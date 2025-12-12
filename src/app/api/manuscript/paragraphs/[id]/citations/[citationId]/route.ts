import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * 引用論文を削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; citationId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const resolvedParams = await params;
    const citationId = resolvedParams.citationId;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // まず所有権を確認
    const { data: citation, error: fetchError } = await adminClient
      .from("paragraph_citations")
      .select(`
        paragraph_id,
        manuscript_paragraphs!inner(
          worksheet_id,
          manuscript_worksheets!inner(user_id)
        )
      `)
      .eq("id", citationId)
      .single();

    if (fetchError || !citation) {
      return NextResponse.json(
        { error: "引用論文が見つかりません" },
        { status: 404 }
      );
    }

    // 所有権確認
    const worksheet = (citation as any).manuscript_paragraphs?.manuscript_worksheets;
    if (!worksheet || worksheet.user_id !== userId) {
      return NextResponse.json(
        { error: "アクセス権限がありません" },
        { status: 403 }
      );
    }

    // 削除実行
    const { error } = await adminClient
      .from("paragraph_citations")
      .delete()
      .eq("id", citationId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Citation delete error:", error);
    return NextResponse.json(
      { error: error?.message || "引用論文の削除に失敗しました" },
      { status: 500 }
    );
  }
}






