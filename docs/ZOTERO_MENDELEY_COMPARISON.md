# Zotero/Mendeley との比較と連携ガイド

## 📊 機能比較

### Zotero/Mendeley の優れている点

#### 1. **Word/LaTeX 統合**

- **Word プラグイン**: Word 文書に直接引用を挿入し、参考文献リストを自動生成
- **LaTeX 統合**: BibTeX 形式でのエクスポートと LaTeX 文書への統合
- **リアルタイム引用**: 文書執筆中に引用を追加・更新できる

#### 2. **ブラウザ拡張機能**

- **ワンクリック保存**: ブラウザから論文情報をワンクリックで保存
- **自動メタデータ取得**: DOI、ISBN、URL から自動的に論文情報を取得
- **複数データベース対応**: PubMed、Google Scholar、Amazon などから情報取得

#### 3. **PDF 管理と注釈**

- **PDF ストレージ**: PDF ファイルを直接管理・保存
- **PDF 注釈**: PDF 内にハイライト、メモ、図形を追加
- **PDF 全文検索**: PDF 内のテキストを検索可能

#### 4. **引用スタイルの豊富さ**

- **10,000+ 引用スタイル**: CSL (Citation Style Language) 形式で多数のスタイルをサポート
- **カスタムスタイル作成**: 独自の引用スタイルを作成可能
- **即座のスタイル変更**: 引用形式を瞬時に変更可能

#### 5. **グループとコラボレーション**

- **グループライブラリ**: 複数人で文献を共有・管理
- **共同注釈**: 他の研究者と PDF に共同で注釈を追加
- **コメント機能**: 文献に対するコメントを共有

#### 6. **オフライン機能**

- **完全オフライン動作**: インターネット接続なしでも動作
- **ローカルデータベース**: すべてのデータをローカルに保存
- **同期オプション**: 必要に応じてクラウドと同期

#### 7. **データの可搬性**

- **標準フォーマット**: BibTeX、RIS、CSV など標準形式でエクスポート
- **クロスプラットフォーム**: Windows、macOS、Linux で同じデータを使用
- **バックアップと復元**: 簡単なデータバックアップと復元

---

## 🔍 現在のツールにない機能（Zotero/Mendeley にあるもの）

### 1. **Word/LaTeX プラグイン**

- ❌ Word 文書への直接引用挿入
- ❌ LaTeX 文書への統合
- ❌ リアルタイム引用更新

### 2. **ブラウザ拡張機能**

- ❌ ブラウザからのワンクリック保存
- ❌ 自動メタデータ取得（DOI から）
- ❌ 複数サイトからの情報取得

### 3. **PDF 注釈機能**

- ❌ PDF 内へのハイライト・メモ追加
- ❌ PDF 全文検索
- ❌ PDF 内の図表抽出

### 4. **引用スタイルの多様性**

- ⚠️ 限定的な引用スタイル（Nature、Cell、Science など主要ジャーナルのみ）
- ❌ 10,000+ の引用スタイルライブラリ
- ❌ カスタムスタイル作成ツール

### 5. **グループ機能**

- ❌ 複数人での文献共有
- ❌ 共同注釈機能
- ❌ コメント共有

### 6. **オフライン機能**

- ⚠️ 部分的オフライン対応（キャッシュあり）
- ❌ 完全オフライン動作

---

## ✨ 現在のツールにある機能（Zotero/Mendeley にないもの）

### 1. **AI 機能**

- ✅ **AI レビュー生成**: 選択した論文から自動的にレビューを生成
- ✅ **研究ギャップ分析**: AI による研究ギャップの特定
- ✅ **論文要約**: AI による自動要約生成
- ✅ **セマンティック検索**: 意味ベースの論文検索

### 2. **引用マップ**

- ✅ **引用ネットワーク可視化**: 論文間の引用関係をグラフで表示
- ✅ **中心性分析**: 論文の影響度を数値化
- ✅ **間接接続探索**: 2 次、3 次の引用関係を発見

### 3. **高度な検索機能**

- ✅ **多層検索戦略**: 完全一致、拡張用語、引用ネットワーク検索
- ✅ **AI ランキング**: 関連性に基づく論文順序付け
- ✅ **複数データベース統合**: Semantic Scholar、PubMed、Google Scholar を統合検索

### 4. **Manuscript 執筆支援**

- ✅ **パラグラフ単位での執筆**: IMRaD 形式での構造化執筆
- ✅ **AI パラグラフ生成**: トピックと引用からパラグラフを自動生成
- ✅ **引用フィールドコード**: Word フィールドコード方式の引用管理
- ✅ **日本語翻訳**: パラグラフの日本語翻訳機能

### 5. **プロジェクト統合**

- ✅ **Cursor チャット連携**: Cursor IDE との統合
- ✅ **プロジェクト管理**: プロジェクトごとの文献管理
- ✅ **研究コンテキスト**: プロジェクトの文脈を考慮した分析

### 6. **Web ベース**

- ✅ **ブラウザから直接利用**: インストール不要
- ✅ **リアルタイム同期**: 複数デバイス間での自動同期
- ✅ **モダンな UI**: レスポンシブデザイン

---

## 🔗 連携方法

### 方法 1: BibTeX/CSL-JSON 形式でのインポート・エクスポート

#### Zotero から現在のツールへ

```typescript
// 1. Zotero から BibTeX をエクスポート
// Zotero → File → Export Library → BibTeX

// 2. BibTeX をパースして現在のツールの形式に変換
import { parseBibTeX } from "@/lib/bibtex-parser";

async function importFromZotero(bibtexContent: string) {
  const papers = parseBibTeX(bibtexContent);

  // 各論文をライブラリに追加
  for (const paper of papers) {
    await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user-123",
        paper: {
          title: paper.title,
          authors: paper.authors.join(", "),
          year: paper.year,
          venue: paper.journal,
          doi: paper.doi,
          // ... その他のフィールド
        },
      }),
    });
  }
}
```

#### 現在のツールから Zotero へ

```typescript
// 1. ライブラリから論文を取得
const response = await fetch("/api/library");
const { papers } = await response.json();

// 2. BibTeX 形式に変換
function exportToBibTeX(papers: Paper[]): string {
  return papers
    .map((paper) => {
      const bibtexKey = generateBibTeXKey(paper);
      return `@article{${bibtexKey},
  title={${paper.title}},
  author={${paper.authors}},
  journal={${paper.venue}},
  year={${paper.year}},
  doi={${paper.doi}}
}`;
    })
    .join("\n\n");
}

// 3. BibTeX ファイルをダウンロード
const bibtexContent = exportToBibTeX(papers);
const blob = new Blob([bibtexContent], { type: "text/plain" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "library.bib";
a.click();
```

### 方法 2: Zotero API を使用した直接連携

#### Zotero API の設定

1. **Zotero アカウントで API キーを取得**

   - <https://www.zotero.org/settings/keys> にアクセス
   - 「Create New Key」をクリック
   - 必要な権限を設定（Library: Read, Write）

2. **API エンドポイントの実装**

```typescript
// src/lib/zotero-integration.ts

const ZOTERO_API_BASE = "https://api.zotero.org";
const ZOTERO_USER_ID = process.env.ZOTERO_USER_ID;
const ZOTERO_API_KEY = process.env.ZOTERO_API_KEY;

export async function syncFromZotero() {
  const response = await fetch(
    `${ZOTERO_API_BASE}/users/${ZOTERO_USER_ID}/items?format=json&limit=100`,
    {
      headers: {
        "Zotero-API-Key": ZOTERO_API_KEY || "",
      },
    }
  );

  const items = await response.json();

  // Zotero のアイテムを現在のツールの形式に変換
  const papers = items.map((item: any) => ({
    title: item.data.title,
    authors:
      item.data.creators
        ?.map((c: any) => `${c.lastName}, ${c.firstName}`)
        .join(", ") || "",
    year: item.data.datePublished?.split("-")[0] || "",
    venue: item.data.publicationTitle || "",
    doi: item.data.DOI || "",
    url: item.data.url || "",
    abstract: item.data.abstractNote || "",
  }));

  return papers;
}

export async function syncToZotero(paper: Paper) {
  const zoteroItem = {
    itemType: "journalArticle",
    title: paper.title,
    creators: paper.authors.split(", ").map((author) => {
      const [lastName, firstName] = author.split(", ");
      return {
        creatorType: "author",
        firstName: firstName || "",
        lastName: lastName || "",
      };
    }),
    date: paper.year?.toString() || "",
    publicationTitle: paper.venue || "",
    DOI: paper.doi || "",
    url: paper.url || "",
    abstractNote: paper.abstract || "",
  };

  const response = await fetch(
    `${ZOTERO_API_BASE}/users/${ZOTERO_USER_ID}/items`,
    {
      method: "POST",
      headers: {
        "Zotero-API-Key": ZOTERO_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([zoteroItem]),
    }
  );

  return await response.json();
}
```

### 方法 3: Mendeley API を使用した連携

#### Mendeley API の設定

1. **Mendeley アカウントでアプリケーションを作成**

   - <https://dev.mendeley.com/> にアクセス
   - 「My Apps」→「Create New App」
   - OAuth 2.0 認証を設定

2. **API エンドポイントの実装**

```typescript
// src/lib/mendeley-integration.ts

const MENDELEY_API_BASE = "https://api.mendeley.com";
const MENDELEY_CLIENT_ID = process.env.MENDELEY_CLIENT_ID;
const MENDELEY_CLIENT_SECRET = process.env.MENDELEY_CLIENT_SECRET;

export async function getMendeleyAccessToken() {
  // OAuth 2.0 フローでアクセストークンを取得
  const response = await fetch(`${MENDELEY_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: MENDELEY_CLIENT_ID || "",
      client_secret: MENDELEY_CLIENT_SECRET || "",
    }),
  });

  const data = await response.json();
  return data.access_token;
}

export async function syncFromMendeley(accessToken: string) {
  const response = await fetch(`${MENDELEY_API_BASE}/documents?limit=100`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const documents = await response.json();

  // Mendeley のドキュメントを現在のツールの形式に変換
  const papers = documents.map((doc: any) => ({
    title: doc.title,
    authors:
      doc.authors
        ?.map((a: any) => `${a.surname}, ${a.given_names}`)
        .join(", ") || "",
    year: doc.year?.toString() || "",
    venue: doc.source || "",
    doi: doc.identifiers?.doi || "",
    url: doc.websites?.[0] || "",
    abstract: doc.abstract || "",
  }));

  return papers;
}
```

### 方法 4: CSL-JSON 形式での連携（推奨）

CSL-JSON は Zotero と Mendeley の両方でサポートされている標準形式です。

```typescript
// src/lib/csl-integration.ts

interface CSLItem {
  id: string;
  type: string;
  title: string;
  author: Array<{ family: string; given: string }>;
  issued: { "date-parts": number[][] };
  "container-title"?: string;
  DOI?: string;
  URL?: string;
  abstract?: string;
}

export function convertCSLToPaper(cslItem: CSLItem): Paper {
  return {
    id: cslItem.id,
    title: cslItem.title,
    authors: cslItem.author.map((a) => `${a.family}, ${a.given}`).join(", "),
    year: cslItem.issued["date-parts"][0]?.[0] || 0,
    venue: cslItem["container-title"] || "",
    doi: cslItem.DOI || "",
    url: cslItem.URL || "",
    abstract: cslItem.abstract || "",
  };
}

export function convertPaperToCSL(paper: Paper): CSLItem {
  const authors = paper.authors.split(", ").map((author) => {
    const [family, given] = author.split(", ");
    return { family: family || "", given: given || "" };
  });

  return {
    id: paper.id,
    type: "article-journal",
    title: paper.title,
    author: authors,
    issued: { "date-parts": [[paper.year || 0]] },
    "container-title": paper.venue || "",
    DOI: paper.doi || "",
    URL: paper.url || "",
    abstract: paper.abstract || "",
  };
}
```

---

## 🚀 実装の優先順位

### Phase 1: 基本的なインポート・エクスポート（高優先度）

1. ✅ BibTeX 形式のエクスポート機能
2. ✅ BibTeX 形式のインポート機能
3. ✅ CSL-JSON 形式のエクスポート機能
4. ✅ CSL-JSON 形式のインポート機能

### Phase 2: API 連携（中優先度）

1. ⏳ Zotero API 連携
2. ⏳ Mendeley API 連携
3. ⏳ 双方向同期機能

### Phase 3: 高度な統合（低優先度）

1. ⏳ Word プラグイン開発
2. ⏳ ブラウザ拡張機能開発
3. ⏳ リアルタイム同期

---

## 📝 まとめ

### Zotero/Mendeley の強み

- **Word/LaTeX 統合**: 文書執筆との密接な統合
- **PDF 管理**: PDF ファイルの直接管理と注釈
- **引用スタイル**: 10,000+ の引用スタイル
- **オフライン機能**: 完全オフライン動作
- **グループ機能**: 共同研究での文献共有

### 現在のツールの強み

- **AI 機能**: レビュー生成、ギャップ分析、要約生成
- **引用マップ**: 引用ネットワークの可視化
- **高度な検索**: セマンティック検索、AI ランキング
- **Manuscript 執筆**: パラグラフ単位での執筆支援
- **Web ベース**: インストール不要、リアルタイム同期

### 推奨される連携戦略

1. **短期**: BibTeX/CSL-JSON 形式でのインポート・エクスポート
2. **中期**: Zotero/Mendeley API を使用した双方向同期
3. **長期**: Word プラグインやブラウザ拡張機能の開発

---

最終更新: 2025-01-28 16:00:00 JST

