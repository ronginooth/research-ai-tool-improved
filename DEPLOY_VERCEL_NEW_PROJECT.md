# Vercel新規プロジェクトデプロイガイド

このガイドでは、GitHubリポジトリからVercelに**新しいプロジェクト**としてデプロイする手順を説明します。

## 📋 前提条件

- ✅ GitHubリポジトリ: `ronginooth/research-ai-tool-improved`
- ✅ コードはGitHubにプッシュ済み
- ✅ Vercelアカウント（GitHubアカウントでログイン可能）

## 🚀 デプロイ手順

### Step 1: Vercelにアクセス

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. GitHubアカウントでログイン（まだの場合）

### Step 2: 新規プロジェクトを作成

1. **「Add New...」** ボタンをクリック
2. **「Project」** を選択
3. GitHubリポジトリ一覧から **`ronginooth/research-ai-tool-improved`** を選択
4. **「Import」** をクリック

### Step 3: プロジェクト設定

#### 基本設定

- **Project Name**: `research-ai-tool-improved-v2` （既存プロジェクトと区別するため）
- **Framework Preset**: Next.js（自動検出されるはず）
- **Root Directory**: `./` （そのまま）
- **Build Command**: `npm run build` （自動設定される）
- **Output Directory**: `.next` （自動設定される）
- **Install Command**: `npm install` （自動設定される）

#### 環境変数の設定

**「Environment Variables」** セクションで以下を追加：

##### 必須環境変数

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_LIBRARY_BUCKET=library-pdfs
```

##### オプション環境変数（AI機能を使用する場合）

```
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
```

##### アプリケーション設定

```
NEXT_PUBLIC_APP_URL=https://your-new-app-name.vercel.app
```

**注意**: `NEXT_PUBLIC_APP_URL` は、デプロイ後にVercelが自動で割り当てるURLに更新してください。

### Step 4: デプロイ実行

1. **「Deploy」** ボタンをクリック
2. デプロイが完了するまで待機（約2-3分）
3. デプロイ完了後、URLが表示されます（例: `https://research-ai-tool-improved-v2.vercel.app`）

### Step 5: 環境変数の更新

デプロイ完了後、割り当てられたURLで `NEXT_PUBLIC_APP_URL` を更新：

1. プロジェクト設定 → **「Environment Variables」**
2. `NEXT_PUBLIC_APP_URL` を編集
3. 新しいURLに更新（例: `https://research-ai-tool-improved-v2.vercel.app`）
4. **「Redeploy」** を実行

## 🔧 既存プロジェクトとの違い

### プロジェクト名
- 既存: `research-ai-tool-improved`
- 新規: `research-ai-tool-improved-v2` （推奨）

### ドメイン
- 既存: `https://research-ai-tool-improved.vercel.app`
- 新規: `https://research-ai-tool-improved-v2.vercel.app` （自動割り当て）

### 環境変数
- 既存プロジェクトと同じ環境変数を使用可能
- または、新しいSupabaseプロジェクトを作成して使用

## 📝 デプロイ後の確認事項

### 1. ホームページの確認
- `https://your-app.vercel.app/` が正常に表示されるか

### 2. API動作確認
- `/api/manuscript/worksheets` が動作するか

### 3. 認証機能（オプション）
- `/auth` でログイン/登録ができるか

### 4. データベース接続
- Supabaseの接続が正常か確認

## 🐛 トラブルシューティング

### ビルドエラー

1. **環境変数が設定されているか確認**
   - Vercelのプロジェクト設定 → Environment Variables

2. **ローカルでビルドテスト**
   ```bash
   npm run build
   ```

### 環境変数エラー

- `.env.local` の内容をVercelのEnvironment Variablesに設定
- `NEXT_PUBLIC_` で始まる変数はクライアント側でも使用可能

### データベース接続エラー

- Supabaseのプロジェクト設定を確認
- RLSポリシーが正しく設定されているか確認
- `database/schema.sql` が実行されているか確認

## 📌 次のステップ

1. **カスタムドメインの設定**（オプション）
   - Vercelのプロジェクト設定 → Domains

2. **環境別の設定**
   - Production、Preview、Development環境で異なる環境変数を設定可能

3. **自動デプロイの確認**
   - GitHubにpushすると自動でデプロイされることを確認

---
最終更新: 2025-12-11 13:10:00 JST

