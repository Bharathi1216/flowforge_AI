import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db, isolated_db
from app.db.models import FailureLog, Repository, User, WorkflowRun
from app.services.identity import find_repository
from app.routers.auth import get_current_user
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repositories/{repo_id}/knowledge", tags=["knowledge"])


def _find_repo(repo_id: str, user_id: int, db: Session) -> Repository | None:
    return find_repository(repo_id, user_id, db)


@router.get("")
@isolated_db
def get_knowledge_base(
    repo_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    repository = _find_repo(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    # 1. Fetch semantically indexed knowledge items from Supabase pgvector
    vector_items = vector_store.get_knowledge_base(str(repository.id))

    # 2. Fetch database failure logs that have diagnosed fixes
    db_items: list[dict[str, Any]] = []
    seen_step_fixes = set()

    for item in vector_items:
        seen_step_fixes.add((item.get("errorType"), item.get("suggestedFix")[:50]))

    failure_runs = (
        db.query(FailureLog, WorkflowRun)
        .join(WorkflowRun, FailureLog.workflow_run_id == WorkflowRun.id)
        .filter(WorkflowRun.repository_id == repository.id, FailureLog.suggested_fix.isnot(None))
        .order_by(FailureLog.created_at.desc())
        .limit(20)
        .all()
    )

    for fail, run in failure_runs:
        fix_key = (fail.step_name, (fail.suggested_fix or "")[:50])
        if fix_key in seen_step_fixes:
            continue
        seen_step_fixes.add(fix_key)

        db_items.append(
            {
                "id": f"kb-db-{fail.id}",
                "repoId": str(repository.id),
                "errorType": f"{fail.step_name or 'Workflow'} Failure",
                "occurrences": 1,
                "lastResolvedAt": fail.created_at.strftime("%b %d, %Y")
                if fail.created_at
                else "Recent",
                "suggestedFix": fail.suggested_fix,
                "similarRunId": run.github_run_id,
                "similarRunNumber": run.run_number,
                "category": "failure",
            }
        )

    # Add standard CI architectural reference card
    docs_item = {
        "id": f"kb-docs-{repository.id}-ci",
        "repoId": str(repository.id),
        "errorType": "CI/CD Pipeline Architecture",
        "occurrences": db.query(WorkflowRun)
        .filter(WorkflowRun.repository_id == repository.id)
        .count()
        or 1,
        "lastResolvedAt": "Current",
        "suggestedFix": f"Automated workflow runs for {repository.name} are triggered via GitHub Actions runners defined under .github/workflows.",
        "category": "docs",
    }

    return vector_items + db_items + [docs_item]
