import unittest

from app.services.evidence_graph import (
    build_evidence_graph,
    graph_context_line_candidates,
    graph_prompt_context,
    graph_response_summary,
)
from app.services.log_preprocessor import preprocess_logs
from app.services.rca_engine import _build_rca_prompt


class EvidenceGraphTests(unittest.TestCase):
    def test_distant_configuration_cause_preserves_source_lines(self):
        logs = "\n".join(
            [
                "DATABASE_URL environment variable is missing",
                *[f"setup output {line}" for line in range(2, 105)],
                "Database initialization fails because configuration is missing",
                *[f"setup output {line}" for line in range(106, 180)],
                "Database connection unavailable after initialization failure",
                *[f"test output {line}" for line in range(181, 245)],
                "Integration tests fail",
                *[f"workflow output {line}" for line in range(246, 310)],
                "Workflow exits with code 1",
            ]
        )

        graph = build_evidence_graph(logs, run_id="run-1")

        config_event = next(node for node in graph["nodes"] if node["category"] == "configuration")
        self.assertEqual(config_event["line_start"], 1)
        self.assertIn(105, [node["line_start"] for node in graph["nodes"]])
        self.assertIn(180, [node["line_start"] for node in graph["nodes"]])
        self.assertIn(245, [node["line_start"] for node in graph["nodes"]])
        self.assertTrue(
            any(
                edge["source_node_id"] == config_event["event_id"]
                and edge["relationship_type"] == "POSSIBLY_CAUSES"
                for edge in graph["edges"]
            )
        )
        self.assertTrue(any(candidate["event_id"] == config_event["event_id"] for candidate in graph["root_cause_candidates"]))
        self.assertTrue(any(item["line_index"] == 0 for item in graph_context_line_candidates(graph)))
        self.assertIn("not a probability", graph_prompt_context(graph))

        blocks, _ = preprocess_logs(
            logs,
            additional_candidates=graph_context_line_candidates(graph),
        )
        captured_lines = {
            line["line_number"]
            for block in blocks
            for line in block["lines"]
        }
        self.assertTrue({1, 105, 180, 245}.issubset(captured_lines))

    def test_dependency_failure_links_shared_package_to_build_failure(self):
        logs = (
            "npm ERR! ERESOLVE unable to resolve dependency tree for widget-kit@2.0\n"
            "Build failed while compiling widget-kit@2.0"
        )
        graph = build_evidence_graph(logs, run_id="run-2")

        self.assertTrue(any(node["category"] == "dependency" for node in graph["nodes"]))
        self.assertTrue(any(node["category"] == "build" for node in graph["nodes"]))
        self.assertTrue(any(edge["relationship_type"] == "POSSIBLY_CAUSES" for edge in graph["edges"]))

    def test_independent_test_failures_remain_separate_causes(self):
        logs = (
            "FAIL tests/a_test.py::test_a AssertionError: expected 1\n"
            "FAIL tests/b_test.py::test_b AssertionError: expected 2"
        )
        graph = build_evidence_graph(logs, run_id="run-3")

        candidates = [node for node in graph["nodes"] if node["category"] == "testing"]
        self.assertEqual(len(candidates), 2)
        self.assertFalse(any(edge["relationship_type"] == "POSSIBLY_CAUSES" for edge in graph["edges"]))
        self.assertEqual(len(graph["root_cause_candidates"]), 2)

    def test_repeated_diagnostic_keeps_each_occurrence(self):
        graph = build_evidence_graph(
            "ModuleNotFoundError: No module named 'alpha'\n"
            "informational line\n"
            "ModuleNotFoundError: No module named 'alpha'",
            run_id="run-4",
        )

        event = next(node for node in graph["nodes"] if node["category"] == "dependency")
        self.assertEqual(event["line_start"], 1)
        self.assertEqual(event["line_end"], 1)
        self.assertEqual(event["occurrences"], [{"line_start": 1, "line_end": 1}, {"line_start": 3, "line_end": 3}])

    def test_exit_without_diagnostic_has_no_root_cause_candidate(self):
        graph = build_evidence_graph("Process completed with exit code 1", run_id="run-5")

        self.assertTrue(graph["insufficient_evidence"])
        self.assertEqual(graph["root_cause_candidates"], [])

    def test_temporal_order_does_not_create_causal_edge(self):
        graph = build_evidence_graph(
            "Database timeout occurred\n"
            "Database connection refused",
            run_id="run-6",
        )

        self.assertTrue(any(edge["relationship_type"] == "PRECEDES" for edge in graph["edges"]))
        self.assertFalse(any(edge["relationship_type"] == "POSSIBLY_CAUSES" for edge in graph["edges"]))

    def test_missing_timestamps_and_explicit_dependencies_are_supported(self):
        graph = build_evidence_graph(
            "Database connection refused\n"
            "Integration test failed; test runner requires database",
            run_id="run-7",
        )

        self.assertTrue(all(node["timestamp"] is None for node in graph["nodes"]))
        self.assertTrue(any(edge["relationship_type"] == "DEPENDS_ON" for edge in graph["edges"]))

    def test_candidate_scores_normalize_available_signals_and_keep_rationale(self):
        graph = build_evidence_graph(
            "Missing environment variable API_TOKEN",
            run_id="run-8",
            weights={"temporal": 0.1, "relevance": 0.3, "relationships": 0.2, "evidence": 0.4, "baseline": 0.0},
        )

        candidate = graph["root_cause_candidates"][0]
        self.assertGreaterEqual(candidate["score"], 0.0)
        self.assertLessEqual(candidate["score"], 1.0)
        self.assertTrue(candidate["reasons"])
        self.assertIn("not a probability", candidate["score_interpretation"])

    def test_graph_and_both_historical_run_types_reach_rca_prompt(self):
        graph = build_evidence_graph(
            "Missing environment variable API_TOKEN\nRuntimeError: authentication failed",
            run_id="run-9",
        )
        prompt = _build_rca_prompt(
            workflow_name="CI",
            failed_step="test",
            commit_sha="abc123",
            branch="main",
            structured_failure={"language": "python"},
            important_blocks=[],
            differences=[],
            historical_precedents=[
                {
                    "runNumber": 5,
                    "runStatus": "success",
                    "similarityPercent": 80,
                    "document": "Known-good authentication setup",
                },
                {
                    "runNumber": 4,
                    "runStatus": "failure",
                    "similarityPercent": 75,
                    "rootCause": "Missing API_TOKEN",
                    "suggestedFix": "Configure the workflow secret.",
                },
            ],
            evidence_graph=graph,
        )

        self.assertIn("EVIDENCE GRAPH", prompt)
        self.assertIn("Successful run #5", prompt)
        self.assertIn("Failed run #4", prompt)
        self.assertIn("Analyse the current run independently", prompt)
        self.assertIn("not a probability of causation", prompt)

    def test_api_graph_summary_keeps_candidates_without_duplicate_nodes(self):
        graph = build_evidence_graph(
            "Missing environment variable API_TOKEN\n"
            "RuntimeError: API_TOKEN was not set",
            run_id="run-10",
        )

        summary = graph_response_summary(graph)
        node_ids = [node["event_id"] for node in summary["nodes"]]
        self.assertEqual(len(node_ids), len(set(node_ids)))
        self.assertTrue(
            set(candidate["event_id"] for candidate in summary["root_cause_candidates"])
            .issubset(node_ids)
        )


if __name__ == "__main__":
    unittest.main()
