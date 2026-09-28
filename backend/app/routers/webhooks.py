import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import Repository
from app.routers.workflows import _upsert_run

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _valid_signature(body: bytes, signature: str | None) -> bool:
    if not settings.GITHUB_WEBHOOK_SECRET or not signature:
        return False
    expected = "sha256=" + hmac.new(settings.GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook(
    request: Request,
    x_github_event: str = Header(default=""),
    x_hub_signature_256: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    body = await request.body()
    if not _valid_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    if x_github_event == "push":
        return {"status": "accepted"}

    if x_github_event != "workflow_run":
        return {"status": "ignored"}

    payload = json.loads(body)
    repository_data = payload.get("repository") or {}
    full_name = repository_data.get("full_name")
    workflow_run = payload.get("workflow_run")
    if not full_name or not workflow_run:
        return {"status": "ignored"}

    repository = db.query(Repository).filter(Repository.full_name == full_name).one_or_none()
    if not repository:
        return {"status": "ignored"}

    _upsert_run(repository, workflow_run, db)
    db.commit()
    return {"status": "accepted"}
