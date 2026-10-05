import os
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings
from typing import ClassVar, Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "FlowForge AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Frontend URL for CORS & redirects
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Supabase/PostgreSQL is the single source of truth. Do not silently use
    # local SQLite, because that can expose stale or cross-account data.
    DATABASE_URL: str = Field(..., min_length=1)
    
    # GitHub OAuth App Settings
    GITHUB_CLIENT_ID: Optional[str] = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8001/api/auth/github/callback")
    GITHUB_WEBHOOK_SECRET: Optional[str] = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    WEBHOOK_CALLBACK_URL: Optional[str] = os.getenv("WEBHOOK_CALLBACK_URL", "")

    # Google Gemini AI Settings
    GEMINI_API_KEY: str = Field(..., min_length=1)
    GEMINI_MODEL: str = Field(..., min_length=1)

    # LogSage RCA Pipeline Settings
    RCA_CONTEXT_BEFORE: int = Field(default=4, ge=1, le=20)
    RCA_CONTEXT_AFTER: int = Field(default=6, ge=1, le=30)
    RCA_MAX_TOKENS: int = Field(default=4000, ge=500, le=30000)
    RCA_KEYWORDS: str = Field(
        default="fatal,fail,failed,panic,error,exit,kill,no such file,missing,exception,cannot,traceback,npm ERR,exit code,exit status"
    )

    class Config:
        env_file = Path(__file__).resolve().parents[1] / ".env"
        extra = "allow"

settings = Settings()
