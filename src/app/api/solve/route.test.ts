/**
 * Solve API Route Tests
 * TDD: Tests for demo solution generation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Helper to create mock NextRequest with proper headers
function createMockRequest(body: object): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-forwarded-for': '127.0.0.1',
  });

  return {
    json: () => Promise.resolve(body),
    headers,
  } as unknown as NextRequest;
}

describe('Solve API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input validation', () => {
    it('should return 400 for empty input', async () => {
      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('문제 텍스트 또는 이미지를 입력해주세요');
    });

    it('should return 400 for text too short', async () => {
      const request = createMockRequest({ text: '짧음' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('10자 이상');
    });

    it('should return 400 for inappropriate content', async () => {
      const request = createMockRequest({ text: '욕설이 포함된 긴 질문입니다 변압기' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('부적절한 내용');
    });
  });

  describe('Demo mode responses', () => {
    it('should return lighting solution for lighting keywords', async () => {
      const request = createMockRequest({
        text: '바닥 면적이 200m2인 사무실에 평균 조도 500lx를 얻고자 한다. 광원의 광속이 3000lm이고, 조명률 0.6, 감광보상률 1.3일 때 필요한 등수는?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.category).toBe('LOAD');
      expect(data.data.answer).toContain('73');
      expect(data.data.formulas).toContain('광속법 (N = EAM/FU)');
      expect(data.data.steps.length).toBeGreaterThan(0);
    });

    it('should return transformer solution for transformer keywords', async () => {
      const request = createMockRequest({
        text: '변압기 용량 500kVA를 선정하여 설치하려고 합니다',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.category).toBe('DESIGN');
      expect(data.data.answer).toContain('kVA');
    });

    it('should return sequence solution for PLC keywords', async () => {
      const request = createMockRequest({
        text: 'PLC 시퀀스 제어와 릴레이 동작에 대해 설명하시오',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.category).toBe('SEQUENCE');
      expect(data.data.steps.some((s: { title: string }) =>
        s.title.includes('동작') || s.title.includes('타임차트') || s.title.includes('래더')
      )).toBe(true);
    });

    it('should return grounding solution for KEC/grounding keywords', async () => {
      const request = createMockRequest({
        text: '접지저항 계산과 KEC 규정에 대해 설명하시오',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.category).toBe('KEC');
      expect(data.data.relatedKEC).toBeDefined();
      expect(data.data.relatedKEC.length).toBeGreaterThan(0);
    });

    it('should return default solution for unmatched questions', async () => {
      const request = createMockRequest({
        text: '전기기사 시험 전반에 대해 설명해주세요',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Response structure', () => {
    it('should include all required solution fields', async () => {
      const request = createMockRequest({
        text: '조명 설계에서 평균 조도 계산 방법을 알려주세요',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      const solution = data.data;

      // Required fields check
      expect(solution).toHaveProperty('id');
      expect(solution).toHaveProperty('question');
      expect(solution).toHaveProperty('category');
      expect(solution).toHaveProperty('solution');
      expect(solution).toHaveProperty('answer');
      expect(solution).toHaveProperty('steps');
      expect(solution).toHaveProperty('formulas');
      expect(solution).toHaveProperty('verification');
      expect(solution).toHaveProperty('agents');
      expect(solution).toHaveProperty('processingTime');
      expect(solution).toHaveProperty('createdAt');
    });

    it('should include verification with confidence score', async () => {
      const request = createMockRequest({
        text: '변압기 용량 계산 방법에 대해 자세히 설명해주세요',
      });

      const response = await POST(request);
      const data = await response.json();

      const verification = data.data.verification;

      expect(verification).toHaveProperty('isValid');
      expect(verification).toHaveProperty('confidence');
      expect(verification).toHaveProperty('checks');
      expect(verification.confidence).toBeGreaterThanOrEqual(0);
      expect(verification.confidence).toBeLessThanOrEqual(1);
    });

    it('should include agent routing information', async () => {
      const request = createMockRequest({
        text: '역률 개선을 위한 콘덴서 용량 계산 방법',
      });

      const response = await POST(request);
      const data = await response.json();

      const agents = data.data.agents;

      expect(agents).toHaveProperty('primary');
      expect(agents).toHaveProperty('secondary');
      expect(typeof agents.primary).toBe('string');
      expect(Array.isArray(agents.secondary)).toBe(true);
    });

    it('should include meta information in response', async () => {
      const request = createMockRequest({
        text: '송전 선로의 전력손실 계산 방법을 설명하시오',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('meta');
      expect(data.meta).toHaveProperty('processingTime');
      expect(data.meta).toHaveProperty('mode');
      expect(data.meta.mode).toBe('demo');
    });
  });

  describe('Step structure validation', () => {
    it('should have properly ordered steps', async () => {
      const request = createMockRequest({
        text: '조명 설계에서 광속법을 이용한 등수 계산 방법',
      });

      const response = await POST(request);
      const data = await response.json();

      const steps = data.data.steps;

      expect(steps.length).toBeGreaterThan(0);

      // Check step order is sequential
      steps.forEach((step: { order: number }, index: number) => {
        expect(step.order).toBe(index + 1);
      });

      // Each step should have required properties
      steps.forEach((step: { title: string; content: string }) => {
        expect(step).toHaveProperty('order');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('content');
        expect(typeof step.title).toBe('string');
        expect(typeof step.content).toBe('string');
      });
    });

    it('should include LaTeX in calculation steps when applicable', async () => {
      const request = createMockRequest({
        text: '바닥 면적 200m2, 조도 500lx, 광속 3000lm, 조명률 0.6, 감광보상률 1.3일 때 등수',
      });

      const response = await POST(request);
      const data = await response.json();

      const steps = data.data.steps;

      // At least one step should have latex
      const stepsWithLatex = steps.filter((s: { latex?: string }) => s.latex);
      expect(stepsWithLatex.length).toBeGreaterThan(0);
    });
  });

  describe('Processing time tracking', () => {
    it('should include processing time in response', async () => {
      const request = createMockRequest({
        text: '전기기사 실기 문제: 변압기 용량 계산',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.processingTime).toBeDefined();
      expect(typeof data.data.processingTime).toBe('number');
      expect(data.data.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Image processing (demo mode)', () => {
    it('should handle image input - returns error when OCR fails without API key', async () => {
      const request = createMockRequest({
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      });

      const response = await POST(request);
      const data = await response.json();

      // Without API key, OCR fails and returns error
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('이미지');
    });

    it('should still attempt OCR when both text and image provided', async () => {
      const request = createMockRequest({
        text: '변압기 용량 계산 방법을 설명해주세요',
        imageBase64: 'validBase64ImageString',
      });

      const response = await POST(request);
      const data = await response.json();

      // OCR is attempted when imageBase64 is present, fails without API key
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('이미지');
    });
  });

  describe('Verification checks structure', () => {
    it('should include all verification check categories', async () => {
      const request = createMockRequest({
        text: '조명 설계 문제: 조도 500lux를 위한 등기구 수량',
      });

      const response = await POST(request);
      const data = await response.json();

      const checks = data.data.verification.checks;

      expect(checks).toHaveProperty('calculation');
      expect(checks).toHaveProperty('formula');
      expect(checks).toHaveProperty('kec');
      expect(checks).toHaveProperty('units');

      // Each check should have pass and notes
      ['calculation', 'formula', 'kec', 'units'].forEach((checkType) => {
        expect(checks[checkType]).toHaveProperty('pass');
        expect(checks[checkType]).toHaveProperty('notes');
        expect(typeof checks[checkType].pass).toBe('boolean');
        expect(Array.isArray(checks[checkType].notes)).toBe(true);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle JSON parse errors gracefully', async () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      });

      const badRequest = {
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers,
      } as unknown as NextRequest;

      const response = await POST(badRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      // Korean error message
      expect(data.error).toBe('서버 오류가 발생했습니다');
    });
  });

  describe('Category-specific solution quality', () => {
    it('should generate high-quality LOAD category solutions', async () => {
      const request = createMockRequest({
        text: '조명률 0.6, 감광보상률 1.3인 조명 설계',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.verification.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should generate appropriate steps for SEQUENCE problems', async () => {
      const request = createMockRequest({
        text: '시퀀스 회로에서 릴레이 타이머 동작 분석',
      });

      const response = await POST(request);
      const data = await response.json();

      const stepTitles = data.data.steps.map((s: { title: string }) => s.title);

      // Should have relevant step titles for sequence problems
      expect(
        stepTitles.some(
          (t: string) => t.includes('동작') || t.includes('조건') || t.includes('분석')
        )
      ).toBe(true);
    });

    it('should include KEC references for grounding problems', async () => {
      const request = createMockRequest({
        text: 'TT계통의 접지저항 기준과 KEC 규정 설명',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.relatedKEC).toBeDefined();
      expect(data.data.relatedKEC.length).toBeGreaterThan(0);
      expect(data.data.relatedKEC.some((k: string) => k.includes('KEC'))).toBe(true);
    });
  });
});
