-- Deep Research機能用テーブル追加
-- このファイルはSupabaseのSQL Editorで実行してください
-- 実行前にデータベースのバックアップを推奨します

-- Deep Researchセッションテーブル
CREATE TABLE IF NOT EXISTS deep_research_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  query_expanded TEXT,
  total_papers INTEGER DEFAULT 0,
  status TEXT DEFAULT 'searching',
  search_sources TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deep Researchセッション内の論文リスト
CREATE TABLE IF NOT EXISTS deep_research_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES deep_research_sessions(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  abstract TEXT,
  url TEXT,
  citation_count INTEGER DEFAULT 0,
  venue TEXT,
  relevance_score INTEGER,
  relevance_reasoning TEXT,
  relevance_tag TEXT,
  source TEXT,
  search_query TEXT,
  doi TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, paper_id)
);

-- レビューテーブルにDeep Research関連カラムを追加
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deep_research_session_id UUID REFERENCES deep_research_sessions(id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS selected_paper_count INTEGER DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS total_papers_count INTEGER DEFAULT 0;

-- レビューで引用された厳選論文（まとめファイル内の引用）
CREATE TABLE IF NOT EXISTS review_selected_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  session_id UUID REFERENCES deep_research_sessions(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL,
  citation_number INTEGER,
  citation_context TEXT,
  section_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, paper_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_deep_research_sessions_user_id ON deep_research_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_research_sessions_created_at ON deep_research_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_deep_research_sessions_status ON deep_research_sessions(status);
CREATE INDEX IF NOT EXISTS idx_deep_research_papers_session_id ON deep_research_papers(session_id);
CREATE INDEX IF NOT EXISTS idx_deep_research_papers_paper_id ON deep_research_papers(paper_id);
CREATE INDEX IF NOT EXISTS idx_deep_research_papers_relevance_score ON deep_research_papers(relevance_score);
CREATE INDEX IF NOT EXISTS idx_reviews_session_id ON reviews(deep_research_session_id);
CREATE INDEX IF NOT EXISTS idx_review_selected_papers_review_id ON review_selected_papers(review_id);
CREATE INDEX IF NOT EXISTS idx_review_selected_papers_session_id ON review_selected_papers(session_id);
CREATE INDEX IF NOT EXISTS idx_review_selected_papers_paper_id ON review_selected_papers(paper_id);

-- 更新日時を自動更新するトリガー
CREATE TRIGGER update_deep_research_sessions_updated_at 
    BEFORE UPDATE ON deep_research_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) ポリシー
ALTER TABLE deep_research_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deep_research_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_selected_papers ENABLE ROW LEVEL SECURITY;

-- deep_research_sessions: ユーザーは自分のセッションのみ閲覧・更新可能
CREATE POLICY "Users can view own deep research sessions"
  ON deep_research_sessions FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own deep research sessions"
  ON deep_research_sessions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own deep research sessions"
  ON deep_research_sessions FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own deep research sessions"
  ON deep_research_sessions FOR DELETE
  USING (auth.uid()::text = user_id);

-- deep_research_papers: ユーザーは自分のセッションの論文のみ閲覧可能
CREATE POLICY "Users can view own deep research papers"
  ON deep_research_papers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deep_research_sessions
      WHERE deep_research_sessions.id = deep_research_papers.session_id
      AND deep_research_sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own deep research papers"
  ON deep_research_papers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deep_research_sessions
      WHERE deep_research_sessions.id = deep_research_papers.session_id
      AND deep_research_sessions.user_id = auth.uid()::text
    )
  );

-- review_selected_papers: ユーザーは自分のレビューの厳選論文のみ閲覧可能
CREATE POLICY "Users can view own review selected papers"
  ON review_selected_papers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_selected_papers.review_id
      AND reviews.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own review selected papers"
  ON review_selected_papers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_selected_papers.review_id
      AND reviews.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own review selected papers"
  ON review_selected_papers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_selected_papers.review_id
      AND reviews.user_id = auth.uid()::text
    )
  );



