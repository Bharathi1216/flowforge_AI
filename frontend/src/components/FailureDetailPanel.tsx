import React, { useEffect, useState } from 'react';
import { 
  Copy, Check, Terminal, AlertOctagon, MessageSquarePlus, ChevronDown, ChevronUp, Sparkles, AlertCircle
} from 'lucide-react';
import { WorkflowRun } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import { logService } from '../services/logService';

interface FailureDetailPanelProps {
  run: WorkflowRun;
  repoId: string;
  onPushToThread: (title: string, logExcerpt: string, aiSolution: string) => void;
}

export const FailureDetailPanel: React.FC<FailureDetailPanelProps> = ({
  run,
  repoId,
  onPushToThread
}) => {
  const { success } = useToast();
  const { openAssistant } = useAIAssistant();
  const [copied, setCopied] = useState(false);
  const [realLogs, setRealLogs] = useState<string>('');
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLogsError(null);
    setRealLogs('Loading GitHub Actions logs...');
    logService.getWorkflowLogs(run.id, repoId)
      .then((logs) => {
        if (active) {
          setRealLogs(logs.map((line) => line.message).join('\n') || 'GitHub returned no downloadable log archive for this workflow job.');
        }
      })
      .catch(() => {
        if (active) {
          setLogsError('Unable to retrieve GitHub Actions logs.');
          setRealLogs('');
        }
      });
    return () => { active = false; };
  }, [repoId, run.id]);

  const errorMessage = run.diagnosticInfo?.errorSnippet || 
    `GitHub Actions run #${run.runNumber} for '${run.name}' failed on branch '${run.branch}'.\nCommit: ${run.commitMessage} (${run.commitSha})\nExit status: Failure`;

  const suggestedFix = run.diagnosticInfo?.suggestedFix || 
    `1. Inspect the failing step in GitHub Actions logs.\n2. Reproduce the failing command locally in your terminal.\n3. Verify all required secrets and environment variables are set in GitHub Repository Settings.`;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(realLogs || errorMessage);
    setCopied(true);
    success('Logs copied to clipboard!', 'Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePush = () => {
    const threadTitle = `Failure in Run #${run.runNumber}: ${run.name}`;
    onPushToThread(threadTitle, errorMessage, suggestedFix);
  };

  const handleAskAI = () => {
    openAssistant(
      `Diagnose this GitHub Actions failure for Run #${run.runNumber} (${run.name}):\n\n${errorMessage}\n\nWhat are the recommended fixes?`,
      run.name
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Action Banner: Push to Discussion Thread + Ask AI Assistant */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
            <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Failure Details (Run #{run.runNumber})
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-mono font-bold">
                Failed
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Branch: <span className="text-slate-800 dark:text-slate-200 font-medium">{run.branch}</span> • Commit: <span className="text-slate-800 dark:text-slate-200 font-medium">#{run.commitSha || 'HEAD'}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAskAI}
            className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-4 py-2.5 text-xs font-bold transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>AI Diagnostic</span>
          </button>
          <button
            onClick={handlePush}
            className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 text-xs font-bold shadow-sm transition-all"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span>Push to Thread</span>
          </button>
        </div>
      </div>

      {/* 2. Step Breakdown / Diagnostic Details */}
      {run.steps && run.steps.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            Workflow Step Status
          </h3>
          <div className="space-y-2">
            {run.steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono ${
                  step.status === 'failed'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                    : step.status === 'success'
                    ? 'border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300'
                    : 'border-slate-200 dark:border-slate-800/40 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Step {idx + 1}:</span>
                  <span>{step.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">{step.duration}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/50 dark:bg-black/30">
                    {step.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Captured Failure Summary / Logs */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 uppercase tracking-wider font-mono">
            <Terminal className="h-4 w-4" />
            <span>GitHub Actions Failure Diagnostic</span>
          </div>

          <button
            onClick={handleCopyLogs}
            className="hover:text-purple-600 dark:hover:text-white transition-colors flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 text-[11px]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-slate-950 overflow-hidden shadow-inner">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-950 dark:bg-black/50 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
            <span>Commit {run.commitSha || 'HEAD'} • {run.name} • Run #{run.runNumber}</span>
            <span className="text-rose-400">Exit Code: 1</span>
          </div>

          <pre className="font-mono text-xs text-rose-300 p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px] scrollbar-terminal select-text">
            {logsError || realLogs || errorMessage}
          </pre>
        </div>
      </div>
    </div>
  );
};
