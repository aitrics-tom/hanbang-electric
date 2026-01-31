/**
 * useAuth Hook - 인증 상태 관리
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const supabase = createClient();

  useEffect(() => {
    // 초기 세션 확인
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[useAuth] 세션 조회 실패:', {
            error: error.message,
            code: error.code,
            timestamp: new Date().toISOString(),
          });
        }
        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session?.user,
        });
      } catch (err) {
        console.error('[useAuth] 세션 초기화 오류:', {
          error: err instanceof Error ? err.message : err,
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        setState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    getInitialSession();

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session?.user,
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[useAuth] 로그아웃 실패:', {
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[useAuth] 로그아웃 오류:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
        },
      });
      if (error) {
        console.error('[useAuth] Google 로그인 실패:', {
          error: error.message,
          code: error.code,
          redirectTo,
          timestamp: new Date().toISOString(),
        });
      }
      return { error };
    } catch (err) {
      console.error('[useAuth] Google 로그인 오류:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        redirectTo,
        timestamp: new Date().toISOString(),
      });
      return { error: err as Error };
    }
  }, []);

  return {
    ...state,
    signOut,
    signInWithGoogle,
  };
}
