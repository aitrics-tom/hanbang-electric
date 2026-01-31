/**
 * Vector Store Service - Supabase pgvector 저장소
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Document,
  DocumentInsert,
  DocumentChunk,
  DocumentChunkInsert,
  RetrievalResult,
} from '@/types/rag';
import { AgentType } from '@/types';
import { logger } from '@/lib/api/logger';

// 클라이언트 타입 (Database 타입 없이)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// 전역 클라이언트 (스크립트용)
let globalClient: AnySupabaseClient | null = null;

/**
 * 스크립트용 글로벌 클라이언트 설정
 */
export function setGlobalClient(client: AnySupabaseClient) {
  globalClient = client;
}

/**
 * 클라이언트 가져오기 (글로벌 또는 요청 컨텍스트)
 */
async function getClient(): Promise<AnySupabaseClient> {
  // 스크립트 모드: 글로벌 클라이언트 사용
  if (globalClient) {
    return globalClient;
  }

  // Next.js 요청 컨텍스트: 동적으로 import
  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  return await createServiceRoleClient();
}

export class VectorStoreService {
  /**
   * 문서 생성
   */
  async createDocument(doc: DocumentInsert): Promise<Document | null> {
    const supabase = await getClient();

    const { data, error } = await supabase
      .from('documents')
      .insert(doc)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create document', error);
      return null;
    }

    return data;
  }

  /**
   * 문서 조회
   */
  async getDocument(id: string): Promise<Document | null> {
    const supabase = await getClient();

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Failed to get document', error);
      return null;
    }

    return data;
  }

  /**
   * 모든 문서 조회
   */
  async getAllDocuments(): Promise<Document[]> {
    const supabase = await getClient();

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get documents', error);
      return [];
    }

    return data || [];
  }

  /**
   * 문서 삭제 (청크도 cascade 삭제)
   */
  async deleteDocument(id: string): Promise<boolean> {
    const supabase = await getClient();

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete document', error);
      return false;
    }

    return true;
  }

  /**
   * 청크 배치 삽입
   */
  async insertChunks(chunks: DocumentChunkInsert[]): Promise<number> {
    if (chunks.length === 0) return 0;

    const supabase = await getClient();

    // 배치 크기 제한 (Supabase 제한)
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const { error } = await supabase
        .from('document_chunks')
        .insert(batch);

      if (error) {
        logger.error('Failed to insert chunks batch', error);
      } else {
        inserted += batch.length;
      }
    }

    return inserted;
  }

  /**
   * 벡터 유사도 검색 (Lenient - 더 많은 결과 반환)
   */
  async searchByVector(
    embedding: number[],
    options: {
      topK?: number;
      minScore?: number;
      category?: AgentType;
    } = {}
  ): Promise<RetrievalResult[]> {
    // 임계값 낮춤: 0.7 → 0.3 (더 관대한 검색)
    const { topK = 20, minScore = 0.3, category } = options;
    const supabase = await getClient();

    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_threshold: minScore,
      match_count: topK,
      filter_category: category || null,
    });

    if (error) {
      logger.error('Vector search failed', error);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      chunk: {
        id: row.id,
        documentId: row.document_id,
        content: row.content,
        metadata: row.metadata,
        category: row.category,
        keywords: row.keywords || [],
        kecCodes: row.kec_codes || [],
        chunkIndex: 0,
        createdAt: '',
      },
      score: row.similarity,
      matchType: 'semantic' as const,
    }));
  }

  /**
   * 하이브리드 검색 (벡터 + 키워드)
   */
  async hybridSearch(
    embedding: number[],
    queryText: string,
    options: {
      topK?: number;
      category?: AgentType;
      semanticWeight?: number;
    } = {}
  ): Promise<RetrievalResult[]> {
    const { topK = 10, category, semanticWeight = 0.7 } = options;
    const supabase = await getClient();

    const { data, error } = await supabase.rpc('hybrid_search_chunks', {
      query_embedding: embedding,
      query_text: queryText,
      match_count: topK,
      filter_category: category || null,
      semantic_weight: semanticWeight,
    });

    if (error) {
      logger.error('Hybrid search failed', error);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      chunk: {
        id: row.id,
        documentId: row.document_id,
        content: row.content,
        metadata: row.metadata,
        category: row.category,
        keywords: row.keywords || [],
        kecCodes: row.kec_codes || [],
        chunkIndex: 0,
        createdAt: '',
      },
      score: row.combined_score,
      matchType: 'hybrid' as const,
    }));
  }

  /**
   * KEC 코드로 검색 (정확 매칭)
   */
  async searchByKecCode(kecCode: string): Promise<DocumentChunk[]> {
    const supabase = await getClient();

    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .contains('kec_codes', [kecCode])
      .limit(10);

    if (error) {
      logger.error('KEC code search failed', error);
      return [];
    }

    return data || [];
  }

  /**
   * KEC 코드로 Fuzzy 검색 (부분 매칭 + 유사 코드)
   * 예: "232.8" → "232.81", "232.82", "232.83" 등도 반환
   */
  async fuzzySearchByKecCode(kecCode: string): Promise<{
    chunk: DocumentChunk;
    matchScore: number;
    matchedCode: string;
  }[]> {
    const supabase = await getClient();
    const results: { chunk: DocumentChunk; matchScore: number; matchedCode: string }[] = [];

    // 코드 정규화: "KEC 232.8" → "232.8", "KEC_232.8" → "232.8"
    const normalizedCode = kecCode
      .replace(/^KEC[\s_]*/i, '')
      .replace(/_/g, '.')
      .trim();

    // 1. 정확한 매칭 시도
    const exactMatches = await this.searchByKecCode(kecCode);
    if (exactMatches.length > 0) {
      return exactMatches.map(chunk => ({
        chunk,
        matchScore: 1.0,
        matchedCode: kecCode,
      }));
    }

    // 2. 정규화된 코드로 정확 매칭 시도
    const normalizedMatches = await this.searchByKecCode(normalizedCode);
    if (normalizedMatches.length > 0) {
      return normalizedMatches.map(chunk => ({
        chunk,
        matchScore: 0.95,
        matchedCode: normalizedCode,
      }));
    }

    // 3. 부분 매칭 (prefix 검색): "232.8" → "232.81", "232.82" 등
    const { data: prefixData, error: prefixError } = await supabase
      .from('document_chunks')
      .select('*')
      .not('kec_codes', 'is', null)
      .limit(100);

    if (!prefixError && prefixData) {
      for (const row of prefixData) {
        const kecCodes = row.kec_codes as string[] || [];
        for (const code of kecCodes) {
          // prefix 매칭: "232.8" → "232.81", "232.82"
          if (code.startsWith(normalizedCode) || normalizedCode.startsWith(code)) {
            const similarity = this.calculateCodeSimilarity(normalizedCode, code);
            if (similarity >= 0.5) {
              results.push({
                chunk: this.rowToChunk(row),
                matchScore: similarity,
                matchedCode: code,
              });
            }
          }
          // 같은 섹션 매칭: "232.8" → "232.1", "232.2" (같은 232.x)
          const normalizedBase = normalizedCode.split('.').slice(0, -1).join('.');
          const codeBase = code.split('.').slice(0, -1).join('.');
          if (normalizedBase && codeBase && normalizedBase === codeBase) {
            results.push({
              chunk: this.rowToChunk(row),
              matchScore: 0.6,
              matchedCode: code,
            });
          }
        }
      }
    }

    // 4. 내용에서 KEC 코드 언급 검색
    const searchTerms = [normalizedCode, `KEC ${normalizedCode}`, `KEC${normalizedCode}`];
    for (const term of searchTerms) {
      const { data: contentData, error: contentError } = await supabase
        .from('document_chunks')
        .select('*')
        .ilike('content', `%${term}%`)
        .limit(10);

      if (!contentError && contentData) {
        for (const row of contentData) {
          // 중복 체크
          if (!results.find(r => r.chunk.id === row.id)) {
            results.push({
              chunk: this.rowToChunk(row),
              matchScore: 0.7,
              matchedCode: term,
            });
          }
        }
      }
    }

    // 점수순 정렬 및 중복 제거
    const uniqueResults = new Map<string, typeof results[0]>();
    for (const result of results) {
      const existing = uniqueResults.get(result.chunk.id);
      if (!existing || existing.matchScore < result.matchScore) {
        uniqueResults.set(result.chunk.id, result);
      }
    }

    return Array.from(uniqueResults.values())
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 15);
  }

  /**
   * KEC 코드 유사도 계산
   */
  private calculateCodeSimilarity(code1: string, code2: string): number {
    // 완전 일치
    if (code1 === code2) return 1.0;

    // prefix 일치 정도 계산
    const parts1 = code1.split('.');
    const parts2 = code2.split('.');

    let matchingParts = 0;
    const maxParts = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        matchingParts++;
      } else {
        break;
      }
    }

    return matchingParts / maxParts;
  }

  /**
   * DB row를 DocumentChunk로 변환
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToChunk(row: any): DocumentChunk {
    return {
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      metadata: row.metadata,
      category: row.category,
      keywords: row.keywords || [],
      kecCodes: row.kec_codes || [],
      chunkIndex: row.chunk_index || 0,
      createdAt: row.created_at || '',
    };
  }

  /**
   * 문서의 청크 수 조회
   */
  async getChunkCount(documentId: string): Promise<number> {
    const supabase = await getClient();

    const { count, error } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId);

    if (error) {
      logger.error('Failed to get chunk count', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * 전체 청크 수 조회
   */
  async getTotalChunkCount(): Promise<number> {
    const supabase = await getClient();

    const { count, error } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.error('Failed to get total chunk count', error);
      return 0;
    }

    return count || 0;
  }
}

export const vectorStoreService = new VectorStoreService();
