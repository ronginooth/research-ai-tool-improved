import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { parseWorksheet, structureToJson } from "@/lib/manuscript/worksheet-parser";

const DEFAULT_USER = "demo-user-123";

/**
 * ワークシート一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;

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
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ worksheets: data || [] });
  } catch (error: any) {
    console.error("Worksheets fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "ワークシートの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * ワークシート作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const title = body.title || "Untitled Worksheet";
    const content = body.content || "";

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // ワークシートを解析
    let structure = null;
    if (content) {
      try {
        const parsed = parseWorksheet(content);
        structure = structureToJson(parsed);
      } catch (parseError) {
        console.warn("Worksheet parsing error:", parseError);
        // パースエラーがあってもワークシートは作成する
      }
    }

    const { data, error } = await adminClient
      .from("manuscript_worksheets")
      .insert({
        user_id: userId,
        title,
        content,
        structure,
      })
      .select()
      .single();

    if (error) throw error;

    // パラグラフが解析された場合は、パラグラフレコードも作成
    if (structure && structure.paragraphs) {
      const parsed = parseWorksheet(content);
      const paragraphInserts = parsed.paragraphs.map((p) => ({
        worksheet_id: data.id,
        paragraph_number: p.paragraphNumber,
        section_type: p.sectionType,
        title: p.title,
        description: p.description,
        status: "pending",
        word_count: 0,
      }));

      if (paragraphInserts.length > 0) {
        const { error: paraError } = await adminClient
          .from("manuscript_paragraphs")
          .insert(paragraphInserts);

        if (paraError) {
          console.error("Paragraph insert error:", paraError);
          // エラーがあってもワークシートは作成済みなので続行
        }
      }
    }

    return NextResponse.json({ worksheet: data });
  } catch (error: any) {
    console.error("Worksheet creation error:", error);
    return NextResponse.json(
      { error: error?.message || "ワークシートの作成に失敗しました" },
      { status: 500 }
    );
  }
}






