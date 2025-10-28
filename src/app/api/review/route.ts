import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { callGemini } from "@/lib/gemini";
import { Paper, AIProvider } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const {
      topic,
      papers,
      provider = "gemini",
      filters,
      searchMode = "manual",
      focusOnGaps = false,
      projectContext,
    }: {
      topic: string;
      papers: Paper[];
      provider?: AIProvider;
      filters?: any;
      searchMode?: "auto" | "manual";
      focusOnGaps?: boolean;
      projectContext?: string;
    } = await request.json();

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "研究トピックが必要です" },
        { status: 400 }
      );
    }

    if (searchMode === "manual" && (!papers || papers.length === 0)) {
      return NextResponse.json(
        { error: "レビュー対象の論文が必要です" },
        { status: 400 }
      );
    }

    const getOutputTypeInstruction = (outputType: string) => {
      switch (outputType) {
        case "structured":
          return "構造化された文献レビューとして、明確なセクション分けと論理的な流れを重視してください。";
        case "dynamic":
          return "動的リサーチアシスタントとして、実用的でアクション可能な洞察を提供してください。";
        case "deep":
          return "深堀りリサーチとして、詳細な分析と批判的考察を含めてください。";
        default:
          return "包括的で網羅的な文献レビューとして作成してください。";
      }
    };

    const getGapAnalysisInstruction = () => {
      return `研究ギャップ分析に特化した学術的なレビューを作成してください。以下の観点を重視してください：

1. **論文別の具体的な言及**: 各論文でどのような知見が報告されているかを具体的に記述
2. **引用形式の統一**: 各センテンスでどの論文を引用しているかを明確に示す
3. **ギャップの明確化**: 既存研究で何がわかっていて、何がわかっていないかを明確に区別
4. **学術的文体**: 科学論文のIntroductionのような客観的で論理的な記述
5. **引用文献リスト**: 最後に使用した論文の完全な引用リストを含める

プロジェクトコンテキスト: ${projectContext || "なし"}

各論文の内容を正確に反映し、以下の形式で引用してください：
- 論文の主要な知見を述べた後、[1], [2]のように番号で引用
- 複数の論文が同じ知見を支持している場合は [1,2,3]のように記述
- 矛盾する結果がある場合は明確に指摘し、それぞれの論文を引用

この分析を基に、選択されたプロジェクトがどのように研究ギャップを埋めることができるかを具体的に提案してください。`;
    };

    let reviewPapers = papers;
    if (searchMode === "auto" && (!papers || papers.length === 0)) {
      try {
        const searchResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/ai-search`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              topic,
              provider,
              maxPapers: 15,
              filters,
            }),
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          reviewPapers = searchData.papers || [];
        }
      } catch (error) {
        console.error("AI search in review API error:", error);
      }
    }

    const prompt = `
以下の研究トピックについて、${
      searchMode === "auto"
        ? "AIが自動検索・選択した論文を基に"
        : "提供された論文を基に"
    }${
      focusOnGaps ? "研究ギャップ分析に特化した" : "包括的な"
    }文献レビューを作成してください。

研究トピック: "${topic}"

${
  focusOnGaps
    ? getGapAnalysisInstruction()
    : filters
    ? getOutputTypeInstruction(filters.outputType)
    : ""
}

重要な指示:
- この研究トピックは質問形式である可能性があります。質問に対する明確な答えを提供してください。
- 複数の視点から包括的に分析し、異なる研究アプローチや結果を比較してください。
- 最新の研究動向と今後の研究方向性についても言及してください。
- 実用的な応用や意義についても考察してください。
${
  focusOnGaps
    ? "- 特に研究ギャップや未解決問題の特定に重点を置いてください。"
    : ""
}

${
  reviewPapers && reviewPapers.length > 0
    ? `関連論文 (${reviewPapers.length}件):
${reviewPapers
  .map(
    (paper: Paper, index: number) => `
${index + 1}. ${paper.title}
   著者: ${paper.authors}
   年: ${paper.year}
   ジャーナル: ${paper.venue}
   要約: ${paper.abstract}
   引用数: ${paper.citationCount}
   関連度: ${
     paper.searchQuery ? `検索クエリ「${paper.searchQuery}」で発見` : "高"
   }
`
  )
  .join("\n")}`
    : "関連論文はAI検索中です。一般的な知識と最新の研究動向に基づいて包括的なレビューを作成してください。"
}

${
  focusOnGaps
    ? `
以下の構造で学術的な研究ギャップ分析を作成してください：

## 1. 研究背景と目的
- 研究分野の重要性と現状
- 本研究の目的と位置づけ

## 2. 先行研究の系統的レビュー
### 2.1 主要な知見
- 各論文で報告された具体的な知見を論文別に記述
- 統計的結果、効果量、信頼区間などの数値データを含める
- 各知見の後に適切な引用番号を付ける

### 2.2 研究手法の比較
- 各論文の研究デザイン、サンプルサイズ、評価指標を比較
- 手法の違いによる結果の違いを分析

### 2.3 一貫性と矛盾
- 複数の論文で一致する知見
- 矛盾する結果とその原因の考察

## 3. 研究ギャップの特定
### 3.1 未解決の問題
- 既存研究で明らかになっていない重要な問題
- 各ギャップを具体的に記述し、なぜ重要なのかを説明

### 3.2 方法論的制約
- 既存研究の手法上の限界
- サンプルサイズ、追跡期間、評価指標などの不足

### 3.3 理論的ギャップ
- 理論的枠組みの不備
- メカニズムの解明不足

## 4. 研究機会と提案
### 4.1 プロジェクトの貢献可能性
- 選択されたプロジェクトがギャップを埋める方法
- 具体的なアプローチと期待される成果

### 4.2 研究戦略
- 実現可能な研究計画
- 必要なリソースと手法

## 5. 引用文献
- 使用した全論文の完全な引用リスト
- 著者名、タイトル、ジャーナル、年、DOIを含む標準的な学術引用形式
`
    : `
以下の構造で文献レビューを作成してください：

## 1. はじめに
- 研究トピックの背景と重要性
- レビューの目的と範囲

## 2. 研究の背景
- 関連する先行研究の概要
- 研究分野の発展の流れ

## 3. 主要な研究動向
- 各論文の主要な貢献
- 研究手法の比較
- 共通点と相違点

## 4. 研究方法の比較
- 実験手法の違い
- データセットの特徴
- 評価指標の比較

## 5. 主要な発見
- 重要な研究成果
- 新たな知見
- 実用的な応用

## 6. 今後の研究方向
- 未解決の問題
- 今後の研究の可能性
- 技術的課題

## 7. 結論
- レビューのまとめ
- 研究分野の現状と展望

学術的な文体で、適切な引用を含めて作成してください。各論文の内容を正確に反映し、客観的な分析を行ってください。
`
}`;

    let review: string;

    if (provider === "gemini") {
      review = await callGemini(prompt);
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "あなたは学術論文の専門家です。与えられた論文を基に包括的で構造化された文献レビューを作成してください。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      review = completion.choices[0].message.content || "";
    }

    return NextResponse.json({
      review,
      papers: reviewPapers,
      searchMode,
    });
  } catch (error) {
    console.error("Review generation error:", error);
    return NextResponse.json(
      { error: "レビュー生成に失敗しました" },
      { status: 500 }
    );
  }
}
