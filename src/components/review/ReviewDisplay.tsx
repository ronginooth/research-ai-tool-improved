"use client";

import { useState } from "react";
import { Copy, Download, Edit3, Check, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import ReviewActions from "./ReviewActions";
import { Paper, AIProvider } from "@/types";
import MarkdownRenderer from "@/components/library/MarkdownRenderer";

interface ReviewDisplayProps {
  review: string;
  provider?: AIProvider;
  topic?: string;
  papers?: Paper[];
  searchMode?: "auto" | "manual";
}

export default function ReviewDisplay({
  review,
  provider,
  topic,
  papers,
  searchMode,
}: ReviewDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(review);
      setCopied(true);
      toast.success("レビューをクリップボードにコピーしました");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("コピーに失敗しました");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([review], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "literature-review.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("レビューをダウンロードしました");
  };

  const handleSave = async () => {
    if (!topic || !review) {
      toast.error("保存に必要な情報が不足しています");
      return;
    }

    setSaving(true);
    try {
      const reviewResponse = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `${topic}に関する文献レビュー`,
          topic,
          content: review,
          paperIds: papers?.map((paper) => paper.paperId) || [],
        }),
      });

      if (!reviewResponse.ok) {
        throw new Error("レビューの保存に失敗しました");
      }

      if (papers && papers.length > 0) {
        const results = await Promise.all(
          papers.map(async (paper) => {
            const response = await fetch("/api/library", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                paperId: paper.paperId,
                title: paper.title,
                authors: paper.authors,
                year: paper.year,
                abstract: paper.abstract,
                url: paper.url,
                citationCount: paper.citationCount,
                venue: paper.venue,
                tags: ["レビュー引用"],
              }),
            });
            return response.ok;
          })
        );

        const successCount = results.filter(Boolean).length;
        if (successCount > 0) {
          toast.success(
            `レビューを保存し、${successCount}件の文献をライブラリーに追加しました`
          );
        } else {
          toast.success("レビューを保存しました");
        }
      } else {
        toast.success("レビューを保存しました");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("レビューの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!review) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg
            className="h-16 w-16 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          レビューが生成されていません
        </h3>
        <p className="text-gray-600">
          研究トピックと関連論文を入力して、文献レビューを生成してください。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            生成された文献レビュー
          </h2>
          {provider && (
            <p className="text-sm text-gray-600 mt-1">
              {provider === "openai" ? "OpenAI GPT-4" : "Google Gemini"} で生成
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                コピー済み
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                コピー
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Download className="h-4 w-4" />
            ダウンロード
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="prose max-w-none">
          <MarkdownRenderer
            content={review}
            papers={papers || []}
            onPaperClick={(paper) => {
              // 論文をクリックした時の処理（必要に応じて実装）
              console.log("Paper clicked:", paper);
            }}
          />
        </div>

        {papers && papers.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              引用文献
            </h3>
            <div className="space-y-3">
              {papers.map((paper, index) => (
                <div
                  key={paper.paperId}
                  id={`paper-${paper.paperId}`}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        [{index + 1}] {paper.title}
                      </p>
                      <p className="text-xs text-gray-600 mb-2">
                        {paper.authors} ({paper.year})
                      </p>
                      {paper.venue && (
                        <p className="text-xs text-gray-500 mb-2">
                          {paper.venue}
                        </p>
                      )}
                      {paper.abstract && (
                        <p className="text-xs text-gray-700 line-clamp-2">
                          {paper.abstract}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      {paper.url && (
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          論文を読む
                        </a>
                      )}
                      <button
                        onClick={() =>
                          fetch("/api/library", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              paperId: paper.paperId,
                              title: paper.title,
                              authors: paper.authors,
                              year: paper.year,
                              abstract: paper.abstract,
                              url: paper.url,
                              citationCount: paper.citationCount,
                              venue: paper.venue,
                              tags: ["レビュー引用"],
                            }),
                          }).then(() => {
                            toast.success("ライブラリーに保存しました");
                          })
                        }
                        className="text-xs text-green-600 hover:text-green-800 underline"
                      >
                        ライブラリーに保存
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <ReviewActions
          review={review}
          topic={topic || ""}
          papers={papers || []}
          provider={provider}
        />
      </div>
    </div>
  );
}
