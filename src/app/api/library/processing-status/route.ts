import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

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

    // ユーザー設定に基づいてSupabaseクライアントを取得
    const { adminClient } = await getSupabaseForUser(request, userId);

    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    // 論文の基本情報を取得（GROBID関連フィールドを追加）
    // grobid_errorカラムは存在しない可能性があるため、最初から除外
    const { data: paper, error: paperError } = await adminClient
      .from("user_library")
      .select("id, title, pdf_url, html_url, ai_summary, ai_summary_updated_at, grobid_processed_at, grobid_tei_xml, grobid_data, created_at")
      .eq("id", paperId)
      .eq("user_id", userId)
      .single();

    if (paperError || !paper) {
      console.error("Paper not found:", paperError);
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    // チャンク数を確認（paper_idはuser_library.id（UUID）を参照）
    const { count: chunkCount, error: chunkError } = await adminClient
      .from("library_pdf_chunks")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", paperId);

    if (chunkError) {
      console.error("Chunk count error:", chunkError);
    }

    // 埋め込み数を確認
    const { count: embeddingCount, error: embeddingError } = await adminClient
      .from("library_pdf_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", paperId);

    if (embeddingError) {
      console.error("Embedding count error:", embeddingError);
    }

    // セクション数を確認
    const { count: sectionCount, error: sectionError } = await adminClient
      .from("library_pdf_sections")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", paperId);

    if (sectionError) {
      console.error("Section count error:", sectionError);
    }

    const hasContent = (chunkCount || 0) > 0;
    const hasEmbeddings = (embeddingCount || 0) > 0;
    const hasAiSummary = !!paper.ai_summary && paper.ai_summary_updated_at;

    // GROBID処理状態を確認
    const hasGrobidOutput = !!(paper.grobid_tei_xml || paper.grobid_data);
    const grobidProcessedAt = paper.grobid_processed_at;
    const paperCreatedAt = paper.created_at ? new Date(paper.created_at) : null;
    const now = new Date();
    
    // タイムアウト判定（論文作成から15分経過してもGROBID出力がない場合はエラー）
    const TIMEOUT_MINUTES = 15;
    const isTimeout = paperCreatedAt && (now.getTime() - paperCreatedAt.getTime()) > TIMEOUT_MINUTES * 60 * 1000;

    // GROBID処理状態
    let grobidStatus = "pending";
    let grobidMessage = "GROBID解析待ち";
    
    if (hasGrobidOutput && grobidProcessedAt) {
      grobidStatus = "completed";
      grobidMessage = "GROBID解析完了";
    } else if (paper.pdf_url || paper.html_url) {
      // PDF/HTMLがあるがGROBID出力がない
      if (isTimeout) {
        // タイムアウトした場合はエラー
        grobidStatus = "error";
        grobidMessage = "GROBID解析がタイムアウトしました。再試行してください。";
      } else {
        // タイムアウトしていない場合は処理中と判定
        // ただし、論文が作成されてから5分以上経過している場合のみ"processing"とする
        // それ以外は"pending"（GROBID処理が開始されていない可能性がある）
        const minutesSinceCreation = paperCreatedAt 
          ? (now.getTime() - paperCreatedAt.getTime()) / (60 * 1000)
          : 0;
        
        if (minutesSinceCreation >= 1) {
          // 1分以上経過している場合は処理中と判定
          grobidStatus = "processing";
          grobidMessage = "GROBID解析中...";
        } else {
          // 1分未満の場合は待機中
          grobidStatus = "pending";
          grobidMessage = "GROBID解析待ち...";
        }
      }
    }

    // 処理ステータスを判定（GROBID状態を優先）
    let status = "pending";
    let progress = 0;
    let message = "処理待ち";

    // GROBIDが完了していない場合は、GROBID状態を優先表示
    if (grobidStatus === "processing") {
      status = "processing";
      progress = 25;
      message = grobidMessage;
    } else if (grobidStatus === "error") {
      status = "error";
      progress = 0;
      message = grobidMessage;
    } else if (grobidStatus === "completed") {
      // GROBID完了後は既存のロジック
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
    } else {
      // pending
      if (paper.pdf_url || paper.html_url) {
        status = "processing";
        message = "GROBID解析待ち...";
      }
    }

    return NextResponse.json({
      paperId,
      status,
      progress,
      message,
      grobid: {
        status: grobidStatus,
        message: grobidMessage,
        processedAt: grobidProcessedAt,
        error: null, // grobid_errorカラムは使用しない
      },
      details: {
        hasContent,
        hasEmbeddings,
        hasAiSummary,
        hasGrobidOutput,
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
