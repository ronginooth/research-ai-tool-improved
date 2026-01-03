import { Paper, SearchPlan } from "@/types";
import { advancedSearchEngine } from "./advanced-search-engine";
import { aiProviderManager } from "./ai-provider-manager";
import { generateSearchPlan } from "./topic-planner";
import { s2Headers } from "./semantic-scholar";
import { callGemini } from "./gemini";
import { openai } from "./openai";

export interface DeepResearchOptions {
  query: string;
  maxPapers?: number;
  sources?: string[];
  includeCitationNetwork?: boolean;
  provider?: "openai" | "gemini";
}

export interface ScoredPaper extends Paper {
  relevanceScore: number;
  relevanceReasoning: string;
  relevanceTag: "Relevant" | "Not Relevant";
}

export interface DeepResearchResult {
  papers: ScoredPaper[];
  totalPapers: number;
  expandedQueries: string[];
  searchStats: {
    sources: Record<string, number>;
    queries: Record<string, number>;
  };
}

/**
 * Deep Researchエンジン
 * 複数のデータベースで包括的に検索し、AIで関連性を評価
 */
export class DeepResearchEngine {
  /**
   * 検索クエリを拡張生成
   */
  async generateExpandedQueries(
    query: string,
    searchPlan?: SearchPlan
  ): Promise<string[]> {
    try {
      const plan = searchPlan || (await generateSearchPlan({ topic: query, language: "ja" }));

      const prompt = `以下の研究質問について、複数のデータベースで検索するための多様な検索クエリを生成してください。

元の質問: "${query}"

以下の形式で10個の検索クエリを生成してください（各クエリは異なる角度から質問を表現）：
1. 直接的な質問形式
2. キーワードベースの検索
3. 専門用語を含む検索
4. 関連概念を含む検索
5. 方法論を含む検索
6. 引用ネットワーク検索用のキーワード
7-10. その他のバリエーション

JSON配列形式で返してください：
["query1", "query2", ...]`;

      const response = await callGemini(prompt);
      
      // JSONを抽出
      const jsonMatch = response.match(/\[.*\]/s);
      if (jsonMatch) {
        const queries = JSON.parse(jsonMatch[0]);
        // 検索プランのrecommendedQueriesも追加
        const allQueries = [
          ...queries,
          ...(plan.recommendedQueries || []),
          query, // 元の質問も含める
        ];
        // 重複除去
        return Array.from(new Set(allQueries));
      }

      // JSONパースに失敗した場合のフォールバック
      return [
        ...(plan.recommendedQueries || []),
        query,
      ];
    } catch (error) {
      console.error("Query expansion error:", error);
      // エラー時は元のクエリとプランのクエリのみ返す
      const plan = searchPlan || (await generateSearchPlan({ topic: query, language: "ja" }).catch(() => null));
      return [
        ...(plan?.recommendedQueries || []),
        query,
      ];
    }
  }

  /**
   * 複数データベースで並列検索（レート制限対策付き）
   */
  async performDeepSearch(
    queries: string[],
    sources: string[],
    maxPapers: number,
    includeCitationNetwork: boolean
  ): Promise<Paper[]> {
    const allPapers: Paper[] = [];

    // クエリ数を制限（10個まで）
    const limitedQueries = queries.slice(0, 10);
    
    // 並列数を制限（一度に3クエリまで）
    const concurrencyLimit = 3;
    const papersPerQuery = Math.ceil(maxPapers / limitedQueries.length);

    // バッチ処理で並列数を制限
    for (let i = 0; i < limitedQueries.length; i += concurrencyLimit) {
      const batch = limitedQueries.slice(i, i + concurrencyLimit);
      const batchPromises: Promise<Paper[]>[] = [];

      // 各バッチ内でクエリ × データベースの組み合わせを作成
      for (const query of batch) {
        for (const source of sources) {
          batchPromises.push(
            this.searchDatabase(query, source, papersPerQuery)
              .then(papers => papers.map(p => ({ ...p, searchQuery: query })))
              .catch((error) => {
                // レート制限エラーの場合は詳細ログ
                if (error instanceof Error && error.message.includes("429")) {
                  console.warn(`[Rate Limit] ${source} with query "${query}": Rate limit exceeded, will retry later`);
                } else {
                  console.error(`Search error for ${source} with query "${query}":`, error);
                }
                return [];
              })
          );
        }
      }

      // バッチを並列実行
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 結果を統合（クエリとソースごとに分類）
      const batchPapers: Paper[] = [];
      const querySourceResults: Map<string, Map<string, Paper[]>> = new Map();
      
      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const papers = result.value;
          batchPapers.push(...papers);
          
          // クエリとソースごとに結果を分類
          papers.forEach((paper) => {
            const query = paper.searchQuery || batch[Math.floor(index / sources.length)];
            const source = paper.source || "unknown";
            
            if (!querySourceResults.has(query)) {
              querySourceResults.set(query, new Map());
            }
            const sourceMap = querySourceResults.get(query)!;
            if (!sourceMap.has(source)) {
              sourceMap.set(source, []);
            }
            sourceMap.get(source)!.push(paper);
          });
        }
      });

      // Semantic Scholarが失敗した場合、PubMedでフォールバック検索
      if (sources.includes("semantic_scholar") && sources.includes("pubmed")) {
        for (const query of batch) {
          const queryResults = querySourceResults.get(query);
          const semanticResults = queryResults?.get("semantic_scholar") || [];
          const pubmedResults = queryResults?.get("pubmed") || [];

          // Semantic Scholarの結果が0件で、PubMedもまだ検索されていない（または0件）の場合
          if (semanticResults.length === 0 && pubmedResults.length === 0) {
            console.log(
              `[Deep Research] Semantic Scholar returned 0 results for "${query}", trying PubMed as fallback`
            );
            try {
              const pubmedFallbackResults = await this.searchDatabase(query, "pubmed", papersPerQuery);
              const pubmedFallbackPapers = pubmedFallbackResults.map((p) => ({
                ...p,
                searchQuery: query,
              }));
              batchPapers.push(...pubmedFallbackPapers);
              console.log(
                `[Deep Research] PubMed fallback found ${pubmedFallbackPapers.length} papers for "${query}"`
              );
              
              // フォールバック検索の後に少し待機（レート制限対策）
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error(`[Deep Research] PubMed fallback failed for "${query}":`, error);
            }
          } else if (semanticResults.length === 0 && pubmedResults.length > 0) {
            console.log(
              `[Deep Research] Semantic Scholar returned 0 results for "${query}", but PubMed already found ${pubmedResults.length} papers`
            );
          }
        }
      }

      allPapers.push(...batchPapers);

      // バッチ間に遅延を追加（レート制限対策）
      // 最後のバッチでない場合のみ待機
      // テスト結果に基づき2秒待機（1秒ではレート制限に達する可能性がある）
      if (i + concurrencyLimit < limitedQueries.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
      }
    }

    // 引用ネットワーク検索（オプション）
    if (includeCitationNetwork && allPapers.length > 0) {
      try {
        const citationPapers = await this.searchCitationNetwork(
          allPapers.slice(0, 10) // 上位10件のみ
        );
        allPapers.push(...citationPapers);
      } catch (error) {
        console.error("Citation network search error:", error);
        // エラーでも続行
      }
    }

    // 重複除去
    const uniquePapers = this.deduplicatePapers(allPapers);
    
    return uniquePapers.slice(0, maxPapers);
  }

  /**
   * 各データベースの検索関数
   */
  private async searchDatabase(
    query: string,
    source: string,
    limit: number
  ): Promise<Paper[]> {
    const searchOptions = {
      query,
      limit,
      filters: {
        databases: [source],
        dateRange: {
          start: "2010-01-01",
          end: new Date().toISOString().split("T")[0],
        },
        minCitations: 0,
      },
    };

    switch (source) {
      case "semantic_scholar":
      case "pubmed":
        return await advancedSearchEngine.multilayerSearch(query, searchOptions);
      default:
        console.warn(`Unknown source: ${source}`);
        return [];
    }
  }

  /**
   * 引用ネットワーク検索（レート制限対策付き）
   */
  private async searchCitationNetwork(seedPapers: Paper[]): Promise<Paper[]> {
    const citationPapers: Paper[] = [];
    
    // 上位5件のみ、かつ1件ずつ処理してレート制限を回避
    for (const paper of seedPapers.slice(0, 5)) {
      try {
        // 引用元を取得
        const citedBy = await this.getCitedByPapers(paper.paperId);
        citationPapers.push(...citedBy);
        
        // リクエスト間に遅延を追加（レート制限対策）
        // テスト結果に基づき1秒待機（500msでは短すぎる可能性がある）
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 参考文献を取得
        const references = await this.getReferencePapers(paper.paperId);
        citationPapers.push(...references);
        
        // リクエスト間に遅延を追加（レート制限対策）
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Citation search error for paper ${paper.paperId}:`, error);
        // エラーでも続行
      }
    }
    
    return citationPapers;
  }

  /**
   * 論文の引用元を取得（レート制限対策付き）
   */
  private async getCitedByPapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?limit=20&fields=paperId,title,abstract,authors,year,venue,citationCount,url,doi`,
        { headers: s2Headers() }
      );

      // レート制限エラーの場合
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const resetTime = response.headers.get("x-rate-limit-reset");
        console.warn(`[Rate Limit] getCitedByPapers: 429 error. Retry after: ${retryAfter}, Reset time: ${resetTime}`);
        return []; // レート制限時は空配列を返す
      }

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.data || []).map((item: any) => ({
        id: item.citingPaper?.paperId || "",
        paperId: item.citingPaper?.paperId || "",
        title: item.citingPaper?.title || "",
        abstract: item.citingPaper?.abstract || "",
        authors: item.citingPaper?.authors?.map((a: any) => a.name).join(", ") || "",
        year: item.citingPaper?.year || 0,
        venue: item.citingPaper?.venue || "",
        citationCount: item.citingPaper?.citationCount || 0,
        url: item.citingPaper?.url || "",
        doi: item.citingPaper?.doi,
        source: "semantic_scholar",
      })).filter((p: Paper) => p.paperId);
    } catch (error) {
      console.error("getCitedByPapers error:", error);
      return [];
    }
  }

  /**
   * 論文の参考文献を取得（レート制限対策付き）
   */
  private async getReferencePapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/references?limit=20&fields=paperId,title,abstract,authors,year,venue,citationCount,url,doi`,
        { headers: s2Headers() }
      );

      // レート制限エラーの場合
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const resetTime = response.headers.get("x-rate-limit-reset");
        console.warn(`[Rate Limit] getReferencePapers: 429 error. Retry after: ${retryAfter}, Reset time: ${resetTime}`);
        return []; // レート制限時は空配列を返す
      }

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.data || []).map((item: any) => ({
        id: item.paper?.paperId || "",
        paperId: item.paper?.paperId || "",
        title: item.paper?.title || "",
        abstract: item.paper?.abstract || "",
        authors: item.paper?.authors?.map((a: any) => a.name).join(", ") || "",
        year: item.paper?.year || 0,
        venue: item.paper?.venue || "",
        citationCount: item.paper?.citationCount || 0,
        url: item.paper?.url || "",
        doi: item.paper?.doi,
        source: "semantic_scholar",
      })).filter((p: Paper) => p.paperId);
    } catch (error) {
      console.error("getReferencePapers error:", error);
      return [];
    }
  }

  /**
   * 論文の重複除去
   */
  private deduplicatePapers(papers: Paper[]): Paper[] {
    const seen = new Set<string>();
    return papers.filter((paper) => {
      if (seen.has(paper.paperId)) {
        return false;
      }
      seen.add(paper.paperId);
      return true;
    });
  }

  /**
   * 論文の関連性をスコアリング
   */
  async scorePapersRelevance(
    query: string,
    papers: Paper[],
    provider: "openai" | "gemini" = "gemini"
  ): Promise<ScoredPaper[]> {
    // バッチ処理（一度に20件ずつ評価）
    const batchSize = 20;
    const scoredPapers: ScoredPaper[] = [];

    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);
      
      try {
        const prompt = `以下の研究質問に対して、各論文の関連性を0-100でスコアリングしてください。

研究質問: "${query}"

論文リスト:
${batch.map((p, idx) => `
${idx + 1}. タイトル: ${p.title}
   要約: ${p.abstract?.substring(0, 200)}...
`).join("\n")}

各論文について、以下のJSON形式で評価してください：
[
  {
    "index": 1,
    "relevanceScore": 85,
    "relevanceReasoning": "ODF3 among MMAF genes について具体的に分析している",
    "relevanceTag": "Relevant"
  },
  ...
]

relevanceTagは "Relevant" または "Not Relevant" のいずれかです。`;

        let response: string;
        if (provider === "gemini") {
          response = await callGemini(prompt);
        } else {
          const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "あなたは学術論文の専門家です。研究質問に対して論文の関連性を評価してください。",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 2000,
          });
          response = completion.choices[0].message.content || "";
        }
        
        // JSONを抽出
        const jsonMatch = response.match(/\[.*\]/s);
        if (jsonMatch) {
          const scores = JSON.parse(jsonMatch[0]);
          
          // 論文にスコアを追加
          batch.forEach((paper, idx) => {
            const score = scores.find((s: any) => s.index === idx + 1);
            scoredPapers.push({
              ...paper,
              relevanceScore: score?.relevanceScore || 0,
              relevanceReasoning: score?.relevanceReasoning || "",
              relevanceTag: score?.relevanceTag === "Relevant" ? "Relevant" : "Not Relevant",
            });
          });
        } else {
          // JSONパースに失敗した場合、デフォルト値を設定
          batch.forEach((paper) => {
            scoredPapers.push({
              ...paper,
              relevanceScore: 50,
              relevanceReasoning: "評価できませんでした",
              relevanceTag: "Not Relevant",
            });
          });
        }
      } catch (error) {
        console.error(`Scoring error for batch ${i}:`, error);
        // エラー時はデフォルト値を設定
        batch.forEach((paper) => {
          scoredPapers.push({
            ...paper,
            relevanceScore: 50,
            relevanceReasoning: "評価中にエラーが発生しました",
            relevanceTag: "Not Relevant",
          });
        });
      }
    }

    // スコアでソート
    return scoredPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Deep Research実行（メイン関数）
   */
  async executeDeepResearch(
    options: DeepResearchOptions
  ): Promise<DeepResearchResult> {
    const {
      query,
      maxPapers = 300,
      sources = ["semantic_scholar", "pubmed"],
      includeCitationNetwork = true,
      provider = "gemini",
    } = options;

    // ステップ1: 検索クエリの拡張生成
    const searchPlan = await generateSearchPlan({ topic: query, language: "ja" });
    const expandedQueries = await this.generateExpandedQueries(query, searchPlan);

    // ステップ2: 複数データベースで並列検索
    const allPapers = await this.performDeepSearch(
      expandedQueries,
      sources,
      maxPapers,
      includeCitationNetwork
    );

    // ステップ3: 関連性スコアリング
    const scoredPapers = await this.scorePapersRelevance(
      query,
      allPapers,
      provider
    );

    // ステップ4: 統計情報を計算
    const searchStats = {
      sources: {} as Record<string, number>,
      queries: {} as Record<string, number>,
    };

    scoredPapers.forEach((paper) => {
      // ソース統計
      const source = paper.source || "unknown";
      searchStats.sources[source] = (searchStats.sources[source] || 0) + 1;

      // クエリ統計
      const searchQuery = (paper as any).searchQuery || "unknown";
      searchStats.queries[searchQuery] = (searchStats.queries[searchQuery] || 0) + 1;
    });

    return {
      papers: scoredPapers,
      totalPapers: scoredPapers.length,
      expandedQueries,
      searchStats,
    };
  }
}

// シングルトンインスタンス
export const deepResearchEngine = new DeepResearchEngine();

