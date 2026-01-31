/**
 * RAG Search API - 검색 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { ragContextService, retrievalService } from '@/lib/rag';
import { AgentType } from '@/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/api/logger';

/**
 * POST /api/rag/search
 * RAG 검색 수행
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { query, agentType, kecCodes, terms, maxTokens, topK } = body as {
      query?: string;
      agentType?: AgentType;
      kecCodes?: string[];
      terms?: string[];
      maxTokens?: number;
      topK?: number;
    };

    // KEC 코드 기반 검색
    if (kecCodes && kecCodes.length > 0) {
      const context = await ragContextService.getKecContext(kecCodes);
      return NextResponse.json({ success: true, context });
    }

    // 용어 검증용 검색
    if (terms && terms.length > 0) {
      const context = await ragContextService.getTermVerificationContext(terms);
      return NextResponse.json({ success: true, context });
    }

    // 일반 쿼리 검색
    if (!query) {
      return NextResponse.json(
        { error: 'query, kecCodes, or terms is required' },
        { status: 400 }
      );
    }

    // 에이전트 타입이 있으면 에이전트용 컨텍스트
    if (agentType) {
      const context = await ragContextService.getContextForAgent(query, agentType);
      return NextResponse.json({ success: true, context });
    }

    // 일반 컨텍스트
    const context = await ragContextService.getContext(query, {
      maxTokens,
      topK,
    });

    return NextResponse.json({ success: true, context });
  } catch (error) {
    logger.error('Search API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/search
 * 간단한 검색 (쿼리 파라미터)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query');
    const topK = parseInt(searchParams.get('topK') || '5', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'q or query parameter is required' },
        { status: 400 }
      );
    }

    const results = await retrievalService.retrieve({
      query,
      topK,
      minScore: 0.5,
      includeKeyword: true,
    });

    return NextResponse.json({
      success: true,
      query,
      results: results.map((r) => ({
        content: r.chunk.content,
        source: r.chunk.metadata.source,
        score: r.score,
        matchType: r.matchType,
        kecCodes: r.chunk.kecCodes,
      })),
    });
  } catch (error) {
    logger.error('Search GET API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
