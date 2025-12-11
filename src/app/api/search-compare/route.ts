import { NextRequest, NextResponse } from "next/server";
import { Paper } from "@/types";
import { callGemini } from "@/lib/gemini";

// パターン4: 意図理解ベース
async function translateQueryToEnglishPattern4(query: string): Promise<string> {
  if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query)) {
    return query;
  }

  try {
    const prompt = `あなたは学術論文検索の専門家です。ユーザーの研究クエリを分析し、研究の本質的な意図を理解した上で、最も効果的な検索キーワードを生成してください。

【分析ステップ】
1. ユーザーが探している研究の種類を特定（メカニズム、機能、調節、相互作用など）
2. 主要な概念とその関係性を理解
3. 関連する専門用語、同義語、関連概念を特定

【キーワード生成ルール】
- 必須概念を必ず含める（例: kinesin, cilia）
- 関連する専門用語を追加（例: motor protein, ciliary function）
- 研究の文脈に応じた概念を含める（例: regulation, mechanism, transport）
- 12-15語程度で、スペース区切りで出力
- 余計な説明や記号は不要

【例】
クエリ: "キネシンの繊毛への影響"
分析: キネシン（モータータンパク質）と繊毛（細胞小器官）の関係、機能、調節メカニズムを探している
出力: kinesin motor protein cilia ciliary function regulation mechanism microtubule transport

【クエリ】
"${query}"

【出力】
英語キーワード:`;

    const translated = await callGemini(prompt);
    const cleaned = translated.trim();

    if (cleaned && /[A-Za-z]/.test(cleaned)) {
      return cleaned;
    }

    return query;
  } catch (error) {
    console.warn("[Search Compare] Pattern4 translation failed:", error);
    return query;
  }
}

// パターン4: 英語キーワードの拡張
async function expandEnglishQueryPattern4(query: string): Promise<string> {
  try {
    const prompt = `あなたは学術論文検索の専門家です。以下の英語の研究キーワードを分析し、研究の本質的な意図を理解した上で、最も効果的な検索キーワードに拡張してください。

【分析ステップ】
1. これらのキーワードが示す研究の種類を特定（メカニズム、機能、調節、相互作用など）
2. 主要な概念とその関係性を理解
3. 関連する専門用語、同義語、関連概念を特定

【キーワード拡張ルール】
- 元のキーワードを必ず含める
- 関連する専門用語を追加
- 研究の文脈に応じた概念を含める
- 12-15語程度で、スペース区切りで出力
- 余計な説明や記号は不要

【例】
入力: kinesin cilia
分析: キネシン（モータータンパク質）と繊毛（細胞小器官）の関係、機能、調節メカニズムを探している
出力: kinesin motor protein cilia ciliary function regulation mechanism microtubule transport

【入力キーワード】
"${query}"

【出力】
拡張された英語キーワード:`;

    const translated = await callGemini(prompt);
    const cleaned = translated.trim();

    if (cleaned && /[A-Za-z]/.test(cleaned)) {
      return cleaned;
    }

    return query; // 拡張に失敗した場合は元のキーワードを返す
  } catch (error) {
    console.warn("[Search Compare] Pattern4 expansion failed:", error);
    return query;
  }
}

// ハイブリッド: パターン4 + パターン1
async function translateQueryToEnglishHybrid(query: string): Promise<string> {
  if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query)) {
    return query;
  }

  try {
    const prompt = `あなたは学術論文検索の専門家です。ユーザーの研究クエリを分析し、研究の本質的な意図を理解した上で、最も効果的な検索キーワードを生成してください。

【分析ステップ】
1. ユーザーが探している研究の種類を特定（メカニズム、機能、調節、相互作用など）
2. 主要な概念とその関係性を理解
3. 関連する専門用語、同義語、関連概念を特定

【キーワード生成ルール】
- 必須概念を必ず含める
- 関連する専門用語を追加
- 研究の文脈に応じた概念を含める
- 12-15語程度で、スペース区切りで出力
- 余計な説明や記号は不要

【クエリ】
"${query}"

【出力】
英語キーワード:`;

    const translated = await callGemini(prompt);
    const cleaned = translated.trim();

    if (cleaned && /[A-Za-z]/.test(cleaned)) {
      return cleaned;
    }

    return query;
  } catch (error) {
    console.warn("[Search Compare] Hybrid translation failed:", error);
    return query;
  }
}

// Semantic Scholar検索
async function searchSemanticScholar(
  query: string,
  limit: number
): Promise<Paper[]> {
  try {
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        query
      )}&limit=${limit}&fields=paperId,title,abstract,authors,year,venue,citationCount,url`,
      {
        headers: {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[Search Compare] Semantic Scholar rate limited");
        return [];
      }
      if (response.status === 400) {
        console.warn(
          "[Search Compare] Semantic Scholar API returned 400, skipping"
        );
        return [];
      }
      return [];
    }

    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((paper: any) => {
      const year = paper.year || new Date().getFullYear();

      return {
        id: paper.paperId || `paper-${Math.random().toString(36).substr(2, 9)}`,
        paperId: paper.paperId,
        title: paper.title || "タイトルなし",
        abstract: paper.abstract || "要約なし",
        authors:
          paper.authors?.map((author: any) => author.name).join(", ") ||
          "著者不明",
        year: year,
        venue: paper.venue || "ジャーナル不明",
        citationCount: paper.citationCount || 0,
        url: paper.url || "#",
        source: "semantic_scholar",
      };
    });
  } catch (error) {
    console.error("[Search Compare] Semantic Scholar search error:", error);
    return [];
  }
}

// PubMed検索
async function searchPubMed(query: string, limit: number): Promise<Paper[]> {
  try {
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
        query
      )}&retmax=${limit}&retmode=json`
    );

    if (!searchResponse.ok) {
      return [];
    }

    const searchData = await searchResponse.json();
    const pmids = searchData?.esearchresult?.idlist || [];

    if (pmids.length === 0) {
      return [];
    }

    const summaryResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(
        ","
      )}&retmode=json`
    );

    if (!summaryResponse.ok) {
      return [];
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

        const yearMatch = paper.pubdate?.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch
          ? parseInt(yearMatch[0])
          : new Date().getFullYear();

        return {
          id: `pubmed-${pmid}`,
          paperId: `pubmed-${pmid}`,
          title: paper.title || "タイトルなし",
          abstract: paper.abstract || "要約なし",
          authors: authors,
          year: year,
          venue: paper.source || "ジャーナル不明",
          citationCount: 0,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          source: "pubmed",
        };
      })
      .filter((paper: Paper | null): paper is Paper => paper !== null);

    return papers;
  } catch (error) {
    console.error("[Search Compare] PubMed search error:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 20 } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "検索クエリが必要です" },
        { status: 400 }
      );
    }

    const originalQuery = query.trim();

    // パターン4で翻訳（英語キーワードの場合も拡張）
    let translatedPattern4: string;
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(originalQuery)) {
      // 日本語が含まれている場合は翻訳
      translatedPattern4 = await translateQueryToEnglishPattern4(originalQuery);
    } else {
      // 英語キーワードの場合も、パターン4のプロンプトで拡張
      translatedPattern4 = await expandEnglishQueryPattern4(originalQuery);
    }

    // ハイブリッドで翻訳
    let translatedHybrid: string;
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(originalQuery)) {
      translatedHybrid = await translateQueryToEnglishHybrid(originalQuery);
    } else {
      translatedHybrid = originalQuery; // 英語の場合はそのまま
    }

    console.log(`[Search Compare] Original: "${originalQuery}"`);
    console.log(`[Search Compare] Pattern4: "${translatedPattern4}"`);
    console.log(`[Search Compare] Hybrid: "${translatedHybrid}"`);

    // パターン4で検索
    const [pattern4Semantic, pattern4PubMed] = await Promise.all([
      searchSemanticScholar(translatedPattern4, limit),
      searchPubMed(translatedPattern4, limit),
    ]);

    // ハイブリッドで検索
    const [hybridSemantic, hybridPubMed] = await Promise.all([
      searchSemanticScholar(translatedHybrid, limit),
      searchPubMed(translatedHybrid, limit),
    ]);

    const pattern4Papers = [...pattern4Semantic, ...pattern4PubMed];
    const hybridPapers = [...hybridSemantic, ...hybridPubMed];

    // 重複除去
    const pattern4Unique = pattern4Papers.filter(
      (paper, index, self) =>
        index ===
        self.findIndex(
          (p) => p.title.toLowerCase() === paper.title.toLowerCase()
        )
    );

    const hybridUnique = hybridPapers.filter(
      (paper, index, self) =>
        index ===
        self.findIndex(
          (p) => p.title.toLowerCase() === paper.title.toLowerCase()
        )
    );

    return NextResponse.json({
      originalQuery,
      translations: {
        pattern4: translatedPattern4,
        hybrid: translatedHybrid,
      },
      results: {
        pattern4: {
          total: pattern4Unique.length,
          papers: pattern4Unique.slice(0, limit),
          semanticScholar: pattern4Semantic.length,
          pubmed: pattern4PubMed.length,
        },
        hybrid: {
          total: hybridUnique.length,
          papers: hybridUnique.slice(0, limit),
          semanticScholar: hybridSemantic.length,
          pubmed: hybridPubMed.length,
        },
      },
    });
  } catch (error) {
    console.error("Search compare error:", error);
    return NextResponse.json(
      {
        error: "検索比較に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
