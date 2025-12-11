# 既存論文のメタデータ更新エンドポイント

## 概要

既に保存されている Semantic Scholar 論文について、`volume`、`issue`、`pages`、`publicationDate`（およびそこから抽出した`month`、`day`）を補完するためのエンドポイントを実装しました。

## エンドポイント

### `POST /api/library/update-metadata`

既存論文のメタデータを Semantic Scholar API から取得して更新します。

#### リクエスト

```json
{
  "userId": "demo-user-123",
  "limit": 10
}
```

- `userId` (string, optional): ユーザー ID（デフォルト: "demo-user-123"）
- `limit` (number, optional): 処理する論文の最大数（デフォルト: 10）

#### レスポンス

```json
{
  "success": true,
  "processed": 10,
  "updated": 7,
  "skipped": 2,
  "failed": 1,
  "results": [
    {
      "paperId": "uuid-123",
      "title": "論文タイトル",
      "url": "https://www.semanticscholar.org/paper/...",
      "success": true,
      "error": null,
      "updates": {
        "volume": "123",
        "issue": "5",
        "pages": "45-67",
        "publication_date": "2024-05-15",
        "month": 5,
        "day": 15
      }
    },
    {
      "paperId": "uuid-456",
      "title": "別の論文",
      "url": "https://www.semanticscholar.org/paper/...",
      "success": true,
      "error": null,
      "updates": null,
      "message": "更新する情報がありませんでした（既に全て揃っています）"
    }
  ]
}
```

## 実装内容

### 1. 対象論文の取得

Semantic Scholar 論文（URL に`semanticscholar.org/paper/`が含まれるもの）を取得します。`volume`、`issue`、`pages`、`publication_date`のいずれかが欠けている論文を優先的に処理します。

### 2. paperId の抽出

- URL から`paperId`を抽出（`semanticscholar.org/paper/{paperId}`）
- `paper_id`カラムからも取得を試みる

### 3. Semantic Scholar API から取得

個別論文エンドポイントから以下の情報を取得：

```
GET https://api.semanticscholar.org/graph/v1/paper/{paperId}?fields=paperId,title,volume,issue,pages,publicationDate,year
```

### 4. データベース更新

取得した情報をデータベースに更新します。既存データがある場合は上書きしません。

#### 更新されるフィールド

- `volume`: 論文の巻号
- `issue`: 論文の号
- `pages`: 論文のページ番号
- `publication_date`: 公開日（ISO 8601 形式: "2024-05-15"）
- `month`: 公開月（1-12、`publication_date`から抽出）
- `day`: 公開日（1-31、`publication_date`から抽出）

### 5. publicationDate からの月・日抽出

`publicationDate`が取得できた場合、ISO 8601 形式から`month`と`day`を抽出します：

```typescript
// ISO 8601形式: "2024-05-15" または "2024-05" または "2024"
const dateParts = publicationDate.split("-");
if (dateParts.length >= 2) {
  month = parseInt(dateParts[1]); // 5
}
if (dateParts.length >= 3) {
  day = parseInt(dateParts[2]); // 15
}
```

## レート制限対策

- API キーがある場合: 2 秒待機
- API キーがない場合: 3 秒待機
- 429 エラー（レート制限）の場合: 10 秒待機してからリトライ（1 回のみ）

## 使用例

### cURL

```bash
curl -X POST http://localhost:3000/api/library/update-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user-123",
    "limit": 10
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch("/api/library/update-metadata", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    userId: "demo-user-123",
    limit: 10,
  }),
});

const data = await response.json();
console.log(
  `更新: ${data.updated}件, スキップ: ${data.skipped}件, 失敗: ${data.failed}件`
);
```

## 注意事項

1. **既存データの保護**: 既に存在するデータは上書きしません
2. **レート制限**: Semantic Scholar API のレート制限（1 リクエスト/秒）を考慮して待機時間を設定
3. **エラーハンドリング**: エラーが発生した論文はスキップし、処理を継続
4. **部分的な更新**: `publicationDate`は既にあるが`month`や`day`が欠けている場合も補完します

## 関連ドキュメント

- [VOLUME_ISSUE_PAGES_AUTO_COMPLETE.md](./VOLUME_ISSUE_PAGES_AUTO_COMPLETE.md) - 保存時の自動補完機能
- [PUBLICATION_DATE_STORAGE_IMPLEMENTATION.md](./PUBLICATION_DATE_STORAGE_IMPLEMENTATION.md) - `publicationDate`の保存実装

---

最終更新: 2025-12-10 19:04:47 JST
