-- リンク情報カラムを追加
-- このファイルはSupabaseのSQL Editorで実行してください

-- linked_from カラムを追加（JSONB型）
-- 形式: [{"type": "manuscript", "worksheetId": "...", "paragraphId": "...", "linkedAt": "..."}, ...]
ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS linked_from JSONB DEFAULT '[]'::jsonb;

-- インデックスを追加（リンク情報の検索を高速化）
CREATE INDEX IF NOT EXISTS idx_user_library_linked_from ON user_library USING GIN (linked_from);




