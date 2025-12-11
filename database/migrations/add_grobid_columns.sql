-- GROBID出力保存用カラムの追加
-- このファイルは既存のSupabaseデータベースにGROBIDカラムを追加するためのマイグレーションです

-- user_libraryテーブルにGROBID関連カラムを追加
ALTER TABLE user_library
ADD COLUMN IF NOT EXISTS grobid_tei_xml TEXT,
ADD COLUMN IF NOT EXISTS grobid_data JSONB,
ADD COLUMN IF NOT EXISTS grobid_processed_at TIMESTAMP WITH TIME ZONE;

-- インデックスの追加（GROBID処理済みの論文を検索しやすくする）
CREATE INDEX IF NOT EXISTS idx_user_library_grobid_processed_at 
ON user_library(grobid_processed_at) 
WHERE grobid_processed_at IS NOT NULL;

-- コメントの追加
COMMENT ON COLUMN user_library.grobid_tei_xml IS 'GROBIDが生成したTEI/XML形式の生データ';
COMMENT ON COLUMN user_library.grobid_data IS 'GROBIDの出力をパースした構造化データ（JSON形式）';
COMMENT ON COLUMN user_library.grobid_processed_at IS 'GROBIDで処理された日時';







