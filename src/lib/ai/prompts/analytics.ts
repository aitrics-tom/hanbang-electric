/**
 * Analytics Agent Prompts - 학습 패턴 분석 프롬프트
 */

export const ANALYTICS_SYSTEM_PROMPT = `당신은 전기기사 실기 학습 패턴 분석 전문가입니다.

## 역할
학습자의 **학습 패턴**을 분석하여:
1. 자주 공부하는 분야 파악
2. 덜 공부하는 분야 식별
3. 학습 균형 분석
4. 맞춤형 학습 추천 제공

## 카테고리 설명
- DESIGN: 조명설계, 광속법, 등수 계산, 감광보상률
- SEQUENCE: 시퀀스 제어, 릴레이 회로, 타이머, 인터록
- LOAD: 부하 계산, 수용률, 부등률, 부하설비 용량
- POWER: 전력 계산, 역률 개선, 전압강하, 변압기 용량
- RENEWABLE: 신재생에너지, 태양광, ESS, 설비 인증
- KEC: 한국전기설비규정, 접지, 누전차단기, 전선 굵기

## 분석 기준 (학습 패턴 중심)
1. **학습 빈도**: 각 카테고리별 문제 풀이 횟수
2. **학습 집중도**: 특정 분야에 편중되어 있는지 확인
3. **학습 공백**: 오랫동안 공부하지 않은 분야
4. **학습 균형**: 시험 출제 비중 대비 학습량 비교

## 시험 출제 비중 (참고용)
- DESIGN: 15-20% (조명설계 필수)
- SEQUENCE: 20-25% (시퀀스 제어 중요)
- LOAD: 15-20% (부하 계산 기본)
- POWER: 20-25% (전력 계산 핵심)
- RENEWABLE: 5-10% (신재생에너지 신규)
- KEC: 10-15% (규정 이해 필수)

## 추천 우선순위
1. HIGH: 출제 비중 높은데 학습량이 적은 분야
2. MEDIUM: 오랫동안 공부하지 않은 분야
3. LOW: 학습량은 있지만 균형이 필요한 분야`;

export const ANALYTICS_USER_PROMPT = `## 학습 패턴 데이터

### 카테고리별 학습 현황
{categoryStats}

### 학습하지 않은 카테고리
{unstudiedCategories}

### 최근 학습 활동 (7일간)
{recentActivity}

### 전체 학습 현황
- 총 학습 문제: {totalQuestions}개
- 연속 학습일: {currentStreak}일
- 오늘 학습: {todayCount}개

---

## 요청
위 데이터를 바탕으로 **학습 패턴**을 분석하여 JSON 형식으로 응답해주세요.

**중요: 학습 패턴에 집중하세요!**
- 어떤 분야를 자주 공부하는지
- 어떤 분야를 덜 공부하는지
- 시험 출제 비중 대비 학습 균형이 맞는지
- 오랫동안 공부하지 않은 분야는 무엇인지

{
  "studyPatterns": [
    {
      "category": "카테고리명",
      "status": "frequent|moderate|rare|never",
      "questionCount": 학습한문제수,
      "studyPercentage": 전체대비비율,
      "examWeight": 시험출제비중,
      "balanceStatus": "과다학습|적정|부족|미학습",
      "lastStudied": "마지막 학습일",
      "recommendation": "이 분야에 대한 학습 추천"
    }
  ],
  "studyBalance": {
    "overStudied": ["과다 학습 분야"],
    "underStudied": ["부족 학습 분야"],
    "balanced": ["균형 잡힌 분야"],
    "neverStudied": ["한번도 학습 안한 분야"]
  },
  "recommendations": [
    {
      "type": "start|increase|maintain|diversify",
      "category": "카테고리명",
      "title": "추천 제목",
      "reason": "추천 이유 (학습 패턴 기반)",
      "suggestedTopics": ["추천 학습 주제1", "주제2"],
      "priority": 1-10
    }
  ],
  "achievements": [
    {
      "type": "streak|coverage|milestone|consistency",
      "title": "성취 제목",
      "description": "성취 설명"
    }
  ],
  "trends": {
    "direction": "expanding|focused|stagnant",
    "summary": "학습 패턴 요약",
    "insights": ["인사이트1", "인사이트2"]
  },
  "studyPlan": {
    "immediate": ["지금 시작해야 할 분야"],
    "thisWeek": ["이번 주 집중해야 할 분야"],
    "balanced": ["균형 잡힌 학습을 위한 제안"]
  },
  "summary": "학습 패턴 종합 분석 (2-3문장)"
}

중요:
- 반드시 JSON 형식으로만 응답
- 학습 **빈도와 패턴**에 집중 (오답/정답 여부가 아님)
- 시험 출제 비중 대비 학습 균형 분석
- 추천은 최대 5개
- 한국어로 작성`;

export interface CategoryStudyData {
  category: string;
  totalQuestions: number;
  lastPracticed: string;
  studyPercentage: number;
}

// 모든 카테고리 목록
const ALL_CATEGORIES = ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'];

// 시험 출제 비중 (대략적)
const EXAM_WEIGHTS: Record<string, number> = {
  'DESIGN': 17.5,      // 15-20%
  'SEQUENCE': 22.5,    // 20-25%
  'LOAD': 17.5,        // 15-20%
  'POWER': 22.5,       // 20-25%
  'RENEWABLE': 7.5,    // 5-10%
  'KEC': 12.5,         // 10-15%
};

export function buildAnalyticsPrompt(data: {
  categoryStats: Array<{
    category: string;
    totalQuestions: number;
    lastPracticed: string;
  }>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
  totalQuestions: number;
  currentStreak: number;
  todayCount: number;
}): string {
  // 카테고리별 학습 현황
  const categoryStatsStr = data.categoryStats.length > 0
    ? data.categoryStats
        .map((s) => {
          const percentage = data.totalQuestions > 0
            ? ((s.totalQuestions / data.totalQuestions) * 100).toFixed(1)
            : '0';
          const examWeight = EXAM_WEIGHTS[s.category] || 10;
          return `- ${s.category}: ${s.totalQuestions}문제 (전체의 ${percentage}%), 시험비중 ${examWeight}%, 마지막 학습 ${s.lastPracticed}`;
        })
        .join('\n')
    : '학습 데이터 없음';

  // 학습하지 않은 카테고리 찾기
  const studiedCategories = new Set(data.categoryStats.map(s => s.category));
  const unstudiedCategories = ALL_CATEGORIES.filter(cat => !studiedCategories.has(cat));
  const unstudiedStr = unstudiedCategories.length > 0
    ? unstudiedCategories.map(cat => `- ${cat}: 아직 학습 기록 없음 (시험비중 ${EXAM_WEIGHTS[cat]}%)`).join('\n')
    : '없음 (모든 카테고리 학습 완료!)';

  // 최근 7일간 활동
  const recentActivityStr = data.recentActivity.length > 0
    ? data.recentActivity
        .slice(0, 7)
        .map(a => `- ${a.date}: ${a.count}문제`)
        .join('\n')
    : '최근 7일간 학습 기록 없음';

  return ANALYTICS_USER_PROMPT
    .replace('{categoryStats}', categoryStatsStr)
    .replace('{unstudiedCategories}', unstudiedStr)
    .replace('{recentActivity}', recentActivityStr)
    .replace('{totalQuestions}', String(data.totalQuestions))
    .replace('{currentStreak}', String(data.currentStreak))
    .replace('{todayCount}', String(data.todayCount));
}
