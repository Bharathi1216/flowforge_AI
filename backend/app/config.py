from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "FlowForge AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: Literal["HS256"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24 * 7, ge=1)

    # Frontend URL for CORS & redirects
    FRONTEND_URL: str = "http://localhost:5173"

    # Supabase/PostgreSQL is the single source of truth. Do not silently use
    # local SQLite, because that can expose stale or cross-account data.
    DATABASE_URL: str = Field(..., min_length=1)

    # GitHub OAuth App Settings
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:8001/api/auth/github/callback"
    GITHUB_WEBHOOK_SECRET: str = ""
    WEBHOOK_CALLBACK_URL: str = ""

    # Google Gemini AI Settings
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-lite-latest"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"
    AI_TIMEOUT_SECONDS: int = Field(default=60, ge=1, le=180)
    MAX_LOG_BYTES: int = Field(default=20_000_000, ge=1024)

    # LogSage RCA Pipeline Settings
    RCA_CONTEXT_BEFORE: int = Field(default=4, ge=1, le=20)
    RCA_CONTEXT_AFTER: int = Field(default=6, ge=1, le=30)
    RCA_MAX_TOKENS: int = Field(default=4000, ge=500, le=30000)
    RCA_EVIDENCE_WEIGHT_TEMPORAL: float = Field(default=0.2, ge=0.0, le=1.0)
    RCA_EVIDENCE_WEIGHT_RELEVANCE: float = Field(default=0.2, ge=0.0, le=1.0)
    RCA_EVIDENCE_WEIGHT_RELATIONSHIPS: float = Field(default=0.2, ge=0.0, le=1.0)
    RCA_EVIDENCE_WEIGHT_STRENGTH: float = Field(default=0.2, ge=0.0, le=1.0)
    RCA_EVIDENCE_WEIGHT_BASELINE: float = Field(default=0.2, ge=0.0, le=1.0)
    RCA_KEYWORDS: str = Field(
        default="fatal,fail,failed,panic,error,exit,kill,no such file,missing,exception,cannot,traceback,npm ERR,exit code,exit status"
    )

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore"
    )


settings = Settings()
