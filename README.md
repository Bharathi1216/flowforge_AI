# FlowForge AI

FlowForge AI is a repository-centric developer collaboration workspace that links with GitHub Actions. It features interactive log viewers, vector RAG search matching, issue discussions, release changelog summarizers, and automated onboarding guides.

## Repository Layout
- **`frontend/`**: Vite + React + TypeScript + Tailwind CSS client application dashboard.
- **`backend/`**: FastAPI controller service placeholders.
- **`ai-service/`**: Gemini models configurations & ChromaDB RAG indexer scripts.
- **`database/`**: PostgreSQL relational schemas.
- **`worker/`**: Celery & Redis task broker queues.
- **`docker/`**: Multi-container compose manifests.
- **`github-integration/`**: GitHub webhook hooks handler.

Runtime data stays out of source folders: the local SQLite fallback is in `database/local/`, PostgreSQL and Supabase scripts are in `database/`, and frontend/backend dependencies are managed by their respective package and requirements files.

---

## Getting Started

To launch both the FastAPI backend and the Vite frontend locally, run this from the repository root in PowerShell:

```powershell
.\start-dev.ps1
```

The script starts only services whose ports are not already in use. It opens a separate terminal for each service and keeps them running while you use the app.

To launch the frontend manually, use the following commands:

### 1. Install Dependencies
Navigate into the `frontend` folder and install all package dependencies:
```bash
cd frontend
npm install
```

### 2. Run the Development Server
Launch the local Vite server:
```bash
npm run dev
```

In a second terminal, start the backend from the repository root:
```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### 3. Explore the Dashboard
Open your browser and navigate to the local link shown in your terminal (typically `http://localhost:5173`).
- GitHub login is required; repository and workflow screens do not use demo data.
- Switch themes (light/dark/system) and accent colors (blue/violet/green/orange) inside **Profile → Settings → Appearance**.
- Trigger AI Log Diagnostics by clicking **Analyze with AI** on failed runs (such as Run #184).
- Create team chats, query the RAG assistant, and generate release notes.

### Supabase PostgreSQL

Set `DATABASE_URL` in `backend/.env` to your Supabase PostgreSQL connection string. The browser does not connect to Supabase directly: the React frontend calls FastAPI, and FastAPI uses SQLAlchemy to store application data in Supabase PostgreSQL.

### Automatic GitHub Actions Updates

To receive workflow updates without opening the dashboard, configure these backend settings:

```env
GITHUB_WEBHOOK_SECRET=your-random-webhook-secret
WEBHOOK_CALLBACK_URL=https://your-public-host.example.com/api/webhooks/github
```

The callback must be publicly reachable by GitHub. A local `localhost` URL will not receive GitHub webhooks. The backend accepts signed `workflow_run` events and stores them in the `workflow_runs` table.

### Current Data Flow

1. A user signs in through GitHub OAuth.
2. The backend fetches that user's accessible repositories and current GitHub Actions runs.
3. The backend stores users, repositories, and workflow runs in Supabase PostgreSQL.
4. Webhook registration is kept separate from repository loading so a webhook or ngrok problem cannot hide repositories.
5. GitHub sends signed workflow events to `/api/webhooks/github`; the backend validates the signature and updates Supabase.
6. The workspace fetches the real job logs from GitHub when a workflow run is opened.

No demo login, mock repository data, fake workflow logs, or client-side Supabase connection is used. Use `POST /api/repositories/{github_repository_id}/webhook` after the public callback is ready to register a repository webhook.