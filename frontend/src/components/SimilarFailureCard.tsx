import React from 'react';
import { History } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface SimilarFailureCardProps {
  pastFailureId: string;
  repoName: string;
  errorSnippet: string;
  fixedBy: {
    name: string;
    avatarUrl: string;
    username: string;
  };
  solutionSummary: string;
  similarityScore?: number;
  onNotify?: () => void;
  onDiscuss?: () => void;
}

export const SimilarFailureCard: React.FC<SimilarFailureCardProps> = ({
  pastFailureId,
  repoName,
  errorSnippet,
  fixedBy,
  solutionSummary,
  similarityScore = 94,
  onNotify,
  onDiscuss
}) => {
  const { success } = useToast();

  const handleNotify = () => {
    success(`Sent notification to @${fixedBy.username}`, 'Teammate Notified');
    if (onNotify) onNotify();
  };

  return (
    <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm space-y-3.5 transition-colors">
      {/* Based on / RAG badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 px-2.5 py-0.5 rounded-full font-mono">
            <History className="h-3 w-3" /> Similar Past Failure (RAG Match)
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Run #{pastFailureId}</span>
      </div>

      <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 font-mono text-[11px] text-slate-800 dark:text-slate-200">
        {errorSnippet}
      </div>

      {/* Solution & Author */}
      <div className="space-y-3 text-xs">
        <div className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
          <b className="text-emerald-700 dark:text-emerald-400 font-bold">Resolution Applied:</b> {solutionSummary}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <img
              src={fixedBy.avatarUrl}
              alt={fixedBy.name}
              className="h-6 w-6 rounded-full object-cover ring-2 ring-purple-500/40"
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block leading-none">{fixedBy.name}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Resolved similar issue in {repoName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNotify}
              className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[11px] font-bold transition-all"
            >
              Notify Developer
            </button>
            {onDiscuss && (
              <button
                onClick={onDiscuss}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-all border border-slate-200 dark:border-slate-700"
              >
                Discuss in Thread
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
