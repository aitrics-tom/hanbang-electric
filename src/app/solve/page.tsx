'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { ImageUploader } from '@/components/solve/ImageUploader';
import { SolutionView } from '@/components/solve/SolutionView';
import { DdayWidget } from '@/components/dashboard/DdayWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SolutionResponse } from '@/types';
import { AGENTS } from '@/lib/ai/agents';
import { Camera, Type, Lightbulb, Zap, Loader2 } from 'lucide-react';

export default function SolvePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [solution, setSolution] = useState<SolutionResponse | null>(null);
  const [textInput, setTextInput] = useState('');

  const handleImageSelect = async (base64: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await response.json();
      if (data.success) {
        setSolution(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput }),
      });
      const data = await response.json();
      if (data.success) {
        setSolution(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSolution(null);
    setTextInput('');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 왼쪽: 입력 영역 */}
          <div className="lg:col-span-2 space-y-6">
            {!solution ? (
              <>
                <div>
                  <h1 className="text-2xl font-bold mb-2">문제 풀이</h1>
                  <p className="text-muted-foreground">
                    사진을 업로드하거나 문제를 입력하세요
                  </p>
                </div>

                <Tabs defaultValue="image" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="image" className="gap-2">
                      <Camera className="h-4 w-4" />
                      사진 업로드
                    </TabsTrigger>
                    <TabsTrigger value="text" className="gap-2">
                      <Type className="h-4 w-4" />
                      텍스트 입력
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="image" className="mt-4">
                    <ImageUploader
                      onImageSelect={handleImageSelect}
                      isLoading={isLoading}
                    />
                  </TabsContent>

                  <TabsContent value="text" className="mt-4">
                    <Card>
                      <CardContent className="pt-6">
                        <textarea
                          placeholder={`문제를 입력하세요...\n\n예: 바닥 면적이 200m²인 사무실에 평균 조도 500lx를 얻고자 한다. 광원의 광속이 3000lm이고, 조명률 0.6, 감광보상률 1.3일 때 필요한 등 수는?`}
                          className="w-full min-h-40 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                        />
                        <Button
                          className="w-full mt-4"
                          onClick={handleTextSubmit}
                          disabled={isLoading || !textInput.trim()}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              분석 중...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              AI에게 물어보기
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* 질문 가이드 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      질문 가이드
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>• 문제 전체가 보이게 촬영해주세요</p>
                    <p>• 손글씨, 수식, 회로도 모두 인식 가능합니다</p>
                    <p>• 주어진 조건과 구하고자 하는 값을 명확히 해주세요</p>
                    <p>• 단위를 포함하면 더 정확한 답변을 받을 수 있습니다</p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold">풀이 결과</h1>
                  <Button variant="outline" onClick={handleReset}>
                    새 문제 풀기
                  </Button>
                </div>
                <SolutionView solution={solution} />
              </>
            )}
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-6">
            <DdayWidget streak={5} />

            {/* 과목별 에이전트 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">전문 에이전트</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.values(AGENTS).map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${agent.color}20` }}
                    >
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.expertise.slice(0, 3).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* NVIDIA 기술 스택 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">NVIDIA 기술</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline" className="w-full justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  NVIDIA NIM - GPU OCR
                </Badge>
                <Badge variant="outline" className="w-full justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Nemotron - LLM 추론
                </Badge>
                <Badge variant="outline" className="w-full justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  NeMo Guardrails - 검증
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
