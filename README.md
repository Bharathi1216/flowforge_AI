# FlowForge AI

A React and FastAPI workspace for GitHub Actions monitoring, log inspection, failure diagnostics, and GitHub issue discussions. Application data lives in PostgreSQL with pgvector; the browser uses the backend's HTTP-only OAuth session.

## Local setup

Use Python 3.11 or 3.12 and a Node version supported by the installed Vite release (Node 22.12+ or 24 recommended). Install PostgreSQL with the pgvector extension, or configure Supabase PostgreSQL.

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip setuptools
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Edit `backend/.env`: set a random `SECRET_KEY` of at least 32 characters, `DATABASE_URL`, and GitHub OAuth credentials. Keep the OAuth callback at `http://localhost:8001/api/auth/github/callback` and use `http://localhost:5173` consistently in the browser. AI credentials are optional.

Apply the schema explicitly before starting the backend:

```powershell
# From backend/, after reviewing the database migration instructions.
.\.venv\Scripts\python -m app.db.migrate
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Once dependencies, configuration, and migrations are ready, `./start-dev.ps1` starts missing services in the background and prints their log locations.

## Behavior

- GitHub OAuth loads real accessible repositories and workflow runs. Repository IDs distinguish repositories with the same name under different owners.
- Repository selection is a saved, per-account dashboard preference. An empty selection displays none; it does not change GitHub permissions.
- Opening a failed run fetches complete logs before automatic analysis. Saved results are reused; explicit reanalysis refreshes them. Gemini and Groq are compared when configured, with clearly marked deterministic fallback results.
- Discussions are GitHub Issues. Comments, source authors, timestamps, issue IDs, and linked workflow runs are mirrored locally. Assistant messages become reviewable drafts before publication.
- Webhook creation is explicit: configure a public HTTPS `WEBHOOK_CALLBACK_URL` and `GITHUB_WEBHOOK_SECRET`, then call `POST /api/repositories/{github_repository_id}/webhook`. Repository refresh does not create hooks.
- Signed workflow webhooks update stored run metadata. Job logs are downloaded separately when opened. Cached summaries use the latest ten runs; workspace history shows up to fifty.

## Validation

```powershell
cd backend
.\.venv\Scripts\python -m ruff check app tests
.\.venv\Scripts\python -m unittest discover -s tests -v
.\.venv\Scripts\python -m pip check
.\.venv\Scripts\python -m pip_audit
```

```powershell
cd frontend
npm run test
npm run build
npm run lint
npm audit
```

See [database/README.md](database/README.md) for migration precautions and disposable PostgreSQL integration tests, and [AUDIT.md](AUDIT.md) for findings, measured improvements, and remaining limits.

## Repository layout

`frontend/` contains the browser application; `backend/` contains FastAPI, GitHub integration, and AI services; `database/` contains schema and migrations. `docker/compose.test.yml` supplies a disposable test database. `worker/` and `github-integration/` document future service boundaries; they are not running Celery, Redis, or Octokit services. There is no separate AI service deployment.
