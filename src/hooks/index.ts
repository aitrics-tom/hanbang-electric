/**
 * Custom Hooks - 재사용 가능한 React Hooks
 */

export { useSolveProblem, LOADING_MESSAGES } from './useSolveProblem';
export type { LoadingStep, SolveMetadata } from './useSolveProblem';
export { useCopyToClipboard } from './useCopyToClipboard';

// Supabase Hooks
export { useAuth } from './useAuth';
export type { AuthState } from './useAuth';
export { useStats } from './useStats';
export type { UserStats, CategoryStats, UseStatsReturn } from './useStats';
export { useQuestionHistory } from './useQuestionHistory';
export type { UseHistoryFilters, UseHistoryReturn } from './useQuestionHistory';
export { useAnalytics } from './useAnalytics';
export type {
  StudyPattern,
  StudyBalance,
  StudyPlan,
  Recommendation,
  Achievement,
  LearningTrend,
  AnalyticsResult,
  UseAnalyticsReturn,
} from './useAnalytics';
