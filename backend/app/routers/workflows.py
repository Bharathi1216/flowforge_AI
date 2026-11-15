from datetime import datetime, timezone
from io import BytesIO
import re
import logging
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_, or_
from sqlalchemy.dialects.postgresql import insert
from app.config import settings
from app.services.locks import keyed_lock

from app.db.database import get_db, isolated_db
from app.db.models import FailureLog, Repository, User, WorkflowRun
from app.services.github import github_client, pages
from app.services.identity import find_repository
from app.routers.auth import get_current_user

router = APIRouter(prefix="/repositories/{repo_id}/workflows", tags=["workflows"])
GITHUB_HEADERS = {"Accept": "application/vnd.github+json"}
logger = logging.getLogger(__name__)


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return (
        parsed.replace(tzinfo=timezone.utc)
        if parsed.tzinfo is None
        else parsed.astimezone(timezone.utc)
    )


def _status(run: dict) -> tuple[str, str | None]:
    status = run.get("status") or "queued"
    conclusion = run.get("conclusion")
    return status, conclusion


def _payload(run: WorkflowRun) -> dict:
    status = (
        "running"
        if run.status in {"queued", "in_progress", "waiting", "pending", "requested"}
        else run.status
    )
    if run.conclusion == "failure" or status == "failure":
        status = "failed"
    elif run.conclusion == "success" or status == "success":
        status = "success"
    elif status not in {"running", "failed", "success"}:
        status = "warning"
    failure = next(
        (
            log
            for log in run.failure_logs
            if log.run_attempt == run.run_attempt and log.error_snippet
        ),
        None,
    )
    payload = {
        "id": run.github_run_id,
        "name": run.workflow_name,
        "runNumber": run.run_number,
        "runAttempt": run.run_attempt,
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
    if github_run.get("id") is None:
        raise HTTPException(422, "Workflow run ID is required")
    started = _parse_datetime(github_run.get("run_started_at") or github_run.get("created_at"))
    updated = _parse_datetime(github_run.get("updated_at")) or started or datetime.now(timezone.utc)
    completed = updated if status == "completed" else None
    actor = github_run.get("actor") or {}
    values = dict(
        repository_id=repository.id,
        github_run_id=str(github_run["id"]),
        workflow_name=github_run.get("name") or "GitHub Actions",
        run_number=github_run.get("run_number") or 0,
        status=status,
        conclusion=conclusion,
        branch=github_run.get("head_branch") or repository.default_branch or "main",
        commit_sha=github_run.get("head_sha"),
        commit_message=(github_run.get("head_commit") or {}).get("message")
        or github_run.get("display_title"),
        author_username=actor.get("login"),
        author_avatar_url=actor.get("avatar_url"),
        started_at=started,
        completed_at=completed,
        duration_seconds=max(0, int((completed - started).total_seconds()))
        if completed and started
        else 0,
        run_attempt=github_run.get("run_attempt") or 1,
        github_updated_at=updated,
        created_at=_parse_datetime(github_run.get("created_at")) or started or updated,
        logs_complete=False,
    )
    statement = insert(WorkflowRun).values(**values)
    changes = {
        key: value
        for key, value in values.items()
        if key not in {"created_at", "repository_id", "github_run_id", "logs_complete"}
    }
    changes["logs_complete"] = and_(
        WorkflowRun.run_attempt == values["run_attempt"], WorkflowRun.logs_complete
    )
    statement = statement.on_conflict_do_update(
        index_elements=[WorkflowRun.repository_id, WorkflowRun.github_run_id],
        set_=changes,
        where=or_(
            WorkflowRun.run_attempt < values["run_attempt"],
            and_(
                WorkflowRun.run_attempt == values["run_attempt"],
                or_(
                    WorkflowRun.github_updated_at.is_(None),
                    WorkflowRun.github_updated_at <= updated,
                ),
            ),
        ),
    )
    db.execute(statement)
    db.flush()
    return (
        db.query(WorkflowRun)
        .filter_by(repository_id=repository.id, github_run_id=str(github_run["id"]))
        .populate_existing()
        .one()
    )


def _log_lines(raw_logs: str, section: str) -> list[dict]:
    lines = []
    timestamp_pattern = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s?(.*)$")
    for index, raw_line in enumerate(raw_logs.splitlines(), start=1):
        match = timestamp_pattern.match(raw_line)
        timestamp = match.group(1) if match else ""
        message = match.group(2) if match else raw_line
        lowered = message.lower()
        line_type = (
            "error"
            if any(marker in lowered for marker in ("error", "exception", "failed"))
            else "warn"
            if "warning" in lowered
            else "info"
        )
        lines.append(
            {
                "lineNumber": index,
                "timestamp": timestamp,
                "type": line_type,
                "message": message,
                "section": section,
            }
        )
    return lines


def _github_runs(repository: Repository, user: User) -> list[dict]:
    with github_client(timeout=15) as client:
        response = client.get(
            f"https://api.github.com/repos/{repository.full_name}/actions/runs",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
            params={"per_page": 50},
        )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired")
    response.raise_for_status()
    return response.json().get("workflow_runs", [])


def _find_workflow_repository(repo_id: str, user_id: int, db: Session) -> Repository | None:
    return find_repository(repo_id, user_id, db)


@router.get("")
@isolated_db
def list_workflow_runs(
    repo_id: str,
    refresh: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    repository = _find_workflow_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    existing_runs = (
        db.query(WorkflowRun)
        .options(selectinload(WorkflowRun.failure_logs))
        .filter(WorkflowRun.repository_id == repository.id)
        .order_by(WorkflowRun.started_at.desc(), WorkflowRun.id.desc())
        .limit(50)
        .all()
    )
    if existing_runs and not refresh:
        return [_payload(run) for run in existing_runs]

    if not user.access_token:
        return [_payload(run) for run in existing_runs]

    for github_run in _github_runs(repository, user):
        _upsert_run(repository, github_run, db)
    db.commit()
    runs = (
        db.query(WorkflowRun)
        .options(selectinload(WorkflowRun.failure_logs))
        .filter(WorkflowRun.repository_id == repository.id)
        .order_by(WorkflowRun.started_at.desc(), WorkflowRun.id.desc())
        .limit(50)
        .all()
    )
    return [_payload(run) for run in runs]


@router.get("/definitions")
@isolated_db
def list_workflows(
    repo_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    repository = _find_workflow_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not user.access_token:
        return []

    with github_client() as client:
        workflows = pages(
            client,
            f"https://api.github.com/repos/{repository.full_name}/actions/workflows",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
            key="workflows",
        )
    return [
        {
            "id": str(w["id"]),
            "name": w["name"],
            "path": w["path"],
            "status": "active" if w.get("state") == "active" else "inactive",
        }
        for w in workflows
    ]


def _decode_logs(content: bytes) -> str:
    if len(content) > settings.MAX_LOG_BYTES:
        raise HTTPException(413, "Workflow logs exceed the configured download limit")
    try:
        with ZipFile(BytesIO(content)) as archive:
            entries = [entry for entry in archive.infolist() if not entry.is_dir()]
            if sum(entry.file_size for entry in entries) > settings.MAX_LOG_BYTES:
                raise HTTPException(413, "Expanded workflow logs exceed the configured limit")
            return "\n".join(
                archive.read(entry).decode("utf-8", errors="replace") for entry in entries
            )
    except BadZipFile:
        return content.decode("utf-8", errors="replace")


def load_workflow_logs(repo_id, run_id, user, db):
    repository = _find_workflow_repository(repo_id, user.id, db)
    if not repository:
        raise HTTPException(404, "Repository not found")
    with keyed_lock(("logs", repository.id, str(run_id))):
        db.expire_all()
        run = (
            db.query(WorkflowRun)
            .filter_by(repository_id=repository.id, github_run_id=str(run_id))
            .one_or_none()
        )
        if not run:
            raise HTTPException(404, "Workflow run not found")
        headers = {**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"}
        with github_client() as client:
            if not run.logs_complete:
                response = client.get(
                    f"https://api.github.com/repos/{repository.full_name}/actions/runs/{run_id}",
                    headers=headers,
                )
                response.raise_for_status()
                run = _upsert_run(repository, response.json(), db)
            records = (
                db.query(FailureLog)
                .filter_by(workflow_run_id=run.id, run_attempt=run.run_attempt)
                .filter(FailureLog.github_job_id.isnot(None))
                .order_by(FailureLog.id)
                .all()
            )
            total_bytes = sum(len((record.raw_logs or "").encode()) for record in records)
            if total_bytes > settings.MAX_LOG_BYTES:
                raise HTTPException(413, "Combined workflow logs exceed the configured limit")
            if not run.logs_complete:
                jobs = pages(
                    client,
                    f"https://api.github.com/repos/{repository.full_name}/actions/runs/{run_id}/attempts/{run.run_attempt}/jobs",
                    headers=headers,
                    key="jobs",
                )
                by_job = {log.github_job_id: log for log in records if log.github_job_id}
                complete = run.status == "completed"
                for job in jobs:
                    if job.get("conclusion") == "skipped":
                        continue
                    if job.get("status") != "completed":
                        complete = False
                        continue
                    job_id = str(job["id"])
                    if job_id in by_job and by_job[job_id].raw_logs is not None:
                        continue
                    with client.stream(
                        "GET",
                        f"https://api.github.com/repos/{repository.full_name}/actions/jobs/{job_id}/logs",
                        headers=headers,
                    ) as response:
                        if response.status_code in {404, 410}:
                            complete = False
                            continue
                        response.raise_for_status()
                        content = bytearray()
                        for chunk in response.iter_bytes():
                            content.extend(chunk)
                            if len(content) > settings.MAX_LOG_BYTES:
                                raise HTTPException(
                                    413, "Workflow logs exceed the configured download limit"
                                )
                    raw = _decode_logs(bytes(content))
                    total_bytes += len(raw.encode())
                    if total_bytes > settings.MAX_LOG_BYTES:
                        raise HTTPException(
                            413, "Combined workflow logs exceed the configured limit"
                        )
                    record = by_job.get(job_id)
                    if record is None:
                        record = FailureLog(
                            workflow_run_id=run.id,
                            run_attempt=run.run_attempt,
                            github_job_id=job_id,
                            step_name=job.get("name") or "GitHub Actions",
                        )
                        db.add(record)
                        records.append(record)
                    record.raw_logs = raw
                    record.exit_code = 0 if job.get("conclusion") == "success" else 1
                    record.error_snippet = (
                        "\n".join(
                            line
                            for line in raw.splitlines()
                            if any(
                                marker in line.lower()
                                for marker in ("error", "exception", "failed")
                            )
                        )[-6000:]
                        or None
                    )
                run.logs_complete = complete and bool(jobs)
                db.commit()
        # A failed/partial download is explicitly retryable; never cache an empty diagnosis.
        if not run.logs_complete:
            raise HTTPException(
                409, "Workflow logs are not completely available yet; retry shortly"
            )
        result = [
            line
            for record in records
            for line in _log_lines(record.raw_logs or "", record.step_name or "GitHub Actions")
        ]
        for number, line in enumerate(result, 1):
            line["lineNumber"] = number
        if run.conclusion == "success":
            try:
                from app.services.vector_store import vector_store

                for record in records:
                    vector_store.index_success(
                        str(repository.id),
                        run.github_run_id,
                        run.run_number,
                        run.workflow_name,
                        record.step_name or "GitHub Actions",
                        record.raw_logs or "",
                        run_attempt=run.run_attempt,
                        job_id=record.github_job_id,
                    )
            except Exception:
                logger.warning(
                    "Successful-run indexing unavailable for run %s", run_id, exc_info=True
                )
        return result


@router.get("/{run_id}/logs")
@isolated_db
def get_workflow_logs(
    repo_id: str, run_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    return load_workflow_logs(repo_id, run_id, user, db)


@router.post("/{run_id}/retry", status_code=202)
@isolated_db
def retry_workflow(
    repo_id: str, run_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict[str, str]:
    repository = _find_workflow_repository(repo_id, user.id, db)
    if not repository or not user.access_token:
        raise HTTPException(status_code=404, detail="Repository not found")

    with github_client(timeout=15) as client:
        response = client.post(
            f"https://api.github.com/repos/{repository.full_name}/actions/runs/{run_id}/rerun-failed-jobs",
            headers={**GITHUB_HEADERS, "Authorization": f"Bearer {user.access_token}"},
        )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    response.raise_for_status()
    run = (
        db.query(WorkflowRun)
        .filter_by(repository_id=repository.id, github_run_id=str(run_id))
        .one_or_none()
    )
    if run:
        run.logs_complete = False
        db.commit()
    return {"status": "queued"}
