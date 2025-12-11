"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Network } from "lucide-react";
import {
  LibraryPaper,
  PaperAIInsights,
  InsightsChatResponse,
  InsightsChatSession,
  InsightsChatParagraph,
  InsightsChatReference,
} from "@/types";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import TagManager from "./TagManager";
import { SUMMARY_CATEGORIES, type SummaryCategoryKey } from "@/lib/summary-categories";

const DEFAULT_USER_ID = "demo-user-123";

export interface PaperDetailPanelProps {
  paper: LibraryPaper | null;
  onClose: () => void;
  onSaveSummary?: (paperId: string, insights: PaperAIInsights) => void;
  onPreviewUpdate?: (
    paperId: string,
    payload: {
      pdfUrl?: string | null;
      htmlUrl?: string | null;
      pdfStoragePath?: string | null;
      pdfFileName?: string | null;
    }
  ) => void;
  onAddTag?: (paperId: string, tag: string) => void;
  onRemoveTag?: (paperId: string, tag: string) => void;
  onCreateTag?: (tag: string) => void;
  availableTags?: string[];
  allPapers?: Array<{ tags?: string[] }>;
}

interface SaveProgress {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
}

interface ProcessingStatus {
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  message: string;
  grobid?: {
    status: "pending" | "processing" | "completed" | "error";
    message: string;
    processedAt?: string | null;
    error?: string | null;
  };
  details?: {
    hasContent: boolean;
    hasEmbeddings: boolean;
    hasAiSummary: boolean;
    chunkCount: number;
    embeddingCount: number;
    sectionCount: number;
  };
}

interface ReferenceHighlight {
  id: string;
  text: string;
  pageNumber?: number | null;
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
  allPapers = [],
}: PaperDetailPanelProps) {
  const router = useRouter();
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

  const grobidData = useMemo(() => {
    if (!paper) return null;
    return (
      (paper as any)?.grobidData ??
      (paper as any)?.grobid_data ??
      null
    );
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
  const [lastIngestSummary, setLastIngestSummary] = useState<{ totalChunks: number; pdfChunks: number; htmlChunks: number } | null>(null);
  const [uploadState, setUploadState] = useState<SaveProgress>({
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
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  const [activeReference, setActiveReference] =
    useState<ReferenceHighlight | null>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState(50);
  const [containerWidth, setContainerWidth] = useState<number | null>(null); // null = デフォルト幅（max-w-6xl）
  const [containerLeft, setContainerLeft] = useState<number | null>(null); // null = 中央揃え
  // GROBID要約生成用の状態
  const [summaryCategories, setSummaryCategories] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [generatedSummaries, setGeneratedSummaries] = useState<Record<string, string>>({});
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // GROBID処理状態を確認
  // paperオブジェクトに直接grobidDataがある場合も完了とみなす
  const hasGrobidData = !!grobidData;
  const grobidStatusFromApi = processingStatus?.grobid?.status || "pending";
  // processingStatusからもGROBID完了状態を確認
  const hasGrobidOutput = processingStatus?.details?.hasGrobidOutput || false;
  const grobidStatus = hasGrobidData || hasGrobidOutput || grobidStatusFromApi === "completed" ? "completed" : grobidStatusFromApi;
  const grobidMessage = processingStatus?.grobid?.message || (hasGrobidData || hasGrobidOutput ? "GROBID解析完了" : "GROBID解析待ち");
  const grobidError = processingStatus?.grobid?.error;
  const isGrobidCompleted = grobidStatus === "completed" || hasGrobidData || hasGrobidOutput;
  const isGrobidProcessing = grobidStatus === "processing" && !hasGrobidData && !hasGrobidOutput;
  const isGrobidError = grobidStatus === "error" && !hasGrobidData && !hasGrobidOutput;
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 保存済み要約を取得
  const fetchSavedSummaries = useCallback(async () => {
    if (!paper) return;
    const paperId = paper.paperId || (paper as any)?.paper_id;
    if (!paperId) return;
    
    try {
      const response = await fetch(
        `/api/library/summaries?paperId=${paperId}&userId=${paper.userId || DEFAULT_USER_ID}`
      );
      if (response.ok) {
        const data = await response.json();
        setGeneratedSummaries(data.summaries || {});
      }
    } catch (error) {
      console.error("Failed to fetch summaries:", error);
    }
  }, [paper]);

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
    setContainerWidth(null);
    setContainerLeft(null);
    setUploadedPdfName(null);
    setUploadedPdfBase64(null);
    setIngestState({ status: "idle" });
    setUploadState({ status: "idle" });
    setSummaryCategories([]);
    setSummaryError(null);
    setGeneratedSummaries({});
    setActiveReference(null);
    if (paper?.paperId || (paper as any)?.paper_id) {
      fetchSavedSummaries();
    }
    setChatSuggestions(deriveChatSuggestions(paper, grobidData));
  }, [
    fetchSavedSummaries,
    grobidData,
    initialHtmlUrl,
    initialInsights,
    initialPdfUrl,
    paper,
  ]);
  
  // GROBID要約生成
  const handleGenerateSummaries = useCallback(async () => {
    if (!paper || summaryCategories.length === 0) return;
    
    const paperId = paper.paperId || (paper as any)?.paper_id;
    if (!paperId) {
      setSummaryError("論文IDが見つかりません");
      return;
    }
    
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      
      const response = await fetch("/api/library/summaries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId,
          userId: paper.userId || DEFAULT_USER_ID,
          categories: summaryCategories as SummaryCategoryKey[],
        }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "要約の生成に失敗しました");
      }
      
      const data = await response.json();
      setGeneratedSummaries((prev) => ({
        ...prev,
        ...data.summaries,
      }));
      
      // 保存済み要約を再取得
      await fetchSavedSummaries();
      
      // 成功メッセージ
      if (Object.keys(data.summaries).length > 0) {
        setSummaryError(null);
      }
    } catch (error: any) {
      setSummaryError(error?.message || "要約の生成に失敗しました");
    } finally {
      setSummaryLoading(false);
    }
  }, [paper, summaryCategories, fetchSavedSummaries]);

  // 自動処理の進捗監視
  const errorCountRef = useRef(0);
  
  useEffect(() => {
    if (!paper?.id) return;

    const maxErrors = 5; // 連続で5回エラーが発生したら停止
    errorCountRef.current = 0; // paperが変更されたらエラーカウントをリセット

    const checkProcessingStatus = async () => {
      // 連続でエラーが発生している場合は停止
      if (errorCountRef.current >= maxErrors) {
        return null;
      }

      // タイムアウト用のAbortControllerを作成
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒でタイムアウト
      
      try {
        const response = await fetch(
          `/api/library/processing-status?paperId=${paper.id}&userId=${DEFAULT_USER_ID}`,
          {
            signal: controller.signal,
          }
        );
        
        clearTimeout(timeoutId); // 成功したらタイムアウトをクリア
        
        if (response.ok) {
          const status = await response.json();
          setProcessingStatus(status);
          errorCountRef.current = 0; // 成功したらエラーカウントをリセット
          return status;
        } else {
          // HTTPエラーレスポンス
          clearTimeout(timeoutId); // タイムアウトをクリア
          console.warn(`Processing status check failed: ${response.status} ${response.statusText}`);
          errorCountRef.current++;
          
          // 連続でエラーが発生した場合は、エラーステータスを設定
          if (errorCountRef.current >= maxErrors) {
            console.error(`Processing status check failed ${maxErrors} times in a row, stopping polling`);
            setProcessingStatus({
              status: "error",
              progress: 0,
              message: "処理ステータスの取得に失敗しました。ページを再読み込みしてください。",
              grobid: {
                status: "error",
                message: "ステータス取得エラー",
              },
              details: {
                hasContent: false,
                hasEmbeddings: false,
                hasAiSummary: false,
                chunkCount: 0,
                embeddingCount: 0,
                sectionCount: 0,
              },
            });
          }
          
          return null;
        }
      } catch (error: any) {
        clearTimeout(timeoutId); // エラー時もタイムアウトをクリア
        errorCountRef.current++;
        
        // ネットワークエラーやタイムアウトエラーを詳細にログ
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          console.warn("Processing status check timeout:", error);
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.warn("Network error while checking processing status:", error);
        } else {
          console.error("Failed to check processing status:", error);
        }
        
        // 連続でエラーが発生した場合は、エラーステータスを設定
        if (errorCountRef.current >= maxErrors) {
          console.error(`Processing status check failed ${maxErrors} times in a row, stopping polling`);
          setProcessingStatus({
            status: "error",
            progress: 0,
            message: "処理ステータスの取得に失敗しました。ページを再読み込みしてください。",
            grobid: {
              status: "error",
              message: "ステータス取得エラー",
            },
            details: {
              hasContent: false,
              hasEmbeddings: false,
              hasAiSummary: false,
              chunkCount: 0,
              embeddingCount: 0,
              sectionCount: 0,
            },
          });
        }
        
        return null;
      }
    };

    // 初回チェック
    checkProcessingStatus();

    // 処理中の場合は定期的にチェック（GROBID解析完了後もチャンク数が更新されるまで続ける）
    let checkCount = 0;
    const maxChecks = 60; // 最大60回（3分）に延長
    let grobidCompleted = false;
    
    const interval = setInterval(async () => {
      // 連続でエラーが発生している場合は停止
      if (errorCountRef.current >= maxErrors) {
        clearInterval(interval);
        console.log("Stopping processing status check due to repeated errors");
        return;
      }

      checkCount++;
      const status = await checkProcessingStatus();

      // ステータスが取得できなかった場合はスキップ
      if (!status) {
        return;
      }

      // GROBID解析が完了したかチェック
      if (status?.grobid?.status === "completed" || status?.details?.hasGrobidOutput) {
        grobidCompleted = true;
      }

      // GROBID解析が完了している場合、チャンク数が0より大きくなるまで、または最大チェック回数に達するまで続ける
      // エラーが発生した場合は停止
      if (
        (status?.status === "error") ||
        (checkCount >= maxChecks) ||
        (grobidCompleted && status?.details?.chunkCount > 0) ||
        (grobidCompleted && checkCount >= 20) // GROBID完了後は20回（1分）でタイムアウト
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
    if (!isResizing && !isResizingLeft && !isResizingRight) {
      document.body.style.cursor = "";
      return;
    }

    document.body.style.cursor = "col-resize";

    function handleMouseMove(event: MouseEvent) {
      if (!containerRef.current) return;
      
      if (isResizingLeft) {
        // 左端のハンドル: ページ全体の幅を変更（画面の左端からの距離）
        const currentBounds = containerRef.current.getBoundingClientRect();
        const newLeft = Math.max(50, event.clientX); // 最小左マージン50px
        const currentRight = currentBounds.right;
        const newWidth = currentRight - newLeft;
        const minWidth = 600; // 最小幅
        const maxWidth = window.innerWidth - newLeft - 50; // 最大幅（右マージン50pxを考慮）
        const clampedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
        setContainerLeft(newLeft);
        setContainerWidth(clampedWidth);
      } else if (isResizingRight) {
        // 右端のハンドル: ページ全体の幅を変更（コンテナの左端からの距離）
        const currentBounds = containerRef.current.getBoundingClientRect();
        const currentLeft = containerLeft !== null ? containerLeft : currentBounds.left;
        const newWidth = event.clientX - currentLeft;
        const minWidth = 600; // 最小幅
        const maxWidth = window.innerWidth - currentLeft - 100; // 最大幅（余白を考慮）
        const clamped = Math.min(maxWidth, Math.max(minWidth, newWidth));
        setContainerWidth(clamped);
      } else if (isResizing) {
        // 中央のハンドル: 左右パネルの比率を変更（ページ幅は固定）
        const bounds = containerRef.current.getBoundingClientRect();
        const relativeX = event.clientX - bounds.left;
        const percentage = (relativeX / bounds.width) * 100;
        const clamped = Math.min(70, Math.max(30, percentage));
        console.log(`Central handle: relativeX=${relativeX}, percentage=${percentage}, clamped=${clamped}, isResizing=${isResizing}`);
        setLeftPaneWidth(clamped);
      }
    }

    function handleMouseUp() {
      setIsResizing(false);
      setIsResizingLeft(false);
      setIsResizingRight(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isResizing, isResizingLeft, isResizingRight]);

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
      // paper.idはuser_library.id（UUID）、paper.paperIdはpaper_id（TEXT）
      // library_pdf_chunksテーブルのpaper_idはuser_library.id（UUID）を参照するため、paper.idを使用
      const libraryId = paper.id; // user_library.id（UUID）
      const paperId = paper.paperId || (paper as any)?.paper_id; // paper_id（TEXT）
      const userId = paper.userId ?? (paper as any)?.user_id ?? DEFAULT_USER_ID;

      setIngestState({ status: "saving", message: "GROBID解析中" });

      try {
        const response = await fetch("/api/library/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paperId: libraryId, // user_library.id（UUID）を渡す
            paperIdText: paperId, // paper_id（TEXT）も渡す（検索用）
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
              "GROBID解析に失敗しました。URL や PDF を確認してください"
          );
        }

        const payload = await response.json();
        
        // チャンク情報を保存
        if (payload?.summary) {
          setLastIngestSummary({
            totalChunks: payload.summary.totalChunks ?? 0,
            pdfChunks: payload.summary.pdfChunks ?? 0,
            htmlChunks: payload.summary.htmlChunks ?? 0,
          });
        }

        setIngestState({
          status: "success",
          message: `GROBID解析が完了しました (チャンク数: ${
            payload?.summary?.totalChunks ?? 0
          })`,
        });
        
        // 処理状態を再取得してUIを更新
        try {
          const statusResponse = await fetch(
            `/api/library/processing-status?paperId=${libraryId}&userId=${userId}`
          );
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            setProcessingStatus(status);
          }
        } catch (error) {
          console.error("Failed to refresh processing status:", error);
        }
        
        setTimeout(() => setIngestState({ status: "idle" }), 4000);
        return true;
      } catch (error: any) {
        console.error("Process content failed", error);
        setIngestState({
          status: "error",
          message: error?.message ?? "GROBID解析に失敗しました",
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
          "GROBID解析が完了していません。URLやPDFを確認してください。"
        );
      }

      const response = await fetch("/api/paper-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paperId: paper.paperId || (paper as any)?.paper_id,
          userId: paper.userId ?? (paper as any)?.user_id ?? DEFAULT_USER_ID,
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

  const sendChatQuestion = useCallback(
    async (rawQuestion: string) => {
      if (!paper) return;
      const question = rawQuestion.trim();
      if (!question) return;

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
          throw new Error(
            payload.error || "チャット回答の生成に失敗しました"
          );
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
    },
    [paper]
  );

  const handleChatSend = useCallback(() => {
    const question = chatDraft.trim();
    if (!question) return;
    setChatDraft("");
    void sendChatQuestion(question);
  }, [chatDraft, sendChatQuestion]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      void sendChatQuestion(suggestion);
    },
    [sendChatQuestion]
  );

  const handleReferenceSelect = useCallback(
    (reference: InsightsChatReference, index: number) => {
      const candidateText =
        (reference as any)?.text?.toString() ??
        reference.excerpt?.toString() ??
        "";
      if (!candidateText) {
        return;
      }
      setActiveReference({
        id: reference.id ?? `ref-${index}`,
        text: candidateText,
        pageNumber: reference.pageNumber ?? null,
      });
    },
    []
  );

  const uploadPdfToDatabase = useCallback(
    async (base64Data: string, originalName: string) => {
      if (!paper) return;
      const paperId = paper.paperId || (paper as any)?.paper_id || paper.id;
      const userId = paper.userId ?? (paper as any)?.user_id ?? DEFAULT_USER_ID;

      try {
        setUploadState({ status: "saving", message: "PDFをアップロードしています..." });
        const response = await fetch("/api/library/pdf-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paperId,
            userId,
            fileName: originalName,
            content: base64Data,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "PDFのアップロードに失敗しました");
        }

        const payload = await response.json();
        const nextPdfUrl = payload.publicUrl as string | undefined;
        const storagePath = (payload.path as string | undefined) ?? null;
        const savedFileName = (payload.fileName as string | undefined) ?? null;

        if (nextPdfUrl) {
          setPdfPreviewUrl(nextPdfUrl);
          setPdfInput(nextPdfUrl);
          onPreviewUpdate?.(paper.id, {
            pdfUrl: nextPdfUrl,
            htmlUrl: htmlPreviewUrl,
            pdfStoragePath: storagePath,
            pdfFileName: savedFileName,
          });
        }

        setUploadState({
          status: "success",
          message: "PDFを保存しました。GROBID解析を実行できます。",
        });
        setTimeout(() => setUploadState({ status: "idle" }), 4000);
      } catch (error: any) {
        console.error("PDF upload failed", error);
        setUploadState({
          status: "error",
          message: error?.message ?? "PDFのアップロードに失敗しました",
        });
        setTimeout(() => setUploadState({ status: "idle" }), 5000);
      }
    },
    [htmlPreviewUrl, onPreviewUpdate, paper]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploadedPdfName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setUploadedPdfBase64(result);
          uploadPdfToDatabase(result, file.name);
        } else if (result instanceof ArrayBuffer) {
          const bytes = new Uint8Array(result);
          let binary = "";
          bytes.forEach((b) => {
            binary += String.fromCharCode(b);
          });
          const base64 = `data:application/pdf;base64,${btoa(binary)}`;
          setUploadedPdfBase64(base64);
          uploadPdfToDatabase(base64, file.name);
        }
      };
      reader.onerror = () => {
        setUploadedPdfName(null);
        setUploadedPdfBase64(null);
        setUploadState({
          status: "error",
          message: "PDFの読み込みに失敗しました",
        });
        setTimeout(() => setUploadState({ status: "idle" }), 4000);
      };
      reader.readAsDataURL(file);
    },
    [uploadPdfToDatabase]
  );

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
      : containerWidth === null
      ? "mx-auto my-10 max-w-6xl rounded-2xl"
      : "mx-auto my-10 rounded-2xl"
  }`;
  // 中央ハンドル用に親要素をrelativeにする（既にrelativeが含まれている）

  return (
    <div className={`${overlayClass} ${(isResizing || isResizingLeft || isResizingRight) ? "select-none" : ""}`}>
      <div 
        ref={containerRef} 
        className={panelClass}
        style={
          containerWidth !== null || containerLeft !== null
            ? {
                width: containerWidth !== null ? `${containerWidth}px` : undefined,
                left: containerLeft !== null ? `${containerLeft}px` : undefined,
                marginLeft: containerLeft !== null ? '0' : undefined,
                marginRight: containerLeft !== null ? 'auto' : undefined,
                position: containerLeft !== null ? 'relative' : undefined,
              }
            : undefined
        }
      >
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
          className="relative flex max-h-full flex-col border-b border-slate-200 bg-slate-800 px-6 py-4 text-white md:border-b-0"
          style={{ flexBasis: `${leftPaneWidth}%`, minWidth: "0" }}
        >
          {/* 左側のリサイズハンドル */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 z-10 cursor-col-resize bg-transparent hover:bg-blue-500/30 transition-colors group"
            onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
              event.preventDefault();
              event.stopPropagation();
              setIsResizingLeft(true);
            }}
            title="ドラッグして幅を調整"
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-blue-500/0 group-hover:bg-blue-500 rounded-full transition-all" />
          </div>
          
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const doi = (paper as any)?.doi;
                  const htmlUrl = (paper as any)?.htmlUrl || (paper as any)?.html_url;
                  const url = (paper as any)?.url || paper.url;
                  const title = paper.title;
                  const authors = paper.authors;
                  const year = paper.year;
                  
                  // URLからpaperIdを抽出（Semantic Scholar URLの場合）
                  let paperId: string | null = null;
                  if (url) {
                    console.log(`[PaperDetailPanel] Extracting paperId from URL: ${url}`);
                    // Semantic Scholar URLの形式:
                    // - https://www.semanticscholar.org/paper/{paperId}
                    // - https://www.semanticscholar.org/paper/{title-slug}/{paperId}
                    // paperIdは通常、英数字とハイフンで構成される（例: abc123def456）
                    // 最後のスラッシュの後、クエリパラメータやフラグメントの前までを取得
                    const paperIdMatch = url.match(/semanticscholar\.org\/paper\/(?:[^\/]+\/)?([a-zA-Z0-9\-]+)(?:\?|#|$)/i) ||
                                         url.match(/semanticscholar\.org\/paper\/([a-zA-Z0-9\-]+)(?:\?|#|$)/i);
                    if (paperIdMatch && paperIdMatch[1]) {
                      paperId = paperIdMatch[1].trim();
                      // paperIdの検証（空でない、適切な長さである、英数字とハイフンのみ）
                      if (paperId.length > 0 && paperId.length < 200 && /^[a-zA-Z0-9\-]+$/.test(paperId)) {
                        console.log(`[PaperDetailPanel] Extracted paperId: ${paperId} (length: ${paperId.length})`);
                      } else {
                        console.warn(`[PaperDetailPanel] Invalid paperId extracted: ${paperId} (length: ${paperId.length})`);
                        paperId = null;
                      }
                    } else {
                      console.warn(`[PaperDetailPanel] Could not extract paperId from URL: ${url}`);
                    }
                  }
                  
                  if (paperId) {
                    // paperIdから直接Citation Mapを生成
                    console.log(`[PaperDetailPanel] Navigating to Citation Map with paperId: ${paperId}`);
                    router.push(`/tools/citation-map?paperId=${encodeURIComponent(paperId)}`);
                  } else if (doi) {
                    console.log(`[PaperDetailPanel] Navigating to Citation Map with DOI: ${doi}`);
                    router.push(`/tools/citation-map?doi=${encodeURIComponent(doi)}`);
                  } else if (htmlUrl) {
                    console.log(`[PaperDetailPanel] Navigating to Citation Map with HTML URL: ${htmlUrl}`);
                    router.push(`/tools/citation-map?html=${encodeURIComponent(htmlUrl)}`);
                  } else if (title) {
                    // タイトルと著者名から検索
                    const searchQuery = [title, authors, year].filter(Boolean).join(" ");
                    console.log(`[PaperDetailPanel] Navigating to Citation Map with search query: ${searchQuery}`);
                    router.push(`/tools/citation-map?search=${encodeURIComponent(searchQuery)}`);
                  } else {
                    alert("DOI、HTML URL、またはタイトルがありません。Citation Mapを表示できません。");
                  }
                }}
                className="flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
              >
                <Network className="h-3 w-3" />
                Citation Map
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/40 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
              >
                閉じる
              </button>
            </div>
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
            {/* リンク情報の表示 */}
            {(() => {
              const linkedFrom = (paper as any)?.linkedFrom || [];
              if (linkedFrom.length > 0) {
                return (
                  <div className="flex flex-wrap gap-2">
                    {linkedFrom.map((link: any, index: number) => (
                      <span
                        key={index}
                        className="rounded-full border border-blue-400/50 bg-blue-500/20 px-3 py-1"
                      >
                        {link.type === "manuscript" && (
                          <a
                            href={`/manuscript/${link.worksheetId}/paragraphs/${link.paragraphId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            Manuscript: {link.paragraphId}
                          </a>
                        )}
                      </span>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
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
                allPapers={allPapers}
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
              activeReference={activeReference}
            />
          </div>
        </div>

        {/* 中央のリサイズハンドル（左右パネルの比率を変更） - ページ全域に表示 */}
        <div
          className="absolute top-0 bottom-0 w-4 cursor-col-resize bg-slate-200 hover:bg-green-500/50 transition-colors group flex items-center justify-center z-20"
          style={{
            left: leftPaneWidth !== null ? `${leftPaneWidth}%` : '50%',
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            console.log("Central handle mouse down, setting isResizing to true");
            setIsResizing(true);
          }}
          onDoubleClick={() => setLeftPaneWidth(50)}
          title="ドラッグして左右パネルの比率を調整"
        >
          <div className="w-1.5 h-24 bg-green-500/0 group-hover:bg-green-500 rounded-full transition-all shadow-lg group-hover:shadow-green-500/50" />
        </div>

        <div
          className="relative flex flex-1 flex-col overflow-y-auto bg-slate-50"
          style={{ minWidth: "0" }}
        >
          {/* 右端のリサイズハンドル（ページ全体の幅を変更） */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 z-10 cursor-col-resize bg-transparent hover:bg-blue-500/30 transition-colors group"
            onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
              event.preventDefault();
              event.stopPropagation();
              setIsResizingRight(true);
            }}
            title="ドラッグしてページ幅を調整"
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-blue-500/0 group-hover:bg-blue-500 rounded-full transition-all" />
          </div>
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
                {uploadState.status === "saving" && uploadState.message ? (
                  <p className="text-xs font-medium text-slate-600">
                    {uploadState.message}
                  </p>
                ) : null}
                {uploadState.status === "success" && uploadState.message ? (
                  <p className="text-xs font-medium text-emerald-600">
                    {uploadState.message}
                  </p>
                ) : null}
                {uploadState.status === "error" && uploadState.message ? (
                  <p className="text-xs font-medium text-red-600">
                    {uploadState.message}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleProcessContent({ force: false })}
                    className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    GROBID解析
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

            {/* GROBID処理状態表示 */}
            <div className={`mb-4 rounded-lg border p-4 ${
                isGrobidError 
                  ? "border-red-300 bg-red-50 dark:bg-red-900/20" 
                  : isGrobidProcessing
                  ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20"
                  : isGrobidCompleted
                  ? "border-green-300 bg-green-50 dark:bg-green-900/20"
                  : "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20"
              }`}>
                <div className="flex items-start gap-2">
                  {isGrobidProcessing && (
                    <svg className="animate-spin h-5 w-5 text-blue-600 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isGrobidCompleted && (
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-[var(--color-text)] mb-2">
                      {isGrobidError ? "GROBID解析エラー" : isGrobidProcessing ? "GROBID解析中" : isGrobidCompleted ? "GROBID解析完了" : "GROBID解析待ち"}
                    </div>
                    
                    {isGrobidCompleted ? (
                      <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                        {/* GROBID情報一覧 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <div className="font-semibold text-[var(--color-text)] mb-1">チャンク数</div>
                            <div className="text-sm font-medium text-[var(--color-primary)]">
                              {lastIngestSummary?.totalChunks ?? processingStatus?.details?.chunkCount ?? 0}
                              {lastIngestSummary && (
                                <span className="text-xs text-[var(--color-text-secondary)] ml-1">
                                  (PDF: {lastIngestSummary.pdfChunks}, HTML: {lastIngestSummary.htmlChunks})
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-text)] mb-1">埋め込み数</div>
                            <div className="text-sm font-medium text-[var(--color-primary)]">
                              {processingStatus?.details?.embeddingCount ?? 0}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-text)] mb-1">セクション数</div>
                            <div className="text-sm font-medium text-[var(--color-primary)]">
                              {processingStatus?.details?.sectionCount ?? (grobidData?.sections?.length ?? 0)}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-text)] mb-1">処理日時</div>
                            <div className="text-sm">
                              {processingStatus?.grobid?.processedAt 
                                ? new Date(processingStatus.grobid.processedAt).toLocaleString("ja-JP")
                                : grobidData ? "完了" : "不明"}
                            </div>
                          </div>
                        </div>
                        
                        {/* GROBIDデータの詳細情報 */}
                        {(grobidData || processingStatus?.details?.hasGrobidOutput) && (
                          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                            <div className="font-semibold text-[var(--color-text)] mb-2">GROBID抽出情報</div>
                            {grobidData ? (
                              <div className="space-y-1">
                                {grobidData.title && (
                                  <div>
                                    <span className="font-medium">タイトル:</span>{" "}
                                    <span className="text-[var(--color-text)]">{grobidData.title}</span>
                                  </div>
                                )}
                                {grobidData.authors && (
                                  <div>
                                    <span className="font-medium">著者:</span>{" "}
                                    <span className="text-[var(--color-text)]">
                                      {(() => {
                                        // 著者データの形式を判定
                                        if (Array.isArray(grobidData.authors)) {
                                          // 配列の場合
                                          const authors = grobidData.authors.filter(Boolean);
                                          if (authors.length === 0) return "なし";
                                          // 最初の5名まで表示、それ以上は「他X名」と表示
                                          if (authors.length <= 5) {
                                            return authors.join(", ");
                                          } else {
                                            return `${authors.slice(0, 5).join(", ")} 他${authors.length - 5}名`;
                                          }
                                        } else if (typeof grobidData.authors === "string") {
                                          // 文字列の場合（既に結合されている可能性）
                                          const authorsStr = grobidData.authors.trim();
                                          if (!authorsStr) return "なし";
                                          // カンマやセミコロンで分割を試みる
                                          const authors = authorsStr.split(/[,;]/).map(a => a.trim()).filter(Boolean);
                                          if (authors.length <= 5) {
                                            return authors.join(", ");
                                          } else {
                                            return `${authors.slice(0, 5).join(", ")} 他${authors.length - 5}名`;
                                          }
                                        }
                                        return "なし";
                                      })()}
                                    </span>
                                  </div>
                                )}
                                {grobidData.abstract && (
                                  <div>
                                    <span className="font-medium">Abstract:</span>{" "}
                                    <span className="text-[var(--color-text)] line-clamp-2">
                                      {grobidData.abstract.length > 200 
                                        ? grobidData.abstract.substring(0, 200) + "..."
                                        : grobidData.abstract}
                                    </span>
                                  </div>
                                )}
                                {grobidData.sections && grobidData.sections.length > 0 && (
                                  <div>
                                    <span className="font-medium">セクション:</span>{" "}
                                    <span className="text-[var(--color-text)]">
                                      {grobidData.sections.map((s: any) => s.heading || s.title || "無題").filter(Boolean).join(", ")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-[var(--color-text-secondary)]">
                                GROBID解析は完了しましたが、詳細データの読み込み中です...
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    ) : (
                      <div className="text-xs mt-1 text-[var(--color-text-secondary)]">
                        {grobidMessage}
                        {grobidError && (
                          <div className="mt-2 text-red-600 dark:text-red-400">
                            エラー詳細: {grobidError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
            </div>

            {/* AI解説セクション（GROBID未完了時は透過処理で無効化） */}
            <div className={`transition-opacity ${isGrobidCompleted ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              {!isGrobidCompleted && (
                <div className="mb-2 text-xs text-[var(--color-text-secondary)] italic">
                  ※ GROBID解析が完了するまで利用できません
                </div>
              )}
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
            </div>

            {/* GROBID要約生成セクション（GROBID未完了時は透過処理で無効化） */}
            <div className={`transition-opacity ${isGrobidCompleted ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              {!isGrobidCompleted && (
                <div className="mb-2 text-xs text-[var(--color-text-secondary)] italic">
                  ※ GROBID解析が完了するまで利用できません
                </div>
              )}
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  GROBID要約生成
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                GROBIDで抽出した構造化データを基に、選択した項目の要約をAIが自動生成します。
              </p>
              
              {/* 項目選択 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(SUMMARY_CATEGORIES).map(([key, category]) => (
                  <label
                    key={key}
                    className="flex items-start gap-2 p-2 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={summaryCategories.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSummaryCategories([...summaryCategories, key]);
                        } else {
                          setSummaryCategories(summaryCategories.filter(c => c !== key));
                        }
                      }}
                      disabled={summaryLoading}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-700">
                        {category.label}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {category.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              
              {/* 生成ボタン */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateSummaries}
                  disabled={summaryLoading || summaryCategories.length === 0}
                  className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {summaryLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      生成中...
                    </>
                  ) : (
                    `要約を生成 (${summaryCategories.length}項目)`
                  )}
                </button>
                {summaryCategories.length === 0 && (
                  <span className="text-xs text-slate-500">
                    項目を選択してください
                  </span>
                )}
              </div>
              
              {/* エラー表示 */}
              {summaryError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                  {summaryError}
                </div>
              )}
              
              {/* 生成結果表示 */}
              {Object.keys(generatedSummaries).length > 0 && (
                <div className="space-y-3 mt-4">
                  <h4 className="text-xs font-semibold text-slate-700">
                    生成された要約
                  </h4>
                  {Object.entries(generatedSummaries).map(([categoryKey, summary]) => {
                    const category = SUMMARY_CATEGORIES[categoryKey as SummaryCategoryKey];
                    if (!category) return null;
                    
                    return (
                      <div
                        key={categoryKey}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          {category.label}
                        </div>
                        <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {summary}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            </div>

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
              {chatSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {chatSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={chatStatus === "loading"}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
              {chatError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {chatError}
                </div>
              ) : null}
              <div className="space-y-3">
                <div className="max-h-72 space-y-3 overflow-y-auto">
                  {chatSessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-background)] px-4 py-5 text-xs text-[var(--color-text-secondary)]">
                      ここにチャット履歴が表示されます。AI解説またはGROBID解析を実行すると、論文チャット用のコンテキストが準備されます。
                    </div>
                  ) : (
                    chatSessions.map((session) => {
                      const references = session.response.references || [];
                      const referenceMap = new Map<
                        string,
                        { index: number; ref: InsightsChatReference }
                      >();
                      references.forEach((ref, index) => {
                        const key = ref.id ?? `ref-${index}`;
                        referenceMap.set(key, {
                          index: index + 1,
                          ref,
                        });
                      });

                      const renderParagraph = (
                        paragraph: InsightsChatParagraph,
                        index: number
                      ) => {
                        const linkedRefs = (paragraph.contextIds || [])
                          .map((ctxId) =>
                            ctxId ? referenceMap.get(ctxId) : undefined
                          )
                          .filter(
                            (
                              value
                            ): value is { index: number; ref: InsightsChatReference } =>
                              !!value &&
                              Boolean(
                                (value.ref as any)?.text ??
                                  value.ref.excerpt ??
                                  ""
                              )
                          )
                          .filter(
                            (value, idx, arr) =>
                              arr.findIndex((item) => item.index === value.index) ===
                              idx
                          );

                        return (
                          <p
                            key={`${session.id}-chat-${index}`}
                            className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]"
                          >
                            {paragraph.content}
                            {linkedRefs.length > 0 ? (
                              <sup className="ml-1 inline-flex gap-1 text-[10px] font-semibold text-[var(--color-primary)]">
                                {linkedRefs.map(({ index: refIndex, ref }) => (
                                  <button
                                    key={`${session.id}-ctx-${refIndex}`}
                                    type="button"
                                    onClick={() =>
                                      handleReferenceSelect(ref, refIndex)
                                    }
                                    className="underline-offset-2 hover:underline"
                                  >
                                    [{refIndex}]
                                  </button>
                                ))}
                              </sup>
                            ) : null}
                          </p>
                        );
                      };

                      return (
                        <article
                          key={session.id}
                          className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-text-secondary)]"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row">
                            <div className="flex-1 space-y-3">
                              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold">
                                    Q
                                  </span>
                                  <span>質問</span>
                                </div>
                                <p className="text-sm font-medium text-[var(--color-text)] whitespace-pre-wrap">
                                  {session.question}
                                </p>
                              </div>

                              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold">
                                    A
                                  </span>
                                  <span>回答</span>
                                </div>
                                <div className="space-y-2">
                                  {session.response.paragraphs.map(
                                    renderParagraph
                                  )}
                                </div>
                              </div>

                              {session.response.externalReferences &&
                              session.response.externalReferences.length > 0 ? (
                                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                                  <p className="text-xs font-semibold text-[var(--color-text)]">
                                    外部参照
                                  </p>
                                  <ul className="mt-2 space-y-2">
                                    {session.response.externalReferences.map(
                                      (item, index) => (
                                        <li
                                          key={`${session.id}-ext-${index}`}
                                          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[11px]"
                                        >
                                          <p className="font-semibold text-[var(--color-text)]">
                                            {item.title}
                                          </p>
                                          {item.authors ? (
                                            <p className="text-[var(--color-text-secondary)]">
                                              著者: {item.authors}
                                            </p>
                                          ) : null}
                                          {item.summary ? (
                                            <p className="text-[var(--color-text-secondary)]">
                                              概要: {item.summary}
                                            </p>
                                          ) : null}
                                          {item.url ? (
                                            <a
                                              href={item.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center text-[var(--color-primary)] underline"
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
                            </div>

                            {references.length > 0 ? (
                              <aside className="w-full space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-[11px] text-[var(--color-text-secondary)] lg:w-60">
                                <p className="text-xs font-semibold text-[var(--color-text)]">
                                  引用チャンク
                                </p>
                                {references.map((ref, index) => {
                                  const displayText =
                                    (ref as any)?.text ??
                                    ref.excerpt ??
                                    "";
                                  return (
                                    <button
                                      key={`${session.id}-ref-${ref.id ?? index}`}
                                      type="button"
                                      onClick={() =>
                                        handleReferenceSelect(ref, index + 1)
                                      }
                                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left transition hover:border-[var(--color-primary)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-bold">
                                          {index + 1}
                                        </span>
                                        <div className="flex-1">
                                          <p className="text-xs font-semibold text-[var(--color-text)]">
                                            {ref.sectionTitle ?? "チャンク"}
                                          </p>
                                          <p className="text-[10px] text-[var(--color-text-secondary)]">
                                            {ref.source?.toUpperCase() ?? "PDF"}
                                            {ref.pageNumber != null
                                              ? ` · p.${ref.pageNumber}`
                                              : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="mt-2 whitespace-pre-wrap text-[var(--color-text-secondary)] leading-relaxed">
                                        {displayText
                                          ? displayText.slice(0, 220)
                                          : "引用テキストが取得できませんでした。"}
                                      </p>
                                    </button>
                                  );
                                })}
                              </aside>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
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
          {figureCards.map((card, index) => {
            return (
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
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          図の詳細は取得できませんでした。PDF や HTML
          の本文が利用可能か確認してください。
        </p>
      )}

      {insights.ochiaiReview ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ReviewBlock title="Overview" body={insights.ochiaiReview.overview || ""} />
          <ReviewBlock
            title="Background"
            body={insights.ochiaiReview.background || ""}
          />
          <ReviewBlock title="Method" body={insights.ochiaiReview.method || ""} />
          <ReviewBlock title="Results" body={insights.ochiaiReview.results || ""} />
          <ReviewBlock
            title="Discussion"
            body={insights.ochiaiReview.discussion || ""}
          />
          <ReviewBlock
            title="Future Work"
            body={insights.ochiaiReview.futureWork || ""}
          />
        </div>
      ) : null}

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
  activeReference,
}: {
  pdfUrl?: string | null;
  htmlUrl?: string | null;
  fallbackUrl?: string;
  fullscreen: boolean;
  hasPreview: boolean;
  activeReference?: ReferenceHighlight | null;
}) {
  const frameHeight = fullscreen ? "h-[calc(100vh-220px)]" : "h-[calc(100vh-300px)]";

  const highlightRequest =
    pdfUrl && activeReference && activeReference.text
      ? {
          text: activeReference.text,
          pageNumber: activeReference.pageNumber ?? undefined,
        }
      : null;

  const renderFallback = () => (
    <div
      className={`flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/40 bg-white/10 px-4 py-6 text-sm text-white/70 ${frameHeight}`}
    >
      右ペインの「プレビューURL設定」から PDF または HTML の URL
      を登録すると、ここに本文が表示されます。
    </div>
  );

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

      {pdfUrl ? (
        <PdfViewer
          fileUrl={pdfUrl}
          fullscreen={fullscreen}
          highlightRequest={highlightRequest}
        />
      ) : htmlUrl ? (
        <iframe
          src={htmlUrl}
          className={`w-full flex-1 rounded-lg border border-white/30 bg-white ${frameHeight}`}
          title="paper-preview-html"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      ) : hasPreview ? (
        renderFallback()
      ) : (
        renderFallback()
      )}
    </section>
  );
}

function deriveChatSuggestions(
  paper: LibraryPaper | null,
  grobidData: any
): string[] {
  const suggestions = new Set<string>();

  if (grobidData?.sections?.length) {
    grobidData.sections.slice(0, 3).forEach((section: any) => {
      const title =
        typeof section?.title === "string" && section.title.trim().length
          ? section.title.trim()
          : null;
      if (title) {
        suggestions.add(`${title}の要点を教えて`);
        suggestions.add(`${title}の実験設計と結果は？`);
      }
    });
  }

  if (grobidData?.figures?.length) {
    const figureLabel =
      grobidData.figures[0]?.title ||
      grobidData.figures[0]?.caption ||
      "図";
    suggestions.add(`${figureLabel}から得られる知見は？`);
  }

  const baseTitle = paper?.title || "この論文";
  [
    `${baseTitle}の主要な貢献は？`,
    `${baseTitle}で提案されている手法の強みと限界は？`,
    "著者が挙げている今後の課題は？",
    "臨床・社会的な応用可能性は？",
  ].forEach((q) => suggestions.add(q));

  return Array.from(suggestions).slice(0, 6);
}
