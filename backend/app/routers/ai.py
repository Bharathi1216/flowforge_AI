import asyncio
from datetime import datetime
import json
import logging
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repositories/{repo_id}", tags=["ai"])


class ChatMessage(BaseModel):
    id: Optional[str] = None
    role: str = Field(..., description="'user' or 'assistant'")
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    run_id: Optional[str] = None


def _cached_analysis_response(failure: FailureLog) -> dict | None:
    """Return the immutable response saved for a completed run."""
    if failure.analysis_status not in {"completed", "fallback"} or not failure.analysis_result:
        return None
    try:
        cached = json.loads(failure.analysis_result)
    except (TypeError, json.JSONDecodeError):
        logger.warning("Ignoring malformed cached RCA result for failure %s", failure.id)
        return None
    return cached if isinstance(cached, dict) else None


def _is_final_provider_result(result: dict | None) -> bool:
    return bool(result and result.get("status") in {"completed", "fallback"})


def _primary_result_from_cache(cached: dict) -> dict:
    return {
        "root_cause": [cached.get("rootCause", "")],
        "suggested_fix": cached.get("suggestedFix", ""),
        "confidence": cached.get("confidence", 0.85),
        "evidence": cached.get("evidence", []),
        "log_analysis": cached.get("logAnalysis", []),
        "analysis_status": cached.get("analysisStatus", "completed"),
    }


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
    reanalyze: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    from app.services.failure_extractor import (
        extract_structured_failure,
        generate_failure_fingerprint,
    )
    from app.services.log_comparator import (
        extract_successful_run_templates,
        summarize_differences_from_successful,
    )
    from app.services.log_preprocessor import preprocess_logs
    from app.services.evidence_graph import (
        build_evidence_graph,
        graph_context_line_candidates,
        graph_response_summary,
    )
    from app.services.rca_engine import PROMPT_VERSION, run_groq_rca, run_rca
    from app.services.vector_store import vector_store

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
    existing_cached_response = next(
        (cached for failure in failures if (cached := _cached_analysis_response(failure))),
        None,
    )
    cached_providers = (existing_cached_response or {}).get("providers", {})
    stored_failure = failures[0] if failures else None
    for provider_name, attribute_name in (("gemini", "gemini_result"), ("groq", "groq_result")):
        stored_result = getattr(stored_failure, attribute_name, None) if stored_failure else None
        if stored_result:
            try:
                cached_providers[provider_name] = json.loads(stored_result)
            except json.JSONDecodeError:
                logger.warning("Ignoring malformed saved %s result for run %s", provider_name, run_id)

    if reanalyze and failures:
        for failure in failures:
            failure.analysis_result = None
            failure.provider_results = None
            failure.gemini_result = None
            failure.groq_result = None
        db.commit()
        existing_cached_response = None
        cached_providers = {}

    gemini_cached = cached_providers.get("gemini")
    if not gemini_cached and existing_cached_response:
        gemini_cached = {
            "provider": "Gemini",
            "status": existing_cached_response.get("analysisStatus", "completed"),
            "model": existing_cached_response.get("model"),
            "summary": existing_cached_response.get("summary", ""),
            "rootCause": existing_cached_response.get("rootCause", ""),
            "suggestedFix": existing_cached_response.get("suggestedFix", ""),
            "confidence": existing_cached_response.get("confidence"),
            "evidence": existing_cached_response.get("evidence", []),
            "logAnalysis": existing_cached_response.get("logAnalysis", []),
        }
    groq_cached = cached_providers.get("groq")
    gemini_needs_run = not _is_final_provider_result(gemini_cached)
    groq_needs_run = not _is_final_provider_result(groq_cached)

    if not gemini_needs_run and not groq_needs_run and existing_cached_response:
        cached_response = dict(existing_cached_response)
        cached_response["providers"] = cached_providers
        return cached_response

    # Step 1: Collect & preserve complete raw logs
    raw_logs_parts = []
    failed_step_name = None
    for f in failures:
        if f.raw_logs:
            raw_logs_parts.append(f.raw_logs)
        elif f.error_snippet:
            raw_logs_parts.append(f.error_snippet)
        if f.step_name and not failed_step_name:
            failed_step_name = f.step_name

    # Check workflow run steps if no failed step identified yet
    if not failed_step_name and workflow_run.steps:
        for s in workflow_run.steps:
            if s.status == "failed" or s.conclusion == "failure":
                failed_step_name = s.name
                break

    if not failed_step_name:
        failed_step_name = "build"

    combined_raw_logs = "\n\n".join(raw_logs_parts).strip()
    if not combined_raw_logs and workflow_run.steps:
        step_details = "\n".join(
            f"Step {s.step_number}: {s.name} - Status: {s.status}, Conclusion: {s.conclusion or 'unknown'}"
            for s in workflow_run.steps
        )
        combined_raw_logs = f"Workflow '{workflow_run.workflow_name}' failed.\nExecuted Steps:\n{step_details}"

    raw_lines = combined_raw_logs.splitlines() if combined_raw_logs else []

    # Step 2: Extract baseline templates from successful runs
    successful_templates = extract_successful_run_templates(
        db=db,
        repository_id=repository.id,
        workflow_name=workflow_run.workflow_name,
        max_runs=3,
    )

    # Step 3: Discover run-wide events and build a deterministic, uncertainty-aware graph.
    graph_weights = {
        "temporal": settings.RCA_EVIDENCE_WEIGHT_TEMPORAL,
        "relevance": settings.RCA_EVIDENCE_WEIGHT_RELEVANCE,
        "relationships": settings.RCA_EVIDENCE_WEIGHT_RELATIONSHIPS,
        "evidence": settings.RCA_EVIDENCE_WEIGHT_STRENGTH,
        "baseline": settings.RCA_EVIDENCE_WEIGHT_BASELINE,
    }
    try:
        evidence_graph = build_evidence_graph(
            raw_logs=combined_raw_logs,
            run_id=workflow_run.github_run_id,
            workflow_step=(
                failed_step_name
                if len(failures) == 1 and (failures[0].raw_logs or failures[0].error_snippet)
                else None
            ),
            successful_templates=successful_templates or None,
            weights=graph_weights,
        )
    except Exception:
        logger.exception(
            "Evidence Graph construction failed for run %s; continuing with legacy RCA inputs",
            workflow_run.github_run_id,
        )
        evidence_graph = {
            "version": "egfa-v1",
            "run_id": str(workflow_run.github_run_id),
            "nodes": [],
            "edges": [],
            "root_cause_candidates": [],
            "insufficient_evidence": True,
            "line_count": len(raw_lines),
        }

    # Step 4: Preserve the existing context windows and reserve prompt budget for graph context.
    important_blocks, candidate_lines = preprocess_logs(
        raw_logs=combined_raw_logs,
        failed_step_name=failed_step_name,
        successful_run_templates=successful_templates,
        max_tokens=max(100, int(settings.RCA_MAX_TOKENS * 0.8)),
        additional_candidates=graph_context_line_candidates(evidence_graph),
    )

    # Step 5: Run Differences vs. Successful Baseline
    differences = summarize_differences_from_successful(
        failed_lines=raw_lines,
        successful_templates=successful_templates,
        failed_step_name=failed_step_name,
    )

    # Step 6: Deterministic Structured Failure & Normalized Fingerprint Extraction
    structured = extract_structured_failure(
        workflow_name=workflow_run.workflow_name,
        run_id=workflow_run.github_run_id,
        failed_step=failed_step_name,
        branch=workflow_run.branch,
        commit_sha=workflow_run.commit_sha,
        raw_lines=raw_lines,
        important_blocks=important_blocks,
        exit_code=failures[0].exit_code if failures and failures[0].exit_code else 1,
        repo_language=repository.language,
    )
    fingerprint = generate_failure_fingerprint(structured)
    structured["evidence_graph"] = evidence_graph

    # Step 7: Embed the current failure and retrieve RAG context from pgvector.
    # Retrieval is optional: an embedding/database outage must not prevent the
    # current failure from reaching Gemini or the deterministic RCA fallback.
    critical_log_text = "\n".join(
        block.get("text", "") for block in important_blocks
    )[:6000]
    vector_query = "\n".join(
        part
        for part in (
            structured.get("exception", ""),
            f"Failure fingerprint: {fingerprint}",
            critical_log_text,
        )
        if part
    )
    try:
        similar_runs = vector_store.find_similar_failures(
            repo_id=str(repository.id),
            error_snippet=vector_query,
            current_run_id=workflow_run.github_run_id,
            limit=2,
            min_similarity=0.50,
        )
    except Exception as retrieval_err:
        logger.warning(
            "Unable to retrieve RAG context for run %s; continuing without "
            "historical precedents: %s",
            workflow_run.github_run_id,
            retrieval_err,
        )
        similar_runs = []
    similar_match = similar_runs[0] if similar_runs else None

    # Step 8: Generate RCA from the current error plus retrieved RAG context.
    # run_rca falls back to deterministic regex/heuristic analysis when the
    # model is unavailable or returns an unusable response.
    common_rca_args = {
        "workflow_name": workflow_run.workflow_name,
        "failed_step": failed_step_name,
        "commit_sha": workflow_run.commit_sha or "HEAD",
        "branch": workflow_run.branch,
        "structured_failure": structured,
        "important_blocks": important_blocks,
        "differences": differences,
        "historical_precedents": similar_runs,
        "evidence_graph": evidence_graph,
    }
    rca_result = await run_rca(**common_rca_args) if gemini_needs_run else _primary_result_from_cache(gemini_cached)
    groq_result = await run_groq_rca(**common_rca_args) if groq_needs_run else {
        "analysis_status": groq_cached.get("status", "completed"),
        "model": groq_cached.get("model"),
        "root_cause": [groq_cached.get("rootCause", "")],
        "suggested_fix": groq_cached.get("suggestedFix", ""),
        "confidence": groq_cached.get("confidence"),
        "evidence": groq_cached.get("evidence", []),
        "log_analysis": groq_cached.get("logAnalysis", []),
    }

    # Step 9: Persistence to Database
    root_cause_str = (
        "\n".join(rca_result["root_cause"])
        if isinstance(rca_result.get("root_cause"), list)
        else str(rca_result.get("root_cause", ""))
    )
    evidence_json = json.dumps(rca_result.get("evidence", []))
    structured_json = json.dumps(structured)
    blocks_json = json.dumps(important_blocks)
    confidence_val = rca_result.get("confidence", 0.85)

    def provider_payload(result: dict, provider: str) -> dict:
        return {
            "provider": provider,
            "status": result.get("analysis_status", "completed"),
            "model": result.get("model"),
            "summary": result.get("root_cause", [""])[0] if result.get("root_cause") else "",
            "rootCause": "\n".join(result.get("root_cause", [])),
            "suggestedFix": result.get("suggested_fix", ""),
            "confidence": result.get("confidence"),
            "evidence": result.get("evidence", []),
            "logAnalysis": result.get("log_analysis", []),
            "error": result.get("error"),
        }

    providers = {
        "gemini": gemini_cached if not gemini_needs_run else provider_payload(rca_result, "Gemini"),
        "groq": groq_cached if not groq_needs_run else provider_payload(groq_result, "Groq"),
    }
    primary_result = rca_result
    analysis_response = {
        "id": f"analysis-{run_id}",
        "runId": run_id,
        "title": f"Workflow Run #{workflow_run.run_number} Diagnostics",
        "summary": (
            primary_result["root_cause"][0]
            if (isinstance(primary_result.get("root_cause"), list) and primary_result["root_cause"])
            else (root_cause_str or f"Diagnostics for run #{workflow_run.run_number}")
        ),
        "rootCause": "\n".join(primary_result.get("root_cause", [])),
        "suggestedFix": primary_result.get("suggested_fix", ""),
        "confidence": primary_result.get("confidence", confidence_val),
        "evidence": primary_result.get("evidence", []),
        "logAnalysis": primary_result.get("log_analysis", []),
        "importantLogBlocks": important_blocks,
        "evidenceGraph": graph_response_summary(evidence_graph),
        "failureFingerprint": fingerprint,
        "analysisStatus": rca_result.get("analysis_status", "completed"),
        "rawLogs": combined_raw_logs,
        "similarPreviousRunId": similar_match["runId"] if similar_match else None,
        "similarPreviousRunNumber": similar_match["runNumber"] if similar_match else None,
        "similarMatchPercent": similar_match["similarityPercent"] if similar_match else None,
        "relevantDocs": [
            {"title": "GitHub Actions Documentation", "url": "https://docs.github.com/en/actions"},
            {"title": "Workflow Syntax Reference", "url": "https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions"},
        ],
        "previousDiscussions": [],
        "providers": providers,
    }
    analysis_result_json = json.dumps(analysis_response, separators=(",", ":"))

    if failures:
        for failure in failures:
            failure.root_cause = root_cause_str
            failure.suggested_fix = rca_result.get("suggested_fix", "")
            failure.ai_confidence = confidence_val
            failure.failure_fingerprint = fingerprint
            failure.structured_failure = structured_json
            failure.important_log_blocks = blocks_json
            failure.evidence = evidence_json
            failure.analysis_status = rca_result.get("analysis_status", "completed")
            failure.model = rca_result.get("model", "FlowForge RCA Engine (LogSage)")
            failure.prompt_version = PROMPT_VERSION
            failure.analysis_result = analysis_result_json
            failure.provider_results = json.dumps(providers, separators=(",", ":"))
            failure.gemini_result = json.dumps(providers["gemini"], separators=(",", ":"))
            failure.groq_result = json.dumps(providers["groq"], separators=(",", ":"))
    else:
        new_failure = FailureLog(
            workflow_run_id=workflow_run.id,
            step_name=failed_step_name,
            raw_logs=combined_raw_logs,
            error_snippet=structured.get("exception", "")[:500],
            root_cause=root_cause_str,
            suggested_fix=rca_result.get("suggested_fix", ""),
            ai_confidence=confidence_val,
            failure_fingerprint=fingerprint,
            structured_failure=structured_json,
            important_log_blocks=blocks_json,
            evidence=evidence_json,
            analysis_status=rca_result.get("analysis_status", "completed"),
            model=rca_result.get("model", "FlowForge RCA Engine (LogSage)"),
            prompt_version=PROMPT_VERSION,
            analysis_result=analysis_result_json,
            provider_results=json.dumps(providers, separators=(",", ":")),
            gemini_result=json.dumps(providers["gemini"], separators=(",", ":")),
            groq_result=json.dumps(providers["groq"], separators=(",", ":")),
        )
        db.add(new_failure)
    db.commit()

    # Step 10: Index verified failure into pgvector.
    try:
        vector_store.index_failure(
            repo_id=str(repository.id),
            run_id=workflow_run.github_run_id,
            run_number=workflow_run.run_number,
            workflow_name=workflow_run.workflow_name,
            step_name=failed_step_name,
            error_snippet=structured.get("exception", "") or fingerprint,
            root_cause=root_cause_str,
            suggested_fix=rca_result.get("suggested_fix", ""),
            exit_code=structured.get("exit_code", 1),
        )
    except Exception as idx_err:
        logger.warning("Error indexing failure to vector store: %s", idx_err)

    return analysis_response


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
