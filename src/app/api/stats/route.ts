/**
 * Stats API - 학습 통계 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { statsService } from '@/lib/services/stats.service';
import { AgentType } from '@/types';
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
    const type = searchParams.get('type') || 'overview';
    const category = searchParams.get('category') as AgentType | null;
    const period = searchParams.get('period') as 'week' | 'month' | null;

    switch (type) {
      case 'overview': {
        const stats = await statsService.getUserStats(user.id);
        if (!stats) {
          return NextResponse.json(
            { error: '통계를 가져올 수 없습니다.' },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, data: stats });
      }

      case 'category': {
        if (!category) {
          return NextResponse.json(
            { error: '카테고리를 지정해주세요.' },
            { status: 400 }
          );
        }
        const details = await statsService.getCategoryDetails(user.id, category);
        return NextResponse.json({ success: true, data: details });
      }

      case 'trend': {
        const trends = await statsService.getTrendData(user.id, period || 'week');
        return NextResponse.json({ success: true, data: trends });
      }

      default:
        return NextResponse.json(
          { error: '유효하지 않은 타입입니다.' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Stats API error', error as Error);
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
