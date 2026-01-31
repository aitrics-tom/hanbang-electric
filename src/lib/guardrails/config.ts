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

  // 최소 입력 길이
  minLength: 10,
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
 * 입력 검증 함수
 */
export function validateInput(input: {
  text?: string;
  imageBase64?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 텍스트 검증
  if (input.text) {
    if (input.text.length < INPUT_RAILS.minLength) {
      errors.push('질문이 너무 짧습니다. 10자 이상 입력해주세요.');
    }
    if (input.text.length > INPUT_RAILS.maxLength) {
      errors.push('질문이 너무 깁니다. 2000자 이하로 입력해주세요.');
    }

    // 차단 패턴 검사
    for (const pattern of INPUT_RAILS.topical.blocked_patterns) {
      if (pattern.test(input.text)) {
        errors.push('부적절한 내용이 포함되어 있습니다.');
        break;
      }
    }

    // 관련 주제 검사
    const hasRelevantTopic = INPUT_RAILS.topical.allowed_topics.some(
      (topic) => input.text!.includes(topic)
    );
    // 키워드가 없어도 허용 (OCR 결과 등)
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

  return { valid: errors.length === 0, errors };
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

  // 신뢰도 검증
  if (output.confidence && output.confidence < OUTPUT_RAILS.quality.minConfidence) {
    warnings.push(`신뢰도가 낮습니다 (${(output.confidence * 100).toFixed(0)}%). 전문가 확인을 권장합니다.`);
  }

  // KEC 규정 검증
  if (OUTPUT_RAILS.kecValidation.enabled && output.relatedKEC) {
    for (const kec of output.relatedKEC) {
      const kecKey = kec.replace(' ', '_').toUpperCase();
      if (!kecDatabase.regulations[kecKey as keyof typeof kecDatabase.regulations]) {
        warnings.push(`KEC ${kec} 규정을 확인할 수 없습니다.`);
      }
    }
  }

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
  } catch (error) {
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
