import React, { useEffect, useState } from 'react';
import { Activity as ActivityIcon, FolderGit2, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { repositoryService } from '../services/repositoryService';
import { workflowService } from '../services/workflowService';
import { Repository, WorkflowRun } from '../types';

export const Activity: React.FC = () => {
  const { user, selectedRepoNames } = useAuth();
  const [events, setEvents] = useState<Array<{ repo: Repository; run: WorkflowRun }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadActivity = async () => {
      setLoading(true);
      try {
        const repos = await repositoryService.getRepositories();
        const results = await Promise.all(repos.map(async (repo) => {
          const runs = await workflowService.getWorkflowRuns(repo.id);
          return runs.map((run) => ({ repo, run }));
        }));
        if (active) setEvents(results.flat().sort((a, b) => (b.run.timestamp || '').localeCompare(a.run.timestamp || '')));
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadActivity();
    return () => { active = false; };
  }, [selectedRepoNames, user]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
          Activity Log
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Live timeline of synchronized repositories and CI/CD operations for {user ? `@${user.username}` : 'your workspace'}.
        </p>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Loading GitHub Actions activity...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <FolderGit2 className="h-8 w-8 text-purple-600 mx-auto" />
            <p>No repository activity recorded yet. Connect a GitHub repository to begin tracking.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(({ repo, run }) => (
              <div key={`${repo.id}-${run.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80">
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
