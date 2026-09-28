import React, { useState, useEffect } from 'react';
import { User, ShieldCheck, Bell, Palette, Plus, Trash2, Check, Sun, Moon, Sparkles, LogOut, Key, ExternalLink, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { repositoryService } from '../services/repositoryService';
import { GithubIcon } from '../components/GithubIcon';
import { AddRepositoryModal } from '../components/AddRepositoryModal';
import { GitHubConnectModal } from '../components/GitHubConnectModal';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { success, info } = useToast();
  const { user, token, username, logout, selectedRepoNames, setSelectedRepoNames, isAuthenticated } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [allRepos, setAllRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Notification preferences (persisted locally)
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);
  const [notifyOnMentions, setNotifyOnMentions] = useState(true);
  const [notifyOnPR, setNotifyOnPR] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadRepos();
    }
  }, [isAuthenticated, user]);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const repos = await repositoryService.getRepositories();
      setAllRepos(repos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleDisconnectRepo = (repoName: string) => {
    const updated = selectedRepoNames.filter((r) => r !== repoName);
    setSelectedRepoNames(updated);
    info(`Removed repository access for ${repoName}`);
  };

  const handleSavePermissions = (enabledNames: string[]) => {
    setSelectedRepoNames(enabledNames);
  };

  const handleLogout = async () => {
    await logout();
    success('Disconnected GitHub account and cleared local session.');
    navigate('/');
  };

  const connectedRepos = allRepos.filter((r) =>
    selectedRepoNames.length === 0 ? true : selectedRepoNames.includes(r.name)
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">
          Settings & Account
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your GitHub account connection, authorized repositories, notifications, and appearance.
        </p>
      </div>

      <div className="space-y-6">
        {/* 1. Account Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-6 backdrop-blur-md shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm">
            <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Connected GitHub Account</span>
          </div>

          {isAuthenticated && user ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-purple-500/40 shadow-sm"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-base">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{user.name || user.username}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{user.username}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <Check className="h-3 w-3" /> {token ? 'PAT Active' : 'Public Access'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Switch Account
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">No GitHub account connected</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Connect your GitHub token or username to load real repositories and workflows.
                </p>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition-all"
              >
                <GithubIcon className="h-4 w-4 fill-white" />
                <span>Connect GitHub</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Repository Access Permissions */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-6 backdrop-blur-md shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Authorized Repositories ({connectedRepos.length})</span>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Manage Access</span>
            </button>
          </div>

          <div className="space-y-2">
            {connectedRepos.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No repositories authorized yet. Click "Manage Access" to select repositories.
              </div>
            ) : (
              connectedRepos.map((repo) => (
                <div
                  key={repo.name}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{repo.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {repo.isPrivate ? 'Private' : 'Public'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {repo.description || 'Monitored repository workspace'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDisconnectRepo(repo.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors ml-2"
                    title="Remove access"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Appearance & Theme */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-6 backdrop-blur-md shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm">
            <Palette className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Theme & Display</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Interface Theme</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Switch between high-contrast dark mode and clean light mode.
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white hover:border-purple-500/40 transition-colors shadow-sm"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-purple-400" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-purple-600" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add Repository Modal */}
      <AddRepositoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        connectedRepoNames={selectedRepoNames}
        onSavePermissions={handleSavePermissions}
      />

      {/* GitHub Connect Modal */}
      <GitHubConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
};
