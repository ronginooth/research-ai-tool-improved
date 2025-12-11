import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * ワークシート全体の引用論文一覧取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const resolvedParams = await params;
    const worksheetId = resolvedParams.id;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    // ワークシートの所有権確認
    const { data: worksheet, error: worksheetError } = await adminClient
      .from("manuscript_worksheets")
      .select("id, user_id")
      .eq("id", worksheetId)
      .eq("user_id", userId)
      .single();

    if (worksheetError || !worksheet) {
      return NextResponse.json(
        { error: "ワークシートが見つかりません" },
        { status: 404 }
      );
    }

    // ワークシート内のすべてのパラグラフを取得
    const { data: paragraphs, error: paragraphsError } = await adminClient
      .from("manuscript_paragraphs")
      .select("id, paragraph_number")
      .eq("worksheet_id", worksheetId)
      .order("paragraph_number", { ascending: true });

    if (paragraphsError) {
      throw paragraphsError;
    }

    if (!paragraphs || paragraphs.length === 0) {
      return NextResponse.json({ citations: [] });
    }

    const paragraphIds = paragraphs.map((p) => p.id);

    // すべてのパラグラフの引用を取得
    const { data, error } = await adminClient
      .from("paragraph_citations")
      .select(`
        *,
        user_library!inner(
          id,
          title,
          authors,
          year,
          venue,
          abstract,
          url,
          doi
        ),
        manuscript_paragraphs!inner(
          id,
          paragraph_number
        )
      `)
      .in("paragraph_id", paragraphIds)
      .order("citation_order", { ascending: true });

    if (error) throw error;

    // データを整形
    const citations = (data || []).map((c: any) => {
      const { user_library, manuscript_paragraphs, ...citation } = c;
      return {
        ...citation,
        paper: user_library,
        paragraph: {
          id: manuscript_paragraphs.id,
          paragraph_number: manuscript_paragraphs.paragraph_number,
        },
      };
    });

    return NextResponse.json({ citations });
  } catch (error: any) {
    console.error("Worksheet citations fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "引用論文の取得に失敗しました" },
      { status: 500 }
    );
  }
}



