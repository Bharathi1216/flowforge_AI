import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Common regex patterns to deterministically parse error signatures
EXCEPTION_PATTERNS = [
    re.compile(r"([A-Za-z0-9_]+Error):\s*(.+)", re.IGNORECASE),
    re.compile(r"(error TS\d+):\s*(.+)", re.IGNORECASE),
    re.compile(r"(Cannot find module\s*['\"]([^'\"]+)['\"])", re.IGNORECASE),
    re.compile(r"(ModuleNotFoundError:\s*No module named\s*['\"]([^'\"]+)['\"])", re.IGNORECASE),
    re.compile(r"(SyntaxError:\s*.+)", re.IGNORECASE),
    re.compile(r"(TypeError:\s*.+)", re.IGNORECASE),
    re.compile(r"(AssertionError:\s*.+)", re.IGNORECASE),
    re.compile(r"(KeyError:\s*.+)", re.IGNORECASE),
    re.compile(r"(ImportError:\s*.+)", re.IGNORECASE),
    re.compile(r"(IndentationError:\s*.+)", re.IGNORECASE),
    re.compile(r"(npm ERR!\s*code\s*([A-Z0-9_]+))", re.IGNORECASE),
    re.compile(r"(npm ERR!\s*ERESOLVE\s*.+)", re.IGNORECASE),
    re.compile(r"(ENOENT:\s*no such file or directory[^\n]+)", re.IGNORECASE),
    re.compile(r"(EACCES:\s*permission denied[^\n]+)", re.IGNORECASE),
    re.compile(r"(EADDRINUSE:\s*address already in use[^\n]+)", re.IGNORECASE),
    re.compile(r"(ECONNREFUSED:\s*connection refused[^\n]+)", re.IGNORECASE),
    re.compile(r"(command not found:\s*([A-Za-z0-9_-]+))", re.IGNORECASE),
    re.compile(r"(Required secret\s+['\"]?([A-Za-z0-9_]+)['\"]?\s+is not set)", re.IGNORECASE),
    re.compile(r"([A-Za-z0-9_]+_is_not_set)", re.IGNORECASE),
    re.compile(r"(panic:\s*(.+))", re.IGNORECASE),
    re.compile(r"(fatal:\s*(.+))", re.IGNORECASE),
    re.compile(r"(FAIL\s+([A-Za-z0-9_./\\-]+\.(?:ts|tsx|js|jsx|py)))", re.IGNORECASE),
    re.compile(r"(FAILED\s+([A-Za-z0-9_./\\-]+::[A-Za-z0-9_]+))", re.IGNORECASE),
]

FILE_LINE_PATTERNS = [
    re.compile(r"(?:at\s+|in\s+)?([A-Za-z0-9_./\\-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|cpp|c|sh)):(\d+)(?::(\d+))?"),
    re.compile(r"File\s+['\"]([^'\"]+\.py)['\"],\s+line\s+(\d+)"),
]

LANGUAGE_EXTENSIONS = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
}


def _slugify(value: str, max_len: int = 40) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", value.lower()).strip("_")
    return re.sub(r"_+", "_", cleaned)[:max_len] or "unknown"


def extract_structured_failure(
    workflow_name: str,
    run_id: str,
    failed_step: str,
    branch: str,
    commit_sha: Optional[str],
    raw_lines: list[str],
    important_blocks: list[dict[str, Any]],
    exit_code: int = 1,
    repo_language: Optional[str] = None,
) -> dict[str, Any]:
    """
    Step 7: Deterministic Structured Failure Extraction.
    Extracts explicit error metadata without guessing or querying an LLM.
    """
    error_type = "ProcessFailure"
    error_message = "Step execution exited with non-zero status"
    exception = ""
    file_path = None
    line_number = None
    language = (repo_language or "").lower()

    # Search through candidate lines & important blocks
    search_lines = []
    for b in important_blocks:
        for l in b.get("lines", []):
            search_lines.append(l.get("text", ""))
    if not search_lines:
        search_lines = raw_lines[-50:]

    # 1. Match Exception & Error Message
    for line in search_lines:
        for pattern in EXCEPTION_PATTERNS:
            match = pattern.search(line)
            if match:
                matched_text = match.group(0).strip()
                exception = matched_text
                if len(match.groups()) >= 2:
                    error_type = match.group(1).strip()
                    error_message = match.group(2).strip()
                else:
                    error_type = match.group(1).strip()
                    error_message = matched_text
                break
        if exception:
            break

    # 2. Match File Path & Line Number
    for line in search_lines:
        for pattern in FILE_LINE_PATTERNS:
            match = pattern.search(line)
            if match:
                file_path = match.group(1).replace("\\", "/")
                try:
                    line_number = int(match.group(2))
                except (ValueError, TypeError):
                    line_number = None

                # Infer language from file extension if not provided
                if not language:
                    for ext, lang in LANGUAGE_EXTENSIONS.items():
                        if file_path.endswith(ext):
                            language = lang
                            break
                break
        if file_path:
            break

    if not language:
        language = "unknown"

    return {
        "workflow_name": workflow_name,
        "run_id": str(run_id),
        "failed_step": failed_step,
        "error_type": error_type,
        "error_message": error_message,
        "exception": exception or f"{error_type}: {error_message}",
        "file_path": file_path,
        "line_number": line_number,
        "exit_code": exit_code,
        "branch": branch,
        "commit_sha": commit_sha or "HEAD",
        "language": language,
        "important_log_blocks": important_blocks,
    }


def generate_failure_fingerprint(structured: dict[str, Any]) -> str:
    """
    Step 8: Normalized Failure Fingerprint.
    Builds a stable, deterministic failure signature avoiding timestamps or run IDs:
    e.g. javascript::npm_test::modulenotfounderror::jsonwebtoken::src_auth_login_js
    """
    lang_slug = _slugify(structured.get("language") or "unknown", 15)
    step_slug = _slugify(structured.get("failed_step") or "step", 25)
    err_slug = _slugify(structured.get("error_type") or "error", 30)

    # Core message slug: keep first 3 words
    msg = structured.get("error_message") or ""
    msg_words = [w for w in re.split(r"\W+", msg) if len(w) > 2][:3]
    msg_slug = _slugify("_".join(msg_words), 35) or "generic"

    file_slug = "nofile"
    if structured.get("file_path"):
        file_slug = _slugify(structured["file_path"].split("/")[-1], 25)

    fingerprint = f"{lang_slug}::{step_slug}::{err_slug}::{msg_slug}::{file_slug}"
    return fingerprint[:255]
