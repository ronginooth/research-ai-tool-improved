-- Citation Styles テーブルの作成
-- ユーザーカスタムスタイルとインポートされたスタイルを保存

CREATE TABLE IF NOT EXISTS citation_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  style_json JSONB NOT NULL,
  is_system BOOLEAN DEFAULT false,
  source_type TEXT, -- 'system' | 'user' | 'imported' | 'url'
  source_url TEXT, -- URLインポートの場合の元URL
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_citation_styles_user_id ON citation_styles(user_id);
CREATE INDEX IF NOT EXISTS idx_citation_styles_name ON citation_styles(name);
CREATE INDEX IF NOT EXISTS idx_citation_styles_is_system ON citation_styles(is_system);

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_citation_styles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_citation_styles_updated_at
  BEFORE UPDATE ON citation_styles
  FOR EACH ROW
  EXECUTE FUNCTION update_citation_styles_updated_at();



