/**
 * History API - 질문 이력 조회 및 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sessionService } from '@/lib/services/session.service';
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

    // 쿼리 파라미터 파싱
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const isCorrect = searchParams.get('isCorrect');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 이력 조회
    const { sessions, total } = await sessionService.getUserSessions(user.id, {
      category,
      isCorrect: isCorrect === 'true' ? true : isCorrect === 'false' ? false : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessions,
        total,
        hasMore: offset + sessions.length < total,
      },
    });
  } catch (error) {
    logger.error('History API error', error as Error);
    return NextResponse.json(
      { error: '이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Admin 클라이언트로 삭제 (RLS 우회, 단 user_id로 소유권 검증)
    const adminClient = createAdminClient();

    // 사용자 소유권 확인 후 삭제
    const { error } = await adminClient
      .from('question_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);  // 반드시 본인의 세션만 삭제 가능

    if (error) {
      // 레코드가 없거나 권한이 없는 경우
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '세션을 찾을 수 없거나 삭제 권한이 없습니다.' },
          { status: 404 }
        );
      }
      throw error;
    }

    logger.info('Session deleted', { sessionId, userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('History delete error', error as Error);
    return NextResponse.json(
      { error: '삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
