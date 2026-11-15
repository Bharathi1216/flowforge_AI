# Audit and repair results

Validated on 15 November 2026. This pass targets a reliable MVP with the existing interface and automatic cached diagnostics.

## Repaired behavior

- Expiring, validated session tokens; immutable authentication principals; account-scoped query caches and saved repository selections; stale session responses cannot restore a logged-out account.
- Canonical GitHub repository IDs across routes, services, and selection controls. Duplicate repository names produce a clear conflict for legacy name-based requests. Selecting none stays empty.
- Repository-scoped atomic workflow upserts, native status/conclusion separation, completion timestamps and durations, source ordering, and attempt tracking. Replayed or older webhook deliveries cannot replace newer run state.
- Discussion synchronization no longer calls `.first()` twice. Comments mirror the requested GitHub issue and retain comment IDs, authors, timestamps, edits, and run markers. Failed API requests no longer become fabricated success.
- Complete logs precede automatic AI analysis. Partial logs are retryable, reruns use fresh attempt/job identity, combined downloads are bounded, oversized context blocks respect their budget, and cached provider failures are not repeatedly billed on ordinary reloads.
- Provider calls run concurrently with bounded deadlines. Saved results survive failed replacement attempts. Model output types and evidence ranges are checked. Vector failure permits deterministic diagnostics and repository-grounded chat.
- Lazy, synchronized ONNX initialization and atomic model preparation; repository/job-scoped vector identities; current-run exclusion also applies to knowledge references.
- Thread-owned database sessions, pooled GitHub HTTP connections, bounded synchronization concurrency, and aggregate repository summaries. Importing the application does not connect to PostgreSQL or download embeddings.
- Explicit, repeatable migrations with legacy conflict checks; aligned schema/types; updated setup instructions and a disposable PostgreSQL test compose file.
- Frontend route/assistant splitting, deferred collaboration queries, guarded browser storage, corrected React lifecycles, and strict TypeScript. Unimplemented permission, release, and onboarding operations fail explicitly.

## Validation

| Check | Result |
| --- | --- |
| Backend unit/API/PostgreSQL suite | 40 passed |
| Frontend regression suite | 14 passed |
| Python Ruff checks | Passed |
| Python dependency compatibility | Passed |
| Python security audit | No known vulnerabilities reported |
| TypeScript and Vite production build | Passed |
| Frontend lint | Passed with warnings treated as errors |
| npm security audit | No known vulnerabilities reported |
| Fresh/repeated/legacy migrations | Passed against disposable PostgreSQL 17 with pgvector |
| Concurrent workflow ingestion | Five concurrent upserts created one record |
| ASGI lifespan/health/auth/OpenAPI | Passed against local test PostgreSQL; 21 API paths documented |
| Cached ONNX inference | 384 finite dimensions with unit norm; no model download needed |
| PowerShell development launcher | Syntax validated |

The frontend main JavaScript bundle decreased from **623.14 KB to 490.26 KB minified** (about **21%**); gzip size decreased from 186.24 KB to 159.28 KB. Repository-summary regression coverage loads 41 repositories within at most four SQL queries. These are bundle/query measurements, not claims about end-to-end production latency.

## Applying the upgrade

Existing Supabase data and configuration were not modified. Back up and review the target database before applying migrations. After installing the updated backend requirements, run the following from `backend/`:

```powershell
.\.venv\Scripts\python -m app.db.migrate
```

Then restart the backend and sign in again: old tokens without expiration are intentionally rejected. Frontend dependencies are recorded in the updated lockfile. See [database migration instructions](database/README.md) and [local setup](README.md).

## Limits

Live GitHub OAuth, public webhook delivery, and paid Gemini/Groq responses were not exercised; regression tests mock those providers. No production deployment was performed. Analysis/discussion coordination is process-local, so this MVP uses one Uvicorn worker. A durable distributed queue, stronger production credential/session storage, and production orchestration remain separate work. The worker/integration directories are documentation placeholders.

The current Starlette test client emits a dependency deprecation warning about its httpx compatibility layer; it does not fail the suite. Security scan results are the advisories available at validation time.

## GitHub login follow-up

Fixed an audit regression where the database-session decorator passed an unsupported `db` argument to the database-free login and logout routes. Those routes now run without database sessions, and the decorator rejects incorrect use immediately. Local OAuth login normalizes `127.0.0.1` to the configured `localhost` origin before setting the state cookie. Vite preserves and forwards the original host so canonical login does not loop.

Six additional regression tests cover login, logout, missing OAuth configuration, decorator misuse, local aliases, and proxied canonical login. The follow-up run passed 42 backend tests; four PostgreSQL integration tests were skipped because the disposable database was not started for this focused fix. Frontend build/lint also passed. Live checks through the running Vite server verified that both local host aliases reach the GitHub authorization redirect and set the OAuth state cookie on `localhost`.
