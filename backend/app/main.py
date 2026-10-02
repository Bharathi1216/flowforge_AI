from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import init_db
from app.routers import ai, auth, discussions, knowledge, repositories, webhooks, workflows

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/diagnostics/chroma")
def chroma_diagnostics():
    from app.services.vector_store import vector_store
    client = vector_store.client
    cols = client.list_collections()
    summary = []
    for col in cols:
        data = col.get(include=["documents", "metadatas", "embeddings"])
        ids = data.get("ids", [])
        docs = data.get("documents", [])
        metas = data.get("metadatas", [])
        embeddings = data.get("embeddings", [])

        summary.append({
            "name": col.name,
            "count": col.count(),
            "items": [
                {
                    "id": ids[i],
                    "metadata": metas[i] if metas and i < len(metas) else {},
                    "document_preview": (docs[i][:300] + "...") if docs and i < len(docs) and len(docs[i]) > 300 else (docs[i] if docs and i < len(docs) else ""),
                    "embedding_dimensions": len(embeddings[i]) if embeddings is not None and i < len(embeddings) and embeddings[i] is not None else 0,
                    "sample_vector": [round(float(v), 4) for v in embeddings[i][:5]] if embeddings is not None and i < len(embeddings) and embeddings[i] is not None else []
                }
                for i in range(len(ids))
            ]
        })
    return {
        "status": "healthy",
        "storage_path": str(vector_store.persist_dir),
        "total_collections": len(cols),
        "collections": summary
    }


app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(repositories.router, prefix=settings.API_V1_STR)
app.include_router(discussions.router, prefix=settings.API_V1_STR)
app.include_router(workflows.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(knowledge.router, prefix=settings.API_V1_STR)
app.include_router(webhooks.router, prefix=settings.API_V1_STR)
