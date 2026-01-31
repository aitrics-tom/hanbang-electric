-- 전기기사 실기 문제 풀이 앱 - 초기 스키마
-- Supabase Dashboard > SQL Editor에서 실행

-- 1. Agent Type Enum (TEXT로 처리 - Supabase에서 enum은 복잡함)
-- 대신 CHECK constraint 사용

-- 2. Question Sessions Table
CREATE TABLE IF NOT EXISTS question_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 문제 데이터
  question_text TEXT NOT NULL,
  image_url TEXT, -- Supabase Storage URL
  category TEXT NOT NULL CHECK (category IN ('DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC')),

  -- 풀이 데이터
  answer TEXT,
  solution_summary TEXT,
  steps JSONB, -- Array of SolutionStep
  formulas TEXT[],
  related_kec TEXT[],

  -- 에이전트 메타데이터
  agent_path TEXT[],
  primary_agent TEXT NOT NULL CHECK (primary_agent IN ('DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC')),
  secondary_agents TEXT[],

  -- 검증 결과
  is_valid BOOLEAN DEFAULT true,
  verification_confidence DECIMAL(5,4),
  verification_checks JSONB,
  corrections TEXT[],
  warnings TEXT[],

  -- 성능 메트릭
  processing_time_ms INTEGER,
  vision_time_ms INTEGER,
  solve_time_ms INTEGER,

  -- 사용자 피드백 (취약점 추적용)
  user_marked_correct BOOLEAN, -- 사용자 자가 평가
  user_difficulty_rating INTEGER CHECK (user_difficulty_rating BETWEEN 1 AND 5),
  user_notes TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Learning Streaks Table
CREATE TABLE IF NOT EXISTS learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,

  -- 일일 목표
  daily_goal INTEGER DEFAULT 10,
  today_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- 4. Analytics Insights Table
CREATE TABLE IF NOT EXISTS analytics_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  insight_type TEXT NOT NULL CHECK (insight_type IN ('weak_point', 'recommendation', 'trend', 'achievement')),
  category TEXT CHECK (category IN ('DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC')),

  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER DEFAULT 0,

  -- 관련 데이터
  related_sessions UUID[],
  metadata JSONB,

  -- 유효 기간
  valid_until TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON question_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON question_sessions(category);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON question_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_correct ON question_sessions(user_marked_correct);
CREATE INDEX IF NOT EXISTS idx_insights_user ON analytics_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON analytics_insights(insight_type);

-- 6. Category Stats View (카테고리별 통계)
CREATE OR REPLACE VIEW category_stats AS
SELECT
  user_id,
  category,
  COUNT(*) as total_questions,
  COUNT(*) FILTER (WHERE user_marked_correct = true) as correct_count,
  COUNT(*) FILTER (WHERE user_marked_correct = false) as incorrect_count,
  COALESCE(AVG(CASE WHEN user_marked_correct IS NOT NULL THEN
    CASE WHEN user_marked_correct THEN 1.0 ELSE 0.0 END
  END) * 100, 0) as accuracy_rate,
  COALESCE(AVG(processing_time_ms), 0) as avg_processing_time,
  MAX(created_at) as last_practiced
FROM question_sessions
GROUP BY user_id, category;

-- 7. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_question_sessions_updated_at
  BEFORE UPDATE ON question_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_streaks_updated_at
  BEFORE UPDATE ON learning_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Row Level Security (RLS)
ALTER TABLE question_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_insights ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 데이터만 볼 수 있음
CREATE POLICY "Users can view own sessions"
  ON question_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON question_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON question_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own streaks"
  ON learning_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
  ON learning_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON learning_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own insights"
  ON analytics_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON analytics_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON analytics_insights FOR UPDATE
  USING (auth.uid() = user_id);

-- 9. Storage Bucket for Images (Supabase Dashboard에서 생성 필요)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('problem-images', 'problem-images', false);

-- 10. Storage Policy (이미지 버킷용)
-- CREATE POLICY "Users can upload own images"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'problem-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own images"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'problem-images' AND auth.uid()::text = (storage.foldername(name))[1]);
