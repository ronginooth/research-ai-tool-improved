import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { s2Headers } from "@/lib/semantic-scholar";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = "demo-user-123", limit = 10 } = body;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // DOIがない論文を取得（urlカラムにSemantic Scholar URLがあるもの）
    const { data: papers, error } = await adminClient
      .from("user_library")
      .select("id, title, url")
      .eq("user_id", userId)
      .is("doi", null)
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
      let foundDoi: string | null = null;

      // Semantic Scholar URLからpaperIdを抽出
      // URL形式: https://www.semanticscholar.org/paper/{paperId}
      const paperIdMatch = paper.url?.match(/semanticscholar\.org\/paper\/([^\/\?]+)/i);
      
      if (paperIdMatch && paperIdMatch[1]) {
        const paperId = paperIdMatch[1];
        
        try {
          // レート制限対策（2秒待機 - APIキーがない場合はより長く待機）
          const waitTime = process.env.SEMANTIC_SCHOLAR_API_KEY ? 2000 : 3000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Semantic Scholar APIでpaperIdからDOIを取得
          const apiResponse = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,doi,year,authors`,
            {
              headers: s2Headers()
            }
          );

          if (apiResponse.ok) {
            const paperData = await apiResponse.json();
            console.log(`[Update DOIs] Paper ${paper.id}: API response - has DOI: ${!!paperData.doi}, title: ${paperData.title?.substring(0, 50)}`);
            if (paperData.doi) {
              foundDoi = paperData.doi;
            } else {
              console.log(`[Update DOIs] Paper ${paper.id} (${paperId}): DOI not found in API response`);
            }
          } else if (apiResponse.status === 429) {
            // レート制限の場合は長めに待機（10秒）
            console.warn(`Rate limited for paper ${paper.id}, waiting 10 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            // リトライ（1回のみ）
            try {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              const retryResponse = await fetch(
                `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=paperId,title,doi,year,authors`,
                {
                  headers: s2Headers()
                }
              );
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                if (retryData.doi) {
                  foundDoi = retryData.doi;
                }
              } else {
                // リトライも失敗した場合はスキップ
                results.push({
                  paperId: paper.id,
                  title: paper.title,
                  url: paper.url,
                  doi: null,
                  success: false,
                  error: "レート制限によりスキップ",
                });
                continue;
              }
            } catch (retryError) {
              results.push({
                paperId: paper.id,
                title: paper.title,
                url: paper.url,
                doi: null,
                success: false,
                error: "レート制限によりスキップ",
              });
              continue;
            }
          } else {
            console.warn(`API error for paper ${paper.id}: ${apiResponse.status}`);
          }
        } catch (error) {
          console.error(`API error for paper ${paper.id}:`, error);
        }
      }

      // DOIが見つかった場合、データベースを更新
      if (foundDoi) {
        const { error: updateError } = await adminClient
          .from("user_library")
          .update({ doi: foundDoi })
          .eq("id", paper.id);

        results.push({
          paperId: paper.id,
          title: paper.title,
          url: paper.url,
          doi: foundDoi,
          success: !updateError,
          error: updateError?.message,
        });
      } else {
        results.push({
          paperId: paper.id,
          title: paper.title,
          url: paper.url,
          doi: null,
          success: false,
          error: "DOIが見つかりませんでした",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      found: results.filter(r => r.doi).length,
      results,
    });
  } catch (error: any) {
    console.error("Update DOIs error:", error);
    return NextResponse.json(
      { error: error?.message || "DOI更新に失敗しました" },
      { status: 500 }
    );
  }
}

