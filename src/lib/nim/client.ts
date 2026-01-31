/**
 * NVIDIA NIM API 클라이언트
 * GPU 가속 Vision/OCR 처리
 */

const NIM_API_URL = process.env.NIM_API_URL || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY || '';

export interface NIMOCRResult {
  text: string;
  mathExpressions: string[];
  confidence: number;
  processingTime: number;
}

export interface NIMError {
  error: string;
  message: string;
}

/**
 * NVIDIA NIM Vision API를 사용하여 이미지에서 텍스트/수식 추출
 */
export async function processImageWithNIM(
  imageBase64: string
): Promise<NIMOCRResult> {
  const startTime = Date.now();

  // base64 데이터 URL에서 순수 base64 추출
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  try {
    // NVIDIA NIM Vision API 호출
    const response = await fetch(`${NIM_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NIM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'nvidia/neva-22b', // NVIDIA Vision 모델
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `이 이미지는 전기기사 실기 시험 문제입니다. 다음을 수행해주세요:

1. 이미지에서 모든 텍스트를 정확하게 추출하세요.
2. 수학 공식이나 수식은 LaTeX 형식으로 변환하세요. (예: $P = VI$)
3. 회로도나 다이어그램이 있다면 설명을 추가하세요.
4. 단위(예: kW, A, Ω)를 정확하게 인식하세요.

추출된 문제 내용을 한국어로 정리해주세요.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'NIM API 호출 실패');
    }

    const data = await response.json();
    const extractedText = data.choices[0]?.message?.content || '';

    // LaTeX 수식 추출
    const mathExpressions = extractMathExpressions(extractedText);

    return {
      text: extractedText,
      mathExpressions,
      confidence: 0.95, // NIM 모델의 기본 신뢰도
      processingTime: (Date.now() - startTime) / 1000,
    };
  } catch (error) {
    console.error('NIM OCR Error:', error);

    // 폴백: 기본 응답 반환
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

/**
 * NIM API 헬스 체크
 */
export async function checkNIMHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${NIM_API_URL}/models`, {
      headers: {
        Authorization: `Bearer ${NIM_API_KEY}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
