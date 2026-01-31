/**
 * useAnalytics Hook - AI 학습 분석 관리
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnalyticsInsight } from '@/types/database';
import { AgentType } from '@/types';

export interface StudyPattern {
  category: AgentType;
  status: 'frequent' | 'moderate' | 'rare' | 'never';
  questionCount: number;
  studyPercentage: number;
  examWeight: number;
  balanceStatus: '과다학습' | '적정' | '부족' | '미학습';
  lastStudied: string;
  recommendation: string;
}

export interface StudyBalance {
  overStudied: string[];
  underStudied: string[];
  balanced: string[];
  neverStudied: string[];
}

export interface StudyPlan {
  immediate: string[];
  thisWeek: string[];
  balanced: string[];
}

export interface Recommendation {
  type: 'start' | 'increase' | 'maintain' | 'diversify';
  category: AgentType;
  title: string;
  reason: string;
  suggestedTopics?: string[];
  priority: number;
}

export interface Achievement {
  type: 'streak' | 'coverage' | 'milestone' | 'consistency';
  title: string;
  description: string;
}

export interface LearningTrend {
  direction: 'expanding' | 'focused' | 'stagnant';
  summary: string;
  insights: string[];
}

export interface AnalyticsResult {
  studyPatterns: StudyPattern[];
  studyBalance: StudyBalance;
  recommendations: Recommendation[];
  achievements: Achievement[];
  trends: LearningTrend;
  studyPlan?: StudyPlan;
  summary: string;
  generatedAt: string;
}

export interface UseAnalyticsReturn {
  analytics: AnalyticsResult | null;
  savedInsights: AnalyticsInsight[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  generateAnalytics: () => Promise<void>;
  dismissInsight: (insightId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useAnalytics(): UseAnalyticsReturn {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [savedInsights, setSavedInsights] = useState<AnalyticsInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics?type=saved');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '인사이트를 불러올 수 없습니다.');
      }

      setSavedInsights(result.data.insights || []);
    } catch (err) {
      console.error('[useAnalytics] 인사이트 조회 실패:', {
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
    fetchSavedInsights();
  }, [fetchSavedInsights]);

  const generateAnalytics = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics?type=generate');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '분석을 실행할 수 없습니다.');
      }

      setAnalytics(result.data);
      // 새 인사이트도 가져오기
      await fetchSavedInsights();
    } catch (err) {
      console.error('[useAnalytics] 분석 생성 실패:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      setError(err instanceof Error ? err.message : '분석 오류');
    } finally {
      setIsGenerating(false);
    }
  }, [fetchSavedInsights]);

  const dismissInsight = useCallback(async (insightId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', insightId }),
      });

      if (!response.ok) {
        throw new Error('인사이트 닫기에 실패했습니다.');
      }

      setSavedInsights((prev) => prev.filter((i) => i.id !== insightId));
      return true;
    } catch (err) {
      console.error('[useAnalytics] 인사이트 닫기 실패:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        insightId,
        timestamp: new Date().toISOString(),
      });
      setError(err instanceof Error ? err.message : '오류');
      return false;
    }
  }, []);

  return {
    analytics,
    savedInsights,
    isLoading,
    isGenerating,
    error,
    generateAnalytics,
    dismissInsight,
    refresh: fetchSavedInsights,
  };
}
