/**
 * AgentFlowIndicator - 멀티 에이전트 처리 흐름 표시
 *
 * 사용자에게 현재 처리 단계를 시각적으로 보여줍니다.
 */

'use client';

import React, { memo } from 'react';
import {
  Eye,
  GitBranch,
  Sparkles,
  CheckCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { LoadingStep, LOADING_MESSAGES } from '@/hooks/useSolveProblem';
import { cn } from '@/lib/utils';

interface AgentFlowIndicatorProps {
  currentStep: LoadingStep;
  agentPath?: string[];
  isLoading: boolean;
}

const STEPS = [
  { id: 'analyzing', label: 'Vision 분석', icon: Eye, description: 'OCR + 회로 인식' },
  { id: 'routing', label: '에이전트 라우팅', icon: GitBranch, description: '전문가 선택' },
  { id: 'solving', label: '풀이 생성', icon: Sparkles, description: '단계별 풀이' },
  { id: 'verifying', label: '검증', icon: CheckCircle, description: '정확성 확인' },
] as const;

export const AgentFlowIndicator = memo(function AgentFlowIndicator({
  currentStep,
  agentPath,
  isLoading,
}: AgentFlowIndicatorProps) {
  if (currentStep === 'idle' || currentStep === 'complete' || currentStep === 'error') {
    return null;
  }

  const getCurrentStepIndex = () => {
    const idx = STEPS.findIndex((s) => s.id === currentStep);
    return idx >= 0 ? idx : 0;
  };

  const currentIdx = getCurrentStepIndex();

  return (
    <div className="w-full bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full animate-pulse" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">멀티 에이전트 처리 중</h3>
          <p className="text-sm text-slate-500">{LOADING_MESSAGES[currentStep]}</p>
        </div>
      </div>

      {/* 단계 표시 */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentIdx;
          const isComplete = index < currentIdx;
          const isPending = index > currentIdx;

          return (
            <React.Fragment key={step.id}>
              {/* 단계 */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300',
                    isActive && 'bg-teal-500 text-white shadow-lg shadow-teal-200 scale-110',
                    isComplete && 'bg-teal-100 text-teal-600',
                    isPending && 'bg-slate-100 text-slate-400'
                  )}
                >
                  {isActive ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isComplete ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isActive && 'text-teal-600',
                      isComplete && 'text-teal-600',
                      isPending && 'text-slate-400'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-400">{step.description}</p>
                </div>
              </div>

              {/* 연결선 */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 px-2">
                  <div
                    className={cn(
                      'h-0.5 rounded-full transition-all duration-500',
                      index < currentIdx ? 'bg-teal-400' : 'bg-slate-200'
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 에이전트 경로 (있는 경우) */}
      {agentPath && agentPath.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="font-medium">Agent Path:</span>
            {agentPath.map((agent, idx) => (
              <React.Fragment key={idx}>
                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                  {agent}
                </span>
                {idx < agentPath.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * 간단한 로딩 스피너 (컴팩트 버전)
 */
export const CompactLoadingIndicator = memo(function CompactLoadingIndicator({
  step,
}: {
  step: LoadingStep;
}) {
  if (step === 'idle') return null;

  return (
    <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-xl border border-teal-100">
      <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
      <span className="text-sm text-teal-700 font-medium">
        {LOADING_MESSAGES[step]}
      </span>
    </div>
  );
});
