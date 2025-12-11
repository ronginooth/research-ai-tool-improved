-- GROBIDエラーカラムを追加
-- このマイグレーションは、GROBID処理中に発生したエラーを保存するためのカラムを追加します

ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS grobid_error TEXT;

-- コメントを追加
COMMENT ON COLUMN user_library.grobid_error IS 'GROBID処理中に発生したエラーメッセージ';




