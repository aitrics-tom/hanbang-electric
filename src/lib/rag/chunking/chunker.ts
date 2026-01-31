/**
 * Chunker - 문서 청킹 서비스
 */

import { ChunkingOptions, ChunkMetadata } from '@/types/rag';
import { AgentType } from '@/types';

export interface ChunkResult {
  content: string;
  metadata: ChunkMetadata;
  keywords: string[];
  kecCodes: string[];
  category?: AgentType;
  tokenCount: number;
}

// 기본 청킹 옵션
const DEFAULT_OPTIONS: ChunkingOptions = {
  chunkSize: 512,
  chunkOverlap: 64,
  preserveMetadata: true,
};

export class Chunker {
  private options: ChunkingOptions;

  constructor(options: Partial<ChunkingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 텍스트를 청크로 분할
   */
  chunkText(
    text: string,
    metadata: ChunkMetadata,
    extractors?: {
      keywords?: (content: string, metadata?: ChunkMetadata) => string[];
      kecCodes?: (content: string, metadata?: ChunkMetadata) => string[];
      category?: (content: string) => AgentType | undefined;
    }
  ): ChunkResult[] {
    const chunks: ChunkResult[] = [];
    const { chunkSize, chunkOverlap } = this.options;

    // 간단한 토큰 추정 (한글은 글자당 ~1.5 토큰)
    const estimateTokens = (s: string) => Math.ceil(s.length * 0.7);

    // 문장 단위로 분리
    const sentences = this.splitIntoSentences(text);

    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);

      if (currentTokens + sentenceTokens > chunkSize && currentChunk.length > 0) {
        // 현재 청크 저장
        const content = currentChunk.join(' ').trim();
        chunks.push(this.createChunkResult(content, metadata, extractors));

        // 오버랩 처리
        const overlapSentences: string[] = [];
        let overlapTokens = 0;

        for (let i = currentChunk.length - 1; i >= 0; i--) {
          const tokens = estimateTokens(currentChunk[i]);
          if (overlapTokens + tokens <= chunkOverlap) {
            overlapSentences.unshift(currentChunk[i]);
            overlapTokens += tokens;
          } else {
            break;
          }
        }

        currentChunk = overlapSentences;
        currentTokens = overlapTokens;
      }

      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }

    // 마지막 청크 저장
    if (currentChunk.length > 0) {
      const content = currentChunk.join(' ').trim();
      if (content.length > 0) {
        chunks.push(this.createChunkResult(content, metadata, extractors));
      }
    }

    return chunks;
  }

  /**
   * 섹션 기반 청킹 (MD/PDF 섹션 활용)
   */
  chunkSections(
    sections: Array<{ content: string; metadata: ChunkMetadata }>,
    extractors?: {
      keywords?: (content: string, metadata?: ChunkMetadata) => string[];
      kecCodes?: (content: string, metadata?: ChunkMetadata) => string[];
      category?: (content: string) => AgentType | undefined;
    }
  ): ChunkResult[] {
    const allChunks: ChunkResult[] = [];

    for (const section of sections) {
      if (section.content.length === 0) continue;

      // 섹션이 청크 크기보다 작으면 그대로 사용
      const estimatedTokens = Math.ceil(section.content.length * 0.7);

      if (estimatedTokens <= this.options.chunkSize) {
        allChunks.push(this.createChunkResult(section.content, section.metadata, extractors));
      } else {
        // 섹션이 크면 추가 분할
        const subChunks = this.chunkText(section.content, section.metadata, extractors);
        allChunks.push(...subChunks);
      }
    }

    return allChunks;
  }

  /**
   * 문장 단위로 분리
   * - 숫자 사이의 마침표(소수점, KEC 코드 등)는 보존
   * - 문장 종결 마침표만 분리
   */
  private splitIntoSentences(text: string): string[] {
    // 마침표가 문장 끝인지 확인하는 로직:
    // - 숫자.숫자 패턴은 유지 (예: 232.3.9, 3.14)
    // - 문장 끝 마침표(뒤에 공백+대문자/한글 또는 줄바꿈)만 분리

    // 먼저 숫자 사이의 마침표를 임시 마커로 대체
    // 중첩 패턴(232.3.9)을 처리하기 위해 반복 적용
    const placeholder = '\u0000NUM_DOT\u0000';
    let preserved = text;
    let prev = '';
    while (prev !== preserved) {
      prev = preserved;
      preserved = preserved.replace(/(\d)\.(\d)/g, `$1${placeholder}$2`);
    }

    // 문장 종결 패턴으로 분리
    const sentencePattern = /[^.!?。？！\n]+[.!?。？！\n]?/g;
    const matches = preserved.match(sentencePattern) || [];

    // 마커를 다시 마침표로 복원
    return matches
      .map((s) => s.replace(new RegExp(placeholder, 'g'), '.').trim())
      .filter((s) => s.length > 0);
  }

  /**
   * ChunkResult 생성
   */
  private createChunkResult(
    content: string,
    metadata: ChunkMetadata,
    extractors?: {
      keywords?: (content: string, metadata?: ChunkMetadata) => string[];
      kecCodes?: (content: string, metadata?: ChunkMetadata) => string[];
      category?: (content: string) => AgentType | undefined;
    }
  ): ChunkResult {
    return {
      content,
      metadata,
      keywords: extractors?.keywords?.(content, metadata) || [],
      kecCodes: extractors?.kecCodes?.(content, metadata) || [],
      category: extractors?.category?.(content),
      tokenCount: Math.ceil(content.length * 0.7),
    };
  }

  /**
   * 카테고리 추론 (키워드 기반)
   */
  static inferCategory(content: string): AgentType | undefined {
    const lowerContent = content.toLowerCase();

    // 카테고리별 키워드
    const categoryKeywords: Record<AgentType, string[]> = {
      DESIGN: ['설계', '도면', '배선', '전선', '관로', '배관', '전선관'],
      SEQUENCE: ['시퀀스', '릴레이', 'plc', '타이머', '카운터', '접점', '회로도'],
      LOAD: ['부하', '전력', '수요', '역률', '변압기', '용량', '계산'],
      POWER: ['전력공학', '송전', '배전', '전압강하', '단락', '지락', '계통'],
      RENEWABLE: ['신재생', '태양광', '풍력', 'ess', '인버터', '모듈'],
      KEC: ['kec', '전기설비기술기준', '접지', '감전', '누전', '안전'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matchCount = keywords.filter((kw) => lowerContent.includes(kw)).length;
      if (matchCount >= 2) {
        return category as AgentType;
      }
    }

    return undefined;
  }
}

export const chunker = new Chunker();
