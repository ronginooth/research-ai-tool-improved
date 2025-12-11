# パラグラフライティングシステム統合指示書

## 📋 概要

KIF6 プロジェクトで開発したパラグラフライティングの仕組みを、AnswerThis 研究支援ツールに統合するための包括的な指示書です。このシステムは、IMRaD 形式の論文執筆を支援し、引用論文の管理と AI による文章生成を統合します。

---

## 🎯 システム要件

### 1. コア機能

#### 1.1 ワークシート管理

- **ワークシートのアップロード**: Markdown 形式のワークシートファイル（例：`KIF6_Manuscript_Paragraph_Worksheet.md`）をアップロード可能
- **ワークシートの解析**: パラグラフ構成（P1-P31 など）を自動解析し、セクション構造を抽出
- **ワークシートの編集**: ブラウザ上でワークシートを編集可能
- **セクションファイル連携**: 各パラグラフに対応するセクションファイル（`02_introduction.md`など）との連携

#### 1.2 パラグラフ・セクション管理

- **パラグラフ一覧表示**: すべてのパラグラフ（P1-P31）を階層的に表示
- **セクション別表示**: Introduction, Methods, Results, Discussion に分類表示
- **進捗状況表示**: 各パラグラフの記入状況（✅ 記入済み、⏳ 編集中、❌ 未記入）
- **パラグラフ詳細表示**: クリックでパラグラフの詳細内容を表示・編集

#### 1.3 引用論文管理

- **ライブラリからの選択**: My Library から引用論文を検索・選択
- **Web 検索からの追加**: Semantic Scholar、PubMed、arXiv などから論文を検索・追加
- **引用論文の表示**: 各パラグラフに紐づく引用論文を一覧表示
- **引用論文の追加・削除**: インタラクティブに引用論文を追加・削除
- **引用形式の自動生成**: 選択した引用スタイル（APA、Vancouver、Nature など）に応じて引用形式を自動生成

#### 1.4 AI 文章生成・補完

- **引用論文に基づく文章生成**: 選択した引用論文の内容を分析し、適切な文章を生成
- **文章の補完**: 既存の文章に対して、引用論文の内容を反映して補完
- **引用の統合**: 生成された文章に適切な引用を自動挿入
- **複数引用の統合**: 複数の引用論文を統合した文章生成

#### 1.5 原稿全体との関連表示

- **相互参照表示**: 各パラグラフが原稿全体のどの部分と関連しているかを表示
- **引用の追跡**: 同じ引用論文が使用されている他のパラグラフを表示
- **一貫性チェック**: 原稿全体での引用の一貫性をチェック
- **原稿プレビュー**: 全セクションを統合した原稿のプレビュー表示

---

## 🏗️ システムアーキテクチャ

### 2.1 データベーススキーマ

```sql
-- ワークシートテーブル
CREATE TABLE manuscript_worksheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown形式のワークシート内容
  structure JSONB, -- パラグラフ構造のJSON
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- パラグラフテーブル
CREATE TABLE manuscript_paragraphs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worksheet_id UUID REFERENCES manuscript_worksheets(id) ON DELETE CASCADE,
  paragraph_number TEXT NOT NULL, -- P1, P2, etc.
  section_type TEXT NOT NULL, -- introduction, methods, results, discussion
  title TEXT NOT NULL,
  description TEXT,
  content TEXT, -- 記入済みの内容
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(worksheet_id, paragraph_number)
);

-- パラグラフ-引用論文関連テーブル
CREATE TABLE paragraph_citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paragraph_id UUID REFERENCES manuscript_paragraphs(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES user_library(id) ON DELETE CASCADE,
  citation_context TEXT, -- 引用が使用されている文脈
  citation_order INTEGER, -- 引用の順序
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(paragraph_id, paper_id, citation_order)
);

-- セクションファイルテーブル
CREATE TABLE manuscript_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worksheet_id UUID REFERENCES manuscript_worksheets(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL, -- introduction, methods, results, discussion
  file_name TEXT NOT NULL, -- 02_introduction.md
  content TEXT NOT NULL, -- Markdown形式のセクション内容
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(worksheet_id, section_type)
);

-- 原稿全体テーブル
CREATE TABLE manuscript_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worksheet_id UUID REFERENCES manuscript_worksheets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- 統合された原稿全体
  citation_style TEXT DEFAULT 'apa', -- apa, vancouver, nature, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 API エンドポイント

#### ワークシート管理

```
POST   /api/manuscript/worksheets/upload      # ワークシートアップロード
GET    /api/manuscript/worksheets             # ワークシート一覧取得
GET    /api/manuscript/worksheets/:id         # ワークシート詳細取得
PUT    /api/manuscript/worksheets/:id         # ワークシート更新
DELETE /api/manuscript/worksheets/:id         # ワークシート削除
POST   /api/manuscript/worksheets/:id/parse   # ワークシート解析
```

#### パラグラフ管理

```
GET    /api/manuscript/paragraphs             # パラグラフ一覧取得
GET    /api/manuscript/paragraphs/:id         # パラグラフ詳細取得
PUT    /api/manuscript/paragraphs/:id          # パラグラフ更新
POST   /api/manuscript/paragraphs/:id/generate # AI文章生成
```

#### 引用論文管理

```
GET    /api/manuscript/paragraphs/:id/citations # 引用論文一覧取得
POST   /api/manuscript/paragraphs/:id/citations # 引用論文追加
DELETE /api/manuscript/paragraphs/:id/citations/:citationId # 引用論文削除
POST   /api/manuscript/paragraphs/:id/citations/generate # 引用に基づく文章生成
```

#### セクション管理

```
GET    /api/manuscript/sections                 # セクション一覧取得
GET    /api/manuscript/sections/:id             # セクション詳細取得
PUT    /api/manuscript/sections/:id             # セクション更新
POST   /api/manuscript/sections/:id/sync        # パラグラフと同期
```

#### 原稿管理

```
GET    /api/manuscript/drafts                   # 原稿一覧取得
GET    /api/manuscript/drafts/:id                # 原稿詳細取得
POST   /api/manuscript/drafts/:id/generate       # 原稿全体生成
GET    /api/manuscript/drafts/:id/preview        # 原稿プレビュー
GET    /api/manuscript/drafts/:id/export         # 原稿エクスポート（PDF, DOCX, etc.）
```

#### 引用検索

```
GET    /api/manuscript/citations/search         # ライブラリ内検索
GET    /api/manuscript/citations/web-search     # Web検索（Semantic Scholar, PubMed, etc.）
GET    /api/manuscript/citations/related         # 関連引用論文取得
```

---

## 🎨 UI/UX 設計

### 3.1 メインレイアウト

```
┌─────────────────────────────────────────────────────────────┐
│  Manuscript Writing System                                   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ ワークシート  │  パラグラフ一覧 / セクション表示              │
│ 管理パネル    │                                              │
│              │  ┌────────────────────────────────────────┐  │
│ - アップロード│  │ P1: 背景・既知の事実                  │  │
│ - 新規作成    │  │ ✅ 記入済み                           │  │
│ - 一覧表示    │  │ [引用: 3件] [編集] [生成]            │  │
│              │  └────────────────────────────────────────┘  │
│              │  ┌────────────────────────────────────────┐  │
│              │  │ P2: 文脈整理・先行研究                   │  │
│              │  │ ⏳ 編集中                                │  │
│              │  │ [引用: 5件] [編集] [生成]               │  │
│              │  └────────────────────────────────────────┘  │
│              │  ...                                         │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│  パラグラフ詳細エディタ / 引用論文管理パネル                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 パラグラフ詳細画面

```
┌─────────────────────────────────────────────────────────────┐
│ P1: 背景・既知の事実                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [テキストエディタ]                                           │
│                                                             │
│ Sperm motility is essential for successful fertilization   │
│ and depends on the coordinated function of the flagellar   │
│ axoneme... [引用1] [引用2] [引用3]                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 引用論文 (3件)                                              │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Inaba, 2011 - Sperm motility and axoneme           │    │
│ │ [削除] [詳細] [関連パラグラフ: P2, P15]            │    │
│ └─────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Sironen et al., 2021 - Flagellar structure          │    │
│ │ [削除] [詳細] [関連パラグラフ: P16]                 │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ [+ ライブラリから追加] [+ Web検索から追加]                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ AI生成オプション                                            │
│ [引用論文に基づいて文章生成] [既存文章を補完]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 引用論文検索・追加画面

```
┌─────────────────────────────────────────────────────────────┐
│ 引用論文を追加                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [検索バー]                                                  │
│                                                             │
│ タブ: [My Library] [Semantic Scholar] [PubMed] [arXiv]     │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Inaba, 2011                                         │    │
│ │ Sperm motility and axoneme structure               │    │
│ │ Journal of Cell Biology, 2011                      │    │
│ │ [追加] [プレビュー]                                 │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Sironen et al., 2021                                │    │
│ │ Flagellar structure and function                    │    │
│ │ Nature Reviews Molecular Cell Biology, 2021        │    │
│ │ [追加] [プレビュー]                                 │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI 統合仕様

### 4.1 文章生成プロンプト

```typescript
interface ParagraphGenerationOptions {
  paragraphId: string;
  paragraphTitle: string;
  paragraphDescription: string;
  existingContent?: string;
  citations: Citation[];
  citationStyle: "apa" | "vancouver" | "nature";
  targetWordCount?: number;
  language: "en" | "ja";
}

async function generateParagraphContent(
  options: ParagraphGenerationOptions
): Promise<string> {
  const prompt = `
You are a scientific writing assistant. Generate a paragraph for a research manuscript.

Paragraph Information:
- Title: ${options.paragraphTitle}
- Description: ${options.paragraphDescription}
${
  options.existingContent
    ? `- Existing Content: ${options.existingContent}`
    : ""
}
${
  options.targetWordCount
    ? `- Target Word Count: ${options.targetWordCount}`
    : ""
}

Citations to incorporate:
${options.citations
  .map(
    (citation, index) => `
${index + 1}. ${citation.title} (${citation.authors}, ${citation.year})
   Context: ${citation.context || "General reference"}
   Key points: ${citation.keyPoints?.join(", ") || "N/A"}
`
  )
  .join("\n")}

Requirements:
1. Write in ${options.language === "en" ? "English" : "Japanese"}
2. Use ${options.citationStyle} citation style
3. Integrate all provided citations naturally
4. Maintain scientific accuracy and clarity
5. Follow IMRaD format conventions
${
  options.targetWordCount
    ? `6. Aim for approximately ${options.targetWordCount} words`
    : ""
}

Generate the paragraph content:
  `;

  // AI Provider Managerを使用して生成
  const response = await aiProviderManager.generateText({
    prompt,
    model: "gpt-4-turbo", // または設定に応じて
    temperature: 0.7,
    maxTokens: 2000,
  });

  return response.text;
}
```

### 4.2 文章補完プロンプト

```typescript
async function enhanceParagraphContent(
  paragraphId: string,
  existingContent: string,
  newCitations: Citation[]
): Promise<string> {
  const prompt = `
You are a scientific writing assistant. Enhance an existing paragraph by incorporating new citations.

Existing Paragraph:
${existingContent}

New Citations to Add:
${newCitations
  .map(
    (citation, index) => `
${index + 1}. ${citation.title} (${citation.authors}, ${citation.year})
   Key points: ${citation.keyPoints?.join(", ") || "N/A"}
`
  )
  .join("\n")}

Requirements:
1. Maintain the existing structure and flow
2. Integrate new citations naturally
3. Ensure smooth transitions
4. Maintain scientific accuracy
5. Do not remove existing content unless it contradicts new citations

Enhanced paragraph:
  `;

  const response = await aiProviderManager.generateText({
    prompt,
    model: "gpt-4-turbo",
    temperature: 0.5,
    maxTokens: 2000,
  });

  return response.text;
}
```

### 4.3 引用論文のコンテキスト抽出

```typescript
async function extractCitationContext(
  paperId: string,
  paragraphContext: string
): Promise<CitationContext> {
  // ライブラリから論文の埋め込みを取得
  const paperEmbedding = await getPaperEmbedding(paperId);
  const paragraphEmbedding = await aiProviderManager.generateEmbedding(
    paragraphContext
  );

  // セマンティック検索で関連箇所を抽出
  const relatedChunks = await searchPaperChunks(paperId, paragraphEmbedding, {
    topK: 5,
    minSimilarity: 0.7,
  });

  // AIで要約とキーポイントを抽出
  const summary = await aiProviderManager.generateText({
    prompt: `
Extract key points from the following paper sections that are relevant to this paragraph context:

Paragraph Context: ${paragraphContext}

Paper Sections:
${relatedChunks.map((chunk, i) => `${i + 1}. ${chunk.text}`).join("\n\n")}

Extract:
1. Key points relevant to the paragraph
2. Specific findings or data that support the paragraph
3. Methodological details if relevant
    `,
    model: "gpt-4-turbo",
    temperature: 0.3,
  });

  return {
    keyPoints: extractKeyPoints(summary.text),
    relevantSections: relatedChunks,
    suggestedCitationContext: summary.text,
  };
}
```

---

## 📁 ファイル構造

```
src/
├── app/
│   ├── manuscript/
│   │   ├── page.tsx                    # メインページ
│   │   ├── [worksheetId]/
│   │   │   ├── page.tsx                # ワークシート詳細
│   │   │   ├── paragraphs/
│   │   │   │   └── [paragraphId]/
│   │   │   │       └── page.tsx       # パラグラフ詳細
│   │   │   └── sections/
│   │   │       └── [sectionId]/
│   │   │           └── page.tsx       # セクション詳細
│   │   └── layout.tsx
│   └── api/
│       └── manuscript/
│           ├── worksheets/
│           │   ├── route.ts           # ワークシートCRUD
│           │   ├── [id]/
│           │   │   └── route.ts
│           │   └── upload/
│           │       └── route.ts       # アップロード
│           ├── paragraphs/
│           │   ├── route.ts           # パラグラフCRUD
│           │   ├── [id]/
│           │   │   ├── route.ts
│           │   │   ├── generate/
│           │   │   │   └── route.ts  # AI生成
│           │   │   └── citations/
│           │   │       └── route.ts  # 引用管理
│           │   └── [id]/citations/
│           │       ├── route.ts
│           │       └── [citationId]/
│           │           └── route.ts
│           ├── sections/
│           │   ├── route.ts           # セクションCRUD
│           │   └── [id]/
│           │       ├── route.ts
│           │       └── sync/
│           │           └── route.ts   # パラグラフ同期
│           ├── drafts/
│           │   ├── route.ts           # 原稿CRUD
│           │   └── [id]/
│           │       ├── route.ts
│           │       ├── generate/
│           │       │   └── route.ts  # 原稿生成
│           │       ├── preview/
│           │       │   └── route.ts  # プレビュー
│           │       └── export/
│           │           └── route.ts  # エクスポート
│           └── citations/
│               ├── search/
│               │   └── route.ts      # ライブラリ検索
│               ├── web-search/
│               │   └── route.ts     # Web検索
│               └── related/
│                   └── route.ts     # 関連引用
├── components/
│   └── manuscript/
│       ├── WorksheetManager.tsx      # ワークシート管理
│       ├── ParagraphList.tsx          # パラグラフ一覧
│       ├── ParagraphEditor.tsx        # パラグラフエディタ
│       ├── CitationManager.tsx        # 引用管理
│       ├── CitationSearch.tsx         # 引用検索
│       ├── SectionView.tsx            # セクション表示
│       ├── ManuscriptPreview.tsx      # 原稿プレビュー
│       └── RelatedParagraphs.tsx      # 関連パラグラフ表示
└── lib/
    ├── manuscript/
    │   ├── worksheet-parser.ts        # ワークシート解析
    │   ├── paragraph-generator.ts    # AI文章生成
    │   ├── citation-manager.ts       # 引用管理ロジック
    │   ├── section-sync.ts           # セクション同期
    │   ├── draft-compiler.ts         # 原稿コンパイル
    │   └── citation-formatter.ts     # 引用フォーマット
    └── ... (既存のライブラリ)
```

---

## 🔄 実装ステップ

### Phase 1: データベースと API 基盤

1. データベーススキーマの作成とマイグレーション
2. 基本的な CRUD API の実装
3. ワークシートアップロード・解析機能

### Phase 2: UI 基盤

1. メインページとレイアウト
2. ワークシート管理 UI
3. パラグラフ一覧表示

### Phase 3: パラグラフ編集機能

1. パラグラフエディタ
2. セクションファイル連携
3. 進捗状況表示

### Phase 4: 引用論文管理

1. ライブラリ統合
2. Web 検索機能
3. 引用追加・削除 UI

### Phase 5: AI 統合

1. 文章生成機能
2. 文章補完機能
3. 引用コンテキスト抽出

### Phase 6: 原稿管理

1. 原稿生成機能
2. プレビュー機能
3. エクスポート機能

### Phase 7: 高度な機能

1. 相互参照表示
2. 一貫性チェック
3. 引用追跡

---

## 📝 使用例

### ワークシートのアップロードと解析

```typescript
// ワークシートをアップロード
const formData = new FormData();
formData.append("file", worksheetFile);
formData.append("title", "KIF6 Manuscript Worksheet");

const response = await fetch("/api/manuscript/worksheets/upload", {
  method: "POST",
  body: formData,
});

const worksheet = await response.json();
// 自動的にパラグラフ構造が解析される
```

### パラグラフに引用を追加して文章生成

```typescript
// 引用論文を追加
await fetch(`/api/manuscript/paragraphs/${paragraphId}/citations`, {
  method: "POST",
  body: JSON.stringify({
    paperId: "paper-123",
    citationContext: "Background information on sperm motility",
  }),
});

// AIで文章生成
const generatedContent = await fetch(
  `/api/manuscript/paragraphs/${paragraphId}/generate`,
  {
    method: "POST",
    body: JSON.stringify({
      includeExistingContent: true,
      targetWordCount: 200,
    }),
  }
);
```

### 原稿全体を生成

```typescript
const draft = await fetch(`/api/manuscript/drafts/generate`, {
  method: "POST",
  body: JSON.stringify({
    worksheetId: "worksheet-123",
    citationStyle: "apa",
    includeAllSections: true,
  }),
});
```

---

## 🔍 技術的考慮事項

### パフォーマンス

- パラグラフ一覧の仮想スクロール実装
- 引用論文検索のデバウンス処理
- AI 生成の非同期処理とプログレス表示

### データ整合性

- パラグラフとセクションファイルの同期
- 引用の一貫性チェック
- ワークシートとパラグラフの整合性維持

### ユーザー体験

- 自動保存機能
- 変更履歴の管理
- エラーハンドリングとリカバリー

---

## 📚 参考資料

- KIF6 プロジェクトのワークシート構造: `/Research/Projects/KIF6/05_Writing/manuscript/KIF6_Manuscript_Paragraph_Worksheet.md`
- IMRaD 形式ガイドライン: [Araújo 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3987331/)
- 既存のライブラリ機能: `/Research/Projects/AnswerThis/research-ai-tool-improved/src/app/library/`

---

最終更新: 2025-11-12 18:13:09 JST
