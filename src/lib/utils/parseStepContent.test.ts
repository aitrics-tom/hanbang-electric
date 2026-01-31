/**
 * parseStepContent Tests
 * TDD: Unit tests for step content parsing utility
 */
import { describe, it, expect } from 'vitest';
import { parseStepContent, formatJsonForDisplay } from './parseStepContent';

describe('parseStepContent', () => {
  describe('Plain text handling', () => {
    it('should return plain text content unchanged', () => {
      const content = '변압기 용량을 계산합니다.';
      const result = parseStepContent(content);

      expect(result.text).toBe(content);
      expect(result.latex).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it('should handle multi-line text', () => {
      const content = '첫 번째 줄\n두 번째 줄\n세 번째 줄';
      const result = parseStepContent(content);

      expect(result.text).toBe(content);
    });

    it('should handle text with LaTeX-like content (not JSON)', () => {
      const content = '공식: $P = VI\\cos\\theta$를 적용합니다.';
      const result = parseStepContent(content);

      expect(result.text).toBe(content);
    });
  });

  describe('Empty and invalid input handling', () => {
    it('should handle empty string', () => {
      const result = parseStepContent('');

      expect(result.text).toBe('');
    });

    it('should handle null input', () => {
      const result = parseStepContent(null as unknown as string);

      expect(result.text).toBe('');
    });

    it('should handle undefined input', () => {
      const result = parseStepContent(undefined as unknown as string);

      expect(result.text).toBe('');
    });

    it('should handle numeric input', () => {
      const result = parseStepContent(42 as unknown as string);

      expect(result.text).toBe('42');
    });

    it('should handle whitespace-only input', () => {
      const result = parseStepContent('   ');

      expect(result.text).toBe('   ');
    });
  });

  describe('JSON object parsing', () => {
    it('should extract content field from JSON object', () => {
      const json = JSON.stringify({ content: '계산 내용입니다.' });
      const result = parseStepContent(json);

      expect(result.text).toBe('계산 내용입니다.');
      expect(result.metadata).toBeDefined();
    });

    it('should extract text field from JSON object', () => {
      const json = JSON.stringify({ text: '텍스트 필드 내용' });
      const result = parseStepContent(json);

      expect(result.text).toBe('텍스트 필드 내용');
    });

    it('should extract description field from JSON object', () => {
      const json = JSON.stringify({ description: '설명 내용' });
      const result = parseStepContent(json);

      expect(result.text).toBe('설명 내용');
    });

    it('should extract explanation field from JSON object', () => {
      const json = JSON.stringify({ explanation: '해설 내용' });
      const result = parseStepContent(json);

      expect(result.text).toBe('해설 내용');
    });

    it('should extract detail field from JSON object', () => {
      const json = JSON.stringify({ detail: '상세 내용' });
      const result = parseStepContent(json);

      expect(result.text).toBe('상세 내용');
    });

    it('should extract body field from JSON object', () => {
      const json = JSON.stringify({ body: '본문 내용' });
      const result = parseStepContent(json);

      expect(result.text).toBe('본문 내용');
    });

    it('should prioritize content field over other fields', () => {
      const json = JSON.stringify({
        content: '우선 내용',
        text: '텍스트 내용',
        description: '설명 내용',
      });
      const result = parseStepContent(json);

      expect(result.text).toBe('우선 내용');
    });

    it('should extract latex field from JSON object', () => {
      const json = JSON.stringify({
        content: '공식 적용',
        latex: 'P = VI',
      });
      const result = parseStepContent(json);

      expect(result.text).toBe('공식 적용');
      expect(result.latex).toBe('P = VI');
    });

    it('should extract formula field as latex', () => {
      const json = JSON.stringify({
        content: '공식 적용',
        formula: 'E = mc^2',
      });
      const result = parseStepContent(json);

      expect(result.latex).toBe('E = mc^2');
    });
  });

  describe('JSON array parsing', () => {
    it('should handle array of strings', () => {
      const json = JSON.stringify(['첫 번째', '두 번째', '세 번째']);
      const result = parseStepContent(json);

      expect(result.text).toBe('첫 번째\n두 번째\n세 번째');
    });

    it('should extract content from array of objects', () => {
      const json = JSON.stringify([
        { content: '단계 1 내용' },
        { content: '단계 2 내용' },
      ]);
      const result = parseStepContent(json);

      expect(result.text).toBe('단계 1 내용\n단계 2 내용');
    });

    it('should extract text from array of objects', () => {
      const json = JSON.stringify([
        { text: '항목 1' },
        { text: '항목 2' },
      ]);
      const result = parseStepContent(json);

      expect(result.text).toBe('항목 1\n항목 2');
    });

    it('should extract description from array of objects', () => {
      const json = JSON.stringify([
        { description: '설명 1' },
        { description: '설명 2' },
      ]);
      const result = parseStepContent(json);

      expect(result.text).toBe('설명 1\n설명 2');
    });

    it('should handle mixed array items', () => {
      const json = JSON.stringify([
        '문자열 항목',
        { content: '객체 내용' },
        { text: '텍스트 항목' },
      ]);
      const result = parseStepContent(json);

      expect(result.text).toBe('문자열 항목\n객체 내용\n텍스트 항목');
    });

    it('should stringify objects without known fields', () => {
      const json = JSON.stringify([
        { unknown: 'value1' },
        { another: 'value2' },
      ]);
      const result = parseStepContent(json);

      expect(result.text).toContain('unknown');
      expect(result.text).toContain('value1');
    });
  });

  describe('Nested structure parsing', () => {
    it('should handle object with title and steps', () => {
      const json = JSON.stringify({
        title: '풀이 제목',
        steps: [
          { title: '단계 1', content: '내용 1' },
          { title: '단계 2', content: '내용 2' },
        ],
      });
      const result = parseStepContent(json);

      expect(result.text).toContain('풀이 제목');
      expect(result.text).toContain('1. 단계 1: 내용 1');
      expect(result.text).toContain('2. 단계 2: 내용 2');
      expect(result.metadata).toBeDefined();
    });

    it('should handle object with only title', () => {
      const json = JSON.stringify({ title: '제목만 있음' });
      const result = parseStepContent(json);

      expect(result.text).toContain('제목만 있음');
    });

    it('should handle object with only steps', () => {
      const json = JSON.stringify({
        steps: [{ title: 'Step 1', content: 'Content' }],
      });
      const result = parseStepContent(json);

      expect(result.text).toContain('1. Step 1: Content');
    });
  });

  describe('Invalid JSON handling', () => {
    it('should return text as-is for invalid JSON', () => {
      const content = '{invalid json';
      const result = parseStepContent(content);

      expect(result.text).toBe(content);
    });

    it('should handle text that looks like JSON but is not', () => {
      const content = '{ 이것은 JSON이 아닙니다 }';
      const result = parseStepContent(content);

      expect(result.text).toBe(content);
    });

    it('should handle text starting with [ but invalid JSON', () => {
      const content = '[배열처럼 보이지만 JSON 아님]';
      const result = parseStepContent(content);

      expect(result.text).toBe(content);
    });
  });

  describe('Edge cases', () => {
    it('should handle JSON with empty content field', () => {
      const json = JSON.stringify({ content: '' });
      const result = parseStepContent(json);

      // Empty string is falsy, so falls through to formatJsonForDisplay
      expect(result.text).toBeDefined();
    });

    it('should handle deeply nested JSON', () => {
      const json = JSON.stringify({
        content: '상위 내용',
        nested: {
          content: '하위 내용',
        },
      });
      const result = parseStepContent(json);

      expect(result.text).toBe('상위 내용');
    });

    it('should skip metadata keys in formatJsonForDisplay', () => {
      const json = JSON.stringify({
        id: '12345',
        order: 1,
        type: 'step',
        timestamp: '2024-01-01',
        name: '표시할 이름',
      });
      const result = parseStepContent(json);

      expect(result.text).not.toContain('12345');
      expect(result.text).not.toContain('timestamp');
      expect(result.text).toContain('표시할 이름');
    });

    it('should handle whitespace around JSON', () => {
      const json = '  { "content": "내용" }  ';
      const result = parseStepContent(json);

      expect(result.text).toBe('내용');
    });
  });
});

describe('formatJsonForDisplay', () => {
  it('should format string values', () => {
    const obj = { name: '테스트' };
    const result = formatJsonForDisplay(obj);

    expect(result).toBe('Name: 테스트');
  });

  it('should format array values', () => {
    const obj = { items: ['항목1', '항목2'] };
    const result = formatJsonForDisplay(obj);

    expect(result).toBe('Items: 항목1, 항목2');
  });

  it('should format nested object values', () => {
    const obj = { data: { key: 'value' } };
    const result = formatJsonForDisplay(obj);

    expect(result).toContain('Data:');
    expect(result).toContain('key');
  });

  it('should skip metadata keys', () => {
    const obj = {
      id: '123',
      order: 1,
      type: 'test',
      timestamp: 'now',
      visible: 'yes',
    };
    const result = formatJsonForDisplay(obj);

    expect(result).not.toContain('123');
    expect(result).toContain('Visible: yes');
  });

  it('should handle camelCase conversion to space-separated', () => {
    const obj = { firstName: 'John' };
    const result = formatJsonForDisplay(obj);

    expect(result).toBe('First Name: John');
  });

  it('should skip null and undefined values', () => {
    const obj = { valid: 'value', invalid: null, missing: undefined };
    const result = formatJsonForDisplay(obj);

    expect(result).toBe('Valid: value');
  });

  it('should format numeric values', () => {
    const obj = { count: 42 };
    const result = formatJsonForDisplay(obj);

    expect(result).toBe('Count: 42');
  });

  it('should format boolean values', () => {
    const obj = { active: true };
    const result = formatJsonForDisplay(obj);

    expect(result).toBe('Active: true');
  });

  it('should skip empty arrays', () => {
    const obj = { items: [], name: 'test' };
    const result = formatJsonForDisplay(obj);

    expect(result).toBe('Name: test');
  });
});
