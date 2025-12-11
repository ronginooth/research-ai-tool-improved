import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * パラグラフ詳細取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const resolvedParams = await params;
    const paragraphId = resolvedParams.id;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    const { data, error } = await adminClient
      .from("manuscript_paragraphs")
      .select(`
        *,
        manuscript_worksheets!inner(user_id)
      `)
      .eq("id", paragraphId)
      .eq("manuscript_worksheets.user_id", userId)
      .single();

    if (error) throw error;

    // データを整形
    const { manuscript_worksheets, ...paragraph } = data as any;

    return NextResponse.json({ paragraph });
  } catch (error: any) {
    console.error("Paragraph fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "パラグラフの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * パラグラフ更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const resolvedParams = await params;
    const paragraphId = resolvedParams.id;
    const { title, content, description, status, word_count, japanese_translation } = body;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    
    if (content !== undefined) {
      updateData.content = content;
      // 単語数を自動計算
      if (content) {
        updateData.word_count = content.split(/\s+/).filter((w: string) => w.length > 0).length;
      } else {
        updateData.word_count = 0;
      }
    }

    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (word_count !== undefined) updateData.word_count = word_count;
    if (japanese_translation !== undefined) updateData.japanese_translation = japanese_translation;

    // まず所有権を確認
    const { data: existingParagraph, error: fetchError } = await adminClient
      .from("manuscript_paragraphs")
      .select(`
        id,
        manuscript_worksheets!inner(
          id,
          user_id
        )
      `)
      .eq("id", paragraphId)
      .single();

    if (fetchError || !existingParagraph) {
      return NextResponse.json(
        { error: "パラグラフが見つかりません" },
        { status: 404 }
      );
    }

    // 所有権確認
    const worksheet = (existingParagraph as any).manuscript_worksheets;
    if (!worksheet || worksheet.user_id !== userId) {
      return NextResponse.json(
        { error: "アクセス権限がありません" },
        { status: 403 }
      );
    }

    // 更新実行
    const { data, error } = await adminClient
      .from("manuscript_paragraphs")
      .update(updateData)
      .eq("id", paragraphId)
      .select("*")
      .single();

    if (error) throw error;

    const { manuscript_worksheets, ...paragraph } = data as any;

    return NextResponse.json({ paragraph });
  } catch (error: any) {
    console.error("Paragraph update error:", error);
    return NextResponse.json(
      { error: error?.message || "パラグラフの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * パラグラフ削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const resolvedParams = await params;
    const paragraphId = resolvedParams.id;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // パラグラフ情報を取得
    const { data: paragraph, error: fetchError } = await adminClient
      .from("manuscript_paragraphs")
      .select("worksheet_id, paragraph_number")
      .eq("id", paragraphId)
      .single();

    if (fetchError || !paragraph) {
      return NextResponse.json(
        { error: "パラグラフが見つかりません" },
        { status: 404 }
      );
    }

    // ワークシートの所有権確認
    const { data: worksheet } = await adminClient
      .from("manuscript_worksheets")
      .select("user_id")
      .eq("id", paragraph.worksheet_id)
      .eq("user_id", userId)
      .single();

    if (!worksheet) {
      return NextResponse.json(
        { error: "アクセス権限がありません" },
        { status: 403 }
      );
    }

    // パラグラフを削除
    const { error: deleteError } = await adminClient
      .from("manuscript_paragraphs")
      .delete()
      .eq("id", paragraphId);

    if (deleteError) throw deleteError;

    // 後続のパラグラフ番号を再採番（2段階で安全に更新）
    const deletedNum = parseInt(paragraph.paragraph_number.replace("P", ""));
    const { data: allParagraphs } = await adminClient
      .from("manuscript_paragraphs")
      .select("id, paragraph_number")
      .eq("worksheet_id", paragraph.worksheet_id);

    // 数値で比較（文字列比較ではP10 < P2になってしまうため）
    const paragraphsToUpdate = (allParagraphs || []).filter((p) => {
      const num = parseInt(p.paragraph_number.replace("P", ""));
      return num > deletedNum;
    });

    if (paragraphsToUpdate.length === 0) {
      // 更新するパラグラフがない場合
      return NextResponse.json({ success: true });
    }

    // ステップ1: すべての後続パラグラフを一時的な番号に変更（重複を避けるため）
    const tempOffset = 10000; // 一時的な番号のオフセット
    const sortedToUpdate = [...paragraphsToUpdate].sort((a, b) => {
      const numA = parseInt(a.paragraph_number.replace("P", ""));
      const numB = parseInt(b.paragraph_number.replace("P", ""));
      return numB - numA; // 大きい番号から順に
    });

    for (let i = 0; i < sortedToUpdate.length; i++) {
      const p = sortedToUpdate[i];
      const tempParagraphNumber = `P${tempOffset + i}`;
      const { error: updateError } = await adminClient
        .from("manuscript_paragraphs")
        .update({ paragraph_number: tempParagraphNumber })
        .eq("id", p.id);
      
      if (updateError) {
        console.error(`Failed to update paragraph ${p.id} to temp number:`, updateError);
        throw updateError;
      }
    }

    // ステップ2: 正しい番号に更新（元の順序を保持して小さい番号から順に）
    // 元の番号順でソート（小さい番号から順に）
    const sortedToUpdateAsc = [...paragraphsToUpdate].sort((a, b) => {
      const numA = parseInt(a.paragraph_number.replace("P", ""));
      const numB = parseInt(b.paragraph_number.replace("P", ""));
      return numA - numB; // 小さい番号から順に
    });

    for (let i = 0; i < sortedToUpdateAsc.length; i++) {
      const p = sortedToUpdateAsc[i];
      const newParagraphNumber = `P${deletedNum + i}`;
      const { error: updateError } = await adminClient
        .from("manuscript_paragraphs")
        .update({ paragraph_number: newParagraphNumber })
        .eq("id", p.id);
      
      if (updateError) {
        console.error(`Failed to update paragraph ${p.id} to final number:`, updateError);
        throw updateError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Paragraph delete error:", error);
    return NextResponse.json(
      { error: error?.message || "パラグラフの削除に失敗しました" },
      { status: 500 }
    );
  }
}


