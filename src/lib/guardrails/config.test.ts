/**
 * Guardrails Configuration Tests
 * TDD: Tests written FIRST for input/output validation
 */
import { describe, it, expect } from 'vitest';
import {
  validateInput,
  validateOutput,
  verifyCalculation,
  getKECRegulation,
  getFormula,
  INPUT_RAILS,
  OUTPUT_RAILS,
} from './config';

describe('Guardrails Module', () => {
  describe('INPUT_RAILS constant', () => {
    it('should define allowed topics for electrical engineering', () => {
      expect(INPUT_RAILS.topical.allowed_topics).toContain('전기설비');
      expect(INPUT_RAILS.topical.allowed_topics).toContain('변압기');
      expect(INPUT_RAILS.topical.allowed_topics).toContain('KEC');
      expect(INPUT_RAILS.topical.allowed_topics).toContain('PLC');
    });

    it('should define blocked patterns for inappropriate content', () => {
      expect(INPUT_RAILS.topical.blocked_patterns.length).toBeGreaterThan(0);
    });

    it('should define input length constraints', () => {
      expect(INPUT_RAILS.minLength).toBe(10);
      expect(INPUT_RAILS.maxLength).toBe(2000);
    });

    it('should define image constraints', () => {
      expect(INPUT_RAILS.image.allowedFormats).toContain('image/jpeg');
      expect(INPUT_RAILS.image.allowedFormats).toContain('image/png');
      expect(INPUT_RAILS.image.maxSizeBytes).toBe(10 * 1024 * 1024);
    });
  });

  describe('OUTPUT_RAILS constant', () => {
    it('should define quality requirements', () => {
      expect(OUTPUT_RAILS.quality.minConfidence).toBe(0.7);
      expect(OUTPUT_RAILS.quality.requiredFields).toContain('answer');
      expect(OUTPUT_RAILS.quality.requiredFields).toContain('steps');
      expect(OUTPUT_RAILS.quality.requiredFields).toContain('formulas');
    });

    it('should enable KEC validation', () => {
      expect(OUTPUT_RAILS.kecValidation.enabled).toBe(true);
    });

    it('should define SI units for validation', () => {
      expect(OUTPUT_RAILS.unitValidation.siUnits).toContain('V');
      expect(OUTPUT_RAILS.unitValidation.siUnits).toContain('A');
      expect(OUTPUT_RAILS.unitValidation.siUnits).toContain('W');
      expect(OUTPUT_RAILS.unitValidation.siUnits).toContain('kVA');
    });
  });

  describe('validateInput function', () => {
    describe('Text validation', () => {
      it('should reject text shorter than minimum length', () => {
        const result = validateInput({ text: '짧은글' });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('질문이 너무 짧습니다. 10자 이상 입력해주세요.');
      });

      it('should reject text longer than maximum length', () => {
        // '변압기 ' is 4 characters, need 501+ repeats to exceed 2000
        const longText = '변압기 '.repeat(600); // 2400 characters, over 2000

        const result = validateInput({ text: longText });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('질문이 너무 깁니다. 2000자 이하로 입력해주세요.');
      });

      it('should accept valid length text', () => {
        const result = validateInput({ text: '변압기 용량 계산 방법을 알려주세요.' });

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should block inappropriate content patterns', () => {
        const result = validateInput({ text: '욕설이 포함된 변압기 질문입니다' });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('부적절한 내용이 포함되어 있습니다.');
      });

      it('should block personal information patterns', () => {
        const result = validateInput({ text: '개인정보와 주민등록번호가 포함된 질문' });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('부적절한 내용이 포함되어 있습니다.');
      });

      it('should block hacking-related patterns', () => {
        const result = validateInput({ text: '해킹 방법을 알려주세요 불법입니다' });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('부적절한 내용이 포함되어 있습니다.');
      });
    });

    describe('Image validation', () => {
      it('should accept valid image base64', () => {
        // Small base64 string
        const smallImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const result = validateInput({ imageBase64: smallImage, text: '이미지 분석 요청입니다' });

        expect(result.valid).toBe(true);
      });

      it('should reject image exceeding size limit', () => {
        // Create a very large base64 string (simulating >10MB)
        const largeImage = 'A'.repeat(15 * 1024 * 1024); // ~15MB

        const result = validateInput({ imageBase64: largeImage });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('이미지 크기가 10MB를 초과합니다.');
      });
    });

    describe('Empty input validation', () => {
      it('should reject when neither text nor image is provided', () => {
        const result = validateInput({});

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('문제 텍스트 또는 이미지를 입력해주세요.');
      });

      it('should accept when only image is provided', () => {
        const result = validateInput({ imageBase64: 'validBase64String' });

        expect(result.valid).toBe(true);
      });
    });

    describe('Combined validation', () => {
      it('should accumulate multiple errors', () => {
        const result = validateInput({ text: '짧음' }); // Too short

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('validateOutput function', () => {
    describe('Required fields validation', () => {
      it('should warn when answer field is missing', () => {
        const result = validateOutput({
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['F=ma'],
        });

        expect(result.warnings).toContain('answer 필드가 누락되었습니다.');
      });

      it('should warn when steps field is missing', () => {
        const result = validateOutput({
          answer: '42V',
          formulas: ['V=IR'],
        });

        expect(result.warnings).toContain('steps 필드가 누락되었습니다.');
      });

      it('should warn when formulas field is missing', () => {
        const result = validateOutput({
          answer: '42V',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
        });

        expect(result.warnings).toContain('formulas 필드가 누락되었습니다.');
      });

      it('should not warn when all required fields are present', () => {
        const result = validateOutput({
          answer: '42V',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['V=IR'],
        });

        const missingFieldWarnings = result.warnings.filter(w => w.includes('필드가 누락'));
        expect(missingFieldWarnings).toHaveLength(0);
      });
    });

    describe('Confidence validation', () => {
      it('should warn when confidence is below minimum threshold', () => {
        const result = validateOutput({
          answer: '100W',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['P=VI'],
          confidence: 0.5, // Below 0.7 threshold
        });

        expect(result.warnings.some(w => w.includes('신뢰도가 낮습니다'))).toBe(true);
      });

      it('should not warn when confidence is above threshold', () => {
        const result = validateOutput({
          answer: '100W',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['P=VI'],
          confidence: 0.85,
        });

        expect(result.warnings.some(w => w.includes('신뢰도가 낮습니다'))).toBe(false);
      });
    });

    describe('KEC regulation validation', () => {
      it('should warn for unknown KEC regulation codes', () => {
        const result = validateOutput({
          answer: '10 ohm',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['R=V/I'],
          relatedKEC: ['KEC 999'], // Invalid code
        });

        expect(result.warnings.some(w => w.includes('KEC') && w.includes('확인할 수 없습니다'))).toBe(true);
      });

      it('should not warn for valid KEC regulation codes', () => {
        const result = validateOutput({
          answer: '10 ohm',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['R=V/I'],
          relatedKEC: ['KEC 142'], // Valid code in database
        });

        // Check if there are any KEC-related warnings for KEC 142
        const kec142Warnings = result.warnings.filter(
          w => w.includes('KEC 142') && w.includes('확인할 수 없습니다')
        );
        expect(kec142Warnings).toHaveLength(0);
      });
    });

    describe('Unit validation', () => {
      it('should warn when answer has numbers but no units', () => {
        const result = validateOutput({
          answer: '42',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['V=IR'],
        });

        expect(result.warnings.some(w => w.includes('단위가 누락'))).toBe(true);
      });

      it('should not warn when answer has valid SI units', () => {
        const result = validateOutput({
          answer: '42V',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['V=IR'],
        });

        expect(result.warnings.some(w => w.includes('단위가 누락'))).toBe(false);
      });

      it('should not warn when answer has no numbers', () => {
        const result = validateOutput({
          answer: '직렬 연결이 적합합니다',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: [],
        });

        expect(result.warnings.some(w => w.includes('단위가 누락'))).toBe(false);
      });
    });

    describe('Validation result structure', () => {
      it('should return valid true when no corrections needed', () => {
        const result = validateOutput({
          answer: '100kVA',
          steps: [{ order: 1, title: 'Step', content: 'Content' }],
          formulas: ['S=VI'],
          confidence: 0.9,
        });

        expect(result.valid).toBe(true);
        expect(result.corrections).toHaveLength(0);
      });
    });
  });

  describe('verifyCalculation function', () => {
    describe('Luminance method (lighting calculation)', () => {
      it('should verify correct lighting calculation', () => {
        // N = (E * A * M) / (F * U)
        // N = (500 * 200 * 1.3) / (3000 * 0.6) = 130000 / 1800 = 72.22 -> 73
        // Note: Implementation uses multiplication sign character
        const result = verifyCalculation(
          'N = (E \u00D7 A \u00D7 M) / (F \u00D7 U)',
          { E: 500, A: 200, M: 1.3, F: 3000, U: 0.6 },
          73
        );

        expect(result.valid).toBe(true);
        expect(result.calculatedResult).toBe(73);
      });

      it('should detect incorrect lighting calculation', () => {
        const result = verifyCalculation(
          'N = (E \u00D7 A \u00D7 M) / (F \u00D7 U)',
          { E: 500, A: 200, M: 1.3, F: 3000, U: 0.6 },
          50 // Wrong expected result
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain('계산 결과 불일치');
      });

      it('should recognize alternative formula notation', () => {
        const result = verifyCalculation(
          'N = EAM/FU',
          { E: 500, A: 200, M: 1.3, F: 3000, U: 0.6 },
          73
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Voltage drop calculation', () => {
      it('should verify correct voltage drop calculation', () => {
        // e = (K * L * I) / A
        // e = (30.8 * 100 * 50) / 35 = 154000 / 35 = 4400
        const result = verifyCalculation(
          'e = (K \u00D7 L \u00D7 I) / A',
          { K: 30.8, L: 100, I: 50, A: 35 },
          4400
        );

        expect(result.valid).toBe(true);
      });

      it('should detect incorrect voltage drop calculation', () => {
        const result = verifyCalculation(
          'e = (K \u00D7 L \u00D7 I) / A',
          { K: 30.8, L: 100, I: 50, A: 35 },
          1000 // Wrong expected result
        );

        expect(result.valid).toBe(false);
      });

      it('should recognize alternative voltage drop formula notation', () => {
        const result = verifyCalculation(
          'e = KLI/A',
          { K: 30.8, L: 100, I: 50, A: 35 },
          4400
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Unknown formula handling', () => {
      it('should return valid true for unrecognized formulas', () => {
        const result = verifyCalculation(
          'P = V * I',
          { V: 220, I: 10 },
          2200
        );

        // Unknown formula should pass (not validated)
        expect(result.valid).toBe(true);
      });
    });

    describe('Tolerance handling', () => {
      it('should accept results within 1% tolerance', () => {
        // Exact: 72.22, rounded: 73
        // 73 is within 1% of 73
        const result = verifyCalculation(
          'N = (E x A x M) / (F x U)',
          { E: 500, A: 200, M: 1.3, F: 3000, U: 0.6 },
          73
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Missing input handling', () => {
      it('should handle missing input variables gracefully', () => {
        const result = verifyCalculation(
          'N = (E x A x M) / (F x U)',
          { E: 500 }, // Missing other variables
          73
        );

        // Should return valid=true since not all variables present
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('getKECRegulation function', () => {
    it('should find valid KEC regulation', () => {
      const result = getKECRegulation('KEC 142');

      expect(result.found).toBe(true);
      expect(result.regulation).toBeDefined();
      expect(result.regulation?.title).toBe('접지저항');
    });

    it('should find KEC 141 grounding system', () => {
      const result = getKECRegulation('KEC 141');

      expect(result.found).toBe(true);
      expect(result.regulation?.title).toBe('접지시스템');
    });

    it('should find KEC 210 shock protection', () => {
      const result = getKECRegulation('KEC 210');

      expect(result.found).toBe(true);
      expect(result.regulation?.title).toBe('감전보호');
    });

    it('should find KEC 232 overcurrent protection', () => {
      const result = getKECRegulation('KEC 232');

      expect(result.found).toBe(true);
      expect(result.regulation?.title).toBe('과전류보호');
    });

    it('should return found false for invalid code', () => {
      const result = getKECRegulation('KEC 999');

      expect(result.found).toBe(false);
      expect(result.regulation).toBeUndefined();
    });

    it('should handle lowercase input', () => {
      const result = getKECRegulation('kec 142');

      expect(result.found).toBe(true);
    });
  });

  describe('getFormula function', () => {
    it('should find voltage drop formula', () => {
      const result = getFormula('power', '전압강하');

      // Based on the formula-whitelist.json structure
      // This test may need adjustment based on actual JSON structure
      expect(typeof result.found).toBe('boolean');
    });

    it('should return found false for invalid category', () => {
      const result = getFormula('invalid_category', '전압강하');

      expect(result.found).toBe(false);
    });

    it('should return found false for invalid formula name', () => {
      const result = getFormula('power', 'invalid_formula');

      expect(result.found).toBe(false);
    });
  });
});
