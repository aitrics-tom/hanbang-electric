/**
 * Google Gemini Vision API 클라이언트
 * OCR 및 이미지 텍스트 추출
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export interface OCRResult {
  text: string;
  mathExpressions: string[];
  confidence: number;
  processingTime: number;
}

/**
 * Gemini Vision API를 사용하여 이미지에서 텍스트/수식 추출
 */
export async function processImageWithGemini(
  imageBase64: string
): Promise<OCRResult> {
  const startTime = Date.now();

  // base64 데이터 URL에서 순수 base64 추출
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  // MIME 타입 추출
  const mimeTypeMatch = imageBase64.match(/data:([^;]+);/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

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

    // LaTeX 수식 추출
    const mathExpressions = extractMathExpressions(extractedText);

    return {
      text: extractedText,
      mathExpressions,
      confidence: 0.95,
      processingTime: (Date.now() - startTime) / 1000,
    };
  } catch (error) {
    console.error('Gemini OCR Error:', error);

    return {
      text: '이미지 인식에 실패했습니다. 텍스트로 직접 입력해주세요.',
      mathExpressions: [],
      confidence: 0,
      processingTime: (Date.now() - startTime) / 1000,
    };
  }
}

/**
 * 텍스트에서 LaTeX 수식 추출
 */
function extractMathExpressions(text: string): string[] {
  const expressions: string[] = [];

  // $...$ 패턴
  const inlineMatches = text.match(/\$[^$]+\$/g);
  if (inlineMatches) {
    expressions.push(...inlineMatches.map((m) => m.slice(1, -1)));
  }

  // $$...$$ 패턴
  const blockMatches = text.match(/\$\$[\s\S]+?\$\$/g);
  if (blockMatches) {
    expressions.push(...blockMatches.map((m) => m.slice(2, -2)));
  }

  return expressions;
}
