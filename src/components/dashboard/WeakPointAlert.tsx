/**
 * WeakPointAlert - 학습 패턴 알림 컴포넌트
 *
 * 사용자의 학습 패턴을 분석하여 부족한 분야와 추천을 표시
 */

'use client';

import { AnalyticsInsight } from '@/types/database';
import { AGENTS } from '@/lib/ai/agents';
import { AgentType } from '@/types';

interface WeakPointAlertProps {
  insights: AnalyticsInsight[];
  onDismiss?: (id: string) => void;
}

export function WeakPointAlert({ insights, onDismiss }: WeakPointAlertProps) {
  // 학습 패턴 (미학습/부족 분야)
  const studyPatterns = insights.filter((i) => i.insight_type === 'study_pattern');
  const recommendations = insights.filter((i) => i.insight_type === 'recommendation');

  // 학습 패턴과 추천만 있는 경우만 표시
  if (studyPatterns.length === 0 && recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 학습 패턴 - 부족한 분야 */}
      {studyPatterns.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📊</span>
            <h4 className="font-semibold text-amber-800">학습이 필요한 분야</h4>
          </div>
          <div className="space-y-2">
            {studyPatterns.map((sp) => {
              const agent = sp.category ? AGENTS[sp.category as AgentType] : null;
              const isNeverStudied = sp.title?.includes('시작 필요');
              return (
                <div
                  key={sp.id}
                  className={`flex items-start justify-between bg-white rounded-lg p-3 border ${
                    isNeverStudied ? 'border-rose-200' : 'border-amber-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {agent && (
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        {agent.icon}
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{sp.title}</p>
                        {isNeverStudied && (
                          <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">
                            미학습
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{sp.description}</p>
                    </div>
                  </div>
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(sp.id)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 추천 */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💡</span>
            <h4 className="font-semibold text-blue-800">학습 추천</h4>
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec) => {
              const agent = rec.category ? AGENTS[rec.category as AgentType] : null;
              return (
                <div
                  key={rec.id}
                  className="flex items-start justify-between bg-white rounded-lg p-3 border border-blue-100"
                >
                  <div className="flex items-start gap-3">
                    {agent && (
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        {agent.icon}
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{rec.title}</p>
                      <p className="text-sm text-slate-600">{rec.description}</p>
                    </div>
                  </div>
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(rec.id)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
