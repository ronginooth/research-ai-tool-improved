-- Supabaseデータベーススキーマ
-- このファイルはSupabaseのSQL Editorで実行してください

-- ユーザー設定テーブル（各自のSupabase設定を保存）
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  custom_supabase_url TEXT,
  custom_supabase_anon_key TEXT,
  custom_supabase_service_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ユーザーライブラリーテーブル
CREATE TABLE IF NOT EXISTS user_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  abstract TEXT,
  url TEXT,
  citation_count INTEGER DEFAULT 0,
  venue TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  pdf_url TEXT,
  html_url TEXT,
  ai_summary JSONB,
  ai_summary_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- レビューテーブル
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  paper_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PDF処理ジョブテーブル
CREATE TABLE IF NOT EXISTS library_pdf_processing_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PDFセクションテーブル
CREATE TABLE IF NOT EXISTS library_pdf_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id TEXT NOT NULL,
  section_level INTEGER NOT NULL,
  section_title TEXT NOT NULL,
  parent_section_id UUID REFERENCES library_pdf_sections(id),
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(paper_id, section_level, section_title)
);

-- PDFチャンクテーブル
CREATE TABLE IF NOT EXISTS library_pdf_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id TEXT NOT NULL,
  section_id UUID REFERENCES library_pdf_sections(id),
  chunk_text TEXT NOT NULL,
  chunk_type TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PDF埋め込みテーブル
CREATE TABLE IF NOT EXISTS library_pdf_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id TEXT NOT NULL,
  chunk_id UUID REFERENCES library_pdf_chunks(id),
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_paper_id ON user_library(paper_id);
CREATE INDEX IF NOT EXISTS idx_user_library_created_at ON user_library(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_user_id ON library_pdf_processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_paper_id ON library_pdf_processing_jobs(paper_id);
CREATE INDEX IF NOT EXISTS idx_pdf_sections_paper_id ON library_pdf_sections(paper_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_paper_id ON library_pdf_chunks(paper_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_section_id ON library_pdf_chunks(section_id);
CREATE INDEX IF NOT EXISTS idx_pdf_embeddings_paper_id ON library_pdf_embeddings(paper_id);
CREATE INDEX IF NOT EXISTS idx_pdf_embeddings_chunk_id ON library_pdf_embeddings(chunk_id);

-- 更新日時を自動更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_library_updated_at 
    BEFORE UPDATE ON user_library 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at 
    BEFORE UPDATE ON reviews 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pdf_jobs_updated_at 
    BEFORE UPDATE ON library_pdf_processing_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) ポリシー
-- ユーザーは自分のデータのみアクセス可能

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_pdf_processing_jobs ENABLE ROW LEVEL SECURITY;

-- user_settings: ユーザーは自分の設定のみ閲覧・更新可能
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid()::text = user_id);

-- user_library: ユーザーは自分のライブラリのみ閲覧・更新可能
CREATE POLICY "Users can view own library"
  ON user_library FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own library"
  ON user_library FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own library"
  ON user_library FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own library"
  ON user_library FOR DELETE
  USING (auth.uid()::text = user_id);

-- reviews: ユーザーは自分のレビューのみ閲覧・更新可能
CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid()::text = user_id);

-- library_pdf_processing_jobs: ユーザーは自分のジョブのみ閲覧可能
CREATE POLICY "Users can view own jobs"
  ON library_pdf_processing_jobs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own jobs"
  ON library_pdf_processing_jobs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own jobs"
  ON library_pdf_processing_jobs FOR UPDATE
  USING (auth.uid()::text = user_id);
