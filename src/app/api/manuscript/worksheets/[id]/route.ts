import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { parseWorksheet, structureToJson } from "@/lib/manuscript/worksheet-parser";

const DEFAULT_USER = "demo-user-123";

/**
 * ワークシート詳細取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const { id } = await params;
    const worksheetId = id;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    const { data, error } = await adminClient
      .from("manuscript_worksheets")
      .select("*")
      .eq("id", worksheetId)
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    return NextResponse.json({ worksheet: data });
  } catch (error: any) {
    console.error("Worksheet fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "ワークシートの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * ワークシート更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const { id } = await params;
    const worksheetId = id;
    const { title, content } = body;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // コンテンツが更新された場合は再解析
    let structure = null;
    if (content) {
      try {
        const parsed = parseWorksheet(content);
        structure = structureToJson(parsed);
      } catch (parseError) {
        console.warn("Worksheet parsing error:", parseError);
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (structure !== null) updateData.structure = structure;

    const { data, error } = await adminClient
      .from("manuscript_worksheets")
      .update(updateData)
      .eq("id", worksheetId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ worksheet: data });
  } catch (error: any) {
    console.error("Worksheet update error:", error);
    return NextResponse.json(
      { error: error?.message || "ワークシートの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * ワークシート削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const { id } = await params;
    const worksheetId = id;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // CASCADEでパラグラフも削除される
    const { error } = await adminClient
      .from("manuscript_worksheets")
      .delete()
      .eq("id", worksheetId)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Worksheet delete error:", error);
    return NextResponse.json(
      { error: error?.message || "ワークシートの削除に失敗しました" },
      { status: 500 }
    );
  }
}






