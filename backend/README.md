# Backend

FastAPI with synchronous SQLAlchemy/psycopg2, GitHub REST integration, optional Gemini/Groq diagnostics, and pgvector retrieval.

## Setup and startup

Use Python 3.11 or 3.12. Create `.venv`, install `requirements-dev.txt`, copy `.env.example` to `.env`, and configure PostgreSQL and GitHub OAuth as described in the root README. The browser frontend and OAuth callback should consistently use `localhost`, not a mixture of `localhost` and `127.0.0.1`.

```powershell
.\.venv\Scripts\python -m app.db.migrate
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Startup validates connectivity and schema version. It does not create tables, alter columns, build vector indexes, download models, or fall back to SQLite. Run migrations explicitly using a PostgreSQL role that can manage the required schema and pgvector extension. See `../database/README.md` before upgrading an existing database.

OAuth credentials are necessary for sign-in. When missing, login redirects to the frontend with `oauth_error=unavailable`. `SECRET_KEY` and `DATABASE_URL` are required; AI keys are optional. Existing session tokens without expiration are rejected after this upgrade; sign in again.

## Concurrency and caching

`isolated_db` exposes synchronous FastAPI endpoints whose sessions are created and closed inside their worker threads. AI provider orchestration runs inside the same worker's event loop; ORM objects stay in their owning thread. HTTP-only authentication returns an immutable principal. GitHub requests share a thread-safe HTTP connection pool; repository synchronization allows five concurrent HTTP requests and deduplicates overlapping refreshes per user.

The application uses process-local locks for overlapping log downloads, discussion synchronization, and analyses. Run one Uvicorn worker for this MVP. Atomic PostgreSQL workflow upserts remain safe across processes; distributed analysis scheduling is future production work. Do not share a request session with another thread or task.

Repository summaries use bounded aggregate queries over the latest ten runs. Run status and conclusion remain separate. Source update timestamps and attempt numbers prevent stale webhook deliveries from overwriting newer metadata. Complete logs are cached by attempt and GitHub job ID. The combined log limit is `MAX_LOG_BYTES` (20 MB by default); incomplete logs return a retryable 409 instead of an empty diagnosis.

## Diagnostics

Automatic analysis waits for logs. Cache identity includes log content, run attempt, prompt version, provider models/enabled state, and RCA settings. Failed or unavailable secondary-provider outcomes are cached too. `?reanalyze=true` explicitly refreshes results and preserves saved results until a replacement succeeds.

`GET /api/repositories/{repo_id}/workflows/{run_id}/analysis` reads saved analysis without invoking providers. `POST` performs analysis. Both use the canonical GitHub IDs. The configured Gemini model and optional Groq model run concurrently, each with a bounded deadline. No unconfigured alternate models are silently invoked. Generation failure yields a labeled deterministic fallback; model output must satisfy diagnostic types and valid evidence line ranges.

The Evidence Graph preserves source line references, classifications, relationships, and ranked candidates. Temporal order and ranking scores are not proof or probabilities of causation. Existing `RCA_CONTEXT_*`, `RCA_MAX_TOKENS`, and `RCA_EVIDENCE_WEIGHT_*` settings remain available. Oversized log blocks are pruned without renumbering retained lines.

Embedding initialization is lazy. Model download/extraction uses a cross-process file lock, verified checksum, staging directory, and atomic file replacement. Successful-run context, failures, and diagnosed fixes use repository-scoped document identities. Vector retrieval failure does not prevent diagnostics or repository-grounded chat.

## Discussions and webhooks

Discussions and comments use GitHub issue/comment IDs. Source payloads preserve authorship and timestamps for explicit `cached=true` reads. Normal reads propagate upstream failures instead of silently substituting unrelated records. Editing a discussion retains its hidden workflow-run marker. Creating a linked discussion is deduplicated per run within the application process.

Set `WEBHOOK_CALLBACK_URL` to a public HTTPS address ending in `/api/webhooks/github`, and configure `GITHUB_WEBHOOK_SECRET` in GitHub as well as the backend. Use the protected registration endpoint to create the hook explicitly. Workflow events contain run metadata, not job log archives.

## Tests

```powershell
.\.venv\Scripts\python -m ruff check app tests
.\.venv\Scripts\python -m unittest discover -s tests -v
.\.venv\Scripts\python -m pip check
.\.venv\Scripts\python -m pip_audit
```

Unit/API regression tests use isolated SQLite sessions and mocked GitHub/model clients. PostgreSQL/pgvector migration and concurrency tests require `TEST_DATABASE_URL` pointing to a disposable local database whose name includes `test` or `audit`; see the database README. No tests require live OAuth credentials or paid model calls.
