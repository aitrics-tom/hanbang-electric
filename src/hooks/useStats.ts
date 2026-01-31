/**
 * useStats Hook - 학습 통계 관리
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AgentType } from '@/types';

export interface CategoryStats {
  user_id: string;
  category: AgentType;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  accuracy_rate: number;
  avg_processing_time: number;
  last_practiced: string;
}

export interface UserStats {
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  overallAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  todayCount: number;
  dailyGoal: number;
  categoryStats: CategoryStats[];
  recentActivity: {
    date: string;
    count: number;
  }[];
  weakCategories: {
    category: AgentType;
    accuracy: number;
    totalQuestions: number;
  }[];
}

export interface UseStatsReturn {
  stats: UserStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stats?type=overview');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '통계를 불러올 수 없습니다.');
      }

      setStats(result.data);
    } catch (err) {
      console.error('[useStats] 통계 조회 실패:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchStats,
  };
}
