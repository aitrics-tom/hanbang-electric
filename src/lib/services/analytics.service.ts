/**
 * Analytics Service - AI 기반 학습 분석 및 추천
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AnalyticsInsight, AnalyticsInsightInsert, Json } from '@/types/database';
import { AgentType } from '@/types';
import { statsService } from './stats.service';
import { ANALYTICS_SYSTEM_PROMPT, buildAnalyticsPrompt } from '@/lib/ai/prompts/analytics';
import { logger } from '@/lib/api/logger';
import { parseAIResponse, safeArray, safeString } from '@/lib/utils/jsonParser';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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
  generatedAt: Date;
}

export class AnalyticsService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  /**
   * 사용자 학습 패턴 분석 실행
   * 성능 최적화: 데이터 부족 시 규칙 기반 분석, AI 호출 타임아웃
   */
  async analyzeUserLearning(userId: string): Promise<AnalyticsResult | null> {
    const startTime = Date.now();

    try {
      // 1. 사용자 통계 조회
      const stats = await statsService.getUserStats(userId);
      if (!stats) {
        logger.error('Failed to get user stats for analytics');
        return this.getEmptyAnalytics();
      }

      // 2. 데이터가 충분하지 않으면 규칙 기반 분석으로 빠르게 반환
      if (stats.totalQuestions < 3) {
        logger.info('Not enough data for AI analysis, using rule-based', {
          totalQuestions: stats.totalQuestions,
        });
        const fallback = this.getFallbackAnalytics(stats);
        await this.saveInsights(userId, fallback);
        return fallback;
      }

      // 3. 분석 프롬프트 생성 (학습 패턴 중심)
      const promptData = {
        categoryStats: stats.categoryStats.map((s) => ({
          category: s.category,
          totalQuestions: s.total_questions,
          lastPracticed: new Date(s.last_practiced).toLocaleDateString('ko-KR'),
        })),
        recentActivity: stats.recentActivity,
        totalQuestions: stats.totalQuestions,
        currentStreak: stats.currentStreak,
        todayCount: stats.todayCount,
      };

      const userPrompt = buildAnalyticsPrompt(promptData);

      // 5. Gemini 분석 실행 (타임아웃 적용)
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024, // 토큰 수 줄여서 속도 향상
        },
      });

      // 타임아웃 Promise와 경쟁
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 15000); // 15초 타임아웃
      });

      const aiPromise = model.generateContent([
        { text: ANALYTICS_SYSTEM_PROMPT },
        { text: userPrompt },
      ]);

      const result = await Promise.race([aiPromise, timeoutPromise]);

      // 타임아웃 또는 에러 시 폴백
      if (!result) {
        logger.warn('AI analytics timed out, using fallback', {
          elapsed: Date.now() - startTime,
        });
        const fallback = this.getFallbackAnalytics(stats);
        await this.saveInsights(userId, fallback);
        return fallback;
      }

      const responseText = result.response.text();
      const parsed = this.parseAnalyticsResponse(responseText);

      if (!parsed) {
        logger.error('Failed to parse analytics response');
        const fallback = this.getFallbackAnalytics(stats);
        await this.saveInsights(userId, fallback);
        return fallback;
      }

      // 6. 인사이트 저장 (비동기로 처리하여 응답 속도 향상)
      this.saveInsights(userId, parsed).catch((err) => {
        logger.error('Failed to save insights', err);
      });

      logger.info('Analytics completed', {
        elapsed: Date.now() - startTime,
        studyPatterns: parsed.studyPatterns.length,
        recommendations: parsed.recommendations.length,
      });

      return {
        ...parsed,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Analytics failed', error as Error);

      // 에러 시에도 빈 결과 대신 기본 분석 반환
      try {
        const stats = await statsService.getUserStats(userId);
        if (stats) {
          return this.getFallbackAnalytics(stats);
        }
      } catch {
        // 무시
      }

      return this.getEmptyAnalytics();
    }
  }

  /**
   * 빈 분석 결과 반환 (데이터 없을 때)
   */
  private getEmptyAnalytics(): AnalyticsResult {
    return {
      studyPatterns: [],
      studyBalance: {
        overStudied: [],
        underStudied: [],
        balanced: [],
        neverStudied: ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'],
      },
      recommendations: [{
        type: 'start',
        category: 'POWER',
        title: '전력 계산부터 시작해보세요',
        reason: '시험에서 가장 비중이 높은 분야입니다. 첫 문제를 풀어보세요!',
        suggestedTopics: ['역률 개선', '변압기 용량 계산'],
        priority: 10,
      }],
      achievements: [],
      trends: {
        direction: 'stagnant',
        summary: '아직 분석할 학습 데이터가 부족합니다.',
        insights: ['문제를 더 풀어보시면 학습 패턴을 분석해드립니다.'],
      },
      summary: '문제를 풀기 시작하면 AI가 학습 패턴을 분석합니다.',
      generatedAt: new Date(),
    };
  }

  /**
   * 저장된 인사이트 조회
   */
  async getSavedInsights(userId: string): Promise<AnalyticsInsight[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('analytics_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('Failed to fetch saved insights', error);
      return [];
    }

    return data || [];
  }

  /**
   * 인사이트 dismiss
   */
  async dismissInsight(insightId: string): Promise<boolean> {
    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('analytics_insights')
      .update({ is_dismissed: true })
      .eq('id', insightId);

    if (error) {
      logger.error('Failed to dismiss insight', error);
      return false;
    }

    return true;
  }

  private parseAnalyticsResponse(responseText: string): Omit<AnalyticsResult, 'generatedAt'> | null {
    try {
      // 통합 JSON 파서 사용
      const result = parseAIResponse<{
        studyPatterns?: StudyPattern[];
        studyBalance?: StudyBalance;
        recommendations?: Recommendation[];
        achievements?: Achievement[];
        trends?: LearningTrend;
        studyPlan?: StudyPlan;
        summary?: string;
      }>(responseText);

      if (!result.success || !result.data) {
        logger.error('Failed to parse analytics JSON', new Error(result.error || 'Unknown error'));
        return null;
      }

      const parsed = result.data;

      return {
        studyPatterns: safeArray<StudyPattern>(parsed.studyPatterns),
        studyBalance: parsed.studyBalance || {
          overStudied: [],
          underStudied: [],
          balanced: [],
          neverStudied: [],
        },
        recommendations: safeArray<Recommendation>(parsed.recommendations),
        achievements: safeArray<Achievement>(parsed.achievements),
        trends: parsed.trends || {
          direction: 'stagnant',
          summary: '분석 중',
          insights: [],
        },
        studyPlan: parsed.studyPlan,
        summary: safeString(parsed.summary, ''),
      };
    } catch (error) {
      logger.error('Failed to parse analytics JSON', error as Error);
    }
    return null;
  }

  private getFallbackAnalytics(stats: {
    categoryStats: { category: string; total_questions: number; last_practiced: string }[];
    currentStreak: number;
    totalQuestions: number;
    recentActivity: { date: string; count: number }[];
  }): AnalyticsResult {
    // 모든 카테고리 목록
    const ALL_CATEGORIES: AgentType[] = ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'];

    // 시험 출제 비중
    const EXAM_WEIGHTS: Record<string, number> = {
      'DESIGN': 17.5,
      'SEQUENCE': 22.5,
      'LOAD': 17.5,
      'POWER': 22.5,
      'RENEWABLE': 7.5,
      'KEC': 12.5,
    };

    // 학습한 카테고리 집합
    const studiedCategories = new Set(stats.categoryStats.map(s => s.category));

    // 학습 패턴 분석
    const studyPatterns: StudyPattern[] = ALL_CATEGORIES.map((cat) => {
      const stat = stats.categoryStats.find(s => s.category === cat);
      const questionCount = stat?.total_questions || 0;
      const studyPercentage = stats.totalQuestions > 0
        ? (questionCount / stats.totalQuestions) * 100
        : 0;
      const examWeight = EXAM_WEIGHTS[cat] || 10;

      let status: 'frequent' | 'moderate' | 'rare' | 'never';
      let balanceStatus: '과다학습' | '적정' | '부족' | '미학습';

      if (questionCount === 0) {
        status = 'never';
        balanceStatus = '미학습';
      } else if (studyPercentage > examWeight * 1.5) {
        status = 'frequent';
        balanceStatus = '과다학습';
      } else if (studyPercentage >= examWeight * 0.7) {
        status = 'moderate';
        balanceStatus = '적정';
      } else {
        status = 'rare';
        balanceStatus = '부족';
      }

      return {
        category: cat,
        status,
        questionCount,
        studyPercentage: Math.round(studyPercentage * 10) / 10,
        examWeight,
        balanceStatus,
        lastStudied: stat?.last_practiced
          ? new Date(stat.last_practiced).toLocaleDateString('ko-KR')
          : '학습 기록 없음',
        recommendation: balanceStatus === '미학습'
          ? `${cat} 분야 학습을 시작해보세요`
          : balanceStatus === '부족'
          ? `${cat} 분야 학습량을 늘려보세요`
          : balanceStatus === '과다학습'
          ? `다른 분야도 함께 공부해보세요`
          : '현재 학습량이 적절합니다',
      };
    });

    // 학습 균형 분석
    const studyBalance: StudyBalance = {
      overStudied: studyPatterns.filter(p => p.balanceStatus === '과다학습').map(p => p.category),
      underStudied: studyPatterns.filter(p => p.balanceStatus === '부족').map(p => p.category),
      balanced: studyPatterns.filter(p => p.balanceStatus === '적정').map(p => p.category),
      neverStudied: studyPatterns.filter(p => p.balanceStatus === '미학습').map(p => p.category),
    };

    // 추천 생성
    const recommendations: Recommendation[] = [];

    // 미학습 분야 추천
    studyBalance.neverStudied.forEach((cat, i) => {
      if (recommendations.length < 5) {
        recommendations.push({
          type: 'start',
          category: cat as AgentType,
          title: `${cat} 학습 시작하기`,
          reason: `아직 ${cat} 분야를 공부한 적이 없습니다. 시험 비중 ${EXAM_WEIGHTS[cat]}%입니다.`,
          suggestedTopics: this.getTopicsForCategory(cat as AgentType),
          priority: 10 - i,
        });
      }
    });

    // 부족 분야 추천
    studyBalance.underStudied.forEach((cat, i) => {
      if (recommendations.length < 5) {
        recommendations.push({
          type: 'increase',
          category: cat as AgentType,
          title: `${cat} 학습량 늘리기`,
          reason: `${cat} 분야 학습량이 시험 비중 대비 부족합니다.`,
          suggestedTopics: this.getTopicsForCategory(cat as AgentType),
          priority: 8 - i,
        });
      }
    });

    // 성취 분석
    const achievements: Achievement[] = [];
    if (stats.currentStreak >= 7) {
      achievements.push({
        type: 'streak',
        title: '일주일 연속 학습!',
        description: `${stats.currentStreak}일 연속으로 학습 중입니다`,
      });
    }
    if (stats.totalQuestions >= 100) {
      achievements.push({
        type: 'milestone',
        title: '100문제 달성!',
        description: '총 100문제 이상을 학습했습니다',
      });
    }
    if (studyBalance.neverStudied.length === 0) {
      achievements.push({
        type: 'coverage',
        title: '전 분야 학습 시작!',
        description: '모든 카테고리를 최소 1번 이상 공부했습니다',
      });
    }

    // 추세 분석
    const recentCount = stats.recentActivity.reduce((sum, a) => sum + a.count, 0);
    const direction: 'expanding' | 'focused' | 'stagnant' =
      studyBalance.neverStudied.length === 0 ? 'expanding' :
      recentCount > 10 ? 'focused' : 'stagnant';

    return {
      studyPatterns,
      studyBalance,
      recommendations,
      achievements,
      trends: {
        direction,
        summary: `총 ${stats.totalQuestions}문제를 학습하셨습니다.`,
        insights: [
          studyBalance.neverStudied.length > 0
            ? `${studyBalance.neverStudied.join(', ')} 분야는 아직 학습하지 않았습니다.`
            : '모든 분야를 학습하고 있습니다!',
          studyBalance.underStudied.length > 0
            ? `${studyBalance.underStudied.join(', ')} 분야 학습량이 부족합니다.`
            : '',
        ].filter(Boolean),
      },
      studyPlan: {
        immediate: studyBalance.neverStudied.slice(0, 2),
        thisWeek: studyBalance.underStudied.slice(0, 2),
        balanced: ['다양한 분야를 골고루 학습하세요'],
      },
      summary: `총 ${stats.totalQuestions}문제를 학습하셨습니다. ${studyBalance.neverStudied.length > 0 ? `${studyBalance.neverStudied[0]} 분야 학습을 시작해보세요.` : '모든 분야를 골고루 학습하고 계십니다!'}`,
      generatedAt: new Date(),
    };
  }

  private getTopicsForCategory(category: AgentType): string[] {
    const topics: Record<AgentType, string[]> = {
      DESIGN: ['광속법', '등수 계산', '감광보상률', '조도 계산'],
      SEQUENCE: ['시퀀스 제어', '릴레이 회로', '타이머 제어', '인터록'],
      LOAD: ['수용률 계산', '부등률', '부하설비 용량', '전력 부하'],
      POWER: ['역률 개선', '전압강하', '변압기 용량', '콘덴서 용량'],
      RENEWABLE: ['태양광 발전', 'ESS', '설비 인증', '신재생에너지'],
      KEC: ['접지 시스템', '누전차단기', '전선 굵기', '안전 규정'],
    };
    return topics[category] || [];
  }

  private async saveInsights(
    userId: string,
    analytics: Omit<AnalyticsResult, 'generatedAt'>
  ): Promise<void> {
    const supabase = await createServerSupabaseClient();

    // 기존 인사이트 무효화
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('analytics_insights')
      .update({ is_dismissed: true })
      .eq('user_id', userId)
      .in('insight_type', ['study_pattern', 'recommendation']);

    const insightsToInsert: AnalyticsInsightInsert[] = [];

    // 학습 패턴 저장 (부족/미학습 분야만)
    analytics.studyPatterns
      .filter((sp) => sp.balanceStatus === '부족' || sp.balanceStatus === '미학습')
      .forEach((sp) => {
        insightsToInsert.push({
          user_id: userId,
          insight_type: 'study_pattern',
          category: sp.category,
          title: sp.balanceStatus === '미학습'
            ? `${sp.category} 학습 시작 필요`
            : `${sp.category} 학습량 부족`,
          description: sp.recommendation,
          priority: sp.balanceStatus === '미학습' ? 10 : 7,
          metadata: sp as unknown as Json,
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7일
        });
      });

    // 추천 저장
    analytics.recommendations.forEach((rec) => {
      insightsToInsert.push({
        user_id: userId,
        insight_type: 'recommendation',
        category: rec.category,
        title: rec.title,
        description: rec.reason,
        priority: rec.priority,
        metadata: rec as unknown as Json,
        valid_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일
      });
    });

    // 성취 저장
    analytics.achievements.forEach((ach) => {
      insightsToInsert.push({
        user_id: userId,
        insight_type: 'achievement',
        category: null,
        title: ach.title,
        description: ach.description,
        priority: 0,
        metadata: ach as unknown as Json,
      });
    });

    if (insightsToInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('analytics_insights')
        .insert(insightsToInsert);

      if (error) {
        logger.error('Failed to save insights', error);
      }
    }
  }
}

export const analyticsService = new AnalyticsService();
