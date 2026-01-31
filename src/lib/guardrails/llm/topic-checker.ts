/**
 * LLM 기반 주제 관련성 검증
 *
 * 전기기사 도메인과 관련된 질문인지 Gemini Flash로 빠르게 검증
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/api/logger';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const TOPIC_CHECK_PROMPT = `당신은 전기기사 실기 시험 문제 분류 전문가입니다.

주어진 텍스트가 전기기사 시험과 관련된 질문인지 판단하세요.

## 관련 주제 (허용)
- 전기설비, 전기공사, 전력계통
- 시퀀스, PLC, 릴레이, 타이머
- 조명, 조도, 광속법
- 역률, 콘덴서, 역률개선
- 변압기, 차단기, 수변전
- 배선, 케이블, 전선굵기
- 단락전류, 과전류, 누전
- 접지, TT계통, TN계통
- KEC 규정, 전기안전
- 태양광, ESS, 인버터
- 전동기, 부하계산
- 전압강하, 전력손실

## 비관련 주제 (거부)
- 일반 수학/물리 (전기 무관)
- 다른 자격증 시험
- 일상 대화, 잡담
- 프로그래밍 (PLC 제외)
- 금융, 경제, 법률 등

## 응답 형식 (JSON만 출력)
{
  "isRelevant": true/false,
  "confidence": 0.0-1.0,
  "category": "전기설비|시퀀스|조명|역률|변압기|접지|KEC|기타전기|비관련",
  "reason": "판단 근거 (한 줄)"
}

## 텍스트
`;

export interface TopicCheckResult {
  isRelevant: boolean;
  confidence: number;
  category: string;
  reason: string;
}

export class TopicChecker {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    });
  }

  /**
   * 주제 관련성 검사
   */
  async check(text: string): Promise<TopicCheckResult> {
    const startTime = Date.now();

    try {
      // 빈 텍스트 처리
      if (!text || text.trim().length < 3) {
        return {
          isRelevant: false,
          confidence: 1.0,
          category: '비관련',
          reason: '입력이 너무 짧습니다',
        };
      }

      // 빠른 키워드 사전 검사 (API 호출 절약)
      const quickCheck = this.quickKeywordCheck(text);
      if (quickCheck.confidence > 0.9) {
        logger.debug('Topic check: quick keyword match', {
          category: quickCheck.category,
          time: Date.now() - startTime,
        });
        return quickCheck;
      }

      // LLM 기반 검사
      const prompt = TOPIC_CHECK_PROMPT + text;
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      const parsed = this.parseResponse(responseText);

      logger.debug('Topic check completed', {
        isRelevant: parsed.isRelevant,
        category: parsed.category,
        time: Date.now() - startTime,
      });

      return parsed;
    } catch (error) {
      logger.error('Topic check failed', error as Error);

      // 에러 시 관대하게 허용 (false negative 방지)
      return {
        isRelevant: true,
        confidence: 0.5,
        category: '기타전기',
        reason: '검증 실패, 기본값 적용',
      };
    }
  }

  /**
   * 빠른 키워드 기반 사전 검사
   */
  private quickKeywordCheck(text: string): TopicCheckResult {
    const normalizedText = text.toLowerCase();

    // 전기기사 핵심 키워드
    const electricalKeywords = [
      { keywords: ['역률', 'pf', 'power factor', '콘덴서', 'kvar'], category: '역률' },
      { keywords: ['조명', '조도', '럭스', 'lux', '광속법', '등수'], category: '조명' },
      { keywords: ['시퀀스', 'plc', '릴레이', '타이머', '자기유지', 'mc'], category: '시퀀스' },
      { keywords: ['변압기', 'tr', '퍼센트 임피던스', '%z', 'kva'], category: '변압기' },
      { keywords: ['접지', 'tt', 'tn', 'it', '누전', '감전'], category: '접지' },
      { keywords: ['kec', '규정', '전기설비기준', '한국전기설비'], category: 'KEC' },
      { keywords: ['전압강하', '전선굵기', '케이블', 'mm²', '배선'], category: '전기설비' },
      { keywords: ['단락', '과전류', '차단기', 'cb', 'ocr'], category: '전기설비' },
      { keywords: ['태양광', 'pv', 'ess', '인버터', '신재생'], category: '기타전기' },
      { keywords: ['전동기', '모터', '부하', '전력', 'kw'], category: '기타전기' },
    ];

    for (const { keywords, category } of electricalKeywords) {
      if (keywords.some(kw => normalizedText.includes(kw))) {
        return {
          isRelevant: true,
          confidence: 0.95,
          category,
          reason: `키워드 매칭: ${keywords.find(kw => normalizedText.includes(kw))}`,
        };
      }
    }

    // 명확한 비관련 키워드
    const irrelevantKeywords = [
      '코딩', '프로그래밍', '파이썬', '자바스크립트',
      '주식', '비트코인', '투자',
      '요리', '레시피',
      '게임', '영화', '드라마',
    ];

    if (irrelevantKeywords.some(kw => normalizedText.includes(kw))) {
      return {
        isRelevant: false,
        confidence: 0.95,
        category: '비관련',
        reason: '비관련 키워드 감지',
      };
    }

    // 불확실한 경우 LLM 검사 필요
    return {
      isRelevant: true,
      confidence: 0.5,
      category: '기타전기',
      reason: 'LLM 검사 필요',
    };
  }

  /**
   * LLM 응답 파싱
   */
  private parseResponse(responseText: string): TopicCheckResult {
    try {
      // JSON 추출
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        isRelevant: parsed.isRelevant ?? true,
        confidence: parsed.confidence ?? 0.8,
        category: parsed.category ?? '기타전기',
        reason: parsed.reason ?? '',
      };
    } catch {
      // 파싱 실패 시 응답 텍스트에서 힌트 추출
      const isRelevant = !responseText.toLowerCase().includes('비관련') &&
                         !responseText.toLowerCase().includes('not relevant');

      return {
        isRelevant,
        confidence: 0.6,
        category: isRelevant ? '기타전기' : '비관련',
        reason: '응답 파싱 실패',
      };
    }
  }
}

// 싱글톤 인스턴스
let topicCheckerInstance: TopicChecker | null = null;

export function getTopicChecker(): TopicChecker {
  if (!topicCheckerInstance) {
    topicCheckerInstance = new TopicChecker();
  }
  return topicCheckerInstance;
}

/**
 * 간편 사용 함수
 */
export async function checkTopic(text: string): Promise<TopicCheckResult> {
  const checker = getTopicChecker();
  return checker.check(text);
}
