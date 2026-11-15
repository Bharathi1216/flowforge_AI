import re
import json
from typing import Literal
from app.services.locks import keyed_lock
from app.routers.workflows import _parse_datetime
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from app.db.database import get_db, isolated_db
from app.db.models import Discussion, DiscussionComment, Repository, User, WorkflowRun
from app.services.github import github_client, pages
from app.services.identity import find_repository
from app.routers.auth import get_current_user

router = APIRouter(prefix="/repositories/{repo_id}/discussions", tags=["discussions"])
GITHUB_API = "https://api.github.com"
GITHUB_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


class ContentModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class DiscussionCreate(ContentModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=60000)
    run_id: str | None = None


class DiscussionUpdate(ContentModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[str] = Field(default=None, min_length=1, max_length=60000)
    status: Literal["open", "closed", "resolved"] | None = None


class CommentCreate(ContentModel):
    content: str = Field(min_length=1, max_length=60000)


RUN_MARKER = re.compile(r"<!--\s*flowforge-run-id:([^\s>]+)\s*-->")


def _repository(repo_id, user_id, db):
    repository = find_repository(repo_id, user_id, db)
    if not repository:
        raise HTTPException(404, "Repository not found")
    return repository


def _github_headers(user: User) -> dict[str, str]:
    if not user.access_token:
        raise HTTPException(
            status_code=401, detail="GitHub authorization has expired. Reconnect your account."
        )
    return {**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"}


def _raise_github_error(response: httpx.Response, action: str) -> None:
    if response.status_code < 400:
        return
    if response.status_code == 401:
        raise HTTPException(
            status_code=401, detail="GitHub authorization has expired. Reconnect your account."
        )
    if response.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail=f"GitHub denied permission to {action}. Confirm you have write access and that Issues are enabled for this repository.",
        )
    if response.status_code == 404:
        raise HTTPException(
            status_code=404, detail="The repository or discussion could not be found on GitHub."
        )
    if response.status_code == 410:
        raise HTTPException(
            status_code=409, detail="GitHub Issues are disabled for this repository."
        )
    if response.status_code == 422:
        raise HTTPException(
            status_code=422,
            detail="GitHub rejected the discussion content. Check the title and body and try again.",
        )
    raise HTTPException(
        status_code=502, detail=f"GitHub could not {action} (HTTP {response.status_code})."
    )


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
        "repoId": str(repository.github_repo_id),
        "runId": RUN_MARKER.search(issue.get("body") or "").group(1)
        if RUN_MARKER.search(issue.get("body") or "")
        else None,
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


def _sync_discussion_to_db(issue, repository, user, db):
    marker = RUN_MARKER.search(issue.get("body") or "")
    run = (
        db.query(WorkflowRun)
        .filter_by(repository_id=repository.id, github_run_id=marker.group(1))
        .one_or_none()
        if marker
        else None
    )
    disc = (
        db.query(Discussion)
        .filter_by(repository_id=repository.id, github_issue_number=int(issue["number"]))
        .one_or_none()
    )
    if disc is None and run:
        disc = (
            db.query(Discussion)
            .filter_by(repository_id=repository.id, workflow_run_id=run.id)
            .one_or_none()
        )
    if disc is None:
        disc = Discussion(repository_id=repository.id)
        db.add(disc)
    author = (
        db.query(User).filter_by(github_id=str((issue.get("user") or {}).get("id"))).one_or_none()
    )
    disc.user_id = author.id if author else None
    disc.github_issue_number = int(issue["number"])
    disc.title = issue.get("title") or "Untitled discussion"
    disc.content = RUN_MARKER.sub("", issue.get("body") or "").rstrip()
    disc.status = "open" if issue.get("state") == "open" else "resolved"
    if run:
        disc.workflow_run_id = run.id
    disc.created_at = _parse_datetime(issue.get("created_at")) or disc.created_at
    disc.updated_at = _parse_datetime(issue.get("updated_at")) or disc.updated_at
    disc.github_payload = json.dumps(issue)
    db.flush()
    return disc


def _sync_comments_to_db(discussion, comments_data, user, db):
    for comment in comments_data:
        record = (
            db.query(DiscussionComment)
            .filter_by(discussion_id=discussion.id, github_comment_id=str(comment["id"]))
            .one_or_none()
        )
        if record is None:
            record = DiscussionComment(
                discussion_id=discussion.id, github_comment_id=str(comment["id"])
            )
            db.add(record)
        author = (
            db.query(User)
            .filter_by(github_id=str((comment.get("user") or {}).get("id")))
            .one_or_none()
        )
        record.user_id = author.id if author else None
        record.content = comment.get("body") or ""
        record.created_at = _parse_datetime(comment.get("created_at")) or record.created_at
        record.github_payload = json.dumps(comment)
    db.flush()


def _local_payload(disc, repository):
    if disc.github_payload:
        return _discussion_payload(json.loads(disc.github_payload), repository)
    author = disc.author
    return {
        "id": str(disc.github_issue_number) if disc.github_issue_number else f"local-{disc.id}",
        "repoId": str(repository.github_repo_id),
        "runId": disc.workflow_run.github_run_id if disc.workflow_run else None,
        "title": disc.title,
        "content": disc.content or "",
        "status": disc.status,
        "author": {
            "id": str(author.github_id) if author else "unknown",
            "username": author.username if author else "unknown",
            "name": author.name if author else "Unknown author",
            "avatarUrl": author.avatar_url if author else "",
        },
        "createdAt": disc.created_at.isoformat() if disc.created_at else None,
        "updatedAt": disc.updated_at.isoformat() if disc.updated_at else None,
        "participants": [],
        "commentsCount": len(disc.comments),
    }


@router.get("")
@isolated_db
def list_discussions(
    repo_id: str,
    cached: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    repository = _repository(repo_id, user.id, db)
    if cached:
        return [
            _local_payload(disc, repository)
            for disc in db.query(Discussion)
            .filter_by(repository_id=repository.id)
            .order_by(Discussion.updated_at.desc())
        ]
    with github_client() as client:
        issues = pages(
            client,
            f"{GITHUB_API}/repos/{repository.full_name}/issues",
            headers=_github_headers(user),
            params={"state": "all"},
        )
    issues = [issue for issue in issues if "pull_request" not in issue]
    with keyed_lock(("discussions", repository.id)):
        for issue in issues:
            _sync_discussion_to_db(issue, repository, user, db)
        db.commit()
    return [_discussion_payload(issue, repository) for issue in issues]


@router.get("/{discussion_id}")
@isolated_db
def get_discussion(
    repo_id: str,
    discussion_id: str,
    cached: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)
    if cached:
        disc = (
            db.query(Discussion)
            .filter_by(repository_id=repository.id, github_issue_number=int(discussion_id))
            .one_or_none()
            if discussion_id.isdigit()
            else None
        )
        if disc is None:
            raise HTTPException(404, "Discussion not found")
        return {
            "discussion": _local_payload(disc, repository),
            "comments": [
                _comment_payload(json.loads(comment.github_payload), discussion_id)
                for comment in disc.comments
                if comment.github_payload
            ],
        }
    with github_client() as client:
        response = client.get(
            f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}",
            headers=_github_headers(user),
        )
        _raise_github_error(response, "load discussion")
        issue = response.json()
        if "pull_request" in issue:
            raise HTTPException(404, "Discussion not found")
        comments = pages(
            client,
            f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}/comments",
            headers=_github_headers(user),
        )
    with keyed_lock(("discussions", repository.id)):
        disc = _sync_discussion_to_db(issue, repository, user, db)
        _sync_comments_to_db(disc, comments, user, db)
        db.commit()
    return {
        "discussion": _discussion_payload(issue, repository),
        "comments": [_comment_payload(comment, discussion_id) for comment in comments],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@isolated_db
def create_discussion(
    repo_id: str,
    payload: DiscussionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)
    with keyed_lock(("discussions", repository.id)):
        run = None
        if payload.run_id:
            run = (
                db.query(WorkflowRun)
                .filter_by(repository_id=repository.id, github_run_id=payload.run_id)
                .one_or_none()
            )
            if run is None:
                raise HTTPException(404, "Workflow run not found")
            existing = (
                db.query(Discussion)
                .filter_by(repository_id=repository.id, workflow_run_id=run.id)
                .one_or_none()
            )
            if existing and existing.github_issue_number:
                return _local_payload(existing, repository)
        body = payload.content + (
            f"\n\n<!-- flowforge-run-id:{run.github_run_id} -->" if run else ""
        )
        with github_client() as client:
            response = client.post(
                f"{GITHUB_API}/repos/{repository.full_name}/issues",
                headers=_github_headers(user),
                json={"title": payload.title, "body": body},
            )
        _raise_github_error(response, "create discussion")
        issue = response.json()
        _sync_discussion_to_db(issue, repository, user, db)
        db.commit()
        return _discussion_payload(issue, repository)


@router.patch("/{discussion_id}")
@isolated_db
def update_discussion(
    repo_id: str,
    discussion_id: str,
    payload: DiscussionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)
    updates = {}
    if payload.title is not None:
        updates["title"] = payload.title
    with keyed_lock(("discussions", repository.id)):
        with github_client() as client:
            if payload.content is not None:
                # Read the source marker, including when this issue is not cached locally.
                response = client.get(
                    f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}",
                    headers=_github_headers(user),
                )
                _raise_github_error(response, "load discussion")
                marker = RUN_MARKER.search(response.json().get("body") or "")
                updates["body"] = RUN_MARKER.sub("", payload.content).rstrip() + (
                    f"\n\n{marker.group(0)}" if marker else ""
                )
            if payload.status:
                updates["state"] = "open" if payload.status == "open" else "closed"
            if not updates:
                raise HTTPException(422, "No discussion changes supplied")
            response = client.patch(
                f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}",
                headers=_github_headers(user),
                json=updates,
            )
        _raise_github_error(response, "update discussion")
        issue = response.json()
        _sync_discussion_to_db(issue, repository, user, db)
        db.commit()
        return _discussion_payload(issue, repository)


@router.post("/{discussion_id}/comments", status_code=status.HTTP_201_CREATED)
@isolated_db
def create_comment(
    repo_id: str,
    discussion_id: str,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _repository(repo_id, user.id, db)
    with keyed_lock(("discussions", repository.id)):
        with github_client() as client:
            issue_response = client.get(
                f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}",
                headers=_github_headers(user),
            )
            _raise_github_error(issue_response, "load discussion")
            disc = _sync_discussion_to_db(issue_response.json(), repository, user, db)
            response = client.post(
                f"{GITHUB_API}/repos/{repository.full_name}/issues/{discussion_id}/comments",
                headers=_github_headers(user),
                json={"body": payload.content},
            )
        _raise_github_error(response, "post comment")
        comment = response.json()
        _sync_comments_to_db(disc, [comment], user, db)
        db.commit()
        return _comment_payload(comment, discussion_id)
