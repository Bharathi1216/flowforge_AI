import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import ClassVar, Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "FlowForge AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "flowforge-super-secret-jwt-key-2026-change-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Frontend URL for CORS & redirects
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Database Settings (PostgreSQL with SQLite fallback)
    LOCAL_DATABASE_PATH: ClassVar[Path] = Path(__file__).resolve().parents[2] / "database" / "local" / "flowforge.db"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{LOCAL_DATABASE_PATH.as_posix()}")
    
    # GitHub OAuth App Settings
    GITHUB_CLIENT_ID: Optional[str] = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8001/api/auth/github/callback")
    GITHUB_WEBHOOK_SECRET: Optional[str] = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    WEBHOOK_CALLBACK_URL: Optional[str] = os.getenv("WEBHOOK_CALLBACK_URL", "")

    # Google Gemini AI Settings
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")

    class Config:
        env_file = Path(__file__).resolve().parents[1] / ".env"
        extra = "allow"

settings = Settings()
