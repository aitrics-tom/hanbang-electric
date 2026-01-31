/**
 * RAG (Retrieval-Augmented Generation) Type Definitions
 */

import { AgentType } from './index';

// Document Types
export type DocumentType = 'dictionary' | 'regulation' | 'formula';

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  sourceFile: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentInsert {
  name: string;
  type: DocumentType;
  source_file: string;
  metadata?: Record<string, unknown>;
}

// Chunk Types
export interface ChunkMetadata {
  title?: string;
  section?: string;
  pageNumber?: number;
  source: string;
  headerPath?: string[];  // 계층적 헤더 경로
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  chunkIndex: number;
  metadata: ChunkMetadata;
  category?: AgentType;
  keywords: string[];
  kecCodes: string[];
  createdAt: string;
}

export interface DocumentChunkInsert {
  document_id: string;
  content: string;
  embedding?: number[];
  chunk_index: number;
  metadata: ChunkMetadata;
  category?: AgentType;
  keywords?: string[];
  kec_codes?: string[];
}

// Retrieval Types
export type MatchType = 'semantic' | 'keyword' | 'hybrid';

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  matchType: MatchType;
}

export interface RetrievalQuery {
  query: string;
  category?: AgentType;
  topK?: number;
  minScore?: number;
  includeKeyword?: boolean;
}

export interface RetrievalContext {
  results: RetrievalResult[];
  query: string;
  totalTokens: number;
  sources: string[];
}

// Chunking Options
export interface ChunkingOptions {
  chunkSize: number;       // 토큰 수
  chunkOverlap: number;    // 오버랩 토큰 수
  preserveMetadata: boolean;
  headerSplit?: string[];  // MD용 헤더 분리 패턴
  sectionPattern?: RegExp; // PDF용 섹션 패턴
}

// Embedding Types
export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  totalTokens: number;
}

// Ingestion Types
export interface IngestionOptions {
  documentType: DocumentType;
  category?: AgentType;
  chunkingOptions?: Partial<ChunkingOptions>;
  extractKeywords?: boolean;
  extractKecCodes?: boolean;
}

export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  totalTokens: number;
  errors: string[];
}

// RAG Context for Agent
export interface RAGContext {
  relevantChunks: {
    content: string;
    source: string;
    score: number;
    kecCodes?: string[];
  }[];
  formattedContext: string;
  sources: string[];
  totalTokens: number;
}

// Validation Types (for Guardrails)
export interface RAGValidationResult {
  isValid: boolean;
  termAccuracy: number;      // 용어 정확도 (0-1)
  kecCitationValid: boolean; // KEC 인용 검증
  sourcesVerified: string[]; // 검증된 출처
  warnings: string[];
  suggestions: string[];
}
