import { NextRequest, NextResponse } from "next/server";
import { Paper } from "@/types";
import { s2Headers } from "@/lib/semantic-scholar";

/**
 * Boolean演算子の有無による検索結果の比較テスト
 * Semantic ScholarとPubMedの両方で、Boolean演算子あり/なしの2パターンを比較
 */
export async function POST(request: NextRequest) {
  try {
    const { query, limit = 20 } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "検索クエリが必要です" },
        { status: 400 }
      );
    }

    const testQueries = {
      // Boolean演算子あり（現在の実装）
      withBoolean: `(${query}) OR (${query} mechanism) OR (${query} function)`,
      // Boolean演算子なし（推奨）
      withoutBoolean: `${query} mechanism function`,
      // 引用符付き（推奨）
      withQuotes: `"${query}" mechanism function`,
    };

    const results: {
      source: string;
      pattern: string;
      query: string;
      papers: Paper[];
      count: number;
      executionTime: number;
    }[] = [];

    // Semantic Scholar: Boolean演算子あり
    const ssWithBooleanStart = Date.now();
    const ssWithBoolean = await searchSemanticScholar(
      testQueries.withBoolean,
      limit
    );
    results.push({
      source: "semantic_scholar",
      pattern: "with_boolean",
      query: testQueries.withBoolean,
      papers: ssWithBoolean,
      count: ssWithBoolean.length,
      executionTime: Date.now() - ssWithBooleanStart,
    });

    // Semantic Scholar: Boolean演算子なし
    const ssWithoutBooleanStart = Date.now();
    const ssWithoutBoolean = await searchSemanticScholar(
      testQueries.withoutBoolean,
      limit
    );
    results.push({
      source: "semantic_scholar",
      pattern: "without_boolean",
      query: testQueries.withoutBoolean,
      papers: ssWithoutBoolean,
      count: ssWithoutBoolean.length,
      executionTime: Date.now() - ssWithoutBooleanStart,
    });

    // Semantic Scholar: 引用符付き
    const ssWithQuotesStart = Date.now();
    const ssWithQuotes = await searchSemanticScholar(
      testQueries.withQuotes,
      limit
    );
    results.push({
      source: "semantic_scholar",
      pattern: "with_quotes",
      query: testQueries.withQuotes,
      papers: ssWithQuotes,
      count: ssWithQuotes.length,
      executionTime: Date.now() - ssWithQuotesStart,
    });

    // PubMed: Boolean演算子あり
    const pmWithBooleanStart = Date.now();
    const pmWithBoolean = await searchPubMed(testQueries.withBoolean, limit);
    results.push({
      source: "pubmed",
      pattern: "with_boolean",
      query: testQueries.withBoolean,
      papers: pmWithBoolean,
      count: pmWithBoolean.length,
      executionTime: Date.now() - pmWithBooleanStart,
    });

    // PubMed: Boolean演算子なし
    const pmWithoutBooleanStart = Date.now();
    const pmWithoutBoolean = await searchPubMed(
      testQueries.withoutBoolean,
      limit
    );
    results.push({
      source: "pubmed",
      pattern: "without_boolean",
      query: testQueries.withoutBoolean,
      papers: pmWithoutBoolean,
      count: pmWithoutBoolean.length,
      executionTime: Date.now() - pmWithoutBooleanStart,
    });

    // PubMed: 引用符付き
    const pmWithQuotesStart = Date.now();
    const pmWithQuotes = await searchPubMed(testQueries.withQuotes, limit);
    results.push({
      source: "pubmed",
      pattern: "with_quotes",
      query: testQueries.withQuotes,
      papers: pmWithQuotes,
      count: pmWithQuotes.length,
      executionTime: Date.now() - pmWithQuotesStart,
    });

    // 結果の比較分析
    const analysis = {
      semanticScholar: {
        withBoolean: {
          count: ssWithBoolean.length,
          executionTime: results.find(
            (r) => r.source === "semantic_scholar" && r.pattern === "with_boolean"
          )?.executionTime || 0,
          uniquePapers: ssWithBoolean.length,
        },
        withoutBoolean: {
          count: ssWithoutBoolean.length,
          executionTime: results.find(
            (r) =>
              r.source === "semantic_scholar" &&
              r.pattern === "without_boolean"
          )?.executionTime || 0,
          uniquePapers: ssWithoutBoolean.length,
        },
        withQuotes: {
          count: ssWithQuotes.length,
          executionTime: results.find(
            (r) =>
              r.source === "semantic_scholar" && r.pattern === "with_quotes"
          )?.executionTime || 0,
          uniquePapers: ssWithQuotes.length,
        },
      },
      pubmed: {
        withBoolean: {
          count: pmWithBoolean.length,
          executionTime: results.find(
            (r) => r.source === "pubmed" && r.pattern === "with_boolean"
          )?.executionTime || 0,
          uniquePapers: pmWithBoolean.length,
        },
        withoutBoolean: {
          count: pmWithoutBoolean.length,
          executionTime: results.find(
            (r) => r.source === "pubmed" && r.pattern === "without_boolean"
          )?.executionTime || 0,
          uniquePapers: pmWithoutBoolean.length,
        },
        withQuotes: {
          count: pmWithQuotes.length,
          executionTime: results.find(
            (r) => r.source === "pubmed" && r.pattern === "with_quotes"
          )?.executionTime || 0,
          uniquePapers: pmWithQuotes.length,
        },
      },
    };

    return NextResponse.json({
      success: true,
      originalQuery: query,
      testQueries,
      results,
      analysis,
      summary: {
        semanticScholar: {
          bestPattern:
            ssWithoutBoolean.length > ssWithBoolean.length
              ? "without_boolean"
              : "with_boolean",
          bestCount: Math.max(
            ssWithBoolean.length,
            ssWithoutBoolean.length,
            ssWithQuotes.length
          ),
        },
        pubmed: {
          bestPattern:
            pmWithoutBoolean.length > pmWithBoolean.length
              ? "without_boolean"
              : "with_boolean",
          bestCount: Math.max(
            pmWithBoolean.length,
            pmWithoutBoolean.length,
            pmWithQuotes.length
          ),
        },
      },
    });
  } catch (error) {
    console.error("[Search Test Boolean] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "テスト実行中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}

// Semantic Scholar検索
async function searchSemanticScholar(
  query: string,
  limit: number
): Promise<Paper[]> {
  try {
    const headers = s2Headers();
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        query
      )}&limit=${limit}&fields=paperId,title,abstract,authors,year,venue,citationCount,url`,
      {
        headers,
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[Search Test] Semantic Scholar rate limited");
        return [];
      }
      
      // 403エラーの場合、APIキーなしで再試行
      if (response.status === 403) {
        console.warn(
          "[Search Test] Semantic Scholar API key invalid (403), trying without API key"
        );
        const fallbackHeaders = {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        };
        const fallbackResponse = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
            query
          )}&limit=${limit}&fields=paperId,title,abstract,authors,year,venue,citationCount,url`,
          {
            headers: fallbackHeaders,
          }
        );
        
        if (fallbackResponse.ok) {
          console.log(
            "[Search Test] Semantic Scholar search succeeded without API key"
          );
          const data = await fallbackResponse.json();
          if (data && data.data && Array.isArray(data.data)) {
            return data.data.map((paper: any) => ({
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
          }
        } else {
          console.warn(
            `[Search Test] Semantic Scholar fallback also failed: ${fallbackResponse.status}`
          );
        }
      }
      
      const errorText = await response.text().catch(() => "");
      console.error(
        `[Search Test] Semantic Scholar API error: ${response.status}`,
        errorText
      );
      if (response.status === 400) {
        console.warn(
          "[Search Test] Semantic Scholar API returned 400, skipping"
        );
        return [];
      }
      // 403以外のエラーは空配列を返して続行
      return [];
    }

    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((paper: any) => ({
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
  } catch (error) {
    console.error("[Search Test] Semantic Scholar search error:", error);
    return [];
  }
}

// PubMed検索
async function searchPubMed(query: string, limit: number): Promise<Paper[]> {
  try {
    // Step 1: esearchでPMIDを取得
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(limit),
      retmode: "json",
    });

    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`PubMed esearch error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const pmids = searchData?.esearchresult?.idlist || [];

    if (pmids.length === 0) {
      return [];
    }

    // Step 2: esummaryで詳細情報を取得
    const summaryParams = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "json",
    });

    const summaryResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        },
      }
    );

    if (!summaryResponse.ok) {
      throw new Error(`PubMed esummary error: ${summaryResponse.status}`);
    }

    const summaryData = await summaryResponse.json();
    const results = summaryData?.result || {};

    const papers: Paper[] = pmids
      .map((pmid: string) => {
        const paper = results[pmid];
        if (!paper) return null;

        const authors = paper.authors
          ? paper.authors
              .map((author: any) => {
                if (typeof author === "string") return author;
                return `${author.name || ""}`.trim();
              })
              .filter((name: string) => name)
              .join(", ")
          : "著者不明";

        const year = paper.pubdate
          ? parseInt(paper.pubdate.split(" ")[0] || paper.pubdate.split("-")[0])
          : new Date().getFullYear();

        return {
          id: `pubmed-${pmid}`,
          paperId: `pubmed-${pmid}`,
          title: paper.title || "タイトルなし",
          abstract: paper.abstract || "要約なし",
          authors: authors || "著者不明",
          year: year || new Date().getFullYear(),
          venue: paper.source || "ジャーナル不明",
          citationCount: 0,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          source: "pubmed",
        };
      })
      .filter((paper: Paper | null): paper is Paper => paper !== null);

    return papers;
  } catch (error) {
    console.error("[Search Test] PubMed search error:", error);
    return [];
  }
}

