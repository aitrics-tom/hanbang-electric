/**
 * SolverService Tests
 * TDD: Tests for the LLM-based problem solving service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SolverService, SolutionResult } from './solver.service';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger to prevent console output in tests
vi.mock('@/lib/api/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SolverService', () => {
  let service: SolverService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SolverService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('routeQuestion', () => {
    describe('Successful routing', () => {
      it('should return routing result with primary agent', async () => {
        const mockResponse = {
          primaryAgent: 'DESIGN',
          secondaryAgents: ['LOAD'],
          confidence: 0.95,
          reasoning: '변압기 관련 문제로 판단됩니다.',
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify(mockResponse) } }],
            }),
        });

        const result = await service.routeQuestion('변압기 용량 계산');

        expect(result.primaryAgent).toBe('DESIGN');
        expect(result.secondaryAgents).toContain('LOAD');
        expect(result.confidence).toBe(0.95);
        expect(result.reasoning).toBe('변압기 관련 문제로 판단됩니다.');
      });

      it('should call LLM API with correct parameters', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify({ primaryAgent: 'LOAD' }) } }],
            }),
        });

        await service.routeQuestion('조명 설계 문제');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/chat/completions'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('should use low temperature for routing', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify({}) } }],
            }),
        });

        await service.routeQuestion('테스트 문제');

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(0.1);
      });
    });

    describe('Error handling', () => {
      it('should return fallback routing on API error', async () => {
        mockFetch.mockRejectedValue(new Error('API Error'));

        const result = await service.routeQuestion('테스트');

        expect(result.primaryAgent).toBe('DESIGN');
        expect(result.secondaryAgents).toEqual([]);
        expect(result.confidence).toBe(0.5);
        expect(result.reasoning).toBe('Fallback to default agent');
      });

      it('should return fallback routing on invalid JSON response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'invalid json' } }],
            }),
        });

        const result = await service.routeQuestion('테스트');

        // When JSON parsing succeeds but returns null, default values are used
        // Default confidence is 0.8 (see line 65 of solver.service.ts)
        expect(result.primaryAgent).toBe('DESIGN');
        expect(result.confidence).toBe(0.8);
      });

      it('should return fallback routing on HTTP error', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ message: 'Server error' }),
        });

        const result = await service.routeQuestion('테스트');

        expect(result.primaryAgent).toBe('DESIGN');
        expect(result.confidence).toBe(0.5);
      });

      it('should use default values for missing fields', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify({}) } }],
            }),
        });

        const result = await service.routeQuestion('테스트');

        expect(result.primaryAgent).toBe('DESIGN');
        expect(result.secondaryAgents).toEqual([]);
        expect(result.confidence).toBe(0.8);
        expect(result.reasoning).toBe('');
      });
    });
  });

  describe('solveProblem', () => {
    describe('Successful solving', () => {
      const mockSolutionResponse = {
        solution: '풀이 내용입니다.',
        answer: '100 kVA',
        steps: [
          { order: 1, title: '분석', content: '문제를 분석합니다.' },
          { order: 2, title: '계산', content: '계산을 수행합니다.' },
        ],
        formulas: ['P = VI', 'S = P/cos\\theta'],
        relatedKEC: ['KEC 142'],
        confidence: 0.95,
      };

      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify(mockSolutionResponse) } }],
            }),
        });
      });

      it('should return solution result with all fields', async () => {
        const result = await service.solveProblem('변압기 용량 계산', 'DESIGN');

        expect(result.category).toBe('DESIGN');
        expect(result.solution).toBe('풀이 내용입니다.');
        expect(result.answer).toBe('100 kVA');
        expect(result.steps).toHaveLength(2);
        expect(result.formulas).toContain('P = VI');
        expect(result.relatedKEC).toContain('KEC 142');
        expect(result.confidence).toBe(0.95);
      });

      it('should include steps with correct structure', async () => {
        const result = await service.solveProblem('테스트', 'LOAD');

        expect(result.steps[0]).toHaveProperty('order');
        expect(result.steps[0]).toHaveProperty('title');
        expect(result.steps[0]).toHaveProperty('content');
        expect(result.steps[0].order).toBe(1);
        expect(result.steps[0].title).toBe('분석');
      });

      it('should use appropriate temperature for solving', async () => {
        await service.solveProblem('테스트', 'DESIGN');

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(0.2);
      });

      it('should include agent-specific system prompt', async () => {
        await service.solveProblem('테스트', 'SEQUENCE');

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.messages[0].role).toBe('system');
        // System prompt should contain agent-specific content
        expect(typeof callBody.messages[0].content).toBe('string');
      });

      it('should include question in user prompt', async () => {
        const question = '특정 전기 문제입니다';
        await service.solveProblem(question, 'DESIGN');

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.messages[1].role).toBe('user');
        expect(callBody.messages[1].content).toContain(question);
      });
    });

    describe('Fallback handling', () => {
      it('should return raw response when JSON parsing fails', async () => {
        const rawResponse = '이것은 JSON이 아닌 텍스트 응답입니다.';
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: rawResponse } }],
            }),
        });

        const result = await service.solveProblem('테스트', 'DESIGN');

        expect(result.solution).toBe(rawResponse);
        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].title).toBe('풀이');
        expect(result.steps[0].content).toBe(rawResponse);
        expect(result.confidence).toBe(0.7);
      });

      it('should use default values for missing response fields', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify({ answer: '42' }) } }],
            }),
        });

        const result = await service.solveProblem('테스트', 'LOAD');

        expect(result.answer).toBe('42');
        expect(result.solution).toBeDefined();
        expect(result.steps).toEqual([]);
        expect(result.formulas).toEqual([]);
        expect(result.relatedKEC).toEqual([]);
        expect(result.confidence).toBe(0.85);
      });
    });

    describe('Error handling', () => {
      it('should throw error on API failure', async () => {
        mockFetch.mockRejectedValue(new Error('API call failed'));

        await expect(service.solveProblem('테스트', 'DESIGN')).rejects.toThrow(
          'API call failed'
        );
      });

      it('should throw error on HTTP error response', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ message: 'Server error' }),
        });

        await expect(service.solveProblem('테스트', 'DESIGN')).rejects.toThrow();
      });
    });
  });

  describe('verifySolution', () => {
    const mockQuestion = '변압기 용량 계산';
    const mockSolution: SolutionResult = {
      category: 'DESIGN',
      solution: '풀이 내용',
      answer: '100 kVA',
      steps: [{ order: 1, title: '분석', content: '내용' }],
      formulas: ['S = VI'],
      relatedKEC: [],
      confidence: 0.9,
    };

    describe('Successful verification', () => {
      it('should return verification result with all checks', async () => {
        const mockVerification = {
          isValid: true,
          confidence: 0.95,
          checks: {
            calculation: { pass: true, notes: ['계산 정확'] },
            formula: { pass: true, notes: ['공식 적합'] },
            kec: { pass: true, notes: [] },
            units: { pass: true, notes: ['단위 정확'] },
          },
          corrections: [],
          warnings: [],
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify(mockVerification) } }],
            }),
        });

        const result = await service.verifySolution(mockQuestion, mockSolution);

        expect(result.isValid).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.checks.calculation.pass).toBe(true);
        expect(result.checks.formula.pass).toBe(true);
        expect(result.checks.kec.pass).toBe(true);
        expect(result.checks.units.pass).toBe(true);
      });

      it('should include corrections and warnings when present', async () => {
        const mockVerification = {
          isValid: false,
          confidence: 0.7,
          checks: {
            calculation: { pass: false, notes: ['계산 오류'] },
            formula: { pass: true, notes: [] },
            kec: { pass: true, notes: [] },
            units: { pass: false, notes: ['단위 누락'] },
          },
          corrections: ['계산 다시 확인 필요'],
          warnings: ['단위 표기 권장'],
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify(mockVerification) } }],
            }),
        });

        const result = await service.verifySolution(mockQuestion, mockSolution);

        expect(result.isValid).toBe(false);
        expect(result.corrections).toContain('계산 다시 확인 필요');
        expect(result.warnings).toContain('단위 표기 권장');
      });

      it('should use low temperature for verification', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: JSON.stringify({}) } }],
            }),
        });

        await service.verifySolution(mockQuestion, mockSolution);

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.temperature).toBe(0.1);
      });
    });

    describe('Fallback verification', () => {
      it('should return default verification on API error', async () => {
        mockFetch.mockRejectedValue(new Error('API Error'));

        const result = await service.verifySolution(mockQuestion, mockSolution);

        expect(result.isValid).toBe(true);
        expect(result.confidence).toBe(0.8);
        expect(result.checks.calculation.pass).toBe(true);
        expect(result.checks.formula.pass).toBe(true);
        expect(result.checks.kec.pass).toBe(true);
        expect(result.checks.units.pass).toBe(true);
        expect(result.warnings).toContain('자동 검증 결과입니다.');
      });

      it('should return default verification on invalid JSON', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'not valid json' } }],
            }),
        });

        const result = await service.verifySolution(mockQuestion, mockSolution);

        expect(result.isValid).toBe(true);
        expect(result.confidence).toBe(0.8);
        expect(result.warnings).toContain('자동 검증 결과입니다.');
      });

      it('should return default verification on HTTP error', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ message: 'Server error' }),
        });

        const result = await service.verifySolution(mockQuestion, mockSolution);

        expect(result.isValid).toBe(true);
        expect(result.confidence).toBe(0.8);
      });
    });
  });

  describe('Private method behavior (through public API)', () => {
    describe('parseJSON', () => {
      it('should extract JSON from text with surrounding content', async () => {
        const responseWithText = `
        여기 분석 결과입니다:
        {"primaryAgent": "LOAD", "confidence": 0.9}
        추가 설명입니다.
        `;

        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: responseWithText } }],
            }),
        });

        const result = await service.routeQuestion('조명 문제');

        expect(result.primaryAgent).toBe('LOAD');
        expect(result.confidence).toBe(0.9);
      });
    });

    describe('callLLM', () => {
      it('should include Authorization header', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: '{}' } }],
            }),
        });

        await service.routeQuestion('테스트');

        expect(mockFetch.mock.calls[0][1].headers).toHaveProperty('Authorization');
        expect(mockFetch.mock.calls[0][1].headers.Authorization).toContain('Bearer');
      });

      it('should set max_tokens limit', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: '{}' } }],
            }),
        });

        await service.routeQuestion('테스트');

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.max_tokens).toBe(2048);
      });

      it('should use correct model', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: '{}' } }],
            }),
        });

        await service.routeQuestion('테스트');

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.model).toBe('meta/llama-3.1-70b-instruct');
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete solve flow', async () => {
      // Mock routing response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    primaryAgent: 'LOAD',
                    confidence: 0.9,
                  }),
                },
              },
            ],
          }),
      });

      // Mock solve response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: '73개',
                    steps: [{ order: 1, title: '분석', content: '내용' }],
                  }),
                },
              },
            ],
          }),
      });

      // Mock verify response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isValid: true,
                    confidence: 0.95,
                  }),
                },
              },
            ],
          }),
      });

      const question = '조명 등수 계산';

      // Step 1: Route
      const routing = await service.routeQuestion(question);
      expect(routing.primaryAgent).toBe('LOAD');

      // Step 2: Solve
      const solution = await service.solveProblem(question, routing.primaryAgent);
      expect(solution.answer).toBe('73개');

      // Step 3: Verify
      const verification = await service.verifySolution(question, solution);
      expect(verification.isValid).toBe(true);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
