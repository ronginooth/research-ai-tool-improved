# Volume, Issue, Pages 自動補完機能の実装

## 概要

Semantic Scholarの検索エンドポイントでは`volume`、`issue`、`pages`が取得できないため、論文保存後に個別論文エンドポイントからこれらの情報を取得してデータベースを自動更新する機能を実装しました。

## 実装内容

### 1. 保存後の自動処理に追加

`src/app/api/library/route.ts`の`autoProcess`関数内に、以下の処理を追加しました：

1. **Semantic Scholar論文の判定**: `paper.source === "semantic_scholar"`かつ`paper.paperId`が存在する場合のみ実行
2. **レート制限対策**: APIキーがある場合は2秒、ない場合は3秒待機
3. **個別論文エンドポイントから取得**: `/graph/v1/paper/{paperId}?fields=paperId,volume,issue,pages`
4. **データベース更新**: 取得した情報を`user_library`テーブルに更新

### 2. 実装の詳細

```typescript
// 2. Semantic Scholar論文の詳細情報（volume, issue, pages）を補完
if (paper.source === "semantic_scholar" && paper.paperId) {
  // レート制限対策
  const waitTime = process.env.SEMANTIC_SCHOLAR_API_KEY ? 2000 : 3000;
  await new Promise((resolve) => setTimeout(resolve, waitTime));

  // 個別論文エンドポイントから取得
  const detailResponse = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}?fields=paperId,volume,issue,pages`,
    { headers: s2Headers() }
  );

  if (detailResponse.ok) {
    const detailData = await detailResponse.json();
    const updates: any = {};

    // 既存データがない場合のみ更新
    if (detailData.volume && !data.volume) {
      updates.volume = detailData.volume;
    }
    if (detailData.issue && !data.issue) {
      updates.issue = detailData.issue;
    }
    if (detailData.pages && !data.pages) {
      updates.pages = detailData.pages;
    }

    // 更新がある場合のみデータベースを更新
    if (Object.keys(updates).length > 0) {
      await adminClient
        .from("user_library")
        .update(updates)
        .eq("id", data.id);
    }
  }
}
```

### 3. エラーハンドリング

- **429エラー（レート制限）**: 警告をログに記録（次の保存時に再試行される）
- **その他のエラー**: 警告をログに記録し、処理を継続
- **既存データの保護**: 既に`volume`、`issue`、`pages`が存在する場合は上書きしない

## 処理フロー

1. ユーザーが論文をライブラリに保存
2. 保存処理が完了
3. バックグラウンドで`autoProcess`が開始
4. Semantic Scholar論文の場合：
   - レート制限対策のため待機
   - 個別論文エンドポイントから`volume`、`issue`、`pages`を取得
   - データベースを更新
5. その他の処理（PDF/HTML解析、AI解説生成）を継続

## メリット

1. **自動補完**: ユーザー操作なしで`volume`、`issue`、`pages`が補完される
2. **非同期処理**: 保存レスポンスをブロックしない
3. **既存データの保護**: 既に存在するデータは上書きしない
4. **レート制限対策**: APIキーの有無に応じて待機時間を調整

## 注意事項

1. **Semantic Scholar論文のみ**: PubMed論文は検索時に既に`volume`、`issue`、`pages`を取得しているため、この処理は不要
2. **レート制限**: Semantic Scholar APIのレート制限（1リクエスト/秒）を考慮して待機時間を設定
3. **エラー時の動作**: エラーが発生しても保存処理自体は成功する（バックグラウンド処理のため）

## 関連ドキュメント

- [PUBLICATION_DATE_STORAGE_IMPLEMENTATION.md](./PUBLICATION_DATE_STORAGE_IMPLEMENTATION.md) - `publicationDate`の保存実装
- [SEMANTIC_SCHOLAR_PUBLICATION_DATE_IMPLEMENTATION.md](./SEMANTIC_SCHOLAR_PUBLICATION_DATE_IMPLEMENTATION.md) - `publicationDate`の取得実装

---
最終更新: 2025-12-10 19:01:08 JST

