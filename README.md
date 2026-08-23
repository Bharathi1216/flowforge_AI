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

---

## Getting Started

To launch and explore the **FlowForge AI** workspace dashboard locally, run the following commands:

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

### 3. Explore the Dashboard
Open your browser and navigate to the local link shown in your terminal (typically `http://localhost:5173`).
- To test the application fully without requiring a live backend, click **Explore as Demo User** on the login page (or use the link `http://localhost:5173/login?demo=true`).
- Switch themes (light/dark/system) and accent colors (blue/violet/green/orange) inside **Profile → Settings → Appearance**.
- Trigger AI Log Diagnostics by clicking **Analyze with AI** on failed runs (such as Run #184).
- Create team chats, query the RAG assistant, and generate release notes.