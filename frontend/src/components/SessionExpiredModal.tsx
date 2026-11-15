import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useAuth } from '../contexts/authState';
import { GithubIcon } from './GithubIcon';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ isOpen }) => {
  const { logout } = useAuth();
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  if (!isOpen) return null;

  const handleLoginAgain = () => {
    setIsRedirecting(true);
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    window.location.assign(`${apiUrl}/auth/github/login`);
  };

  const handleExit = async () => {
    await logout();
    window.location.assign('/?oauth_error=session_expired');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Dark Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-md rounded-3xl border border-rose-500/30 bg-[#0E121D] p-6 sm:p-8 shadow-2xl text-center space-y-5"
        >
          {/* Glowing Warning Icon */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-lg shadow-rose-500/10">
            <ShieldAlert className="h-7 w-7 text-rose-500 animate-pulse" />
          </div>

          {/* Heading and Description */}
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white font-heading tracking-tight">
              GitHub Authorization Expired
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your GitHub credentials have expired or were revoked on GitHub. You cannot view
              workflows, logs, or post discussions until you authorize again.
            </p>
          </div>

          {/* Prompt Actions */}
          <div className="pt-2 space-y-3">
            <button
              onClick={handleLoginAgain}
              disabled={isRedirecting}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-3 px-4 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isRedirecting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Redirecting to GitHub...</span>
                </>
              ) : (
                <>
                  <GithubIcon className="h-4 w-4 fill-white" />
                  <span>Log in with GitHub Again</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              onClick={handleExit}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-bold text-xs py-2.5 px-4 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit to Home</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 font-mono">
            FlowForge AI • Secure OAuth 2.0
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
