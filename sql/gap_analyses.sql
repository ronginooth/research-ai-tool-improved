-- 研究ギャップ分析テーブル
CREATE TABLE IF NOT EXISTS gap_analyses (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  topic TEXT NOT NULL,
  context TEXT,
  analysis TEXT NOT NULL,
  papers JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_gap_analyses_user_id ON gap_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_created_at ON gap_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_topic ON gap_analyses USING gin(to_tsvector('english', topic));


















