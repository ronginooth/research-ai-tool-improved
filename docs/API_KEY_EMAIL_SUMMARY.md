# Semantic Scholar API キー承認メールの要約

## メールから読み取れる重要な情報

### ✅ 1. API キーが承認された

- **API キー**: `Suexwo3A3d9u1QBBCihHhiJsFYp5rSB7JC1CJfZh`
- リクエストが承認され、API キーが有効になった
- **以前の 403 エラーの原因**: API キーが承認されていなかった可能性が高い

### ⚠️ 2. レート制限: 1 リクエスト/秒（非常に重要）

```
1 request per second, cumulative across all endpoints.
This means that in a given second you may send only 1 request
to our system and expect a successful response.
```

**重要なポイント**:

- **すべてのエンドポイントで累積**: 複数のエンドポイントに同時にリクエストを送っても、合計で 1 リクエスト/秒
- **現在の実装の問題**: `Promise.allSettled`で並行リクエストを送信しているため、レート制限に違反する可能性が高い

### ✅ 3. ヘッダーの設定（正しく実装済み）

```
The API key needs to be sent in the header of the request as x-api-key.
```

- 現在の実装: ✅ `src/lib/semantic-scholar.ts`で正しく実装されている

### ⚠️ 4. 帰属表示の要件（未実装）

```
Finally, please give Semantic Scholar attribution on your site or cite
The Semantic Scholar Open Data Platform paper in any published materials
for contributions made to your service or results, as mentioned in our
license agreement.
```

## 現在の実装の問題点

### 問題 1: 並行リクエストによるレート制限違反

**現在の実装** (`src/app/api/search-simple/route.ts`):

```typescript
// Semantic ScholarとPubMedを並行して検索
const searchPromises: Promise<Paper[]>[] = [];
if (requestedSources.includes("semantic_scholar")) {
  searchPromises.push(searchSemanticScholar(translatedQuery, limit));
}
if (requestedSources.includes("pubmed")) {
  searchPromises.push(searchPubMed(translatedQuery, limit));
}

// 並行実行 - レート制限に違反する可能性
const results = await Promise.allSettled(searchPromises);
```

**問題**: Semantic Scholar のリクエストが他のリクエストと並行して実行されるため、1 リクエスト/秒の制限を守れない可能性がある。

### 問題 2: 複数の Semantic Scholar リクエストが並行実行される可能性

高度な検索モードや複数クエリの場合、複数の Semantic Scholar リクエストが同時に送信される可能性がある。

## 推奨される対応

### 1. レート制限を考慮したリクエスト処理

Semantic Scholar のリクエストを順次処理する必要があります：

```typescript
// レート制限を考慮したリクエストキュー
class SemanticScholarRateLimiter {
  private lastRequestTime: number = 0;
  private minInterval: number = 1000; // 1秒 = 1000ms

  async request<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    return await fn();
  }
}

// 使用例
const rateLimiter = new SemanticScholarRateLimiter();
const ssResults = await rateLimiter.request(() =>
  searchSemanticScholar(query, limit)
);
```

### 2. 帰属表示の追加

フッターまたは検索結果ページに以下のような表示を追加：

```tsx
<div className="attribution text-xs text-gray-500 mt-4">
  <p>
    Search results powered by{" "}
    <a
      href="https://www.semanticscholar.org/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      Semantic Scholar
    </a>
  </p>
</div>
```

### 3. API キーの確認

メールに記載されている API キーが`.env.local`に正しく設定されているか確認：

```bash
# .env.localファイルを確認
grep SEMANTIC_SCHOLAR_API_KEY .env.local
```

## 次のステップ

1. ✅ API キーが正しく設定されているか確認
2. ⚠️ レート制限を考慮したリクエスト処理の実装（優先度高）
3. ⚠️ Semantic Scholar への帰属表示の追加
4. ✅ 動作確認（診断エンドポイントで確認）

---

最終更新: 2025-01-28 17:05:00 JST

