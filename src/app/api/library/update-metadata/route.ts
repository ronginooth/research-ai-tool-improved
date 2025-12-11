import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { s2Headers } from "@/lib/semantic-scholar";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = "demo-user-123", limit = 100 } = body;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // Semantic Scholar論文を取得（urlカラムにSemantic Scholar URLがあるもの）
    // volume, issue, pages, publication_dateのいずれかがnullのものを優先
    const { data: papers, error } = await adminClient
      .from("user_library")
      .select("id, title, url, paper_id, volume, issue, pages, publication_date, month, day")
      .eq("user_id", userId)
      .not("url", "is", null)
      .like("url", "%semanticscholar.org/paper/%")
      .limit(limit || 10);

    if (error) {
      return NextResponse.json(
        { error: "論文の取得に失敗しました" },
        { status: 500 }
      );
    }

    const results = [];
    
    for (const paper of papers || []) {
      // Semantic Scholar URLからpaperIdを抽出
      // URL形式: https://www.semanticscholar.org/paper/{paperId}
      const paperIdMatch = paper.url?.match(/semanticscholar\.org\/paper\/([^\/\?]+)/i);
      
      // paper_idカラムからも取得を試みる
      const paperId = paperIdMatch?.[1] || paper.paper_id;
      
      if (!paperId) {
        results.push({
          paperId: paper.id,
          title: paper.title,
          url: paper.url,
          success: false,
          error: "paperIdが見つかりませんでした",
        });
        continue;
      }
      
      try {
        // レート制限対策（3秒待機 - APIキーなしでの利用を想定）
        const waitTime = 3000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        
        // Semantic Scholar APIでpaperIdから詳細情報を取得
        // 注意: volume, issue, pagesは個別論文エンドポイントでは取得できない可能性があるため、
        // 一旦publicationDateのみを取得（将来的にvolume, issue, pagesが利用可能になった場合に追加）
        let apiResponse = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,publicationDate,year`,
          {
            headers: s2Headers(),
          }
        );

        // 403エラーの場合、APIキーなしで再試行
        if (apiResponse.status === 403) {
          console.warn(
            `[Update Metadata] API key invalid (403) for paper ${paper.id}, trying without API key`
          );
          const fallbackHeaders = {
            "User-Agent": "Research-AI-Tool-Improved/2.0",
          };
          apiResponse = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,volume,issue,pages,publicationDate,year`,
            {
              headers: fallbackHeaders,
            }
          );
        }

        if (apiResponse.ok) {
          const paperData = await apiResponse.json();
          console.log(
            `[Update Metadata] Paper ${paper.id}: API response - publicationDate: ${!!paperData.publicationDate}`
          );

          const updates: any = {};

          // 注意: volume, issue, pagesは個別論文エンドポイントでは取得できないため、一旦コメントアウト
          // 将来的にSemantic Scholar APIでこれらのフィールドが利用可能になった場合に有効化
          /*
          if (paperData.volume && !paper.volume) {
            updates.volume = paperData.volume;
          }
          if (paperData.issue && !paper.issue) {
            updates.issue = paperData.issue;
          }
          if (paperData.pages && !paper.pages) {
            updates.pages = paperData.pages;
          }
          */

          // publicationDateを更新（既存データがない場合のみ）
          if (paperData.publicationDate && !paper.publication_date) {
            updates.publication_date = paperData.publicationDate;

            // publicationDateからmonth, dayを抽出
            // ISO 8601形式: "2024-05-15" または "2024-05" または "2024"
            const dateParts = paperData.publicationDate.split("-");
            if (dateParts.length >= 2 && !paper.month) {
              const month = parseInt(dateParts[1]);
              if (month >= 1 && month <= 12) {
                updates.month = month;
              }
            }
            if (dateParts.length >= 3 && !paper.day) {
              const day = parseInt(dateParts[2]);
              if (day >= 1 && day <= 31) {
                updates.day = day;
              }
            }
          } else if (paperData.publicationDate && paper.publication_date) {
            // publicationDateは既にあるが、month/dayが欠けている場合
            if (!paper.month || !paper.day) {
              const dateParts = paperData.publicationDate.split("-");
              if (dateParts.length >= 2 && !paper.month) {
                const month = parseInt(dateParts[1]);
                if (month >= 1 && month <= 12) {
                  updates.month = month;
                }
              }
              if (dateParts.length >= 3 && !paper.day) {
                const day = parseInt(dateParts[2]);
                if (day >= 1 && day <= 31) {
                  updates.day = day;
                }
              }
            }
          }

          // 更新がある場合のみデータベースを更新
          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await adminClient
              .from("user_library")
              .update(updates)
              .eq("id", paper.id);

            if (updateError) {
              results.push({
                paperId: paper.id,
                title: paper.title,
                url: paper.url,
                success: false,
                error: updateError.message,
                updates: null,
              });
            } else {
              results.push({
                paperId: paper.id,
                title: paper.title,
                url: paper.url,
                success: true,
                error: null,
                updates: updates,
              });
            }
          } else {
            results.push({
              paperId: paper.id,
              title: paper.title,
              url: paper.url,
              success: true,
              error: null,
              updates: null,
              message: "更新する情報がありませんでした（既に全て揃っています）",
            });
          }
        } else if (apiResponse.status === 429) {
          // レート制限の場合は長めに待機（10秒）
          console.warn(
            `Rate limited for paper ${paper.id}, waiting 10 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, 10000));
          // リトライ（1回のみ）
          try {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            let retryResponse = await fetch(
              `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,publicationDate,year`,
              {
                headers: s2Headers(),
              }
            );

              // 403エラーの場合、APIキーなしで再試行
              if (retryResponse.status === 403) {
                const fallbackHeaders = {
                  "User-Agent": "Research-AI-Tool-Improved/2.0",
                };
                retryResponse = await fetch(
                  `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,publicationDate,year`,
                  {
                    headers: fallbackHeaders,
                  }
                );
              }

              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                const updates: any = {};

                // 注意: volume, issue, pagesは個別論文エンドポイントでは取得できないため、一旦コメントアウト
                /*
                if (retryData.volume && !paper.volume) {
                  updates.volume = retryData.volume;
                }
                if (retryData.issue && !paper.issue) {
                  updates.issue = retryData.issue;
                }
                if (retryData.pages && !paper.pages) {
                  updates.pages = retryData.pages;
                }
                */
              if (retryData.publicationDate && !paper.publication_date) {
                updates.publication_date = retryData.publicationDate;
                const dateParts = retryData.publicationDate.split("-");
                if (dateParts.length >= 2 && !paper.month) {
                  const month = parseInt(dateParts[1]);
                  if (month >= 1 && month <= 12) {
                    updates.month = month;
                  }
                }
                if (dateParts.length >= 3 && !paper.day) {
                  const day = parseInt(dateParts[2]);
                  if (day >= 1 && day <= 31) {
                    updates.day = day;
                  }
                }
              }

              if (Object.keys(updates).length > 0) {
                const { error: updateError } = await adminClient
                  .from("user_library")
                  .update(updates)
                  .eq("id", paper.id);

                results.push({
                  paperId: paper.id,
                  title: paper.title,
                  url: paper.url,
                  success: !updateError,
                  error: updateError?.message || null,
                  updates: updateError ? null : updates,
                });
              } else {
                results.push({
                  paperId: paper.id,
                  title: paper.title,
                  url: paper.url,
                  success: true,
                  error: null,
                  updates: null,
                  message: "更新する情報がありませんでした",
                });
              }
            } else {
              // リトライも失敗した場合はスキップ
              results.push({
                paperId: paper.id,
                title: paper.title,
                url: paper.url,
                success: false,
                error: "レート制限によりスキップ",
                updates: null,
              });
            }
          } catch (retryError) {
            results.push({
              paperId: paper.id,
              title: paper.title,
              url: paper.url,
              success: false,
              error: "レート制限によりスキップ",
              updates: null,
            });
          }
        } else {
          // エラーレスポンスの詳細を取得
          const errorText = await apiResponse.text().catch(() => "");
          let errorMessage = `API error: ${apiResponse.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            if (errorText) {
              errorMessage = `${errorMessage} - ${errorText.substring(0, 200)}`;
            }
          }
          
          console.warn(
            `API error for paper ${paper.id}: ${apiResponse.status}`,
            errorMessage
          );
          results.push({
            paperId: paper.id,
            title: paper.title,
            url: paper.url,
            success: false,
            error: errorMessage,
            updates: null,
          });
        }
      } catch (error) {
        console.error(`API error for paper ${paper.id}:`, error);
        results.push({
          paperId: paper.id,
          title: paper.title,
          url: paper.url,
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error",
          updates: null,
        });
      }
    }

    const successCount = results.filter((r) => r.success && r.updates).length;
    const skippedCount = results.filter(
      (r) => r.success && !r.updates
    ).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      updated: successCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error("Update metadata error:", error);
    return NextResponse.json(
      { error: error?.message || "メタデータ更新に失敗しました" },
      { status: 500 }
    );
  }
}

