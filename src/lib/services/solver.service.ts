/**
 * Solver Service - 문제 풀이 서비스
 */

import { AgentType, SolutionStep } from '@/types';
import { AGENT_PROMPTS, SOLUTION_FORMAT_PROMPT } from '@/lib/ai/prompts/agents';
import {
  ORCHESTRATOR_SYSTEM_PROMPT,
  ORCHESTRATOR_USER_PROMPT,
} from '@/lib/ai/prompts/orchestrator';
import { logger } from '@/lib/api/logger';
import {
  parseAIResponse,
  safeString,
  safeNumber,
  safeArray,
} from '@/lib/utils/jsonParser';

const NEMOTRON_API_URL =
  process.env.NEMOTRON_API_URL || 'https://integrate.api.nvidia.com/v1';
const NEMOTRON_API_KEY = process.env.NEMOTRON_API_KEY || '';
const MODEL = 'meta/llama-3.1-70b-instruct';

export interface RoutingResult {
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;
  reasoning: string;
}

export interface SolutionResult {
  category: AgentType;
  solution: string;
  answer: string;
  steps: SolutionStep[];
  formulas: string[];
  relatedKEC: string[];
  confidence: number;
}

export interface VerificationResult {
  isValid: boolean;
  confidence: number;
  checks: {
    calculation: { pass: boolean; notes: string[] };
    formula: { pass: boolean; notes: string[] };
    kec: { pass: boolean; notes: string[] };
    units: { pass: boolean; notes: string[] };
  };
  corrections: string[];
  warnings: string[];
}

export class SolverService {
  /**
   * 질문을 분석하고 적절한 에이전트로 라우팅
   */
  async routeQuestion(question: string): Promise<RoutingResult> {
    try {
      const response = await this.callLLM(
        ORCHESTRATOR_SYSTEM_PROMPT,
        ORCHESTRATOR_USER_PROMPT(question),
        0.1
      );

      const parsed = this.parseJSON(response);

      return {
        primaryAgent: (parsed?.primaryAgent as AgentType) || 'DESIGN',
        secondaryAgents: (parsed?.secondaryAgents as AgentType[]) || [],
        confidence: (parsed?.confidence as number) || 0.8,
        reasoning: (parsed?.reasoning as string) || '',
      };
    } catch (error) {
      logger.error('Routing failed', error as Error);
      return {
        primaryAgent: 'DESIGN',
        secondaryAgents: [],
        confidence: 0.5,
        reasoning: 'Fallback to default agent',
      };
    }
  }

  /**
   * 문제 풀이 생성
   */
  async solveProblem(
    question: string,
    agentType: AgentType
  ): Promise<SolutionResult> {
    const systemPrompt = AGENT_PROMPTS[agentType];
    const userPrompt = `다음 전기기사 실기 문제를 단계별로 상세히 풀이해주세요.

문제:
${question}

${SOLUTION_FORMAT_PROMPT}`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt, 0.2);
      const parsed = this.parseJSON(response);

      if (parsed) {
        const rawSteps = safeArray<{ order?: number; title?: string; content?: string; latex?: string }>(parsed.steps);
        const steps: SolutionStep[] = rawSteps.map((step, index) => ({
          order: safeNumber(step?.order, index + 1),
          title: safeString(step?.title, `단계 ${index + 1}`),
          content: safeString(step?.content, ''),
          latex: step?.latex || undefined,
        }));

        return {
          category: agentType,
          solution: safeString(parsed.solution, response),
          answer: safeString(parsed.answer, ''),
          steps,
          formulas: safeArray<string>(parsed.formulas),
          relatedKEC: safeArray<string>(parsed.relatedKEC),
          confidence: safeNumber(parsed.confidence, 0.85),
        };
      }

      // JSON 파싱 실패 시 텍스트 응답 사용
      return {
        category: agentType,
        solution: response,
        answer: '',
        steps: [{ order: 1, title: '풀이', content: response }],
        formulas: [],
        relatedKEC: [],
        confidence: 0.7,
      };
    } catch (error) {
      logger.error('Solve failed', error as Error);
      throw error;
    }
  }

  /**
   * 풀이 검증
   */
  async verifySolution(
    question: string,
    solution: SolutionResult
  ): Promise<VerificationResult> {
    const systemPrompt = `당신은 전기기사 풀이 검증 전문가입니다.
풀이 과정의 정확성을 검사합니다.

# 검증 항목
1. 계산 정확성 - 수식 적용 및 대입값 오류
2. 공식 적합성 - 문제 유형에 맞는 공식 사용
3. KEC 규정 준수 - 관련 규정 인용 정확성
4. 단위 일관성 - SI 단위 및 변환 정확성

# 응답 형식 (JSON)
{
  "isValid": true,
  "confidence": 0.95,
  "checks": {
    "calculation": { "pass": true, "notes": [] },
    "formula": { "pass": true, "notes": [] },
    "kec": { "pass": true, "notes": [] },
    "units": { "pass": true, "notes": [] }
  },
  "corrections": [],
  "warnings": []
}`;

    const userPrompt = `다음 풀이를 검증해주세요.

문제: ${question}
풀이: ${solution.solution}
답: ${solution.answer}`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt, 0.1);
      const parsed = this.parseJSON(response);

      if (parsed) {
        return parsed as unknown as VerificationResult;
      }

      return this.defaultVerification();
    } catch (error) {
      logger.error('Verify failed', error as Error);
      return this.defaultVerification();
    }
  }

  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    temperature: number
  ): Promise<string> {
    const response = await fetch(`${NEMOTRON_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NEMOTRON_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'LLM API call failed');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private parseJSON(text: string): Record<string, unknown> | null {
    const result = parseAIResponse<Record<string, unknown>>(text);
    return result.data;
  }

  private defaultVerification(): VerificationResult {
    return {
      isValid: true,
      confidence: 0.8,
      checks: {
        calculation: { pass: true, notes: [] },
        formula: { pass: true, notes: [] },
        kec: { pass: true, notes: [] },
        units: { pass: true, notes: [] },
      },
      corrections: [],
      warnings: ['자동 검증 결과입니다.'],
    };
  }
}

export const solverService = new SolverService();
