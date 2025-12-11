"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Star, Trash2, Network } from "lucide-react";

interface PaperCardMenuProps {
  paperId: string;
  isFavorite: boolean;
  onToggleFavorite: (paperId: string, currentFavorite: boolean) => void;
  onDelete: (paperId: string) => void;
  position?: "top-right" | "left";
  paper?: {
    doi?: string | null;
    htmlUrl?: string | null;
    html_url?: string | null;
    url?: string | null;
    title?: string | null;
    authors?: string | null;
    year?: number | null;
  };
}

export default function PaperCardMenu({
  paperId,
  isFavorite,
  onToggleFavorite,
  onDelete,
  position = "top-right",
  paper,
}: PaperCardMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleCitationMap = () => {
    if (!paper) return;
    
    const doi = paper.doi;
    const htmlUrl = paper.htmlUrl || paper.html_url;
    const url = paper.url;
    const title = paper.title;
    const authors = paper.authors;
    const year = paper.year;
    
    // URLからpaperIdを抽出（Semantic Scholar URLの場合）
    let paperId: string | null = null;
    if (url) {
      console.log(`[PaperCardMenu] Extracting paperId from URL: ${url}`);
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
          console.log(`[PaperCardMenu] Extracted paperId: ${paperId} (length: ${paperId.length})`);
        } else {
          console.warn(`[PaperCardMenu] Invalid paperId extracted: ${paperId} (length: ${paperId.length})`);
          paperId = null;
        }
      } else {
        console.warn(`[PaperCardMenu] Could not extract paperId from URL: ${url}`);
      }
    }
    
    if (paperId) {
      // paperIdから直接Citation Mapを生成
      console.log(`[PaperCardMenu] Navigating to Citation Map with paperId: ${paperId}`);
      router.push(`/tools/citation-map?paperId=${encodeURIComponent(paperId)}`);
    } else if (doi) {
      console.log(`[PaperCardMenu] Navigating to Citation Map with DOI: ${doi}`);
      router.push(`/tools/citation-map?doi=${encodeURIComponent(doi)}`);
    } else if (htmlUrl) {
      console.log(`[PaperCardMenu] Navigating to Citation Map with HTML URL: ${htmlUrl}`);
      router.push(`/tools/citation-map?html=${encodeURIComponent(htmlUrl)}`);
    } else if (title) {
      // タイトルと著者名から検索
      const searchQuery = [title, authors, year].filter(Boolean).join(" ");
      console.log(`[PaperCardMenu] Navigating to Citation Map with search query: ${searchQuery}`);
      router.push(`/tools/citation-map?search=${encodeURIComponent(searchQuery)}`);
    } else {
      alert("DOI、HTML URL、またはタイトルがありません。Citation Mapを表示できません。");
    }
    setShowMenu(false);
  };

  // メニューの外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMenu]);

  const positionClasses =
    position === "top-right"
      ? "right-2 top-2"
      : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

  return (
    <div className={`absolute ${positionClasses} z-10`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 hover:bg-[var(--color-background)]"
      >
        {position === "top-right" ? (
          <MoreVertical className="h-4 w-4 text-[var(--color-text-secondary)]" />
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="h-1 w-1 rounded-full bg-[var(--color-text-secondary)]" />
            <div className="h-1 w-1 rounded-full bg-[var(--color-text-secondary)]" />
            <div className="h-1 w-1 rounded-full bg-[var(--color-text-secondary)]" />
          </div>
        )}
      </button>
      {showMenu && (
        <div
          ref={menuRef}
          className={`absolute ${
            position === "top-right" ? "right-0 mt-1" : "left-8 mt-0"
          } w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg z-20`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(paperId, isFavorite);
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-background)] flex items-center gap-2"
          >
            <Star
              className={`h-4 w-4 ${
                isFavorite ? "fill-yellow-400 text-yellow-400" : ""
              }`}
            />
            {isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCitationMap();
            }}
            className="w-full px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-background)] flex items-center gap-2"
          >
            <Network className="h-4 w-4" />
            Citation Map
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(paperId);
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-[var(--color-background)] flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            削除
          </button>
        </div>
      )}
    </div>
  );
}

