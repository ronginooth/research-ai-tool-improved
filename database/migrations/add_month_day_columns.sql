-- 月・日カラムの追加
-- このファイルは既存のSupabaseデータベースに月・日カラムを追加するためのマイグレーションです

-- user_libraryテーブルに月・日カラムを追加
ALTER TABLE user_library
ADD COLUMN IF NOT EXISTS month INTEGER,
ADD COLUMN IF NOT EXISTS day INTEGER;

-- インデックスの追加（年月日での検索を高速化）
CREATE INDEX IF NOT EXISTS idx_user_library_year_month_day 
ON user_library(year, month, day) 
WHERE year IS NOT NULL;

-- コメントの追加
COMMENT ON COLUMN user_library.month IS '論文の公開月（1-12）';
COMMENT ON COLUMN user_library.day IS '論文の公開日（1-31）';


