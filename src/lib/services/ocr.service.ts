/**
 * OCR Service - 이미지에서 텍스트 추출
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/api/logger';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export interface OCRResult {
  text: string;
  confidence: number;
  processingTime: number;
}

export class OCRService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  async extractText(imageBase64: string): Promise<OCRResult> {
    const startTime = Date.now();

    // base64 데이터 URL에서 순수 base64 추출
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    // MIME 타입 추출
    const mimeTypeMatch = imageBase64.match(/data:([^;]+);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: `이 이미지는 한국 전기기사 실기 시험 문제입니다.

이미지에서 모든 텍스트를 정확하게 추출해주세요.
- 문제 번호, 문제 내용, 조건 등 모든 텍스트를 포함
- 숫자와 단위를 정확히 인식 (예: 80[ton], 2[m/min], 75[%], kW, A, Ω 등)
- 수식이 있다면 그대로 표현

추출된 문제 텍스트만 출력해주세요. 설명이나 풀이는 하지 마세요.`,
        },
      ]);

      const extractedText = result.response.text();
      const processingTime = (Date.now() - startTime) / 1000;

      logger.info('OCR completed', {
        processingTime,
        textLength: extractedText.length,
      });

      return {
        text: extractedText,
        confidence: 0.95,
        processingTime,
      };
    } catch (error) {
      logger.error('OCR failed', error as Error);

      return {
        text: '',
        confidence: 0,
        processingTime: (Date.now() - startTime) / 1000,
      };
    }
  }
}

export const ocrService = new OCRService();
