-- Volume, Issue, Pagesカラムの追加
-- このファイルは既存のSupabaseデータベースにVolume、Issue、Pagesカラムを追加するためのマイグレーションです

-- user_libraryテーブルにVolume、Issue、Pagesカラムを追加
ALTER TABLE user_library
ADD COLUMN IF NOT EXISTS volume TEXT,
ADD COLUMN IF NOT EXISTS issue TEXT,
ADD COLUMN IF NOT EXISTS pages TEXT;

-- インデックスの追加（Volume、Issueでの検索を高速化）
CREATE INDEX IF NOT EXISTS idx_user_library_volume 
ON user_library(volume) 
WHERE volume IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_library_issue 
ON user_library(issue) 
WHERE issue IS NOT NULL;

-- コメントの追加
COMMENT ON COLUMN user_library.volume IS '論文の巻号（例: "123"）';
COMMENT ON COLUMN user_library.issue IS '論文の号（例: "5"）';
COMMENT ON COLUMN user_library.pages IS '論文のページ番号（例: "123-145"）';


