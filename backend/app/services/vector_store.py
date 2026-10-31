import logging
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import text

from app.db.database import engine
from app.services.embedding_model import embedding_model

logger = logging.getLogger(__name__)

VECTOR_DIMENSIONS = 384


class VectorStoreService:
    """Supabase pgvector-backed store."""

    def __init__(self) -> None:
        self.embedding_model = embedding_model

    def _clean_text(self, value: Optional[str]) -> str:
        return (value or "").strip()

    def _embed(self, value: str) -> list[float]:
        embedding = self.embedding_model.embed(value)
        if len(embedding) != VECTOR_DIMENSIONS:
            raise ValueError(
                f"Embedding model returned {len(embedding)} dimensions; "
                f"expected {VECTOR_DIMENSIONS}"
            )
        return [float(item) for item in embedding]

    def _vector_literal(self, embedding: list[float]) -> str:
        return "[" + ",".join(str(value) for value in embedding) + "]"

    def _upsert(
        self,
        item_id: str,
        collection_name: str,
        document: str,
        metadata: dict[str, Any],
    ) -> None:
        embedding = self._vector_literal(self._embed(document))
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO vector_documents (
                        id, collection_name, document, metadata, embedding
                    )
                    VALUES (
                        :id, :collection_name, :document,
                        CAST(:metadata AS jsonb), CAST(:embedding AS vector)
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        collection_name = EXCLUDED.collection_name,
                        document = EXCLUDED.document,
                        metadata = EXCLUDED.metadata,
                        embedding = EXCLUDED.embedding
                    """
                ),
                {
                    "id": item_id,
                    "collection_name": collection_name,
                    "document": document,
                    "metadata": __import__("json").dumps(metadata),
                    "embedding": embedding,
                },
            )

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

        self._upsert(
            doc_id,
            "workflow_failures",
            document,
            {
                "repo_id": str(repo_id),
                "run_id": str(run_id),
                "run_number": int(run_number),
                "workflow_name": workflow_name,
                "step_name": step_name,
                "exit_code": int(exit_code),
                "has_fix": bool(suggested_fix),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

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

        logger.info("Indexed failure log in Supabase pgvector: %s", doc_id)
        return doc_id

    def index_success(
        self,
        repo_id: str,
        run_id: str,
        run_number: int,
        workflow_name: str,
        step_name: str,
        log_excerpt: str,
    ) -> str:
        """Index successful workflow evidence as a distinct retrieval collection."""
        cleaned_excerpt = self._clean_text(log_excerpt)
        if not cleaned_excerpt:
            return ""
        slug = "".join(c if c.isalnum() else "_" for c in step_name.lower())[:30]
        doc_id = f"success-{repo_id}-{run_id}-{slug}"
        if engine.dialect.name == "postgresql":
            with engine.connect() as connection:
                exists = connection.execute(
                    text(
                        """
                        SELECT 1
                        FROM vector_documents
                        WHERE id = :id AND collection_name = 'workflow_successes'
                        """
                    ),
                    {"id": doc_id},
                ).first()
            if exists:
                return doc_id
        document = (
            f"Workflow: {workflow_name}\n"
            f"Run: #{run_number}\n"
            f"Run Status: successful\n"
            f"Step: {step_name}\n"
            f"Known-good Log Context:\n{cleaned_excerpt[:6000]}\n"
        )
        self._upsert(
            doc_id,
            "workflow_successes",
            document,
            {
                "repo_id": str(repo_id),
                "run_id": str(run_id),
                "run_number": int(run_number),
                "workflow_name": workflow_name,
                "step_name": step_name,
                "run_status": "success",
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        logger.info("Indexed successful workflow context in pgvector: %s", doc_id)
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

        query_vector = self._vector_literal(self._embed(cleaned))
        exclude_current_run = (
            "AND (metadata->>'run_id' IS NULL OR metadata->>'run_id' <> :current_run_id)"
            if current_run_id
            else ""
        )
        parameters: dict[str, Any] = {
            "repo_id": str(repo_id),
            "query_vector": query_vector,
            "limit": max(limit + 2, 1),
        }
        if current_run_id:
            parameters["current_run_id"] = str(current_run_id)

        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    f"""
                    SELECT
                        id, collection_name, document, metadata,
                        1 - (embedding <=> CAST(:query_vector AS vector))
                            AS similarity
                    FROM vector_documents
                    WHERE collection_name IN (
                        'workflow_failures', 'workflow_successes', 'knowledge_items'
                    )
                      AND metadata->>'repo_id' = :repo_id
                      {exclude_current_run}
                    ORDER BY embedding <=> CAST(:query_vector AS vector)
                    LIMIT :limit
                    """
                ),
                parameters,
            ).mappings().all()

        matches = []
        for row in rows:
            similarity = max(0.0, min(1.0, float(row["similarity"])))
            if similarity < min_similarity:
                continue
            metadata = row["metadata"] or {}
            document = row["document"] or ""
            matches.append(
                {
                    "id": row["id"],
                    "runId": str(metadata.get("run_id") or metadata.get("similar_run_id") or ""),
                    "runNumber": metadata.get("run_number") or metadata.get("similar_run_number"),
                    "workflowName": metadata.get("workflow_name", ""),
                    "stepName": metadata.get("step_name", ""),
                    "runStatus": metadata.get(
                        "run_status",
                        "success" if row["collection_name"] == "workflow_successes" else "failure",
                    ),
                    "rootCause": (
                        document.split("Root Cause:\n", 1)[1].split("\n", 1)[0]
                        if "Root Cause:\n" in document
                        else metadata.get("error_type", "")
                    ),
                    "suggestedFix": (
                        document.split("Suggested Fix:\n", 1)[1].strip()
                        if "Suggested Fix:\n" in document
                        else document.split("Suggested Fix: ", 1)[1].strip()
                        if "Suggested Fix: " in document
                        else ""
                    ),
                    "similarity": round(similarity, 3),
                    "similarityPercent": int(round(similarity * 100)),
                    "document": document,
                    "timestamp": metadata.get("timestamp", ""),
                }
            )
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
        document = (
            f"Category: {category}\n"
            f"Error Type: {error_type}\n"
            f"Suggested Fix: {suggested_fix}"
        )
        self._upsert(
            item_id,
            "knowledge_items",
            document,
            {
                "repo_id": str(repo_id),
                "item_id": item_id,
                "error_type": error_type,
                "category": category,
                "occurrences": int(occurrences),
                "last_resolved_at": datetime.utcnow().strftime("%b %d, %Y"),
                "similar_run_id": str(similar_run_id or ""),
                "similar_run_number": int(similar_run_number or 0),
            },
        )
        return item_id

    def get_knowledge_base(self, repo_id: str, limit: int = 25) -> list[dict[str, Any]]:
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT id, document, metadata
                    FROM vector_documents
                    WHERE collection_name = 'knowledge_items'
                      AND metadata->>'repo_id' = :repo_id
                    ORDER BY created_at DESC
                    LIMIT :limit
                    """
                ),
                {"repo_id": str(repo_id), "limit": limit},
            ).mappings().all()

        items = []
        for row in rows:
            metadata = row["metadata"] or {}
            document = row["document"] or ""
            suggested_fix = (
                document.split("Suggested Fix: ", 1)[-1]
                if "Suggested Fix: " in document
                else ""
            )
            items.append(
                {
                    "id": row["id"],
                    "repoId": str(repo_id),
                    "errorType": metadata.get("error_type", "Pipeline Diagnostic"),
                    "occurrences": metadata.get("occurrences", 1),
                    "lastResolvedAt": metadata.get("last_resolved_at", "Recent"),
                    "suggestedFix": suggested_fix,
                    "similarRunId": metadata.get("similar_run_id") or None,
                    "similarRunNumber": metadata.get("similar_run_number") or None,
                    "category": metadata.get("category", "failure"),
                }
            )
        return items

    def search_context(self, repo_id: str, query: str, limit: int = 4) -> list[str]:
        cleaned = self._clean_text(query)
        if not cleaned:
            return []

        query_vector = self._vector_literal(self._embed(cleaned))
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT document
                    FROM vector_documents
                    WHERE metadata->>'repo_id' = :repo_id
                    ORDER BY embedding <=> CAST(:query_vector AS vector)
                    LIMIT :limit
                    """
                ),
                {
                    "repo_id": str(repo_id),
                    "query_vector": query_vector,
                    "limit": limit,
                },
            ).scalars().all()
        return [document for document in rows if document]


vector_store = VectorStoreService()
