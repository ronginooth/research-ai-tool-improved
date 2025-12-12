"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { LibraryPaper, Paper } from "@/types";
import TagManager from "@/components/library/TagManager";
import PaperCardMenu from "@/components/library/PaperCardMenu";
import { Star, CheckSquare, Square } from "lucide-react";

// ResizableTableで使用する最小限のプロパティを持つ型
type TablePaper = Paper | LibraryPaper;

interface ResizableTableProps {
  papers: TablePaper[];
  onSelectPaper: (paper: TablePaper) => void;
  onAddTag: (paperId: string, tag: string) => void;
  onRemoveTag: (paperId: string, tag: string) => void;
  onCreateTag: (tag: string) => void;
  availableTags: string[];
  onToggleFavorite?: (paperId: string, currentFavorite: boolean) => void;
  onDelete?: (paperId: string) => void;
  selectedPaperIds?: Set<string>;
  onTogglePaperSelection?: (paperId: string) => void;
}

export default function ResizableTable({
  papers,
  onSelectPaper,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  availableTags,
  onToggleFavorite,
  onDelete,
  selectedPaperIds = new Set(),
  onTogglePaperSelection,
}: ResizableTableProps) {
  const [columnWidths, setColumnWidths] = useState({
    title: 50, // デフォルトでタイトルを広く
    authors: 8, // 著者を狭く
    year: 6,
    venue: 12,
    citationCount: 6,
    tags: 12,
    aiSummary: 6,
  });

  const [isResizing, setIsResizing] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleMouseDown = useCallback((column: string) => {
    setIsResizing(column);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !tableRef.current) return;

      const tableRect = tableRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - tableRect.left) / tableRect.width) * 100;

      // 最小幅と最大幅を設定
      const minWidth = 3;
      const maxWidth = 70;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setColumnWidths((prev) => ({
          ...prev,
          [isResizing]: Math.round(newWidth * 100) / 100, // 小数点以下2桁に丸める
        }));
      }
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  // マウスイベントリスナーを設定
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const renderPaperTableRow = (paper: TablePaper) => {
    const hasAiSummary = Boolean((paper as any)?.aiSummary ?? (paper as any)?.ai_summary);
    const isFavorite = (paper as any)?.is_favorite ?? (paper as any)?.isFavorite ?? false;
    const isSelected = selectedPaperIds.has(paper.id);

    return (
      <tr
        key={paper.id}
        className={`group relative border-b border-[var(--color-border)]/60 hover:bg-[var(--color-background)]/80 ${
          isSelected ? "bg-[var(--color-primary)]/5" : ""
        }`}
      >
        {/* チェックボックス */}
        {onTogglePaperSelection && (
          <td className="p-3 w-8">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePaperSelection(paper.id);
              }}
              className="flex items-center justify-center rounded border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-1 hover:bg-[var(--color-background)] transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-[var(--color-primary)]" />
              ) : (
                <Square className="h-4 w-4 text-[var(--color-text-secondary)]" />
              )}
            </button>
          </td>
        )}
        {/* 左端メニューボタン */}
        {onToggleFavorite && onDelete && (
          <td className="relative p-3 w-8 group">
            <PaperCardMenu
              paperId={paper.id}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDelete}
              position="left"
              paper={{
                doi: (paper as any)?.doi || null,
                htmlUrl: (paper as any)?.htmlUrl || (paper as any)?.html_url || null,
                url: (paper as any)?.url || paper.url || null,
                title: paper.title || null,
                authors: paper.authors || null,
                year: paper.year || null,
              }}
            />
            {isFavorite && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              </div>
            )}
          </td>
        )}
        <td
          className="p-3 cursor-pointer"
          style={{ width: `${columnWidths.title}%` }}
          onClick={() => onSelectPaper(paper)}
        >
          <div className="font-medium text-[var(--color-text)] line-clamp-2">
            {paper.title}
          </div>
        </td>
        <td
          className="p-3 text-sm text-[var(--color-text-secondary)]"
          style={{ width: `${columnWidths.authors}%` }}
        >
          <div className="truncate" title={paper.authors || "著者情報なし"}>
            {paper.authors && paper.authors.length > 20
              ? `${paper.authors.substring(0, 20)}...`
              : paper.authors || "著者情報なし"}
          </div>
        </td>
        <td
          className="p-3 text-sm text-[var(--color-text-secondary)]"
          style={{ width: `${columnWidths.year}%` }}
        >
          {paper.year || "-"}
        </td>
        <td
          className="p-3 text-sm text-[var(--color-text-secondary)]"
          style={{ width: `${columnWidths.venue}%` }}
        >
          <div className="truncate" title={paper.venue || "-"}>
            {paper.venue || "-"}
          </div>
        </td>
        <td
          className="p-3 text-sm text-[var(--color-text-secondary)]"
          style={{ width: `${columnWidths.citationCount}%` }}
        >
          {(paper as any)?.citation_count ?? paper.citationCount ?? "-"}
        </td>
        <td className="p-3" style={{ width: `${columnWidths.tags}%` }}>
          <TagManager
            paperId={paper.id}
            currentTags={(paper as any).tags || []}
            availableTags={availableTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onCreateTag={onCreateTag}
            className="min-w-32"
            allPapers={papers as any}
          />
        </td>
        <td className="p-3" style={{ width: `${columnWidths.aiSummary}%` }}>
          {(() => {
            const aiSummary = (paper as any)?.aiSummary ?? (paper as any)?.ai_summary;
            const summaries = aiSummary?.summaries || {};
            const tldr = summaries.tldr;
            
            if (tldr) {
              return (
                <div className="max-w-xs">
                  <div className="text-xs font-semibold text-[var(--color-text)] mb-1">
                    TL;DR
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                    {tldr}
                  </div>
                </div>
              );
            }
            
            if (hasAiSummary) {
              return (
                <span className="rounded-full bg-[var(--color-success)]/20 px-2 py-1 text-xs text-[var(--color-success)]">
                  あり
                </span>
              );
            }
            
            return <span className="text-[var(--color-text-secondary)]/60">-</span>;
          })()}
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      {/* デバッグ用の幅表示 */}
      <div className="mb-2 text-xs text-[var(--color-text-secondary)]/80">
        現在の幅: タイトル{columnWidths.title}% | 著者{columnWidths.authors}% |
        年{columnWidths.year}% | ジャーナル{columnWidths.venue}% | 引用数
        {columnWidths.citationCount}% | タグ{columnWidths.tags}% | AI解説
        {columnWidths.aiSummary}%
      </div>
      <table
        ref={tableRef}
        className="w-full border-collapse table-fixed"
        style={{ minWidth: "800px" }}
      >
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {onTogglePaperSelection && (
              <th className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] w-8">
                {/* チェックボックス列のヘッダー */}
              </th>
            )}
            {onToggleFavorite && onDelete && (
              <th className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] w-8">
                {/* メニュー列のヘッダー */}
              </th>
            )}
            <th
              className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] relative"
              style={{ width: `${columnWidths.title}%` }}
            >
              タイトル
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-[var(--color-primary)]/30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("title");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] relative"
              style={{ width: `${columnWidths.authors}%` }}
            >
              著者
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-[var(--color-primary)]/30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("authors");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] relative"
              style={{ width: `${columnWidths.year}%` }}
            >
              年
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-[var(--color-primary)]/30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("year");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] relative"
              style={{ width: `${columnWidths.venue}%` }}
            >
              ジャーナル
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-[var(--color-primary)]/30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("venue");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] relative"
              style={{ width: `${columnWidths.citationCount}%` }}
            >
              引用数
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-[var(--color-primary)]/30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("citationCount");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] relative"
              style={{ width: `${columnWidths.tags}%` }}
            >
              タグ
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-[var(--color-primary)]/30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("tags");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] relative"
              style={{ width: `${columnWidths.aiSummary}%` }}
            >
              AI解説
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-[var(--color-primary)]/30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("aiSummary");
                }}
              />
            </th>
          </tr>
        </thead>
        <tbody>{papers.map((paper) => renderPaperTableRow(paper))}</tbody>
      </table>
    </div>
  );
}
