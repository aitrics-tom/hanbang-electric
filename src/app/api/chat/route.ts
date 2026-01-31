/**
 * Chat API - 개인 질문 및 일반 대화 처리
 *
 * 문제 풀이가 아닌 학습 현황, 추천 등 개인화된 응답 제공
 * GuardRails로 부적절한 입력 필터링
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { historyContextService } from '@/lib/services/history-context.service';
import { classifyQuestion, QuestionType } from '@/lib/utils/questionClassifier';
import { validateChatInput, getEnhancedSystemPrompt } from '@/lib/utils/chatGuardrails';
import { logger } from '@/lib/api/logger';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

interface ChatRequest {
  message: string;
  questionType?: QuestionType;
}

const PERSONAL_QUERY_PROMPT = `당신은 전기기사 실기 시험 준비를 도와주는 친절한 AI 튜터입니다.
사용자의 학습 현황 데이터를 기반으로 개인화된 조언을 제공합니다.

## 역할
- 학습 현황 분석 및 피드백
- 취약 분야 파악 및 학습 추천
- 틀린 문제에 대한 복습 조언
- 학습 동기 부여

## 응답 스타일
- 친근하고 격려하는 톤
- 구체적인 데이터 기반 조언
- 간결하고 명확한 답변
- 이모지 적절히 사용

## 주의사항
- 실제 데이터만 기반으로 답변
- 없는 데이터를 지어내지 않기
- 학습 의욕을 북돋는 방향으로`;

const GENERAL_CHAT_PROMPT = `당신은 전기기사 실기 시험 전문 AI 튜터입니다.

## 역할
- 전기기사 실기 시험 관련 질문 답변
- 전기 이론 및 개념 설명
- KEC(한국전기설비규정) 관련 안내
- 학습 방법 조언

## 응답 스타일
- 전문적이면서도 이해하기 쉬운 설명
- 필요한 경우 예시 포함
- 간결하고 명확한 답변

## 주의사항
- 전기기사 실기와 무관한 질문은 정중히 거절
- 안전과 관련된 내용은 특히 정확하게`;

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, questionType: providedType } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: '메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    // GuardRails 검사
    const guardrailResult = validateChatInput(message);
    if (!guardrailResult.passed) {
      logger.warn('Chat guardrail blocked', {
        userId: user.id,
        category: guardrailResult.category,
        reason: guardrailResult.reason,
      });

      return NextResponse.json({
        success: true,
        data: {
          response: guardrailResult.suggestion || '전기기사 실기 관련 질문을 해주세요.',
          questionType: 'general_chat',
          blocked: true,
          blockReason: guardrailResult.category,
        },
      });
    }

    // 질문 유형 분류
    const questionType = providedType || classifyQuestion(message, false);

    let systemPrompt: string;
    let contextData = '';

    if (questionType === 'personal_query') {
      // 개인 질문: 학습 이력 컨텍스트 포함
      systemPrompt = getEnhancedSystemPrompt(PERSONAL_QUERY_PROMPT);
      contextData = await historyContextService.buildPromptContext(user.id);
    } else {
      // 일반 대화
      systemPrompt = getEnhancedSystemPrompt(GENERAL_CHAT_PROMPT);
    }

    // Gemini API 호출 (빠른 응답을 위해 Flash 모델 사용)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const fullPrompt = contextData
      ? `${systemPrompt}\n\n${contextData}\n\n사용자 질문: ${message}`
      : `${systemPrompt}\n\n사용자 질문: ${message}`;

    let responseText: string;
    try {
      const result = await model.generateContent(fullPrompt);
      responseText = result.response.text();

      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from AI');
      }
    } catch (aiError) {
      logger.error('Gemini API error', aiError as Error);
      // AI 호출 실패 시 폴백 응답
      responseText = '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    logger.info('Chat API response generated', {
      questionType,
      userId: user.id,
      hasContext: !!contextData,
    });

    // 채팅 세션 저장 (선택적)
    await saveChatMessage(supabase, user.id, message, responseText, questionType);

    return NextResponse.json({
      success: true,
      data: {
        response: responseText,
        questionType,
      },
    });
  } catch (error) {
    logger.error('Chat API error', error as Error);
    // 에러 시에도 사용자에게 표시할 응답 반환
    return NextResponse.json({
      success: true,
      data: {
        response: '죄송합니다. 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        questionType: 'general_chat',
        error: true,
      },
    });
  }
}

async function saveChatMessage(
  _supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  _userId: string,
  _userMessage: string,
  _assistantResponse: string,
  _questionType: QuestionType
) {
  // chat_messages 테이블이 없으므로 현재는 저장하지 않음
  // 향후 테이블 추가 시 구현 예정
}
