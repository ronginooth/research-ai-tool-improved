"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import {
  MoreVertical,
  Plus,
  Trash2,
  GripVertical,
  X,
  FileText,
  List,
  Download,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getAvailableFormats,
  getFormatById,
  getDefaultFormat,
  type CitationFormatConfig,
} from "@/lib/manuscript/citation-formats";
import {
  formatCitation,
  sortCitationsAlphabetically,
  sortCitationsByAppearance,
  type PaperData,
} from "@/lib/manuscript/citation-formatter";
import {
  extractFieldCodes,
  renderCitationField,
  getInTextFormatForStyle,
} from "@/lib/manuscript/citation-field";
import { getStyleById, getDefaultStyle } from "@/lib/manuscript/citation-styles";

const DEFAULT_USER = "demo-user-123";

interface Paragraph {
  id: string;
  paragraph_number: string;
  section_type: string;
  title: string;
  description: string;
  content: string;
  status: string;
  word_count: number;
}

interface Worksheet {
  id: string;
  title: string;
  content: string;
  structure: any;
}

// SortableParagraphコンポーネント
function SortableParagraph({
  paragraph,
  worksheetId,
  menuOpenId,
  onMenuClick,
  onAddAbove,
  onAddBelow,
  onDelete,
}: {
  paragraph: Paragraph;
  worksheetId: string;
  menuOpenId: string | null;
  onMenuClick: (id: string | null) => void;
  onAddAbove: (id: string) => void;
  onAddBelow: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: paragraph.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "✅";
      case "in_progress":
        return "⏳";
      default:
        return "❌";
    }
  };

  const getSectionName = (sectionType: string) => {
    const names: Record<string, string> = {
      introduction: "Introduction",
      methods: "Methods",
      results: "Results",
      discussion: "Discussion",
    };
    return names[sectionType] || sectionType;
  };

  // セクションタイプに応じた色を取得（CSS変数を使用）
  const getSectionColor = (sectionType: string) => {
    const colors: Record<string, string> = {
      introduction: "var(--color-primary)", // 青系
      methods: "var(--color-success)", // 緑系
      results: "var(--color-warning)", // オレンジ/アンバー系
      discussion: "var(--color-accent)", // 紫系
    };
    return colors[sectionType] || "var(--color-primary)";
  };

  return (
    <div className="flex items-start gap-3">
      {/* パラグラフ番号（カードの外側、固定位置） */}
      <div className="flex-shrink-0 w-12 text-center pt-4">
        <span className="text-lg font-bold text-[var(--color-text-secondary)]">
          {paragraph.paragraph_number}
        </span>
      </div>

      {/* パラグラフカード */}
      <div
        ref={setNodeRef}
        style={style}
        className="flex-1 border border-[var(--color-border)] rounded-lg p-4 hover:shadow-md transition-shadow relative bg-[var(--color-surface)]"
      >
        {/* ドラッグハンドル */}
        <div
          {...attributes}
          {...listeners}
          className="absolute left-2 top-2 cursor-grab active:cursor-grabbing text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        {/* セクション名（右上、三点メニューの左） */}
        <div className="absolute top-2 right-10">
          <span
            className="px-3 py-1 rounded-md text-xs font-bold text-[var(--color-surface)]"
            style={{ backgroundColor: getSectionColor(paragraph.section_type) }}
          >
            {getSectionName(paragraph.section_type)}
          </span>
        </div>

        {/* 三点メニューボタン */}
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick(menuOpenId === paragraph.id ? null : paragraph.id);
            }}
            className="p-1 rounded hover:bg-[var(--color-background)]"
          >
            <MoreVertical className="h-5 w-5 text-[var(--color-text-secondary)]" />
          </button>

          {/* メニュードロップダウン */}
          {menuOpenId === paragraph.id && (
            <div className="absolute right-0 mt-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  onAddAbove(paragraph.id);
                  onMenuClick(null);
                }}
                className="w-full text-left px-4 py-2 hover:bg-[var(--color-background)] flex items-center gap-2 text-[var(--color-text)]"
              >
                <Plus className="h-4 w-4" />
                上に追加
              </button>
              <button
                onClick={() => {
                  onAddBelow(paragraph.id);
                  onMenuClick(null);
                }}
                className="w-full text-left px-4 py-2 hover:bg-[var(--color-background)] flex items-center gap-2 text-[var(--color-text)]"
              >
                <Plus className="h-4 w-4" />
                下に追加
              </button>
              <button
                onClick={() => {
                  if (confirm("このパラグラフを削除しますか？")) {
                    onDelete(paragraph.id);
                  }
                  onMenuClick(null);
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                削除
              </button>
            </div>
          )}
        </div>

        {/* パラグラフ内容 */}
        <div className="flex justify-between items-start pl-8 pr-24">
          <div className="flex-1">
            <Link
              href={`/manuscript/${worksheetId}/paragraphs/${paragraph.id}`}
              className="text-lg font-semibold text-[var(--color-primary)] hover:underline"
            >
              {paragraph.title}
            </Link>
            {paragraph.content && (
              <div className="mt-2 text-sm text-[var(--color-text)] whitespace-pre-wrap">
                {paragraph.content}
              </div>
            )}
            {/* ステータス、単語数などの情報を最後に表示 */}
            <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
              <span className="text-[var(--color-text)]">
                {getStatusIcon(paragraph.status)} {paragraph.status}
              </span>
              {paragraph.word_count > 0 && (
                <span>
                  {paragraph.word_count} words
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorksheetDetailPage() {
  const params = useParams();
  const worksheetId = params.worksheetId as string;

  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPosition, setAddPosition] = useState<"above" | "below" | null>(null);
  const [targetParagraphId, setTargetParagraphId] = useState<string | null>(null);
  const [newParagraphTitle, setNewParagraphTitle] = useState("");
  const [newParagraphDescription, setNewParagraphDescription] = useState("");
  const [newParagraphSectionType, setNewParagraphSectionType] = useState("introduction");
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "document">("list");
  const [citations, setCitations] = useState<any[]>([]);
  const [citationFormat, setCitationFormat] = useState<string>("nature");
  const [citationOrder, setCitationOrder] = useState<"alphabetical" | "appearance">("alphabetical");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (worksheetId) {
      fetchWorksheet();
      fetchParagraphs();
      fetchCitations();
    }
  }, [worksheetId]);

  useEffect(() => {
    if (viewMode === "document") {
      fetchCitations();
    }
  }, [viewMode, worksheetId]);

  const fetchWorksheet = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/worksheets/${worksheetId}?userId=${DEFAULT_USER}`
      );
      const data = await response.json();
      setWorksheet(data.worksheet);
    } catch (error) {
      console.error("Failed to fetch worksheet:", error);
    }
  };

  const fetchParagraphs = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/paragraphs?worksheetId=${worksheetId}&userId=${DEFAULT_USER}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Failed to fetch paragraphs:", data.error || data);
        alert(`パラグラフの取得に失敗しました: ${data.error || "不明なエラー"}`);
        return;
      }

      console.log(`[Frontend] Fetched ${data.paragraphs?.length || 0} paragraphs`);
      setParagraphs(data.paragraphs || []);
    } catch (error) {
      console.error("Failed to fetch paragraphs:", error);
      alert("パラグラフの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const fetchCitations = async () => {
    try {
      const response = await fetch(
        `/api/manuscript/worksheets/${worksheetId}/citations?userId=${DEFAULT_USER}`
      );
      if (response.ok) {
        const data = await response.json();
        setCitations(data.citations || []);
      }
    } catch (error) {
      console.error("Failed to fetch citations:", error);
    }
  };

  // 引用をpaper_idで重複排除し、一意の論文リストを作成
  const getUniqueCitations = (citations: any[]) => {
    const citationsByPaper = new Map<string, any[]>();
    
    citations.forEach((citation) => {
      const paperId = citation.paper?.id || citation.paper_id;
      if (!paperId) {
        console.warn("Citation without paperId in getUniqueCitations:", citation);
        return;
      }
      
      if (!citationsByPaper.has(paperId)) {
        citationsByPaper.set(paperId, []);
      }
      citationsByPaper.get(paperId)!.push(citation);
    });

    // 出現順の場合、最初に出現した引用を基準に番号を割り当て
    const uniqueCitations = Array.from(citationsByPaper.values()).map((citationGroup) => {
      // パラグラフ番号とcitation_orderでソート
      const sorted = citationGroup.sort((a: any, b: any) => {
        const paraA = parseInt(
          (a.paragraph?.paragraph_number || "").replace("P", "") || "0"
        );
        const paraB = parseInt(
          (b.paragraph?.paragraph_number || "").replace("P", "") || "0"
        );
        if (paraA !== paraB) return paraA - paraB;
        return (a.citation_order || 0) - (b.citation_order || 0);
      });
      const firstCitation = sorted[0]; // 最初に出現した引用を返す
      
      // paragraphとcitation_orderが含まれていることを確認
      if (!firstCitation.paragraph || firstCitation.citation_order === undefined) {
        console.warn("Citation missing paragraph or citation_order:", firstCitation);
      }
      
      return firstCitation;
    });

    return uniqueCitations.filter((citation) => {
      // paperIdが存在し、paperオブジェクトが存在する引用のみを返す
      const paperId = citation.paper?.id || citation.paper_id;
      return paperId && citation.paper;
    });
  };

  // 出現順/アルファベット順に応じて、各論文に一意の番号を割り当て
  const getCitationNumberMap = (
    citations: any[],
    order: "alphabetical" | "appearance"
  ): Map<string, number> => {
    const uniqueCitations = getUniqueCitations(citations);
    let sortedCitations: any[];

    if (order === "alphabetical") {
      sortedCitations = sortCitationsAlphabetically(uniqueCitations);
    } else {
      // 出現順の場合、paragraphとcitation_orderが必要
      const citationsWithParagraph = uniqueCitations.filter((c: any) => 
        c.paragraph && c.citation_order !== undefined
      );
      
      if (citationsWithParagraph.length > 0) {
        sortedCitations = sortCitationsByAppearance(citationsWithParagraph);
      } else {
        // フォールバック: 元のcitationsから再試行
        const originalWithParagraph = citations.filter((c: any) => 
          c.paragraph && c.citation_order !== undefined
        );
        
        if (originalWithParagraph.length > 0) {
          const reUnique = getUniqueCitations(originalWithParagraph);
          sortedCitations = sortCitationsByAppearance(reUnique);
        } else {
          // それでもダメな場合はアルファベット順
          console.warn("No citations with paragraph/citation_order found in getCitationNumberMap, falling back to alphabetical");
          sortedCitations = sortCitationsAlphabetically(uniqueCitations);
        }
      }
    }

    const citationNumberMap = new Map<string, number>();
    sortedCitations.forEach((citation, index) => {
      const paperId = citation.paper?.id || citation.paper_id;
      // paperIdが存在しない場合はスキップ
      if (!paperId) {
        console.warn("Citation without paperId in getCitationNumberMap:", citation);
        return;
      }
      citationNumberMap.set(paperId, index + 1);
    });

    return citationNumberMap;
  };

  // パラグラフ内容にフィールドコードをレンダリング
  const renderParagraphWithFieldCodes = (
    content: string,
    paragraphId: string,
    citationNumberMap: Map<string, number>
  ): string => {
    // フィールドコードを抽出
    const fieldCodes = extractFieldCodes(content);
    if (fieldCodes.length === 0) {
      // フィールドコードがない場合は、従来の方法で引用番号を挿入（後方互換性）
      return insertCitationNumbersLegacy(content, paragraphId, citationNumberMap);
    }

    // 引用スタイルを取得
    const style = getStyleById(citationFormat) || getDefaultStyle();
    
    // 引用マップを作成
    const citationMap = new Map<string, { paper: PaperData; citationId: string }>();
    citations.forEach((citation) => {
      if (citation.paper && citation.paper.id) {
        const paperData: PaperData = {
          title: citation.paper.title || "",
          authors: citation.paper.authors || "",
          year: citation.paper.year || new Date().getFullYear(),
          venue: citation.paper.venue || "",
          doi: citation.paper.doi || null,
          volume: citation.paper.volume || null,
          pages: citation.paper.pages || null,
        };
        citationMap.set(citation.id, {
          paper: paperData,
          citationId: citation.id,
        });
      }
    });

    // フィールドコードをレンダリング
    const config = getInTextFormatForStyle(citationFormat, citationOrder);
    let renderedContent = content;
    
    // フィールドコードを後ろから前に処理（インデックスがずれないように）
    const sortedFieldCodes = [...fieldCodes].sort(
      (a, b) => b.startIndex - a.startIndex
    );

    sortedFieldCodes.forEach((fieldCode) => {
      const citation = citationMap.get(fieldCode.citationId);
      if (citation) {
        // paperIdはcitationオブジェクトから取得
        const citationObj = citations.find((c) => c.id === fieldCode.citationId);
        const paperId = citationObj?.paper?.id || citationObj?.paper_id || fieldCode.paperId;
        const number = citationNumberMap.get(paperId);
        const rendered = renderCitationField(
          fieldCode,
          citation.paper,
          style,
          number,
          config
        );

        // フィールドコードをレンダリング結果で置き換え
        renderedContent =
          renderedContent.substring(0, fieldCode.startIndex) +
          rendered +
          renderedContent.substring(fieldCode.endIndex);
      }
    });

    return renderedContent;
  };

  // 従来の方法で引用番号を挿入（後方互換性のため）
  const insertCitationNumbersLegacy = (
    content: string,
    paragraphId: string,
    citationNumberMap: Map<string, number>
  ): string => {
    // このパラグラフの引用を取得
    const paragraphCitations = citations.filter(
      (c) => c.paragraph?.id === paragraphId
    );

    if (paragraphCitations.length === 0 || citationOrder !== "appearance") {
      return content;
    }

    // パラグラフの引用をcitation_orderでソート
    const sortedCitations = [...paragraphCitations].sort(
      (a, b) => (a.citation_order || 0) - (b.citation_order || 0)
    );

    // 引用を番号で置き換え
    let result = content;

    sortedCitations.forEach((citation) => {
      const paperId = citation.paper?.id || citation.paper_id;
      const number = citationNumberMap.get(paperId);

      if (number && citation.paper) {
        const title = citation.paper.title || "";
        const authors = citation.paper.authors || "";
        const year = citation.paper.year;

        // パターン1: [タイトル] 形式
        if (title) {
          const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          result = result.replace(
            new RegExp(`\\[${escapedTitle}\\]`, "gi"),
            `[${number}]`
          );
        }

        // パターン2: (著者名, 年) 形式
        if (authors && year) {
          const firstAuthor = authors.split(",")[0].trim();
          const escapedAuthor = firstAuthor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          result = result.replace(
            new RegExp(`\\(${escapedAuthor}[,\\s]+${year}\\)`, "gi"),
            `[${number}]`
          );
        }

        // パターン3: citation_context が存在する場合、それを使用
        if (citation.citation_context) {
          const escapedContext = citation.citation_context.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          result = result.replace(
            new RegExp(escapedContext, "gi"),
            `[${number}]`
          );
        }
      }
    });

    return result;
  };

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpenId(null);
    };

    if (menuOpenId) {
      // 少し遅延させて、メニューボタンのクリックイベントが先に処理されるようにする
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [menuOpenId]);

  const handleAddAbove = (id: string) => {
    setAddPosition("above");
    setTargetParagraphId(id);
    setShowAddModal(true);
  };

  const handleAddBelow = (id: string) => {
    setAddPosition("below");
    setTargetParagraphId(id);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(
        `/api/manuscript/paragraphs/${id}?userId=${DEFAULT_USER}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(`削除に失敗しました: ${data.error || "不明なエラー"}`);
        return;
      }

      await fetchParagraphs();
    } catch (error) {
      console.error("Failed to delete paragraph:", error);
      alert("パラグラフの削除に失敗しました");
    }
  };

  const handleRenumber = async () => {
    if (!confirm("すべてのパラグラフ番号を再採番しますか？（P1, P2, P3...の順に修正されます）")) {
      return;
    }

    setIsRenumbering(true);
    try {
      const response = await fetch("/api/manuscript/paragraphs/renumber", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEFAULT_USER,
          worksheetId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(`再採番に失敗しました: ${data.error || "不明なエラー"}`);
        return;
      }

      const result = await response.json();
      alert(result.message || "再採番が完了しました");
      await fetchParagraphs();
    } catch (error) {
      console.error("Failed to renumber paragraphs:", error);
      alert("パラグラフの再採番に失敗しました");
    } finally {
      setIsRenumbering(false);
    }
  };

  const handleAddParagraph = async () => {
    if (!newParagraphTitle.trim()) {
      alert("タイトルを入力してください");
      return;
    }

    try {
      const response = await fetch("/api/manuscript/paragraphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEFAULT_USER,
          worksheetId,
          title: newParagraphTitle,
          description: newParagraphDescription,
          sectionType: newParagraphSectionType,
          position: addPosition,
          targetParagraphId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(`追加に失敗しました: ${data.error || "不明なエラー"}`);
        return;
      }

      setShowAddModal(false);
      setNewParagraphTitle("");
      setNewParagraphDescription("");
      setNewParagraphSectionType("introduction");
      await fetchParagraphs();
    } catch (error) {
      console.error("Failed to add paragraph:", error);
      alert("パラグラフの追加に失敗しました");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // フィルタされたリスト内でのインデックス
    const oldFilteredIndex = filteredParagraphs.findIndex((p) => p.id === active.id);
    const newFilteredIndex = filteredParagraphs.findIndex((p) => p.id === over.id);

    if (oldFilteredIndex === -1 || newFilteredIndex === -1) return;

    // フィルタされたリスト内で順序を変更
    const newFilteredParagraphs = arrayMove(filteredParagraphs, oldFilteredIndex, newFilteredIndex);

    // 全パラグラフリストを構築
    // セクションフィルタがかかっている場合でも、全パラグラフの順序を更新する必要がある
    let paragraphIdsToSend: string[];
    
    if (selectedSection) {
      // セクションフィルタがかかっている場合
      // セクション内のパラグラフの新しい順序を、全パラグラフの順序に反映
      const otherParagraphs = paragraphs.filter((p) => p.section_type !== selectedSection);
      
      // 全パラグラフのIDリストを構築：セクション内のパラグラフを新しい順序で、それ以外は元の順序で
      // 元のparagraphsの順序を保持しつつ、セクション内のパラグラフを新しい順序で置き換え
      const newFilteredParagraphsMap = new Map(newFilteredParagraphs.map((p) => [p.id, p]));
      
      // 元のparagraphsの順序を保持しつつ、セクション内のパラグラフを新しい順序で置き換え
      const updatedParagraphs = paragraphs.map((p) => {
        if (p.section_type === selectedSection) {
          return newFilteredParagraphsMap.get(p.id) || p;
        }
        return p;
      });
      
      // セクション内のパラグラフの順序を新しい順序に置き換え
      const sectionIndices = new Map(
        newFilteredParagraphs.map((p, idx) => [p.id, idx])
      );
      
      // セクション内のパラグラフを新しい順序で並び替え
      const sectionParagraphs = updatedParagraphs
        .filter((p) => p.section_type === selectedSection)
        .sort((a, b) => {
          const idxA = sectionIndices.get(a.id) ?? 999;
          const idxB = sectionIndices.get(b.id) ?? 999;
          return idxA - idxB;
        });
      
      // 全パラグラフを再構築：セクション内のパラグラフを新しい順序で、それ以外は元の順序で
      // 元のparagraphsの順序を保持しつつ、セクション内のパラグラフの位置を新しい順序で置き換え
      const reorderedParagraphs: Paragraph[] = [];
      
      // 元のparagraphsの順序を保持しつつ、セクション内のパラグラフを新しい順序で挿入
      // 最初のセクション内パラグラフの位置を見つける
      let firstSectionIndex = paragraphs.findIndex((p) => p.section_type === selectedSection);
      
      if (firstSectionIndex === -1) {
        // セクション内のパラグラフが存在しない場合（通常は発生しない）
        reorderedParagraphs.push(...paragraphs.filter((p) => p.section_type !== selectedSection));
        reorderedParagraphs.push(...sectionParagraphs);
      } else {
        // 最初のセクション内パラグラフの位置まで、他のパラグラフを追加
        for (let i = 0; i < firstSectionIndex; i++) {
          if (paragraphs[i].section_type !== selectedSection) {
            reorderedParagraphs.push(paragraphs[i]);
          }
        }
        
        // 新しい順序のセクション内パラグラフを挿入
        reorderedParagraphs.push(...sectionParagraphs);
        
        // 残りの他のパラグラフを追加
        for (let i = firstSectionIndex; i < paragraphs.length; i++) {
          if (paragraphs[i].section_type !== selectedSection) {
            reorderedParagraphs.push(paragraphs[i]);
          }
        }
      }
      
      paragraphIdsToSend = reorderedParagraphs.map((p) => p.id);
    } else {
      // フィルタなしの場合、フィルタされたリストが全パラグラフ
      paragraphIdsToSend = newFilteredParagraphs.map((p) => p.id);
    }

    // APIで順序を更新（楽観的更新は行わず、API成功後に再取得）
    try {
      const response = await fetch("/api/manuscript/paragraphs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEFAULT_USER,
          worksheetId,
          paragraphIds: paragraphIdsToSend,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("Reorder failed:", data.error);
        alert(`順序の更新に失敗しました: ${data.error || "不明なエラー"}`);
        // エラー時は元に戻す
        await fetchParagraphs();
      } else {
        // 成功時は再取得して確実に同期（paragraph_numberが正しく再採番されているか確認）
        await fetchParagraphs();
      }
    } catch (error) {
      console.error("Failed to reorder paragraphs:", error);
      alert("順序の更新に失敗しました");
      // エラー時は元に戻す
      await fetchParagraphs();
    }
  };

  const getSectionName = (sectionType: string) => {
    const names: Record<string, string> = {
      introduction: "Introduction",
      methods: "Methods",
      results: "Results",
      discussion: "Discussion",
    };
    return names[sectionType] || sectionType;
  };

  // 論文形式でパラグラフを結合
  const generateDocumentContent = () => {
    if (paragraphs.length === 0) return "";

    const sections = ["introduction", "methods", "results", "discussion"];
    let content = `# ${worksheet?.title || "Manuscript"}\n\n`;

    sections.forEach((sectionType) => {
      const sectionParagraphs = paragraphs
        .filter((p) => p.section_type === sectionType && p.content)
        .sort((a, b) => {
          const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
          const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
          return numA - numB;
        });

      if (sectionParagraphs.length > 0) {
        content += `## ${getSectionName(sectionType)}\n\n`;
        
        // 引用番号マッピングを作成
        const citationNumberMap = getCitationNumberMap(citations, citationOrder);
        
        sectionParagraphs.forEach((paragraph) => {
          if (paragraph.content.trim()) {
            const showTitle = paragraph.title && paragraph.title.trim().length > 0;
            if (showTitle) {
              content += `**${paragraph.title.trim()}**\n\n`;
            }
            
            // パラグラフ内容にフィールドコードをレンダリング
            const contentWithCitations = renderParagraphWithFieldCodes(
              paragraph.content.trim(),
              paragraph.id,
              citationNumberMap
            );
            
            content += `${contentWithCitations}\n\n`;
          }
        });
      }
    });

    // Referenceセクションを追加
    if (citations.length > 0) {
      const format = getFormatById(citationFormat) || getDefaultFormat();
      
      // 引用を重複排除して一意の論文リストを作成
      const uniqueCitations = getUniqueCitations(citations);
      
      // 引用をソート
      let sortedCitations: any[];
      if (citationOrder === "alphabetical") {
        sortedCitations = sortCitationsAlphabetically(uniqueCitations);
      } else {
        // 出現順の場合、paragraphとcitation_orderが必要
        const citationsWithParagraph = uniqueCitations.filter((c: any) => 
          c.paragraph && c.citation_order !== undefined
        );
        
        if (citationsWithParagraph.length > 0) {
          sortedCitations = sortCitationsByAppearance(citationsWithParagraph);
        } else {
          // フォールバック: 元のcitationsから再試行
          const originalWithParagraph = citations.filter((c: any) => 
            c.paragraph && c.citation_order !== undefined
          );
          
          if (originalWithParagraph.length > 0) {
            const reUnique = getUniqueCitations(originalWithParagraph);
            sortedCitations = sortCitationsByAppearance(reUnique);
          } else {
            // それでもダメな場合はアルファベット順
            sortedCitations = sortCitationsAlphabetically(uniqueCitations);
          }
        }
      }

      // paperIdが存在する引用のみをフィルタリング
      const validCitations = sortedCitations.filter((citation) => {
        const paperId = citation.paper?.id || citation.paper_id;
        return paperId && citation.paper;
      });

      // 番号マッピングを作成
      const citationNumberMap = getCitationNumberMap(citations, citationOrder);

      if (validCitations.length > 0) {
        content += `## References\n\n`;

        validCitations.forEach((citation) => {
          const paperId = citation.paper?.id || citation.paper_id;
          const citationNumber = citationNumberMap.get(paperId);

          const paperData: PaperData = {
            title: citation.paper.title || "",
            authors: citation.paper.authors || "",
            year: citation.paper.year || new Date().getFullYear(),
            venue: citation.paper.venue || "",
            doi: citation.paper.doi || null,
            volume: null,
            issue: null,
            pages: null,
            articleNumber: null,
          };

          const number = citationOrder === "appearance" ? citationNumber : undefined;
          const formattedCitation = formatCitation(paperData, format, number);

          content += `${formattedCitation}\n\n`;
        });
      }
    }

    return content;
  };

  // ダウンロード機能
  const handleDownload = () => {
    const content = generateDocumentContent();
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${worksheet?.title || "manuscript"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredParagraphs = (selectedSection
    ? paragraphs.filter((p) => p.section_type === selectedSection)
    : paragraphs
  ).sort((a, b) => {
    const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
    const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
    return numA - numB;
  });

  const sections = ["introduction", "methods", "results", "discussion"];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">読み込み中...</div>
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">ワークシートが見つかりません</div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
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

      <div className="mb-6">
        <Link
          href="/manuscript"
          className="text-[var(--color-primary)] hover:underline mb-2 inline-block"
        >
          ← ワークシート一覧に戻る
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{worksheet.title}</h1>
        {worksheet.structure && (
          <div className="text-sm text-[var(--color-text-secondary)] mt-2">
            パラグラフ数: {worksheet.structure.totalParagraphs || 0} / 
            実際のパラグラフ数: {paragraphs.length}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex gap-2 flex-wrap items-center">
          {/* ビューモード切り替え */}
          <div className="flex gap-2 border border-[var(--color-border)] rounded overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 transition-colors flex items-center gap-2 ${
                viewMode === "list"
                  ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                  : "bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              }`}
            >
              <List className="h-4 w-4" />
              パラグラフ一覧
            </button>
            <button
              onClick={() => setViewMode("document")}
              className={`px-4 py-2 transition-colors flex items-center gap-2 ${
                viewMode === "document"
                  ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                  : "bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              }`}
            >
              <FileText className="h-4 w-4" />
              論文ビュー
            </button>
          </div>

          {/* 引用形式と順序の選択（論文ビューのみ） */}
          {viewMode === "document" && (
            <>
              <select
                value={citationFormat}
                onChange={(e) => setCitationFormat(e.target.value)}
                className="px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {getAvailableFormats().map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.displayName}
                  </option>
                ))}
              </select>
              <select
                value={citationOrder}
                onChange={(e) => setCitationOrder(e.target.value as "alphabetical" | "appearance")}
                className="px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="alphabetical">ABC順（アルファベット順）</option>
                <option value="appearance">出現順（番号付き）</option>
              </select>
            </>
          )}

          {/* セクションフィルター（パラグラフ一覧モードのみ） */}
          {viewMode === "list" && (
            <>
              <button
                onClick={() => setSelectedSection(null)}
                className={`px-4 py-2 rounded transition-colors ${
                  selectedSection === null
                    ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                    : "bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)]"
                }`}
              >
                すべて
              </button>
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => setSelectedSection(section)}
                  className={`px-4 py-2 rounded transition-colors ${
                    selectedSection === section
                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                      : "bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)]"
                  }`}
                >
                  {getSectionName(section)}
                </button>
              ))}
            </>
          )}

          <div className="ml-auto flex gap-2">
            {viewMode === "document" && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)] flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                ダウンロード
              </button>
            )}
            {viewMode === "list" && (
              <button
                onClick={handleRenumber}
                disabled={isRenumbering}
                className="px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRenumbering ? "再採番中..." : "番号を再採番"}
              </button>
            )}
          </div>
        </div>
      </div>

      {viewMode === "list" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredParagraphs.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-4">
              {filteredParagraphs.length === 0 ? (
                <div className="text-center py-12 text-[var(--color-text-secondary)]">
                  パラグラフがありません
                </div>
              ) : (
                filteredParagraphs.map((paragraph) => (
                  <SortableParagraph
                    key={paragraph.id}
                    paragraph={paragraph}
                    worksheetId={worksheetId}
                    menuOpenId={menuOpenId}
                    onMenuClick={setMenuOpenId}
                    onAddAbove={handleAddAbove}
                    onAddBelow={handleAddBelow}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-8">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-[var(--color-text)] leading-relaxed">
              {(() => {
                const sections = ["introduction", "methods", "results", "discussion"];
                const content: JSX.Element[] = [];

                sections.forEach((sectionType) => {
                  const sectionParagraphs = paragraphs
                    .filter((p) => p.section_type === sectionType && p.content)
                    .sort((a, b) => {
                      const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
                      const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
                      return numA - numB;
                    });

                  if (sectionParagraphs.length > 0) {
                    content.push(
                      <h2
                        key={`section-${sectionType}`}
                        className="text-2xl font-bold mt-8 mb-4 text-[var(--color-text)] border-b border-[var(--color-border)] pb-2"
                      >
                        {getSectionName(sectionType)}
                      </h2>
                    );

                    sectionParagraphs.forEach((paragraph, idx) => {
                      if (paragraph.content.trim()) {
                        const showTitle = paragraph.title && paragraph.title.trim().length > 0;
                        
                        // 引用番号マッピングを作成
                        const citationNumberMap = getCitationNumberMap(citations, citationOrder);
                        
                        // パラグラフ内容にフィールドコードをレンダリング
                        const contentWithCitations = renderParagraphWithFieldCodes(
                          paragraph.content.trim(),
                          paragraph.id,
                          citationNumberMap
                        );
                        
                        content.push(
                          <div
                            key={`para-${paragraph.id}`}
                            className="mb-4 text-[var(--color-text)] leading-7"
                          >
                            {showTitle && (
                              <div className="font-bold text-[var(--color-text)] mb-2">
                                {paragraph.title.trim()}
                              </div>
                            )}
                            <div>{contentWithCitations}</div>
                          </div>
                        );
                      }
                    });
                  }
                });

                // Referenceセクションを追加
                if (citations.length > 0) {
                  const format = getFormatById(citationFormat) || getDefaultFormat();
                  
                  // 引用を重複排除して一意の論文リストを作成
                  const uniqueCitations = getUniqueCitations(citations);
                  
                  // デバッグ: uniqueCitationsの内容を確認
                  console.log("Unique citations:", uniqueCitations.length, uniqueCitations);
                  
                  // 引用をソート
                  let sortedCitations: any[];
                  if (citationOrder === "alphabetical") {
                    sortedCitations = sortCitationsAlphabetically(uniqueCitations);
                  } else {
                    // 出現順の場合、paragraphとcitation_orderが必要
                    // まず、paragraphとcitation_orderが存在する引用を確認
                    console.log("Unique citations before filtering:", uniqueCitations);
                    console.log("Checking paragraph and citation_order:", uniqueCitations.map((c: any) => ({
                      hasParagraph: !!c.paragraph,
                      hasCitationOrder: c.citation_order !== undefined,
                      paragraph: c.paragraph,
                      citation_order: c.citation_order
                    })));
                    
                    // paragraphとcitation_orderが存在する引用のみをフィルタリング
                    const citationsWithParagraph = uniqueCitations.filter((c: any) => {
                      const hasParagraph = !!c.paragraph;
                      const hasCitationOrder = c.citation_order !== undefined;
                      if (!hasParagraph || !hasCitationOrder) {
                        console.warn("Citation missing required fields:", {
                          paperId: c.paper?.id || c.paper_id,
                          hasParagraph,
                          hasCitationOrder,
                          citation: c
                        });
                      }
                      return hasParagraph && hasCitationOrder;
                    });
                    
                    console.log("Citations with paragraph:", citationsWithParagraph.length, citationsWithParagraph);
                    
                    if (citationsWithParagraph.length > 0) {
                      sortedCitations = sortCitationsByAppearance(citationsWithParagraph);
                    } else {
                      // paragraphやcitation_orderが欠けている場合は、元のcitationsから再取得を試みる
                      console.warn("All citations missing paragraph or citation_order, trying original citations");
                      const originalWithParagraph = citations.filter((c: any) => 
                        c.paragraph && c.citation_order !== undefined
                      );
                      
                      if (originalWithParagraph.length > 0) {
                        // 元のcitationsから重複排除を再実行
                        const reUnique = getUniqueCitations(originalWithParagraph);
                        sortedCitations = sortCitationsByAppearance(reUnique);
                      } else {
                        // それでもダメな場合は、アルファベット順でソート
                        console.warn("No citations with paragraph/citation_order found, falling back to alphabetical");
                        sortedCitations = sortCitationsAlphabetically(uniqueCitations);
                      }
                    }
                  }

                  // デバッグ: sortedCitationsの内容を確認
                  console.log("Sorted citations:", sortedCitations.length, sortedCitations);

                  // 番号マッピングを作成
                  const citationNumberMap = getCitationNumberMap(citations, citationOrder);

                  // paperIdが存在する引用のみをフィルタリング
                  const validCitations = sortedCitations.filter((citation) => {
                    const paperId = citation.paper?.id || citation.paper_id;
                    if (!paperId) {
                      console.warn("Citation without paperId in sortedCitations:", citation);
                      return false;
                    }
                    if (!citation.paper) {
                      console.warn("Citation without paper object:", citation);
                      return false;
                    }
                    return true;
                  });

                  // validCitationsが空の場合はReferenceセクションを表示しない
                  if (validCitations.length === 0) {
                    console.warn("No valid citations to display after filtering");
                  } else {
                    content.push(
                      <h2
                        key="section-references"
                        className="text-2xl font-bold mt-12 mb-4 text-[var(--color-text)] border-b border-[var(--color-border)] pb-2"
                      >
                        References
                      </h2>
                    );

                    validCitations.forEach((citation, index) => {
                      const paperId = citation.paper?.id || citation.paper_id;
                      const citationNumber = citationNumberMap.get(paperId);

                      const paperData: PaperData = {
                        title: citation.paper.title || "",
                        authors: citation.paper.authors || "",
                        year: citation.paper.year || new Date().getFullYear(),
                        venue: citation.paper.venue || "",
                        doi: citation.paper.doi || null,
                        volume: null,
                        issue: null,
                        pages: null,
                        articleNumber: null,
                      };

                      const number = citationOrder === "appearance" ? citationNumber : undefined;
                      const formattedCitation = formatCitation(paperData, format, number);

                      // 一意のキーを作成（paperIdとインデックスを組み合わせ）
                      const uniqueKey = `citation-${paperId}-${index}`;

                      content.push(
                        <div
                          key={uniqueKey}
                          className="mb-3 text-[var(--color-text)] text-sm leading-relaxed"
                        >
                          {formattedCitation}
                        </div>
                      );
                    });
                  }
                }

                if (content.length === 0) {
                  return (
                    <div className="text-center py-12 text-[var(--color-text-secondary)]">
                      パラグラフ内容がありません
                    </div>
                  );
                }

                return content;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* パラグラフ追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-lg p-6 w-full max-w-md border border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                {addPosition === "above" ? "上に追加" : "下に追加"}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewParagraphTitle("");
                  setNewParagraphDescription("");
                }}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--color-text)]">
                  タイトル *
                </label>
                <input
                  type="text"
                  value={newParagraphTitle}
                  onChange={(e) => setNewParagraphTitle(e.target.value)}
                  placeholder="パラグラフのタイトル"
                  className="w-full border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--color-text)]">
                  説明
                </label>
                <textarea
                  value={newParagraphDescription}
                  onChange={(e) => setNewParagraphDescription(e.target.value)}
                  placeholder="パラグラフの説明（任意）"
                  className="w-full border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--color-text)]">
                  セクション
                </label>
                <select
                  value={newParagraphSectionType}
                  onChange={(e) => setNewParagraphSectionType(e.target.value)}
                  className="w-full border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="introduction">Introduction</option>
                  <option value="methods">Methods</option>
                  <option value="results">Results</option>
                  <option value="discussion">Discussion</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewParagraphTitle("");
                  setNewParagraphDescription("");
                }}
                className="px-4 py-2 border border-[var(--color-border)] rounded hover:bg-[var(--color-background)] text-[var(--color-text)]"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddParagraph}
                className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-surface)] rounded hover:opacity-90"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

