import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// タグを追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = "demo-user-123", paperId, tag } = body;

    if (!paperId || !tag) {
      return NextResponse.json(
        { error: "論文IDとタグが必要です" },
        { status: 400 }
      );
    }

    // 既存のタグを取得
    const { data: existingPaper } = await supabaseAdmin
      .from("user_library")
      .select("tags")
      .eq("user_id", userId)
      .eq("id", paperId)
      .single();

    if (!existingPaper) {
      return NextResponse.json(
        { error: "論文が見つかりません" },
        { status: 404 }
      );
    }

    const currentTags = existingPaper.tags || [];

    // タグが既に存在する場合は何もしない
    if (currentTags.includes(tag)) {
      return NextResponse.json({
        success: true,
        message: "タグは既に存在します",
      });
    }

    // タグを追加
    const updatedTags = [...currentTags, tag];

    const { error } = await supabaseAdmin
      .from("user_library")
      .update({ tags: updatedTags })
      .eq("user_id", userId)
      .eq("id", paperId);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "データベースエラーが発生しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tags: updatedTags,
      message: "タグを追加しました",
    });
  } catch (error) {
    console.error("Add tag error:", error);
    return NextResponse.json(
      { error: "タグの追加に失敗しました" },
      { status: 500 }
    );
  }
}

// タグを削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "demo-user-123";
    const paperId = searchParams.get("paperId");
    const tag = searchParams.get("tag");

    if (!paperId || !tag) {
      return NextResponse.json(
        { error: "論文IDとタグが必要です" },
        { status: 400 }
      );
    }

    // 既存のタグを取得
    const { data: existingPaper } = await supabaseAdmin
      .from("user_library")
      .select("tags")
      .eq("user_id", userId)
      .eq("id", paperId)
      .single();

    if (!existingPaper) {
      return NextResponse.json(
        { error: "論文が見つかりません" },
        { status: 404 }
      );
    }

    const currentTags = existingPaper.tags || [];

    // タグを削除
    const updatedTags = currentTags.filter((t: string) => t !== tag);

    const { error } = await supabaseAdmin
      .from("user_library")
      .update({ tags: updatedTags })
      .eq("user_id", userId)
      .eq("id", paperId);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "データベースエラーが発生しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tags: updatedTags,
      message: "タグを削除しました",
    });
  } catch (error) {
    console.error("Remove tag error:", error);
    return NextResponse.json(
      { error: "タグの削除に失敗しました" },
      { status: 500 }
    );
  }
}

// タグ一覧を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "demo-user-123";

    const { data, error } = await supabaseAdmin
      .from("user_library")
      .select("tags")
      .eq("user_id", userId)
      .not("tags", "is", null);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "データベースエラーが発生しました" },
        { status: 500 }
      );
    }

    // すべてのタグを取得して重複を除去
    const allTags = [
      ...new Set(
        (data || []).flatMap((item) => item.tags || []).filter(Boolean)
      ),
    ].sort();

    return NextResponse.json({
      success: true,
      tags: allTags,
      total: allTags.length,
    });
  } catch (error) {
    console.error("Get tags error:", error);
    return NextResponse.json(
      { error: "タグの取得に失敗しました" },
      { status: 500 }
    );
  }
}



















