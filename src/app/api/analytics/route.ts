/**
 * Analytics API - AI 학습 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { analyticsService } from '@/lib/services/analytics.service';
import { logger } from '@/lib/api/logger';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'saved';

    switch (type) {
      case 'saved': {
        // 저장된 인사이트 조회
        const insights = await analyticsService.getSavedInsights(user.id);
        return NextResponse.json({ success: true, data: { insights } });
      }

      case 'generate': {
        // 새 분석 실행
        const analytics = await analyticsService.analyzeUserLearning(user.id);
        if (!analytics) {
          return NextResponse.json(
            { error: '분석을 실행할 수 없습니다.' },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, data: analytics });
      }

      default:
        return NextResponse.json(
          { error: '유효하지 않은 타입입니다.' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Analytics API error', error as Error);
    return NextResponse.json(
      { error: '분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, insightId } = body;

    switch (action) {
      case 'dismiss': {
        if (!insightId) {
          return NextResponse.json(
            { error: '인사이트 ID가 필요합니다.' },
            { status: 400 }
          );
        }
        const success = await analyticsService.dismissInsight(insightId);
        return NextResponse.json({ success });
      }

      case 'regenerate': {
        const analytics = await analyticsService.analyzeUserLearning(user.id);
        return NextResponse.json({ success: true, data: analytics });
      }

      default:
        return NextResponse.json(
          { error: '유효하지 않은 액션입니다.' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Analytics POST error', error as Error);
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
