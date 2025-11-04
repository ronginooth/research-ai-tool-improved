"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { LibraryPaper, Paper } from "@/types";
import TagManager from "@/components/library/TagManager";

// ResizableTableで使用する最小限のプロパティを持つ型
type TablePaper = Paper | LibraryPaper;

interface ResizableTableProps {
  papers: TablePaper[];
  onSelectPaper: (paper: TablePaper) => void;
  onAddTag: (paperId: string, tag: string) => void;
  onRemoveTag: (paperId: string, tag: string) => void;
  onCreateTag: (tag: string) => void;
  availableTags: string[];
}

export default function ResizableTable({
  papers,
  onSelectPaper,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  availableTags,
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

    return (
      <tr
        key={paper.id}
        onClick={() => onSelectPaper(paper)}
        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
      >
        <td className="p-3" style={{ width: `${columnWidths.title}%` }}>
          <div className="font-medium text-slate-900 line-clamp-2">
            {paper.title}
          </div>
        </td>
        <td
          className="p-3 text-sm text-slate-600"
          style={{ width: `${columnWidths.authors}%` }}
        >
          <div className="truncate" title={paper.authors || "著者情報なし"}>
            {paper.authors && paper.authors.length > 20
              ? `${paper.authors.substring(0, 20)}...`
              : paper.authors || "著者情報なし"}
          </div>
        </td>
        <td
          className="p-3 text-sm text-slate-600"
          style={{ width: `${columnWidths.year}%` }}
        >
          {paper.year || "-"}
        </td>
        <td
          className="p-3 text-sm text-slate-600"
          style={{ width: `${columnWidths.venue}%` }}
        >
          <div className="truncate" title={paper.venue || "-"}>
            {paper.venue || "-"}
          </div>
        </td>
        <td
          className="p-3 text-sm text-slate-600"
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
          />
        </td>
        <td className="p-3" style={{ width: `${columnWidths.aiSummary}%` }}>
          {hasAiSummary ? (
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
              あり
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      {/* デバッグ用の幅表示 */}
      <div className="mb-2 text-xs text-slate-500">
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
          <tr className="border-b border-slate-200">
            <th
              className="p-3 text-left text-xs font-semibold text-slate-600 relative"
              style={{ width: `${columnWidths.title}%` }}
            >
              タイトル
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("title");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-slate-600 relative"
              style={{ width: `${columnWidths.authors}%` }}
            >
              著者
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("authors");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-slate-600 relative"
              style={{ width: `${columnWidths.year}%` }}
            >
              年
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("year");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-slate-600 relative"
              style={{ width: `${columnWidths.venue}%` }}
            >
              ジャーナル
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("venue");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-slate-600 relative"
              style={{ width: `${columnWidths.citationCount}%` }}
            >
              引用数
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("citationCount");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-slate-600 relative"
              style={{ width: `${columnWidths.tags}%` }}
            >
              タグ
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMouseDown("tags");
                }}
              />
            </th>
            <th
              className="p-3 text-left text-xs font-semibold text-slate-600 relative"
              style={{ width: `${columnWidths.aiSummary}%` }}
            >
              AI解説
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
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
