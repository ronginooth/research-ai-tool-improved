"use client";

import React, { useState } from "react";
import type { LibraryPaper, Paper } from "@/types";
import MarkdownRenderer from "@/components/library/MarkdownRenderer";
import {
  BookOpen,
  Calendar,
  User,
  ExternalLink,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

interface Review {
  id: string;
  title?: string;
  topic?: string;
  content?: string;
  created_at?: string;
}

type ReviewCardPaper = Paper | LibraryPaper;

interface ReviewCardProps {
  review: Review;
  papers: ReviewCardPaper[];
  onPaperClick?: (paper: ReviewCardPaper) => void;
  onSaveToLibrary?: (paper: ReviewCardPaper) => Promise<void>;
  isPaperInLibrary?: (paperId: string) => boolean;
}

export default function ReviewCard({
  review,
  papers,
  onPaperClick,
  onSaveToLibrary,
  isPaperInLibrary,
}: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [savingPapers, setSavingPapers] = useState<Set<string>>(new Set());

  // レビューの内容から参照論文を抽出する関数
  const extractReferencedPapers = (content: string): ReviewCardPaper[] => {
    if (!content) return [];

    const referencedPapers: ReviewCardPaper[] = [];

    // 番号引用 [1], [2], [3] などを検出
    const numberRefs = content.match(/\[(\d+)\]/g);
    if (numberRefs) {
      numberRefs.forEach((ref) => {
        const number = parseInt(ref.replace(/[\[\]]/g, ""));
        if (number >= 1 && number <= papers.length) {
          const paper = papers[number - 1];
          if (paper && !referencedPapers.find((p) => p.id === paper.id)) {
            referencedPapers.push(paper);
          }
        }
      });
    }

    // 著者年引用 (Author et al., 2023) などを検出
    const authorYearRefs = content.match(/\(([^)]+\s\d{4})\)/g);
    if (authorYearRefs) {
      authorYearRefs.forEach((ref) => {
        const authorYear = ref.replace(/[()]/g, "");
        const paper = papers.find(
          (p) =>
            p.authors?.includes(authorYear.split(",")[0]) ||
            p.year?.toString() === authorYear.split(",").pop()?.trim()
        );
        if (paper && !referencedPapers.find((p) => p.id === paper.id)) {
          referencedPapers.push(paper);
        }
      });
    }

    return referencedPapers;
  };

  const referencedPapers = extractReferencedPapers(review.content || "");

  const handleSavePaper = async (paper: ReviewCardPaper) => {
    if (!onSaveToLibrary) return;

    setSavingPapers((prev) => new Set(prev).add(paper.id));
    try {
      await onSaveToLibrary(paper);
    } catch (error) {
      console.error("Failed to save paper:", error);
    } finally {
      setSavingPapers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(paper.id);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "保存日時不明";
    }
  };

  const getPreviewContent = (content: string) => {
    return content.length > 300 ? content.slice(0, 300) + "..." : content;
  };

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      {/* ヘッダー */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold text-slate-900 line-clamp-2">
            {review.title || review.topic || "Untitled"}
          </h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(review.created_at || "")}</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              <span>{referencedPapers.length} 件の論文を参照</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-4 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {isExpanded ? (
            <>
              <EyeOff className="h-3 w-3" />
              折りたたむ
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              展開
            </>
          )}
        </button>
      </div>

      {/* 内容 */}
      <div className="space-y-4">
        {isExpanded ? (
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer
              content={review.content || ""}
              papers={referencedPapers}
              onPaperClick={(paperId) => {
                const paper = referencedPapers.find((p) => p.id === paperId);
                if (paper && onPaperClick) {
                  onPaperClick(paper);
                }
              }}
            />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <div className="line-clamp-6">
              <MarkdownRenderer
                content={getPreviewContent(
                  review.content || "本文が保存されていません"
                )}
                papers={referencedPapers}
                onPaperClick={(paperId) => {
                  const paper = referencedPapers.find((p) => p.id === paperId);
                  if (paper && onPaperClick) {
                    onPaperClick(paper);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* 参照論文一覧 */}
        {referencedPapers.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">
              参照論文 ({referencedPapers.length}件)
            </h4>
            <div className="space-y-2">
              {referencedPapers.map((paper, index) => {
                const isInLibrary = isPaperInLibrary?.(paper.id) || false;
                const isSaving = savingPapers.has(paper.id);

                return (
                  <div
                    key={paper.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition ${
                      isInLibrary
                        ? "border-green-200 bg-green-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-500">
                          [{index + 1}]
                        </span>
                        {isInLibrary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <BookOpen className="h-3 w-3" />
                            ライブラリに保存済み
                          </span>
                        )}
                      </div>
                      <h5 className="text-sm font-medium text-slate-900 line-clamp-1">
                        {paper.title}
                      </h5>
                      <p className="text-xs text-slate-600 line-clamp-1">
                        {paper.authors} • {paper.year} • {paper.venue}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {onPaperClick && (
                        <button
                          onClick={() => onPaperClick(paper)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          詳細
                        </button>
                      )}
                      {onSaveToLibrary && !isInLibrary && (
                        <button
                          onClick={() => handleSavePaper(paper)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                        >
                          <Save className="h-3 w-3" />
                          {isSaving ? "保存中..." : "保存"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
