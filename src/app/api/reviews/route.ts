import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

// GET /api/reviews?userId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "demo-user-123";

    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, reviews: data || [] });
  } catch (error: any) {
    console.error("Reviews fetch error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "レビューの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/reviews
export async function POST(request: NextRequest) {
  try {
    const {
      title,
      topic,
      content,
      paperIds,
      userId = "demo-user-123",
    } = await request.json();

    if (!title || !topic || !content) {
      return NextResponse.json(
        { success: false, error: "タイトル、トピック、内容が必要です" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("reviews")
      .insert([
        {
          user_id: userId,
          title,
          topic,
          content,
          paper_ids: paperIds || [],
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, review: data });
  } catch (error: any) {
    console.error("Review save error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "レビューの保存に失敗しました" },
      { status: 500 }
    );
  }
}
