/**
 * Feedback API - 정오답 피드백 제출
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sessionService } from '@/lib/services/session.service';
import { statsService } from '@/lib/services/stats.service';
import { logger } from '@/lib/api/logger';

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
    const { sessionId, isCorrect, difficultyRating, notes } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json(
        { error: '정답 여부(isCorrect)가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세션 소유권 확인
    const session = await sessionService.getSession(sessionId);
    if (!session || session.user_id !== user.id) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 피드백 업데이트
    const success = await sessionService.updateFeedback(sessionId, {
      isCorrect,
      difficultyRating,
      notes,
    });

    if (!success) {
      return NextResponse.json(
        { error: '피드백 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 피드백 저장 후 최신 통계 조회하여 반환
    const updatedStats = await statsService.getUserStats(user.id);

    return NextResponse.json({
      success: true,
      message: isCorrect ? '정답으로 기록되었습니다!' : '오답으로 기록되었습니다.',
      stats: updatedStats,
    });
  } catch (error) {
    logger.error('Feedback API error', error as Error);
    return NextResponse.json(
      { error: '피드백 제출 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
