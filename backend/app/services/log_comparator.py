import logging
from typing import Optional, Set
from sqlalchemy.orm import Session

from app.db.models import FailureLog, WorkflowRun
from app.services.log_preprocessor import normalize_line

logger = logging.getLogger(__name__)


def extract_successful_run_templates(
    db: Session,
    repository_id: int,
    workflow_name: str,
    max_runs: int = 3,
) -> Set[str]:
    """
    Extracts normalized line templates from up to `max_runs` recent successful runs
    for the same workflow to act as a baseline for filtering repetitive/stable CI lines.
    """
    try:
        successful_runs = (
            db.query(WorkflowRun)
            .filter(
                WorkflowRun.repository_id == repository_id,
                WorkflowRun.workflow_name == workflow_name,
                (WorkflowRun.status == "success") | (WorkflowRun.conclusion == "success"),
            )
            .order_by(WorkflowRun.created_at.desc())
            .limit(max_runs)
            .all()
        )

        if not successful_runs:
            return set()

        run_ids = [run.id for run in successful_runs]
        logs = (
            db.query(FailureLog.raw_logs)
            .filter(FailureLog.workflow_run_id.in_(run_ids))
            .all()
        )

        templates: Set[str] = set()
        for (raw,) in logs:
            if not raw:
                continue
            for line in raw.splitlines():
                stripped = line.strip()
                if stripped:
                    templates.add(normalize_line(stripped))

        logger.info(
            "Extracted %d stable line templates from %d successful runs for %s",
            len(templates),
            len(successful_runs),
            workflow_name,
        )
        return templates
    except Exception as exc:
        logger.warning("Error extracting successful run templates: %s", exc)
        return set()


def summarize_differences_from_successful(
    failed_lines: list[str],
    successful_templates: Set[str],
    failed_step_name: Optional[str] = None,
    max_diffs: int = 5,
) -> list[str]:
    """
    Generates a concise list of differential evidence lines that appeared uniquely
    in the failed run compared to the successful baseline.
    """
    if not successful_templates:
        return [
            f"No prior successful runs available for baseline comparison; failed at step '{failed_step_name or 'unknown'}'."
        ]

    unique_diffs = []
    seen = set()

    for line in failed_lines:
        stripped = line.strip()
        if not stripped:
            continue
        norm = normalize_line(stripped)
        if norm not in successful_templates and norm not in seen:
            seen.add(norm)
            unique_diffs.append(stripped)
            if len(unique_diffs) >= max_diffs:
                break

    if not unique_diffs:
        return [f"Failure observed at step '{failed_step_name or 'unknown'}'; logs share high similarity with baseline."]

    return unique_diffs
