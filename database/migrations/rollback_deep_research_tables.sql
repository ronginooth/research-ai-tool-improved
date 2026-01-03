-- Deep Research機能用テーブルのロールバック
-- このファイルはSupabaseのSQL Editorで実行してください
-- 実行前にデータベースのバックアップを推奨します

-- 注意: このスクリプトを実行すると、Deep Research関連のすべてのデータが削除されます

-- 重要: 外部キー制約を削除するため、まずreviewsテーブルからカラムを削除
ALTER TABLE reviews DROP COLUMN IF EXISTS deep_research_session_id;
ALTER TABLE reviews DROP COLUMN IF EXISTS total_papers_count;
ALTER TABLE reviews DROP COLUMN IF EXISTS selected_paper_count;

-- RLSポリシーを削除
DROP POLICY IF EXISTS "Users can view own deep research sessions" ON deep_research_sessions;
DROP POLICY IF EXISTS "Users can insert own deep research sessions" ON deep_research_sessions;
DROP POLICY IF EXISTS "Users can update own deep research sessions" ON deep_research_sessions;
DROP POLICY IF EXISTS "Users can delete own deep research sessions" ON deep_research_sessions;

DROP POLICY IF EXISTS "Users can view own deep research papers" ON deep_research_papers;
DROP POLICY IF EXISTS "Users can insert own deep research papers" ON deep_research_papers;

DROP POLICY IF EXISTS "Users can view own review selected papers" ON review_selected_papers;
DROP POLICY IF EXISTS "Users can insert own review selected papers" ON review_selected_papers;
DROP POLICY IF EXISTS "Users can delete own review selected papers" ON review_selected_papers;

-- RLSを無効化
ALTER TABLE IF EXISTS deep_research_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deep_research_papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_selected_papers DISABLE ROW LEVEL SECURITY;

-- トリガーを削除
DROP TRIGGER IF EXISTS update_deep_research_sessions_updated_at ON deep_research_sessions;

-- インデックスを削除
DROP INDEX IF EXISTS idx_deep_research_sessions_user_id;
DROP INDEX IF EXISTS idx_deep_research_sessions_created_at;
DROP INDEX IF EXISTS idx_deep_research_sessions_status;
DROP INDEX IF EXISTS idx_deep_research_papers_session_id;
DROP INDEX IF EXISTS idx_deep_research_papers_paper_id;
DROP INDEX IF EXISTS idx_deep_research_papers_relevance_score;
DROP INDEX IF EXISTS idx_reviews_session_id;
DROP INDEX IF EXISTS idx_review_selected_papers_review_id;
DROP INDEX IF EXISTS idx_review_selected_papers_session_id;
DROP INDEX IF EXISTS idx_review_selected_papers_paper_id;

-- テーブルを削除（外部キー制約により順序が重要）
-- review_selected_papersは他のテーブルに依存しているので先に削除
DROP TABLE IF EXISTS review_selected_papers;
-- deep_research_papersはdeep_research_sessionsに依存しているので次に削除
DROP TABLE IF EXISTS deep_research_papers;
-- deep_research_sessionsは最後に削除（reviewsテーブルからの参照が既に削除されている）
DROP TABLE IF EXISTS deep_research_sessions;

