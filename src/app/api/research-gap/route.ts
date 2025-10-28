import { NextRequest, NextResponse } from "next/server";
import { researchGapFinder } from "@/lib/research-gap-finder";

export async function POST(request: NextRequest) {
  try {
    const { topic }: { topic: string } = await request.json();

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "研究トピックが必要です" },
        { status: 400 }
      );
    }

    // 研究ギャップを検索
    const gaps = await researchGapFinder.findResearchGaps(topic);

    // ギャップ分析の統計を取得
    const stats = researchGapFinder.getGapAnalysisStats(gaps);

    return NextResponse.json({
      success: true,
      gaps,
      stats,
      message:
        gaps.length > 0
          ? `${gaps.length}個の研究ギャップを発見しました`
          : "研究ギャップが見つかりませんでした。",
    });
  } catch (error) {
    console.error("Research gap finding error:", error);
    return NextResponse.json(
      { error: "研究ギャップの検索に失敗しました" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic");

    if (!topic) {
      return NextResponse.json(
        { error: "研究トピックが必要です" },
        { status: 400 }
      );
    }

    // 研究ギャップを検索
    const gaps = await researchGapFinder.findResearchGaps(topic);

    return NextResponse.json({
      success: true,
      gaps,
    });
  } catch (error) {
    console.error("Research gap finding error:", error);
    return NextResponse.json(
      { error: "研究ギャップの検索に失敗しました" },
      { status: 500 }
    );
  }
}

