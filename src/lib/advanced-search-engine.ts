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

  // 多層検索戦略
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
          this.searchSemanticScholar(query, searchOptions).catch(() => [])
        )
      );

      let combinedResults = this.deduplicateAndRank(resultsSets.flat());

      if (combinedResults.length === 0 && queries.length > 1) {
        const combinedQuery = queries.map((query) => `(${query})`).join(" OR ");
        combinedResults = await this.searchSemanticScholar(
          combinedQuery,
          searchOptions
        ).catch(() => []);
      }

      if (combinedResults.length === 0) {
        const fallbackQuery = ensureCoreTerms(topic, plan?.coreKeywords);
        combinedResults = await this.searchSemanticScholar(
          fallbackQuery,
          searchOptions
        ).catch(() => []);
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
      const papers = await this.searchSemanticScholar(query, options);
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

      // 各クエリで並列検索
      const searchPromises = queries.map((query) =>
        this.searchSemanticScholar(query, options).catch(() => [])
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
        "paperId,title,abstract,authors,year,venue,citationCount,url,isOpenAccess",
    });

    // 年フィルターは精度を落とす可能性があるため除外（必要なら後段でフィルター）

    // リトライ機能付きでAPI呼び出し
    return await this.retryApiCall(
      () => this.callSemanticScholarAPI(params),
      3, // 最大3回リトライ
      1000 // 1秒間隔
    );
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
      const errorText = await response.text();
      console.error(
        `Semantic Scholar API error: ${response.status}`,
        errorText
      );

      // レート制限の場合は特別な処理
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please try again later.`);
      }

      throw new Error(
        `Semantic Scholar API error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((paper: any) => ({
      id: paper.paperId,
      paperId: paper.paperId,
      title: paper.title || "タイトルなし",
      authors: paper.authors?.map((a: any) => a.name).join(", ") || "著者不明",
      year: paper.year || new Date().getFullYear(),
      abstract: paper.abstract || "要約なし",
      url:
        paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
      citationCount: paper.citationCount || 0,
      venue: paper.venue || "ジャーナル不明",
      isOpenAccess: paper.isOpenAccess || false,
      doi: paper.doi,
      source: "semantic_scholar",
    }));
  }

  // 引用された論文を取得
  private async getCitedByPapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?limit=20&fields=paperId,title,abstract,authors,year,venue,citationCount,url`,
        { headers: s2Headers() }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (data.data || []).map((citation: any) => ({
        id: citation.citingPaper.paperId,
        paperId: citation.citingPaper.paperId,
        title: citation.citingPaper.title || "タイトルなし",
        authors:
          citation.citingPaper.authors?.map((a: any) => a.name).join(", ") ||
          "著者不明",
        year: citation.citingPaper.year || new Date().getFullYear(),
        abstract: citation.citingPaper.abstract || "要約なし",
        url:
          citation.citingPaper.url ||
          `https://www.semanticscholar.org/paper/${citation.citingPaper.paperId}`,
        citationCount: citation.citingPaper.citationCount || 0,
        venue: citation.citingPaper.venue || "ジャーナル不明",
        source: "semantic_scholar",
      }));
    } catch (error) {
      console.error("Get cited by papers error:", error);
      return [];
    }
  }

  // 参考文献を取得
  private async getReferencePapers(paperId: string): Promise<Paper[]> {
    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}/references?limit=20&fields=paperId,title,abstract,authors,year,venue,citationCount,url`,
        { headers: s2Headers() }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (data.data || []).map((reference: any) => ({
        id: reference.paper.paperId,
        paperId: reference.paper.paperId,
        title: reference.paper.title || "タイトルなし",
        authors:
          reference.paper.authors?.map((a: any) => a.name).join(", ") ||
          "著者不明",
        year: reference.paper.year || new Date().getFullYear(),
        abstract: reference.paper.abstract || "要約なし",
        url:
          reference.paper.url ||
          `https://www.semanticscholar.org/paper/${reference.paper.paperId}`,
        citationCount: reference.paper.citationCount || 0,
        venue: reference.paper.venue || "ジャーナル不明",
        source: "semantic_scholar",
      }));
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
    return this.searchSemanticScholar(query, options).catch(() => []);
  }

  // フィルター適用
  applyFilters(papers: Paper[], filters: AdvancedSearchFilters): Paper[] {
    return papers.filter((paper) => {
      // 引用数フィルター
      if (
        filters.minCitations > 0 &&
        (paper.citationCount || 0) < filters.minCitations
      ) {
        return false;
      }

      // 年フィルター
      if (
        filters.dateRange.start &&
        paper.year < parseInt(filters.dateRange.start.split("-")[0])
      ) {
        return false;
      }
      if (
        filters.dateRange.end &&
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
          throw error;
        }

        // レート制限の場合は長めに待機
        if (error instanceof Error && error.message.includes("Rate limit")) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayMs * attempt * 2)
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        console.log(`API call attempt ${attempt} failed, retrying...`);
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
