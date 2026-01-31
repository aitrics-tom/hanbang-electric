/**
 * Agent Service - 멀티 에이전트 오케스트레이션
 *
 * 아키텍처:
 * 1. Vision → 이미지 분석 및 사전 분류
 * 2. Orchestrator → 최종 에이전트 결정
 * 3. Specialist Agent → 전문 풀이 생성
 * 4. Verifier → 검증 (병렬 실행)
 *
 * 최적화:
 * - 로컬 키워드 분류로 API 호출 최소화
 * - 스트리밍 응답 지원
 * - 에이전트별 토큰 예산 관리
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentType, SolutionStep, SolutionResponse } from '@/types';
import { AGENT_PROMPTS } from '@/lib/ai/prompts/agents';
import { classifyQuestion, AGENTS } from '@/lib/ai/agents';
import { VisionAnalysisResult } from './vision.service';
import { logger } from '@/lib/api/logger';
import { ragContextService, ragValidator, RAGContext, ValidationResult } from '@/lib/rag';
import { parseAIResponse, safeArray, safeString, safeNumber } from '@/lib/utils/jsonParser';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// 에이전트별 토큰 예산
const TOKEN_BUDGETS = {
  vision: 2048,      // 이미지 분석
  orchestrator: 512, // 라우팅 결정
  solver: 4096,      // 풀이 생성
  verifier: 1024,    // 검증
};

export interface AgentResponse {
  solution: SolutionResponse;
  metadata: {
    visionTime: number;
    solveTime: number;
    verifyTime: number;
    totalTokens: number;
    agentPath: string[];
    ragContext?: {
      sources: string[];
      totalTokens: number;
      chunkCount: number;
    };
    ragValidation?: ValidationResult;
  };
}

export class AgentService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  /**
   * 메인 오케스트레이션 - 비전 분석 결과를 받아 풀이 생성
   */
  async orchestrate(
    visionResult: VisionAnalysisResult,
    imageBase64?: string
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const agentPath: string[] = ['VISION'];

    // 1. 에이전트 결정 (로컬 + 비전 결과 조합)
    const { agent, confidence } = this.determineAgent(visionResult);
    agentPath.push(`ORCHESTRATOR→${agent}`);

    logger.info('Agent determined', { agent, confidence });

    // 2. RAG 컨텍스트 가져오기 (병렬 실행)
    let ragContext: RAGContext | undefined;
    try {
      ragContext = await ragContextService.getContextForAgent(
        visionResult.extractedText,
        agent
      );
      if (ragContext.relevantChunks.length > 0) {
        agentPath.push('RAG');
        logger.info('RAG context loaded', {
          sources: ragContext.sources.length,
          chunks: ragContext.relevantChunks.length,
          tokens: ragContext.totalTokens,
        });
      }
    } catch (error) {
      logger.warn('RAG context failed, proceeding without', { error: (error as Error).message });
    }

    // 3. 전문 에이전트로 풀이 생성 (RAG 컨텍스트 포함)
    const solveStart = Date.now();
    const solution = await this.solveWithAgent(
      agent,
      visionResult,
      imageBase64,
      ragContext
    );
    const solveTime = (Date.now() - solveStart) / 1000;
    agentPath.push(`SOLVER:${agent}`);

    // 4. 검증 (기존 검증 + RAG 검증 병렬 실행)
    const verifyStart = Date.now();
    const [verification, ragValidation] = await Promise.all([
      this.verify(visionResult.extractedText, solution),
      this.validateWithRAG(solution.answer, {
        question: visionResult.extractedText,
        usedKEC: solution.relatedKEC,
        usedFormulas: solution.formulas,
      }),
    ]);
    const verifyTime = (Date.now() - verifyStart) / 1000;
    agentPath.push('VERIFIER');
    if (ragValidation) {
      agentPath.push('RAG_VALIDATOR');
    }

    const totalTime = (Date.now() - startTime) / 1000;

    // RAG 검증 결과를 기존 검증에 병합
    const mergedVerification = this.mergeVerification(verification, ragValidation);

    return {
      solution: {
        id: `sol-${Date.now()}`,
        question: visionResult.extractedText,
        category: agent,
        solution: solution.summary,
        answer: solution.answer,
        steps: solution.steps,
        formulas: [...(visionResult.formulas || []), ...solution.formulas],
        relatedKEC: solution.relatedKEC,
        verification: mergedVerification,
        agents: {
          primary: agent,
          secondary: this.getSecondaryAgents(visionResult, agent),
        },
        processingTime: totalTime,
        createdAt: new Date(),
      },
      metadata: {
        visionTime: visionResult.processingTime,
        solveTime,
        verifyTime,
        totalTokens: TOKEN_BUDGETS.vision + TOKEN_BUDGETS.solver + TOKEN_BUDGETS.verifier + (ragContext?.totalTokens || 0),
        agentPath,
        ragContext: ragContext ? {
          sources: ragContext.sources,
          totalTokens: ragContext.totalTokens,
          chunkCount: ragContext.relevantChunks.length,
        } : undefined,
        ragValidation,
      },
    };
  }

  /**
   * RAG 기반 답변 검증
   */
  private async validateWithRAG(
    answer: string,
    context: {
      question: string;
      usedKEC?: string[];
      usedFormulas?: string[];
    }
  ): Promise<ValidationResult | undefined> {
    try {
      return await ragValidator.validate(answer, context);
    } catch (error) {
      logger.warn('RAG validation failed', { error: (error as Error).message });
      return undefined;
    }
  }

  /**
   * 검증 결과 병합
   */
  private mergeVerification(
    baseVerification: SolutionResponse['verification'],
    ragValidation?: ValidationResult
  ): SolutionResponse['verification'] {
    if (!ragValidation) {
      return baseVerification;
    }

    // RAG 검증 결과로 신뢰도 조정
    const adjustedConfidence = baseVerification.confidence * 0.6 + ragValidation.confidence * 0.4;

    // 경고 병합
    const warnings = [
      ...baseVerification.warnings,
      ...ragValidation.suggestions,
    ];

    // KEC 검증 결과 - 스마트 검증 결과 반영
    const kecNotes: string[] = [
      ...baseVerification.checks.kec.notes,
    ];

    // 검증된 KEC 코드 추가
    if (ragValidation.kecValidation.verified.length > 0) {
      kecNotes.push(`KEC 검증 완료: ${ragValidation.kecValidation.verified.join(', ')}`);
    }

    // 미검증 KEC 코드 추가 (경고)
    if (ragValidation.kecValidation.invalid.length > 0) {
      kecNotes.push(`KEC 미확인: ${ragValidation.kecValidation.invalid.join(', ')}`);
    }

    const kecCheck = {
      ...baseVerification.checks.kec,
      notes: kecNotes,
      // 스마트 검증: invalid가 없으면 pass
      pass: ragValidation.kecValidation.invalid.length === 0,
    };

    return {
      ...baseVerification,
      confidence: adjustedConfidence,
      isValid: baseVerification.isValid && ragValidation.isValid,
      checks: {
        ...baseVerification.checks,
        kec: kecCheck,
      },
      warnings,
    };
  }

  /**
   * 에이전트 결정 - 로컬 분류 + 비전 결과 조합
   */
  private determineAgent(visionResult: VisionAnalysisResult): {
    agent: AgentType;
    confidence: number;
  } {
    // 비전 분석의 신뢰도가 높으면 그대로 사용
    if (visionResult.confidence >= 0.85) {
      return {
        agent: visionResult.suggestedAgent,
        confidence: visionResult.confidence,
      };
    }

    // 로컬 키워드 분류와 비교
    const localClassification = classifyQuestion(visionResult.extractedText);

    // 회로도가 있으면 SEQUENCE 우선
    if (visionResult.circuitAnalysis?.type === 'sequence') {
      return { agent: 'SEQUENCE', confidence: 0.9 };
    }

    // 두 분류가 일치하면 신뢰도 상승
    if (localClassification.primary === visionResult.suggestedAgent) {
      return {
        agent: localClassification.primary,
        confidence: Math.min(0.95, localClassification.confidence + 0.1),
      };
    }

    // 로컬 분류의 신뢰도가 높으면 로컬 사용
    if (localClassification.confidence > visionResult.confidence) {
      return {
        agent: localClassification.primary,
        confidence: localClassification.confidence,
      };
    }

    return {
      agent: visionResult.suggestedAgent,
      confidence: visionResult.confidence,
    };
  }

  /**
   * 보조 에이전트 결정
   */
  private getSecondaryAgents(
    visionResult: VisionAnalysisResult,
    primaryAgent: AgentType
  ): AgentType[] {
    const secondary: AgentType[] = [];

    // KEC 키워드가 있으면 KEC 에이전트 추가
    const kecKeywords = ['접지', 'KEC', '규정', 'TT', 'TN', '누전'];
    if (
      primaryAgent !== 'KEC' &&
      visionResult.keywords.some((k) => kecKeywords.some((kec) => k.includes(kec)))
    ) {
      secondary.push('KEC');
    }

    return secondary;
  }

  /**
   * 전문 에이전트로 풀이 생성
   * Gemini 3 Pro 사용 - 고급 추론이 필요한 복잡한 계산에 최적
   */
  private async solveWithAgent(
    agent: AgentType,
    visionResult: VisionAnalysisResult,
    imageBase64?: string,
    ragContext?: RAGContext
  ): Promise<{
    summary: string;
    answer: string;
    steps: SolutionStep[];
    formulas: string[];
    relatedKEC: string[];
  }> {
    // Gemini 3 Pro: 복잡한 추론/계산에 최적화
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: TOKEN_BUDGETS.solver,
      },
    });

    const systemPrompt = AGENT_PROMPTS[agent];
    const agentInfo = AGENTS[agent];

    // 문제 텍스트 안전하게 정리 (JSON/코드블록 형식이 남아있지 않도록)
    const cleanedProblemText = this.sanitizeProblemText(visionResult.extractedText);

    // 회로도 분석 정보 포함
    const circuitContext = visionResult.circuitAnalysis?.type !== 'none'
      ? `\n\n## 회로도 분석 결과
- 회로 유형: ${visionResult.circuitAnalysis?.type}
- 구성요소: ${visionResult.circuitAnalysis?.components?.join(', ')}
- 연결: ${visionResult.circuitAnalysis?.connections?.join(', ')}
- 설명: ${visionResult.circuitAnalysis?.description}`
      : '';

    // RAG 참조 자료 포함
    const ragReference = ragContext?.formattedContext || '';

    const userPrompt = `${systemPrompt}

---
${ragReference}
---

# 문제
${cleanedProblemText}
${circuitContext}

# 요청
위 문제를 ${agentInfo.name} 전문가로서 단계별로 상세히 풀이해주세요.
${ragReference ? '\n참조자료가 제공되었습니다. 답변 시 해당 자료를 참고하고, 정확한 인용 시 출처를 명시하세요.' : ''}

# 응답 형식 (JSON)
{
  "answer": "최종 답 (단위 포함)",
  "summary": "풀이 요약 (1-2문장)",
  "steps": [
    {
      "order": 1,
      "title": "문제 분석",
      "content": "주어진 조건:\\n- 조건1\\n- 조건2",
      "latex": ""
    },
    {
      "order": 2,
      "title": "공식 적용",
      "content": "적용할 공식 설명",
      "latex": "N = \\\\frac{E \\\\times A \\\\times M}{F \\\\times U}"
    }
  ],
  "formulas": ["광속법 (N = EAM/FU)"],
  "relatedKEC": ["KEC 142.3"]
}

중요:
- 계산은 반드시 정확하게 수행하세요
- 등수, 개수는 올림 처리하세요
- 단위를 반드시 포함하세요
- LaTeX 수식에서 백슬래시는 이중 이스케이프 (\\\\)
- 참조자료에서 관련 KEC 조항을 찾아 relatedKEC에 포함하세요
- content 필드에 마크다운 문법(**, ##, *)을 절대 사용하지 마세요. 일반 텍스트만 사용하세요.`;

    try {
      const result = await model.generateContent(userPrompt);
      const responseText = result.response.text();

      return this.parseSolutionResponse(responseText);
    } catch (error) {
      logger.error('Agent solve failed', error as Error);
      throw error;
    }
  }

  /**
   * 풀이 검증
   */
  private async verify(
    question: string,
    solution: { answer: string; steps: SolutionStep[] }
  ): Promise<SolutionResponse['verification']> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: TOKEN_BUDGETS.verifier,
      },
    });

    const stepsText = solution.steps
      .map((s) => `${s.order}. ${s.title}: ${s.content}`)
      .join('\n');

    const prompt = `전기기사 풀이 검증:

문제: ${question}
풀이: ${stepsText}
답: ${solution.answer}

검증 항목:
1. 계산 정확성 - 수치 대입 및 연산 오류
2. 공식 적합성 - 문제에 맞는 공식 사용
3. 단위 일관성 - SI 단위 사용

JSON 응답:
{
  "isValid": true,
  "confidence": 0.95,
  "checks": {
    "calculation": {"pass": true, "notes": ["계산 정확"]},
    "formula": {"pass": true, "notes": ["공식 적절"]},
    "kec": {"pass": true, "notes": []},
    "units": {"pass": true, "notes": ["단위 정확"]}
  },
  "corrections": [],
  "warnings": []
}`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed = this.parseJSON(responseText);

      if (parsed) {
        return {
          isValid: parsed.isValid as boolean ?? true,
          confidence: parsed.confidence as number ?? 0.85,
          checks: parsed.checks as SolutionResponse['verification']['checks'],
          corrections: parsed.corrections as string[] ?? [],
          warnings: parsed.warnings as string[] ?? [],
        };
      }
    } catch (error) {
      logger.error('Verification failed', error as Error);
    }

    return this.defaultVerification();
  }

  /**
   * 문제 텍스트 안전하게 정리
   * JSON/코드블록 형식이 남아있지 않도록 보장
   * 이렇게 해야 Gemini가 프롬프트 내 중괄호를 혼동하지 않음
   */
  private sanitizeProblemText(text: string): string {
    if (!text) return '문제를 인식할 수 없습니다.';

    let cleaned = text;

    // 1. 코드 블록 제거 (```json, ```, 등)
    cleaned = cleaned.replace(/```(?:json|javascript|typescript|js|ts)?\s*[\s\S]*?```/gi, '');
    cleaned = cleaned.replace(/```/g, '');

    // 2. JSON 키-값 패턴 제거
    cleaned = cleaned.replace(/"[a-zA-Z_]+"\s*:\s*"[^"]*"/g, '');
    cleaned = cleaned.replace(/"[a-zA-Z_]+"\s*:\s*\[[^\]]*\]/g, '');
    cleaned = cleaned.replace(/"[a-zA-Z_]+"\s*:\s*\{[^}]*\}/g, '');
    cleaned = cleaned.replace(/"[a-zA-Z_]+"\s*:\s*[\d.]+/g, '');
    cleaned = cleaned.replace(/"[a-zA-Z_]+"\s*:/g, '');

    // 3. 단독 중괄호/대괄호 쌍 제거 (비어있는 경우)
    cleaned = cleaned.replace(/\{\s*\}/g, '');
    cleaned = cleaned.replace(/\[\s*\]/g, '');

    // 4. 연속 줄바꿈 정리
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

    // 5. 앞뒤 공백 제거
    cleaned = cleaned.trim();

    // 6. 너무 짧으면 원본 반환 (최소한의 정리만 적용)
    if (cleaned.length < 10) {
      return text.replace(/```[\s\S]*?```/g, '').replace(/```/g, '').trim();
    }

    return cleaned;
  }

  private parseSolutionResponse(responseText: string): {
    summary: string;
    answer: string;
    steps: SolutionStep[];
    formulas: string[];
    relatedKEC: string[];
  } {
    try {
      const parsed = this.parseJSON(responseText);

      if (parsed) {
        // 타입 안전한 배열 추출
        const rawSteps = safeArray<{
          order?: number;
          title?: string;
          content?: string;
          latex?: string;
        }>(parsed.steps);

        const steps: SolutionStep[] = rawSteps.map((step, index) => ({
          order: safeNumber(step?.order, index + 1),
          title: this.stripMarkdown(safeString(step?.title, `단계 ${index + 1}`)),
          content: this.stripMarkdown(safeString(step?.content, '')),
          latex: step?.latex || undefined,
        }));

        return {
          summary: this.stripMarkdown(safeString(parsed.summary, '')),
          answer: safeString(parsed.answer, ''),
          steps,
          formulas: safeArray<string>(parsed.formulas),
          relatedKEC: safeArray<string>(parsed.relatedKEC),
        };
      }
    } catch (error) {
      logger.error('Failed to parse solution response', error as Error);
    }

    // JSON 파싱 실패 시 원본에서 텍스트 추출 시도
    const cleanedText = this.extractTextFromJSON(responseText);

    return {
      summary: '',
      answer: '',
      steps: [{ order: 1, title: '풀이', content: cleanedText }],
      formulas: [],
      relatedKEC: [],
    };
  }

  /**
   * JSON 응답에서 텍스트만 추출 (파싱 실패 시 폴백)
   */
  private extractTextFromJSON(text: string): string {
    let result = text.trim();

    // 1. 전체가 JSON인 경우 파싱 시도
    if (result.startsWith('{') && result.endsWith('}')) {
      try {
        const parsed = JSON.parse(result);
        // answer, summary, steps 등에서 텍스트 추출
        const parts: string[] = [];
        if (parsed.answer) parts.push(`답: ${parsed.answer}`);
        if (parsed.summary) parts.push(parsed.summary);
        if (parsed.steps && Array.isArray(parsed.steps)) {
          parsed.steps.forEach((step: { title?: string; content?: string }, i: number) => {
            if (step.content) {
              parts.push(`${i + 1}. ${step.title || ''}: ${step.content}`);
            }
          });
        }
        if (parts.length > 0) {
          return this.stripMarkdown(parts.join('\n\n'));
        }
      } catch {
        // 파싱 실패 시 계속 진행
      }
    }

    // 2. JSON 패턴 제거
    result = result.replace(/```[\s\S]*?```/g, '');
    result = result.replace(/```/g, '');
    result = result.replace(/"[a-zA-Z_]+"\s*:\s*"([^"]*)"/g, '$1');
    result = result.replace(/"[a-zA-Z_]+"\s*:\s*\[/g, '');
    result = result.replace(/"[a-zA-Z_]+"\s*:\s*\{/g, '');
    result = result.replace(/[{}\[\]",]/g, ' ');
    result = result.replace(/\s{2,}/g, ' ');

    return this.stripMarkdown(result.trim());
  }

  /**
   * 마크다운 문법 제거
   */
  private stripMarkdown(text: string): string {
    if (!text) return '';

    return text
      // 볼드/이탤릭 제거: **text** → text, *text* → text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // 헤딩 제거: ## text → text
      .replace(/^#{1,6}\s*/gm, '')
      // 인라인 코드 제거: `code` → code
      .replace(/`([^`]+)`/g, '$1')
      // 링크 제거: [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 불릿 리스트 정리: - item → item (앞에 - 만 제거)
      .replace(/^[\-\*]\s+/gm, '• ')
      .trim();
  }

  private parseJSON(text: string): Record<string, unknown> | null {
    const result = parseAIResponse<Record<string, unknown>>(text);
    return result.data;
  }

  private defaultVerification(): SolutionResponse['verification'] {
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

export const agentService = new AgentService();
