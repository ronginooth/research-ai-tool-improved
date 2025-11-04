# デプロイガイド

## Vercelへのデプロイ手順

### 1. GitHubにリポジトリをプッシュ

```bash
git push origin main
```

### 2. Vercelでプロジェクトをインポート

1. [Vercel](https://vercel.com) にログイン
2. 「Add New...」→「Project」を選択
3. GitHubリポジトリを選択
4. プロジェクト設定を確認

### 3. 環境変数の設定

Vercelのプロジェクト設定で以下の環境変数を設定：

#### 必須環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### オプション環境変数（AI機能を使用する場合）

```env
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
```

#### アプリケーション設定

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 4. デプロイ設定

`vercel.json` が既に設定済みです：
- フレームワーク: Next.js
- ビルドコマンド: `npm run build`
- API関数のタイムアウト: 60秒

### 5. デプロイ実行

GitHubにpushすると自動でデプロイが開始されます。

または、Vercel CLIで手動デプロイ：

```bash
vercel --prod
```

## データベースセットアップ

### Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. SQL Editorで `database/schema.sql` を実行
3. Authentication > Providers でGoogle OAuthを設定（必要に応じて）

### 環境変数の取得

Supabaseプロジェクトの設定から：
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- API Settings > anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- API Settings > service_role → `SUPABASE_SERVICE_ROLE_KEY`

## デプロイ後の確認事項

1. **ホームページ**: `/` が正常に表示されるか
2. **認証**: `/auth` でログイン/登録ができるか
3. **設定**: `/settings` でユーザー設定が保存できるか
4. **API**: ライブラリ機能が動作するか

## トラブルシューティング

### ビルドエラー

- 環境変数が正しく設定されているか確認
- `npm run build` をローカルで実行して確認

### 認証エラー

- SupabaseのAuthentication設定を確認
- リダイレクトURLが正しく設定されているか確認

### データベースエラー

- RLSポリシーが正しく設定されているか確認
- `database/schema.sql` が実行されているか確認

---
最終更新: 2025-01-28 15:45:00 JST