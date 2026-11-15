import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertOctagon,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  History,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Terminal,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAIAssistant } from '../contexts/assistantState';
import { useAuth } from '../contexts/authState';
import { useToast } from '../contexts/toastState';
import { aiService } from '../services/aiService';
import { logService } from '../services/logService';
import { ProviderAnalysis, WorkflowRun } from '../types';

interface FailureDetailPanelProps {
  run: WorkflowRun;
  repoId: string;
  onPushToThread: (title: string, logExcerpt: string, aiSolution: string) => void;
}

export const FailureDetailPanel: React.FC<FailureDetailPanelProps> = ({
  run,
  repoId,
  onPushToThread,
}) => {
  const { success, error: showError } = useToast();
  const { openAssistant } = useAIAssistant();
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFullRawLogs, setShowFullRawLogs] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const logsKey = ['logs', user?.id, repoId, run.id, run.runAttempt || 1];
  const analysisKey = ['analysis', user?.id, repoId, run.id, run.runAttempt || 1];
  const logsQuery = useQuery({
    queryKey: logsKey,
    queryFn: () => logService.getWorkflowLogs(run.id, repoId),
    staleTime: Infinity,
  });
  const analysisQuery = useQuery({
    queryKey: analysisKey,
    queryFn: () => aiService.analyzeFailure(run.id, undefined, repoId),
    enabled: logsQuery.isSuccess && logsQuery.data.length > 0,
    staleTime: Infinity,
  });
  const realLogs = logsQuery.isPending
    ? 'Loading GitHub Actions logs...'
    : (logsQuery.data || []).map((line) => line.message).join('\n');
  const logsError = logsQuery.error
    ? 'Unable to retrieve complete GitHub Actions logs. Retry when they are available.'
    : null;
  const analysisLoading = reanalyzing || (analysisQuery.isFetching && logsQuery.isSuccess);
  const analysisData = analysisQuery.data || null;
  const analysisError =
    manualError || (analysisQuery.error ? 'Diagnostics unavailable. Retry analysis.' : null);
  const handleTriggerAnalysis = async () => {
    if (reanalyzing) return;
    setReanalyzing(true);
    setManualError(null);
    try {
      const logs = await logsQuery.refetch();
      if (logs.error || !logs.data?.length) throw new Error('Complete logs are required.');
      await queryClient.fetchQuery({
        queryKey: analysisKey,
        staleTime: 0,
        queryFn: () => aiService.reanalyzeFailure(run.id, repoId),
      });
      success('Diagnostic scan complete.', 'Analysis Ready');
    } catch {
      setManualError('Failed to execute AI diagnostics. Saved results remain available.');
      showError('Diagnostic engine could not complete this request.', 'Scan Failed');
    } finally {
      setReanalyzing(false);
    }
  };

  const errorMessage =
    run.diagnosticInfo?.errorSnippet ||
    `GitHub Actions run #${run.runNumber} for '${run.name}' failed on branch '${run.branch}'.\nCommit: ${run.commitMessage} (${run.commitSha})\nExit status: Failure`;

  const fallbackSuggestedFix =
    run.diagnosticInfo?.suggestedFix ||
    `1. Inspect the failing step in GitHub Actions logs.\n2. Reproduce the failing command locally in your terminal.\n3. Verify all required secrets and environment variables are set in GitHub Repository Settings.`;

  const effectiveFix = analysisData?.suggestedFix || fallbackSuggestedFix;
  const effectiveRootCause =
    analysisData?.rootCause || run.diagnosticInfo?.rootCause || errorMessage;
  const providerResults = analysisData?.providers;
  const groqResult = providerResults?.groq;
  const evidenceGraph = analysisData?.evidenceGraph;
  const graphNodesById = new Map(
    (evidenceGraph?.nodes || []).map((node) => [node.event_id, node] as const),
  );
  const graphEdges = evidenceGraph?.edges.slice(0, 5) || [];

  const renderProvider = (provider: ProviderAnalysis | undefined, label: string) => {
    if (!provider) {
      return (
        <p className="text-xs text-slate-700 dark:text-slate-400">
          No saved result is available for {label}.
        </p>
      );
    }
    if (provider.status === 'unavailable') {
      return (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          This provider is not available for this workspace.
        </p>
      );
    }
    if (provider.status === 'failed') {
      return (
        <div className="space-y-2">
          <p className="text-xs text-rose-700 dark:text-rose-300">
            This provider failed during analysis. The saved result is retained for deterministic
            reloads.
          </p>
          {provider.error && (
            <p className="rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-950/30 p-2 text-[10px] text-rose-800 dark:text-rose-200 font-mono break-words">
              {provider.error}
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          {provider.summary}
        </p>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">
            Root Cause
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-200/90 whitespace-pre-wrap font-mono">
            {provider.rootCause}
          </p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
            Suggested Fix
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
            {provider.suggestedFix}
          </p>
        </div>
      </div>
    );
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(realLogs || errorMessage);
    setCopiedLogs(true);
    success('Logs copied to clipboard!', 'Copied');
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleCopyFix = () => {
    navigator.clipboard.writeText(effectiveFix);
    setCopiedFix(true);
    success('Remediation patch copied to clipboard!', 'Copied');
    setTimeout(() => setCopiedFix(false), 2000);
  };

  const handlePush = () => {
    const threadTitle = `[AI Diagnostic] Run #${run.runNumber}: ${run.name} Failure`;
    const logsForThread =
      realLogs && realLogs !== 'Loading GitHub Actions logs...' ? realLogs : errorMessage;
    const analysisExcerpt = analysisData?.summary
      ? `Summary:\n${analysisData.summary}\n\nRoot Cause:\n${effectiveRootCause}`
      : effectiveRootCause;
    const excerpt = `Failure Logs:\n${logsForThread}\n\nFailure Analysis:\n${analysisExcerpt}`;
    onPushToThread(threadTitle, excerpt, effectiveFix);
  };

  const handleAskAI = () => {
    const promptContext = analysisData
      ? `Diagnose this GitHub Actions failure for Run #${run.runNumber} (${run.name}):\n\nRoot Cause: ${analysisData.rootCause}\n\nProposed Fix: ${analysisData.suggestedFix}\n\nCan you explain how to apply this safely?`
      : `Diagnose this GitHub Actions failure for Run #${run.runNumber} (${run.name}):\n\n${errorMessage}\n\nWhat are the recommended fixes?`;
    openAssistant(promptContext, repoId);
  };

  return (
    <div className="space-y-5">
      {logsError && (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
          {logsError}
        </p>
      )}
      {/* 1. Action Banner: Quick Overview + Actions */}
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
              Branch:{' '}
              <span className="text-slate-800 dark:text-slate-200 font-medium">{run.branch}</span> •
              Commit:{' '}
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                #{run.commitSha || 'HEAD'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAskAI}
            className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-4 py-2.5 text-xs font-bold transition-all shadow-sm hover:bg-purple-100 dark:hover:bg-purple-900/50"
          >
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Ask Assistant</span>
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

      {/* 2. Dedicated Live FlowForge AI Diagnostic Card */}
      <div className="rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-gradient-to-b from-purple-50 via-white to-slate-50 dark:from-purple-950/20 dark:via-slate-900/90 dark:to-slate-950 p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Diagnostic Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shadow-md shadow-purple-500/30">
              <div className="h-full w-full bg-white dark:bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  FlowForge AI Diagnostic Engine
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Autonomous root-cause detection & remediation synthesis
              </p>
            </div>
          </div>

          {/* Diagnostic controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerAnalysis}
              disabled={analysisLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50"
              title="Re-analyze with current Gemini and Groq providers"
            >
              <RefreshCw
                className={`h-4 w-4 ${analysisLoading ? 'animate-spin text-purple-400' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Card Body */}
        {analysisLoading ? (
          <div className="py-10 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
            <p className="text-xs text-purple-800 dark:text-purple-300 font-mono animate-pulse">
              FlowForge Intelligence Core is analyzing build logs and workspace AST...
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3.5 relative z-10">
            {providerResults && (
              <div className="rounded-xl border border-cyan-200 dark:border-cyan-500/25 bg-cyan-50/60 dark:bg-slate-950/70 p-3.5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-bold text-cyan-800 dark:text-cyan-300 uppercase font-mono tracking-wider">
                    Model Comparison
                  </div>
                  <span className="text-[10px] text-slate-700 dark:text-slate-400 font-mono">
                    Saved per workflow run
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {(['gemini', 'groq'] as const).map((provider) => (
                    <div
                      key={provider}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-black/30 p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {provider === 'gemini' ? 'Gemini' : 'Groq'}
                        </span>
                        <span className="text-[10px] rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-slate-700 dark:text-slate-400">
                          {providerResults[provider]?.status || 'missing'}
                        </span>
                      </div>
                      {renderProvider(
                        provider === 'groq' ? groqResult : providerResults[provider],
                        provider === 'gemini' ? 'Gemini' : 'Groq',
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Identified Root Cause */}
            <div className="rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-500/30 p-3.5">
              <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase font-mono tracking-wider mb-1 flex items-center gap-1.5">
                <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
                <span>Identified Root Cause (LogSage Analysis)</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-200/90 leading-relaxed font-mono whitespace-pre-wrap">
                {effectiveRootCause}
              </p>
            </div>

            {/* Factual Log Evidence */}
            {analysisData?.evidence && analysisData.evidence.length > 0 && (
              <div className="rounded-xl bg-amber-50/70 border border-amber-200 dark:bg-slate-950/70 dark:border-slate-800/80 p-3.5">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase font-mono tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Observed Log Evidence</span>
                </div>
                <ul className="space-y-1.5">
                  {analysisData.evidence.map((ev, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-700 dark:text-slate-300 font-mono flex items-start gap-2"
                    >
                      <span className="text-amber-400 select-none">•</span>
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evidenceGraph && (
              <div className="rounded-xl bg-cyan-50/60 border border-cyan-200 dark:bg-slate-950/70 dark:border-cyan-500/25 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-cyan-800 dark:text-cyan-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>Evidence Graph</span>
                  </div>
                  <span className="text-[10px] text-slate-700 dark:text-slate-400 font-mono">
                    {evidenceGraph.nodes.length} events · {evidenceGraph.edges.length} relationships
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                  Candidate scores rank evidence; they are not probabilities. Event order alone does
                  not establish causation.
                </p>
                {evidenceGraph.root_cause_candidates.length > 0 ? (
                  <ol className="space-y-2">
                    {evidenceGraph.root_cause_candidates.slice(0, 3).map((candidate) => {
                      const node = graphNodesById.get(candidate.event_id);
                      if (!node) return null;
                      return (
                        <li
                          key={candidate.event_id}
                          className="rounded-lg border border-cyan-200/80 dark:border-cyan-500/20 bg-white/80 dark:bg-black/30 p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-cyan-800 dark:text-cyan-300 uppercase font-mono">
                              Candidate #{candidate.rank} · Line {node.line_start}
                            </span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                              score {candidate.score.toFixed(2)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-800 dark:text-slate-200 font-mono break-words">
                            {node.original_message}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    No strongly classified root-cause candidate was identified.
                  </p>
                )}
                {graphEdges.length > 0 && (
                  <ul className="space-y-1 border-t border-cyan-200/80 dark:border-cyan-500/20 pt-2">
                    {graphEdges.map((edge, index) => {
                      const source = graphNodesById.get(edge.source_node_id);
                      const target = graphNodesById.get(edge.target_node_id);
                      if (!source || !target) return null;
                      return (
                        <li
                          key={`${edge.source_node_id}-${edge.target_node_id}-${edge.relationship_type}-${index}`}
                          className="text-[10px] text-slate-700 dark:text-slate-300 font-mono"
                        >
                          Line {source.line_start} {edge.relationship_type} line {target.line_start}
                          : {edge.supporting_evidence}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Critical Preprocessed Log Blocks */}
            {analysisData?.importantLogBlocks && analysisData.importantLogBlocks.length > 0 && (
              <div className="rounded-xl bg-purple-50/60 border border-purple-200 dark:bg-slate-950/70 dark:border-purple-500/25 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-purple-400" />
                    <span>Relevant Log Blocks</span>
                  </div>
                  <span className="text-[10px] text-slate-700 dark:text-slate-400 font-mono">
                    {analysisData.importantLogBlocks.length} block
                    {analysisData.importantLogBlocks.length > 1 ? 's' : ''} isolated
                  </span>
                </div>
                <div className="space-y-2">
                  {analysisData.importantLogBlocks.map((block, bIdx) => {
                    const startL = block.startLine ?? block.start_line ?? 1;
                    const endL = block.endLine ?? block.end_line ?? 1;
                    return (
                      <div
                        key={bIdx}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/60 overflow-hidden text-xs font-mono"
                      >
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-400">
                          <span className="font-bold text-purple-700 dark:text-purple-300">
                            Block #{bIdx + 1}: Lines {startL}–{endL}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {block.reasons?.slice(0, 2).map((r, rIdx) => (
                              <span
                                key={rIdx}
                                className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300 text-[9px]"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                        <pre className="p-3 overflow-x-auto text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed font-mono whitespace-pre select-text">
                          {block.text ||
                            block.lines
                              ?.map(
                                (l) =>
                                  `${(l.lineNumber ?? l.line_number ?? 0).toString().padStart(5, ' ')} | ${l.text}`,
                              )
                              .join('\n')}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Similar Historical Failure from FlowForge Semantic Memory */}
            {analysisData?.similarPreviousRunNumber && (
              <div className="rounded-xl bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/25 dark:border-indigo-500/30 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                    <History className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                        Pattern Match: Run #{analysisData.similarPreviousRunNumber}
                      </span>
                      {analysisData.similarMatchPercent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                          {analysisData.similarMatchPercent}% Semantic Similarity
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-indigo-700/80 dark:text-indigo-200/70 mt-0.5 font-mono">
                      Identified via FlowForge Semantic Memory Engine • Historical failure pattern
                      verified
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recommended Remediation Patch */}
            <div className="rounded-xl bg-white border border-purple-200 dark:bg-slate-950 dark:border-purple-500/25 p-4 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Recommended Remediation Patch</span>
                </div>
                <button
                  onClick={handleCopyFix}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white px-3 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-500/30 transition-all shadow-sm"
                >
                  {copiedFix ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedFix ? 'Copied' : 'Copy Fix'}</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-purple-800 dark:text-purple-200 whitespace-pre-wrap leading-relaxed overflow-x-auto bg-purple-50 dark:bg-black/50 p-3.5 rounded-lg border border-purple-100 dark:border-slate-800 select-text">
                {effectiveFix}
              </pre>
            </div>

            {/* Card Action Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Engine:{' '}
                <span className="text-purple-700 dark:text-purple-400 font-semibold">
                  FlowForge Intelligence Core
                </span>{' '}
                • Grounded in Run History
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAskAI}
                  className="flex items-center gap-1.5 rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-3.5 py-2 text-xs font-bold transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  <span>Ask Assistant</span>
                </button>
                <button
                  onClick={handlePush}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs font-bold transition-all shadow-md shadow-purple-600/20"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  <span>Push Fix to Discussion Thread</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {analysisError && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 font-mono">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              {analysisError}
            </span>
            <button
              onClick={handleTriggerAnalysis}
              className="underline hover:text-amber-900 dark:hover:text-white font-bold"
            >
              Retry Diagnostic
            </button>
          </div>
        )}
      </div>

      {/* 3. Step Breakdown / Diagnostic Details */}
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

      {/* 4. Complete Execution Logs & Preserved Raw Archive */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 uppercase tracking-wider font-mono">
            <Terminal className="h-4 w-4" />
            <span>GitHub Actions Complete Execution Logs</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFullRawLogs(!showFullRawLogs)}
              className="px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {showFullRawLogs ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              <span>{showFullRawLogs ? 'Hide Full Raw Log' : 'View Full Raw Log'}</span>
            </button>
            <button
              onClick={handleCopyLogs}
              className="hover:text-purple-600 dark:hover:text-white transition-colors flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 text-[11px] px-2 py-1"
            >
              {copiedLogs ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {showFullRawLogs ? (
          <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-black/50 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              <span>
                Commit {run.commitSha || 'HEAD'} • {run.name} • Run #{run.runNumber} (Complete
                Preserved Raw Log)
              </span>
              <span className="text-rose-400">Exit Code: 1</span>
            </div>

            <pre className="font-mono text-xs text-rose-700 dark:text-rose-300 p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px] scrollbar-terminal select-text">
              {analysisData?.rawLogs || logsError || realLogs || errorMessage}
            </pre>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
              <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
              <span>
                Complete workflow logs preserved in Supabase. Critical failure segments isolated
                above.
              </span>
            </div>
            <button
              onClick={() => setShowFullRawLogs(true)}
              className="px-3.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View Full Raw Log</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
