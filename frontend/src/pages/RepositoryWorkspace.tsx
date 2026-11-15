import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  AlertOctagon,
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCw,
  Sparkles,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ContributorCard } from '../components/ContributorCard';
import { FailureDetailPanel } from '../components/FailureDetailPanel';
import { StatusBadge } from '../components/StatusBadge';
import { ThreadView } from '../components/ThreadView';
import { WorkflowRunRow } from '../components/WorkflowRunRow';
import { useAIAssistant } from '../contexts/assistantState';
import { useAuth } from '../contexts/authState';
import { useToast } from '../contexts/toastState';
import { discussionService } from '../services/discussionService';
import { repositoryService } from '../services/repositoryService';
import { teamService } from '../services/teamService';
import { workflowService } from '../services/workflowService';
import { Discussion, WorkflowRun } from '../types';

export const RepositoryWorkspace: React.FC = () => {
  const { repoId } = useParams();
  const location = useLocation();
  return <RepositoryWorkspaceContent key={`${repoId}:${location.state?.draft?.id || ''}`} />;
};

const RepositoryWorkspaceContent: React.FC = () => {
  const { repoId = '', tab, workflowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingDraft = location.state?.draft;
  const [draftTitle, setDraftTitle] = useState(
    typeof incomingDraft?.title === 'string' ? incomingDraft.title : '',
  );
  const [draftContent, setDraftContent] = useState(
    typeof incomingDraft?.content === 'string' ? incomingDraft.content : '',
  );
  const [publishingDraft, setPublishingDraft] = useState(false);
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { openAssistant } = useAIAssistant();
  const queryClient = useQueryClient();
  type Tab = 'failure-analysis' | 'threads' | 'workflows' | 'team';
  const activeTab: Tab =
    tab && ['threads', 'workflows', 'team'].includes(tab) ? (tab as Tab) : 'failure-analysis';
  const [workflowFilter, setWorkflowFilter] = useState<'all' | 'running' | 'passed' | 'failed'>(
    'all',
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(workflowId || null);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [isRetryingLatest, setIsRetryingLatest] = useState(false);
  const repoQuery = useQuery({
    ...repositoryService.repositoryOptions(user?.id || '', repoId),
    enabled: !!user && !!repoId,
  });
  const repo = repoQuery.data || null;
  const runsKey = ['workflow-runs', user?.id, repo?.id];
  const discussionsKey = ['discussions', user?.id, repo?.id];
  const runsQuery = useQuery({
    queryKey: runsKey,
    queryFn: () => workflowService.getWorkflowRuns(repo!.id, true),
    enabled: !!repo,
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === 'running') ? 5000 : false,
  });
  const discussionsQuery = useQuery({
    queryKey: discussionsKey,
    queryFn: () => discussionService.getDiscussions(repo!.id),
    enabled: !!repo && (activeTab === 'threads' || activeTab === 'team'),
  });
  const teamQuery = useQuery({
    queryKey: ['team', user?.id, repo?.id],
    queryFn: () => teamService.getMembers(repo!.id),
    enabled: !!repo && activeTab === 'team',
  });
  const workflowRuns = runsQuery.data || [];
  const discussions = discussionsQuery.data || [];
  const collaborators = teamQuery.data || [];
  const selectedFailureRun =
    workflowRuns.find((run) => run.id === selectedRunId && run.status === 'failed') ||
    workflowRuns.find((run) => run.status === 'failed') ||
    null;
  const selectedDiscussion =
    discussions.find((disc) => disc.id === selectedDiscussionId) || discussions[0] || null;
  const detailsKey = ['discussion', user?.id, repo?.id, selectedDiscussion?.id];
  const detailsQuery = useQuery({
    queryKey: detailsKey,
    queryFn: () => discussionService.getDiscussion(repo!.id, selectedDiscussion!.id),
    enabled: !!repo && !!selectedDiscussion && activeTab === 'threads',
  });
  const comments = detailsQuery.data?.comments || [];
  const loading = repoQuery.isPending || (!!repo && runsQuery.isPending);
  const workspaceError =
    repoQuery.error ||
    runsQuery.error ||
    discussionsQuery.error ||
    teamQuery.error ||
    detailsQuery.error;
  const handleTabClick = (next: Tab) =>
    navigate(`/repositories/${encodeURIComponent(repo?.id || repoId)}/${next}`);
  const setSelectedFailureRun = (run: WorkflowRun | null) => setSelectedRunId(run?.id || null);
  const handleSelectDiscussion = (disc: Discussion) => setSelectedDiscussionId(disc.id);
  const handleCreateDiscussion = async (
    title: string,
    content: string,
    runId: string | null | undefined = selectedFailureRun?.id,
  ) => {
    if (!repo) return false;
    const created = await discussionService.createDiscussion(
      repo.id,
      runId || undefined,
      title,
      content,
    );
    queryClient.setQueryData<Discussion[]>(discussionsKey, (current) => [
      created,
      ...(current || []).filter((disc) => disc.id !== created.id),
    ]);
    setSelectedDiscussionId(created.id);
    await queryClient.invalidateQueries({
      queryKey: ['discussion', user?.id, repo.id, created.id],
    });
    return true;
  };
  const handleAddComment = async (discussionId: string, content: string) => {
    if (!repo) throw new Error('Repository is no longer selected.');
    await discussionService.addComment(repo.id, discussionId, content);
    await queryClient.invalidateQueries({
      queryKey: ['discussion', user?.id, repo.id, discussionId],
    });
    await queryClient.invalidateQueries({ queryKey: discussionsKey });
  };
  const handleResolveDiscussion = async (discussionId: string, status: 'resolved' | 'open') => {
    if (!repo) return;
    await discussionService.resolveDiscussion(repo.id, discussionId, status);
    await queryClient.invalidateQueries({ queryKey: discussionsKey });
  };
  const handlePushFailureToThread = async (title: string, excerpt: string, fix: string) => {
    try {
      if (
        await handleCreateDiscussion(title, `${excerpt}\n\nSuggested Fix & Diagnostics:\n${fix}`)
      ) {
        success('Failure logs and diagnosis were added to a GitHub issue.', 'Pushed to Thread');
        handleTabClick('threads');
      }
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
      showError(
        typeof detail === 'string' ? detail : 'Could not create a discussion.',
        'Push Failed',
      );
    }
  };
  const handleRetryLatestRun = async () => {
    if (!repo || !selectedFailureRun || isRetryingLatest) return;
    setIsRetryingLatest(true);
    try {
      await workflowService.retryWorkflow(repo.id, selectedFailureRun.id);
      await queryClient.invalidateQueries({
        queryKey: ['logs', user?.id, repo.id, selectedFailureRun.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ['analysis', user?.id, repo.id, selectedFailureRun.id],
      });
      await queryClient.invalidateQueries({ queryKey: runsKey });
      success('Workflow retry requested on GitHub.', 'Workflow Queued');
    } catch {
      showError('GitHub could not queue this retry.', 'Retry Failed');
    } finally {
      setIsRetryingLatest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-12 text-center text-slate-400 max-w-lg mx-auto mt-12 space-y-4 shadow-sm">
        <AlertOctagon className="h-10 w-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Repository Not Found</h3>
        <p className="text-xs text-slate-500">
          The repository '{repoId}' could not be loaded. Please ensure it is connected and
          synchronized.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const failedRuns = workflowRuns.filter((r) => r.status === 'failed');
  const filteredRuns = workflowRuns.filter((r) => {
    if (workflowFilter === 'running') return r.status === 'running';
    if (workflowFilter === 'passed') return r.status === 'success';
    if (workflowFilter === 'failed') return r.status === 'failed';
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {workspaceError && (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Some workspace data could not be loaded. Refresh or reconnect GitHub and try again.
        </p>
      )}
      {/* 1. Header: Repo name + owner + status badge + AI Assistant trigger + "Retry latest run" button */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm flex flex-wrap items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">
                {repo.name}
              </h1>
              <StatusBadge status={repo.lastWorkflowStatus} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Repository Owner:{' '}
              <span className="text-purple-600 dark:text-purple-400 font-bold">@{repo.owner}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Ask AI Assistant button */}
          <button
            onClick={() =>
              openAssistant(
                `I am looking at ${repo.name}. Can you summarize recent build status, failure points, and team recommendations?`,
                repo.id,
              )
            }
            className="flex items-center gap-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 px-4 py-2.5 text-xs font-bold transition-all shadow-sm group"
          >
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 group-hover:rotate-12 transition-transform" />
            <span>AI Assistant</span>
          </button>

          {/* Action Button: Retry Latest Run if failed (Red for failure) */}
          {repo.lastWorkflowStatus === 'failed' && (
            <button
              onClick={handleRetryLatestRun}
              disabled={isRetryingLatest}
              className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all disabled:opacity-75"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRetryingLatest ? 'animate-spin' : ''}`} />
              <span>{isRetryingLatest ? 'Retrying Latest Run...' : 'Retry Latest Run'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Navigation Tabs (4 Core Tabs) */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 space-x-1 overflow-x-auto scrollbar-terminal">
        {[
          {
            id: 'failure-analysis',
            name: 'Failure Analysis & Logs',
            icon: AlertOctagon,
            count: failedRuns.length,
            highlight: true,
          },
          {
            id: 'threads',
            name: 'Discussion Threads',
            icon: MessageSquare,
            count: discussions.length,
          },
          { id: 'workflows', name: 'All Workflows', icon: Play, count: workflowRuns.length },
          { id: 'team', name: 'Team & Collaboration', icon: Users, count: collaborators.length },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleTabClick(t.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'border-purple-600 dark:border-purple-500 text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/20'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${t.highlight && failedRuns.length > 0 ? 'text-rose-500' : ''}`}
              />
              <span>{t.name}</span>
              {t.count !== undefined && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    t.id === 'failure-analysis' && t.count > 0
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : isActive
                        ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}
      <div className="mt-4">
        {/* TAB 1: FAILURE ANALYSIS (Latest Logs + Push to Discussion Thread) */}
        {activeTab === 'failure-analysis' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: List of recorded failure runs */}
            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Failing Runs</span>
                    <span className="text-[10px] font-mono text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                      {failedRuns.length}
                    </span>
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Select run
                  </span>
                </div>

                <div className="space-y-2">
                  {failedRuns.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      <CheckCircle2 className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                      <span>All workflow runs are currently passing!</span>
                    </div>
                  ) : (
                    failedRuns.map((run, idx) => {
                      const isSelected = selectedFailureRun?.id === run.id;
                      const isLatest = idx === 0;
                      return (
                        <div
                          key={run.id}
                          onClick={() => setSelectedFailureRun(run)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-red-500/60 bg-red-500/5 dark:bg-red-950/30 text-slate-900 dark:text-white shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isLatest && (
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
                              )}
                              <span className="text-xs font-bold text-red-600 dark:text-red-400 truncate">
                                {run.diagnosticInfo?.errorType || `${run.name} Failed`}
                              </span>
                            </div>
                            <span className="rounded bg-red-500/15 border border-red-500/25 px-1.5 py-0.2 text-[9px] font-bold text-red-600 dark:text-red-400">
                              Run #{run.runNumber || run.id}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            <span>branch: {run.branch}</span>
                            <span>{run.timestamp || 'Date unavailable'}</span>
                          </div>
                          <div
                            className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400"
                            title={run.commitMessage}
                          >
                            commit: {run.commitSha || 'HEAD'} · {run.commitMessage}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Full Failure Detail Panel with Latest Logs and Push to Thread */}
            <div className="lg:col-span-8">
              {selectedFailureRun ? (
                <FailureDetailPanel
                  key={`${repo.id}:${selectedFailureRun.id}:${selectedFailureRun.runAttempt || 1}`}
                  run={selectedFailureRun}
                  repoId={repo.id}
                  onPushToThread={handlePushFailureToThread}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-12 text-center text-slate-400">
                  <AlertOctagon className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs">Select a failure on the left to inspect logs.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DISCUSSION THREADS */}
        {activeTab === 'threads' && (
          <>
            {incomingDraft && (
              <form
                className="mb-5 rounded-xl border border-purple-300 p-4 space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (publishingDraft) return;
                  setPublishingDraft(true);
                  try {
                    await handleCreateDiscussion(draftTitle, draftContent, null);
                    success('Discussion published to GitHub.');
                    navigate(location.pathname, { replace: true, state: null });
                  } catch {
                    showError('Could not publish this discussion. Your draft is retained.');
                  } finally {
                    setPublishingDraft(false);
                  }
                }}
              >
                <p className="text-sm font-bold">Review discussion draft</p>
                <input
                  aria-label="Discussion title"
                  value={draftTitle}
                  required
                  maxLength={255}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  className="w-full rounded border p-2 text-slate-900"
                />
                <textarea
                  aria-label="Discussion content"
                  value={draftContent}
                  required
                  maxLength={60000}
                  onChange={(event) => setDraftContent(event.target.value)}
                  className="w-full rounded border p-2 text-slate-900"
                  rows={6}
                />
                <button
                  disabled={publishingDraft || !draftTitle.trim() || !draftContent.trim()}
                  className="rounded bg-purple-600 px-4 py-2 text-white"
                >
                  Publish discussion
                </button>
              </form>
            )}
            <ThreadView
              key={selectedDiscussion?.id || 'empty'}
              repoId={repo.id}
              discussions={discussions}
              selectedDiscussion={selectedDiscussion}
              comments={comments}
              onSelectDiscussion={handleSelectDiscussion}
              onAddComment={handleAddComment}
              onResolveDiscussion={handleResolveDiscussion}
            />
          </>
        )}

        {/* TAB 3: WORKFLOWS */}
        {activeTab === 'workflows' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-1">
                {(['all', 'running', 'passed', 'failed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setWorkflowFilter(mode)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold capitalize transition-all ${
                      workflowFilter === mode
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Showing <b className="text-slate-900 dark:text-white">{filteredRuns.length}</b>{' '}
                workflow runs
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] overflow-hidden shadow-sm">
              {filteredRuns.map((run) => (
                <WorkflowRunRow
                  key={run.id}
                  run={run}
                  onSelectForFailureAnalysis={(r) => {
                    setSelectedFailureRun(r);
                    handleTabClick('failure-analysis');
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TEAM & COLLABORATION */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collaborators.map((c) => (
                <ContributorCard key={c.id} collaborator={c} />
              ))}
            </div>
            {collaborators.length === 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                GitHub returned no collaborators for this repository, or your token cannot view its
                access list.
              </div>
            )}

            {/* Team Collaboration Hub */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Team Developer Discussions
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Active repository team members can review and discuss failures together
                  </p>
                </div>
                <button
                  onClick={() => handleTabClick('threads')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-xs font-bold transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Open Discussion Hub</span>
                </button>
              </div>

              <div className="space-y-2">
                {discussions.slice(0, 3).map((disc) => (
                  <div
                    key={disc.id}
                    onClick={() => {
                      handleSelectDiscussion(disc);
                      handleTabClick('threads');
                    }}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={disc.author.avatarUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-300 dark:ring-slate-700"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {disc.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          by @{disc.author.username} • {disc.commentsCount} replies
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline">
                      View Thread →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
