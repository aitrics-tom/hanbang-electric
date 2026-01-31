/**
 * ChatInterface - 채팅 인터페이스 컴포넌트
 *
 * 개인 질문 및 일반 대화용 채팅 UI
 * LaTeX 수식 렌더링 지원
 */

'use client';

import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, User, Bot, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  initialMessage?: string;
  questionType?: 'personal_query' | 'general_chat';
}

export const ChatInterface = memo(function ChatInterface({
  initialMessage,
  questionType = 'general_chat',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialProcessed = useRef(false);

  // 스크롤 맨 아래로
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 초기 메시지 처리
  useEffect(() => {
    if (initialMessage && !initialProcessed.current) {
      initialProcessed.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          questionType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '응답을 받지 못했습니다.');
      }

      // 응답 데이터 유효성 검사
      const responseText = data?.data?.response;
      if (!responseText) {
        throw new Error('서버에서 유효한 응답을 받지 못했습니다.');
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}. 잠시 후 다시 시도해주세요.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const typeLabel = questionType === 'personal_query' ? '학습 현황' : 'AI 튜터';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-200">
        <Link
          href="/"
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
            <Bot className="text-teal-600" size={24} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{typeLabel}</h2>
            <p className="text-sm text-slate-500">
              {questionType === 'personal_query'
                ? '학습 이력 기반 맞춤 상담'
                : '전기기사 실기 AI 튜터'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-12 text-slate-500">
            <Bot size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium">안녕하세요!</p>
            <p className="text-sm mt-1">
              {questionType === 'personal_query'
                ? '학습 현황이나 취약 분야에 대해 물어보세요.'
                : '전기기사 실기에 관해 무엇이든 물어보세요.'}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Bot className="text-teal-600" size={18} />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <Loader2 className="animate-spin text-teal-600" size={20} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-white border-t border-slate-200"
      >
        <div className="flex gap-3 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none resize-none text-slate-900 placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'px-4 py-3 rounded-xl font-medium transition-all',
              input.trim() && !isLoading
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
});

// 메시지 버블 컴포넌트
const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex items-start gap-3',
        isUser ? 'flex-row-reverse' : ''
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-slate-700' : 'bg-teal-100'
        )}
      >
        {isUser ? (
          <User className="text-white" size={18} />
        ) : (
          <Bot className="text-teal-600" size={18} />
        )}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'bg-teal-600 text-white rounded-tr-sm'
            : 'bg-white text-slate-800 rounded-tl-sm'
        )}
      >
        <div className="break-words">
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <MessageContentRenderer content={message.content} />
          )}
        </div>
        <div
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-teal-200' : 'text-slate-400'
          )}
        >
          {message.timestamp.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
});

// 메시지 콘텐츠 렌더러 (LaTeX 지원)
const MessageContentRenderer = memo(function MessageContentRenderer({
  content,
}: {
  content: string;
}) {
  // 줄바꿈으로 분리하여 각 줄 처리
  const lines = content.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;

        // 블록 수식 ($$...$$)
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
          const latex = trimmed.slice(2, -2).trim();
          return (
            <div key={index} className="my-2 overflow-x-auto">
              <LaTeXRenderer latex={latex} block />
            </div>
          );
        }

        // 리스트 항목
        if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="text-teal-500">•</span>
              <span><InlineLatexRenderer text={trimmed.slice(1).trim()} /></span>
            </div>
          );
        }

        // 숫자 리스트
        const numberMatch = trimmed.match(/^(\d+)\.\s*/);
        if (numberMatch) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="font-semibold min-w-[1.5rem]">{numberMatch[1]}.</span>
              <span><InlineLatexRenderer text={trimmed.slice(numberMatch[0].length)} /></span>
            </div>
          );
        }

        // 일반 텍스트 (인라인 LaTeX 포함 가능)
        return (
          <p key={index} className="leading-relaxed">
            <InlineLatexRenderer text={trimmed} />
          </p>
        );
      })}
    </div>
  );
});

// 인라인 LaTeX 렌더러
const InlineLatexRenderer = memo(function InlineLatexRenderer({
  text,
}: {
  text: string;
}) {
  const parts = useMemo(() => {
    // $...$ 또는 \(...\) 패턴 찾기
    const regex = /\$([^$]+)\$|\\\(([^)]+)\\\)/g;
    const result: Array<{ type: 'text' | 'latex'; content: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      result.push({ type: 'latex', content: match[1] || match[2] });
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
          return <LaTeXRenderer key={index} latex={part.content} />;
        }
        return <span key={index}>{part.content}</span>;
      })}
    </>
  );
});

// LaTeX 렌더러
const LaTeXRenderer = memo(function LaTeXRenderer({
  latex,
  block = false,
}: {
  latex: string;
  block?: boolean;
}) {
  const cleanLatex = useMemo(() => {
    return latex
      .replace(/\\\[/g, '')
      .replace(/\\\]/g, '')
      .replace(/\\\(/g, '')
      .replace(/\\\)/g, '')
      .trim();
  }, [latex]);

  try {
    if (block) {
      return <BlockMath math={cleanLatex} errorColor="#ef4444" />;
    }
    return <InlineMath math={cleanLatex} errorColor="#ef4444" />;
  } catch {
    return <code className="px-1 py-0.5 bg-slate-100 rounded text-sm">{latex}</code>;
  }
});

export default ChatInterface;
