import React from 'react';
import { AnalysisStatus, Category, Priority, Sentiment, Status } from '@/lib/types';

export function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  if (!sentiment) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        Unanalyzed
      </span>
    );
  }

  const styles = {
    POSITIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    NEGATIVE: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    NEUTRAL: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  };

  const labels = {
    POSITIVE: 'Positive',
    NEGATIVE: 'Negative',
    NEUTRAL: 'Neutral',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[sentiment]}`}>
      {labels[sentiment]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        N/A
      </span>
    );
  }

  const styles = {
    LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold',
  };

  const labels = {
    LOW: 'Low Priority',
    MEDIUM: 'Medium Priority',
    HIGH: 'High Priority',
    CRITICAL: 'Critical Priority',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[priority]}`}>
      {labels[priority]}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const styles = {
    NEW: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    REVIEWING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  const labels = {
    NEW: 'New',
    REVIEWING: 'Reviewing',
    RESOLVED: 'Resolved',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Category | null }) {
  if (!category) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700">
        Unassigned
      </span>
    );
  }

  const labels: Record<Category, string> = {
    UI_UX: 'UI/UX',
    PERFORMANCE: 'Performance',
    BUG: 'Bug',
    FEATURE_REQUEST: 'Feature Request',
    SECURITY: 'Security',
    OTHER: 'Other',
  };

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
      {labels[category]}
    </span>
  );
}

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  const styles = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    FAILED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const labels = {
    PENDING: 'Pending Analysis',
    COMPLETED: 'Analysis Complete',
    FAILED: 'Analysis Failed',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function SeedBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/40 text-purple-300 border border-purple-500/30 uppercase tracking-wider" title="Pre-loaded demo seed dataset">
      Seed
    </span>
  );
}
