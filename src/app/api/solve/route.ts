/**
 * POST /api/solve - 멀티 에이전트 문제 풀이 API
 *
 * 아키텍처:
 * 1. Vision Service → 이미지 분석 (OCR + 회로 인식)
 * 2. Agent Service → 오케스트레이션 + 전문 풀이
 * 3. Streaming → 실시간 응답 (선택적)
 * 4. Session Service → Supabase에 결과 저장
 *
 * 최적화:
 * - 토큰 예산 관리
 * - 병렬 검증
 * - 응답 캐싱 (TODO)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { visionService } from '@/lib/services/vision.service';
import { agentService } from '@/lib/services/agent.service';
import { geminiSolverService } from '@/lib/services/gemini-solver.service';
import { sessionService } from '@/lib/services/session.service';
import { storageService } from '@/lib/services/storage.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateInput, validateOutput } from '@/lib/guardrails/config';
import { ApiError, errorHandler } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { logger } from '@/lib/api/logger';
import { rateLimiter, getClientIp } from '@/lib/api/rate-limiter';

// 요청 스키마
const SolveRequestSchema = z.object({
  text: z.string().optional(),
  imageBase64: z.string().optional(),
  mode: z.enum(['multi-agent', 'simple']).optional().default('multi-agent'),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // 0. 인증 확인
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw ApiError.unauthorized('로그인이 필요합니다.');
    }

    // 1. Rate Limiting
    const clientIp = getClientIp(request);
    const rateLimit = rateLimiter.check(clientIp, {
      maxRequests: 30,
      windowMs: 60000,
    });

    if (!rateLimit.allowed) {
      throw ApiError.tooManyRequests('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }

    // 2. 요청 파싱 및 검증
    const body = await request.json();
    const { text, imageBase64, mode } = SolveRequestSchema.parse(body);

    // 3. Guardrails - 입력 검증 및 정규화
    const inputValidation = validateInput({ text, imageBase64 });
    if (!inputValidation.valid) {
      throw ApiError.badRequest(inputValidation.errors.join(' '));
    }

    // 정규화된 텍스트 사용 (단위 오류, 오타 등 보정)
    const normalizedText = inputValidation.normalizedText || text;

    logger.info('Solve request received', {
      requestId,
      userId: user.id,
      hasImage: !!imageBase64,
      hasText: !!text,
      textNormalized: text !== normalizedText,
      mode,
    });

    // 4. 이미지 업로드 (비동기, 저장용)
    let imageUrl: string | undefined;
    if (imageBase64) {
      const uploadResult = await storageService.uploadImage(user.id, imageBase64);
      if (uploadResult) {
        imageUrl = uploadResult.url;
      }
    }

    // 5. 모드에 따른 처리
    if (mode === 'simple' || !imageBase64) {
      // 간단 모드 또는 텍스트만 있는 경우
      const solution = imageBase64
        ? await geminiSolverService.solveFromImage(imageBase64)
        : await geminiSolverService.solveFromText(normalizedText!);

      // 세션 저장 (동기 - 세션 ID 반환을 위해)
      const session = await sessionService.createSession({
        userId: user.id,
        solution,
        imageUrl,
      });

      return successResponse(solution, {
        processingTime: (Date.now() - startTime) / 1000,
        mode: 'simple',
        sessionId: session?.id,
      });
    }

    // 6. 멀티 에이전트 모드
    // 6.1 Vision 분석
    logger.info('Starting vision analysis', { requestId });
    const visionResult = await visionService.analyzeImage(imageBase64);

    logger.info('Vision analysis completed', {
      requestId,
      suggestedAgent: visionResult.suggestedAgent,
      hasCircuit: !!visionResult.circuitAnalysis?.type,
      confidence: visionResult.confidence,
      extractedTextLength: visionResult.extractedText?.length || 0,
    });

    // 6.1.1 Vision 실패 시 simple 모드로 폴백
    // 텍스트 추출 실패해도 이미지로 직접 풀이 시도
    if (!visionResult.extractedText || visionResult.extractedText.length < 10 || visionResult.confidence === 0) {
      logger.warn('Vision extraction failed or low confidence, falling back to simple mode', {
        requestId,
        extractedLength: visionResult.extractedText?.length || 0,
        confidence: visionResult.confidence,
      });

      // simple 모드로 직접 이미지 풀이 시도
      const solution = await geminiSolverService.solveFromImage(imageBase64);

      const session = await sessionService.createSession({
        userId: user.id,
        solution,
        imageUrl,
        metadata: {
          fallbackReason: 'vision_extraction_failed',
          visionConfidence: visionResult.confidence,
        },
      });

      return successResponse(solution, {
        processingTime: (Date.now() - startTime) / 1000,
        mode: 'simple',
        fallback: true,
        fallbackReason: 'Vision 텍스트 추출 실패로 간단 모드로 전환됨',
        sessionId: session?.id,
      });
    }

    // 6.2 에이전트 오케스트레이션
    logger.info('Starting agent orchestration', { requestId });
    const agentResult = await agentService.orchestrate(visionResult, imageBase64);

    logger.info('Agent orchestration completed', {
      requestId,
      agentPath: agentResult.metadata.agentPath,
      totalTime: agentResult.metadata.visionTime + agentResult.metadata.solveTime,
    });

    // 7. Guardrails - 출력 검증
    const outputValidation = validateOutput({
      answer: agentResult.solution.answer,
      steps: agentResult.solution.steps,
      formulas: agentResult.solution.formulas,
      confidence: agentResult.solution.verification?.confidence,
      relatedKEC: agentResult.solution.relatedKEC,
    });

    if (outputValidation.warnings.length > 0) {
      agentResult.solution.verification = {
        ...agentResult.solution.verification!,
        warnings: [
          ...(agentResult.solution.verification?.warnings || []),
          ...outputValidation.warnings,
        ],
      };
    }

    const processingTime = (Date.now() - startTime) / 1000;

    // 8. 세션 저장 (동기 - 세션 ID 반환을 위해)
    const session = await sessionService.createSession({
      userId: user.id,
      solution: agentResult.solution,
      imageUrl,
      metadata: {
        visionTime: agentResult.metadata.visionTime,
        solveTime: agentResult.metadata.solveTime,
        agentPath: agentResult.metadata.agentPath,
      },
    });

    return successResponse(agentResult.solution, {
      processingTime,
      mode: 'multi-agent',
      metadata: agentResult.metadata,
      sessionId: session?.id,
    });
  } catch (error) {
    logger.error('Solve request failed', error as Error, { requestId });
    return errorHandler(error);
  }
}
