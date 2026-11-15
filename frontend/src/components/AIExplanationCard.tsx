import { ArrowRight, Sparkles } from 'lucide-react';
import React from 'react';
import { useAIAssistant } from '../contexts/assistantState';

interface AIExplanationCardProps {
  repoId?: string;
  summary: string;
  rootCause?: string;
}

export const AIExplanationCard: React.FC<AIExplanationCardProps> = ({
  summary,
  rootCause,
  repoId,
}) => {
  const { openAssistant } = useAIAssistant();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-800/80 bg-purple-50/50 dark:bg-purple-950/20 p-5 shadow-sm space-y-3.5 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-purple-700 dark:text-purple-300">
          <div className="rounded-lg bg-purple-600 text-white p-1.5 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider font-mono">
            AI Failure Diagnostics
          </span>
        </div>

        <button
          onClick={() =>
            openAssistant(`Explain this root cause in detail: ${rootCause || summary}`, repoId)
          }
          className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
        >
          <span>Ask AI Assistant</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans font-medium">
        {summary}
      </p>

      {rootCause && (
        <div className="pt-3 border-t border-purple-200/80 dark:border-purple-900/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-400 block mb-1.5 font-mono">
            Probable Root Cause:
          </span>
          <div className="text-xs text-slate-900 dark:text-slate-100 font-mono bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm leading-relaxed">
            {rootCause}
          </div>
        </div>
      )}
    </div>
  );
};
