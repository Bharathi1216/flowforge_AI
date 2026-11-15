import hashlib
import hmac
import json

from fastapi import APIRouter, Header, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.db.database import SessionLocal
from app.db.models import Repository
from app.routers.workflows import _upsert_run

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _valid_signature(body: bytes, signature: str | None) -> bool:
    if not settings.GITHUB_WEBHOOK_SECRET or not signature:
        return False
    expected = (
        "sha256="
        + hmac.new(settings.GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    )
    return hmac.compare_digest(expected, signature)


@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook(
    request: Request,
    x_github_event: str = Header(default=""),
    x_hub_signature_256: str | None = Header(default=None),
) -> dict[str, str]:
    body = await request.body()
    if not _valid_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    if x_github_event == "push":
        return {"status": "accepted"}

    if x_github_event != "workflow_run":
        return {"status": "ignored"}

    if len(body) > 1_000_000:
        raise HTTPException(413, "Webhook body is too large")
    return await run_in_threadpool(_process_webhook, body)


def _process_webhook(body):
    with SessionLocal() as db:
        try:
            return _store_webhook(body, db)
        except (ValueError, TypeError, KeyError) as exc:
            db.rollback()
            raise HTTPException(422, "Invalid workflow event") from exc


def _store_webhook(body, db):
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(422, "Invalid webhook JSON") from exc
    if not isinstance(payload, dict):
        raise HTTPException(422, "Invalid webhook payload")
    repository_data = payload.get("repository") or {}
    if not isinstance(repository_data, dict):
        raise HTTPException(422, "Invalid repository payload")
    github_repo_id = repository_data.get("id")
    full_name = repository_data.get("full_name")
    workflow_run = payload.get("workflow_run")
    if not full_name or not workflow_run:
        return {"status": "ignored"}

    if not isinstance(workflow_run, dict) or workflow_run.get("id") is None:
        raise HTTPException(422, "Invalid workflow run payload")

    repositories = (
        db.query(Repository)
        .filter(
            Repository.github_repo_id == str(github_repo_id)
            if github_repo_id is not None
            else Repository.full_name == full_name
        )
        .all()
    )
    if not repositories:
        return {"status": "ignored"}

    for repository in repositories:
        _upsert_run(repository, workflow_run, db)
    db.commit()
    return {"status": "accepted"}
