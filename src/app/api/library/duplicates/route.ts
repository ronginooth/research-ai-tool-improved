import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * 重複論文を検出する
 * タイトル、著者、年で比較
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;

    const { adminClient } = await getSupabaseForUser(request, userId);

    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    // すべての論文を取得
    const { data: papers, error } = await adminClient
      .from("user_library")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "データベースエラーが発生しました" },
        { status: 500 }
      );
    }

    if (!papers || papers.length === 0) {
      return NextResponse.json({
        success: true,
        duplicates: [],
        total: 0,
      });
    }

    // 重複を検出する関数
    const normalizeString = (str: string | null | undefined): string => {
      if (!str) return "";
      return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, "") // 記号を除去
        .replace(/\s+/g, " "); // 複数の空白を1つに
    };

    const normalizeTitle = (title: string | null | undefined): string => {
      const normalized = normalizeString(title);
      // タイトルの最初の50文字を使用（長すぎるタイトルを短縮）
      return normalized.substring(0, 50);
    };

    const normalizeAuthors = (authors: string | null | undefined): string => {
      const normalized = normalizeString(authors);
      // 著者名の最初の30文字を使用
      return normalized.substring(0, 30);
    };

    // 重複グループを検出
    const duplicateGroups: {
      key: string;
      papers: any[];
    }[] = [];

    const processed = new Set<string>();

    for (let i = 0; i < papers.length; i++) {
      if (processed.has(papers[i].id)) continue;

      const paper1 = papers[i];
      const title1 = normalizeTitle(paper1.title);
      const authors1 = normalizeAuthors(paper1.authors);
      const year1 = paper1.year;

      const group: any[] = [paper1];
      processed.add(paper1.id);

      for (let j = i + 1; j < papers.length; j++) {
        if (processed.has(papers[j].id)) continue;

        const paper2 = papers[j];
        const title2 = normalizeTitle(paper2.title);
        const authors2 = normalizeAuthors(paper2.authors);
        const year2 = paper2.year;

        // タイトルと著者の類似度を計算（簡易版）
        const titleSimilarity =
          title1 && title2
            ? title1 === title2 ||
              title1.includes(title2.substring(0, 20)) ||
              title2.includes(title1.substring(0, 20))
            : false;

        const authorsSimilarity =
          authors1 && authors2
            ? authors1 === authors2 ||
              authors1.includes(authors2.substring(0, 15)) ||
              authors2.includes(authors1.substring(0, 15))
            : false;

        // 年が同じか、どちらかがnullの場合は年を無視
        const yearMatch = !year1 || !year2 || year1 === year2;

        // 重複と判定する条件
        // 1. タイトルが非常に類似している
        // 2. 著者が類似している
        // 3. 年が一致する（またはどちらかがnull）
        if (titleSimilarity && authorsSimilarity && yearMatch) {
          group.push(paper2);
          processed.add(paper2.id);
        }
      }

      // 重複が2件以上ある場合のみ追加
      if (group.length > 1) {
        duplicateGroups.push({
          key: `${title1}-${authors1}-${year1 || "unknown"}`,
          papers: group.map((p) => ({
            ...p,
            paperId: p.paper_id ?? p.paperId,
            citationCount: p.citation_count ?? p.citationCount,
            linkedFrom: p.linked_from ?? [],
            createdAt: p.created_at ?? p.createdAt,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      duplicates: duplicateGroups,
      total: duplicateGroups.length,
    });
  } catch (error) {
    console.error("Find duplicates error:", error);
    return NextResponse.json(
      { error: "重複検出に失敗しました" },
      { status: 500 }
    );
  }
}




