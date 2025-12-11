# GROBID デバッグガイド

GROBIDの出力がデータベースに保存されない場合のトラブルシューティングガイドです。

## 確認事項

### 1. データベースのカラムが存在するか確認

SupabaseのSQL Editorで以下を実行して、カラムが存在するか確認してください：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_library' 
AND column_name IN ('grobid_tei_xml', 'grobid_data', 'grobid_processed_at');
```

**カラムが存在しない場合**：
`database/migrations/add_grobid_columns.sql` を実行してください。

### 2. GROBIDサーバーが起動しているか確認

```bash
# Dockerコンテナが起動しているか確認
docker ps | grep grobid

# GROBIDサーバーが応答するか確認
curl http://localhost:8070/api/isalive
```

**期待される結果**: `true` が返される

### 3. 環境変数が設定されているか確認

`.env.local` に以下が設定されているか確認：

```env
GROBID_BASE_URL=http://localhost:8070
```

### 4. 開発サーバーのログを確認

PDFをアップロードして「本文を解析」を実行した際、以下のログが出力されます：

#### GROBIDが使用されている場合：
```
[GROBID Debug] GROBID available: true
[GROBID Debug] Using GROBID for PDF parsing...
[GROBID Debug] GROBID returned TEI XML: true, length: XXXX
[GROBID Debug] Parsed GROBID result: true, sections: X
[GROBID Debug] GROBID extracted X chunks from Y sections
[GROBID Debug] Returning GROBID result with TEI XML and parsed data
[GROBID Debug] paperId: XXX, userId: XXX
[GROBID Debug] grobidTeiXml exists: true, grobidData exists: true
[GROBID Debug] Updating user_library with paperId: XXX
[GROBID Debug] GROBID output saved successfully. Updated rows: 1
```

#### GROBIDが使用されていない場合：
```
[GROBID Debug] GROBID available: false
[GROBID Debug] GROBID not available, using basic PDF parsing
[GROBID Debug] Using fallback PDF parsing, returning X chunks without GROBID data
[GROBID Debug] No GROBID output to save (grobidTeiXml and grobidData are both null)
```

### 5. よくある問題と解決方法

#### 問題1: "GROBID available: false"
**原因**: GROBIDサーバーが起動していない、または環境変数が設定されていない

**解決方法**:
1. GROBIDコンテナを起動: `docker run -d --name grobid -p 8070:8070 lfoppiano/grobid:0.7.3`
2. `.env.local` に `GROBID_BASE_URL=http://localhost:8070` を追加
3. 開発サーバーを再起動

#### 問題2: "No rows updated"
**原因**: `paperId` または `userId` が一致しない

**解決方法**:
1. ログで `paperId` と `userId` を確認
2. Supabaseで `user_library` テーブルを確認し、該当するレコードが存在するか確認
3. `paper_id` と `user_id` が一致しているか確認

#### 問題3: "Failed to save GROBID output"
**原因**: データベースのカラムが存在しない、または権限エラー

**解決方法**:
1. カラムが存在するか確認（上記のSQLを実行）
2. カラムが存在しない場合は、マイグレーションSQLを実行
3. RLSポリシーが正しく設定されているか確認

#### 問題4: "GROBID returned no TEI XML"
**原因**: GROBIDサーバーは応答しているが、PDFの処理に失敗している

**解決方法**:
1. GROBIDコンテナのログを確認: `docker logs grobid`
2. PDFファイルが破損していないか確認
3. PDFファイルサイズが大きすぎないか確認（50MB以下推奨）

### 6. データベースの確認

GROBIDの出力が保存されているか確認：

```sql
SELECT 
  paper_id,
  title,
  grobid_processed_at,
  CASE 
    WHEN grobid_tei_xml IS NOT NULL THEN 'TEI XML exists'
    ELSE 'No TEI XML'
  END as tei_xml_status,
  CASE 
    WHEN grobid_data IS NOT NULL THEN 'Data exists'
    ELSE 'No data'
  END as data_status
FROM user_library
WHERE grobid_processed_at IS NOT NULL
ORDER BY grobid_processed_at DESC
LIMIT 10;
```

## デバッグ手順

1. **ログを確認**: 開発サーバーのコンソールで `[GROBID Debug]` で始まるログを確認
2. **GROBIDサーバーの状態を確認**: `curl http://localhost:8070/api/isalive`
3. **データベースのカラムを確認**: 上記のSQLを実行
4. **PDFを再アップロード**: 問題が解決しない場合は、PDFを再アップロードして「本文を解析」を実行

---
最終更新: 2025-11-12 14:15:00 JST







