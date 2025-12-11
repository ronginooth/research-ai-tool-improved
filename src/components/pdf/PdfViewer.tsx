"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export type HighlightRequest = {
  text: string;
  pageNumber?: number | null;
} | null;

export interface PdfViewerProps {
  fileUrl: string;
  highlightRequest?: HighlightRequest;
  fullscreen?: boolean;
}

export function PdfViewer({ 
  fileUrl, 
  fullscreen = false,
  highlightRequest 
}: PdfViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [resizeKey, setResizeKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // ResizeObserverでコンテナのサイズ変更を監視
    const resizeObserver = new ResizeObserver(() => {
      setResizeKey((prev) => prev + 1);
    });

    resizeObserver.observe(containerRef.current);

    // ウィンドウリサイズも監視
    const handleResize = () => {
      setResizeKey((prev) => prev + 1);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ハイライトリクエストが変更された時に検索バーを開く
  useEffect(() => {
    if (!highlightRequest?.text) return;

    const searchText = highlightRequest.text.trim();
    if (searchText) {
      setSearchQuery(searchText);
      setSearchVisible(true);
    }
  }, [highlightRequest]);

  // キーボードショートカット（Ctrl+FまたはCmd+Fで検索バーを開く）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F または Cmd+F で検索バーを開く
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && fileUrl) {
        e.preventDefault();
        setSearchVisible(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
      // Esc で検索バーを閉じる
      if (e.key === "Escape" && searchVisible) {
        setSearchVisible(false);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileUrl, searchVisible]);

  // 検索実行（クリップボードにコピーしてiframeにフォーカス）
  const handleSearch = async () => {
    if (!iframeRef.current || !searchQuery.trim()) return;

    const searchText = searchQuery.trim();

    try {
      // クリップボードに検索テキストをコピー
      await navigator.clipboard.writeText(searchText);
      
      // iframeにフォーカスを当てる
      iframeRef.current.focus();
      
      // ユーザーにCtrl+Fを押してもらうよう案内
      alert(`検索語 "${searchText}" をクリップボードにコピーしました。\n\nPDFビューアー内で Ctrl+F (Mac: Cmd+F) を押し、Ctrl+V (Mac: Cmd+V) で貼り付けて検索してください。`);
    } catch (err) {
      console.log("Clipboard copy failed:", err);
      // フォールバック: iframeにフォーカスを当てるだけ
      iframeRef.current.focus();
      alert(`PDFビューアー内で Ctrl+F (Mac: Cmd+F) を押して "${searchText}" を検索してください。`);
    }
  };

  if (!fileUrl) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4">
        <div className="text-sm text-[var(--color-text-secondary)]">
          PDFなし
        </div>
      </div>
    );
  }

  const frameHeight = fullscreen ? "h-[calc(100vh-220px)]" : "h-[calc(100vh-300px)]";

  // リサイズ時にiframeのsrcを更新（zoom=page-widthを維持）
  const iframeSrc = `${fileUrl}#toolbar=1&navpanes=0&scrollbar=1&zoom=page-width${resizeKey > 0 ? `&t=${Date.now()}` : ''}`;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* 検索バー */}
      {searchVisible && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    handleSearch();
                  }
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSearchVisible(false);
                  setSearchQuery("");
                }
              }}
              placeholder="検索語を入力してEnterキーを押すと、クリップボードにコピーされます"
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              className="rounded px-3 py-1 text-xs font-medium text-[var(--color-text)] bg-[var(--color-primary)] hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              title="検索実行（PDFビューアーにフォーカスが移ります）"
            >
              検索
            </button>
            <button
              onClick={() => {
                setSearchVisible(false);
                setSearchQuery("");
              }}
              className="rounded p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] transition-colors"
              title="閉じる (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)] px-1">
            💡 検索語を入力後、Enterキーまたは検索ボタンをクリックしてください。検索語がクリップボードにコピーされ、PDFビューアー内で Ctrl+F (Mac: Cmd+F) → Ctrl+V (Mac: Cmd+V) で検索できます。
          </div>
        </div>
      )}

      {/* 検索バーが非表示の時は検索ボタンを表示 */}
      {!searchVisible && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => {
              setSearchVisible(true);
              setTimeout(() => {
                searchInputRef.current?.focus();
              }, 100);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-background)] transition-colors"
            title="検索を開く (Ctrl+F または Cmd+F)"
          >
            <Search className="h-3.5 w-3.5" />
            検索
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full flex-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] ${frameHeight}`}
      >
        {/* ブラウザの組み込みPDF.jsを使う */}
        <iframe
          ref={iframeRef}
          key={resizeKey}
          src={iframeSrc}
          className="h-full w-full"
          title="PDF Viewer"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          PDFを新しいタブで開く
        </a>
      </div>
    </div>
  );
}
