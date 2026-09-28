import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';
import { GithubIcon } from './GithubIcon';

interface GitHubConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubConnectModal: React.FC<GitHubConnectModalProps> = ({ isOpen, onClose }) => {
  const startOAuth = () => {
    window.location.assign(`${import.meta.env.VITE_API_URL || '/api'}/auth/github/login`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative z-10 w-full max-w-xl space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-[#0E121D]"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-5 top-5 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3.5 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 p-0.5 shadow-md">
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                  <GithubIcon className="h-5 w-5 fill-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Connect GitHub</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Authorize FlowForge to access your repositories and workflows.
                </p>
              </div>
            </div>

            <button
              onClick={startOAuth}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-purple-700"
            >
              <GithubIcon className="h-4 w-4 fill-white" />
              Continue with GitHub OAuth
            </button>

            <div className="flex items-start gap-2.5 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
              <span>GitHub handles authorization. FlowForge uses a secure server session and does not ask for a personal access token.</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
