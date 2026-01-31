/**
 * Unified Guardrails - 통합 안전장치 서비스
 *
 * NeMo Guardrails 스타일의 다층 검증 시스템
 *
 * 아키텍처:
 * 1. Pre-filter (규칙 기반) - 빠른 패턴 매칭
 * 2. LLM Validation (시맨틱) - 주제/탈옥 검증
 * 3. Output Validation (RAG + LLM) - 품질 검증
 */

import { validateInput as ruleBasedValidateInput, validateOutput as ruleBasedValidateOutput, normalizeText } from './config';
import { checkTopic, TopicCheckResult } from './llm/topic-checker';
import { detectJailbreak, JailbreakDetectionResult } from './llm/jailbreak-detector';
import { logger } from '@/lib/api/logger';

// =====================================
// Types
// =====================================

export interface UnifiedInputValidation {
  // 최종 결과
  valid: boolean;
  errors: string[];
  normalizedText?: string;

  // 상세 결과
  details: {
    ruleCheck: {
      valid: boolean;
      errors: string[];
    };
    topicCheck?: TopicCheckResult;
    jailbreakCheck?: JailbreakDetectionResult;
  };

  // 메타데이터
  processingTime: number;
  source: 'unified' | 'fallback';
}

export interface UnifiedOutputValidation {
  valid: boolean;
  warnings: string[];
  corrections: string[];

  // 상세 결과
  details: {
    ruleCheck: {
      valid: boolean;
      warnings: string[];
      corrections: string[];
    };
  };

  processingTime: number;
}

export interface UnifiedGuardrailsConfig {
  // LLM 검증 활성화 여부
  enableLLMValidation: boolean;
  // 주제 검증 임계값 (이 신뢰도 이하면 차단)
  topicConfidenceThreshold: number;
  // 탈옥 검증 임계값 (이 신뢰도 이상이면 차단)
  jailbreakConfidenceThreshold: number;
  // 병렬 실행 여부
  parallelExecution: boolean;
}

const DEFAULT_CONFIG: UnifiedGuardrailsConfig = {
  enableLLMValidation: true,
  topicConfidenceThreshold: 0.3,
  jailbreakConfidenceThreshold: 0.7,
  parallelExecution: true,
};

// =====================================
// Unified Guardrails Class
// =====================================

export class UnifiedGuardrails {
  private config: UnifiedGuardrailsConfig;

  constructor(config: Partial<UnifiedGuardrailsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 통합 입력 검증
   *
   * 1. 규칙 기반 사전 검사 (빠름)
   * 2. LLM 기반 주제/탈옥 검사 (정확)
   */
  async validateInput(input: {
    text?: string;
    imageBase64?: string;
  }): Promise<UnifiedInputValidation> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // 1단계: 규칙 기반 검증 (Pre-filter)
      const ruleResult = ruleBasedValidateInput(input);

      if (!ruleResult.valid) {
        // 규칙 검증 실패 시 바로 반환 (LLM 호출 절약)
        return {
          valid: false,
          errors: ruleResult.errors,
          normalizedText: ruleResult.normalizedText,
          details: {
            ruleCheck: {
              valid: false,
              errors: ruleResult.errors,
            },
          },
          processingTime: Date.now() - startTime,
          source: 'unified',
        };
      }

      // 2단계: LLM 기반 검증 (선택적)
      if (!this.config.enableLLMValidation || !input.text) {
        return {
          valid: true,
          errors: [],
          normalizedText: ruleResult.normalizedText,
          details: {
            ruleCheck: {
              valid: true,
              errors: [],
            },
          },
          processingTime: Date.now() - startTime,
          source: 'unified',
        };
      }

      const textToCheck = ruleResult.normalizedText || input.text;

      // 병렬 또는 순차 실행
      let topicResult: TopicCheckResult;
      let jailbreakResult: JailbreakDetectionResult;

      if (this.config.parallelExecution) {
        [topicResult, jailbreakResult] = await Promise.all([
          checkTopic(textToCheck),
          detectJailbreak(textToCheck),
        ]);
      } else {
        topicResult = await checkTopic(textToCheck);
        jailbreakResult = await detectJailbreak(textToCheck);
      }

      // 탈옥 시도 확인
      if (jailbreakResult.isJailbreak &&
          jailbreakResult.confidence >= this.config.jailbreakConfidenceThreshold) {
        errors.push('부적절한 요청이 감지되었습니다.');
        logger.warn('Jailbreak attempt blocked', {
          type: jailbreakResult.type,
          confidence: jailbreakResult.confidence,
        });
      }

      // 주제 관련성 확인
      if (!topicResult.isRelevant &&
          topicResult.confidence >= this.config.topicConfidenceThreshold) {
        errors.push('전기기사 시험과 관련 없는 질문입니다. 전기 관련 문제를 입력해주세요.');
        logger.info('Off-topic question blocked', {
          category: topicResult.category,
          confidence: topicResult.confidence,
        });
      }

      return {
        valid: errors.length === 0,
        errors,
        normalizedText: ruleResult.normalizedText,
        details: {
          ruleCheck: {
            valid: true,
            errors: [],
          },
          topicCheck: topicResult,
          jailbreakCheck: jailbreakResult,
        },
        processingTime: Date.now() - startTime,
        source: 'unified',
      };
    } catch (error) {
      logger.error('Unified input validation failed', error as Error);

      // 폴백: 규칙 기반 검증만 사용
      const fallbackResult = ruleBasedValidateInput(input);

      return {
        valid: fallbackResult.valid,
        errors: fallbackResult.errors,
        normalizedText: fallbackResult.normalizedText,
        details: {
          ruleCheck: {
            valid: fallbackResult.valid,
            errors: fallbackResult.errors,
          },
        },
        processingTime: Date.now() - startTime,
        source: 'fallback',
      };
    }
  }

  /**
   * 통합 출력 검증
   *
   * 현재는 규칙 기반만 사용
   * 향후 LLM 기반 Fact Check 추가 가능
   */
  async validateOutput(output: {
    answer?: string;
    steps?: Array<{ order: number; title: string; content: string }>;
    formulas?: string[];
    confidence?: number;
    relatedKEC?: string[];
  }): Promise<UnifiedOutputValidation> {
    const startTime = Date.now();

    try {
      // 규칙 기반 검증
      const ruleResult = ruleBasedValidateOutput(output);

      return {
        valid: ruleResult.valid,
        warnings: ruleResult.warnings,
        corrections: ruleResult.corrections,
        details: {
          ruleCheck: {
            valid: ruleResult.valid,
            warnings: ruleResult.warnings,
            corrections: ruleResult.corrections,
          },
        },
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Unified output validation failed', error as Error);

      return {
        valid: true,
        warnings: ['검증 중 오류가 발생했습니다.'],
        corrections: [],
        details: {
          ruleCheck: {
            valid: true,
            warnings: [],
            corrections: [],
          },
        },
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 텍스트 정규화 (유틸리티)
   */
  normalizeText(text: string): string {
    return normalizeText(text);
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<UnifiedGuardrailsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): UnifiedGuardrailsConfig {
    return { ...this.config };
  }
}

// =====================================
// Singleton & Convenience Functions
// =====================================

let unifiedGuardrailsInstance: UnifiedGuardrails | null = null;

export function getUnifiedGuardrails(config?: Partial<UnifiedGuardrailsConfig>): UnifiedGuardrails {
  if (!unifiedGuardrailsInstance) {
    unifiedGuardrailsInstance = new UnifiedGuardrails(config);
  } else if (config) {
    unifiedGuardrailsInstance.updateConfig(config);
  }
  return unifiedGuardrailsInstance;
}

export function resetUnifiedGuardrails(): void {
  unifiedGuardrailsInstance = null;
}

/**
 * 간편 입력 검증 함수
 */
export async function validateInputUnified(input: {
  text?: string;
  imageBase64?: string;
}): Promise<UnifiedInputValidation> {
  const guardrails = getUnifiedGuardrails();
  return guardrails.validateInput(input);
}

/**
 * 간편 출력 검증 함수
 */
export async function validateOutputUnified(output: {
  answer?: string;
  steps?: Array<{ order: number; title: string; content: string }>;
  formulas?: string[];
  confidence?: number;
  relatedKEC?: string[];
}): Promise<UnifiedOutputValidation> {
  const guardrails = getUnifiedGuardrails();
  return guardrails.validateOutput(output);
}

// 기본 인스턴스 export
export const unifiedGuardrails = getUnifiedGuardrails();
