/**
 * Stats Service - 학습 통계 및 분석
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CategoryStats } from '@/types/database';
import { AgentType } from '@/types';
import { logger } from '@/lib/api/logger';

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

export interface TrendData {
  period: string;
  totalQuestions: number;
  accuracy: number;
  categories: Record<string, number>;
}

export class StatsService {
  /**
   * 사용자 전체 통계 조회
   */
  async getUserStats(userId: string): Promise<UserStats | null> {
    const supabase = await createServerSupabaseClient();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      // 카테고리별 통계 (view 사용)
      const { data: categoryStats, error: categoryError } = await sb
        .from('category_stats')
        .select('*')
        .eq('user_id', userId);

      if (categoryError) {
        logger.error('Failed to fetch category stats', categoryError);
      }

      // 학습 스트릭
      const { data: streak } = await sb
        .from('learning_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

      // 최근 7일 활동
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentSessions } = await sb
        .from('question_sessions')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString());

      // 일별 활동 집계
      const activityMap = new Map<string, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentSessions?.forEach((session: any) => {
        const date = session.created_at.split('T')[0];
        activityMap.set(date, (activityMap.get(date) || 0) + 1);
      });

      const recentActivity = Array.from(activityMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date));

      // 전체 통계 계산
      const stats = (categoryStats || []) as CategoryStats[];
      const totalQuestions = stats.reduce((sum: number, s: CategoryStats) => sum + s.total_questions, 0);
      const totalCorrect = stats.reduce((sum: number, s: CategoryStats) => sum + s.correct_count, 0);
      const totalIncorrect = stats.reduce((sum: number, s: CategoryStats) => sum + s.incorrect_count, 0);
      // 정확도 계산: 체크된 문제(정답+오답) 중 정답 비율
      const markedTotal = totalCorrect + totalIncorrect;
      const overallAccuracy = markedTotal > 0
        ? (totalCorrect / markedTotal) * 100
        : 0;

      // 취약 카테고리 (정답률 80% 미만)
      const weakCategories = stats
        .filter((s: CategoryStats) => s.accuracy_rate < 80 && s.total_questions >= 3)
        .map((s: CategoryStats) => ({
          category: s.category as AgentType,
          accuracy: s.accuracy_rate,
          totalQuestions: s.total_questions,
        }))
        .sort((a, b) => a.accuracy - b.accuracy);

      return {
        totalQuestions,
        totalCorrect,
        totalIncorrect,
        overallAccuracy,
        currentStreak: streak?.current_streak || 0,
        longestStreak: streak?.longest_streak || 0,
        todayCount: streak?.today_count || 0,
        dailyGoal: streak?.daily_goal || 10,
        categoryStats: stats as CategoryStats[],
        recentActivity,
        weakCategories,
      };
    } catch (error) {
      logger.error('Failed to get user stats', error as Error);
      return null;
    }
  }

  /**
   * 카테고리별 상세 통계
   */
  async getCategoryDetails(
    userId: string,
    category: AgentType
  ): Promise<{
    totalQuestions: number;
    correctCount: number;
    accuracy: number;
    avgTime: number;
    recentSessions: {
      id: string;
      question: string;
      answer: string;
      isCorrect: boolean | null;
      createdAt: string;
    }[];
  } | null> {
    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessions, error } = await (supabase as any)
      .from('question_sessions')
      .select('id, question_text, answer, user_marked_correct, processing_time_ms, created_at')
      .eq('user_id', userId)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('Failed to fetch category details', error);
      return null;
    }

    const totalQuestions = sessions?.length || 0;
    const sessionList = sessions || [];
    const markedSessions = sessionList.filter((s: { user_marked_correct: boolean | null }) => s.user_marked_correct !== null);
    const correctCount = markedSessions.filter((s: { user_marked_correct: boolean | null }) => s.user_marked_correct).length;
    const accuracy = markedSessions.length > 0
      ? (correctCount / markedSessions.length) * 100
      : 0;
    const avgTime = totalQuestions > 0
      ? sessionList.reduce((sum: number, s: { processing_time_ms: number | null }) => sum + (s.processing_time_ms || 0), 0) / totalQuestions
      : 0;

    return {
      totalQuestions,
      correctCount,
      accuracy,
      avgTime,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentSessions: sessionList.map((s: any) => ({
        id: s.id,
        question: s.question_text.substring(0, 100) + (s.question_text.length > 100 ? '...' : ''),
        answer: s.answer || '',
        isCorrect: s.user_marked_correct,
        createdAt: s.created_at,
      })),
    };
  }

  /**
   * 학습 추세 데이터 (주별/월별)
   */
  async getTrendData(
    userId: string,
    period: 'week' | 'month' = 'week'
  ): Promise<TrendData[]> {
    const supabase = await createServerSupabaseClient();

    const daysAgo = period === 'week' ? 28 : 90; // 4주 또는 3개월
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessions, error } = await (supabase as any)
      .from('question_sessions')
      .select('category, user_marked_correct, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch trend data', error);
      return [];
    }

    // 기간별 집계
    const periodMap = new Map<string, {
      total: number;
      correct: number;
      categories: Record<string, number>;
    }>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessions?.forEach((session: any) => {
      const date = new Date(session.created_at);
      let periodKey: string;

      if (period === 'week') {
        // 주의 시작일 (월요일)
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(date.setDate(diff));
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        // 월
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const current = periodMap.get(periodKey) || {
        total: 0,
        correct: 0,
        categories: {},
      };

      current.total += 1;
      if (session.user_marked_correct) {
        current.correct += 1;
      }
      current.categories[session.category] = (current.categories[session.category] || 0) + 1;

      periodMap.set(periodKey, current);
    });

    return Array.from(periodMap.entries())
      .map(([periodStr, data]) => ({
        period: periodStr,
        totalQuestions: data.total,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        categories: data.categories,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }
}

export const statsService = new StatsService();
