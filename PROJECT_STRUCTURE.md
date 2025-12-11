# 📋 Research AI Tool - プロジェクト構造一覧

最終更新: 2025-01-28 15:45:00 JST

## 🎯 主要ページ一覧

### 1. **ホームページ** (`/`)
- **機能**: アプリケーションのエントリーポイント
- **主な機能**:
  - 論文検索フォーム（標準/レビュー/深掘りモード）
  - クイックアクセスリンク
  - おすすめツール一覧
  - ワークフロー可視化

### 2. **論文検索** (`/search`)
- **機能**: AIを活用した論文検索
- **主な機能**:
  - セマンティック検索
  - フィルタリング（年、ジャーナル、著者等）
  - Web検索統合
  - ライブラリへの保存

### 3. **ライブラリ** (`/library`)
- **機能**: 保存済み論文の管理
- **主な機能**:
  - 論文一覧表示（カード/テーブル/ボードビュー）
  - PDFアップロード・解析（GROBID統合）
  - AI解説生成（落合方式レビュー）
  - **GROBID要約生成**（TL;DR、Findings、Conclusions等）
  - タグ管理
  - PDF/HTMLプレビュー
  - AIチャット（論文に関する質問）

### 4. **レビュー生成** (`/review`)
- **機能**: 落合方式レビューの自動生成
- **主な機能**:
  - レビュー生成（Overview、Background、Method、Results、Discussion、Future Work）
  - レビュー編集・保存
  - レビュー一覧表示

### 5. **原稿管理** (`/manuscript`)
- **機能**: 論文執筆支援ツール
- **ページ構成**:
  - `/manuscript` - ワークシート一覧
  - `/manuscript/[worksheetId]` - ワークシート詳細
  - `/manuscript/[worksheetId]/paragraphs/[paragraphId]` - パラグラフ詳細
- **主な機能**:
  - ワークシート作成・管理（Markdown/CSV形式）
  - パラグラフ生成（AI支援）
  - 引用論文検索・追加
  - セマンティック検索統合
  - トピックセンテンス編集

### 6. **プロジェクト統合** (`/project-integration`)
- **機能**: 研究プロジェクトと連携した論文執筆
- **主な機能**:
  - プロジェクト管理
  - ライブラリとの連携
  - 論文執筆支援

### 7. **引用マップ** (`/tools/citation-map`)
- **機能**: 引用ネットワークの可視化
- **主な機能**:
  - 引用関係のグラフ表示
  - インタラクティブな操作

### 8. **ダッシュボード** (`/dashboard`)
- **機能**: 研究アクティビティの俯瞰
- **主な機能**:
  - 統計情報表示
  - クイックアクション

### 9. **設定** (`/settings`)
- **機能**: アプリケーション設定
- **主な機能**:
  - ユーザー設定
  - Supabase設定

### 10. **認証** (`/auth`)
- **機能**: ユーザー認証
- **主な機能**:
  - ログイン/サインアップ

---

## 🔧 主要機能・コンポーネント

### **GROBID統合**
- PDF解析・構造化データ抽出
- TEI/XML形式でのデータ保存
- セクション、著者、要約の自動抽出

### **AI要約生成**（新規追加）
- GROBIDデータを活用した要約生成
- 12種類の要約項目（TL;DR、Findings、Conclusions等）
- 複数項目の同時生成
- 一覧表示への要約表示

### **AI解説生成**
- 落合方式レビュー
- 図表の読みどころ
- 注意点・補足情報

### **セマンティック検索**
- ベクトル検索による関連論文発見
- Web検索統合
- 引用数フィルタリング

### **テーマシステム**（新規追加）
- 7種類のカラースキーム（オリジナル、ライト、ダーク、ブルー、グリーン、パープル、オレンジ）
- 統一されたデザインシステム
- 共通コンポーネント（Button、Card、Input等）

---

## 📁 ディレクトリ構造

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API エンドポイント
│   │   ├── library/      # ライブラリ関連API
│   │   ├── manuscript/   # 原稿管理API
│   │   ├── search/       # 検索API
│   │   └── review/       # レビューAPI
│   ├── library/          # ライブラリページ
│   ├── manuscript/       # 原稿管理ページ
│   ├── search/           # 検索ページ
│   ├── review/           # レビュー生成ページ
│   └── tools/            # ツールページ
├── components/            # Reactコンポーネント
│   ├── ui/               # UI共通コンポーネント
│   ├── library/          # ライブラリ関連コンポーネント
│   ├── manuscript/       # 原稿管理コンポーネント
│   └── layout/           # レイアウトコンポーネント
├── lib/                   # ユーティリティ・ライブラリ
│   ├── grobid.ts         # GROBID統合
│   ├── paper-ingest.ts   # 論文取り込み処理
│   ├── gemini.ts         # Gemini API（複数キー対応）
│   └── ai-provider-manager.ts  # AIプロバイダー管理
└── contexts/             # React Context
    └── ThemeContext.tsx  # テーマ管理
```

---

## 🎨 デザインシステム

### **カラースキーム**
1. **オリジナル** - 元のslate系デザイン
2. **ライト** - 明るいスカイブルー
3. **ダーク** - ダークモード
4. **ブルー** - ブルー系
5. **グリーン** - グリーン系
6. **パープル** - パープル系
7. **オレンジ** - オレンジ系

### **共通コンポーネント**
- `Button` - 5つのバリアント、3つのサイズ
- `Card` - 4つのバリアント、3つのパディング
- `Input` - ラベル、エラー表示対応
- `ThemeSelector` - カラースキーム選択

---

## 🔌 API エンドポイント主要機能

### **ライブラリ関連**
- `/api/library` - 論文の取得・保存
- `/api/library/process` - PDF処理
- `/api/library/summaries` - GROBID要約生成（新規）
- `/api/library/insights-chat` - AIチャット
- `/api/library/tags` - タグ管理

### **原稿管理関連**
- `/api/manuscript/worksheets` - ワークシート管理
- `/api/manuscript/paragraphs` - パラグラフ管理
- `/api/manuscript/citations` - 引用管理

### **検索・レビュー関連**
- `/api/search-simple` - シンプル検索
- `/api/ai-search` - AI検索
- `/api/review` - レビュー生成

---

## 📊 データベース構造

### **主要テーブル**
- `user_library` - 論文ライブラリ
  - `grobid_data` (JSONB) - GROBID構造化データ
  - `grobid_tei_xml` (TEXT) - GROBID TEI/XML
  - `ai_summary` (JSONB) - AI解説・要約
- `manuscript_worksheets` - ワークシート
- `manuscript_paragraphs` - パラグラフ
- `manuscript_citations` - 引用

---

## 🚀 最近追加された機能

1. **GROBID要約生成** - 12種類の要約項目をAI生成
2. **複数Gemini APIキー対応** - レート制限回避のためのキーローテーション
3. **テーマシステム** - 7種類のカラースキーム選択
4. **統一デザインシステム** - 共通コンポーネントとアイコン統一

---

最終更新: 2025-11-14 11:20:27 JST

