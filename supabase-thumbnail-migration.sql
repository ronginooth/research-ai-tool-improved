-- サムネイル画像URLカラムを追加
ALTER TABLE user_library 
ADD COLUMN thumbnail_url TEXT;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_user_library_thumbnail_url ON user_library(thumbnail_url);

-- コメントを追加
COMMENT ON COLUMN user_library.thumbnail_url IS '論文のサムネイル画像URL';



