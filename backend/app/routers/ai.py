import asyncio
import json
import re

from fastapi import APIRouter, Depends, HTTPException
from google import genai
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import FailureLog, Repository, User, WorkflowRun
from app.routers.auth import get_current_user

router = APIRouter(prefix="/repositories/{repo_id}/workflows", tags=["ai"])


async def _generate_analysis(prompt: str) -> str:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=settings.GEMINI_MODEL,
        contents=prompt,
    )
    return response.text or "{}"


def _parse_result(text: str) -> dict:
    candidate = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)
    try:
        result = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Gemini returned an invalid analysis response") from exc
    required = ("summary", "rootCause", "suggestedFix", "confidence")
    if any(not result.get(field) for field in required):
        raise HTTPException(status_code=502, detail="Gemini returned an incomplete analysis response")
    return result


@router.post("/{run_id}/analysis")
async def analyze_failure(
    repo_id: str,
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini analysis is not configured")

    repo_filter = (Repository.user_id == user.id) & (
        (Repository.github_repo_id == repo_id) | (Repository.name == repo_id)
    )
    if repo_id.isdigit():
        repo_filter = (Repository.user_id == user.id) & (
            (Repository.github_repo_id == repo_id) | (Repository.name == repo_id) | (Repository.id == int(repo_id))
        )
    repository = db.query(Repository).filter(repo_filter).one_or_none()
    workflow_run = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.repository_id == repository.id if repository else False, WorkflowRun.github_run_id == run_id)
        .one_or_none()
    )
    if not repository or not workflow_run:
        raise HTTPException(status_code=404, detail="Workflow run not found")

    failures = db.query(FailureLog).filter(FailureLog.workflow_run_id == workflow_run.id).all()
    log_text = "\n\n".join(
        f"Job: {failure.step_name or 'unknown'}\n{failure.raw_logs or failure.error_snippet or ''}"
        for failure in failures
    )[:30000]
    if not log_text.strip():
        raise HTTPException(status_code=422, detail="No stored logs are available for this workflow run")

    prompt = f"""You are FlowForge AI, a CI failure analysis assistant.
Analyze the GitHub Actions failure below. Do not invent facts that are not present in the logs.
Return ONLY valid JSON with these fields:
summary (string), rootCause (string), suggestedFix (string), confidence (integer 0-100).
The suggestedFix should be concrete and safe. Mention uncertainty in the summary when appropriate.

Repository: {repository.full_name}
Workflow: {workflow_run.workflow_name}
Run number: {workflow_run.run_number}
Branch: {workflow_run.branch}
Commit: {workflow_run.commit_sha or 'unknown'}

Logs:
{log_text}"""

    try:
        result = _parse_result(await _generate_analysis(prompt))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Gemini analysis request failed") from exc

    confidence = max(0, min(100, int(result["confidence"])))
    for failure in failures:
        failure.root_cause = result["rootCause"]
        failure.suggested_fix = result["suggestedFix"]
        failure.ai_confidence = confidence
    db.commit()

    return {
        "id": f"analysis-{run_id}",
        "runId": run_id,
        "title": f"Workflow Run #{workflow_run.run_number} Diagnostics",
        "summary": result["summary"],
        "rootCause": result["rootCause"],
        "suggestedFix": result["suggestedFix"],
        "confidence": confidence,
        "relevantDocs": [{"title": "GitHub Actions Documentation", "url": "https://docs.github.com/en/actions"}],
        "previousDiscussions": [],
    }
