"use client";

import { useEffect, useMemo, useState, Suspense, useCallback, useRef } from "react";
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
  ArrowUpDown,
  AlertTriangle,
  Trash2,
  Link as LinkIcon,
  MoreVertical,
  GripVertical,
  Star,
  CheckSquare,
  Square,
  Settings,
  ChevronLeft,
  Download,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import PaperDetailPanel from "@/components/library/PaperDetailPanel";
import TagManager from "@/components/library/TagManager";
import ResizableTable from "@/components/library/ResizableTable";
import ReviewCard from "@/components/library/ReviewCard";
import PaperCardMenu from "@/components/library/PaperCardMenu";
import {
  Paper,
  LibraryPaper,
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

function LibraryPageContent() {
  const searchParams = useSearchParams();
  const [papers, setPapers] = useState<(Paper | LibraryPaper)[]>([]);
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
  const [selectedPaper, setSelectedPaper] = useState<Paper | LibraryPaper | null>(null);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [highlights, setHighlights] = useState<string[]>([]);
  // selectedPaperのIDを保持（papersが更新されても、selectedPaperを維持するため）
  const selectedPaperIdRef = useRef<string | null>(null);
  
  // selectedPaperが変更されたときに、IDを保持
  useEffect(() => {
    if (selectedPaper) {
      selectedPaperIdRef.current = selectedPaper.id;
    } else {
      selectedPaperIdRef.current = null;
    }
  }, [selectedPaper]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [venueFilter, setVenueFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | null>(null);
  const [addedDateFilter, setAddedDateFilter] = useState<
    "all" | "7days" | "30days" | "365days"
  >("all");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "title" | "year" | "citationCount" | "venue"
  >("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"card" | "table" | "board">("card");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // レイアウト設定関連のstate
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [groupBy, setGroupBy] = useState<"tag" | "year" | "venue" | "none">("none");
  const [cardSize, setCardSize] = useState<"xl" | "large" | "medium" | "small">("xl");
  const [pageOpenMode, setPageOpenMode] = useState<"fullscreen" | "popup" | "sidepeek">("sidepeek");
  const [cardPreview, setCardPreview] = useState<"thumbnail" | "none" | "pdf">("thumbnail");
  const [showColumnBackground, setShowColumnBackground] = useState(true);
  const [showPageIcon, setShowPageIcon] = useState(true);
  const [foldContentAtRight, setFoldContentAtRight] = useState(true);
  const [loadLimit, setLoadLimit] = useState<number>(25);
  const [textDisplayMode, setTextDisplayMode] = useState<"wrap" | "truncate">("truncate");
  
  // 表示項目の設定
  const [visibleCardFields, setVisibleCardFields] = useState<{
    thumbnail: boolean;
    title: boolean;
    authors: boolean;
    venue: boolean;
    year: boolean;
    tags: boolean;
    aiSummary: boolean;
    tldr: boolean;
    favorite: boolean;
    citationCount: boolean;
  }>({
    thumbnail: true,
    title: true,
    authors: true,
    venue: true,
    year: true,
    tags: true,
    aiSummary: true,
    tldr: true,
    favorite: true,
    citationCount: false,
  });
  // 設定が初期化されたかどうかを追跡
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  // localStorageから設定を読み込む
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("library-view-settings");
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // 設定を復元（デフォルト値とマージ）
        if (settings.cardSize) setCardSize(settings.cardSize);
        if (settings.textDisplayMode) setTextDisplayMode(settings.textDisplayMode);
        if (settings.cardPreview) setCardPreview(settings.cardPreview);
        if (settings.visibleCardFields) {
          setVisibleCardFields((prev) => ({
            ...prev,
            ...settings.visibleCardFields,
          }));
        }
        if (settings.groupBy) setGroupBy(settings.groupBy);
        if (settings.showColumnBackground !== undefined) setShowColumnBackground(settings.showColumnBackground);
        if (settings.showPageIcon !== undefined) setShowPageIcon(settings.showPageIcon);
        if (settings.foldContentAtRight !== undefined) setFoldContentAtRight(settings.foldContentAtRight);
        if (settings.loadLimit) setLoadLimit(settings.loadLimit);
        if (settings.pageOpenMode) setPageOpenMode(settings.pageOpenMode);
        if (settings.viewMode) setViewMode(settings.viewMode);
        if (settings.showLayoutSettings !== undefined) setShowLayoutSettings(settings.showLayoutSettings);
      }
      setSettingsInitialized(true);
    } catch (e) {
      console.error("Failed to load settings from localStorage:", e);
      setSettingsInitialized(true);
    }
  }, []);

  // 設定が変更されたらlocalStorageに保存（初期化後のみ）
  useEffect(() => {
    if (!settingsInitialized) return; // 初期化前は保存しない
    
    try {
      const settings = {
        cardSize,
        textDisplayMode,
        cardPreview,
        visibleCardFields,
        groupBy,
        showColumnBackground,
        showPageIcon,
        foldContentAtRight,
        loadLimit,
        pageOpenMode,
        viewMode,
        showLayoutSettings,
      };
      localStorage.setItem("library-view-settings", JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save settings to localStorage:", e);
    }
  }, [
    settingsInitialized,
    cardSize,
    textDisplayMode,
    cardPreview,
    visibleCardFields,
    groupBy,
    showColumnBackground,
    showPageIcon,
    foldContentAtRight,
    loadLimit,
    pageOpenMode,
    viewMode,
    showLayoutSettings,
  ]);

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
    // URLパラメータがある場合のみ実行
    if (paperId && papers.length > 0) {
      const paper = papers.find(
        (p) => p.paperId === paperId || p.id === paperId
      );
      if (paper) {
        // 既に同じ論文が選択されている場合は更新しない（タグ追加やサムネイルアップロード後の意図しない変更を防ぐ）
        if (!selectedPaper || selectedPaper.id !== paper.id) {
          setSelectedPaper(paper);
          setHighlights(buildHighlights(paper));
        }
      }
    }
  }, [searchParams, papers]); // papersを依存関係に含める（URLパラメータがある場合のみ実行されるため問題ない）

  // papersが更新されたときに、selectedPaperがpapersリストに存在するか確認
  // 存在しない場合は、selectedPaperをクリア（ただし、URLパラメータがある場合は上記のuseEffectで処理される）
  // 注意: selectedPaperの更新は、明示的な操作（タグ追加、サムネイルアップロードなど）の後にのみ行う
  // papersが更新されただけでは、selectedPaperを自動更新しない（意図しない切り替えを防ぐ）
  useEffect(() => {
    const paperId = searchParams.get("paperId");
    // URLパラメータがない場合のみ実行（URLパラメータがある場合は上記のuseEffectで処理される）
    // selectedPaperIdRefを使用して、selectedPaperが変更されても、IDを保持する
    const currentSelectedId = selectedPaperIdRef.current;
    if (!paperId && currentSelectedId && papers.length > 0) {
      // selectedPaperに対応する論文がリストに存在するか確認
      const stillExists = papers.some(
        (p) => p.id === currentSelectedId || p.paperId === currentSelectedId
      );
      
      // 論文がリストから削除された場合のみ、selectedPaperをクリア
      // タグ追加やサムネイルアップロードの場合は論文は存在するはずなので、この処理は通常実行されない
      if (!stillExists) {
        console.warn("Selected paper no longer exists in papers list, clearing selection");
        setSelectedPaper(null);
        selectedPaperIdRef.current = null;
      }
      // 注意: ここではselectedPaperを更新しない（意図しない切り替えを防ぐ）
      // 明示的な操作（タグ追加、サムネイルアップロードなど）の後にのみ、selectedPaperを更新する
    }
  }, [papers, searchParams]); // selectedPaperを依存関係から削除（selectedPaperIdRefを使用するため）

  // カードサイズに応じたグリッドクラス取得
  const getCardGridClasses = () => {
    switch (cardSize) {
      case "xl":
        return "grid-cols-1";
      case "large":
        return "md:grid-cols-2";
      case "medium":
        return "md:grid-cols-2 xl:grid-cols-3";
      case "small":
        return "md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";
      default:
        return "grid-cols-1";
    }
  };

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
    const now = new Date();

    const filtered = papers.filter((paper) => {
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

      // タグでフィルタリング（選択されたタグをすべて含む場合のみ表示）
      if (tagFilter.length > 0) {
        const paperTags = getPaperTags(paper);
        const hasAllTags = tagFilter.every((tag) => paperTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      // お気に入りでフィルタリング
      if (favoriteFilter !== null) {
        const isFavorite = (paper as any)?.is_favorite ?? (paper as any)?.isFavorite ?? false;
        if (isFavorite !== favoriteFilter) {
          return false;
        }
      }

      // 追加日時のフィルター
      if (addedDateFilter !== "all") {
        const createdAt = getPaperCreatedAt(paper);
        if (!createdAt) {
          return false;
        }
        const diffInMs = now.getTime() - createdAt.getTime();
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        if (
          (addedDateFilter === "7days" && diffInDays > 7) ||
          (addedDateFilter === "30days" && diffInDays > 30) ||
          (addedDateFilter === "365days" && diffInDays > 365)
        ) {
          return false;
        }
      }

      return true;
    });

    // ソート
    const numberComparator = (aValue: number, bValue: number) => {
      if (aValue === bValue) return 0;
      return aValue < bValue ? -1 : 1;
    };

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      switch (sortBy) {
        case "createdAt": {
          const aDate = getPaperCreatedAt(a);
          const bDate = getPaperCreatedAt(b);
          const aTime = aDate ? aDate.getTime() : 0;
          const bTime = bDate ? bDate.getTime() : 0;
          return numberComparator(aTime, bTime) * direction;
        }
        case "title": {
          const aTitle = a.title || "";
          const bTitle = b.title || "";
          return aTitle.localeCompare(bTitle, "ja") * direction;
        }
        case "year": {
          const aYear = a.year || 0;
          const bYear = b.year || 0;
          return numberComparator(aYear, bYear) * direction;
        }
        case "citationCount": {
          const aCount =
            (a as any)?.citation_count ?? a.citationCount ?? 0;
          const bCount =
            (b as any)?.citation_count ?? b.citationCount ?? 0;
          return numberComparator(aCount, bCount) * direction;
        }
        case "venue": {
          const aVenue = a.venue || "";
          const bVenue = b.venue || "";
          return aVenue.localeCompare(bVenue, "ja") * direction;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [
    papers,
    searchQuery,
    yearFilter,
    venueFilter,
    tagFilter,
    addedDateFilter,
    sortBy,
    sortDirection,
  ]);

  // グループ化された論文リストの生成（ボード表示用）
  const groupedPapers = useMemo(() => {
    if (viewMode !== "board" || groupBy === "none") {
      // グループ化なしの場合は、既存のgetBoardColumns()ロジックを使用（タグでグループ化）
      const source = filteredAndSortedPapers;
      const allTags = [...new Set(source.flatMap((p) => getPaperTags(p)))].sort();
      const untaggedPapers = source.filter((p) => getPaperTags(p).length === 0);

      const grouped: Record<string, typeof filteredAndSortedPapers> = {};
      allTags.forEach((tag) => {
        grouped[tag] = source.filter((p) => getPaperTags(p).includes(tag));
      });

      if (untaggedPapers.length > 0) {
        grouped["タグなし"] = untaggedPapers;
      }

      return grouped;
    }

    const grouped: Record<string, typeof filteredAndSortedPapers> = {};

    filteredAndSortedPapers.forEach((paper) => {
      let key = "その他";
      
      if (groupBy === "tag") {
        const paperTags = getPaperTags(paper);
        if (paperTags.length > 0) {
          paperTags.forEach((tag) => {
            if (!grouped[tag]) {
              grouped[tag] = [];
            }
            grouped[tag].push(paper);
          });
        } else {
          if (!grouped["タグなし"]) {
            grouped["タグなし"] = [];
          }
          grouped["タグなし"].push(paper);
        }
        return;
      } else if (groupBy === "year") {
        key = paper.year?.toString() || "年不明";
      } else if (groupBy === "venue") {
        key = paper.venue || "Journal不明";
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(paper);
    });

    return grouped;
  }, [filteredAndSortedPapers, groupBy, viewMode]);

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

  const handleSelectPaper = (paper: Paper | LibraryPaper) => {
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

      // 選択中の論文も更新（現在開いている論文を維持）
      if (selectedPaper && selectedPaper.id === paperId) {
        setSelectedPaper({
          ...selectedPaper,
          tags: result.tags,
        } as any);
      }

      // 全体のタグリストに追加
      if (!tags.includes(tag.trim())) {
        setTags((prev) => [...prev, tag.trim()].sort());
      }
    } catch (error) {
      console.error("Add tag error:", error);
      // エラー時はフロントエンドの状態のみ更新（一時的な表示）
      const updatedTags = [...((selectedPaper as any)?.tags || []), tag.trim()].filter(
        (t, i, arr) => arr.indexOf(t) === i
      );
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                tags: updatedTags,
              }
            : paper
        )
      );

      // 選択中の論文も更新（現在開いている論文を維持）
      if (selectedPaper && selectedPaper.id === paperId) {
        setSelectedPaper({
          ...selectedPaper,
          tags: updatedTags,
        } as any);
      }
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

      // 選択中の論文も更新（現在開いている論文を維持）
      if (selectedPaper && selectedPaper.id === paperId) {
        setSelectedPaper({
          ...selectedPaper,
          tags: result.tags,
        } as any);
      }
    } catch (error) {
      console.error("Remove tag error:", error);
      // エラー時はフロントエンドの状態のみ更新（一時的な表示）
      const updatedTags = ((selectedPaper as any)?.tags || []).filter(
        (tag: string) => tag !== tagToRemove
      );
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                tags: updatedTags,
              }
            : paper
        )
      );

      // 選択中の論文も更新（現在開いている論文を維持）
      if (selectedPaper && selectedPaper.id === paperId) {
        setSelectedPaper({
          ...selectedPaper,
          tags: updatedTags,
        } as any);
      }
    }
  };

  const handleCreateTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags((prev) => [...prev, newTag.trim()].sort());
      setNewTag("");
      setShowTagInput(false);
    }
  };

  const handleToggleFavorite = async (paperId: string, currentFavorite: boolean) => {
    try {
      const response = await fetch("/api/library/favorite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          paperId: paperId,
          isFavorite: !currentFavorite,
        }),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // JSONパースに失敗した場合、テキストとして取得
          const text = await response.text();
          errorData = { error: text || `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error("Favorite toggle API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        const errorMessage = errorData.error || errorData.message || "お気に入りの更新に失敗しました";
        
        // カラムが存在しない場合の特別な処理
        if (errorMessage.includes("is_favoriteカラムが存在しません") || errorMessage.includes("column") || errorMessage.includes("is_favorite")) {
          const migrationMessage = `データベースにis_favoriteカラムが存在しません。

以下のSQLをSupabaseのSQL Editorで実行してください：

ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_library_is_favorite ON user_library(user_id, is_favorite);

または、以下のマイグレーションファイルを実行してください：
database/migrations/add_is_favorite_column.sql`;
          
          alert(migrationMessage);
          console.error("マイグレーションが必要です:", migrationMessage);
        } else {
          alert(errorMessage);
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // フロントエンドの状態を更新
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                is_favorite: result.isFavorite,
                isFavorite: result.isFavorite,
              }
            : paper
        )
      );

      // 選択中の論文も更新
      if (selectedPaper && selectedPaper.id === paperId) {
        setSelectedPaper({
          ...selectedPaper,
          isFavorite: result.isFavorite,
        } as any);
      }
    } catch (error) {
      console.error("Toggle favorite error:", error);
      alert("お気に入りの更新に失敗しました");
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!confirm("この論文を削除しますか？")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/library?userId=${DEMO_USER_ID}&libraryId=${paperId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("論文の削除に失敗しました");
      }

      // フロントエンドの状態を更新
      setPapers((prev) => prev.filter((paper) => paper.id !== paperId));

      // 選択中の論文を閉じる
      if (selectedPaper && selectedPaper.id === paperId) {
        setSelectedPaper(null);
      }

      // 複数選択からも削除
      setSelectedPaperIds((prev) => {
        const next = new Set(prev);
        next.delete(paperId);
        return next;
      });
    } catch (error) {
      console.error("Delete paper error:", error);
      alert("論文の削除に失敗しました");
    }
  };

  // 複数選択のハンドラー
  const handleTogglePaperSelection = (paperId: string) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPaperIds(new Set(filteredAndSortedPapers.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPaperIds(new Set());
  };

  // 一括タグ追加
  const handleBulkAddTag = async (tag: string) => {
    if (!tag.trim() || selectedPaperIds.size === 0) return;

    const paperIds = Array.from(selectedPaperIds);
    const results = await Promise.allSettled(
      paperIds.map((paperId) =>
        fetch("/api/library/tags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: DEMO_USER_ID,
            paperId: paperId,
            tag: tag.trim(),
          }),
        }).then((res) => {
          if (!res.ok) {
            throw new Error("タグの追加に失敗しました");
          }
          return res.json();
        })
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    if (successCount > 0) {
      // 成功した論文のタグを更新
      const successfulResults = results.filter((r) => r.status === "fulfilled") as Array<PromiseFulfilledResult<any>>;
      for (const result of successfulResults) {
        const data = result.value;
        const paperId = paperIds[results.indexOf(result)];
        setPapers((prev) =>
          prev.map((paper) =>
            paper.id === paperId
              ? {
                  ...paper,
                  tags: data.tags,
                }
              : paper
          )
        );
      }

      // 全体のタグリストに追加
      if (!tags.includes(tag.trim())) {
        setTags((prev) => [...prev, tag.trim()].sort());
      }

      toast.success(`${successCount}件の論文にタグ「${tag.trim()}」を追加しました`);
    }

    if (successCount < paperIds.length) {
      toast.error(
        `${paperIds.length - successCount}件の論文でタグ追加に失敗しました`
      );
    }
  };

  // 一括タグ削除
  const handleBulkRemoveTag = async (tag: string) => {
    if (!tag.trim() || selectedPaperIds.size === 0) return;

    const paperIds = Array.from(selectedPaperIds);
    const results = await Promise.allSettled(
      paperIds.map((paperId) =>
        fetch(
          `/api/library/tags?userId=${DEMO_USER_ID}&paperId=${paperId}&tag=${encodeURIComponent(
            tag
          )}`,
          {
            method: "DELETE",
          }
        ).then((res) => {
          if (!res.ok) {
            throw new Error("タグの削除に失敗しました");
          }
          return res.json();
        })
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    if (successCount > 0) {
      // 成功した論文のタグを更新
      const successfulResults = results.filter((r) => r.status === "fulfilled") as Array<PromiseFulfilledResult<any>>;
      for (const result of successfulResults) {
        const data = result.value;
        const paperId = paperIds[results.indexOf(result)];
        setPapers((prev) =>
          prev.map((paper) =>
            paper.id === paperId
              ? {
                  ...paper,
                  tags: data.tags,
                }
              : paper
          )
        );
      }

      toast.success(`${successCount}件の論文からタグ「${tag.trim()}」を削除しました`);
    }

    if (successCount < paperIds.length) {
      toast.error(
        `${paperIds.length - successCount}件の論文でタグ削除に失敗しました`
      );
    }
  };

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedPaperIds.size === 0) return;

    const count = selectedPaperIds.size;
    if (
      !confirm(
        `選択した${count}件の論文を削除しますか？この操作は取り消せません。`
      )
    ) {
      return;
    }

    const paperIds = Array.from(selectedPaperIds);
    const results = await Promise.allSettled(
      paperIds.map((paperId) =>
        fetch(
          `/api/library?userId=${DEMO_USER_ID}&libraryId=${paperId}`,
          {
            method: "DELETE",
          }
        )
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;

    // フロントエンドの状態を更新
    setPapers((prev) =>
      prev.filter((paper) => !selectedPaperIds.has(paper.id))
    );

    // 選択中の論文が削除された場合は閉じる
    if (selectedPaper && selectedPaperIds.has(selectedPaper.id)) {
      setSelectedPaper(null);
    }

    // 複数選択をクリア
    setSelectedPaperIds(new Set());

    if (successCount > 0) {
      toast.success(`${successCount}件の論文を削除しました`);
    }

    if (successCount < paperIds.length) {
      toast.error(
        `${paperIds.length - successCount}件の論文の削除に失敗しました`
      );
    }
  };

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const resetFilters = () => {
    setSearchQuery("");
    setYearFilter("");
    setVenueFilter("");
    setTagFilter([]);
    setFavoriteFilter(null);
    setAddedDateFilter("all");
    setSortBy("createdAt");
    setSortDirection("desc");
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  // ボードビューの列を取得する関数
  const getBoardColumns = () => {
    const source = filteredAndSortedPapers;
    const allTags = [...new Set(source.flatMap((p) => getPaperTags(p)))].sort();
    const untaggedPapers = source.filter((p) => getPaperTags(p).length === 0);

    const columns = allTags.map((tag) => ({
      tag,
      papers: source.filter((p) => getPaperTags(p).includes(tag)),
    }));

    if (untaggedPapers.length > 0) {
      columns.push({
        tag: "タグなし",
        papers: source.filter((p) => getPaperTags(p).length === 0),
      });
    }

    return columns;
  };

  // サムネイル画像アップロード処理
  const handleThumbnailUpload = async (paperId: string, file: File) => {
    try {
      // ファイルをbase64に変換
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/library/thumbnail-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId,
          userId: DEMO_USER_ID,
          imageData: base64Data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "画像のアップロードに失敗しました";
        const errorDetails = errorData.details || "";
        const migrationSql = errorData.migrationSql || "";
        
        // カラムが存在しない場合の特別な処理
        if (errorMessage.includes("thumbnail_urlカラムが存在しません") || errorMessage.includes("column") || errorMessage.includes("thumbnail_url")) {
          const migrationMessage = `データベースにthumbnail_urlカラムが存在しません。

以下のSQLをSupabaseのSQL Editorで実行してください：

${migrationSql || `ALTER TABLE user_library 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_user_library_thumbnail_url ON user_library(thumbnail_url);`}

または、以下のマイグレーションファイルを実行してください：
supabase-thumbnail-migration.sql`;
          
          alert(migrationMessage);
          console.error("マイグレーションが必要です:", migrationMessage);
          throw new Error(errorMessage);
        }
        
        // バケット関連のエラーの場合、詳細な案内を表示
        if (errorMessage.includes("バケット") || errorMessage.includes("Bucket")) {
          const fullMessage = `${errorMessage}\n\n${errorDetails}\n\n` +
            `対処方法:\n` +
            `1. Supabaseのダッシュボードにログイン\n` +
            `2. Storageセクションに移動\n` +
            `3. 「library-thumbnails」という名前のバケットを作成\n` +
            `4. 設定: 公開バケット、最大ファイルサイズ5MB`;
          alert(fullMessage);
          throw new Error(errorMessage);
        }
        
        alert(`${errorMessage}\n\n${errorDetails ? `詳細: ${errorDetails}` : ""}`);
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // フロントエンドの状態を更新
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? {
                ...paper,
                thumbnail_url: result.thumbnailUrl,
              }
            : paper
        )
      );

      // 選択中の論文も更新
      if (selectedPaper && selectedPaper.id === paperId) {
        setSelectedPaper({
          ...selectedPaper,
          thumbnail_url: result.thumbnailUrl,
        } as any);
      }
    } catch (error: any) {
      console.error("Thumbnail upload error:", error);
      alert(error.message || "画像のアップロードに失敗しました");
    }
  };

  // サムネイル画像選択処理
  const handleThumbnailClick = (paperId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleThumbnailUpload(paperId, file);
      }
    };
    input.click();
  };

  // カードビューのレンダリング関数
  const renderPaperCard = (
    paper: Paper | LibraryPaper, 
    isBoard = false,
    size: "xl" | "large" | "medium" | "small" = cardSize,
    textMode: "wrap" | "truncate" = textDisplayMode,
    visibleFields = visibleCardFields
  ) => {
    const hasAiSummary = Boolean(
      (paper as any)?.aiSummary ?? (paper as any)?.ai_summary
    );
    const hasPreview = Boolean(
      (paper as any)?.pdfUrl ??
        (paper as any)?.pdf_url ??
        (paper as any)?.htmlUrl ??
        (paper as any)?.html_url
    );
    // サムネイル画像の取得優先順位: 1. thumbnail_url, 2. notesフィールド, 3. デフォルト画像
    const thumbnailUrl = (paper as any)?.thumbnail_url || (paper as any)?.notes;

    const isFavorite = (paper as any)?.is_favorite ?? (paper as any)?.isFavorite ?? false;

    const isSelected = selectedPaperIds.has(paper.id);

    // カードサイズに応じたクラスとスタイル
    const cardSizeClasses = {
      xl: "p-6 gap-4",
      large: "p-5 gap-3",
      medium: "p-5 gap-3",
      small: "p-2 gap-1 text-xs",
    };

    const titleClasses = {
      xl: "text-xl font-bold",
      large: "text-lg font-bold",
      medium: "text-base font-bold",
      small: "text-xs font-semibold",
    };

    const isSmall = size === "small";
    const widthStyle = isSmall ? { width: "120px", minWidth: "120px", maxWidth: "120px" } : {};

    // テキスト表示モードに応じたクラス
    const titleDisplayClass = textMode === "wrap" 
      ? "" 
      : isSmall 
        ? "line-clamp-3" 
        : "line-clamp-2";

    const abstractDisplayClass = textMode === "wrap"
      ? ""
      : "line-clamp-2";

    return (
      <div
        key={paper.id}
        style={widthStyle}
        className={`group relative flex h-full flex-col items-start overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ${cardSizeClasses[size]} text-left transition hover:-translate-y-0.5 hover:shadow-md ${
          hasAiSummary ? "border-[var(--color-primary)]/30" : ""
        } ${isSelected ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20" : ""} ${isBoard ? "w-full" : ""}`}
      >
        {/* チェックボックス */}
        <div className={`absolute ${isSmall ? "left-1 top-1" : "left-2 top-2"} z-20`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePaperSelection(paper.id);
            }}
            className={`flex items-center justify-center rounded border-2 border-[var(--color-border)] bg-[var(--color-surface)] ${isSmall ? "p-0.5" : "p-1"} hover:bg-[var(--color-background)] transition-colors`}
          >
            {isSelected ? (
              <CheckSquare className={`${isSmall ? "h-3 w-3" : "h-4 w-4"} text-[var(--color-primary)]`} />
            ) : (
              <Square className={`${isSmall ? "h-3 w-3" : "h-4 w-4"} text-[var(--color-text-secondary)]`} />
            )}
          </button>
        </div>

        {/* 右上メニューボタン */}
        <PaperCardMenu
          paperId={paper.id}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDeletePaper}
          position="top-right"
          paper={{
            doi: (paper as any)?.doi || null,
            htmlUrl: (paper as any)?.htmlUrl || (paper as any)?.html_url || null,
            url: (paper as any)?.url || paper.url || null,
            title: paper.title || null,
            authors: paper.authors || null,
            year: paper.year || null,
          }}
        />

        {/* お気に入りマーク */}
        {visibleFields.favorite && isFavorite && (
          <div className={`absolute ${isSmall ? "left-1 top-1" : "left-2 top-2"} z-10`}>
            <Star className={`${isSmall ? "h-3 w-3" : "h-5 w-5"} fill-yellow-400 text-yellow-400`} />
          </div>
        )}

        <div
          onClick={() => handleSelectPaper(paper)}
          className="w-full cursor-pointer"
        >
          {/* サムネイル画像 */}
          {!isSmall && 
           visibleFields.thumbnail && 
           cardPreview === "thumbnail" && (
            <div
              className="w-full relative group/thumbnail"
              onClick={(e) => {
                e.stopPropagation();
                handleThumbnailClick(paper.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.add("opacity-70", "border-2", "border-dashed", "border-[var(--color-primary)]");
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove("opacity-70", "border-2", "border-dashed", "border-[var(--color-primary)]");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove("opacity-70", "border-2", "border-dashed", "border-[var(--color-primary)]");
                
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith("image/")) {
                  handleThumbnailUpload(paper.id, file);
                } else {
                  alert("画像ファイルを選択してください");
                }
              }}
            >
              <img
                src={
                  thumbnailUrl ||
                  `https://dummyimage.com/200x280/4F46E5/FFFFFF&text=${encodeURIComponent(
                    paper.title.substring(0, 10)
                  )}`
                }
                alt={paper.title}
                className="h-32 w-full rounded-lg object-cover object-center cursor-pointer transition-opacity"
                onError={(e) => {
                  (
                    e.target as HTMLImageElement
                  ).src = `https://dummyimage.com/200x280/4F46E5/FFFFFF&text=Error`;
                }}
              />
              {/* ホバー時のオーバーレイ */}
              <div className="absolute inset-0 bg-black/0 group-hover/thumbnail:bg-black/30 rounded-lg flex items-center justify-center opacity-0 group-hover/thumbnail:opacity-100 transition-opacity cursor-pointer">
                <div className="text-white text-xs font-semibold bg-black/50 px-3 py-1 rounded">
                  画像を変更
                </div>
              </div>
            </div>
          )}

          {/* ジャーナルと年 - 表示項目設定に応じて */}
          {(visibleFields.venue || visibleFields.year) && (
            <div className="flex w-full items-start justify-between">
              <div className="text-sm font-semibold text-[var(--color-text)]">
                {visibleFields.venue && (paper.venue || "掲載情報なし")}{" "}
                {visibleFields.year && paper.year ? `(${paper.year})` : ""}
              </div>
              {visibleFields.aiSummary && hasAiSummary && (
                <span className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text)]">
                  AI解説あり
                </span>
              )}
              {/* 引用数 - 表示項目設定に応じて */}
              {visibleFields.citationCount && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  引用: {paper.citationCount || 0}
                </span>
              )}
            </div>
          )}

          {/* タイトル - 表示項目設定に応じて */}
          {visibleFields.title && (
            <h2 className={`${titleClasses[size]} ${titleDisplayClass} text-[var(--color-text)]`}>
              {paper.title}
            </h2>
          )}

          {/* 著者 - 表示項目設定に応じて */}
          {visibleFields.authors && !isSmall && (
            <p className={`text-xs text-[var(--color-text-secondary)] ${textMode === "wrap" ? "" : abstractDisplayClass}`}>
              {paper.authors || "著者情報なし"}
            </p>
          )}

          {/* タグ管理 - 表示項目設定に応じて */}
          {visibleFields.tags && !isSmall && (
            <TagManager
              paperId={paper.id}
              currentTags={(paper as any).tags || []}
              availableTags={tags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              onCreateTag={handleCreateTag}
              className="mt-2"
              allPapers={papers as any}
            />
          )}

          {/* TL;DR要約 - 表示項目設定に応じて */}
          {visibleFields.tldr && (() => {
            const aiSummary = (paper as any)?.aiSummary ?? (paper as any)?.ai_summary;
            const summaries = aiSummary?.summaries || {};
            const tldr = summaries.tldr;
            
            if (tldr) {
              return (
                <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 p-3 mt-2">
                  <div className="text-xs font-semibold text-[var(--color-primary)] mb-1">
                    TL;DR
                  </div>
                  <div className={`text-xs text-[var(--color-primary)] ${textMode === "wrap" ? "" : "line-clamp-2"}`}>
                    {tldr}
                  </div>
                </div>
              );
            }
            return null;
          })()}

        <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
          <span>
            引用数:{" "}
            {(
              (paper as any)?.citation_count ??
              paper.citationCount ??
              "不明"
            ).toString()}
          </span>
          {(paper as any)?.created_at ?? (paper as any)?.createdAt ? (
            <span>
              保存日:{" "}
              {new Date(
                ((paper as any)?.created_at ??
                  (paper as any)?.createdAt) as string
              ).toLocaleDateString("ja-JP")}
            </span>
          ) : null}
          {hasPreview && (
            <span className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text)]">
              プレビュー可
            </span>
          )}
        </div>

        {paper.url && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            外部リンクあり →
          </span>
        )}
        </div>
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

  // 重複検出
  const handleFindDuplicates = async () => {
    setLoadingDuplicates(true);
    try {
      const response = await fetch(
        `/api/library/duplicates?userId=${DEMO_USER_ID}`
      );
      const data = await response.json();
      if (data.success) {
        setDuplicates(data.duplicates || []);
        setShowDuplicates(true);
      } else {
        alert("重複検出に失敗しました");
      }
    } catch (error) {
      console.error("Find duplicates error:", error);
      alert("重複検出に失敗しました");
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const handleExport = async (format: "bibtex" | "csl-json", selectedOnly: boolean = false) => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      // 選択された論文IDを取得
      let paperIdsParam = "";
      if (selectedOnly && selectedPaperIds.size > 0) {
        paperIdsParam = `&paperIds=${Array.from(selectedPaperIds).join(",")}`;
      }
      
      const response = await fetch(
        `/api/library/export?userId=${DEMO_USER_ID}&format=${format}${paperIdsParam}`
      );

      if (!response.ok) {
        throw new Error("エクスポートに失敗しました");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `library-${Date.now()}.${format === "bibtex" ? "bib" : "json"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const count = selectedOnly && selectedPaperIds.size > 0 ? selectedPaperIds.size : papers.length;
      toast.success(
        `${format === "bibtex" ? "BibTeX" : "CSL-JSON"}形式で${count}件の論文をエクスポートしました`
      );
    } catch (error) {
      console.error("Export error:", error);
      toast.error("エクスポートに失敗しました");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      let format: "bibtex" | "csl-json" = "bibtex";
      let content: string;

      if (fileExtension === "json") {
        format = "csl-json";
        content = await file.text();
      } else {
        format = "bibtex";
        content = await file.text();
      }

      const response = await fetch("/api/library/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          format,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "インポートに失敗しました");
      }

      toast.success(
        `インポート完了: ${data.results.success}件追加、${data.results.skipped}件スキップ、${data.results.failed}件失敗`
      );

      // ライブラリを再読み込み
      const libraryResponse = await fetch(`/api/library?userId=${DEMO_USER_ID}`);
      const libraryData = await libraryResponse.json();
      if (libraryData.success && libraryData.papers) {
        setPapers(libraryData.papers);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        `インポートに失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setImporting(false);
      // ファイル入力をリセット
      event.target.value = "";
    }
  };


  return (
    <div className="relative min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-6 py-6">
        {/* 中央の陰影アイコン */}
        <section className="mb-6">
          <div className="flex items-center justify-center">
            <div className="flex-shrink-0" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))', opacity: 0.15 }}>
              <svg width="80" height="80" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" fill="none" className="text-[var(--color-text)]"/>
                <path d="M12 10C12 10 14 9 16 9C18 9 20 10 20 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
                <path d="M12 10Q12 13 12 16Q12 19 12 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
                <path d="M20 10Q20 13 20 16Q20 19 20 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
                <path d="M12 14Q16 13 20 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
                <path d="M12 18Q16 17 20 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="text-[var(--color-text)]"/>
              </svg>
            </div>
          </div>
        </section>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-sm">
              論文 {summaryStats.paperCount} 件 / レビュー{" "}
              {summaryStats.reviewCount} 件
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-sm">
              平均引用数 {summaryStats.citationAverage.toLocaleString()} 件
            </div>
            <button
              onClick={handleFindDuplicates}
              disabled={loadingDuplicates}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-background)] disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              {loadingDuplicates ? "検出中..." : "重複検出"}
            </button>
            {/* エクスポート/インポートボタン */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exporting || papers.length === 0}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-background)] disabled:opacity-50"
                  title="BibTeXまたはCSL-JSON形式でエクスポート"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? "エクスポート中..." : "エクスポート"}
                </button>
                {showExportMenu && !exporting && papers.length > 0 && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                      <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                        全論文をエクスポート
                      </div>
                      <button
                        onClick={() => handleExport("bibtex", false)}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-background)]"
                      >
                        BibTeX形式 (.bib)
                      </button>
                      <button
                        onClick={() => handleExport("csl-json", false)}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-background)] border-b border-[var(--color-border)]"
                      >
                        CSL-JSON形式 (.json)
                      </button>
                      {selectedPaperIds.size > 0 && (
                        <>
                          <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                            選択した論文のみ ({selectedPaperIds.size}件)
                          </div>
                          <button
                            onClick={() => handleExport("bibtex", true)}
                            className="w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-background)]"
                          >
                            BibTeX形式 (.bib)
                          </button>
                          <button
                            onClick={() => handleExport("csl-json", true)}
                            className="w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-background)]"
                          >
                            CSL-JSON形式 (.json)
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-background)] cursor-pointer disabled:opacity-50">
                <Upload className="h-4 w-4" />
                {importing ? "インポート中..." : "インポート"}
                <input
                  type="file"
                  accept=".bib,.json"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* 検索とフィルター */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* 検索バー */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  placeholder="論文を検索... (タイトル、著者、要約、ジャーナル)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] pl-10 pr-4 py-2 text-sm text-[var(--color-text)] shadow-inner focus:border-[var(--color-primary)] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  showFilters
                    ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                    : "bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
                }`}
              >
                <Filter className="h-4 w-4" />
                フィルター
              </button>
            </div>

            {/* フィルターオプション */}
            {showFilters && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {/* 年フィルター */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                      年
                    </label>
                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
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
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                      ジャーナル
                    </label>
                    <select
                      value={venueFilter}
                      onChange={(e) => setVenueFilter(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                    >
                      <option value="">すべてのジャーナル</option>
                      {availableVenues.map((venue) => (
                        <option key={venue} value={venue}>
                          {venue}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 追加日時フィルター */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                      追加日
                    </label>
                    <select
                      value={addedDateFilter}
                      onChange={(e) =>
                        setAddedDateFilter(
                          e.target.value as "all" | "7days" | "30days" | "365days"
                        )
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                    >
                      <option value="all">期間を指定しない</option>
                      <option value="7days">直近7日間</option>
                      <option value="30days">直近30日間</option>
                      <option value="365days">直近1年間</option>
                    </select>
                  </div>

                  {/* お気に入りフィルター */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                      お気に入り
                    </label>
                    <select
                      value={favoriteFilter === null ? "all" : favoriteFilter ? "favorite" : "not-favorite"}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFavoriteFilter(
                          value === "all" ? null : value === "favorite"
                        );
                      }}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                    >
                      <option value="all">すべて</option>
                      <option value="favorite">お気に入りのみ</option>
                      <option value="not-favorite">お気に入り以外</option>
                    </select>
                  </div>

                  {/* ソート */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                      並び順
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(
                            e.target.value as
                              | "createdAt"
                              | "title"
                              | "year"
                              | "citationCount"
                              | "venue"
                          )
                        }
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                      >
                        <option value="createdAt">追加日</option>
                        <option value="year">発行年</option>
                        <option value="title">タイトル（A-Z）</option>
                        <option value="venue">ジャーナル（A-Z）</option>
                        <option value="citationCount">引用数</option>
                      </select>
                      <button
                        type="button"
                        onClick={toggleSortDirection}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        {sortDirection === "desc" ? "降順" : "昇順"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* タグフィルター */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-[var(--color-text-secondary)]">
                    タグ
                  </label>
                  {tags.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                      まだタグが登録されていません。タグを追加するとここから絞り込みができます。
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const checked = tagFilter.includes(tag);
                        return (
                          <label
                            key={tag}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                              checked
                                ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              value={tag}
                              checked={checked}
                              onChange={() => toggleTagFilter(tag)}
                              className="h-3 w-3 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            {tag}
                          </label>
                        );
                      })}
                      {tagFilter.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTagFilter([])}
                          className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                        >
                          選択をクリア
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-medium hover:bg-[var(--color-background)]"
                  >
                    フィルターをリセット
                  </button>
                </div>
              </div>
            )}

            {/* 検索結果の統計 */}
            {searchQuery ||
            yearFilter ||
            venueFilter ||
            tagFilter.length > 0 ||
            addedDateFilter !== "all" ? (
              <div className="text-sm text-[var(--color-text-secondary)]">
                {filteredAndSortedPapers.length} 件の論文が見つかりました
                {papers.length !== filteredAndSortedPapers.length && (
                  <span className="text-[var(--color-text-secondary)] opacity-60">
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
                  ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
              }`}
            >
              論文 ({papers.length})
            </button>
            <button
              onClick={() => setTab("reviews")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === "reviews"
                  ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
              }`}
            >
              レビュー ({reviews.length})
            </button>
          </div>

          {/* 表示モード切り替え */}
          {tab === "papers" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-text-secondary)]">表示:</span>
              <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
                <button
                  onClick={() => setViewMode("card")}
                  className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition ${
                    viewMode === "card"
                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" />
                  カード
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition ${
                    viewMode === "table"
                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                  }`}
                >
                  <List className="h-3 w-3" />
                  テーブル
                </button>
                <button
                  onClick={() => setViewMode("board")}
                  className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition ${
                    viewMode === "board"
                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                  }`}
                >
                  <Columns className="h-3 w-3" />
                  ボード
                </button>
              </div>
              <button
                onClick={() => setShowLayoutSettings(!showLayoutSettings)}
                className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-background)]"
              >
                <Settings className="h-3 w-3" />
                レイアウト設定
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-[var(--color-text-secondary)]">読み込み中...</div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-[var(--color-error)]/10 p-4 text-[var(--color-error)]">
            エラー: {error}
          </div>
        )}

        {!loading && !error && tab === "papers" && (
          <>
            {/* レイアウト設定パネル */}
            {showLayoutSettings && (
              <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    レイアウト設定
                  </h3>
                  <button
                    onClick={() => setShowLayoutSettings(false)}
                    className="rounded-full p-1 hover:bg-[var(--color-background)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* レイアウトタイプの選択 */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                    レイアウト
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setViewMode("card")}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                        viewMode === "card"
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                          : "border-[var(--color-border)] hover:bg-[var(--color-background)]"
                      }`}
                    >
                      <LayoutGrid className="h-6 w-6" />
                      <span className="text-xs font-medium">カード</span>
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                        viewMode === "table"
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                          : "border-[var(--color-border)] hover:bg-[var(--color-background)]"
                      }`}
                    >
                      <List className="h-6 w-6" />
                      <span className="text-xs font-medium">テーブル</span>
                    </button>
                    <button
                      onClick={() => setViewMode("board")}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                        viewMode === "board"
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                          : "border-[var(--color-border)] hover:bg-[var(--color-background)]"
                      }`}
                    >
                      <Columns className="h-6 w-6" />
                      <span className="text-xs font-medium">ボード</span>
                    </button>
                  </div>
                </div>

                {/* 一般設定 */}
                <div className="space-y-4 mb-6">
                  <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                    表示設定
                  </h4>
                  
                  {/* ページアイコンを表示 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text)]">ページアイコンを表示</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPageIcon}
                        onChange={(e) => setShowPageIcon(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                    </label>
                  </div>

                  {/* すべてのコンテンツを右端で折りたたむ */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text)]">すべてのコンテンツを右端で折りたたむ</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={foldContentAtRight}
                        onChange={(e) => setFoldContentAtRight(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                    </label>
                  </div>

                  {/* ページの開き方 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text)]">ページの開き方</span>
                    <select
                      value={pageOpenMode}
                      onChange={(e) => setPageOpenMode(e.target.value as any)}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                    >
                      <option value="fullscreen">全画面</option>
                      <option value="popup">ポップアップ</option>
                      <option value="sidepeek">サイドピーク</option>
                    </select>
                  </div>

                  {/* 読み込み制限 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text)]">読み込み制限</span>
                    <select
                      value={loadLimit}
                      onChange={(e) => setLoadLimit(Number(e.target.value))}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                {/* ボード特有の設定 */}
                {viewMode === "board" && (
                  <div className="space-y-4 mb-6">
                    <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                      ボード設定
                    </h4>
                    
                    {/* グループ化（必須） */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)] font-semibold">グループ化 *</span>
                      <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as any)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                      >
                        <option value="none">なし</option>
                        <option value="tag">タグ</option>
                        <option value="year">年</option>
                        <option value="venue">Journal</option>
                      </select>
                    </div>

                    {/* 列の背景色 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)]">列の背景色</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showColumnBackground}
                          onChange={(e) => setShowColumnBackground(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                      </label>
                    </div>

                    {/* カードサイズ */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)]">カードサイズ</span>
                      <select
                        value={cardSize}
                        onChange={(e) => setCardSize(e.target.value as any)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                      >
                        <option value="xl">特大</option>
                        <option value="large">大</option>
                        <option value="medium">中</option>
                        <option value="small">小</option>
                      </select>
                    </div>

                    {/* テキスト表示方法 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)]">テキスト表示</span>
                      <select
                        value={textDisplayMode}
                        onChange={(e) => setTextDisplayMode(e.target.value as any)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                      >
                        <option value="truncate">省略</option>
                        <option value="wrap">折り返し</option>
                      </select>
                    </div>

                    {/* カードプレビュー */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)]">カードプレビュー</span>
                      <select
                        value={cardPreview}
                        onChange={(e) => setCardPreview(e.target.value as any)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                      >
                        <option value="thumbnail">サムネ画像</option>
                        <option value="none">なし</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </div>

                    {/* 表示項目の選択 */}
                    <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                      <h5 className="text-sm font-semibold text-[var(--color-text)] mb-2">
                        表示項目
                      </h5>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.thumbnail}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                thumbnail: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">サムネイル画像</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.title}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                title: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">タイトル</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.authors}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                authors: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">著者</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.venue}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                venue: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">ジャーナル</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.year}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                year: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">年</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.tags}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                tags: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">タグ</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.aiSummary}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                aiSummary: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">AI解説マーク</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.tldr}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                tldr: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">TL;DR要約</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.favorite}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                favorite: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">お気に入りマーク</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.citationCount}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                citationCount: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">引用数</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* カード特有の設定 */}
                {viewMode === "card" && (
                  <div className="space-y-4 mb-6">
                    <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                      カード設定
                    </h4>
                    
                    {/* カードサイズ */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)]">カードサイズ</span>
                      <select
                        value={cardSize}
                        onChange={(e) => setCardSize(e.target.value as any)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                      >
                        <option value="xl">特大</option>
                        <option value="large">大</option>
                        <option value="medium">中</option>
                        <option value="small">小</option>
                      </select>
                    </div>

                    {/* テキスト表示方法 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)]">テキスト表示</span>
                      <select
                        value={textDisplayMode}
                        onChange={(e) => setTextDisplayMode(e.target.value as any)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                      >
                        <option value="truncate">省略</option>
                        <option value="wrap">折り返し</option>
                      </select>
                    </div>

                    {/* カードプレビュー */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text)]">カードプレビュー</span>
                      <select
                        value={cardPreview}
                        onChange={(e) => setCardPreview(e.target.value as any)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm text-[var(--color-text)]"
                      >
                        <option value="thumbnail">サムネ画像</option>
                        <option value="none">なし</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </div>

                    {/* 表示項目の選択 */}
                    <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                      <h5 className="text-sm font-semibold text-[var(--color-text)] mb-2">
                        表示項目
                      </h5>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.thumbnail}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                thumbnail: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">サムネイル画像</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.title}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                title: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">タイトル</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.authors}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                authors: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">著者</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.venue}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                venue: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">ジャーナル</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.year}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                year: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">年</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.tags}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                tags: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">タグ</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.aiSummary}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                aiSummary: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">AI解説マーク</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.tldr}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                tldr: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">TL;DR要約</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.favorite}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                favorite: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">お気に入りマーク</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCardFields.citationCount}
                            onChange={(e) =>
                              setVisibleCardFields((prev) => ({
                                ...prev,
                                citationCount: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--color-text)]">引用数</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 一括操作ツールバー */}
            {selectedPaperIds.size > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)]/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {selectedPaperIds.size}件の論文を選択中
                  </span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  >
                    選択を解除
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const tag = prompt("追加するタグを入力してください:");
                      if (tag) {
                        handleBulkAddTag(tag);
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-background)]"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    タグを追加
                  </button>
                  <button
                    onClick={() => {
                      const tag = prompt("削除するタグを入力してください:");
                      if (tag) {
                        handleBulkRemoveTag(tag);
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-background)]"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    タグを削除
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-error)] bg-[var(--color-error)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    削除
                  </button>
                </div>
              </div>
            )}

            {/* 全選択/全解除ボタン */}
            {filteredAndSortedPapers.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={
                    selectedPaperIds.size === filteredAndSortedPapers.length
                      ? handleDeselectAll
                      : handleSelectAll
                  }
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-background)]"
                >
                  {selectedPaperIds.size === filteredAndSortedPapers.length ? (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      全解除
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4" />
                      全選択
                    </>
                  )}
                </button>
              </div>
            )}

            {filteredAndSortedPapers.length === 0 && (
              <div className="text-[var(--color-text-secondary)]">
                {papers.length === 0
                  ? "保存された論文はありません。"
                  : "検索条件に一致する論文が見つかりませんでした。"}
              </div>
            )}

            {/* カードビュー */}
            {viewMode === "card" && (
              <div className={`grid gap-4 ${getCardGridClasses()}`}>
                {filteredAndSortedPapers.slice(0, loadLimit).map((paper) => {
                  return renderPaperCard(paper, false, cardSize, textDisplayMode, visibleCardFields);
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
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeletePaper}
                selectedPaperIds={selectedPaperIds}
                onTogglePaperSelection={handleTogglePaperSelection}
              />
            )}

            {/* ボードビュー */}
            {viewMode === "board" && (
              <div className={`grid ${
                cardSize === "xl"
                  ? "grid-cols-1 gap-4"
                  : cardSize === "large"
                  ? "grid-cols-2 gap-4"
                  : cardSize === "small"
                  ? "grid-cols-5 gap-0"
                  : "grid-cols-3 gap-4"
              } overflow-x-auto pb-4`}>
                {Object.entries(groupedPapers).map(([groupName, papers]) => (
                  <div 
                    key={groupName} 
                    className={`${
                      cardSize === "small" 
                        ? "min-w-0 w-full" 
                        : cardSize === "xl"
                        ? "min-w-full"
                        : "min-w-80"
                    } flex-shrink-0 ${showColumnBackground ? "bg-[var(--color-background)] rounded-lg p-4" : ""} ${cardSize === "small" ? "border-r border-[var(--color-border)] last:border-r-0" : ""}`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[var(--color-text-secondary)]" />
                      <h3 className="font-semibold text-[var(--color-text)]">
                        {groupName}
                      </h3>
                      <span className="rounded-full bg-[var(--color-background)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                        {papers.length}
                      </span>
                    </div>
                    <div className={`${cardSize === "small" ? "space-y-0" : "space-y-3"}`}>
                      {papers.slice(0, loadLimit).map((paper) => {
                        return renderPaperCard(paper, true, cardSize, textDisplayMode, visibleCardFields);
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

        {/* 重複論文モーダル */}
        {showDuplicates && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--color-text)]">
                  重複論文 ({duplicates.length} グループ)
                </h2>
                <button
                  onClick={() => setShowDuplicates(false)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {duplicates.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">
                  重複している論文は見つかりませんでした。
                </div>
              ) : (
                <div className="space-y-6">
                  {duplicates.map((group, groupIndex) => (
                    <div
                      key={groupIndex}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4"
                    >
                      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                        グループ {groupIndex + 1} ({group.papers.length} 件)
                      </h3>
                      <div className="space-y-3">
                        {group.papers.map((paper: any) => {
                          const linkedFrom = paper.linkedFrom || [];
                          const hasLinks = linkedFrom.length > 0;

                          return (
                            <div
                              key={paper.id}
                              className={`flex items-start gap-4 rounded-lg border p-4 ${
                                hasLinks
                                  ? "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10"
                                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-start gap-2 mb-2">
                                  <h4 className="font-semibold text-[var(--color-text)]">
                                    {paper.title}
                                  </h4>
                                  {hasLinks && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                                      <LinkIcon className="h-3 w-3" />
                                      リンクあり
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
                                  <div>著者: {paper.authors || "不明"}</div>
                                  <div>年: {paper.year || "不明"}</div>
                                  <div>ジャーナル: {paper.venue || "不明"}</div>
                                  <div>
                                    保存日:{" "}
                                    {new Date(
                                      paper.createdAt || paper.created_at
                                    ).toLocaleDateString("ja-JP")}
                                  </div>
                                  {hasLinks && (
                                    <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                                      <div className="font-semibold mb-1">
                                        リンク元:
                                      </div>
                                      {linkedFrom.map(
                                        (link: any, linkIndex: number) => (
                                          <div
                                            key={linkIndex}
                                            className="text-xs mb-1"
                                          >
                                            {link.type === "manuscript" && (
                                              <a
                                                href={`/manuscript/${link.worksheetId}/paragraphs/${link.paragraphId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[var(--color-primary)] hover:underline"
                                              >
                                                Manuscript: {link.worksheetId} / {link.paragraphId}
                                              </a>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeletePaper(paper.id)}
                                className="flex items-center gap-1 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20"
                              >
                                <Trash2 className="h-3 w-3" />
                                削除
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedPaper && (
          <PaperDetailPanel
            paper={
              {
                ...selectedPaper,
                userId: DEMO_USER_ID,
                pdfUrl:
                  (selectedPaper as any)?.pdfUrl ??
                  (selectedPaper as any)?.pdf_url ??
                  null,
                htmlUrl:
                  (selectedPaper as any)?.htmlUrl ??
                  (selectedPaper as any)?.html_url ??
                  null,
                notes: buildNoteFromHighlights(highlights),
                createdAt:
                  (selectedPaper as any)?.createdAt ??
                  (selectedPaper as any)?.created_at ??
                  new Date().toISOString(),
              } as any
            }
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
            onPreviewUpdate={(paperId, payload) => {
              setPapers((prev) =>
                prev.map((paper) =>
                  paper.id === paperId
                    ? {
                        ...paper,
                        pdfUrl: payload.pdfUrl ?? (paper as any)?.pdfUrl ?? (paper as any)?.pdf_url ?? null,
                        pdf_url: payload.pdfUrl ?? (paper as any)?.pdf_url ?? null,
                        htmlUrl: payload.htmlUrl ?? (paper as any)?.htmlUrl ?? (paper as any)?.html_url ?? null,
                        html_url: payload.htmlUrl ?? (paper as any)?.html_url ?? null,
                        pdfStoragePath:
                          payload.pdfStoragePath ??
                          (paper as any)?.pdfStoragePath ??
                          (paper as any)?.pdf_storage_path ??
                          null,
                        pdf_storage_path:
                          payload.pdfStoragePath ??
                          (paper as any)?.pdf_storage_path ??
                          null,
                        pdfFileName:
                          payload.pdfFileName ??
                          (paper as any)?.pdfFileName ??
                          (paper as any)?.pdf_file_name ??
                          null,
                        pdf_file_name:
                          payload.pdfFileName ??
                          (paper as any)?.pdf_file_name ??
                          null,
                      }
                    : paper
                )
              );
              setSelectedPaper((prev) =>
                prev && prev.id === paperId
                  ? {
                      ...prev,
                      pdfUrl: payload.pdfUrl ?? (prev as any)?.pdfUrl ?? (prev as any)?.pdf_url ?? null,
                      htmlUrl: payload.htmlUrl ?? (prev as any)?.htmlUrl ?? (prev as any)?.html_url ?? null,
                      pdfStoragePath:
                        payload.pdfStoragePath ??
                        (prev as any)?.pdfStoragePath ??
                        (prev as any)?.pdf_storage_path ??
                        null,
                      pdfFileName:
                        payload.pdfFileName ??
                        (prev as any)?.pdfFileName ??
                        (prev as any)?.pdf_file_name ??
                        null,
                    }
                  : prev
              );
            }}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onCreateTag={handleCreateTag}
            availableTags={tags}
            allPapers={papers as any}
          />
        )}
      </main>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center">読み込み中...</div>}>
      <LibraryPageContent />
    </Suspense>
  );
}

function getPaperCreatedAt(paper: Paper | LibraryPaper): Date | null {
  const raw =
    (paper as any)?.createdAt ??
    (paper as any)?.created_at ??
    null;
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPaperTags(paper: Paper | LibraryPaper): string[] {
  const raw = (paper as any)?.tags;
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.filter((tag): tag is string => typeof tag === "string");
  }

  return [];
}

function buildHighlights(paper: Paper | LibraryPaper): string[] {
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
  if ((paper as any)?.citation_count ?? paper.citationCount) {
    const count = (paper as any)?.citation_count ?? paper.citationCount;
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
