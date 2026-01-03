"use client";

import { useState, useEffect } from "react";
import { Paper, AIProvider } from "@/types";
import {
  Plus,
  X,
  FileText,
  Bot,
  Sparkles,
  BookOpen,
  Search,
} from "lucide-react";
import AdvancedFilters, { FilterSettings } from "./AdvancedFilters";
import SearchPlanSummary from "./SearchPlanSummary";
import { SearchPlan } from "@/types";
import { toast } from "react-hot-toast";

interface ReviewFormProps {
  topic: string;
  setTopic: (topic: string) => void;
  papers: Paper[];
  setPapers: (papers: Paper[]) => void;
  onGenerate: (
    provider: AIProvider,
    searchMode: "auto" | "manual",
    filters: FilterSettings
  ) => void;
  generating: boolean;
  userId?: string;
}

export default function ReviewForm({
  topic,
  setTopic,
  papers,
  setPapers,
  onGenerate,
  generating,
  userId = "demo-user-123",
}: ReviewFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [libraryPapers, setLibraryPapers] = useState<Paper[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "library">("search");
  const [searchMode, setSearchMode] = useState<"auto" | "manual" | "deep">(
    "auto"
  );
  const [deepResearching, setDeepResearching] = useState(false);
  const [deepResearchSessionId, setDeepResearchSessionId] = useState<
    string | null
  >(null);
  const [filters, setFilters] = useState<FilterSettings>({
    outputType: "auto",
    minCitations: 0,
    databases: ["semantic_scholar"],
    journalQuality: "all",
    internetFilter: "all",
    dateRange: { start: "", end: "" },
  });
  const [plan, setPlan] = useState<SearchPlan | null>(null);
  const [planning, setPlanning] = useState(false);

  const fetchLibraryPapers = async () => {
    setLoadingLibrary(true);
    try {
      const response = await fetch(`/api/library?userId=${userId}`);
      if (!response.ok) {
        throw new Error("ライブラリーの取得に失敗しました");
      }
      const data = await response.json();
      setLibraryPapers(data.papers || []);
    } catch (error) {
      console.error("Library fetch error:", error);
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (activeTab === "library") {
      fetchLibraryPapers();
    }
  }, [activeTab, userId]);

  useEffect(() => {
    setPlan(null);
  }, [topic]);

  const generatePlan = async (targetTopic: string) => {
    setPlanning(true);
    try {
      const response = await fetch("/api/topic-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: targetTopic }),
      });

      if (!response.ok) {
        throw new Error("検索戦略の生成に失敗しました");
      }

      const data = await response.json();
      setPlan(data.plan);

      // 推奨フィルターを自動反映
      if (data.plan?.recommendedFilters) {
        setFilters((prev) => ({
          ...prev,
          minCitations:
            data.plan.recommendedFilters.minCitations ?? prev.minCitations,
          dateRange: {
            start:
              data.plan.recommendedFilters.dateRange?.start ??
              prev.dateRange.start,
            end:
              data.plan.recommendedFilters.dateRange?.end ?? prev.dateRange.end,
          },
        }));
      }

      return data.plan as SearchPlan;
    } catch (error) {
      console.error("Topic plan error:", error);
      toast.error("検索戦略の生成に失敗しました");
      return null;
    } finally {
      setPlanning(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const activePlan = plan || (await generatePlan(searchQuery));

      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: searchQuery,
          provider: "gemini",
          maxPapers: 10,
          filters,
          plan: activePlan,
          sources: filters.databases || ["semantic_scholar", "pubmed"],
        }),
      });

      if (!response.ok) {
        throw new Error("検索に失敗しました");
      }

      const data = await response.json();
      if (data.papers && data.papers.length > 0) {
        setPapers([...papers, ...data.papers]);
        setSearchQuery("");
        if (data.plan) {
          setPlan(data.plan);
        }
      } else {
        toast.error(data.message || "関連する論文が見つかりませんでした");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("検索に失敗しました");
    } finally {
      setSearching(false);
    }
  };

  const removePaper = (paperId: string) => {
    setPapers(papers.filter((paper) => paper.paperId !== paperId));
  };

  const addPaperFromLibrary = (libraryPaper: any) => {
    const paper: Paper = {
      id: libraryPaper.paper_id || libraryPaper.id,
      paperId: libraryPaper.paper_id || libraryPaper.id,
      title: libraryPaper.title,
      authors: libraryPaper.authors || "",
      year: libraryPaper.year || 0,
      abstract: libraryPaper.abstract || "",
      url: libraryPaper.url || "",
      citationCount: libraryPaper.citation_count || 0,
      venue: libraryPaper.venue || "",
    };

    if (!papers.some((p) => p.paperId === paper.paperId)) {
      setPapers([...papers, paper]);
    }
  };

  const handleAutoSearch = async () => {
    if (!topic.trim()) {
      toast.error("研究トピックを入力してください");
      return;
    }

    setSearching(true);
    try {
      const activePlan = plan || (await generatePlan(topic));

      if (!activePlan) {
        toast.error("検索戦略が生成できませんでした");
        return;
      }

      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic,
          provider: "gemini",
          maxPapers: 15,
          filters,
          plan: activePlan,
          sources: filters.databases || ["semantic_scholar", "pubmed"],
        }),
      });

      if (!response.ok) {
        throw new Error("AI検索に失敗しました");
      }

      const data = await response.json();
      if (data.papers && data.papers.length > 0) {
        setPapers(data.papers);
        if (data.plan) {
          setPlan(data.plan);
        }
        toast.success(
          `AIが${data.papers.length}件の関連論文を自動選択しました`
        );
      } else {
        toast.error(data.message || "関連する論文が見つかりませんでした");
      }
    } catch (error) {
      console.error("AI search error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "AI検索に失敗しました";
      toast.error(`AI検索に失敗しました: ${errorMessage}`);
    } finally {
      setSearching(false);
    }
  };

  const handleDeepResearch = async () => {
    if (!topic.trim()) {
      toast.error("研究トピックを入力してください");
      return;
    }

    setDeepResearching(true);
    try {
      // ステップ1: Deep Research実行（10個の論文を検索）
      toast.loading("Deep Researchを実行中...（10件の論文を検索中）", {
        id: "deep-research",
      });

      const deepResponse = await fetch("/api/deep-research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: topic,
          maxPapers: 10,
          sources: ["pubmed"], // PubMedのみで検索（Semantic Scholarのエラーを回避）
          includeCitationNetwork: false, // PubMedでは引用ネットワーク検索は利用できないため無効化
          provider: "gemini",
        }),
      });

      if (!deepResponse.ok) {
        const errorData = await deepResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || "Deep Researchに失敗しました";
        const errorDetails = errorData.details
          ? `\n詳細: ${errorData.details}`
          : "";
        const errorHint = errorData.hint ? `\nヒント: ${errorData.hint}` : "";
        console.error("Deep Research API error:", errorData);
        toast.error(`${errorMessage}${errorDetails}${errorHint}`, {
          id: "deep-research",
        });
        throw new Error(`${errorMessage}${errorDetails}${errorHint}`);
      }

      const deepData = await deepResponse.json();
      setDeepResearchSessionId(deepData.sessionId);

      toast.success(
        `${deepData.totalPapers}件の論文を検索しました。AIが厳選中...`,
        { id: "deep-research" }
      );

      // ステップ2: まとめファイル生成（7個の論文を厳選）
      toast.loading("AIが関連性の高い論文を厳選中...", {
        id: "deep-research-summary",
      });

      const summaryResponse = await fetch(
        `/api/deep-research/${deepData.sessionId}/summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedCount: 7,
            provider: "gemini",
          }),
        }
      );

      if (!summaryResponse.ok) {
        const statusCode = summaryResponse.status;
        let errorData: any = {};

        // レスポンスボディを取得（空の場合も考慮）
        try {
          const text = await summaryResponse.text();
          if (text && text.trim().length > 0) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          // パースに失敗した場合は空オブジェクトのまま
        }

        // HTTPステータスコードに基づいてエラーメッセージを構築
        let errorMessage =
          errorData.error || "まとめファイル生成に失敗しました";
        let errorDetails = "";

        if (errorData.details) {
          errorDetails += `\n詳細: ${errorData.details}`;
        }

        if (errorData.sessionId) {
          errorDetails += `\nセッションID: ${errorData.sessionId}`;
        }

        if (errorData.code) {
          errorDetails += `\nエラーコード: ${errorData.code}`;
        }

        if (errorData.hint) {
          errorDetails += `\nヒント: ${errorData.hint}`;
        }

        if (errorData.totalPapersInSession !== undefined) {
          errorDetails += `\nセッション内の論文数: ${errorData.totalPapersInSession}件`;
        }

        if (errorData.requestedCount !== undefined) {
          errorDetails += `\n要求された論文数: ${errorData.requestedCount}件`;
        }

        // ステータスコード別のメッセージ
        if (statusCode === 404) {
          if (errorData.error?.includes("セッション")) {
            errorMessage = "セッションが見つかりません";
          } else if (errorData.error?.includes("論文")) {
            errorMessage = "論文が見つかりません";
          } else {
            errorMessage = "リソースが見つかりません（404）";
          }
        } else if (statusCode === 500) {
          errorMessage = "サーバーエラーが発生しました";
        }

        console.error("Summary generation API error:", {
          statusCode,
          errorData,
          sessionId: deepData.sessionId,
        });

        toast.error(`${errorMessage}${errorDetails}`, {
          id: "deep-research-summary",
          duration: 5000, // エラーメッセージを長めに表示
        });
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      const summaryData = await summaryResponse.json();

      // まとめファイルと厳選論文を設定
      // onGenerateを呼び出してレビューを設定
      // ただし、Deep Researchの場合は既にレビューが生成されているので、
      // 親コンポーネントに通知する必要がある
      setPapers(summaryData.selectedPapers);
      setSearchMode("deep");

      toast.success(
        `Deep Research完了！${summaryData.selectedPapers.length}件の論文を厳選してまとめファイルを生成しました`,
        { id: "deep-research-summary" }
      );

      // 親コンポーネントにレビューを設定してもらうため、カスタムイベントを発火
      // または、onGenerateを呼び出す（ただし、既にレビューが生成されているので注意）
      // ここでは、親コンポーネントでDeep Researchの結果を処理する必要がある
      // 一時的な解決策として、windowイベントを使用
      window.dispatchEvent(
        new CustomEvent("deepResearchComplete", {
          detail: {
            review: summaryData.review,
            papers: summaryData.selectedPapers,
            sessionId: deepData.sessionId,
            totalPapers: deepData.totalPapers,
          },
        })
      );
    } catch (error) {
      console.error("Deep research error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Deep Researchに失敗しました";
      toast.error(`Deep Researchに失敗しました: ${errorMessage}`, {
        id: "deep-research",
      });
      toast.error(`Deep Researchに失敗しました: ${errorMessage}`, {
        id: "deep-research-summary",
      });
    } finally {
      setDeepResearching(false);
    }
  };

  const canGenerate =
    topic.trim() && (papers.length > 0 || searchMode === "auto");

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="topic"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          研究トピック *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例: カルシウムが神経細胞中で微小管解体をどのように促進するか？"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => {
              if (!topic.trim()) {
                toast.error("研究トピックを入力してください");
                return;
              }
              generatePlan(topic);
            }}
            disabled={planning || !topic.trim()}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {planning ? "生成中..." : "AIプラン作成"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          具体的なリサーチクエスチョンを入力すると、より包括的なレビューが生成されます
        </p>
      </div>

      <SearchPlanSummary
        plan={plan}
        onRegenerate={topic.trim() ? () => generatePlan(topic) : undefined}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          検索モード
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setSearchMode("auto")}
            className={`p-3 text-left border-2 rounded-lg transition-colors ${
              searchMode === "auto"
                ? "border-pink-500 bg-pink-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="font-medium text-sm">🤖 自動検索</div>
            <div className="text-xs text-gray-600 mt-1">
              トピックから自動的に関連論文を検索・選択（15件程度）
            </div>
          </button>
          <button
            onClick={() => setSearchMode("manual")}
            className={`p-3 text-left border-2 rounded-lg transition-colors ${
              searchMode === "manual"
                ? "border-pink-500 bg-pink-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="font-medium text-sm">✋ 手動選択</div>
            <div className="text-xs text-gray-600 mt-1">
              自分で論文を検索・選択して指定
            </div>
          </button>
          <button
            onClick={() => setSearchMode("deep")}
            className={`p-3 text-left border-2 rounded-lg transition-colors ${
              searchMode === "deep"
                ? "border-pink-500 bg-pink-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="font-medium text-sm">🔬 Deep Research</div>
            <div className="text-xs text-gray-600 mt-1">
              10件の論文を検索し、AIが厳選してまとめファイルを生成
            </div>
          </button>
        </div>
      </div>

      <AdvancedFilters filters={filters} onFiltersChange={setFilters} />

      {searchMode === "auto" && (
        <div>
          <button
            onClick={handleAutoSearch}
            disabled={searching || !topic.trim()}
            className="w-full p-4 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg hover:from-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {searching ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                AIが関連論文を検索中...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                AIが関連論文を自動検索・選択
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            AIが複数の検索クエリを生成し、関連性の高い論文を自動的に検索・選択します
          </p>
        </div>
      )}

      {searchMode === "deep" && (
        <div>
          <button
            onClick={handleDeepResearch}
            disabled={deepResearching || !topic.trim()}
            className="w-full p-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {deepResearching ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Deep Research実行中...（10件の論文を検索中）
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Deep Researchを実行
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            複数のデータベースで包括的に検索し、AIが関連性の高い論文を厳選してまとめファイルを生成します
          </p>
        </div>
      )}

      {searchMode === "manual" && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            関連論文を検索・追加
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="論文を検索..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-4 py-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? "検索中..." : "検索"}
            </button>
          </div>

          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("search")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === "search"
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Search className="h-4 w-4" />
                論文を検索
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === "library"
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                ライブラリーから選択
              </button>
            </nav>
          </div>

          {activeTab === "library" && (
            <div>
              {loadingLibrary ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">
                    ライブラリーを読み込み中...
                  </p>
                </div>
              ) : libraryPapers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>ライブラリーに保存された論文がありません</p>
                  <p className="text-sm mt-1">
                    まず論文を検索してライブラリーに保存してください
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {libraryPapers.map((libraryPaper) => (
                    <div
                      key={(libraryPaper as any)?.paper_id || libraryPaper.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                          {libraryPaper.title}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {libraryPaper.authors} ({libraryPaper.year})
                        </p>
                        {libraryPaper.venue && (
                          <p className="text-xs text-gray-500 mt-1">
                            {libraryPaper.venue}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => addPaperFromLibrary(libraryPaper)}
                        disabled={papers.some(
                          (p) =>
                            p.paperId ===
                            ((libraryPaper as any)?.paper_id || libraryPaper.id)
                        )}
                        className="px-3 py-1 text-xs bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {papers.some(
                          (p) =>
                            p.paperId ===
                            ((libraryPaper as any)?.paper_id || libraryPaper.id)
                        )
                          ? "追加済み"
                          : "追加"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            選択された論文 ({papers.length}件)
          </h3>
          {papers.length > 0 && (
            <button
              onClick={() => setPapers([])}
              className="text-sm text-red-600 hover:text-red-800"
            >
              すべて削除
            </button>
          )}
        </div>

        {papers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            {searchMode === "auto" ? (
              <p>「関連論文を自動検索・選択」ボタンを押してください</p>
            ) : (
              <p>関連論文を検索して追加してください</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {papers.map((paper, index) => (
              <div
                key={`${paper.paperId}-${index}`}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                    {paper.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {paper.authors} ({paper.year})
                  </p>
                </div>
                <button
                  onClick={() => removePaper(paper.paperId)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {searchMode !== "deep" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              onGenerate("openai", searchMode as "auto" | "manual", filters);
            }}
            disabled={!canGenerate || generating}
            className="flex items-center justify-center gap-2 p-3 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Bot className="h-5 w-5 text-blue-600" />
            <div className="text-left">
              <div className="font-medium text-blue-900">OpenAI GPT-4</div>
              <div className="text-xs text-blue-600">高品質・詳細</div>
            </div>
          </button>
          <button
            onClick={() => {
              onGenerate("gemini", searchMode as "auto" | "manual", filters);
            }}
            disabled={!canGenerate || generating}
            className="flex items-center justify-center gap-2 p-3 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-5 w-5 text-purple-600" />
            <div className="text-left">
              <div className="font-medium text-purple-900">Google Gemini</div>
              <div className="text-xs text-purple-600">高速・効率的</div>
            </div>
          </button>
        </div>
      )}

      {generating && (
        <div className="w-full bg-gray-100 text-gray-600 py-3 px-4 rounded-md font-semibold flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          レビュー生成中...
        </div>
      )}
    </div>
  );
}
