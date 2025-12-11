import {
  Paper,
  SearchOptions,
  AdvancedSearchFilters,
  AIProvider,
  SearchPlan,
} from "@/types";
import { aiProviderManager } from "./ai-provider-manager";
import { s2Headers } from "./semantic-scholar";
import { generateSearchPlan } from "./topic-planner";
import { callGemini } from "./gemini";

// 高度な検索エンジン
export class AdvancedSearchEngine {
  private cache = new Map<string, { results: Paper[]; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

  // セマンティック検索
  async semanticSearch(
    query: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    try {
      // 埋め込みベクトルを生成
      const embedding = await aiProviderManager.generateEmbedding(query);

      // ベクトルデータベースでの類似検索（実装は簡略化）
      const similarPapers = await this.vectorSimilaritySearch(
        embedding,
        options
      );

      return similarPapers;
    } catch (error) {
      console.error("Semantic search error:", error);
      return [];
    }
  }

  // 多層検索戦略（段階的にキーワードを緩和）
  async multilayerSearch(
    topic: string,
    options: SearchOptions = { query: topic }
  ): Promise<Paper[]> {
    try {
      let plan = options.plan;

      if (!plan) {
        try {
          plan = await generateSearchPlan({ topic, language: "ja" });
        } catch (plannerError) {
          console.warn(
            "Topic planner failed in multilayer search:",
            plannerError
          );
        }
      }

      const requiredTerms = [] as string[];
      const ensureCoreTerms = (
        original: string,
        core: string[] | undefined
      ) => {
        if (!core?.length) return original;
        const tokens = original
          .split(" ")
          .map((token) => token.trim())
          .filter((token) => token.length > 0);

        const missing = core.filter((term) => {
          const normalized = term.toLowerCase();
          return !tokens.some((token) =>
            token.toLowerCase().includes(normalized)
          );
        });

        if (missing.length > 0) {
          requiredTerms.push(...missing);
          return `${original} ${missing.map((term) => `"${term}"`).join(" ")}`;
        }

        return original;
      };

      // 段階的検索戦略：コアキーワードを段階的に減らしていく
      // 引用は一文につき1個が多いので、複数のコアキーワードでヒットしない場合は段階的に緩和
      const coreKeywords = plan?.coreKeywords || [];
      const minResults = 5; // 最低限必要な結果数

      // ステップ1: 全てのコアキーワードを含む検索（段階的にキーワードを減らす）
      if (coreKeywords.length > 0) {
        for (let keywordCount = coreKeywords.length; keywordCount > 0; keywordCount--) {
          const selectedKeywords = coreKeywords.slice(0, keywordCount);
          // Semantic Scholarは自然言語クエリをサポートしているので、キーワードをスペースで区切る
          // 全てのキーワードを含むクエリを生成
          const queryWithAllKeywords = selectedKeywords.join(" ");
          
          console.log(`[Multilayer Search] Trying with ${keywordCount} keywords: ${queryWithAllKeywords}`);
          
          // 複数ソースで検索
          const results = await this.searchMultipleSources(
            queryWithAllKeywords,
            { ...options, plan }
          ).catch(() => []);

          // 結果が十分ある場合、または最後の試行の場合は返す
          if (results.length >= minResults || keywordCount === 1) {
            console.log(`[Multilayer Search] Found ${results.length} results with ${keywordCount} keywords`);
            // 被引用数でソート（多い順）
            const sortedResults = results.sort((a, b) => 
              (b.citationCount || 0) - (a.citationCount || 0)
            );
            return this.deduplicateAndRank(sortedResults);
          }
        }
      }

      // ステップ2: 推奨クエリを使用
      const queries = plan?.recommendedQueries?.length
        ? plan.recommendedQueries.map((query) =>
            ensureCoreTerms(query, plan?.coreKeywords)
          )
        : [ensureCoreTerms(topic, plan?.coreKeywords)];

      const searchOptions = {
        ...options,
        plan,
      };

      const resultsSets = await Promise.all(
        queries.map((query) =>
          this.searchMultipleSources(query, searchOptions).catch(() => [])
        )
      );

      let combinedResults = this.deduplicateAndRank(resultsSets.flat());

      // ステップ3: OR検索にフォールバック
      if (combinedResults.length < minResults && queries.length > 1) {
        const combinedQuery = queries.map((query) => `(${query})`).join(" OR ");
        combinedResults = await this.searchMultipleSources(
          combinedQuery,
          searchOptions
        ).catch(() => []);
        combinedResults = this.deduplicateAndRank(combinedResults);
      }

      // ステップ4: 最終フォールバック
      if (combinedResults.length === 0) {
        const fallbackQuery = ensureCoreTerms(topic, plan?.coreKeywords);
        combinedResults = await this.searchMultipleSources(
          fallbackQuery,
          searchOptions
        ).catch(() => []);
        combinedResults = this.deduplicateAndRank(combinedResults);
      }

      return combinedResults;
    } catch (error) {
      console.error("Multilayer search error:", error);
      return [];
    }
  }

  // 完全一致検索
  async exactMatchSearch(
    query: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    const cacheKey = `exact_${query}_${JSON.stringify(options.filters)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const papers = await this.searchMultipleSources(query, options);
      this.setCachedResult(cacheKey, papers);
      return papers;
    } catch (error) {
      console.error("Exact match search error:", error);
      return [];
    }
  }

  // 拡張用語検索
  async expandedTermSearch(
    topic: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    try {
      // AI で検索クエリを生成
      const queries = await aiProviderManager.generateQuery(topic);

      // 各クエリで並列検索（複数ソース対応）
      const searchPromises = queries.map((query) =>
        this.searchMultipleSources(query, options).catch(() => [])
      );

      const results = await Promise.all(searchPromises);
      return this.deduplicateAndRank(results.flat());
    } catch (error) {
      console.error("Expanded term search error:", error);
      return [];
    }
  }

  // 引用ネットワーク検索
  async citationNetworkSearch(
    topic: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    try {
      // まず関連論文を検索
      const initialPapers = await this.exactMatchSearch(topic, options);

      if (initialPapers.length === 0) return [];

      // 引用関係を探索
      const citedByPapers = await this.getCitedByPapers(
        initialPapers[0].paperId
      );
      const referencePapers = await this.getReferencePapers(
        initialPapers[0].paperId
      );

      return this.deduplicateAndRank([...citedByPapers, ...referencePapers]);
    } catch (error) {
      console.error("Citation network search error:", error);
      return [];
    }
  }

  // Semantic Scholar API 検索
  private async searchSemanticScholar(
    query: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    // 日本語クエリを英語に翻訳
    const translatedQuery = await this.translateQueryToEnglish(query);

    const params = new URLSearchParams({
      query: translatedQuery,
      limit: String(options.limit || 20),
      fields:
        "paperId,title,abstract,authors,year,publicationDate,venue,citationCount,url,isOpenAccess,doi",
    });

    // 年フィルターは精度を落とす可能性があるため除外（必要なら後段でフィルター）

    // リトライ機能付きでAPI呼び出し
    return await this.retryApiCall(
      () => this.callSemanticScholarAPI(params),
      3, // 最大3回リトライ
      1000 // 1秒間隔
    );
  }

  // PubMed API 検索
  private async searchPubMed(
    query: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    // 日本語クエリを英語に翻訳
    const translatedQuery = await this.translateQueryToEnglish(query);

    try {
      // Step 1: esearchでPMIDを取得
      const searchParams = new URLSearchParams({
        db: "pubmed",
        term: translatedQuery,
        retmax: String(options.limit || 20),
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

      // データを整形
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

          // pubdateから年、月、日を抽出
          let year = new Date().getFullYear();
          let month: number | null = null;
          let day: number | null = null;

          if (paper.pubdate) {
            const pubdateStr = paper.pubdate;
            // 年を抽出
            const yearMatch = pubdateStr.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0]);
            }

            // 月を抽出（英語名または数字）
            const monthNames: Record<string, number> = {
              january: 1,
              jan: 1,
              february: 2,
              feb: 2,
              march: 3,
              mar: 3,
              april: 4,
              apr: 4,
              may: 5,
              june: 6,
              jun: 6,
              july: 7,
              jul: 7,
              august: 8,
              aug: 8,
              september: 9,
              sep: 9,
              sept: 9,
              october: 10,
              oct: 10,
              november: 11,
              nov: 11,
              december: 12,
              dec: 12,
            };

            const monthMatch = pubdateStr.match(
              /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/i
            );
            if (monthMatch) {
              month = monthNames[monthMatch[0].toLowerCase()] || null;
            } else {
              // 数字形式の月を抽出（例: "2024-05-15"）
              const monthNumMatch = pubdateStr.match(/\b(0?[1-9]|1[0-2])\b/);
              if (
                (monthNumMatch && !yearMatch) ||
                (monthNumMatch && parseInt(monthNumMatch[0]) <= 12)
              ) {
                month = parseInt(monthNumMatch[0]);
              }
            }

            // 日を抽出（1-31）
            const dayMatch = pubdateStr.match(/\b([1-9]|[12][0-9]|3[01])\b/);
            if (dayMatch) {
              const dayNum = parseInt(dayMatch[0]);
              if (dayNum >= 1 && dayNum <= 31) {
                day = dayNum;
              }
            }
          }

          // Volume, Issue, Pagesを抽出
          const volume = paper.volume || undefined;
          const issue = paper.issue || undefined;
          let pages: string | undefined = undefined;
          if (paper.pages) {
            pages = paper.pages;
          } else if (paper.spage && paper.epage) {
            pages = `${paper.spage}-${paper.epage}`;
          } else if (paper.spage) {
            pages = paper.spage;
          } else if (paper.epage) {
            pages = paper.epage;
          }

          return {
            id: `pubmed-${pmid}`,
            paperId: `pubmed-${pmid}`,
            title: paper.title || "タイトルなし",
            abstract: paper.abstract || "要約なし",
            authors: authors || "著者不明",
            year: year,
            month: month,
            day: day,
            venue: paper.source || "ジャーナル不明",
            volume: volume,
            issue: issue,
            pages: pages,
            citationCount: 0, // PubMed APIには引用数が含まれない
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            source: "pubmed",
          };
        })
        .filter((paper: Paper | null): paper is Paper => paper !== null);

      return papers;
    } catch (error) {
      console.error("PubMed search error:", error);
      return [];
    }
  }

  // 複数ソース検索（Semantic Scholar + PubMed）
  private async searchMultipleSources(
    query: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    const databases = options.filters?.databases || ["semantic_scholar"];

    const searchPromises: Promise<Paper[]>[] = [];

    if (databases.includes("semantic_scholar")) {
      searchPromises.push(
        this.searchSemanticScholar(query, options).catch(() => [])
      );
    }

    if (databases.includes("pubmed")) {
      searchPromises.push(
        this.searchPubMed(query, options).catch(() => [])
      );
    }

    const results = await Promise.allSettled(searchPromises);
    const allPapers = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (r as PromiseFulfilledResult<Paper[]>).value);

    return this.deduplicateAndRank(allPapers);
  }

  // Semantic Scholar API 呼び出し
  private async callSemanticScholarAPI(
    params: URLSearchParams
  ): Promise<Paper[]> {
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      { headers: s2Headers() }
    );

    if (!response.ok) {
      // 403エラーの場合、APIキーなしで再試行
      if (response.status === 403) {
        console.warn(
          `[Semantic Scholar] API key invalid (403), trying without API key`
        );
        const fallbackHeaders = {
          "User-Agent": "Research-AI-Tool-Improved/2.0",
        };
        const fallbackResponse = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
          { headers: fallbackHeaders }
        );
        
        if (fallbackResponse.ok) {
          console.log(
            `[Semantic Scholar] Search succeeded without API key`
          );
          const data = await fallbackResponse.json();
          if (data && data.data && Array.isArray(data.data)) {
            return data.data.map((paper: any) => {
              // publicationDateから年、月、日を抽出
              let year = paper.year || new Date().getFullYear();
              let month: number | null = null;
              let day: number | null = null;

              if (paper.publicationDate) {
                // ISO 8601形式: "2024-05-15"
                const dateParts = paper.publicationDate.split('-');
                if (dateParts.length >= 1) {
                  year = parseInt(dateParts[0]) || year;
                }
                if (dateParts.length >= 2) {
                  month = parseInt(dateParts[1]) || null;
                }
                if (dateParts.length >= 3) {
                  day = parseInt(dateParts[2]) || null;
                }
              }

              return {
                id: paper.paperId,
                paperId: paper.paperId,
                title: paper.title || "タイトルなし",
                abstract: paper.abstract || "要約なし",
                authors:
                  paper.authors?.map((author: any) => author.name).join(", ") ||
                  "著者不明",
                year: year,
                month: month,
                day: day,
                venue: paper.venue || "ジャーナル不明",
                citationCount: paper.citationCount || 0,
                url: paper.url || "#",
                doi: paper.doi || undefined,
                source: "semantic_scholar",
              };
            });
          }
        } else {
          console.warn(
            `[Semantic Scholar] Fallback also failed: ${fallbackResponse.status}`
          );
        }
      }

      const errorText = await response.text();
      let errorMessage: string;
      let errorDetails: any = null;

      // JSONエラーレスポンスをパース
      try {
        errorDetails = JSON.parse(errorText);
        const message = errorDetails?.message || errorDetails?.error?.message;
        if (message) {
          errorMessage = `Semantic Scholar API error: ${response.status} - ${message}`;
        } else {
          errorMessage = `Semantic Scholar API error: ${response.status}`;
        }
      } catch {
        // JSONパースに失敗した場合はテキストをそのまま使用（最初の200文字まで）
        errorMessage = `Semantic Scholar API error: ${response.status} - ${errorText.substring(0, 200)}`;
      }

      // レート制限の場合は特別な処理
      if (response.status === 429) {
        console.warn(
          `[Semantic Scholar] Rate limit exceeded (429), will retry...`
        );
        throw new Error(`Rate limit exceeded. Please try again later.`);
      }

      // 403以外のエラーは空配列を返して続行
      if (response.status === 403) {
        console.warn(`[Semantic Scholar] API key invalid, returning empty results`);
        return [];
      }

      console.error(`[Semantic Scholar] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((paper: any) => {
      // publicationDateから年、月、日を抽出
      let year = paper.year || new Date().getFullYear();
      let month: number | null = null;
      let day: number | null = null;

      if (paper.publicationDate) {
        // ISO 8601形式: "2024-05-15"
        const dateParts = paper.publicationDate.split('-');
        if (dateParts.length >= 1) {
          year = parseInt(dateParts[0]) || year;
        }
        if (dateParts.length >= 2) {
          month = parseInt(dateParts[1]) || null;
        }
        if (dateParts.length >= 3) {
          day = parseInt(dateParts[2]) || null;
        }
      }

      return {
        id: paper.paperId,
        paperId: paper.paperId,
        title: paper.title || "タイトルなし",
        authors: paper.authors?.map((a: any) => a.name).join(", ") || "著者不明",
        year: year,
        month: month,
        day: day,
        publicationDate: paper.publicationDate || undefined,
        abstract: paper.abstract || "要約なし",
        url:
          paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        citationCount: paper.citationCount || 0,
        venue: paper.venue || "ジャーナル不明",
        isOpenAccess: paper.isOpenAccess || false,
        doi: paper.doi || undefined,
        source: "semantic_scholar",
      };
    });
  }

  // 引用された論文を取得
  private async getCitedByPapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?limit=20&fields=paperId,title,abstract,authors,year,publicationDate,venue,citationCount,url,doi`,
        { headers: s2Headers() }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (data.data || []).map((citation: any) => {
        const paper = citation.citingPaper;
        // publicationDateから年、月、日を抽出
        let year = paper.year || new Date().getFullYear();
        let month: number | null = null;
        let day: number | null = null;

        if (paper.publicationDate) {
          const dateParts = paper.publicationDate.split('-');
          if (dateParts.length >= 1) {
            year = parseInt(dateParts[0]) || year;
          }
          if (dateParts.length >= 2) {
            month = parseInt(dateParts[1]) || null;
          }
          if (dateParts.length >= 3) {
            day = parseInt(dateParts[2]) || null;
          }
        }

        return {
          id: paper.paperId,
          paperId: paper.paperId,
          title: paper.title || "タイトルなし",
          authors:
            paper.authors?.map((a: any) => a.name).join(", ") ||
            "著者不明",
          year: year,
          month: month,
          day: day,
          abstract: paper.abstract || "要約なし",
          url:
            paper.url ||
            `https://www.semanticscholar.org/paper/${paper.paperId}`,
          citationCount: paper.citationCount || 0,
          venue: paper.venue || "ジャーナル不明",
          doi: paper.doi || undefined,
          source: "semantic_scholar",
        };
      });
    } catch (error) {
      console.error("Get cited by papers error:", error);
      return [];
    }
  }

  // 参考文献を取得
  private async getReferencePapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/references?limit=20&fields=paperId,title,abstract,authors,year,publicationDate,venue,citationCount,url,doi`,
        { headers: s2Headers() }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (data.data || []).map((reference: any) => {
        const paper = reference.paper;
        // publicationDateから年、月、日を抽出
        let year = paper.year || new Date().getFullYear();
        let month: number | null = null;
        let day: number | null = null;

        if (paper.publicationDate) {
          const dateParts = paper.publicationDate.split('-');
          if (dateParts.length >= 1) {
            year = parseInt(dateParts[0]) || year;
          }
          if (dateParts.length >= 2) {
            month = parseInt(dateParts[1]) || null;
          }
          if (dateParts.length >= 3) {
            day = parseInt(dateParts[2]) || null;
          }
        }

        return {
          id: paper.paperId,
          paperId: paper.paperId,
          title: paper.title || "タイトルなし",
          authors:
            paper.authors?.map((a: any) => a.name).join(", ") ||
            "著者不明",
          year: year,
          month: month,
          day: day,
          publicationDate: paper.publicationDate || undefined,
          abstract: paper.abstract || "要約なし",
          url:
            paper.url ||
            `https://www.semanticscholar.org/paper/${paper.paperId}`,
          citationCount: paper.citationCount || 0,
          venue: paper.venue || "ジャーナル不明",
          doi: paper.doi || undefined,
          source: "semantic_scholar",
        };
      });
    } catch (error) {
      console.error("Get reference papers error:", error);
      return [];
    }
  }

  // ベクトル類似検索（簡略化実装）
  private async vectorSimilaritySearch(
    embedding: number[],
    options: SearchOptions
  ): Promise<Paper[]> {
    // 実際の実装では、ベクトルデータベース（Pinecone、Weaviate等）を使用
    // ここでは基本的な検索にフォールバック
    return this.exactMatchSearch(options.query, options);
  }

  // 重複除去とランキング
  private deduplicateAndRank(papers: Paper[]): Paper[] {
    // 重複除去
    const uniquePapers = papers.filter(
      (paper, index, self) =>
        index === self.findIndex((p) => p.paperId === paper.paperId)
    );

    // 引用数でソート
    return uniquePapers.sort(
      (a, b) => (b.citationCount || 0) - (a.citationCount || 0)
    );
  }

  // キャッシュ管理
  private getCachedResult(key: string): Paper[] | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.results;
    }
    return null;
  }

  private setCachedResult(key: string, results: Paper[]): void {
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
    });
  }

  public async basicSearch(
    query: string,
    options: SearchOptions
  ): Promise<Paper[]> {
    return this.searchMultipleSources(query, options).catch(() => []);
  }

  // フィルター適用
  applyFilters(papers: Paper[], filters: AdvancedSearchFilters): Paper[] {
    return papers.filter((paper) => {
      // 引用数フィルター
      if (
        filters.minCitations !== undefined &&
        filters.minCitations > 0 &&
        (paper.citationCount || 0) < filters.minCitations
      ) {
        return false;
      }

      // 年フィルター
      if (
        filters.dateRange?.start &&
        paper.year < parseInt(filters.dateRange.start.split("-")[0])
      ) {
        return false;
      }
      if (
        filters.dateRange?.end &&
        paper.year > parseInt(filters.dateRange.end.split("-")[0])
      ) {
        return false;
      }

      // ジャーナル品質フィルター（簡略化）
      if (filters.journalQuality !== "all") {
        // 実際の実装では、ジャーナルのインパクトファクターをチェック
        // ここでは簡略化
      }

      return true;
    });
  }

  // 検索結果の統計情報
  getSearchStats(papers: Paper[]): {
    total: number;
    averageCitations: number;
    yearRange: { min: number; max: number };
    topVenues: { venue: string; count: number }[];
    topAuthors: { author: string; count: number }[];
  } {
    if (papers.length === 0) {
      return {
        total: 0,
        averageCitations: 0,
        yearRange: { min: 0, max: 0 },
        topVenues: [],
        topAuthors: [],
      };
    }

    const citations = papers.map((p) => p.citationCount || 0);
    const years = papers.map((p) => p.year);
    const venues = papers.map((p) => p.venue).filter(Boolean);
    const authors = papers
      .flatMap((p) => p.authors.split(", "))
      .filter(Boolean);

    return {
      total: papers.length,
      averageCitations: citations.reduce((a, b) => a + b, 0) / citations.length,
      yearRange: { min: Math.min(...years), max: Math.max(...years) },
      topVenues: this.getTopItems(venues, 5).map(({ item, count }) => ({
        venue: item,
        count,
      })),
      topAuthors: this.getTopItems(authors, 10).map(({ item, count }) => ({
        author: item,
        count,
      })),
    };
  }

  private getTopItems(
    items: string[],
    limit: number
  ): { item: string; count: number }[] {
    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // リトライ機能
  private async retryApiCall<T>(
    apiCall: () => Promise<T>,
    maxRetries: number,
    delayMs: number
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        if (attempt === maxRetries) {
          // 最後の試行でも失敗した場合はエラーを投げる
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          console.error(
            `[Retry] All ${maxRetries} attempts failed. Last error: ${errorMsg}`
          );
          throw error;
        }

        // レート制限の場合は長めに待機
        const isRateLimit =
          error instanceof Error && error.message.includes("Rate limit");
        const waitTime = isRateLimit ? delayMs * attempt * 2 : delayMs;

        console.warn(
          `[Retry] API call attempt ${attempt}/${maxRetries} failed${
            isRateLimit ? " (rate limited)" : ""
          }, retrying in ${waitTime}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
    throw new Error("All retry attempts failed");
  }

  // 日本語クエリを英語に翻訳（AIベースのフォールバック付き）
  private async translateQueryToEnglish(query: string): Promise<string> {
    // 英語らしい文字が含まれていればそのまま返す
    if (/[A-Za-z]/.test(query)) return query;

    try {
      const cleaned = query
        .replace(
          /(は|が|を|に|で|と|も|から|まで|より|なに|なん|何|どのように|どうやって|どう|なのか|ですか|している|しているか|とは|について)/g,
          ""
        )
        .trim();

      const prompt = `以下の日本語の研究クエリを英語の学術検索用キーワードに変換してください。固有名詞は保持し、疑問形を命題に変換し、12語以内で出力します。余計な記号やカンマは不要です。\n\n日本語: "${
        cleaned || query
      }"`;
      const text = (await callGemini(prompt)).trim();
      if (text && /[A-Za-z]/.test(text)) return text;
    } catch {}

    // 簡易変換フォールバック
    const simple = this.simpleJapaneseToEnglish(query);
    if (simple && simple !== "research") return simple;
    // 変換できない場合は元のクエリを使用
    return query;
  }

  // 簡単な日本語→英語変換（フォールバック用）
  private simpleJapaneseToEnglish(query: string): string {
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

    let result = query;
    for (const [japanese, english] of Object.entries(translations)) {
      result = result.replace(new RegExp(japanese, "g"), english);
    }

    // 日本語文字が残っている場合は削除
    result = result.replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "");

    return result.trim() || "research"; // 空の場合はデフォルトキーワード
  }
}

// シングルトンインスタンス
export const advancedSearchEngine = new AdvancedSearchEngine();
