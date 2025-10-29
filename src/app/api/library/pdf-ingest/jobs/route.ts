import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DEMO_USER = "demo-user-123";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get("paperId");
  const userId = searchParams.get("userId") || DEMO_USER;

  if (!paperId) {
    return NextResponse.json({ error: "paperId は必須です" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("library_pdf_processing_jobs")
    .select("id, status, created_at, started_at, finished_at, error_message")
    .eq("paper_id", paperId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "ジョブ情報の取得に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ job: data ?? null });
}
