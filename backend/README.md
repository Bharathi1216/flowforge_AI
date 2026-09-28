# Backend Service (FastAPI)

This directory is designated for the FlowForge AI FastAPI backend.

## Local Setup

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

The local SQLite fallback is stored in `database/local/flowforge.db`. Set `DATABASE_URL` in `.env` to use PostgreSQL instead.

## GitHub Actions Webhooks

GitHub sends workflow logs through the `workflow_run` event after an Actions workflow runs. Configure a public HTTPS callback and the same secret in both `backend/.env` and GitHub:

```env
WEBHOOK_CALLBACK_URL=https://your-public-host.example.com/api/webhooks/github
GITHUB_WEBHOOK_SECRET=your-random-secret
```

The endpoint is `/api/webhooks/github`. It validates the signature, stores the workflow run in PostgreSQL, and the workspace fetches the real logs from GitHub when the run is opened.

On an explicit repository refresh, FlowForge attempts to create the hook for every accessible repository. A missing callback URL or secret skips registration so repositories still load. Repositories where the user is only a collaborator may not allow webhook creation.

## Registration Test

The protected registration endpoint is:

```text
POST /api/repositories/{github_repository_id}/webhook
```

Normal use does not require calling this endpoint manually because repository refresh calls the same registration logic automatically. A successful registration returns `registered` with the GitHub webhook ID. A repository without admin permission is left unregistered and continues to use refresh-based synchronization.
