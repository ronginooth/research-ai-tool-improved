# Semantic Scholar API キーの確認・更新ガイド

## ステップ 1: Semantic Scholar ダッシュボードにアクセス

1. **Semantic Scholar API ページにアクセス**

   - URL: <https://www.semanticscholar.org/product/api>
   - または: <https://www.semanticscholar.org/api>
   - チュートリアル: <https://www.semanticscholar.org/product/api/tutorial>

2. **ログイン**
   - Semantic Scholar アカウントでログイン
   - アカウントがない場合は新規登録

> **注意**: チュートリアルページ（[API Tutorial](https://www.semanticscholar.org/product/api/tutorial)）には、API キーの更新に関する具体的な手順は記載されていません。API キーの管理は、API ページのダッシュボードで行います。

## ステップ 2: API キーの確認

1. **ダッシュボードで API キーを確認**

   - 現在の API キーの状態を確認
   - 有効期限、使用状況、レート制限を確認

2. **現在の API キーの状態を確認**
   - 有効/無効の状態
   - 使用状況（リクエスト数）
   - レート制限の状況

## ステップ 3: 新しい API キーの生成（必要な場合）

1. **新しい API キーを生成**

   - ダッシュボードで「Generate New API Key」または「Create API Key」をクリック
   - 新しい API キーが表示される

2. **API キーをコピー**
   - 表示された API キーをコピー
   - ⚠️ **重要**: API キーは一度しか表示されない場合があるため、必ずコピーして保存

## ステップ 4: 環境変数ファイルの更新

1. **`.env.local`ファイルを開く**

   ```bash
   # プロジェクトルートディレクトリで
   code .env.local
   # または
   nano .env.local
   ```

2. **API キーを更新**

   ```env
   # 既存の行を更新、または新規追加
   SEMANTIC_SCHOLAR_API_KEY=新しいAPIキーをここに貼り付け
   ```

3. **ファイルを保存**

## ステップ 5: サーバーの再起動

1. **開発サーバーを再起動**

   ```bash
   # 現在のサーバーを停止（Ctrl+C）
   # その後、再起動
   npm run dev
   ```

2. **API キーの動作確認**

   ```bash
   # 診断エンドポイントで確認
   curl http://localhost:3000/api/test-semantic-key
   ```

## ステップ 6: 動作確認

1. **診断エンドポイントで確認**

   - ブラウザで `http://localhost:3000/api/test-semantic-key` にアクセス
   - または、ターミナルで `curl http://localhost:3000/api/test-semantic-key`

2. **期待される結果**

   ```json
   {
     "success": true,
     "summary": {
       "apiKeyConfigured": true,
       "headerCorrect": true,
       "apiWorking": true, // ← trueになれば成功
       "status": 200
     }
   }
   ```

3. **実際の検索で確認**
   - トップページで検索を実行
   - Semantic Scholar の結果が表示されることを確認

## トラブルシューティング

### 問題 1: 403 エラーが続く

**原因**:

- API キーが正しく設定されていない
- サーバーが再起動されていない
- API キーが無効

**対処法**:

1. `.env.local`ファイルの API キーを確認（余分なスペースや改行がないか）
2. サーバーを再起動
3. Semantic Scholar ダッシュボードで API キーの状態を確認

### 問題 2: API キーが見つからない

**原因**:

- `.env.local`ファイルが存在しない
- 環境変数名が間違っている

**対処法**:

1. `.env.local`ファイルを作成（`env.template`をコピー）
2. `SEMANTIC_SCHOLAR_API_KEY=...` の行を追加

### 問題 3: レート制限エラー（429）

**原因**:

- 1 日のリクエスト制限を超えた

**対処法**:

1. ダッシュボードで使用状況を確認
2. 翌日まで待つ、または有料プランにアップグレード
3. キャッシュを活用してリクエスト数を減らす

## 現在の API キー状態の確認方法

### 方法 1: 診断エンドポイントを使用

```bash
curl http://localhost:3000/api/test-semantic-key
```

### 方法 2: 環境変数を直接確認（開発環境のみ）

```bash
# .env.localファイルを確認
cat .env.local | grep SEMANTIC_SCHOLAR_API_KEY
```

## チュートリアルから得られた重要な情報

[Semantic Scholar API Tutorial](https://www.semanticscholar.org/product/api/tutorial) によると、以下の情報が重要です：

### API キーの使用方法

1. **ヘッダーに含める**

   ```python
   headers = {"x-api-key": "your_api_key_here"}
   ```

2. **レート制限の改善**

   - API キーを使用すると、**1 リクエスト/秒**のレート制限が自動的に付与される
   - レビュー後に、より高いレートが付与される場合がある
   - API キーなしの場合は、すべての未認証ユーザーと共有のレート制限が適用される

3. **エラーステータスコード**
   - **401 Unauthorized**: 認証されていない、または認証情報が無効
   - **403 Forbidden**: サーバーはリクエストを理解したが、拒否した。リソースにアクセスする権限がない
   - **429 Too Many Requests**: レート制限に達した

### API キーの取得方法

チュートリアルには「Learn more about API keys and how to request one here」という記述があり、API ページで詳細を確認する必要があります。

> **注意**: チュートリアルには API キーの更新手順は記載されていません。API キーの管理（生成、更新、削除）は、Semantic Scholar の API ダッシュボードで行います。

## 参考リンク

- Semantic Scholar API ドキュメント: <https://www.semanticscholar.org/product/api>
- API チュートリアル: <https://www.semanticscholar.org/product/api/tutorial>
- API キーの取得: <https://www.semanticscholar.org/product/api>
- FAQ: <https://www.semanticscholar.org/faq/public-api>
- 利用規約: <https://www.semanticscholar.org/terms>

---

最終更新: 2025-01-28 16:35:00 JST
