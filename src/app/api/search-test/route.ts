import { NextRequest, NextResponse } from "next/server";
import { Paper } from "@/types";
import { callGemini } from "@/lib/gemini";

// 複合語やタンパク質名を引用符で囲む関数
function preservePhrases(query: string): string {
  // 既に引用符で囲まれている場合はそのまま返す
  if (query.includes('"')) {
    return query;
  }

  // 既知の複合語パターン（タンパク質名、専門用語など）
  const phrasePatterns = [
    // タンパク質名・酵素名
    /\badenylate\s+kinase\b/gi,
    /\bATP\s+synthase\b/gi,
    /\bmotor\s+protein\b/gi,
    /\bprotein\s+kinase\b/gi,
    /\bDNA\s+polymerase\b/gi,
    /\bRNA\s+polymerase\b/gi,
    /\btranscription\s+factor\b/gi,
    /\bcell\s+cycle\b/gi,
    /\bcell\s+death\b/gi,
    /\bcell\s+division\b/gi,
    
    // 専門用語の組み合わせ
    /\bintraflagellar\s+transport\b/gi,
    /\bciliary\s+function\b/gi,
    /\bciliary\s+dysfunction\b/gi,
    /\benergy\s+homeostasis\b/gi,
    /\bATP\s+metabolism\b/gi,
    /\bmitochondrial\s+dysfunction\b/gi,
    /\bnuclear\s+reshaping\b/gi,
    /\btail\s+formation\b/gi,
    /\bmicrotubule\s+transport\b/gi,
    /\bprimary\s+cilia\b/gi,
    
    // 一般的な複合語パターン（タンパク質名のパターン）
    /\b[A-Z][a-z]+\s+kinase\b/g, // 例: Adenylate kinase, Protein kinase
    /\b[A-Z][a-z]+\s+protein\b/g, // 例: Motor protein, Ciliary protein
    /\b[A-Z][a-z]+\s+synthase\b/g, // 例: ATP synthase
    /\b[A-Z][a-z]+\s+transport\b/g, // 例: Intraflagellar transport
  ];

  let result = query;
  const processedPhrases = new Set<string>();

  // 各パターンに対して、引用符で囲む
  phrasePatterns.forEach((pattern) => {
    result = result.replace(pattern, (match) => {
      const lowerMatch = match.toLowerCase();
      // 既に処理済みの場合はスキップ
      if (processedPhrases.has(lowerMatch)) {
        return match;
      }
      processedPhrases.add(lowerMatch);
      
      // 既に引用符で囲まれている場合はスキップ
      if (result.includes(`"${match}"`)) {
        return match;
      }
      
      // 引用符で囲む
      return `"${match}"`;
    });
  });

  return result;
}

// パターン4: 意図理解ベース（改善版）
async function translateQueryToEnglishPattern4(query: string): Promise<string> {
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query);
  const isLongSentence = query.split(/\s+/).length > 5; // 論文タイトルなどの長い文章かどうか
  const isEnglishKeywords = !hasJapanese && query.split(/\s+/).length <= 5; // 英語のキーワードのみかどうか

  // 英語のキーワードのみの場合: 元のキーワードを核として最小限の拡張のみ
  if (isEnglishKeywords) {
    try {
      const prompt = `以下の英語の学術検索キーワードを、元のキーワードを核として、最小限の関連語（2-3語）のみを追加して拡張してください。

【ルール】
- 元のキーワードを必ずすべて含める
- 関連する専門用語を2-3語のみ追加（例: motor protein, function, mechanism）
- **複合語やタンパク質名は引用符で囲む**（例: "adenylate kinase", "motor protein", "ATP synthase"）
- 合計で10-12語程度に収める
- スペース区切りで出力
- 余計な説明や記号は不要

【例】
入力: kinesin cilia effect
出力: kinesin "motor protein" cilia "ciliary function" effect mechanism

【入力】
${query}

【出力】
英語キーワード:`;

      const translated = await callGemini(prompt);
      const cleaned = translated.trim();

      if (cleaned && /[A-Za-z]/.test(cleaned)) {
        // キーワード数をチェック（15語を超える場合は元のクエリを返す）
        const wordCount = cleaned.split(/\s+/).length;
        if (wordCount > 15) {
          console.warn(
            `[Search Test] Generated query too long (${wordCount} words), using original`
          );
          return preservePhrases(query);
        }
        // 引用符処理を適用
        return preservePhrases(cleaned);
      }
      return preservePhrases(query); // 拡張に失敗した場合は元のクエリを返す（引用符処理付き）
    } catch (error) {
      console.warn("[Search Test] English keyword expansion failed:", error);
      return preservePhrases(query); // エラー時は元のクエリを返す（引用符処理付き）
    }
  }

  // 論文タイトルの場合: 主要キーワードを抽出して拡張を最小限に
  if (isLongSentence && !hasJapanese) {
    try {
      const prompt = `以下の論文タイトルまたは長い文章から、主要な学術検索キーワードを抽出してください。

【ルール】
- 重要な専門用語、遺伝子名、種名、プロセス名を優先的に含める
- **複合語やタンパク質名は引用符で囲む**（例: "nuclear reshaping", "tail formation"）
- 10-12語程度に収める
- スペース区切りで出力
- 余計な説明や記号は不要

【例】
入力: Expression Dynamics Indicate Potential Roles of KIF17 for Nuclear Reshaping and Tail Formation during Spermiogenesis in Phascolosoma esculenta
出力: KIF17 kinesin "nuclear reshaping" "tail formation" spermiogenesis Phascolosoma esculenta expression dynamics

【入力】
${query}

【出力】
英語キーワード:`;

      const translated = await callGemini(prompt);
      const cleaned = translated.trim();

      if (cleaned && /[A-Za-z]/.test(cleaned)) {
        const wordCount = cleaned.split(/\s+/).length;
        if (wordCount > 15) {
          console.warn(
            `[Search Test] Generated query too long (${wordCount} words), using original`
          );
          return preservePhrases(query);
        }
        // 引用符処理を適用
        return preservePhrases(cleaned);
      }
      return preservePhrases(query);
    } catch (error) {
      console.warn("[Search Test] Title extraction failed:", error);
      return preservePhrases(query);
    }
  }

  // 日本語が含まれている場合: 意図理解ベースの翻訳と拡張
  if (hasJapanese) {
    try {
      const prompt = `あなたは学術論文検索の専門家です。ユーザーの研究クエリを分析し、研究の本質的な意図を理解した上で、最も効果的な検索キーワードを生成してください。

【分析ステップ】
1. ユーザーが探している研究の種類を特定（メカニズム、機能、調節、相互作用など）
2. 主要な概念とその関係性を理解
3. 関連する専門用語、同義語、関連概念を特定

【キーワード生成ルール】
- 必須概念を必ず含める（例: kinesin, cilia）
- 関連する専門用語を追加（例: motor protein, ciliary function, intraflagellar transport）
- **複合語やタンパク質名は引用符で囲む**（例: "adenylate kinase", "motor protein", "intraflagellar transport", "ciliary function"）
- 研究の文脈に応じた概念を含める（例: regulation, mechanism, transport）
- **10-12語程度で、スペース区切りで出力**（重要: 15語を超えないこと）
- 余計な説明や記号は不要

【例】
クエリ: "キネシンの繊毛への影響"
分析: キネシン（モータータンパク質）と繊毛（細胞小器官）の関係、機能、調節メカニズムを探している
出力: kinesin "motor protein" cilia "ciliary function" regulation mechanism "microtubule transport"

【クエリ】
"${query}"

【出力】
英語キーワード:`;

      const translated = await callGemini(prompt);
      const cleaned = translated.trim();

      if (cleaned && /[A-Za-z]/.test(cleaned)) {
        // キーワード数をチェック（15語を超える場合は警告して切り詰める）
        const words = cleaned.split(/\s+/);
        if (words.length > 15) {
          console.warn(
            `[Search Test] Generated query too long (${words.length} words), truncating to 12 words`
          );
          const truncated = words.slice(0, 12).join(" ");
          // 引用符処理を適用
          return preservePhrases(truncated);
        }
        // 引用符処理を適用
        return preservePhrases(cleaned);
      }

      return preservePhrases(query);
    } catch (error) {
      console.warn("[Search Test] Gemini translation failed:", error);
      return preservePhrases(query);
    }
  }

  // その他の場合: そのまま返す（引用符処理付き）
  return preservePhrases(query);
}

// Semantic Scholar検索
async function searchSemanticScholar(query: string, limit: number): Promise<Paper[]> {
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
        return [];
      }
      if (response.status === 400) {
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
    console.error("[Search Test] Semantic Scholar search error:", error);
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
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

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
    console.error("[Search Test] PubMed search error:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { queries, limit = 20 } = await request.json();

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json(
        { error: "検索クエリの配列が必要です" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      queries.map(async (query: string) => {
        const originalQuery = query.trim();
        
        // パターン4で翻訳/拡張
        const translatedPattern4 = await translateQueryToEnglishPattern4(originalQuery);

        console.log(`[Search Test] Query: "${originalQuery}"`);
        console.log(`[Search Test] Pattern4: "${translatedPattern4}"`);

        // 検索実行
        const [semanticResults, pubmedResults] = await Promise.all([
          searchSemanticScholar(translatedPattern4, limit),
          searchPubMed(translatedPattern4, limit),
        ]);

        const allPapers = [...semanticResults, ...pubmedResults];

        // 重複除去
        const uniquePapers = allPapers.filter(
          (paper, index, self) =>
            index ===
            self.findIndex((p) => p.title.toLowerCase() === paper.title.toLowerCase())
        );

        return {
          originalQuery,
          translatedQuery: translatedPattern4,
          total: uniquePapers.length,
          semanticScholar: semanticResults.length,
          pubmed: pubmedResults.length,
          papers: uniquePapers.slice(0, limit),
        };
      })
    );

    return NextResponse.json({
      results,
    });
  } catch (error) {
    console.error("Search test error:", error);
    return NextResponse.json(
      {
        error: "検索テストに失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

