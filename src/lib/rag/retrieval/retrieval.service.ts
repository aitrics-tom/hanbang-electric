/**
 * Retrieval Service - RAG 검색 엔진
 */

import { embeddingService } from '../embedding/embedding.service';
import { vectorStoreService } from '../store/vector-store.service';
import { RetrievalQuery, RetrievalResult, RetrievalContext } from '@/types/rag';
import { logger } from '@/lib/api/logger';

// 도메인별 동의어/관련어 맵
const SYNONYM_MAP: Record<string, string[]> = {
  '접지': ['접지', 'grounding', '어스', 'earth', 'TT', 'TN', 'IT'],
  '역률': ['역률', '력률', 'power factor', 'pf', 'cosθ', '무효전력', '역률개선', '콘덴서'],
  '전압강하': ['전압강하', 'voltage drop', '드롭', '전압손실'],
  '변압기': ['변압기', 'transformer', 'TR', '트랜스', '권선'],
  '차단기': ['차단기', 'breaker', 'CB', 'MCCB', 'ACB', 'VCB', 'OCB'],
  '누전': ['누전', '지락', 'leakage', 'earth fault', '누전차단기', 'ELB'],
  '부하': ['부하', 'load', '부하설비', '부하율', '수용률', '부등률'],
  '전동기': ['전동기', 'motor', '모터', '유도전동기', '기동'],
};

export class RetrievalService {
  /**
   * 쿼리 기반 검색 (Lenient - 더 많은 결과 반환)
   */
  async retrieve(query: RetrievalQuery): Promise<RetrievalResult[]> {
    const {
      query: queryText,
      category,
      topK = 20,  // 10 → 20 증가
      minScore = 0.25,  // 0.5 → 0.25 낮춤
      includeKeyword = true,
    } = query;

    try {
      // 쿼리 확장 (동의어 추가)
      const expandedQuery = this.expandQueryWithSynonyms(queryText);

      // 쿼리 임베딩 생성
      const queryEmbedding = await embeddingService.embedQuery(expandedQuery);

      // 하이브리드 검색 또는 시맨틱 검색
      let results: RetrievalResult[];

      if (includeKeyword) {
        results = await vectorStoreService.hybridSearch(queryEmbedding, queryText, {
          topK: topK * 2,  // 더 많이 요청
          category,
          semanticWeight: 0.5, // 0.6 → 0.5 (키워드 비중 높임)
        });
      } else {
        results = await vectorStoreService.searchByVector(queryEmbedding, {
          topK: topK * 2,
          minScore,
          category,
        });
      }

      // 최소 점수 필터링 (더 관대하게)
      let filteredResults = results.filter((r) => r.score >= minScore);

      // 결과가 없으면 fallback 검색 시도
      if (filteredResults.length === 0) {
        logger.info('Primary search returned no results, trying fallback');
        filteredResults = await this.fallbackSearch(queryText, category);
      }

      return filteredResults.slice(0, topK);
    } catch (error) {
      logger.error('Retrieval failed', error as Error);
      return [];
    }
  }

  /**
   * 쿼리에 동의어/관련어 추가
   */
  private expandQueryWithSynonyms(query: string): string {
    let expanded = query;

    for (const [term, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (query.includes(term)) {
        // 첫 2개 동의어만 추가 (너무 많으면 노이즈)
        const additions = synonyms
          .filter(s => !query.includes(s) && s !== term)
          .slice(0, 2)
          .join(' ');
        if (additions) {
          expanded = `${expanded} ${additions}`;
        }
      }
    }

    return expanded;
  }

  /**
   * Fallback 검색 (주요 검색 실패 시)
   */
  private async fallbackSearch(
    queryText: string,
    category?: RetrievalQuery['category']
  ): Promise<RetrievalResult[]> {
    const results: RetrievalResult[] = [];

    // KEC 코드 추출 시도
    const kecPattern = /KEC[\s_]*(\d{3}(?:\.\d+)*)|(\d{3}(?:\.\d+)+)/gi;
    const matches = queryText.match(kecPattern) || [];

    for (const match of matches.slice(0, 3)) {
      const fuzzyResults = await vectorStoreService.fuzzySearchByKecCode(match);
      results.push(...fuzzyResults.map(r => ({
        chunk: r.chunk,
        score: r.matchScore,
        matchType: 'keyword' as const,
      })));
    }

    // 중복 제거
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.chunk.id)) return false;
      seen.add(r.chunk.id);
      return true;
    });
  }

  /**
   * 여러 쿼리로 검색 후 결과 병합 (RRF)
   */
  async multiQueryRetrieve(
    queries: string[],
    options: Omit<RetrievalQuery, 'query'> = {}
  ): Promise<RetrievalResult[]> {
    const allResults: Map<string, { result: RetrievalResult; ranks: number[] }> = new Map();

    // 각 쿼리로 검색
    for (let i = 0; i < queries.length; i++) {
      const results = await this.retrieve({ query: queries[i], ...options });

      results.forEach((result, rank) => {
        const key = result.chunk.id;
        if (!allResults.has(key)) {
          allResults.set(key, { result, ranks: [] });
        }
        allResults.get(key)!.ranks.push(rank + 1);
      });
    }

    // RRF (Reciprocal Rank Fusion) 점수 계산
    const k = 60; // RRF 상수
    const fusedResults: RetrievalResult[] = [];

    for (const [_, { result, ranks }] of allResults) {
      const rrfScore = ranks.reduce((sum, rank) => sum + 1 / (k + rank), 0);
      fusedResults.push({
        ...result,
        score: rrfScore,
        matchType: 'hybrid',
      });
    }

    // 점수순 정렬
    return fusedResults.sort((a, b) => b.score - a.score);
  }

  /**
   * KEC 코드 기반 검색 (Fuzzy 포함)
   * 정확 매칭 실패 시 부분 매칭/유사 코드 검색
   */
  async retrieveByKecCode(kecCode: string): Promise<RetrievalResult[]> {
    // 1. 정확 매칭 시도
    const exactChunks = await vectorStoreService.searchByKecCode(kecCode);

    if (exactChunks.length > 0) {
      return exactChunks.map((chunk) => ({
        chunk,
        score: 1.0,
        matchType: 'keyword' as const,
      }));
    }

    // 2. Fuzzy 검색으로 fallback
    logger.info(`Exact KEC match failed for "${kecCode}", trying fuzzy search`);
    const fuzzyResults = await vectorStoreService.fuzzySearchByKecCode(kecCode);

    return fuzzyResults.map((r) => ({
      chunk: r.chunk,
      score: r.matchScore,
      matchType: 'keyword' as const,
    }));
  }

  /**
   * 컨텍스트 생성 (에이전트용) - Lenient
   */
  async buildContext(
    query: string,
    options: {
      category?: RetrievalQuery['category'];
      maxTokens?: number;
      topK?: number;
    } = {}
  ): Promise<RetrievalContext> {
    const { category, maxTokens = 3000, topK = 8 } = options;  // 토큰/결과 수 증가

    // 검색 실행 (더 많은 후보)
    const results = await this.retrieve({
      query,
      category,
      topK: topK * 3, // 3배로 늘림
      minScore: 0.2,  // 0.5 → 0.2 (더 관대)
      includeKeyword: true,
    });

    // 토큰 예산 내에서 청크 선택
    const selectedResults: RetrievalResult[] = [];
    let totalTokens = 0;
    const sources = new Set<string>();

    for (const result of results) {
      const chunkTokens = Math.ceil(result.chunk.content.length * 0.7);

      if (totalTokens + chunkTokens <= maxTokens) {
        selectedResults.push(result);
        totalTokens += chunkTokens;
        sources.add(result.chunk.metadata.source);

        if (selectedResults.length >= topK) break;
      }
    }

    // 포맷팅된 컨텍스트 생성
    const formattedContext = this.formatContext(selectedResults);

    return {
      results: selectedResults,
      query,
      totalTokens,
      sources: Array.from(sources),
    };
  }

  /**
   * 컨텍스트 포맷팅
   */
  private formatContext(results: RetrievalResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const contextParts = results.map((r, i) => {
      const { chunk } = r;
      const source = chunk.metadata.source;
      const section = chunk.metadata.section || chunk.metadata.title || '';
      const kecInfo = chunk.kecCodes.length > 0 ? ` [KEC ${chunk.kecCodes.join(', ')}]` : '';

      return `[참조 ${i + 1}] ${source}${section ? ` - ${section}` : ''}${kecInfo}\n${chunk.content}`;
    });

    return `--- 관련 참조 자료 ---\n\n${contextParts.join('\n\n')}\n\n--- 참조 자료 끝 ---`;
  }
}

export const retrievalService = new RetrievalService();
