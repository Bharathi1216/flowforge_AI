import React from 'react';
import { GitBranch, Terminal, MessageSquare, CheckCircle, UserPlus, BrainCircuit, ShieldCheck } from 'lucide-react';

const mockActivities = [
  {
    id: 1,
    type: 'failure',
    icon: Terminal,
    color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/20',
    title: 'Workflow Run #184 Failed',
    details: 'Build and Test job aborted on FlowForge-AI/main due to peer installation conflicts.',
    time: '2 mins ago',
    user: 'bharathi1216'
  },
  {
    id: 2,
    type: 'ai',
    icon: BrainCircuit,
    color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/20',
    title: 'AI Diagnostic Analysis Completed',
    details: 'Generated ERESOLVE peer conflict fix details for run #184.',
    time: '2 mins ago',
    user: 'FlowForge Bot'
  },
  {
    id: 3,
    type: 'comment',
    icon: MessageSquare,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
    title: 'New Discussion Reply Added',
    details: 'Sarah Connor commented in thread "Dependency installation failing on main with React 19 peer conflict".',
    time: '10 mins ago',
    user: 'sarah-codes'
  },
  {
    id: 4,
    type: 'push',
    icon: GitBranch,
    color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/30',
    title: 'Code Pushed to main',
    details: 'Bharathi pushed commit e7f2b1a: feat: add RAG search and visualizer component.',
    time: '20 mins ago',
    user: 'bharathi1216'
  },
  {
    id: 5,
    type: 'resolution',
    icon: CheckCircle,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
    title: 'Discussion Thread Resolved',
    details: 'Alex Rivera marked "Fix lint warnings in logs-viewer utility" as resolved.',
    time: '2 days ago',
    user: 'alex-dev'
  },
  {
    id: 6,
    type: 'team',
    icon: UserPlus,
    color: 'text-primary bg-primary/10',
    title: 'Developer Joined Workspace',
    details: 'Sarah Connor was added as Maintainer on repository Smart-Disaster-Twin.',
    time: '3 days ago',
    user: 'john-lead'
  },
  {
    id: 7,
    type: 'connect',
    icon: ShieldCheck,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
    title: 'Repository Connected',
    details: 'Repository German-Bharatham was authorized and synced into FlowForge workspace.',
    time: '5 days ago',
    user: 'bharathi1216'
  }
];

export const Activity: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">Activity Log</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Timeline of developer operations, triggers, and diagnostics across your organization.</p>
      </div>

      {/* Activity Timeline */}
      <div className="card-main relative">
        {/* Central connecting line */}
        <div className="absolute left-[38px] top-6 bottom-6 w-[2px] bg-slate-200 dark:bg-slate-800" />

        <div className="space-y-7 relative">
          {mockActivities.map(activity => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex gap-4 items-start animate-fade-in group">
                {/* Event circle icon */}
                <div className={`rounded-full p-2.5 shrink-0 z-10 transition-transform group-hover:scale-110 ${activity.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                
                {/* Event text details */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-950 dark:text-white">{activity.title}</h3>
                    <span className="text-[10px] text-slate-400">{activity.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed dark:text-slate-400">{activity.details}</p>
                  <span className="text-[9px] font-semibold text-slate-400 block mt-1.5">Triggered by @{activity.user}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
