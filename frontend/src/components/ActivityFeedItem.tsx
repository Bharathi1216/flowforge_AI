import React from 'react';
import { GitCommit, GitPullRequest, GitMerge, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ActivityEvent {
  id: string;
  type: 'push' | 'pr_opened' | 'pr_merged' | 'workflow_failed' | 'workflow_fixed';
  actor: {
    name: string;
    avatarUrl: string;
    username: string;
  };
  description: string;
  target: string;
  timestamp: string;
}

interface ActivityFeedItemProps {
  event: ActivityEvent;
}

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({ event }) => {
  const getIcon = () => {
    switch (event.type) {
      case 'push':
        return <GitCommit className="h-4 w-4 text-blue-400" />;
      case 'pr_opened':
        return <GitPullRequest className="h-4 w-4 text-violet-400" />;
      case 'pr_merged':
        return <GitMerge className="h-4 w-4 text-emerald-400" />;
      case 'workflow_failed':
        return <AlertCircle className="h-4 w-4 text-rose-400" />;
      case 'workflow_fixed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      default:
        return <GitCommit className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:bg-slate-900/80 transition-colors">
      <img
        src={event.actor.avatarUrl}
        alt={event.actor.name}
        className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-slate-700"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-200">
          <span className="font-bold text-white">{event.actor.name}</span>
          <span className="text-slate-400">{event.description}</span>
          <span className="font-mono text-primary text-[11px] truncate">{event.target}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">{getIcon()}</span>
          <span>{event.timestamp}</span>
        </div>
      </div>
    </div>
  );
};
