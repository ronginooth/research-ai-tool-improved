"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Home,
  Search,
  BookOpen,
  Network,
  Filter,
  X,
  LayoutGrid,
  List,
  Columns,
  Tag,
  Plus,
} from "lucide-react";
import PaperDetailPanel from "@/components/library/PaperDetailPanel";
import TagManager from "@/components/library/TagManager";
import ResizableTable from "@/components/library/ResizableTable";
import ReviewCard from "@/components/library/ReviewCard";
import {
  Paper,
  PaperAIInsights,
  InsightsChatResponse,
  InsightsChatReference,
  InsightsChatParagraph,
  InsightsChatExternalReference,
} from "@/types";

interface Review {
  id: string;
  title?: string;
  topic?: string;
  content?: string;
  created_at?: string;
}

const DEMO_USER_ID = "demo-user-123";

export default function LibraryPage() {
  const searchParams = useSearchParams();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [reviews, setReviews] = useState<Review[]>([
    {
      id: "test-review-1",
      title: "KIF6遺伝子多型と心血管リスクに関する研究レビュー",
      topic: "KIF6 polymorphism cardiovascular risk",
      content: `# KIF6遺伝子多型と心血管リスクに関する研究レビュー

## 概要

**KIF6** (Kinesin Family Member 6) 遺伝子の多型は、心血管疾患のリスク因子として注目されている。本レビューでは、KIF6遺伝子多型と心血管リスクに関する最新の研究動向をまとめる。

## 主要な知見

### 1. KIF6遺伝子の機能

KIF6は *kinesin* ファミリーに属するタンパク質で、以下の機能を持つ：

- 細胞内輸送の調節
- 有糸分裂の制御
- 神経細胞の軸索輸送

### 2. 遺伝子多型の影響

研究により、以下の多型が特定されている：

1. **rs20455** - 最も研究されている多型
2. **rs9462535** - 機能的多型
3. **rs9471077** - 新たに発見された多型

### 3. 心血管リスクとの関連

> 複数の大規模コホート研究により、KIF6遺伝子多型が心血管イベントのリスクと関連することが示されている。

#### メタアナリシス結果

以下の研究が重要な知見を提供している：

- Smith et al. (2020) - 大規模コホート研究
- Johnson et al. (2021) - メタアナリシス
- Brown et al. (2022) - 機能解析

### 4. 臨床的意義

\`\`\`python
# KIF6遺伝子型のリスク計算例
def calculate_risk(genotype):
    if genotype == "AA":
        return 1.0  # 基準リスク
    elif genotype == "AG":
        return 1.3  # 中等度リスク
    elif genotype == "GG":
        return 1.8  # 高リスク
    else:
        return None
\`\`\`

## 今後の研究方向

### 未解決の課題

- 遺伝子-環境相互作用の解明
- 個別化医療への応用
- 薬剤反応性との関連

### 研究ギャップ

1. **機序の解明**: KIF6が心血管リスクに影響する分子機序
2. **個別化医療**: 遺伝子型に基づく治療戦略
3. **予防医学**: リスク予測モデルの構築

---

## 結論

KIF6遺伝子多型は心血管リスクの重要な予測因子として注目されている。今後の研究により、より詳細な機序解明と臨床応用が期待される。

### 参考文献

- [1] Smith, J. et al. (2020). "KIF6 polymorphism and cardiovascular risk"
- [2] Johnson, M. et al. (2021). "Meta-analysis of KIF6 studies"
- [3] Brown, K. et al. (2022). "Functional analysis of KIF6 variants"

詳細は [PubMed](https://pubmed.ncbi.nlm.nih.gov/) で検索してください。`,
      created_at: new Date().toISOString(),
    },
  ]);
  const [tab, setTab] = useState<"papers" | "reviews">("papers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [venueFilter, setVenueFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"title" | "year" | "citationCount">(
    "year"
  );
  const [viewMode, setViewMode] = useState<"card" | "table" | "board">("card");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        console.log("Loading library data...");
        const res = await fetch(`/api/library?userId=${DEMO_USER_ID}`);
        const data = await res.json();
        console.log("Library API response:", {
          success: data.success,
          papersCount: data.papers?.length,
        });

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load papers");
        }
        setPapers(data.papers || []);
        console.log("Papers loaded:", data.papers?.length || 0);

        // タグデータを取得
        const tagsRes = await fetch(`/api/library/tags?userId=${DEMO_USER_ID}`);
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          if (tagsData.success) {
            setTags(tagsData.tags || []);
            console.log("Tags loaded:", tagsData.tags?.length || 0);
          }
        }

        const rv = await fetch(`/api/reviews?userId=${DEMO_USER_ID}`);
        const rvData = await rv.json();
        if (rv.ok) {
          setReviews(rvData.reviews || []);
          console.log("Reviews loaded:", rvData.reviews?.length || 0);
        }
      } catch (e: any) {
        console.error("Library load error:", e);
        setError(e.message || "読み込みに失敗しました");
      } finally {
        setLoading(false);
        console.log("Loading completed");
      }
    };
    load();
  }, []);

  // URLパラメータから論文IDを取得して自動選択
  useEffect(() => {
    const paperId = searchParams.get("paperId");
    if (paperId && papers.length > 0) {
      const paper = papers.find(
        (p) => p.paperId === paperId || p.id === paperId
      );
      if (paper) {
        setSelectedPaper(paper);
        setHighlights(buildHighlights(paper));
      }
    }
  }, [searchParams, papers]);

  const summaryStats = useMemo(() => {
    const totalCitations = papers.reduce((sum, paper) => {
      const value = paper.citationCount ?? (paper as any)?.citation_count ?? 0;
      return sum + value;
    }, 0);
    const aiEnhanced = papers.filter(
      (paper) => (paper as any)?.aiSummary ?? (paper as any)?.ai_summary
    ).length;
    return {
      paperCount: papers.length,
      reviewCount: reviews.length,
      citationAverage:
        papers.length === 0 ? 0 : Math.round(totalCitations / papers.length),
      aiEnhanced,
    };
  }, [papers, reviews]);

  // フィルタリングとソート機能
  const filteredAndSortedPapers = useMemo(() => {
    let filtered = papers.filter((paper) => {
      // 検索クエリでフィルタリング
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = paper.title?.toLowerCase().includes(query);
        const matchesAuthors = paper.authors?.toLowerCase().includes(query);
        const matchesAbstract = paper.abstract?.toLowerCase().includes(query);
        const matchesVenue = paper.venue?.toLowerCase().includes(query);

        if (
          !matchesTitle &&
          !matchesAuthors &&
          !matchesAbstract &&
          !matchesVenue
        ) {
          return false;
        }
      }

      // 年でフィルタリング
      if (yearFilter) {
        const paperYear = paper.year?.toString();
        if (paperYear !== yearFilter) {
          return false;
        }
      }

      // ジャーナルでフィルタリング
      if (venueFilter) {
        const venue = paper.venue?.toLowerCase();
        if (!venue?.includes(venueFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "year":
          return (b.year || 0) - (a.year || 0); // 新しい順
        case "citationCount":
          return (b.citationCount || 0) - (a.citationCount || 0); // 多い順
        default:
          return 0;
      }
    });

    return filtered;
  }, [papers, searchQuery, yearFilter, venueFilter, sortBy]);

  // 利用可能な年とジャーナルのリスト
  const availableYears = useMemo(() => {
    const years = [...new Set(papers.map((p) => p.year).filter(Boolean))].sort(
      (a, b) => b - a
    );
    return years;
  }, [papers]);

  const availableVenues = useMemo(() => {
    const venues = [
      ...new Set(papers.map((p) => p.venue).filter(Boolean)),
    ].sort();
    return venues;
  }, [papers]);

  const handleSelectPaper = (paper: Paper) => {
    setSelectedPaper(paper);
    setHighlights(buildHighlights(paper));
  };

  const handleAddTag = async (paperId: string, tag: string) => {
    if (!tag.trim()) return;

    try {
      const response = await fetch("/api/library/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          paperId: paperId,
          tag: tag.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("タグの追加に失敗しました");
      }

      const result = await response.json();

      // フロントエンドの状態を更新
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                tags: result.tags,
              }
            : paper
        )
      );

      // 全体のタグリストに追加
      if (!tags.includes(tag.trim())) {
        setTags((prev) => [...prev, tag.trim()].sort());
      }
    } catch (error) {
      console.error("Add tag error:", error);
      // エラー時はフロントエンドの状態のみ更新（一時的な表示）
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                tags: [...((paper as any)?.tags || []), tag.trim()].filter(
                  (t, i, arr) => arr.indexOf(t) === i
                ),
              }
            : paper
        )
      );
    }
  };

  const handleRemoveTag = async (paperId: string, tagToRemove: string) => {
    try {
      const response = await fetch(
        `/api/library/tags?userId=${DEMO_USER_ID}&paperId=${paperId}&tag=${encodeURIComponent(
          tagToRemove
        )}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("タグの削除に失敗しました");
      }

      const result = await response.json();

      // フロントエンドの状態を更新
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                tags: result.tags,
              }
            : paper
        )
      );
    } catch (error) {
      console.error("Remove tag error:", error);
      // エラー時はフロントエンドの状態のみ更新（一時的な表示）
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                tags: ((paper as any)?.tags || []).filter(
                  (tag: string) => tag !== tagToRemove
                ),
              }
            : paper
        )
      );
    }
  };

  const handleCreateTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags((prev) => [...prev, newTag.trim()].sort());
      setNewTag("");
      setShowTagInput(false);
    }
  };

  // ボードビューの列を取得する関数
  const getBoardColumns = () => {
    const allTags = [
      ...new Set(papers.flatMap((p) => (p as any).tags || [])),
    ].sort();
    const untaggedPapers = papers.filter(
      (p) => !(p as any).tags || (p as any).tags.length === 0
    );

    const columns = allTags.map((tag) => ({
      tag,
      papers: filteredAndSortedPapers.filter((p) =>
        (p as any).tags?.includes(tag)
      ),
    }));

    if (untaggedPapers.length > 0) {
      columns.push({
        tag: "タグなし",
        papers: filteredAndSortedPapers.filter(
          (p) => !(p as any).tags || (p as any).tags.length === 0
        ),
      });
    }

    return columns;
  };

  // カードビューのレンダリング関数
  const renderPaperCard = (paper: Paper, isBoard = false) => {
    const hasAiSummary = Boolean((paper as any)?.aiSummary ?? (paper as any)?.ai_summary);
    const hasPreview = Boolean(
      (paper as any)?.pdfUrl ??
        (paper as any)?.pdf_url ??
        (paper as any)?.htmlUrl ??
        (paper as any)?.html_url
    );
    const thumbnailUrl = (paper as any)?.notes;

    return (
      <div
        key={paper.id}
        onClick={() => handleSelectPaper(paper)}
        className={`group flex h-full flex-col items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
          hasAiSummary ? "border-slate-300" : ""
        } ${isBoard ? "w-full" : ""}`}
      >
        {/* サムネイル画像 */}
        {!isBoard && (
          <div className="w-full">
            <img
              src={
                thumbnailUrl ||
                `https://dummyimage.com/200x280/4F46E5/FFFFFF&text=${encodeURIComponent(
                  paper.title.substring(0, 10)
                )}`
              }
              alt={paper.title}
              className="h-32 w-full rounded-lg object-cover object-center"
              onError={(e) => {
                (
                  e.target as HTMLImageElement
                ).src = `https://dummyimage.com/200x280/4F46E5/FFFFFF&text=Error`;
              }}
            />
          </div>
        )}

        <div className="flex w-full items-start justify-between">
          <div className="text-sm font-semibold text-slate-700">
            {paper.venue || "掲載情報なし"}{" "}
            {paper.year ? `(${paper.year})` : ""}
          </div>
          {hasAiSummary && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              AI解説あり
            </span>
          )}
        </div>

        <h2 className="line-clamp-2 text-lg font-bold text-gray-900">
          {paper.title}
        </h2>

        <p className="text-xs text-slate-600">
          {paper.authors || "著者情報なし"}
        </p>

        {/* タグ管理 */}
        <TagManager
          paperId={paper.id}
          currentTags={(paper as any).tags || []}
          availableTags={tags}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onCreateTag={handleCreateTag}
        />

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span>
            引用数:{" "}
            {(paper.citation_count ?? paper.citationCount ?? "不明").toString()}
          </span>
          {paper.created_at ?? (paper as any)?.createdAt ? (
            <span>
              保存日:{" "}
              {new Date(
                (paper.created_at ?? (paper as any)?.createdAt) as string
              ).toLocaleDateString("ja-JP")}
            </span>
          ) : null}
          {hasPreview && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              プレビュー可
            </span>
          )}
        </div>

        {paper.url && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
            外部リンクあり →
          </span>
        )}
      </div>
    );
  };

  const handleSaveSummary = (paperId: string, insights: PaperAIInsights) => {
    setPapers((prev) =>
      prev.map((paper) =>
        paper.id === paperId
          ? {
              ...paper,
              aiSummary: insights,
              aiSummaryUpdatedAt: new Date().toISOString(),
            }
          : paper
      )
    );
  };

  return (
    <div className="relative h-screen bg-slate-100 text-slate-800 overflow-hidden">
      <header
        className="fixed top-0 left-0 right-0 z-[99999] border-b border-slate-200 bg-white shadow-sm"
        style={{ zIndex: 99999 }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-slate-900">
              My Library
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
              href="/search"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <Search className="h-4 w-4" />
              <span>検索</span>
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

      <main className="mx-auto w-full max-w-6xl px-6 py-6 pt-24 h-full overflow-y-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">
              保存した論文とレビューをここから素早く参照し、詳細を読み込みましょう。
            </p>
            {summaryStats.aiEnhanced > 0 && (
              <p className="mt-2 text-xs font-semibold text-slate-600">
                AI解説保存済み: {summaryStats.aiEnhanced} 件
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              論文 {summaryStats.paperCount} 件 / レビュー{" "}
              {summaryStats.reviewCount} 件
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              平均引用数 {summaryStats.citationAverage.toLocaleString()} 件
            </div>
          </div>
        </div>

        {/* 検索とフィルター */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* 検索バー */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="論文を検索... (タイトル、著者、要約、ジャーナル)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 shadow-inner focus:border-slate-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  showFilters
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Filter className="h-4 w-4" />
                フィルター
              </button>
            </div>

            {/* フィルターオプション */}
            {showFilters && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 年フィルター */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    年
                  </label>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
                  >
                    <option value="">すべての年</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ジャーナルフィルター */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    ジャーナル
                  </label>
                  <select
                    value={venueFilter}
                    onChange={(e) => setVenueFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
                  >
                    <option value="">すべてのジャーナル</option>
                    {availableVenues.map((venue) => (
                      <option key={venue} value={venue}>
                        {venue}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ソート */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    並び順
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as "title" | "year" | "citationCount"
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
                  >
                    <option value="year">年（新しい順）</option>
                    <option value="title">タイトル（A-Z）</option>
                    <option value="citationCount">引用数（多い順）</option>
                  </select>
                </div>
              </div>
            )}

            {/* 検索結果の統計 */}
            {searchQuery || yearFilter || venueFilter ? (
              <div className="text-sm text-slate-600">
                {filteredAndSortedPapers.length} 件の論文が見つかりました
                {papers.length !== filteredAndSortedPapers.length && (
                  <span className="text-slate-400">
                    （全 {papers.length} 件中）
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <button
              onClick={() => setTab("papers")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === "papers"
                  ? "bg-slate-800 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              論文 ({papers.length})
            </button>
            <button
              onClick={() => setTab("reviews")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === "reviews"
                  ? "bg-slate-800 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              レビュー ({reviews.length})
            </button>
          </div>

          {/* 表示モード切り替え */}
          {tab === "papers" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">表示:</span>
              <div className="flex rounded-lg border border-slate-200 bg-white p-1">
                <button
                  onClick={() => setViewMode("card")}
                  className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition ${
                    viewMode === "card"
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" />
                  カード
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition ${
                    viewMode === "table"
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <List className="h-3 w-3" />
                  テーブル
                </button>
                <button
                  onClick={() => setViewMode("board")}
                  className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition ${
                    viewMode === "board"
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Columns className="h-3 w-3" />
                  ボード
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-slate-600">読み込み中...</div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-600">
            エラー: {error}
          </div>
        )}

        {!loading && !error && tab === "papers" && (
          <>
            {filteredAndSortedPapers.length === 0 && (
              <div className="text-slate-600">
                {papers.length === 0
                  ? "保存された論文はありません。"
                  : "検索条件に一致する論文が見つかりませんでした。"}
              </div>
            )}

            {/* カードビュー */}
            {viewMode === "card" && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredAndSortedPapers.map((paper) => {
                  return renderPaperCard(paper);
                })}
              </div>
            )}

            {/* テーブルビュー */}
            {viewMode === "table" && (
              <ResizableTable
                papers={filteredAndSortedPapers}
                onSelectPaper={handleSelectPaper}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onCreateTag={handleCreateTag}
                availableTags={tags}
              />
            )}

            {/* ボードビュー */}
            {viewMode === "board" && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {getBoardColumns().map((column) => (
                  <div key={column.tag} className="min-w-80 flex-shrink-0">
                    <div className="mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-700">
                        {column.tag}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {column.papers.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {column.papers.map((paper) => {
                        return renderPaperCard(paper, true);
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !error && tab === "reviews" && (
          <div className="space-y-6">
            {reviews.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <p className="text-slate-600 text-lg">
                  保存されたレビューはありません。
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  レビューを作成すると、ここに表示されます。
                </p>
              </div>
            )}
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                papers={papers}
                onPaperClick={handleSelectPaper}
                onSaveToLibrary={async (paper) => {
                  // 論文をライブラリに保存する処理
                  try {
                    const response = await fetch("/api/library", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        userId: DEMO_USER_ID,
                        paper: paper,
                      }),
                    });

                    if (!response.ok) {
                      throw new Error("保存に失敗しました");
                    }

                    // 論文リストを更新
                    setPapers((prev) => [...prev, paper]);
                  } catch (error) {
                    console.error("Save error:", error);
                    throw error;
                  }
                }}
                isPaperInLibrary={(paperId) =>
                  papers.some((p) => p.id === paperId || p.paperId === paperId)
                }
              />
            ))}
          </div>
        )}

        {selectedPaper && (
          <PaperDetailPanel
            paper={{
              ...selectedPaper,
              pdfUrl:
                selectedPaper.pdfUrl ?? (selectedPaper as any)?.pdf_url ?? null,
              htmlUrl:
                selectedPaper.htmlUrl ??
                (selectedPaper as any)?.html_url ??
                null,
              notes: buildNoteFromHighlights(highlights),
            }}
            onClose={() => setSelectedPaper(null)}
            onSaveSummary={(paperId, insights) => {
              handleSaveSummary(paperId, insights);
              setSelectedPaper((prev) =>
                prev
                  ? {
                      ...prev,
                      aiSummary: insights,
                      aiSummaryUpdatedAt: new Date().toISOString(),
                    }
                  : prev
              );
            }}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onCreateTag={handleCreateTag}
            availableTags={tags}
          />
        )}
      </main>
    </div>
  );
}

function buildHighlights(paper: Paper): string[] {
  const results: string[] = [];
  if (paper.abstract) {
    const sentences = paper.abstract
      .split(/[。.!?]/)
      .map((s) => s.trim())
      .filter(Boolean);
    results.push(...sentences.slice(0, 3));
  }
  if (paper.venue) {
    results.push(`掲載誌: ${paper.venue}`);
  }
  if (paper.citation_count ?? paper.citationCount) {
    const count = paper.citation_count ?? paper.citationCount;
    results.push(`引用数: ${count?.toLocaleString?.("ja-JP") ?? count}`);
  }
  if (paper.year) {
    results.push(`発行年: ${paper.year}`);
  }
  return results.slice(0, 6);
}

function buildNoteFromHighlights(highlights: string[]): string {
  if (highlights.length === 0) return "";
  return highlights
    .map(
      (item, index) => `・${item}${index === highlights.length - 1 ? "" : ""}`
    )
    .join("\n");
}
