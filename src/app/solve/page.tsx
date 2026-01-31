/**
 * Solve Page - 멀티 에이전트 문제 풀이 페이지
 *
 * Features:
 * - 멀티 에이전트 처리 흐름 시각화
 * - 단계별 로딩 상태 표시
 * - 에이전트 경로 추적
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar, Footer } from '@/components/layout';
import { ProblemInput } from '@/components/solve/ProblemInput';
import { SolutionDisplay } from '@/components/solve/SolutionDisplay';
import { AgentFlowIndicator } from '@/components/solve/AgentFlowIndicator';
import { ErrorMessage, Card, CardHeader, CardBody } from '@/components/common';
import { useSolveProblem, useAuth } from '@/hooks';
import { AGENTS } from '@/lib/ai/agents';

export default function SolvePage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const {
    solution,
    metadata,
    isLoading,
    loadingStep,
    error,
    solve,
    reset,
  } = useSolveProblem();

  // 로그인 체크
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirectTo=/solve');
    }
  }, [authLoading, isAuthenticated, router]);

  // Check for pending question from home page
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingQuestion');
    if (pending) {
      sessionStorage.removeItem('pendingQuestion');
      try {
        const { text, image } = JSON.parse(pending);
        if (text || image) {
          solve({ text, imageBase64: image || undefined });
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }, [solve]);

  const handleSubmit = useCallback(
    (input: { text?: string; imageBase64?: string }) => {
      solve(input);
    },
    [solve]
  );

  // 새 문제 풀기 - 상태만 초기화, 페이지 유지
  const handleNewProblem = useCallback(() => {
    reset();
  }, [reset]);

  // 홈으로 이동
  const handleGoHome = useCallback(() => {
    reset();
    router.push('/');
  }, [reset, router]);

  const handleRetry = useCallback(() => {
    if (solution?.question) {
      solve({ text: solution.question });
    }
  }, [solution, solve]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {authLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
              </div>
            ) : isLoading ? (
              <AgentFlowIndicator
                currentStep={loadingStep}
                agentPath={metadata?.agentPath}
                isLoading={isLoading}
              />
            ) : error ? (
              <ErrorMessage
                message={error.message}
                onRetry={() => reset()}
              />
            ) : solution ? (
              <>
                {/* 메타데이터 표시 (멀티 에이전트 모드일 때) */}
                {metadata?.agentPath && (
                  <MetadataCard metadata={metadata} />
                )}
                <SolutionDisplay
                  solution={solution}
                  sessionId={metadata?.sessionId}
                  onRetry={handleRetry}
                  onNewProblem={handleNewProblem}
                  onGoHome={handleGoHome}
                />
              </>
            ) : (
              <ProblemInput onSubmit={handleSubmit} isLoading={isLoading} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Agent List */}
            <Card>
              <CardHeader>전문 에이전트</CardHeader>
              <CardBody className="space-y-3">
                {Object.values(AGENTS).map((agent) => (
                  <AgentItem
                    key={agent.id}
                    agent={agent}
                    isActive={solution?.category === agent.id}
                  />
                ))}
              </CardBody>
            </Card>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Sub-components
function AgentItem({
  agent,
  isActive,
}: {
  agent: (typeof AGENTS)[keyof typeof AGENTS];
  isActive?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
        isActive
          ? 'bg-teal-50 border border-teal-200 shadow-sm'
          : 'hover:bg-slate-50'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
          isActive ? 'scale-110' : ''
        }`}
        style={{ backgroundColor: `${agent.color}${isActive ? '30' : '20'}` }}
      >
        {agent.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{agent.name}</p>
          {isActive && (
            <span className="px-1.5 py-0.5 bg-teal-500 text-white text-[10px] rounded font-semibold">
              활성
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">
          {agent.expertise.slice(0, 3).join(', ')}
        </p>
      </div>
    </div>
  );
}

function MetadataCard({ metadata }: { metadata: { visionTime?: number; solveTime?: number; verifyTime?: number; agentPath?: string[] } }) {
  return (
    <Card className="bg-gradient-to-r from-slate-50 to-white border-slate-200">
      <CardBody className="p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">처리 경로:</span>
            <div className="flex items-center gap-1">
              {metadata.agentPath?.map((step, idx) => (
                <span key={idx}>
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                    {step}
                  </span>
                  {idx < (metadata.agentPath?.length || 0) - 1 && (
                    <span className="mx-1 text-slate-300">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          {metadata.visionTime && (
            <div className="text-slate-500">
              Vision: <span className="font-medium text-slate-700">{metadata.visionTime.toFixed(2)}s</span>
            </div>
          )}
          {metadata.solveTime && (
            <div className="text-slate-500">
              풀이: <span className="font-medium text-slate-700">{metadata.solveTime.toFixed(2)}s</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
