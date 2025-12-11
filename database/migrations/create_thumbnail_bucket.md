# サムネイル画像用ストレージバケットの作成手順

サムネイル画像アップロード機能を使用するには、Supabase Storage にバケットを作成する必要があります。

## 手順

### 1. Supabase ダッシュボードにアクセス

1. [Supabase Dashboard](https://app.supabase.com/) にログイン
2. プロジェクトを選択

### 2. Storage セクションに移動

1. 左サイドバーから「Storage」をクリック
2. 「Buckets」タブを選択

### 3. バケットを作成

1. 「New bucket」ボタンをクリック
2. 以下の設定を入力：
   - **Name**: `library-thumbnails`
   - **Public bucket**: ✅ チェックを入れる（公開バケットにする）
   - **File size limit**: `5 MB`（または 5242880 bytes）
   - **Allowed MIME types**:
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `image/webp`
3. 「Create bucket」をクリック

### 4. バケットポリシーの設定（オプション）

セキュリティのため、必要に応じてバケットポリシーを設定できます。

## 確認

バケット作成後、アプリケーションでサムネイル画像のアップロードが正常に動作することを確認してください。

## トラブルシューティング

### エラー: "Bucket not found"

- バケット名が正確に `library-thumbnails` になっているか確認
- バケットが公開設定になっているか確認

### エラー: "バケットの作成に失敗しました"

- Supabase の権限設定を確認
- Service Role Key が正しく設定されているか確認

---

最終更新: 2025-11-20 18:01:45 JST


