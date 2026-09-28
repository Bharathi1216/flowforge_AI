import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { RepositoryWorkspace } from './pages/RepositoryWorkspace';
import { Settings } from './pages/Settings';
import { Activity } from './pages/Activity';
import { AppLayout } from './layouts/AppLayout';

function App() {
  return (
    <Routes>
      {/* 1. Landing / Connect GitHub Screen (auth entry point) */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LandingPage />} />
      <Route path="/auth/github" element={<Navigate to="/dashboard" replace />} />

      {/* 2. Dashboard (List of connected repositories + Add repository modal) */}
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
      />

      {/* 3. Repository Workspace (Overview, Workflows, Failure Analysis, Threads, Team, AI Assistant) */}
      <Route
        path="/repositories/:repoId"
        element={
          <AppLayout>
            <RepositoryWorkspace />
          </AppLayout>
        }
      />
      <Route
        path="/repositories/:repoId/:tab"
        element={
          <AppLayout>
            <RepositoryWorkspace />
          </AppLayout>
        }
      />
      <Route
        path="/repositories/:repoId/workflows/:workflowId"
        element={
          <AppLayout>
            <RepositoryWorkspace />
          </AppLayout>
        }
      />

      {/* 4. Settings (Account, Repository access, Notifications, Appearance) */}
      <Route
        path="/settings"
        element={
          <AppLayout>
            <Settings />
          </AppLayout>
        }
      />

      {/* Route fallbacks and legacy aliases redirecting to main 4 destinations */}
      <Route path="/repositories" element={<Navigate to="/dashboard" replace />} />
      <Route path="/activity" element={<AppLayout><Activity /></AppLayout>} />
      <Route path="/notifications" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
