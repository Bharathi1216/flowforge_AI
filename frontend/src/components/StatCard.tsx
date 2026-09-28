import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  color?: 'purple' | 'rose' | 'amber' | 'blue' | 'emerald';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  color = 'purple'
}) => {
  const getColorStyles = () => {
    switch (color) {
      case 'emerald':
        return {
          border: 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50',
          iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
          valueColor: 'text-slate-900 dark:text-white'
        };
      case 'rose':
        return {
          border: 'border-slate-200 dark:border-slate-800 hover:border-rose-500/50',
          iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
          valueColor: 'text-rose-600 dark:text-rose-400'
        };
      case 'blue':
        return {
          border: 'border-slate-200 dark:border-slate-800 hover:border-sky-500/50',
          iconBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
          valueColor: 'text-slate-900 dark:text-white'
        };
      case 'amber':
        return {
          border: 'border-slate-200 dark:border-slate-800 hover:border-amber-500/50',
          iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
          valueColor: 'text-slate-900 dark:text-white'
        };
      default:
        return {
          border: 'border-slate-200 dark:border-slate-800 hover:border-purple-500/50',
          iconBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
          valueColor: 'text-slate-900 dark:text-white'
        };
    }
  };

  const style = getColorStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-white dark:bg-[#0E121D] p-5 shadow-sm transition-all duration-200 ${style.border} hover:-translate-y-0.5`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">{title}</span>
        <div className={`rounded-xl p-2.5 ${style.iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3">
        <span className={`text-3xl font-black tracking-tight font-heading ${style.valueColor}`}>{value}</span>
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-sans">{subtitle}</p>}
    </motion.div>
  );
};
