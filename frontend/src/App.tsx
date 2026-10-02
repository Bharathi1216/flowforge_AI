import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { RepositoryWorkspace } from './pages/RepositoryWorkspace';
import { Settings } from './pages/Settings';
import { Activity } from './pages/Activity';
import { AppLayout } from './layouts/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#080B12]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" role="status" aria-label="Checking your session" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace state={{ from: location.pathname }} />;
}

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
          <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
        }
      />

      {/* 3. Repository Workspace (Overview, Workflows, Failure Analysis, Threads, Team, AI Assistant) */}
      <Route
        path="/repositories/:repoId"
        element={
          <ProtectedRoute><AppLayout><RepositoryWorkspace /></AppLayout></ProtectedRoute>
        }
      />
      <Route
        path="/repositories/:repoId/:tab"
        element={
          <ProtectedRoute><AppLayout><RepositoryWorkspace /></AppLayout></ProtectedRoute>
        }
      />
      <Route
        path="/repositories/:repoId/workflows/:workflowId"
        element={
          <ProtectedRoute><AppLayout><RepositoryWorkspace /></AppLayout></ProtectedRoute>
        }
      />

      {/* 4. Settings (Account, Repository access, Notifications, Appearance) */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>
        }
      />

      {/* Route fallbacks and legacy aliases redirecting to main 4 destinations */}
      <Route path="/repositories" element={<Navigate to="/dashboard" replace />} />
      <Route path="/activity" element={<ProtectedRoute><AppLayout><Activity /></AppLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
