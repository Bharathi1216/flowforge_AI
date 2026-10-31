import re
from collections import defaultdict
from typing import Any, Optional

from app.services.log_preprocessor import normalize_line


TIMESTAMP_PATTERN = re.compile(
    r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b"
)
IDENTIFIER_PATTERNS = (
    re.compile(r"\b[A-Z][A-Z0-9_]{2,}\b"),
    re.compile(r"\b(?:TS|EAI|ECONN|ENOENT|EACCES|ERESOLVE)[A-Z0-9_-]*\b", re.IGNORECASE),
    re.compile(r"\b[a-zA-Z0-9_.-]+(?:/[a-zA-Z0-9_.-]+)+\b"),
    re.compile(r"\b[a-zA-Z0-9_.-]+(?:@\d+(?:\.\d+){0,3})\b"),
)

EVENT_RULES = (
    (
        "configuration",
        "configuration",
        "error",
        0.94,
        re.compile(
            r"(?:missing|required|not set|unset|undefined).{0,50}"
            r"(?:environment variable|env(?:ironment)? var|secret|configuration|config)|"
            r"(?:environment variable|env(?:ironment)? var|secret)\s+[\"'`]?([A-Z][A-Z0-9_]+)"
            r"[\"'`]?.{0,50}(?:missing|not set|unset|undefined|required)|"
            r"\b[A-Z][A-Z0-9_]*(?:URL|KEY|TOKEN|SECRET|PASSWORD|HOST|PORT|_ENV)\b"
            r".{0,35}(?:missing|not set|unset|undefined)",
            re.IGNORECASE,
        ),
    ),
    (
        "dependency",
        "dependency",
        "error",
        0.92,
        re.compile(
            r"(?:cannot find module|modulenotfounderror|no module named|"
            r"npm err!|eresolve|dependency conflict|version conflict|"
            r"failed to (?:install|resolve|download).{0,30}(?:package|dependency)|"
            r"could not find a version that satisfies)",
            re.IGNORECASE,
        ),
    ),
    (
        "permission",
        "permissions",
        "error",
        0.91,
        re.compile(r"(?:permission denied|eacces|unauthorized|authentication failed|access denied)", re.IGNORECASE),
    ),
    (
        "artifact",
        "artifact",
        "error",
        0.87,
        re.compile(r"(?:artifact|file).{0,40}(?:not found|missing|could not be accessed|failed to upload|failed to download)|enoent", re.IGNORECASE),
    ),
    (
        "database",
        "database",
        "error",
        0.9,
        re.compile(
            r"(?:\b(?:database|postgres(?:ql)?|mysql|sqlite|sqlalchemy|db)\b.{0,100}"
            r"\b(?:error|fail(?:ed|s|ure)?|refused|unavailable|timeout|timed? out|could not|cannot)\b|"
            r"\b(?:error|fail(?:ed|s|ure)?|refused|unavailable|timeout|timed? out)\b.{0,100}"
            r"\b(?:database|postgres(?:ql)?|mysql|sqlite|sqlalchemy|db)\b)",
            re.IGNORECASE,
        ),
    ),
    (
        "infrastructure",
        "network",
        "error",
        0.88,
        re.compile(
            r"(?:connection (?:refused|timed? out|failed|reset)|"
            r"network is unreachable|host .* unreachable|dns.*(?:failed|error)|"
            r"service unavailable|econnrefused|econnreset|etimedout)",
            re.IGNORECASE,
        ),
    ),
    (
        "testing",
        "tests",
        "error",
        0.86,
        re.compile(r"(?:\btests?\b.*\b(?:fail(?:ed|s|ure)?|error)\b|\b(?:fail(?:ed|s|ure)?|error)\b.*\btests?\b|assertionerror)", re.IGNORECASE),
    ),
    (
        "build",
        "build",
        "error",
        0.87,
        re.compile(r"(?:compilation failed|compile error|build failed|error TS\d+|syntaxerror)", re.IGNORECASE),
    ),
    (
        "runtime",
        "runtime",
        "error",
        0.78,
        re.compile(r"(?:traceback|exception|panic:|fatal:|\b[A-Za-z]+Error:|\bERROR\b)", re.IGNORECASE),
    ),
    (
        "workflow",
        "workflow",
        "error",
        0.62,
        re.compile(r"(?:process completed with exit code [1-9]\d*|exits? with code [1-9]\d*|exit status [1-9]\d*)", re.IGNORECASE),
    ),
)

FAILURE_MARKER = re.compile(
    r"\b(?:failed|failure|error|exception|unavailable|missing|not set|timed? out|refused)\b",
    re.IGNORECASE,
)
CONFIG_MISSING_MARKER = re.compile(r"\b(?:missing|not set|unset|undefined|required)\b", re.IGNORECASE)
INIT_MARKER = re.compile(r"\b(?:initiali[sz](?:e|ation|ing)|startup|boot(?:strap)?)\b", re.IGNORECASE)
CONNECTION_MARKER = re.compile(r"\b(?:connection|connect|timeout|unavailable)\b", re.IGNORECASE)
DEPENDENCY_PHRASE = re.compile(r"\b(?:depends on|requires)\s+([A-Za-z0-9_.-]+)", re.IGNORECASE)
SPECIFIC_COMPONENTS = {
    "database",
    "dependency",
    "network",
    "authentication",
    "permissions",
    "artifact",
}


def _component_for(category: str, message: str) -> Optional[str]:
    lowered = message.lower()
    if category == "configuration":
        if any(token in lowered for token in ("database", "db_url", "database_url", "postgres", "mysql")):
            return "database"
        return "configuration"
    if category == "database":
        return "database"
    if category == "dependency":
        return "dependency"
    if category == "infrastructure":
        return "network"
    if category == "permission":
        return "authentication" if any(token in lowered for token in ("auth", "token", "unauthorized")) else "permissions"
    if category == "testing":
        return "tests"
    if category == "build":
        return "build"
    if category == "artifact":
        return "artifact"
    if category == "runtime":
        return "runtime"
    if category == "workflow":
        return "workflow"
    return None


def _identifiers(message: str) -> list[str]:
    identifiers: set[str] = set()
    for pattern in IDENTIFIER_PATTERNS:
        identifiers.update(match.group(0) for match in pattern.finditer(message))
    for match in DEPENDENCY_PHRASE.finditer(message):
        identifiers.add(match.group(1))
    identifiers = {
        identifier
        for identifier in identifiers
        if identifier.casefold() not in {
            "error", "failed", "failure", "fatal", "warn", "warning", "info",
            "fail", "debug", "exception", "assertionerror",
        }
    }
    return sorted(identifiers, key=str.casefold)


def _classify(message: str) -> Optional[tuple[str, str, str, float]]:
    for category, _, severity, confidence, pattern in EVENT_RULES:
        if pattern.search(message):
            component = _component_for(category, message)
            return category, component or category, severity, confidence
    return None


def _append_edge(
    edges: list[dict[str, Any]],
    seen: set[tuple[str, str, str]],
    source_id: str,
    target_id: str,
    relationship: str,
    evidence: str,
    confidence: float,
) -> None:
    key = (source_id, target_id, relationship)
    if source_id == target_id or key in seen:
        return
    seen.add(key)
    edges.append(
        {
            "source_node_id": source_id,
            "target_node_id": target_id,
            "relationship_type": relationship,
            "supporting_evidence": evidence,
            "relationship_confidence": confidence,
            "relationship_reason": evidence,
        }
    )


def _candidate_signals(
    event: dict[str, Any],
    total_lines: int,
    outgoing_causes: int,
    successful_templates: Optional[set[str]],
) -> tuple[dict[str, float], list[str]]:
    category = event["category"]
    line_count = max(total_lines, 1)
    temporal = max(0.0, min(1.0, 1 - ((event["line_start"] - 1) / line_count)))
    relevance = {
        "configuration": 1.0,
        "dependency": 0.95,
        "permission": 0.9,
        "database": 0.9,
        "infrastructure": 0.88,
        "artifact": 0.85,
        "runtime": 0.82,
        "build": 0.8,
        "testing": 0.72,
        "workflow": 0.2,
    }.get(category, 0.0)
    evidence = min(1.0, event["classification_confidence"] * (0.75 + 0.08 * len(event["identifiers"])))
    signals = {
        "temporal": temporal,
        "relevance": relevance,
        "relationships": min(1.0, outgoing_causes / 2),
        "evidence": evidence,
    }
    reasons = [
        f"category relevance: {category}",
        f"classification confidence: {event['classification_confidence']:.2f}",
    ]
    if outgoing_causes:
        reasons.append(f"supported possible-cause links to {outgoing_causes} later event(s)")
    if event["identifiers"]:
        reasons.append("identifiers: " + ", ".join(event["identifiers"][:5]))
    if successful_templates is not None:
        baseline = 0.0 if normalize_line(event["original_message"]) in successful_templates else 1.0
        signals["baseline"] = baseline
        reasons.append("not present in successful-run baseline" if baseline else "also present in successful-run baseline")
    return signals, reasons


def build_evidence_graph(
    raw_logs: str,
    run_id: str,
    workflow_step: Optional[str] = None,
    successful_templates: Optional[set[str]] = None,
    weights: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    """Build deterministic diagnostic events and evidence-backed relationships."""
    events_by_signature: dict[tuple[str, str], dict[str, Any]] = {}
    raw_lines = raw_logs.splitlines()

    for line_number, raw_line in enumerate(raw_lines, start=1):
        classified = _classify(raw_line)
        if not classified:
            continue
        category, component, severity, confidence = classified
        normalized = normalize_line(raw_line)
        signature = (category, normalized.casefold())
        timestamp_match = TIMESTAMP_PATTERN.search(raw_line)
        if signature in events_by_signature:
            event = events_by_signature[signature]
            event["occurrences"].append({"line_start": line_number, "line_end": line_number})
            continue

        event_id = f"{run_id}:event:{len(events_by_signature) + 1}"
        event = {
            "event_id": event_id,
            "run_id": str(run_id),
            "line_start": line_number,
            "line_end": line_number,
            "timestamp": timestamp_match.group(0) if timestamp_match else None,
            "workflow_step": workflow_step,
            "component": component,
            "category": category,
            "severity": severity,
            "original_message": raw_line.strip(),
            "normalized_message": normalized,
            "identifiers": _identifiers(raw_line),
            "classification_confidence": confidence,
            "occurrences": [{"line_start": line_number, "line_end": line_number}],
        }
        events_by_signature[signature] = event

    events = list(events_by_signature.values())
    edges: list[dict[str, Any]] = []
    seen_edges: set[tuple[str, str, str]] = set()
    previous_by_component: dict[str, dict[str, Any]] = {}
    previous_by_identifier: dict[str, dict[str, Any]] = {}

    for index, event in enumerate(events):
        dependency = DEPENDENCY_PHRASE.search(event["original_message"])
        dependency_name = dependency.group(1).casefold() if dependency else None
        dependency_prerequisite = (
            previous_by_component.get(dependency_name)
            or previous_by_identifier.get(dependency_name)
            if dependency_name
            else None
        )
        component = event.get("component")
        previous_component_event = previous_by_component.get(component) if component else None
        if component in SPECIFIC_COMPONENTS and component in previous_by_component:
            previous = previous_by_component[component]
            _append_edge(
                edges,
                seen_edges,
                previous["event_id"],
                event["event_id"],
                "SAME_COMPONENT",
                f"Both events concern component '{component}'.",
                0.9,
            )
        if component:
            previous_by_component[component] = event

        shared_sources: list[tuple[dict[str, Any], str]] = []
        for identifier in event["identifiers"]:
            previous = previous_by_identifier.get(identifier.casefold())
            if previous:
                _append_edge(
                    edges,
                    seen_edges,
                    previous["event_id"],
                    event["event_id"],
                    "SHARES_IDENTIFIER",
                    f"Both events contain identifier '{identifier}'.",
                    0.95,
                )
                shared_sources.append((previous, identifier))
            previous_by_identifier[identifier.casefold()] = event

        for source, identifier in shared_sources:
            _append_edge(
                edges,
                seen_edges,
                source["event_id"],
                event["event_id"],
                "POSSIBLY_CAUSES",
                f"Both events share identifier '{identifier}', and the later event reports a failure; this is supporting evidence, not proof of causation.",
                0.72,
            )
            _append_edge(
                edges,
                seen_edges,
                source["event_id"],
                event["event_id"],
                "PROPAGATES_TO",
                f"Failure-related events share identifier '{identifier}' in log order.",
                0.68,
            )

        if index:
            previous = events[index - 1]
            immediately_related = (
                previous.get("component") == component and component in SPECIFIC_COMPONENTS
            ) or any(source["event_id"] == previous["event_id"] for source, _ in shared_sources)
            if immediately_related:
                _append_edge(
                    edges,
                    seen_edges,
                    previous["event_id"],
                    event["event_id"],
                    "PRECEDES",
                    f"Log line {previous['line_start']} precedes line {event['line_start']}; temporal ordering only.",
                    1.0,
                )

        if previous_component_event and previous_component_event is not event:
            source_message = previous_component_event["original_message"]
            target_message = event["original_message"]
            same_component_failure_chain = (
                previous_component_event["category"] == "configuration"
                and CONFIG_MISSING_MARKER.search(source_message)
                and FAILURE_MARKER.search(target_message)
            ) or (
                INIT_MARKER.search(source_message)
                and FAILURE_MARKER.search(source_message)
                and CONNECTION_MARKER.search(target_message)
            )
            if same_component_failure_chain:
                _append_edge(
                    edges,
                    seen_edges,
                    previous_component_event["event_id"],
                    event["event_id"],
                    "POSSIBLY_CAUSES",
                    f"An explicit configuration or initialization failure is followed by a failure for the same component '{component}'.",
                    0.7,
                )
                _append_edge(
                    edges,
                    seen_edges,
                    previous_component_event["event_id"],
                    event["event_id"],
                    "PROPAGATES_TO",
                    f"Failure messages indicate a possible downstream effect within component '{component}'.",
                    0.65,
                )

        if dependency and dependency_prerequisite:
            if dependency_prerequisite["event_id"] != event["event_id"]:
                _append_edge(
                    edges,
                    seen_edges,
                    event["event_id"],
                    dependency_prerequisite["event_id"],
                    "DEPENDS_ON",
                    f"Log explicitly states that this operation requires '{dependency.group(1)}'.",
                    0.9,
                )

    outgoing_causes: defaultdict[str, int] = defaultdict(int)
    for edge in edges:
        if edge["relationship_type"] == "POSSIBLY_CAUSES":
            outgoing_causes[edge["source_node_id"]] += 1

    configured_weights = weights or {
        "temporal": 0.2,
        "relevance": 0.2,
        "relationships": 0.2,
        "evidence": 0.2,
        "baseline": 0.2,
    }
    ranked_candidates = []
    for event in events:
        if event["category"] in {"workflow"}:
            continue
        if event["severity"] not in {"error", "critical"}:
            continue
        signals, reasons = _candidate_signals(
            event,
            len(raw_lines),
            outgoing_causes[event["event_id"]],
            successful_templates,
        )
        available_weights = {
            name: max(0.0, float(configured_weights.get(name, 0.0)))
            for name in signals
        }
        weight_total = sum(available_weights.values())
        score = (
            sum(signals[name] * available_weights[name] for name in signals) / weight_total
            if weight_total
            else 0.0
        )
        ranked_candidates.append(
            {
                "event_id": event["event_id"],
                "score": round(score, 4),
                "signals": {key: round(value, 4) for key, value in signals.items()},
                "reasons": reasons,
                "score_interpretation": "ranking score, not a probability of causation",
            }
        )
    ranked_candidates.sort(key=lambda item: (-item["score"], item["event_id"]))
    for rank, candidate in enumerate(ranked_candidates, start=1):
        candidate["rank"] = rank

    return {
        "version": "egfa-v1",
        "run_id": str(run_id),
        "nodes": events,
        "edges": edges,
        "root_cause_candidates": ranked_candidates,
        "insufficient_evidence": not ranked_candidates,
        "line_count": len(raw_lines),
    }


def graph_context_line_candidates(graph: dict[str, Any]) -> list[dict[str, Any]]:
    """Return event lines prioritized for the existing context expansion/pruning."""
    node_by_id = {node["event_id"]: node for node in graph.get("nodes", [])}
    ranks = {
        candidate["event_id"]: candidate["rank"]
        for candidate in graph.get("root_cause_candidates", [])
    }
    candidate_ids = {
        candidate["event_id"]
        for candidate in graph.get("root_cause_candidates", [])[:5]
    }
    selected_ids = set(candidate_ids)
    for edge in graph.get("edges", []):
        if edge["source_node_id"] in candidate_ids or edge["target_node_id"] in candidate_ids:
            selected_ids.update((edge["source_node_id"], edge["target_node_id"]))
    candidates = []
    for event_id in selected_ids:
        node = node_by_id.get(event_id)
        if not node:
            continue
        rank = ranks.get(event_id, 6)
        candidates.append(
            {
                "line_index": node["line_start"] - 1,
                "line_number": node["line_start"],
                "raw_line": node["original_message"],
                "normalized_line": node["normalized_message"],
                "score": max(1.0, 8.0 - rank),
                "reasons": ["evidence_graph_event", f"graph_candidate_rank:{rank}"],
            }
        )
    return candidates


def graph_prompt_context(graph: dict[str, Any], max_chars: int = 1800) -> str:
    """Format a compact, uncertainty-aware graph summary for the RCA prompt."""
    if graph.get("insufficient_evidence"):
        return "No strongly classified root-cause candidate was identified; do not infer one from temporal ordering alone."

    node_by_id = {node["event_id"]: node for node in graph.get("nodes", [])}
    candidate_ids = {
        item["event_id"]
        for item in graph.get("root_cause_candidates", [])[:4]
    }
    relevant_edges = []
    for edge in graph.get("edges", []):
        if edge["source_node_id"] in candidate_ids or edge["target_node_id"] in candidate_ids:
            relevant_edges.append(edge)

    lines = ["Candidate ranking scores prioritize evidence; a score is not a probability of causation."]
    for candidate in graph.get("root_cause_candidates", [])[:4]:
        node = node_by_id.get(candidate["event_id"])
        if node:
            step = f" step={node['workflow_step']}" if node.get("workflow_step") else ""
            identifiers = (
                f" identifiers={','.join(node['identifiers'][:5])}"
                if node["identifiers"]
                else ""
            )
            reasons = "; ".join(candidate.get("reasons", [])[:2])
            lines.append(
                f"Candidate #{candidate['rank']} score={candidate['score']:.3f}: "
                f"line {node['line_start']} [{node['category']}/{node['component']}{step}] "
                f"{node['original_message']}{identifiers}; reasons: {reasons}"
            )
    for edge in relevant_edges[:10]:
        source = node_by_id.get(edge["source_node_id"])
        target = node_by_id.get(edge["target_node_id"])
        if source and target and edge["relationship_type"] != "PRECEDES":
            lines.append(
                f"{edge['relationship_type']}: line {source['line_start']} -> "
                f"line {target['line_start']} ({edge['supporting_evidence']})"
            )
    if not relevant_edges:
        lines.append("No supported causal relationship was identified; events remain unconnected.")
    if len(graph.get("nodes", [])) > len(candidate_ids):
        lines.append(
            f"{len(graph['nodes']) - len(candidate_ids)} other event(s) were omitted from this compact summary."
        )
    included = []
    current_length = 0
    for line in lines:
        addition = len(line) + (1 if included else 0)
        if current_length + addition > max_chars:
            included.append("Additional graph evidence omitted to respect the prompt budget.")
            break
        included.append(line)
        current_length += addition
    return "\n".join(included)


def graph_response_summary(graph: dict[str, Any]) -> dict[str, Any]:
    """Return a small API summary while the complete graph remains persisted."""
    candidates = graph.get("root_cause_candidates", [])[:5]
    candidate_ids = {candidate["event_id"] for candidate in candidates}
    relevant_ids = set(candidate_ids)
    for edge in graph.get("edges", []):
        if edge["source_node_id"] in candidate_ids or edge["target_node_id"] in candidate_ids:
            relevant_ids.update((edge["source_node_id"], edge["target_node_id"]))
    nodes_by_id = {node["event_id"]: node for node in graph.get("nodes", [])}
    ordered_ids = [candidate["event_id"] for candidate in candidates]
    ordered_ids.extend(
        node["event_id"]
        for node in graph.get("nodes", [])
        if node["event_id"] in relevant_ids and node["event_id"] not in candidate_ids
    )
    nodes = [nodes_by_id[node_id] for node_id in ordered_ids[:12] if node_id in nodes_by_id]
    node_ids = {node["event_id"] for node in nodes}
    edges = [
        edge for edge in graph.get("edges", [])
        if edge["source_node_id"] in node_ids and edge["target_node_id"] in node_ids
    ][:20]
    return {
        "version": graph.get("version", "egfa-v1"),
        "nodes": nodes,
        "edges": edges,
        "root_cause_candidates": candidates,
        "insufficient_evidence": bool(graph.get("insufficient_evidence", True)),
        "line_count": graph.get("line_count", 0),
    }
