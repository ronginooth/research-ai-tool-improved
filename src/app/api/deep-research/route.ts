import { NextRequest, NextResponse } from "next/server";
import { deepResearchEngine } from "@/lib/deep-research-engine";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const {
      query,
      userId = "demo-user-123",
      maxPapers = 300,
      sources = ["semantic_scholar", "pubmed"],
      includeCitationNetwork = true,
      provider = "gemini",
    } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "研究質問が必要です" },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "データベース接続が設定されていません" },
        { status: 500 }
      );
    }

    // ステップ1: セッション作成
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("deep_research_sessions")
      .insert({
        user_id: userId,
        query: query.trim(),
        status: "searching",
        search_sources: sources,
        total_papers: 0,
      })
      .select()
      .single();

    if (sessionError) {
      // エラー情報を詳細にログ出力
      console.error("=== Session creation error ===");
      console.error("Full error object:", JSON.stringify(sessionError, null, 2));
      console.error("Error code:", sessionError.code);
      console.error("Error message:", sessionError.message);
      console.error("Error details:", sessionError.details);
      console.error("Error hint:", sessionError.hint);
      
      // テーブルが存在しない場合のエラーメッセージ
      const errorMessage = sessionError.message || "";
      const errorCode = sessionError.code || "";
      
      if (
        errorCode === "42P01" || 
        errorMessage.includes("does not exist") ||
        errorMessage.includes("relation") && errorMessage.includes("does not exist")
      ) {
        return NextResponse.json(
          { 
            error: "データベーステーブルが存在しません",
            details: "Deep Research機能用のテーブルが作成されていません。マイグレーションを実行してください。",
            hint: "database/migrations/add_deep_research_tables.sql をSupabaseで実行してください",
            originalError: errorMessage,
            code: errorCode
          },
          { status: 500 }
        );
      }
      
      // RLSポリシーの問題
      if (
        errorCode === "42501" ||
        errorMessage.includes("permission denied") ||
        errorMessage.includes("RLS")
      ) {
        return NextResponse.json(
          { 
            error: "権限エラーが発生しました",
            details: "RLSポリシーまたは権限設定に問題がある可能性があります。",
            hint: "マイグレーションファイルのRLSポリシーが正しく作成されているか確認してください",
            originalError: errorMessage,
            code: errorCode
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "セッションの作成に失敗しました", 
          details: errorMessage,
          code: errorCode,
          hint: sessionError.hint || "詳細はサーバーログを確認してください",
          fullError: process.env.NODE_ENV === "development" ? JSON.stringify(sessionError) : undefined
        },
        { status: 500 }
      );
    }

    try {
      // ステップ2: Deep Research実行
      console.log("[Deep Research API] Starting deep research execution...");
      const result = await deepResearchEngine.executeDeepResearch({
        query: query.trim(),
        maxPapers,
        sources,
        includeCitationNetwork,
        provider: provider as "openai" | "gemini",
      });

      console.log("[Deep Research API] Deep research completed:", {
        sessionId: session.id,
        totalPapers: result.totalPapers,
        papersCount: result.papers.length,
        expandedQueriesCount: result.expandedQueries.length,
      });

      // 論文が0件の場合は警告を出して続行（セッションは作成済みなので保存）
      if (result.papers.length === 0) {
        console.warn("[Deep Research API] No papers found in search results");
        console.warn("[Deep Research API] Search details:", {
          query: query.trim(),
          sources,
          expandedQueries: result.expandedQueries,
          searchStats: result.searchStats,
        });
        
        await supabaseAdmin
          .from("deep_research_sessions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.id);

        return NextResponse.json(
          {
            error: "論文が見つかりませんでした",
            details: "検索結果が0件でした。Semantic Scholar APIのエラー（400/429）やレート制限が原因の可能性があります。検索クエリを変更するか、しばらく時間をおいて再試行してください。",
            sessionId: session.id,
            totalPapers: 0,
            expandedQueries: result.expandedQueries,
            searchStats: result.searchStats,
            hint: "PubMedのみで検索するか、検索クエリをより具体的にしてみてください",
          },
          { status: 404 }
        );
      }

      // ステップ3: 論文をデータベースに保存
      console.log("[Deep Research API] Saving papers to database...");
      await savePapersToSession(session.id, result.papers);
      console.log("[Deep Research API] Papers saved successfully");

      // ステップ4: セッション更新
      const { error: updateError } = await supabaseAdmin
        .from("deep_research_sessions")
        .update({
          status: "completed",
          total_papers: result.totalPapers,
          query_expanded: result.expandedQueries.join("; "),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (updateError) {
        console.error("[Deep Research API] Session update error:", updateError);
        // エラーでも結果は返す
      } else {
        console.log("[Deep Research API] Session updated successfully");
      }

      return NextResponse.json({
        sessionId: session.id,
        totalPapers: result.totalPapers,
        papers: result.papers.slice(0, 100), // 最初の100件を返す
        expandedQueries: result.expandedQueries,
        searchStats: result.searchStats,
        status: "completed",
      });
    } catch (error) {
      // エラー時はセッションを失敗状態に更新
      await supabaseAdmin
        .from("deep_research_sessions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      console.error("Deep research error:", error);
      return NextResponse.json(
        {
          error: "Deep Researchに失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
          sessionId: session.id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Deep research API error:", error);
    return NextResponse.json(
      {
        error: "Deep Research APIエラー",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * 論文をセッションに保存
 */
async function savePapersToSession(
  sessionId: string,
  papers: Array<{
    paperId: string;
    title: string;
    authors?: string;
    year?: number;
    abstract?: string;
    url?: string;
    citationCount?: number;
    venue?: string;
    relevanceScore?: number;
    relevanceReasoning?: string;
    relevanceTag?: string;
    source?: string;
    searchQuery?: string;
    doi?: string;
  }>
): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not available");
  }

  if (papers.length === 0) {
    console.warn("[savePapersToSession] No papers to save");
    return;
  }

  console.log(`[savePapersToSession] Saving ${papers.length} papers to session ${sessionId}`);

  // バッチ挿入（一度に100件ずつ）
  const batchSize = 100;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < papers.length; i += batchSize) {
    const batch = papers.slice(i, i + batchSize);
    console.log(`[savePapersToSession] Processing batch ${Math.floor(i / batchSize) + 1}, papers ${i + 1}-${Math.min(i + batchSize, papers.length)}`);

    const papersToInsert = batch.map((paper) => {
      // paperIdが空の場合はスキップ
      if (!paper.paperId || paper.paperId.trim() === "") {
        console.warn("[savePapersToSession] Skipping paper with empty paperId:", paper.title);
        return null;
      }

      return {
        session_id: sessionId,
        paper_id: paper.paperId,
        title: paper.title || "タイトルなし",
        authors: paper.authors || null,
        year: paper.year || null,
        abstract: paper.abstract || null,
        url: paper.url || null,
        citation_count: paper.citationCount || 0,
        venue: paper.venue || null,
        relevance_score: paper.relevanceScore || null,
        relevance_reasoning: paper.relevanceReasoning || null,
        relevance_tag: paper.relevanceTag || null,
        source: paper.source || "unknown",
        search_query: paper.searchQuery || null,
        doi: paper.doi || null,
      };
    }).filter((p) => p !== null); // nullを除外

    if (papersToInsert.length === 0) {
      console.warn(`[savePapersToSession] Batch ${Math.floor(i / batchSize) + 1} has no valid papers to insert`);
      continue;
    }

    const { error, data } = await supabaseAdmin
      .from("deep_research_papers")
      .insert(papersToInsert)
      .select();

    if (error) {
      console.error(`[savePapersToSession] Error inserting batch ${Math.floor(i / batchSize) + 1}:`, {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        batchSize: papersToInsert.length,
        sessionId,
      });
      totalErrors++;
    } else {
      const insertedCount = data?.length || papersToInsert.length;
      totalInserted += insertedCount;
      console.log(`[savePapersToSession] Successfully inserted ${insertedCount} papers in batch ${Math.floor(i / batchSize) + 1}`);
    }
  }

  console.log(`[savePapersToSession] Completed: ${totalInserted} papers inserted, ${totalErrors} batch errors`);

  if (totalInserted === 0 && papers.length > 0) {
    throw new Error(`Failed to save any papers. ${totalErrors} batch errors occurred.`);
  }
}

