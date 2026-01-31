/**
 * Agent Classification Tests
 * TDD: Tests written FIRST before implementation verification
 */
import { describe, it, expect } from 'vitest';
import { classifyQuestion, AGENTS, AGENT_KEYWORDS } from './index';
import type { AgentType } from '@/types';

describe('Agent Classification Module', () => {
  describe('AGENTS constant', () => {
    it('should define all 6 agent types', () => {
      const agentTypes: AgentType[] = ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'];

      for (const type of agentTypes) {
        expect(AGENTS[type]).toBeDefined();
        expect(AGENTS[type].id).toBe(type);
      }
    });

    it('should have required properties for each agent', () => {
      for (const agent of Object.values(AGENTS)) {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('icon');
        expect(agent).toHaveProperty('color');
        expect(agent).toHaveProperty('expertise');
        expect(agent).toHaveProperty('description');
        expect(Array.isArray(agent.expertise)).toBe(true);
        expect(agent.expertise.length).toBeGreaterThan(0);
      }
    });

    it('should have valid color hex codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      for (const agent of Object.values(AGENTS)) {
        expect(agent.color).toMatch(hexColorRegex);
      }
    });
  });

  describe('AGENT_KEYWORDS constant', () => {
    it('should define keywords for all 6 agent types', () => {
      const agentTypes: AgentType[] = ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'];

      for (const type of agentTypes) {
        expect(AGENT_KEYWORDS[type]).toBeDefined();
        expect(Array.isArray(AGENT_KEYWORDS[type])).toBe(true);
        expect(AGENT_KEYWORDS[type].length).toBeGreaterThan(0);
      }
    });

    it('should have Korean keywords for electrical engineering domains', () => {
      // DESIGN keywords
      expect(AGENT_KEYWORDS.DESIGN).toContain('변압기');
      expect(AGENT_KEYWORDS.DESIGN).toContain('차단기');
      expect(AGENT_KEYWORDS.DESIGN).toContain('케이블');

      // SEQUENCE keywords
      expect(AGENT_KEYWORDS.SEQUENCE).toContain('릴레이');
      expect(AGENT_KEYWORDS.SEQUENCE).toContain('PLC');
      expect(AGENT_KEYWORDS.SEQUENCE).toContain('시퀀스');

      // LOAD keywords
      expect(AGENT_KEYWORDS.LOAD).toContain('조명');
      expect(AGENT_KEYWORDS.LOAD).toContain('역률');
      expect(AGENT_KEYWORDS.LOAD).toContain('콘덴서');

      // POWER keywords
      expect(AGENT_KEYWORDS.POWER).toContain('송전');
      expect(AGENT_KEYWORDS.POWER).toContain('배전');
      expect(AGENT_KEYWORDS.POWER).toContain('단락전류');

      // RENEWABLE keywords
      expect(AGENT_KEYWORDS.RENEWABLE).toContain('태양광');
      expect(AGENT_KEYWORDS.RENEWABLE).toContain('ESS');
      expect(AGENT_KEYWORDS.RENEWABLE).toContain('인버터');

      // KEC keywords
      expect(AGENT_KEYWORDS.KEC).toContain('접지');
      expect(AGENT_KEYWORDS.KEC).toContain('TT');
      expect(AGENT_KEYWORDS.KEC).toContain('누전차단기');
    });
  });

  describe('classifyQuestion function', () => {
    describe('DESIGN agent classification', () => {
      it('should classify transformer questions as DESIGN', () => {
        const result = classifyQuestion('변압기 용량 500kVA를 선정하려고 합니다');

        expect(result.primary).toBe('DESIGN');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should classify cable sizing questions as DESIGN', () => {
        const result = classifyQuestion('케이블 단면적 선정 방법을 알려주세요');

        expect(result.primary).toBe('DESIGN');
      });

      it('should classify circuit breaker questions as DESIGN', () => {
        const result = classifyQuestion('VCB 차단기의 정격전류를 계산하시오');

        expect(result.primary).toBe('DESIGN');
      });
    });

    describe('SEQUENCE agent classification', () => {
      it('should classify PLC questions as SEQUENCE', () => {
        const result = classifyQuestion('PLC 래더 다이어그램을 작성하시오');

        expect(result.primary).toBe('SEQUENCE');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should classify relay questions as SEQUENCE', () => {
        const result = classifyQuestion('릴레이 타이머를 이용한 자기유지 회로');

        expect(result.primary).toBe('SEQUENCE');
      });

      it('should classify sequence control questions as SEQUENCE', () => {
        const result = classifyQuestion('시퀀스 회로에서 인터록 동작 원리');

        expect(result.primary).toBe('SEQUENCE');
      });
    });

    describe('LOAD agent classification', () => {
      it('should classify lighting calculation questions as LOAD', () => {
        const result = classifyQuestion('조명 설계에서 평균 조도 500lux를 얻기 위한 등수');

        expect(result.primary).toBe('LOAD');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should classify power factor questions as LOAD', () => {
        const result = classifyQuestion('역률 개선을 위한 콘덴서 용량 계산');

        expect(result.primary).toBe('LOAD');
      });

      it('should classify motor questions as LOAD', () => {
        const result = classifyQuestion('전동기 축전지 용량 산정');

        expect(result.primary).toBe('LOAD');
      });
    });

    describe('POWER agent classification', () => {
      it('should classify transmission questions as POWER', () => {
        const result = classifyQuestion('송전 선로의 전력손실 계산');

        expect(result.primary).toBe('POWER');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should classify short circuit questions as POWER', () => {
        const result = classifyQuestion('단락전류 계산과 %Z 임피던스');

        expect(result.primary).toBe('POWER');
      });

      it('should classify distribution questions as POWER', () => {
        const result = classifyQuestion('배전 계통의 고장계산 방법');

        expect(result.primary).toBe('POWER');
      });
    });

    describe('RENEWABLE agent classification', () => {
      it('should classify solar questions as RENEWABLE', () => {
        const result = classifyQuestion('태양광 발전소의 일사량에 따른 발전량');

        expect(result.primary).toBe('RENEWABLE');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should classify ESS questions as RENEWABLE', () => {
        const result = classifyQuestion('ESS 인버터 용량 설계');

        expect(result.primary).toBe('RENEWABLE');
      });

      it('should classify supervision questions as RENEWABLE', () => {
        const result = classifyQuestion('전기공사 감리 업무 범위');

        expect(result.primary).toBe('RENEWABLE');
      });
    });

    describe('KEC agent classification', () => {
      it('should classify grounding questions as KEC', () => {
        const result = classifyQuestion('접지저항 측정 방법과 KEC 규정');

        expect(result.primary).toBe('KEC');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should classify TT/TN system questions as KEC', () => {
        const result = classifyQuestion('TT 계통과 TN 계통의 차이점');

        expect(result.primary).toBe('KEC');
      });

      it('should classify RCD questions as KEC', () => {
        const result = classifyQuestion('누전차단기 감전 보호 원리');

        expect(result.primary).toBe('KEC');
      });
    });

    describe('Edge cases and fallback behavior', () => {
      it('should return DESIGN as default when no keywords match', () => {
        const result = classifyQuestion('이것은 관련없는 질문입니다');

        expect(result.primary).toBe('DESIGN');
        expect(result.confidence).toBe(0.5);
        expect(result.secondary).toEqual([]);
      });

      it('should handle empty string input', () => {
        const result = classifyQuestion('');

        expect(result.primary).toBe('DESIGN');
        expect(result.confidence).toBe(0.5);
      });

      it('should be case-insensitive for English keywords', () => {
        const result1 = classifyQuestion('PLC 프로그래밍');
        const result2 = classifyQuestion('plc 프로그래밍');

        expect(result1.primary).toBe(result2.primary);
      });

      it('should add KEC to secondary when KEC keywords appear with other domains', () => {
        // Question with both DESIGN and KEC keywords
        const result = classifyQuestion('변압기 접지 설계');

        // Primary should be the more dominant one
        expect(['DESIGN', 'KEC']).toContain(result.primary);

        // If primary is not KEC, secondary should include KEC
        if (result.primary !== 'KEC') {
          expect(result.secondary).toContain('KEC');
        }
      });
    });

    describe('Confidence scoring', () => {
      it('should have higher or equal confidence with more matching keywords', () => {
        const singleKeyword = classifyQuestion('변압기');
        const multipleKeywords = classifyQuestion('변압기 차단기 케이블 용량 수변전');

        // More keywords should give higher or equal confidence (capped at 0.95)
        expect(multipleKeywords.confidence).toBeGreaterThanOrEqual(singleKeyword.confidence);
      });

      it('should cap confidence at 0.95', () => {
        // Use many matching keywords
        const result = classifyQuestion(
          '변압기 차단기 단로기 전선굵기 케이블 용량 수변전 정격전류 허용전류'
        );

        expect(result.confidence).toBeLessThanOrEqual(0.95);
      });

      it('should have minimum confidence of 0.5 for matches', () => {
        const result = classifyQuestion('변압기');

        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    describe('Multi-domain questions', () => {
      it('should select primary based on highest keyword count', () => {
        // LOAD has more keywords: 조명, 조도, 역률
        // DESIGN has fewer: 변압기
        const result = classifyQuestion('조명 조도 역률 변압기');

        expect(result.primary).toBe('LOAD');
      });

      it('should handle questions spanning multiple domains', () => {
        const result = classifyQuestion('태양광 인버터와 PLC 시퀀스 제어');

        // Should pick one as primary
        expect(['RENEWABLE', 'SEQUENCE']).toContain(result.primary);
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });

    describe('Real exam question scenarios', () => {
      it('should classify lighting calculation exam question correctly', () => {
        const question = `바닥 면적이 200m2인 사무실에 평균 조도 500lx를 얻고자 한다.
광원의 광속이 3000lm이고, 조명률 0.6, 감광보상률 1.3일 때 필요한 등 수는?`;

        const result = classifyQuestion(question);

        expect(result.primary).toBe('LOAD');
        expect(result.confidence).toBeGreaterThan(0.7);
      });

      it('should classify transformer capacity exam question correctly', () => {
        const question = '수변전 설비에서 변압기 용량 500kVA, 역률 0.8일 때 2차측 정격전류를 구하시오';

        const result = classifyQuestion(question);

        // Could be DESIGN or LOAD due to keywords
        expect(['DESIGN', 'LOAD']).toContain(result.primary);
      });

      it('should classify grounding system exam question correctly', () => {
        const question = 'TN-C-S 계통에서 보호접지와 누전차단기의 협조에 대해 설명하시오';

        const result = classifyQuestion(question);

        expect(result.primary).toBe('KEC');
      });
    });
  });
});
