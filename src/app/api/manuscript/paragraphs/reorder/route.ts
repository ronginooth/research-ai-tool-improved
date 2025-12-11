import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * パラグラフ順序更新
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const { worksheetId, paragraphIds } = body;

    if (!worksheetId || !Array.isArray(paragraphIds) || paragraphIds.length === 0) {
      return NextResponse.json(
        { error: "worksheetId と paragraphIds は必須です" },
        { status: 400 }
      );
    }

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // ワークシートの所有権確認
    const { data: worksheet } = await adminClient
      .from("manuscript_worksheets")
      .select("id")
      .eq("id", worksheetId)
      .eq("user_id", userId)
      .single();

    if (!worksheet) {
      return NextResponse.json(
        { error: "ワークシートが見つかりません" },
        { status: 404 }
      );
    }

    // パラグラフ番号を再採番（2段階で安全に更新）
    // ステップ1: すべてのパラグラフを一時的な番号に変更（重複を避けるため）
    const tempOffset = 10000; // 一時的な番号のオフセット
    for (let i = 0; i < paragraphIds.length; i++) {
      const tempParagraphNumber = `P${tempOffset + i}`;
      const { error } = await adminClient
        .from("manuscript_paragraphs")
        .update({ paragraph_number: tempParagraphNumber })
        .eq("id", paragraphIds[i])
        .eq("worksheet_id", worksheetId);

      if (error) {
        console.error(`Failed to update paragraph ${paragraphIds[i]} to temp number:`, error);
        throw error;
      }
    }

    // ステップ2: 正しい番号に更新
    for (let i = 0; i < paragraphIds.length; i++) {
      const newParagraphNumber = `P${i + 1}`;
      const { error } = await adminClient
        .from("manuscript_paragraphs")
        .update({ paragraph_number: newParagraphNumber })
        .eq("id", paragraphIds[i])
        .eq("worksheet_id", worksheetId);

      if (error) {
        console.error(`Failed to update paragraph ${paragraphIds[i]} to final number:`, error);
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Paragraph reorder error:", error);
    return NextResponse.json(
      { error: error?.message || "パラグラフの順序更新に失敗しました" },
      { status: 500 }
    );
  }
}

