'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useFeedbackItem } from '@/lib/hooks';
import { apiFetch } from '@/lib/apiFetch';
import { AnalysisStatusBadge, CategoryBadge, PriorityBadge, SeedBadge, SentimentBadge } from '@/components/dashboard/Badges';
import { ErrorState } from '@/components/dashboard/States';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Alert } from '@/components/Alert';
import { Spinner } from '@/components/Spinner';
import { Feedback, Status } from '@/lib/types';

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

interface UserSession {
  id: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

function FeedbackDetailContent({ params }: DetailPageProps) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { data: feedback, loading, error, refetch, setData } = useFeedbackItem(id);

  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.data) {
          setCurrentUser(body.data);
        }
      })
      .catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'ADMIN';

  const handleStatusChange = async (newStatus: Status) => {
    if (!feedback || feedback.status === newStatus || !isAdmin) return;

    const previousStatus = feedback.status;

    // Optimistic Update
    setData({ ...feedback, status: newStatus });
    setIsUpdatingStatus(true);
    setToast(null);

    try {
      const res = await apiFetch<Feedback>(`/api/feedback/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setData(res.data);
      setToast({ type: 'success', message: `Status updated to ${newStatus}` });
    } catch (err: unknown) {
      // Rollback on Error
      setData({ ...feedback, status: previousStatus });
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      setToast({ type: 'error', message: `Rollback: ${msg}` });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReanalyze = async () => {
    if (!feedback || !isAdmin) return;
    setIsReanalyzing(true);
    setToast(null);

    try {
      const res = await apiFetch<Feedback>(`/api/feedback/${id}/reanalyze`, {
        method: 'POST',
      });
      setData(res.data);
      if (res.data.analysisStatus === 'FAILED') {
        setToast({
          type: 'error',
          message: `Reanalysis completed but failed: ${res.data.analysisError || 'Unknown AI error'}`,
        });
      } else {
        setToast({ type: 'success', message: 'Reanalysis completed successfully!' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reanalysis request failed';
      setToast({ type: 'error', message: msg });
    } finally {
      setIsReanalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-mono">Loading feedback details...</p>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="space-y-6">
        <Link href="/admin/feedback" className="text-xs text-indigo-400 hover:underline">
          ← Back to Feedback List
        </Link>
        <ErrorState message={error || 'Feedback not found'} onRetry={refetch} />
      </div>
    );
  }

  const confidencePercent = feedback.confidence !== null && feedback.confidence !== undefined
    ? Math.round(feedback.confidence * 100)
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/feedback"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 mb-2"
          >
            ← Back to Feedback List
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Feedback Record Detail</h1>
            {feedback.isSeed && <SeedBadge />}
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">ID: {feedback.id}</p>
        </div>

        {/* Status Dropdown Controls with VIEWER disabled tooltip */}
        <div
          className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl relative group"
          title={!isAdmin ? 'Admin permission required to change status' : undefined}
        >
          <label htmlFor="status-select" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Status:
          </label>
          <Select
            id="status-select"
            value={feedback.status}
            disabled={isUpdatingStatus || !isAdmin}
            onChange={(e) => handleStatusChange(e.target.value as Status)}
            className="py-1 px-3 text-xs font-semibold w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="NEW">New</option>
            <option value="REVIEWING">Reviewing</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
          {!isAdmin && (
            <span className="hidden group-hover:block absolute -bottom-8 right-0 bg-slate-800 text-slate-200 text-[10px] px-2 py-1 rounded shadow border border-slate-700 whitespace-nowrap z-10">
              Only Admin can change status
            </span>
          )}
        </div>
      </div>

      {/* Toast Notification Alert */}
      {toast && (
        <Alert variant={toast.type}>
          {toast.message}
        </Alert>
      )}

      {/* Main Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Submitter & Message Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submitter Info Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-2">
              Submission Metadata
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block uppercase font-mono tracking-wider">Product Name</span>
                <span className="text-slate-200 font-medium text-sm">{feedback.productName}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono tracking-wider">Source</span>
                <span className="text-slate-200 font-medium">{feedback.source || 'web'}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono tracking-wider">Submitter Name</span>
                <span className="text-slate-200 font-medium">{feedback.userName || 'Anonymous'}</span>
              </div>
              {/* Only show email if present */}
              {feedback.userEmail && (
                <div>
                  <span className="text-slate-500 block uppercase font-mono tracking-wider">Email Address</span>
                  <a href={`mailto:${feedback.userEmail}`} className="text-indigo-400 hover:underline font-medium">
                    {feedback.userEmail}
                  </a>
                </div>
              )}
              <div>
                <span className="text-slate-500 block uppercase font-mono tracking-wider">Submitted At</span>
                <span className="text-slate-300 font-mono">
                  {new Date(feedback.createdAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono tracking-wider">Seed Record</span>
                <span className="text-slate-400 font-mono flex items-center gap-1.5">
                  {feedback.isSeed ? (
                    <>
                      <span>Yes</span>
                      <SeedBadge />
                    </>
                  ) : (
                    <span>No</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Original Message Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-sm space-y-3">
            <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-2">
              Original Feedback Message
            </h2>
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {feedback.message}
            </div>
          </div>

          {/* Attached Screenshot Card */}
          {feedback.attachment && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-sm space-y-3">
              <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Attached Screenshot</span>
                <span className="text-xs font-mono text-slate-400 font-normal">
                  {feedback.attachment.originalName} ({(feedback.attachment.sizeBytes / 1024).toFixed(1)} KB)
                </span>
              </h2>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={feedback.attachment.url}
                  alt={feedback.attachment.originalName}
                  className="max-h-96 rounded-lg object-contain shadow-md border border-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Analysis Panel */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                AI Intelligence Panel
              </h2>
              <AnalysisStatusBadge status={feedback.analysisStatus} />
            </div>

            {/* Error view if Analysis FAILED */}
            {feedback.analysisStatus === 'FAILED' && (
              <div className="p-3 bg-rose-950/30 border border-rose-500/20 rounded-lg space-y-2 text-xs">
                <p className="font-semibold text-rose-300">Analysis Error:</p>
                <p className="text-rose-400 font-mono leading-tight">{feedback.analysisError || 'Unknown processing error'}</p>
              </div>
            )}

            {/* Labels & Categorization */}
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Sentiment Classification</span>
                <div className="flex items-center justify-between">
                  <SentimentBadge sentiment={feedback.sentiment} />
                  {confidencePercent !== null && (
                    <span className="font-mono text-slate-400">{confidencePercent}% confidence</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Category</span>
                <CategoryBadge category={feedback.category} />
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Priority Rating</span>
                <PriorityBadge priority={feedback.priority} />
              </div>

              {feedback.summary && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block mb-1 font-semibold font-mono">AI Executive Summary</span>
                  <p className="p-2.5 bg-slate-950/40 rounded border border-slate-800 text-slate-300 italic leading-snug">
                    &ldquo;{feedback.summary}&rdquo;
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px] text-slate-500 font-mono">
                {feedback.modelVersion && <div>Model: {feedback.modelVersion}</div>}
                {feedback.analyzedAt && <div>Analyzed: {new Date(feedback.analyzedAt).toLocaleString()}</div>}
              </div>
            </div>

            {/* Clear Disclaimer Note */}
            <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg text-[11px] text-indigo-300 leading-normal">
              💡 <strong>Note:</strong> AI labels are recommendations intended to assist review. Admins can update status or reanalyze at any time.
            </div>

            {/* Reanalyze Action Button with VIEWER check */}
            <div className="pt-2 relative group" title={!isAdmin ? 'Admin permission required to reanalyze feedback' : undefined}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!isAdmin}
                isLoading={isReanalyzing}
                onClick={handleReanalyze}
                className="w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReanalyzing ? 'Running AI Pipeline...' : 'Reanalyze Feedback'}
              </Button>
              {!isAdmin && (
                <span className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-200 text-[10px] px-2 py-1 rounded shadow border border-slate-700 whitespace-nowrap z-10">
                  Only Admin can reanalyze feedback
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackDetailPage({ params }: DetailPageProps) {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-mono">Loading feedback details...</p>
      </div>
    }>
      <FeedbackDetailContent params={params} />
    </Suspense>
  );
}
