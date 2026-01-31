/**
 * History Context Service - 사용자 학습 이력 컨텍스트 빌더
 *
 * Supabase에서 사용자 이력을 가져와 AI 컨텍스트로 변환
 * Admin 클라이언트 사용하여 RLS 우회 (user_id로 필터링)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { QuestionSession, LearningStreak } from '@/types/database';
import { logger } from '@/lib/api/logger';

export interface UserHistoryContext {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  categoryStats: Record<string, { total: number; correct: number }>;
  recentMistakes: Array<{
    question: string;
    answer: string;
    category: string;
    date: string;
  }>;
  streakDays: number;
  summary: string;
}

export class HistoryContextService {
  /**
   * 사용자의 학습 이력 컨텍스트 생성
   */
  async buildContext(userId: string): Promise<UserHistoryContext> {
    const supabase = createAdminClient();

    try {
      // 전체 세션 통계 조회
      const { data: sessions, error } = await supabase
        .from('question_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch sessions for context', error);
        throw error;
      }

      const allSessions = (sessions || []) as QuestionSession[];

      // 기본 통계
      const totalQuestions = allSessions.length;
      const correctCount = allSessions.filter(s => s.user_marked_correct === true).length;
      const incorrectCount = allSessions.filter(s => s.user_marked_correct === false).length;

      // 카테고리별 통계
      const categoryStats: Record<string, { total: number; correct: number }> = {};
      allSessions.forEach(session => {
        const cat = session.category || '기타';
        if (!categoryStats[cat]) {
          categoryStats[cat] = { total: 0, correct: 0 };
        }
        categoryStats[cat].total += 1;
        if (session.user_marked_correct === true) {
          categoryStats[cat].correct += 1;
        }
      });

      // 최근 틀린 문제 (최대 5개)
      const recentMistakes = allSessions
        .filter(s => s.user_marked_correct === false)
        .slice(0, 5)
        .map(s => ({
          question: s.question_text || '',
          answer: s.answer || '',
          category: s.category || '기타',
          date: s.created_at ? new Date(s.created_at).toLocaleDateString('ko-KR') : '',
        }));

      // 학습 스트릭 조회
      const { data: streak } = await supabase
        .from('learning_streaks')
        .select('current_streak')
        .eq('user_id', userId)
        .single();

      const typedStreak = streak as LearningStreak | null;
      const streakDays = typedStreak?.current_streak || 0;

      // 요약 텍스트 생성
      const summary = this.generateSummary({
        totalQuestions,
        correctCount,
        incorrectCount,
        categoryStats,
        recentMistakes,
        streakDays,
      });

      return {
        totalQuestions,
        correctCount,
        incorrectCount,
        categoryStats,
        recentMistakes,
        streakDays,
        summary,
      };
    } catch (error) {
      logger.error('Failed to build history context', error as Error);
      return {
        totalQuestions: 0,
        correctCount: 0,
        incorrectCount: 0,
        categoryStats: {},
        recentMistakes: [],
        streakDays: 0,
        summary: '학습 이력을 불러올 수 없습니다.',
      };
    }
  }

  /**
   * AI 프롬프트용 컨텍스트 문자열 생성
   */
  async buildPromptContext(userId: string): Promise<string> {
    const context = await this.buildContext(userId);

    let promptContext = `## 사용자 학습 현황\n`;
    promptContext += `- 총 풀이 문제: ${context.totalQuestions}문제\n`;
    promptContext += `- 정답: ${context.correctCount}문제\n`;
    promptContext += `- 오답: ${context.incorrectCount}문제\n`;
    promptContext += `- 연속 학습: ${context.streakDays}일\n\n`;

    if (Object.keys(context.categoryStats).length > 0) {
      promptContext += `## 카테고리별 현황\n`;
      for (const [cat, stats] of Object.entries(context.categoryStats)) {
        const accuracy = stats.total > 0
          ? Math.round((stats.correct / stats.total) * 100)
          : 0;
        promptContext += `- ${cat}: ${stats.total}문제 (정답률 ${accuracy}%)\n`;
      }
      promptContext += '\n';
    }

    if (context.recentMistakes.length > 0) {
      promptContext += `## 최근 틀린 문제\n`;
      context.recentMistakes.forEach((mistake, i) => {
        promptContext += `${i + 1}. [${mistake.category}] ${mistake.question.slice(0, 100)}...\n`;
        promptContext += `   정답: ${mistake.answer}\n`;
      });
    }

    return promptContext;
  }

  private generateSummary(context: Omit<UserHistoryContext, 'summary'>): string {
    if (context.totalQuestions === 0) {
      return '아직 풀이한 문제가 없습니다. 첫 문제를 풀어보세요!';
    }

    const accuracy = context.totalQuestions > 0
      ? Math.round((context.correctCount / context.totalQuestions) * 100)
      : 0;

    let summary = `총 ${context.totalQuestions}문제를 풀었고, 정답률은 ${accuracy}%입니다.`;

    if (context.streakDays > 0) {
      summary += ` ${context.streakDays}일 연속 학습 중입니다.`;
    }

    // 취약 카테고리 찾기
    const weakCategories = Object.entries(context.categoryStats)
      .filter(([, stats]) => {
        const catAccuracy = stats.total > 0 ? stats.correct / stats.total : 1;
        return catAccuracy < 0.5 && stats.total >= 2;
      })
      .map(([cat]) => cat);

    if (weakCategories.length > 0) {
      summary += ` ${weakCategories.join(', ')} 분야가 취약합니다.`;
    }

    return summary;
  }
}

export const historyContextService = new HistoryContextService();
