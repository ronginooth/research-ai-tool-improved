-- Supabase Migration: Add missing columns to user_library table
-- 実行日: 2025-01-28

-- 1. 現在のテーブル構造を確認
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_library' 
-- ORDER BY ordinal_position;

-- 2. doi カラムを追加
ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS doi text;

-- 3. pdf_url カラムを追加（既存の場合も安全）
ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS pdf_url text;

-- 4. html_url カラムを追加（既存の場合も安全）
ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS html_url text;

-- 5. ai_summary カラムを追加（既存の場合も安全）
ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS ai_summary text;

-- 6. ai_summary_updated_at カラムを追加（既存の場合も安全）
ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS ai_summary_updated_at timestamptz;

-- 7. インデックスを追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_user_library_doi ON user_library(doi);
CREATE INDEX IF NOT EXISTS idx_user_library_pdf_url ON user_library(pdf_url);
CREATE INDEX IF NOT EXISTS idx_user_library_html_url ON user_library(html_url);

-- 8. 確認クエリ（実行後に確認用）
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_library' 
-- AND column_name IN ('doi', 'pdf_url', 'html_url', 'ai_summary', 'ai_summary_updated_at')
-- ORDER BY column_name;

