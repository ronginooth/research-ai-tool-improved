import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PaperAIInsights } from "@/types";

interface SaveInsightsBody {
  paperId: string;
  insights: PaperAIInsights;
  userId?: string;
  pdfUrl?: string | null;
  htmlUrl?: string | null;
}

const DEMO_USER = "demo-user-123";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveInsightsBody;
    const userId = body.userId || DEMO_USER;

    if (!body.paperId || !body.insights) {
      return NextResponse.json(
        { error: "paperIdとinsightsは必須です" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      ai_summary: body.insights,
      ai_summary_updated_at: new Date().toISOString(),
    };

    if (body.pdfUrl !== undefined) {
      updatePayload.pdf_url = body.pdfUrl;
    }
    if (body.htmlUrl !== undefined) {
      updatePayload.html_url = body.htmlUrl;
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("user_library")
      .update(updatePayload)
      .eq("paper_id", body.paperId)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Save AI summary error", error);
      return NextResponse.json(
        { error: "AI解説の保存に失敗しました" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "対象の論文が見つかりません" },
        { status: 404 }
      );
    }

    const normalized = {
      ...data,
      paperId: data.paper_id ?? data.paperId,
      citationCount: data.citation_count ?? data.citationCount,
      aiSummary: data.ai_summary ?? data.aiSummary,
      aiSummaryUpdatedAt: data.ai_summary_updated_at ?? data.aiSummaryUpdatedAt,
      pdfUrl: data.pdf_url ?? data.pdfUrl,
      htmlUrl: data.html_url ?? data.htmlUrl,
    };

    return NextResponse.json({ success: true, paper: normalized });
  } catch (error: any) {
    console.error("Save AI summary route error", error);
    return NextResponse.json(
      { error: error?.message ?? "AI解説の保存に失敗しました" },
      { status: 500 }
    );
  }
}
