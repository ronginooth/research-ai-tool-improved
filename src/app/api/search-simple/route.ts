import { NextRequest, NextResponse } from "next/server";
import { Paper, SearchResult } from "@/types";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 20 } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "検索クエリが必要です" },
        { status: 400 }
      );
    }

    const rateKey = `search:${query.trim().toLowerCase()}`;
    const rate = isRateLimited(rateKey, "search");
    if (rate.limited) {
      return NextResponse.json(
        {
          papers: [],
          total: 0,
          error:
            "短時間に検索が集中しています。少し時間を空けて再試行してください。",
          retryAfter: Math.ceil((rate.retryAfter ?? 0) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rate.retryAfter ?? 0) / 1000)),
          },
        }
      );
    }

    // 日本語クエリを英語に変換（簡単な変換）
    const translatedQuery = translateQueryToEnglish(query.trim());

    // Semantic Scholar API呼び出し
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        translatedQuery
      )}&limit=${limit}&fields=paperId,title,abstract,authors,year,venue,citationCount,url`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        },
      }
    );

    if (!response.ok) {
      console.error(
        `Semantic Scholar API error: ${response.status} ${response.statusText}`
      );

      // レート制限の場合は特別なメッセージを返す
      if (response.status === 429) {
        return NextResponse.json({
          papers: [],
          total: 0,
          error:
            "外部APIのレート制限に達しました。しばらく待ってから再試行してください。",
          retryAfter: 60, // 60秒後に再試行を推奨
        });
      }

      throw new Error(`API呼び出しに失敗しました: ${response.status}`);
    }

    const data = await response.json();

    // データ構造をチェックして安全に処理
    if (!data || !data.data || !Array.isArray(data.data)) {
      console.error("Invalid API response structure:", data);
      return NextResponse.json({
        papers: [],
        total: 0,
        error: "APIレスポンスの形式が正しくありません",
      });
    }

    // データを整形
    const papers: Paper[] = data.data.map((paper: any) => ({
      id: paper.paperId || `paper-${Math.random().toString(36).substr(2, 9)}`,
      paperId: paper.paperId,
      title: paper.title || "タイトルなし",
      abstract: paper.abstract || "要約なし",
      authors:
        paper.authors?.map((author: any) => author.name).join(", ") ||
        "著者不明",
      year: paper.year || new Date().getFullYear(),
      venue: paper.venue || "ジャーナル不明",
      citationCount: paper.citationCount || 0,
      url: paper.url || "#",
      source: "semantic_scholar",
    }));

    const result: SearchResult = {
      papers,
      total: data.total || papers.length,
      searchMethod: "semantic_scholar",
      success: true,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        papers: [],
        total: 0,
        error: "論文検索に失敗しました",
        success: false,
      },
      { status: 500 }
    );
  }
}

// 簡単な日本語→英語変換
function translateQueryToEnglish(query: string): string {
  const translations: Record<string, string> = {
    カルシウム: "calcium",
    神経細胞: "neuron",
    微小管: "microtubule",
    解体: "disassembly",
    促進: "promotion",
    研究: "research",
    論文: "paper",
    検索: "search",
    分析: "analysis",
    実験: "experiment",
    データ: "data",
    結果: "result",
    方法: "method",
    技術: "technique",
    開発: "development",
    応用: "application",
    効果: "effect",
    影響: "influence",
    関係: "relationship",
    比較: "comparison",
  };

  // 英語が含まれている場合はそのまま返す
  if (/[A-Za-z]/.test(query)) {
    return query;
  }

  let result = query;
  for (const [japanese, english] of Object.entries(translations)) {
    result = result.replace(new RegExp(japanese, "g"), english);
  }

  // 日本語文字が残っている場合は削除
  result = result.replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "");

  return result.trim() || query; // 空の場合は元のクエリを返す
}
