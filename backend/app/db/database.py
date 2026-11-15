"""Database construction is local; only lifespan startup checks connectivity."""

import asyncio
from functools import wraps
from inspect import iscoroutinefunction, signature

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from starlette.concurrency import run_in_threadpool

from app.config import settings


def _build_engine():
    url = make_url(settings.DATABASE_URL.replace("postgres://", "postgresql://", 1))
    if url.drivername == "postgresql":
        url = url.set(drivername="postgresql+psycopg2")
    if not url.drivername.startswith("postgresql+"):
        raise RuntimeError("DATABASE_URL must point to PostgreSQL")
    if url.host not in {"localhost", "127.0.0.1", "::1"}:
        url = url.update_query_dict({"sslmode": "require"})
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10})


engine = _build_engine()
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False, bind=engine)
Base = declarative_base()


def get_db():
    with SessionLocal() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise


def isolated_db(function):
    """Run database endpoints with a thread-owned session.

    Async routes explicitly dispatch to a worker and get a loop inside it.
    ORM objects never cross threads and synchronous inference/SQL cannot block
    ASGI's event loop.
    """
    function_signature = signature(function)
    if "db" not in function_signature.parameters:
        raise TypeError("isolated_db requires a 'db' parameter; omit it for routes without SQL")

    def run_with_session(*args, **kwargs):
        with SessionLocal() as db:
            try:
                kwargs["db"] = db
                if iscoroutinefunction(function):
                    return asyncio.run(function(*args, **kwargs))
                return function(*args, **kwargs)
            except Exception:
                db.rollback()
                raise

    if iscoroutinefunction(function):
        # Preserve async classification even when FastAPI unwraps the handler.
        @wraps(function)
        async def endpoint(*args, **kwargs):
            return await run_in_threadpool(run_with_session, *args, **kwargs)
    else:
        endpoint = wraps(function)(run_with_session)

    endpoint.__signature__ = function_signature.replace(
        parameters=[p for p in function_signature.parameters.values() if p.name != "db"]
    )
    return endpoint


def init_db():
    """Readiness only. Schema changes require python -m app.db.migrate."""
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
        version = connection.execute(
            text("SELECT version FROM flowforge_schema_versions WHERE version = 2")
        ).scalar()
        if version != 2:
            raise RuntimeError("Database schema is outdated; run python -m app.db.migrate")
