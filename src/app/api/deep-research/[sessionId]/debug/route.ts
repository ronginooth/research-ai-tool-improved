import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Deep Researchセッションのデバッグ情報を取得
 * GET /api/deep-research/[sessionId]/debug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: "データベース接続が設定されていません",
          sessionId,
        },
        { status: 500 }
      );
    }

    const debugInfo: any = {
      sessionId,
      timestamp: new Date().toISOString(),
      databaseConnected: true,
      session: null,
      papers: null,
      errors: [],
    };

    // セッションの存在確認
    try {
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("deep_research_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) {
        debugInfo.errors.push({
          type: "session_fetch_error",
          message: sessionError.message,
          code: sessionError.code,
          details: sessionError.details,
          hint: sessionError.hint,
        });
      } else if (!session) {
        debugInfo.errors.push({
          type: "session_not_found",
          message: "セッションが見つかりません",
        });
      } else {
        debugInfo.session = {
          id: session.id,
          user_id: session.user_id,
          query: session.query,
          status: session.status,
          total_papers: session.total_papers,
          query_expanded: session.query_expanded,
          search_sources: session.search_sources,
          created_at: session.created_at,
          updated_at: session.updated_at,
        };
      }
    } catch (error) {
      debugInfo.errors.push({
        type: "session_check_exception",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // 論文の存在確認と件数
    try {
      const { data: papers, error: papersError, count } = await supabaseAdmin
        .from("deep_research_papers")
        .select("*", { count: "exact" })
        .eq("session_id", sessionId);

      if (papersError) {
        debugInfo.errors.push({
          type: "papers_fetch_error",
          message: papersError.message,
          code: papersError.code,
          details: papersError.details,
        });
      } else {
        debugInfo.papers = {
          totalCount: count || 0,
          papers: papers?.map((p: any) => ({
            id: p.id,
            paper_id: p.paper_id,
            title: p.title,
            relevance_score: p.relevance_score,
            relevance_tag: p.relevance_tag,
            source: p.source,
          })) || [],
          topPapers: papers
            ?.sort((a: any, b: any) => (b.relevance_score || 0) - (a.relevance_score || 0))
            .slice(0, 5)
            .map((p: any) => ({
              paper_id: p.paper_id,
              title: p.title,
              relevance_score: p.relevance_score,
            })) || [],
        };
      }
    } catch (error) {
      debugInfo.errors.push({
        type: "papers_check_exception",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // レビューの存在確認
    try {
      const { data: reviews, error: reviewsError } = await supabaseAdmin
        .from("reviews")
        .select("id, title, created_at")
        .eq("deep_research_session_id", sessionId);

      if (!reviewsError && reviews) {
        debugInfo.reviews = {
          count: reviews.length,
          reviews: reviews.map((r: any) => ({
            id: r.id,
            title: r.title,
            created_at: r.created_at,
          })),
        };
      }
    } catch (error) {
      // レビューの確認はオプションなので、エラーは無視
    }

    const hasErrors = debugInfo.errors.length > 0;
    const statusCode = hasErrors && !debugInfo.session ? 404 : 200;

    return NextResponse.json(debugInfo, { status: statusCode });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      {
        error: "デバッグ情報の取得に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}



