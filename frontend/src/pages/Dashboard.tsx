import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Heart, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Play, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { repositoryService } from '../services/repositoryService';
import { workflowService } from '../services/workflowService';
import { Repository, WorkflowRun } from '../types';

// Mock chart data for premium visual feel
const buildMetricsData = [
  { day: 'Mon', success: 12, failed: 1 },
  { day: 'Tue', success: 15, failed: 2 },
  { day: 'Wed', success: 18, failed: 0 },
  { day: 'Thu', success: 10, failed: 3 },
  { day: 'Fri', success: 14, failed: 1 },
  { day: 'Sat', success: 8, failed: 0 },
  { day: 'Sun', success: 16, failed: 2 }
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [recentActivities, setRecentActivities] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const repos = await repositoryService.getRepositories();
        setRepositories(repos);

        // Fetch recent workflow runs from top repositories
        const activities: WorkflowRun[] = [];
        for (const repo of repos) {
          const runs = await workflowService.getWorkflowRuns(repo.id);
          activities.push(...runs);
        }
        // Sort by time (mock sort)
        setRecentActivities(activities.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold dark:bg-emerald-950/30 dark:text-emerald-400">SUCCESS</span>;
      case 'failed':
        return <span className="rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold dark:bg-rose-950/30 dark:text-rose-400">FAILED</span>;
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold dark:bg-blue-950/30 dark:text-blue-400">
            <RefreshCw className="h-2.5 w-2.5 animate-spin" /> RUNNING
          </span>
        );
      case 'warning':
        return <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-bold dark:bg-amber-950/30 dark:text-amber-400">WARNING</span>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-rose-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  // Summarize stats
  const totalRepos = repositories.length;
  const failedRepos = repositories.filter(r => r.lastWorkflowStatus === 'failed').length;
  const warningRepos = repositories.filter(r => r.lastWorkflowStatus === 'warning').length;
  const healthyRepos = totalRepos - failedRepos - warningRepos;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6">
      
      {/* Welcome Banner */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">Good evening, Bharathi</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Here's what is happening across your repositories.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Repos */}
        <div className="card-main flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Repositories</span>
            <div className="text-xl font-extrabold mt-1 text-slate-950 dark:text-white">{totalRepos}</div>
          </div>
          <div className="rounded-lg bg-slate-100 p-2.5 text-slate-500 dark:bg-slate-800/80">
            <Folder className="h-5 w-5" />
          </div>
        </div>

        {/* Healthy Repos */}
        <div className="card-main flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Healthy</span>
            <div className="text-xl font-extrabold mt-1 text-slate-950 dark:text-white">{healthyRepos}</div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-500 dark:bg-emerald-950/20">
            <Heart className="h-5 w-5" />
          </div>
        </div>

        {/* Warnings */}
        <div className="card-main flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Attention</span>
            <div className="text-xl font-extrabold mt-1 text-slate-950 dark:text-white">{warningRepos}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5 text-amber-500 dark:bg-amber-950/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Failed Workflows */}
        <div className="card-main flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Failed Workflows</span>
            <div className="text-xl font-extrabold mt-1 text-slate-950 dark:text-white">{failedRepos}</div>
          </div>
          <div className="rounded-lg bg-rose-50 p-2.5 text-rose-500 dark:bg-rose-950/20">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Grid: Charts + Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Success Rate Chart (Recharts) */}
        <div className="card-main lg:col-span-8 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">CI/CD Run Summary</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Success vs failures across connected repositories</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Success
              </span>
              <span className="flex items-center gap-1 text-rose-500">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Failed
              </span>
            </div>
          </div>

          <div className="h-44 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buildMetricsData} margin={{ left: -25, top: 5, right: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    border: '1px solid rgba(30, 41, 59, 0.8)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }} 
                />
                <Area type="monotone" dataKey="success" stroke="#10b981" fillOpacity={1} fill="url(#colorSuccess)" strokeWidth={2} />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recurring Failures */}
        <div className="card-main lg:col-span-4 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">Recurring Failures</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Critical blockers seen multiple times</p>
          </div>

          <div className="space-y-3.5">
            <div className="rounded-lg border border-rose-200/50 bg-rose-50/10 p-3.5 dark:border-rose-900/30 dark:bg-rose-950/10">
              <div className="flex items-start justify-between">
                <span className="text-xs font-extrabold text-rose-500 dark:text-rose-400">npm ERR! code ERESOLVE</span>
                <span className="rounded bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-500">7 times</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Last seen: 2 mins ago in FlowForge-AI</p>
              <div className="mt-2 border-t border-slate-200/60 dark:border-slate-800/40 pt-2 text-[10px]">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Recommended Fix:</span> Run with --legacy-peer-deps
              </div>
            </div>

            <div className="rounded-lg border border-amber-200/50 bg-amber-50/10 p-3.5 dark:border-amber-900/30 dark:bg-amber-950/10">
              <div className="flex items-start justify-between">
                <span className="text-xs font-extrabold text-amber-500 dark:text-amber-400">ModuleNotFoundError (yaml)</span>
                <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-500">4 times</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Last seen: 3 days ago in German-Bharatham</p>
              <div className="mt-2 border-t border-slate-200/60 dark:border-slate-800/40 pt-2 text-[10px]">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Recommended Fix:</span> Add PyYAML into requirements.txt
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Repositories health list grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-950 dark:text-white">Repository Health Overview</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repositories.map(repo => (
            <div
              key={repo.id}
              onClick={() => navigate(`/repositories/${repo.name}/overview`)}
              className="card-main card-hover cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-950 dark:text-white">{repo.name}</h4>
                    <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:border-slate-800">
                      {repo.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{repo.description}</p>
                </div>
                {getStatusBadge(repo.lastWorkflowStatus)}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-200/60 pt-3 dark:border-slate-800/40 text-xs">
                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                  <span>Score: <b className="text-slate-700 dark:text-slate-200">{repo.healthScore}%</b></span>
                  <span>Success: <b className="text-slate-700 dark:text-slate-200">{repo.successRate}%</b></span>
                </div>
                <div className="flex items-center gap-1.5 text-primary hover:underline font-semibold text-[11px]">
                  <span>Open workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent workflow activities list */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-950 dark:text-white">Recent Workflow Activity</h3>
        <div className="card-main overflow-hidden p-0">
          <div className="min-w-full divide-y divide-slate-200 dark:divide-slate-850">
            <div className="bg-slate-50 dark:bg-slate-900/30 grid grid-cols-12 px-6 py-3.5 text-left text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Repository</div>
              <div className="col-span-3">Workflow Run</div>
              <div className="col-span-2">Commit</div>
              <div className="col-span-2">Triggered by</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-800/40 bg-white dark:bg-slate-900/10">
              {recentActivities.map(activity => (
                <div
                  key={activity.id}
                  onClick={() => navigate(`/repositories/${activity.id}/workflows/${activity.id}`)}
                  className="grid grid-cols-12 px-6 py-4 items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors"
                >
                  <div className="col-span-3 font-semibold text-slate-900 dark:text-white">FlowForge-AI</div>
                  <div className="col-span-3 flex items-center gap-2">
                    {getStatusIcon(activity.status)}
                    <span className="font-medium">Run #{activity.runNumber} - {activity.name}</span>
                  </div>
                  <div className="col-span-2 font-mono text-[10px] text-slate-400">{activity.commitSha.substring(0, 7)}</div>
                  <div className="col-span-2 flex items-center gap-2">
                    <img src={activity.triggeredBy.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                    <span>@{activity.triggeredBy.username}</span>
                  </div>
                  <div className="col-span-2 text-right">{getStatusBadge(activity.status)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
