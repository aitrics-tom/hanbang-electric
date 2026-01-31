/**
 * useSolveProblem - 멀티 에이전트 문제 풀이 Hook
 *
 * Features:
 * - 단계별 로딩 상태 표시
 * - 에이전트 경로 추적
 * - 에러 핸들링
 */

import { useState, useCallback } from 'react';
import { SolutionResponse } from '@/types';

// 로딩 단계
export type LoadingStep =
  | 'idle'
  | 'uploading'
  | 'analyzing'      // Vision 분석 중
  | 'routing'        // 에이전트 라우팅 중
  | 'solving'        // 풀이 생성 중
  | 'verifying'      // 검증 중
  | 'complete'
  | 'error';

export interface SolveMetadata {
  visionTime?: number;
  solveTime?: number;
  verifyTime?: number;
  totalTokens?: number;
  agentPath?: string[];
  mode?: 'simple' | 'multi-agent';
  sessionId?: string;
}

interface UseSolveProblemOptions {
  onSuccess?: (data: SolutionResponse, metadata?: SolveMetadata) => void;
  onError?: (error: Error) => void;
  onStepChange?: (step: LoadingStep) => void;
}

interface SolveProblemResult {
  solution: SolutionResponse | null;
  metadata: SolveMetadata | null;
  isLoading: boolean;
  loadingStep: LoadingStep;
  error: Error | null;
  solve: (input: { text?: string; imageBase64?: string; mode?: 'simple' | 'multi-agent' }) => Promise<void>;
  reset: () => void;
}

// 로딩 단계별 메시지
export const LOADING_MESSAGES: Record<LoadingStep, string> = {
  idle: '',
  uploading: '이미지 업로드 중...',
  analyzing: '🔍 이미지 분석 중... (OCR + 회로 인식)',
  routing: '🎯 전문 에이전트 선택 중...',
  solving: '✏️ 단계별 풀이 생성 중...',
  verifying: '✅ 풀이 검증 중...',
  complete: '완료!',
  error: '오류 발생',
};

export function useSolveProblem(options?: UseSolveProblemOptions): SolveProblemResult {
  const [solution, setSolution] = useState<SolutionResponse | null>(null);
  const [metadata, setMetadata] = useState<SolveMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [error, setError] = useState<Error | null>(null);

  const updateStep = useCallback((step: LoadingStep) => {
    setLoadingStep(step);
    options?.onStepChange?.(step);
  }, [options]);

  const solve = useCallback(async (input: {
    text?: string;
    imageBase64?: string;
    mode?: 'simple' | 'multi-agent';
  }) => {
    if (!input.text && !input.imageBase64) return;

    setIsLoading(true);
    setError(null);
    setSolution(null);
    setMetadata(null);

    try {
      // 단계 1: 업로드
      updateStep('uploading');

      // 단계 2: 분석 시작 표시
      if (input.imageBase64) {
        updateStep('analyzing');
      }

      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input.text,
          imageBase64: input.imageBase64,
          mode: input.mode || 'multi-agent',
        }),
      });

      // 단계 진행 시뮬레이션 (실제로는 서버에서 SSE로 보내는 것이 이상적)
      if (input.imageBase64 && input.mode !== 'simple') {
        updateStep('routing');
        await new Promise((r) => setTimeout(r, 200));
        updateStep('solving');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '문제 풀이 중 오류가 발생했습니다');
      }

      if (data.success) {
        updateStep('verifying');
        await new Promise((r) => setTimeout(r, 100));

        setSolution(data.data);
        const metaWithSessionId = {
          ...data.meta,
          sessionId: data.meta?.sessionId,
        };
        setMetadata(metaWithSessionId);
        updateStep('complete');

        options?.onSuccess?.(data.data, metaWithSessionId);
      } else {
        throw new Error(data.error || '알 수 없는 오류');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('알 수 없는 오류');
      console.error('[useSolveProblem] 문제 풀이 실패:', {
        error: error.message,
        stack: error.stack,
        input: { hasText: !!input.text, hasImage: !!input.imageBase64, mode: input.mode },
        timestamp: new Date().toISOString(),
      });
      setError(error);
      updateStep('error');
      options?.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [options, updateStep]);

  const reset = useCallback(() => {
    setSolution(null);
    setMetadata(null);
    setError(null);
    setLoadingStep('idle');
  }, []);

  return {
    solution,
    metadata,
    isLoading,
    loadingStep,
    error,
    solve,
    reset,
  };
}
