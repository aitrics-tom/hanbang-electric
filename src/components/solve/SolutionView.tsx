'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { SolutionResponse } from '@/types';
import { AGENTS } from '@/lib/ai/agents';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface SolutionViewProps {
  solution: SolutionResponse;
}

export function SolutionView({ solution }: SolutionViewProps) {
  const primaryAgent = AGENTS[solution.category];
  const verification = solution.verification;

  // 마크다운/LaTeX 파싱 (간단 버전)
  const renderContent = (content: string) => {
    // $$...$$ 블록 수식
    const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g);

    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const latex = part.slice(2, -2);
        return <BlockMath key={index} math={latex} />;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const latex = part.slice(1, -1);
        return <InlineMath key={index} math={latex} />;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="space-y-4">
      {/* 분류 및 에이전트 정보 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${primaryAgent.color}20` }}
              >
                {primaryAgent.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{primaryAgent.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    Nemotron
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {primaryAgent.description}
                </p>
              </div>
            </div>
            <Badge
              variant={verification.isValid ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              {verification.isValid ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {verification.isValid ? '검증 완료' : '검증 필요'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 풀이 과정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📝 풀이 과정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {solution.steps.map((step, index) => (
            <div key={index}>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  {step.order}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-2">{step.title}</h4>
                  <div className="text-muted-foreground leading-relaxed">
                    {renderContent(step.content)}
                  </div>
                  {step.latex && (
                    <div className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto">
                      <BlockMath math={step.latex} />
                    </div>
                  )}
                </div>
              </div>
              {index < solution.steps.length - 1 && (
                <Separator className="my-4" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 최종 답 */}
      <Card className="border-primary">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-xl">📌</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">최종 답</p>
              <p className="text-xl font-bold text-primary">{solution.answer}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 검증 결과 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            🛡️ NeMo Guardrails 검증 결과
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <VerificationItem
              label="계산 정확성"
              pass={verification.checks.calculation.pass}
              notes={verification.checks.calculation.notes}
            />
            <VerificationItem
              label="공식 사용"
              pass={verification.checks.formula.pass}
              notes={verification.checks.formula.notes}
            />
            <VerificationItem
              label="KEC 규정"
              pass={verification.checks.kec.pass}
              notes={verification.checks.kec.notes}
            />
            <VerificationItem
              label="단위 정확성"
              pass={verification.checks.units.pass}
              notes={verification.checks.units.notes}
            />
          </div>

          {verification.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">주의사항</span>
              </div>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                {verification.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 text-center">
            <span className="text-sm text-muted-foreground">
              신뢰도: {Math.round(verification.confidence * 100)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 관련 공식 */}
      {solution.formulas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📐 사용된 공식</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {solution.formulas.map((formula, i) => (
                <Badge key={i} variant="outline" className="text-sm">
                  {formula}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KEC 규정 */}
      {solution.relatedKEC && solution.relatedKEC.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📋 관련 KEC 규정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {solution.relatedKEC.map((kec, i) => (
                <Badge key={i} variant="secondary" className="text-sm">
                  KEC {kec}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VerificationItem({
  label,
  pass,
  notes,
}: {
  label: string;
  pass: boolean;
  notes: string[];
}) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
      {pass ? (
        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        {notes.length > 0 && (
          <p className="text-xs text-muted-foreground">{notes[0]}</p>
        )}
      </div>
    </div>
  );
}
