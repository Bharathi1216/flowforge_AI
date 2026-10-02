import logging
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)

def _build_engine():
    db_url = settings.DATABASE_URL
    if "sqlite" in db_url:
        return create_engine(db_url, connect_args={"check_same_thread": False})
    
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    if db_url.startswith("postgresql+"):
        db_url = make_url(db_url).update_query_dict({"sslmode": "require"})

    try:
        eng = create_engine(db_url, pool_pre_ping=True)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return eng
    except Exception as exc:
        logger.warning("Remote database unavailable (%s). Falling back to local SQLite database.", exc)
        sqlite_url = f"sqlite:///{settings.LOCAL_DATABASE_PATH.as_posix()}"
        return create_engine(sqlite_url, connect_args={"check_same_thread": False})

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
