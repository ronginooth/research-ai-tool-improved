# Deep Research機能 データベースマイグレーション

## 概要

このディレクトリには、Deep Research機能用のデータベースマイグレーションファイルが含まれています。

## ファイル一覧

- `add_deep_research_tables.sql` - Deep Research機能用テーブルの追加
- `rollback_deep_research_tables.sql` - ロールバック用スクリプト

## 実行手順

### 1. マイグレーション実行前の確認

**重要**: マイグレーション実行前に必ずデータベースのバックアップを取得してください。

#### Supabaseでのバックアップ方法

1. Supabase Dashboardにログイン
2. プロジェクトを選択
3. Settings > Database > Backups に移動
4. "Create backup" をクリックしてバックアップを作成

または、pg_dumpを使用してローカルにバックアップ：

```bash
pg_dump -h <your-supabase-host> -U postgres -d postgres > backup_before_deep_research.sql
```

### 2. マイグレーション実行

1. Supabase Dashboardにログイン
2. SQL Editorを開く
3. `add_deep_research_tables.sql` の内容をコピー＆ペースト
4. "Run" をクリックして実行
5. エラーがないことを確認

### 3. 動作確認

マイグレーション実行後、以下のクエリでテーブルが作成されたことを確認：

```sql
-- テーブルが存在するか確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'deep_research_sessions',
  'deep_research_papers',
  'review_selected_papers'
);

-- reviewsテーブルにカラムが追加されたか確認
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'reviews' 
AND column_name IN (
  'deep_research_session_id',
  'selected_paper_count',
  'total_papers_count'
);
```

## ロールバック手順

問題が発生した場合、以下の手順でロールバックできます：

### 1. ロールバック実行

1. Supabase DashboardのSQL Editorを開く
2. `rollback_deep_research_tables.sql` の内容をコピー＆ペースト
3. "Run" をクリックして実行
4. エラーがないことを確認

### 2. ロールバック確認

ロールバック後、以下のクエリでテーブルが削除されたことを確認：

```sql
-- テーブルが削除されたか確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'deep_research_sessions',
  'deep_research_papers',
  'review_selected_papers'
);
-- 結果が0件であることを確認

-- reviewsテーブルからカラムが削除されたか確認
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'reviews' 
AND column_name IN (
  'deep_research_session_id',
  'selected_paper_count',
  'total_papers_count'
);
-- 結果が0件であることを確認
```

## 注意事項

1. **データ損失**: ロールバックを実行すると、Deep Research関連のすべてのデータが削除されます
2. **外部キー制約**: `review_selected_papers` は `reviews` テーブルを参照しているため、既存のレビューに影響する可能性があります（ただし、既存のレビューは削除されません）
3. **RLSポリシー**: ロールバック後、RLSポリシーも削除されます

## トラブルシューティング

### エラー: "relation already exists"

テーブルが既に存在する場合：
- ロールバックスクリプトを実行してから、再度マイグレーションを実行してください

### エラー: "column already exists"

カラムが既に存在する場合：
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` を使用しているため、通常は問題ありません
- それでもエラーが出る場合は、手動でカラムを確認してください

### エラー: "permission denied"

RLSポリシーや権限の問題：
- Supabaseのサービスロールキーを使用していることを確認してください
- または、適切な権限を持つユーザーで実行してください

## サポート

問題が発生した場合は、以下を確認してください：

1. Supabase Dashboardのログを確認
2. エラーメッセージの全文を確認
3. データベースのバックアップから復元を検討

---
最終更新: 2025-01-28 15:45:00 JST



