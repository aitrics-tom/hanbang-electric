/**
 * Embedding Service - Gemini Embedding API 통합
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbeddingRequest, EmbeddingResult } from '@/types/rag';
import { logger } from '@/lib/api/logger';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768;
const MAX_BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 100; // ms

export class EmbeddingService {
  private genAI: GoogleGenerativeAI;
  private cache: Map<string, number[]>;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.cache = new Map();
  }

  /**
   * 단일 텍스트 임베딩 생성
   */
  async embedText(text: string): Promise<number[]> {
    // 캐시 확인
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await this.embedBatch([text]);
    const embedding = result.embeddings[0];

    // 캐시 저장
    this.cache.set(cacheKey, embedding);

    return embedding;
  }

  /**
   * 배치 임베딩 생성
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], model: EMBEDDING_MODEL, totalTokens: 0 };
    }

    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    // 배치 처리
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);

      try {
        const model = this.genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

        // 배치 내 각 텍스트 처리
        for (const text of batch) {
          // 캐시 확인
          const cacheKey = this.getCacheKey(text);
          if (this.cache.has(cacheKey)) {
            allEmbeddings.push(this.cache.get(cacheKey)!);
            continue;
          }

          const result = await model.embedContent(text);
          const embedding = result.embedding.values;

          // 차원 검증
          if (embedding.length !== EMBEDDING_DIMENSION) {
            logger.warn(`Unexpected embedding dimension: ${embedding.length}`);
          }

          allEmbeddings.push(embedding);
          this.cache.set(cacheKey, embedding);
          totalTokens += Math.ceil(text.length * 0.7); // 토큰 추정

          // Rate limit 방지
          await this.delay(RATE_LIMIT_DELAY);
        }
      } catch (error) {
        logger.error('Embedding batch failed', error as Error);
        throw error;
      }
    }

    return {
      embeddings: allEmbeddings,
      model: EMBEDDING_MODEL,
      totalTokens,
    };
  }

  /**
   * 쿼리 임베딩 생성 (검색용)
   */
  async embedQuery(query: string): Promise<number[]> {
    return this.embedText(query);
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(text: string): string {
    // 간단한 해시 (처음 100자 + 길이)
    return `${text.slice(0, 100)}_${text.length}`;
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 임베딩 차원 반환
   */
  getDimension(): number {
    return EMBEDDING_DIMENSION;
  }
}

export const embeddingService = new EmbeddingService();
