import { AgentInfo, AgentType } from '@/types';

export const AGENTS: Record<AgentType, AgentInfo> = {
  DESIGN: {
    id: 'DESIGN',
    name: '전기설비설계',
    icon: '🔌',
    color: '#3B82F6',
    expertise: ['변압기', '차단기', '전선굵기', '케이블', '수변전'],
    description: '수변전 설비, 배선 설계 관련 문제를 해결합니다.',
  },
  SEQUENCE: {
    id: 'SEQUENCE',
    name: '시퀀스/PLC',
    icon: '⚡',
    color: '#8B5CF6',
    expertise: ['릴레이', '타이머', 'PLC', '래더', '논리회로'],
    description: '시퀀스 제어 및 PLC 프로그래밍 문제를 해결합니다.',
  },
  LOAD: {
    id: 'LOAD',
    name: '부하설비',
    icon: '💡',
    color: '#F59E0B',
    expertise: ['조명', '역률', '콘덴서', '전동기', '축전지'],
    description: '조명, 역률 개선, 동력 설비 문제를 해결합니다.',
  },
  POWER: {
    id: 'POWER',
    name: '전력설비',
    icon: '📊',
    color: '#EF4444',
    expertise: ['송전', '배전', '전력손실', '단락', '고장계산'],
    description: '송배전 계통 및 전력 계산 문제를 해결합니다.',
  },
  RENEWABLE: {
    id: 'RENEWABLE',
    name: '감리/신재생',
    icon: '🏗️',
    color: '#10B981',
    expertise: ['감리', '태양광', 'ESS', '인버터', '신재생'],
    description: '전기공사 감리 및 신재생에너지 문제를 해결합니다.',
  },
  KEC: {
    id: 'KEC',
    name: 'KEC규정',
    icon: '📋',
    color: '#6366F1',
    expertise: ['접지', 'TT', 'TN', '누전차단기', '배선규정'],
    description: '한국전기설비규정 관련 문제를 해결합니다.',
  },
};

// 키워드 매핑
export const AGENT_KEYWORDS: Record<AgentType, string[]> = {
  DESIGN: [
    '변압기', '차단기', '단로기', '전선굵기', '케이블', '용량', '수변전',
    '정격전류', '허용전류', '부스덕트', 'VCB', 'ACB', 'MCCB', 'kVA',
    '단면적', '굵기', '전압강하', '케이블 선정',
  ],
  SEQUENCE: [
    '릴레이', '타이머', '시퀀스', 'PLC', '래더', '자기유지', '인터록',
    'a접점', 'b접점', '타임차트', 'AND', 'OR', 'NOT', 'MC', 'THR',
    'EOCR', '정역', '운전', '기동', '정지',
  ],
  LOAD: [
    '조명', '광속', '조도', 'lux', 'lm', '역률', '콘덴서', '진상',
    '전동기', '축전지', '부하율', '수용률', '감광보상률', '조명률',
    '등수', '루멘', '배터리', 'UPS',
  ],
  POWER: [
    '송전', '배전', '전력손실', '코로나', '페란티', '단락전류',
    '%Z', '고장계산', '선로정수', '전압강하율', '임피던스',
    '단락용량', '차단용량',
  ],
  RENEWABLE: [
    '태양광', '태양전지', 'ESS', '인버터', '풍력', '신재생',
    '일사량', '발전량', '모듈', '어레이', '감리', '공사감리',
  ],
  KEC: [
    '접지', '접지저항', 'TT', 'TN', 'IT', '누전차단기', '감전',
    '이격거리', '배선', '과전류', '보호도체', 'KEC', '규정',
    '접지공사', '보호접지',
  ],
};

// 에이전트 분류 함수
export function classifyQuestion(question: string): {
  primary: AgentType;
  secondary: AgentType[];
  confidence: number;
} {
  const scores: Record<AgentType, number> = {
    DESIGN: 0,
    SEQUENCE: 0,
    LOAD: 0,
    POWER: 0,
    RENEWABLE: 0,
    KEC: 0,
  };

  const questionLower = question.toLowerCase();

  // 키워드 매칭 점수 계산
  for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (questionLower.includes(keyword.toLowerCase())) {
        scores[agent as AgentType] += 1;
      }
    }
  }

  // 정렬하여 상위 에이전트 선택
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score > 0);

  if (sorted.length === 0) {
    return { primary: 'DESIGN', secondary: [], confidence: 0.5 };
  }

  const primary = sorted[0][0] as AgentType;
  const primaryScore = sorted[0][1];
  const totalScore = sorted.reduce((sum, [, score]) => sum + score, 0);
  const confidence = Math.min(0.95, 0.5 + (primaryScore / totalScore) * 0.5);

  // KEC 관련 키워드가 있으면 secondary에 추가
  const secondary: AgentType[] = [];
  if (primary !== 'KEC' && scores.KEC > 0) {
    secondary.push('KEC');
  }

  return { primary, secondary, confidence };
}
