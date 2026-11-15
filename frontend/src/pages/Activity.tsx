import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, FolderGit2, RefreshCw } from 'lucide-react';
import React from 'react';
import { useAuth } from '../contexts/authState';
import { repositoryService } from '../services/repositoryService';
import { workflowService } from '../services/workflowService';
import { Repository, WorkflowRun } from '../types';

export const Activity: React.FC = () => {
  const { user, selectedRepoIds } = useAuth();

  const activity = useQuery({
    queryKey: ['activity', user?.id, selectedRepoIds],
    enabled: !!user,
    queryFn: async () => {
      const repos = (await repositoryService.getRepositories()).filter(
        (repo) => selectedRepoIds === null || selectedRepoIds.includes(repo.id),
      );
      const events: Array<{ repo: Repository; run: WorkflowRun }> = [];
      let failed = 0;
      for (let offset = 0; offset < repos.length; offset += 5) {
        const results = await Promise.allSettled(
          repos
            .slice(offset, offset + 5)
            .map(async (repo) =>
              (await workflowService.getWorkflowRuns(repo.id)).map((run) => ({ repo, run })),
            ),
        );
        for (const result of results) {
          if (result.status === 'fulfilled') events.push(...result.value);
          else failed += 1;
        }
      }
      return {
        events: events.sort((a, b) => (b.run.timestamp || '').localeCompare(a.run.timestamp || '')),
        failed,
      };
    },
  });
  const events = activity.data?.events || [];
  const loading = activity.isPending;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {(activity.error || !!activity.data?.failed) && (
        <p role="alert" className="text-sm text-amber-600">
          Some repository activity could not be loaded. Try again shortly.
        </p>
      )}
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
          Activity Log
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Live timeline of synchronized repositories and CI/CD operations for{' '}
          {user ? `@${user.username}` : 'your workspace'}.
        </p>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading GitHub Actions activity...
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <FolderGit2 className="h-8 w-8 text-purple-600 mx-auto" />
            <p>
              No repository activity recorded yet. Connect a GitHub repository to begin tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(({ repo, run }) => (
              <div
                key={`${repo.id}-${run.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <ActivityIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {repo.name} · {run.name} · Run #{run.runNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {run.status} · {run.branch} · {run.timestamp || 'Date unavailable'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
