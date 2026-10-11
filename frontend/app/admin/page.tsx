'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { useFeedbackList, useSummary } from '@/lib/hooks';
import { StatCard } from '@/components/dashboard/StatCard';
import { CategoryBadge, PriorityBadge, SentimentBadge, StatusBadge } from '@/components/dashboard/Badges';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/dashboard/States';
import { Select } from '@/components/Select';

const SENTIMENT_COLORS = {
  POSITIVE: '#10b981', // emerald-500
  NEGATIVE: '#f43f5e', // rose-500
  NEUTRAL: '#64748b',  // slate-500
  UNANALYZED: '#334155' // slate-700
};

export default function AdminOverviewPage() {
  const [days, setDays] = useState<number>(30);
  const { data: summary, loading: summaryLoading, error: summaryError, refetch: refetchSummary } = useSummary(days);
  const { data: recentList, loading: listLoading, error: listError, refetch: refetchList } = useFeedbackList({
    page: 1,
    pageSize: 8,
    sort: 'createdAt:desc',
  });

  const isLoading = summaryLoading || listLoading;
  const error = summaryError || listError;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Analytics Overview</h1>
        <ErrorState message={error} onRetry={() => { refetchSummary(); refetchList(); }} />
      </div>
    );
  }

  const sentimentPieData = summary
    ? [
        { name: 'Positive', value: summary.sentiment.positive, color: SENTIMENT_COLORS.POSITIVE },
        { name: 'Negative', value: summary.sentiment.negative, color: SENTIMENT_COLORS.NEGATIVE },
        { name: 'Neutral', value: summary.sentiment.neutral, color: SENTIMENT_COLORS.NEUTRAL },
        ...(summary.sentiment.unanalyzed > 0
          ? [{ name: 'Unanalyzed', value: summary.sentiment.unanalyzed, color: SENTIMENT_COLORS.UNANALYZED }]
          : []),
      ]
    : [];

  const categoryBarData = summary
    ? summary.categoryDistribution.map((item) => ({
        name: item.category.replace('_', ' '),
        count: item.count,
      }))
    : [];

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Analytics Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time metrics and intelligence across customer feedback.</p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="timeframe" className="text-xs font-medium text-slate-400">Timeframe:</label>
          <Select
            id="timeframe"
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-auto py-1.5 px-3 text-xs font-medium"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </Select>
        </div>
      </div>

      {/* Analysis Notes / Banners if pending or failed exist */}
      {summary && (summary.pendingAnalysisCount > 0 || summary.failedAnalysisCount > 0) && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
          {summary.pendingAnalysisCount > 0 && (
            <div className="flex items-center gap-2 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span><strong>{summary.pendingAnalysisCount}</strong> feedback item(s) pending AI analysis</span>
            </div>
          )}
          {summary.failedAnalysisCount > 0 && (
            <div className="flex items-center gap-2 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span><strong>{summary.failedAnalysisCount}</strong> item(s) failed analysis (requires attention)</span>
            </div>
          )}
        </div>
      )}

      {/* Key Metrics Stat Cards */}
      {summaryLoading || !summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Feedback" value={summary.total} description={`In past ${days} days`} variant="default" />
          <StatCard title="Positive" value={summary.sentiment.positive} variant="positive" />
          <StatCard title="Negative" value={summary.sentiment.negative} variant="negative" />
          <StatCard title="Neutral" value={summary.sentiment.neutral} variant="default" />
          <StatCard title="High Priority" value={summary.highPriorityCount} description="High + Critical" variant="warning" />
          <StatCard title="Critical" value={summary.criticalCount} variant="negative" />
          <StatCard title="Resolved" value={summary.resolvedCount} variant="positive" />
          <StatCard title="Unresolved" value={summary.unresolvedCount} description="New + Reviewing" variant="info" />
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Feedback Volume Trend</h2>
            <span className="text-xs text-slate-400 font-mono">Daily Submissions</span>
          </div>

          {summaryLoading || !summary ? (
            <div className="h-64 bg-slate-800/30 rounded-lg animate-pulse" />
          ) : summary.trend.length === 0 || summary.total === 0 ? (
            <EmptyState title="No trend data" description="No feedback submitted in this timeframe." />
          ) : (
            <div className="space-y-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" name="Total" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table Fallback for Accessibility */}
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer hover:text-slate-200">View trend tabular data</summary>
                <div className="mt-2 max-h-40 overflow-y-auto border border-slate-800 rounded p-2">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-300">
                        <th className="py-1">Date</th>
                        <th className="py-1">Total</th>
                        <th className="py-1">Positive</th>
                        <th className="py-1">Negative</th>
                        <th className="py-1">Neutral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.trend.map((row) => (
                        <tr key={row.date} className="border-b border-slate-800/50">
                          <td className="py-1">{row.date}</td>
                          <td className="py-1">{row.count}</td>
                          <td className="py-1 text-emerald-400">{row.positive}</td>
                          <td className="py-1 text-rose-400">{row.negative}</td>
                          <td className="py-1 text-slate-400">{row.neutral}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Sentiment & Category Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
          {/* Sentiment Donut */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-semibold text-white">Sentiment Distribution</h2>
            {summaryLoading || !summary ? (
              <div className="h-48 bg-slate-800/30 rounded-lg animate-pulse" />
            ) : summary.total === 0 ? (
              <EmptyState title="No sentiment data" description="No analyzed feedback available." />
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
                <div className="h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {sentimentPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Positive: <strong>{summary.sentiment.positive}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-400">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    <span>Negative: <strong>{summary.sentiment.negative}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-3 h-3 rounded-full bg-slate-500" />
                    <span>Neutral: <strong>{summary.sentiment.neutral}</strong></span>
                  </div>
                  {summary.sentiment.unanalyzed > 0 && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="w-3 h-3 rounded-full bg-slate-700" />
                      <span>Unanalyzed: <strong>{summary.sentiment.unanalyzed}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Category Distribution Bar */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-semibold text-white">Category Distribution</h2>
            {summaryLoading || !summary ? (
              <div className="h-48 bg-slate-800/30 rounded-lg animate-pulse" />
            ) : summary.total === 0 ? (
              <EmptyState title="No category data" description="No feedback categorized yet." />
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                    <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Feedback Table (Latest 8) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent Feedback Submissions</h2>
            <p className="text-xs text-slate-400">Latest 8 customer messages needing review or action.</p>
          </div>
          <Link
            href="/admin/feedback"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            View All Feedback →
          </Link>
        </div>

        {listLoading ? (
          <TableSkeleton rows={5} />
        ) : !recentList || recentList.length === 0 ? (
          <EmptyState title="No recent feedback" description="No feedback records found in database." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Message Snippet</th>
                  <th className="py-3 px-3">Sentiment</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap text-slate-400 font-mono">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-200">
                      {item.productName}
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                      {item.message}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <SentimentBadge sentiment={item.sentiment} />
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <Link
                        href={`/admin/feedback/${item.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        View Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
