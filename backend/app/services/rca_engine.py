import asyncio
import json
import math
import logging
import re
from typing import Any, Optional
import httpx

from app.config import settings
from app.services.evidence_graph import graph_prompt_context

logger = logging.getLogger(__name__)

PROMPT_VERSION = "logsage-v2"

FEW_SHOT_EXEMPLARS = """
### EXEMPLAR 1: Missing Runtime/Build Dependency
Input Failure Context:
- Workflow: CI / Build & Test
- Failed Step: test
- Target Language: javascript
- Preprocessed Critical Log:
   12 | [INFO] Loading test suite modules...
   13 | node:internal/modules/cjs/loader:1147
   14 | Error: Cannot find module 'jsonwebtoken'
   15 | Require stack:
   16 | - /home/runner/work/flowforge/src/auth/jwt.js:5:14
   17 | npm ERR! Lifecycle script `test` failed with exit code 1

Expected Output JSON:
{
  "log_analysis": [
    {
      "error_logs": [[13, 16]],
      "analysis": "Node.js CommonJS module loader failed to resolve 'jsonwebtoken' required by src/auth/jwt.js:5."
    }
  ],
  "root_cause": [
    "Package 'jsonwebtoken' is imported in src/auth/jwt.js but is missing from package.json dependencies.",
    "Step 'npm install' did not install the package because it was not listed in package.json or package-lock.json."
  ],
  "evidence": [
    "Line 14: Error: Cannot find module 'jsonwebtoken'",
    "Line 16: Require stack: /home/runner/work/flowforge/src/auth/jwt.js:5:14",
    "Line 17: npm ERR! Lifecycle script `test` failed with exit code 1"
  ],
  "suggested_fix": "1. Add the missing dependency to your project:\\n   `npm install jsonwebtoken --save`\\n2. If using TypeScript, also install types:\\n   `npm install @types/jsonwebtoken --save-dev`\\n3. Commit package.json and package-lock.json.",
  "confidence": 0.98
}

### EXEMPLAR 2: Static Analysis / TypeScript Type Failure
Input Failure Context:
- Workflow: Release Build
- Failed Step: compile
- Target Language: typescript
- Preprocessed Critical Log:
   16 | [INFO] Compiling TypeScript project...
   17 | src/index.ts:18:9 - error TS2322: Type 'string' is not assignable to type 'number'.
   18 | 18   const count: number = "ten";
   19 |            ~~~~~
   20 | Found 1 error in src/index.ts:18
   21 | Error: Process completed with exit code 2.

Expected Output JSON:
{
  "log_analysis": [
    {
      "error_logs": [[17, 20]],
      "analysis": "TypeScript compiler (tsc) reported static type violation TS2322 in src/index.ts at line 18."
    }
  ],
  "root_cause": [
    "Static type checking failure in src/index.ts:18 due to assigning string literal '\"ten\"' to a variable explicitly typed as 'number'.",
    "The strict TypeScript compiler gate rejected the build before emitting JavaScript artifacts."
  ],
  "evidence": [
    "Line 17: src/index.ts:18:9 - error TS2322: Type 'string' is not assignable to type 'number'.",
    "Line 18: const count: number = \"ten\";",
    "Line 21: Error: Process completed with exit code 2."
  ],
  "suggested_fix": "1. Open `src/index.ts` and correct line 18 to assign a valid number:\\n   ```typescript\\n   const count: number = 10;\\n   ```\\n2. Verify the type check locally before committing:\\n   `npm run build` or `npx tsc --noEmit`",
  "confidence": 0.99
}

### EXEMPLAR 3: Missing CI Environment Variable / Secret
Input Failure Context:
- Workflow: Database Setup
- Failed Step: db_migrate
- Target Language: python
- Preprocessed Critical Log:
   22 | [INFO] Running alembic database migration
   23 | Traceback (most recent call last):
   24 |   File \"app/db/database.py\", line 14, in <module>
   25 |     database_url = os.environ[\"DATABASE_URL\"]
   26 | KeyError: 'DATABASE_URL is not set'
   27 | Process returned exit code 1

Expected Output JSON:
{
  "log_analysis": [
    {
      "error_logs": [[23, 26]],
      "analysis": "Python os.environ dictionary lookup raised KeyError because 'DATABASE_URL' is unpopulated in the runner environment."
    }
  ],
  "root_cause": [
    "The required secret or environment variable 'DATABASE_URL' was not injected into the 'db_migrate' step.",
    "Alembic database engine initialization failed immediately upon startup when reading os.environ."
  ],
  "evidence": [
    "Line 24: File \"app/db/database.py\", line 14, in <module>",
    "Line 25: database_url = os.environ[\"DATABASE_URL\"]",
    "Line 26: KeyError: 'DATABASE_URL is not set'"
  ],
  "suggested_fix": "1. In GitHub Repository Settings -> Secrets and variables -> Actions, ensure `DATABASE_URL` is configured.\\n2. In your workflow YAML file (.github/workflows/ci.yml), inject the secret into the step:\\n   ```yaml\\n   - name: Run database migration\\n     env:\\n       DATABASE_URL: ${{ secrets.DATABASE_URL }}\\n     run: alembic upgrade head\\n   ```",
  "confidence": 0.97
}
"""


def _build_rca_prompt(
    workflow_name: str,
    failed_step: str,
    commit_sha: str,
    branch: str,
    structured_failure: dict[str, Any],
    important_blocks: list[dict[str, Any]],
    differences: list[str],
    historical_precedents: list[dict[str, Any]],
    evidence_graph: Optional[dict[str, Any]] = None,
) -> str:
    """
    Builds the fine-tuned LogSage-style RCA Analyst Prompt.
    Grounds LLM reasoning in critical log blocks, deterministic error extraction,
    differential analysis vs. successful runs, few-shot exemplars, and historical semantic memory.
    """
    blocks_formatted = []
    for idx, b in enumerate(important_blocks, 1):
        blocks_formatted.append(
            f"--- Critical Block #{idx} (Lines {b.get('start_line')}-{b.get('end_line')}, Importance Score: {b.get('importance_score', 0)}) ---\n"
            f"{b.get('text', '')}"
        )
    blocks_text = (
        "\n\n".join(blocks_formatted)
        if blocks_formatted
        else "No highlighted log blocks available."
    )

    diff_text = (
        "\n".join(f"- {d}" for d in differences)
        if differences
        else "- No differences recorded against successful baseline."
    )

    precedents_formatted = []
    for p in historical_precedents:
        if p.get("runStatus") == "success":
            precedent = (
                f"- Successful run #{p.get('runNumber')} (Similarity: {p.get('similarityPercent', 0)}%):\n"
                f"  Known-good workflow context: {str(p.get('document', 'N/A'))[:1200]}"
            )
        else:
            precedent = (
                f"- Failed run #{p.get('runNumber')} (Similarity: {p.get('similarityPercent', 0)}%):\n"
                f"  Root Cause: {p.get('rootCause') or 'N/A'}\n"
                f"  Suggested Fix: {p.get('suggestedFix') or 'N/A'}"
            )
        precedents_formatted.append(precedent)
    precedents_text = (
        "\n".join(precedents_formatted)
        if precedents_formatted
        else "- No similar historical precedents found in repository memory."
    )
    graph_text = (
        graph_prompt_context(evidence_graph)
        if evidence_graph
        else "Evidence Graph unavailable; use the current log evidence without assuming causal relationships."
    )

    prompt = f"""You are the FlowForge AI Diagnostic Engine, an advanced CI/CD Root Cause Analysis (RCA) intelligence system utilizing the LogSage methodology (ASE 2025).
Your objective is to perform rigorous, fine-tuned root cause analysis on a failed GitHub Actions workflow run.

### CORE LOGSAGE REASONING PRINCIPLES:
1. ROOT CAUSE VS SYMPTOM: Never report superficial exit conditions (e.g. "exit code 1", "command failed", "npm test failed", "build exited with status 2") as the root cause. You MUST identify the true underlying defect (e.g., missing package, undefined variable, syntax error, misconfigured environment variable, type mismatch, permission denial).
2. EVIDENCE GROUNDING: Every bullet in "evidence" MUST cite the exact 1-indexed line number from the provided Critical Log Blocks (e.g., "Line 14: Error: Cannot find module ..."). Do not invent line numbers.
3. CONCRETE REMEDIATION: The "suggested_fix" MUST provide exact, copy-pasteable commands, configuration diffs, or code patches directly addressing the root cause.
4. CALIBRATED CONFIDENCE: Output a realistic float between 0.0 and 1.0 reflecting analytical certainty based on whether an explicit error trace is directly visible.
5. STRICT BRANDING: NEVER mention third-party AI provider names or model names (e.g. do not mention Gemini, OpenAI, Claude). Refer to yourself solely as FlowForge AI Diagnostic Engine.
6. Treat graph relationships as supporting evidence, not proof. A PRECEDES edge indicates order only; do not infer causation from it.
7. Analyse the current run independently. Historical runs are references only; verify that any prior fix applies before recommending it.
8. FORMAT: Output MUST BE strictly a valid JSON object matching the schema below.

### IN-CONTEXT FEW-SHOT DEMONSTRATIONS:
{FEW_SHOT_EXEMPLARS}

### JSON OUTPUT SCHEMA:
{{
  "log_analysis": [
    {{
      "error_logs": [[<start_line_number>, <end_line_number>]],
      "analysis": "<technical explanation of what this specific log segment proves>"
    }}
  ],
  "root_cause": [
    "<underlying root cause statement 1>",
    "<underlying root cause statement 2>"
  ],
  "evidence": [
    "Line <N>: <direct factual quote from logs demonstrating the failure>"
  ],
  "suggested_fix": "<actionable remediation steps with exact commands, config changes, or code diff>",
  "confidence": <float between 0.0 and 1.0>
}}

### TARGET WORKFLOW EXECUTION CONTEXT:
- Workflow: {workflow_name}
- Failed Step: {failed_step}
- Branch: {branch}
- Commit: {commit_sha}
- Target Language: {structured_failure.get("language", "unknown")}

### DETERMINISTIC FAILURE SIGNATURE:
- Error Type: {structured_failure.get("error_type", "Unknown")}
- Error Message: {structured_failure.get("error_message", "Unknown")}
- Failing File / Line: {structured_failure.get("file_path", "None")}:{structured_failure.get("line_number", "None")}
- Exit Code: {structured_failure.get("exit_code", 1)}

### PREPROCESSED CRITICAL LOG BLOCKS (Expanded context with 1-indexed lines):
{blocks_text}

### RUN DIFFERENCES (vs. Recent Successful Baseline):
{diff_text}

### HISTORICAL PRECEDENTS (from FlowForge Semantic Memory):
{precedents_text}

### EVIDENCE GRAPH (deterministic event relationships and ranked candidates):
{graph_text}

Perform fine-tuned LogSage root cause analysis and output the JSON report:"""
    return prompt


def _heuristic_fallback(
    structured_failure: dict[str, Any],
    important_blocks: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Fine-tuned, pitch-safe deterministic fallback when upstream API is unreachable.
    Produces high-fidelity, production-grade RCA purely from deterministic AST/regex extraction.
    """
    err_type = structured_failure.get("error_type", "ProcessFailure")
    err_msg = structured_failure.get("error_message", "Step execution exited with non-zero status")
    failed_step = structured_failure.get("failed_step", "execution")
    file_path = structured_failure.get("file_path")
    line_num = structured_failure.get("line_number")
    exit_code = structured_failure.get("exit_code", 1)

    location_str = (
        f" in {file_path}:{line_num}"
        if file_path and line_num
        else (f" in {file_path}" if file_path else "")
    )

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
            evidence.append(
                f"Line {first_b['lines'][0]['line_number']}: {first_b['lines'][0]['text'].strip()}"
            )

    if not evidence:
        evidence.append(f"Execution of step '{failed_step}' terminated with exit code {exit_code}.")

    err_lower = f"{err_type} {err_msg}".lower()

    if "cannot find module" in err_lower or "modulenotfound" in err_lower:
        mod_match = re.search(r"['\"]([^'\"]+)['\"]", err_msg)
        pkg_name = mod_match.group(1) if mod_match else "the missing dependency"
        suggested_fix = (
            f"1. Add '{pkg_name}' to your project dependencies:\n"
            f"   `npm install {pkg_name} --save` (Node.js) or `pip install {pkg_name}` (Python)\n"
            f"2. Verify that package.json or requirements.txt is committed.\n"
            f"3. Run dependency installation locally to ensure clean resolution."
        )
        root_causes = [
            f"Missing runtime or build dependency '{pkg_name}'{location_str}.",
            f"Step '{failed_step}' attempted to import a package not present in the runner environment.",
        ]
        confidence = 0.96

    elif "error ts" in err_lower or "ts2322" in err_lower or "ts1005" in err_lower:
        ts_code = "TS Error"
        ts_m = re.search(r"error\s+(TS\d+)", err_msg, re.IGNORECASE)
        if ts_m:
            ts_code = ts_m.group(1).upper()
        suggested_fix = (
            f"1. Inspect {file_path or 'the source file'} around line {line_num or 'indicated in logs'}.\n"
            f"2. Resolve the TypeScript type mismatch or syntax violation ({ts_code}).\n"
            f"3. Run `npx tsc --noEmit` locally to verify zero compiler errors before pushing."
        )
        root_causes = [
            f"TypeScript static compilation error ({ts_code}){location_str}.",
            f"Type checking gate failed in step '{failed_step}'.",
        ]
        confidence = 0.98

    elif "syntaxerror" in err_lower:
        suggested_fix = (
            f"1. Open {file_path or 'the source file'} and inspect line {line_num or 'indicated in logs'}.\n"
            f"2. Fix invalid syntax or unclosed tokens.\n"
            f"3. Run local linter/compiler (e.g. `npm run lint` or `python -m py_compile`) before pushing."
        )
        root_causes = [
            f"Syntax parsing failure{location_str}.",
            f"Malformed token or language syntax in step '{failed_step}'.",
        ]
        confidence = 0.95

    elif "assertionerror" in err_lower or "test" in failed_step.lower():
        suggested_fix = (
            f"1. Reproduce test failure locally in step '{failed_step}'.\n"
            f"2. Compare expected assertion values against actual function return values.\n"
            f"3. Update either the implementation logic or the test expectations to align with the specification."
        )
        root_causes = [
            f"Automated test assertion failure in step '{failed_step}'.",
            f"Observed error: {err_type}: {err_msg}",
        ]
        confidence = 0.90

    elif "keyerror" in err_lower or "secret" in err_lower or "not set" in err_lower:
        var_match = re.search(
            r"['\"]?([A-Za-z0-9_]+(?:URL|KEY|TOKEN|SECRET|ID|ENV))['\"]?", err_msg
        )
        var_name = var_match.group(1) if var_match else "REQUIRED_SECRET"
        suggested_fix = (
            f"1. In GitHub Repository Settings -> Secrets and variables -> Actions, configure `{var_name}`.\n"
            f"2. Inject the secret into step '{failed_step}' in your workflow YAML file:\n"
            f"   ```yaml\n"
            f"   - name: {failed_step}\n"
            f"     env:\n"
            f"       {var_name}: ${{{{ secrets.{var_name} }}}}\n"
            f"     run: <command>\n"
            f"   ```"
        )
        root_causes = [
            f"Required environment variable or secret '{var_name}' is not configured in step '{failed_step}'.",
            f"Runtime environment lookup failed with {err_type}.",
        ]
        confidence = 0.96

    elif "enoent" in err_lower or "no such file" in err_lower:
        suggested_fix = (
            f"1. Verify that file or directory paths referenced in step '{failed_step}' exist in the repository.\n"
            f"2. If the file is produced by an earlier build step, check build artifact output directory paths.\n"
            f"3. Check for case-sensitivity discrepancies between local OS and Linux CI runners."
        )
        root_causes = [
            f"File system path not found{location_str}.",
            f"Step '{failed_step}' attempted to read or execute a non-existent path.",
        ]
        confidence = 0.92

    elif "eacces" in err_lower or "permission denied" in err_lower:
        suggested_fix = (
            "1. Add executable permissions to script files in your workflow: `chmod +x <script_path>`.\n"
            "2. Avoid writing to protected root paths without appropriate runner privileges."
        )
        root_causes = [
            f"Permission denied during execution of step '{failed_step}'.",
            "Runner process lacked required filesystem permissions.",
        ]
        confidence = 0.94

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
        confidence = 0.78

    log_analysis = []
    for b in important_blocks[:2]:
        log_analysis.append(
            {
                "error_logs": [[b.get("start_line", 1), b.get("end_line", 1)]],
                "analysis": f"Step '{failed_step}' encountered termination trigger: {', '.join(b.get('reasons', ['process_failure']))}.",
            }
        )

    return {
        "log_analysis": log_analysis,
        "root_cause": root_causes,
        "evidence": evidence,
        "suggested_fix": suggested_fix,
        "confidence": confidence,
        "analysis_status": "fallback",
        "model": "FlowForge Deterministic Engine",
    }


def _parse_and_validate_rca_json(raw_text: str, max_line: int | None = None) -> dict[str, Any]:
    """
    Parses model response, stripping markdown fences, and strictly validates
    the LogSage RCA response schema.
    """
    candidate = raw_text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)

    parsed = json.loads(candidate)
    if not isinstance(parsed, dict):
        raise ValueError("RCA response must be an object")
    if (
        not parsed.get("root_cause")
        or not isinstance(parsed.get("suggested_fix"), str)
        or not parsed["suggested_fix"].strip()
    ):
        raise ValueError("RCA response is incomplete")

    root = parsed.get("root_cause")
    if (
        not isinstance(root, (str, list))
        or isinstance(root, list)
        and any(not isinstance(item, str) for item in root)
    ):
        raise ValueError("Invalid root cause type")
    if not isinstance(parsed.get("evidence", []), (str, list)):
        raise ValueError("Invalid evidence type")
    conf = parsed.get("confidence", 0.90)
    try:
        conf_float = float(conf)
        if not math.isfinite(conf_float):
            raise ValueError("Non-finite confidence")
        if conf_float > 1.0:
            conf_float = conf_float / 100.0
        conf_float = max(0.0, min(1.0, round(conf_float, 2)))
    except (ValueError, TypeError):
        raise ValueError("Invalid RCA confidence")

    rc = parsed.get("root_cause")
    if isinstance(rc, str):
        root_cause_list = [rc.strip()]
    elif isinstance(rc, list):
        root_cause_list = [str(item).strip() for item in rc if str(item).strip()]
    else:
        root_cause_list = ["Identified root cause in workflow step execution."]

    if not root_cause_list or any(not item for item in root_cause_list):
        raise ValueError("Empty root cause")

    ev = parsed.get("evidence")
    if isinstance(ev, str):
        evidence_list = [ev.strip()]
    elif isinstance(ev, list):
        evidence_list = [str(item).strip() for item in ev if str(item).strip()]
    else:
        evidence_list = []

    log_an = parsed.get("log_analysis")
    if not isinstance(log_an, list):
        log_an = []

    normalized_log_analysis = []
    for item in log_an:
        if isinstance(item, dict):
            error_logs = item.get("error_logs", [])
            if not isinstance(error_logs, list) or any(
                not isinstance(pair, list)
                or len(pair) != 2
                or any(type(n) is not int for n in pair)
                or pair[0] < 1
                or pair[1] < pair[0]
                or (max_line is not None and pair[1] > max_line)
                for pair in error_logs
            ):
                raise ValueError("Invalid evidence line range")
            analysis_str = str(item.get("analysis", ""))
            normalized_log_analysis.append(
                {
                    "error_logs": error_logs,
                    "analysis": analysis_str,
                }
            )

    suggested_fix = str(
        parsed.get("suggested_fix") or "Inspect failed step logs and reproduce locally."
    )

    return {
        "log_analysis": normalized_log_analysis,
        "root_cause": root_cause_list,
        "evidence": evidence_list,
        "suggested_fix": suggested_fix,
        "confidence": conf_float,
        "analysis_status": "completed",
        "model": "FlowForge RCA Engine (LogSage Deep Analysis)",
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
    evidence_graph: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Executes the fine-tuned LogSage Root Cause Analysis engine.
    Formats structured analyst prompt with few-shot exemplars -> calls model with
    low-temperature JSON configuration -> validates JSON schema -> falls back deterministically.
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
        evidence_graph=evidence_graph,
    )

    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options={"timeout": settings.AI_TIMEOUT_SECONDS * 1000},
    )
    try:
        async with client.aio as async_client:
            response = await asyncio.wait_for(
                async_client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.0, response_mime_type="application/json"
                    ),
                ),
                timeout=settings.AI_TIMEOUT_SECONDS,
            )
        result = _parse_and_validate_rca_json(
            response.text or "", (evidence_graph or {}).get("line_count")
        )
        result["model"] = settings.GEMINI_MODEL
        return result
    except Exception:
        logger.warning(
            "Configured RCA provider unavailable; using deterministic fallback", exc_info=True
        )
        return _heuristic_fallback(structured_failure, important_blocks)


async def run_groq_rca(
    workflow_name: str,
    failed_step: str,
    commit_sha: str,
    branch: str,
    structured_failure: dict[str, Any],
    important_blocks: list[dict[str, Any]],
    differences: list[str],
    historical_precedents: list[dict[str, Any]],
    evidence_graph: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Run the same RCA prompt through Groq's OpenAI-compatible API."""
    if not settings.GROQ_API_KEY:
        return {
            **_heuristic_fallback(structured_failure, important_blocks),
            "analysis_status": "unavailable",
            "model": settings.GROQ_MODEL,
            "error": "GROQ_API_KEY is not configured",
        }

    prompt = _build_rca_prompt(
        workflow_name,
        failed_step,
        commit_sha,
        branch,
        structured_failure,
        important_blocks,
        differences,
        historical_precedents,
        evidence_graph,
    )
    request_payload = {
        "model": settings.GROQ_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Return only the requested JSON object."},
            {"role": "user", "content": prompt},
        ],
    }
    try:
        async with (
            asyncio.timeout(settings.AI_TIMEOUT_SECONDS),
            httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client,
        ):
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                json=request_payload,
            )
            if response.status_code == 400:
                request_payload.pop("response_format", None)
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json=request_payload,
                )
            response.raise_for_status()
            response_body = response.json()
            choices = response_body.get("choices")
            if not isinstance(choices, list) or not choices:
                raise ValueError("Groq returned no completion choices")
            message = choices[0].get("message", {})
            content = message.get("content") if isinstance(message, dict) else None
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Groq returned an empty completion")
            result = _parse_and_validate_rca_json(content, (evidence_graph or {}).get("line_count"))
            result["model"] = settings.GROQ_MODEL
            return result
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Groq RCA request failed with HTTP %s: %s",
            exc.response.status_code,
            exc.response.text[:500],
        )
        return {
            **_heuristic_fallback(structured_failure, important_blocks),
            "analysis_status": "failed",
            "model": settings.GROQ_MODEL,
            "error": f"Groq Cloud HTTP {exc.response.status_code}",
        }
    except Exception as exc:
        logger.warning("Groq RCA request failed: %s", exc)
        return {
            **_heuristic_fallback(structured_failure, important_blocks),
            "analysis_status": "failed",
            "model": settings.GROQ_MODEL,
            "error": "Groq analysis failed. Retry analysis to try again.",
        }
