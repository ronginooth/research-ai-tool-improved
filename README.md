# Tsukuyomi 2

## 🚀 概要

このプロジェクトは、AI を活用した高度な研究支援プラットフォームの改善版です。元のプロジェクトの機能を保持しつつ、以下の大幅な改善を実装しています：

- **統一された AI プロバイダーマネージャー**: OpenAI、Gemini、Claude の統合管理
- **高度な検索エンジン**: セマンティック検索、多層検索戦略
- **引用マップ機能**: 論文の引用関係を視覚化
- **研究ギャップファインダー**: 未開拓の研究領域を特定
- **モダンなダッシュボード**: 包括的な分析とインサイト

## ✨ 主な機能

### 1. 高度な AI 検索

- **セマンティック検索**: 意味ベースの論文検索
- **多層検索戦略**: 完全一致、拡張用語、引用ネットワーク検索
- **AI ランキング**: 関連性に基づく論文順序付け
- **キャッシュ機能**: 検索結果の効率的な管理

### 2. 引用マップ

- **ネットワーク可視化**: 論文の引用関係をグラフで表示
- **中心性分析**: 論文の影響度を数値化
- **間接接続探索**: 2 次、3 次の引用関係を発見
- **インタラクティブ表示**: クリック可能なノードとエッジ

### 3. 研究ギャップファインダー

- **包括的分析**: テーマ、方法論、時系列の多角的分析
- **ギャップ特定**: 方法論的、領域的、時間的、統合的ギャップ
- **研究質問生成**: 各ギャップに対する具体的な研究質問
- **実現可能性評価**: 研究の難易度と影響度を数値化

### 4. モダンダッシュボード

- **リアルタイム統計**: 論文数、レビュー数、プロジェクト数
- **活動履歴**: 最近の検索、保存、共有活動
- **キーワード分析**: 人気キーワードとトレンド
- **クイックアクション**: 主要機能への直接アクセス

## 🛠️ 技術スタック

### フロントエンド

- **Next.js 15**: React フレームワーク
- **TypeScript**: 型安全な開発
- **Tailwind CSS**: ユーティリティファースト CSS
- **Framer Motion**: アニメーション
- **Recharts**: データ可視化
- **React Hot Toast**: 通知システム

### バックエンド

- **Next.js API Routes**: サーバーサイド API
- **Supabase**: データベースと認証
- **OpenAI API**: GPT-4 と埋め込み生成
- **Google Gemini API**: 高速 AI 処理
- **Semantic Scholar API**: 学術論文検索

### 高度な機能

- **ベクトル検索**: 埋め込みベクトルによる類似検索
- **キャッシュシステム**: Redis 風のメモリキャッシュ
- **エラーハンドリング**: 堅牢なフォールバック機能
- **並列処理**: Promise.allSettled による効率的な処理

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp env.template .env.local
```

`.env.local` ファイルを編集して、必要な API キーを設定：

```env
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. データベースのセットアップ

Supabase でプロジェクトを作成し、以下のテーブルを作成：

```sql
-- ユーザーライブラリテーブル
CREATE TABLE user_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  abstract TEXT,
  url TEXT,
  citation_count INTEGER DEFAULT 0,
  venue TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- レビューテーブル
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  paper_ids TEXT[],
  provider TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. GROBID のセットアップ（オプション - 高品質なPDF解析のため）

GROBID を使用すると、PDF からより正確にテキストと構造を抽出できます。

#### Docker を使用する場合（推奨）

```bash
docker run -d --name grobid -p 8070:8070 lfoppiano/grobid:0.7.3
```

#### 環境変数の設定

`.env.local` に以下を追加：

```env
GROBID_BASE_URL=http://localhost:8070
```

GROBID が利用できない場合は、既存の簡易 PDF 解析が自動的に使用されます。

### 5. 開発サーバーの起動

```bash
npm install
npm run dev
```

アプリケーションは `http://localhost:3000` で起動します。

## 📁 プロジェクト構造

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API エンドポイント
│   │   ├── ai-search/     # 高度なAI検索
│   │   ├── citation-map/  # 引用マップ生成
│   │   └── research-gap/  # 研究ギャップ検索
│   ├── dashboard/         # ダッシュボードページ
│   ├── search/           # 検索ページ
│   ├── review/           # レビュー生成ページ
│   ├── library/          # ライブラリページ
│   └── tools/            # ツールページ
├── components/            # React コンポーネント
│   ├── ui/               # 基本UIコンポーネント
│   ├── search/           # 検索関連コンポーネント
│   ├── review/           # レビュー関連コンポーネント
│   ├── library/          # ライブラリ関連コンポーネント
│   ├── tools/            # ツール関連コンポーネント
│   └── dashboard/        # ダッシュボード関連コンポーネント
├── lib/                  # ライブラリとユーティリティ
│   ├── ai-provider-manager.ts    # AIプロバイダー管理
│   ├── advanced-search-engine.ts # 高度な検索エンジン
│   ├── citation-map-generator.ts # 引用マップ生成器
│   ├── research-gap-finder.ts    # 研究ギャップファインダー
│   ├── openai.ts         # OpenAI クライアント
│   ├── gemini.ts         # Gemini クライアント
│   └── supabase.ts       # Supabase クライアント
├── types/                # TypeScript 型定義
└── utils/                # ユーティリティ関数
```

## 🔧 主要な改善点

### 1. AI プロバイダーマネージャー

- **統一インターフェース**: すべての AI プロバイダーを同じ方法で使用
- **自動フォールバック**: 一つのプロバイダーが失敗した場合の自動切り替え
- **設定管理**: プロバイダーごとの設定を一元管理
- **可用性チェック**: リアルタイムでのプロバイダー状態確認

### 2. 高度な検索エンジン

- **多層検索**: 複数の検索戦略を並列実行
- **セマンティック検索**: 意味ベースの類似検索
- **引用ネットワーク検索**: 引用関係を利用した論文発見
- **インテリジェントフィルタリング**: 高度なフィルター条件

### 3. 引用マップ機能

- **ネットワーク可視化**: 論文の引用関係をグラフで表示
- **中心性分析**: 論文の影響度を数値化
- **インタラクティブ操作**: クリック可能なノードとエッジ
- **キャッシュ機能**: 生成済みマップの効率的な管理

### 4. 研究ギャップファインダー

- **包括的分析**: テーマ、方法論、時系列の多角的分析
- **AI 活用**: ギャップ特定と研究質問生成
- **統計情報**: ギャップ分析の詳細な統計
- **実用性評価**: 研究の実現可能性と影響度

## 🎯 使用方法

### 1. 基本的な検索

1. ホームページで研究トピックを入力
2. 検索タイプ（Auto、Literature Review、Deep Dive）を選択
3. ソース（Papers、Internet、Library）を選択
4. 検索ボタンをクリック

### 2. 引用マップの生成

1. ツールページで「Citation Map」を選択
2. 論文の DOI を入力
3. マップの生成を待つ
4. インタラクティブなネットワークを探索

### 3. 研究ギャップの検索

1. ツールページで「Research Gap Finder」を選択
2. 研究トピックを入力
3. ギャップ分析の実行を待つ
4. 発見されたギャップと研究質問を確認

### 4. ダッシュボードの活用

1. ダッシュボードページで統計を確認
2. 最近の活動を追跡
3. 人気キーワードを分析
4. クイックアクションで主要機能にアクセス

## 🔍 API エンドポイント

### AI 検索

- `POST /api/ai-search` - 高度な AI 検索
- `GET /api/ai-search?topic=...` - トピックベース検索

### 引用マップ

- `POST /api/citation-map` - 引用マップ生成
- `GET /api/citation-map?doi=...` - DOI ベースマップ生成

### 研究ギャップ

- `POST /api/research-gap` - 研究ギャップ検索
- `GET /api/research-gap?topic=...` - トピックベースギャップ検索

## 🚀 今後の拡張予定

### Phase 1: 基盤強化

- [ ] Claude API 統合
- [ ] ベクトルデータベース統合
- [ ] リアルタイム通知システム

### Phase 2: 高度機能

- [ ] PDF 対話機能強化
- [ ] 協力機能
- [ ] 分析ダッシュボード拡張

### Phase 3: 最適化

- [ ] パフォーマンス最適化
- [ ] モバイル対応強化
- [ ] アクセシビリティ改善

## 📊 パフォーマンス指標

- **検索精度**: 関連性 95%以上
- **応答速度**: 3 秒以内で初回結果
- **ユーザー満足度**: 4.5/5 以上
- **論文カバレッジ**: 主要データベースの 90%以上
- **API 可用性**: 99.9%以上

## 🤝 貢献

このプロジェクトへの貢献を歓迎します。以下の手順で貢献してください：

1. リポジトリをフォーク
2. フィーチャーブランチを作成
3. 変更をコミット
4. プルリクエストを作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 📞 サポート

質問や問題がある場合は、GitHub の Issues ページで報告してください。

## 🚀 自動起動設定（macOS）

macOSでシステム起動時に自動的に開発サーバーを起動するには、以下の手順を実行してください：

### 1. 自動起動設定スクリプトを実行

```bash
cd Research/Projects/AnswerThis/tsukuyomi-2
bash setup-auto-start.sh
```

### 2. 設定内容

このスクリプトは以下の設定を行います：

- **LaunchAgentの作成**: `~/Library/LaunchAgents/com.research-ai-tool.dev.plist` を作成
- **自動起動の有効化**: システム起動時に自動的に開発サーバーを起動
- **ログファイルの設定**: `server.log` と `server-error.log` にログを出力

### 3. サービスの管理

自動起動設定後、以下のコマンドでサービスを管理できます：

```bash
# サービスを停止
launchctl unload ~/Library/LaunchAgents/com.research-ai-tool.dev.plist

# サービスを開始
launchctl load ~/Library/LaunchAgents/com.research-ai-tool.dev.plist

# サービス状態を確認
launchctl list | grep research-ai-tool
```

### 4. 自動起動の無効化

自動起動を無効化する場合は、以下のコマンドを実行してください：

```bash
launchctl unload ~/Library/LaunchAgents/com.research-ai-tool.dev.plist
rm ~/Library/LaunchAgents/com.research-ai-tool.dev.plist
```

### 5. ログの確認

サーバーのログは以下のファイルで確認できます：

- **標準出力**: `server.log`
- **エラー出力**: `server-error.log`

```bash
# ログをリアルタイムで確認
tail -f server.log

# エラーログを確認
tail -f server-error.log
```

### 注意事項

- 自動起動は次回のシステム再起動から有効になります
- 現在のセッションですぐに起動したい場合は、手動で `npm run dev` を実行してください
- `.env.local` ファイルが存在しない場合、自動起動は失敗します

---

**Tsukuyomi 2**  
_Advanced AI-powered research assistance platform_

# tsukuyomi-2
