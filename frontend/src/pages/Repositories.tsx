import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Grid, List, Plus, RefreshCw, MessageSquare, Users, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { repositoryService } from '../services/repositoryService';
import { Repository, WorkflowStatus } from '../types';

export const Repositories: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'failing' | 'private'>('all');

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const data = await repositoryService.getRepositories();
        setRepositories(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRepos();
  }, []);

  const filteredRepos = useMemo(() => {
    return repositories.filter(repo => {
      // Search matching
      const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            repo.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'healthy') {
        return repo.lastWorkflowStatus === 'success';
      }
      if (statusFilter === 'failing') {
        return repo.lastWorkflowStatus === 'failed';
      }
      if (statusFilter === 'private') {
        return repo.isPrivate;
      }
      
      return true;
    });
  }, [repositories, searchQuery, statusFilter]);

  const getStatusIcon = (status: WorkflowStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold dark:bg-emerald-950/30 dark:text-emerald-400">SUCCESS</span>;
      case 'failed':
        return <span className="rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold dark:bg-rose-950/30 dark:text-rose-400">FAILED</span>;
      case 'running':
        return <span className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold dark:bg-blue-950/30 dark:text-blue-400">RUNNING</span>;
      case 'warning':
        return <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-bold dark:bg-amber-950/30 dark:text-amber-400">WARNING</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">My Repositories</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Explore active repository workspaces and connected developer channels.</p>
        </div>
        <button
          onClick={() => navigate('/settings/github')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Connect Repositories
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-60 rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-4 text-xs outline-none dark:border-slate-850 dark:bg-slate-950 focus-ring"
            />
          </div>

          {/* Filter Categories */}
          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('healthy')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                statusFilter === 'healthy'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Healthy
            </button>
            <button
              onClick={() => setStatusFilter('failing')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                statusFilter === 'failing'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Failing
            </button>
            <button
              onClick={() => setStatusFilter('private')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                statusFilter === 'private'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Private
            </button>
          </div>
        </div>

        {/* Layout Mode Grid/List toggle */}
        <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-md p-1.5 ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
            }`}
            title="Grid view"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
            }`}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Repositories Grid or List display */}
      {filteredRepos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
          <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">No repositories found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">Try refining your keyword search or change status filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
          {filteredRepos.map(repo => (
            <div
              key={repo.id}
              onClick={() => navigate(`/repositories/${repo.name}/overview`)}
              className="card-main card-hover flex flex-col justify-between cursor-pointer"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white truncate">{repo.name}</h3>
                    <span className="text-[10px] text-slate-400 truncate block mt-0.5">@{repo.owner}</span>
                  </div>
                  {getStatusBadge(repo.lastWorkflowStatus)}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{repo.description}</p>
              </div>

              <div className="mt-6 space-y-3 pt-3.5 border-t border-slate-200/60 dark:border-slate-800/40">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{repo.language}</span>
                  <span>Updated {repo.lastUpdated}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      {repo.contributorCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      {repo.openDiscussionsCount}
                    </span>
                  </div>
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {repo.userAccessRole}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Mode View */
        <div className="card-main overflow-hidden p-0 animate-fade-in">
          <div className="divide-y divide-slate-150 dark:divide-slate-850">
            {filteredRepos.map(repo => (
              <div
                key={repo.id}
                onClick={() => navigate(`/repositories/${repo.name}/overview`)}
                className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-[240px] flex-1">
                  <div className="mt-0.5">{getStatusIcon(repo.lastWorkflowStatus)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-950 dark:text-white truncate">{repo.name}</h3>
                      <span className="rounded border border-slate-200 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:border-slate-800">
                        {repo.isPrivate ? 'Private' : 'Public'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{repo.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{repo.language}</span>
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span>{repo.contributorCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>{repo.openDiscussionsCount}</span>
                  </div>
                  <span>Updated {repo.lastUpdated}</span>
                  <div className="min-w-[70px] text-right">{getStatusBadge(repo.lastWorkflowStatus)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
