import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { selectedCount = 7, provider = "gemini" } = await request.json();
    const { sessionId } = await params;

    // デバッグログ: リクエストパラメータ
    console.log("[Summary API] Request received:", {
      sessionId,
      selectedCount,
      provider,
    });

    if (!supabaseAdmin) {
      console.error("[Summary API] Supabase admin client not initialized");
      return NextResponse.json(
        { error: "データベース接続が設定されていません" },
        { status: 500 }
      );
    }

    // セッションと論文を取得
    console.log("[Summary API] Fetching session:", sessionId);
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("deep_research_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError) {
      console.error("[Summary API] Session fetch error:", {
        sessionId,
        error: sessionError.message,
        code: sessionError.code,
        details: sessionError.details,
        hint: sessionError.hint,
      });
      return NextResponse.json(
        {
          error: "セッションが見つかりません",
          sessionId: sessionId,
          details: sessionError.message,
          code: sessionError.code,
          hint: sessionError.hint,
        },
        { status: 404 }
      );
    }

    if (!session) {
      console.error("[Summary API] Session not found:", sessionId);
      return NextResponse.json(
        {
          error: "セッションが見つかりません",
          sessionId: sessionId,
          details: "セッションIDに対応するデータが存在しません",
        },
        { status: 404 }
      );
    }

    console.log("[Summary API] Session found:", {
      sessionId: session.id,
      query: session.query,
      status: session.status,
      totalPapers: session.total_papers,
    });

    // 関連性スコアの高い論文を取得
    console.log("[Summary API] Fetching papers for session:", sessionId);
    const { data: papers, error: papersError } = await supabaseAdmin
      .from("deep_research_papers")
      .select("*")
      .eq("session_id", sessionId)
      .order("relevance_score", { ascending: false })
      .limit(selectedCount);

    if (papersError) {
      console.error("[Summary API] Papers fetch error:", {
        sessionId,
        error: papersError.message,
        code: papersError.code,
        details: papersError.details,
      });
      return NextResponse.json(
        {
          error: "論文の取得に失敗しました",
          sessionId: sessionId,
          details: papersError.message,
          code: papersError.code,
        },
        { status: 500 }
      );
    }

    if (!papers || papers.length === 0) {
      // セッションに紐づく論文の総数を確認
      const { count } = await supabaseAdmin
        .from("deep_research_papers")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);

      console.error("[Summary API] No papers found:", {
        sessionId,
        requestedCount: selectedCount,
        totalPapersInSession: count || 0,
      });
      return NextResponse.json(
        {
          error: "論文が見つかりません",
          sessionId: sessionId,
          details: `セッションに紐づく論文が存在しません（総数: ${count || 0}件）`,
          totalPapersInSession: count || 0,
          requestedCount: selectedCount,
        },
        { status: 404 }
      );
    }

    // 要求された件数より少ない場合でも続行（利用可能な論文数を使用）
    const actualCount = Math.min(papers.length, selectedCount);
    if (papers.length < selectedCount) {
      console.warn("[Summary API] Requested more papers than available:", {
        sessionId,
        requestedCount: selectedCount,
        availableCount: papers.length,
        usingCount: actualCount,
      });
    }

    console.log("[Summary API] Papers found:", {
      sessionId,
      paperCount: papers.length,
      requestedCount: selectedCount,
    });

    // 論文データをPaper型に変換（利用可能な論文数を使用）
    const actualSelectedCount = Math.min(papers.length, selectedCount);
    const selectedPapers = papers.slice(0, actualSelectedCount).map((p: any) => ({
      id: p.paper_id,
      paperId: p.paper_id,
      title: p.title,
      authors: p.authors || "",
      year: p.year || 0,
      abstract: p.abstract || "",
      url: p.url || "",
      citationCount: p.citation_count || 0,
      venue: p.venue || "",
      doi: p.doi,
      source: p.source || "unknown",
    }));

    console.log("[Summary API] Using papers:", {
      sessionId,
      totalAvailable: papers.length,
      requestedCount: selectedCount,
      actualSelectedCount: actualSelectedCount,
    });

    // 既存のreview APIを使用してまとめファイルを生成
    const reviewResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: session.query,
          papers: selectedPapers,
          provider: provider,
          searchMode: "manual",
          focusOnGaps: true,
        }),
      }
    );

    if (!reviewResponse.ok) {
      const errorData = await reviewResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "まとめファイル生成に失敗しました",
          details: errorData.error || "Unknown error",
        },
        { status: 500 }
      );
    }

    const { review } = await reviewResponse.json();

    // 引用マッピングを抽出（[1], [2]などの引用番号と論文IDの対応）
    const citationMap = extractCitationMap(review, selectedPapers);

    // レビューを保存
    const { data: savedReview, error: reviewError } = await supabaseAdmin
      .from("reviews")
      .insert({
        user_id: session.user_id,
        title: `${session.query}に関するDeep Researchレビュー`,
        topic: session.query,
        content: review,
        paper_ids: selectedPapers.map((p) => p.paperId),
        deep_research_session_id: sessionId,
        selected_paper_count: actualSelectedCount,
        total_papers_count: session.total_papers,
      })
      .select()
      .single();

    if (reviewError) {
      console.error("Review save error:", reviewError);
      return NextResponse.json(
        {
          error: "レビューの保存に失敗しました",
          details: reviewError.message,
        },
        { status: 500 }
      );
    }

    // 厳選論文の引用情報を保存
    for (const [citationNum, paperId] of Object.entries(citationMap)) {
      const paper = selectedPapers.find((p) => p.paperId === paperId);
      if (paper) {
        const citationNumber = parseInt(
          citationNum.replace("[", "").replace("]", "")
        );
        const citationContext = extractCitationContext(review, citationNum);

        await supabaseAdmin.from("review_selected_papers").insert({
          review_id: savedReview.id,
          session_id: sessionId,
          paper_id: paperId,
          citation_number: citationNumber,
          citation_context: citationContext,
        });
      }
    }

    return NextResponse.json({
      reviewId: savedReview.id,
      review: review,
      selectedPapers: selectedPapers,
      citationMap: citationMap,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      {
        error: "まとめファイル生成に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * まとめファイルから引用マッピングを抽出
 */
function extractCitationMap(
  review: string,
  papers: Array<{ paperId: string; title: string }>
): Record<string, string> {
  const citationMap: Record<string, string> = {};
  const citationPattern = /\[(\d+)\]/g;
  const matches = review.matchAll(citationPattern);

  // 各引用番号に対して、最も可能性の高い論文をマッピング
  // 簡易実装: 引用番号の順序で論文を割り当て
  const citationNumbers = Array.from(matches)
    .map((m) => parseInt(m[1]))
    .filter((n) => !isNaN(n));

  const uniqueCitations = Array.from(new Set(citationNumbers)).sort(
    (a, b) => a - b
  );

  uniqueCitations.forEach((citationNum, index) => {
    if (index < papers.length) {
      citationMap[`[${citationNum}]`] = papers[index].paperId;
    }
  });

  return citationMap;
}

/**
 * 引用文脈を抽出
 */
function extractCitationContext(
  review: string,
  citationNumber: string
): string {
  // 引用番号の前後50文字を抽出
  const index = review.indexOf(citationNumber);
  if (index === -1) {
    return "";
  }

  const start = Math.max(0, index - 50);
  const end = Math.min(review.length, index + citationNumber.length + 50);
  return review.substring(start, end).trim();
}

