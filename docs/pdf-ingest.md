# PDF 解析パイプライン設計メモ

## 概要

- DOI や手動アップロードから PDF/HTML を取得
- サーバー側で本文テキストを抽出しチャンク化
- 図キャプションを検出して `chunk_type` に `figure_*` を付与
- Supabase `library_pdf_sections/chunks/embeddings` に保存
- AI 解説・チャットが本文コンテキストを参照

---

最終更新: 2025-10-02 12:24:00 JST
