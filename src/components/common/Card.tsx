/**
 * Card - 재사용 가능한 Card 컴포넌트
 *
 * Frontend Patterns: Composition Over Inheritance
 */

import React, { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated';
  hover?: boolean;
}

export const Card = memo(function Card({
  children,
  className,
  variant = 'default',
  hover = false,
}: CardProps) {
  const variants = {
    default: 'bg-white border border-slate-200',
    outlined: 'bg-transparent border-2 border-slate-300',
    elevated: 'bg-white shadow-lg border-0',
  };

  return (
    <div
      className={cn(
        'rounded-2xl',
        variants[variant],
        hover && 'transition-all hover:shadow-lg hover:border-teal-200',
        className
      )}
    >
      {children}
    </div>
  );
});

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const CardHeader = memo(function CardHeader({
  children,
  className,
  icon,
  action,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-slate-100 flex justify-between items-center',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-slate-900">{children}</h3>
      </div>
      {action}
    </div>
  );
});

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export const CardBody = memo(function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn('p-6', className)}>{children}</div>;
});
