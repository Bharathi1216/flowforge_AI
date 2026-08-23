import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { Repositories } from './pages/Repositories';
import { RepositoryWorkspace } from './pages/RepositoryWorkspace';
import { Settings } from './pages/Settings';
import { Activity } from './pages/Activity';
import { Notifications } from './pages/Notifications';
import { AppLayout } from './layouts/AppLayout';

function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/github" element={<Navigate to="/dashboard" replace />} />

      {/* App Workspace Pages wrapped in Sidebar Shell */}
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
      />
      <Route
        path="/repositories"
        element={
          <AppLayout>
            <Repositories />
          </AppLayout>
        }
      />

      {/* Repository Workspaces & nested tabs */}
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

      {/* Other Panel Views */}
      <Route
        path="/activity"
        element={
          <AppLayout>
            <Activity />
          </AppLayout>
        }
      />
      <Route
        path="/notifications"
        element={
          <AppLayout>
            <Notifications />
          </AppLayout>
        }
      />

      {/* Settings Options */}
      <Route
        path="/settings"
        element={
          <AppLayout>
            <Settings />
          </AppLayout>
        }
      />
      <Route
        path="/settings/:tab"
        element={
          <AppLayout>
            <Settings />
          </AppLayout>
        }
      />

      {/* Fallback Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
