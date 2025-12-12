import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * パラグラフの引用論文一覧取得
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

    // まず所有権を確認
    const { data: paragraph, error: paraError } = await adminClient
      .from("manuscript_paragraphs")
      .select("worksheet_id, manuscript_worksheets!inner(user_id)")
      .eq("id", paragraphId)
      .single();

    if (paraError || !paragraph) {
      return NextResponse.json(
        { error: "パラグラフが見つかりません" },
        { status: 404 }
      );
    }

    const worksheet = (paragraph as any).manuscript_worksheets;
    if (!worksheet || worksheet.user_id !== userId) {
      return NextResponse.json(
        { error: "アクセス権限がありません" },
        { status: 403 }
      );
    }

    // 引用論文を取得
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
          url
        )
      `)
      .eq("paragraph_id", paragraphId)
      .order("citation_order", { ascending: true });

    if (error) throw error;

    // データを整形
    const citations = (data || []).map((c: any) => {
      const { user_library, manuscript_paragraphs, ...citation } = c;
      return {
        ...citation,
        paper: user_library,
      };
    });

    return NextResponse.json({ citations });
  } catch (error: any) {
    console.error("Citations fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "引用論文の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * パラグラフに引用論文を追加
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const resolvedParams = await params;
    const paragraphId = resolvedParams.id;
    const { paperId, citationContext, citationOrder } = body;

    if (!paperId) {
      return NextResponse.json(
        { error: "paperId は必須です" },
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

    // 既存の引用の最大順序を取得
    let order = citationOrder;
    if (order === undefined) {
      const { data: existingCitations } = await adminClient
        .from("paragraph_citations")
        .select("citation_order")
        .eq("paragraph_id", paragraphId)
        .order("citation_order", { ascending: false })
        .limit(1);

      order = existingCitations && existingCitations.length > 0
        ? (existingCitations[0].citation_order || 0) + 1
        : 1;
    }

    const { data, error } = await adminClient
      .from("paragraph_citations")
      .insert({
        paragraph_id: paragraphId,
        paper_id: paperId,
        citation_context: citationContext || null,
        citation_order: order,
      })
      .select(`
        *,
        user_library!inner(
          id,
          title,
          authors,
          year,
          venue,
          abstract,
          url
        )
      `)
      .single();

    if (error) throw error;

    // データを整形
    const { user_library, ...citation } = data as any;

    return NextResponse.json({
      citation: {
        ...citation,
        paper: user_library,
      },
    });
  } catch (error: any) {
    console.error("Citation add error:", error);
    return NextResponse.json(
      { error: error?.message || "引用論文の追加に失敗しました" },
      { status: 500 }
    );
  }
}






