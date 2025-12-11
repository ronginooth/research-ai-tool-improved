/**
 * 引用フォーマッター（後方互換性のためのラッパー）
 * 新しいCitation Engineを使用するようにリファクタリング
 */

import { CitationFormatConfig } from "./citation-formats";
import { CitationStyle } from "./citation-styles/types";
import { ReferenceRenderer, PaperData as EnginePaperData } from "./citation-engine/ReferenceRenderer";
import { CitationSorter, SortableCitation } from "./citation-engine/Sorter";
import { AuthorFormatter } from "./citation-engine/AuthorFormatter";

// 既存のPaperDataインターフェースをエクスポート（後方互換性）
export interface PaperData {
  title: string;
  authors: string | string[];
  year: number;
  venue: string;
  doi?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  articleNumber?: string | null;
}

// CitationFormatConfigをCitationStyleに変換
function convertFormatConfigToStyle(config: CitationFormatConfig): CitationStyle {
  return {
    id: config.id,
    name: config.name,
    displayName: config.displayName,
    isSystem: true,
    sort: {
      mode: "citation-order", // デフォルト
      key: "citation_order",
    },
    authorRules: {
      maxAuthors: config.authorConfig.maxAuthorsBeforeEtAl,
      etAlAfter: config.authorConfig.maxAuthorsBeforeEtAl,
      delimiter: config.authorConfig.authorSeparator,
      finalDelimiter: config.authorConfig.lastAuthorSeparator,
      format: config.authorConfig.authorFormat,
    },
    title: {
      include: config.titleConfig.includeTitle,
      case: config.titleConfig.titleCase,
      endPunctuation: config.titleConfig.titleEndPunctuation,
    },
    journal: {
      useItalic: config.journalConfig.useItalic,
      useVenue: true, // 常にvenueを使用
      fallbackAbbreviation: config.journalConfig.abbreviation,
    },
    volume: {
      useBold: config.volumeConfig.useBold,
      includeIssue: config.volumeConfig.includeIssue,
      format: config.volumeConfig.pageFormat,
      pageSeparator: config.volumeConfig.pageSeparator,
    },
    doi: {
      include: config.doiConfig.includeDoi,
      prefix: config.doiConfig.doiPrefix,
    },
    year: {
      format: config.yearConfig.format,
    },
    template: "{authors}. {title}. {journal} {volume}, {pages} ({year}). {doi}",
  };
}

/**
 * 引用をフォーマット（後方互換性のためのラッパー）
 */
export function formatCitation(
  paper: PaperData,
  format: CitationFormatConfig,
  citationNumber?: number
): string {
  const style = convertFormatConfigToStyle(format);
  const renderer = new ReferenceRenderer();
  
  const enginePaper: EnginePaperData = {
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    venue: paper.venue,
    doi: paper.doi,
    volume: paper.volume,
    issue: paper.issue,
    pages: paper.pages,
    articleNumber: paper.articleNumber,
  };

  return renderer.render(enginePaper, style, "markdown", citationNumber);
}

/**
 * 引用リストをソート（ABC順）
 */
export function sortCitationsAlphabetically<T extends { paper: PaperData }>(
  citations: T[]
): T[] {
  const sorter = new CitationSorter();
  const style: CitationStyle = {
    id: "alphabetical",
    name: "Alphabetical",
    displayName: "Alphabetical",
    sort: {
      mode: "alphabetical",
      key: "firstAuthor.lastName",
    },
    authorRules: {
      maxAuthors: 6,
      etAlAfter: 6,
      delimiter: ", ",
      finalDelimiter: ", ",
      format: "LastName FirstInitial",
    },
    title: {
      include: true,
      case: "sentence",
      endPunctuation: ".",
    },
    journal: {
      useItalic: true,
      useVenue: true,
      fallbackAbbreviation: "",
    },
    volume: {
      useBold: false,
      includeIssue: false,
      format: "range",
      pageSeparator: "–",
    },
    doi: {
      include: true,
      prefix: "doi:",
    },
    year: {
      format: "parentheses",
    },
    template: "{authors}. {title}. {journal} {volume}, {pages} ({year}). {doi}",
  };

  const sortableCitations: SortableCitation[] = citations.map((c) => ({
    paper: {
      title: c.paper.title,
      authors: c.paper.authors,
      year: c.paper.year,
      venue: c.paper.venue,
      volume: c.paper.volume,
    },
    citation_order: 0,
  }));

  const sorted = sorter.sort(sortableCitations, style.sort);
  
  // 元の型に戻す
  return sorted.map((sortedItem, index) => {
    const original = citations.find(
      (c) =>
        c.paper.title === sortedItem.paper.title &&
        c.paper.authors === sortedItem.paper.authors
    );
    return original || citations[index];
  }) as T[];
}

/**
 * 引用リストをソート（出現順）
 */
export function sortCitationsByAppearance<T extends {
  paper: PaperData;
  paragraph?: { paragraph_number: string };
  citation_order: number;
}>(
  citations: T[]
): T[] {
  const sorter = new CitationSorter();
  const style: CitationStyle = {
    id: "citation-order",
    name: "Citation Order",
    displayName: "Citation Order",
    sort: {
      mode: "citation-order",
      key: "citation_order",
    },
    authorRules: {
      maxAuthors: 6,
      etAlAfter: 6,
      delimiter: ", ",
      finalDelimiter: ", ",
      format: "LastName FirstInitial",
    },
    title: {
      include: true,
      case: "sentence",
      endPunctuation: ".",
    },
    journal: {
      useItalic: true,
      useVenue: true,
      fallbackAbbreviation: "",
    },
    volume: {
      useBold: false,
      includeIssue: false,
      format: "range",
      pageSeparator: "–",
    },
    doi: {
      include: true,
      prefix: "doi:",
    },
    year: {
      format: "parentheses",
    },
    template: "{authors}. {title}. {journal} {volume}, {pages} ({year}). {doi}",
  };

  // 元の引用オブジェクトを保持するための配列を作成
  // ソート用のデータと元のデータをペアで保持
  const citationPairs = citations.map((c) => ({
    original: c,
    sortable: {
      paper: {
        title: c.paper.title,
        authors: c.paper.authors,
        year: c.paper.year,
        venue: c.paper.venue,
        volume: c.paper.volume,
      },
      paragraph: c.paragraph,
      citation_order: c.citation_order,
    } as SortableCitation,
  }));

  // ソート用のデータのみを抽出
  const sortableCitations: SortableCitation[] = citationPairs.map((pair) => pair.sortable);

  // ソート実行
  const sorted = sorter.sort(sortableCitations, style.sort);
  
  // ソート後の結果を元の引用オブジェクトにマッピング
  return sorted.map((sortedItem) => {
    // ソート後のアイテムと一致する元の引用を検索
    const matched = citationPairs.find((pair) => {
      const s = pair.sortable;
      return (
        s.paper.title === sortedItem.paper.title &&
        s.paper.authors === sortedItem.paper.authors &&
        s.paper.year === sortedItem.paper.year &&
        s.paragraph?.paragraph_number === sortedItem.paragraph?.paragraph_number &&
        (s.citation_order || 0) === (sortedItem.citation_order || 0)
      );
    });
    
    // 元の引用オブジェクトを返す（paper.idを含む）
    return matched?.original || sortedItem as T;
  });
}
