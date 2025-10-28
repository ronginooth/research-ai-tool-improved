import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "ユーザーIDが必要です" },
        { status: 400 }
      );
    }

    // テスト用のMarkdownレビューを作成
    const testReview = {
      user_id: userId,
      title: "KIF6遺伝子多型と心血管リスクに関する研究レビュー",
      topic: "KIF6 polymorphism cardiovascular risk",
      content: `# KIF6遺伝子多型と心血管リスクに関する研究レビュー

## 概要

**KIF6** (Kinesin Family Member 6) 遺伝子の多型は、心血管疾患のリスク因子として注目されている。本レビューでは、KIF6遺伝子多型と心血管リスクに関する最新の研究動向をまとめる。

## 主要な知見

### 1. KIF6遺伝子の機能

KIF6は *kinesin* ファミリーに属するタンパク質で、以下の機能を持つ：

- 細胞内輸送の調節
- 有糸分裂の制御
- 神経細胞の軸索輸送

### 2. 遺伝子多型の影響

研究により、以下の多型が特定されている：

1. **rs20455** - 最も研究されている多型
2. **rs9462535** - 機能的多型
3. **rs9471077** - 新たに発見された多型

### 3. 心血管リスクとの関連

> 複数の大規模コホート研究により、KIF6遺伝子多型が心血管イベントのリスクと関連することが示されている。

#### メタアナリシス結果

以下の研究が重要な知見を提供している：

- Smith et al. (2020) - 大規模コホート研究
- Johnson et al. (2021) - メタアナリシス
- Brown et al. (2022) - 機能解析

### 4. 臨床的意義

\`\`\`python
# KIF6遺伝子型のリスク計算例
def calculate_risk(genotype):
    if genotype == "AA":
        return 1.0  # 基準リスク
    elif genotype == "AG":
        return 1.3  # 中等度リスク
    elif genotype == "GG":
        return 1.8  # 高リスク
    else:
        return None
\`\`\`

## 今後の研究方向

### 未解決の課題

- 遺伝子-環境相互作用の解明
- 個別化医療への応用
- 薬剤反応性との関連

### 研究ギャップ

1. **機序の解明**: KIF6が心血管リスクに影響する分子機序
2. **個別化医療**: 遺伝子型に基づく治療戦略
3. **予防医学**: リスク予測モデルの構築

---

## 結論

KIF6遺伝子多型は心血管リスクの重要な予測因子として注目されている。今後の研究により、より詳細な機序解明と臨床応用が期待される。

### 参考文献

- [1] Smith, J. et al. (2020). "KIF6 polymorphism and cardiovascular risk"
- [2] Johnson, M. et al. (2021). "Meta-analysis of KIF6 studies"
- [3] Brown, K. et al. (2022). "Functional analysis of KIF6 variants"

詳細は [PubMed](https://pubmed.ncbi.nlm.nih.gov/) で検索してください。`,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("user_reviews")
      .insert([testReview])
      .select()
      .single();

    if (error) {
      console.error("Database error creating test review:", error);
      return NextResponse.json(
        { error: `データベースエラーが発生しました: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: data,
      message: "テストレビューを作成しました",
    });
  } catch (error) {
    console.error("Create test review error:", error);
    return NextResponse.json(
      { error: "テストレビューの作成に失敗しました" },
      { status: 500 }
    );
  }
}



















