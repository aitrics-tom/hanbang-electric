/**
 * Ingest Service - 문서 수집 파이프라인
 */

import fs from 'fs/promises';
import path from 'path';
import { markdownParser } from '../parsers/md-parser';
import { pdfParser } from '../parsers/pdf-parser';
import { Chunker } from '../chunking/chunker';
import { embeddingService } from '../embedding/embedding.service';
import { vectorStoreService } from '../store/vector-store.service';
import {
  DocumentType,
  IngestionOptions,
  IngestionResult,
  DocumentChunkInsert,
  ChunkMetadata,
} from '@/types/rag';
import { AgentType } from '@/types';
import { logger } from '@/lib/api/logger';

const DOC_BASE_PATH = path.join(process.cwd(), 'doc');

export class IngestService {
  private chunker: Chunker;

  constructor() {
    this.chunker = new Chunker({
      chunkSize: 512,
      chunkOverlap: 64,
      preserveMetadata: true,
    });
  }

  /**
   * 단일 파일 수집
   */
  async ingestFile(
    filePath: string,
    options: IngestionOptions
  ): Promise<IngestionResult> {
    const errors: string[] = [];
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(DOC_BASE_PATH, filePath);

    try {
      // 파일 존재 확인
      await fs.access(absolutePath);

      const ext = path.extname(absolutePath).toLowerCase();
      const fileName = path.basename(absolutePath);

      logger.info(`Ingesting file: ${fileName}`);

      // 문서 생성
      const doc = await vectorStoreService.createDocument({
        name: fileName,
        type: options.documentType,
        source_file: filePath,
        metadata: { category: options.category },
      });

      if (!doc) {
        throw new Error('Failed to create document record');
      }

      // 파일 타입별 처리
      let chunks: DocumentChunkInsert[];

      if (ext === '.md') {
        chunks = await this.processMdFile(absolutePath, doc.id, options);
      } else if (ext === '.pdf') {
        chunks = await this.processPdfFile(absolutePath, doc.id, options);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      // 청크 저장
      const insertedCount = await vectorStoreService.insertChunks(chunks);

      logger.info(`Ingested ${insertedCount} chunks from ${fileName}`);

      return {
        documentId: doc.id,
        chunksCreated: insertedCount,
        totalTokens: chunks.reduce((sum, c) => sum + Math.ceil(c.content.length * 0.7), 0),
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      logger.error(`Ingestion failed for ${filePath}`, error as Error);

      return {
        documentId: '',
        chunksCreated: 0,
        totalTokens: 0,
        errors,
      };
    }
  }

  /**
   * MD 파일 처리
   */
  private async processMdFile(
    filePath: string,
    documentId: string,
    options: IngestionOptions
  ): Promise<DocumentChunkInsert[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    const parsed = markdownParser.parse(content, fileName);

    // 섹션 기반 청킹
    const sections = parsed.sections.map((section) => ({
      content: section.content,
      metadata: markdownParser.createMetadata(section, fileName, parsed.frontmatter),
      // KEC 코드 추출을 위해 원본 섹션 정보도 보존
      _originalSection: section,
    }));

    const chunkResults = this.chunker.chunkSections(
      sections.map((s) => ({ content: s.content, metadata: s.metadata })),
      {
        keywords: (c) => markdownParser.extractKeywords(c, ''),
        kecCodes: (c, metadata) => {
          // content에서 KEC 코드 추출
          const contentCodes = markdownParser.extractKecCodes(c);
          // title에서도 KEC 코드 추출 (헤더에 있는 KEC 코드 포함)
          const titleCodes = metadata?.title
            ? markdownParser.extractKecCodes(metadata.title)
            : [];
          // headerPath에서도 KEC 코드 추출
          const headerPathCodes = metadata?.headerPath
            ? metadata.headerPath.flatMap((h) => markdownParser.extractKecCodes(h))
            : [];
          // 중복 제거하여 반환
          return [...new Set([...contentCodes, ...titleCodes, ...headerPathCodes])];
        },
        category: (c) => options.category || Chunker.inferCategory(c),
      }
    );

    // 임베딩 생성
    const texts = chunkResults.map((c) => c.content);
    const embeddingResult = await embeddingService.embedBatch(texts);

    // DocumentChunkInsert 형태로 변환
    return chunkResults.map((chunk, i) => ({
      document_id: documentId,
      content: chunk.content,
      embedding: embeddingResult.embeddings[i],
      chunk_index: i,
      metadata: chunk.metadata,
      category: chunk.category,
      keywords: chunk.keywords,
      kec_codes: chunk.kecCodes,
    }));
  }

  /**
   * PDF 파일 처리
   */
  private async processPdfFile(
    filePath: string,
    documentId: string,
    options: IngestionOptions
  ): Promise<DocumentChunkInsert[]> {
    const buffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    const parsed = await pdfParser.parse(buffer, fileName);

    // 섹션 기반 청킹
    const sections = parsed.sections.map((section) => ({
      content: section.content,
      metadata: pdfParser.createMetadata(section, fileName, parsed.metadata),
    }));

    // PDF 청커 (더 큰 청크 사이즈)
    const pdfChunker = new Chunker({
      chunkSize: 1024,
      chunkOverlap: 128,
      preserveMetadata: true,
    });

    const chunkResults = pdfChunker.chunkSections(sections, {
      keywords: (c) => pdfParser.extractKeywords(c, ''),
      kecCodes: (c) => pdfParser.extractKecCodes(c),
      category: (c) => options.category || Chunker.inferCategory(c),
    });

    // 임베딩 생성
    const texts = chunkResults.map((c) => c.content);
    const embeddingResult = await embeddingService.embedBatch(texts);

    return chunkResults.map((chunk, i) => ({
      document_id: documentId,
      content: chunk.content,
      embedding: embeddingResult.embeddings[i],
      chunk_index: i,
      metadata: chunk.metadata,
      category: chunk.category,
      keywords: chunk.keywords,
      kec_codes: chunk.kecCodes,
    }));
  }

  /**
   * 디렉토리 전체 수집
   */
  async ingestDirectory(
    dirPath: string,
    options: Partial<IngestionOptions> = {}
  ): Promise<IngestionResult[]> {
    const absolutePath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(DOC_BASE_PATH, dirPath);

    const results: IngestionResult[] = [];

    try {
      const files = await fs.readdir(absolutePath);

      for (const file of files) {
        const filePath = path.join(absolutePath, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          // 재귀적으로 하위 디렉토리 처리
          const subResults = await this.ingestDirectory(filePath, options);
          results.push(...subResults);
        } else {
          const ext = path.extname(file).toLowerCase();

          if (ext === '.md' || ext === '.pdf') {
            // 파일 타입에 따른 문서 타입 추론
            const documentType = this.inferDocumentType(file, dirPath);

            const result = await this.ingestFile(filePath, {
              documentType,
              ...options,
            } as IngestionOptions);

            results.push(result);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to ingest directory: ${dirPath}`, error as Error);
    }

    return results;
  }

  /**
   * 전체 doc 폴더 수집
   */
  async ingestAll(): Promise<{
    total: number;
    success: number;
    failed: number;
    results: IngestionResult[];
  }> {
    logger.info('Starting full document ingestion...');

    const results = await this.ingestDirectory(DOC_BASE_PATH);

    const success = results.filter((r) => r.errors.length === 0).length;
    const failed = results.filter((r) => r.errors.length > 0).length;

    logger.info(`Ingestion complete: ${success} success, ${failed} failed`);

    return {
      total: results.length,
      success,
      failed,
      results,
    };
  }

  /**
   * 문서 타입 추론
   */
  private inferDocumentType(fileName: string, dirPath: string): DocumentType {
    const lowerName = fileName.toLowerCase();
    const lowerDir = dirPath.toLowerCase();

    if (lowerDir.includes('dictionary') || lowerName.includes('용어')) {
      return 'dictionary';
    }
    if (lowerDir.includes('regulation') || lowerName.includes('기준') || lowerName.includes('kec')) {
      return 'regulation';
    }
    if (lowerName.includes('공식') || lowerName.includes('formula')) {
      return 'formula';
    }

    return 'dictionary'; // 기본값
  }

  /**
   * 특정 문서 재수집
   */
  async reingestDocument(documentId: string): Promise<IngestionResult> {
    // 기존 문서 정보 조회
    const doc = await vectorStoreService.getDocument(documentId);

    if (!doc) {
      return {
        documentId,
        chunksCreated: 0,
        totalTokens: 0,
        errors: ['Document not found'],
      };
    }

    // 기존 문서 삭제 (청크도 cascade 삭제)
    await vectorStoreService.deleteDocument(documentId);

    // 재수집
    return this.ingestFile(doc.sourceFile, {
      documentType: doc.type as DocumentType,
      category: doc.metadata?.category as AgentType | undefined,
    });
  }
}

export const ingestService = new IngestService();
