import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEMO_USER = "demo-user-123";

type PreviewPayload = {
  paperId: string;
  userId?: string;
  pdfUrl?: string | null;
  htmlUrl?: string | null;
};

function normalizePaper(record: any) {
  if (!record) return null;
  return {
    ...record,
    paperId: record.paper_id ?? record.paperId,
    citationCount: record.citation_count ?? record.citationCount,
    aiSummary: record.ai_summary ?? record.aiSummary,
    aiSummaryUpdatedAt:
      record.ai_summary_updated_at ?? record.aiSummaryUpdatedAt,
    pdfUrl: record.pdf_url ?? record.pdfUrl,
    htmlUrl: record.html_url ?? record.htmlUrl,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PreviewPayload;
    const paperId = body.paperId;
    const userId = body.userId || DEMO_USER;

    if (!paperId) {
      return NextResponse.json(
        { error: "paperId は必須です" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.pdfUrl !== undefined) {
      updates.pdf_url = body.pdfUrl;
    }
    if (body.htmlUrl !== undefined) {
      updates.html_url = body.htmlUrl;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "更新する項目がありません" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("user_library")
      .update(updates)
      .eq("paper_id", paperId)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Preview update error", error);
      return NextResponse.json(
        { error: "プレビュー情報の更新に失敗しました" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "対象の論文が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      paper: normalizePaper(data),
    });
  } catch (error: any) {
    console.error("Preview route error", error);
    return NextResponse.json(
      { error: error?.message ?? "プレビュー情報の更新に失敗しました" },
      { status: 500 }
    );
  }
}
