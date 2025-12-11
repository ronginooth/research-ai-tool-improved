/**
 * Citation Field Code のレンダリング
 * 各ジャーナルのin-text citation形式に対応
 */

import { CitationFieldCode } from "./field-code";
import { CitationStyle } from "../citation-styles/types";
import { AuthorFormatter } from "../citation-engine/AuthorFormatter";
import { PaperData } from "../citation-engine/ReferenceRenderer";

export type InTextCitationFormat = "author-date" | "numeric" | "author-year";

/**
 * In-text citation形式の設定
 */
export interface InTextCitationConfig {
  format: InTextCitationFormat;
  numericStyle: "brackets" | "parentheses"; // [1] または (1)
  authorFormat: "full" | "et-al"; // 全員表示 または et al.使用
  maxAuthors: number; // et al.を使う前の最大著者数
}

/**
 * 著者名をin-text citation用にフォーマット
 */
function formatAuthorsForInText(
  authors: string | string[],
  style: CitationStyle["authorRules"],
  config: InTextCitationConfig
): string {
  const formatter = new AuthorFormatter();
  
  // in-text citation用のルールを作成
  const inTextRules = {
    maxAuthors: config.maxAuthors || style.maxAuthors,
    etAlAfter: config.maxAuthors || style.etAlAfter,
    delimiter: style.delimiter,
    finalDelimiter: style.finalDelimiter,
    format: style.format,
  };

  return formatter.format(authors, inTextRules);
}

/**
 * フィールドコードをレンダリング
 */
export function renderCitationField(
  fieldCode: CitationFieldCode,
  paper: PaperData,
  style: CitationStyle,
  citationNumber?: number,
  config?: Partial<InTextCitationConfig>
): string {
  const defaultConfig: InTextCitationConfig = {
    format: "author-date",
    numericStyle: "brackets",
    authorFormat: "et-al",
    maxAuthors: style.authorRules.maxAuthors,
  };

  const finalConfig = { ...defaultConfig, ...config };

  // Numeric形式の場合
  if (finalConfig.format === "numeric" && citationNumber !== undefined) {
    if (finalConfig.numericStyle === "brackets") {
      return `[${citationNumber}]`;
    } else {
      return `(${citationNumber})`;
    }
  }

  // Author-Date形式の場合
  if (finalConfig.format === "author-date") {
    const authors = formatAuthorsForInText(
      paper.authors,
      style.authorRules,
      finalConfig
    );
    return `(${authors}, ${paper.year})`;
  }

  // Author-Year形式の場合（年のみ）
  if (finalConfig.format === "author-year") {
    const authors = formatAuthorsForInText(
      paper.authors,
      style.authorRules,
      finalConfig
    );
    return `${authors} (${paper.year})`;
  }

  // デフォルト: 表示テキストが指定されている場合はそれを使用
  return fieldCode.displayText || `(${paper.authors}, ${paper.year})`;
}

/**
 * ジャーナルスタイルに基づいてin-text citation形式を決定
 */
export function getInTextFormatForStyle(
  styleId: string,
  citationOrder: "alphabetical" | "appearance"
): InTextCitationConfig {
  // 出現順の場合は番号形式、アルファベット順の場合は著者-年形式
  if (citationOrder === "appearance") {
    return {
      format: "numeric",
      numericStyle: "brackets", // [1] 形式
      authorFormat: "et-al",
      maxAuthors: 3,
    };
  }

  // アルファベット順の場合は著者-年形式
  // ジャーナルによって形式が異なる可能性があるが、デフォルトは (Author, Year)
  return {
    format: "author-date",
    numericStyle: "brackets",
    authorFormat: "et-al",
    maxAuthors: 3,
  };
}

/**
 * パラグラフ内容内のフィールドコードをレンダリング
 */
export function renderParagraphContent(
  content: string,
  fieldCodes: CitationFieldCode[],
  citations: Map<string, { paper: PaperData; citationId: string; paperId?: string }>,
  style: CitationStyle,
  citationNumberMap: Map<string, number>,
  config?: Partial<InTextCitationConfig>
): string {
  let result = content;

  // フィールドコードを後ろから前に処理（インデックスがずれないように）
  const sortedFieldCodes = [...fieldCodes].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  sortedFieldCodes.forEach((fieldCode) => {
    const citation = citations.get(fieldCode.citationId);
    if (citation) {
      // paperIdはcitationオブジェクトまたはfieldCodeから取得
      const paperId = citation.paperId || fieldCode.paperId;
      const number = citationNumberMap.get(paperId);
      const rendered = renderCitationField(
        fieldCode,
        citation.paper,
        style,
        number,
        config
      );

      // フィールドコードをレンダリング結果で置き換え
      result =
        result.substring(0, fieldCode.startIndex) +
        rendered +
        result.substring(fieldCode.endIndex);
    }
  });

  return result;
}

