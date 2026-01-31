/**
 * RAG Validator - 답변 검증 및 Guardrails
 *
 * 기능:
 * 1. 답변에 사용된 용어 검증
 * 2. KEC 코드 인용 검증 (Multi-stage 스마트 검색)
 * 3. 공식 정확성 검증
 * 4. Hallucination 탐지
 *
 * KEC 검증 전략:
 * - Stage 1: 정확 KEC 코드 매칭 (예: 232.8)
 * - Stage 2: 상위 코드 매칭 (예: 232.8 → 232)
 * - Stage 3: 토픽 시맨틱 검색 (예: "조명설비" 추출하여 검색)
 * - Stage 4: 관련 키워드 검색 (예: 역률, 콘덴서 등)
 * - ANY stage에서 관련 컨텐츠 발견 시 VERIFIED 처리
 */

import { ragContextService, retrievalService } from '@/lib/rag';
import { logger } from '@/lib/api/logger';

// Multi-stage KEC 검색 결과
interface MultiStageSearchResult {
  verified: boolean;
  stage: 'exact' | 'parent' | 'topic' | 'keyword' | 'none';
  score: number;
  matchedContent?: string;
  relatedCodes: string[];
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  termValidation: {
    verified: string[];
    unverified: string[];
    corrections: { term: string; suggestion: string }[];
  };
  kecValidation: {
    verified: string[];
    invalid: string[];
    context: { code: string; summary: string }[];
  };
  formulaValidation: {
    verified: string[];
    warnings: string[];
  };
  hallucinationScore: number;
  suggestions: string[];
}

export class RAGValidator {
  /**
   * 종합 검증
   */
  async validate(
    answer: string,
    context: {
      question: string;
      usedTerms?: string[];
      usedKEC?: string[];
      usedFormulas?: string[];
    }
  ): Promise<ValidationResult> {
    const [termResult, kecResult, formulaResult] = await Promise.all([
      this.validateTerms(context.usedTerms || this.extractTerms(answer)),
      this.validateKEC(context.usedKEC || this.extractKECCodes(answer)),
      this.validateFormulas(
        context.question,
        context.usedFormulas || this.extractFormulas(answer)
      ),
    ]);

    // Hallucination 점수 계산
    const hallucinationScore = this.calculateHallucinationScore(
      termResult,
      kecResult,
      formulaResult
    );

    // 스마트 검증 결과를 실제로 반영
    // KEC invalid가 있어도 전체 답변이 invalid가 되지는 않음 (경고만 표시)
    // 단, hallucination score가 높거나 미검증 용어가 많으면 invalid
    const isValid =
      termResult.unverified.length === 0 &&
      hallucinationScore < 0.3;

    const confidence = this.calculateConfidence(
      termResult,
      kecResult,
      formulaResult,
      hallucinationScore
    );

    const suggestions = this.generateSuggestions(
      termResult,
      kecResult,
      formulaResult,
      hallucinationScore
    );

    return {
      isValid,
      confidence,
      termValidation: termResult,
      kecValidation: kecResult,
      formulaValidation: formulaResult,
      hallucinationScore,
      suggestions,
    };
  }

  /**
   * 용어 검증 - RAG로 전기 용어 사전 대조
   */
  private async validateTerms(
    terms: string[]
  ): Promise<ValidationResult['termValidation']> {
    const verified: string[] = [];
    const unverified: string[] = [];
    const corrections: { term: string; suggestion: string }[] = [];

    if (terms.length === 0) {
      return { verified, unverified, corrections };
    }

    try {
      const context = await ragContextService.getTermVerificationContext(terms);

      for (const term of terms) {
        const found = context.relevantChunks.some(
          (chunk) =>
            chunk.content.includes(term) ||
            chunk.content.toLowerCase().includes(term.toLowerCase())
        );

        if (found) {
          verified.push(term);
        } else {
          // 유사 용어 찾기
          const similarTerm = this.findSimilarTerm(
            term,
            context.relevantChunks.map((c) => c.content).join(' ')
          );

          if (similarTerm) {
            corrections.push({ term, suggestion: similarTerm });
          } else {
            unverified.push(term);
          }
        }
      }
    } catch (error) {
      logger.error('Term validation failed', error as Error);
    }

    return { verified, unverified, corrections };
  }

  /**
   * KEC 코드 검증 (Multi-stage 스마트 검색)
   *
   * 4단계 검색 전략:
   * 1. 정확 KEC 코드 매칭 (예: "232.8")
   * 2. 상위 코드 매칭 (예: "232.8" → "232")
   * 3. 토픽 시맨틱 검색 (예: "KEC 230 (조명설비)" → "조명설비" 추출)
   * 4. 관련 키워드 검색 (예: 역률, 콘덴서 등)
   *
   * ANY stage에서 score >= 0.3 결과 발견 시 VERIFIED
   */
  private async validateKEC(
    kecCodes: string[]
  ): Promise<ValidationResult['kecValidation']> {
    const verified: string[] = [];
    const invalid: string[] = [];
    const context: { code: string; summary: string }[] = [];

    if (kecCodes.length === 0) {
      return { verified, invalid, context };
    }

    const MIN_SCORE_THRESHOLD = 0.3;

    for (const code of kecCodes) {
      try {
        // Multi-stage 검색 실행
        const searchResult = await this.multiStageKecSearch(code);

        if (searchResult.verified) {
          verified.push(code);
          context.push({
            code,
            summary: searchResult.matchedContent
              ? `[${searchResult.stage}] ${searchResult.matchedContent.slice(0, 200)}...`
              : `[${searchResult.stage}] 관련 내용 발견 (score: ${(searchResult.score * 100).toFixed(0)}%)`,
          });
          logger.info(`KEC ${code}: ${searchResult.stage} 단계에서 검증 성공 (score: ${searchResult.score.toFixed(2)})`);
        } else {
          // RAG에서 찾지 못함 - invalid로 표시
          invalid.push(code);
          context.push({
            code,
            summary: `RAG 검증 실패 - 관련 내용을 찾을 수 없음 (threshold: ${MIN_SCORE_THRESHOLD})`,
          });
          logger.warn(`KEC ${code}: Multi-stage 검색 실패 - 모든 단계에서 관련 내용 없음`);
        }
      } catch (error) {
        logger.error(`KEC ${code} validation failed`, error as Error);
        // 에러 발생 시에도 invalid로 표시하되, 별도 메시지
        invalid.push(code);
        context.push({
          code,
          summary: `검증 중 오류 발생: ${(error as Error).message}`,
        });
      }
    }

    return { verified, invalid, context };
  }

  /**
   * Multi-stage KEC 검색
   * 4단계 검색을 순차적으로 실행하여 첫 번째 성공 시 반환
   */
  private async multiStageKecSearch(kecCode: string): Promise<MultiStageSearchResult> {
    const MIN_SCORE = 0.3;

    // KEC 코드에서 토픽 추출 (예: "KEC 230 (조명설비)" → "조명설비")
    const topic = this.extractTopicFromKEC(kecCode);
    const normalizedCode = kecCode.replace(/^KEC[\s_]*/i, '').trim();
    const parentCode = this.extractParentCode(normalizedCode);

    logger.info(`Multi-stage KEC search: code=${normalizedCode}, topic=${topic}, parent=${parentCode}`);

    // Stage 1: 정확 KEC 코드 매칭
    try {
      const exactResults = await retrievalService.retrieveByKecCode(kecCode);
      if (exactResults.length > 0 && exactResults[0].score >= MIN_SCORE) {
        return {
          verified: true,
          stage: 'exact',
          score: exactResults[0].score,
          matchedContent: exactResults[0].chunk.content,
          relatedCodes: exactResults[0].chunk.kecCodes,
        };
      }

      // 정규화된 코드로도 시도
      if (normalizedCode !== kecCode) {
        const normalizedResults = await retrievalService.retrieveByKecCode(normalizedCode);
        if (normalizedResults.length > 0 && normalizedResults[0].score >= MIN_SCORE) {
          return {
            verified: true,
            stage: 'exact',
            score: normalizedResults[0].score,
            matchedContent: normalizedResults[0].chunk.content,
            relatedCodes: normalizedResults[0].chunk.kecCodes,
          };
        }
      }
    } catch (error) {
      logger.warn(`Stage 1 (exact) failed for ${kecCode}`, { error: (error as Error).message });
    }

    // Stage 2: 상위 코드 매칭 (예: 232.8 → 232)
    if (parentCode) {
      try {
        const parentResults = await retrievalService.retrieveByKecCode(parentCode);
        if (parentResults.length > 0 && parentResults[0].score >= MIN_SCORE) {
          return {
            verified: true,
            stage: 'parent',
            score: parentResults[0].score * 0.9, // 상위 코드는 약간 점수 낮춤
            matchedContent: parentResults[0].chunk.content,
            relatedCodes: parentResults[0].chunk.kecCodes,
          };
        }
      } catch (error) {
        logger.warn(`Stage 2 (parent) failed for ${parentCode}`, { error: (error as Error).message });
      }
    }

    // Stage 3: 토픽 시맨틱 검색 (예: "조명설비")
    if (topic) {
      try {
        const topicResults = await retrievalService.retrieve({
          query: topic,
          topK: 5,
          minScore: MIN_SCORE,
          includeKeyword: true,
        });
        if (topicResults.length > 0 && topicResults[0].score >= MIN_SCORE) {
          return {
            verified: true,
            stage: 'topic',
            score: topicResults[0].score * 0.85, // 토픽 검색은 약간 점수 낮춤
            matchedContent: topicResults[0].chunk.content,
            relatedCodes: topicResults[0].chunk.kecCodes,
          };
        }
      } catch (error) {
        logger.warn(`Stage 3 (topic) failed for ${topic}`, { error: (error as Error).message });
      }
    }

    // Stage 4: 관련 키워드 검색 (KEC 코드별 키워드 매핑)
    const relatedKeywords = this.getRelatedKeywordsForKEC(normalizedCode);
    if (relatedKeywords.length > 0) {
      try {
        // 여러 키워드 조합으로 검색
        const keywordQuery = relatedKeywords.slice(0, 3).join(' ');
        const keywordResults = await retrievalService.retrieve({
          query: keywordQuery,
          topK: 5,
          minScore: MIN_SCORE,
          includeKeyword: true,
        });
        if (keywordResults.length > 0 && keywordResults[0].score >= MIN_SCORE) {
          return {
            verified: true,
            stage: 'keyword',
            score: keywordResults[0].score * 0.8, // 키워드 검색은 점수 더 낮춤
            matchedContent: keywordResults[0].chunk.content,
            relatedCodes: keywordResults[0].chunk.kecCodes,
          };
        }
      } catch (error) {
        logger.warn(`Stage 4 (keyword) failed for ${relatedKeywords.join(', ')}`, { error: (error as Error).message });
      }
    }

    // 모든 단계 실패
    return {
      verified: false,
      stage: 'none',
      score: 0,
      relatedCodes: [],
    };
  }

  /**
   * KEC 문자열에서 토픽 추출
   * 예: "KEC 230 (조명설비)" → "조명설비"
   * 예: "KEC 232.8 (역률의 유지 및 개선)" → "역률의 유지 및 개선"
   */
  private extractTopicFromKEC(kecString: string): string | null {
    // 괄호 안의 한글 텍스트 추출
    const koreanMatch = kecString.match(/\(([가-힣\s]+)\)/);
    if (koreanMatch) {
      return koreanMatch[1].trim();
    }

    // 괄호 안의 일반 텍스트 추출 (한글/영문 혼합)
    const generalMatch = kecString.match(/\(([^)]+)\)/);
    if (generalMatch) {
      return generalMatch[1].trim();
    }

    return null;
  }

  /**
   * 상위 KEC 코드 추출
   * 예: "232.8" → "232", "232.81" → "232.8", "141.1" → "141"
   */
  private extractParentCode(code: string): string | null {
    const parts = code.split('.');
    if (parts.length <= 1) {
      return null;
    }
    return parts.slice(0, -1).join('.');
  }

  /**
   * KEC 코드별 관련 키워드 매핑
   * rag-context.service.ts의 kecKeywords 매핑과 동기화
   */
  private getRelatedKeywordsForKEC(code: string): string[] {
    const kecKeywords: Record<string, string[]> = {
      // 1XX: 공통사항
      '141': ['접지시스템', 'TT', 'TN', 'IT', '계통접지'],
      '142': ['접지저항', '접지공사', '접지극', '접지선'],

      // 2XX: 저압전기설비
      '210': ['감전보호', '누전차단기', 'RCD', 'ELB'],
      '220': ['피뢰설비', '낙뢰', '피뢰침', 'SPD'],
      '230': ['조명', '조명설비', '조도', '광속법', '룩스', '조명기구'],
      '231': ['배선', '배선방식', '케이블', '전선관'],
      '232': ['배선설비', '전선', '케이블'],
      '232.8': ['역률', '역률개선', '콘덴서', '무효전력', '진상콘덴서'],
      '233': ['특수장소', '위험장소', '폭발위험', '방폭'],
      '234': ['허용전류', '전선굵기', '전선선정'],
      '240': ['전압강하', '전압변동', '전압손실'],
      '241': ['전압강하', '전압강하계산', '전압강하율'],
      '250': ['개폐기', '차단기', '스위치'],
      '260': ['전동기', '모터', '기동방식'],
    };

    // 정확히 일치하는 키워드
    if (kecKeywords[code]) {
      return kecKeywords[code];
    }

    // 상위 코드 키워드
    const parts = code.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      const partialCode = parts.slice(0, i + 1).join('.');
      if (kecKeywords[partialCode]) {
        return kecKeywords[partialCode];
      }
    }

    // 섹션 기반 키워드 (100단위)
    const section = code.split('.')[0];
    if (kecKeywords[section]) {
      return kecKeywords[section];
    }

    return [];
  }

  /**
   * 공식 검증
   */
  private async validateFormulas(
    question: string,
    formulas: string[]
  ): Promise<ValidationResult['formulaValidation']> {
    const verified: string[] = [];
    const warnings: string[] = [];

    if (formulas.length === 0) {
      return { verified, warnings };
    }

    try {
      // 문제 유형에 맞는 공식인지 RAG로 확인
      const context = await retrievalService.buildContext(
        `${question} 공식 계산식`,
        { maxTokens: 1000, topK: 3 }
      );

      for (const formula of formulas) {
        // 공식 키워드 추출
        const formulaKeywords = this.extractFormulaKeywords(formula);

        const found = context.results.some((r) =>
          formulaKeywords.some(
            (kw) =>
              r.chunk.content.includes(kw) ||
              r.chunk.keywords.includes(kw)
          )
        );

        if (found) {
          verified.push(formula);
        } else {
          warnings.push(`공식 "${formula}"이 문제 유형과 맞지 않을 수 있습니다.`);
        }
      }
    } catch (error) {
      logger.error('Formula validation failed', error as Error);
    }

    return { verified, warnings };
  }

  /**
   * Hallucination 점수 계산 (0-1, 낮을수록 좋음)
   * KEC, 용어, 공식 모두 검증에 포함
   */
  private calculateHallucinationScore(
    termResult: ValidationResult['termValidation'],
    kecResult: ValidationResult['kecValidation'],
    formulaResult: ValidationResult['formulaValidation']
  ): number {
    const totalTerms =
      termResult.verified.length + termResult.unverified.length;
    const totalKec =
      kecResult.verified.length + kecResult.invalid.length;
    const totalFormulas =
      formulaResult.verified.length + formulaResult.warnings.length;

    let score = 0;
    let weight = 0;

    // 용어 검증 (30%)
    if (totalTerms > 0) {
      score += (termResult.unverified.length / totalTerms) * 0.3;
      weight += 0.3;
    }

    // KEC 검증 (40%) - 스마트 검증으로 실제 결과 반영
    if (totalKec > 0) {
      score += (kecResult.invalid.length / totalKec) * 0.4;
      weight += 0.4;
    }

    // 공식 검증 (30%)
    if (totalFormulas > 0) {
      score += (formulaResult.warnings.length / totalFormulas) * 0.3;
      weight += 0.3;
    }

    return weight > 0 ? score / weight : 0;
  }

  /**
   * 신뢰도 계산
   * KEC 스마트 검증 결과를 실제로 반영
   */
  private calculateConfidence(
    termResult: ValidationResult['termValidation'],
    kecResult: ValidationResult['kecValidation'],
    formulaResult: ValidationResult['formulaValidation'],
    hallucinationScore: number
  ): number {
    const termScore =
      termResult.verified.length /
      Math.max(1, termResult.verified.length + termResult.unverified.length);

    // KEC 스마트 검증 결과 실제 반영
    const kecScore =
      kecResult.verified.length /
      Math.max(1, kecResult.verified.length + kecResult.invalid.length);

    const formulaScore =
      formulaResult.verified.length /
      Math.max(1, formulaResult.verified.length + formulaResult.warnings.length);

    const baseConfidence = termScore * 0.3 + kecScore * 0.4 + formulaScore * 0.3;

    // Hallucination 점수로 조정
    return Math.max(0, Math.min(1, baseConfidence * (1 - hallucinationScore)));
  }

  /**
   * 개선 제안 생성
   */
  private generateSuggestions(
    termResult: ValidationResult['termValidation'],
    kecResult: ValidationResult['kecValidation'],
    formulaResult: ValidationResult['formulaValidation'],
    hallucinationScore: number
  ): string[] {
    const suggestions: string[] = [];

    // 용어 교정 제안
    for (const correction of termResult.corrections) {
      suggestions.push(
        `"${correction.term}" → "${correction.suggestion}" 수정 권장`
      );
    }

    // 미검증 용어
    if (termResult.unverified.length > 0) {
      suggestions.push(
        `다음 용어의 정확성을 확인해주세요: ${termResult.unverified.join(', ')}`
      );
    }

    // KEC 코드 검증 실패 경고 (스마트 검증으로 실제 결과 반영)
    if (kecResult.invalid.length > 0) {
      suggestions.push(
        `다음 KEC 코드는 RAG에서 관련 내용을 찾을 수 없습니다: ${kecResult.invalid.join(', ')}`
      );
    }

    // 공식 경고
    for (const warning of formulaResult.warnings) {
      suggestions.push(warning);
    }

    // Hallucination 경고
    if (hallucinationScore > 0.3) {
      suggestions.push(
        '답변의 일부 내용이 검증되지 않았습니다. RAG 참조 자료를 확인해주세요.'
      );
    }

    return suggestions;
  }

  /**
   * 답변에서 전문 용어 추출
   */
  private extractTerms(text: string): string[] {
    const patterns = [
      /[가-힣]+(?:기|기기|기계|설비|장치|장비|회로|배선|계통)/g,
      /[A-Z]{2,}(?:\s?[A-Za-z]+)?/g,
      /[가-힣]+(?:법|방식|현상|효과)/g,
    ];

    const terms = new Set<string>();
    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      matches.forEach((m) => terms.add(m));
    }

    return Array.from(terms).slice(0, 10);
  }

  /**
   * KEC 코드 추출
   */
  private extractKECCodes(text: string): string[] {
    const pattern = /KEC\s*\d{3}(?:\.\d+)?(?:\.\d+)?/gi;
    const matches = text.match(pattern) || [];
    return [...new Set(matches.map((m) => m.toUpperCase().replace(/\s/g, ' ')))];
  }

  /**
   * 공식 추출
   */
  private extractFormulas(text: string): string[] {
    const patterns = [
      /[가-힣]+법/g, // 광속법, 루멘법 등
      /[A-Z]\s*=\s*[^\n,]+/g, // P = VI 형태
      /[가-힣]+(?:공식|계산식)/g,
    ];

    const formulas = new Set<string>();
    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      matches.forEach((m) => formulas.add(m.trim()));
    }

    return Array.from(formulas).slice(0, 5);
  }

  /**
   * 유사 용어 찾기
   */
  private findSimilarTerm(term: string, content: string): string | null {
    // 간단한 레벤슈타인 거리 기반 유사도
    const words = content.match(/[가-힣]+/g) || [];
    const uniqueWords = [...new Set(words)];

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const word of uniqueWords) {
      if (word.length < 2) continue;

      const score = this.similarity(term, word);
      if (score > 0.7 && score > bestScore) {
        bestScore = score;
        bestMatch = word;
      }
    }

    return bestMatch;
  }

  /**
   * 공식 키워드 추출
   */
  private extractFormulaKeywords(formula: string): string[] {
    const keywords: string[] = [];

    // 한글 키워드
    const koreanMatch = formula.match(/[가-힣]+/g);
    if (koreanMatch) keywords.push(...koreanMatch);

    // 영문 키워드
    const englishMatch = formula.match(/[A-Za-z]+/g);
    if (englishMatch) keywords.push(...englishMatch);

    return keywords;
  }

  /**
   * 문자열 유사도 (자카드 유사도)
   */
  private similarity(a: string, b: string): number {
    const setA = new Set(a);
    const setB = new Set(b);

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }
}

export const ragValidator = new RAGValidator();
