import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import {
  Zap,
  Camera,
  Shield,
  Brain,
  ArrowRight,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="container py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          NVIDIA NIM · Nemotron · NeMo Guardrails
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
          전기기사 실기,
          <br />
          <span className="text-primary">AI가 책임집니다</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          사진 한 장만 찍으면 AI가 문제를 분석하고 단계별로 풀이해드립니다.
          <br />
          NVIDIA 기술로 빠르고 정확한 학습을 경험하세요.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/solve">
            <Button size="lg" className="gap-2">
              <Camera className="h-5 w-5" />
              문제 풀기 시작
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              대시보드
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-center mb-12">
          NVIDIA 기술로 구현된 핵심 기능
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Camera className="h-8 w-8" />}
            title="Smart OCR"
            description="NVIDIA NIM으로 0.5초 만에 문제 인식. 손글씨, 수식, 회로도까지 정확하게 추출합니다."
            badge="NVIDIA NIM"
          />
          <FeatureCard
            icon={<Brain className="h-8 w-8" />}
            title="전문 AI 에이전트"
            description="6개 과목 특화 에이전트가 Nemotron으로 정확한 풀이를 제공합니다."
            badge="Nemotron"
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="자동 검증"
            description="NeMo Guardrails가 계산 정확성과 KEC 규정 준수를 자동으로 검증합니다."
            badge="Guardrails"
          />
        </div>
      </section>

      {/* Agents Section */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-center mb-4">
          6개 전문 에이전트
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          각 분야 전문가 수준의 AI가 문제를 분석하고 풀이합니다
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <AgentCard icon="🔌" name="전기설비설계" color="#3B82F6" />
          <AgentCard icon="⚡" name="시퀀스/PLC" color="#8B5CF6" />
          <AgentCard icon="💡" name="부하설비" color="#F59E0B" />
          <AgentCard icon="📊" name="전력설비" color="#EF4444" />
          <AgentCard icon="🏗️" name="감리/신재생" color="#10B981" />
          <AgentCard icon="📋" name="KEC규정" color="#6366F1" />
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-center mb-12">이용 방법</h2>
        <div className="grid md:grid-cols-4 gap-8">
          <StepCard
            step={1}
            title="사진 촬영"
            description="문제를 촬영하거나 이미지를 업로드하세요"
          />
          <StepCard
            step={2}
            title="AI 분석"
            description="NVIDIA NIM이 0.5초 만에 문제를 인식합니다"
          />
          <StepCard
            step={3}
            title="전문가 풀이"
            description="Nemotron 에이전트가 단계별로 풀이합니다"
          />
          <StepCard
            step={4}
            title="검증 완료"
            description="Guardrails가 정확성을 자동 검증합니다"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">지금 바로 시작하세요</h2>
            <p className="text-muted-foreground mb-6">
              무료로 문제를 풀어보고 AI 튜터의 실력을 확인해보세요
            </p>
            <Link href="/solve">
              <Button size="lg">
                무료로 시작하기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2025 전실 AI. Powered by NVIDIA NIM, Nemotron & NeMo Guardrails.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <Badge className="absolute top-4 right-4" variant="secondary">
          {badge}
        </Badge>
        <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function AgentCard({
  icon,
  name,
  color,
}: {
  icon: string;
  name: string;
  color: string;
}) {
  return (
    <Card className="text-center hover:border-primary transition-colors cursor-default">
      <CardContent className="pt-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
        <p className="text-sm font-medium">{name}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
