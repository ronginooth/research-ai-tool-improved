# Semantic Scholar API キーリクエストフォーム入力ガイド

## フォームへのアクセス

[Semantic Scholar API キーリクエストフォーム](https://www.semanticscholar.org/product/api#api-key-form)にアクセスしてください。

## 必要な情報

フォームには以下の情報が必要です：

### 1. **名前 (Name)**

- フルネームを入力
- 例: `Tsukasa Makino` または `牧野 司`

### 2. **メールアドレス (Email)**

- Semantic Scholar アカウントに登録されているメールアドレス
- API キーがこのメールアドレスに送信されます

### 3. **組織名 (Organization)**

- 所属する組織・大学・会社名
- 例: `University of Tokyo` または `個人研究`

### 4. **使用目的 (Use Case / Purpose)**

- API を使用する目的を説明
- 推奨される説明文（英語版）:

```
I am developing a research support platform called "Tsukuyomi" that integrates academic paper search, citation, and analysis features. I would like to use the Semantic Scholar API to implement the following functionalities:

Primary use cases:
- Paper search functionality (integration with Semantic Scholar and PubMed)
- Citation network visualization
- Paper metadata retrieval (title, authors, abstract, citation count, etc.)
- Integration with research project management tools

This platform is being developed as an open-source tool for researchers, with the goal of improving the efficiency of academic research. The API will be used to provide users with comprehensive access to scholarly literature and enhance their research workflow.
```

**日本語版（参考）**:

```
研究支援プラットフォーム「Tsukuyomi」の開発において、学術論文の検索・引用・分析機能を実装するために使用します。

主な用途:
- 論文検索機能（Semantic Scholar、PubMed との統合）
- 引用ネットワークの可視化
- 論文のメタデータ取得（タイトル、著者、要約、引用数など）
- 研究プロジェクト管理ツールとの連携

本プラットフォームは研究者向けのオープンソースツールとして開発しており、学術研究の効率化を目的としています。
```

### 5. **使用するエンドポイント (Which endpoints do you plan to use?)** ⚠️ 必須

コードベースで使用しているエンドポイントを指定してください：

```
/graph/v1/paper/search - Paper search endpoint for finding relevant papers
/graph/v1/paper/{paperId} - Paper details endpoint for retrieving paper metadata
/graph/v1/paper/{paperId}/citations - Citations endpoint for getting papers that cite a given paper
/graph/v1/paper/{paperId}/references - References endpoint for getting papers referenced by a given paper
/graph/v1/paper/DOI:{doi} - Paper lookup by DOI
/graph/v1/paper/URL:{url} - Paper lookup by URL
```

**推奨回答（コピー&ペースト）**:

```
/graph/v1/paper/search
/graph/v1/paper/{paperId}
/graph/v1/paper/{paperId}/citations
/graph/v1/paper/{paperId}/references
/graph/v1/paper/DOI:{doi}
/graph/v1/paper/URL:{url}
```

### 6. **1 日のリクエスト数 (How many requests per day do you anticipate using?)** ⚠️ 必須

レート制限（1 リクエスト/秒）を考慮した推奨回答：

```
500-2000 requests per day

This estimate is based on:
- User search queries: approximately 10-50 searches per day
- Each search may trigger 1-2 API calls to /paper/search
- Citation network visualization: 5-20 papers per session, each requiring 2-3 API calls (paper details, citations, references)
- Paper metadata retrieval: 20-100 papers per day

We will implement rate limiting (1 request per second) and caching to stay within the limit and optimize API usage.
```

**日本語での説明**:

- ユーザー検索: 1 日あたり 10-50 回程度
- 各検索で 1-2 回の API 呼び出し
- 引用ネットワーク可視化: セッションあたり 5-20 論文、各論文で 2-3 回の API 呼び出し
- 論文メタデータ取得: 1 日あたり 20-100 論文

### 7. **チェックボックス項目**

以下のチェックボックスをすべてオンにしてください：

- ✅ **I have already successfully made unauthenticated requests**

  - 説明: 既に API キーなしでリクエストを成功させていることを確認

- ✅ **I acknowledge that there are only 2 rate plans**

  - 説明: レートプランが 2 つしかないことを理解していることを確認

- ✅ **I will apply exponential backoff and similar strategies to help protect our systems from overloading**

  - 説明: 指数バックオフなどの戦略を実装してシステムを保護することを約束

- ✅ **I understand that keys that are seen to be inactive for approximately 60 or more days may be removed**

  - 説明: 約 60 日以上非アクティブなキーは削除される可能性があることを理解

- ✅ **I have read and agree to Semantic Scholar™ API License Agreement**
  - 説明: 利用規約に同意

### 8. **利用規約への同意**

- チェックボックスをオンにして利用規約に同意

## 入力例

| 項目                   | 入力例（英語）                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **名前**               | Tsukasa Makino                                                                                                                                                                                 |
| **メールアドレス**     | <your-email@example.com>                                                                                                                                                                       |
| **組織名**             | Personal Research / University Name                                                                                                                                                            |
| **使用目的**           | 上記の英語版推奨説明文を使用                                                                                                                                                                   |
| **使用エンドポイント** | `/graph/v1/paper/search`, `/graph/v1/paper/{paperId}`, `/graph/v1/paper/{paperId}/citations`, `/graph/v1/paper/{paperId}/references`, `/graph/v1/paper/DOI:{doi}`, `/graph/v1/paper/URL:{url}` |
| **1 日のリクエスト数** | 500-2000 requests per day（上記の推奨回答を使用）                                                                                                                                              |
| **チェックボックス**   | すべてオンにする                                                                                                                                                                               |

> **注意**: フォームは英語で記入することを推奨します。使用目的の説明は、上記の英語版テンプレートをそのまま使用するか、必要に応じてカスタマイズしてください。

## フォーム送信後の流れ

1. **フォーム送信**

   - すべての情報を入力し、「Submit」ボタンをクリック

2. **承認待ち**

   - Semantic Scholar チームがリクエストを確認（通常数日）

3. **API キー受信**

   - 承認後、メールで API キーが送信されます
   - メールの件名: "Your Semantic Scholar API Key Request"
   - メール本文に API キーが記載されています

4. **API キーの設定**
   - 受信した API キーを `.env.local` ファイルに設定
   - 詳細は [API_KEY_UPDATE_GUIDE.md](./API_KEY_UPDATE_GUIDE.md) を参照

## 注意事項

### ⚠️ 重要なポイント

1. **メールアドレスの確認**

   - Semantic Scholar アカウントに登録されているメールアドレスを使用
   - 迷惑メールフォルダも確認してください

2. **使用目的の説明**

   - 具体的で明確な説明を記載すると承認されやすい
   - 商用利用の場合はその旨を明記

3. **API キーの管理**

   - API キーは機密情報です。他人と共有しないでください
   - `.env.local` ファイルは Git にコミットしないでください（`.gitignore` に含まれていることを確認）

4. **レート制限**
   - 承認された API キーには **1 リクエスト/秒** のレート制限が適用されます
   - 詳細は [API_KEY_EMAIL_SUMMARY.md](./API_KEY_EMAIL_SUMMARY.md) を参照

## トラブルシューティング

### 問題 1: フォームが表示されない

**対処法**:

- ページをリロード
- ブラウザのキャッシュをクリア
- 別のブラウザで試す

### 問題 2: メールが届かない

**対処法**:

- 迷惑メールフォルダを確認
- メールアドレスが正しいか確認
- 数日待ってから再度確認
- Semantic Scholar のサポートに問い合わせ

### 問題 3: リクエストが承認されない

**対処法**:

- 使用目的の説明をより詳細に記載
- 商用利用の場合は、その旨を明記
- 再度リクエストを送信

## 参考リンク

- [Semantic Scholar API ページ](https://www.semanticscholar.org/product/api)
- [API チュートリアル](https://www.semanticscholar.org/product/api/tutorial)
- [API ドキュメント](https://api.semanticscholar.org/api-docs/)
- [利用規約](https://api.semanticscholar.org/license/)

---

最終更新: 2025-01-28 17:10:00 JST
