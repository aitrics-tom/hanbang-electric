-- RAG (Retrieval-Augmented Generation) 테이블
-- Supabase Dashboard > SQL Editor에서 실행

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 문서 테이블
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dictionary', 'regulation', 'formula')),
  source_file TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 문서 청크 테이블 (벡터 포함)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),  -- Gemini text-embedding-004 차원
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  -- 검색 최적화 필드
  category TEXT CHECK (category IN ('DESIGN', 'SEQUENCE', 'LOAD', 'POWER', 'RENEWABLE', 'KEC')),
  keywords TEXT[] DEFAULT '{}',
  kec_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 벡터 검색 인덱스 (IVFFlat - 빠른 근사 검색)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. 텍스트 검색 인덱스 (한국어 전문 검색)
CREATE INDEX IF NOT EXISTS idx_chunks_content_fts
ON document_chunks
USING gin (to_tsvector('simple', content));

-- 6. 기타 인덱스
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_category ON document_chunks(category);
CREATE INDEX IF NOT EXISTS idx_chunks_kec_codes ON document_chunks USING gin(kec_codes);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- 7. Updated At Trigger
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. 벡터 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  category text,
  keywords text[],
  kec_codes text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    dc.category,
    dc.keywords,
    dc.kec_codes,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR dc.category = filter_category)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 9. 하이브리드 검색 함수 (벡터 + 키워드)
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_embedding vector(768),
  query_text text,
  match_count int DEFAULT 10,
  filter_category text DEFAULT NULL,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  category text,
  keywords text[],
  kec_codes text[],
  semantic_score float,
  keyword_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      dc.category,
      dc.keywords,
      dc.kec_codes,
      1 - (dc.embedding <=> query_embedding) AS semantic_score
    FROM document_chunks dc
    WHERE dc.embedding IS NOT NULL
      AND (filter_category IS NULL OR dc.category = filter_category)
  ),
  keyword_results AS (
    SELECT
      dc.id,
      ts_rank(to_tsvector('simple', dc.content), plainto_tsquery('simple', query_text)) AS keyword_score
    FROM document_chunks dc
    WHERE to_tsvector('simple', dc.content) @@ plainto_tsquery('simple', query_text)
      AND (filter_category IS NULL OR dc.category = filter_category)
  )
  SELECT
    sr.id,
    sr.document_id,
    sr.content,
    sr.metadata,
    sr.category,
    sr.keywords,
    sr.kec_codes,
    sr.semantic_score,
    COALESCE(kr.keyword_score, 0) AS keyword_score,
    (sr.semantic_score * semantic_weight + COALESCE(kr.keyword_score, 0) * (1 - semantic_weight)) AS combined_score
  FROM semantic_results sr
  LEFT JOIN keyword_results kr ON sr.id = kr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 10. RLS 정책 (서비스 롤 전용 - 공개 문서)
-- 문서는 모든 인증된 사용자가 읽을 수 있음
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read chunks"
  ON document_chunks FOR SELECT
  TO authenticated
  USING (true);

-- 서비스 롤만 삽입/수정/삭제 가능
CREATE POLICY "Service role can manage documents"
  ON documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage chunks"
  ON document_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
