/**
 * NeMo Guardrails Types
 * NeMo Guardrails 서버와의 통신을 위한 타입 정의
 */

// ============================================================================
// 입력 검증 (Input Validation) 타입
// ============================================================================

/**
 * NeMo 입력 검증 요청
 */
export interface NemoInputValidationRequest {
  /** 검증할 텍스트 */
  text?: string;
  /** 검증할 이미지 (Base64 인코딩) */
  imageBase64?: string;
  /** 사용자 ID (컨텍스트용) */
  userId?: string;
  /** 세션 ID (컨텍스트용) */
  sessionId?: string;
}

/**
 * NeMo 입력 검증 응답
 */
export interface NemoInputValidationResponse {
  /** 검증 통과 여부 */
  valid: boolean;
  /** 정규화된 텍스트 (선택적) */
  normalizedText?: string;
  /** 차단 사유 */
  blockedReason?: string;
  /** 차단 카테고리 */
  blockedCategory?: InputBlockedCategory;
  /** 오류 목록 */
  errors: string[];
  /** 사용자에게 표시할 제안 */
  suggestion?: string;
  /** 메타데이터 */
  metadata?: {
    /** 처리 시간 (ms) */
    processingTime?: number;
    /** NeMo 서버에서 적용된 레일 */
    appliedRails?: string[];
  };
}

/**
 * 입력 차단 카테고리
 */
export type InputBlockedCategory =
  | 'blocked'      // 유해/불법 콘텐츠
  | 'off_topic'    // 주제 이탈
  | 'jailbreak'    // 프롬프트 인젝션 시도
  | 'spam'         // 스팸/반복
  | 'too_short'    // 너무 짧은 입력
  | 'too_long'     // 너무 긴 입력
  | 'invalid_image'; // 이미지 검증 실패

// ============================================================================
// 출력 검증 (Output Validation) 타입
// ============================================================================

/**
 * 풀이 단계 (기존 config.ts와 호환)
 */
export interface SolutionStep {
  order: number;
  title: string;
  content: string;
}

/**
 * NeMo 출력 검증 요청
 */
export interface NemoOutputValidationRequest {
  /** 최종 답안 */
  answer?: string;
  /** 풀이 단계 */
  steps?: SolutionStep[];
  /** 사용된 공식 */
  formulas?: string[];
  /** AI 신뢰도 (0-1) */
  confidence?: number;
  /** 관련 KEC 규정 코드 */
  relatedKEC?: string[];
  /** 원본 질문 (컨텍스트) */
  originalQuestion?: string;
}

/**
 * NeMo 출력 검증 응답
 */
export interface NemoOutputValidationResponse {
  /** 검증 통과 여부 (중대 오류 없음) */
  valid: boolean;
  /** 경고 메시지 목록 */
  warnings: string[];
  /** 자동 수정 제안 */
  corrections: string[];
  /** KEC 규정 검증 결과 */
  kecValidation?: KECValidationResult;
  /** 계산 검증 결과 */
  calculationValidation?: CalculationValidationResult;
  /** 메타데이터 */
  metadata?: {
    /** 처리 시간 (ms) */
    processingTime?: number;
    /** NeMo 서버에서 적용된 레일 */
    appliedRails?: string[];
  };
}

/**
 * KEC 규정 검증 결과
 */
export interface KECValidationResult {
  /** 검증된 KEC 코드 목록 */
  validatedCodes: string[];
  /** 찾을 수 없는 KEC 코드 */
  unknownCodes: string[];
  /** 가능한 KEC 제안 */
  suggestions?: Array<{
    code: string;
    title: string;
    similarity: number;
  }>;
}

/**
 * 계산 검증 결과
 */
export interface CalculationValidationResult {
  /** 검증 수행 여부 */
  performed: boolean;
  /** 모든 계산 정확 여부 */
  allCorrect: boolean;
  /** 개별 검증 결과 */
  details?: Array<{
    formula: string;
    expected: number;
    calculated: number;
    isCorrect: boolean;
    tolerance: number;
  }>;
}

// ============================================================================
// NeMo 서버 통신 타입
// ============================================================================

/**
 * NeMo API 요청 래퍼
 */
export interface NemoApiRequest<T> {
  /** 요청 타입 */
  type: 'input_validation' | 'output_validation' | 'health_check';
  /** 요청 데이터 */
  data: T;
  /** 타임아웃 (ms) */
  timeout?: number;
}

/**
 * NeMo API 응답 래퍼
 */
export interface NemoApiResponse<T> {
  /** 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data?: T;
  /** 오류 메시지 */
  error?: string;
  /** 오류 코드 */
  errorCode?: NemoErrorCode;
  /** 메타데이터 */
  meta?: {
    /** 서버 버전 */
    serverVersion?: string;
    /** 처리 시간 */
    processingTime?: number;
  };
}

/**
 * NeMo 오류 코드
 */
export type NemoErrorCode =
  | 'CONNECTION_ERROR'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

// ============================================================================
// 클라이언트 설정 타입
// ============================================================================

/**
 * NeMo 클라이언트 설정
 */
export interface NemoClientConfig {
  /** NeMo Guardrails 서버 URL */
  baseUrl: string;
  /** 요청 타임아웃 (ms) */
  timeout?: number;
  /** 재시도 횟수 */
  retryCount?: number;
  /** 재시도 딜레이 (ms) */
  retryDelay?: number;
  /** 폴백 활성화 여부 */
  enableFallback?: boolean;
  /** API 키 (선택적) */
  apiKey?: string;
}

/**
 * 기본 클라이언트 설정
 */
export const DEFAULT_NEMO_CLIENT_CONFIG: NemoClientConfig = {
  baseUrl: process.env.NEMO_GUARDRAILS_URL || 'http://localhost:8000',
  timeout: 5000,
  retryCount: 2,
  retryDelay: 500,
  enableFallback: true,
};

// ============================================================================
// 폴백 관련 타입
// ============================================================================

/**
 * 검증 결과 소스
 */
export type ValidationSource = 'nemo' | 'fallback';

/**
 * 검증 결과 래퍼 (소스 정보 포함)
 */
export interface ValidationResultWithSource<T> {
  /** 검증 결과 */
  result: T;
  /** 결과 소스 */
  source: ValidationSource;
  /** 폴백 사유 (폴백인 경우) */
  fallbackReason?: string;
}

// ============================================================================
// 헬스 체크 타입
// ============================================================================

/**
 * NeMo 서버 상태
 */
export interface NemoHealthStatus {
  /** 서버 가용 여부 */
  available: boolean;
  /** 서버 버전 */
  version?: string;
  /** 응답 시간 (ms) */
  responseTime?: number;
  /** 로드된 레일 */
  loadedRails?: string[];
  /** 마지막 체크 시간 */
  lastChecked: Date;
}
