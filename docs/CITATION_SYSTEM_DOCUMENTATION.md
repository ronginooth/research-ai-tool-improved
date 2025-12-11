# 引用追加システムの説明

## 概要

このシステムは、Manuscript（論文執筆）機能において、パラグラフに引用論文を追加・管理するためのシステムです。

## システム構成

### 1. データベース構造

#### `paragraph_citations` テーブル

- `id`: UUID（主キー）
- `paragraph_id`: UUID（`manuscript_paragraphs`テーブルへの外部キー）
- `paper_id`: UUID（`user_library`テーブルへの外部キー）
- `citation_context`: TEXT（引用が使用されている文脈）
- `citation_order`: INTEGER（パラグラフ内での引用の順序）
- `created_at`: TIMESTAMP

#### `user_library` テーブル

- 論文の基本情報を保存
- `id`: UUID（主キー）
- `title`: 論文タイトル
- `authors`: 著者名（文字列または配列）
- `year`: 発行年
- `venue`: ジャーナル名
- `doi`: DOI
- `url`: 論文 URL
- その他のメタデータ

#### `manuscript_paragraphs` テーブル

- パラグラフの情報を保存
- `id`: UUID（主キー）
- `worksheet_id`: UUID（ワークシートへの外部キー）
- `paragraph_number`: TEXT（P1, P2 など）
- `section_type`: TEXT（introduction, methods, results, discussion）
- `title`: パラグラフのタイトル
- `content`: パラグラフの内容

### 2. 引用追加のフロー

#### ステップ 1: 論文の検索

- ユーザーはパラグラフ編集画面で「引用を追加」ボタンをクリック
- 検索画面が表示され、以下の方法で論文を検索可能：
  - **Web 検索**: Semantic Scholar API を使用して論文を検索
  - **ライブラリ検索**: 既に保存されている論文を検索

#### ステップ 2: 論文の保存確認

- 検索結果から論文を選択すると、以下の処理が実行される：

```typescript
handleAddCitation(paperIdOrPaper: string | Paper)
```

1. **既にライブラリに保存されているかチェック**

   - `savedPaperIds` Set で確認
   - 保存済みの場合、既存の UUID を検索して取得

2. **未保存の場合、ライブラリに保存**

   - `/api/library` (POST) を呼び出して論文を保存
   - レスポンスから UUID を取得
   - エラー「既にライブラリに保存されています」の場合、エラーレスポンスから既存の UUID を取得

3. **引用をパラグラフに追加**
   - `/api/manuscript/paragraphs/${paragraphId}/citations` (POST) を呼び出し
   - `paperId`（UUID）、`citationContext`、`citationOrder`を送信
   - `citationOrder`が未指定の場合、既存の引用の最大順序+1 が自動設定される

#### ステップ 3: 引用の表示

- パラグラフ編集画面に引用リストが表示される
- 各引用には以下が表示される：
  - 論文タイトル
  - 著者名（年）
  - ジャーナル名
  - 削除ボタン

### 3. API エンドポイント

#### `/api/manuscript/paragraphs/[id]/citations` (GET)

- パラグラフに紐づく引用論文一覧を取得
- レスポンス: `{ citations: Citation[] }`

#### `/api/manuscript/paragraphs/[id]/citations` (POST)

- パラグラフに引用論文を追加
- リクエストボディ:

  ```json
  {
    "userId": "demo-user-123",
    "paperId": "uuid",
    "citationContext": "optional context",
    "citationOrder": 1
  }
  ```

- レスポンス: `{ citation: Citation }`

#### `/api/manuscript/paragraphs/[id]/citations/[citationId]` (DELETE)

- 引用を削除

#### `/api/manuscript/worksheets/[id]/citations` (GET)

- ワークシート全体の引用を取得
- すべてのパラグラフの引用を集約して返す
- レスポンス: `{ citations: Citation[] }`

#### `/api/library` (POST)

- 論文をライブラリに保存
- リクエストボディ:

  ```json
  {
    "id": "paperId",
    "title": "Paper Title",
    "authors": "Author1, Author2",
    "year": 2020,
    "venue": "Nature",
    "doi": "10.xxxx/xxxxx",
    ...
  }
  ```

- レスポンス: `{ success: true, paper: {...} }` または `{ success: false, error: "...", paper: {...} }` (既存の場合)

#### `/api/manuscript/citations/search`

- ライブラリ内の論文を検索

### 4. 引用の管理

#### 引用の順序

- 各パラグラフ内で`citation_order`フィールドで管理
- 引用を追加する際、既存の最大順序+1 が自動設定される
- 手動で順序を指定することも可能

#### 引用の削除

- パラグラフ編集画面で各引用の横にある削除ボタンをクリック
- `/api/manuscript/paragraphs/[id]/citations/[citationId]` (DELETE) が呼び出される
- 削除後、引用リストが自動更新される

### 5. 論文ビューでの引用表示

#### Reference セクション

- 論文ビューの最後に Reference セクションが表示される
- ワークシート全体の引用が集約されて表示される

#### 引用形式の選択

- **Nature**: 6 名以下は全員、7 名以上は最初の 6 名+et al.
- **Cell**: 6 名以下は全員、7 名以上は最初の 3 名+et al.
- **Science**: 5 名以下は全員、6 名以上は最初の 5 名+et al.
- **J. Cell. Biol.**: 3 名以下は全員、4 名以上は最初の 3 名+et al.
- **eLife**: 5 名以下は全員、6 名以上は最初の 5 名+et al.、記事番号を使用

#### 順序の選択

- **ABC 順（アルファベット順）**: 著者名の姓（Family name）でソート
- **出現順（番号付き）**: パラグラフ内での出現順に番号を付けて表示

### 6. データフロー図

```
ユーザー操作
    ↓
論文検索（Web検索 or ライブラリ検索）
    ↓
論文選択
    ↓
handleAddCitation()
    ↓
既にライブラリに保存されているか？
    ├─ Yes → 既存UUIDを取得
    └─ No → /api/library (POST) で保存 → UUIDを取得
    ↓
/api/manuscript/paragraphs/[id]/citations (POST)
    ↓
引用がパラグラフに追加される
    ↓
引用リストが更新される
```

### 7. 重要なポイント

1. **論文 ID の管理**

   - 外部 API（Semantic Scholar）の`paperId`と、内部データベースの`id`（UUID）は別物
   - 引用を追加する際は、必ず`user_library`テーブルの UUID を使用

2. **重複チェック**

   - 同じ論文が既にライブラリに保存されている場合、新規保存せずに既存の UUID を使用
   - API レスポンスのエラーメッセージから既存の UUID を取得する仕組み

3. **引用の順序**

   - `citation_order`はパラグラフ内での順序を表す
   - 論文ビューでの出現順ソートでは、パラグラフ番号と`citation_order`を組み合わせてソート

4. **引用形式の拡張**
   - `src/lib/manuscript/citation-formats.ts`に新しいジャーナル形式を追加可能
   - 各形式は`CitationFormatConfig`インターフェースに従って定義

### 8. 実装の詳細

#### 引用形式の選択 UI

- 論文ビューモードで、ビューモード切り替えボタンの横に表示
- ドロップダウンで 5 つのジャーナル形式から選択可能
- 選択した形式が即座に Reference セクションに反映される

#### ジャーナル名の処理

- `formatJournal`関数で、venue フィールドを優先的に使用
- venue が存在し、設定のジャーナル名と一致しない場合は venue を使用
- venue が空または設定のジャーナル名と一致する場合は略称を使用

#### アルファベット順ソート

- `extractLastName`関数で著者名から姓（Family name）を抽出
- カンマがある場合（"Smith, J. A."）はカンマの前を姓として使用
- カンマがない場合（"Smith J. A."）は最初の単語を姓として使用
- `localeCompare`で大文字小文字を区別せずにソート

### 9. ファイル構成

```
src/
├── lib/manuscript/
│   ├── citation-formats.ts      # 引用形式の定義
│   └── citation-formatter.ts    # 引用フォーマッター関数
├── app/
│   ├── api/manuscript/
│   │   ├── paragraphs/[id]/citations/
│   │   │   └── route.ts        # パラグラフの引用取得・追加API
│   │   └── worksheets/[id]/citations/
│   │       └── route.ts        # ワークシート全体の引用取得API
│   └── manuscript/
│       └── [worksheetId]/
│           ├── page.tsx        # パラグラフ一覧・論文ビュー
│           └── paragraphs/[paragraphId]/
│               └── page.tsx    # 個別パラグラフ編集画面
```

---

最終更新: 2025-01-28
