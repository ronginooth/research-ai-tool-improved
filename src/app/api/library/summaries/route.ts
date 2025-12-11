import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { callGemini } from "@/lib/gemini";
import { SUMMARY_CATEGORIES, type SummaryCategoryKey } from "@/lib/summary-categories";

const DEFAULT_USER = "demo-user-123";

interface GenerateSummariesRequest {
  paperId: string;
  userId?: string;
  categories: SummaryCategoryKey[];
}

/**
 * GROBIDデータから論文情報を抽出
 */
function extractPaperInfoFromGrobid(grobidData: any): {
  title: string | null;
  authors: string[];
  abstract: string | null;
  sections: Array<{ title: string | null; paragraphs: string[] }>;
  references: string[];
} {
  if (!grobidData) {
    return {
      title: null,
      authors: [],
      abstract: null,
      sections: [],
      references: [],
    };
  }

  return {
    title: grobidData.title || null,
    authors: grobidData.authors || [],
    abstract: grobidData.abstract || null,
    sections: grobidData.sections || [],
    references: grobidData.references || [],
  };
}

/**
 * セクションタイプを判定（Introduction, Methods, Results, Discussion等）
 */
function identifySectionType(sectionTitle: string | null): string {
  if (!sectionTitle) return "unknown";
  
  const title = sectionTitle.toLowerCase();
  if (title.includes("introduction") || title.includes("背景") || title.includes("はじめに")) {
    return "introduction";
  }
  if (title.includes("method") || title.includes("手法") || title.includes("方法")) {
    return "methods";
  }
  if (title.includes("result") || title.includes("結果")) {
    return "results";
  }
  if (title.includes("discussion") || title.includes("考察") || title.includes("議論")) {
    return "discussion";
  }
  if (title.includes("conclusion") || title.includes("結論")) {
    return "conclusion";
  }
  return "other";
}

/**
 * プロンプトを生成
 */
function buildSummaryPrompt(
  category: SummaryCategoryKey,
  paperInfo: ReturnType<typeof extractPaperInfoFromGrobid>
): string {
  const { title, authors, abstract, sections, references } = paperInfo;
  
  // セクションをタイプ別に分類
  const introductionSections = sections.filter(s => identifySectionType(s.title) === "introduction");
  const methodsSections = sections.filter(s => identifySectionType(s.title) === "methods");
  const resultsSections = sections.filter(s => identifySectionType(s.title) === "results");
  const discussionSections = sections.filter(s => identifySectionType(s.title) === "discussion");
  const conclusionSections = sections.filter(s => identifySectionType(s.title) === "conclusion");
  
  let context = "";
  if (title) context += `タイトル: ${title}\n`;
  if (authors.length > 0) context += `著者: ${authors.join(", ")}\n`;
  if (abstract) context += `抄録: ${abstract}\n\n`;
  
  // セクション内容を追加
  if (introductionSections.length > 0) {
    context += "## Introduction\n";
    introductionSections.forEach(section => {
      if (section.title) context += `### ${section.title}\n`;
      section.paragraphs.forEach(p => {
        context += `${p}\n\n`;
      });
    });
  }
  
  if (methodsSections.length > 0) {
    context += "## Methods\n";
    methodsSections.forEach(section => {
      if (section.title) context += `### ${section.title}\n`;
      section.paragraphs.forEach(p => {
        context += `${p}\n\n`;
      });
    });
  }
  
  if (resultsSections.length > 0) {
    context += "## Results\n";
    resultsSections.forEach(section => {
      if (section.title) context += `### ${section.title}\n`;
      section.paragraphs.forEach(p => {
        context += `${p}\n\n`;
      });
    });
  }
  
  if (discussionSections.length > 0) {
    context += "## Discussion\n";
    discussionSections.forEach(section => {
      if (section.title) context += `### ${section.title}\n`;
      section.paragraphs.forEach(p => {
        context += `${p}\n\n`;
      });
    });
  }
  
  if (conclusionSections.length > 0) {
    context += "## Conclusion\n";
    conclusionSections.forEach(section => {
      if (section.title) context += `### ${section.title}\n`;
      section.paragraphs.forEach(p => {
        context += `${p}\n\n`;
      });
    });
  }
  
  // カテゴリ別のプロンプト
  const categoryPrompts: Record<SummaryCategoryKey, string> = {
    tldr: `上記の論文を1-2文で要約してください。最も重要な発見と結論を含めてください。`,
    findings: `上記の論文の主な発見（Findings）を要約してください。重要な結果やデータを含めてください。`,
    conclusions: `上記の論文の結論（Conclusions）を要約してください。`,
    summarizedAbstract: `上記の論文の抄録を要約してください。`,
    results: `上記の論文の結果セクション（Results）を要約してください。重要なデータや図表の説明を含めてください。`,
    summarizedIntroduction: `上記の論文のイントロダクションセクションを要約してください。背景、目的、研究ギャップを含めてください。`,
    methodsUsed: `上記の論文で使用された手法（Methods）を要約してください。実験設計、データ収集方法、分析方法を含めてください。`,
    literatureSurvey: `上記の論文の文献調査・関連研究（Literature Survey）を要約してください。`,
    limitations: `上記の論文の限界（Limitations）を要約してください。`,
    contributions: `上記の論文の貢献（Contributions）を要約してください。`,
    practicalImplications: `上記の論文の実用的な意義（Practical Implications）を要約してください。`,
    objectives: `上記の論文の研究目的（Objectives）を要約してください。`,
    researchGap: `上記の論文で指摘されている研究ギャップ（Research Gap）を要約してください。`,
  };
  
  return `以下の学術論文の情報を基に、${SUMMARY_CATEGORIES[category].label}を生成してください。

${context}

${categoryPrompts[category]}

出力は日本語で、簡潔かつ明確に記述してください。`;
}

/**
 * 要約を生成
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateSummariesRequest;
    const { paperId, userId = DEFAULT_USER, categories } = body;

    if (!paperId) {
      return NextResponse.json(
        { error: "paperId is required" },
        { status: 400 }
      );
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json(
        { error: "At least one category must be selected" },
        { status: 400 }
      );
    }

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // 論文情報とGROBIDデータを取得
    const { data: paper, error: paperError } = await adminClient
      .from("user_library")
      .select("id, title, authors, abstract, grobid_data")
      .eq("paper_id", paperId)
      .eq("user_id", userId)
      .single();

    if (paperError || !paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    // GROBIDデータを取得
    const grobidData = paper.grobid_data as any;
    if (!grobidData) {
      return NextResponse.json(
        { error: "GROBID data not found. Please process the PDF first." },
        { status: 400 }
      );
    }

    // 論文情報を抽出
    const paperInfo = extractPaperInfoFromGrobid(grobidData);
    
    // フォールバック: GROBIDデータがない場合は基本情報を使用
    if (!paperInfo.title) paperInfo.title = paper.title;
    if (paperInfo.authors.length === 0 && paper.authors) {
      paperInfo.authors = typeof paper.authors === "string" 
        ? paper.authors.split(",").map(a => a.trim())
        : [];
    }
    if (!paperInfo.abstract && paper.abstract) {
      paperInfo.abstract = paper.abstract;
    }

    // 各カテゴリの要約を生成
    const summaries: Record<string, string> = {};
    const errors: Record<string, string> = {};

    for (const category of categories) {
      try {
        const prompt = buildSummaryPrompt(category, paperInfo);
        const summary = await callGemini(prompt);
        
        if (summary && summary.trim().length > 0) {
          summaries[category] = summary.trim();
        } else {
          errors[category] = "Empty response from AI";
        }
      } catch (error: any) {
        console.error(`[Summary Generation] Error for category ${category}:`, error);
        errors[category] = error?.message || "Failed to generate summary";
      }
    }

    // 既存のai_summaryを取得してマージ
    const { data: existingPaper } = await adminClient
      .from("user_library")
      .select("ai_summary")
      .eq("paper_id", paperId)
      .eq("user_id", userId)
      .single();

    const existingSummary = (existingPaper?.ai_summary as any) || {};
    const updatedSummary = {
      ...existingSummary,
      summaries: {
        ...(existingSummary.summaries || {}),
        ...summaries,
      },
      summariesUpdatedAt: new Date().toISOString(),
    };

    // データベースに保存
    const { error: updateError } = await adminClient
      .from("user_library")
      .update({
        ai_summary: updatedSummary,
        ai_summary_updated_at: new Date().toISOString(),
      })
      .eq("paper_id", paperId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[Summary Generation] Failed to save summaries:", updateError);
      return NextResponse.json(
        { error: "Failed to save summaries", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      summaries,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: error?.message || "Summary generation failed" },
      { status: 500 }
    );
  }
}

/**
 * 保存済みの要約を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get("paperId");
    const userId = searchParams.get("userId") || DEFAULT_USER;

    if (!paperId) {
      return NextResponse.json(
        { error: "paperId is required" },
        { status: 400 }
      );
    }

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    const { data: paper, error } = await adminClient
      .from("user_library")
      .select("ai_summary, ai_summary_updated_at")
      .eq("paper_id", paperId)
      .eq("user_id", userId)
      .single();

    if (error || !paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const aiSummary = paper.ai_summary as any;
    const summaries = aiSummary?.summaries || {};

    return NextResponse.json({
      summaries,
      updatedAt: paper.ai_summary_updated_at,
    });
  } catch (error: any) {
    console.error("Get summaries error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get summaries" },
      { status: 500 }
    );
  }
}





