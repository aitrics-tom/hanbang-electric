'use client';

import { Header } from '@/components/layout/Header';
import { DdayWidget } from '@/components/dashboard/DdayWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AGENTS } from '@/lib/ai/agents';
import { TrendingUp, BookOpen, Target, Clock } from 'lucide-react';

export default function DashboardPage() {
  // 데모 데이터
  const stats = {
    totalSolved: 127,
    todaySolved: 8,
    streak: 5,
    accuracy: 78,
  };

  const categoryStats = [
    { id: 'LOAD', count: 35, accuracy: 82 },
    { id: 'DESIGN', count: 28, accuracy: 75 },
    { id: 'SEQUENCE', count: 24, accuracy: 71 },
    { id: 'KEC', count: 18, accuracy: 85 },
    { id: 'POWER', count: 14, accuracy: 79 },
    { id: 'RENEWABLE', count: 8, accuracy: 88 },
  ];

  const recentSolutions = [
    { title: '조명 등수 계산', category: 'LOAD', time: '2시간 전', correct: true },
    { title: '변압기 용량 산정', category: 'DESIGN', time: '3시간 전', correct: true },
    { title: 'PLC 래더 다이어그램', category: 'SEQUENCE', time: '어제', correct: false },
    { title: '접지저항 계산', category: 'KEC', time: '어제', correct: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">대시보드</h1>
          <p className="text-muted-foreground">학습 현황을 확인하세요</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* 왼쪽: 통계 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<BookOpen className="h-5 w-5" />}
                label="총 풀이"
                value={stats.totalSolved}
                suffix="문제"
              />
              <StatCard
                icon={<Target className="h-5 w-5" />}
                label="오늘"
                value={stats.todaySolved}
                suffix="문제"
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="정답률"
                value={stats.accuracy}
                suffix="%"
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                label="연속 학습"
                value={stats.streak}
                suffix="일"
              />
            </div>

            {/* 과목별 현황 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">과목별 현황</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoryStats.map((stat) => {
                  const agent = AGENTS[stat.id as keyof typeof AGENTS];
                  return (
                    <div key={stat.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{agent.icon}</span>
                          <span className="font-medium">{agent.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {stat.count}문제
                          </span>
                          <Badge
                            variant={stat.accuracy >= 80 ? 'default' : 'secondary'}
                          >
                            {stat.accuracy}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={stat.accuracy} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 최근 풀이 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">최근 풀이</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSolutions.map((sol, i) => {
                    const agent = AGENTS[sol.category as keyof typeof AGENTS];
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: `${agent.color}20` }}
                          >
                            {agent.icon}
                          </div>
                          <div>
                            <p className="font-medium">{sol.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.name} · {sol.time}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={sol.correct ? 'default' : 'destructive'}
                        >
                          {sol.correct ? '정답' : '오답'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-6">
            <DdayWidget streak={stats.streak} />

            {/* 학습 목표 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">오늘의 목표</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>문제 풀이</span>
                    <span className="text-muted-foreground">
                      {stats.todaySolved}/10
                    </span>
                  </div>
                  <Progress value={(stats.todaySolved / 10) * 100} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>정답률</span>
                    <span className="text-muted-foreground">
                      {stats.accuracy}%/80%
                    </span>
                  </div>
                  <Progress value={(stats.accuracy / 80) * 100} />
                </div>
              </CardContent>
            </Card>

            {/* 추천 학습 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">추천 학습</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span>⚡</span>
                    <span className="font-medium text-sm">시퀀스/PLC</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    정답률이 낮습니다. 복습을 추천드려요.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span>📋</span>
                    <span className="font-medium text-sm">KEC규정</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    최근 풀이가 없습니다. 연습해보세요.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-sm text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}
