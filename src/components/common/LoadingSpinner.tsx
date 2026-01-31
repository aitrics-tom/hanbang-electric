/**
 * LoadingSpinner - 로딩 스피너 컴포넌트
 */

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
  subMessage?: string;
}

export const LoadingSpinner = memo(function LoadingSpinner({
  size = 'md',
  className,
  message,
  subMessage,
}: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-4', className)}>
      <div
        className={cn(
          'border-teal-200 border-t-teal-600 rounded-full animate-spin',
          sizes[size]
        )}
      />
      {message && (
        <p className="text-slate-600 font-medium animate-pulse">{message}</p>
      )}
      {subMessage && (
        <p className="text-xs text-slate-400">{subMessage}</p>
      )}
    </div>
  );
});
