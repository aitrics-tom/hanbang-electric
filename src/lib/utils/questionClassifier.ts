/**
 * Question Classifier - 질문 유형 분류
 */

export type QuestionType = 'problem_solving' | 'personal_query' | 'general_chat';

const PERSONAL_KEYWORDS = [
  '내가', '나의', '내 ', '나는',
  '틀린 문제', '틀렸', '오답', '실수',
  '학습 현황', '학습현황', '공부 현황', '진도',
  '몇 문제', '몇문제', '얼마나',
  '정답률', '성적', '점수',
  '취약', '약한', '부족한',
  '추천', '뭘 공부', '무엇을 공부', '어떤 걸',
  '히스토리', '기록', '이력',
  '최근에', '어제', '오늘', '지난',
  '통계', '분석',
];

const PROBLEM_KEYWORDS = [
  '계산', '구하', '풀어', '답', '정답',
  '공식', '수식', '값',
  'V', 'A', 'W', 'kW', 'kVA', 'kVar',
  '전압', '전류', '저항', '전력', '역률',
  '회로', '변압기', 'PLC', '시퀀스',
  '접지', 'KEC', '규정',
  '=', '+', '-', '×', '÷',
  '단상', '3상', '삼상',
  '전동기', '발전기', '콘덴서',
];

export function classifyQuestion(text: string, hasImage: boolean): QuestionType {
  // 이미지가 있으면 문제 풀이
  if (hasImage) {
    return 'problem_solving';
  }

  const normalizedText = text.toLowerCase();

  // 개인 질문 점수 계산
  const personalScore = PERSONAL_KEYWORDS.reduce((score, keyword) => {
    return normalizedText.includes(keyword.toLowerCase()) ? score + 2 : score;
  }, 0);

  // 문제 풀이 점수 계산
  const problemScore = PROBLEM_KEYWORDS.reduce((score, keyword) => {
    return normalizedText.includes(keyword.toLowerCase()) ? score + 1 : score;
  }, 0);

  // 개인 질문 우선
  if (personalScore >= 2) {
    return 'personal_query';
  }

  // 문제 풀이 키워드가 충분하면
  if (problemScore >= 2) {
    return 'problem_solving';
  }

  // 기본값: 일반 대화
  return 'general_chat';
}

export function getQuestionTypeLabel(type: QuestionType): string {
  switch (type) {
    case 'problem_solving':
      return '문제 풀이';
    case 'personal_query':
      return '학습 현황';
    case 'general_chat':
      return 'AI 튜터';
  }
}
