/**
 * Chat Page - 채팅 페이지
 *
 * 개인 질문 및 일반 대화 처리
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { QuestionType } from '@/lib/utils/questionClassifier';

interface PendingChat {
  text: string;
  questionType: QuestionType;
}

export default function ChatPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [pendingChat, setPendingChat] = useState<PendingChat | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 인증 체크
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // sessionStorage에서 pending chat 가져오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('pendingChat');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPendingChat(parsed);
          sessionStorage.removeItem('pendingChat');
        } catch {
          // 파싱 실패시 무시
        }
      }
      setIsReady(true);
    }
  }, []);

  // 로딩 중
  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          <p className="mt-4">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 안됨 - 리다이렉트 중 표시
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          <p className="mt-4">로그인 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <ChatInterface
        initialMessage={pendingChat?.text}
        questionType={pendingChat?.questionType === 'personal_query' ? 'personal_query' : 'general_chat'}
      />
    </div>
  );
}
