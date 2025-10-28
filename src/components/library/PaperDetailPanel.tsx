"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useDropzone } from "react-dropzone";
import {
  LibraryPaper,
  PaperAIInsights,
  InsightsChatResponse,
  InsightsChatSession,
} from "@/types";
import TagManager from "./TagManager";

const DEFAULT_USER_ID = "demo-user-123";

export interface PaperDetailPanelProps {
  paper: LibraryPaper | null;
  onClose: () => void;
  onSaveSummary?: (paperId: string, insights: PaperAIInsights) => void;
  onPreviewUpdate?: (
    paperId: string,
    payload: { pdfUrl?: string | null; htmlUrl?: string | null }
  ) => void;
  onAddTag?: (paperId: string, tag: string) => void;
  onRemoveTag?: (paperId: string, tag: string) => void;
  onCreateTag?: (tag: string) => void;
  availableTags?: string[];
}

interface SaveProgress {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
}

interface ProcessingStatus {
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  message: string;
  details?: {
    hasContent: boolean;
    hasEmbeddings: boolean;
    hasAiSummary: boolean;
    chunkCount: number;
    embeddingCount: number;
    sectionCount: number;
  };
}

export default function PaperDetailPanel({
  paper,
  onClose,
  onSaveSummary,
  onPreviewUpdate,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  availableTags = [],
}: PaperDetailPanelProps) {
  const initialInsights = useMemo<PaperAIInsights | null>(() => {
    if (!paper) return null;
    return paper.aiSummary ?? (paper as any)?.ai_summary ?? null;
  }, [paper]);

  const initialPdfUrl = useMemo(() => {
    if (!paper) return null;
    return paper.pdfUrl ?? (paper as any)?.pdf_url ?? null;
  }, [paper]);

  const initialHtmlUrl = useMemo(() => {
    if (!paper) return null;
    return paper.htmlUrl ?? (paper as any)?.html_url ?? null;
  }, [paper]);

  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [insights, setInsights] = useState<PaperAIInsights | null>(
    initialInsights
  );
  const [saveState, setSaveState] = useState<SaveProgress>({ status: "idle" });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(
    initialPdfUrl
  );
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState<string | null>(
    initialHtmlUrl
  );
  const [pdfInput, setPdfInput] = useState(initialPdfUrl ?? "");
  const [htmlInput, setHtmlInput] = useState(initialHtmlUrl ?? "");
  const [previewState, setPreviewState] = useState<SaveProgress>({
    status: "idle",
  });
  const [ingestState, setIngestState] = useState<SaveProgress>({
    status: "idle",
  });

  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: "pending",
    progress: 0,
    message: "処理待ち",
  });
  const [uploadedPdfName, setUploadedPdfName] = useState<string | null>(null);
  const [uploadedPdfBase64, setUploadedPdfBase64] = useState<string | null>(
    null
  );
  const [chatDraft, setChatDraft] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<InsightsChatSession[]>([]);
  const [leftPaneWidth, setLeftPaneWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowFullAbstract(false);
    setAiError(null);
    setSaveState({ status: "idle" });
    setPreviewState({ status: "idle" });
    setInsights(initialInsights);
    setPdfPreviewUrl(initialPdfUrl);
    setHtmlPreviewUrl(initialHtmlUrl);
    setPdfInput(initialPdfUrl ?? "");
    setHtmlInput(initialHtmlUrl ?? "");
    setChatDraft("");
    setChatStatus("idle");
    setChatError(null);
    setChatSessions([]);
    setLeftPaneWidth(50);
    setUploadedPdfName(null);
    setUploadedPdfBase64(null);
    setIngestState({ status: "idle" });
  }, [initialInsights, initialPdfUrl, initialHtmlUrl]);

  // 自動処理の進捗監視
  useEffect(() => {
    if (!paper?.id) return;

    const checkProcessingStatus = async () => {
      try {
        const response = await fetch(
          `/api/library/processing-status?paperId=${paper.id}&userId=${DEFAULT_USER_ID}`
        );
        if (response.ok) {
          const status = await response.json();
          setProcessingStatus(status);
          return status;
        }
      } catch (error) {
        console.error("Failed to check processing status:", error);
      }
      return null;
    };

    // 初回チェック
    checkProcessingStatus();

    // 処理中の場合は定期的にチェック（最大30回、90秒でタイムアウト）
    let checkCount = 0;
    const maxChecks = 30;
    const interval = setInterval(async () => {
      checkCount++;
      const status = await checkProcessingStatus();

      // 完了、エラー、または最大チェック回数に達したら停止
      if (
        status?.status === "completed" ||
        status?.status === "error" ||
        checkCount >= maxChecks
      ) {
        clearInterval(interval);
        if (checkCount >= maxChecks) {
          console.log(
            `Processing status check timeout after ${maxChecks} attempts`
          );
        }
      }
    }, 3000); // 3秒ごと

    return () => clearInterval(interval);
  }, [paper?.id]); // processingStatus.statusを依存配列から削除

  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = "";
      return;
    }

    document.body.style.cursor = "col-resize";

    function handleMouseMove(event: MouseEvent) {
      if (!containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const relativeX = event.clientX - bounds.left;
      const percentage = (relativeX / bounds.width) * 100;
      const clamped = Math.min(70, Math.max(30, percentage));
      setLeftPaneWidth(clamped);
    }

    function handleMouseUp() {
      setIsResizing(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  const hasPreview = useMemo(
    () => Boolean(pdfPreviewUrl || htmlPreviewUrl),
    [pdfPreviewUrl, htmlPreviewUrl]
  );

  const citationLabel = useMemo(() => {
    const value = paper?.citation_count ?? paper?.citationCount;
    if (value == null) return "不明";
    if (value === 0) return "0";
    return value.toLocaleString();
  }, [paper]);

  const formattedDate = useMemo(() => {
    const createdAt = paper?.created_at ?? paper?.createdAt;
    if (!createdAt) return null;
    try {
      return new Date(createdAt).toLocaleString("ja-JP");
    } catch (error) {
      return createdAt;
    }
  }, [paper]);

  const summaryTimestamp = useMemo(() => {
    const summaryAt =
      paper?.aiSummaryUpdatedAt ??
      (paper as any)?.ai_summary_updated_at ??
      null;
    if (!summaryAt) return null;
    try {
      return new Date(summaryAt).toLocaleString("ja-JP");
    } catch (error) {
      return summaryAt;
    }
  }, [paper]);

  const handleProcessContent = useCallback(
    async (options?: { force?: boolean }) => {
      if (!paper) return;
      const paperId = paper.paperId || (paper as any)?.paper_id || paper.id;
      const userId = paper.userId ?? (paper as any)?.user_id ?? DEFAULT_USER_ID;

      setIngestState({ status: "saving", message: "本文を解析しています" });

      try {
        const response = await fetch("/api/library/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paperId,
            userId,
            pdfUrl: pdfPreviewUrl,
            htmlUrl: htmlPreviewUrl,
            pdfBase64: uploadedPdfBase64,
            fallbackHtml: paper.abstract ?? null,
            force: options?.force ?? false,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.error ||
              "本文の解析に失敗しました。URL や PDF を確認してください"
          );
        }

        const payload = await response.json();

        setIngestState({
          status: "success",
          message: `本文解析が完了しました (チャンク数: ${
            payload?.summary?.totalChunks ?? 0
          })`,
        });
        setTimeout(() => setIngestState({ status: "idle" }), 4000);
        return true;
      } catch (error: any) {
        console.error("Process content failed", error);
        setIngestState({
          status: "error",
          message: error?.message ?? "本文の解析に失敗しました",
        });
        setTimeout(() => setIngestState({ status: "idle" }), 5000);
        return false;
      }
    },
    [htmlPreviewUrl, paper, pdfPreviewUrl, uploadedPdfBase64]
  );

  const handleGenerateInsights = async () => {
    if (!paper) return;
    if (!paper.paperId && !(paper as any)?.paper_id) {
      setAiError("この論文には識別子が無いためAI解説を生成できません");
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);

      const processed = await handleProcessContent();
      if (!processed) {
        throw new Error(
          "本文解析が完了していません。URLやPDFを確認してください。"
        );
      }

      const response = await fetch("/api/paper-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId: paper.paperId || (paper as any)?.paper_id,
          fallback: {
            title: paper.title,
            abstract: paper.abstract,
            authors: paper.authors,
            venue: paper.venue,
            year: paper.year,
            url: paper.url ?? (paper as any)?.url,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "AI解説の生成に失敗しました");
      }

      const data = (await response.json()) as { insights: PaperAIInsights };
      setInsights(data.insights);
    } catch (error: any) {
      setAiError(error?.message ?? "AI解説の生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!paper || !insights || !onSaveSummary) return;
    try {
      setSaveState({ status: "saving" });
      const response = await fetch("/api/paper-insights/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId: paper.paperId || (paper as any)?.paper_id || paper.id,
          insights,
          userId: paper.userId ?? (paper as any)?.user_id ?? DEFAULT_USER_ID,
          pdfUrl: pdfPreviewUrl,
          htmlUrl: htmlPreviewUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "AI解説の保存に失敗しました");
      }

      onSaveSummary?.(paper.id, insights);
      setSaveState({ status: "success", message: "AI解説を保存しました" });
      setTimeout(() => setSaveState({ status: "idle" }), 2500);
    } catch (error: any) {
      setSaveState({
        status: "error",
        message: error?.message ?? "保存に失敗しました",
      });
    }
  };

  const handlePreviewSave = useCallback(async () => {
    if (!paper) return;

    const trimmedPdf = pdfInput.trim();
    const trimmedHtml = htmlInput.trim();

    try {
      setPreviewState({ status: "saving" });
      const response = await fetch("/api/library/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId: paper.paperId || (paper as any)?.paper_id || paper.id,
          userId: paper.userId ?? (paper as any)?.user_id ?? DEFAULT_USER_ID,
          pdfUrl: trimmedPdf ? trimmedPdf : null,
          htmlUrl: trimmedHtml ? trimmedHtml : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "プレビューURLの保存に失敗しました");
      }

      const data = await response.json();
      const updated = data.paper ?? {};
      const nextPdf = updated.pdfUrl ?? trimmedPdf ?? null;
      const nextHtml = updated.htmlUrl ?? trimmedHtml ?? null;

      setPdfPreviewUrl(nextPdf);
      setHtmlPreviewUrl(nextHtml);
      onPreviewUpdate?.(paper.id, { pdfUrl: nextPdf, htmlUrl: nextHtml });

      setPreviewState({
        status: "success",
        message: "プレビューURLを保存しました",
      });
      setTimeout(() => setPreviewState({ status: "idle" }), 2500);
    } catch (error: any) {
      setPreviewState({
        status: "error",
        message: error?.message ?? "プレビューURLの保存に失敗しました",
      });
    }
  }, [htmlInput, onPreviewUpdate, paper, pdfInput]);

  const handleChatSend = useCallback(async () => {
    if (!paper) return;
    const question = chatDraft.trim();
    if (!question) return;

    setChatDraft("");
    setChatStatus("loading");
    setChatError(null);

    try {
      const response = await fetch("/api/library/insights-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId: paper.paperId || (paper as any)?.paper_id || paper.id,
          userId: paper.userId ?? (paper as any)?.user_id ?? DEFAULT_USER_ID,
          question,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "チャット回答の生成に失敗しました");
      }

      const data = (await response.json()) as InsightsChatResponse;

      setChatSessions((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          question,
          response: data,
          createdAt: new Date().toISOString(),
        },
      ]);
      setChatStatus("idle");
    } catch (error) {
      console.error("Insights chat send failed", error);
      setChatStatus("error");
      setChatError(
        error instanceof Error
          ? error.message
          : "チャット回答の生成に失敗しました"
      );
    }
  }, [chatDraft, paper]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedPdfName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setUploadedPdfBase64(result);
      } else if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result);
        let binary = "";
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });
        const base64 = `data:application/pdf;base64,${btoa(binary)}`;
        setUploadedPdfBase64(base64);
      }
    };
    reader.onerror = () => {
      setUploadedPdfName(null);
      setUploadedPdfBase64(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  if (!paper) return null;

  const overlayClass = isFullscreen
    ? "fixed inset-0 z-[70] bg-slate-900 overflow-y-auto"
    : "fixed inset-0 z-[60] bg-black/60 overflow-y-auto";

  const panelClass = `relative flex w-full flex-col overflow-hidden bg-white shadow-xl transition-all duration-300 md:flex-row ${
    isFullscreen
      ? "min-h-screen rounded-none"
      : "mx-auto my-10 max-w-6xl rounded-2xl"
  }`;

  return (
    <div className={`${overlayClass} ${isResizing ? "select-none" : ""}`}>
      <div ref={containerRef} className={panelClass}>
        {isFullscreen ? (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="sticky top-6 ml-auto mr-6 z-20 inline-flex items-center rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
          >
            閉じる
          </button>
        ) : null}

        <div
          className="flex max-h-full flex-col border-b border-slate-200 bg-slate-800 px-6 py-4 text-white md:border-b-0"
          style={{ flexBasis: `${leftPaneWidth}%`, minWidth: "0" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 pr-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                保存した論文
              </p>
              <h2 className="text-xl font-semibold leading-snug">
                {paper.title}
              </h2>
              {paper.authors ? (
                <p className="text-xs text-slate-200">{paper.authors}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
            >
              閉じる
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/30 px-3 py-1">
              引用数: {citationLabel}
            </span>
            {formattedDate ? (
              <span className="rounded-full border border-white/30 px-3 py-1">
                追加日時: {formattedDate}
              </span>
            ) : null}
            {summaryTimestamp ? (
              <span className="rounded-full border border-white/30 px-3 py-1">
                AI解説更新日: {summaryTimestamp}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="ml-auto inline-flex items-center rounded-full border border-white/40 px-4 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              {isFullscreen ? "通常表示" : "全画面"}
            </button>
          </div>

          {/* タグ管理 */}
          {onAddTag && onRemoveTag && onCreateTag && (
            <div className="mt-4">
              <TagManager
                paperId={paper.id}
                currentTags={(paper as any).tags || []}
                availableTags={availableTags}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onCreateTag={onCreateTag}
                className="text-white"
              />
            </div>
          )}
          <div className="mt-4 flex-1 overflow-hidden">
            <PreviewPanel
              pdfUrl={pdfPreviewUrl}
              htmlUrl={htmlPreviewUrl}
              fallbackUrl={paper.url ?? (paper as any)?.url}
              fullscreen={isFullscreen}
              hasPreview={hasPreview}
            />
          </div>
        </div>

        <div
          className="hidden md:block h-full w-[6px] cursor-col-resize bg-slate-200 transition hover:bg-slate-300"
          onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsResizing(true);
          }}
          onDoubleClick={() => setLeftPaneWidth(50)}
        />

        <div
          className="flex flex-1 flex-col overflow-y-auto bg-slate-50"
          style={{ minWidth: "0" }}
        >
          <div className="grid gap-4 p-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">
                プレビューURL設定
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                公開されている PDF または HTML の URL
                を登録すると左側でプレビューできます。
              </p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    PDF URL
                  </label>
                  <input
                    value={pdfInput}
                    onChange={(event) => setPdfInput(event.target.value)}
                    placeholder="https://...pdf"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    HTML URL
                  </label>
                  <input
                    value={htmlInput}
                    onChange={(event) => setHtmlInput(event.target.value)}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePreviewSave}
                    disabled={previewState.status === "saving"}
                    className="inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500"
                  >
                    {previewState.status === "saving"
                      ? "保存中..."
                      : "プレビューURLを保存"}
                  </button>
                  {previewState.status === "success" && previewState.message ? (
                    <span className="text-xs font-medium text-emerald-600">
                      {previewState.message}
                    </span>
                  ) : null}
                  {previewState.status === "error" && previewState.message ? (
                    <span className="text-xs font-medium text-red-600">
                      {previewState.message}
                    </span>
                  ) : null}
                </div>
                <div
                  {...getRootProps({
                    className:
                      "rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500 transition hover:border-slate-400 hover:bg-slate-100",
                  })}
                >
                  <input {...getInputProps()} />
                  {isDragActive ? (
                    <p>ここに PDF をドロップしてください...</p>
                  ) : (
                    <>
                      <p className="font-medium text-slate-700">
                        PDF をアップロード（ドラッグ＆ドロップまたはクリック）
                      </p>
                      <p className="mt-1 text-slate-500">
                        オープンアクセスで入手できない場合は、手元の PDF
                        を解析用にアップロードできます。
                      </p>
                      {uploadedPdfName ? (
                        <p className="mt-2 text-slate-600">
                          選択中: {uploadedPdfName}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleProcessContent({ force: false })}
                    className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    本文を解析
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcessContent({ force: true })}
                    className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    強制再解析
                  </button>
                  {ingestState.status === "saving" ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      {ingestState.message ?? "解析中..."}
                    </span>
                  ) : null}
                  {processingStatus.status === "processing" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${processingStatus.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">
                          {processingStatus.progress}%
                        </span>
                      </div>
                      <span className="text-xs text-slate-600">
                        {processingStatus.message}
                      </span>
                      {processingStatus.details && (
                        <div className="text-xs text-slate-500">
                          チャンク: {processingStatus.details.chunkCount} |
                          埋め込み: {processingStatus.details.embeddingCount} |
                          AI解説:{" "}
                          {processingStatus.details.hasAiSummary
                            ? "完了"
                            : "生成中"}
                        </div>
                      )}
                    </div>
                  )}
                  {ingestState.status === "error" ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-red-600">
                      {ingestState.message ?? "解析に失敗しました"}
                    </span>
                  ) : null}
                  {ingestState.status === "success" ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">
                      {ingestState.message ?? "解析が完了しました"}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  AIによる解説
                </h3>
                {insights ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">
                    仮保存中
                  </span>
                ) : null}
                {paper.aiSummary && !insights ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-700">
                    保存済みを表示中
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                図表の読みどころと落合方式に基づくレビューを生成します。
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateInsights}
                  disabled={aiLoading}
                  className="inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {aiLoading ? "生成中..." : "AI解説を生成"}
                </button>
                {insights ? (
                  <button
                    type="button"
                    onClick={handleSaveSummary}
                    disabled={saveState.status === "saving"}
                    className="inline-flex items-center rounded-full border border-slate-500 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saveState.status === "saving"
                      ? "保存中..."
                      : "この解説を保存"}
                  </button>
                ) : null}
              </div>
              {aiError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                  {aiError}
                </div>
              ) : null}
              {saveState.status === "success" && saveState.message ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                  {saveState.message}
                </div>
              ) : null}
              <InsightsView
                paper={paper}
                insights={
                  insights ??
                  paper.aiSummary ??
                  (paper as any)?.ai_summary ??
                  null
                }
                aiLoading={aiLoading}
                aiError={aiError}
                onGenerate={handleGenerateInsights}
                onSave={handleSaveSummary}
                latestSessions={chatSessions}
              />
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  AI チャット
                </h3>
                {chatStatus === "loading" ? (
                  <span className="text-xs text-slate-500">回答生成中...</span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                生成済みの本文コンテキストをもとに、論文に関する質問に回答します。
              </p>
              {chatError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {chatError}
                </div>
              ) : null}
              <div className="space-y-3">
                <div className="max-h-72 space-y-3 overflow-y-auto">
                  {chatSessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-xs text-slate-500">
                      ここにチャット履歴が表示されます。AI解説を生成すると、初回のインデックス化が行われます。
                    </div>
                  ) : (
                    chatSessions.map((session) => (
                      <article
                        key={session.id}
                        className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-700">
                            質問: {session.question}
                          </p>
                          <div className="space-y-1">
                            {session.response.paragraphs.map(
                              (paragraph, index) => (
                                <p
                                  key={`${session.id}-chat-${index}`}
                                  className="whitespace-pre-wrap"
                                >
                                  {paragraph.content}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                        {session.response.references.length > 0 ? (
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                            <p className="font-semibold text-slate-700">
                              参照したコンテキスト
                            </p>
                            <ul className="mt-1 space-y-1">
                              {session.response.references.map((ref) => (
                                <li
                                  key={`${session.id}-ref-${ref.id}`}
                                  className="rounded border border-slate-200 bg-white p-2"
                                >
                                  <p className="font-semibold text-slate-700">
                                    {ref.sectionTitle ?? "セクション不明"}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    類似度: {ref.similarity.toFixed(3)} /
                                    ページ: {ref.pageNumber ?? "情報なし"}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-600">
                                    {ref.excerpt}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {session.response.externalReferences &&
                        session.response.externalReferences.length > 0 ? (
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <p className="font-semibold text-slate-700">
                              外部参照
                            </p>
                            <ul className="mt-1 space-y-1">
                              {session.response.externalReferences.map(
                                (item, index) => (
                                  <li
                                    key={`${session.id}-ext-${index}`}
                                    className="space-y-1 rounded border border-slate-200 bg-slate-50 p-2"
                                  >
                                    <p className="text-sm font-semibold text-slate-700">
                                      {item.title}
                                    </p>
                                    {item.authors ? (
                                      <p className="text-[11px] text-slate-500">
                                        著者: {item.authors}
                                      </p>
                                    ) : null}
                                    {item.summary ? (
                                      <p className="text-[11px] text-slate-600">
                                        概要: {item.summary}
                                      </p>
                                    ) : null}
                                    {item.url ? (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-[11px] text-slate-500 underline"
                                      >
                                        リンクを開く
                                      </a>
                                    ) : null}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <textarea
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder="本文について質問してみましょう"
                    rows={3}
                    className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleChatSend}
                      disabled={
                        chatDraft.trim().length === 0 ||
                        chatStatus === "loading"
                      }
                      className="inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500"
                    >
                      {chatStatus === "loading" ? "送信中..." : "送信"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {paper.abstract ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    論文の概要
                  </h3>
                  {paper.abstract.length >= 380 ? (
                    <button
                      type="button"
                      onClick={() => setShowFullAbstract((prev) => !prev)}
                      className="text-xs font-semibold text-slate-600 hover:underline"
                    >
                      {showFullAbstract ? "概要を閉じる" : "全文を表示"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {showFullAbstract || paper.abstract.length < 380
                    ? paper.abstract
                    : `${paper.abstract.slice(0, 360)}...`}
                </p>
              </section>
            ) : null}

            {paper.notes ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">メモ</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {paper.notes}
                </p>
              </section>
            ) : null}
          </div>

          <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(paper.title ?? "")
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                タイトルをコピー
              </button>
              {paper.url ? (
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(paper.url ?? "")
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  リンクをコピー
                </button>
              ) : null}
            </div>
            {insights && saveState.status === "idle" ? (
              <span className="text-[10px] font-semibold text-slate-600">
                ※ AI解説は保存ボタンを押すとライブラリに反映されます
              </span>
            ) : null}
          </footer>
        </div>
      </div>
    </div>
  );
}

interface ReviewBlockProps {
  title: string;
  body: string;
}

function ReviewBlock({ title, body }: ReviewBlockProps) {
  if (!body) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
        {body}
      </p>
    </div>
  );
}

function InsightsView({
  paper,
  insights,
  aiLoading,
  aiError,
  onGenerate,
  onSave,
  latestSessions,
}: {
  paper: LibraryPaper;
  insights: PaperAIInsights | null;
  aiLoading: boolean;
  aiError: string | null;
  onGenerate: () => void;
  onSave: () => void;
  latestSessions: InsightsChatSession[];
}) {
  if (!insights) {
    return (
      <p className="text-xs text-slate-500">
        まだAI解説は生成されていません。生成ボタンを押すと、図表の読みどころと落合方式レビューが表示されます。
      </p>
    );
  }

  const figureCards = useMemo(() => {
    const cards: { title: string; details: string[] }[] = [];
    let current: { title: string; details: string[] } | null = null;

    insights.figureInsights?.forEach((raw) => {
      const trimmed = raw.trim();
      if (/^figure\s*\d+/i.test(trimmed)) {
        if (current) {
          cards.push(current);
        }
        current = {
          title: trimmed,
          details: [],
        };
      } else {
        if (!current) {
          current = {
            title: "図解説",
            details: [],
          };
        }
        if (trimmed.length > 0) {
          current.details.push(trimmed);
        }
      }
    });

    if (current) {
      cards.push(current);
    }

    return cards;
  }, [insights.figureInsights]);

  return (
    <div className="space-y-4 text-sm text-slate-700">
      {figureCards.length ? (
        <div className="grid gap-3">
          {figureCards.map((card, index) => (
            <div
              key={`figure-${index}`}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-slate-700">
                {card.title || `図解説 ${index + 1}`}
              </p>
              {card.details.length ? (
                <div className="mt-2 space-y-2">
                  {card.details.map((detail, detailIndex) => (
                    <p
                      key={`figure-${index}-detail-${detailIndex}`}
                      className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700"
                    >
                      {detail}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          図の詳細は取得できませんでした。PDF や HTML
          の本文が利用可能か確認してください。
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <ReviewBlock title="Overview" body={insights.ochiaiReview.overview} />
        <ReviewBlock
          title="Background"
          body={insights.ochiaiReview.background}
        />
        <ReviewBlock title="Method" body={insights.ochiaiReview.method} />
        <ReviewBlock title="Results" body={insights.ochiaiReview.results} />
        <ReviewBlock
          title="Discussion"
          body={insights.ochiaiReview.discussion}
        />
        <ReviewBlock
          title="Future Work"
          body={insights.ochiaiReview.futureWork}
        />
      </div>

      {insights.caveats?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-sm font-semibold text-amber-700">注意点・補足</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-amber-700">
            {insights.caveats.map((item, index) => (
              <li key={`caveat-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {insights.sources?.length ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-700">参考情報</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
            {insights.sources.map((item, index) => (
              <li key={`src-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {latestSessions.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">
            直近のチャット回答
          </h3>
          <div className="space-y-4">
            {latestSessions.map((session) => (
              <article
                key={session.id}
                className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-700">
                    質問: {session.question}
                  </p>
                  <time className="text-[11px] text-slate-500">
                    {new Date(session.createdAt).toLocaleString("ja-JP")}
                  </time>
                </header>
                <div className="space-y-1">
                  {session.response.paragraphs.map((paragraph, index) => (
                    <p
                      key={`${session.id}-review-${index}`}
                      className="whitespace-pre-wrap"
                    >
                      {paragraph.content}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PreviewPanel({
  pdfUrl,
  htmlUrl,
  fallbackUrl,
  fullscreen,
  hasPreview,
}: {
  pdfUrl?: string | null;
  htmlUrl?: string | null;
  fallbackUrl?: string;
  fullscreen: boolean;
  hasPreview: boolean;
}) {
  const frameHeight = fullscreen ? "min-h-[calc(100vh-220px)]" : "min-h-[65vh]";

  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">本文プレビュー</h3>
        {fallbackUrl ? (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-white/70 hover:underline"
          >
            外部リンクで開く
          </a>
        ) : null}
      </div>

      {hasPreview ? (
        pdfUrl ? (
          <iframe
            src={`${pdfUrl}#view=FitH&toolbar=0`}
            className={`w-full flex-1 rounded-lg border border-white/30 bg-slate-900 ${frameHeight}`}
            title="paper-preview-pdf"
          />
        ) : htmlUrl ? (
          <iframe
            src={htmlUrl}
            className={`w-full flex-1 rounded-lg border border-white/30 bg-white ${frameHeight}`}
            title="paper-preview-html"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        ) : null
      ) : (
        <div
          className={`flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/40 bg-white/10 px-4 py-6 text-sm text-white/70 ${frameHeight}`}
        >
          右ペインの「プレビューURL設定」から PDF または HTML の URL
          を登録すると、ここに本文が表示されます。
        </div>
      )}
    </section>
  );
}
