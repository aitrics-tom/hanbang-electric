/**
 * FeedbackButtons - 정오답 피드백 버튼 컴포넌트
 */

'use client';

import { useState } from 'react';

interface FeedbackButtonsProps {
  sessionId?: string;
  onFeedback?: (isCorrect: boolean) => void;
  initialValue?: boolean | null;
}

export function FeedbackButtons({
  sessionId,
  onFeedback,
  initialValue,
}: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<boolean | null>(initialValue ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFeedback = async (isCorrect: boolean) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (sessionId) {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, isCorrect }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || '피드백 제출 실패');
        }
      }

      setFeedback(isCorrect);
      onFeedback?.(isCorrect);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">이 풀이가 도움이 되었나요?</p>
      <div className="flex gap-3">
        <button
          onClick={() => handleFeedback(true)}
          disabled={isSubmitting || feedback !== null}
          className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            feedback === true
              ? 'bg-green-500 text-white'
              : feedback === null
              ? 'bg-green-50 text-green-700 border-2 border-green-200 hover:bg-green-100'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {feedback === true && <span className="text-lg">✓</span>}
          <span>정답이에요</span>
        </button>
        <button
          onClick={() => handleFeedback(false)}
          disabled={isSubmitting || feedback !== null}
          className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            feedback === false
              ? 'bg-rose-500 text-white'
              : feedback === null
              ? 'bg-rose-50 text-rose-700 border-2 border-rose-200 hover:bg-rose-100'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {feedback === false && <span className="text-lg">✓</span>}
          <span>오답이에요</span>
        </button>
      </div>

      {feedback !== null && (
        <p className="text-sm text-center text-slate-500">
          {feedback ? '정답으로 기록되었습니다!' : '오답으로 기록되었습니다. 복습해보세요!'}
        </p>
      )}

      {error && (
        <p className="text-sm text-center text-red-500">{error}</p>
      )}

      {isSubmitting && (
        <div className="flex justify-center">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
