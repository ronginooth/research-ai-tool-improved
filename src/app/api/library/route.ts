import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { Paper } from "@/types";
import { resolveOpenAccessUrls } from "@/lib/doi-resolver";
import { ingestPaperContent } from "@/lib/paper-ingest";

// 処理中の論文を追跡するセット
const processingPapers = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 旧版互換: { userId, paper }
    // 改良版互換: Paper 単体
    const userId = body?.userId || "demo-user-123";
    const paper: Paper = body?.paper || body;

    // ユーザー設定に基づいてSupabaseクライアントを取得
    const { adminClient } = await getSupabaseForUser(request, userId);
    
    const incomingId =
      (paper as any).id || paper.paperId || (paper as any)?.paper_id;
    if (!incomingId || !paper.title) {
      return NextResponse.json(
        { error: "論文IDとタイトルが必要です" },
        { status: 400 }
      );
    }

    // Supabaseが利用できない場合はモックデータを返す
    if (!adminClient) {
      return NextResponse.json({
        success: true,
        message: "論文が保存されました（モックモード）",
        paper: {
          ...paper,
          id: `mock-${Date.now()}`,
          userId: userId,
          savedAt: new Date().toISOString(),
        },
      });
    }

    // 既存の論文をチェック
    const { data: existingPaper } = await adminClient
      .from("user_library")
      .select("id")
      .eq("user_id", userId)
      .eq("paper_id", incomingId)
      .single();

    if (existingPaper) {
      return NextResponse.json(
        { error: "この論文は既にライブラリに保存されています" },
        { status: 409 }
      );
    }

    let pdfUrl = (paper as any)?.pdfUrl ?? (paper as any)?.pdf_url ?? null;
    let htmlUrl = (paper as any)?.htmlUrl ?? (paper as any)?.html_url ?? null;
    let thumbnailUrl =
      (paper as any)?.thumbnailUrl ?? (paper as any)?.thumbnail_url ?? null;
    const doi = paper.doi ?? (paper as any)?.doi ?? null;

    if ((!pdfUrl || !htmlUrl || !thumbnailUrl) && doi) {
      try {
        const resolved = await resolveOpenAccessUrls(doi);
        if (resolved) {
          if (!pdfUrl && resolved.pdfUrl) {
            pdfUrl = resolved.pdfUrl;
          }
          if (!htmlUrl && resolved.htmlUrl) {
            htmlUrl = resolved.htmlUrl;
          }
          if (!thumbnailUrl && resolved.thumbnailUrl) {
            thumbnailUrl = resolved.thumbnailUrl;
          }
        }
      } catch (resolveError) {
        console.warn("DOI resolve failed", resolveError);
      }
    }

    // 論文を保存
    const { data, error } = await adminClient
      .from("user_library")
      .insert({
        user_id: userId,
        paper_id: incomingId,
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        abstract: paper.abstract,
        url: paper.url,
        citation_count: (paper as any).citation_count ?? paper.citationCount,
        venue: paper.venue,
        ai_summary:
          (paper as any).aiSummary ?? (paper as any).ai_summary ?? null,
        ai_summary_updated_at:
          (paper as any).aiSummaryUpdatedAt ??
          (paper as any).ai_summary_updated_at ??
          null,
        pdf_url: pdfUrl,
        html_url: htmlUrl,
        notes: thumbnailUrl, // 一時的にnotesカラムを使用
        doi,
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: `データベースエラーが発生しました: ${error.message}` },
        { status: 500 }
      );
    }

    // 論文保存後に自動処理を開始（非同期）
    const autoProcess = async () => {
      // 重複処理を防ぐ
      if (processingPapers.has(data.id)) {
        console.log(`Paper ${data.id} is already being processed, skipping`);
        return;
      }

      processingPapers.add(data.id);

      try {
        console.log(`Starting auto-processing for paper ${data.id}`);

        // 1. コンテンツ処理（PDF/HTML解析・チャンク生成・埋め込み）
        if (pdfUrl || htmlUrl) {
          await ingestPaperContent({
            paperId: data.id,
            pdfUrl,
            htmlUrl,
            force: false,
          });
          console.log(`Content processing completed for paper ${data.id}`);
        }

        // 2. AI解説生成（タイムアウト付き）
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒でタイムアウト

          const insightsResponse = await fetch(
            `${
              process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
            }/api/paper-insights`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paperId: data.id,
                userId: userId,
              }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (insightsResponse.ok) {
            console.log(
              `AI insights generation completed for paper ${data.id}`
            );
          } else {
            console.warn(
              `AI insights generation failed for paper ${data.id}: ${insightsResponse.status}`
            );
          }
        } catch (insightError) {
          if (
            insightError instanceof Error &&
            insightError.name === "AbortError"
          ) {
            console.warn(
              `AI insights generation timed out for paper ${data.id}`
            );
          } else {
            console.error(
              `AI insights API call failed for paper ${data.id}:`,
              insightError
            );
          }
        }
      } catch (error) {
        console.error(`Auto-processing failed for paper ${data.id}:`, error);
      } finally {
        // 処理完了後にセットから削除
        processingPapers.delete(data.id);
      }
    };

    // バックグラウンドで処理を開始（レスポンスをブロックしない）
    autoProcess();

    return NextResponse.json({
      success: true,
      paper: data,
      message: "論文をライブラリに保存しました。自動解析を開始しています...",
      autoProcessing: {
        started: true,
        contentProcessing: !!(pdfUrl || htmlUrl),
        aiInsights: true,
      },
    });
  } catch (error) {
    console.error("Save paper error:", error);
    return NextResponse.json(
      { error: "論文の保存に失敗しました" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "demo-user-123";

    // ユーザー設定に基づいてSupabaseクライアントを取得
    const { adminClient } = await getSupabaseForUser(request, userId);

    // Supabaseが利用できない場合はモックデータを返す
    if (!adminClient) {
      const mockPapers = [
        {
          id: "mock-1",
          paperId: "mock-paper-1",
          title:
            "Study of the role of the deglutamylating enzyme CCP5 in microtubules function regulation during mouse spermatogenesis",
          authors: "T. Giordano",
          venue: "Journal of Cell Biology",
          year: 2023,
          citationCount: 15,
          aiSummary:
            "CCP5酵素がマウス精子形成過程でのマイクロチューブル機能調節に重要な役割を果たすことを示した研究",
          pdfUrl: null,
          htmlUrl: null,
          thumbnailUrl: null,
          doi: "10.1083/jcb.202301001",
          created_at: new Date().toISOString(),
        },
        {
          id: "mock-2",
          paperId: "mock-paper-2",
          title:
            "MEIG1/PACRG associated and non-associated functions of axonemal dynein light intermediate polypeptide 1 (DNALI1) in mammalian spermatogenesis",
          authors: "S. Smith, J. Johnson",
          venue: "Developmental Biology",
          year: 2022,
          citationCount: 23,
          aiSummary:
            "DNALI1タンパク質の哺乳類精子形成における軸糸ダイニン関連機能と非関連機能を解析した研究",
          pdfUrl: null,
          htmlUrl: null,
          thumbnailUrl: null,
          doi: "10.1016/j.ydbio.2022.03.015",
          created_at: new Date().toISOString(),
        },
        {
          id: "mock-3",
          paperId: "mock-paper-3",
          title:
            "Differentiation Disorders of Chara vulgaris Spermatids following Treatment with Propyzamide",
          authors: "A. Wojtczak",
          venue: "Plant Cell Reports",
          year: 2021,
          citationCount: 8,
          aiSummary:
            "Propyzamide処理によるChara vulgaris精子細胞の分化異常に関する研究",
          pdfUrl: null,
          htmlUrl: null,
          thumbnailUrl: null,
          doi: "10.1007/s00299-021-02678-5",
          created_at: new Date().toISOString(),
        },
      ];

      return NextResponse.json({
        success: true,
        papers: mockPapers,
        total: mockPapers.length,
      });
    }

    let query = adminClient
      .from("user_library")
      .select("*")
      .eq("user_id", userId);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "データベースエラーが発生しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      papers: (data || []).map((item) => ({
        ...item,
        paperId: item.paper_id ?? item.paperId,
        citationCount: item.citation_count ?? item.citationCount,
        aiSummary: item.ai_summary ?? item.aiSummary,
        aiSummaryUpdatedAt:
          item.ai_summary_updated_at ?? item.aiSummaryUpdatedAt,
        pdfUrl: item.pdf_url ?? item.pdfUrl,
        htmlUrl: item.html_url ?? item.htmlUrl,
      })),
      total: data?.length || 0,
    });
  } catch (error) {
    console.error("Get papers error:", error);
    return NextResponse.json(
      { error: "論文の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 旧版互換: ライブラリーから論文を削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "demo-user-123";
    const paperId = searchParams.get("paperId");

    if (!paperId) {
      return NextResponse.json({ error: "論文IDが必要です" }, { status: 400 });
    }

    // ユーザー設定に基づいてSupabaseクライアントを取得
    const { adminClient } = await getSupabaseForUser(request, userId);

    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    const { error } = await adminClient
      .from("user_library")
      .delete()
      .eq("user_id", userId)
      .eq("paper_id", paperId);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "データベースエラーが発生しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete paper error:", error);
    return NextResponse.json(
      { error: "論文の削除に失敗しました" },
      { status: 500 }
    );
  }
}
