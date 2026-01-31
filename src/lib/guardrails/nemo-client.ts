/**
 * NeMo Guardrails API 클라이언트
 *
 * NeMo Guardrails 서버와 통신하며, 연결 실패 시 로컬 폴백을 사용합니다.
 */

import { logger } from '../api/logger';
import {
  validateInput as localValidateInput,
  validateOutput as localValidateOutput,
  normalizeText,
} from './config';
import {
  NemoClientConfig,
  NemoInputValidationRequest,
  NemoInputValidationResponse,
  NemoOutputValidationRequest,
  NemoOutputValidationResponse,
  NemoHealthStatus,
  NemoApiResponse,
  NemoErrorCode,
  ValidationResultWithSource,
  ValidationSource,
  DEFAULT_NEMO_CLIENT_CONFIG,
} from './types';

/**
 * NeMo Guardrails API 클라이언트
 */
export class NemoGuardrailsClient {
  private config: NemoClientConfig;
  private healthStatus: NemoHealthStatus | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<NemoClientConfig>) {
    this.config = {
      ...DEFAULT_NEMO_CLIENT_CONFIG,
      ...config,
      baseUrl: config?.baseUrl || process.env.NEMO_GUARDRAILS_URL || DEFAULT_NEMO_CLIENT_CONFIG.baseUrl,
    };

    logger.debug('NeMo Guardrails client initialized', {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      enableFallback: this.config.enableFallback,
    });
  }

  // ============================================================================
  // 입력 검증
  // ============================================================================

  /**
   * 입력 검증 수행
   * NeMo 서버 실패 시 로컬 폴백 사용
   */
  async validateInput(
    request: NemoInputValidationRequest
  ): Promise<ValidationResultWithSource<NemoInputValidationResponse>> {
    const startTime = Date.now();

    try {
      // NeMo 서버로 검증 요청
      const response = await this.sendRequest<
        NemoInputValidationRequest,
        NemoInputValidationResponse
      >('/v1/validate/input', request);

      if (response.success && response.data) {
        logger.debug('NeMo input validation successful', {
          valid: response.data.valid,
          processingTime: Date.now() - startTime,
        });

        return {
          result: response.data,
          source: 'nemo',
        };
      }

      // 서버 응답은 있지만 실패한 경우
      throw new Error(response.error || 'Unknown validation error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 폴백 활성화 시 로컬 검증 사용
      if (this.config.enableFallback) {
        logger.warn('NeMo validation failed, using fallback', {
          error: errorMessage,
        });

        return {
          result: this.fallbackValidateInput(request),
          source: 'fallback',
          fallbackReason: errorMessage,
        };
      }

      // 폴백 비활성화 시 오류 반환
      return {
        result: {
          valid: false,
          errors: [`Guardrails 서버 오류: ${errorMessage}`],
        },
        source: 'nemo',
      };
    }
  }

  /**
   * 로컬 폴백 입력 검증 (config.ts 활용)
   */
  private fallbackValidateInput(
    request: NemoInputValidationRequest
  ): NemoInputValidationResponse {
    const result = localValidateInput({
      text: request.text,
      imageBase64: request.imageBase64,
    });

    return {
      valid: result.valid,
      errors: result.errors,
      normalizedText: result.normalizedText,
      blockedCategory: !result.valid ? this.categorizeError(result.errors) : undefined,
      suggestion: !result.valid ? this.getSuggestion(result.errors) : undefined,
      metadata: {
        processingTime: 0,
        appliedRails: ['fallback_local_validation'],
      },
    };
  }

  // ============================================================================
  // 출력 검증
  // ============================================================================

  /**
   * 출력 검증 수행
   * NeMo 서버 실패 시 로컬 폴백 사용
   */
  async validateOutput(
    request: NemoOutputValidationRequest
  ): Promise<ValidationResultWithSource<NemoOutputValidationResponse>> {
    const startTime = Date.now();

    try {
      // NeMo 서버로 검증 요청
      const response = await this.sendRequest<
        NemoOutputValidationRequest,
        NemoOutputValidationResponse
      >('/v1/validate/output', request);

      if (response.success && response.data) {
        logger.debug('NeMo output validation successful', {
          valid: response.data.valid,
          warningCount: response.data.warnings.length,
          processingTime: Date.now() - startTime,
        });

        return {
          result: response.data,
          source: 'nemo',
        };
      }

      throw new Error(response.error || 'Unknown validation error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.config.enableFallback) {
        logger.warn('NeMo output validation failed, using fallback', {
          error: errorMessage,
        });

        return {
          result: this.fallbackValidateOutput(request),
          source: 'fallback',
          fallbackReason: errorMessage,
        };
      }

      return {
        result: {
          valid: true, // 출력 검증 실패 시 일단 통과 (사용자 경험 우선)
          warnings: [`Guardrails 검증을 수행할 수 없습니다: ${errorMessage}`],
          corrections: [],
        },
        source: 'nemo',
      };
    }
  }

  /**
   * 로컬 폴백 출력 검증 (config.ts 활용)
   */
  private fallbackValidateOutput(
    request: NemoOutputValidationRequest
  ): NemoOutputValidationResponse {
    const result = localValidateOutput({
      answer: request.answer,
      steps: request.steps,
      formulas: request.formulas,
      confidence: request.confidence,
      relatedKEC: request.relatedKEC,
    });

    return {
      valid: result.valid,
      warnings: result.warnings,
      corrections: result.corrections,
      metadata: {
        processingTime: 0,
        appliedRails: ['fallback_local_validation'],
      },
    };
  }

  // ============================================================================
  // 헬스 체크
  // ============================================================================

  /**
   * NeMo 서버 상태 확인
   */
  async checkHealth(): Promise<NemoHealthStatus> {
    const startTime = Date.now();

    try {
      const response = await this.sendRequest<void, { status: string; version?: string; rails?: string[] }>(
        '/health',
        undefined,
        'GET'
      );

      this.healthStatus = {
        available: response.success,
        version: response.data?.version,
        loadedRails: response.data?.rails,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
      };
    } catch {
      this.healthStatus = {
        available: false,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
      };
    }

    logger.debug('NeMo health check completed', {
      available: this.healthStatus.available,
      responseTime: this.healthStatus.responseTime,
    });

    return this.healthStatus;
  }

  /**
   * 캐시된 헬스 상태 반환
   */
  getHealthStatus(): NemoHealthStatus | null {
    return this.healthStatus;
  }

  /**
   * 서버 가용 여부 확인
   */
  async isAvailable(): Promise<boolean> {
    // 최근 체크가 30초 이내라면 캐시 사용
    if (
      this.healthStatus &&
      Date.now() - this.healthStatus.lastChecked.getTime() < 30000
    ) {
      return this.healthStatus.available;
    }

    const status = await this.checkHealth();
    return status.available;
  }

  /**
   * 주기적 헬스 체크 시작
   */
  startHealthMonitoring(intervalMs = 60000): void {
    if (this.healthCheckInterval) {
      this.stopHealthMonitoring();
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch((error) => {
        logger.warn('Health check failed', { error: error instanceof Error ? error.message : 'Unknown' });
      });
    }, intervalMs);

    // 즉시 첫 번째 체크 수행
    this.checkHealth().catch(() => {});
  }

  /**
   * 주기적 헬스 체크 중지
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ============================================================================
  // HTTP 요청 헬퍼
  // ============================================================================

  /**
   * NeMo 서버로 HTTP 요청 전송
   */
  private async sendRequest<TRequest, TResponse>(
    endpoint: string,
    data?: TRequest,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<NemoApiResponse<TResponse>> {
    const url = `${this.config.baseUrl}${endpoint}`;

    let lastError: Error | null = null;
    const retryCount = this.config.retryCount ?? DEFAULT_NEMO_CLIENT_CONFIG.retryCount!;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout
        );

        const requestOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
          },
          signal: controller.signal,
        };

        if (method === 'POST' && data) {
          requestOptions.body = JSON.stringify(data);
        }

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'No error body');
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

        const responseData = await response.json();

        return {
          success: true,
          data: responseData,
          meta: {
            serverVersion: response.headers.get('X-Nemo-Version') || undefined,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // AbortError는 타임아웃
        if (lastError.name === 'AbortError') {
          lastError = new Error('Request timeout');
        }

        logger.debug(`NeMo request attempt ${attempt + 1} failed`, {
          endpoint,
          error: lastError.message,
        });

        // 마지막 시도가 아니면 재시도 대기
        if (attempt < retryCount) {
          await this.delay(this.config.retryDelay ?? DEFAULT_NEMO_CLIENT_CONFIG.retryDelay!);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed after retries',
      errorCode: this.classifyError(lastError),
    };
  }

  /**
   * 오류 코드 분류
   */
  private classifyError(error: Error | null): NemoErrorCode {
    if (!error) return 'UNKNOWN';

    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('abort')) {
      return 'TIMEOUT';
    }
    if (message.includes('fetch') || message.includes('network') || message.includes('econnrefused')) {
      return 'CONNECTION_ERROR';
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return 'RATE_LIMITED';
    }
    if (message.includes('5')) {
      return 'SERVER_ERROR';
    }
    if (message.includes('4')) {
      return 'INVALID_REQUEST';
    }

    return 'UNKNOWN';
  }

  /**
   * 오류 메시지에서 차단 카테고리 추출
   */
  private categorizeError(errors: string[]): NemoInputValidationResponse['blockedCategory'] {
    const combined = errors.join(' ').toLowerCase();

    if (combined.includes('짧')) return 'too_short';
    if (combined.includes('길')) return 'too_long';
    if (combined.includes('부적절')) return 'blocked';
    if (combined.includes('이미지')) return 'invalid_image';

    return 'blocked';
  }

  /**
   * 오류 메시지에 대한 사용자 친화적 제안 생성
   */
  private getSuggestion(errors: string[]): string {
    const combined = errors.join(' ');

    if (combined.includes('짧')) {
      return '좀 더 구체적으로 질문해 주세요.';
    }
    if (combined.includes('길')) {
      return '질문을 2000자 이내로 줄여주세요.';
    }
    if (combined.includes('부적절')) {
      return '전기기사 실기 관련 질문을 해주세요.';
    }
    if (combined.includes('이미지')) {
      return 'JPEG, PNG, WebP 형식의 10MB 이하 이미지를 사용해주세요.';
    }

    return '전기기사 실기 관련 질문을 입력해주세요.';
  }

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // 편의 메서드 (기존 config.ts와의 호환성)
  // ============================================================================

  /**
   * 텍스트 정규화 (로컬에서 수행)
   */
  normalizeText(text: string): string {
    return normalizeText(text);
  }
}

// ============================================================================
// 싱글톤 인스턴스
// ============================================================================

let clientInstance: NemoGuardrailsClient | null = null;

/**
 * 싱글톤 NeMo 클라이언트 인스턴스 반환
 */
export function getNemoClient(config?: Partial<NemoClientConfig>): NemoGuardrailsClient {
  if (!clientInstance) {
    clientInstance = new NemoGuardrailsClient(config);
  }
  return clientInstance;
}

/**
 * 클라이언트 인스턴스 재설정 (테스트용)
 */
export function resetNemoClient(): void {
  if (clientInstance) {
    clientInstance.stopHealthMonitoring();
    clientInstance = null;
  }
}

// ============================================================================
// 편의 함수 (기존 config.ts 인터페이스와 호환)
// ============================================================================

/**
 * 입력 검증 (NeMo + 폴백)
 * 기존 config.ts의 validateInput과 호환되는 인터페이스
 */
export async function validateInputWithNemo(input: {
  text?: string;
  imageBase64?: string;
}): Promise<{
  valid: boolean;
  errors: string[];
  normalizedText?: string;
  source: ValidationSource;
}> {
  const client = getNemoClient();
  const result = await client.validateInput(input);

  return {
    valid: result.result.valid,
    errors: result.result.errors,
    normalizedText: result.result.normalizedText,
    source: result.source,
  };
}

/**
 * 출력 검증 (NeMo + 폴백)
 * 기존 config.ts의 validateOutput과 호환되는 인터페이스
 */
export async function validateOutputWithNemo(output: {
  answer?: string;
  steps?: Array<{ order: number; title: string; content: string }>;
  formulas?: string[];
  confidence?: number;
  relatedKEC?: string[];
}): Promise<{
  valid: boolean;
  warnings: string[];
  corrections: string[];
  source: ValidationSource;
}> {
  const client = getNemoClient();
  const result = await client.validateOutput(output);

  return {
    valid: result.result.valid,
    warnings: result.result.warnings,
    corrections: result.result.corrections,
    source: result.source,
  };
}

// ValidationSource 타입 re-export (types.ts에서 이미 정의됨)
