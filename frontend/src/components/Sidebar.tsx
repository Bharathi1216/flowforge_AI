import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, useParams } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Activity, Bell, Settings, LogOut, ChevronDown, Shield, Menu, X, Plus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { mockRepositories, mockCurrentUser, mockNotifications } from '../mock/data';

interface SidebarProps {
  onOpenCommandPalette: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCommandPalette }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { repoId } = useParams();
  const { theme } = useTheme();
  
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeRepo = mockRepositories.find(r => 
    r.name.toLowerCase() === repoId?.toLowerCase() || 
    (repoId && r.id === repoId)
  ) || mockRepositories[0];

  const unreadNotificationsCount = mockNotifications.filter(n => !n.isRead).length;

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Repositories', path: '/repositories', icon: FolderKanban },
    { name: 'Activity Log', path: '/activity', icon: Activity },
    { name: 'Notifications', path: '/notifications', icon: Bell, badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleRepoSelect = (repoName: string) => {
    setRepoDropdownOpen(false);
    navigate(`/repositories/${repoName}/overview`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-500';
      case 'failed': return 'bg-rose-500';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300 dark:bg-slate-950 border-r border-slate-800/80">
      {/* Brand Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800/50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/src/assets/logo.svg" className="h-7 w-7" alt="FlowForge AI" />
          <span className="text-base font-extrabold tracking-wider text-white font-sans uppercase">FlowForge <span className="text-primary-hover">AI</span></span>
        </div>
        <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Workspace Repository Switcher */}
      <div className="px-4 py-4 relative">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2">Current Workspace</span>
        <button
          onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
          className="mt-1.5 flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-950/80 text-white transition-colors"
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor(activeRepo.lastWorkflowStatus)} shrink-0`} />
            <span className="truncate">{activeRepo.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
        </button>

        {repoDropdownOpen && (
          <div className="absolute left-4 right-4 z-40 mt-1 rounded-lg border border-slate-800 bg-slate-900 p-1.5 shadow-xl">
            <div className="max-h-[180px] overflow-y-auto scrollbar-terminal space-y-0.5">
              {mockRepositories.map(repo => (
                <button
                  key={repo.id}
                  onClick={() => handleRepoSelect(repo.name)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                    repo.id === activeRepo.id 
                      ? 'bg-slate-800 text-white' 
                      : 'hover:bg-slate-800/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`h-2 w-2 rounded-full ${getStatusColor(repo.lastWorkflowStatus)} shrink-0`} />
                    <span className="truncate font-medium">{repo.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">{repo.language}</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 border-t border-slate-800 pt-1.5">
              <button
                onClick={() => {
                  setRepoDropdownOpen(false);
                  navigate('/settings/github');
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Connect Repositories
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1.5 px-3 py-2 overflow-y-auto scrollbar-terminal">
        {navLinks.map(link => {
          const Icon = link.icon;
          const isActive = location.pathname.startsWith(link.path);
          return (
            <NavLink
              key={link.name}
              to={link.path}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold tracking-wide transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary dark:text-primary-hover border-l-4 border-primary pl-2'
                  : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <span>{link.name}</span>
              </div>
              {link.badge && (
                <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {link.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Cmd+K visual cue */}
        <div className="px-3 pt-4">
          <button
            onClick={onOpenCommandPalette}
            className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-left text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
          >
            <span>Search workspaces...</span>
            <kbd className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">Ctrl+K</kbd>
          </button>
        </div>
      </nav>

      {/* Bottom User profile card */}
      <div className="border-t border-slate-800/50 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-950/20 p-2.5 border border-slate-800/20">
          <img
            src={mockCurrentUser.avatarUrl}
            alt={mockCurrentUser.name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate leading-tight">{mockCurrentUser.name}</h4>
            <span className="text-[10px] text-slate-500 truncate block mt-0.5">@{mockCurrentUser.username}</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Bar */}
      <div className="flex h-14 items-center justify-between px-6 bg-slate-900 text-white md:hidden border-b border-slate-800">
        <div className="flex items-center gap-2">
          <img src="/src/assets/logo.svg" className="h-6 w-6" alt="FlowForge" />
          <span className="text-xs font-bold uppercase tracking-wider">FlowForge AI</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Slide-over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 flex-1 flex-col bg-slate-900 animate-slide-up">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        <SidebarContent />
      </div>
    </>
  );
};
