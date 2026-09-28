import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, FolderGit2, Check, Sparkles } from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import { GitHubConnectModal } from '../components/GitHubConnectModal';
import { useAuth } from '../contexts/AuthContext';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const oauthError = searchParams.get('oauth_error');

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

        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs font-bold text-white px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition-colors shadow-sm"
            >
              Open Workspace (@{user.username})
            </button>
            <button
              onClick={() => setShowConnectModal(true)}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-xl bg-slate-900 border border-slate-800"
            >
              Switch Account
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConnectModal(true)}
            className="text-xs font-bold text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40"
          >
            Sign in with GitHub
          </button>
        )}
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
          {oauthError === 'invalid_state' && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              This GitHub login expired or was opened from an old tab. Start a new sign-in attempt.
            </div>
          )}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-bold text-purple-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            <span>AI-Powered GitHub Workflow Failure Analysis & Team Collaboration</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight font-heading">
            Your intelligence layer for{' '}
            <span className="text-purple-400">
              GitHub Actions
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed font-sans">
            Connect your real GitHub repositories to instantly diagnose CI/CD failures, trace step-by-step logs, and collaborate on fixes.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-3 flex flex-col items-center gap-3 w-full sm:w-auto">
            {isAuthenticated && user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group relative flex items-center justify-center gap-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white px-9 py-4 text-sm font-black shadow-xl shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto min-w-[280px]"
              >
                <span>Launch Workspace (@{user.username})</span>
                <ArrowRight className="h-4 w-4 text-purple-200 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button
                onClick={() => setShowConnectModal(true)}
                className="group relative flex items-center justify-center gap-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 px-9 py-4 text-sm font-black shadow-xl shadow-purple-500/15 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto min-w-[280px]"
              >
                <GithubIcon className="h-5 w-5 fill-slate-950" />
                <span>Connect with GitHub</span>
                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <span>Secure GitHub OAuth with private repository access</span>
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

      {/* GitHub Authorization Modal */}
      <GitHubConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </div>
  );
};
