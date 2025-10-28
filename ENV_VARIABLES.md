# Vercel Environment Variables

以下の環境変数をVercelの環境変数設定画面でコピー＆ペーストしてください。

## 環境変数リスト

```bash
GEMINI_API_KEY=AIzaSyAs1RybWgIi6z1mT6VC25Ss5G-K25mxVN0

NEXT_PUBLIC_SUPABASE_URL=https://ryywrixjbqcltwujwbdd.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eXdyaXhqYnFjbHR3dWp3YmRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzM0MTAsImV4cCI6MjA3MjQ0OTQxMH0.HVinzCYQR0y4O9VVSQOZxyFmmLqLFBTiJy4DvAciB58

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eXdyaXhqYnFjbHR3dWp3YmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njg3MzQxMCwiZXhwIjoyMDcyNDQ5NDEwfQ.np86Pirr65p_Id0gFkWRxpOwZ1W8WAolPh9Tu2haBmc
```

## 設定方法

### Vercelダッシュボードでの設定

1. プロジェクトの「Settings」>「Environment Variables」に移動
2. 「Add New」をクリック
3. 以下の表を参照して環境変数を追加：

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | `AIzaSyAs1RybWgIi6z1mT6VC25Ss5G-K25mxVN0` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ryywrixjbqcltwujwbdd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eXdyaXhqYnFjbHR3dWp3YmRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzM0MTAsImV4cCI6MjA3MjQ0OTQxMH0.HVinzCYQR0y4O9VVSQOZxyFmmLqLFBTiJy4DvAciB58` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eXdyaXhqYnFjbHR3dWp3YmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njg3MzQxMCwiZXhwIjoyMDcyNDQ5NDEwfQ.np86Pirr65p_Id0gFkWRxpOwZ1W8WAolPh9Tu2haBmc` |

### Vercel CLIでの設定（推奨）

```bash
# Vercel CLIをインストール（まだの場合）
npm i -g vercel

# 環境変数を一括設定
vercel env add GEMINI_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

---

最終更新: 2025-01-28 06:40:00 JST
