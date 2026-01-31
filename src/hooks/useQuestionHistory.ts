/**
 * useQuestionHistory Hook - 질문 이력 관리
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { QuestionSession } from '@/types/database';

export interface UseHistoryFilters {
  category?: string;
  isCorrect?: boolean;
  limit?: number;
}

export interface UseHistoryReturn {
  sessions: QuestionSession[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  updateSessionFeedback: (sessionId: string, isCorrect: boolean) => void;
}

export function useQuestionHistory(filters: UseHistoryFilters = {}): UseHistoryReturn {
  const [sessions, setSessions] = useState<QuestionSession[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const limit = filters.limit || 20;

  const buildQueryString = useCallback(
    (currentOffset: number) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(currentOffset));
      if (filters.category) params.set('category', filters.category);
      if (filters.isCorrect !== undefined) params.set('isCorrect', String(filters.isCorrect));
      return params.toString();
    },
    [filters.category, filters.isCorrect, limit]
  );

  const fetchHistory = useCallback(
    async (reset = false) => {
      setIsLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;

      try {
        const response = await fetch(`/api/history?${buildQueryString(currentOffset)}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || '이력을 불러올 수 없습니다.');
        }

        if (reset) {
          setSessions(result.data.sessions);
        } else {
          setSessions((prev) => [...prev, ...result.data.sessions]);
        }
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);
        setOffset(currentOffset + result.data.sessions.length);
      } catch (err) {
        console.error('[useQuestionHistory] 이력 조회 실패:', {
          error: err instanceof Error ? err.message : err,
          stack: err instanceof Error ? err.stack : undefined,
          offset: currentOffset,
          filters: { category: filters.category, isCorrect: filters.isCorrect },
          timestamp: new Date().toISOString(),
        });
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsLoading(false);
      }
    },
    [buildQueryString, offset]
  );

  useEffect(() => {
    fetchHistory(true);
  }, [filters.category, filters.isCorrect]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchHistory(false);
  }, [fetchHistory, hasMore, isLoading]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchHistory(true);
  }, [fetchHistory]);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다.');
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setTotal((prev) => prev - 1);
      return true;
    } catch (err) {
      console.error('[useQuestionHistory] 세션 삭제 실패:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        sessionId,
        timestamp: new Date().toISOString(),
      });
      setError(err instanceof Error ? err.message : '삭제 오류');
      return false;
    }
  }, []);

  const updateSessionFeedback = useCallback((sessionId: string, isCorrect: boolean) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, user_marked_correct: isCorrect }
          : session
      )
    );
  }, []);

  return {
    sessions,
    total,
    hasMore,
    isLoading,
    error,
    loadMore,
    refresh,
    deleteSession,
    updateSessionFeedback,
  };
}
