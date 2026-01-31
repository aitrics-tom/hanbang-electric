/**
 * RAG Ingest API - 문서 수집 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestService } from '@/lib/rag';
import { DocumentType } from '@/types/rag';
import { AgentType } from '@/types';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/api/logger';

/**
 * POST /api/rag/ingest
 * 단일 파일 수집
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (service role 또는 admin 필요)
    const authHeader = request.headers.get('authorization');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !authHeader.includes(serviceRoleKey || '')) {
      // 일반 사용자 인증 확인
      const supabase = await createServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: { user } } = await (supabase as any).auth.getUser();

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const { filePath, documentType, category } = body as {
      filePath: string;
      documentType: DocumentType;
      category?: AgentType;
    };

    if (!filePath || !documentType) {
      return NextResponse.json(
        { error: 'filePath and documentType are required' },
        { status: 400 }
      );
    }

    const result = await ingestService.ingestFile(filePath, {
      documentType,
      category,
    });

    if (result.errors.length > 0) {
      return NextResponse.json(
        { success: false, result },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    logger.error('Ingest API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rag/ingest
 * 전체 문서 수집 (doc 폴더 전체)
 */
export async function PUT(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !authHeader.includes(serviceRoleKey || '')) {
      return NextResponse.json(
        { error: 'Service role authorization required' },
        { status: 401 }
      );
    }

    logger.info('Starting full document ingestion...');

    const result = await ingestService.ingestAll();

    return NextResponse.json({
      success: result.failed === 0,
      total: result.total,
      success_count: result.success,
      failed_count: result.failed,
      results: result.results,
    });
  } catch (error) {
    logger.error('Full ingest API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
