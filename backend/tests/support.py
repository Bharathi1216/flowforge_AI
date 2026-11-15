import os


def configure_environment():
    # Unit tests need no .env or live services. Integration tests use their own URL.
    os.environ.setdefault("SECRET_KEY", "test-only-secret-key-with-at-least-32-characters")
    os.environ["DATABASE_URL"] = "postgresql://postgres:test@127.0.0.1:5432/flowforge_unit_test"
    os.environ["GEMINI_API_KEY"] = ""
    os.environ["GROQ_API_KEY"] = ""
