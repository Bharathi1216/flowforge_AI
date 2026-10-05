import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import text
from app.db.database import engine

def inspect_pgvector():
    print("=" * 80)
    print("         FLOWFORGE AI - SUPABASE PGVECTOR EMBEDDED LOGS INSPECTOR")
    print("=" * 80)
    
    with engine.connect() as conn:
        # Check pgvector extension
        ext_check = conn.execute(text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")).mappings().first()
        if ext_check:
            print(f"PostgreSQL Extension: [VECTOR v{ext_check['extversion']}] is ACTIVE in Supabase")
        else:
            print("Warning: pgvector extension not found!")
            return

        # Check total documents
        total = conn.execute(text("SELECT COUNT(*) AS total FROM vector_documents")).scalar() or 0
        print(f"Total Vector Documents in Supabase: {total}")
        print("-" * 80)

        # Group by collection
        collections = conn.execute(text(
            "SELECT collection_name, COUNT(*) AS count FROM vector_documents GROUP BY collection_name"
        )).mappings().all()

        for col in collections:
            c_name = col["collection_name"]
            c_count = col["count"]
            print(f"\nCollection: [{c_name.upper()}] (Items Count: {c_count})")

            rows = conn.execute(text(
                "SELECT id, document, metadata, embedding FROM vector_documents WHERE collection_name = :c_name ORDER BY created_at DESC LIMIT 5"
            ), {"c_name": c_name}).mappings().all()

            for r in rows:
                doc_id = r["id"]
                metadata = r["metadata"] or {}
                doc = r["document"] or ""
                emb_str = str(r["embedding"]) if r["embedding"] is not None else ""
                
                # Parse sample floats
                sample_preview = emb_str[:60] + "..." if len(emb_str) > 60 else emb_str

                print(f"\n   ┌─── 📄 Document ID: {doc_id}")
                print(f"   │    Vector Type: pgvector vector(384)")
                print(f"   │    Sample Vector Coefficients: {sample_preview}")
                print(f"   │    Metadata: {metadata}")
                print(f"   │    Embedded Content Preview:")
                for line in doc.splitlines()[:6]:
                    print(f"   │      {line}")
                if len(doc.splitlines()) > 6:
                    print(f"   │      ... ({len(doc.splitlines()) - 6} more lines)")
                print(f"   └───")

    print("\n" + "=" * 80)
    print("Inspection complete! All logs above are stored in Supabase PostgreSQL (pgvector).")
    print("=" * 80)

if __name__ == "__main__":
    inspect_pgvector()
