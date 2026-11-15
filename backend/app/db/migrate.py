"""Apply repository SQL migrations explicitly, never during server startup."""

from pathlib import Path
from sqlalchemy import text
from app.db.database import Base, engine
from app.db import models  # noqa: F401 - register tables

MIGRATIONS = Path(__file__).resolve().parents[3] / "database" / "migrations"


def migrate(target_engine=engine):
    with target_engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(782041912)"))
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS flowforge_schema_versions (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        Base.metadata.create_all(connection)
        applied = set(
            connection.execute(text("SELECT version FROM flowforge_schema_versions")).scalars()
        )
        for path in sorted(MIGRATIONS.glob("*.sql")):
            version = int(path.name.split("_", 1)[0])
            if version in applied:
                continue
            connection.execute(text(path.read_text(encoding="utf-8")))
            connection.execute(
                text("INSERT INTO flowforge_schema_versions(version) VALUES (:version)"),
                {"version": version},
            )


if __name__ == "__main__":
    migrate()
    print("FlowForge database migrations applied successfully.")
