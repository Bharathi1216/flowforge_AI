import logging
import re
from typing import Any, Optional, Set

from app.config import settings

logger = logging.getLogger(__name__)

# Configurable regexes for dynamic noise normalization
TIMESTAMP_RE = re.compile(
    r"\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b"
)
UUID_RE = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)
HEX_ADDR_RE = re.compile(r"\b0x[0-9a-fA-F]{6,16}\b")
GIT_SHA_RE = re.compile(r"\b[0-9a-f]{40}\b")
PID_RE = re.compile(r"\b(?:PID|pid)[\s:=]+\d+\b")
TEMP_PATH_RE = re.compile(
    r"(?:/tmp/[^ \n\r\t]+|[A-Za-z]:\\[^ \n\r\t]*\\(?:Temp|temp)\\[^ \n\r\t]+|/home/runner/work/[^/]+/[^/]+)"
)


def normalize_line(line: str) -> str:
    """
    Normalizes dynamic noise (timestamps, UUIDs, temp paths, hex addresses)
    while strictly preserving error types, filenames, package names, line numbers,
    and technical diagnostics.
    """
    text = TIMESTAMP_RE.sub("<TIMESTAMP>", line)
    text = UUID_RE.sub("<UUID>", text)
    text = HEX_ADDR_RE.sub("<ADDR>", text)
    text = GIT_SHA_RE.sub("<SHA>", text)
    text = PID_RE.sub("<PID>", text)
    text = TEMP_PATH_RE.sub("<TEMP_PATH>", text)
    return text.strip()


def get_default_keywords() -> list[str]:
    raw = getattr(settings, "RCA_KEYWORDS", "")
    if raw:
        return [k.strip().lower() for k in raw.split(",") if k.strip()]
    return [
        "fatal",
        "fail",
        "failed",
        "panic",
        "error",
        "exit",
        "kill",
        "no such file",
        "missing",
        "exception",
        "cannot",
        "traceback",
        "npm err",
        "exit code",
        "exit status",
    ]


def filter_candidate_lines(
    raw_lines: list[str],
    failed_step_name: Optional[str] = None,
    successful_line_templates: Optional[Set[str]] = None,
    keywords: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    """
    Step 1: Key Log Filtering.
    Identifies candidate error lines using:
    - Configurable keyword matching
    - Log-tail prioritization (exponential/linear boost near log end)
    - Successful-run differential comparison (demotes/filters stable lines)
    - Failed-step prioritization
    """
    kw_list = keywords or get_default_keywords()
    successful_templates = successful_line_templates or set()
    total_lines = len(raw_lines)
    candidates = []

    for idx, raw_line in enumerate(raw_lines):
        line_num = idx + 1  # 1-indexed
        lowered = raw_line.lower()
        normalized = normalize_line(raw_line)

        # Skip empty lines or pure whitespace
        if not raw_line.strip():
            continue

        matched_keywords = [kw for kw in kw_list if kw in lowered]
        if not matched_keywords:
            continue

        # Check if line appears identically in successful runs (stable boilerplate)
        if normalized in successful_templates:
            # Demote boilerplates unless it has an explicit high-severity crash keyword
            if not any(
                crit in lowered
                for crit in (
                    "fatal",
                    "panic",
                    "exit code 1",
                    "exit status 1",
                    "syntaxerror",
                    "modulenotfound",
                )
            ):
                continue

        reasons = [f"keyword:{kw}" for kw in matched_keywords]
        base_score = 1.0 + (len(matched_keywords) * 0.5)

        # Log-tail prioritization: failure indications frequently appear in the last 25% of logs
        tail_ratio = line_num / max(total_lines, 1)
        if tail_ratio >= 0.75:
            base_score += 1.5
            reasons.append("tail_proximity")
        elif tail_ratio >= 0.50:
            base_score += 0.8

        # Explicit exception / stack trace indicators
        if any(
            marker in lowered
            for marker in (
                "syntaxerror",
                "typeerror",
                "referenceerror",
                "assertionerror",
                "modulenotfound",
                "cannot find module",
            )
        ):
            base_score += 2.5
            reasons.append("explicit_exception")

        if any(
            marker in lowered for marker in ("at ", "line ", "traceback (most recent call last)")
        ):
            base_score += 1.0
            reasons.append("stack_trace_trace")

        if "exit code" in lowered or "exit status" in lowered or "exited with" in lowered:
            base_score += 1.5
            reasons.append("process_termination")

        # Differential novelty against successful runs
        if normalized not in successful_templates:
            base_score += 1.0
            reasons.append("diff_from_successful")

        candidates.append(
            {
                "line_index": idx,
                "line_number": line_num,
                "raw_line": raw_line,
                "normalized_line": normalized,
                "score": base_score,
                "reasons": reasons,
            }
        )

    return candidates


def expand_blocks(
    candidates: list[dict[str, Any]],
    raw_lines: list[str],
    context_before: Optional[int] = None,
    context_after: Optional[int] = None,
) -> list[dict[str, Any]]:
    """
    Step 2: Key Log Expansion.
    Expands each candidate error line with:
    - CONTEXT_BEFORE (default 4) lines before
    - The candidate line
    - CONTEXT_AFTER (default 6) lines after
    Merges overlapping blocks while preserving original 1-indexed line numbers.
    """
    before = (
        context_before if context_before is not None else getattr(settings, "RCA_CONTEXT_BEFORE", 4)
    )
    after = (
        context_after if context_after is not None else getattr(settings, "RCA_CONTEXT_AFTER", 6)
    )
    total_lines = len(raw_lines)

    if not candidates:
        return []

    # Build initial intervals [start_idx, end_idx]
    intervals = []
    for cand in candidates:
        c_idx = cand["line_index"]
        start_idx = max(0, c_idx - before)
        end_idx = min(total_lines - 1, c_idx + after)
        intervals.append(
            {
                "start": start_idx,
                "end": end_idx,
                "candidate_indices": {c_idx},
                "scores": [cand["score"]],
                "reasons": set(cand["reasons"]),
            }
        )

    # Sort intervals by start index
    intervals.sort(key=lambda x: x["start"])

    # Merge overlapping or contiguous intervals
    merged = []
    current = intervals[0]

    for next_inv in intervals[1:]:
        if next_inv["start"] <= current["end"] + 1:
            # Overlapping or adjacent, merge
            current["end"] = max(current["end"], next_inv["end"])
            current["candidate_indices"].update(next_inv["candidate_indices"])
            current["scores"].extend(next_inv["scores"])
            current["reasons"].update(next_inv["reasons"])
        else:
            merged.append(current)
            current = next_inv
    merged.append(current)

    # Format merged blocks with 1-indexed lines
    blocks = []
    for m in merged:
        start_idx = m["start"]
        end_idx = m["end"]
        block_lines = []
        for l_idx in range(start_idx, end_idx + 1):
            block_lines.append(
                {
                    "line_number": l_idx + 1,
                    "text": raw_lines[l_idx],
                    "is_candidate": l_idx in m["candidate_indices"],
                }
            )

        importance_score = sum(m["scores"]) / len(m["scores"]) + (len(m["candidate_indices"]) * 0.5)

        # Render clean text representation with line numbers
        formatted_text = "\n".join(
            f"{item['line_number']:5d} | {item['text']}" for item in block_lines
        )

        blocks.append(
            {
                "start_line": start_idx + 1,
                "end_line": end_idx + 1,
                "lines": block_lines,
                "text": formatted_text,
                "importance_score": round(importance_score, 2),
                "reasons": sorted(list(m["reasons"])),
                "line_count": len(block_lines),
            }
        )

    return blocks


def prune_blocks(
    blocks: list[dict[str, Any]],
    max_tokens: Optional[int] = None,
) -> list[dict[str, Any]]:
    """
    Step 3: Token Overflow Pruning.
    Ranks blocks by importance density and preserves highest-value blocks
    within the configured budget. Restores chronological ordering.
    """
    budget = max_tokens if max_tokens is not None else getattr(settings, "RCA_MAX_TOKENS", 4000)
    # Approximation: ~3.5 characters per token in code/log text
    max_chars = max(0, int(budget * 3.5))

    if not blocks:
        return []

    # Sort blocks by importance score descending
    ranked = sorted(blocks, key=lambda b: b["importance_score"], reverse=True)

    selected = []
    accumulated_chars = 0

    for block in ranked:
        block_char_len = len(block["text"])
        if accumulated_chars + block_char_len <= max_chars:
            selected.append(block)
            accumulated_chars += block_char_len
        elif not selected:
            # Keep source line numbers while fitting even a single dense error block.
            remaining = max_chars
            kept = []
            priority = sorted(block["lines"], key=lambda line: not line.get("is_candidate", False))
            for line in priority:
                rendered = f"{line['line_number']:5d} | {line['text']}"
                if len(rendered) + 1 <= remaining:
                    kept.append(line)
                    remaining -= len(rendered) + 1
            if kept:
                kept.sort(key=lambda line: line["line_number"])
                selected.append(
                    {
                        **block,
                        "lines": kept,
                        "line_count": len(kept),
                        "start_line": kept[0]["line_number"],
                        "end_line": kept[-1]["line_number"],
                        "text": "\n".join(
                            f"{line['line_number']:5d} | {line['text']}" for line in kept
                        ),
                    }
                )
                accumulated_chars = max_chars - remaining

    # Restore chronological ordering for coherent prompt presentation
    selected.sort(key=lambda b: b["start_line"])
    return selected


def preprocess_logs(
    raw_logs: str,
    failed_step_name: Optional[str] = None,
    successful_run_templates: Optional[Set[str]] = None,
    context_before: Optional[int] = None,
    context_after: Optional[int] = None,
    max_tokens: Optional[int] = None,
    additional_candidates: Optional[list[dict[str, Any]]] = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Full LogSage Preprocessing Pipeline:
    Raw Log -> Filtering -> Expansion (m=4, n=6) -> Pruning.
    Returns (critical_blocks, candidate_lines).
    """
    raw_lines = raw_logs.splitlines()
    if not raw_lines:
        return [], []

    candidates = filter_candidate_lines(
        raw_lines=raw_lines,
        failed_step_name=failed_step_name,
        successful_line_templates=successful_run_templates,
    )
    existing_indices = {candidate["line_index"] for candidate in candidates}
    for candidate in additional_candidates or []:
        line_index = candidate.get("line_index")
        if not isinstance(line_index, int) or not 0 <= line_index < len(raw_lines):
            continue
        if line_index in existing_indices:
            existing = next(item for item in candidates if item["line_index"] == line_index)
            existing["reasons"] = sorted(
                set(existing["reasons"]) | set(candidate.get("reasons", []))
            )
            existing["score"] = max(existing["score"], float(candidate.get("score", 1.0)))
            continue
        candidates.append(
            {
                **candidate,
                "line_number": line_index + 1,
                "raw_line": raw_lines[line_index],
                "normalized_line": normalize_line(raw_lines[line_index]),
                "score": float(candidate.get("score", 1.0)),
                "reasons": list(candidate.get("reasons", ["additional_candidate"])),
            }
        )
        existing_indices.add(line_index)

    # Fallback: if no candidates found via strict keywords, take tail of log
    if not candidates:
        tail_start = max(0, len(raw_lines) - 25)
        for idx in range(tail_start, len(raw_lines)):
            if raw_lines[idx].strip():
                candidates.append(
                    {
                        "line_index": idx,
                        "line_number": idx + 1,
                        "raw_line": raw_lines[idx],
                        "normalized_line": normalize_line(raw_lines[idx]),
                        "score": 1.0,
                        "reasons": ["log_tail_fallback"],
                    }
                )

    blocks = expand_blocks(
        candidates=candidates,
        raw_lines=raw_lines,
        context_before=context_before,
        context_after=context_after,
    )

    pruned = prune_blocks(blocks, max_tokens=max_tokens)
    return pruned, candidates
