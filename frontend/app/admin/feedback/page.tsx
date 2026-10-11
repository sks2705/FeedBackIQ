'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFeedbackList } from '@/lib/hooks';
import { AnalysisStatusBadge, CategoryBadge, PriorityBadge, SeedBadge, SentimentBadge, StatusBadge } from '@/components/dashboard/Badges';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/dashboard/States';
import { Pagination } from '@/components/dashboard/Pagination';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import { AnalysisStatus, Category, Priority, Sentiment, Status } from '@/lib/types';

function FeedbackListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read state from URL search params
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialPageSize = Number(searchParams.get('pageSize')) || 20;
  const initialSearch = searchParams.get('search') || '';
  const initialSentiment = (searchParams.get('sentiment') as Sentiment) || undefined;
  const initialCategory = (searchParams.get('category') as Category) || undefined;
  const initialPriority = (searchParams.get('priority') as Priority) || undefined;
  const initialStatus = (searchParams.get('status') as Status) || undefined;
  const initialAnalysisStatus = (searchParams.get('analysisStatus') as AnalysisStatus) || undefined;
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || '';
  const initialSort = (searchParams.get('sort') as 'createdAt:desc' | 'createdAt:asc' | 'priority:desc') || 'createdAt:desc';

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sentiment, setSentiment] = useState<Sentiment | undefined>(initialSentiment);
  const [category, setCategory] = useState<Category | undefined>(initialCategory);
  const [priority, setPriority] = useState<Priority | undefined>(initialPriority);
  const [status, setStatus] = useState<Status | undefined>(initialStatus);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | undefined>(initialAnalysisStatus);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [sort, setSort] = useState<'createdAt:desc' | 'createdAt:asc' | 'priority:desc'>(initialSort);

  // Debounce search input by 300 ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search change
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Sync state changes to URL search params
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (pageSize !== 20) params.set('pageSize', String(pageSize));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sentiment) params.set('sentiment', sentiment);
    if (category) params.set('category', category);
    if (priority) params.set('priority', priority);
    if (status) params.set('status', status);
    if (analysisStatus) params.set('analysisStatus', analysisStatus);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (sort !== 'createdAt:desc') params.set('sort', sort);

    const queryString = params.toString();
    const newUrl = `/admin/feedback${queryString ? `?${queryString}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [page, pageSize, debouncedSearch, sentiment, category, priority, status, analysisStatus, from, to, sort, router]);

  useEffect(() => {
    updateUrlParams();
  }, [updateUrlParams]);

  // Fetch feedback list based on current filters
  const queryParams = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    sentiment,
    category,
    priority,
    status,
    analysisStatus,
    from: from || undefined,
    to: to || undefined,
    sort,
  };

  const { data: feedbackList, meta, loading, error, refetch } = useFeedbackList(queryParams);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSentiment(undefined);
    setCategory(undefined);
    setPriority(undefined);
    setStatus(undefined);
    setAnalysisStatus(undefined);
    setFrom('');
    setTo('');
    setSort('createdAt:desc');
    setPage(1);
  };

  const handleExportCsv = () => {
    const searchParams = new URLSearchParams();
    if (debouncedSearch) searchParams.set('search', debouncedSearch);
    if (sentiment) searchParams.set('sentiment', sentiment);
    if (category) searchParams.set('category', category);
    if (priority) searchParams.set('priority', priority);
    if (status) searchParams.set('status', status);
    if (analysisStatus) searchParams.set('analysisStatus', analysisStatus);
    if (from) searchParams.set('from', from);
    if (to) searchParams.set('to', to);
    if (sort) searchParams.set('sort', sort);

    const exportUrl = `/api/feedback/export?${searchParams.toString()}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Feedback Management</h1>
          <p className="text-sm text-slate-400 mt-1">Search, filter, examine and update customer submissions.</p>
        </div>
        <Button variant="secondary" onClick={handleExportCsv} className="self-start sm:self-auto">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </Button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 backdrop-blur-sm space-y-4">
        {/* Search Input & Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="search-input" className="block text-xs font-medium text-slate-400 mb-1">Search Keywords</label>
            <Input
              id="search-input"
              type="text"
              placeholder="Search in message, product name, or submitter details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sort-select" className="block text-xs font-medium text-slate-400 mb-1">Sort By</label>
            <Select
              id="sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'createdAt:desc' | 'createdAt:asc' | 'priority:desc');
                setPage(1);
              }}
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="priority:desc">Highest Priority First</option>
            </Select>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label htmlFor="sentiment-filter" className="block text-xs font-medium text-slate-400 mb-1">Sentiment</label>
            <Select
              id="sentiment-filter"
              value={sentiment || ''}
              onChange={(e) => {
                setSentiment((e.target.value as Sentiment) || undefined);
                setPage(1);
              }}
              className="text-xs py-1.5"
            >
              <option value="">All Sentiments</option>
              <option value="POSITIVE">Positive</option>
              <option value="NEGATIVE">Negative</option>
              <option value="NEUTRAL">Neutral</option>
            </Select>
          </div>

          <div>
            <label htmlFor="category-filter" className="block text-xs font-medium text-slate-400 mb-1">Category</label>
            <Select
              id="category-filter"
              value={category || ''}
              onChange={(e) => {
                setCategory((e.target.value as Category) || undefined);
                setPage(1);
              }}
              className="text-xs py-1.5"
            >
              <option value="">All Categories</option>
              <option value="UI_UX">UI/UX</option>
              <option value="PERFORMANCE">Performance</option>
              <option value="BUG">Bug</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="SECURITY">Security</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>

          <div>
            <label htmlFor="priority-filter" className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
            <Select
              id="priority-filter"
              value={priority || ''}
              onChange={(e) => {
                setPriority((e.target.value as Priority) || undefined);
                setPage(1);
              }}
              className="text-xs py-1.5"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </div>

          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-slate-400 mb-1">Status</label>
            <Select
              id="status-filter"
              value={status || ''}
              onChange={(e) => {
                setStatus((e.target.value as Status) || undefined);
                setPage(1);
              }}
              className="text-xs py-1.5"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="REVIEWING">Reviewing</option>
              <option value="RESOLVED">Resolved</option>
            </Select>
          </div>

          <div>
            <label htmlFor="from-date" className="block text-xs font-medium text-slate-400 mb-1">From Date</label>
            <Input
              id="from-date"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="text-xs py-1 px-2"
            />
          </div>

          <div>
            <label htmlFor="to-date" className="block text-xs font-medium text-slate-400 mb-1">To Date</label>
            <Input
              id="to-date"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="text-xs py-1 px-2"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline focus:outline-none"
          >
            Clear All Filters & Reset
          </button>
        </div>
      </div>

      {/* Main Table / Mobile Card Grid */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl backdrop-blur-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={refetch} />
          </div>
        ) : !feedbackList || feedbackList.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No feedback matching filters"
              description="Try clearing your search query or adjusting filter parameters."
              actionLabel="Reset Filters"
              onAction={handleClearFilters}
            />
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider bg-slate-900/40">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Message</th>
                    <th className="py-3 px-4">Sentiment</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {feedbackList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          {item.isSeed && <SeedBadge />}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{item.productName}</span>
                          {item.attachment && (
                            <span title={`Attachment: ${item.attachment.originalName}`} className="text-indigo-400 text-xs">
                              📎
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                        {item.message}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <SentimentBadge sentiment={item.sentiment} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <CategoryBadge category={item.category} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <Link
                          href={`/admin/feedback/${item.id}`}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 font-medium transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-800">
              {feedbackList.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      {item.isSeed && <SeedBadge />}
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.productName}</h3>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2">{item.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <SentimentBadge sentiment={item.sentiment} />
                    <CategoryBadge category={item.category} />
                    <PriorityBadge priority={item.priority} />
                    {item.analysisStatus !== 'COMPLETED' && (
                      <AnalysisStatusBadge status={item.analysisStatus} />
                    )}
                  </div>
                  <div className="pt-1 flex justify-end">
                    <Link
                      href={`/admin/feedback/${item.id}`}
                      className="text-xs font-semibold text-indigo-400 hover:underline"
                    >
                      View Full Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-900/40">
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                total={meta.total}
                onPageChange={(newPage) => setPage(newPage)}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function FeedbackListPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <TableSkeleton rows={8} />
      </div>
    }>
      <FeedbackListContent />
    </Suspense>
  );
}
