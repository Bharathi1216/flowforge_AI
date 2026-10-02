from datetime import datetime
from io import BytesIO
import re
from zipfile import BadZipFile, ZipFile

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import FailureLog, Repository, RunStep, User, WorkflowRun
from app.routers.auth import get_current_user

router = APIRouter(prefix="/repositories/{repo_id}/workflows", tags=["workflows"])
GITHUB_HEADERS = {"Accept": "application/vnd.github+json"}


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def _status(run: dict) -> tuple[str, str | None]:
    status = run.get("status") or "queued"
    conclusion = run.get("conclusion")
    if status == "completed":
        return ("success" if conclusion == "success" else "failed" if conclusion == "failure" else conclusion or "completed", conclusion)
    return status, conclusion


def _payload(run: WorkflowRun) -> dict:
    status = "running" if run.status in {"queued", "in_progress"} else run.status
    if status == "completed":
        status = "success" if run.conclusion == "success" else "failed" if run.conclusion == "failure" else "warning"
    failure = run.failure_logs[0] if run.failure_logs else None
    payload = {
        "id": run.github_run_id,
        "name": run.workflow_name,
        "runNumber": run.run_number,
        "status": status,
        "branch": run.branch,
        "commitSha": run.commit_sha,
        "commitMessage": run.commit_message or "",
        "durationSeconds": run.duration_seconds or 0,
        "startedAt": run.started_at.isoformat() if run.started_at else None,
        "completedAt": run.completed_at.isoformat() if run.completed_at else None,
        "timestamp": run.created_at.isoformat() if run.created_at else None,
        "triggeredBy": {
            "id": run.author_username or "",
            "username": run.author_username or "unknown",
            "name": run.author_username or "unknown",
            "avatarUrl": run.author_avatar_url or "",
            "email": "",
            "githubUrl": "",
        },
    }
    if failure:
        payload["diagnosticInfo"] = {
            "errorType": failure.step_name or "GitHub Actions failure",
            "errorSnippet": failure.error_snippet or "",
            "rootCause": failure.root_cause or "",
            "suggestedFix": failure.suggested_fix or "",
        }
    return payload


def _upsert_run(repository: Repository, github_run: dict, db: Session) -> WorkflowRun:
    status, conclusion = _status(github_run)
    workflow_run = db.query(WorkflowRun).filter(WorkflowRun.github_run_id == str(github_run["id"])).one_or_none()
    if not workflow_run:
        workflow_run = WorkflowRun(repository_id=repository.id, github_run_id=str(github_run["id"]))
        db.add(workflow_run)

    workflow_run.workflow_name = github_run.get("name") or "GitHub Actions"
    workflow_run.run_number = github_run.get("run_number") or 0
    workflow_run.status = status
    workflow_run.conclusion = conclusion
    workflow_run.branch = github_run.get("head_branch") or repository.default_branch or "main"
    workflow_run.commit_sha = github_run.get("head_sha")
    workflow_run.commit_message = github_run.get("head_commit", {}).get("message") or github_run.get("display_title")
    actor = github_run.get("actor") or {}
    workflow_run.author_username = actor.get("login")
    workflow_run.author_avatar_url = actor.get("avatar_url")
    workflow_run.started_at = _parse_datetime(github_run.get("run_started_at") or github_run.get("created_at"))
    workflow_run.completed_at = _parse_datetime(github_run.get("updated_at")) if status == "completed" else None
    if workflow_run.started_at and workflow_run.completed_at:
        workflow_run.duration_seconds = max(0, int((workflow_run.completed_at - workflow_run.started_at).total_seconds()))
    return workflow_run


def _log_lines(raw_logs: str, section: str) -> list[dict]:
    lines = []
    timestamp_pattern = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s?(.*)$")
    for index, raw_line in enumerate(raw_logs.splitlines(), start=1):
        match = timestamp_pattern.match(raw_line)
        timestamp = match.group(1) if match else datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
        message = match.group(2) if match else raw_line
        lowered = message.lower()
        line_type = "error" if any(marker in lowered for marker in ("error", "exception", "failed")) else "warn" if "warning" in lowered else "info"
        lines.append({
            "lineNumber": index,
            "timestamp": timestamp,
            "type": line_type,
            "message": message,
            "section": section,
        })
    return lines


async def _github_runs(repository: Repository, user: User) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"https://api.github.com/repos/{repository.full_name}/actions/runs",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
            params={"per_page": 50},
        )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired")
    response.raise_for_status()
    return response.json().get("workflow_runs", [])


def _find_workflow_repository(repo_id: str, user_id: int, db: Session) -> Repository | None:
    repo_filter = (Repository.user_id == user_id) & (
        (Repository.github_repo_id == repo_id) | (Repository.name == repo_id)
    )
    if repo_id.isdigit():
        repo_filter = (Repository.user_id == user_id) & (
            (Repository.github_repo_id == repo_id) | (Repository.name == repo_id) | (Repository.id == int(repo_id))
        )
    return db.query(Repository).filter(repo_filter).one_or_none()


@router.get("")
async def list_workflow_runs(
    repo_id: str,
    refresh: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> list[dict]:
    repository = _find_workflow_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    existing_runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.repository_id == repository.id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(50)
        .all()
    )
    if existing_runs and not refresh:
        return [_payload(run) for run in existing_runs]

    if not user.access_token:
        return [_payload(run) for run in existing_runs]

    try:
        for github_run in await _github_runs(repository, user):
            _upsert_run(repository, github_run, db)
        db.commit()
    except Exception:
        return [_payload(run) for run in existing_runs]

    runs = db.query(WorkflowRun).filter(WorkflowRun.repository_id == repository.id).order_by(WorkflowRun.created_at.desc()).limit(50).all()
    return [_payload(run) for run in runs]


@router.get("/definitions")
async def list_workflows(repo_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    repository = _find_workflow_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not user.access_token:
        return []

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"https://api.github.com/repos/{repository.full_name}/actions/workflows",
                headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
            )
            if response.status_code == 200:
                return [
                    {
                        "id": str(workflow["id"]),
                        "name": workflow["name"],
                        "path": workflow["path"],
                        "status": "active" if workflow.get("state") == "active" else "inactive",
                    }
                    for workflow in response.json().get("workflows", [])
                ]
    except Exception:
        pass
    return []


@router.get("/{run_id}/logs")
async def get_workflow_logs(repo_id: str, run_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    repository = _find_workflow_repository(repo_id, user.id, db)
    workflow_run = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.repository_id == repository.id if repository else False, WorkflowRun.github_run_id == run_id)
        .one_or_none()
    )
    if not repository or not workflow_run or not user.access_token:
        raise HTTPException(status_code=404, detail="Workflow run not found")

    persisted_logs = db.query(FailureLog).filter(FailureLog.workflow_run_id == workflow_run.id).all()
    if persisted_logs and all(log.raw_logs is not None for log in persisted_logs):
        return [line for log in persisted_logs for line in _log_lines(log.raw_logs or "", log.step_name or "GitHub Actions")]

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        jobs_response = await client.get(
            f"https://api.github.com/repos/{repository.full_name}/actions/runs/{run_id}/jobs",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
        )
        jobs_response.raise_for_status()
        jobs = jobs_response.json().get("jobs", [])
        lines: list[dict] = []

        for job in jobs:
            logs_response = await client.get(
                f"https://api.github.com/repos/{repository.full_name}/actions/jobs/{job['id']}/logs",
                headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
            )
            if logs_response.status_code in (403, 404):
                continue
            logs_response.raise_for_status()
            try:
                archive = ZipFile(BytesIO(logs_response.content))
                raw_logs = "\n".join(archive.read(filename).decode("utf-8", errors="replace") for filename in archive.namelist())
            except BadZipFile:
                raw_logs = logs_response.text

            error_lines = [line for line in raw_logs.splitlines() if any(marker in line.lower() for marker in ("error", "exception", "failed"))]
            error_snippet = "\n".join(error_lines[-20:])
            existing = db.query(FailureLog).filter(FailureLog.workflow_run_id == workflow_run.id, FailureLog.step_name == job.get("name")).one_or_none()
            if not existing:
                existing = FailureLog(workflow_run_id=workflow_run.id, step_name=job.get("name"))
                db.add(existing)
            existing.raw_logs = raw_logs
            existing.error_snippet = error_snippet or None

            # Index into ChromaDB vector store
            if error_snippet:
                try:
                    from app.services.vector_store import vector_store
                    vector_store.index_failure(
                        repo_id=str(repository.id),
                        run_id=workflow_run.github_run_id,
                        run_number=workflow_run.run_number,
                        workflow_name=workflow_run.workflow_name,
                        step_name=job.get("name") or "GitHub Actions",
                        error_snippet=error_snippet,
                        root_cause=existing.root_cause or "",
                        suggested_fix=existing.suggested_fix or "",
                        exit_code=1,
                    )
                except Exception:
                    pass

            lines.extend(_log_lines(raw_logs, job.get("name") or "GitHub Actions"))

    db.commit()
    return lines


@router.post("/{run_id}/retry", status_code=202)
async def retry_workflow(repo_id: str, run_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    repository = _find_workflow_repository(repo_id, user.id, db)
    if not repository or not user.access_token:
        raise HTTPException(status_code=404, detail="Repository not found")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"https://api.github.com/repos/{repository.full_name}/actions/runs/{run_id}/rerun-failed-jobs",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
        )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    response.raise_for_status()
    return {"status": "queued"}
