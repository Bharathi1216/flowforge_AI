from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
from sqlalchemy import func, select
from app.services.locks import keyed_lock

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.db.database import get_db, isolated_db
from app.db.models import Repository, User, WorkflowRun, Discussion
from app.config import settings
from app.services.github import github_client, pages
from app.services.identity import find_repository
from app.routers.auth import get_current_user
from app.routers.workflows import _upsert_run

router = APIRouter(prefix="/repositories", tags=["repositories"])
GITHUB_HEADERS = {"Accept": "application/vnd.github+json"}


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
        runs = (
            sorted(
                repo.workflow_runs,
                key=lambda r: r.started_at or r.created_at or datetime.min,
                reverse=True,
            )
            if repo.workflow_runs
            else []
        )
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
        "openDiscussionsCount": getattr(repo, "open_discussions_count", None)
        if hasattr(repo, "open_discussions_count")
        else sum(d.status == "open" for d in repo.discussions),
        "failureCount": failure_count,
        "successRate": success_rate,
        "webhookId": repo.webhook_id,
        "webhookRegistered": bool(repo.webhook_id),
        "userAccessRole": "owner"
        if (repo.user and repo.owner.lower() == repo.user.username.lower())
        else "developer",
    }


def _ensure_webhook(repository: Repository, user: User) -> str | None:
    if (
        repository.webhook_id
        or not settings.WEBHOOK_CALLBACK_URL
        or not settings.GITHUB_WEBHOOK_SECRET
    ):
        return repository.webhook_id

    with github_client(timeout=15) as client:
        response = client.post(
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


def _cached_repositories(user, db, repository_id=None):
    repos = (
        db.query(Repository)
        .options(selectinload(Repository.user))
        .filter(Repository.user_id == user.id, Repository.is_accessible.is_(True))
        .filter(Repository.id == repository_id if repository_id is not None else True)
        .order_by(Repository.updated_at.desc())
        .all()
    )
    if not repos:
        return []
    ids = [r.id for r in repos]
    ranked = (
        select(
            WorkflowRun.repository_id,
            WorkflowRun.status,
            WorkflowRun.conclusion,
            func.row_number()
            .over(
                partition_by=WorkflowRun.repository_id,
                order_by=(WorkflowRun.started_at.desc(), WorkflowRun.id.desc()),
            )
            .label("rank"),
        )
        .where(WorkflowRun.repository_id.in_(ids))
        .subquery()
    )
    runs = defaultdict(list)
    for row in db.execute(select(ranked).where(ranked.c.rank <= 10)).mappings():
        runs[row["repository_id"]].append(dict(row))
    counts = dict(
        db.query(Discussion.repository_id, func.count(Discussion.id))
        .filter(Discussion.repository_id.in_(ids), Discussion.status == "open")
        .group_by(Discussion.repository_id)
        .all()
    )
    for repo in repos:
        repo.open_discussions_count = counts.get(repo.id, 0)
    return [_repository_payload(repo, runs[repo.id]) for repo in repos]


@router.get("")
@isolated_db
def list_repositories(
    refresh: bool = False, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    cached = _cached_repositories(user, db)
    if cached and not refresh:
        return cached
    requested_at = datetime.now(timezone.utc)
    db.rollback()
    with keyed_lock(("repositories", user.id)):
        latest = (
            db.query(func.max(Repository.updated_at)).filter(Repository.user_id == user.id).scalar()
        )
        if latest and latest >= requested_at:
            return _cached_repositories(user, db)
        return _list_repositories(user, db)


def _list_repositories(user: User, db: Session) -> list[dict]:
    if not user.access_token:
        raise HTTPException(401, "GitHub authorization has expired")
    headers = {**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"}
    with github_client() as client:
        github_repos_data = pages(
            client,
            "https://api.github.com/user/repos",
            headers=headers,
            params={
                "sort": "updated",
                "direction": "desc",
                "affiliation": "owner,collaborator,organization_member",
            },
        )
        # Worker tasks receive only strings and make HTTP calls, never ORM calls.
        names = [repo["full_name"] for repo in github_repos_data]

        def fetch_runs(full_name):
            response = client.get(
                f"https://api.github.com/repos/{full_name}/actions/runs",
                headers=headers,
                params={"per_page": 10},
            )
            if response.status_code == 404:
                return []
            response.raise_for_status()
            return response.json().get("workflow_runs", [])

        with ThreadPoolExecutor(max_workers=5) as executor:
            run_batches = list(executor.map(fetch_runs, names))
    existing = {
        repo.github_repo_id: repo
        for repo in db.query(Repository).filter(Repository.user_id == user.id)
    }
    seen = set()
    for account, batch in zip(github_repos_data, run_batches):
        gid = str(account["id"])
        seen.add(gid)
        repo = existing.get(gid)
        if repo is None:
            repo = Repository(user_id=user.id, github_repo_id=gid)
            db.add(repo)
        for attr, value in {
            "name": account["name"],
            "full_name": account["full_name"],
            "owner": account["owner"]["login"],
            "description": account.get("description"),
            "language": account.get("language"),
            "is_private": account.get("private", False),
            "default_branch": account.get("default_branch") or "main",
            "is_accessible": True,
            "updated_at": datetime.now(timezone.utc),
        }.items():
            setattr(repo, attr, value)
        db.flush()
        for run in batch:
            _upsert_run(repo, run, db)
    # A complete successful membership sync hides revoked repositories without deleting history.
    for gid, repo in existing.items():
        if gid not in seen:
            repo.is_accessible = False
    db.commit()
    return _cached_repositories(user, db)


def _find_repository(repo_id: str, user_id: int, db: Session) -> Repository | None:
    return find_repository(repo_id, user_id, db)


@router.get("/{repo_id}")
@isolated_db
def get_repository(
    repo_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    repository = _find_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    return next(
        payload
        for payload in _cached_repositories(user, db, repository.id)
        if payload["id"] == str(repository.github_repo_id or repository.id)
    )


@router.post("/{repo_id}/webhook")
@isolated_db
def register_webhook(
    repo_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict[str, str]:
    if not settings.WEBHOOK_CALLBACK_URL or not settings.GITHUB_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503, detail="Webhook callback URL and secret are not configured"
        )
    repository = _find_repository(repo_id, user.id, db)
    if not repository or not user.access_token:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repository.webhook_id:
        return {"status": "already_registered", "webhookId": repository.webhook_id}

    webhook_id = _ensure_webhook(repository, user)
    if not webhook_id:
        raise HTTPException(
            status_code=403,
            detail="GitHub did not grant permission to create a webhook for this repository",
        )
    db.commit()
    return {"status": "registered", "webhookId": webhook_id}


@router.get("/{repo_id}/collaborators")
@isolated_db
def list_collaborators(
    repo_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
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
        with github_client(timeout=15) as client:
            response = client.get(
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
                        "role": "owner"
                        if (str(member.get("login", "")).lower() == repository.owner.lower())
                        else member.get("permissions", {}).get("admin")
                        and "maintainer"
                        or "developer",
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
                        member
                        for member in unique_members.values()
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
