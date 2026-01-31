/**
 * CategoryChart - 카테고리별 진도 차트
 */

'use client';

import { AgentType } from '@/types';
import { AGENTS } from '@/lib/ai/agents';

interface CategoryStats {
  category: AgentType;
  total_questions: number;
  correct_count: number;
  accuracy_rate: number;
  last_practiced: string;
}

interface CategoryChartProps {
  stats: CategoryStats[];
}

export function CategoryChart({ stats }: CategoryChartProps) {
  // 모든 카테고리 (데이터가 없는 것 포함)
  const allCategories: AgentType[] = ['DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC'];

  const getStatsForCategory = (category: AgentType): CategoryStats | null => {
    return stats.find((s) => s.category === category) || null;
  };

  // 가장 많이 푼 카테고리 기준으로 프로그레스 바 계산
  const maxQuestions = Math.max(...stats.map(s => s.total_questions), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">카테고리별 학습 현황</h3>
      <div className="space-y-4">
        {allCategories.map((category) => {
          const data = getStatsForCategory(category);
          const agent = AGENTS[category];
          const total = data?.total_questions || 0;
          const correct = data?.correct_count || 0;
          const incorrect = (data?.total_questions || 0) - (data?.correct_count || 0);

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${agent.color}20` }}
                  >
                    {agent.icon}
                  </span>
                  <span className="font-medium text-slate-900">{agent.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-slate-900">
                    {total}문제
                  </span>
                  {total > 0 && (
                    <span className="text-slate-400 text-sm ml-1">
                      (정답 {correct} / 오답 {incorrect > 0 ? incorrect : 0})
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-teal-500"
                  style={{ width: `${(total / maxQuestions) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryChartSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
      <div className="h-6 w-40 bg-slate-200 rounded mb-6" />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                <div className="h-4 w-24 bg-slate-200 rounded" />
              </div>
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
            <div className="h-2 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
