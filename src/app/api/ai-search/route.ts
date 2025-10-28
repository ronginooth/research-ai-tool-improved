import { NextRequest, NextResponse } from "next/server";
import { advancedSearchEngine } from "@/lib/advanced-search-engine";
import { aiProviderManager } from "@/lib/ai-provider-manager";
import { SearchOptions, AIProvider, SearchPlan } from "@/types";
import { generateSearchPlan } from "@/lib/topic-planner";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const {
      topic,
      provider = "gemini",
      maxPapers = 15,
      filters,
      usePlanner = true,
      userId = "demo-user-123",
    }: {
      topic: string;
      provider?: AIProvider;
      maxPapers?: number;
      filters?: any;
      usePlanner?: boolean;
      userId?: string;
    } = await request.json();

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "研究トピックが必要です" },
        { status: 400 }
      );
    }

    const rateKey = `ai-search:${userId}`;
    const rate = isRateLimited(rateKey, "ai");
    if (rate.limited) {
      const retrySeconds = Math.ceil((rate.retryAfter ?? 0) / 1000);
      return NextResponse.json(
        {
          error:
            "AI検索の利用リクエストが短時間に集中しています。少し時間を空けて再実行してください。",
          retryAfter: retrySeconds,
        },
        { status: 429, headers: { "Retry-After": String(retrySeconds) } }
      );
    }

    // 高度な検索エンジンを使用
    let plan: SearchPlan | undefined;

    if (usePlanner) {
      try {
        plan = await generateSearchPlan({ topic, language: "ja" });
      } catch (plannerError) {
        console.warn(
          "Topic planner failed, proceeding without plan:",
          plannerError
        );
      }
    }

    const searchOptions: SearchOptions = {
      query: topic,
      limit: maxPapers,
      filters: filters || {
        dateRange: {
          start: "2010-01-01",
          end: new Date().toISOString().split("T")[0],
        },
        minCitations: 0,
        journalQuality: "all",
        studyTypes: [],
        methodologies: [],
        disciplines: [],
        authors: [],
        institutions: [],
        fundingSources: [],
        includeUserLibrary: false,
        excludeUserLibrary: false,
        specificCollections: [],
        databases: ["semantic_scholar"],
        internetFilter: "all",
      },
      plan,
    };

    // 多層検索を実行
    let papers = await advancedSearchEngine.multilayerSearch(
      topic,
      searchOptions
    );

    const buildWithCore = (query: string, core?: string[]) => {
      if (!core?.length) return query;
      const required = core.map((term) => `"${term}"`).join(" ");
      return `${query} ${required}`.trim();
    };

    if (papers.length === 0 && plan?.recommendedQueries?.length) {
      try {
        const combinedQuery = plan.recommendedQueries
          .map((query) => `(${query})`)
          .join(" OR ");
        const enrichedQuery = buildWithCore(combinedQuery, plan.coreKeywords);
        papers = await advancedSearchEngine.basicSearch(
          enrichedQuery,
          searchOptions
        );
      } catch {}
    }

    if (papers.length === 0) {
      try {
        const relaxedOptions: SearchOptions = {
          ...searchOptions,
          filters: {
            ...searchOptions.filters,
            minCitations: 0,
          },
        };
        const fallbackQuery = buildWithCore(topic, plan?.coreKeywords);
        papers = await advancedSearchEngine.basicSearch(
          fallbackQuery,
          relaxedOptions
        );
      } catch {}
    }

    // フィルター適用
    const filteredPapers = filters
      ? advancedSearchEngine.applyFilters(papers, filters)
      : papers;

    // AI でランキング
    let rankedPapers = filteredPapers;
    if (filteredPapers.length > 0) {
      try {
        const ranking = await aiProviderManager.rankPapers(
          topic,
          filteredPapers,
          provider
        );
        if (ranking.length > 0) {
          rankedPapers = ranking
            .map((index) => filteredPapers[index - 1])
            .filter(Boolean);
          const remainingPapers = filteredPapers.filter(
            (_, index) => !ranking.includes(index + 1)
          );
          rankedPapers = [...rankedPapers, ...remainingPapers];
        }
      } catch (error) {
        console.warn("AI ranking failed, using default ranking:", error);
        // 引用数でソート
        rankedPapers = filteredPapers.sort(
          (a, b) => (b.citationCount || 0) - (a.citationCount || 0)
        );
      }
    }

    // 上位論文を選択
    const selectedPapers = rankedPapers.slice(0, maxPapers);

    // 検索統計を取得
    const searchStats = advancedSearchEngine.getSearchStats(selectedPapers);

    return NextResponse.json({
      papers: selectedPapers,
      total: selectedPapers.length,
      searchMethod: "advanced_multilayer",
      success: selectedPapers.length > 0,
      message:
        selectedPapers.length > 0
          ? `高度な検索で${selectedPapers.length}件の関連論文を発見しました`
          : "関連する論文が見つかりませんでした。検索条件を変更してお試しください。",
      stats: searchStats,
      provider: provider,
      plan,
    });
  } catch (error) {
    console.error("Advanced AI search error:", error);
    return NextResponse.json(
      { error: "高度なAI検索に失敗しました" },
      { status: 500 }
    );
  }
}
