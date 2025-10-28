import { NextRequest, NextResponse } from "next/server";
import { citationMapGenerator } from "@/lib/citation-map-generator";

export async function POST(request: NextRequest) {
  try {
    const { paperDOI }: { paperDOI: string } = await request.json();

    if (!paperDOI || paperDOI.trim().length === 0) {
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

    // 可視化データを生成
    const visualizationData =
      citationMapGenerator.generateVisualizationData(citationMap);

    return NextResponse.json({
      success: true,
      citationMap,
      visualizationData,
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

