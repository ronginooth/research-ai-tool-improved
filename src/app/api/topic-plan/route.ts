import { NextRequest, NextResponse } from "next/server";
import { generateSearchPlan } from "@/lib/topic-planner";

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "研究トピックが必要です" },
        { status: 400 }
      );
    }

    const plan = await generateSearchPlan({ topic, language: "ja" });
    return NextResponse.json({ plan });
  } catch (error: any) {
    console.error("Topic plan error:", error);
    return NextResponse.json(
      { error: error?.message || "検索プランの生成に失敗しました" },
      { status: 500 }
    );
  }
}
