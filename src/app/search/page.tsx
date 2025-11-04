"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  BookOpen,
  Calendar,
  User,
  ExternalLink,
  Save,
  Share2,
  Filter,
  ArrowLeft,
  FileText,
  Network,
  Home,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

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
}

interface SearchResult {
  papers: Paper[];
  total: number;
  error?: string;
  retryAfter?: number;
  searchMethod?: string;
  success?: boolean;
  message?: string;
}

const DEMO_USER_ID = "demo-user-123";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<
    "auto" | "literature" | "deep-dive"
  >("auto");
  const [searchMode, setSearchMode] = useState<"lite" | "pro">("lite");
  const [sources, setSources] = useState<string[]>(["papers"]);
  const [results, setResults] = useState<SearchResult>({
    papers: [],
    total: 0,
  });
  const [libraryPapers, setLibraryPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = searchParams.get("q");
    const type = searchParams.get("type") as
      | "auto"
      | "literature"
      | "deep-dive";
    const mode = searchParams.get("mode") as "lite" | "pro";
    const sourcesParam = searchParams.get("sources");

    if (query) {
      setSearchQuery(query);
      setSearchType(type || "auto");
      setSearchMode(mode || "lite");
      setSources(sourcesParam ? sourcesParam.split(",") : ["papers"]);
      handleSearch(
        query,
        type || "auto",
        mode || "lite",
        sourcesParam ? sourcesParam.split(",") : ["papers"]
      );
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const response = await fetch(`/api/library?userId=${DEMO_USER_ID}`);
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

  const handleSearch = async (
    query: string,
    type: string = searchType,
    mode: string = searchMode,
    sourcesList: string[] = sources
  ) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/search-simple", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
          limit: 20,
        }),
      });

      const data = await response.json();
      if (
        Array.isArray(data.papers) &&
        data.papers.length > 0 &&
        data.success !== false
      ) {
        data.papers = mergeWithLibrary(data.papers);
      }
      setResults(data);

      if (data.success && data.papers?.length > 0) {
        toast.success(`${data.papers.length}件の論文を発見しました`);
      } else if (data.error) {
        toast.error(data.error);
      } else {
        toast("検索結果が見つかりませんでした");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("検索中にエラーが発生しました");
      setResults({
        papers: [],
        total: 0,
        error: "検索中にエラーが発生しました",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaper = async (paper: Paper) => {
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "demo-user-123",
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

        // 検索結果の状態を更新して、保存済みフラグを追加
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

  return (
    <div className="h-screen bg-slate-100 text-slate-800 overflow-hidden">
      <header
        className="fixed top-0 left-0 right-0 z-[99999] border-b border-slate-200 bg-white shadow-sm"
        style={{ zIndex: 99999 }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-slate-900">
              論文検索
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <Home className="h-4 w-4" />
              <span>ホーム</span>
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <BookOpen className="h-4 w-4" />
              <span>ライブラリ</span>
            </Link>
            <Link
              href="/tools/citation-map"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <Network className="h-4 w-4" />
              <span>Citation Map</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8 pt-24 h-full overflow-y-auto">
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-center mb-6">
              <p className="text-slate-600">
                研究トピックを入力して、関連する論文を検索してください
              </p>
            </div>

            {/* Search Input */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="研究トピックを入力してください"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-5 py-4 text-base text-slate-800 shadow-inner focus:border-slate-500 focus:outline-none"
                  onKeyPress={(e) =>
                    e.key === "Enter" && handleSearch(searchQuery)
                  }
                />
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  検索
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col bg-white border border-gray-100 rounded-xl p-4">
                <span className="text-sm font-semibold text-gray-700 mb-2">
                  検索タイプ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSearchType("auto")}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      searchType === "auto"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    自動
                  </button>
                  <button
                    onClick={() => setSearchType("literature")}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      searchType === "literature"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    レビュー
                  </button>
                  <button
                    onClick={() => setSearchType("deep-dive")}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      searchType === "deep-dive"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    深掘り
                  </button>
                </div>
              </div>

              <div className="flex flex-col bg-white border border-gray-100 rounded-xl p-4">
                <span className="text-sm font-semibold text-gray-700 mb-2">
                  検索モード
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSearchMode("lite")}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      searchMode === "lite"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Lite
                  </button>
                  <button
                    onClick={() => setSearchMode("pro")}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      searchMode === "pro"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Pro
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Search Results */}
          {loading && (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">検索中...</p>
            </div>
          )}

          {!loading && results.papers.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  検索結果 ({results.papers.length}件)
                </h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>検索方法: {results.searchMethod || "AI検索"}</span>
                </div>
              </div>

              <div className="space-y-6">
                {results.papers.map((paper) => {
                  const isSaved = Boolean((paper as any).savedInLibrary);
                  return (
                    <div
                      key={paper.paperId}
                      className={`rounded-lg border ${
                        isSaved
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200"
                      } p-6 transition-shadow hover:shadow-md ${
                        isSaved ? "cursor-pointer" : ""
                      }`}
                      onClick={() => {
                        if (isSaved) {
                          // ライブラリ詳細画面に遷移
                          window.location.href = `/library?paperId=${paper.paperId}`;
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            {paper.title}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                            <div className="flex items-center space-x-1">
                              <User className="h-4 w-4" />
                              <span>{paper.authors}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>{paper.year}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <BookOpen className="h-4 w-4" />
                              <span>{paper.venue}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span>引用数: {paper.citationCount}</span>
                            </div>
                            {isSaved && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                保存済み - クリックで詳細表示
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700 mb-4 line-clamp-3">
                            {paper.abstract}
                          </p>
                          <div className="flex items-center space-x-4">
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-4 w-4" />
                              <span>論文を読む</span>
                            </a>
                            {isSaved ? (
                              <Link
                                href={`/library?paperId=${paper.paperId}`}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                              >
                                <BookOpen className="h-4 w-4" />
                                <span>ライブラリで表示</span>
                              </Link>
                            ) : (
                              <button
                                onClick={() => handleSavePaper(paper)}
                                className="flex items-center space-x-1 text-green-600 hover:text-green-800"
                              >
                                <Save className="h-4 w-4" />
                                <span>保存</span>
                              </button>
                            )}
                            <button className="flex items-center space-x-1 text-gray-600 hover:text-gray-800">
                              <Share2 className="h-4 w-4" />
                              <span>共有</span>
                            </button>
                            {paper.doi && (
                              <Link
                                href={`/tools/citation-map?doi=${encodeURIComponent(
                                  paper.doi
                                )}`}
                                className="flex items-center space-x-1 text-purple-600 hover:text-purple-800"
                              >
                                <Network className="h-4 w-4" />
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
            </div>
          )}

          {!loading && results.papers.length === 0 && results.error && (
            <div className="card text-center py-12">
              <div className="text-red-500 mb-4">
                <Search className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg font-semibold">検索エラー</p>
              </div>
              <p className="text-gray-600 mb-4">{results.error}</p>
              {results.retryAfter && (
                <p className="text-sm text-blue-600">
                  {results.retryAfter}秒後に再試行することをお勧めします
                </p>
              )}
            </div>
          )}

          {!loading &&
            results.papers.length === 0 &&
            !results.error &&
            searchQuery && (
              <div className="card text-center py-12">
                <div className="text-gray-500 mb-4">
                  <Search className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-semibold">
                    検索結果が見つかりませんでした
                  </p>
                </div>
                <p className="text-gray-600 mb-4">
                  別のキーワードで検索してみてください
                </p>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center">読み込み中...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
