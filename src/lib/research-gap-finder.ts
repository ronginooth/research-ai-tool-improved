import { Paper, ResearchGap } from "@/types";
import { advancedSearchEngine } from "./advanced-search-engine";
import { aiProviderManager } from "./ai-provider-manager";

// 研究ギャップファインダー
export class ResearchGapFinder {
  private cache = new Map<string, ResearchGap[]>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

  async findResearchGaps(topic: string): Promise<ResearchGap[]> {
    const cacheKey = `gaps_${topic}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // 1. 関連論文の包括的収集
      const papers = await this.comprehensiveSearch(topic);

      if (papers.length === 0) {
        return [];
      }

      // 2. テーマクラスタリング
      const themes = await this.clusterByThemes(papers);

      // 3. 方法論分析
      const methodologies = await this.analyzeMethodologies(papers);

      // 4. 時系列分析
      const trends = await this.analyzeTrends(papers);

      // 5. ギャップ特定
      const gaps = await this.identifyGaps({
        topic,
        papers,
        themes,
        methodologies,
        trends,
        currentFrontiers: await this.identifyCurrentFrontiers(papers),
      });

      // キャッシュに保存
      this.cache.set(cacheKey, gaps);

      return gaps;
    } catch (error) {
      console.error("Research gap finding error:", error);
      return [];
    }
  }

  // 包括的検索
  private async comprehensiveSearch(topic: string): Promise<Paper[]> {
    const searchOptions = {
      query: topic,
      limit: 100,
      filters: {
        dateRange: {
          start: "2010-01-01",
          end: new Date().toISOString().split("T")[0],
        },
        minCitations: 0,
        journalQuality: "all" as const,
        studyTypes: [] as ("empirical" | "theoretical" | "review" | "meta-analysis")[],
        methodologies: [] as ("quantitative" | "qualitative" | "mixed")[],
        disciplines: [] as string[],
        authors: [] as string[],
        institutions: [] as string[],
        fundingSources: [] as string[],
        includeUserLibrary: false,
        excludeUserLibrary: false,
        specificCollections: [] as string[],
        databases: ["semantic_scholar"],
        internetFilter: "all" as const,
      },
    };

    return await advancedSearchEngine.multilayerSearch(topic, searchOptions);
  }

  // テーマクラスタリング
  private async clusterByThemes(papers: Paper[]): Promise<{
    themes: string[];
    paperThemes: Map<string, string[]>;
  }> {
    try {
      // 論文の要約を結合
      const abstracts = papers.map((p) => p.abstract).join("\n");

      // AI でテーマを抽出
      const prompt = `
以下の学術論文の要約を分析して、主要な研究テーマを10個抽出してください。

論文要約:
${abstracts}

各テーマは簡潔で（3-5語）、研究分野を表すものにしてください。
テーマのみを1行に1つずつ出力してください。
`;

      const themes = await aiProviderManager.executeWithFallback((provider) =>
        provider.generateQuery(prompt)
      );

      // 論文とテーマの関連付け（簡略化）
      const paperThemesMap = new Map<string, string[]>();
      papers.forEach((paper) => {
        const assignedThemes = themes.slice(0, 3); // 各論文に最大3テーマ
        paperThemesMap.set(paper.paperId, assignedThemes);
      });

      return { themes, paperThemes: paperThemesMap };
    } catch (error) {
      console.error("Theme clustering error:", error);
      return { themes: [], paperThemes: new Map() };
    }
  }

  // 方法論分析
  private async analyzeMethodologies(papers: Paper[]): Promise<{
    quantitative: number;
    qualitative: number;
    mixed: number;
    experimental: number;
    theoretical: number;
    review: number;
  }> {
    const methodologies = {
      quantitative: 0,
      qualitative: 0,
      mixed: 0,
      experimental: 0,
      theoretical: 0,
      review: 0,
    };

    // キーワードベースの方法論分類（簡略化）
    papers.forEach((paper) => {
      const text = `${paper.title} ${paper.abstract}`.toLowerCase();

      if (
        text.includes("experiment") ||
        text.includes("trial") ||
        text.includes("study")
      ) {
        methodologies.experimental++;
      }
      if (
        text.includes("survey") ||
        text.includes("questionnaire") ||
        text.includes("interview")
      ) {
        methodologies.qualitative++;
      }
      if (
        text.includes("statistical") ||
        text.includes("regression") ||
        text.includes("analysis")
      ) {
        methodologies.quantitative++;
      }
      if (
        text.includes("review") ||
        text.includes("meta-analysis") ||
        text.includes("systematic")
      ) {
        methodologies.review++;
      }
      if (
        text.includes("model") ||
        text.includes("theory") ||
        text.includes("framework")
      ) {
        methodologies.theoretical++;
      }
    });

    return methodologies;
  }

  // 時系列分析
  private async analyzeTrends(papers: Paper[]): Promise<{
    yearlyCounts: Map<number, number>;
    emergingTopics: string[];
    decliningTopics: string[];
  }> {
    // 年別論文数
    const yearlyCounts = new Map<number, number>();
    papers.forEach((paper) => {
      const year = paper.year;
      yearlyCounts.set(year, (yearlyCounts.get(year) || 0) + 1);
    });

    // 新興トピックと衰退トピック（簡略化）
    const emergingTopics: string[] = [];
    const decliningTopics: string[] = [];

    // 最近の論文でよく使われる用語
    const recentPapers = papers.filter((p) => p.year >= 2020);
    const olderPapers = papers.filter((p) => p.year < 2020);

    if (recentPapers.length > 0 && olderPapers.length > 0) {
      // 簡略化されたトピック分析
      emergingTopics.push("AI/ML", "Deep Learning", "Sustainability");
      decliningTopics.push("Traditional Methods", "Legacy Systems");
    }

    return { yearlyCounts, emergingTopics, decliningTopics };
  }

  // 現在のフロンティア特定
  private async identifyCurrentFrontiers(papers: Paper[]): Promise<string[]> {
    try {
      // 最近の高被引用論文を分析
      const recentHighImpact = papers
        .filter((p) => p.year >= 2020 && (p.citationCount || 0) > 10)
        .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
        .slice(0, 20);

      if (recentHighImpact.length === 0) return [];

      const abstracts = recentHighImpact.map((p) => p.abstract).join("\n");

      const prompt = `
以下の最近の高被引用論文の要約を分析して、現在の研究フロンティアを5つ特定してください。

論文要約:
${abstracts}

各フロンティアは簡潔で（3-5語）、最新の研究動向を表すものにしてください。
フロンティアのみを1行に1つずつ出力してください。
`;

      return await aiProviderManager.executeWithFallback((provider) =>
        provider.generateQuery(prompt)
      );
    } catch (error) {
      console.error("Current frontiers identification error:", error);
      return [];
    }
  }

  // ギャップ特定
  private async identifyGaps(analysis: {
    topic: string;
    papers: Paper[];
    themes: { themes: string[]; paperThemes: Map<string, string[]> };
    methodologies: any;
    trends: any;
    currentFrontiers: string[];
  }): Promise<ResearchGap[]> {
    const gaps: ResearchGap[] = [];

    // 方法論的ギャップ
    gaps.push(...this.findMethodologicalGaps(analysis));

    // 対象領域のギャップ
    gaps.push(...this.findDomainGaps(analysis));

    // 時間的ギャップ
    gaps.push(...this.findTemporalGaps(analysis));

    // 統合的ギャップ
    gaps.push(...this.findIntegrativeGaps(analysis));

    return gaps.map((gap) => ({
      ...gap,
      researchQuestions: this.generateResearchQuestions(gap),
      feasibilityScore: this.assessFeasibility(gap),
      potentialImpact: this.estimateImpact(gap),
    }));
  }

  // 方法論的ギャップ
  private findMethodologicalGaps(analysis: any): ResearchGap[] {
    const gaps: ResearchGap[] = [];
    const { methodologies } = analysis;

    const total = Object.values(methodologies).reduce(
      (sum: number, count: any) => sum + count,
      0
    );

    if (total === 0) return gaps;

    // 量的研究が少ない場合
    if (methodologies.quantitative / total < 0.3) {
      gaps.push({
        id: `methodological_quantitative_${Date.now()}`,
        title: "量的研究手法の不足",
        description:
          "この分野では質的研究が主流で、量的研究手法の適用が不足している",
        category: "methodological",
        severity: "medium",
        researchQuestions: [],
        feasibilityScore: 0,
        potentialImpact: 0,
        relatedPapers: [],
        suggestedApproaches: [],
      });
    }

    // 実験的研究が少ない場合
    if (methodologies.experimental / total < 0.2) {
      gaps.push({
        id: `methodological_experimental_${Date.now()}`,
        title: "実験的研究の不足",
        description: "理論的研究が多く、実証的な実験研究が不足している",
        category: "methodological",
        severity: "high",
        researchQuestions: [],
        feasibilityScore: 0,
        potentialImpact: 0,
        relatedPapers: [],
        suggestedApproaches: [],
      });
    }

    return gaps;
  }

  // 領域ギャップ
  private findDomainGaps(analysis: any): ResearchGap[] {
    const gaps: ResearchGap[] = [];
    const { themes, currentFrontiers } = analysis;

    // 新興トピックとの接続が少ない場合
    if (currentFrontiers.length > 0) {
      const frontierConnections = themes.themes.filter((theme: string) =>
        currentFrontiers.some(
          (frontier: string) =>
            theme.toLowerCase().includes(frontier.toLowerCase()) ||
            frontier.toLowerCase().includes(theme.toLowerCase())
        )
      );

      if (frontierConnections.length < currentFrontiers.length * 0.5) {
        gaps.push({
          id: `domain_frontier_${Date.now()}`,
          title: "新興技術との接続不足",
          description:
            "現在の研究が最新の技術動向や新興分野との接続が不足している",
          category: "domain",
          severity: "high",
          researchQuestions: [],
          feasibilityScore: 0,
          potentialImpact: 0,
          relatedPapers: [],
          suggestedApproaches: [],
        });
      }
    }

    return gaps;
  }

  // 時間的ギャップ
  private findTemporalGaps(analysis: any): ResearchGap[] {
    const gaps: ResearchGap[] = [];
    const { trends } = analysis;

    // 最近の研究が少ない場合
    const yearlyEntries = Array.from(trends.yearlyCounts.entries()) as Array<
      [number, number]
    >;
    const recentCount = yearlyEntries
      .filter(([year]) => year >= 2020)
      .reduce((sum, [, count]) => sum + count, 0);

    const totalCount = (Array.from(
      trends.yearlyCounts.values()
    ) as number[]).reduce((sum, count) => sum + count, 0);

    if (recentCount / totalCount < 0.3) {
      gaps.push({
        id: `temporal_recent_${Date.now()}`,
        title: "最近の研究の不足",
        description:
          "この分野では過去の研究が多く、最近の研究動向が不足している",
        category: "temporal",
        severity: "medium",
        researchQuestions: [],
        feasibilityScore: 0,
        potentialImpact: 0,
        relatedPapers: [],
        suggestedApproaches: [],
      });
    }

    return gaps;
  }

  // 統合的ギャップ
  private findIntegrativeGaps(analysis: any): ResearchGap[] {
    const gaps: ResearchGap[] = [];
    const { themes } = analysis;

    // 異なるテーマ間の接続が少ない場合
    if (themes.themes.length > 5) {
      gaps.push({
        id: `integrative_cross_theme_${Date.now()}`,
        title: "テーマ間の統合研究不足",
        description:
          "個別のテーマ研究は多いが、異なるテーマを統合した研究が不足している",
        category: "integrative",
        severity: "medium",
        researchQuestions: [],
        feasibilityScore: 0,
        potentialImpact: 0,
        relatedPapers: [],
        suggestedApproaches: [],
      });
    }

    return gaps;
  }

  // 研究質問生成
  private generateResearchQuestions(gap: ResearchGap): string[] {
    const baseQuestions = [
      `How can ${gap.title.toLowerCase()} be addressed in this field?`,
      `What are the barriers to implementing solutions for ${gap.title.toLowerCase()}?`,
      `What methodologies would be most effective for studying ${gap.title.toLowerCase()}?`,
    ];

    return baseQuestions;
  }

  // 実現可能性評価
  private assessFeasibility(gap: ResearchGap): number {
    let score = 0.5; // ベーススコア

    // 方法論的ギャップは実現しやすい
    if (gap.category === "methodological") {
      score += 0.3;
    }

    // 時間的ギャップは中程度
    if (gap.category === "temporal") {
      score += 0.1;
    }

    // 統合的ギャップは難しい
    if (gap.category === "integrative") {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  // 影響度評価
  private estimateImpact(gap: ResearchGap): number {
    let impact = 0.5; // ベーススコア

    // 高重要度のギャップは影響が大きい
    if (gap.severity === "high" || gap.severity === "critical") {
      impact += 0.3;
    }

    // 方法論的ギャップは影響が大きい
    if (gap.category === "methodological") {
      impact += 0.2;
    }

    return Math.max(0, Math.min(1, impact));
  }

  // キャッシュクリア
  clearCache(): void {
    this.cache.clear();
  }

  // ギャップ分析の統計
  getGapAnalysisStats(gaps: ResearchGap[]): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    averageFeasibility: number;
    averageImpact: number;
  } {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalFeasibility = 0;
    let totalImpact = 0;

    gaps.forEach((gap) => {
      byCategory[gap.category] = (byCategory[gap.category] || 0) + 1;
      bySeverity[gap.severity] = (bySeverity[gap.severity] || 0) + 1;
      totalFeasibility += gap.feasibilityScore;
      totalImpact += gap.potentialImpact;
    });

    return {
      total: gaps.length,
      byCategory,
      bySeverity,
      averageFeasibility: gaps.length > 0 ? totalFeasibility / gaps.length : 0,
      averageImpact: gaps.length > 0 ? totalImpact / gaps.length : 0,
    };
  }
}

// シングルトンインスタンス
export const researchGapFinder = new ResearchGapFinder();

