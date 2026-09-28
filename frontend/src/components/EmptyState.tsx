import React from 'react';
import { FolderGit2, Plus, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No repositories connected yet',
  description = 'Connect your GitHub repositories to start monitoring workflows, analyzing failures, and collaborating with your team.',
  actionText = 'Connect your first repository',
  onAction
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 backdrop-blur-sm max-w-lg mx-auto my-8">
      <div className="relative mb-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-violet-600/20 to-pink-600/20 border border-violet-500/30 flex items-center justify-center text-primary">
          <FolderGit2 className="h-8 w-8 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-pink-400" />
        </div>
      </div>

      <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
        {description}
      </p>

      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all"
        >
          <Plus className="h-4 w-4" />
          {actionText}
        </button>
      )}
    </div>
  );
};
