"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Search,
  FileText,
  BookOpen,
  Map as MapIcon,
  Lightbulb,
  Upload,
  PenTool,
  Calendar,
  User,
  ExternalLink,
  Save,
  Share2,
  Network,
  ChevronRight,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { getVersionString } from "@/lib/app-version";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

const SOURCE_OPTIONS = [
  { key: "semantic_scholar", label: "Semantic Scholar" },
  { key: "pubmed", label: "PubMed" },
  // Google Scholarは非表示
];

interface Paper {
  id: string;
  paperId: string;
  title: string;
  authors: string;
  year: number;
  abstract: string;
  url: string;
  citationCount: number;
  venue: string;
  source?: string;
  doi?: string;
  savedInLibrary?: boolean;
}

interface SourceStats {
  source: string;
  fetched: number;
  displayed: number;
}

interface SearchLogic {
  originalQuery: string;
  translatedQuery: string;
  translationMethod: "gemini" | "fallback" | "none";
  searchedSources: string[];
}

interface SearchResult {
  papers: Paper[];
  total: number;
  error?: string;
  retryAfter?: number;
  searchMethod?: string;
  success?: boolean;
  message?: string;
  sourceStats?: SourceStats[];
  searchLogic?: SearchLogic;
}

const DEMO_USER_ID = "demo-user-123";

// 主要機能とツールを統合
const ALL_FEATURES = [
  {
    href: "/library",
    icon: BookOpen,
    title: "My Library",
    description: "保存済みの論文・AI 解説を管理",
  },
  {
    href: "/review",
    icon: FileText,
    title: "Generate Reviews",
    description: "落合方式レビューを自動作成",
  },
  {
    href: "/manuscript",
    icon: PenTool,
    title: "Manuscript",
    description: "論文執筆支援ツール",
  },
  {
    href: "/tools/citation-map",
    icon: MapIcon,
    title: "Citation Map",
    description: "引用ネットワークを視覚化",
  },
  {
    href: "/project-integration",
    icon: Lightbulb,
    title: "Project Integration",
    description: "研究プロジェクトと連携した論文執筆ツール",
  },
];

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sources, setSources] = useState<string[]>(["semantic_scholar", "pubmed"]); // デフォルトはSemantic ScholarとPubMed
  const [enableIntentConfirmation, setEnableIntentConfirmation] = useState(false); // デフォルトはOFF
  const [results, setResults] = useState<SearchResult>({
    papers: [],
    total: 0,
  });
  const [libraryPapers, setLibraryPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultLimit, setResultLimit] = useState(20);
  const [showSearchDetails, setShowSearchDetails] = useState(true); // デフォルトで展開
  const [searchProgress, setSearchProgress] = useState<{
    semanticScholar: { status: "idle" | "searching" | "done" | "error"; fetched: number };
    pubmed: { status: "idle" | "searching" | "done" | "error"; fetched: number };
    googleScholar: { status: "idle" | "searching" | "done" | "error"; fetched: number };
  }>({
    semanticScholar: { status: "idle", fetched: 0 },
    pubmed: { status: "idle", fetched: 0 },
    googleScholar: { status: "idle", fetched: 0 },
  });
  const [currentSearchStep, setCurrentSearchStep] = useState<string>("");
  const [processingSteps, setProcessingSteps] = useState<Array<{
    step: string;
    description: string;
    query?: string;
    details?: any;
  }>>([]);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState<boolean>(false);
  const [reviewOnly, setReviewOnly] = useState<boolean>(false); // Review論文のみ検索

  // Gemini API使用状況
  const [geminiUsageStats, setGeminiUsageStats] = useState<{
    totalKeys: number;
    availableKeys: number;
    quotaExceededKeys: number;
    keyDetails: Array<{
      keyIndex: number;
      requestCount: number;
      quotaExceeded: boolean;
      lastError?: string;
    }>;
  } | null>(null);

  // IME（日本語入力）の状態を管理（検索窓用）
  const [isComposing, setIsComposing] = useState(false);
  const [compositionEndTime, setCompositionEndTime] = useState(0);

  // IME（日本語入力）の状態を管理（チャット欄用）
  const [isChatComposing, setIsChatComposing] = useState(false);
  const [chatCompositionEndTime, setChatCompositionEndTime] = useState(0);

  // 意図確認の状態管理
  const [showIntentConfirmation, setShowIntentConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [pendingUserIntent, setPendingUserIntent] = useState<any>(null);
  const [isConfirmingIntent, setIsConfirmingIntent] = useState(false);

  // 意図確認を開始する関数
  const startIntentConfirmation = async (query: string) => {
    if (!query.trim()) return;

    // チャット履歴をリセット
    setChatMessages([]);
    setChatInput("");

    setIsConfirmingIntent(true);
    setPendingSearchQuery(query);
    setCurrentSearchStep("AIが検索意図を分析中...");
    setShowIntentConfirmation(true); // すぐにAI確認窓を表示

    try {
      // 意図確認メッセージを生成（userIntentはAPI内で分析される）
      const confirmResponse = await fetch("/api/search-intent-confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query.trim(),
        }),
      });

      const confirmData = await confirmResponse.json();

      console.log("[Page] Intent confirmation response:", confirmData);
      console.log("[Page] Confirmation message:", confirmData.confirmationMessage);

      if (confirmData.requiresConfirmation) {
        const message = confirmData.confirmationMessage || `「${query}」について検索しますか？`;
        setConfirmationMessage(message);
        setChatMessages([
          {
            role: "assistant",
            content: message,
            timestamp: new Date().toISOString(),
          },
        ]);
        setCurrentSearchStep(""); // 分析完了
        // userIntentは後でrefine APIから取得する
        // setShowIntentConfirmation(true); // 既に表示されているので不要
      } else {
        // 確認不要の場合はそのまま検索実行
        setCurrentSearchStep("");
        await executeSearch(query, null);
      }
    } catch (error) {
      console.error("Intent confirmation error:", error);
      setCurrentSearchStep("");
      // エラー時はそのまま検索実行
      await executeSearch(query, null);
    } finally {
      setIsConfirmingIntent(false);
    }
  };

  // チャットでユーザーの返答を送信
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      role: "user" as const,
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    try {
      // ユーザーの返答に基づいて検索クエリを修正
      const refineResponse = await fetch("/api/search-intent-refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalQuery: pendingSearchQuery,
          userResponse: userMessage.content,
          previousIntent: pendingUserIntent,
        }),
      });

      if (!refineResponse.ok) {
        const errorData = await refineResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Intent refine API returned ${refineResponse.status}`);
      }

      const refineData = await refineResponse.json();

      // refinedQueryが空の場合は元のクエリを使用
      let finalQuery = refineData.refinedQuery?.trim() || pendingSearchQuery;

      // finalQueryが空の場合はエラー
      if (!finalQuery || finalQuery.trim().length === 0) {
        throw new Error("検索クエリが生成できませんでした。元のクエリで検索を実行します。");
      }

      if (refineData.needsFurtherConfirmation && refineData.confirmationMessage) {
        // さらに確認が必要な場合
        const assistantMessage = {
          role: "assistant" as const,
          content: refineData.confirmationMessage,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
        setPendingSearchQuery(finalQuery);
        setPendingUserIntent(refineData.newIntent);
      } else {
        // 確認が完了した場合、検索を実行
        setShowIntentConfirmation(false);
        setChatMessages([]);
        setChatInput("");
        await executeSearch(finalQuery, refineData.newIntent);
      }
    } catch (error) {
      console.error("Intent refine error:", error);
      const errorMessage = error instanceof Error ? error.message : "返答の処理に失敗しました";
      toast.error(errorMessage);

      // エラー時は元のクエリで検索を実行
      setShowIntentConfirmation(false);
      setChatMessages([]);
      setChatInput("");
      await executeSearch(pendingSearchQuery, pendingUserIntent);
    }
  };

  // 確認をスキップして検索を実行
  const skipConfirmation = async () => {
    setShowIntentConfirmation(false);
    setChatMessages([]);
    setChatInput("");
    await executeSearch(pendingSearchQuery, pendingUserIntent);
  };

  // handleSearch関数を追加（検索ボタンやEnterキーから呼ばれる）
  const handleSearch = async (
    query: string = searchQuery,
    sourcesList: string[] = sources
  ) => {
    if (!query.trim()) return;

    // 意図確認が有効な場合のみ意図確認を開始、そうでなければ直接検索
    if (enableIntentConfirmation) {
      await startIntentConfirmation(query);
    } else {
      await executeSearch(query);
    }
  };

  // 実際の検索を実行する関数
  const executeSearch = async (query: string, userIntent?: any, selectedSources: string[] = sources) => {
    // クエリが空の場合はエラー
    if (!query || !query.trim()) {
      toast.error("検索クエリが空です");
      setLoading(false);
      return;
    }

    if (selectedSources.length === 0) {
      toast.error("検索対象を1つ以上選択してください。");
      return;
    }

    setLoading(true);
    setCurrentSearchStep("クエリを翻訳中...");
    // 検索開始時に進捗をリセット
    setSearchProgress({
      semanticScholar: { status: "idle", fetched: 0 },
      pubmed: { status: "idle", fetched: 0 },
      googleScholar: { status: "idle", fetched: 0 },
    });
    // 処理ステップをリセット
    setProcessingSteps([
      {
        step: "1",
        description: "ユーザーの検索意図を分析中",
        query: query.trim(),
      },
    ]);

    try {
      // 各ソースの検索を開始
      if (selectedSources.includes("semantic_scholar")) {
        setSearchProgress(prev => ({ ...prev, semanticScholar: { status: "searching", fetched: 0 } }));
      }
      if (selectedSources.includes("pubmed")) {
        setSearchProgress(prev => ({ ...prev, pubmed: { status: "searching", fetched: 0 } }));
      }
      if (selectedSources.includes("google_scholar")) {
        setSearchProgress(prev => ({ ...prev, googleScholar: { status: "searching", fetched: 0 } }));
      }

      setCurrentSearchStep("各データベースから論文を検索中...");

      // 高度な検索モードの場合は/api/ai-searchを使用
      const endpoint = useAdvancedSearch ? "/api/ai-search" : "/api/search-simple";
      const requestBody = useAdvancedSearch
        ? {
          topic: query.trim(),
          maxPapers: resultLimit,
          sources: selectedSources.length > 0 ? selectedSources : ["semantic_scholar", "pubmed"],
          provider: "gemini",
          reviewOnly: reviewOnly,
        }
        : {
          query: query.trim(),
          limit: resultLimit,
          sources: selectedSources.length > 0 ? selectedSources : ["semantic_scholar", "pubmed"],
          reviewOnly: reviewOnly,
        };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Search API returned ${response.status}: ${response.statusText}`;
        console.error("Search API error:", errorMessage, errorData);
        throw new Error(errorMessage);
      }

      setCurrentSearchStep("検索結果を処理中...");

      const data = await response.json();
      if (
        Array.isArray(data.papers) &&
        data.papers.length > 0 &&
        data.success !== false
      ) {
        try {
          setCurrentSearchStep("ライブラリと照合中...");
          data.papers = mergeWithLibrary(data.papers);
        } catch (mergeError) {
          console.warn("Failed to merge with library:", mergeError);
          // mergeWithLibraryが失敗しても検索結果は表示する
        }
      }
      setResults(data);
      setCurrentSearchStep("");
      // APIから返ってきた処理ステップを設定
      if ((data.searchLogic as any)?.processingSteps) {
        setProcessingSteps((data.searchLogic as any).processingSteps);
      }

      // 検索結果から進捗を更新
      if (data.sourceStats) {
        const progress: typeof searchProgress = {
          semanticScholar: { status: "idle", fetched: 0 },
          pubmed: { status: "idle", fetched: 0 },
          googleScholar: { status: "idle", fetched: 0 },
        };

        data.sourceStats.forEach((stat: any) => {
          if (stat.source === "semantic_scholar") {
            progress.semanticScholar = {
              status: stat.fetched > 0 ? "done" : "error",
              fetched: stat.fetched,
            };
          } else if (stat.source === "pubmed") {
            progress.pubmed = {
              status: stat.fetched > 0 ? "done" : "error",
              fetched: stat.fetched,
            };
          } else if (stat.source === "google_scholar") {
            progress.googleScholar = {
              status: stat.fetched > 0 ? "done" : "error",
              fetched: stat.fetched,
            };
          }
        });

        setSearchProgress(progress);
      }

      if (data.success && data.papers?.length > 0) {
        toast.success(`${data.papers.length}件の論文を発見しました`);
      } else if (data.error) {
        toast.error(data.error);
      } else {
        toast("検索結果が見つかりませんでした");
      }
    } catch (error) {
      console.error("Search error:", error);
      const errorMessage = error instanceof Error ? error.message : "検索中にエラーが発生しました";
      toast.error(errorMessage);
      setResults({
        papers: [],
        total: 0,
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // URLパラメータから初期値を設定
  useEffect(() => {
    const query = searchParams.get("q");
    const sourcesParam = searchParams.get("sources");

    if (query) {
      setSearchQuery(query);
      const selectedSources = sourcesParam ? sourcesParam.split(",") : ["semantic_scholar", "pubmed"];
      setSources(selectedSources);
      handleSearch(query, selectedSources);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ライブラリの論文を取得
  useEffect(() => {
    const fetchLibrary = async () => {
      if (authLoading || !user?.id) return;

      try {
        const response = await fetch(`/api/library?userId=${user.id}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setLibraryPapers(
            (data.papers || []).map((paper: any) => ({
              id: paper.paper_id || paper.paperId || paper.id,
              paperId: paper.paper_id || paper.paperId || paper.id,
              title: paper.title,
              authors: paper.authors,
              year: paper.year,
              abstract: paper.abstract,
              url: paper.url,
              citationCount: paper.citation_count ?? paper.citationCount ?? 0,
              venue: paper.venue,
              source: "library",
            }))
          );
        }
      } catch (error) {
        console.warn("Failed to load library for search merge", error);
      }
    };

    fetchLibrary();
  }, []);

  const mergeWithLibrary = (papers: Paper[]): Paper[] => {
    if (libraryPapers.length === 0) return papers;

    const libraryById = new Map<string, Paper>(
      libraryPapers.map((paper) => [paper.paperId, paper])
    );

    return papers.map((paper) => {
      const saved = libraryById.get(paper.paperId);
      if (!saved) return paper;
      return {
        ...paper,
        savedInLibrary: true,
      } as Paper & { savedInLibrary: boolean };
    });
  };

  const handleSavePaper = async (paper: Paper) => {
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          paper: {
            id: (paper as any).id || paper.paperId,
            paperId: paper.paperId,
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            abstract: paper.abstract,
            url: paper.url,
            citationCount: paper.citationCount,
            venue: paper.venue,
          },
        }),
      });

      if (response.ok) {
        toast.success("論文をライブラリに保存しました");
        setResults((prevResults) => ({
          ...prevResults,
          papers: prevResults.papers.map((p) =>
            p.paperId === paper.paperId ? { ...p, savedInLibrary: true } : p
          ),
        }));
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data?.error || "保存に失敗しました");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("保存中にエラーが発生しました");
    }
  };

  const toggleSource = (key: string) => {
    setSources((prev) => {
      const newSources = prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key];
      // 最低1つは選択されている必要がある
      if (newSources.length === 0) {
        toast.error("最低1つの検索ソースを選択してください");
        return prev; // 変更をキャンセル
      }
      return newSources;
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <section className="mb-6">
          <div className="flex items-end justify-center gap-3">
            {/* 中央の陰影アイコン */}
            <div className="flex-shrink-0" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))', opacity: 0.15 }}>
              <svg width="80" height="80" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" fill="none" className="text-[var(--color-text)]" />
                <path d="M12 10C12 10 14 9 16 9C18 9 20 10 20 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]" />
                <path d="M12 10Q12 13 12 16Q12 19 12 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]" />
                <path d="M20 10Q20 13 20 16Q20 19 20 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]" />
                <path d="M12 14Q16 13 20 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]" />
                <path d="M12 18Q16 17 20 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]" />
              </svg>
            </div>
            {/* バージョン表示 */}
            <span className="text-sm text-[var(--color-text-secondary)] font-medium">
              {getVersionString()}
            </span>
          </div>
        </section>

        <Card className="mb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
              <Search className="h-5 w-5 text-[var(--color-text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                // IME入力開始時
                onCompositionStart={() => setIsComposing(true)}
                // IME確定時
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  // 確定時刻を記録（macOSでの確定Enterキー検知用）
                  setCompositionEndTime(Date.now());
                }}
                // 入力時は検索クエリの状態を更新するだけ（検索は開始しない）
                onChange={(e) => setSearchQuery(e.target.value)}
                // Enterキーで検索を開始（IME入力中または確定直後は実行しない）
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // IME入力中でない、かつ確定から100ms以上経過している場合のみ検索
                    const timeSinceCompositionEnd = Date.now() - compositionEndTime;
                    if (!isComposing && timeSinceCompositionEnd > 100) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }
                }}
                placeholder="論文を検索..."
                className="flex-1 border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-secondary)]"
              />
              {/* 検索ボタンクリックで検索を開始 */}
              <Button
                onClick={() => handleSearch()}
                size="sm"
                disabled={loading}
              >
                {loading ? "検索中..." : "検索する"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card variant="outlined" padding="sm">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">検索対象</p>
                <div className="flex items-center gap-2">
                  {SOURCE_OPTIONS.map((item) => (
                    <Button
                      key={item.key}
                      onClick={() => toggleSource(item.key)}
                      variant={sources.includes(item.key) ? "primary" : "ghost"}
                      size="sm"
                      className="flex-1"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </Card>

              <Card variant="outlined" padding="sm">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">表示件数</p>
                <div className="flex items-center gap-2">
                  {[10, 20, 50, 100].map((limit) => (
                    <Button
                      key={limit}
                      onClick={() => setResultLimit(limit)}
                      variant={resultLimit === limit ? "primary" : "ghost"}
                      size="sm"
                      className="flex-1"
                    >
                      {limit}
                    </Button>
                  ))}
                </div>
              </Card>

              <Card variant="outlined" padding="sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                        AI意図確認
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        検索前に意図を確認
                      </p>
                    </div>
                    {/* トグルスイッチ */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enableIntentConfirmation}
                      onClick={() => setEnableIntentConfirmation(!enableIntentConfirmation)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${enableIntentConfirmation
                        ? "bg-[var(--color-primary)]"
                        : "bg-[var(--color-border)]"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${enableIntentConfirmation ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                    <input
                      type="checkbox"
                      id="review-only"
                      checked={reviewOnly}
                      onChange={(e) => setReviewOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <label
                      htmlFor="review-only"
                      className="text-xs text-[var(--color-text)] cursor-pointer"
                    >
                      Review論文のみ
                    </label>
                  </div>
                </div>
              </Card>

              <Card variant="outlined" padding="sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                        高度な検索モード
                      </p>
                      <div className="group relative">
                        <HelpCircle className="h-3.5 w-3.5 text-[var(--color-text-secondary)] cursor-help" />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-xs text-[var(--color-text)]">
                          <div className="space-y-2">
                            <p className="font-semibold mb-3 text-[var(--color-text)]">高度な検索モードの処理フロー：</p>
                            <div className="space-y-2">
                              {/* ステップ1 */}
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                                  1
                                </div>
                                <div className="flex-1">
                                  <p className="text-[var(--color-text)] font-medium">検索プラン生成</p>
                                  <p className="text-[var(--color-text-secondary)] text-[10px]">検索戦略を自動生成</p>
                                </div>
                              </div>
                              {/* 矢印 */}
                              <div className="flex items-center justify-center py-0.5">
                                <ChevronDown className="h-3 w-3 text-[var(--color-text-secondary)]" />
                              </div>
                              {/* ステップ2 */}
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                                  2
                                </div>
                                <div className="flex-1">
                                  <p className="text-[var(--color-text)] font-medium">多層検索</p>
                                  <p className="text-[var(--color-text-secondary)] text-[10px]">キーワードを段階的に緩和して検索</p>
                                </div>
                              </div>
                              {/* 矢印 */}
                              <div className="flex items-center justify-center py-0.5">
                                <ChevronDown className="h-3 w-3 text-[var(--color-text-secondary)]" />
                              </div>
                              {/* ステップ3 */}
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                                  3
                                </div>
                                <div className="flex-1">
                                  <p className="text-[var(--color-text)] font-medium">複数ソース検索</p>
                                  <p className="text-[var(--color-text-secondary)] text-[10px]">Semantic ScholarとPubMedの両方で検索</p>
                                </div>
                              </div>
                              {/* 矢印 */}
                              <div className="flex items-center justify-center py-0.5">
                                <ChevronDown className="h-3 w-3 text-[var(--color-text-secondary)]" />
                              </div>
                              {/* ステップ4 */}
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                                  4
                                </div>
                                <div className="flex-1 group relative">
                                  <div className="flex items-center gap-1 cursor-help">
                                    <p className="text-[var(--color-text)] font-medium">AIランキング</p>
                                    <HelpCircle className="h-3 w-3 text-[var(--color-text-secondary)]" />
                                  </div>
                                  <p className="text-[var(--color-text-secondary)] text-[10px]">Gemini APIで関連度順に並び替え</p>

                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl p-3 text-xs leading-relaxed">
                                      <div className="font-semibold text-[var(--color-text)] mb-2 border-b border-[var(--color-border)] pb-1">
                                        検索モードの違い
                                      </div>
                                      <div className="space-y-2">
                                        <div>
                                          <div className="font-medium text-[var(--color-text-secondary)]">OFF: 通常検索</div>
                                          <div className="text-[var(--color-text)] opacity-80">キーワード一致重視。特定の論文を探す時や、高速に検索したい時に適しています。</div>
                                        </div>
                                        <div>
                                          <div className="font-medium text-[var(--color-primary)]">ON: AI検索</div>
                                          <div className="text-[var(--color-text)] opacity-80">検索意図重視。複雑な疑問や、文脈に関連する論文を探したい時に推奨です。</div>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Tooltip Arrow */}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 h-2 w-4 overflow-hidden">
                                      <div className="w-2 h-2 bg-[var(--color-surface)] border-r border-b border-[var(--color-border)] transform rotate-45 mx-auto -mt-1 shadow-xl"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          多層検索・AIランキング
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* トグルスイッチ */}

                  <button
                    type="button"
                    role="switch"
                    aria-checked={useAdvancedSearch}
                    onClick={() => setUseAdvancedSearch(!useAdvancedSearch)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${useAdvancedSearch
                      ? "bg-[var(--color-primary)]"
                      : "bg-[var(--color-border)]"
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${useAdvancedSearch ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>
              </Card>
            </div>

            {!loading && (
              <Card variant="filled" padding="sm">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <Upload className="h-4 w-4" />
                  <span>
                    PDF
                    やメモを直接検索対象に加えたい場合は、ライブラリからアップロードしてください。
                  </span>
                </div>
              </Card>
            )}
          </div>
        </Card>






        {/* 意図確認チャットUI */}
        {showIntentConfirmation && (
          <Card className="mb-10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">
                    検索の意図を確認
                  </h3>
                  {isConfirmingIntent && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="h-2 w-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="h-2 w-2 rounded-full bg-[var(--color-primary)] animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                      <span>AIが考えています...</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={skipConfirmation}
                  variant="ghost"
                  size="sm"
                >
                  スキップして検索
                </Button>
              </div>

              {/* チャット履歴 */}
              <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] p-4 max-h-96 overflow-y-auto space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === "user"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]"
                        }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
                {isConfirmingIntent && (
                  <div className="flex justify-start">
                    <div className="bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg px-4 py-2">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        確認メッセージを生成中...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* チャット入力 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  // IME入力開始時
                  onCompositionStart={() => setIsChatComposing(true)}
                  // IME確定時
                  onCompositionEnd={(e) => {
                    setIsChatComposing(false);
                    // 確定時刻を記録（macOSでの確定Enterキー検知用）
                    setChatCompositionEndTime(Date.now());
                  }}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // IME入力中でない、かつ確定から100ms以上経過している場合のみ送信
                      const timeSinceCompositionEnd = Date.now() - chatCompositionEndTime;
                      if (!isChatComposing && timeSinceCompositionEnd > 100) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }
                  }}
                  placeholder="返答を入力してください（例: はい、その通りです / いえ、違います。特に○○について知りたいです）"
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)]"
                  disabled={isConfirmingIntent}
                />
                <Button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || isConfirmingIntent}
                  size="sm"
                >
                  送信
                </Button>
              </div>
            </div>
          </Card>
        )}


        {/* 検索条件と処理ステップ（検索中でも表示） */}
        {(loading || results.searchLogic || results.papers.length > 0 || results.total > 0) && searchQuery && (
          <Card className="mb-10">
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--color-text)]">
                  {results.papers.length > 0
                    ? `検索結果 (${results.papers.length}件 / 全${results.total}件)`
                    : "検索条件"}
                </h3>
              </div>

              {/* 検索条件の折りたたみ表示 */}
              <div className="border-t border-[var(--color-border)] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">検索条件</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {searchQuery} | {resultLimit}件
                    </span>
                  </div>
                  <button
                    onClick={() => setShowSearchDetails(!showSearchDetails)}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
                  >
                    {showSearchDetails ? (
                      <>
                        <span>詳細を非表示</span>
                        <ChevronDown className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        <span>詳細を表示</span>
                        <ChevronRight className="h-3 w-3" />
                      </>
                    )}
                  </button>
                </div>

                {showSearchDetails && (
                  <div className="mt-3 pl-4 border-l-2 border-[var(--color-border)] space-y-3 text-sm">
                    {/* Gemini API使用状況 */}
                    {geminiUsageStats && (
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[var(--color-text)]">
                            Gemini API使用状況
                          </span>
                          <span className={`text-xs font-semibold ${geminiUsageStats.availableKeys === 0
                            ? "text-red-500"
                            : geminiUsageStats.quotaExceededKeys > 0
                              ? "text-yellow-500"
                              : "text-green-500"
                            }`}>
                            {geminiUsageStats.availableKeys}/{geminiUsageStats.totalKeys}キー利用可能
                          </span>
                        </div>
                        <div className="space-y-1">
                          {geminiUsageStats.keyDetails.map((key) => (
                            <div
                              key={key.keyIndex}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-[var(--color-text-secondary)]">
                                キー{key.keyIndex}:
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`${key.quotaExceeded
                                  ? "text-red-500"
                                  : "text-green-500"
                                  }`}>
                                  {key.quotaExceeded ? "制限超過" : "利用可能"}
                                </span>
                                <span className="text-[var(--color-text-secondary)]">
                                  ({key.requestCount}回)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {geminiUsageStats.quotaExceededKeys === geminiUsageStats.totalKeys && (
                          <div className="mt-2 text-xs text-red-500">
                            全てのキーが1日のクォータ制限（20リクエスト）に達しています。24時間後に自動的にリセットされます。
                          </div>
                        )}
                      </div>
                    )}

                    {/* 基本設定 */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                        基本設定
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">検索クエリ:</span>
                        <span className="text-[var(--color-text)]">{searchQuery || "-"}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">検索対象:</span>
                        <span className="text-[var(--color-text)]">
                          {sources.length > 0
                            ? sources
                              .map((s) => SOURCE_OPTIONS.find((opt) => opt.key === s)?.label || s)
                              .join(", ")
                            : "-"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">表示件数:</span>
                        <span className="text-[var(--color-text)]">{resultLimit}件</span>
                      </div>
                    </div>

                    {/* クエリ処理の途中経過 */}
                    {(processingSteps.length > 0 || (results.searchLogic as any)?.processingSteps) && (
                      <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                          クエリ処理の途中経過
                        </div>
                        <div className="space-y-2">
                          {(processingSteps.length > 0 ? processingSteps : (results.searchLogic as any)?.processingSteps || []).map((step: any, index: number) => {
                            // 処理中かどうかを判定（「中」で終わる、または最後のステップでloading中）
                            const isProcessing = step.description.includes("中") &&
                              (step.description.endsWith("中") || step.description.endsWith("中...")) &&
                              (loading || index === (processingSteps.length > 0 ? processingSteps : (results.searchLogic as any)?.processingSteps || []).length - 1);

                            return (
                              <div key={index} className="flex items-start gap-3 text-xs">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                                  {step.step}
                                </div>
                                <div className="flex-1 space-y-1">
                                  <div className="text-[var(--color-text)] font-medium flex items-center gap-1">
                                    <span>{step.description.replace(/\.\.\.$/, "")}</span>
                                    {isProcessing && (
                                      <span className="inline-flex gap-0.5">
                                        <span className="animate-[dots_1.4s_infinite]">.</span>
                                        <span className="animate-[dots_1.4s_infinite_0.2s]">.</span>
                                        <span className="animate-[dots_1.4s_infinite_0.4s]">.</span>
                                      </span>
                                    )}
                                  </div>
                                  {step.query && (
                                    <div className="text-[var(--color-text-secondary)] font-mono bg-[var(--color-background)] px-2 py-1 rounded break-words">
                                      {step.query}
                                    </div>
                                  )}
                                  {step.details && (
                                    <div className="text-[var(--color-text-secondary)] space-y-1 pl-2 border-l-2 border-[var(--color-border)]">
                                      {step.details.mainConcepts && (
                                        <div>
                                          <span className="font-medium">主要概念: </span>
                                          <span>{step.details.mainConcepts.join(", ")}</span>
                                        </div>
                                      )}
                                      {step.details.compoundTerms && step.details.compoundTerms.length > 0 && (
                                        <div>
                                          <span className="font-medium">複合語: </span>
                                          <span>{step.details.compoundTerms.join(", ")}</span>
                                        </div>
                                      )}
                                      {step.details.searchPurpose && (
                                        <div>
                                          <span className="font-medium">検索目的: </span>
                                          <span>{step.details.searchPurpose}</span>
                                        </div>
                                      )}
                                      {step.details.keyPhrases && step.details.keyPhrases.length > 0 && (
                                        <div>
                                          <span className="font-medium">重要フレーズ: </span>
                                          <span className="font-mono">{step.details.keyPhrases.map((p: string) => `"${p}"`).join(", ")}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 実際に使用された検索ロジック */}
                    {results.searchLogic && (
                      <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                          最終的な検索クエリ
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">元のクエリ:</span>
                          <span className="text-[var(--color-text)] font-mono text-xs break-words">{results.searchLogic.originalQuery}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">翻訳後クエリ:</span>
                          <span className="text-[var(--color-text)] font-mono text-xs break-words">{results.searchLogic.translatedQuery}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">翻訳方法:</span>
                          <span className="text-[var(--color-text)]">
                            {results.searchLogic.translationMethod === "gemini"
                              ? "Gemini API（AI翻訳）"
                              : results.searchLogic.translationMethod === "fallback"
                                ? "フォールバック（辞書ベース）"
                                : "翻訳なし（英語またはその他）"}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">検索ソース:</span>
                          <span className="text-[var(--color-text)]">
                            {results.searchLogic.searchedSources
                              .map((s) => {
                                if (s === "semantic_scholar") return "Semantic Scholar";
                                if (s === "pubmed") return "PubMed";
                                if (s === "google_scholar") return "Google Scholar";
                                return s;
                              })
                              .join(", ")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            <div className="space-y-4">
              {results.papers.map((paper, index) => {
                const isSaved = Boolean(paper.savedInLibrary);
                // 一意なキーを生成（paperId、id、source、インデックスを組み合わせ）
                const uniqueKey = `${paper.paperId || paper.id || `paper-${index}`}-${paper.source || 'unknown'}-${index}`;
                return (
                  <div
                    key={uniqueKey}
                    className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-md"
                  >
                    {/* 右上の保存済みラベルとソースラベル */}
                    <div className="absolute top-0 right-0 z-10 flex items-center gap-2 p-2">
                      {paper.source && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ${paper.source === "semantic_scholar"
                          ? "bg-blue-600"
                          : paper.source === "pubmed"
                            ? "bg-green-600"
                            : paper.source === "google_scholar"
                              ? "bg-orange-600"
                              : "bg-gray-600"
                          }`}>
                          {paper.source === "semantic_scholar" ? "Semantic Scholar" :
                            paper.source === "pubmed" ? "PubMed" :
                              paper.source === "google_scholar" ? "Google Scholar" :
                                paper.source}
                        </span>
                      )}
                      {isSaved && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-success)] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                          <BookOpen className="h-2.5 w-2.5" />
                          保存済み
                        </span>
                      )}
                    </div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-[var(--color-text)] mb-2 pr-24">
                          {paper.title}
                        </h4>
                        <div className="flex items-center flex-wrap gap-3 text-xs text-[var(--color-text-secondary)] mb-2">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{paper.authors}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{paper.year}</span>
                          </div>
                          {paper.venue && (
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              <span>{paper.venue}</span>
                            </div>
                          )}
                          {paper.citationCount !== undefined && paper.citationCount > 0 && (
                            <span>引用数: {paper.citationCount}</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
                          {paper.abstract}
                        </p>
                        <div className="flex items-center flex-wrap gap-3">
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>論文を読む</span>
                          </a>
                          {isSaved ? (
                            <Link
                              href={`/library?paperId=${paper.paperId}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-success)] hover:opacity-80"
                            >
                              <BookOpen className="h-3 w-3" />
                              <span>ライブラリで表示</span>
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleSavePaper(paper)}
                              className="inline-flex items-center gap-1 text-xs text-[var(--color-success)] hover:opacity-80"
                            >
                              <Save className="h-3 w-3" />
                              <span>保存</span>
                            </button>
                          )}
                          {paper.doi && (
                            <Link
                              href={`/tools/citation-map?doi=${encodeURIComponent(paper.doi)}`}
                              className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:opacity-80"
                            >
                              <Network className="h-3 w-3" />
                              <span>Citation Map</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {!loading && results.papers.length === 0 && results.error && (
          <Card className="mb-10">
            <div className="text-center py-12">
              <div className="text-[var(--color-error)] mb-4">
                <Search className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg font-semibold">検索エラー</p>
              </div>
              <p className="text-[var(--color-text-secondary)] mb-4">{results.error}</p>
              {results.retryAfter && (
                <p className="text-sm text-[var(--color-primary)]">
                  {results.retryAfter}秒後に再試行することをお勧めします
                </p>
              )}
            </div>
          </Card>
        )}

        {!loading &&
          results.papers.length === 0 &&
          !results.error &&
          searchQuery &&
          results.searchLogic && (
            <Card className="mb-10">
              <div className="mb-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">
                    検索結果が見つかりませんでした
                  </h3>
                </div>

                {/* 検索条件の折りたたみ表示 */}
                <div className="border-t border-[var(--color-border)] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text)]">検索条件</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {searchQuery} | {resultLimit}件
                      </span>
                    </div>
                    <button
                      onClick={() => setShowSearchDetails(!showSearchDetails)}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
                    >
                      {showSearchDetails ? (
                        <>
                          <span>詳細を非表示</span>
                          <ChevronDown className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          <span>詳細を表示</span>
                          <ChevronRight className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  </div>

                  {showSearchDetails && (
                    <div className="mt-3 pl-4 border-l-2 border-[var(--color-border)] space-y-3 text-sm">
                      {/* 基本設定 */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                          基本設定
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">検索クエリ:</span>
                          <span className="text-[var(--color-text)]">{searchQuery || "-"}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">検索対象:</span>
                          <span className="text-[var(--color-text)]">
                            {sources.length > 0
                              ? sources
                                .map((s) => SOURCE_OPTIONS.find((opt) => opt.key === s)?.label || s)
                                .join(", ")
                              : "-"}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">表示件数:</span>
                          <span className="text-[var(--color-text)]">{resultLimit}件</span>
                        </div>
                      </div>

                      {/* クエリ処理の途中経過 */}
                      {(results.searchLogic as any)?.processingSteps && (results.searchLogic as any).processingSteps.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                            クエリ処理の途中経過
                          </div>
                          <div className="space-y-2">
                            {(results.searchLogic as any).processingSteps.map((step: any, index: number) => {
                              // 処理中かどうかを判定（「中」で終わる、または最後のステップでloading中）
                              const isProcessing = step.description.includes("中") &&
                                (step.description.endsWith("中") || step.description.endsWith("中...")) &&
                                (loading || index === (results.searchLogic as any).processingSteps.length - 1);

                              return (
                                <div key={index} className="flex items-start gap-3 text-xs">
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                                    {step.step}
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="text-[var(--color-text)] font-medium flex items-center gap-1">
                                      <span>{step.description.replace(/\.\.\.$/, "")}</span>
                                      {isProcessing && (
                                        <span className="inline-flex gap-0.5">
                                          <span className="animate-[dots_1.4s_infinite]">.</span>
                                          <span className="animate-[dots_1.4s_infinite_0.2s]">.</span>
                                          <span className="animate-[dots_1.4s_infinite_0.4s]">.</span>
                                        </span>
                                      )}
                                    </div>
                                    {step.query && (
                                      <div className="text-[var(--color-text-secondary)] font-mono bg-[var(--color-background)] px-2 py-1 rounded break-words">
                                        {step.query}
                                      </div>
                                    )}
                                    {step.details && (
                                      <div className="text-[var(--color-text-secondary)] space-y-1 pl-2 border-l-2 border-[var(--color-border)]">
                                        {step.details.mainConcepts && (
                                          <div>
                                            <span className="font-medium">主要概念: </span>
                                            <span>{step.details.mainConcepts.join(", ")}</span>
                                          </div>
                                        )}
                                        {step.details.compoundTerms && step.details.compoundTerms.length > 0 && (
                                          <div>
                                            <span className="font-medium">複合語: </span>
                                            <span>{step.details.compoundTerms.join(", ")}</span>
                                          </div>
                                        )}
                                        {step.details.searchPurpose && (
                                          <div>
                                            <span className="font-medium">検索目的: </span>
                                            <span>{step.details.searchPurpose}</span>
                                          </div>
                                        )}
                                        {step.details.keyPhrases && step.details.keyPhrases.length > 0 && (
                                          <div>
                                            <span className="font-medium">重要フレーズ: </span>
                                            <span className="font-mono">{step.details.keyPhrases.map((p: string) => `"${p}"`).join(", ")}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 実際に使用された検索ロジック */}
                      {results.searchLogic && (
                        <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                            最終的な検索クエリ
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">元のクエリ:</span>
                            <span className="text-[var(--color-text)] font-mono text-xs break-words">{results.searchLogic.originalQuery}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">翻訳後クエリ:</span>
                            <span className="text-[var(--color-text)] font-mono text-xs break-words">{results.searchLogic.translatedQuery}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">翻訳方法:</span>
                            <span className="text-[var(--color-text)]">
                              {results.searchLogic.translationMethod === "gemini"
                                ? "Gemini API（AI翻訳）"
                                : results.searchLogic.translationMethod === "fallback"
                                  ? "フォールバック（辞書ベース）"
                                  : "翻訳なし（英語またはその他）"}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">検索ソース:</span>
                            <span className="text-[var(--color-text)]">
                              {results.searchLogic.searchedSources
                                .map((s) => {
                                  if (s === "semantic_scholar") return "Semantic Scholar";
                                  if (s === "pubmed") return "PubMed";
                                  if (s === "google_scholar") return "Google Scholar";
                                  return s;
                                })
                                .join(", ")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center py-12">
                <div className="text-[var(--color-text-secondary)] mb-4">
                  <Search className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-semibold">
                    検索結果が見つかりませんでした
                  </p>
                </div>
                <p className="text-[var(--color-text-secondary)] mb-4">
                  別のキーワードで検索してみてください
                </p>
              </div>
            </Card>
          )}

        {/* 機能とツールを統合 */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            機能・ツール
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ALL_FEATURES.map(
              ({ href, icon: Icon, title, description }) => (
                <Link key={href} href={href}>
                  <Card
                    hover
                    padding="md"
                    icon={Icon}
                    title={title}
                    subtitle={description}
                  />
                </Link>
              )
            )}
          </div>
        </section>

        <section className="mt-10">
          <Card
            title="ワークフローの可視化"
          >
            <div className="mt-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
              <Card variant="filled" padding="sm">
                <div className="flex items-start gap-3">
                  <Search className="mt-1 h-4 w-4 text-[var(--color-primary)]" />
                  <p>
                    <span className="font-semibold text-[var(--color-text)]">
                      ステップ 1:
                    </span>
                    AI 検索で関連論文を発見し、必要に応じて Pro
                    モードで引用ネットワークを追跡。
                  </p>
                </div>
              </Card>
              <Card variant="filled" padding="sm">
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-1 h-4 w-4 text-[var(--color-primary)]" />
                  <p>
                    <span className="font-semibold text-[var(--color-text)]">
                      ステップ 2:
                    </span>
                    気になる論文をライブラリに保存し、PDF プレビューや AI
                    解説で理解を深めます。
                  </p>
                </div>
              </Card>
              <Card variant="filled" padding="sm">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-4 w-4 text-[var(--color-primary)]" />
                  <p>
                    <span className="font-semibold text-[var(--color-text)]">
                      ステップ 3:
                    </span>
                    レビュー生成ツールで落合方式のまとめを出力し、研究ギャップ分析に繋げましょう。
                  </p>
                </div>
              </Card>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-[var(--color-text-secondary)]">
          <span>© {new Date().getFullYear()} AnswerThis Research Platform</span>
          <div className="flex items-center gap-3">
            <Link href="/tools" className="hover:text-[var(--color-text)] transition-colors">
              ツール一覧
            </Link>
            <Link href="/library" className="hover:text-[var(--color-text)] transition-colors">
              ライブラリ
            </Link>
            <Link href="/review" className="hover:text-[var(--color-text)] transition-colors">
              レビュー作成
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-secondary)]">読み込み中...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
