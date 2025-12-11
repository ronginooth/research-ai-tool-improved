# Semantic Scholar APIキー問題の解決

## 問題の診断

### 診断結果
- **APIキー設定**: ✅ 設定済み（40文字）
- **ヘッダー設定**: ✅ 正しく設定されている（`x-api-key`含む）
- **API動作**: ❌ 403 Forbiddenエラー

### 原因
APIキーが無効または期限切れの可能性があります。

## 実装した解決策

### 1. フォールバック処理の追加

403エラーが発生した場合、APIキーなしで再試行する処理を追加しました。

**実装箇所**:
- `src/lib/semantic-scholar.ts`: APIキーテスト関数を追加
- `src/app/api/search-simple/route.ts`: 403エラー時のフォールバック処理
- `src/lib/advanced-search-engine.ts`: 403エラー時のフォールバック処理
- `src/app/api/search-test-boolean/route.ts`: テスト用エンドポイントにも適用

### 2. 動作確認

テスト結果:
- **Semantic Scholar**: `without_boolean`パターンで5件の結果を取得 ✅
- **PubMed**: Boolean演算子あり/なしでそれぞれ5件 ✅

### 3. 推奨事項

1. **APIキーの確認**:
   - Semantic Scholarのダッシュボード（https://www.semanticscholar.org/product/api）でAPIキーを確認
   - 新しいAPIキーを生成して`.env.local`に設定

2. **現在の動作**:
   - APIキーが無効でも、APIキーなしで検索が継続されます
   - ただし、APIキーなしの場合はレート制限が厳しくなります

3. **次のステップ**:
   - Boolean演算子の削除（Semantic Scholarはサポートしていないため）
   - 引用符の適切な使用

---
最終更新: 2025-01-28 16:15:00 JST


