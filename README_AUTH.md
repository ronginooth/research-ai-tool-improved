# ハイブリッド認証システム実装ガイド

## 概要

このアプリケーションは、ハイブリッド認証システムを実装しています：
- **デフォルト**: マルチテナント（共有Supabase Auth）
- **オプション**: ユーザー各自のSupabaseプロジェクト

## 実装内容

### 1. 認証機能

- **ログイン/登録**: `/auth` ページ
- **Google OAuth**: 対応
- **認証状態管理**: `useAuth` フック

### 2. ユーザー設定

- **設定ページ**: `/settings`
- **独自Supabase設定**: URL、Anon Key、Service Role Key（オプション）

### 3. データベーススキーマ

`database/schema.sql` をSupabaseのSQL Editorで実行してください。

主なテーブル：
- `user_settings`: ユーザーの独自Supabase設定
- `user_library`: ユーザーの論文ライブラリ
- `reviews`: レビュー
- `library_pdf_*`: PDF処理関連テーブル

### 4. Row Level Security (RLS)

すべてのテーブルでRLSが有効化されており、ユーザーは自分のデータのみアクセス可能です。

## セットアップ手順

### 1. 環境変数の設定

`.env.local` に以下を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. データベースのセットアップ

1. Supabaseプロジェクトを作成
2. SQL Editorで `database/schema.sql` を実行
3. Authentication > Providers でGoogle OAuthを設定（必要に応じて）

### 3. アプリケーションの起動

```bash
npm run dev
```

## 使用方法

### デフォルトモード（共有Supabase）

1. `/auth` でログイン/登録
2. そのまま使用可能（設定不要）

### 独自Supabaseモード

1. ログイン後、`/settings` にアクセス
2. 独自のSupabase URLとAnon Keyを設定
3. 保存後、そのユーザーのデータは独自のSupabaseに保存されます

## APIルートの動作

すべてのAPIルートは `getSupabaseForUser` を使用して、ユーザー設定に基づいて適切なSupabaseクライアントを取得します。

```typescript
const { adminClient, client, userId } = await getSupabaseForUser(request, userId);
```

## セキュリティ

- RLSポリシーでデータ分離
- ユーザーは自分の設定のみ閲覧・更新可能
- Service Role Keyはサーバーサイドでのみ使用

---
最終更新: 2025-01-28 15:45:00 JST
