import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { parseBibTeXToPapers } from "@/lib/bibtex-parser";
import { convertCSLToPaper } from "@/lib/csl-converter";

const DEFAULT_USER = "demo-user-123";

/**
 * BibTeXまたはCSL-JSON形式で論文をインポート
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const format = body.format || "bibtex"; // "bibtex" or "csl-json"
    const content = body.content; // BibTeX文字列またはCSL-JSON配列
    
    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
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
    
    let papers: Partial<any>[] = [];
    
    if (format === "csl-json") {
      // CSL-JSON形式をパース
      let cslItems;
      if (typeof content === "string") {
        cslItems = JSON.parse(content);
      } else {
        cslItems = content;
      }
      
      if (!Array.isArray(cslItems)) {
        return NextResponse.json(
          { error: "CSL-JSON content must be an array" },
          { status: 400 }
        );
      }
      
      papers = cslItems.map(convertCSLToPaper);
    } else {
      // BibTeX形式をパース
      papers = parseBibTeXToPapers(content);
    }
    
    if (papers.length === 0) {
      return NextResponse.json(
        { error: "No papers found in content" },
        { status: 400 }
      );
    }
    
    // 論文をライブラリに追加
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };
    
    for (const paper of papers) {
      try {
        if (!paper.title) {
          results.skipped++;
          continue;
        }
        
        // 既存の論文をチェック
        const paperId = (paper as any).paperId || paper.id || `imported-${Date.now()}-${Math.random()}`;
        
        const { data: existing } = await adminClient
          .from("user_library")
          .select("id")
          .eq("user_id", userId)
          .eq("paper_id", paperId)
          .single();
        
        if (existing) {
          results.skipped++;
          continue;
        }
        
        // 論文を追加
        const { error: insertError } = await adminClient
          .from("user_library")
          .insert({
            user_id: userId,
            paper_id: paperId,
            title: paper.title,
            authors: paper.authors || "",
            year: paper.year || null,
            month: (paper as any).month || null,
            day: (paper as any).day || null,
            venue: paper.venue || "",
            volume: (paper as any).volume || null,
            issue: (paper as any).issue || null,
            pages: (paper as any).pages || null,
            doi: paper.doi || "",
            url: paper.url || "",
            abstract: paper.abstract || "",
          });
        
        if (insertError) {
          results.failed++;
          results.errors.push(`${paper.title}: ${insertError.message}`);
        } else {
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${paper.title}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Imported ${results.success} papers, skipped ${results.skipped}, failed ${results.failed}`,
      results,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: `Failed to import: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

