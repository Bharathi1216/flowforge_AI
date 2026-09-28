import React from 'react';
import { Collaborator } from '../types';

interface ContributorCardProps {
  collaborator: Collaborator;
}

export const ContributorCard: React.FC<ContributorCardProps> = ({ collaborator }) => {
  const isOwner = collaborator.role === 'owner';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm hover:border-purple-500/50 transition-all flex flex-col justify-between">
      <div>
        {/* User Info Header */}
        <div className="flex items-center gap-3">
          <img
            src={collaborator.avatarUrl}
            alt={collaborator.name}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-purple-500/30"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{collaborator.name}</h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate font-mono">@{collaborator.username}</span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border font-mono ${
              isOwner
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                : 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
            }`}
          >
            {isOwner ? 'Owner' : 'Developer'}
          </span>
        </div>

        {/* Access information comes from GitHub's collaborators endpoint. */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium font-mono">Push</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">{collaborator.permissions?.push ? 'Allowed' : 'No'}</span>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium font-mono">Admin</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">{collaborator.permissions?.admin ? 'Allowed' : 'No'}</span>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium font-mono">Source</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">GitHub</span>
          </div>
        </div>
      </div>
    </div>
  );
};
