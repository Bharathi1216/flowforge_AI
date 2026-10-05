import asyncio
import json
import logging
import re
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)

PROMPT_VERSION = "logsage-v1"


def _build_rca_prompt(
    workflow_name: str,
    failed_step: str,
    commit_sha: str,
    branch: str,
    structured_failure: dict[str, Any],
    important_blocks: list[dict[str, Any]],
    differences: list[str],
    historical_precedents: list[dict[str, Any]],
) -> str:
    """
    Builds the LogSage-style RCA Analyst Prompt.
    Grounds LLM reasoning in critical log blocks, deterministic error extraction,
    differential analysis vs. successful runs, and historical semantic memory.
    """
    # 1. Format Important Log Blocks with line numbers
    blocks_formatted = []
    for idx, b in enumerate(important_blocks, 1):
        blocks_formatted.append(
            f"--- Critical Block #{idx} (Lines {b.get('start_line')}-{b.get('end_line')}, Score: {b.get('importance_score', 0)}) ---\n"
            f"{b.get('text', '')}"
        )
    blocks_text = "\n\n".join(blocks_formatted) if blocks_formatted else "No highlighted log blocks available."

    # 2. Format Baseline Run Differences
    diff_text = "\n".join(f"- {d}" for d in differences) if differences else "- No differences recorded against successful baseline."

    # 3. Format Historical Precedents
    precedents_formatted = []
    for p in historical_precedents:
        precedents_formatted.append(
            f"- Run #{p.get('runNumber')} (Similarity: {p.get('similarityPercent', 0)}%):\n"
            f"  Root Cause: {p.get('rootCause', 'N/A')}\n"
            f"  Suggested Fix: {p.get('suggestedFix', 'N/A')}"
        )
    precedents_text = "\n".join(precedents_formatted) if precedents_formatted else "- No similar historical precedents found in repository memory."

    prompt = f"""You are the FlowForge AI Diagnostic Engine, an advanced CI/CD Root Cause Analysis (RCA) intelligence system utilizing the LogSage methodology.
Your objective is to perform rigorous, grounded root cause analysis on a failed GitHub Actions workflow run.

### STRICT RULES:
1. Ground every claim directly in the provided Critical Log Blocks, Structured Failure metadata, and Run Differences.
2. DO NOT hallucinate or assume facts not present in the logs.
3. NEVER mention third-party AI provider names or model names (e.g. do not mention Gemini, OpenAI, Claude). Refer to yourself solely as FlowForge AI Diagnostic Engine.
4. Output MUST BE strictly a valid JSON object matching the exact schema below, with no surrounding conversation.

### JSON SCHEMA:
{{
  "log_analysis": [
    {{
      "error_logs": [[<start_line_number>, <end_line_number>]],
      "analysis": "<detailed explanation of what this specific log segment proves>"
    }}
  ],
  "root_cause": [
    "<underlying root cause statement 1>",
    "<underlying root cause statement 2>"
  ],
  "evidence": [
    "<direct factual quote or line reference from the logs demonstrating the failure>"
  ],
  "suggested_fix": "<actionable remediation steps with exact commands, config changes, or code diff>",
  "confidence": <float between 0.0 and 1.0 reflecting analytical certainty>
}}

### WORKFLOW EXECUTION CONTEXT:
- Workflow: {workflow_name}
- Failed Step: {failed_step}
- Branch: {branch}
- Commit: {commit_sha}
- Target Language: {structured_failure.get('language', 'unknown')}

### DETERMINISTIC FAILURE SIGNATURE:
- Error Type: {structured_failure.get('error_type', 'Unknown')}
- Error Message: {structured_failure.get('error_message', 'Unknown')}
- Failing File / Line: {structured_failure.get('file_path', 'None')}:{structured_failure.get('line_number', 'None')}
- Exit Code: {structured_failure.get('exit_code', 1)}

### PREPROCESSED CRITICAL LOG BLOCKS (Expanded context with 1-indexed lines):
{blocks_text}

### RUN DIFFERENCES (vs. Recent Successful Runs):
{diff_text}

### HISTORICAL PRECEDENTS (from FlowForge Semantic Memory):
{precedents_text}

Analyze the logs and provide the structured RCA JSON report:"""
    return prompt


def _heuristic_fallback(
    structured_failure: dict[str, Any],
    important_blocks: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Deterministic, pitch-safe fallback when LLM is unreachable or times out.
    Produces high-fidelity RCA purely from deterministic AST/regex extraction.
    """
    err_type = structured_failure.get("error_type", "ProcessFailure")
    err_msg = structured_failure.get("error_message", "Step execution exited with non-zero status")
    failed_step = structured_failure.get("failed_step", "execution")
    file_path = structured_failure.get("file_path")
    line_num = structured_failure.get("line_number")
    exit_code = structured_failure.get("exit_code", 1)

    location_str = f" in {file_path}:{line_num}" if file_path and line_num else (f" in {file_path}" if file_path else "")

    # Build evidence list from candidate lines
    evidence = []
    for b in important_blocks:
        for l in b.get("lines", []):
            if l.get("is_candidate"):
                evidence.append(f"Line {l['line_number']}: {l['text'].strip()}")
            if len(evidence) >= 4:
                break
        if len(evidence) >= 4:
            break

    if not evidence and important_blocks:
        first_b = important_blocks[0]
        if first_b.get("lines"):
            evidence.append(f"Line {first_b['lines'][0]['line_number']}: {first_b['lines'][0]['text'].strip()}")

    if not evidence:
        evidence.append(f"Execution of step '{failed_step}' terminated with exit code {exit_code}.")

    # Tailor remediation to specific error types
    err_lower = f"{err_type} {err_msg}".lower()
    if "modulenotfound" in err_lower or "cannot find module" in err_lower:
        suggested_fix = (
            f"1. Ensure the missing dependency is declared in package.json or requirements.txt.\n"
            f"2. Add a dependency installation step (e.g., `npm install` or `pip install -r requirements.txt`) before step '{failed_step}'.\n"
            f"3. Run dependency installation locally to confirm lockfile integrity."
        )
        root_causes = [
            f"Missing runtime or build dependency{location_str}.",
            f"The environment failed to resolve module '{err_msg}' during '{failed_step}'.",
        ]
        confidence = 0.90
    elif "syntaxerror" in err_lower:
        suggested_fix = (
            f"1. Open {file_path or 'the source file'} and inspect line {line_num or 'indicated in logs'}.\n"
            f"2. Fix invalid syntax or unclosed tokens.\n"
            f"3. Run local linter/compiler (e.g. `npm run lint` or `python -m py_compile`) before pushing."
        )
        root_causes = [
            f"Syntax parsing failure{location_str}.",
            f"Malformed token or language syntax in '{failed_step}'.",
        ]
        confidence = 0.92
    elif "assertionerror" in err_lower or "test" in failed_step.lower():
        suggested_fix = (
            f"1. Reproduce test failure locally in step '{failed_step}'.\n"
            f"2. Verify updated application logic against expected test assertions.\n"
            f"3. Update either the test suite expectations or the implementation to match the expected contract."
        )
        root_causes = [
            f"Automated test assertion failure in step '{failed_step}'.",
            f"Observed error: {err_type}: {err_msg}",
        ]
        confidence = 0.88
    elif "enoent" in err_lower or "no such file" in err_lower:
        suggested_fix = (
            f"1. Verify that file or directory paths referenced in step '{failed_step}' exist in the repository.\n"
            f"2. If the file is built during CI, verify the build output directory and artifact path configuration.\n"
            f"3. Check for case-sensitivity discrepancies between local OS and Linux CI runners."
        )
        root_causes = [
            f"File system path not found{location_str}.",
            f"Step '{failed_step}' attempted to read or execute a non-existent path.",
        ]
        confidence = 0.89
    elif "eacces" in err_lower or "permission denied" in err_lower:
        suggested_fix = (
            f"1. Add executable permissions to script files in your workflow: `chmod +x <script_path>`.\n"
            f"2. Avoid writing to protected root directories without appropriate runner permissions."
        )
        root_causes = [
            f"Permission denied during execution of step '{failed_step}'.",
            f"Runner process lacked required filesystem permissions.",
        ]
        confidence = 0.91
    elif "not set" in err_lower or "missing" in err_lower and ("secret" in err_lower or "env" in err_lower or "key" in err_lower):
        suggested_fix = (
            f"1. Navigate to GitHub Repository Settings -> Secrets and variables -> Actions.\n"
            f"2. Configure the missing secret or environment variable.\n"
            f"3. Pass the secret into the workflow step using `env:` in the workflow YAML file."
        )
        root_causes = [
            f"Required environment variable or secret is missing or unpopulated in step '{failed_step}'.",
        ]
        confidence = 0.90
    else:
        suggested_fix = (
            f"1. Review critical log evidence for step '{failed_step}'.\n"
            f"2. Reproduce the step command locally in the repository environment.\n"
            f"3. Verify build scripts, environment variables, and toolchain versions."
        )
        root_causes = [
            f"Step '{failed_step}' failed with non-zero exit code {exit_code}.",
            f"{err_type}: {err_msg}",
        ]
        confidence = 0.75

    log_analysis = []
    for b in important_blocks[:2]:
        log_analysis.append({
            "error_logs": [[b.get("start_line", 1), b.get("end_line", 1)]],
            "analysis": f"Step '{failed_step}' encountered termination trigger: {', '.join(b.get('reasons', ['process_failure']))}."
        })

    return {
        "log_analysis": log_analysis,
        "root_cause": root_causes,
        "evidence": evidence,
        "suggested_fix": suggested_fix,
        "confidence": confidence,
        "analysis_status": "fallback",
        "model": "FlowForge Deterministic Engine",
    }


def _parse_and_validate_rca_json(raw_text: str) -> dict[str, Any]:
    """
    Parses LLM response, stripping markdown fences, and strictly validates
    the LogSage RCA response schema.
    """
    candidate = raw_text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)

    parsed = json.loads(candidate)

    # 1. Normalize confidence (float between 0.0 and 1.0)
    conf = parsed.get("confidence", 0.85)
    try:
        conf_float = float(conf)
        if conf_float > 1.0:
            conf_float = conf_float / 100.0
        conf_float = max(0.0, min(1.0, round(conf_float, 2)))
    except (ValueError, TypeError):
        conf_float = 0.85

    # 2. Normalize root_cause to list of strings
    rc = parsed.get("root_cause")
    if isinstance(rc, str):
        root_cause_list = [rc.strip()]
    elif isinstance(rc, list):
        root_cause_list = [str(item).strip() for item in rc if str(item).strip()]
    else:
        root_cause_list = ["Identified root cause in workflow step execution."]

    # 3. Normalize evidence to list of strings
    ev = parsed.get("evidence")
    if isinstance(ev, str):
        evidence_list = [ev.strip()]
    elif isinstance(ev, list):
        evidence_list = [str(item).strip() for item in ev if str(item).strip()]
    else:
        evidence_list = []

    # 4. Normalize log_analysis
    log_an = parsed.get("log_analysis")
    if not isinstance(log_an, list):
        log_an = []

    normalized_log_analysis = []
    for item in log_an:
        if isinstance(item, dict):
            error_logs = item.get("error_logs", [])
            analysis_str = str(item.get("analysis", ""))
            normalized_log_analysis.append({
                "error_logs": error_logs,
                "analysis": analysis_str,
            })

    # 5. Suggested fix
    suggested_fix = str(parsed.get("suggested_fix") or "Inspect failed step logs and reproduce locally.")

    return {
        "log_analysis": normalized_log_analysis,
        "root_cause": root_cause_list,
        "evidence": evidence_list,
        "suggested_fix": suggested_fix,
        "confidence": conf_float,
        "analysis_status": "completed",
        "model": "FlowForge RCA Engine (LogSage)",
    }


async def run_rca(
    workflow_name: str,
    failed_step: str,
    commit_sha: str,
    branch: str,
    structured_failure: dict[str, Any],
    important_blocks: list[dict[str, Any]],
    differences: list[str],
    historical_precedents: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Executes the LogSage Root Cause Analysis engine.
    Formats structured analyst prompt -> calls model -> validates JSON schema ->
    falls back deterministically on any failure.
    """
    if not settings.GEMINI_API_KEY:
        logger.info("No LLM API key configured; using deterministic heuristic fallback.")
        return _heuristic_fallback(structured_failure, important_blocks)

    prompt = _build_rca_prompt(
        workflow_name=workflow_name,
        failed_step=failed_step,
        commit_sha=commit_sha,
        branch=branch,
        structured_failure=structured_failure,
        important_blocks=important_blocks,
        differences=differences,
        historical_precedents=historical_precedents,
    )

    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        text = response.text or ""
        result = _parse_and_validate_rca_json(text)
        return result
    except Exception as exc:
        logger.warning("LLM RCA analysis failed or returned invalid format: %s. Using heuristic fallback.", exc)
        return _heuristic_fallback(structured_failure, important_blocks)
