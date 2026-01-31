'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface Formula {
  name: string;
  latex: string;
  variables: Record<string, string>;
  note?: string;
}

interface FormulaCategory {
  icon: string;
  formulas: Formula[];
}

// 공식 데이터
const formulaData: Record<string, FormulaCategory> = {
  조명설계: {
    icon: '💡',
    formulas: [
      {
        name: '광속법 (등수 계산)',
        latex: 'N = \\frac{E \\times A \\times M}{F \\times U}',
        variables: {
          N: '등수 [개]',
          E: '소요조도 [lx]',
          A: '바닥면적 [m²]',
          M: '감광보상률 (1.2~1.5)',
          F: '광속 [lm]',
          U: '조명률 (0.4~0.7)',
        },
        note: '결과는 올림 처리',
      },
      {
        name: '점광원법 (조도)',
        latex: 'E = \\frac{I \\times \\cos^3\\theta}{h^2}',
        variables: {
          E: '조도 [lx]',
          I: '광도 [cd]',
          θ: '입사각 [°]',
          h: '광원 높이 [m]',
        },
      },
    ],
  },
  역률개선: {
    icon: '⚡',
    formulas: [
      {
        name: '콘덴서 용량',
        latex: 'Q_c = P \\times (\\tan\\theta_1 - \\tan\\theta_2)',
        variables: {
          Qc: '콘덴서 용량 [kVar]',
          P: '유효전력 [kW]',
          θ1: '개선 전 역률각',
          θ2: '개선 후 역률각',
        },
      },
      {
        name: '역률 계산',
        latex: '\\cos\\theta = \\frac{P}{S}',
        variables: {
          'cosθ': '역률',
          P: '유효전력 [kW]',
          S: '피상전력 [kVA]',
        },
      },
    ],
  },
  변압기: {
    icon: '🔌',
    formulas: [
      {
        name: '변압기 용량',
        latex: 'P_{TR} = \\frac{P_{설비}}{\\cos\\theta \\times \\eta}',
        variables: {
          'P_TR': '변압기 용량 [kVA]',
          'P_설비': '설비용량 [kW]',
          'cosθ': '역률',
          η: '효율',
        },
      },
      {
        name: '정격전류 (3상)',
        latex: 'I = \\frac{P}{\\sqrt{3} \\times V \\times \\cos\\theta}',
        variables: {
          I: '정격전류 [A]',
          P: '전력 [W]',
          V: '선간전압 [V]',
          'cosθ': '역률',
        },
      },
    ],
  },
  단락전류: {
    icon: '⚠️',
    formulas: [
      {
        name: '%Z법 단락전류',
        latex: 'I_s = \\frac{100 \\times P}{\\sqrt{3} \\times V \\times \\%Z}',
        variables: {
          Is: '단락전류 [A]',
          P: '기준용량 [VA]',
          V: '정격전압 [V]',
          '%Z': '% 임피던스',
        },
      },
    ],
  },
  전압강하: {
    icon: '📉',
    formulas: [
      {
        name: '전압강하 (단상2선)',
        latex: 'e = \\frac{35.6 \\times L \\times I}{A}',
        variables: {
          e: '전압강하 [V]',
          L: '전선길이 [m]',
          I: '전류 [A]',
          A: '전선단면적 [mm²]',
        },
      },
      {
        name: '전압강하 (3상3선)',
        latex: 'e = \\frac{30.8 \\times L \\times I}{A}',
        variables: {
          e: '전압강하 [V]',
          L: '전선길이 [m]',
          I: '전류 [A]',
          A: '전선단면적 [mm²]',
        },
      },
    ],
  },
  접지: {
    icon: '🔗',
    formulas: [
      {
        name: '봉상 접지극 저항',
        latex: 'R = \\frac{\\rho}{2\\pi L} \\times \\ln\\frac{4L}{d}',
        variables: {
          R: '접지저항 [Ω]',
          ρ: '대지저항률 [Ω·m]',
          L: '봉 길이 [m]',
          d: '봉 직경 [m]',
        },
      },
    ],
  },
};

export default function FormulasPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const categories = Object.keys(formulaData);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">공식 라이브러리</h1>
          <p className="text-muted-foreground">
            전기기사 실기 시험에 필요한 핵심 공식 모음
          </p>
        </div>

        <div className="mb-6">
          <Input
            placeholder="공식 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        <Tabs defaultValue="조명설계" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-2 mb-6">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="gap-1">
                <span>{formulaData[category as keyof typeof formulaData].icon}</span>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category} value={category}>
              <div className="grid gap-6">
                {formulaData[category as keyof typeof formulaData].formulas
                  .filter(
                    (f) =>
                      !searchTerm ||
                      f.name.includes(searchTerm) ||
                      Object.values(f.variables).some((v) =>
                        v.includes(searchTerm)
                      )
                  )
                  .map((formula, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{formula.name}</CardTitle>
                          <Badge variant="outline">{category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-4">
                          <BlockMath math={formula.latex} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Object.entries(formula.variables).map(
                            ([symbol, desc]) => (
                              <div
                                key={symbol}
                                className="flex items-start gap-2 text-sm"
                              >
                                <span className="font-mono font-semibold text-primary">
                                  {symbol}
                                </span>
                                <span className="text-muted-foreground">
                                  {desc}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                        {formula.note && (
                          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                            * {formula.note}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
