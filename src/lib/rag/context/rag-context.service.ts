/**
 * RAG Context Service - 에이전트용 컨텍스트 생성
 */

import { retrievalService } from '../retrieval/retrieval.service';
import { RAGContext, RetrievalResult } from '@/types/rag';
import { AgentType } from '@/types';
import { logger } from '@/lib/api/logger';

// 에이전트별 컨텍스트 설정 (Lenient - 더 많은 컨텍스트 제공)
const AGENT_CONTEXT_CONFIG: Record<
  AgentType,
  {
    maxTokens: number;
    topK: number;
    keywords: string[];
  }
> = {
  DESIGN: {
    maxTokens: 2500,  // 1500 → 2500
    topK: 8,          // 4 → 8
    keywords: ['설계', '배선', '전선', '배관', '도면'],
  },
  SEQUENCE: {
    maxTokens: 2500,  // 1500 → 2500
    topK: 8,          // 4 → 8
    keywords: ['시퀀스', '릴레이', 'PLC', '회로', '접점'],
  },
  LOAD: {
    maxTokens: 3000,  // 2000 → 3000
    topK: 10,         // 5 → 10
    keywords: ['부하', '용량', '변압기', '역률', '전력', '부하율', '수용률'],
  },
  POWER: {
    maxTokens: 3000,  // 2000 → 3000
    topK: 10,         // 5 → 10
    keywords: ['전력공학', '송전', '배전', '전압강하', '단락'],
  },
  RENEWABLE: {
    maxTokens: 2500,  // 1500 → 2500
    topK: 8,          // 4 → 8
    keywords: ['태양광', '신재생', 'ESS', '인버터', '풍력'],
  },
  KEC: {
    maxTokens: 4000,  // 2500 → 4000
    topK: 12,         // 6 → 12
    keywords: ['KEC', '기술기준', '접지', '안전', '규정', '전기설비'],
  },
};

export class RAGContextService {
  /**
   * 에이전트용 RAG 컨텍스트 생성
   */
  async getContextForAgent(
    query: string,
    agentType: AgentType
  ): Promise<RAGContext> {
    const config = AGENT_CONTEXT_CONFIG[agentType];

    try {
      // 쿼리 확장 (에이전트 키워드 추가)
      const expandedQuery = `${query} ${config.keywords.slice(0, 3).join(' ')}`;

      // 컨텍스트 빌드
      const context = await retrievalService.buildContext(expandedQuery, {
        category: agentType,
        maxTokens: config.maxTokens,
        topK: config.topK,
      });

      // RAGContext 형태로 변환
      return this.toRAGContext(context.results, context.totalTokens);
    } catch (error) {
      logger.error(`RAG context failed for ${agentType}`, error as Error);
      return this.emptyContext();
    }
  }

  /**
   * 일반 RAG 컨텍스트 생성 (에이전트 타입 없이)
   */
  async getContext(
    query: string,
    options: {
      maxTokens?: number;
      topK?: number;
    } = {}
  ): Promise<RAGContext> {
    const { maxTokens = 2000, topK = 5 } = options;

    try {
      const context = await retrievalService.buildContext(query, {
        maxTokens,
        topK,
      });

      return this.toRAGContext(context.results, context.totalTokens);
    } catch (error) {
      logger.error('RAG context failed', error as Error);
      return this.emptyContext();
    }
  }

  /**
   * KEC 코드 기반 컨텍스트 (Fuzzy 포함 - 더 많은 관련 코드 검색)
   */
  async getKecContext(kecCodes: string[]): Promise<RAGContext> {
    const allResults: RetrievalResult[] = [];

    for (const code of kecCodes) {
      // 1. 입력된 코드로 검색 (Fuzzy 포함)
      const results = await retrievalService.retrieveByKecCode(code);
      allResults.push(...results);

      // 2. 상위 코드도 검색 (예: "232.8" → "232"도 검색)
      const parts = code.replace(/^KEC[\s_]*/i, '').split('.');
      if (parts.length > 1) {
        const parentCode = parts.slice(0, -1).join('.');
        const parentResults = await retrievalService.retrieveByKecCode(parentCode);
        // 부모 코드 결과는 점수를 약간 낮춤
        allResults.push(...parentResults.map(r => ({
          ...r,
          score: r.score * 0.8,
        })));
      }

      // 3. 관련 키워드로도 검색 (예: "역률" 관련)
      const relatedTerms = this.extractRelatedTerms(code);
      for (const term of relatedTerms.slice(0, 2)) {
        const termResults = await retrievalService.retrieve({
          query: term,
          topK: 3,
          minScore: 0.3,
          includeKeyword: true,
        });
        allResults.push(...termResults.map(r => ({
          ...r,
          score: r.score * 0.7,  // 관련 검색은 점수 낮춤
        })));
      }
    }

    // 중복 제거 및 점수순 정렬
    const uniqueResults = this.deduplicateResults(allResults)
      .sort((a, b) => b.score - a.score);

    const totalTokens = uniqueResults.reduce(
      (sum, r) => sum + Math.ceil(r.chunk.content.length * 0.7),
      0
    );

    return this.toRAGContext(uniqueResults.slice(0, 10), totalTokens);  // 5 → 10
  }

  /**
   * KEC 코드에서 관련 검색어 추출
   */
  private extractRelatedTerms(kecCode: string): string[] {
    // KEC 코드별 관련 키워드 매핑 (확장된 버전)
    const kecKeywords: Record<string, string[]> = {
      // === 1XX: 공통사항 ===
      '141': ['접지시스템', 'TT', 'TN', 'IT', 'TN-S', 'TN-C', 'TN-C-S', '계통접지', '보호접지'],
      '141.1': ['접지시스템', '계통접지', '접지방식'],
      '141.2': ['TT', 'TT계통', 'TT접지'],
      '141.3': ['TN', 'TN계통', 'TN-S', 'TN-C', 'TN-C-S'],
      '141.4': ['IT', 'IT계통', 'IT접지'],
      '142': ['접지저항', '접지', '어스', '접지공사', '접지극', '접지선'],
      '142.1': ['접지저항', '접지저항값', '접지저항측정'],
      '142.2': ['접지공사', '접지극', '접지봉', '접지판'],
      '142.3': ['접지선', '접지도체', '보호도체'],

      // === 2XX: 저압전기설비 ===
      // 210: 감전보호
      '210': ['감전보호', '보호장치', '누전', '감전방지', '보호협조'],
      '210.1': ['직접접촉', '직접접촉보호', '충전부'],
      '210.2': ['간접접촉', '간접접촉보호', '노출도전부'],
      '210.3': ['누전차단기', 'RCD', 'ELB', '누전보호', '지락보호'],
      '210.4': ['보호협조', '보호장치협조', '차단협조'],
      '210.5': ['이중절연', '강화절연', '클래스II'],

      // 220: 피뢰설비
      '220': ['피뢰설비', '낙뢰', '피뢰침', '피뢰시스템', '서지보호'],
      '220.1': ['피뢰침', '수뢰부', '피뢰설비'],
      '220.2': ['인하도선', '피뢰도선', '낙뢰도선'],
      '220.3': ['접지극', '피뢰접지', '낙뢰접지'],
      '220.4': ['서지보호장치', 'SPD', '써지흡수기', '서지흡수기'],

      // 230: 조명설비
      '230': ['조명', '조명설비', '조도', '광속법', '룩스', '조명기구', '광원'],
      '230.1': ['조도', '조도기준', '조명률', '실지수'],
      '230.2': ['광속법', '점광원', '광도', '광속'],
      '230.3': ['조명기구', '광원', '램프', 'LED조명'],
      '230.4': ['조명제어', '디밍', '조광기', '조명스위치'],
      '230.5': ['비상조명', '예비조명', '비상등'],

      // 231: 배선방식
      '231': ['배선', '배선방식', '케이블', '배선공사', '전선관'],
      '231.1': ['금속관배선', '전선관', '강제전선관'],
      '231.2': ['합성수지관', 'PVC관', '가요전선관'],
      '231.3': ['케이블배선', '케이블트레이', '케이블덕트'],
      '231.4': ['애자사용배선', '애자배선', '노출배선'],
      '231.5': ['덕트배선', '버스덕트', '트렌치'],

      // 232: 배선설비
      '232': ['배선설비', '전선', '케이블', '접촉전선', '도체'],
      '232.1': ['절연전선', 'IV전선', 'HIV전선'],
      '232.2': ['케이블', 'CV케이블', 'CVV케이블'],
      '232.3': ['접속', '전선접속', '커넥터'],
      '232.4': ['분기', '분기회로', '분전반'],
      '232.5': ['접촉전선', '트롤리', '버스바'],
      '232.6': ['차단기', '배선용차단기', 'MCCB'],
      '232.7': ['전자접촉기', '마그넷스위치', 'MC'],
      '232.8': ['역률', '역률개선', '콘덴서', '무효전력', '진상콘덴서'],

      // 233: 특수장소
      '233': ['특수장소', '위험장소', '폭발위험', '가연성', '방폭'],
      '233.1': ['위험장소', '0종장소', '1종장소', '2종장소'],
      '233.2': ['방폭구조', '내압방폭', '본질안전방폭'],
      '233.3': ['분진위험장소', '분진폭발', '분진방폭'],
      '233.4': ['가연성가스', '인화성', '폭발한계'],
      '233.5': ['부식성', '습기', '고온장소'],
      '233.6': ['의료장소', '병원전기설비', '의료용접지'],

      // 234: 허용전류
      '234': ['허용전류', '전선굵기', '전선선정', '도체크기', '전선용량'],
      '234.1': ['허용전류표', '전류용량', '도체허용전류'],
      '234.2': ['전선굵기', '전선크기', '도체단면적'],
      '234.3': ['보정계수', '온도보정', '매설보정'],
      '234.4': ['그룹보정', '전선묶음', '복수회로'],
      '234.5': ['단락전류', '단락용량', '차단용량'],

      // 240: 전압강하
      '240': ['전압강하', '전압변동', '전압손실'],
      '241': ['전압강하', '전압손실', '전압강하계산', '전압강하율'],
      '241.1': ['전압강하계산', '전압강하공식', '전압강하율'],
      '241.2': ['간선전압강하', '간선설계', '주회로전압강하'],
      '241.3': ['분기전압강하', '분기회로', '말단전압'],

      // 250: 개폐기
      '250': ['개폐기', '차단기', '스위치', '차단장치'],
      '251': ['배선용차단기', 'MCCB', '과전류차단기'],
      '252': ['누전차단기', 'ELB', 'RCD', '지락차단기'],

      // 260: 전동기
      '260': ['전동기', '모터', '기동방식', '전동기보호'],
      '261': ['전동기기동', 'Y-델타', '리액터기동', '기동보상기'],
      '262': ['전동기보호', '과부하보호', '결상보호'],
    };

    const normalizedCode = kecCode.replace(/^KEC[\s_]*/i, '');

    // 정확히 일치하는 키워드
    if (kecKeywords[normalizedCode]) {
      return kecKeywords[normalizedCode];
    }

    // 상위 코드 키워드
    const baseParts = normalizedCode.split('.');
    for (let i = baseParts.length - 1; i >= 0; i--) {
      const partialCode = baseParts.slice(0, i + 1).join('.');
      if (kecKeywords[partialCode]) {
        return kecKeywords[partialCode];
      }
    }

    return [];
  }

  /**
   * 용어 검증용 컨텍스트 (Lenient)
   */
  async getTermVerificationContext(terms: string[]): Promise<RAGContext> {
    const allResults: RetrievalResult[] = [];

    for (const term of terms.slice(0, 8)) {  // 5 → 8
      const results = await retrievalService.retrieve({
        query: term,
        topK: 4,        // 2 → 4
        minScore: 0.3,  // 0.6 → 0.3 (더 관대)
        includeKeyword: true,
      });
      allResults.push(...results);
    }

    const uniqueResults = this.deduplicateResults(allResults);
    const totalTokens = uniqueResults.reduce(
      (sum, r) => sum + Math.ceil(r.chunk.content.length * 0.7),
      0
    );

    return this.toRAGContext(uniqueResults.slice(0, 10), Math.min(totalTokens, 2500));  // 5→10, 1500→2500
  }

  /**
   * RAGContext 형태로 변환
   */
  private toRAGContext(
    results: RetrievalResult[],
    totalTokens: number
  ): RAGContext {
    const relevantChunks = results.map((r) => ({
      content: r.chunk.content,
      source: r.chunk.metadata.source,
      score: r.score,
      kecCodes: r.chunk.kecCodes,
    }));

    const sources = [...new Set(results.map((r) => r.chunk.metadata.source))];

    // 포맷팅된 컨텍스트
    const formattedContext = this.formatContextForPrompt(results);

    return {
      relevantChunks,
      formattedContext,
      sources,
      totalTokens,
    };
  }

  /**
   * 프롬프트용 컨텍스트 포맷팅
   */
  private formatContextForPrompt(results: RetrievalResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const parts = results.map((r, i) => {
      const { chunk, score } = r;
      const source = chunk.metadata.source;
      const section = chunk.metadata.section || chunk.metadata.title || '';
      const kecInfo =
        chunk.kecCodes.length > 0 ? `\n  - KEC 관련: ${chunk.kecCodes.join(', ')}` : '';

      return `【참조 ${i + 1}】(출처: ${source}${section ? `, ${section}` : ''}, 관련도: ${(score * 100).toFixed(0)}%)${kecInfo}
${chunk.content}`;
    });

    return `
<참조자료>
다음은 질문과 관련된 전기기사 참조 자료입니다. 답변 시 이 자료를 참고하되, 정확히 인용할 때는 출처를 명시하세요.

${parts.join('\n\n')}
</참조자료>
`;
  }

  /**
   * 중복 결과 제거
   */
  private deduplicateResults(results: RetrievalResult[]): RetrievalResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.chunk.id)) return false;
      seen.add(r.chunk.id);
      return true;
    });
  }

  /**
   * 빈 컨텍스트
   */
  private emptyContext(): RAGContext {
    return {
      relevantChunks: [],
      formattedContext: '',
      sources: [],
      totalTokens: 0,
    };
  }
}

export const ragContextService = new RAGContextService();
