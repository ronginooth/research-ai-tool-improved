# データベースマイグレーション実行ガイド

## 問題

エラーメッセージ: `Could not find the table 'public.manuscript_worksheets' in the schema cache`

このエラーは、パラグラフライティングシステム用のテーブルがデータベースに存在しないことを示しています。

## 解決方法

### ステップ1: Supabaseダッシュボードにアクセス

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択

### ステップ2: SQL Editorを開く

1. 左側のメニューから「SQL Editor」をクリック
2. 「New query」をクリック

### ステップ3: マイグレーションファイルを実行

1. 以下のファイルを開く：
   ```
   database/migrations/add_manuscript_tables.sql
   ```

2. ファイルの内容をすべてコピー

3. SQL Editorにペースト

4. 「Run」ボタン（または `Ctrl+Enter` / `Cmd+Enter`）をクリック

### ステップ4: 実行結果を確認

成功すると、以下のようなメッセージが表示されます：
```
Success. No rows returned
```

### ステップ5: テーブルが作成されたか確認

SQL Editorで以下のクエリを実行：

```sql
-- テーブルが存在するか確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'manuscript%'
ORDER BY table_name;
```

以下の5つのテーブルが表示されるはずです：
- `manuscript_worksheets`
- `manuscript_paragraphs`
- `paragraph_citations`
- `manuscript_sections`
- `manuscript_drafts`

### ステップ6: 開発サーバーを再起動

マイグレーション実行後、開発サーバーを再起動してください：

```bash
# 開発サーバーを停止（Ctrl+C）
# その後、再起動
npm run dev
```

## トラブルシューティング

### エラー: "relation already exists"

テーブルが既に存在する場合、このエラーが表示されることがあります。これは問題ありません。`CREATE TABLE IF NOT EXISTS` を使用しているため、既存のテーブルはそのまま残ります。

### エラー: "permission denied"

Service Role Keyを使用していることを確認してください。RLSポリシーは後で適用されるため、まずテーブルを作成する必要があります。

### スキーマキャッシュの問題

Supabaseはスキーマキャッシュを使用しているため、テーブル作成後すぐに反映されない場合があります。数秒待ってから再度試してください。

### 確認クエリ

テーブルが正しく作成されたか確認：

```sql
-- すべてのmanuscriptテーブルを確認
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name LIKE 'manuscript%'
ORDER BY table_name;
```

## 次のステップ

マイグレーションが完了したら：

1. 開発サーバーを再起動
2. `http://localhost:3000/manuscript` にアクセス
3. ワークシートをアップロードしてみてください

---
最終更新: 2025-11-12 18:26:00 JST






