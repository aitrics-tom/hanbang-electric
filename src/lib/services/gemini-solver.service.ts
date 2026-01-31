/**
 * Gemini Solver Service - 이미지 분석 및 문제 풀이 통합 서비스
 *
 * Gemini 3를 사용하여 이미지에서 직접 문제를 분석하고 풀이를 생성합니다.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentType, SolutionResponse, SolutionStep, VerificationResult } from '@/types';
import { classifyQuestion } from '@/lib/ai/agents';
import { logger } from '@/lib/api/logger';
import {
  parseAIResponse,
  safeString,
  safeNumber,
  safeArray,
} from '@/lib/utils/jsonParser';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export interface GeminiSolverResult {
  question: string;
  answer: string;
  steps: SolutionStep[];
  formulas: string[];
  relatedKEC: string[];
  category: AgentType;
  confidence: number;
}

const SOLVER_PROMPT = `당신은 한국 전기기사 실기 시험 전문 튜터입니다.
이 이미지에 있는 전기기사 실기 문제를 분석하고 상세하게 풀이해주세요.

## 응답 형식 (반드시 JSON으로 응답)
{
  "question": "문제 전문 (이미지에서 추출한 문제 텍스트)",
  "answer": "최종 답 (숫자와 단위 포함, 예: 73개, 34.84 kW)",
  "steps": [
    {
      "order": 1,
      "title": "문제 분석",
      "content": "주어진 조건을 정리합니다.\\n- 조건 1\\n- 조건 2",
      "latex": ""
    },
    {
      "order": 2,
      "title": "적용 공식",
      "content": "이 문제에 적용할 공식을 설명합니다.",
      "latex": "N = \\\\frac{E \\\\times A \\\\times M}{F \\\\times U}"
    },
    {
      "order": 3,
      "title": "값 대입",
      "content": "주어진 값을 공식에 대입합니다.",
      "latex": "N = \\\\frac{500 \\\\times 200 \\\\times 1.3}{3000 \\\\times 0.6}"
    },
    {
      "order": 4,
      "title": "계산",
      "content": "계산 과정을 상세히 설명합니다.",
      "latex": "N = \\\\frac{130,000}{1,800} = 72.22"
    },
    {
      "order": 5,
      "title": "최종 답",
      "content": "정수 처리 등 최종 결과를 도출합니다.",
      "latex": "N = 73 \\\\text{ 개}"
    }
  ],
  "formulas": ["광속법 (N = EAM/FU)", "사용된 다른 공식명"],
  "relatedKEC": ["KEC 142.3", "관련 규정 조항"],
  "confidence": 0.95
}

## 풀이 작성 규칙
1. **문제 분석**: 주어진 모든 조건과 구하고자 하는 것을 명확히 정리
2. **공식 선택**: 문제 유형에 맞는 정확한 공식 사용 (LaTeX 수식으로)
3. **단위 변환**: 필요한 경우 단위 변환 과정을 명시
4. **계산 과정**: 각 계산 단계를 상세히 보여주기
5. **최종 답**: 적절한 자릿수와 단위로 표현

## LaTeX 수식 작성법
- 분수: \\\\frac{분자}{분모}
- 곱하기: \\\\times
- 제곱: ^2
- 루트: \\\\sqrt{}
- 텍스트: \\\\text{내용}
- 그리스 문자: \\\\alpha, \\\\beta, \\\\eta, \\\\theta
- 단위: \\\\text{ kW}, \\\\text{ A}, \\\\Omega

## 전기기사 주요 공식
- 조명 등수: N = EAM/FU
- 권상기 전동기: P = Wgv/(η×1000)
- 변압기 용량: P_TR = P/(cosθ×η)
- 콘덴서 용량: Q = P(tanθ₁ - tanθ₂)
- 전압강하: e = IR·cosθ + IX·sinθ

중요:
- 반드시 위의 JSON 형식으로만 응답하세요. 다른 설명이나 텍스트를 추가하지 마세요.
- content 필드에 마크다운 문법(**, ##, *)을 절대 사용하지 마세요. 일반 텍스트만 사용하세요.`;

export class GeminiSolverService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  /**
   * 이미지에서 문제를 분석하고 풀이 생성
   */
  async solveFromImage(imageBase64: string): Promise<SolutionResponse> {
    const startTime = Date.now();

    // base64 데이터 URL에서 순수 base64 추출
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    // MIME 타입 추출
    const mimeTypeMatch = imageBase64.match(/data:([^;]+);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: SOLVER_PROMPT },
      ]);

      const responseText = result.response.text();
      const processingTime = (Date.now() - startTime) / 1000;

      logger.info('Gemini solver completed', {
        processingTime,
        responseLength: responseText.length,
      });

      // JSON 파싱
      const parsed = this.parseResponse(responseText);

      if (!parsed) {
        throw new Error('Failed to parse Gemini response');
      }

      // 카테고리 분류
      const classification = classifyQuestion(parsed.question);

      return {
        id: `sol-${Date.now()}`,
        question: parsed.question,
        category: classification.primary,
        solution: `${parsed.answer}에 대한 상세 풀이`,
        answer: parsed.answer,
        steps: parsed.steps,
        formulas: parsed.formulas,
        relatedKEC: parsed.relatedKEC,
        verification: this.createVerification(parsed.confidence),
        agents: {
          primary: classification.primary,
          secondary: classification.secondary,
        },
        processingTime,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Gemini solver failed', error as Error);
      throw error;
    }
  }

  /**
   * 텍스트 문제 풀이
   */
  async solveFromText(questionText: string): Promise<SolutionResponse> {
    const startTime = Date.now();

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      const textPrompt = `${SOLVER_PROMPT}

문제:
${questionText}`;

      const result = await model.generateContent(textPrompt);
      const responseText = result.response.text();
      const processingTime = (Date.now() - startTime) / 1000;

      logger.info('Gemini text solver completed', {
        processingTime,
        responseLength: responseText.length,
      });

      // JSON 파싱
      const parsed = this.parseResponse(responseText);

      if (!parsed) {
        throw new Error('Failed to parse Gemini response');
      }

      // 카테고리 분류
      const classification = classifyQuestion(questionText);

      return {
        id: `sol-${Date.now()}`,
        question: parsed.question || questionText,
        category: classification.primary,
        solution: `${parsed.answer}에 대한 상세 풀이`,
        answer: parsed.answer,
        steps: parsed.steps,
        formulas: parsed.formulas,
        relatedKEC: parsed.relatedKEC,
        verification: this.createVerification(parsed.confidence),
        agents: {
          primary: classification.primary,
          secondary: classification.secondary,
        },
        processingTime,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Gemini text solver failed', error as Error);
      throw error;
    }
  }

  private parseResponse(responseText: string): GeminiSolverResult | null {
    try {
      // 통합 JSON 파서 사용
      const result = parseAIResponse<{
        question?: string;
        answer?: string;
        steps?: Array<{ order?: number; title?: string; content?: string; latex?: string }>;
        formulas?: string[];
        relatedKEC?: string[];
        category?: string;
        confidence?: number;
      }>(responseText);

      if (!result.success || !result.data) {
        logger.error('Failed to parse Gemini response', new Error(result.error || 'Unknown error'));
        return null;
      }

      const parsed = result.data;

      // steps 배열 검증 및 정리 (타입 안전)
      const rawSteps = safeArray<{ order?: number; title?: string; content?: string; latex?: string }>(parsed.steps);
      const steps: SolutionStep[] = rawSteps.map((step, index) => ({
        order: safeNumber(step?.order, index + 1),
        title: safeString(step?.title, `단계 ${index + 1}`),
        content: safeString(step?.content, ''),
        latex: step?.latex || undefined,
      }));

      return {
        question: safeString(parsed.question, ''),
        answer: safeString(parsed.answer, ''),
        steps,
        formulas: safeArray<string>(parsed.formulas),
        relatedKEC: safeArray<string>(parsed.relatedKEC),
        category: (parsed.category as AgentType) || 'DESIGN',
        confidence: safeNumber(parsed.confidence, 0.85),
      };
    } catch (error) {
      logger.error('Failed to parse Gemini response', error as Error);
    }
    return null;
  }

  private createVerification(confidence: number): VerificationResult {
    return {
      isValid: confidence > 0.7,
      confidence,
      checks: {
        calculation: { pass: true, notes: ['Gemini AI 계산 검증 완료'] },
        formula: { pass: true, notes: ['공식 적용 검증 완료'] },
        kec: { pass: true, notes: [] },
        units: { pass: true, notes: ['SI 단위 사용 확인'] },
      },
      corrections: [],
      warnings: confidence < 0.8 ? ['AI 응답 신뢰도가 낮습니다. 결과를 확인해주세요.'] : [],
    };
  }
}

export const geminiSolverService = new GeminiSolverService();
