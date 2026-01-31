/**
 * HistoryList - 질문 이력 리스트 컴포넌트
 */

'use client';

import { useState } from 'react';
import { QuestionSession } from '@/types/database';
import { AGENTS } from '@/lib/ai/agents';
import { AgentType } from '@/types';

interface HistoryListProps {
  sessions: QuestionSession[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onDelete?: (id: string) => void;
  onViewDetail?: (session: QuestionSession) => void;
  onFeedbackUpdate?: (sessionId: string, isCorrect: boolean) => void;
}

export function HistoryList({
  sessions,
  hasMore,
  isLoading,
  onLoadMore,
  onDelete,
  onViewDetail,
  onFeedbackUpdate,
}: HistoryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const handleFeedback = async (sessionId: string, isCorrect: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (submittingFeedback) return;

    setSubmittingFeedback(sessionId);
    setFeedbackError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, isCorrect }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '피드백 제출 실패');
      }

      onFeedbackUpdate?.(sessionId, isCorrect);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSubmittingFeedback(null);
    }
  };

  if (sessions.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="text-4xl mb-3">📚</div>
        <p className="text-slate-600">아직 풀이한 문제가 없습니다.</p>
        <p className="text-sm text-slate-400 mt-1">문제를 풀면 여기에 기록됩니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">최근 풀이 이력</h3>
      </div>

      <div className="divide-y divide-slate-100">
        {sessions.map((session) => {
          const agent = AGENTS[session.category as AgentType];
          const isExpanded = expandedId === session.id;

          return (
            <div key={session.id} className="hover:bg-slate-50 transition-colors">
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: `${agent.color}20` }}
                  >
                    {agent.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {agent.name}
                      </span>
                      {session.user_marked_correct !== null ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            session.user_marked_correct
                              ? 'bg-green-100 text-green-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {session.user_marked_correct ? '정답' : '오답'}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          미체크
                        </span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(session.created_at).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">
                      {session.question_text}
                    </p>
                    {session.answer && (
                      <p className="text-sm font-medium text-teal-600 mt-1">
                        답: {session.answer}
                      </p>
                    )}
                  </div>
                  <button
                    className={`text-slate-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </button>
                </div>
              </div>

              {/* 확장된 상세 정보 */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50">
                  <div className="pt-4 space-y-3">
                    {/* 풀이 단계 */}
                    {session.steps && Array.isArray(session.steps) && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">풀이 단계</p>
                        <div className="space-y-2">
                          {(session.steps as Array<{ order: number; title: string; content: string }>)
                            .slice(0, 3)
                            .map((step, idx) => (
                              <div
                                key={idx}
                                className="text-sm bg-white rounded p-2 border border-slate-200"
                              >
                                <span className="font-medium text-teal-600">
                                  {step.order}. {step.title}
                                </span>
                                <p className="text-slate-600 text-xs mt-1 line-clamp-2">
                                  {step.content}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 메타데이터 */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {session.processing_time_ms && (
                        <span className="px-2 py-1 bg-slate-100 rounded text-slate-600">
                          처리 시간: {(session.processing_time_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      {session.verification_confidence && (
                        <span className="px-2 py-1 bg-slate-100 rounded text-slate-600">
                          신뢰도: {(session.verification_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>

                    {/* 정답/오답 체크 버튼 (아직 체크하지 않은 경우) */}
                    {session.user_marked_correct === null && (
                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">이 문제를 맞히셨나요?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => handleFeedback(session.id, true, e)}
                            disabled={submittingFeedback === session.id}
                            className="flex-1 py-2 text-sm rounded-lg font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {submittingFeedback === session.id ? (
                              <span className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                            ) : (
                              <>✓ 정답</>
                            )}
                          </button>
                          <button
                            onClick={(e) => handleFeedback(session.id, false, e)}
                            disabled={submittingFeedback === session.id}
                            className="flex-1 py-2 text-sm rounded-lg font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {submittingFeedback === session.id ? (
                              <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
                            ) : (
                              <>✗ 오답</>
                            )}
                          </button>
                        </div>
                        {feedbackError && (
                          <p className="text-xs text-red-500 mt-1">{feedbackError}</p>
                        )}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 pt-2">
                      {onViewDetail && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetail(session);
                          }}
                          className="text-xs px-3 py-1.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
                        >
                          상세 보기
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('이 기록을 삭제하시겠습니까?')) {
                              onDelete(session.id);
                            }
                          }}
                          className="text-xs px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 더 보기 */}
      {hasMore && (
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="w-full py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg disabled:opacity-50"
          >
            {isLoading ? '로딩 중...' : '더 보기'}
          </button>
        </div>
      )}
    </div>
  );
}

export function HistoryListSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-slate-100">
        <div className="h-5 w-32 bg-slate-200 rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-full bg-slate-100 rounded mb-1" />
                <div className="h-4 w-2/3 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
