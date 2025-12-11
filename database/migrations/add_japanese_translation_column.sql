-- パラグラフテーブルに日本語訳カラムを追加
-- このファイルはSupabaseのSQL Editorで実行してください

ALTER TABLE manuscript_paragraphs
ADD COLUMN IF NOT EXISTS japanese_translation TEXT;

-- コメントを追加
COMMENT ON COLUMN manuscript_paragraphs.japanese_translation IS 'パラグラフ内容の日本語訳';






