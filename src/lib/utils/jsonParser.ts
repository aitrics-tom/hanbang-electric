/**
 * Unified JSON Parser Utility
 *
 * 모든 AI 응답의 JSON 파싱을 일관되게 처리하는 유틸리티
 *
 * 주요 기능:
 * 1. "json" 레이블 제거
 * 2. 코드 블록(```json```) 추출
 * 3. 균형 잡힌 중괄호 매칭 (greedy regex 대신)
 * 4. 타입 안전한 파싱
 * 5. 재귀 깊이 제한
 */

import { logger } from '@/lib/api/logger';

const MAX_RECURSION_DEPTH = 5;

/**
 * JSON 파싱 결과
 */
export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  rawText?: string;
}

/**
 * AI 응답에서 JSON을 안전하게 추출하고 파싱
 *
 * @param responseText - AI 응답 텍스트
 * @returns 파싱된 JSON 객체 또는 null
 */
export function parseAIResponse<T = Record<string, unknown>>(
  responseText: string
): ParseResult<T> {
  if (!responseText || typeof responseText !== 'string') {
    return { success: false, data: null, error: 'Invalid input' };
  }

  try {
    // Step 1: "json" 레이블 제거
    let text = removeJsonLabel(responseText);

    // Step 2: 코드 블록 추출 시도
    const codeBlockContent = extractCodeBlock(text);
    if (codeBlockContent) {
      text = codeBlockContent;
    }

    // Step 3: 균형 잡힌 중괄호로 JSON 추출
    const jsonString = extractBalancedJSON(text);
    if (!jsonString) {
      return {
        success: false,
        data: null,
        error: 'No valid JSON found',
        rawText: text
      };
    }

    // Step 4: JSON 파싱
    const parsed = JSON.parse(jsonString) as T;
    return { success: true, data: parsed };

  } catch (error) {
    logger.error('JSON parsing failed', error as Error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      rawText: responseText
    };
  }
}

/**
 * "json" 레이블 제거
 * Gemini가 가끔 "json\n{...}" 형태로 반환함
 */
export function removeJsonLabel(text: string): string {
  let result = text.trim();

  // "json" 또는 "JSON"으로 시작하면 제거
  if (result.toLowerCase().startsWith('json')) {
    result = result.substring(4).trim();
  }

  return result;
}

/**
 * 마크다운 코드 블록에서 내용 추출
 * ```json ... ``` 또는 ``` ... ``` 형태
 */
export function extractCodeBlock(text: string): string | null {
  // ```json ... ``` 또는 ``` ... ``` 패턴
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);

  if (codeBlockMatch && codeBlockMatch[1]) {
    const content = codeBlockMatch[1].trim();
    // 내용이 JSON 객체인지 확인
    if (content.startsWith('{') || content.startsWith('[')) {
      return content;
    }
  }

  return null;
}

/**
 * 균형 잡힌 중괄호 매칭으로 JSON 추출
 *
 * Greedy regex `/\{[\s\S]*\}/` 대신 사용
 * - 첫 번째 `{`를 찾고
 * - depth 카운터로 매칭되는 `}`를 찾음
 * - 문자열 내부의 중괄호는 무시
 */
export function extractBalancedJSON(text: string): string | null {
  const startIdx = text.indexOf('{');
  if (startIdx === -1) {
    // 배열인 경우
    const arrayStartIdx = text.indexOf('[');
    if (arrayStartIdx === -1) return null;
    return extractBalancedArray(text, arrayStartIdx);
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let endIdx = -1;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];

    // 이스케이프 문자 처리
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    // 문자열 내부 감지 (큰따옴표)
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // 문자열 내부가 아닐 때만 중괄호 카운트
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx !== -1) {
    return text.substring(startIdx, endIdx + 1);
  }

  return null;
}

/**
 * 균형 잡힌 대괄호 매칭으로 배열 추출
 */
function extractBalancedArray(text: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let endIdx = -1;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx !== -1) {
    return text.substring(startIdx, endIdx + 1);
  }

  return null;
}

/**
 * 텍스트에서 JSON 아티팩트 제거
 * 추출된 텍스트 필드에서 남은 JSON 구조 정리
 *
 * @param text - 정리할 텍스트
 * @param depth - 재귀 깊이 (무한 루프 방지)
 */
export function cleanTextFromJSON(text: string, depth: number = 0): string {
  if (!text || typeof text !== 'string') return '';
  if (depth > MAX_RECURSION_DEPTH) return text;

  let result = text.trim();

  // 1. "json" 레이블 제거
  result = removeJsonLabel(result);

  // 2. 중첩된 JSON 객체인지 확인하고 extractedText 추출
  if (result.startsWith('{')) {
    try {
      const parsed = JSON.parse(result);
      if (parsed && typeof parsed === 'object') {
        // extractedText 필드가 있으면 재귀적으로 정리
        if (typeof parsed.extractedText === 'string') {
          return cleanTextFromJSON(parsed.extractedText, depth + 1);
        }
        // question 필드가 있으면 사용
        if (typeof parsed.question === 'string') {
          return cleanTextFromJSON(parsed.question, depth + 1);
        }
        // text 필드가 있으면 사용
        if (typeof parsed.text === 'string') {
          return cleanTextFromJSON(parsed.text, depth + 1);
        }
      }
    } catch {
      // JSON 파싱 실패 시 계속 진행
    }
  }

  // 3. 불완전한 JSON에서 extractedText 추출 시도
  const extractedMatch = result.match(/"extractedText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (extractedMatch && extractedMatch[1]) {
    const extracted = extractedMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    return cleanTextFromJSON(extracted, depth + 1);
  }

  // 4. 코드 블록 제거
  result = result.replace(/```[\s\S]*?```/g, '');

  // 5. JSON 키-값 패턴 제거
  result = result.replace(/"[a-zA-Z_]+"\s*:\s*"[^"]*"/g, '');
  result = result.replace(/"[a-zA-Z_]+"\s*:\s*\[[^\]]*\]/g, '');
  result = result.replace(/"[a-zA-Z_]+"\s*:\s*\{[^}]*\}/g, '');
  result = result.replace(/"[a-zA-Z_]+"\s*:\s*\d+/g, '');
  result = result.replace(/"[a-zA-Z_]+"\s*:\s*(true|false|null)/g, '');

  // 6. 빈 괄호 제거
  result = result.replace(/\{\s*\}/g, '');
  result = result.replace(/\[\s*\]/g, '');

  // 7. 연속 개행 정리
  result = result.replace(/\n{3,}/g, '\n\n');

  // 8. 공백 정리
  result = result.replace(/\s{2,}/g, ' ');

  return result.trim();
}

/**
 * 배열 타입 검증
 */
export function isValidArray<T>(
  value: unknown,
  itemValidator?: (item: unknown) => item is T
): value is T[] {
  if (!Array.isArray(value)) return false;
  if (!itemValidator) return true;
  return value.every(itemValidator);
}

/**
 * 안전한 배열 추출
 * 타입 검증 실패 시 빈 배열 반환
 */
export function safeArray<T>(
  value: unknown,
  defaultValue: T[] = []
): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return defaultValue;
}

/**
 * 안전한 문자열 추출
 */
export function safeString(value: unknown, defaultValue: string = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value !== null && value !== undefined) {
    return String(value);
  }
  return defaultValue;
}

/**
 * 안전한 숫자 추출
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}

/**
 * 안전한 불린 추출
 */
export function safeBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}
