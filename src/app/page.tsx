/**
 * Home Page - 메인 랜딩 페이지
 *
 * 로그인 안됨 → 로그인 페이지로 리다이렉트
 * 로그인 됨 → 메인 콘텐츠 표시
 *
 * 질문 유형에 따른 라우팅:
 * - 이미지 있음 → /solve (문제 풀이)
 * - problem_solving → /solve (문제 풀이)
 * - personal_query → /chat (학습 현황)
 * - general_chat → /chat (AI 튜터)
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { Navbar, Footer } from '@/components/layout';
import { HeroSection, FeatureSection } from '@/components/home';
import { useAuth } from '@/hooks/useAuth';
import { classifyQuestion } from '@/lib/utils/questionClassifier';

export default function HomePage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  // 로그인 안된 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = useCallback(
    (text: string, image: string | null) => {
      // 질문 유형 분류
      const questionType = classifyQuestion(text, !!image);

      if (questionType === 'problem_solving') {
        // 문제 풀이 → /solve
        sessionStorage.setItem(
          'pendingQuestion',
          JSON.stringify({ text, image })
        );
        router.push('/solve');
      } else {
        // 개인 질문 또는 일반 대화 → /chat
        sessionStorage.setItem(
          'pendingChat',
          JSON.stringify({ text, questionType })
        );
        router.push('/chat');
      }
    },
    [router]
  );

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-5xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">전기기사 실기 AI</h1>
          <p className="text-white/80">로딩 중...</p>
          <div className="mt-6">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // 로그인 안된 경우 (리다이렉트 중)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-5xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">전기기사 실기 AI</h1>
          <p className="text-white/80">로그인 페이지로 이동 중...</p>
          <div className="mt-6">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // 로그인 된 경우 메인 콘텐츠 표시
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main>
        <HeroSection onSubmit={handleSubmit} />
        <FeatureSection />
      </main>

      <Footer />
    </div>
  );
}
