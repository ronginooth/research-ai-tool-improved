import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { Paper } from "@/types";
import { resolveOpenAccessUrls } from "@/lib/doi-resolver";
import { ingestPaperContent } from "@/lib/paper-ingest";
import { s2Headers } from "@/lib/semantic-scholar";

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

    // リンク情報を取得（リクエストボディから）
    const linkedFrom = (body as any)?.linkedFrom || null;
    
    // 既存の論文をチェック（linked_fromカラムが存在しない場合に備えて、エラーハンドリングを追加）
    let existingPaper: any = null;
    try {
      const { data, error } = await adminClient
        .from("user_library")
        .select("id, paper_id, title, linked_from")
        .eq("user_id", userId)
        .eq("paper_id", incomingId)
        .single();
      
      if (!error && data) {
        existingPaper = data;
      } else if (error && error.code !== 'PGRST116') { // PGRST116は「行が見つからない」エラー
        // linked_fromカラムが存在しない場合は、カラムを除外して再試行
        const { data: retryData, error: retryError } = await adminClient
          .from("user_library")
          .select("id, paper_id, title")
          .eq("user_id", userId)
          .eq("paper_id", incomingId)
          .single();
        
        if (!retryError && retryData) {
          existingPaper = retryData;
        }
      }
    } catch (selectError: any) {
      // linked_fromカラムが存在しない場合のエラーを無視
      const errorMessage = selectError?.message || "";
      const isLinkedFromError = 
        errorMessage.includes("linked_from") ||
        errorMessage.includes("Could not find the 'linked_from' column") ||
        selectError?.code === "42703" ||
        selectError?.code === "PGRST204";
      
      if (isLinkedFromError) {
        console.warn("linked_from column does not exist, skipping link information");
        try {
          const { data, error } = await adminClient
            .from("user_library")
            .select("id, paper_id, title")
            .eq("user_id", userId)
            .eq("paper_id", incomingId)
            .single();
          
          if (!error && data) {
            existingPaper = data;
          }
        } catch (retryError) {
          // エラーを無視（論文が存在しない場合は後続処理で処理される）
        }
      }
    }

    if (existingPaper) {
      // リンク情報がある場合は更新（linked_fromカラムが存在する場合のみ）
      if (linkedFrom && existingPaper.linked_from !== undefined) {
        try {
          const currentLinkedFrom = (existingPaper.linked_from as any[]) || [];
          // 既に同じリンクが存在するかチェック
          const linkExists = currentLinkedFrom.some(
            (link: any) =>
              link.type === linkedFrom.type &&
              link.worksheetId === linkedFrom.worksheetId &&
              link.paragraphId === linkedFrom.paragraphId
          );
          
          if (!linkExists) {
            // 新しいリンク情報を追加
            const updatedLinkedFrom = [
              ...currentLinkedFrom,
              {
                ...linkedFrom,
                linkedAt: new Date().toISOString(),
              },
            ];
            
            // リンク情報を更新
            const { data: updatedPaper, error: updateError } = await adminClient
              .from("user_library")
              .update({ linked_from: updatedLinkedFrom })
              .eq("id", existingPaper.id)
              .select()
              .single();
            
            if (updateError) {
              console.error("Update linked_from error:", updateError);
            } else {
              return NextResponse.json({
                success: true,
                paper: updatedPaper,
                message: "リンク情報を更新しました",
                existing: true,
              });
            }
          }
        } catch (updateError: any) {
          // linked_fromカラムが存在しない場合はエラーを無視
          const errorMessage = updateError?.message || "";
          const isLinkedFromError = 
            errorMessage.includes("linked_from") ||
            errorMessage.includes("Could not find the 'linked_from' column") ||
            updateError?.code === "42703" ||
            updateError?.code === "PGRST204";
          
          if (isLinkedFromError) {
            console.warn("linked_from column does not exist, skipping link update");
          } else {
            console.error("Update linked_from error:", updateError);
          }
        }
      }
      
      // 既存の論文のUUIDを返す（引用に追加する際に必要）
      return NextResponse.json(
        { 
          error: "この論文は既にライブラリに保存されています",
          paper: existingPaper, // user_library.id（UUID）を含む
          existing: true
        },
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

    // リンク情報を準備
    const linkedFromArray = linkedFrom
      ? [
          {
            ...linkedFrom,
            linkedAt: new Date().toISOString(),
          },
        ]
      : [];

    // 論文を保存（linked_fromカラムが存在しない場合に備えて、条件付きで追加）
    const insertData: any = {
      user_id: userId,
      paper_id: incomingId,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      month: (paper as any).month ?? paper.month ?? null,
      day: (paper as any).day ?? paper.day ?? null,
      publication_date: (paper as any).publicationDate ?? paper.publicationDate ?? null,
      abstract: paper.abstract,
      url: paper.url,
      citation_count: (paper as any).citation_count ?? paper.citationCount,
      venue: paper.venue,
      volume: (paper as any).volume ?? paper.volume ?? null,
      issue: (paper as any).issue ?? paper.issue ?? null,
      pages: (paper as any).pages ?? paper.pages ?? null,
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
    };

    // linked_fromカラムが存在する場合のみ追加（エラーハンドリングで対応）
    if (linkedFromArray.length > 0) {
      insertData.linked_from = linkedFromArray;
    }

    // 論文を保存
    let data: any = null;
    let error: any = null;
    
    const { data: insertResult, error: insertError } = await adminClient
      .from("user_library")
      .insert(insertData)
      .select()
      .single();
    
    data = insertResult;
    error = insertError;
    
    // linked_fromカラムが存在しない場合は、カラムを除外して再試行
    if (error) {
      const errorMessage = error?.message || "";
      const isLinkedFromError = 
        errorMessage.includes("linked_from") ||
        errorMessage.includes("Could not find the 'linked_from' column") ||
        error?.code === "42703" ||
        error?.code === "PGRST204";
      
      if (isLinkedFromError) {
        console.warn("linked_from column does not exist, inserting without link information");
        const retryInsertData = { ...insertData };
        delete retryInsertData.linked_from;
        
        const { data: retryData, error: retryError } = await adminClient
          .from("user_library")
          .insert(retryInsertData)
          .select()
          .single();
        
        data = retryData;
        error = retryError;
      }
    }

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
            userId,
            pdfUrl,
            htmlUrl,
            force: false,
          });
          console.log(`Content processing completed for paper ${data.id}`);
        }

        // 2. Semantic Scholar論文の詳細情報（volume, issue, pages）を補完
        // 検索エンドポイントでは取得できないため、個別論文エンドポイントから取得
        if (paper.source === "semantic_scholar" && paper.paperId) {
          try {
            // レート制限対策（3秒待機 - APIキーなしでの利用を想定）
            const waitTime = 3000;
            await new Promise((resolve) => setTimeout(resolve, waitTime));

            // 注意: volume, issue, pagesは個別論文エンドポイントでは取得できないため、
            // 一旦publicationDateのみを取得（将来的にvolume, issue, pagesが利用可能になった場合に追加）
            const detailResponse = await fetch(
              `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}?fields=paperId,publicationDate`,
              {
                headers: s2Headers(),
              }
            );

            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              const updates: any = {};

              // 注意: volume, issue, pagesは個別論文エンドポイントでは取得できないため、一旦コメントアウト
              // 将来的にSemantic Scholar APIでこれらのフィールドが利用可能になった場合に有効化
              /*
              if (detailData.volume && !data.volume) {
                updates.volume = detailData.volume;
              }
              if (detailData.issue && !data.issue) {
                updates.issue = detailData.issue;
              }
              if (detailData.pages && !data.pages) {
                updates.pages = detailData.pages;
              }
              */

              // publicationDateを更新（既存データがない場合のみ）
              if (detailData.publicationDate && !data.publication_date) {
                updates.publication_date = detailData.publicationDate;

                // publicationDateからmonth, dayを抽出
                const dateParts = detailData.publicationDate.split("-");
                if (dateParts.length >= 2 && !data.month) {
                  const month = parseInt(dateParts[1]);
                  if (month >= 1 && month <= 12) {
                    updates.month = month;
                  }
                }
                if (dateParts.length >= 3 && !data.day) {
                  const day = parseInt(dateParts[2]);
                  if (day >= 1 && day <= 31) {
                    updates.day = day;
                  }
                }
              }

              // 更新がある場合のみデータベースを更新
              if (Object.keys(updates).length > 0) {
                const { error: updateError } = await adminClient
                  .from("user_library")
                  .update(updates)
                  .eq("id", data.id);

                if (updateError) {
                  console.warn(
                    `Failed to update volume/issue/pages for paper ${data.id}:`,
                    updateError
                  );
                } else {
                  console.log(
                    `Updated volume/issue/pages for paper ${data.id}:`,
                    updates
                  );
                }
              }
            } else if (detailResponse.status === 429) {
              // レート制限の場合は警告のみ（次の保存時に再試行される）
              console.warn(
                `Rate limited when fetching details for paper ${data.id}, will retry later`
              );
            } else {
              console.warn(
                `Failed to fetch details for paper ${data.id}: ${detailResponse.status}`
              );
            }
          } catch (detailError) {
            console.error(
              `Error fetching paper details for ${data.id}:`,
              detailError
            );
          }
        }

        // 3. AI解説生成（タイムアウト付き）
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
        month: item.month ?? null,
        day: item.day ?? null,
        publicationDate: item.publication_date ?? (item as any)?.publicationDate ?? null,
        aiSummary: item.ai_summary ?? item.aiSummary,
        aiSummaryUpdatedAt:
          item.ai_summary_updated_at ?? item.aiSummaryUpdatedAt,
        pdfUrl: item.pdf_url ?? item.pdfUrl,
        htmlUrl: item.html_url ?? item.htmlUrl ?? null,
        pdfStoragePath:
          item.pdf_storage_path ?? (item as any)?.pdfStoragePath ?? null,
        pdfFileName:
          item.pdf_file_name ?? (item as any)?.pdfFileName ?? null,
        doi: item.doi ?? null,
        thumbnailUrl: (item as any)?.thumbnail_url ?? (item as any)?.thumbnailUrl ?? null,
        grobidTeiXml: item.grobid_tei_xml ?? (item as any)?.grobidTeiXml ?? null,
        grobidData: item.grobid_data ?? (item as any)?.grobidData ?? null,
        grobidProcessedAt:
          item.grobid_processed_at ??
          (item as any)?.grobidProcessedAt ??
          null,
        linkedFrom: item.linked_from ?? (item as any)?.linkedFrom ?? [],
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

// ライブラリーから論文を削除（UUIDベースまたはpaper_idベース）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "demo-user-123";
    const paperId = searchParams.get("paperId"); // paper_idまたはUUID
    const libraryId = searchParams.get("libraryId"); // user_library.id (UUID)

    if (!paperId && !libraryId) {
      return NextResponse.json(
        { error: "論文IDまたはライブラリIDが必要です" },
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

    // libraryIdが指定されている場合はUUIDで削除、そうでなければpaper_idで削除
    const deleteQuery = adminClient
      .from("user_library")
      .delete()
      .eq("user_id", userId);

    if (libraryId) {
      deleteQuery.eq("id", libraryId);
    } else {
      deleteQuery.eq("paper_id", paperId);
    }

    const { error } = await deleteQuery;

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
