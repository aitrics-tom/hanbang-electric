/**
 * Dashboard Page - 학습 대시보드 (Supabase 연동)
 *
 * Features:
 * - 실시간 학습 통계
 * - 카테고리별 진도
 * - AI 기반 취약점 분석
 * - 질문 이력
 */

'use client';

// Force dynamic rendering - this page uses Supabase auth
export const dynamic = 'force-dynamic';

import React, { Suspense, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar, Footer } from '@/components/layout';
import { Card, CardHeader, CardBody } from '@/components/common';
import { StatsCard, StatsCardSkeleton } from '@/components/dashboard/StatsCard';
import { CategoryChart, CategoryChartSkeleton } from '@/components/dashboard/CategoryChart';
import { WeakPointAlert } from '@/components/dashboard/WeakPointAlert';
import { AnalyticsModal } from '@/components/dashboard/AnalyticsModal';
import { HistoryList, HistoryListSkeleton } from '@/components/dashboard/HistoryList';
import { useAuth } from '@/hooks/useAuth';
import { useStats } from '@/hooks/useStats';
import { useQuestionHistory } from '@/hooks/useQuestionHistory';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { stats, isLoading: statsLoading, error: statsError, refresh: refreshStats } = useStats();
  const {
    sessions,
    hasMore,
    isLoading: historyLoading,
    loadMore,
    deleteSession,
    updateSessionFeedback,
  } = useQuestionHistory({ limit: 10 });
  const {
    analytics,
    savedInsights,
    isLoading: analyticsLoading,
    isGenerating,
    generateAnalytics,
    dismissInsight,
  } = useAnalytics();

  // AI 학습 분석 모달 상태
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // 세션 삭제 후 통계 갱신
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const success = await deleteSession(sessionId);
    if (success) {
      // 삭제 성공 시 통계도 갱신
      await refreshStats();
    }
  }, [deleteSession, refreshStats]);

  // 피드백 업데이트 후 통계 갱신
  const handleFeedbackUpdate = useCallback((sessionId: string, isCorrect: boolean) => {
    updateSessionFeedback(sessionId, isCorrect);
    // 통계도 갱신 (정답/오답 수가 변경됨)
    refreshStats();
  }, [updateSessionFeedback, refreshStats]);

  // 로그인 체크
  if (!authLoading && !isAuthenticated) {
    router.push('/login?redirectTo=/dashboard');
    return null;
  }

  const isLoading = authLoading || statsLoading;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">학습 대시보드</h1>
            <p className="text-slate-600 mt-1">
              {user?.user_metadata?.full_name || user?.email}님의 학습 현황
            </p>
          </div>
          <button
            onClick={() => setShowAnalyticsModal(true)}
            disabled={isGenerating}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>🔍</span>
            AI 학습 분석
          </button>
        </div>

        {/* Error State */}
        {statsError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {statsError}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatsCard
                title="총 풀이"
                value={stats?.totalQuestions || 0}
                subtitle="문제"
                icon="📚"
                color="teal"
              />
              <StatsCard
                title="오늘"
                value={stats?.todayCount || 0}
                subtitle={`/ ${stats?.dailyGoal || 10} 목표`}
                icon="🎯"
                color="blue"
              />
              <StatsCard
                title="연속 학습"
                value={stats?.currentStreak || 0}
                subtitle={`최장 ${stats?.longestStreak || 0}일`}
                icon="🔥"
                color="purple"
              />
            </>
          )}
        </div>

        {/* AI Insights */}
        {!analyticsLoading && savedInsights.length > 0 && (
          <WeakPointAlert
            insights={savedInsights}
            onDismiss={dismissInsight}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Category Chart */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <CategoryChartSkeleton />
            ) : (
              <CategoryChart stats={stats?.categoryStats || []} />
            )}
          </div>

          {/* Learning Goal & Quick Actions */}
          <div className="space-y-6">
            {/* Daily Progress */}
            <Card>
              <CardHeader>오늘의 학습 목표</CardHeader>
              <CardBody className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">문제 학습</span>
                    <span className="font-bold text-teal-700">
                      {stats?.todayCount || 0}/{stats?.dailyGoal || 10}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          ((stats?.todayCount || 0) / (stats?.dailyGoal || 10)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => router.push('/solve')}
                  className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                >
                  학습하러 가기
                </button>
              </CardBody>
            </Card>

            {/* Activity Heatmap */}
            {stats?.recentActivity && stats.recentActivity.length > 0 && (
              <Card>
                <CardHeader>최근 7일 활동</CardHeader>
                <CardBody>
                  <div className="flex justify-between">
                    {stats.recentActivity.map((day) => (
                      <div key={day.date} className="text-center">
                        <div
                          className={`w-8 h-8 rounded-lg mb-1 flex items-center justify-center text-xs font-medium ${
                            day.count >= 10
                              ? 'bg-teal-500 text-white'
                              : day.count >= 5
                              ? 'bg-teal-300 text-teal-800'
                              : day.count > 0
                              ? 'bg-teal-100 text-teal-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {day.count}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(day.date).toLocaleDateString('ko-KR', { weekday: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>

        {/* Question History */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">최근 풀이 이력</h2>
          {historyLoading && sessions.length === 0 ? (
            <HistoryListSkeleton />
          ) : (
            <HistoryList
              sessions={sessions}
              hasMore={hasMore}
              isLoading={historyLoading}
              onLoadMore={loadMore}
              onDelete={handleDeleteSession}
              onFeedbackUpdate={handleFeedbackUpdate}
            />
          )}
        </div>
      </main>

      <Footer />

      {/* AI 학습 분석 모달 */}
      <AnalyticsModal
        open={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        isGenerating={isGenerating}
        analytics={analytics}
        categoryStats={stats?.categoryStats || []}
        onGenerateAnalytics={generateAnalytics}
        onStartStudy={(category) => {
          router.push(`/solve?category=${category}`);
        }}
      />
    </div>
  );
}
