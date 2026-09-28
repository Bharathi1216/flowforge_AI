import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, GitCommit, Clock, ChevronDown, ChevronUp, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { WorkflowRun } from '../types';
import { StatusBadge } from './StatusBadge';

interface WorkflowRunRowProps {
  run: WorkflowRun;
  onSelectForFailureAnalysis?: (run: WorkflowRun) => void;
}

export const WorkflowRunRow: React.FC<WorkflowRunRowProps> = ({
  run,
  onSelectForFailureAnalysis
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
      {/* Main History Row */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer"
      >
        {/* Left: Status Classification + Run Name & Commit */}
        <div className="flex items-center gap-3.5 min-w-[240px] flex-1">
          <StatusBadge status={run.status} />
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {run.name || `Build & Test #${run.id}`}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">#{run.id}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <GitCommit className="h-3 w-3 shrink-0" />
              <span className="truncate font-mono">{run.commitMessage}</span>
            </div>
          </div>
        </div>

        {/* Right: Branch, Triggered by User, Duration, Timestamp, & Actions */}
        <div className="flex items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <GitBranch className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-700 dark:text-slate-300">{run.branch}</span>
          </div>

          <div className="flex items-center gap-2">
            <img
              src={run.triggeredBy?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt=""
              className="h-5 w-5 rounded-full object-cover ring-1 ring-slate-300 dark:ring-slate-700"
            />
            <span className="text-slate-700 dark:text-slate-300 text-[11px]">{run.triggeredBy?.name || 'Bharathi'}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{run.duration}</span>
          </div>

          <span className="text-[11px] font-mono">{run.timestamp}</span>

          {/* Action buttons */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {run.status === 'failed' && onSelectForFailureAnalysis && (
              <button
                onClick={() => onSelectForFailureAnalysis(run)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all"
              >
                <FileText className="h-3 w-3" />
                <span>Logs</span>
              </button>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              title={isExpanded ? 'Collapse pipeline steps' : 'Expand pipeline steps'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded CI Steps Detail Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 pb-4 pt-1 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800"
          >
            <div className="space-y-2 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-mono">
                CI Pipeline Execution History
              </div>

              {(run.steps && run.steps.length > 0 ? run.steps : [
                { name: 'Set up job environment', status: 'success', duration: '4s' },
                { name: 'Checkout repository at commit', status: 'success', duration: '2s' },
                { name: 'Setup Node.js v20.x runtime', status: 'success', duration: '6s' },
                { name: 'Install dependencies (npm ci)', status: run.status === 'failed' ? 'failed' : 'success', duration: '42s' },
                { name: 'Run linting & unit tests', status: run.status === 'failed' ? 'skipped' : 'success', duration: '18s' },
                { name: 'Build production bundle', status: run.status === 'failed' ? 'skipped' : 'success', duration: '34s' }
              ]).map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    {step.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : step.status === 'failed' ? (
                      <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0" />
                    )}
                    <span className={step.status === 'failed' ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-slate-800 dark:text-slate-200'}>
                      {step.name}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{step.duration}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
