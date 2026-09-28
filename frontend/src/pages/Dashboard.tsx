import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, FolderGit2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, X, LogIn } from 'lucide-react';
import { repositoryService } from '../services/repositoryService';
import { Repository } from '../types';
import { RepoCard } from '../components/RepoCard';
import { AddRepositoryModal } from '../components/AddRepositoryModal';
import { GitHubConnectModal } from '../components/GitHubConnectModal';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedRepoNames, setSelectedRepoNames, isAuthenticated } = useAuth();
  const { success } = useToast();

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const fetchRepos = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await repositoryService.getRepositories(forceRefresh);
      setRepositories(data);

      // If no selected repo names are in storage yet, select all fetched repos
      if (selectedRepoNames.length === 0 && data.length > 0) {
        setSelectedRepoNames(data.map((r) => r.name));
      }
    } catch (err) {
      console.error('Error fetching repositories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [user]);

  const handleSavePermissions = (enabledNames: string[]) => {
    setSelectedRepoNames(enabledNames);
  };

  const displayedRepos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return repositories.filter((r) => {
      const isAuthorized =
        selectedRepoNames.length === 0 || selectedRepoNames.includes(r.name);
      const matchesSearch =
        !term ||
        r.name.toLowerCase().includes(term) ||
        (r.owner && r.owner.toLowerCase().includes(term)) ||
        (r.description && r.description.toLowerCase().includes(term));
      return isAuthorized && matchesSearch;
    });
  }, [repositories, selectedRepoNames, search]);

  const totalConnected = displayedRepos.length;
  const passedCount = displayedRepos.filter((r) => r.lastWorkflowStatus === 'success').length;
  const failedCount = displayedRepos.filter((r) => r.lastWorkflowStatus === 'failed').length;
  const runningCount = displayedRepos.filter(
    (r) => r.lastWorkflowStatus === 'running' || r.lastWorkflowStatus === 'warning'
  ).length;

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 text-purple-600 animate-spin" />
        <span className="text-xs text-slate-500 font-mono">Synchronizing with GitHub API...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Connected Repos"
          value={totalConnected}
          icon={FolderGit2}
          color="purple"
          subtitle={user ? `@${user.username} repositories` : 'Authorized workspaces'}
        />
        <StatCard
          title="Passing Pipelines"
          value={passedCount}
          icon={CheckCircle2}
          color="emerald"
          subtitle="Healthy automated builds"
        />
        <StatCard
          title="Failing Pipelines"
          value={failedCount}
          icon={XCircle}
          color="rose"
          subtitle="Require failure diagnostics"
        />
        <StatCard
          title="Active Checks"
          value={runningCount}
          icon={AlertTriangle}
          color="amber"
          subtitle="In progress automated checks"
        />
      </div>

      {/* Header Row: "Your repositories" + search/filter + "Add repository" button */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">
            Your repositories
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {user ? (
              <span>
                Connected as <strong className="text-purple-600 dark:text-purple-400">@{user.username}</strong>. Select a repository to inspect GitHub Actions and logs.
              </span>
            ) : (
              'Connect your GitHub account to monitor real repositories and workflows.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search/filter input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-purple-500" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 sm:w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] py-2.5 pl-9 pr-8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-purple-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => {
              fetchRepos(true);
              success('Refreshed repositories from GitHub');
            }}
            title="Refresh from GitHub"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/30 transition-colors shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Add repository / Connect button */}
          {isAuthenticated ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Manage repos</span>
            </button>
          ) : (
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all"
            >
              <LogIn className="h-4 w-4" />
              <span>Connect GitHub</span>
            </button>
          )}
        </div>
      </div>

      {/* Repository Cards Grid or Empty State */}
      {displayedRepos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
            <FolderGit2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAuthenticated ? 'No repositories found' : 'GitHub Not Connected'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {isAuthenticated
                ? 'No repositories match your current filter, or you haven’t authorized any repositories yet.'
                : 'Connect your GitHub account with a Personal Access Token or username to load your real repositories.'}
            </p>
          </div>
          <button
            onClick={() => (isAuthenticated ? setIsAddModalOpen(true) : setIsConnectModalOpen(true))}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all"
          >
            {isAuthenticated ? <Plus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            <span>{isAuthenticated ? 'Select Repositories' : 'Connect with GitHub'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedRepos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}

      {/* Add Repository Modal */}
      <AddRepositoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        connectedRepoNames={selectedRepoNames}
        onSavePermissions={handleSavePermissions}
      />

      {/* Connect Modal */}
      <GitHubConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
};
