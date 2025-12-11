# デプロイ手順（実行版）

## ✅ 完了したこと

1. ✅ ビルド成功確認
2. ✅ GitHub への push 完了
3. ✅ デプロイガイド作成

## 📋 次のステップ

### 方法 1: Vercel Web UI（推奨）

1. **Vercel にアクセス**

   - <https://vercel.com> にアクセス
   - GitHub アカウントでログイン

2. **プロジェクトをインポート**

   - 「Add New...」→「Project」を選択
   - GitHub リポジトリ `ronginooth/research-ai-tool-improved` を選択
   - 「Import」をクリック

3. **環境変数を設定**
   - プロジェクト設定で「Environment Variables」を開く
   - 以下を追加：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key (オプション)
GEMINI_API_KEY=your_gemini_api_key (オプション)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
SUPABASE_LIBRARY_BUCKET=library-pdfs
```

4. **デプロイ実行**
   - 「Deploy」をクリック
   - デプロイが完了するまで待機（約 2-3 分）

### 方法 2: Vercel CLI

1. **ログイン**

```bash
cd /Users/makino/Documents/workspace_cursor/Research/Projects/AnswerThis/research-ai-tool-improved
npx vercel login
```

2. **デプロイ**

```bash
npx vercel --prod --yes
```

3. **環境変数の設定**
   - Vercel Web UI で環境変数を設定
   - または、`vercel env add` コマンドで設定

## 🔧 デプロイ後の確認

1. デプロイされた URL（例: `https://research-ai-tool-improved.vercel.app`）にアクセス
2. ホームページが表示されるか確認
3. `/auth` でログインページが表示されるか確認
4. `/settings` で設定ページが表示されるか確認

## 📝 データベースセットアップ

デプロイ前に Supabase で以下を実行：

1. **Supabase プロジェクト作成**

   - <https://supabase.com> でプロジェクトを作成

2. **SQL スキーマ実行**

   - SQL Editor で `database/schema.sql` を実行
   - 追加列 `pdf_storage_path`, `pdf_file_name` により、最新のスキーマを再適用してください

3. **環境変数の取得**

   - Project Settings → API から取得
   - URL, anon key, service_role key をコピー

4. **認証設定（オプション）**

   - Authentication → Providers で Google OAuth を設定
   - Redirect URLs に `https://your-app.vercel.app/auth/callback` を追加

5. **ストレージバケット作成**
   - Storage → Buckets で `library-pdfs` バケットを作成（Public に設定）
   - 既に存在する場合は再作成不要

## 🚀 現在の状態

- ✅ コードは GitHub に push 済み
- ✅ ビルドは成功
- ⏳ Vercel へのデプロイは手動で実行が必要

---

最終更新: 2025-11-11 18:58:10 JST
