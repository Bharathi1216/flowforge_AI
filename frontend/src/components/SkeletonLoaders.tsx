import React from 'react';

export const RepositoryCardSkeleton: React.FC = () => {
  return (
    <div className="card-main animate-pulse space-y-4">
      <div className="flex items-start justify-between">
        <div className="h-5 w-2/5 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
};

export const WorkflowTableSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="flex items-center justify-between border-b border-slate-200 py-3 dark:border-slate-800">
        <div className="h-4 w-1/4 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800/40">
          <div className="space-y-1.5 w-1/4">
            <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-3.5 w-12 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-7 w-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
};

export const AISkeletonLoader: React.FC = () => {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/5 p-6 animate-pulse space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-1/4 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-10 w-full rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );
};

export const DiscussionSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2].map(i => (
        <div key={i} className="card-main space-y-3">
          <div className="h-4 w-3/5 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
};
