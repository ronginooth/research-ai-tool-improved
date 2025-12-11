import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * パラグラフ番号を再採番（欠番を修正）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const { worksheetId } = body;

    if (!worksheetId) {
      return NextResponse.json(
        { error: "worksheetId は必須です" },
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

    // すべてのパラグラフを取得
    const { data: allParagraphs, error: fetchError } = await adminClient
      .from("manuscript_paragraphs")
      .select("id, paragraph_number")
      .eq("worksheet_id", worksheetId);

    if (fetchError) throw fetchError;

    if (!allParagraphs || allParagraphs.length === 0) {
      return NextResponse.json({ success: true, message: "パラグラフがありません" });
    }

    // paragraph_numberで数値ソート
    const sortedParagraphs = [...allParagraphs].sort((a, b) => {
      const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
      const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
      return numA - numB;
    });

    // パラグラフ番号を再採番（2段階で安全に更新）
    // ステップ1: すべてのパラグラフを一時的な番号に変更
    const tempOffset = 10000;
    for (let i = 0; i < sortedParagraphs.length; i++) {
      const tempParagraphNumber = `P${tempOffset + i}`;
      const { error } = await adminClient
        .from("manuscript_paragraphs")
        .update({ paragraph_number: tempParagraphNumber })
        .eq("id", sortedParagraphs[i].id)
        .eq("worksheet_id", worksheetId);

      if (error) {
        console.error(`Failed to update paragraph ${sortedParagraphs[i].id} to temp number:`, error);
        throw error;
      }
    }

    // ステップ2: 正しい番号に更新（P1, P2, P3...）
    for (let i = 0; i < sortedParagraphs.length; i++) {
      const newParagraphNumber = `P${i + 1}`;
      const { error } = await adminClient
        .from("manuscript_paragraphs")
        .update({ paragraph_number: newParagraphNumber })
        .eq("id", sortedParagraphs[i].id)
        .eq("worksheet_id", worksheetId);

      if (error) {
        console.error(`Failed to update paragraph ${sortedParagraphs[i].id} to final number:`, error);
        throw error;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${sortedParagraphs.length}個のパラグラフを再採番しました` 
    });
  } catch (error: any) {
    console.error("Paragraph renumber error:", error);
    return NextResponse.json(
      { error: error?.message || "パラグラフの再採番に失敗しました" },
      { status: 500 }
    );
  }
}




