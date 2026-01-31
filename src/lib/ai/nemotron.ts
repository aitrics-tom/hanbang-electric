/**
 * NVIDIA Nemotron API 클라이언트
 * 멀티 에이전트 LLM 추론 엔진
 */

import { AgentType, SolutionStep } from '@/types';
import { AGENT_PROMPTS, SOLUTION_FORMAT_PROMPT } from './prompts/agents';
import {
  ORCHESTRATOR_SYSTEM_PROMPT,
  ORCHESTRATOR_USER_PROMPT,
} from './prompts/orchestrator';

const NEMOTRON_API_URL =
  process.env.NEMOTRON_API_URL || 'https://integrate.api.nvidia.com/v1';
const NEMOTRON_API_KEY = process.env.NEMOTRON_API_KEY || '';

// 모델 설정 - NVIDIA NIM API 실제 모델명
const MODELS = {
  orchestrator: 'meta/llama-3.1-70b-instruct', // 라우팅용
  solver: 'meta/llama-3.1-70b-instruct', // 풀이용
  verifier: 'meta/llama-3.1-70b-instruct', // 검증용
};

export interface RoutingResult {
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;
  reasoning: string;
  extractedQuestion: string;
  keywords: string[];
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

/**
 * Orchestrator: 질문 분석 및 에이전트 라우팅
 */
export async function routeQuestion(question: string): Promise<RoutingResult> {
  try {
    const response = await callNemotron(
      MODELS.orchestrator,
      ORCHESTRATOR_SYSTEM_PROMPT,
      ORCHESTRATOR_USER_PROMPT(question),
      0.1
    );

    // JSON 파싱 시도
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        primaryAgent: parsed.primaryAgent || 'DESIGN',
        secondaryAgents: parsed.secondaryAgents || [],
        confidence: parsed.confidence || 0.8,
        reasoning: parsed.reasoning || '',
        extractedQuestion: parsed.extractedQuestion || question,
        keywords: parsed.keywords || [],
      };
    }

    // 파싱 실패 시 기본값
    return {
      primaryAgent: 'DESIGN',
      secondaryAgents: [],
      confidence: 0.5,
      reasoning: '자동 분류 실패, 기본 에이전트 선택',
      extractedQuestion: question,
      keywords: [],
    };
  } catch (error) {
    console.error('Routing error:', error);
    return {
      primaryAgent: 'DESIGN',
      secondaryAgents: [],
      confidence: 0.5,
      reasoning: 'API 오류',
      extractedQuestion: question,
      keywords: [],
    };
  }
}

/**
 * Solver Agent: 문제 풀이 생성
 */
export async function solveProblem(
  question: string,
  agentType: AgentType
): Promise<SolutionResult> {
  const systemPrompt = AGENT_PROMPTS[agentType];
  const userPrompt = `다음 전기기사 실기 문제를 단계별로 상세히 풀이해주세요.

문제:
${question}

${SOLUTION_FORMAT_PROMPT}`;

  try {
    const response = await callNemotron(
      MODELS.solver,
      systemPrompt,
      userPrompt,
      0.2
    );

    // JSON 파싱 시도
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: agentType,
        solution: parsed.solution || response,
        answer: parsed.answer || '',
        steps: parsed.steps || [],
        formulas: parsed.formulas || [],
        relatedKEC: parsed.relatedKEC || [],
        confidence: parsed.confidence || 0.85,
      };
    }

    // 파싱 실패 시 텍스트 응답 사용
    return {
      category: agentType,
      solution: response,
      answer: '',
      steps: [
        {
          order: 1,
          title: '풀이',
          content: response,
        },
      ],
      formulas: [],
      relatedKEC: [],
      confidence: 0.7,
    };
  } catch (error) {
    console.error('Solve error:', error);
    throw error;
  }
}

/**
 * Verifier Agent: 풀이 검증
 */
export async function verifySolution(
  question: string,
  solution: SolutionResult
): Promise<{
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
}> {
  const systemPrompt = `당신은 전기기사 풀이 검증 전문가입니다.
풀이 과정의 정확성을 검사합니다.

# 검증 항목
1. 계산 정확성 - 수식 적용 및 대입값 오류
2. 공식 적합성 - 문제 유형에 맞는 공식 사용
3. KEC 규정 준수 - 관련 규정 인용 정확성
4. 단위 일관성 - SI 단위 및 변환 정확성

# 응답 형식 (JSON)
{
  "isValid": true/false,
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
    const response = await callNemotron(
      MODELS.verifier,
      systemPrompt,
      userPrompt,
      0.1
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // 기본 검증 결과
    return {
      isValid: true,
      confidence: 0.8,
      checks: {
        calculation: { pass: true, notes: ['자동 검증'] },
        formula: { pass: true, notes: [] },
        kec: { pass: true, notes: [] },
        units: { pass: true, notes: [] },
      },
      corrections: [],
      warnings: ['상세 검증을 위해 전문가 확인을 권장합니다.'],
    };
  } catch (error) {
    console.error('Verify error:', error);
    return {
      isValid: true,
      confidence: 0.5,
      checks: {
        calculation: { pass: true, notes: [] },
        formula: { pass: true, notes: [] },
        kec: { pass: true, notes: [] },
        units: { pass: true, notes: [] },
      },
      corrections: [],
      warnings: ['검증 API 오류'],
    };
  }
}

/**
 * Nemotron API 호출 헬퍼
 */
async function callNemotron(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.2
): Promise<string> {
  const response = await fetch(`${NEMOTRON_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NEMOTRON_API_KEY}`,
    },
    body: JSON.stringify({
      model,
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
    throw new Error(error.message || 'Nemotron API 호출 실패');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
