/**
 * AnalyticsModal - AI 학습 분석 팝업 컴포넌트
 *
 * 사용자의 학습 패턴을 AI로 분석하여 취약점과 학습 방법을 제시합니다.
 * 가장 많이 질문한 카테고리 = 가장 모르는 분야로 판단합니다.
 */

'use client';

import { useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AGENTS } from '@/lib/ai/agents';
import { AgentType } from '@/types';
import {
  AnalyticsResult,
  StudyPattern,
  Recommendation,
} from '@/hooks/useAnalytics';

interface CategoryStats {
  category: AgentType;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  accuracy_rate: number;
}

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  isGenerating: boolean;
  analytics: AnalyticsResult | null;
  categoryStats: CategoryStats[];
  onGenerateAnalytics: () => Promise<void>;
  onStartStudy?: (category: AgentType) => void;
}

// 카테고리별 학습 팁
const STUDY_TIPS: Record<AgentType, { topics: string[]; method: string }> = {
  DESIGN: {
    topics: ['변압기 용량 계산', '차단기 정격 선정', '전선 굵기 계산', '케이블 허용전류'],
    method: '수변전 설비의 기본 개념을 먼저 정리하고, 용량 계산 공식을 암기한 뒤 다양한 문제를 풀어보세요. 특히 변압기 용량과 차단기 정격은 출제 빈도가 높습니다.',
  },
  SEQUENCE: {
    topics: ['릴레이 회로 해석', 'PLC 래더 다이어그램', '타이머/카운터 응용', '자기유지회로'],
    method: '시퀀스 제어는 회로도를 직접 그려보며 학습하는 것이 효과적입니다. 기본 회로(자기유지, 인터록)를 완벽히 이해한 뒤 복잡한 회로로 확장해 나가세요.',
  },
  LOAD: {
    topics: ['역률 개선 계산', '조명 설계', '전동기 기동법', '축전지 용량'],
    method: '부하설비는 공식 암기가 중요합니다. 역률 개선 콘덴서 용량, 조명 설계 계산식을 반복 학습하고, 단위 변환에 주의하세요.',
  },
  POWER: {
    topics: ['송전선 전력손실', '단락전류 계산', '전압강하 계산', '고장계산'],
    method: '전력설비는 %임피던스법과 대칭좌표법을 확실히 이해해야 합니다. 단락용량, 전압강하 공식을 외우고 다양한 계통 조건에서 연습하세요.',
  },
  RENEWABLE: {
    topics: ['태양광 발전 용량', 'ESS 설계', '인버터 선정', '신재생에너지 관련 규정'],
    method: '신재생에너지는 최신 기술 동향과 KEC 규정을 함께 학습하세요. 태양광 모듈 직병렬 계산과 인버터 용량 산정이 자주 출제됩니다.',
  },
  KEC: {
    topics: ['접지 시스템(TT, TN, IT)', '누전차단기 선정', '배선 규정', '안전 기준'],
    method: 'KEC는 조문 번호와 핵심 내용을 연결해서 암기하세요. 특히 접지 시스템 종류별 특징과 누전차단기 설치 기준은 필수입니다.',
  },
};

// 카테고리 한글 이름
const CATEGORY_NAMES: Record<AgentType, string> = {
  DESIGN: '수변전 설비',
  SEQUENCE: '시퀀스 제어',
  LOAD: '부하설비',
  POWER: '전력설비',
  RENEWABLE: '신재생에너지',
  KEC: 'KEC 규정',
};

export function AnalyticsModal({
  open,
  onClose,
  isGenerating,
  analytics,
  categoryStats,
  onGenerateAnalytics,
  onStartStudy,
}: AnalyticsModalProps) {
  // 모달 열릴 때 분석 시작
  useEffect(() => {
    if (open && !analytics && !isGenerating) {
      onGenerateAnalytics();
    }
  }, [open, analytics, isGenerating, onGenerateAnalytics]);

  // 로컬 분석 (AI 분석이 없을 때 폴백)
  const localAnalysis = useMemo(() => {
    if (!categoryStats || categoryStats.length === 0) {
      return null;
    }

    // 질문 수 기준 정렬 (내림차순)
    const sorted = [...categoryStats].sort((a, b) => b.total_questions - a.total_questions);
    const totalQuestions = sorted.reduce((sum, s) => sum + s.total_questions, 0);

    // 가장 많이 질문한 카테고리 (상위 3개)
    const topCategories = sorted.slice(0, 3).filter(s => s.total_questions > 0);

    // 아직 학습하지 않은 카테고리
    const allCategories: AgentType[] = ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'];
    const studiedCategories = new Set(categoryStats.map(s => s.category));
    const notStudied = allCategories.filter(c => !studiedCategories.has(c) ||
      (categoryStats.find(s => s.category === c)?.total_questions || 0) === 0);

    return {
      topCategories,
      totalQuestions,
      notStudied,
      primary: topCategories[0] || null,
    };
  }, [categoryStats]);

  // AI 분석 결과를 줄글로 변환
  const generateAIAnalysisText = (): string => {
    if (!analytics) return '';

    const { studyPatterns, studyBalance, recommendations, trends, summary } = analytics;

    let text = '';

    // 1. 전체 요약
    if (summary) {
      text += summary + '\n\n';
    }

    // 2. 취약 분야 분석 (가장 많이 질문한 = 취약한 분야)
    const weakPatterns = studyPatterns
      .filter(p => p.balanceStatus === '부족' || p.questionCount > 0)
      .sort((a, b) => b.questionCount - a.questionCount);

    if (weakPatterns.length > 0) {
      const primary = weakPatterns[0];
      const agent = AGENTS[primary.category];
      const tips = STUDY_TIPS[primary.category];

      text += `📌 분석 결과, ${agent.name} 분야에서 가장 많은 문제(${primary.questionCount}개)를 풀어보셨습니다. `;
      text += `이는 해당 분야에 대한 이해도가 상대적으로 부족하다는 신호입니다. `;
      text += `${CATEGORY_NAMES[primary.category]} 분야는 시험에서 약 ${primary.examWeight}%의 비중을 차지하므로 집중적인 학습이 필요합니다.\n\n`;

      text += `💡 학습 방법: ${tips.method}\n\n`;
      text += `📚 핵심 학습 주제: ${tips.topics.join(', ')}\n\n`;
    }

    // 3. 미학습 분야 경고
    if (studyBalance.neverStudied.length > 0) {
      text += `⚠️ 주의! 다음 분야는 아직 한 번도 학습하지 않으셨습니다: `;
      text += studyBalance.neverStudied.map(cat => CATEGORY_NAMES[cat as AgentType] || cat).join(', ');
      text += `. 전기기사 실기 시험은 모든 분야에서 고르게 출제되므로, 이 분야들도 반드시 학습해주세요!\n\n`;
    }

    // 4. 부족한 분야
    if (studyBalance.underStudied.length > 0) {
      text += `📉 학습량이 부족한 분야: `;
      text += studyBalance.underStudied.map(cat => CATEGORY_NAMES[cat as AgentType] || cat).join(', ');
      text += `. 시험 비중 대비 학습량이 적으니 추가 학습을 권장합니다.\n\n`;
    }

    // 5. AI 추천사항
    if (recommendations.length > 0) {
      text += `🎯 AI 학습 추천:\n`;
      recommendations.slice(0, 3).forEach((rec, i) => {
        text += `${i + 1}. ${rec.title}: ${rec.reason}`;
        if (rec.suggestedTopics && rec.suggestedTopics.length > 0) {
          text += ` (추천 주제: ${rec.suggestedTopics.join(', ')})`;
        }
        text += '\n';
      });
      text += '\n';
    }

    // 6. 학습 트렌드
    if (trends) {
      const trendText = trends.direction === 'expanding' ? '학습 범위를 넓혀가고 있습니다'
        : trends.direction === 'focused' ? '특정 분야에 집중하고 있습니다'
        : '학습 활동이 정체되어 있습니다';
      text += `📊 학습 트렌드: ${trendText}. ${trends.summary}\n`;
    }

    return text;
  };

  // 폴백 분석 텍스트 (AI 분석 없을 때)
  const generateFallbackText = (): string => {
    if (!localAnalysis || !localAnalysis.primary) {
      return '아직 학습 데이터가 부족합니다. 문제를 더 풀어보시면 학습 패턴을 분석해드릴 수 있어요. 다양한 분야의 문제를 풀어보세요!';
    }

    const { topCategories, totalQuestions, notStudied, primary } = localAnalysis;
    const primaryAgent = AGENTS[primary.category];
    const tips = STUDY_TIPS[primary.category];

    let text = `지금까지 총 ${totalQuestions}개의 문제를 풀어보셨네요. `;
    text += `분석 결과, ${primaryAgent.name} 분야에서 가장 많은 질문(${primary.total_questions}개)을 하셨습니다. `;
    text += `이는 해당 분야에 대한 이해가 부족하다는 신호일 수 있어요.\n\n`;

    text += `💡 ${primaryAgent.name} 분야 학습 방법:\n${tips.method}\n\n`;
    text += `📚 핵심 학습 주제: ${tips.topics.join(', ')}\n\n`;

    if (topCategories.length > 1) {
      text += `📌 추가로 보강이 필요한 분야:\n`;
      topCategories.slice(1).forEach(cat => {
        const agent = AGENTS[cat.category];
        text += `• ${agent.name} (${cat.total_questions}개 질문)\n`;
      });
      text += '\n';
    }

    if (notStudied.length > 0) {
      text += `⚠️ 아직 학습하지 않은 분야:\n`;
      notStudied.forEach(cat => {
        const agent = AGENTS[cat];
        text += `• ${agent.name}\n`;
      });
      text += '\n시험에서 고르게 출제되므로, 이 분야들도 반드시 학습해주세요!';
    }

    return text;
  };

  // 분석 텍스트 결정
  const analysisText = analytics ? generateAIAnalysisText() : generateFallbackText();

  // 가장 취약한 카테고리 결정
  const primaryCategory: AgentType | null = useMemo(() => {
    if (analytics?.studyPatterns && analytics.studyPatterns.length > 0) {
      const sorted = [...analytics.studyPatterns].sort((a, b) => b.questionCount - a.questionCount);
      return sorted[0]?.category || null;
    }
    return localAnalysis?.primary?.category || null;
  }, [analytics, localAnalysis]);

  const primaryAgent = primaryCategory ? AGENTS[primaryCategory] : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            🔍 AI 학습 분석 결과
          </DialogTitle>
          <DialogDescription>
            질문 패턴을 분석하여 취약 분야와 맞춤형 학습 방법을 제안합니다
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-6" />
              <p className="text-lg font-medium text-slate-700">AI가 학습 패턴을 분석하고 있습니다...</p>
              <p className="text-sm text-slate-500 mt-2">잠시만 기다려주세요 (약 5-10초 소요)</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 분석 요약 헤더 */}
              {primaryAgent && (
                <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl p-5 border border-teal-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${primaryAgent.color}20` }}
                    >
                      {primaryAgent.icon}
                    </span>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">
                        {primaryAgent.name} 분야 집중 학습 권장
                      </h3>
                      <p className="text-sm text-slate-600">
                        가장 많이 질문한 분야 = 가장 보강이 필요한 분야
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 상세 분석 내용 (줄글) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span>📝</span> 상세 분석
                </h4>
                <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {analysisText}
                </div>
              </div>

              {/* 카테고리별 질문 분포 */}
              {localAnalysis && localAnalysis.topCategories.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-5">
                  <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span>📊</span> 카테고리별 질문 분포
                  </h4>
                  <div className="space-y-3">
                    {localAnalysis.topCategories.map((cat) => {
                      const agent = AGENTS[cat.category];
                      const percentage = localAnalysis.totalQuestions > 0
                        ? (cat.total_questions / localAnalysis.totalQuestions * 100).toFixed(0)
                        : 0;
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <span
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: `${agent.color}20` }}
                          >
                            {agent.icon}
                          </span>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-slate-700">{agent.name}</span>
                              <span className="text-slate-500">{cat.total_questions}개 ({percentage}%)</span>
                            </div>
                            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: agent.color,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 성취 배지 */}
              {analytics?.achievements && analytics.achievements.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <span>🏆</span> 달성한 성취
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analytics.achievements.map((ach, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
                      >
                        {ach.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-3">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          {!isGenerating && (
            <Button
              variant="outline"
              onClick={onGenerateAnalytics}
              className="text-teal-600 border-teal-200 hover:bg-teal-50"
            >
              다시 분석
            </Button>
          )}
          {primaryCategory && onStartStudy && !isGenerating && (
            <Button
              onClick={() => {
                onStartStudy(primaryCategory);
                onClose();
              }}
              className="bg-teal-500 hover:bg-teal-600"
            >
              {AGENTS[primaryCategory].name} 학습하러 가기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
