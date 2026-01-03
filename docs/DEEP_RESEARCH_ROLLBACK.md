# Deep Research機能 ロールバック手順

## 概要

このドキュメントは、Deep Research機能の実装をロールバックする手順を説明します。

## ロールバックの種類

### 1. データベースのみロールバック

データベースの変更のみを元に戻す場合：

```bash
# Supabase DashboardのSQL Editorで実行
# database/migrations/rollback_deep_research_tables.sql の内容を実行
```

### 2. コードのみロールバック

コードの変更のみを元に戻す場合：

```bash
# Gitを使用している場合
git checkout HEAD -- src/lib/deep-research-engine.ts
git checkout HEAD -- src/app/api/deep-research/
git checkout HEAD -- src/components/review/ReviewForm.tsx
git checkout HEAD -- src/app/review/page.tsx
```

### 3. 完全ロールバック

データベースとコードの両方を元に戻す場合：

1. データベースロールバック（上記1を実行）
2. コードロールバック（上記2を実行）

## 段階的ロールバック

### Phase 1 ロールバック（データベース）

```sql
-- database/migrations/rollback_deep_research_tables.sql を実行
```

### Phase 2-3 ロールバック（ライブラリ・API）

以下のファイルを削除または元に戻す：

```bash
# ファイル削除
rm -rf src/lib/deep-research-engine.ts
rm -rf src/app/api/deep-research/
```

### Phase 4 ロールバック（UI）

`ReviewForm.tsx`と`review/page.tsx`の変更を元に戻す：

```bash
# Gitを使用している場合
git checkout HEAD -- src/components/review/ReviewForm.tsx
git checkout HEAD -- src/app/review/page.tsx
```

## ロールバック前の確認事項

1. **データバックアップ**: ロールバック前にデータベースのバックアップを取得
2. **既存機能の確認**: 既存のreview機能が正常動作していることを確認
3. **依存関係の確認**: 他の機能がDeep Research機能に依存していないことを確認

## ロールバック後の確認

1. 既存のreview機能（auto/manualモード）が正常動作することを確認
2. データベースにDeep Research関連のテーブルが残っていないことを確認
3. エラーが発生していないことを確認

## トラブルシューティング

### エラー: "relation does not exist"

テーブルが既に削除されている場合：
- ロールバックスクリプトの該当部分をスキップして実行

### エラー: "column does not exist"

カラムが既に削除されている場合：
- `ALTER TABLE ... DROP COLUMN IF EXISTS` を使用しているため、通常は問題ありません

### コードロールバック後のエラー

TypeScriptの型エラーが発生する場合：
- `npm run build` を実行して型チェック
- エラーがあれば、該当ファイルを確認

## 完全削除手順

すべてのDeep Research機能を完全に削除する場合：

1. データベースロールバックスクリプトを実行
2. 以下のファイルを削除：
   - `src/lib/deep-research-engine.ts`
   - `src/app/api/deep-research/` ディレクトリ全体
   - `database/migrations/add_deep_research_tables.sql`
   - `database/migrations/rollback_deep_research_tables.sql`
3. `ReviewForm.tsx`と`review/page.tsx`からDeep Research関連のコードを削除

## 注意事項

- ロールバックを実行すると、Deep Research関連のすべてのデータが削除されます
- 既存のreview機能には影響しません（既存のauto/manualモードは変更していません）
- ロールバック後も、既存のレビューデータは保持されます

---
最終更新: 2025-01-28 15:45:00 JST



