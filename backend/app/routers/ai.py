import asyncio
from datetime import datetime
import json
import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import FailureLog, Repository, User, WorkflowRun
from app.routers.auth import get_current_user

router = APIRouter(prefix="/repositories/{repo_id}", tags=["ai"])


class ChatMessage(BaseModel):
    id: Optional[str] = None
    role: str = Field(..., description="'user' or 'assistant'")
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    run_id: Optional[str] = None


async def _generate_gemini_response(prompt: str) -> str:
    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=settings.GEMINI_MODEL,
        contents=prompt,
    )
    return response.text or ""


def _parse_result(text: str) -> dict:
    candidate = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)
    try:
        result = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI diagnostic engine returned an invalid response format") from exc
    required = ("summary", "rootCause", "suggestedFix", "confidence")
    if any(not result.get(field) for field in required):
        raise HTTPException(status_code=502, detail="AI diagnostic engine returned an incomplete response")
    return result


def _find_repo(repo_id: str, user_id: int, db: Session) -> Repository | None:
    repo_filter = (Repository.user_id == user_id) & (
        (Repository.github_repo_id == repo_id) | (Repository.name == repo_id)
    )
    if repo_id.isdigit():
        repo_filter = (Repository.user_id == user_id) & (
            (Repository.github_repo_id == repo_id) | (Repository.name == repo_id) | (Repository.id == int(repo_id))
        )
    return db.query(Repository).filter(repo_filter).one_or_none()


@router.post("/workflows/{run_id}/analysis")
async def analyze_failure(
    repo_id: str,
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _find_repo(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    run_filter = (WorkflowRun.repository_id == repository.id) & (WorkflowRun.github_run_id == str(run_id))
    if str(run_id).isdigit():
        run_filter = (WorkflowRun.repository_id == repository.id) & (
            (WorkflowRun.github_run_id == str(run_id)) | (WorkflowRun.id == int(run_id))
        )
    workflow_run = db.query(WorkflowRun).filter(run_filter).one_or_none()

    if not workflow_run:
        raise HTTPException(status_code=404, detail="Workflow run not found")

    failures = db.query(FailureLog).filter(FailureLog.workflow_run_id == workflow_run.id).all()
    log_text = "\n\n".join(
        f"Job: {failure.step_name or 'unknown'}\n{failure.raw_logs or failure.error_snippet or ''}"
        for failure in failures
    )[:30000]

    if not log_text.strip() and workflow_run.steps:
        step_details = "\n".join(
            f"Step {s.step_number}: {s.name} - Status: {s.status}, Conclusion: {s.conclusion or 'unknown'}"
            for s in workflow_run.steps
        )
        log_text = f"Workflow '{workflow_run.workflow_name}' failed.\nExecuted Steps:\n{step_details}"

    # Query Supabase pgvector for similar historical failures
    from app.services.vector_store import vector_store

    error_snippet_query = ""
    if failures and failures[0].error_snippet:
        error_snippet_query = failures[0].error_snippet
    elif log_text:
        error_snippet_query = log_text[:1500]

    similar_runs = vector_store.find_similar_failures(
        repo_id=str(repository.id),
        error_snippet=error_snippet_query,
        current_run_id=workflow_run.github_run_id,
        limit=2,
        min_similarity=0.55,
    )
    similar_match = similar_runs[0] if similar_runs else None

    similar_context = ""
    if similar_match:
        similar_context = f"\nSemantic Match: A similar failure occurred in Run #{similar_match['runNumber']} (Similarity: {similar_match['similarityPercent']}%):\n{similar_match['document'][:800]}\n"

    prompt = f"""You are the FlowForge AI Diagnostic Engine, an advanced CI/CD failure diagnostic intelligence system for GitHub Actions.
Analyze the workflow failure details and error logs below.
Do not invent facts that are not present in the logs or run details.
Do NOT mention third-party AI provider names or model names (e.g. do not mention Gemini, OpenAI, Claude). Always refer to yourself as FlowForge AI Diagnostic Engine.

Return ONLY a valid JSON object with these exact keys:
- "summary": A concise, clear summary of what happened.
- "rootCause": Detailed root cause explaining specifically why the build/job failed.
- "suggestedFix": Actionable remediation steps with exact commands or code snippets where applicable.
- "confidence": An integer between 75 and 99 reflecting diagnostic certainty.

Repository: {repository.full_name}
Workflow: {workflow_run.workflow_name}
Run number: {workflow_run.run_number}
Branch: {workflow_run.branch}
Commit: {workflow_run.commit_sha or 'unknown'} ({workflow_run.commit_message or 'No commit message'})
{similar_context}
Logs & Failure Context:
{log_text or f"Workflow '{workflow_run.workflow_name}' failed with status '{workflow_run.status}' (conclusion: '{workflow_run.conclusion}')."}"""
    try:
        result = _parse_result(await _generate_gemini_response(prompt))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Gemini root-cause analysis failed") from exc

    confidence = max(0, min(100, int(result["confidence"])))
    if failures:
        for failure in failures:
            failure.root_cause = result["rootCause"]
            failure.suggested_fix = result["suggestedFix"]
            failure.ai_confidence = confidence
    else:
        new_failure = FailureLog(
            workflow_run_id=workflow_run.id,
            step_name="GitHub Actions Workflow",
            root_cause=result["rootCause"],
            suggested_fix=result["suggestedFix"],
            ai_confidence=confidence,
        )
        db.add(new_failure)
    db.commit()

    # Index into Supabase pgvector with verified root cause and suggested fix
    try:
        step_name = failures[0].step_name if failures and failures[0].step_name else "GitHub Actions"
        vector_store.index_failure(
            repo_id=str(repository.id),
            run_id=workflow_run.github_run_id,
            run_number=workflow_run.run_number,
            workflow_name=workflow_run.workflow_name,
            step_name=step_name,
            error_snippet=error_snippet_query or result["summary"],
            root_cause=result["rootCause"],
            suggested_fix=result["suggestedFix"],
            exit_code=1,
        )
    except Exception:
        pass

    return {
        "id": f"analysis-{run_id}",
        "runId": run_id,
        "title": f"Workflow Run #{workflow_run.run_number} Diagnostics",
        "summary": result["summary"],
        "rootCause": result["rootCause"],
        "suggestedFix": result["suggestedFix"],
        "confidence": confidence,
        "similarPreviousRunId": similar_match["runId"] if similar_match else None,
        "similarPreviousRunNumber": similar_match["runNumber"] if similar_match else None,
        "similarMatchPercent": similar_match["similarityPercent"] if similar_match else None,
        "relevantDocs": [
            {"title": "GitHub Actions Documentation", "url": "https://docs.github.com/en/actions"},
            {"title": "Workflow Syntax Reference", "url": "https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions"},
        ],
        "previousDiscussions": [],
    }


@router.post("/ai/chat")
@router.post("/chat")
async def chat_with_assistant(
    repo_id: str,
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = _find_repo(repo_id, user.id, db)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    recent_runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.repository_id == repository.id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(10)
        .all()
    )

    failed_runs = [r for r in recent_runs if r.status == "failed" or r.conclusion == "failure"]
    latest_run = recent_runs[0] if recent_runs else None

    last_user_message = next((m.content for m in reversed(payload.messages) if m.role == "user"), "")
    sources = [f"Repository: {repository.full_name}"]

    # Retrieve RAG semantic context from Supabase pgvector
    from app.services.vector_store import vector_store

    rag_snippets = vector_store.search_context(repo_id=str(repository.id), query=last_user_message, limit=3)
    rag_context = ""
    if rag_snippets:
        rag_context = "\nRelevant Historical Logs & Solutions (from FlowForge Semantic Memory):\n" + "\n---\n".join(rag_snippets[:3]) + "\n"

    if settings.GEMINI_API_KEY:
        context_prompt = f"""You are FlowForge AI Assistant, a native CI/CD developer intelligence assistant for the GitHub repository '{repository.full_name}'.
Repository Details:
- Owner: {repository.owner}
- Default branch: {repository.default_branch}
- Language: {repository.language or 'Unknown'}
- Recent Workflow Runs: {len(recent_runs)}
- Latest Run: #{latest_run.run_number if latest_run else 'N/A'} (Workflow: {latest_run.workflow_name if latest_run else 'N/A'}, Status: {latest_run.status if latest_run else 'N/A'})
- Recent Failures: {len(failed_runs)}
{rag_context}
User Query:
{last_user_message}

Provide a helpful, concise, engineering-focused answer formatted in GitHub-flavored Markdown. Mention real repository facts and provide actionable code or remediation when relevant.
Never mention third-party AI provider or model names (e.g. Gemini, OpenAI, Claude). You are FlowForge AI."""

        try:
            reply_text = await _generate_gemini_response(context_prompt)
            sources.append("FlowForge Intelligence Core")
            if failed_runs:
                sources.append("GitHub Actions Run History")
        except Exception:
            reply_text = ""
    else:
        reply_text = ""

    # Intelligent contextual fallback if Gemini is not configured or request fails
    if not reply_text:
        q = last_user_message.lower()
        if "fail" in q or "error" in q or "why" in q or "build" in q:
            if failed_runs:
                f_run = failed_runs[0]
                reply_text = f"The most recent failure in **{repository.name}** was **Run #{f_run.run_number}** (`{f_run.workflow_name}`) on branch `{f_run.branch}` (commit: `{f_run.commit_sha[:7] if f_run.commit_sha else 'HEAD'}`: *{f_run.commit_message or 'No commit message'}*).\n\n"
                reply_text += "You can open the **Failure Analysis** tab to inspect the raw step logs, view the highlighted error snippet, and trigger automated diagnostics."
                sources.append(f"Workflow Run #{f_run.run_number}")
            else:
                reply_text = f"All recent workflow runs for **{repository.name}** are currently passing or queued. No active CI failures were recorded in the latest 10 runs."
        elif "who" in q or "author" in q or "contributor" in q or "team" in q:
            authors = list({r.author_username for r in recent_runs if r.author_username})
            author_str = ", ".join(f"@{a}" for a in authors) if authors else f"@{repository.owner}"
            reply_text = f"Recent workflow runs and commits for **{repository.name}** involve: {author_str}.\nCheck the **Team** tab for contributor statistics and commit counts."
            sources.append("GitHub Contributors")
        elif "how" in q or "fix" in q or "patch" in q:
            reply_text = f"To debug workflow issues on **{repository.name}**:\n1. Open **Failure Analysis** to inspect the job logs.\n2. Create a Discussion thread to collaborate with your team.\n3. Rerun the failed jobs directly using the **Rerun Failed** button."
            sources.append("FlowForge CI Engine")
        else:
            status_desc = f"Latest run #{latest_run.run_number} is {latest_run.status}" if latest_run else "No runs recorded yet"
            reply_text = f"I am your FlowForge AI assistant for **{repository.full_name}** ({status_desc}). Ask me about workflow failures, build status on branch `{repository.default_branch}`, or collaborators."

    return {
        "id": f"ai-{int(time.time() * 1000)}",
        "role": "assistant",
        "content": reply_text,
        "timestamp": datetime.utcnow().strftime("%H:%M"),
        "sources": sources,
    }
