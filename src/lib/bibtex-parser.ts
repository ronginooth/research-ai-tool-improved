/**
 * BibTeX形式のパーサーとエクスポーター
 */

import { Paper } from "@/types";

export interface BibTeXEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
}

/**
 * BibTeX形式の文字列をパースしてエントリの配列に変換
 */
export function parseBibTeX(bibtexContent: string): BibTeXEntry[] {
  const entries: BibTeXEntry[] = [];
  
  // BibTeXエントリを抽出する正規表現
  const entryRegex = /@(\w+)\s*\{([^,]+),\s*([^@]*)\}/gs;
  let match;
  
  while ((match = entryRegex.exec(bibtexContent)) !== null) {
    const [, type, key, fieldsText] = match;
    const fields: Record<string, string> = {};
    
    // フィールドを抽出
    const fieldRegex = /(\w+)\s*=\s*\{([^}]*)\}/g;
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(fieldsText)) !== null) {
      const [, fieldName, fieldValue] = fieldMatch;
      fields[fieldName.toLowerCase()] = fieldValue.trim();
    }
    
    entries.push({
      type: type.toLowerCase(),
      key: key.trim(),
      fields,
    });
  }
  
  return entries;
}

/**
 * BibTeXエントリをPaper形式に変換
 */
export function convertBibTeXToPaper(entry: BibTeXEntry): Partial<Paper> {
  const paper: Partial<Paper> = {
    title: entry.fields.title || "",
    authors: entry.fields.author || "",
    year: parseInt(entry.fields.year || "0", 10) || 0,
    venue: entry.fields.journal || entry.fields.booktitle || "",
    doi: entry.fields.doi || "",
    url: entry.fields.url || "",
    abstract: entry.fields.abstract || "",
  };
  
  // paperIdを生成（keyまたはDOIから）
  if (entry.key) {
    (paper as any).paperId = entry.key;
  } else if (entry.fields.doi) {
    (paper as any).paperId = `doi:${entry.fields.doi}`;
  }
  
  return paper;
}

/**
 * BibTeX形式の文字列をパースしてPaper配列に変換
 */
export function parseBibTeXToPapers(bibtexContent: string): Partial<Paper>[] {
  const entries = parseBibTeX(bibtexContent);
  return entries.map(convertBibTeXToPaper);
}

/**
 * BibTeXキーを生成（著者名と年から）
 */
export function generateBibTeXKey(paper: Paper): string {
  const authors = paper.authors?.split(",")[0]?.trim() || "unknown";
  const lastName = authors.split(" ")[0] || authors;
  const year = paper.year || new Date().getFullYear();
  const titleWords = paper.title?.split(" ").slice(0, 2) || [];
  const titleKey = titleWords.map((w) => w.substring(0, 4)).join("");
  
  return `${lastName.toLowerCase()}${year}${titleKey.toLowerCase()}`.replace(/[^a-z0-9]/g, "");
}

/**
 * PaperをBibTeX形式の文字列に変換
 */
export function convertPaperToBibTeX(paper: Paper): string {
  const key = generateBibTeXKey(paper);
  const title = paper.title || "";
  const authors = paper.authors || "";
  const journal = paper.venue || "";
  const year = paper.year?.toString() || "";
  const doi = paper.doi || "";
  const url = paper.url || "";
  const abstract = paper.abstract || "";
  
  let bibtex = `@article{${key},\n`;
  bibtex += `  title={${title}},\n`;
  bibtex += `  author={${authors}},\n`;
  
  if (journal) {
    bibtex += `  journal={${journal}},\n`;
  }
  
  if (year) {
    bibtex += `  year={${year}},\n`;
  }
  
  if (doi) {
    bibtex += `  doi={${doi}},\n`;
  }
  
  if (url) {
    bibtex += `  url={${url}},\n`;
  }
  
  if (abstract) {
    // BibTeXではabstractに改行が含まれる可能性があるため、簡略化
    const shortAbstract = abstract.substring(0, 200).replace(/\n/g, " ");
    bibtex += `  abstract={${shortAbstract}},\n`;
  }
  
  bibtex += `}`;
  
  return bibtex;
}

/**
 * Paper配列をBibTeX形式の文字列に変換
 */
export function convertPapersToBibTeX(papers: Paper[]): string {
  return papers.map(convertPaperToBibTeX).join("\n\n");
}


