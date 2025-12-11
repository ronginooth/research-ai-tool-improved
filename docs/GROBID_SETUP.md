# GROBID セットアップガイド

GROBID を使用すると、PDF から高品質なテキストと構造情報を抽出できます。このドキュメントでは、GROBID のセットアップと使用方法を説明します。

## 📋 概要

GROBID は学術論文 PDF を解析して、以下の情報を構造化された形式（TEI/XML）で抽出します：

- タイトル・著者情報
- Abstract（要約）
- セクション構造（Introduction, Methods, Results, Discussion など）
- 段落テキスト
- 参考文献

## 🚀 セットアップ

### 1. Docker で GROBID を起動

```bash
docker run -d --name grobid -p 8070:8070 lfoppiano/grobid:0.7.3
```

### 2. 起動確認

```bash
curl http://localhost:8070/api/isalive
```

`200 OK` が返ってくれば正常に起動しています。

### 3. 環境変数の設定

`.env.local` に以下を追加：

```env
GROBID_BASE_URL=http://localhost:8070
```

## 🔧 使用方法

### 自動的な使用

My Library に PDF を追加すると、自動的に GROBID が使用されます：

1. **PDF をアップロード**：My Library の詳細パネルで PDF をドラッグ＆ドロップ
2. **本文を解析**：「本文を解析」ボタンをクリック
3. **GROBID による解析**：GROBID が利用可能な場合、自動的に高品質な解析が実行されます

### 動作の流れ

1. PDF がアップロードされると、`/api/library/process` が呼び出されます
2. `parsePdfChunks` 関数が GROBID サーバーの可用性をチェック
3. GROBID が利用可能な場合：
   - PDF を GROBID に送信
   - TEI/XML 形式で結果を取得
   - セクション・段落ごとにチャンク化
   - Supabase に保存
4. GROBID が利用できない場合：
   - 既存の簡易 PDF 解析にフォールバック

## 📊 GROBID の利点

### 既存の簡易解析との比較

| 項目 | 簡易解析 | GROBID |
|------|----------|--------|
| 文字化け | 発生しやすい | ほとんど発生しない |
| セクション認識 | なし | あり（Introduction, Methods など） |
| 著者情報 | 抽出不可 | 抽出可能 |
| Abstract | 抽出不可 | 抽出可能 |
| 参考文献 | 抽出不可 | 抽出可能 |
| 処理速度 | 高速 | やや遅い（数秒〜数十秒） |

## 🛠️ トラブルシューティング

### GROBID サーバーに接続できない

- Docker コンテナが起動しているか確認：`docker ps | grep grobid`
- ポート 8070 が使用中でないか確認：`lsof -i :8070`
- 環境変数 `GROBID_BASE_URL` が正しく設定されているか確認

### 解析がタイムアウトする

- 大きな PDF の場合、GROBID の処理に時間がかかることがあります
- タイムアウト時間は現在 2 分に設定されています（`grobid.ts` の `AbortSignal.timeout(120000)`）

### フォールバックが動作しない

- GROBID が利用できない場合、自動的に既存の簡易解析にフォールバックします
- ログに `GROBID error, falling back to basic PDF parsing` と表示されれば正常にフォールバックしています

## 📝 注意事項

- GROBID はローカル環境での使用を想定しています
- 本番環境（Vercel など）で使用する場合は、別途 GROBID サーバーを用意する必要があります
- GROBID は Java ベースのため、メモリ使用量が多めです（推奨: 4GB 以上）

## 🔗 参考リンク

- [GROBID 公式ドキュメント](https://grobid.readthedocs.io/)
- [GROBID GitHub リポジトリ](https://github.com/kermitt2/grobid)
- [Docker Hub - GROBID](https://hub.docker.com/r/lfoppiano/grobid)

---
最終更新: 2025-11-12 13:31:56 JST

