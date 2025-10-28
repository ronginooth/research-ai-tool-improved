import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// DELETE /api/reviews/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "レビューIDが必要です" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("reviews")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Review delete error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "レビューの削除に失敗しました" },
      { status: 500 }
    );
  }
}
