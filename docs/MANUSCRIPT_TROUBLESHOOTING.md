# パラグラフライティングシステム トラブルシューティング

## ワークシートのアップロードに失敗する場合

### 1. データベーステーブルが存在しない

**エラーメッセージ:**
- `データベーステーブルが見つかりません`
- `relation "manuscript_worksheets" does not exist`

**解決方法:**

1. Supabaseのダッシュボードにアクセス
2. SQL Editorを開く
3. `database/migrations/add_manuscript_tables.sql` の内容をコピー＆ペースト
4. 「Run」ボタンをクリックして実行

**確認方法:**

```sql
-- テーブルが存在するか確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'manuscript%';
```

### 2. Supabaseクライアントが初期化されていない

**エラーメッセージ:**
- `Supabase client is not initialized`
- `環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定されているか確認してください`

**解決方法:**

`.env.local` ファイルに以下を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**確認方法:**

```bash
# 環境変数が設定されているか確認
echo $NEXT_PUBLIC_SUPABASE_URL
```

### 3. RLS（Row Level Security）ポリシーの問題

**エラーメッセージ:**
- `new row violates row-level security policy`
- `permission denied for table manuscript_worksheets`

**解決方法:**

マイグレーションファイルにRLSポリシーが含まれているか確認し、実行してください。

```sql
-- RLSが有効になっているか確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'manuscript%';
```

### 4. ファイル形式の問題

**エラーメッセージ:**
- `ファイルが指定されていません`
- `Worksheet parsing error`

**解決方法:**

- ファイルが `.md` 形式であることを確認
- ファイルが空でないことを確認
- ワークシートの形式が正しいことを確認（`# タイトル`, `## Introduction`, `### P1: ...` など）

### 5. ネットワークエラー

**エラーメッセージ:**
- `Failed to fetch`
- `Network error`

**解決方法:**

- インターネット接続を確認
- SupabaseのURLが正しいか確認
- ファイアウォールやプロキシの設定を確認

## デバッグ方法

### ブラウザのコンソールを確認

1. ブラウザの開発者ツールを開く（F12）
2. Consoleタブを確認
3. エラーメッセージを確認

### サーバーログを確認

ターミナルで開発サーバーのログを確認：

```bash
# 開発サーバーのログに [Worksheet Upload] で始まるメッセージが表示されます
```

### APIエンドポイントを直接テスト

```bash
# curlで直接テスト
curl -X POST http://localhost:3000/api/manuscript/worksheets/upload \
  -F "file=@your-worksheet.md" \
  -F "userId=demo-user-123"
```

## よくある質問

### Q: マイグレーションを実行したのにエラーが出る

A: 以下を確認してください：
1. マイグレーションが正常に完了したか（エラーメッセージがないか）
2. テーブルが実際に作成されたか（上記のSQLで確認）
3. 開発サーバーを再起動したか

### Q: 環境変数は設定したのにエラーが出る

A: 以下を確認してください：
1. `.env.local` ファイルがプロジェクトルートにあるか
2. 環境変数の値が正しいか（余分なスペースや引用符がないか）
3. 開発サーバーを再起動したか（環境変数の変更は再起動が必要）

### Q: ワークシートはアップロードできたが、パラグラフが表示されない

A: 以下を確認してください：
1. ワークシートの形式が正しいか（`### P1: ...` の形式）
2. パラグラフテーブルにデータが保存されているか：

```sql
SELECT * FROM manuscript_paragraphs 
WHERE worksheet_id = 'your-worksheet-id';
```

---
最終更新: 2025-11-12 18:25:00 JST






