# Project status

FlowForge AI is an MVP with real GitHub OAuth, repository and workflow monitoring, log retrieval, GitHub issue discussions, and optional AI diagnostics with pgvector retrieval. All implemented routers are mounted in FastAPI.

The audit repair pass adds account-safe caching, canonical IDs, expiring sessions, explicit schema migrations, attempt-aware logs, deterministic analysis caching, lazy embeddings, concurrency limits, regression tests, and frontend code splitting. See `AUDIT.md` for validation results and remaining limitations.

Repository selection controls dashboard visibility. Team permission changes, release/changelog generation, repository onboarding generation, a separate worker service, and production orchestration are not implemented. Unavailable service methods report that explicitly instead of returning fabricated success.

The project remains a single-worker MVP. Live OAuth/provider smoke testing, deployment, distributed scheduling, and production credential storage hardening are separate work.
