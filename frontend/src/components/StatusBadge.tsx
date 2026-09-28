import React from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { WorkflowStatus } from '../types';

interface StatusBadgeProps {
  status: WorkflowStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showIcon = true
}) => {
  const normStatus = (status || '').toLowerCase();

  const getStyle = () => {
    switch (normStatus) {
      case 'success':
      case 'passed':
      case 'completed':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
          dot: 'bg-emerald-500',
          icon: CheckCircle2,
          label: 'Passed'
        };
      case 'failed':
      case 'error':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
          dot: 'bg-rose-500',
          icon: AlertCircle,
          label: 'Failed'
        };
      case 'running':
      case 'in_progress':
        return {
          bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
          dot: 'bg-sky-500',
          icon: RefreshCw,
          spin: true,
          label: 'Running'
        };
      case 'warning':
      case 'pending':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
          dot: 'bg-amber-500',
          icon: AlertTriangle,
          label: 'Active'
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
          dot: 'bg-slate-400',
          icon: AlertCircle,
          label: normStatus === 'unknown' ? 'No workflow runs' : status
        };
    }
  };

  const config = getStyle();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-2.5 py-0.5 gap-1.5 font-bold font-mono',
    md: 'text-xs px-3 py-1 gap-2 font-bold font-mono',
    lg: 'text-sm px-4 py-1.5 gap-2.5 font-bold font-mono'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${config.bg} ${sizeClasses[size]}`}
    >
      {showIcon && (
        <Icon className={`${iconSizes[size]} ${config.spin ? 'animate-spin' : ''}`} />
      )}
      <span>{config.label}</span>
    </span>
  );
};
