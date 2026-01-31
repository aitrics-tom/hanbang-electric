/**
 * RAG System - Main Export
 */

// Services
export { embeddingService, EmbeddingService } from './embedding/embedding.service';
export { vectorStoreService, VectorStoreService, setGlobalClient } from './store/vector-store.service';
export { retrievalService, RetrievalService } from './retrieval/retrieval.service';
export { ragContextService, RAGContextService } from './context/rag-context.service';
export { ingestService, IngestService } from './ingest/ingest.service';

// Parsers
export { markdownParser, MarkdownParser } from './parsers/md-parser';
export { pdfParser, PdfParser } from './parsers/pdf-parser';

// Chunking
export { Chunker } from './chunking/chunker';

// Validator
export { ragValidator, RAGValidator } from './validator/rag-validator';
export type { ValidationResult } from './validator/rag-validator';

// Types (re-export from types/rag)
export type {
  Document,
  DocumentInsert,
  DocumentChunk,
  DocumentChunkInsert,
  ChunkMetadata,
  ChunkingOptions,
  EmbeddingRequest,
  EmbeddingResult,
  RetrievalQuery,
  RetrievalResult,
  RetrievalContext,
  RAGContext,
  DocumentType,
  IngestionOptions,
  IngestionResult,
} from '@/types/rag';
