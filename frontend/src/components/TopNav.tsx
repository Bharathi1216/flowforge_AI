import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, Moon, Sun, Search, FolderGit2, LogIn } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface TopNavProps {
  onOpenSearch?: () => void;
  onOpenConnectModal?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onOpenSearch, onOpenConnectModal }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#080A10]/95 backdrop-blur-xl px-4 sm:px-8 py-3 transition-colors duration-200">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Brand Logo & Wordmark */}
        <div 
          onClick={() => navigate('/dashboard')} 
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="h-9 w-9 rounded-xl bg-purple-600 p-0.5 flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <FolderGit2 className="h-4 w-4 text-purple-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5 font-heading">
              FlowForge
              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-600 text-white tracking-widest">
                AI
              </span>
            </span>
          </div>
        </div>

        {/* Center: Global Search shortcut */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 hover:border-purple-500/50 text-slate-600 dark:text-slate-400 text-xs transition-all w-72 justify-between"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-slate-600 dark:text-slate-400">Search repos, workflows, logs...</span>
            </span>
            <kbd className="text-[10px] bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700 shadow-sm">⌘K</kbd>
          </button>
        )}

        {/* Right: Quick actions, Theme toggle, Avatar + Name, Settings */}
        <div className="flex items-center gap-2.5">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-purple-400" /> : <Moon className="h-4 w-4 text-purple-600" />}
          </button>

          {/* User Profile or Connect Button */}
          {isAuthenticated && user ? (
            <div 
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2.5 pl-2 py-1 pr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors border border-slate-200 dark:border-slate-800"
              title="View Account & Settings"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-purple-500/40"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[100px]">
                  {user.name || user.username}
                </span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                  @{user.username}
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <GithubIcon className="h-3.5 w-3.5 fill-white" />
              <span>Connect GitHub</span>
            </button>
          )}

          {/* Settings Icon */}
          <button
            onClick={() => navigate('/settings')}
            className={`p-2 rounded-xl transition-colors border ${
              location.pathname.startsWith('/settings')
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
            title="Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
