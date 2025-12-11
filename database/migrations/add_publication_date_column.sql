-- publication_dateカラムの追加
-- このファイルは既存のSupabaseデータベースにpublication_dateカラムを追加するためのマイグレーションです

-- user_libraryテーブルにpublication_dateカラムを追加
ALTER TABLE user_library
ADD COLUMN IF NOT EXISTS publication_date TEXT;

-- インデックスの追加（publication_dateでの検索を高速化）
CREATE INDEX IF NOT EXISTS idx_user_library_publication_date 
ON user_library(publication_date) 
WHERE publication_date IS NOT NULL;

-- コメントの追加
COMMENT ON COLUMN user_library.publication_date IS '論文の公開日（ISO 8601形式: "2024-05-15"）。元のAPIレスポンスをそのまま保持';


