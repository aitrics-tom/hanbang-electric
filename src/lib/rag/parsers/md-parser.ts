/**
 * Markdown Parser - MD 문서 파싱 서비스
 */

import matter from 'gray-matter';
import { ChunkMetadata } from '@/types/rag';

export interface ParsedSection {
  title: string;
  level: number;
  content: string;
  headerPath: string[];
}

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  sections: ParsedSection[];
  rawContent: string;
}

export class MarkdownParser {
  /**
   * Markdown 파일 파싱
   */
  parse(content: string, sourcePath: string): ParsedMarkdown {
    // Frontmatter 추출
    const { data: frontmatter, content: body } = matter(content);

    // 섹션 분리
    const sections = this.extractSections(body);

    return {
      frontmatter,
      sections,
      rawContent: body,
    };
  }

  /**
   * 헤더 기준으로 섹션 분리
   */
  private extractSections(content: string): ParsedSection[] {
    const lines = content.split('\n');
    const sections: ParsedSection[] = [];
    const headerStack: { title: string; level: number }[] = [];

    let currentContent: string[] = [];
    let currentTitle = '';
    let currentLevel = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // 이전 섹션 저장
        if (currentContent.length > 0 || currentTitle) {
          sections.push({
            title: currentTitle,
            level: currentLevel,
            content: currentContent.join('\n').trim(),
            headerPath: headerStack.map((h) => h.title),
          });
        }

        // 새 헤더 처리
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();

        // 헤더 스택 업데이트
        while (headerStack.length > 0 && headerStack[headerStack.length - 1].level >= level) {
          headerStack.pop();
        }
        headerStack.push({ title, level });

        currentTitle = title;
        currentLevel = level;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // 마지막 섹션 저장
    if (currentContent.length > 0 || currentTitle) {
      sections.push({
        title: currentTitle,
        level: currentLevel,
        content: currentContent.join('\n').trim(),
        headerPath: headerStack.map((h) => h.title),
      });
    }

    return sections.filter((s) => s.content.length > 0);
  }

  /**
   * 섹션에서 KEC 코드 추출
   * KEC 형식: 111.1, 232.3.9, 142.3 등 (100-999로 시작하는 3자리.소수점 형식)
   */
  extractKecCodes(content: string): string[] {
    const codes = new Set<string>();

    // 패턴 1: "KEC 232.3.9" 또는 "KEC232.3.9" 형식
    const kecPrefixPattern = /KEC\s*(\d{3}(?:\.\d+)*)/gi;
    let match;
    while ((match = kecPrefixPattern.exec(content)) !== null) {
      if (match[1]) codes.add(match[1]);
    }

    // 패턴 2: 독립적인 KEC 코드 (3자리.숫자.숫자 형식)
    // 예: "232.3.9", "142.3", "110.1.1"
    const standalonePattern = /\b(\d{3}\.\d+(?:\.\d+)?)\b/g;
    while ((match = standalonePattern.exec(content)) !== null) {
      const code = match[1];
      const firstPart = parseInt(code.split('.')[0], 10);
      // 100-999 범위 (1xx, 2xx, 3xx... 8xx, 9xx)
      if (firstPart >= 100 && firstPart <= 999) {
        codes.add(code);
      }
    }

    return Array.from(codes);
  }

  /**
   * 섹션에서 키워드 추출 (간단한 방식)
   */
  extractKeywords(content: string, title: string): string[] {
    const keywords = new Set<string>();

    // 제목 단어 추가
    if (title) {
      title.split(/\s+/).forEach((word) => {
        if (word.length >= 2) keywords.add(word);
      });
    }

    // 강조된 텍스트 추출 (**bold**, *italic*)
    const emphasisPattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let match;
    while ((match = emphasisPattern.exec(content)) !== null) {
      const keyword = match[1] || match[2];
      if (keyword && keyword.length >= 2) {
        keywords.add(keyword.trim());
      }
    }

    // 코드 블록 내 용어 추출 (`term`)
    const codePattern = /`([^`]+)`/g;
    while ((match = codePattern.exec(content)) !== null) {
      if (match[1] && match[1].length >= 2) {
        keywords.add(match[1].trim());
      }
    }

    return Array.from(keywords).slice(0, 20); // 최대 20개
  }

  /**
   * 메타데이터 생성
   */
  createMetadata(
    section: ParsedSection,
    sourcePath: string,
    frontmatter: Record<string, unknown>
  ): ChunkMetadata {
    return {
      title: section.title || (frontmatter.title as string) || sourcePath,
      section: section.headerPath.join(' > '),
      source: sourcePath,
      headerPath: section.headerPath,
    };
  }
}

export const markdownParser = new MarkdownParser();
