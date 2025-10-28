import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get("paperId");
    const userId = searchParams.get("userId") || "demo-user-123";

    if (!paperId) {
      return NextResponse.json(
        { error: "paperId parameter is required" },
        { status: 400 }
      );
    }

    // 論文の基本情報を取得
    const { data: paper, error: paperError } = await supabaseAdmin
      .from("user_library")
      .select("id, title, pdf_url, html_url, ai_summary, ai_summary_updated_at")
      .eq("id", paperId)
      .eq("user_id", userId)
      .single();

    if (paperError || !paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    // チャンク数を確認
    const { count: chunkCount } = await supabaseAdmin
      .from("library_pdf_chunks")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", paperId);

    // 埋め込み数を確認
    const { count: embeddingCount } = await supabaseAdmin
      .from("library_pdf_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", paperId);

    // セクション数を確認
    const { count: sectionCount } = await supabaseAdmin
      .from("library_pdf_sections")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", paperId);

    const hasContent = (chunkCount || 0) > 0;
    const hasEmbeddings = (embeddingCount || 0) > 0;
    const hasAiSummary = !!paper.ai_summary && paper.ai_summary_updated_at;

    // 処理ステータスを判定
    let status = "pending";
    let progress = 0;
    let message = "処理待ち";

    if (hasContent) {
      progress = 50;
      message = "コンテンツ解析完了";

      if (hasEmbeddings) {
        progress = 75;
        message = "埋め込み生成完了";

        if (hasAiSummary) {
          progress = 100;
          status = "completed";
          message = "AI解説生成完了";
        } else {
          status = "processing";
          message = "AI解説生成中...";
        }
      } else {
        status = "processing";
        message = "埋め込み生成中...";
      }
    } else if (paper.pdf_url || paper.html_url) {
      status = "processing";
      message = "コンテンツ解析中...";
    }

    return NextResponse.json({
      paperId,
      status,
      progress,
      message,
      details: {
        hasContent,
        hasEmbeddings,
        hasAiSummary,
        chunkCount: chunkCount || 0,
        embeddingCount: embeddingCount || 0,
        sectionCount: sectionCount || 0,
        lastUpdated: paper.ai_summary_updated_at,
      },
    });
  } catch (error) {
    console.error("Processing status error:", error);
    return NextResponse.json(
      {
        error: "Failed to get processing status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}



