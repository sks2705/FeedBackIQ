import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  variant?: 'default' | 'positive' | 'negative' | 'warning' | 'info';
  icon?: React.ReactNode;
}

export function StatCard({ title, value, description, variant = 'default', icon }: StatCardProps) {
  const variantStyles = {
    default: 'border-slate-800 bg-slate-900/60 text-slate-100',
    positive: 'border-emerald-500/20 bg-emerald-950/20 text-emerald-100',
    negative: 'border-rose-500/20 bg-rose-950/20 text-rose-100',
    warning: 'border-amber-500/20 bg-amber-950/20 text-amber-100',
    info: 'border-indigo-500/20 bg-indigo-950/20 text-indigo-100',
  };

  return (
    <div className={`p-5 rounded-xl border backdrop-blur-sm transition-all duration-200 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
      </div>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}
