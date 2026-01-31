/**
 * Vision Service - Gemini 비전 기반 이미지 분석
 *
 * 역할:
 * - 이미지에서 문제 텍스트 추출 (OCR)
 * - 회로도/시퀀스 다이어그램 인식
 * - 수식 및 기호 인식
 * - 문제 유형 사전 분류 (토큰 절약)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentType } from '@/types';
import { logger } from '@/lib/api/logger';
import {
  parseAIResponse,
  cleanTextFromJSON,
  removeJsonLabel,
  extractCodeBlock,
  extractBalancedJSON,
  safeString,
  safeNumber,
  safeArray,
  removeAllJsonArtifacts,
  ensureCleanText,
} from '@/lib/utils/jsonParser';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export interface VisionAnalysisResult {
  // 추출된 텍스트
  extractedText: string;
  // 회로도 분석 결과
  circuitAnalysis?: {
    type: 'sequence' | 'power' | 'control' | 'logic' | 'none';
    components: string[];
    connections: string[];
    description: string;
  };
  // 수식 인식
  formulas: string[];
  // 표/데이터 인식
  tables?: Array<{
    headers: string[];
    rows: string[][];
  }>;
  // 사전 분류 (빠른 라우팅용)
  suggestedAgent: AgentType;
  // 키워드
  keywords: string[];
  // 처리 시간
  processingTime: number;
  // 신뢰도
  confidence: number;
}

const VISION_ANALYSIS_PROMPT = `## 절대 규칙
응답은 반드시 순수 JSON만 출력하라. 백틱, 마크다운, 설명 텍스트 금지. { 로 시작해서 } 로 끝나는 순수 JSON만 출력하라.

당신은 전기기사 실기 시험 문제 이미지 분석 전문가입니다.

## 분석 항목

### 1. 텍스트 추출 (가장 중요)
- 문제 번호부터 시작하여 모든 문제 텍스트를 정확히 추출하라
- 소문제 (1), (2), (3) 등을 구분하여 추출하라
- 빈칸 채우기 문제의 ( ) 또는 (①), (②) 등을 정확히 인식하라
- 숫자와 단위를 정확히 인식하라 (예: 80[ton], 2[m/min], 75[%], kW, kVA, A, Ω)
- 조건, 구하는 것 등을 구분하라
- 표가 있으면 표 내용도 extractedText에 텍스트 형태로 포함하라

#### 숫자 인식 주의사항 (필수 준수)
- 숫자를 절대 추측하지 마라. 이미지에 보이는 숫자를 그대로 읽어라
- 비슷한 숫자를 혼동하지 마라: 0.5↔0.8, 1↔1.5, 3↔8, 6↔9
- 소수점 위치를 정확히 파악하라: 0.75와 75, 2.5와 25 구분
- 단위 접두사를 혼동하지 마라: kW↔MW, kVA↔VA

### 2. 그래프/차트 분석 (있는 경우)
그래프가 있으면 다음을 정밀하게 읽어라:
- X축(가로축) 눈금 라벨을 왼쪽→오른쪽 순서로
- Y축(세로축) 눈금 라벨을 아래→위 순서로
- 각 축의 단위 (시간[h], 전력[kW] 등)
- 계단형 그래프: 각 구간의 시작점, 끝점, Y값
- 선형 그래프: 각 꺾이는 점의 좌표
- 눈금선에 정확히 맞지 않는 값은 가장 가까운 눈금값으로 반올림

### 3. 도면/배치도 분석 (있는 경우)
전기 배치도/결선도가 있으면:
- 모든 전선의 상(Phase) 라벨 (A/B/C 또는 R/S/T)
- 각 부하의 종류: H(전열), M(전동기), L(조명)
- 각 부하의 용량: kW 또는 kVA 수치 (소수점 포함)
- 어느 두 전선(상간) 사이에 연결되었는지 추적

### 4. 회로도 분석 (있는 경우)
- 회로 유형: sequence(시퀀스/릴레이), power(전력회로), control(제어회로), logic(논리회로), none
- 구성요소: MC, THR, PB, Timer, Relay, 접점(a접점/b접점) 등
- 연결 관계 설명

### 5. 수식 인식
- 이미지에 있는 모든 수식을 LaTeX 형식으로 변환

### 6. 표/데이터 (매우 중요)
표가 있다면 다음 규칙을 따라라:
- 표의 모든 행과 열을 빠짐없이 읽어라
- 병합된 셀(여러 행에 걸친 셀)이 있으면 해당 값을 각 행에 반복 기재하라
  예: "저압"이 한 행, "고압"이 두 행에 걸쳐 있으면 → 고압 행마다 "고압" 명시
- 빈칸 표시 (①), (②), (③), ( ) 등을 정확히 인식하라
- extractedText에 표를 텍스트로 변환할 때 행 단위로 구분하여 작성하라
  예시 형식:
  [표: 용량별 점검횟수 및 간격]
  | 구분 | 용량별 | 점검횟수 | 점검간격 |
  | 저압 | 1~300kW 이하 | 월 1회 | (①)일 이상 |
  | 고압 | 500kW 초과~700kW 이하 | 월(②)회 | 7일 이상 |
  | 고압 | 2000kW 초과~ | 월(③)회 | 3일 이상 |
- 첫 번째 열이 카테고리(저압/고압 등)이고 여러 행에 걸쳐 있으면 각 행에 명시
- 표 제목이 있으면 함께 추출하라

### 7. 문제 분류
다음 중 가장 적합한 에이전트 선택:
- DESIGN: 변압기, 차단기, 케이블, 전선굵기, 수변전, MOF
- SEQUENCE: 시퀀스, PLC, 릴레이, 타이머, 래더, 자기유지
- LOAD: 조명, 조도, 역률, 콘덴서, 전동기, 축전지, 광속법
- POWER: 송배전, 단락전류, 전력손실, %Z, 부하곡선
- RENEWABLE: 태양광, ESS, 인버터, 감리
- KEC: 접지, TT/TN, 누전차단기, 규정

### 8. 키워드
문제의 핵심 키워드 추출 (최대 10개)

## 응답 형식 (순수 JSON만 출력)
{
  "extractedText": "문제 번호와 전체 지문을 포함. 소문제는 (1), (2) 등으로 구분. 표가 있으면 | 구분자로 행 표현. 빈칸은 (①), (②) 등 그대로 표기. 예: 10. 전기안전관리자의 직무에 따라... (1) ( )점검이란... (2) 표: 용량별 점검횟수 및 간격 | 저압 | 1~300kW 이하 | 월 1회 | (①)일 이상 | ...",
  "circuitAnalysis": {
    "type": "sequence|power|control|logic|none",
    "components": ["MC", "THR", "PB1"],
    "connections": ["PB1 → MC 코일", "MC 접점 → 부하"],
    "description": "자기유지 회로로, PB1을 누르면 MC가 여자되어..."
  },
  "graphData": {
    "xAxis": {"label": "시간", "unit": "h", "ticks": [0, 6, 12, 18, 24]},
    "yAxis": {"label": "전력", "unit": "kW", "ticks": [0, 50, 100]},
    "series": [{"name": "부하곡선", "data": [{"x": 0, "y": 50}, {"x": 6, "y": 100}]}]
  },
  "diagramData": {
    "phases": ["A", "B", "C"],
    "loads": [{"type": "H", "kw": 2.0, "between": ["A", "B"]}]
  },
  "formulas": ["P = \\sqrt{3} V I \\cos\\theta"],
  "tables": [{"headers": ["항목", "값"], "rows": [["전압", "380V"]]}],
  "suggestedAgent": "LOAD",
  "keywords": ["조명", "광속법", "조도", "등수"],
  "confidence": 0.95
}`;

export class VisionService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  /**
   * 이미지 분석 - OCR + 회로 인식 + 분류
   */
  async analyzeImage(imageBase64: string): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const mimeTypeMatch = imageBase64.match(/data:([^;]+);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

    try {
      // Gemini 2.0 Flash for vision (빠르고 저렴)
      // 토큰 제한을 4096으로 증가 - 긴 문제/표 포함 이미지 지원
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: VISION_ANALYSIS_PROMPT },
      ]);

      const responseText = result.response.text();
      const processingTime = (Date.now() - startTime) / 1000;

      const parsed = this.parseResponse(responseText);

      logger.info('Vision analysis completed', {
        processingTime,
        suggestedAgent: parsed.suggestedAgent,
        hasCircuit: parsed.circuitAnalysis?.type !== 'none',
      });

      return {
        ...parsed,
        processingTime,
      };
    } catch (error) {
      logger.error('Vision analysis failed', error as Error);

      // 에러 발생 시에도 기본 결과 반환 (graceful degradation)
      // 텍스트 추출에 실패해도 이후 프로세스가 진행될 수 있도록 함
      const processingTime = (Date.now() - startTime) / 1000;

      return {
        extractedText: '',
        circuitAnalysis: undefined,
        formulas: [],
        tables: undefined,
        suggestedAgent: 'DESIGN',
        keywords: [],
        processingTime,
        confidence: 0,
      };
    }
  }

  private parseResponse(responseText: string): Omit<VisionAnalysisResult, 'processingTime'> {
    try {
      // 통합 JSON 파서 사용
      const parseResult = parseAIResponse<{
        extractedText?: string;
        circuitAnalysis?: VisionAnalysisResult['circuitAnalysis'];
        formulas?: string[];
        tables?: VisionAnalysisResult['tables'];
        suggestedAgent?: string;
        keywords?: string[];
        confidence?: number;
      }>(responseText);

      if (!parseResult.success || !parseResult.data) {
        throw new Error(parseResult.error || 'JSON parsing failed');
      }

      const parsed = parseResult.data;

      // 3단계: extractedText 정리 (가장 중요!)
      // 여기서 모든 JSON/코드블록 형식을 완전히 제거해야 함
      let cleanedText = '';
      if (parsed.extractedText) {
        cleanedText = this.cleanExtractedText(parsed.extractedText);
      }

      // 4단계: cleanedText가 비어있거나 너무 짧으면 원본에서 재추출
      if (cleanedText.length < 20) {
        // extractedText 필드 값을 다시 확인
        const rawExtracted = parsed.extractedText || '';
        if (rawExtracted.length > cleanedText.length) {
          // 더 강력한 정리 시도
          cleanedText = this.extractCoreText(rawExtracted);
        }

        // 그래도 짧으면 전체 응답에서 추출
        if (cleanedText.length < 20) {
          const fallback = this.extractTextFromRawResponse(responseText);
          if (fallback.length > cleanedText.length) {
            cleanedText = fallback;
          }
        }
      }

      // 5단계: 최종 검증 - 반드시 순수 텍스트여야 함
      cleanedText = this.ensurePureText(cleanedText);

      logger.debug('Vision response parsed', {
        originalLength: responseText.length,
        extractedLength: cleanedText.length,
        hasCircuit: !!parsed.circuitAnalysis,
      });

      return {
        extractedText: cleanedText,
        circuitAnalysis: parsed.circuitAnalysis,
        formulas: parsed.formulas || [],
        tables: parsed.tables,
        suggestedAgent: this.validateAgentType(parsed.suggestedAgent || 'DESIGN'),
        keywords: parsed.keywords || [],
        confidence: parsed.confidence || 0.8,
      };
    } catch (error) {
      logger.error('Failed to parse vision response', error as Error);

      // 파싱 실패 시 텍스트만 추출 시도
      const fallbackText = this.extractTextFromRawResponse(responseText);
      const cleanedFallback = this.ensurePureText(fallbackText);

      return {
        extractedText: cleanedFallback,
        suggestedAgent: 'DESIGN',
        keywords: [],
        formulas: [],
        confidence: 0.5,
      };
    }
  }

  /**
   * 최종 검증 - 순수 텍스트 보장
   * 어떤 JSON 형식이나 코드블록도 남아있지 않도록 함
   * 강화된 ensureCleanText 사용
   */
  private ensurePureText(text: string): string {
    return ensureCleanText(text, '문제 텍스트를 추출할 수 없습니다.');
  }

  /**
   * 추출된 텍스트 정리 - 불필요한 형식 제거
   *
   * 중요: 이 함수는 extractedText에서 모든 JSON/코드블록 형식을 완전히 제거하여
   * 순수 텍스트만 반환해야 합니다. 이렇게 해야 이후 agent.service에서
   * 프롬프트에 삽입할 때 Gemini가 중괄호를 혼동하지 않습니다.
   */
  private cleanExtractedText(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // 1. 먼저 중첩된 JSON 파싱 시도 (extractedText 안에 또 JSON이 있는 경우)
    const trimmed = cleaned.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.extractedText && typeof parsed.extractedText === 'string') {
          // 재귀적으로 정리
          return this.cleanExtractedText(parsed.extractedText);
        }
      } catch {
        // JSON이 아니면 계속 진행
      }
    }

    // 2. ```json ... ``` 또는 ``` ... ``` 코드 블록 완전 제거
    // 여러 개의 코드 블록이 있을 수 있으므로 반복 처리
    cleaned = cleaned.replace(/```(?:json|javascript|typescript|js|ts)?\s*[\s\S]*?```/gi, '');

    // 3. 단독 백틱 라인 제거
    cleaned = cleaned.replace(/^```\s*$/gm, '');

    // 4. JSON 객체 형태 제거 (문제 텍스트 안에 있으면 안 됨)
    // 단, 수학적 중괄호 (예: {1, 2, 3})는 보존해야 함
    // JSON 키-값 패턴이 있는 경우만 제거
    const jsonPattern = /\{\s*"[^"]+"\s*:/;
    if (jsonPattern.test(cleaned)) {
      // JSON 객체로 보이는 부분 제거
      cleaned = cleaned.replace(/\{[^{}]*"[^"]*"\s*:[^{}]*\}/g, '');
    }

    // 5. 이스케이프된 줄바꿈을 실제 줄바꿈으로 변환
    cleaned = cleaned.replace(/\\n/g, '\n');

    // 6. 연속된 줄바꿈 정리
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 7. 앞뒤 공백 제거
    cleaned = cleaned.trim();

    // 8. 빈 결과인 경우 원본 텍스트에서 핵심만 추출 시도
    if (cleaned.length < 10) {
      return this.extractCoreText(text);
    }

    return cleaned;
  }

  /**
   * 원본 텍스트에서 핵심 문제 텍스트만 추출
   */
  private extractCoreText(text: string): string {
    const lines = text.split('\n');
    const meaningfulLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // 건너뛸 패턴들
      if (
        trimmed.length === 0 ||
        trimmed.startsWith('{') ||
        trimmed.startsWith('}') ||
        trimmed.startsWith('```') ||
        trimmed.startsWith('"extractedText"') ||
        trimmed.startsWith('"circuitAnalysis"') ||
        trimmed.startsWith('"formulas"') ||
        trimmed.startsWith('"tables"') ||
        trimmed.startsWith('"suggestedAgent"') ||
        trimmed.startsWith('"keywords"') ||
        trimmed.startsWith('"confidence"') ||
        trimmed.match(/^"[a-zA-Z]+"\s*:/)  // JSON 키-값 패턴
      ) {
        continue;
      }

      // 따옴표로 감싸진 값에서 텍스트 추출
      const valueMatch = trimmed.match(/^"([^"]+)"[,]?$/);
      if (valueMatch) {
        meaningfulLines.push(valueMatch[1]);
        continue;
      }

      meaningfulLines.push(trimmed);
    }

    return meaningfulLines.join('\n').trim() || '문제 텍스트를 추출할 수 없습니다.';
  }

  /**
   * 원본 응답에서 텍스트만 추출 (파싱 실패 시 폴백)
   * 개선: greedy 패턴 제거, 재귀 깊이 제한 추가
   */
  private extractTextFromRawResponse(responseText: string, depth: number = 0): string {
    // 재귀 깊이 제한
    if (depth > 5) {
      return this.extractCoreText(responseText);
    }

    // 1. extractedText 필드 값만 추출 시도
    const simpleMatch = responseText.match(/"extractedText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (simpleMatch) {
      const extracted = simpleMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

      // 추출된 값이 또 JSON이면 재귀 처리 (깊이 제한 적용)
      if (extracted.trim().startsWith('{')) {
        return this.extractTextFromRawResponse(extracted, depth + 1);
      }

      return extracted;
    }

    // 2. 여러 줄 문자열 (템플릿 리터럴 스타일)
    const multilineMatch = responseText.match(/"extractedText"\s*:\s*`([^`]*)`/);
    if (multilineMatch) {
      return multilineMatch[1].replace(/\\n/g, '\n');
    }

    // 3. 코드 블록 안에 순수 텍스트가 있는지 확인
    const textBlockMatch = responseText.match(/```\s*\n([\s\S]*?)\n```/);
    if (textBlockMatch && !textBlockMatch[1].trim().startsWith('{')) {
      return textBlockMatch[1].trim();
    }

    // 4. 균형 잡힌 JSON 추출 후 제거 (greedy 패턴 대신)
    // 수학적 중괄호 보호를 위해 removeAllJsonArtifacts 사용
    const cleaned = removeAllJsonArtifacts(responseText);

    // 5. 정리된 텍스트가 있으면 반환
    if (cleaned.length > 10) {
      return cleaned;
    }

    // 6. 원본 텍스트에서 핵심 내용만 추출
    return this.extractCoreText(responseText);
  }

  private validateAgentType(agent: string): AgentType {
    const validAgents: AgentType[] = ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'];
    return validAgents.includes(agent as AgentType)
      ? (agent as AgentType)
      : 'DESIGN';
  }
}

export const visionService = new VisionService();
