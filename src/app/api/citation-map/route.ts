import { NextRequest, NextResponse } from "next/server";
import { citationMapGenerator } from "@/lib/citation-map-generator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paperDOI, paperHTML, paperSearch, paperId }: { 
      paperDOI?: string; 
      paperHTML?: string; 
      paperSearch?: string;
      paperId?: string;
    } = body;

    // paperIdが直接提供された場合、それを使用
    if (paperId) {
      console.log(`[CITATION MAP API] Generating citation map for paperId: ${paperId}`);
      const citationMap = await citationMapGenerator
        .generateCitationMapByPaperId(paperId.trim())
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.error(`[CITATION MAP API] Error generating citation map for paperId ${paperId}:`, message);
          if (message.includes("Paper not found")) {
            return null;
          }
          throw e;
        });

      if (!citationMap) {
        console.error(`[CITATION MAP API] Citation map not found for paperId: ${paperId}`);
        const hasApiKey = !!process.env.SEMANTIC_SCHOLAR_API_KEY;
        const errorMessage = hasApiKey
          ? `指定したpaperId (${paperId}) の論文が見つかりません。paperIdが正しいか確認してください。`
          : `指定したpaperId (${paperId}) の論文が見つかりません。レート制限の可能性があります。SEMANTIC_SCHOLAR_API_KEYを設定すると、より高いレート制限で利用できます。`;
        return NextResponse.json(
          { 
            success: false, 
            error: errorMessage,
            paperId: paperId,
            suggestion: hasApiKey ? null : "SEMANTIC_SCHOLAR_API_KEYを設定することをお勧めします。"
          },
          { status: 404 }
        );
      }

      // 可視化データを生成
      const visualizationData =
        citationMapGenerator.generateVisualizationData(citationMap);

      return NextResponse.json({
        success: true,
        citationMap,
        visualizationData,
        doi: citationMap.center?.doi || null,
        paperId: paperId,
        stats: {
          totalNodes: visualizationData.nodes.length,
          totalEdges: visualizationData.edges.length,
          citedByCount: citationMap.citedBy.length,
          referencesCount: citationMap.references.length,
          indirectConnectionsCount: citationMap.indirectConnections.length,
        },
      });
    }

    let doiToUse: string | null = null;

    // 検索クエリが提供された場合、Semantic Scholar APIで検索してDOIを取得
    if (paperSearch && !paperDOI && !paperHTML) {
      try {
        const searchResponse = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(paperSearch.trim())}&limit=5&fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess,doi`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept": "application/json",
            }
          }
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.data && searchData.data.length > 0) {
            const firstPaper = searchData.data[0];
            if (firstPaper.doi) {
              doiToUse = normalizeDOI(firstPaper.doi);
            } else if (firstPaper.paperId) {
              // DOIがない場合、paperIdから直接論文を取得してDOIを確認
              const paperResponse = await fetch(
                `https://api.semanticscholar.org/graph/v1/paper/${firstPaper.paperId}?fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess,doi`,
                {
                  headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json",
                  }
                }
              );
              if (paperResponse.ok) {
                const paperData = await paperResponse.json();
                if (paperData.doi) {
                  doiToUse = normalizeDOI(paperData.doi);
                }
              }
            }
          }
        }
      } catch (searchError) {
        console.error("Paper search error:", searchError);
      }
    }
    
    // HTML URLが提供された場合、DOIを抽出するか、URLから直接検索
    if (paperHTML && !paperDOI && !doiToUse) {
      // HTML URLからDOIを抽出を試みる
      const doiMatch = paperHTML.match(/doi\.org\/([^\s"<>]+)/i) || 
                       paperHTML.match(/doi[:\s]+([^\s"<>]+)/i);
      if (doiMatch) {
        doiToUse = normalizeDOI(doiMatch[1]);
      } else {
        // DOIが見つからない場合、URL形式でSemantic Scholar APIを直接使用
        try {
          const urlResponse = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(paperHTML.trim())}?fields=paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess,doi`,
            { 
              headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
              }
            }
          );
          
          if (urlResponse.ok) {
            const urlData = await urlResponse.json();
            if (urlData.paperId) {
              // paperIdからDOIを取得できた場合、それを使用
              if (urlData.doi) {
                doiToUse = normalizeDOI(urlData.doi);
              } else {
                // DOIがない場合、エラーを返す
                return NextResponse.json(
                  { 
                    success: false, 
                    error: "この論文のDOIが見つかりません。DOIが必要です。",
                    paperId: urlData.paperId,
                    title: urlData.title,
                  },
                  { status: 404 }
                );
              }
            }
          }
        } catch (urlError) {
          console.error("HTML URL search error:", urlError);
        }
      }
    } else if (paperDOI) {
      doiToUse = normalizeDOI(paperDOI);
    }

    if (!doiToUse || doiToUse.trim().length === 0) {
      return NextResponse.json(
        { error: "論文のDOI、HTML URL、または検索クエリが必要です。検索で論文が見つからない場合、DOIが必要です。" },
        { status: 400 }
      );
    }

    // 引用マップを生成
    const citationMap = await citationMapGenerator
      .generateCitationMap(doiToUse)
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("Paper not found")) {
          return null;
        }
        throw e;
      });

    if (!citationMap) {
      return NextResponse.json(
        { success: false, error: "指定したDOIの論文が見つかりません" },
        { status: 404 }
      );
    }

    // 可視化データを生成
    const visualizationData =
      citationMapGenerator.generateVisualizationData(citationMap);

    return NextResponse.json({
      success: true,
      citationMap,
      visualizationData,
      doi: citationMap.center?.doi || doiToUse,
      stats: {
        totalNodes: visualizationData.nodes.length,
        totalEdges: visualizationData.edges.length,
        citedByCount: citationMap.citedBy.length,
        referencesCount: citationMap.references.length,
        indirectConnectionsCount: citationMap.indirectConnections.length,
      },
    });
  } catch (error: any) {
    console.error("Citation map generation error:", error);
    return NextResponse.json(
      { error: `引用マップの生成に失敗しました: ${error?.message || error}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paperDOI = searchParams.get("doi");

    if (!paperDOI) {
      return NextResponse.json(
        { error: "論文のDOIが必要です" },
        { status: 400 }
      );
    }

    const normalized = normalizeDOI(paperDOI);

    // 引用マップを生成
    const citationMap = await citationMapGenerator
      .generateCitationMap(normalized)
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("Paper not found")) {
          return null;
        }
        throw e;
      });

    if (!citationMap) {
      return NextResponse.json(
        { success: false, error: "指定したDOIの論文が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      citationMap,
    });
  } catch (error: any) {
    console.error("Citation map generation error:", error);
    return NextResponse.json(
      { error: `引用マップの生成に失敗しました: ${error?.message || error}` },
      { status: 500 }
    );
  }
}

function normalizeDOI(input: string): string {
  const trimmed = input.trim();
  return trimmed
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/^DOI:\s*/i, "");
}

