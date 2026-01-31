/**
 * SolutionDisplay - 풀이 결과 표시 컴포넌트 (고도화 버전)
 *
 * Features:
 * - KaTeX를 이용한 수식 렌더링
 * - 단계별 풀이 UI/UX 개선
 * - 검증 결과 시각화
 */

'use client';

import React, { memo, useMemo, useState } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calculator,
  BookOpen,
  Shield,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Home,
  PlusCircle,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/common';
import { FeedbackButtons } from './FeedbackButtons';
import { useCopyToClipboard } from '@/hooks';
import { SolutionResponse, SolutionStep } from '@/types';
import { AGENTS } from '@/lib/ai/agents';
import { cn } from '@/lib/utils';
import { formatFormulaForDisplay } from '@/lib/utils/latexConverter';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';

interface SolutionDisplayProps {
  solution: SolutionResponse;
  sessionId?: string;
  onRetry?: () => void;
  onClear?: () => void;
  onNewProblem?: () => void;
  onGoHome?: () => void;
  onFeedback?: (isCorrect: boolean) => void;
}

export const SolutionDisplay = memo(function SolutionDisplay({
  solution,
  sessionId,
  onRetry,
  onClear,
  onNewProblem,
  onGoHome,
  onFeedback,
}: SolutionDisplayProps) {
  const { copied, copy } = useCopyToClipboard();
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    new Set(solution.steps.map((s) => s.order))
  );

  // 에이전트 정보
  const agent = useMemo(() => {
    const agentKey = solution.category as keyof typeof AGENTS;
    return AGENTS[agentKey] || AGENTS.DESIGN;
  }, [solution.category]);

  // 전체 풀이 텍스트 (복사용)
  const fullSolutionText = useMemo(() => {
    const stepsText = solution.steps
      .map((s) => `${s.order}. ${s.title}\n${s.content}${s.latex ? `\n수식: ${s.latex}` : ''}`)
      .join('\n\n');

    const parts = [
      `문제: ${solution.question}`,
      `\n\n정답: ${solution.answer}`,
      `\n\n풀이:\n${stepsText}`,
    ];
    if (solution.formulas?.length) {
      parts.push(`\n\n사용 공식: ${solution.formulas.join(', ')}`);
    }
    return parts.join('');
  }, [solution]);

  const handleCopy = () => copy(fullSolutionText);

  const toggleStep = (order: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(order)) {
        next.delete(order);
      } else {
        next.add(order);
      }
      return next;
    });
  };

  const expandAllSteps = () => {
    setExpandedSteps(new Set(solution.steps.map((s) => s.order)));
  };

  const collapseAllSteps = () => {
    setExpandedSteps(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center text-sm text-slate-500">
          <span
            className="cursor-pointer hover:text-teal-600 transition-colors flex items-center gap-1"
            onClick={onGoHome}
            role="button"
            tabIndex={0}
          >
            <Home size={14} />
            홈
          </span>
          <ChevronRight size={16} className="mx-2" />
          <span className="font-semibold text-slate-900">문제 풀이 결과</span>
        </div>
        <div className="flex items-center gap-3">
          {/* 새 문제 풀기 버튼 */}
          <button
            onClick={onNewProblem}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <PlusCircle size={18} />
            새 문제 풀기
          </button>
          <div className="flex gap-2 text-sm">
            <button
              onClick={collapseAllSteps}
              className="text-slate-500 hover:text-slate-700 font-medium"
            >
              모두 접기
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={expandAllSteps}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              모두 펼치기
            </button>
          </div>
        </div>
      </div>

      {/* Agent Info */}
      <AgentInfoCard agent={agent} verification={solution.verification} />

      {/* Answer Highlight */}
      <AnswerCard answer={solution.answer} processingTime={solution.processingTime} />

      {/* Question */}
      <QuestionCard question={solution.question} />

      {/* Solution Steps - Enhanced UI */}
      <Card className="overflow-hidden">
        <CardHeader
          icon={<Sparkles className="text-amber-500" size={20} />}
          action={
            <div className="flex gap-2">
              <IconButton
                onClick={handleCopy}
                icon={copied ? <Check size={18} /> : <Copy size={18} />}
                title="복사하기"
              />
              {onRetry && (
                <IconButton onClick={onRetry} icon={<RefreshCw size={18} />} title="다시 풀기" />
              )}
            </div>
          }
        >
          <span className="flex items-center gap-2">
            단계별 풀이
            <span className="text-xs font-normal text-slate-400">
              ({solution.steps.length}단계)
            </span>
          </span>
        </CardHeader>

        <CardBody className="p-0">
          <div className="divide-y divide-slate-100">
            {solution.steps.map((step, index) => (
              <StepCard
                key={step.order}
                step={step}
                isExpanded={expandedSteps.has(step.order)}
                onToggle={() => toggleStep(step.order)}
                isFirst={index === 0}
                isLast={index === solution.steps.length - 1}
                totalSteps={solution.steps.length}
              />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Formulas & KEC */}
      <div className="grid md:grid-cols-2 gap-4">
        {solution.formulas && solution.formulas.length > 0 && (
          <FormulaCard formulas={solution.formulas} />
        )}
        {solution.relatedKEC && solution.relatedKEC.length > 0 && (
          <KECCard kecList={solution.relatedKEC} />
        )}
      </div>

      {/* Verification */}
      {solution.verification && <VerificationCard verification={solution.verification} />}

      {/* Feedback */}
      <Card>
        <CardBody>
          <FeedbackButtons
            sessionId={sessionId}
            onFeedback={onFeedback}
          />
        </CardBody>
      </Card>
    </div>
  );
});

// =====================================
// Sub-components
// =====================================

const AgentInfoCard = memo(function AgentInfoCard({
  agent,
  verification,
}: {
  agent: (typeof AGENTS)[keyof typeof AGENTS];
  verification?: SolutionResponse['verification'];
}) {
  return (
    <Card className="bg-gradient-to-r from-teal-50 to-white border-teal-100">
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
              style={{ backgroundColor: `${agent.color}20` }}
            >
              {agent.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{agent.name}</span>
                <span className="px-2 py-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-semibold rounded-full">
                  Gemini 3
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{agent.description}</p>
            </div>
          </div>
          {verification && (
            <div className="text-right">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-500" size={20} />
                <span className="font-semibold text-green-700">
                  검증 완료
                </span>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
});

const AnswerCard = memo(function AnswerCard({
  answer,
  processingTime,
}: {
  answer: string;
  processingTime?: number;
}) {
  // 답변 길이에 따른 동적 스타일링
  const isLongAnswer = answer.length > 50;
  const isVeryLongAnswer = answer.length > 150;

  // LaTeX 패턴 감지 (수식 명령어가 있으면 LaTeX로 직접 렌더링)
  const containsLatex = /\\(frac|times|cdot|sqrt|text|sum|int|pi|theta|alpha|beta|gamma|delta|omega|cos|sin|tan|log|ln|lim|infty)|_\{|\^\{/.test(answer);

  return (
    <Card className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 text-white border-0 shadow-lg shadow-teal-200">
      <CardBody className="p-6">
        <div className={cn(
          'flex gap-4',
          isLongAnswer ? 'flex-col' : 'items-center justify-between'
        )}>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-teal-100 mb-2">
              <Lightbulb size={18} />
              <span className="text-sm font-medium">최종 정답</span>
            </div>
            <div className={cn(
              'leading-relaxed',
              isVeryLongAnswer
                ? 'text-base md:text-lg font-medium whitespace-pre-wrap'
                : isLongAnswer
                  ? 'text-xl md:text-2xl font-semibold'
                  : 'text-3xl md:text-4xl font-bold tracking-tight'
            )}>
              {containsLatex ? (
                <LaTeXFormula latex={answer} />
              ) : (
                <LatexInlineRenderer text={answer} />
              )}
            </div>
          </div>
          {processingTime && (
            <div className={cn(
              'bg-white/10 rounded-xl px-4 py-2',
              isLongAnswer ? 'self-end' : 'text-right'
            )}>
              <span className="text-teal-100 text-xs">처리 시간</span>
              <p className="text-xl font-semibold">{processingTime.toFixed(1)}초</p>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
});

const QuestionCard = memo(function QuestionCard({ question }: { question: string }) {
  return (
    <Card>
      <CardHeader icon={<BookOpen className="text-slate-500" size={18} />}>문제</CardHeader>
      <CardBody>
        <div className="p-4 bg-slate-50 rounded-xl text-slate-800 leading-relaxed whitespace-pre-wrap border border-slate-100">
          {question}
        </div>
      </CardBody>
    </Card>
  );
});

const StepCard = memo(function StepCard({
  step,
  isExpanded,
  onToggle,
  isFirst,
  isLast,
  totalSteps,
}: {
  step: SolutionStep;
  isExpanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  isLast: boolean;
  totalSteps: number;
}) {
  // 진행률 계산
  const progress = (step.order / totalSteps) * 100;

  return (
    <div
      className={cn(
        'transition-all duration-200',
        isExpanded ? 'bg-gradient-to-r from-teal-50/50 to-white' : 'bg-white hover:bg-slate-50'
      )}
    >
      {/* Step Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 text-left group"
      >
        {/* Progress indicator */}
        <div className="relative">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 border-2',
              isExpanded
                ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-200'
                : 'bg-white text-slate-600 border-slate-200 group-hover:border-teal-300'
            )}
          >
            {step.order}
          </div>
          {/* Connecting line */}
          {!isLast && (
            <div
              className={cn(
                'absolute left-1/2 top-full w-0.5 h-4 -translate-x-1/2',
                isExpanded ? 'bg-teal-300' : 'bg-slate-200'
              )}
            />
          )}
        </div>

        {/* Title and preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-semibold transition-colors',
                isExpanded ? 'text-teal-900' : 'text-slate-700'
              )}
            >
              {step.title}
            </span>
            {step.latex && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                수식 포함
              </span>
            )}
          </div>
          {!isExpanded && step.content && (
            <p className="text-sm text-slate-400 truncate mt-0.5">
              {step.content.slice(0, 60)}...
            </p>
          )}
        </div>

        {/* Expand icon */}
        <div
          className={cn(
            'p-2 rounded-full transition-all',
            isExpanded ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'
          )}
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Step Content */}
      {isExpanded && (
        <div className="px-4 pb-5 animate-in slide-in-from-top-2 duration-200">
          <div className="ml-14 space-y-4">
            {/* Content text with line breaks */}
            <div className="text-slate-700 leading-relaxed">
              <ContentRenderer content={step.content} />
            </div>

            {/* LaTeX formula */}
            {step.latex && (
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                  <Calculator size={14} />
                  <span>수식</span>
                </div>
                <div className="flex justify-center">
                  <LaTeXFormula latex={step.latex} block />
                </div>
              </div>
            )}

            {/* Next step indicator */}
            {!isLast && (
              <div className="flex items-center gap-2 text-slate-400 text-sm pt-2">
                <ArrowRight size={14} />
                <span>다음 단계로 진행</span>
              </div>
            )}

            {/* Final step indicator */}
            {isLast && (
              <div className="flex items-center gap-2 text-green-600 text-sm pt-2 font-medium">
                <CheckCircle size={16} />
                <span>풀이 완료</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

const FormulaCard = memo(function FormulaCard({ formulas }: { formulas: string[] }) {
  // 공식을 읽기 쉬운 형태로 변환 (LaTeX → plain text)
  const displayFormulas = useMemo(() => {
    return formulas.map(formula => formatFormulaForDisplay(formula));
  }, [formulas]);

  return (
    <Card>
      <CardHeader icon={<Calculator className="text-blue-500" size={18} />}>사용 공식</CardHeader>
      <CardBody>
        <div className="flex flex-wrap gap-2">
          {displayFormulas.map((formula, index) => (
            <span
              key={`${formulas[index]}-${index}`}
              className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 font-medium"
            >
              {formula}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
});

const KECCard = memo(function KECCard({ kecList }: { kecList: string[] }) {
  return (
    <Card>
      <CardHeader icon={<BookOpen className="text-purple-500" size={18} />}>관련 KEC 규정</CardHeader>
      <CardBody>
        <div className="flex flex-wrap gap-2">
          {kecList.map((kec) => (
            <span
              key={kec}
              className="px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-lg text-sm text-purple-700 font-medium"
            >
              {kec}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
});

const VerificationCard = memo(function VerificationCard({
  verification,
}: {
  verification: NonNullable<SolutionResponse['verification']>;
}) {
  const checks = [
    { key: 'calculation', label: '계산 정확성', icon: Calculator },
    { key: 'formula', label: '공식 적용', icon: BookOpen },
    { key: 'kec', label: 'KEC 규정', icon: Shield },
    { key: 'units', label: '단위 정확성', icon: CheckCircle },
  ] as const;

  return (
    <Card>
      <CardHeader icon={<Shield className="text-green-500" size={18} />}>
        검증 결과
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {checks.map(({ key, label }) => {
            const check = verification.checks[key];
            const pass = check?.pass ?? true;
            return (
              <div
                key={key}
                className={cn(
                  'p-3 rounded-xl border text-center transition-all',
                  pass
                    ? 'bg-green-50 border-green-100 hover:border-green-200'
                    : 'bg-red-50 border-red-100 hover:border-red-200'
                )}
              >
                <div className="flex justify-center mb-2">
                  {pass ? (
                    <CheckCircle className="text-green-500" size={24} />
                  ) : (
                    <XCircle className="text-red-500" size={24} />
                  )}
                </div>
                <span className={cn('text-sm font-medium', pass ? 'text-green-700' : 'text-red-700')}>
                  {label}
                </span>
                {check?.notes?.[0] && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{check.notes[0]}</p>
                )}
              </div>
            );
          })}
        </div>

        {verification.warnings && verification.warnings.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <AlertTriangle size={18} />
              <span className="font-semibold">주의사항</span>
            </div>
            <ul className="space-y-1">
              {verification.warnings.map((warning, i) => (
                <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span><LatexInlineRenderer text={warning} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
});

const IconButton = memo(function IconButton({
  onClick,
  icon,
  title,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
      title={title}
    >
      {icon}
    </button>
  );
});

// =====================================
// Content & LaTeX Rendering Components
// =====================================

const ContentRenderer = memo(function ContentRenderer({ content }: { content: string }) {
  // 줄바꿈 처리 및 리스트 항목 스타일링
  const lines = content.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-2" />;

        // 리스트 항목 (- 또는 • 로 시작)
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-teal-500 mt-1">•</span>
              <span>{trimmed.slice(1).trim()}</span>
            </div>
          );
        }

        // 숫자 리스트
        const numberMatch = trimmed.match(/^(\d+)\.\s*/);
        if (numberMatch) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-teal-600 font-semibold min-w-[1.5rem]">
                {numberMatch[1]}.
              </span>
              <span>{trimmed.slice(numberMatch[0].length)}</span>
            </div>
          );
        }

        // 일반 텍스트
        return (
          <p key={index} className="leading-relaxed">
            <LatexInlineRenderer text={trimmed} />
          </p>
        );
      })}
    </div>
  );
});

const LatexInlineRenderer = memo(function LatexInlineRenderer({ text }: { text: string }) {
  // 인라인 LaTeX 패턴 찾기 ($...$)
  const parts = useMemo(() => {
    const regex = /\$([^$]+)\$/g;
    const result: Array<{ type: 'text' | 'latex'; content: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      result.push({ type: 'latex', content: match[1] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      result.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return result.length > 0 ? result : [{ type: 'text' as const, content: text }];
  }, [text]);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'latex') {
          return <LaTeXFormula key={index} latex={part.content} />;
        }
        return <span key={index}>{part.content}</span>;
      })}
    </>
  );
});

const LaTeXFormula = memo(function LaTeXFormula({
  latex,
  block = false,
}: {
  latex: string;
  block?: boolean;
}) {
  // LaTeX 정리 - JSON에서 이중 이스케이프된 백슬래시 처리
  const { cleanLatex, fallbackText } = useMemo(() => {
    let cleaned = latex;

    // 1. JSON 이중 이스케이프 처리 (\\frac -> \frac)
    // 주의: 실제 \\ (줄바꿈)은 유지해야 함
    cleaned = cleaned.replace(/\\\\([a-zA-Z])/g, '\\$1');
    cleaned = cleaned.replace(/\\\\_/g, '\\_');
    cleaned = cleaned.replace(/\\\\{/g, '\\{');
    cleaned = cleaned.replace(/\\\\}/g, '\\}');

    // 2. 디스플레이 모드 구분자 제거
    cleaned = cleaned.replace(/\\\[/g, '');
    cleaned = cleaned.replace(/\\\]/g, '');
    cleaned = cleaned.replace(/\\\(/g, '');
    cleaned = cleaned.replace(/\\\)/g, '');

    // 3. 앞뒤 공백 제거
    cleaned = cleaned.trim();

    // 4. 폴백 텍스트 생성 (LaTeX -> Plain text)
    let fallback = cleaned;
    fallback = fallback.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    fallback = fallback.replace(/\\times/g, '×');
    fallback = fallback.replace(/\\cdot/g, '·');
    fallback = fallback.replace(/\\text\{([^{}]+)\}/g, '$1');
    fallback = fallback.replace(/_\{([^{}]+)\}/g, '[$1]');
    fallback = fallback.replace(/\^{([^{}]+)}/g, '^$1');
    fallback = fallback.replace(/\\[a-zA-Z]+/g, '');
    fallback = fallback.replace(/[{}]/g, '');

    return { cleanLatex: cleaned, fallbackText: fallback };
  }, [latex]);

  // KaTeX 렌더링 시도
  try {
    if (block) {
      return (
        <BlockMath
          math={cleanLatex}
          errorColor="#ef4444"
          renderError={(error) => (
            <div className="text-slate-700 font-mono text-lg">
              {fallbackText}
            </div>
          )}
        />
      );
    }
    return (
      <InlineMath
        math={cleanLatex}
        errorColor="#ef4444"
        renderError={(error) => (
          <span className="font-mono">{fallbackText}</span>
        )}
      />
    );
  } catch {
    // 렌더링 완전 실패 시 폴백 텍스트 표시
    return (
      <span className="font-mono text-slate-700">
        {fallbackText}
      </span>
    );
  }
});
