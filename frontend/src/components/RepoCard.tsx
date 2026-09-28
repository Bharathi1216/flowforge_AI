import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitCommit, Lock, Globe, ArrowUpRight, Users, Code } from 'lucide-react';
import { Repository } from '../types';
import { StatusBadge } from './StatusBadge';

interface RepoCardProps {
  repo: Repository;
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      onClick={() => navigate(`/repositories/${repo.name}`)}
      className="group relative cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm hover:border-purple-500/50 dark:hover:border-purple-500/50 hover:shadow-md transition-all flex flex-col justify-between"
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate font-heading">
                {repo.name}
              </h3>
              {repo.isPrivate ? (
                <span className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 font-mono">
                  <Lock className="h-2.5 w-2.5 text-slate-400" /> Private
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 font-mono">
                  <Globe className="h-2.5 w-2.5" /> Public
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate font-mono">
              @{repo.owner}
            </p>
          </div>

          <StatusBadge status={repo.lastWorkflowStatus} />
        </div>

        {/* Repository Description */}
        <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {repo.description || 'No description provided on GitHub.'}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
              <Code className="h-3 w-3" />
              {repo.language || 'Code'}
            </span>
            <span>Updated {repo.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Footer: Details + Open Workspace */}
      <div className="mt-5 pt-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 font-mono">
          <span>{repo.openDiscussionsCount} {repo.openDiscussionsCount === 1 ? 'issue' : 'issues'}</span>
        </div>

        <div className="flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform">
          <span>Open Workspace</span>
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
};
