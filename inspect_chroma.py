import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import chromadb

def inspect_chromadb():
    chroma_dir = Path(__file__).resolve().parent / "database" / "chroma"
    print("=" * 80)
    print("         FLOWFORGE AI - CHROMADB EMBEDDED LOGS VISUAL INSPECTOR")
    print("=" * 80)
    print(f"ChromaDB Storage Location: {chroma_dir}")
    print(f"Status: Database file exists: {(chroma_dir / 'chroma.sqlite3').exists()}")
    print("-" * 80)

    client = chromadb.PersistentClient(path=str(chroma_dir))
    collections = client.list_collections()
    print(f"Total Collections Found: {len(collections)}")
    print("-" * 80)

    for col in collections:
        count = col.count()
        print(f"\n📁 Collection Name: [{col.name.upper()}] (Items Count: {count})")
        if count == 0:
            print("   (Collection is currently empty)")
            continue

        # Fetch all documents, embeddings, and metadatas
        data = col.get(include=["documents", "metadatas", "embeddings"])
        ids = data.get("ids", [])
        docs = data.get("documents", [])
        metas = data.get("metadatas", [])
        embeddings = data.get("embeddings", [])

        for i, doc_id in enumerate(ids):
            meta = metas[i] if metas and i < len(metas) else {}
            doc = docs[i] if docs and i < len(docs) else ""
            emb = embeddings[i] if embeddings is not None and i < len(embeddings) else []
            dim = len(emb) if emb is not None else 0

            print(f"\n   ┌─── 📄 Document ID: {doc_id}")
            print(f"   │    Embedding Dimensionality: {dim} Dimensions")
            if dim > 0:
                print(f"   │    Sample Vector Vector: [{', '.join(f'{v:.4f}' for v in emb[:5])}, ... +{dim-5} floats]")
            print(f"   │    Metadata: {meta}")
            print(f"   │    Embedded Content Preview:")
            for line in doc.splitlines()[:6]:
                print(f"   │      {line}")
            if len(doc.splitlines()) > 6:
                print(f"   │      ... ({len(doc.splitlines()) - 6} more lines)")
            print(f"   └───")

    print("\n" + "=" * 80)
    print("Inspection complete! All logs above are embedded and persisted in ChromaDB.")
    print("=" * 80)

if __name__ == "__main__":
    inspect_chromadb()
