"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { getVersionString } from "@/lib/app-version";
import {
  MoreVertical,
  Plus,
  Trash2,
  GripVertical,
  X,
  FileText,
  List,
  Download,
  Columns,
  Maximize2,
  Minimize2,
  Square,
  LayoutTemplate,
  Edit,
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
  citations,
  isEditing,
  editContent,
  onMenuClick,
  onAddAbove,
  onAddBelow,
  onDelete,
  onStatusChange,
  onEditToggle,
  onEditContentChange,
  onSaveContent,
  onLiveUpdate,
}: {
  paragraph: Paragraph;
  worksheetId: string;
  menuOpenId: string | null;
  citations: any[];
  isEditing: boolean;
  editContent: string;
  onMenuClick: (id: string | null) => void;
  onAddAbove: (id: string) => void;
  onAddBelow: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onEditToggle: (id: string | null) => void;
  onEditContentChange: (content: string) => void;
  onSaveContent: (id: string, content: string) => void;
  onLiveUpdate: (id: string, content: string) => void;
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
      case "pending":
      default:
        return "❌";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "in_progress":
        return "In Progress";
      case "pending":
      default:
        return "Pending";
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
    <div
      ref={setNodeRef}
      style={style}
      className="border border-[var(--color-border)] rounded-lg p-4 hover:shadow-md transition-shadow bg-[var(--color-surface)]"
    >
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-3">
        <div className="flex items-center gap-3">
          {/* ドラッグハンドル */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          {/* パラグラフ番号 */}
          <span className="font-bold text-[var(--color-text)]">{paragraph.paragraph_number}</span>
          {/* セクション名 */}
          <span
            className="px-2 py-1 rounded text-xs font-bold text-[var(--color-surface)]"
            style={{ backgroundColor: getSectionColor(paragraph.section_type) }}
          >
            {getSectionName(paragraph.section_type)}
          </span>
          {/* ステータス */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // ステータスをサイクル: pending -> in_progress -> completed -> pending
              const statusOrder = ["pending", "in_progress", "completed"];
              const currentIndex = statusOrder.indexOf(paragraph.status);
              const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
              onStatusChange(paragraph.id, nextStatus);
            }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-[var(--color-background)] transition-colors cursor-pointer text-[var(--color-text)]"
            title="クリックでステータス変更"
          >
            {getStatusIcon(paragraph.status)} {getStatusLabel(paragraph.status)}
          </button>
        </div>
        {/* 三点メニュー */}
        <div className="relative">
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
            <div className="absolute right-0 mt-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-10 divide-y divide-[var(--color-border)]">
              <div className="py-1">
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
              </div>

              <div className="py-1">
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
            </div>
          )}
        </div>
      </div>

      {/* タイトル行 */}
      <div className="mb-3">
        <Link
          href={`/manuscript/${worksheetId}/paragraphs/${paragraph.id}`}
          className="text-xl font-bold text-[var(--color-primary)] hover:underline"
        >
          {paragraph.title}
        </Link>
      </div>

      {/* コンテンツ表示/編集 - クリックで編集、blur自動保存 */}
      {isEditing ? (
        <div className="mb-3">
          <textarea
            value={editContent}
            onChange={(e) => {
              onEditContentChange(e.target.value);
              // リアルタイム更新をトリガー
              onLiveUpdate(paragraph.id, e.target.value);
              // 高さを自動調整
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onBlur={() => {
              // blur時に自動保存
              onSaveContent(paragraph.id, editContent);
            }}
            autoFocus
            ref={(el) => {
              // 初期表示時に高さを調整
              if (el) {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }
            }}
            className="w-full p-3 text-sm border border-[var(--color-primary)] rounded bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none overflow-hidden"
            placeholder="パラグラフ内容を入力..."
            rows={1}
          />
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
            編集中... (クリック外で自動保存)
          </div>
        </div>
      ) : (
        <div
          onClick={() => onEditToggle(paragraph.id)}
          className="mb-3 text-sm text-[var(--color-text)] whitespace-pre-wrap cursor-text hover:bg-[var(--color-background)] rounded p-2 -m-2 transition-colors min-h-[40px]"
          title="クリックして編集"
        >
          {paragraph.content || <span className="text-[var(--color-text-secondary)] italic">クリックして内容を入力...</span>}
        </div>
      )}

      {/* フッター: 引用とワード数 */}
      <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        {/* 引用表示（折りたたみ可能） */}
        <div className="flex-1">
          {citations.length > 0 ? (
            <details className="cursor-pointer">
              <summary className="hover:text-[var(--color-text)]" style={{ listStyle: 'none' }}>
                <span>
                  📚 引用: {citations.slice(0, 3).map((c, idx) => {
                    const author = c.paper?.authors?.split(',')[0]?.split(' ').pop() || 'Unknown';
                    const year = c.paper?.year || '';
                    return `[${author} ${year}]`;
                  }).join(', ')}
                  {citations.length > 3 && ` +${citations.length - 3}件`}
                </span>
              </summary>
              <div className="mt-2 pl-4 space-y-1">
                {citations.map((c) => {
                  const author = c.paper?.authors?.split(',')[0]?.split(' ').pop() || 'Unknown';
                  const year = c.paper?.year || '';
                  return (
                    <div key={c.id} className="text-[var(--color-text)]">
                      [{author} {year}]
                    </div>
                  );
                })}
              </div>
            </details>
          ) : (
            <span>📚 引用なし</span>
          )}
        </div>
        {/* ワード数 */}
        <div className="ml-4">
          {paragraph.word_count || 0} words
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
  const [layoutMode, setLayoutMode] = useState<"single" | "split">("split");
  const [leftWidth, setLeftWidth] = useState(50); // 左側の幅（パーセンテージ）
  const [isResizing, setIsResizing] = useState(false);
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");

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
      // 出現順の場合: テキスト内でのフィールドコードの出現位置に基づいてソート
      const sortedCitationsWithPosition = uniqueCitations
        .filter((c: any) => c && c.paper && c.paper.id && c.id)
        .map((c: any) => {
          // パラグラフを取得
          const para = paragraphs.find(
            (p) => p && p.id === c.paragraph_id
          );

          if (!para || !para.content) {
            return { citation: c, paragraph: para, position: Infinity, paraNumber: 0 };
          }

          // フィールドコードのパターン: [cite:citation_id:paper_id]
          const escapedCitationId = (c.id || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const fieldCodePattern = new RegExp(`\\[cite:${escapedCitationId}:[^\\]]+\\]`);
          const content = para.content;
          const match = content.match(fieldCodePattern);
          const position = match ? (match.index ?? Infinity) : Infinity;

          const paraNumber = parseInt((para.paragraph_number || "").replace("P", "")) || 0;

          return { citation: c, paragraph: para, position, paraNumber };
        })
        .sort((a, b) => {
          // まずパラグラフ番号で比較
          if (a.paraNumber !== b.paraNumber) {
            return a.paraNumber - b.paraNumber;
          }
          // 同じパラグラフ内では、テキスト内での出現位置で比較
          if (a.position !== b.position) {
            return a.position - b.position;
          }
          // 同じ位置の場合はcitation_orderで比較（フォールバック）
          return (a.citation.citation_order || 0) - (b.citation.citation_order || 0);
        })
        .map(item => item.citation);

      if (sortedCitationsWithPosition.length > 0) {
        sortedCitations = sortedCitationsWithPosition;
      } else {
        // フォールバック: 従来の方法でソート
        const citationsWithParagraph = uniqueCitations.filter((c: any) =>
          c.paragraph && c.citation_order !== undefined
        );

        if (citationsWithParagraph.length > 0) {
          sortedCitations = sortCitationsByAppearance(citationsWithParagraph);
        } else {
          // それでもダメな場合はアルファベット順
          console.warn("No citations with field codes found in getCitationNumberMap, falling back to alphabetical");
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


  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      // 楽観的UI更新
      setParagraphs(prev => prev.map(p =>
        p.id === id ? { ...p, status: newStatus } : p
      ));

      const response = await fetch(
        `/api/manuscript/paragraphs/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEFAULT_USER,
            status: newStatus
          }),
        }
      );

      if (!response.ok) {
        // エラー時は戻す
        await fetchParagraphs();
        const data = await response.json();
        alert(`ステータス更新に失敗しました: ${data.error || "不明なエラー"}`);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      // エラー時は戻す
      await fetchParagraphs();
      alert("ステータス更新に失敗しました");
    }
  };

  // インライン編集モードをトグル
  const handleEditToggle = (id: string | null) => {
    if (id) {
      const paragraph = paragraphs.find(p => p.id === id);
      setEditContent(paragraph?.content || "");
    }
    setEditingParagraphId(id);
  };

  // パラグラフ内容を保存
  const handleSaveContent = async (id: string, content: string) => {
    try {
      // 楽観的UI更新
      setParagraphs(prev => prev.map(p =>
        p.id === id ? { ...p, content } : p
      ));
      setEditingParagraphId(null);

      const response = await fetch(
        `/api/manuscript/paragraphs/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEFAULT_USER,
            content
          }),
        }
      );

      if (!response.ok) {
        await fetchParagraphs();
        const data = await response.json();
        alert(`保存に失敗しました: ${data.error || "不明なエラー"}`);
      }
    } catch (error) {
      console.error("Failed to save content:", error);
      await fetchParagraphs();
      alert("保存に失敗しました");
    }
  };

  // リアルタイム更新（API保存なしでステートのみ更新）
  const handleLiveUpdate = (id: string, content: string) => {
    setParagraphs(prev => prev.map(p =>
      p.id === id ? { ...p, content } : p
    ));
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

  // リサイズハンドラー
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.querySelector('[data-split-container]') as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // 最小幅と最大幅を制限（20%〜80%）
      const clampedWidth = Math.max(20, Math.min(80, newLeftWidth));
      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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

  const renderParagraphList = () => (
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
                citations={citations.filter(c => c.paragraph_id === paragraph.id)}
                isEditing={editingParagraphId === paragraph.id}
                editContent={editingParagraphId === paragraph.id ? editContent : paragraph.content || ""}
                onMenuClick={setMenuOpenId}
                onAddAbove={handleAddAbove}
                onAddBelow={handleAddBelow}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onEditToggle={handleEditToggle}
                onEditContentChange={setEditContent}
                onSaveContent={handleSaveContent}
                onLiveUpdate={handleLiveUpdate}
              />

            ))

          )}
        </div>
      </SortableContext>
    </DndContext>
  );

  const renderDocumentView = () => (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-8 min-h-full w-full">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-[var(--color-text)] leading-relaxed">
          {(() => {
            const sections = ["introduction", "methods", "results", "discussion"];
            const content: JSX.Element[] = [];

            // 1. 各セクションのパラグラフをレンダリング
            sections.forEach((sectionType) => {
              const sectionParagraphs = paragraphs
                .filter((p) => p.section_type === sectionType && p.content)
                .sort((a, b) => {
                  const numA = parseInt((a.paragraph_number || "").replace("P", "")) || 0;
                  const numB = parseInt((b.paragraph_number || "").replace("P", "")) || 0;
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
                  if (paragraph.content && paragraph.content.trim()) {
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

            // 2. Referenceセクションを追加
            if (citations.length > 0) {
              const format = getFormatById(citationFormat) || getDefaultFormat();

              // 引用を重複排除して一意の論文リストを作成
              const uniqueCitations = getUniqueCitations(citations);

              // 引用をソート
              let sortedCitations: any[];
              if (citationOrder === "alphabetical") {
                sortedCitations = sortCitationsAlphabetically(uniqueCitations);
              } else {
                // 出現順: テキスト内での出現位置に基づいてソート
                const sortedCitationsWithPosition = uniqueCitations
                  .filter((c: any) => c && c.paper && c.paper.id && c.id)
                  .map((c: any) => {
                    // パラグラフを取得
                    const para = paragraphs.find(
                      (p) => p && p.id === c.paragraph_id
                    );

                    if (!para || !para.content) {
                      return { citation: c, paragraph: para, position: Infinity, paraNumber: 0 };
                    }

                    // フィールドコードのパターン
                    const escapedCitationId = (c.id || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const fieldCodePattern = new RegExp(`\\[cite:${escapedCitationId}:[^\\]]+\\]`);
                    const contentP = para.content;
                    const match = contentP.match(fieldCodePattern);
                    const position = match ? (match.index ?? Infinity) : Infinity;

                    const paraNumber = parseInt((para.paragraph_number || "").replace("P", "")) || 0;

                    return { citation: c, paragraph: para, position, paraNumber };
                  })
                  .sort((a, b) => {
                    // パラグラフ番号、位置、citation_orderの順で比較
                    if (a.paraNumber !== b.paraNumber) return a.paraNumber - b.paraNumber;
                    if (a.position !== b.position) return a.position - b.position;
                    return (a.citation.citation_order || 0) - (b.citation.citation_order || 0);
                  })
                  .map(item => item.citation);

                if (sortedCitationsWithPosition.length > 0) {
                  sortedCitations = sortedCitationsWithPosition;
                } else {
                  // フォールバック
                  const citationsWithParagraph = uniqueCitations.filter((c: any) =>
                    c.paragraph && c.citation_order !== undefined
                  );
                  if (citationsWithParagraph.length > 0) {
                    sortedCitations = sortCitationsByAppearance(citationsWithParagraph);
                  } else {
                    sortedCitations = sortCitationsAlphabetically(uniqueCitations);
                  }
                }
              }

              // 番号マッピング
              const citationNumberMap = getCitationNumberMap(citations, citationOrder);

              // paperIdが存在する有効な引用のみ
              const validCitations = sortedCitations.filter((citation) => {
                const paperId = citation.paper?.id || citation.paper_id;
                return paperId && citation.paper;
              });

              if (validCitations.length > 0) {
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
                    volume: citation.paper.volume || null,
                    pages: citation.paper.pages || null,
                  };

                  const number = citationOrder === "appearance" ? citationNumber : undefined;
                  const formattedCitation = formatCitation(paperData, format, number);
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
  );

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* 中央の陰影アイコン */}
        <section className="mb-6">
          <div className="flex items-center justify-center gap-3">
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

        <div className="mb-6">
          <Link
            href="/manuscript"
            className="text-[var(--color-primary)] hover:underline mb-2 inline-block"
          >
            ← ワークシート一覧に戻る
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text)]">{worksheet.title}</h1>
              {worksheet.structure && (
                <div className="text-sm text-[var(--color-text-secondary)] mt-2">
                  パラグラフ数: {worksheet.structure.totalParagraphs || 0} /
                  実際のパラグラフ数: {paragraphs.length}
                </div>
              )}
            </div>
            {/* シングル/スプリット切り替え */}
            <div className="flex gap-2 border border-[var(--color-border)] rounded overflow-hidden">
              <button
                onClick={() => setLayoutMode("single")}
                className={`px-3 py-2 transition-colors flex items-center gap-2 ${layoutMode === "single"
                  ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                  : "bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                  }`}
                title="シングルビュー"
              >
                <Square className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLayoutMode("split")}
                className={`px-3 py-2 transition-colors flex items-center gap-2 ${layoutMode === "split"
                  ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                  : "bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                  }`}
                title="分割ビュー（左右）"
              >
                <Columns className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 左側: ビューモード切り替え（シングルビュー時のみ）とセクションフィルター */}
            <div className="flex items-center gap-4">
              {/* ビューモード切り替え（シングルビュー時のみ） */}
              {layoutMode === "single" && (
                <div className="flex gap-2 border border-[var(--color-border)] rounded overflow-hidden">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-4 py-2 transition-colors flex items-center gap-2 ${viewMode === "list"
                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                      : "bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                      }`}
                  >
                    <List className="h-4 w-4" />
                    パラグラフ一覧
                  </button>
                  <button
                    onClick={() => setViewMode("document")}
                    className={`px-4 py-2 transition-colors flex items-center gap-2 ${viewMode === "document"
                      ? "bg-[var(--color-primary)] text-[var(--color-surface)]"
                      : "bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                      }`}
                  >
                    <FileText className="h-4 w-4" />
                    論文ビュー
                  </button>
                </div>
              )}

              {/* セクションフィルター（listモードのみ） */}
              {viewMode === "list" && (
                <select
                  value={selectedSection || "all"}
                  onChange={(e) => setSelectedSection(e.target.value === "all" ? null : e.target.value)}
                  className="px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="all">All</option>
                  {sections.map((section) => (
                    <option key={section} value={section}>
                      {getSectionName(section)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 右側: 引用形式・順序選択とシングルビュー専用機能 */}
            <div className="flex items-center gap-4">
              {/* 引用形式・順序選択（documentモードまたはsplitモード時） */}
              {(viewMode === "document" || layoutMode === "split") && (
                <div className="flex gap-2">
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
                    <option value="alphabetical">ABC</option>
                    <option value="appearance">出現順</option>
                  </select>
                </div>
              )}

              {/* ダウンロードボタン（documentモードまたはsplitモード時） */}
              {(viewMode === "document" || layoutMode === "split") && (
                <button
                  onClick={handleDownload}
                  className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface)] flex items-center justify-center"
                  title="Markdownファイルをダウンロード"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}

              {/* シングルビュー専用機能（再採番） */}
              {layoutMode === "single" && viewMode === "list" && (
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

        {layoutMode === "single" ? (
          viewMode === "list" ? renderParagraphList() : renderDocumentView()
        ) : (
          <div
            data-split-container
            className="flex relative"
            style={{
              cursor: isResizing ? 'col-resize' : 'default',
              height: 'calc(100vh - 280px)',
              minHeight: 'calc(100vh - 280px)'
            }}
          >
            {/* 左側: パラグラフ一覧 */}
            <div
              className="overflow-y-auto pr-2 border-r border-[var(--color-border)] h-full"
              style={{ width: `${leftWidth}%`, minWidth: '20%', maxWidth: '80%' }}
            >
              {renderParagraphList()}
            </div>

            {/* リサイズハンドル */}
            <div
              onMouseDown={handleMouseDown}
              className={`absolute top-0 bottom-0 w-1 bg-transparent hover:bg-[var(--color-primary)] cursor-col-resize transition-colors z-10 group ${isResizing ? 'bg-[var(--color-primary)]' : ''
                }`}
              style={{ left: `${leftWidth}%`, transform: 'translateX(-50%)' }}
              title="ドラッグして幅を調整"
            >
              {/* 視覚的なリサイズハンドル */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-[var(--color-border)] group-hover:bg-[var(--color-primary)] rounded transition-colors" />
            </div>

            {/* 右側: 論文ビュー */}
            <div
              className="flex-1 h-full flex flex-col"
              style={{ minWidth: '20%', maxWidth: '80%' }}
            >
              <div className="flex-1 overflow-y-auto pl-2">
                {renderDocumentView()}
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

