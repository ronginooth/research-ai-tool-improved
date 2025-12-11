# Semantic Scholar APIキー承認メールの分析

## メールから読み取れる重要な情報

### 1. **APIキーが承認された**
- **APIキー**: `Suexwo3A3d9u1QBBCihHhiJsFYp5rSB7JC1CJfZh`
- リクエストが承認され、APIキーが有効になった
- 以前の403エラーは、APIキーが承認されていなかった可能性が高い

### 2. **レート制限: 1リクエスト/秒（重要）**
```
1 request per second, cumulative across all endpoints.
This means that in a given second you may send only 1 request 
to our system and expect a successful response.
```

**重要なポイント**:
- **すべてのエンドポイントで累積**: 複数のエンドポイントに同時にリクエストを送っても、合計で1リクエスト/秒
- **非常に厳しい制限**: 現在の実装で複数のリクエストを並行して送信している場合、レート制限に引っかかる可能性が高い

### 3. **ヘッダーの設定方法**
```
The API key needs to be sent in the header of the request as x-api-key.
```

**現在の実装**: ✅ 正しく実装されている
- `src/lib/semantic-scholar.ts`で`x-api-key`ヘッダーを設定している

### 4. **帰属表示の要件**
```
Finally, please give Semantic Scholar attribution on your site or cite 
The Semantic Scholar Open Data Platform paper in any published materials 
for contributions made to your service or results, as mentioned in our 
license agreement.
```

**必要な対応**:
- サイトにSemantic Scholarへの帰属表示を追加
- または、公開資料で論文を引用

## 現在の実装への影響

### ✅ 正しく実装されている点

1. **ヘッダーの設定**
   - `x-api-key`として正しく送信されている

2. **フォールバック処理**
   - 403エラー時にAPIキーなしで再試行する処理が実装されている

### ⚠️ 改善が必要な点

1. **レート制限の考慮**
   - 現在、複数のリクエストを並行して送信している可能性がある
   - 1リクエスト/秒の制限を守るため、リクエストを順次処理する必要がある

2. **帰属表示の追加**
   - サイトにSemantic Scholarへの帰属表示を追加する必要がある

## 推奨される対応

### 1. レート制限の実装

現在の実装では、複数のソース（Semantic Scholar、PubMed）を並行して検索している可能性があります。Semantic Scholarのレート制限を守るため、以下の対応が必要です：

```typescript
// レート制限を考慮したリクエストキュー
class RateLimitedRequestQueue {
  private lastRequestTime: number = 0;
  private minInterval: number = 1000; // 1秒 = 1000ms

  async request<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    return await fn();
  }
}
```

### 2. 帰属表示の追加

フッターまたは検索結果ページに以下のような表示を追加：

```html
<div className="attribution">
  <p>
    Search results powered by{" "}
    <a href="https://www.semanticscholar.org/" target="_blank" rel="noopener noreferrer">
      Semantic Scholar
    </a>
  </p>
</div>
```

### 3. APIキーの更新

メールに記載されているAPIキーが現在の`.env.local`に設定されているか確認：

```bash
# .env.localファイルを確認
grep SEMANTIC_SCHOLAR_API_KEY .env.local
```

もし異なる場合は、メールに記載されているキーに更新してください。

## 次のステップ

1. ✅ APIキーが正しく設定されているか確認
2. ⚠️ レート制限を考慮したリクエスト処理の実装
3. ⚠️ Semantic Scholarへの帰属表示の追加
4. ✅ 動作確認（診断エンドポイントで確認）

---
最終更新: 2025-01-28 17:00:00 JST


