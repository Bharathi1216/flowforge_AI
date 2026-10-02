import logging
from pathlib import Path
from typing import Any, Optional
from datetime import datetime

import chromadb
from chromadb.config import Settings as ChromaSettings

logger = logging.getLogger(__name__)

# Persistent ChromaDB directory under database/chroma
DEFAULT_CHROMA_DIR = Path(__file__).resolve().parents[3] / "database" / "chroma"


class VectorStoreService:
    def __init__(self, persist_dir: Optional[Path] = None):
        self.persist_dir = persist_dir or DEFAULT_CHROMA_DIR
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(self.persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.failures_col = self.client.get_or_create_collection(
            name="workflow_failures",
            metadata={"description": "CI/CD workflow failure logs and error patterns"},
        )
        self.knowledge_col = self.client.get_or_create_collection(
            name="knowledge_items",
            metadata={"description": "Semantically indexed failure resolutions and pipeline docs"},
        )

    def _clean_text(self, text: Optional[str]) -> str:
        return (text or "").strip()

    def _doc_id(self, repo_id: str, run_id: str, step_name: str) -> str:
        slug = "".join(c if c.isalnum() else "_" for c in step_name.lower())[:30]
        return f"fail-{repo_id}-{run_id}-{slug}"

    def index_failure(
        self,
        repo_id: str,
        run_id: str,
        run_number: int,
        workflow_name: str,
        step_name: str,
        error_snippet: str,
        root_cause: str = "",
        suggested_fix: str = "",
        exit_code: int = 1,
    ) -> str:
        doc_id = self._doc_id(repo_id, run_id, step_name)
        cleaned_snippet = self._clean_text(error_snippet)
        if not cleaned_snippet:
            return ""

        document = (
            f"Workflow: {workflow_name}\n"
            f"Run: #{run_number}\n"
            f"Failed Step: {step_name}\n"
            f"Exit Code: {exit_code}\n"
            f"Error Snippet:\n{cleaned_snippet}\n"
        )
        if root_cause:
            document += f"Root Cause:\n{root_cause}\n"
        if suggested_fix:
            document += f"Suggested Fix:\n{suggested_fix}\n"

        metadata = {
            "repo_id": str(repo_id),
            "run_id": str(run_id),
            "run_number": int(run_number),
            "workflow_name": workflow_name,
            "step_name": step_name,
            "exit_code": int(exit_code),
            "has_fix": bool(suggested_fix),
            "timestamp": datetime.utcnow().isoformat(),
        }

        self.failures_col.upsert(
            ids=[doc_id],
            documents=[document],
            metadatas=[metadata],
        )

        # If a verified fix is available, also record into knowledge base
        if suggested_fix:
            slug = "".join(c if c.isalnum() else "_" for c in step_name.lower())[:30]
            self.index_knowledge_item(
                repo_id=repo_id,
                item_id=f"kb-fail-{run_id}-{slug}",
                error_type=f"{step_name} Failure",
                suggested_fix=suggested_fix,
                category="failure",
                occurrences=1,
                similar_run_id=str(run_id),
                similar_run_number=int(run_number),
            )

        logger.info("Indexed failure log in ChromaDB: %s", doc_id)
        return doc_id

    def find_similar_failures(
        self,
        repo_id: str,
        error_snippet: str,
        current_run_id: Optional[str] = None,
        limit: int = 3,
        min_similarity: float = 0.5,
    ) -> list[dict[str, Any]]:
        cleaned = self._clean_text(error_snippet)
        if not cleaned:
            return []

        try:
            results = self.failures_col.query(
                query_texts=[cleaned],
                n_results=limit + 2,
                where={"repo_id": str(repo_id)},
            )
        except Exception as exc:
            logger.warning("Error querying ChromaDB failures: %s", exc)
            return []

        matches = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return []

        ids = results["ids"][0]
        distances = results.get("distances", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        documents = results.get("documents", [[]])[0]

        for i, match_id in enumerate(ids):
            meta = metadatas[i] if i < len(metadatas) else {}
            # Exclude current run
            if current_run_id and str(meta.get("run_id")) == str(current_run_id):
                continue

            dist = distances[i] if i < len(distances) else 1.0
            similarity = max(0.0, min(1.0, 1.0 - (dist / 2.0)))

            if similarity >= min_similarity:
                matches.append({
                    "id": match_id,
                    "runId": str(meta.get("run_id", "")),
                    "runNumber": meta.get("run_number"),
                    "workflowName": meta.get("workflow_name", ""),
                    "stepName": meta.get("step_name", ""),
                    "similarity": round(similarity, 3),
                    "similarityPercent": int(round(similarity * 100)),
                    "document": documents[i] if i < len(documents) else "",
                    "timestamp": meta.get("timestamp", ""),
                })

            if len(matches) >= limit:
                break

        return matches

    def index_knowledge_item(
        self,
        repo_id: str,
        item_id: str,
        error_type: str,
        suggested_fix: str,
        category: str = "failure",
        occurrences: int = 1,
        similar_run_id: Optional[str] = None,
        similar_run_number: Optional[int] = None,
    ) -> str:
        document = f"Category: {category}\nError Type: {error_type}\nSuggested Fix: {suggested_fix}"
        metadata = {
            "repo_id": str(repo_id),
            "item_id": item_id,
            "error_type": error_type,
            "category": category,
            "occurrences": int(occurrences),
            "last_resolved_at": datetime.utcnow().strftime("%b %d, %Y"),
            "similar_run_id": str(similar_run_id or ""),
            "similar_run_number": int(similar_run_number or 0),
        }

        self.knowledge_col.upsert(
            ids=[item_id],
            documents=[document],
            metadatas=metadata,
        )
        return item_id

    def get_knowledge_base(self, repo_id: str, limit: int = 25) -> list[dict[str, Any]]:
        try:
            results = self.knowledge_col.get(
                where={"repo_id": str(repo_id)},
                limit=limit,
            )
        except Exception as exc:
            logger.warning("Error getting ChromaDB knowledge items: %s", exc)
            return []

        items = []
        if not results or not results.get("ids"):
            return []

        ids = results["ids"]
        metadatas = results.get("metadatas", [])
        documents = results.get("documents", [])

        for i, item_id in enumerate(ids):
            meta = metadatas[i] if i < len(metadatas) else {}
            doc = documents[i] if i < len(documents) else ""

            suggested_fix = ""
            if "Suggested Fix: " in doc:
                suggested_fix = doc.split("Suggested Fix: ")[-1]

            items.append({
                "id": item_id,
                "repoId": str(repo_id),
                "errorType": meta.get("error_type", "Pipeline Diagnostic"),
                "occurrences": meta.get("occurrences", 1),
                "lastResolvedAt": meta.get("last_resolved_at", "Recent"),
                "suggestedFix": suggested_fix,
                "similarRunId": meta.get("similar_run_id") or None,
                "similarRunNumber": meta.get("similar_run_number") or None,
                "category": meta.get("category", "failure"),
            })

        return items

    def search_context(self, repo_id: str, query: str, limit: int = 4) -> list[str]:
        cleaned = self._clean_text(query)
        if not cleaned:
            return []

        snippets = []
        try:
            res_fail = self.failures_col.query(
                query_texts=[cleaned],
                n_results=limit,
                where={"repo_id": str(repo_id)},
            )
            if res_fail and res_fail.get("documents") and res_fail["documents"][0]:
                snippets.extend(res_fail["documents"][0])
        except Exception:
            pass

        try:
            res_kb = self.knowledge_col.query(
                query_texts=[cleaned],
                n_results=limit,
                where={"repo_id": str(repo_id)},
            )
            if res_kb and res_kb.get("documents") and res_kb["documents"][0]:
                snippets.extend(res_kb["documents"][0])
        except Exception:
            pass

        return snippets[:limit]


# Global singleton instance
vector_store = VectorStoreService()
