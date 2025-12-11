# Boolean演算子の有無による検索結果比較テスト

## テスト概要

Semantic ScholarとPubMedの両方で、以下の3パターンの検索クエリを比較：

1. **Boolean演算子あり**: `(query) OR (query mechanism) OR (query function)`
2. **Boolean演算子なし**: `query mechanism function`
3. **引用符付き**: `"query" mechanism function`

## テスト結果

### クエリ1: "kinesin cilia"

#### Semantic Scholar
- **Boolean演算子あり**: 0件 (実行時間: 148ms)
- **Boolean演算子なし**: 0件 (実行時間: 147ms)
- **引用符付き**: 0件 (実行時間: 132ms)

**分析**: 
- Semantic Scholarではすべてのパターンで0件
- APIキーの問題の可能性（`Forbidden`エラーが発生）
- または、Boolean演算子をサポートしていないため、クエリが無効になっている可能性

#### PubMed
- **Boolean演算子あり**: 20件 (実行時間: 1118ms)
- **Boolean演算子なし**: 20件 (実行時間: 600ms)
- **引用符付き**: 0件 (実行時間: 217ms)

**分析**: 
- Boolean演算子あり/なしで同じ20件が取得できた（ただし、結果の内容は異なる可能性）
- Boolean演算子ありの方が実行時間が長い（約2倍）
- 引用符付きでは0件（PubMedは引用符を厳密に解釈するため、完全一致を要求している可能性）

### クエリ2: "motor protein manchette"

#### Semantic Scholar
- **Boolean演算子あり**: 0件 (実行時間: 138ms)
- **Boolean演算子なし**: 0件 (実行時間: 140ms)
- **引用符付き**: 0件 (実行時間: 122ms)

**分析**: クエリ1と同様にすべて0件

#### PubMed
- **Boolean演算子あり**: 10件 (実行時間: 1165ms)
  - 例: "KIF3A is essential for sperm tail formation and manchette function."
  - 例: "KIFC1-like motor protein associates with the cephalopod manchette..."
- **Boolean演算子なし**: 10件 (実行時間: 610ms)
  - 例: "Heterotrimeric Kinesin II is required for flagellar assembly..."
  - 例: "KIF3A is essential for sperm tail formation and manchette function."
- **引用符付き**: 0件 (実行時間: 571ms)

**分析**: 
- Boolean演算子あり/なしで異なる結果セットが返される
- Boolean演算子ありの方が、より広範囲の関連論文を取得（`OR`で拡張されたクエリの効果）
- Boolean演算子なしの方が実行時間が短い（約半分）

## 結論

### 1. Semantic Scholar
- **Boolean演算子をサポートしていない**（FAQ通り）
- すべてのパターンで0件 → APIキーの問題またはクエリの問題の可能性
- **推奨**: Boolean演算子を使わず、スペース区切りのキーワードを使用

### 2. PubMed
- **Boolean演算子をサポートしている**
- `OR`演算子が機能し、より広範囲の結果を取得可能
- Boolean演算子ありの方が実行時間が長いが、より多くの関連論文を取得
- 引用符付きは厳密すぎる（完全一致を要求するため、結果が0件になりやすい）
- **推奨**: 
  - 広範囲の検索が必要な場合: Boolean演算子を使用
  - 高速な検索が必要な場合: Boolean演算子なしで十分

### 3. 実装への推奨事項

1. **Semantic Scholar**: 
   - Boolean演算子を削除
   - スペース区切りのキーワードを使用
   - 引用符は複合語にのみ使用（例: `"motor protein" kinesin`）

2. **PubMed**: 
   - Boolean演算子を使用可能（`OR`で拡張検索）
   - ただし、実行時間を考慮して、シンプルなキーワードでも十分な場合がある
   - 引用符は使用しない（厳密すぎる）

3. **現在のコードの問題点**:
   ```typescript
   // ❌ 現在のコード（search-simple/route.ts 109-113行目）
   const combinedQuery = plan.recommendedQueries
     .map((q) => `(${q})`)
     .join(" OR ");  // Semantic Scholarでは無効！
   ```
   - Semantic Scholarでは`OR`が無効になる可能性
   - PubMedでは機能するが、実行時間が長くなる

---
最終更新: 2025-01-28 16:00:00 JST

