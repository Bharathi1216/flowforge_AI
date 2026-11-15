import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, FolderGit2, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { GithubIcon } from '../components/GithubIcon';
import { useAuth } from '../contexts/authState';

export const LandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const oauthError = searchParams.get('oauth_error');

  useEffect(() => {
    if (oauthError && isAuthenticated) {
      logout();
    }
  }, [oauthError, isAuthenticated, logout]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080A10] text-slate-300">
        <div className="flex items-center gap-3 text-sm" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          Checking your session...
        </div>
      </div>
    );
  }

  if (isAuthenticated && !oauthError) return <Navigate to="/dashboard" replace />;

  const errorMessages: Record<string, string> = {
    access_denied:
      'GitHub access was not granted. FlowForge needs GitHub access to load repository and workflow features. Review the permissions on GitHub before approving, then try again whenever you are ready.',
    invalid_state: 'This sign-in attempt expired or could not be verified. Please start again.',
    unavailable: 'GitHub sign-in is not available for this deployment yet. Please try again later.',
    github_unavailable:
      'GitHub could not complete sign-in just now. Check your connection and try again.',
    session_expired: 'Your session has expired. Continue with GitHub to reconnect your account.',
    failed: 'We could not sign you in with GitHub. Please try again.',
  };
  const errorMessage = oauthError ? errorMessages[oauthError] || errorMessages.failed : null;

  const startLogin = () => {
    setIsRedirecting(true);
    window.location.assign(`${import.meta.env.VITE_API_URL || '/api'}/auth/github/login`);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#080A10] text-slate-100 flex flex-col justify-between overflow-hidden selection:bg-purple-500/30">
      {/* Background Subtle Purple Illumination */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-purple-600/10 blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 mx-auto max-w-7xl w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-600 p-0.5 shadow-md shadow-purple-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <FolderGit2 className="h-4 w-4 text-purple-400" />
            </div>
          </div>
          <span className="text-lg font-black tracking-wider text-white font-heading">
            FlowForge <span className="text-purple-400">AI</span>
          </span>
        </div>

        <button
          onClick={startLogin}
          disabled={isRedirecting}
          className="text-xs font-bold text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 disabled:opacity-60"
        >
          {isRedirecting ? 'Connecting...' : 'Continue with GitHub'}
        </button>
      </header>

      {/* Hero Content Center */}
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-12 text-center flex flex-col items-center justify-center my-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 flex flex-col items-center"
        >
          {/* Badge */}
          {errorMessage && (
            <div
              className="flex max-w-xl items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-100"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
              <div>
                <p className="font-semibold">We couldn’t sign you in with GitHub</p>
                <p className="mt-1 text-rose-100/80">{errorMessage}</p>
              </div>
            </div>
          )}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-bold text-purple-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            <span>AI-Powered GitHub Workflow Failure Analysis & Team Collaboration</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight font-heading">
            Your intelligence layer for <span className="text-purple-400">GitHub Actions</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed font-sans">
            Connect your GitHub repositories to diagnose CI/CD failures, trace workflow logs, and
            collaborate on fixes.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-3 flex flex-col items-center gap-3 w-full sm:w-auto">
            <button
              onClick={startLogin}
              disabled={isRedirecting}
              className="group relative flex min-h-12 items-center justify-center gap-3 rounded-xl bg-white hover:bg-slate-100 text-slate-950 px-8 py-3.5 text-sm font-black shadow-xl shadow-purple-500/15 transition-all w-full sm:w-auto min-w-[280px] disabled:opacity-70"
            >
              <GithubIcon className="h-5 w-5 fill-slate-950" />
              <span>{isRedirecting ? 'Connecting to GitHub...' : 'Continue with GitHub'}</span>
              <ArrowRight className="h-4 w-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#access"
              className="text-sm font-semibold text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white"
            >
              How access works
            </a>

            <div id="access" className="flex max-w-md items-start gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <span>
                We use your GitHub authorization for repository and workflow features. Review the
                full permissions shown by GitHub before approving; you can revoke access from your
                GitHub settings.
              </span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto max-w-7xl w-full px-6 py-6 flex flex-wrap items-center justify-between text-xs text-slate-500 border-t border-slate-900">
        <div>© 2026 FlowForge AI. Connected with GitHub REST API.</div>
        <div className="flex gap-4 text-xs font-mono text-slate-400">
          <span>Failure Diagnostics</span>
          <span>•</span>
          <span>Live Workflow Tracing</span>
        </div>
      </footer>
    </div>
  );
};
