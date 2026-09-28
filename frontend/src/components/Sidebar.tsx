import React, { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Activity, Settings, X, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  onOpenCommandPalette: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCommandPalette }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, selectedRepoNames, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Activity Log', path: '/activity', icon: Activity },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0E121D] text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
        <span className="text-base font-black tracking-wider text-slate-900 dark:text-white font-heading">
          FlowForge <span className="text-purple-600 dark:text-purple-400">AI</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{link.name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
