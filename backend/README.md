# Backend Service (FastAPI)

This directory is designated for the FlowForge AI FastAPI backend.

## Local Setup

Use Python 3.11 or 3.12 for local development. The free-threaded Python 3.13t build is not compatible with the current `cryptography` stack used here.

Copy `.env.example` to `.env` and replace the GitHub OAuth App placeholders before using GitHub login:

- `GITHUB_CLIENT_ID`: the OAuth App client ID from GitHub
- `GITHUB_CLIENT_SECRET`: the OAuth App client secret from GitHub

The callback URL configured in GitHub must be:
`http://localhost:8001/api/auth/github/callback`

Without these values, the login endpoint returns `503 GitHub OAuth credentials are not configured` instead of redirecting to an invalid GitHub URL.

## Expected Responsibilities
- User authentication & session management via GitHub OAuth.
- CRUD operations for projects, repositories, workspaces, and team memberships.
- Execution webhook integrations with GitHub.
- Proxy and control flow for running Celery tasks.
- API endpoints: `/api/repositories`, `/api/workflows`, etc.

`DATABASE_URL` must point to the Supabase PostgreSQL database. The backend does not fall back to local SQLite, because a fallback can display stale or cross-account repository data. If Supabase is unavailable or credentials are invalid, startup fails with an explicit database error.

## GitHub Actions Webhooks

GitHub sends workflow logs through the `workflow_run` event after an Actions workflow runs. Configure a public HTTPS callback and the same secret in both `backend/.env` and GitHub:

```env
WEBHOOK_CALLBACK_URL=https://your-public-host.example.com/api/webhooks/github
GITHUB_WEBHOOK_SECRET=your-random-secret
```

The endpoint is `/api/webhooks/github`. It validates the signature, stores the workflow run in PostgreSQL, and the workspace fetches the real logs from GitHub when the run is opened.

On an explicit repository refresh, FlowForge attempts to create the hook for every accessible repository. A missing callback URL or secret skips registration so repositories still load. Repositories where the user is only a collaborator may not allow webhook creation.

## Evidence Graph-Based Failure Analysis

Failed-run analysis discovers diagnostic events across the complete available log, while retaining the existing configurable context windows (`RCA_CONTEXT_BEFORE=4` and `RCA_CONTEXT_AFTER=6`). The deterministic Evidence Graph records event line references, classifications, identifiers, supported relationships, and ranked root-cause candidates. Temporal `PRECEDES` edges do not imply causation; candidate scores are rankings rather than causal probabilities.

The complete graph is persisted in the existing `failure_logs.structured_failure` JSON text alongside the structured failure record. The analysis response exposes a compact `evidenceGraph` summary, and graph-selected source lines are expanded and passed through the existing log-pruning path. If graph construction fails, analysis logs the error and continues with the existing RCA path.

Successful workflow logs fetched by FlowForge are indexed into the `workflow_successes` pgvector collection. Similarity retrieval considers both successful workflow context and historical failed runs with their stored RCA/fix, and supplies matches to the current RCA prompt as references rather than verified answers. The embedding model and vector dimensions remain unchanged.

The candidate-ranking weights can be tuned with `RCA_EVIDENCE_WEIGHT_TEMPORAL`, `RCA_EVIDENCE_WEIGHT_RELEVANCE`, `RCA_EVIDENCE_WEIGHT_RELATIONSHIPS`, `RCA_EVIDENCE_WEIGHT_STRENGTH`, and `RCA_EVIDENCE_WEIGHT_BASELINE` (each accepts `0.0`–`1.0`; defaults are equal weights). Missing baseline data is omitted and the remaining available weights are normalized. These initial weights are configuration defaults, not experimentally validated causal probabilities.

## Registration Test

The protected registration endpoint is:

```text
POST /api/repositories/{github_repository_id}/webhook
```

Normal use does not require calling this endpoint manually because repository refresh calls the same registration logic automatically. A successful registration returns `registered` with the GitHub webhook ID. A repository without admin permission is left unregistered and continues to use refresh-based synchronization.
