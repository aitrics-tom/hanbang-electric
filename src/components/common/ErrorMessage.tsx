/**
 * ErrorMessage - 에러 메시지 컴포넌트
 */

import React, { memo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  message: string;
  className?: string;
  onRetry?: () => void;
}

export const ErrorMessage = memo(function ErrorMessage({
  message,
  className,
  onRetry,
}: ErrorMessageProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
    >
      <div className="bg-red-50 p-4 rounded-full mb-4">
        <AlertCircle className="text-red-500" size={48} />
      </div>
      <p className="text-slate-800 font-semibold mb-2">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <RefreshCw size={16} />
          다시 시도하기
        </button>
      )}
    </div>
  );
});
