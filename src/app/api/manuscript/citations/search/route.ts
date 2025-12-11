import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

const DEFAULT_USER = "demo-user-123";

/**
 * ライブラリ内で引用論文を検索（検索、フィルター、タグ対応）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;
    const query = searchParams.get("query") || "";
    const tagFilter = searchParams.get("tags") || "";
    const yearFilter = searchParams.get("year") || "";
    const venueFilter = searchParams.get("venue") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    let dbQuery = adminClient
      .from("user_library")
      .select("id, title, authors, year, venue, abstract, url, tags")
      .eq("user_id", userId);

    // 検索クエリ
    if (query.trim()) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query}%,authors.ilike.%${query}%,abstract.ilike.%${query}%`
      );
    }

    // 年でフィルタリング
    if (yearFilter) {
      dbQuery = dbQuery.eq("year", parseInt(yearFilter));
    }

    // ジャーナルでフィルタリング
    if (venueFilter) {
      dbQuery = dbQuery.ilike("venue", `%${venueFilter}%`);
    }

    // タグでフィルタリング
    if (tagFilter) {
      const tags = tagFilter.split(",").map((t) => t.trim()).filter((t) => t);
      if (tags.length > 0) {
        // PostgreSQLの配列演算子を使用
        dbQuery = dbQuery.contains("tags", tags);
      }
    }

    // 作成日時でフィルタリング
    if (dateFrom) {
      dbQuery = dbQuery.gte("created_at", dateFrom);
    }
    if (dateTo) {
      dbQuery = dbQuery.lte("created_at", dateTo);
    }

    const { data, error } = await dbQuery
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ papers: data || [] });
  } catch (error: any) {
    console.error("Citation search error:", error);
    return NextResponse.json(
      { error: error?.message || "検索に失敗しました" },
      { status: 500 }
    );
  }
}

