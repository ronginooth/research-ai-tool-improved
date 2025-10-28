import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const {
      topic,
      context,
      analysis,
      papers,
      userId = "demo-user-123",
    } = await request.json();

    if (!topic || !analysis) {
      return NextResponse.json(
        { error: "研究トピックと分析内容が必要です" },
        { status: 400 }
      );
    }

    // Supabaseが利用できない場合はモックデータを返す
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: true,
        id: `mock-${Date.now()}`,
        message: "研究ギャップ分析が保存されました（モックモード）",
      });
    }

    // 研究ギャップ分析をデータベースに保存
    const { data, error } = await supabaseAdmin
      .from("gap_analyses")
      .insert({
        user_id: userId,
        topic: topic,
        context: context,
        analysis: analysis,
        papers: papers,
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      // テーブルが存在しない場合はモックモードで動作
      return NextResponse.json({
        success: true,
        id: `mock-${Date.now()}`,
        message: "研究ギャップ分析が保存されました（モックモード）",
      });
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message: "研究ギャップ分析が保存されました",
    });
  } catch (error) {
    console.error("Error saving gap analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to save gap analysis: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "demo-user-123";

    // Supabaseが利用できない場合はモックデータを返す
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: true,
        analyses: [],
      });
    }

    // ユーザーの研究ギャップ分析一覧を取得
    const { data, error } = await supabaseAdmin
      .from("gap_analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "データベースエラーが発生しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analyses: data || [],
    });
  } catch (error) {
    console.error("Error fetching gap analyses:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch gap analyses: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
