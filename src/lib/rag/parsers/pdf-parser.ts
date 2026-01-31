/**
 * PDF Parser - PDF 문서 파싱 서비스
 */

import { ChunkMetadata } from '@/types/rag';

// Dynamic import to avoid build-time issues with pdf-parse (requires DOM APIs)
async function getPdfParser() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  // pdf-parse exports PDFParse as the main function
  return pdfParse.PDFParse || pdfParse.default || pdfParse;
}

export interface ParsedPage {
  pageNumber: number;
  content: string;
  sections: ParsedPdfSection[];
}

export interface ParsedPdfSection {
  title: string;
  content: string;
  pageNumber: number;
  articleNumber?: string; // 조항 번호
}

export interface ParsedPdf {
  metadata: {
    title?: string;
    author?: string;
    pages: number;
  };
  pages: ParsedPage[];
  sections: ParsedPdfSection[];
  rawText: string;
}

export class PdfParser {
  // KEC 조항 패턴 (제X조, X.X.X 형식)
  private readonly articlePattern = /^(제\s*\d+\s*조|제\s*\d+\s*장|\d+\.\d+(?:\.\d+)*)\s*[.:]?\s*(.*)$/gm;

  /**
   * PDF 파일 파싱
   */
  async parse(buffer: Buffer, sourcePath: string): Promise<ParsedPdf> {
    const pdf = await getPdfParser();
    const data = await pdf(buffer);

    // 페이지별 텍스트 추출
    const pages = this.extractPages(data.text, data.numpages);

    // 섹션 추출 (조항 기준)
    const sections = this.extractSections(data.text);

    return {
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        pages: data.numpages,
      },
      pages,
      sections,
      rawText: data.text,
    };
  }

  /**
   * 페이지별 텍스트 분리 (간단한 휴리스틱)
   */
  private extractPages(text: string, numPages: number): ParsedPage[] {
    const pages: ParsedPage[] = [];

    // 페이지 구분자가 없으면 전체를 하나로 처리
    // 실제 PDF는 pdf-parse가 페이지 정보를 제공하지 않으므로 근사치 사용
    const avgPageLength = Math.ceil(text.length / numPages);

    for (let i = 0; i < numPages; i++) {
      const start = i * avgPageLength;
      const end = Math.min((i + 1) * avgPageLength, text.length);
      const content = text.slice(start, end).trim();

      pages.push({
        pageNumber: i + 1,
        content,
        sections: this.extractSectionsFromText(content, i + 1),
      });
    }

    return pages;
  }

  /**
   * 텍스트에서 섹션(조항) 추출
   */
  private extractSections(text: string): ParsedPdfSection[] {
    const sections: ParsedPdfSection[] = [];
    const lines = text.split('\n');

    let currentSection: ParsedPdfSection | null = null;
    let currentContent: string[] = [];
    let estimatedPage = 1;
    let charCount = 0;
    const avgCharsPerPage = text.length / Math.max(1, Math.ceil(text.length / 3000));

    for (const line of lines) {
      charCount += line.length + 1;
      estimatedPage = Math.ceil(charCount / avgCharsPerPage);

      const match = line.match(/^(제\s*\d+\s*조|제\s*\d+\s*장|\d+\.\d+(?:\.\d+)*)\s*[.:]?\s*(.*)$/);

      if (match) {
        // 이전 섹션 저장
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // 새 섹션 시작
        currentSection = {
          title: match[2]?.trim() || match[1],
          articleNumber: match[1].replace(/\s+/g, ''),
          content: '',
          pageNumber: estimatedPage,
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // 마지막 섹션 저장
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections.filter((s) => s.content.length > 0);
  }

  /**
   * 페이지 텍스트에서 섹션 추출
   */
  private extractSectionsFromText(text: string, pageNumber: number): ParsedPdfSection[] {
    const sections: ParsedPdfSection[] = [];
    const lines = text.split('\n');

    let currentSection: ParsedPdfSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(제\s*\d+\s*조|제\s*\d+\s*장|\d+\.\d+(?:\.\d+)*)\s*[.:]?\s*(.*)$/);

      if (match) {
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
        }

        currentSection = {
          title: match[2]?.trim() || match[1],
          articleNumber: match[1].replace(/\s+/g, ''),
          content: '',
          pageNumber,
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      } else {
        // 섹션 없이 시작하는 텍스트
        if (line.trim() && sections.length === 0 && !currentSection) {
          currentSection = {
            title: '서문',
            content: '',
            pageNumber,
          };
          currentContent = [line];
        }
      }
    }

    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
    }

    return sections;
  }

  /**
   * KEC 코드 추출
   */
  extractKecCodes(content: string): string[] {
    const kecPattern = /제?\s*(\d+)\s*조|(\d{3}(?:\.\d+)+)|KEC\s*(\d+(?:\.\d+)*)/g;
    const codes = new Set<string>();

    let match;
    while ((match = kecPattern.exec(content)) !== null) {
      const code = match[1] || match[2] || match[3];
      if (code) {
        codes.add(code);
      }
    }

    return Array.from(codes);
  }

  /**
   * 키워드 추출
   */
  extractKeywords(content: string, title: string): string[] {
    const keywords = new Set<string>();

    // 제목에서 키워드 추출
    if (title) {
      title.split(/\s+/).forEach((word) => {
        if (word.length >= 2 && !word.match(/^\d+$/)) {
          keywords.add(word);
        }
      });
    }

    // 기술 용어 패턴 (괄호 안의 영문/숫자)
    const techTermPattern = /\(([A-Za-z0-9\s]+)\)/g;
    let match;
    while ((match = techTermPattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        keywords.add(match[1].trim());
      }
    }

    return Array.from(keywords).slice(0, 20);
  }

  /**
   * 메타데이터 생성
   */
  createMetadata(
    section: ParsedPdfSection,
    sourcePath: string,
    pdfMetadata: ParsedPdf['metadata']
  ): ChunkMetadata {
    return {
      title: section.title,
      section: section.articleNumber || section.title,
      pageNumber: section.pageNumber,
      source: sourcePath,
    };
  }
}

export const pdfParser = new PdfParser();
