-- paragraph_citationsテーブルにfield_codeカラムを追加（オプション）
-- フィールドコードをデータベースに保存する場合に使用
-- 後方互換性のため、NULLを許可

ALTER TABLE paragraph_citations 
ADD COLUMN IF NOT EXISTS field_code TEXT;

-- インデックスを追加（検索パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_paragraph_citations_field_code 
ON paragraph_citations(field_code) 
WHERE field_code IS NOT NULL;

-- コメントを追加
COMMENT ON COLUMN paragraph_citations.field_code IS 
'Citation field code in format [cite:citation_id:paper_id](display_text). Optional, for backward compatibility.';



