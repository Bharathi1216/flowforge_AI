import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Palette, Bell, Shield, User, RefreshCw, Check } from 'lucide-react';
import { useTheme, Theme, Accent } from '../contexts/ThemeContext';
import { githubService, GithubRepo } from '../services/githubService';
import { authService } from '../services/authService';
import { User as UserType } from '../types';
import { GithubIcon } from '../components/GithubIcon';

export const Settings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { theme, accent, setTheme, setAccent } = useTheme();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile settings
  const [user, setUser] = useState<UserType | null>(null);
  
  // GitHub connection settings
  const [isConnected, setIsConnected] = useState(true);
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [repoTab, setRepoTab] = useState<'all' | 'my' | 'org'>('all');
  const [githubLoading, setGithubLoading] = useState(false);

  // Notifications settings
  const [notifPreferences, setNotifPreferences] = useState({
    failures: true,
    mentions: true,
    discussions: true,
    assignments: false
  });

  // Sync tab from query parameter if present
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const u = await authService.getCurrentUser();
        setUser(u);

        const repos = await githubService.getGithubRepositories();
        setGithubRepos(repos);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettingsData();
  }, []);

  const handleConnectGithub = async () => {
    setGithubLoading(true);
    try {
      await githubService.connectGithubAccount();
      setIsConnected(true);
    } catch (err) {
      console.error(err);
    } finally {
      setGithubLoading(false);
    }
  };

  const handleDisconnectGithub = async () => {
    setIsConnected(false);
  };

  const handleAddRepo = async (owner: string, name: string) => {
    try {
      await githubService.addRepositoryAccess(owner, name);
      // Refresh list
      const repos = await githubService.getGithubRepositories();
      setGithubRepos(repos);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredGithubRepos = React.useMemo(() => {
    if (repoTab === 'my') {
      return githubRepos.filter(r => r.owner === 'bharathi1216');
    }
    if (repoTab === 'org') {
      return githubRepos.filter(r => r.owner !== 'bharathi1216');
    }
    return githubRepos;
  }, [githubRepos, repoTab]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your account profile, GitHub access, theme settings, and alert priorities.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-terminal">
        {[
          { id: 'profile', name: 'Profile', icon: User },
          { id: 'github', name: 'GitHub Connection', icon: GithubIcon },
          { id: 'appearance', name: 'Appearance', icon: Palette },
          { id: 'notifications', name: 'Notifications', icon: Bell }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary dark:text-primary-hover'
                  : 'border-transparent text-slate-400 hover:border-slate-200 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="mt-4">
        
        {/* Profile Settings */}
        {activeTab === 'profile' && user && (
          <div className="card-main max-w-xl space-y-6">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white border-b border-slate-200 dark:border-slate-850 pb-3">Account Profile</h3>
            
            <div className="flex items-center gap-4">
              <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-4 ring-primary/10" />
              <div>
                <h4 className="text-sm font-bold text-slate-950 dark:text-white">{user.name}</h4>
                <p className="text-xs text-slate-400">@{user.username}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    defaultValue={user.name}
                    className="w-full rounded-lg border border-slate-200 p-2.5 outline-none dark:border-slate-800 dark:bg-slate-950 focus-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    defaultValue={user.email}
                    className="w-full rounded-lg border border-slate-200 p-2.5 outline-none dark:border-slate-800 dark:bg-slate-950 focus-ring"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">GitHub Link</label>
                <input
                  type="text"
                  defaultValue={user.githubUrl}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-900/40 text-slate-400"
                />
              </div>

              <button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">Save Profiles Changes</button>
            </div>
          </div>
        )}

        {/* GitHub Connection */}
        {activeTab === 'github' && (
          <div className="space-y-6">
            <div className="card-main max-w-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white border-b border-slate-200 dark:border-slate-850 pb-3">GitHub Connection Status</h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-900 text-white p-2.5 dark:bg-slate-950">
                    <GithubIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-950 dark:text-white">GitHub OAuth Auth Scope</h4>
                    {isConnected && user ? (
                      <span className="text-[10px] text-emerald-500 font-bold block mt-0.5">Connected as @{user.username}</span>
                    ) : (
                      <span className="text-[10px] text-slate-450 block mt-0.5">Not connected to GitHub</span>
                    )}
                  </div>
                </div>

                <div>
                  {isConnected ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleConnectGithub}
                        className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                      >
                        Reconnect
                      </button>
                      <button
                        onClick={handleDisconnectGithub}
                        className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectGithub}
                      disabled={githubLoading}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white flex items-center gap-1"
                    >
                      {githubLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      Connect GitHub Account
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Repositories access selector tabs */}
            {isConnected && (
              <div className="card-main max-w-3xl space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">Repository Access Permissions</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Choose which repositories FlowForge can access and monitor.</p>
                </div>

                {/* Sub-tabs for repos filter */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                  <button
                    onClick={() => setRepoTab('all')}
                    className={`px-3.5 py-2 border-b-2 ${repoTab === 'all' ? 'border-primary text-primary dark:text-primary-hover' : 'border-transparent text-slate-400'}`}
                  >
                    All Repositories
                  </button>
                  <button
                    onClick={() => setRepoTab('my')}
                    className={`px-3.5 py-2 border-b-2 ${repoTab === 'my' ? 'border-primary text-primary dark:text-primary-hover' : 'border-transparent text-slate-400'}`}
                  >
                    My Repositories
                  </button>
                  <button
                    onClick={() => setRepoTab('org')}
                    className={`px-3.5 py-2 border-b-2 ${repoTab === 'org' ? 'border-primary text-primary dark:text-primary-hover' : 'border-transparent text-slate-400'}`}
                  >
                    Organization Repositories
                  </button>
                </div>

                <div className="divide-y divide-slate-150 dark:divide-slate-850">
                  {filteredGithubRepos.map((repo, idx) => (
                    <div key={idx} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-950 dark:text-white truncate">{repo.name}</h4>
                          <span className="rounded border border-slate-200 px-1 py-0.2 text-[8px] font-bold text-slate-400 dark:border-slate-800">
                            {repo.isPrivate ? 'Private' : 'Public'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{repo.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="text-[10px] text-slate-400">{repo.language}</span>
                        {repo.added ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                            <Check className="h-3.5 w-3.5" /> Added
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddRepo(repo.owner, repo.name)}
                            className="rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary dark:bg-primary/20 px-3 py-1.5 text-[11px] font-bold transition-all"
                          >
                            Add to FlowForge
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Appearance Settings */}
        {activeTab === 'appearance' && (
          <div className="card-main max-w-xl space-y-6">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white border-b border-slate-200 dark:border-slate-850 pb-3">Appearance Settings</h3>
            
            {/* Theme switcher */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Application Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {(['light', 'dark', 'system'] as Theme[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`rounded-xl border p-4 text-xs font-bold text-center capitalize transition-all ${
                      theme === t
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-550 dark:text-slate-400'
                    }`}
                  >
                    {t} Mode
                  </button>
                ))}
              </div>
            </div>

            {/* Accent selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Color Accent</label>
              <div className="grid grid-cols-4 gap-3">
                {(['blue', 'violet', 'green', 'orange'] as Accent[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-bold capitalize transition-all ${
                      accent === c
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-550 dark:text-slate-400'
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full shrink-0 ${
                      c === 'blue' ? 'bg-blue-600' : c === 'violet' ? 'bg-violet-600' : c === 'green' ? 'bg-emerald-600' : 'bg-orange-600'
                    }`} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Checkbox preferences */}
        {activeTab === 'notifications' && (
          <div className="card-main max-w-xl space-y-6">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white border-b border-slate-200 dark:border-slate-850 pb-3">Notification Preferences</h3>
            
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white">Workflow Failure Alerts</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Receive warnings when build test jobs fail on main branch.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.failures}
                  onChange={e => setNotifPreferences({ ...notifPreferences, failures: e.target.checked })}
                  className="h-4.5 w-4.5 rounded border-slate-200 text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-start justify-between border-t border-slate-100 dark:border-slate-800/40 pt-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white">Teammate Mentions</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Alert me when someone tags my username in failure comments.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.mentions}
                  onChange={e => setNotifPreferences({ ...notifPreferences, mentions: e.target.checked })}
                  className="h-4.5 w-4.5 rounded border-slate-200 text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-start justify-between border-t border-slate-100 dark:border-slate-800/40 pt-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white">Discussion Activity</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Get notified when new replies are added to threads I participate in.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.discussions}
                  onChange={e => setNotifPreferences({ ...notifPreferences, discussions: e.target.checked })}
                  className="h-4.5 w-4.5 rounded border-slate-200 text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-start justify-between border-t border-slate-100 dark:border-slate-800/40 pt-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white">Issue Assignment</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Alert me when teammates assign me to resolve a thread.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.assignments}
                  onChange={e => setNotifPreferences({ ...notifPreferences, assignments: e.target.checked })}
                  className="h-4.5 w-4.5 rounded border-slate-200 text-primary focus:ring-primary"
                />
              </div>
            </div>

            <button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">Save Notifications Settings</button>
          </div>
        )}

      </div>

    </div>
  );
};
