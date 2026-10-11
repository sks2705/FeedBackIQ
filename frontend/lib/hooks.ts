'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './apiFetch';
import { AnalyticsSummary, Feedback, FeedbackListParams, ListMeta } from './types';

export function useSummary(days: number = 30) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AnalyticsSummary>(`/api/analytics/summary?days=${days}`);
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, loading, error, refetch: fetchSummary };
}

export function useFeedbackList(params: FeedbackListParams) {
  const [data, setData] = useState<Feedback[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ page: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const queryParamsStr = JSON.stringify(params);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.set(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      const endpoint = `/api/feedback${queryString ? `?${queryString}` : ''}`;
      const res = await apiFetch<Feedback[]>(endpoint);
      setData(res.data);
      if (res.meta) {
        setMeta({
          page: Number(res.meta.page) || 1,
          pageSize: Number(res.meta.pageSize) || 20,
          total: Number(res.meta.total) || 0,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback list');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParamsStr]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { data, meta, loading, error, refetch: fetchList };
}

export function useFeedbackItem(id: string) {
  const [data, setData] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Feedback>(`/api/feedback/${id}`);
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback item');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  return { data, loading, error, refetch: fetchItem, setData };
}
