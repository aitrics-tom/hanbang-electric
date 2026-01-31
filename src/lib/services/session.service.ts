/**
 * Session Service - 질문 세션 CRUD 및 관리
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  QuestionSession,
  QuestionSessionInsert,
  QuestionSessionUpdate,
  Json
} from '@/types/database';
import { SolutionResponse } from '@/types';
import { logger } from '@/lib/api/logger';

export interface CreateSessionInput {
  userId: string;
  solution: SolutionResponse;
  imageUrl?: string;
  metadata?: {
    visionTime?: number;
    solveTime?: number;
    agentPath?: string[];
    fallbackReason?: string;
    visionConfidence?: number;
  };
}

export interface SessionFilters {
  category?: string;
  isCorrect?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class SessionService {
  /**
   * 새 질문 세션 생성
   */
  async createSession(input: CreateSessionInput): Promise<QuestionSession | null> {
    const supabase = await createServerSupabaseClient();
    const { userId, solution, imageUrl, metadata } = input;

    const sessionData: QuestionSessionInsert = {
      user_id: userId,
      question_text: solution.question,
      image_url: imageUrl,
      category: solution.category,
      answer: solution.answer,
      solution_summary: solution.solution,
      steps: solution.steps as unknown as Json,
      formulas: solution.formulas,
      related_kec: solution.relatedKEC,
      agent_path: metadata?.agentPath,
      primary_agent: solution.agents?.primary || solution.category,
      secondary_agents: solution.agents?.secondary,
      is_valid: solution.verification?.isValid ?? true,
      verification_confidence: solution.verification?.confidence,
      verification_checks: solution.verification?.checks as unknown as Json,
      corrections: solution.verification?.corrections,
      warnings: solution.verification?.warnings,
      processing_time_ms: solution.processingTime ? Math.round(solution.processingTime * 1000) : null,
      vision_time_ms: metadata?.visionTime ? Math.round(metadata.visionTime * 1000) : null,
      solve_time_ms: metadata?.solveTime ? Math.round(metadata.solveTime * 1000) : null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('question_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create session', error);
      return null;
    }

    // 학습 스트릭 업데이트
    await this.updateLearningStreak(userId);

    return data as QuestionSession;
  }

  /**
   * 사용자의 질문 이력 조회
   */
  async getUserSessions(
    userId: string,
    filters: SessionFilters = {}
  ): Promise<{ sessions: QuestionSession[]; total: number }> {
    const supabase = await createServerSupabaseClient();
    const { category, isCorrect, startDate, endDate, limit = 20, offset = 0 } = filters;

    let query = supabase
      .from('question_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (isCorrect !== undefined) {
      query = query.eq('user_marked_correct', isCorrect);
    }

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch sessions', error);
      return { sessions: [], total: 0 };
    }

    return { sessions: data || [], total: count || 0 };
  }

  /**
   * 단일 세션 조회
   */
  async getSession(sessionId: string): Promise<QuestionSession | null> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('question_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      logger.error('Failed to fetch session', error);
      return null;
    }

    return data;
  }

  /**
   * 사용자 피드백 업데이트 (정답/오답 마킹)
   */
  async updateFeedback(
    sessionId: string,
    feedback: {
      isCorrect: boolean;
      difficultyRating?: number;
      notes?: string;
    }
  ): Promise<boolean> {
    const supabase = await createServerSupabaseClient();

    const updateData: QuestionSessionUpdate = {
      user_marked_correct: feedback.isCorrect,
      user_difficulty_rating: feedback.difficultyRating,
      user_notes: feedback.notes,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('question_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      logger.error('Failed to update feedback', error);
      return false;
    }

    return true;
  }

  /**
   * 학습 스트릭 업데이트
   */
  private async updateLearningStreak(userId: string): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // 기존 스트릭 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('learning_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!existing) {
      // 새 스트릭 생성
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('learning_streaks').insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
        today_count: 1,
      });
      return;
    }

    const lastDate = existing.last_activity_date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = existing.current_streak;
    let todayCount = existing.today_count;

    if (lastDate === today) {
      // 오늘 이미 활동함 - 카운트만 증가
      todayCount += 1;
    } else if (lastDate === yesterdayStr) {
      // 연속 학습 - 스트릭 증가
      newStreak += 1;
      todayCount = 1;
    } else {
      // 스트릭 끊김 - 리셋
      newStreak = 1;
      todayCount = 1;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('learning_streaks')
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, existing.longest_streak),
        last_activity_date: today,
        today_count: todayCount,
      })
      .eq('user_id', userId);
  }

  /**
   * 학습 스트릭 조회
   */
  async getLearningStreak(userId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('learning_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to fetch learning streak', error);
    }

    return data;
  }
}

export const sessionService = new SessionService();
