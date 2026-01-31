'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Flame } from 'lucide-react';

interface DdayWidgetProps {
  examDate?: Date;
  streak?: number;
}

export function DdayWidget({ examDate, streak = 0 }: DdayWidgetProps) {
  // 기본 시험일: 2025년 5월 시험
  const targetDate = examDate || new Date('2025-05-10');
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          {/* D-day */}
          <div className="flex-1 p-4 bg-primary/5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">전기기사 실기</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-primary">D-{diffDays}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {targetDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* 연속 학습 */}
          <div className="flex-1 p-4 border-l">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm">연속 학습</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{streak}</span>
              <span className="text-sm text-muted-foreground">일</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {streak > 0 ? '잘 하고 있어요!' : '오늘 시작해보세요!'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
