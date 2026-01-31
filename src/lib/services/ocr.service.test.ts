/**
 * OCR Service Integration Tests
 * TDD: Tests for OCR text extraction from real electrical engineer exam images
 *
 * Test Images Location: /Users/sunguk/ai-projects/hackaton/doc/test/
 *
 * | File | Problem Type | Category | Expected Content |
 * |------|--------------|----------|------------------|
 * | 1번 문제.png | 권상기 전동기 용량 | LOAD | 80 ton, 2 m/min, 75%, kW |
 * | 2번 문제.png | 지선 가닥수 계산 | DESIGN | 가닥수, 지선, 계산 |
 * | 9번 문제.png | 논리회로/시퀀스 | SEQUENCE | 논리회로, 시퀀스, 회로 |
 * | 14번 문제.png | 전기기호 명칭 | DESIGN | G, F, B, 기호 |
 * | 15번 문제.png | 정역 운전 회로도 | SEQUENCE | 정역, 운전, 회로 |
 * | 18번 문제.png | 영상전류 검출 | POWER | 영상전류, 검출, 방법 |
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OCRService, OCRResult } from './ocr.service';
import fs from 'fs';
import path from 'path';

// Test image directory path
const TEST_IMAGES_DIR = '/Users/sunguk/ai-projects/hackaton/doc/test';

// Expected OCR content patterns for each test image (for reference/future use)
const _EXPECTED_CONTENT = {
  '1번 문제.png': {
    category: 'LOAD',
    keywords: ['ton', 'm/min', '%', 'kW', '권상', '전동기', '용량'],
    numbers: ['80', '2', '75'],
  },
  '2번 문제.png': {
    category: 'DESIGN',
    keywords: ['지선', '가닥', '계산'],
    numbers: [],
  },
  '9번 문제.png': {
    category: 'SEQUENCE',
    keywords: ['논리', '회로', '시퀀스'],
    numbers: [],
  },
  '14번 문제.png': {
    category: 'DESIGN',
    keywords: ['기호', '명칭'],
    letters: ['G', 'F', 'B'],
  },
  '15번 문제.png': {
    category: 'SEQUENCE',
    keywords: ['정역', '운전', '회로'],
    numbers: [],
  },
  '18번 문제.png': {
    category: 'POWER',
    keywords: ['영상전류', '검출', '방법'],
    numbers: ['3'],
  },
} as const;

// Helper function to load image as base64
function loadImageAsBase64(filename: string): string {
  const imagePath = path.join(TEST_IMAGES_DIR, filename);
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Test image not found: ${imagePath}`);
  }
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

// Helper function to check if test images exist
function testImagesExist(): boolean {
  try {
    return fs.existsSync(TEST_IMAGES_DIR) && fs.readdirSync(TEST_IMAGES_DIR).length > 0;
  } catch {
    return false;
  }
}

// Mock logger to prevent console output
vi.mock('@/lib/api/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('OCRService', () => {
  let service: OCRService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OCRService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unit Tests (Mocked)', () => {
    describe('extractText method structure', () => {
      it('should return OCRResult with required fields', async () => {
        // Mock the Gemini API response
        const mockGenerateContent = vi.fn().mockResolvedValue({
          response: {
            text: () => '권상기용 전동기 용량 계산\n권상하중: 80 ton\n속도: 2 m/min\n효율: 75%',
          },
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        // Replace the genAI instance
        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        const result = await service.extractText('data:image/png;base64,testbase64data');

        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('processingTime');
        expect(typeof result.text).toBe('string');
        expect(typeof result.confidence).toBe('number');
        expect(typeof result.processingTime).toBe('number');
      });

      it('should handle base64 data URL format correctly', async () => {
        const mockGenerateContent = vi.fn().mockResolvedValue({
          response: {
            text: () => 'Extracted text content',
          },
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        await service.extractText('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');

        // Verify the model was called with correct parameters
        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              inlineData: expect.objectContaining({
                mimeType: 'image/png',
                data: 'iVBORw0KGgoAAAANSUhEUg==',
              }),
            }),
          ])
        );
      });

      it('should handle raw base64 without data URL prefix', async () => {
        const mockGenerateContent = vi.fn().mockResolvedValue({
          response: {
            text: () => 'Extracted text content',
          },
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        await service.extractText('rawBase64DataWithoutPrefix');

        // Should default to image/png for raw base64
        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              inlineData: expect.objectContaining({
                mimeType: 'image/png',
                data: 'rawBase64DataWithoutPrefix',
              }),
            }),
          ])
        );
      });

      it('should return high confidence for successful extraction', async () => {
        const mockGenerateContent = vi.fn().mockResolvedValue({
          response: {
            text: () => '정상적으로 추출된 텍스트입니다.',
          },
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        const result = await service.extractText('data:image/png;base64,test');

        expect(result.confidence).toBe(0.95);
      });

      it('should track processing time', async () => {
        const mockGenerateContent = vi.fn().mockImplementation(async () => {
          // Simulate some processing delay
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            response: {
              text: () => 'Test result',
            },
          };
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        const result = await service.extractText('data:image/png;base64,test');

        expect(result.processingTime).toBeGreaterThan(0);
      });
    });

    describe('Error handling', () => {
      it('should return empty text and zero confidence on API error', async () => {
        const mockGenerateContent = vi.fn().mockRejectedValue(new Error('API Error'));

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        const result = await service.extractText('data:image/png;base64,test');

        expect(result.text).toBe('');
        expect(result.confidence).toBe(0);
        expect(result.processingTime).toBeGreaterThanOrEqual(0);
      });

      it('should handle network timeout gracefully', async () => {
        const mockGenerateContent = vi.fn().mockRejectedValue(new Error('Network timeout'));

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        const result = await service.extractText('data:image/png;base64,test');

        expect(result.text).toBe('');
        expect(result.confidence).toBe(0);
      });

      it('should handle rate limit errors', async () => {
        const mockGenerateContent = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        const result = await service.extractText('data:image/png;base64,test');

        expect(result.text).toBe('');
        expect(result.confidence).toBe(0);
      });
    });

    describe('MIME type detection', () => {
      it('should detect PNG MIME type', async () => {
        const mockGenerateContent = vi.fn().mockResolvedValue({
          response: { text: () => 'test' },
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        await service.extractText('data:image/png;base64,test');

        const callArgs = mockGenerateContent.mock.calls[0][0];
        expect(callArgs[0].inlineData.mimeType).toBe('image/png');
      });

      it('should detect JPEG MIME type', async () => {
        const mockGenerateContent = vi.fn().mockResolvedValue({
          response: { text: () => 'test' },
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        await service.extractText('data:image/jpeg;base64,test');

        const callArgs = mockGenerateContent.mock.calls[0][0];
        expect(callArgs[0].inlineData.mimeType).toBe('image/jpeg');
      });

      it('should detect WebP MIME type', async () => {
        const mockGenerateContent = vi.fn().mockResolvedValue({
          response: { text: () => 'test' },
        });

        const mockGetGenerativeModel = vi.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        });

        (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
          getGenerativeModel: mockGetGenerativeModel,
        };

        await service.extractText('data:image/webp;base64,test');

        const callArgs = mockGenerateContent.mock.calls[0][0];
        expect(callArgs[0].inlineData.mimeType).toBe('image/webp');
      });
    });
  });

  describe('Mock OCR Response Tests', () => {
    /**
     * These tests verify classification logic with simulated OCR outputs
     * that match expected content from real exam images
     */

    it('should extract hoist motor problem content (1번 문제)', async () => {
      const expectedOCRText = `1. 권상기용 전동기 용량을 구하시오.
      [조건]
      - 권상하중: 80 [ton]
      - 권상속도: 2 [m/min]
      - 효율: 75 [%]`;

      const mockGenerateContent = vi.fn().mockResolvedValue({
        response: { text: () => expectedOCRText },
      });

      const mockGetGenerativeModel = vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      });

      (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
        getGenerativeModel: mockGetGenerativeModel,
      };

      const result = await service.extractText('data:image/png;base64,mockdata');

      // Verify extracted text contains key information
      expect(result.text).toContain('권상');
      expect(result.text).toContain('80');
      expect(result.text).toContain('ton');
      expect(result.text).toContain('2');
      expect(result.text).toContain('m/min');
      expect(result.text).toContain('75');
      expect(result.text).toContain('%');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract stay wire problem content (2번 문제)', async () => {
      const expectedOCRText = `2. 지선의 가닥수를 구하시오.
      [조건]
      - 전선의 수평장력: T [kg]
      - 지선의 안전율: 2.5
      - 지선의 허용인장하중: 1,600 [kg]`;

      const mockGenerateContent = vi.fn().mockResolvedValue({
        response: { text: () => expectedOCRText },
      });

      const mockGetGenerativeModel = vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      });

      (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
        getGenerativeModel: mockGetGenerativeModel,
      };

      const result = await service.extractText('data:image/png;base64,mockdata');

      expect(result.text).toContain('지선');
      expect(result.text).toContain('가닥');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract logic circuit problem content (9번 문제)', async () => {
      const expectedOCRText = `9. 다음 논리회로를 시퀀스 회로로 완성하시오.
      [조건]
      - AND 게이트와 OR 게이트를 사용
      - 입력: A, B, C
      - 출력: Y`;

      const mockGenerateContent = vi.fn().mockResolvedValue({
        response: { text: () => expectedOCRText },
      });

      const mockGetGenerativeModel = vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      });

      (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
        getGenerativeModel: mockGetGenerativeModel,
      };

      const result = await service.extractText('data:image/png;base64,mockdata');

      expect(result.text).toContain('논리회로');
      expect(result.text).toContain('시퀀스');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract electrical symbol naming problem content (14번 문제)', async () => {
      const expectedOCRText = `14. 다음 전기기호의 명칭을 쓰시오.
      (가) G - 발전기
      (나) F - 퓨즈
      (다) B - 축전지`;

      const mockGenerateContent = vi.fn().mockResolvedValue({
        response: { text: () => expectedOCRText },
      });

      const mockGetGenerativeModel = vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      });

      (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
        getGenerativeModel: mockGetGenerativeModel,
      };

      const result = await service.extractText('data:image/png;base64,mockdata');

      expect(result.text).toContain('기호');
      expect(result.text).toContain('명칭');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract forward/reverse circuit problem content (15번 문제)', async () => {
      const expectedOCRText = `15. 다음 정역 운전 회로도를 완성하시오.
      [조건]
      - 전동기: 3상 유도전동기
      - 정회전 접촉기: MC-F
      - 역회전 접촉기: MC-R
      - 인터록 회로 필수`;

      const mockGenerateContent = vi.fn().mockResolvedValue({
        response: { text: () => expectedOCRText },
      });

      const mockGetGenerativeModel = vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      });

      (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
        getGenerativeModel: mockGetGenerativeModel,
      };

      const result = await service.extractText('data:image/png;base64,mockdata');

      expect(result.text).toContain('정역');
      expect(result.text).toContain('운전');
      expect(result.text).toContain('회로');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract zero-sequence current detection problem content (18번 문제)', async () => {
      const expectedOCRText = `18. 영상전류 검출 방법 3가지를 서술하시오.
      1) CT 3대 사용법
      2) ZCT (영상변류기) 사용법
      3) 잔류회로법`;

      const mockGenerateContent = vi.fn().mockResolvedValue({
        response: { text: () => expectedOCRText },
      });

      const mockGetGenerativeModel = vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      });

      (service as unknown as { genAI: { getGenerativeModel: typeof mockGetGenerativeModel } }).genAI = {
        getGenerativeModel: mockGetGenerativeModel,
      };

      const result = await service.extractText('data:image/png;base64,mockdata');

      expect(result.text).toContain('영상전류');
      expect(result.text).toContain('검출');
      expect(result.text).toContain('3');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests with Real Images', () => {
    /**
     * These tests load actual exam images and verify OCR extraction
     * Skipped if GEMINI_API_KEY is not set or test images are not available
     */

    const shouldRunIntegrationTests =
      !!process.env.GEMINI_API_KEY && testImagesExist();

    describe.skipIf(!shouldRunIntegrationTests)('Real Image OCR Extraction', () => {
      // Increase timeout for API calls
      const INTEGRATION_TEST_TIMEOUT = 30000;

      it(
        'should extract text from hoist motor problem image (1번 문제)',
        async () => {
          const imageBase64 = loadImageAsBase64('1번 문제.png');
          const result = await service.extractText(imageBase64);

          expect(result.confidence).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(10);

          // Check for expected keywords
          const text = result.text.toLowerCase();
          const hasRelevantContent =
            text.includes('권상') ||
            text.includes('전동기') ||
            text.includes('ton') ||
            text.includes('kw');
          expect(hasRelevantContent).toBe(true);
        },
        INTEGRATION_TEST_TIMEOUT
      );

      it(
        'should extract text from stay wire problem image (2번 문제)',
        async () => {
          const imageBase64 = loadImageAsBase64('2번 문제.png');
          const result = await service.extractText(imageBase64);

          expect(result.confidence).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(10);

          const text = result.text.toLowerCase();
          const hasRelevantContent =
            text.includes('지선') || text.includes('가닥') || text.includes('장력');
          expect(hasRelevantContent).toBe(true);
        },
        INTEGRATION_TEST_TIMEOUT
      );

      it(
        'should extract text from logic circuit problem image (9번 문제)',
        async () => {
          const imageBase64 = loadImageAsBase64('9번 문제.png');
          const result = await service.extractText(imageBase64);

          expect(result.confidence).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(10);

          const text = result.text.toLowerCase();
          const hasRelevantContent =
            text.includes('논리') ||
            text.includes('회로') ||
            text.includes('and') ||
            text.includes('or');
          expect(hasRelevantContent).toBe(true);
        },
        INTEGRATION_TEST_TIMEOUT
      );

      it(
        'should extract text from symbol naming problem image (14번 문제)',
        async () => {
          const imageBase64 = loadImageAsBase64('14번 문제.png');
          const result = await service.extractText(imageBase64);

          expect(result.confidence).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(10);

          const text = result.text;
          const hasRelevantContent =
            text.includes('기호') ||
            text.includes('명칭') ||
            (text.includes('G') && text.includes('F') && text.includes('B'));
          expect(hasRelevantContent).toBe(true);
        },
        INTEGRATION_TEST_TIMEOUT
      );

      it(
        'should extract text from forward/reverse circuit image (15번 문제)',
        async () => {
          const imageBase64 = loadImageAsBase64('15번 문제.png');
          const result = await service.extractText(imageBase64);

          expect(result.confidence).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(10);

          const text = result.text.toLowerCase();
          const hasRelevantContent =
            text.includes('정역') ||
            text.includes('운전') ||
            text.includes('mc') ||
            text.includes('전동기');
          expect(hasRelevantContent).toBe(true);
        },
        INTEGRATION_TEST_TIMEOUT
      );

      it(
        'should extract text from zero-sequence current image (18번 문제)',
        async () => {
          const imageBase64 = loadImageAsBase64('18번 문제.png');
          const result = await service.extractText(imageBase64);

          expect(result.confidence).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(10);

          const text = result.text.toLowerCase();
          const hasRelevantContent =
            text.includes('영상') ||
            text.includes('전류') ||
            text.includes('검출') ||
            text.includes('ct') ||
            text.includes('zct');
          expect(hasRelevantContent).toBe(true);
        },
        INTEGRATION_TEST_TIMEOUT
      );
    });

    describe.skipIf(!shouldRunIntegrationTests)('OCR Performance', () => {
      const PERFORMANCE_TIMEOUT = 60000;

      it(
        'should complete OCR within acceptable time (< 15 seconds)',
        async () => {
          const imageBase64 = loadImageAsBase64('1번 문제.png');
          const result = await service.extractText(imageBase64);

          expect(result.processingTime).toBeLessThan(15);
        },
        PERFORMANCE_TIMEOUT
      );

      it(
        'should handle multiple sequential OCR requests',
        async () => {
          const images = ['1번 문제.png', '9번 문제.png'];
          const results: OCRResult[] = [];

          for (const img of images) {
            const imageBase64 = loadImageAsBase64(img);
            const result = await service.extractText(imageBase64);
            results.push(result);
          }

          expect(results).toHaveLength(2);
          results.forEach((result) => {
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.text.length).toBeGreaterThan(0);
          });
        },
        PERFORMANCE_TIMEOUT
      );
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton ocrService instance', async () => {
      const { ocrService } = await import('./ocr.service');
      expect(ocrService).toBeDefined();
      expect(ocrService).toBeInstanceOf(OCRService);
    });
  });
});
