/**
 * Expected OCR Outputs for Test Images
 *
 * These fixtures represent the expected text extraction results from
 * real electrical engineer exam images. Used for both unit tests (mocking)
 * and integration test validation.
 *
 * Test Images Location: /Users/sunguk/ai-projects/hackaton/doc/test/
 */

import { AgentType } from '@/types';

export interface ExpectedOCROutput {
  filename: string;
  expectedCategory: AgentType;
  expectedKeywords: string[];
  expectedNumbers: string[];
  expectedUnits: string[];
  sampleOCRText: string;
  expectedAnswer?: string;
  problemType: string;
}

/**
 * Problem 1: Hoist Motor Capacity Calculation
 * Category: LOAD (Load Equipment)
 * Expected Answer: ~34.84 kW
 */
export const PROBLEM_1_HOIST: ExpectedOCROutput = {
  filename: '1번 문제.png',
  expectedCategory: 'LOAD',
  expectedKeywords: ['권상', '전동기', '용량', '하중', '속도', '효율'],
  expectedNumbers: ['80', '2', '75'],
  expectedUnits: ['ton', 'm/min', '%', 'kW'],
  sampleOCRText: `1. 권상기용 전동기 용량을 구하시오.

[조건]
- 권상하중: 80 [ton]
- 권상속도: 2 [m/min]
- 효율: 75 [%]

[참고]
- 전동기 부하율 계산
- 축전지 용량 산정 시 참고

[풀이]
전동기 용량 P = (W x g x v) / (η x 1000) [kW]
여기서,
W: 권상하중 [kg]
g: 중력가속도 (9.8 m/s²)
v: 권상속도 [m/s]
η: 효율`,
  expectedAnswer: '34.84 kW',
  problemType: 'calculation',
};

/**
 * Problem 2: Stay Wire Strand Count Calculation
 * Category: DESIGN (Electrical Equipment Design)
 */
export const PROBLEM_2_STAY_WIRE: ExpectedOCROutput = {
  filename: '2번 문제.png',
  expectedCategory: 'DESIGN',
  expectedKeywords: ['지선', '가닥수', '장력', '안전율', '인장하중', '케이블'],
  expectedNumbers: ['2.5', '1600'],
  expectedUnits: ['kg'],
  sampleOCRText: `2. 지선의 가닥수를 구하시오.

[조건]
- 전선(케이블)의 수평장력: T [kg]
- 지선의 안전율: 2.5
- 지선의 허용인장하중: 1,600 [kg]
- 전선굵기 및 단면적 참고

[풀이]
가닥수 n = (T x 안전율) / 허용인장하중`,
  problemType: 'calculation',
};

/**
 * Problem 9: Logic Circuit / Sequence Conversion
 * Category: SEQUENCE (Sequence/PLC)
 */
export const PROBLEM_9_LOGIC_CIRCUIT: ExpectedOCROutput = {
  filename: '9번 문제.png',
  expectedCategory: 'SEQUENCE',
  expectedKeywords: ['논리회로', '시퀀스', 'AND', 'OR', 'NOT', '접점', '릴레이'],
  expectedNumbers: [],
  expectedUnits: [],
  sampleOCRText: `9. 다음 논리회로를 시퀀스 회로로 완성하고 논리식을 구하시오.

[조건]
- AND 게이트, OR 게이트 사용
- 입력: A, B, C
- 출력: Y

[논리식]
Y = A・B + C
(AND와 OR의 조합)`,
  problemType: 'circuit-diagram',
};

/**
 * Problem 14: Electrical Symbol Naming
 * Category: DESIGN (Electrical Equipment Design)
 */
export const PROBLEM_14_SYMBOL_NAMING: ExpectedOCROutput = {
  filename: '14번 문제.png',
  expectedCategory: 'DESIGN',
  expectedKeywords: ['기호', '명칭', '전기', '발전기', '퓨즈', '축전지'],
  expectedNumbers: [],
  expectedUnits: [],
  sampleOCRText: `14. 다음 전기기호의 명칭을 쓰시오.

(가) G -
(나) F -
(다) B -

[답]
(가) G - 발전기 (Generator)
(나) F - 퓨즈 (Fuse)
(다) B - 축전지/배터리 (Battery)`,
  expectedAnswer: 'G: 발전기, F: 퓨즈, B: 축전지',
  problemType: 'knowledge',
};

/**
 * Problem 15: Forward/Reverse Motor Control Circuit
 * Category: SEQUENCE (Sequence/PLC)
 */
export const PROBLEM_15_FORWARD_REVERSE: ExpectedOCROutput = {
  filename: '15번 문제.png',
  expectedCategory: 'SEQUENCE',
  expectedKeywords: ['정역', '운전', '회로', '전동기', 'MC', '인터록', '접촉기'],
  expectedNumbers: ['3'],
  expectedUnits: [],
  sampleOCRText: `15. 다음 정역 운전 회로도를 완성하시오.

[조건]
- 3상 유도전동기
- 정회전 접촉기: MC-F
- 역회전 접촉기: MC-R
- 인터록 회로 필수
- 과부하 계전기 (THR) 사용

[회로 요소]
- PBS-F: 정회전 버튼
- PBS-R: 역회전 버튼
- PBS-STOP: 정지 버튼`,
  problemType: 'circuit-diagram',
};

/**
 * Problem 18: Zero-Sequence Current Detection Methods
 * Category: POWER (Power Equipment)
 */
export const PROBLEM_18_ZERO_SEQUENCE: ExpectedOCROutput = {
  filename: '18번 문제.png',
  expectedCategory: 'POWER',
  expectedKeywords: ['영상전류', '검출', '방법', 'CT', 'ZCT', '잔류'],
  expectedNumbers: ['3'],
  expectedUnits: [],
  sampleOCRText: `18. 영상전류 검출 방법 3가지를 서술하시오.

[답]
1) CT 3대 사용법
   - 각 상에 CT를 설치하고 2차측을 병렬 접속
   - 영상전류 Io = Ia + Ib + Ic

2) ZCT (영상변류기) 사용법
   - 3상 일괄 관통형 변류기 사용
   - 지락 시 영상전류만 검출

3) 잔류회로법 (GPT 방식)
   - 접지형 계기용 변압기 사용
   - 개방 델타 결선의 3차 권선 이용`,
  expectedAnswer: 'CT 3대 사용법, ZCT 사용법, 잔류회로법',
  problemType: 'descriptive',
};

// Export all fixtures as an array for iteration
export const ALL_TEST_PROBLEMS: ExpectedOCROutput[] = [
  PROBLEM_1_HOIST,
  PROBLEM_2_STAY_WIRE,
  PROBLEM_9_LOGIC_CIRCUIT,
  PROBLEM_14_SYMBOL_NAMING,
  PROBLEM_15_FORWARD_REVERSE,
  PROBLEM_18_ZERO_SEQUENCE,
];

// Helper function to get fixture by filename
export function getFixtureByFilename(filename: string): ExpectedOCROutput | undefined {
  return ALL_TEST_PROBLEMS.find((p) => p.filename === filename);
}

// Helper function to get fixtures by category
export function getFixturesByCategory(category: AgentType): ExpectedOCROutput[] {
  return ALL_TEST_PROBLEMS.filter((p) => p.expectedCategory === category);
}

// Helper function to validate OCR output against expected keywords
export function validateOCROutput(
  extractedText: string,
  expected: ExpectedOCROutput
): {
  isValid: boolean;
  matchedKeywords: string[];
  missedKeywords: string[];
  keywordCoverage: number;
} {
  const textLower = extractedText.toLowerCase();
  const matchedKeywords: string[] = [];
  const missedKeywords: string[] = [];

  for (const keyword of expected.expectedKeywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    } else {
      missedKeywords.push(keyword);
    }
  }

  const keywordCoverage =
    expected.expectedKeywords.length > 0
      ? matchedKeywords.length / expected.expectedKeywords.length
      : 1;

  return {
    isValid: keywordCoverage >= 0.5, // At least 50% keyword match
    matchedKeywords,
    missedKeywords,
    keywordCoverage,
  };
}
