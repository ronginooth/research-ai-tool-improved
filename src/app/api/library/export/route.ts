import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { convertPapersToBibTeX } from "@/lib/bibtex-parser";
import { convertPapersToCSLArray } from "@/lib/csl-converter";

const DEFAULT_USER = "demo-user-123";

/**
 * ライブラリから論文をエクスポート（BibTeXまたはCSL-JSON形式）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const format = searchParams.get("format") || "bibtex"; // "bibtex" or "csl-json"
    const paperIds = searchParams.get("paperIds"); // カンマ区切りの論文ID（オプション）
    
    const { adminClient } = await getSupabaseForUser(request, userId);
    
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }
    
    // ライブラリから論文を取得
    let query = adminClient
      .from("user_library")
      .select("*")
      .eq("user_id", userId);
    
    // 論文IDが指定されている場合は、それらのみを取得
    if (paperIds) {
      const idsArray = paperIds.split(",").filter(Boolean);
      if (idsArray.length > 0) {
        query = query.in("id", idsArray);
      }
    }
    
    const { data: papers, error } = await query.order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching papers:", error);
      return NextResponse.json(
        { error: "Failed to fetch papers" },
        { status: 500 }
      );
    }
    
    if (!papers || papers.length === 0) {
      return NextResponse.json(
        { error: "No papers found in library" },
        { status: 404 }
      );
    }
    
    // Paper形式に変換
    const formattedPapers = papers.map((paper: any) => ({
      id: paper.id,
      paperId: paper.paper_id,
      title: paper.title,
      authors: paper.authors || "",
      year: paper.year || 0,
      month: paper.month || null,
      day: paper.day || null,
      venue: paper.venue || "",
      volume: paper.volume || undefined,
      issue: paper.issue || undefined,
      pages: paper.pages || undefined,
      doi: paper.doi || "",
      url: paper.url || "",
      abstract: paper.abstract || "",
    }));
    
    if (format === "csl-json") {
      // CSL-JSON形式でエクスポート
      const cslItems = convertPapersToCSLArray(formattedPapers);
      return NextResponse.json(cslItems, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="library-${Date.now()}.json"`,
        },
      });
    } else {
      // BibTeX形式でエクスポート
      const bibtexContent = convertPapersToBibTeX(formattedPapers);
      return new NextResponse(bibtexContent, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="library-${Date.now()}.bib"`,
        },
      });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: `Failed to export: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

