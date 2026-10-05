
import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)

def _build_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    if not db_url.startswith("postgresql+"):
        raise RuntimeError("DATABASE_URL must point to the Supabase PostgreSQL database")

    db_url = make_url(db_url).update_query_dict({"sslmode": "require"})
    engine = create_engine(db_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        engine.dispose()
        logger.exception("Supabase PostgreSQL connection failed")
        raise RuntimeError("Supabase PostgreSQL is unavailable or DATABASE_URL credentials are invalid")
    return engine

engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.db import models
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    additions = {
        "discussions": [("github_issue_number", "INTEGER")],
        "discussion_comments": [("github_comment_id", "VARCHAR(100)")],
    }
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.execute(text(
            """
            CREATE TABLE IF NOT EXISTS vector_documents (
                id TEXT PRIMARY KEY,
                collection_name TEXT NOT NULL,
                document TEXT NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                embedding vector(384) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (collection_name, id)
            )
            """
        ))
        connection.execute(text(
            """
            CREATE INDEX IF NOT EXISTS vector_documents_collection_idx
            ON vector_documents (collection_name)
            """
        ))
        connection.execute(text(
            """
            CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx
            ON vector_documents USING hnsw (embedding vector_cosine_ops)
            """
        ))
        for table, columns in additions.items():
            existing_columns = {column["name"] for column in inspector.get_columns(table)}
            for column_name, column_type in columns:
                if column_name not in existing_columns:
                    connection.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN {column_name} {column_type}"
                    ))
