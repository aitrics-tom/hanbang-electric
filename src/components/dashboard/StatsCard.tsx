/**
 * StatsCard - 통계 카드 컴포넌트
 */

'use client';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  color?: 'teal' | 'blue' | 'amber' | 'rose' | 'purple';
}

const colorClasses = {
  teal: 'bg-teal-50 text-teal-600 border-teal-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  rose: 'bg-rose-50 text-rose-600 border-rose-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
};

const iconBgClasses = {
  teal: 'bg-teal-100',
  blue: 'bg-blue-100',
  amber: 'bg-amber-100',
  rose: 'bg-rose-100',
  purple: 'bg-purple-100',
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'teal',
}: StatsCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 text-sm">
              <span
                className={
                  trend.direction === 'up'
                    ? 'text-green-600'
                    : trend.direction === 'down'
                    ? 'text-red-600'
                    : 'text-slate-500'
                }
              >
                {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                {trend.value}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-xl ${iconBgClasses[color]} flex items-center justify-center text-2xl`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-slate-200 rounded" />
          <div className="h-8 w-16 bg-slate-200 rounded" />
          <div className="h-3 w-24 bg-slate-100 rounded" />
        </div>
        <div className="w-12 h-12 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}
