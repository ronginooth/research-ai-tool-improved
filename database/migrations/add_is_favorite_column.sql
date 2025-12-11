-- Add is_favorite column to user_library table
-- 実行日: 2025-01-28

ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- インデックスを追加（お気に入りフィルターのパフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_user_library_is_favorite ON user_library(user_id, is_favorite);

-- 確認クエリ（実行後に確認用）
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'user_library' 
-- AND column_name = 'is_favorite';




