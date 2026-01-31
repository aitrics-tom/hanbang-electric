// 에이전트 타입
export type AgentType =
  | 'DESIGN'      // 전기설비설계
  | 'SEQUENCE'    // 시퀀스/PLC
  | 'LOAD'        // 부하설비
  | 'POWER'       // 전력설비
  | 'RENEWABLE'   // 감리/신재생
  | 'KEC';        // KEC규정

// 에이전트 정보
export interface AgentInfo {
  id: AgentType;
  name: string;
  icon: string;
  color: string;
  expertise: string[];
  description: string;
}

// 풀이 단계
export interface SolutionStep {
  order: number;
  title: string;
  content: string;
  latex?: string;
}

// 검증 결과
export interface VerificationResult {
  isValid: boolean;
  confidence: number;
  checks: {
    calculation: { pass: boolean; notes: string[] };
    formula: { pass: boolean; notes: string[] };
    kec: { pass: boolean; notes: string[] };
    units: { pass: boolean; notes: string[] };
  };
  corrections: string[];
  warnings: string[];
}

// 풀이 응답
export interface SolutionResponse {
  id: string;
  question: string;
  category: AgentType;
  solution: string;
  answer: string;
  steps: SolutionStep[];
  formulas: string[];
  relatedKEC?: string[];
  verification: VerificationResult;
  agents: {
    primary: AgentType;
    secondary: AgentType[];
  };
  processingTime: number;
  createdAt: Date;
}
