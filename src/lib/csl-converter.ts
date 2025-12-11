/**
 * CSL-JSON形式のコンバーター
 * Citation Style Language (CSL) JSON形式はZoteroとMendeleyの標準形式
 */

import { Paper } from "@/types";

export interface CSLItem {
  id: string;
  type: string;
  title: string;
  author: Array<{ family: string; given: string }>;
  issued: { "date-parts": number[][] }; // [[年, 月, 日]] または [[年, 月]] または [[年]]
  "container-title"?: string;
  DOI?: string;
  URL?: string;
  abstract?: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  "publisher-place"?: string;
}

/**
 * CSL-JSONアイテムをPaper形式に変換
 * Supabaseでは "given family" 形式で保存されるため、この形式に統一
 */
export function convertCSLToPaper(cslItem: CSLItem): Partial<Paper> {
  const authors = cslItem.author
    ?.map((a) => {
      // given（名）とfamily（姓）を結合
      // Supabaseでは "given family" 形式で保存される（例: "Maki Takagishi"）
      const parts = [a.given, a.family].filter(Boolean);
      return parts.join(" ");
    })
    .join(", ") || "";
  
  const dateParts = cslItem.issued?.["date-parts"]?.[0] || [];
  const year = dateParts[0] || 0;
  const month = dateParts[1] || null;
  const day = dateParts[2] || null;
  
  const paper: Partial<Paper> = {
    id: cslItem.id,
    title: cslItem.title || "",
    authors: authors,
    year: year,
    month: month,
    day: day,
    venue: cslItem["container-title"] || "",
    volume: cslItem.volume || undefined,
    issue: cslItem.issue || undefined,
    pages: cslItem.page || undefined,
    doi: cslItem.DOI || "",
    url: cslItem.URL || "",
    abstract: cslItem.abstract || "",
  };
  
  // paperIdを設定
  if (cslItem.id) {
    (paper as any).paperId = cslItem.id;
  } else if (cslItem.DOI) {
    (paper as any).paperId = `doi:${cslItem.DOI}`;
  }
  
  return paper;
}

/**
 * PaperをCSL-JSON形式に変換
 * Supabaseでは "given family" 形式で保存されているため、この形式をパース
 */
export function convertPaperToCSL(paper: Paper): CSLItem {
  // 著者名をパース
  // Supabaseでは "given family" 形式（例: "Maki Takagishi"）で保存されている
  const authors = paper.authors
    ?.split(",")
    .map((authorStr) => {
      const trimmed = authorStr.trim();
      
      // スペース区切りの場合（Supabaseの標準形式）
      // 最後の単語を姓（family）、それ以外を名（given）とする
      const parts = trimmed.split(" ").filter(Boolean);
      if (parts.length >= 2) {
        // "Maki Takagishi" → family: "Takagishi", given: "Maki"
        return {
          family: parts[parts.length - 1] || "",
          given: parts.slice(0, -1).join(" ") || "",
        };
      } else if (parts.length === 1) {
        // 単一の単語の場合、姓として扱う
        return {
          family: parts[0] || "",
          given: "",
        };
      } else {
        return {
          family: "",
          given: "",
        };
      }
    }) || [];
  
  // date-partsを構築（年、月、日が利用可能な場合のみ含める）
  const dateParts: number[] = [];
  if (paper.year) {
    dateParts.push(paper.year);
    if (paper.month) {
      dateParts.push(paper.month);
      if (paper.day) {
        dateParts.push(paper.day);
      }
    }
  } else {
    // 年がない場合は現在の年を使用
    dateParts.push(new Date().getFullYear());
  }
  
  const cslItem: CSLItem = {
    id: paper.id || paper.paperId || `paper-${Date.now()}`,
    type: "article-journal",
    title: paper.title || "",
    author: authors,
    issued: {
      "date-parts": [dateParts],
    },
  };
  
  if (paper.venue) {
    cslItem["container-title"] = paper.venue;
  }
  
  if (paper.volume) {
    cslItem.volume = paper.volume;
  }
  
  if (paper.issue) {
    cslItem.issue = paper.issue;
  }
  
  if (paper.pages) {
    cslItem.page = paper.pages;
  }
  
  if (paper.doi) {
    cslItem.DOI = paper.doi;
  }
  
  if (paper.url) {
    cslItem.URL = paper.url;
  }
  
  if (paper.abstract) {
    cslItem.abstract = paper.abstract;
  }
  
  return cslItem;
}

/**
 * CSL-JSON配列をPaper配列に変換
 */
export function convertCSLArrayToPapers(cslItems: CSLItem[]): Partial<Paper>[] {
  return cslItems.map(convertCSLToPaper);
}

/**
 * Paper配列をCSL-JSON配列に変換
 */
export function convertPapersToCSLArray(papers: Paper[]): CSLItem[] {
  return papers.map(convertPaperToCSL);
}

