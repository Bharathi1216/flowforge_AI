import re
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Discussion, DiscussionComment, Repository, User, WorkflowRun
from app.routers.auth import get_current_user

router = APIRouter(prefix="/repositories/{repo_id}/discussions", tags=["discussions"])
GITHUB_API = "https://api.github.com"
GITHUB_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


class DiscussionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    run_id: str | None = None


RUN_MARKER = re.compile(r"<!--\s*flowforge-run-id:([^\s>]+)\s*-->")


class DiscussionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: Optional[str] = None
    status: Optional[str] = Field(default=None, description="'open' or 'resolved' / 'closed'")


class CommentCreate(BaseModel):
    content: str = Field(min_length=1)


def _repository(repo_id: str, user_id: int, db: Session) -> Repository:
    matches = (Repository.github_repo_id == repo_id) | (Repository.name == repo_id)
    if repo_id.isdigit():
        matches = matches | (Repository.id == int(repo_id))
    repository = (
        db.query(Repository)
        .filter(Repository.user_id == user_id, matches)
        .one_or_none()
    )
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repository


def _github_headers(user: User) -> dict[str, str]:
    if not user.access_token:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired. Reconnect your account.")
    return {**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"}


def _raise_github_error(response: httpx.Response, action: str) -> None:
    if response.status_code < 400:
        return
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired. Reconnect your account.")
    if response.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail=f"GitHub denied permission to {action}. Confirm you have write access and that Issues are enabled for this repository.",
        )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="The repository or discussion could not be found on GitHub.")
    if response.status_code == 410:
        raise HTTPException(status_code=409, detail="GitHub Issues are disabled for this repository.")
    if response.status_code == 422:
        raise HTTPException(status_code=422, detail="GitHub rejected the discussion content. Check the title and body and try again.")
    raise HTTPException(status_code=502, detail=f"GitHub could not {action} (HTTP {response.status_code}).")


def _user_payload(account: dict | None) -> dict[str, str]:
    account = account or {}
    username = account.get("login") or "unknown"
    return {
        "id": str(account.get("id") or username),
        "username": username,
        "name": username,
        "avatarUrl": account.get("avatar_url") or "",
        "email": "",
        "githubUrl": account.get("html_url") or "",
    }


def _discussion_payload(issue: dict, repository: Repository) -> dict:
    author = _user_payload(issue.get("user"))
    body = RUN_MARKER.sub("", issue.get("body") or "").rstrip()
    return {
        "id": str(issue["number"]),
        "repoId": repository.name,
        "runId": None,
        "title": issue.get("title") or "Untitled discussion",
        "content": body,
        "author": author,
        "status": "open" if issue.get("state") == "open" else "resolved",
        "createdAt": issue.get("created_at"),
        "updatedAt": issue.get("updated_at"),
        "timestamp": issue.get("created_at"),
        "participants": [author],
        "commentsCount": issue.get("comments") or 0,
    }


def _comment_payload(comment: dict, issue_number: str) -> dict:
    return {
        "id": str(comment["id"]),
        "discussionId": issue_number,
        "author": _user_payload(comment.get("user")),
        "content": comment.get("body") or "",
        "createdAt": comment.get("created_at"),
        "timestamp": comment.get("created_at"),
    }


def _sync_discussion_to_db(issue: dict, repository: Repository, user: User, db: Session) -> Discussion:
    title = issue.get("title") or "Untitled discussion"
    status_str = "open" if issue.get("state") == "open" else "resolved"
    body = issue.get("body") or ""
    display_body = RUN_MARKER.sub("", body).rstrip()
    marker = RUN_MARKER.search(body)
    workflow_run = None
    if marker:
        workflow_run = (
            db.query(WorkflowRun)
            .filter(
                WorkflowRun.repository_id == repository.id,
                WorkflowRun.github_run_id == marker.group(1),
            )
            .one_or_none()
        )
    disc = (
        db.query(Discussion)
        .filter(
            Discussion.repository_id == repository.id,
            Discussion.github_issue_number == int(issue["number"]),
        )
        .first()
    ).first()
    if not disc and workflow_run:
        disc = (
            db.query(Discussion)
            .filter(
                Discussion.repository_id == repository.id,
                Discussion.workflow_run_id == workflow_run.id,
            )
            .first()
        )
    if not disc:
        disc = Discussion(
            repository_id=repository.id,
            user_id=user.id,
            github_issue_number=int(issue["number"]),
            title=title,
            content=display_body,
            status=status_str,
            workflow_run_id=workflow_run.id if workflow_run else None,
        )
        db.add(disc)
        db.flush()
    else:
        disc.status = status_str
        disc.content = display_body
    return disc


def _sync_comments_to_db(discussion: Discussion, comments_data: list[dict], user: User, db: Session):
    if not discussion.id:
        db.flush()
    for c in comments_data:
        c_body = c.get("body") or ""
        existing = (
            db.query(DiscussionComment)
            .filter(
                DiscussionComment.discussion_id == discussion.id,
                DiscussionComment.github_comment_id == str(c["id"]),
            )
            .first()
        )
        if not existing:
            new_comment = DiscussionComment(
                discussion_id=discussion.id,
                user_id=user.id,
                github_comment_id=str(c["id"]),
                content=c_body,
            )
            db.add(new_comment)


@router.get("")
async def list_discussions(
    repo_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    repository = _repository(repo_id, user.id, db)
    local_discs = db.query(Discussion).filter(Discussion.repository_id == repository.id).order_by(Discussion.created_at.desc()).all()

    if user.access_token:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    f"{GITHUB_API}/repos/{repository.full_name}/issues",
                    headers=_github_headers(user),
                    params={"state": "all", "per_page": 30},
                )
            if response.status_code == 200:
                issues = response.json()
                valid_issues = [issue for issue in issues if "pull_request" not in issue]
                for issue in valid_issues:
                    _sync_discussion_to_db(issue, repository, user, db)
                db.commit()
                return [_discussion_payload(issue, repository) for issue in valid_issues]
        except Exception:
            pass

    return [
        {
            "id": str(d.id),
            "repoId": str(repository.id),
            "title": d.title,
            "content": d.content or "",
            "author": {"id": str(user.id), "username": user.username, "name": user.name or user.username, "avatarUrl": user.avatar_url or "", "githubUrl": user.github_url or ""},
            "status": d.status or "open",
            "createdAt": d.created_at.isoformat() if d.created_at else "",
            "updatedAt": d.updated_at.isoformat() if d.updated_at else "",
            "participants": [{"id": str(user.id), "username": user.username, "name": user.name or user.username, "avatarUrl": user.avatar_url or "", "githubUrl": user.github_url or ""}],
            "commentsCount": len(d.comments) if d.comments else 0,
        }
        for d in local_discs
    ]


@router.get("/{discussion_id}")
async def get_discussion(
    repo_id: str,
    discussion_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)

    if user.access_token:
        try:
            headers = _github_headers(user)
            async with httpx.AsyncClient(timeout=15) as client:
                issue_response = await client.get(
                    f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}",
                    headers=headers,
                )
                if issue_response.status_code == 200:
                    comments_response = await client.get(
                        f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}/comments",
                        headers=headers,
                        params={"per_page": 100},
                    )
                    issue_data = issue_response.json()
                    comments_data = comments_response.json() if comments_response.status_code == 200 else []

                    disc = _sync_discussion_to_db(issue_data, repository, user, db)
                    _sync_comments_to_db(disc, comments_data, user, db)
                    db.commit()

                    return {
                        "discussion": _discussion_payload(issue_data, repository),
                        "comments": [_comment_payload(comment, discussion_id) for comment in comments_data],
                    }
        except Exception:
            pass

    disc_match = (Discussion.repository_id == repository.id) & (Discussion.id == int(discussion_id) if discussion_id.isdigit() else False)
    disc = db.query(Discussion).filter(disc_match).first()
    if not disc:
        raise HTTPException(status_code=404, detail="Discussion not found")

    return {
        "discussion": {
            "id": str(disc.id),
            "repoId": str(repository.id),
            "title": disc.title,
            "content": disc.content or "",
            "author": {"id": str(user.id), "username": user.username, "name": user.name or user.username, "avatarUrl": user.avatar_url or "", "githubUrl": user.github_url or ""},
            "status": disc.status or "open",
            "createdAt": disc.created_at.isoformat() if disc.created_at else "",
            "updatedAt": disc.updated_at.isoformat() if disc.updated_at else "",
            "participants": [{"id": str(user.id), "username": user.username, "name": user.name or user.username, "avatarUrl": user.avatar_url or "", "githubUrl": user.github_url or ""}],
            "commentsCount": len(disc.comments) if disc.comments else 0,
        },
        "comments": [
            {
                "id": str(c.id),
                "discussionId": str(disc.id),
                "author": {"id": str(user.id), "username": user.username, "name": user.name or user.username, "avatarUrl": user.avatar_url or "", "githubUrl": user.github_url or ""},
                "content": c.content,
                "createdAt": c.created_at.isoformat() if c.created_at else "",
            }
            for c in (disc.comments or [])
        ],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_discussion(
    repo_id: str,
    payload: DiscussionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)
    body = payload.content.strip()
    workflow_run = None
    if payload.run_id:
        run_filter = (
            (WorkflowRun.repository_id == repository.id)
            & (WorkflowRun.github_run_id == str(payload.run_id))
        )
        if str(payload.run_id).isdigit():
            run_filter = (
                (WorkflowRun.repository_id == repository.id)
                & (
                    (WorkflowRun.github_run_id == str(payload.run_id))
                    | (WorkflowRun.id == int(payload.run_id))
                )
            )
        workflow_run = db.query(WorkflowRun).filter(run_filter).one_or_none()
        if workflow_run:
            existing = (
                db.query(Discussion)
                .filter(
                    Discussion.repository_id == repository.id,
                    Discussion.workflow_run_id == workflow_run.id,
                )
                .first()
            )
            if existing:
                if existing.github_issue_number:
                    return _discussion_payload(
                        {
                            "number": existing.github_issue_number,
                            "title": existing.title,
                            "body": existing.content,
                            "state": "closed" if existing.status == "resolved" else "open",
                            "created_at": existing.created_at.isoformat() if existing.created_at else None,
                            "updated_at": existing.updated_at.isoformat() if existing.updated_at else None,
                            "user": {"login": user.username, "id": user.github_id, "avatar_url": user.avatar_url},
                            "comments": len(existing.comments or []),
                        },
                        repository,
                    )
        body = f"{body}\n\n<!-- flowforge-run-id:{workflow_run.github_run_id if workflow_run else payload.run_id} -->"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{GITHUB_API}/repos/{repository.full_name}/issues",
            headers=_github_headers(user),
            json={"title": payload.title.strip(), "body": body},
        )
    _raise_github_error(response, "create a discussion")
    created_issue = response.json()

    # Mirror to local DB
    discussion = _sync_discussion_to_db(created_issue, repository, user, db)
    if workflow_run:
        discussion.workflow_run_id = workflow_run.id
    db.commit()

    return _discussion_payload(created_issue, repository)


@router.patch("/{discussion_id}")
async def update_discussion(
    repo_id: str,
    discussion_id: str,
    payload: DiscussionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)
    update_data: dict[str, str] = {}

    if payload.title is not None:
        update_data["title"] = payload.title.strip()
    if payload.content is not None:
        update_data["body"] = payload.content.strip()
    if payload.status is not None:
        # Convert "resolved" / "closed" to "closed", "open" to "open"
        gh_state = "closed" if payload.status.lower() in {"resolved", "closed"} else "open"
        update_data["state"] = gh_state
        if gh_state == "closed":
            update_data["state_reason"] = "completed"

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.patch(
            f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}",
            headers=_github_headers(user),
            json=update_data,
        )
    _raise_github_error(response, "update discussion")
    updated_issue = response.json()

    # Mirror to local DB
    _sync_discussion_to_db(updated_issue, repository, user, db)
    db.commit()

    return _discussion_payload(updated_issue, repository)


@router.post("/{discussion_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_comment(
    repo_id: str,
    discussion_id: str,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}/comments",
            headers=_github_headers(user),
            json={"body": payload.content.strip()},
        )
    _raise_github_error(response, "post a discussion comment")
    created_comment = response.json()

    # Mirror comment to local DB
    disc = (
        db.query(Discussion)
        .filter(Discussion.repository_id == repository.id)
        .first()
    )
    if disc:
        new_comment = DiscussionComment(
            discussion_id=disc.id,
            user_id=user.id,
            content=payload.content.strip(),
        )
        db.add(new_comment)
        db.commit()

    return _comment_payload(created_comment, discussion_id)