/**
 * NeMo Guardrails 설정
 * 입력/출력 검증 및 안전장치
 */

import kecDatabase from './kec-database.json';
import formulaWhitelist from './formula-whitelist.json';

// 입력 검증 규칙
export const INPUT_RAILS = {
  // 전기기사 관련 질문만 허용
  topical: {
    allowed_topics: [
      '전기설비',
      '전기공사',
      '전력계통',
      '시퀀스',
      'PLC',
      '조명',
      '역률',
      '변압기',
      '접지',
      'KEC',
      '전기기사',
      '수변전',
      '배선',
      '단락',
      '과전류',
      '누전',
    ],
    blocked_patterns: [
      /욕설|비속어|공격적/i,
      /개인정보|주민등록|전화번호/i,
      /해킹|크래킹|불법/i,
    ],
  },

  // 최소 입력 길이 (텍스트 입력 관용성 향상)
  minLength: 3, // 짧은 질문도 허용 (예: "역률?", "PLC?")
  maxLength: 2000,

  // 이미지 검증
  image: {
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
  },
};

// 출력 검증 규칙
export const OUTPUT_RAILS = {
  // 응답 품질 기준
  quality: {
    minConfidence: 0.7,
    requiredFields: ['answer', 'steps', 'formulas'],
  },

  // KEC 규정 검증
  kecValidation: {
    enabled: true,
    database: kecDatabase,
  },

  // 공식 검증
  formulaValidation: {
    enabled: true,
    whitelist: formulaWhitelist,
  },

  // 계산 검증
  calculationValidation: {
    enabled: true,
    tolerancePercent: 1, // 1% 오차 허용
  },

  // 단위 검증
  unitValidation: {
    enabled: true,
    siUnits: ['V', 'A', 'W', 'Ω', 'F', 'H', 'lx', 'lm', 'cd', 'm', 'mm²', 'kVA', 'kVar', 'kW'],
  },
};

/**
 * 텍스트 정규화 함수 - 단위 오류, 오타, 누락 보정
 */
export function normalizeText(text: string): string {
  let normalized = text.trim();

  // 1. 단위 정규화 (한글 → 표준 기호)
  const unitMappings: [RegExp, string][] = [
    [/럭스/g, 'lx'],
    [/루멘/g, 'lm'],
    [/칸델라/g, 'cd'],
    [/킬로와트/g, 'kW'],
    [/와트/g, 'W'],
    [/볼트/g, 'V'],
    [/암페어/g, 'A'],
    [/옴/g, 'Ω'],
    [/제곱미터/g, 'm²'],
    [/평방미터/g, 'm²'],
    [/키로바/g, 'kVA'],
    [/케이브이에이/g, 'kVA'],
    [/키로바르/g, 'kVar'],
    [/케이바르/g, 'kVar'],
    [/퍼센트/g, '%'],
    [/프로/g, '%'],
  ];
  for (const [pattern, replacement] of unitMappings) {
    normalized = normalized.replace(pattern, replacement);
  }

  // 2. 흔한 오타 수정
  const typoMappings: [RegExp, string][] = [
    [/역율/g, '역률'],
    [/역률개선/g, '역률 개선'],
    [/조명율/g, '조명률'],
    [/전압강하율/g, '전압강하율'],
    [/임피던스/g, '임피던스'],
    [/인피던스/g, '임피던스'],
    [/변압기용량/g, '변압기 용량'],
    [/단락전류/g, '단락 전류'],
    [/코사인/g, 'cosθ'],
    [/코싸인/g, 'cosθ'],
    [/사인/g, 'sinθ'],
    [/탄젠트/g, 'tanθ'],
    [/파이/g, 'π'],
    [/루트/g, '√'],
  ];
  for (const [pattern, replacement] of typoMappings) {
    normalized = normalized.replace(pattern, replacement);
  }

  // 3. 약어 확장
  const abbreviationMappings: [RegExp, string][] = [
    [/pf\s*=?\s*(\d)/gi, '역률 $1'],
    [/cos\s*=?\s*(\d)/gi, 'cosθ = $1'],
  ];
  for (const [pattern, replacement] of abbreviationMappings) {
    normalized = normalized.replace(pattern, replacement);
  }

  // 4. 공백 정규화
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * 입력 검증 함수
 */
export function validateInput(input: {
  text?: string;
  imageBase64?: string;
}): { valid: boolean; errors: string[]; normalizedText?: string } {
  const errors: string[] = [];
  let normalizedText: string | undefined;

  // 텍스트 검증
  if (input.text) {
    // 먼저 정규화 수행
    normalizedText = normalizeText(input.text);

    if (normalizedText.length < INPUT_RAILS.minLength) {
      errors.push('질문이 너무 짧습니다. 좀 더 구체적으로 입력해주세요.');
    }
    if (normalizedText.length > INPUT_RAILS.maxLength) {
      errors.push('질문이 너무 깁니다. 2000자 이하로 입력해주세요.');
    }

    // 차단 패턴 검사
    for (const pattern of INPUT_RAILS.topical.blocked_patterns) {
      if (pattern.test(normalizedText)) {
        errors.push('부적절한 내용이 포함되어 있습니다.');
        break;
      }
    }

    // 관련 주제 검사 (키워드가 없어도 허용 - OCR 결과 등)
    const _hasRelevantTopic = INPUT_RAILS.topical.allowed_topics.some(
      (topic) => normalizedText!.includes(topic)
    );
  }

  // 이미지 검증
  if (input.imageBase64) {
    // Base64 크기 추정 (원본의 약 1.37배)
    const estimatedSize = (input.imageBase64.length * 3) / 4;
    if (estimatedSize > INPUT_RAILS.image.maxSizeBytes) {
      errors.push('이미지 크기가 10MB를 초과합니다.');
    }
  }

  // 텍스트나 이미지 중 하나는 필요
  if (!input.text && !input.imageBase64) {
    errors.push('문제 텍스트 또는 이미지를 입력해주세요.');
  }

  return { valid: errors.length === 0, errors, normalizedText };
}

/**
 * 출력 검증 함수
 */
export function validateOutput(output: {
  answer?: string;
  steps?: Array<{ order: number; title: string; content: string }>;
  formulas?: string[];
  confidence?: number;
  relatedKEC?: string[];
}): {
  valid: boolean;
  warnings: string[];
  corrections: string[];
} {
  const warnings: string[] = [];
  const corrections: string[] = [];

  // 필수 필드 검증
  for (const field of OUTPUT_RAILS.quality.requiredFields) {
    if (!output[field as keyof typeof output]) {
      warnings.push(`${field} 필드가 누락되었습니다.`);
    }
  }

  // 신뢰도 검증 - 비활성화 (에이전트 판단 신뢰)
  // 신뢰도 경고를 표시하지 않음

  // KEC 규정 검증 - 완전 비활성화 (에이전트 판단 전적으로 신뢰)
  // 에이전트가 KEC 코드를 인용했다면 그 판단을 신뢰합니다.
  // 경고 메시지를 생성하지 않습니다.

  // 답안 형식 검증
  if (output.answer) {
    // 단위가 포함되어 있는지 확인
    const hasUnit = OUTPUT_RAILS.unitValidation.siUnits.some((unit) =>
      output.answer!.includes(unit)
    );
    if (!hasUnit && /\d/.test(output.answer)) {
      warnings.push('답에 단위가 누락된 것 같습니다.');
    }
  }

  return {
    valid: corrections.length === 0,
    warnings,
    corrections,
  };
}

/**
 * 계산 검증 함수
 */
export function verifyCalculation(
  formula: string,
  inputs: Record<string, number>,
  expectedResult: number
): {
  valid: boolean;
  calculatedResult?: number;
  error?: string;
} {
  try {
    // 광속법 검증 예시
    if (formula.includes('N = (E × A × M) / (F × U)') || formula.includes('N = EAM/FU')) {
      const { E, A, M, F, U } = inputs;
      if (E && A && M && F && U) {
        const calculated = (E * A * M) / (F * U);
        const rounded = Math.ceil(calculated);
        const tolerance = expectedResult * (OUTPUT_RAILS.calculationValidation.tolerancePercent / 100);

        if (Math.abs(rounded - expectedResult) <= tolerance) {
          return { valid: true, calculatedResult: rounded };
        } else {
          return {
            valid: false,
            calculatedResult: rounded,
            error: `계산 결과 불일치: 예상 ${expectedResult}, 계산 ${rounded}`,
          };
        }
      }
    }

    // 전압강하 검증
    if (formula.includes('e = (K × L × I) / A') || formula.includes('e = KLI/A')) {
      const { K, L, I, A } = inputs;
      if (K && L && I && A) {
        const calculated = (K * L * I) / A;
        const tolerance = expectedResult * (OUTPUT_RAILS.calculationValidation.tolerancePercent / 100);

        if (Math.abs(calculated - expectedResult) <= tolerance) {
          return { valid: true, calculatedResult: calculated };
        } else {
          return {
            valid: false,
            calculatedResult: calculated,
            error: `계산 결과 불일치: 예상 ${expectedResult}, 계산 ${calculated.toFixed(2)}`,
          };
        }
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: '계산 검증 중 오류 발생' };
  }
}

/**
 * KEC 규정 조회
 */
export function getKECRegulation(code: string): {
  found: boolean;
  regulation?: (typeof kecDatabase.regulations)[keyof typeof kecDatabase.regulations];
} {
  const kecKey = code.replace(' ', '_').toUpperCase() as keyof typeof kecDatabase.regulations;
  const regulation = kecDatabase.regulations[kecKey];

  return {
    found: !!regulation,
    regulation,
  };
}

/**
 * 공식 조회
 */
export function getFormula(category: string, formulaName: string): {
  found: boolean;
  formula?: (typeof formulaWhitelist.categories)[keyof typeof formulaWhitelist.categories]['formulas'][0];
} {
  const categoryData = formulaWhitelist.categories[category as keyof typeof formulaWhitelist.categories];
  if (!categoryData) {
    return { found: false };
  }

  const formula = categoryData.formulas.find((f) => f.name.includes(formulaName));
  return {
    found: !!formula,
    formula,
  };
}

export { kecDatabase, formulaWhitelist };
