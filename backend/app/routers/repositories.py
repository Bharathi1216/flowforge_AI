from datetime import datetime
import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.db.database import get_db
from app.db.models import Repository, User
from app.config import settings
from app.routers.auth import get_current_user
from app.routers.workflows import _upsert_run

router = APIRouter(prefix="/repositories", tags=["repositories"])
GITHUB_HEADERS = {"Accept": "application/vnd.github+json"}
repository_sync_lock = asyncio.Lock()
def _workflow_summary(runs: list) -> tuple[str, int, float | None]:
    if not runs:
        return "unknown", 0, None

    def get_attr(item, key):
        if isinstance(item, dict):
            return item.get(key)
        return getattr(item, key, None)

    failures = sum(1 for run in runs if get_attr(run, "conclusion") == "failure")
    completed = [run for run in runs if get_attr(run, "status") == "completed"]
    successful = sum(1 for run in completed if get_attr(run, "conclusion") == "success")
    success_rate = round(successful / len(completed) * 100, 1) if completed else None
    latest = runs[0]
    latest_status = get_attr(latest, "status")
    latest_conclusion = get_attr(latest, "conclusion")

    if latest_status in {"queued", "in_progress"}:
        status = "running"
    elif latest_conclusion == "success":
        status = "success"
    elif latest_conclusion == "failure":
        status = "failed"
    else:
        status = "warning"
    return status, failures, success_rate


def _repository_payload(repo: Repository, workflow_runs: list | None = None) -> dict:
    if workflow_runs is None:
        runs = sorted(repo.workflow_runs, key=lambda r: r.started_at or r.created_at or datetime.min, reverse=True) if repo.workflow_runs else []
    else:
        runs = workflow_runs
    status, failure_count, success_rate = _workflow_summary(runs)
    return {
        "id": str(repo.github_repo_id or repo.id),
        "name": repo.name,
        "owner": repo.owner,
        "description": repo.description,
        "language": repo.language,
        "isPrivate": repo.is_private,
        "lastWorkflowStatus": status,
        "lastUpdated": repo.updated_at.isoformat() if repo.updated_at else "",
        # The owner is always a contributor; detailed collaborators are loaded
        # only in the repository workspace.
        "contributorCount": 1,
        "openDiscussionsCount": len(repo.discussions) if repo.discussions else 0,
        "failureCount": failure_count,
        "successRate": success_rate,
        "webhookId": repo.webhook_id,
        "webhookRegistered": bool(repo.webhook_id),
        "userAccessRole": "owner" if (
            repo.user and repo.owner.lower() == repo.user.username.lower()
        ) else "developer",
    }


async def _ensure_webhook(repository: Repository, user: User) -> str | None:
    if repository.webhook_id or not settings.WEBHOOK_CALLBACK_URL or not settings.GITHUB_WEBHOOK_SECRET:
        return repository.webhook_id

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"https://api.github.com/repos/{repository.full_name}/hooks",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
            json={
                "name": "web",
                "active": True,
                "events": ["push", "workflow_run"],
                "config": {
                    "url": settings.WEBHOOK_CALLBACK_URL,
                    "content_type": "json",
                    "secret": settings.GITHUB_WEBHOOK_SECRET,
                    "insecure_ssl": "0",
                },
            },
        )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired")
    if response.status_code in {403, 404, 422}:
        return None
    response.raise_for_status()
    repository.webhook_id = str(response.json()["id"])
    return repository.webhook_id


@router.get("")
async def list_repositories(
    refresh: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> list[dict]:
    # Instant load: Serve from local DB if repositories exist and refresh is not requested
    if not refresh:
        existing_repos = (
            db.query(Repository)
            .options(selectinload(Repository.workflow_runs))
            .filter(Repository.user_id == user.id)
            .order_by(Repository.updated_at.desc())
            .all()
        )
        if existing_repos:
            # Repository display is a local read. Webhook registration belongs to
            # synchronization/explicit registration, not the normal read path.
            return [_repository_payload(repo) for repo in existing_repos]

    async with repository_sync_lock:
        return await _list_repositories(user, db)


async def _list_repositories(user: User, db: Session) -> list[dict]:
    if not user.access_token:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired")

    limits = httpx.Limits(max_keepalive_connections=20, max_connections=20)
    async with httpx.AsyncClient(timeout=15, limits=limits) as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
            params={"per_page": 100, "sort": "updated", "direction": "desc", "affiliation": "owner,collaborator,organization_member"},
        )

        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub authorization has expired")
        if response.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="GitHub did not allow access to this account's repositories. Review FlowForge access in GitHub and try again.",
            )
        response.raise_for_status()
        github_repos_data = response.json()

        existing_repos = {
            r.github_repo_id: r
            for r in db.query(Repository).filter(Repository.user_id == user.id).all()
        }

        repositories = []
        for github_repo in github_repos_data:
            repo_gid = str(github_repo["id"])
            repository = existing_repos.get(repo_gid)
            if not repository:
                repository = Repository(user_id=user.id, github_repo_id=repo_gid)
                db.add(repository)
                existing_repos[repo_gid] = repository

            repository.name = github_repo["name"]
            repository.full_name = github_repo["full_name"]
            repository.owner = github_repo["owner"]["login"]
            repository.description = github_repo.get("description")
            repository.language = github_repo.get("language")
            repository.is_private = github_repo.get("private", False)
            repository.default_branch = github_repo.get("default_branch") or "main"
            repository.updated_at = datetime.utcnow()
            repositories.append(repository)

        db.flush()

        if settings.WEBHOOK_CALLBACK_URL and settings.GITHUB_WEBHOOK_SECRET:
            for repository in repositories:
                await _ensure_webhook(repository, user)

        responses = await asyncio.gather(*[
            client.get(
                f"https://api.github.com/repos/{repository.full_name}/actions/runs",
                headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
                params={"per_page": 10},
            )
            for repository in repositories
        ], return_exceptions=True)

    workflow_runs_by_repo: dict[str, list[dict]] = {}
    for repository, runs_response in zip(repositories, responses):
        if isinstance(runs_response, Exception) or runs_response.status_code != 200:
            workflow_runs_by_repo[repository.github_repo_id] = []
            continue
        workflow_runs = runs_response.json().get("workflow_runs", [])
        workflow_runs_by_repo[repository.github_repo_id] = workflow_runs
        for workflow_run in workflow_runs:
            _upsert_run(repository, workflow_run, db)

    db.commit()
    return [_repository_payload(repository, workflow_runs_by_repo.get(repository.github_repo_id, [])) for repository in repositories]


def _find_repository(repo_id: str, user_id: int, db: Session) -> Repository | None:
    repo_filter = (Repository.user_id == user_id) & (
        (Repository.github_repo_id == repo_id) | (Repository.name == repo_id)
    )
    if repo_id.isdigit():
        repo_filter = (Repository.user_id == user_id) & (
            (Repository.github_repo_id == repo_id) | (Repository.name == repo_id) | (Repository.id == int(repo_id))
        )
    return db.query(Repository).options(selectinload(Repository.workflow_runs)).filter(repo_filter).one_or_none()


@router.get("/{repo_id}")
async def get_repository(
    repo_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    repository = _find_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    return _repository_payload(repository)


@router.post("/{repo_id}/webhook")
async def register_webhook(repo_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    if not settings.WEBHOOK_CALLBACK_URL or not settings.GITHUB_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook callback URL and secret are not configured")
    repository = _find_repository(repo_id, user.id, db)
    if not repository or not user.access_token:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repository.webhook_id:
        return {"status": "already_registered", "webhookId": repository.webhook_id}

    webhook_id = await _ensure_webhook(repository, user)
    if not webhook_id:
        raise HTTPException(status_code=403, detail="GitHub did not grant permission to create a webhook for this repository")
    db.commit()
    return {"status": "registered", "webhookId": webhook_id}
@router.get("/{repo_id}/collaborators")
async def list_collaborators(repo_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    repository = _find_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    fallback = [
        {
            "id": str(user.github_id),
            "username": user.username,
            "name": user.name or user.username,
            "avatarUrl": user.avatar_url or "",
            "role": "owner" if user.username.lower() == repository.owner.lower() else "developer",
            "permissions": {"admin": False, "push": True, "pull": True},
            "lastActivity": "Repository access granted on GitHub",
            "issuesResolved": 0,
            "failuresFixed": 0,
        }
    ]

    if not user.access_token:
        return fallback

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"https://api.github.com/repos/{repository.full_name}/collaborators",
                headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
                params={"per_page": 100},
            )
            if response.status_code == 200:
                members = [
                    {
                        "id": str(member.get("id")),
                        "username": member.get("login", ""),
                        "name": member.get("name") or member.get("login", ""),
                        "avatarUrl": member.get("avatar_url", ""),
                        "role": "owner" if (
                            str(member.get("login", "")).lower() == repository.owner.lower()
                        ) else member.get("permissions", {}).get("admin") and "maintainer" or "developer",
                        "permissions": member.get("permissions", {}),
                        "lastActivity": "Repository access granted on GitHub",
                        "issuesResolved": 0,
                        "failuresFixed": 0,
                    }
                    for member in response.json()
                    if member.get("id") is not None and member.get("login")
                ]
                unique_members: dict[str, dict] = {}
                for member in members:
                    unique_members.setdefault(str(member["id"]), member)
                owner = next(
                    (
                        member for member in unique_members.values()
                        if member["username"].lower() == repository.owner.lower()
                    ),
                    None,
                )
                if owner is None and user.username.lower() == repository.owner.lower():
                    unique_members[str(user.github_id)] = fallback[0]
                return list(unique_members.values())
    except httpx.HTTPError:
        pass

    return fallback
