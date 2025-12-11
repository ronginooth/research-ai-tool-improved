-- パラグラフライティングシステム用テーブル
-- このファイルはSupabaseのSQL Editorで実行してください

-- ワークシートテーブル
CREATE TABLE IF NOT EXISTS manuscript_worksheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown形式のワークシート内容
  structure JSONB, -- パラグラフ構造のJSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- パラグラフテーブル
CREATE TABLE IF NOT EXISTS manuscript_paragraphs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worksheet_id UUID REFERENCES manuscript_worksheets(id) ON DELETE CASCADE,
  paragraph_number TEXT NOT NULL, -- P1, P2, etc.
  section_type TEXT NOT NULL, -- introduction, methods, results, discussion
  title TEXT NOT NULL,
  description TEXT,
  content TEXT, -- 記入済みの内容
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worksheet_id, paragraph_number)
);

-- パラグラフ-引用論文関連テーブル
CREATE TABLE IF NOT EXISTS paragraph_citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paragraph_id UUID REFERENCES manuscript_paragraphs(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES user_library(id) ON DELETE CASCADE,
  citation_context TEXT, -- 引用が使用されている文脈
  citation_order INTEGER, -- 引用の順序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(paragraph_id, paper_id, citation_order)
);

-- セクションファイルテーブル
CREATE TABLE IF NOT EXISTS manuscript_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worksheet_id UUID REFERENCES manuscript_worksheets(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL, -- introduction, methods, results, discussion
  file_name TEXT NOT NULL, -- 02_introduction.md
  content TEXT NOT NULL, -- Markdown形式のセクション内容
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worksheet_id, section_type)
);

-- 原稿全体テーブル
CREATE TABLE IF NOT EXISTS manuscript_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worksheet_id UUID REFERENCES manuscript_worksheets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- 統合された原稿全体
  citation_style TEXT DEFAULT 'apa', -- apa, vancouver, nature, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_worksheets_user_id ON manuscript_worksheets(user_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_created_at ON manuscript_worksheets(created_at);
CREATE INDEX IF NOT EXISTS idx_paragraphs_worksheet_id ON manuscript_paragraphs(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_paragraphs_section_type ON manuscript_paragraphs(section_type);
CREATE INDEX IF NOT EXISTS idx_paragraphs_status ON manuscript_paragraphs(status);
CREATE INDEX IF NOT EXISTS idx_citations_paragraph_id ON paragraph_citations(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_citations_paper_id ON paragraph_citations(paper_id);
CREATE INDEX IF NOT EXISTS idx_sections_worksheet_id ON manuscript_sections(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_sections_section_type ON manuscript_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_drafts_worksheet_id ON manuscript_drafts(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON manuscript_drafts(user_id);

-- 更新日時を自動更新するトリガー
CREATE TRIGGER update_worksheets_updated_at 
    BEFORE UPDATE ON manuscript_worksheets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paragraphs_updated_at 
    BEFORE UPDATE ON manuscript_paragraphs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at 
    BEFORE UPDATE ON manuscript_sections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drafts_updated_at 
    BEFORE UPDATE ON manuscript_drafts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) ポリシー
ALTER TABLE manuscript_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuscript_paragraphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE paragraph_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuscript_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuscript_drafts ENABLE ROW LEVEL SECURITY;

-- manuscript_worksheets: ユーザーは自分のワークシートのみ閲覧・更新可能
CREATE POLICY "Users can view own worksheets"
  ON manuscript_worksheets FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = 'demo-user-123');

CREATE POLICY "Users can insert own worksheets"
  ON manuscript_worksheets FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'demo-user-123');

CREATE POLICY "Users can update own worksheets"
  ON manuscript_worksheets FOR UPDATE
  USING (auth.uid()::text = user_id OR user_id = 'demo-user-123');

CREATE POLICY "Users can delete own worksheets"
  ON manuscript_worksheets FOR DELETE
  USING (auth.uid()::text = user_id OR user_id = 'demo-user-123');

-- manuscript_paragraphs: ワークシートの所有者のみアクセス可能
CREATE POLICY "Users can view own paragraphs"
  ON manuscript_paragraphs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM manuscript_worksheets 
      WHERE manuscript_worksheets.id = manuscript_paragraphs.worksheet_id 
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

CREATE POLICY "Users can insert own paragraphs"
  ON manuscript_paragraphs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscript_worksheets 
      WHERE manuscript_worksheets.id = manuscript_paragraphs.worksheet_id 
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

CREATE POLICY "Users can update own paragraphs"
  ON manuscript_paragraphs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM manuscript_worksheets 
      WHERE manuscript_worksheets.id = manuscript_paragraphs.worksheet_id 
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

CREATE POLICY "Users can delete own paragraphs"
  ON manuscript_paragraphs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM manuscript_worksheets 
      WHERE manuscript_worksheets.id = manuscript_paragraphs.worksheet_id 
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

-- paragraph_citations: パラグラフの所有者のみアクセス可能
CREATE POLICY "Users can view own citations"
  ON paragraph_citations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM manuscript_paragraphs
      JOIN manuscript_worksheets ON manuscript_worksheets.id = manuscript_paragraphs.worksheet_id
      WHERE manuscript_paragraphs.id = paragraph_citations.paragraph_id
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

CREATE POLICY "Users can insert own citations"
  ON paragraph_citations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscript_paragraphs
      JOIN manuscript_worksheets ON manuscript_worksheets.id = manuscript_paragraphs.worksheet_id
      WHERE manuscript_paragraphs.id = paragraph_citations.paragraph_id
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

CREATE POLICY "Users can delete own citations"
  ON paragraph_citations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM manuscript_paragraphs
      JOIN manuscript_worksheets ON manuscript_worksheets.id = manuscript_paragraphs.worksheet_id
      WHERE manuscript_paragraphs.id = paragraph_citations.paragraph_id
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

-- manuscript_sections: ワークシートの所有者のみアクセス可能
CREATE POLICY "Users can view own sections"
  ON manuscript_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM manuscript_worksheets 
      WHERE manuscript_worksheets.id = manuscript_sections.worksheet_id 
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

CREATE POLICY "Users can insert own sections"
  ON manuscript_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscript_worksheets 
      WHERE manuscript_worksheets.id = manuscript_sections.worksheet_id 
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

CREATE POLICY "Users can update own sections"
  ON manuscript_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM manuscript_worksheets 
      WHERE manuscript_worksheets.id = manuscript_sections.worksheet_id 
      AND (manuscript_worksheets.user_id = auth.uid()::text OR manuscript_worksheets.user_id = 'demo-user-123')
    )
  );

-- manuscript_drafts: ユーザーは自分の原稿のみ閲覧・更新可能
CREATE POLICY "Users can view own drafts"
  ON manuscript_drafts FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = 'demo-user-123');

CREATE POLICY "Users can insert own drafts"
  ON manuscript_drafts FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'demo-user-123');

CREATE POLICY "Users can update own drafts"
  ON manuscript_drafts FOR UPDATE
  USING (auth.uid()::text = user_id OR user_id = 'demo-user-123');

CREATE POLICY "Users can delete own drafts"
  ON manuscript_drafts FOR DELETE
  USING (auth.uid()::text = user_id OR user_id = 'demo-user-123');






