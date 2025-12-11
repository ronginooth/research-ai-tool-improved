import { NextResponse } from "next/server";
import { getGeminiUsageStats } from "@/lib/gemini";

/**
 * Gemini APIキーの使用状況を取得するAPIエンドポイント
 */
export async function GET() {
  try {
    const stats = getGeminiUsageStats();
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Gemini Usage] Error getting usage stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "使用状況の取得に失敗しました",
      },
      { status: 500 }
    );
  }
}


