/**
 * Supabase Database Types - 데이터베이스 스키마 타입 정의
 */

import { AgentType } from './index';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      question_sessions: {
        Row: {
          id: string;
          user_id: string;
          question_text: string;
          image_url: string | null;
          category: AgentType;
          answer: string | null;
          solution_summary: string | null;
          steps: Json | null;
          formulas: string[] | null;
          related_kec: string[] | null;
          agent_path: string[] | null;
          primary_agent: AgentType;
          secondary_agents: AgentType[] | null;
          is_valid: boolean;
          verification_confidence: number | null;
          verification_checks: Json | null;
          corrections: string[] | null;
          warnings: string[] | null;
          processing_time_ms: number | null;
          vision_time_ms: number | null;
          solve_time_ms: number | null;
          user_marked_correct: boolean | null;
          user_difficulty_rating: number | null;
          user_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_text: string;
          image_url?: string | null;
          category: AgentType;
          answer?: string | null;
          solution_summary?: string | null;
          steps?: Json | null;
          formulas?: string[] | null;
          related_kec?: string[] | null;
          agent_path?: string[] | null;
          primary_agent: AgentType;
          secondary_agents?: AgentType[] | null;
          is_valid?: boolean;
          verification_confidence?: number | null;
          verification_checks?: Json | null;
          corrections?: string[] | null;
          warnings?: string[] | null;
          processing_time_ms?: number | null;
          vision_time_ms?: number | null;
          solve_time_ms?: number | null;
          user_marked_correct?: boolean | null;
          user_difficulty_rating?: number | null;
          user_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          question_text?: string;
          image_url?: string | null;
          category?: AgentType;
          answer?: string | null;
          solution_summary?: string | null;
          steps?: Json | null;
          formulas?: string[] | null;
          related_kec?: string[] | null;
          agent_path?: string[] | null;
          primary_agent?: AgentType;
          secondary_agents?: AgentType[] | null;
          is_valid?: boolean;
          verification_confidence?: number | null;
          verification_checks?: Json | null;
          corrections?: string[] | null;
          warnings?: string[] | null;
          processing_time_ms?: number | null;
          vision_time_ms?: number | null;
          solve_time_ms?: number | null;
          user_marked_correct?: boolean | null;
          user_difficulty_rating?: number | null;
          user_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      learning_streaks: {
        Row: {
          id: string;
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          daily_goal: number;
          today_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          daily_goal?: number;
          today_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          daily_goal?: number;
          today_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      analytics_insights: {
        Row: {
          id: string;
          user_id: string;
          insight_type: 'weak_point' | 'study_pattern' | 'recommendation' | 'trend' | 'achievement';
          category: AgentType | null;
          title: string;
          description: string;
          priority: number;
          related_sessions: string[] | null;
          metadata: Json | null;
          valid_until: string | null;
          is_dismissed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          insight_type: 'weak_point' | 'study_pattern' | 'recommendation' | 'trend' | 'achievement';
          category?: AgentType | null;
          title: string;
          description: string;
          priority?: number;
          related_sessions?: string[] | null;
          metadata?: Json | null;
          valid_until?: string | null;
          is_dismissed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          insight_type?: 'weak_point' | 'study_pattern' | 'recommendation' | 'trend' | 'achievement';
          category?: AgentType | null;
          title?: string;
          description?: string;
          priority?: number;
          related_sessions?: string[] | null;
          metadata?: Json | null;
          valid_until?: string | null;
          is_dismissed?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      category_stats: {
        Row: {
          user_id: string;
          category: AgentType;
          total_questions: number;
          correct_count: number;
          incorrect_count: number;
          accuracy_rate: number;
          avg_processing_time: number;
          last_practiced: string;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      agent_type: AgentType;
      insight_type: 'weak_point' | 'study_pattern' | 'recommendation' | 'trend' | 'achievement';
    };
  };
}

// Helper types
export type QuestionSession = Database['public']['Tables']['question_sessions']['Row'];
export type QuestionSessionInsert = Database['public']['Tables']['question_sessions']['Insert'];
export type QuestionSessionUpdate = Database['public']['Tables']['question_sessions']['Update'];

export type LearningStreak = Database['public']['Tables']['learning_streaks']['Row'];
export type LearningStreakInsert = Database['public']['Tables']['learning_streaks']['Insert'];

export type AnalyticsInsight = Database['public']['Tables']['analytics_insights']['Row'];
export type AnalyticsInsightInsert = Database['public']['Tables']['analytics_insights']['Insert'];

export type CategoryStats = Database['public']['Views']['category_stats']['Row'];
