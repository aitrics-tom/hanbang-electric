/**
 * FeatureSection - 기능 소개 섹션
 *
 * Frontend Patterns: Memoization for Pure Components
 */

import React, { memo, useMemo } from 'react';
import {
  ScanText,
  BrainCircuit,
  ShieldCheck,
  Zap,
  Cog,
  Lightbulb,
  BarChart3,
  Ruler,
  BookOpen,
} from 'lucide-react';
import { Card, CardBody } from '@/components/common';

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
  tag: string;
}

interface Agent {
  name: string;
  icon: React.ReactNode;
}

export const FeatureSection = memo(function FeatureSection() {
  const coreFeatures = useMemo<Feature[]>(
    () => [
      {
        title: 'Smart OCR',
        description:
          'Gemini 3.0 Flash로 즉시 문제 인식. 손글씨, 수식, 회로도까지 정확하게 추출합니다.',
        icon: <ScanText className="text-teal-600" size={32} />,
        tag: 'Vision AI',
      },
      {
        title: '전문 AI 에이전트',
        description:
          '6개 과목 특화 에이전트가 정확한 풀이를 제공합니다. 전기기사 실기 데이터로 최적화되었습니다.',
        icon: <BrainCircuit className="text-teal-600" size={32} />,
        tag: 'LLM Reasoning',
      },
      {
        title: '자동 검증',
        description:
          'KEC 규정 준수 여부를 자동으로 검증하여 오답률을 최소화하고 신뢰도를 높입니다.',
        icon: <ShieldCheck className="text-teal-600" size={32} />,
        tag: 'Guardrails',
      },
    ],
    []
  );

  const specializedAgents = useMemo<Agent[]>(
    () => [
      { name: '전기설비설계', icon: <Cog size={24} className="text-slate-600" /> },
      { name: '시퀀스/PLC', icon: <Zap size={24} className="text-yellow-500" /> },
      { name: '부하설비', icon: <Lightbulb size={24} className="text-orange-400" /> },
      { name: '전력설비', icon: <BarChart3 size={24} className="text-blue-500" /> },
      { name: '감리/신재생', icon: <Ruler size={24} className="text-green-600" /> },
      { name: 'KEC규정', icon: <BookOpen size={24} className="text-red-400" /> },
    ],
    []
  );

  return (
    <div className="bg-white py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-24">
        {/* Core Features */}
        <div className="space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              최신 기술로 구현된 핵심 기능
            </h2>
            <p className="mt-4 text-slate-600">
              복잡한 전기 문제도 AI가 정확하게 분석합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {coreFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>

        {/* Specialized Agents */}
        <div className="space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">6개 전문 에이전트</h2>
            <p className="mt-4 text-slate-600">
              각 분야 전문가 수준의 AI가 문제를 분석하고 풀이합니다
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {specializedAgents.map((agent) => (
              <AgentCard key={agent.name} {...agent} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

// Sub-components
const FeatureCard = memo(function FeatureCard({ title, description, icon, tag }: Feature) {
  return (
    <Card hover className="bg-slate-50 p-8 group">
      <CardBody className="p-0">
        <div className="flex justify-between items-start mb-6">
          <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-teal-50 transition-colors">
            {icon}
          </div>
          <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded">
            {tag}
          </span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-600 leading-relaxed">{description}</p>
      </CardBody>
    </Card>
  );
});

const AgentCard = memo(function AgentCard({ name, icon }: Agent) {
  return (
    <Card hover className="text-center p-6">
      <CardBody className="p-0">
        <div className="mb-4 p-3 bg-slate-50 rounded-full w-fit mx-auto">{icon}</div>
        <span className="font-semibold text-slate-700">{name}</span>
      </CardBody>
    </Card>
  );
});
