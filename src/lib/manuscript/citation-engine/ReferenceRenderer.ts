/**
 * 引用レンダラー
 * テンプレートエンジンとして機能し、Markdown/HTML/LaTeX出力に対応
 */

import { CitationStyle } from "../citation-styles/types";
import { AuthorFormatter } from "./AuthorFormatter";

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

export type OutputFormat = "markdown" | "html" | "latex";

export class ReferenceRenderer {
  private authorFormatter: AuthorFormatter;

  constructor() {
    this.authorFormatter = new AuthorFormatter();
  }

  /**
   * 引用をレンダリング
   */
  render(
    paper: PaperData,
    style: CitationStyle,
    outputFormat: OutputFormat = "markdown",
    citationNumber?: number
  ): string {
    // 各要素をフォーマット
    const authors = this.formatAuthors(paper.authors, style.authorRules);
    const title = this.formatTitle(paper.title, style.title);
    const journal = this.formatJournal(paper.venue, style.journal, outputFormat);
    const volumePages = this.formatVolumePages(paper, style.volume, outputFormat);
    const doi = this.formatDoi(paper.doi, style.doi);
    const year = this.formatYear(paper.year, style.year);

    // volumeとpagesを結合
    const volumePagesStr = [volumePages.volume, volumePages.pages]
      .filter(Boolean)
      .join(", ");

    // テンプレートを使用して組み立て
    let result = style.template
      .replace("{authors}", authors)
      .replace("{title}", title)
      .replace("{journal}", journal)
      .replace("{volume}", volumePages.volume || "")
      .replace("{pages}", volumePages.pages || "")
      .replace("{volume}, {pages}", volumePagesStr)
      .replace("{year}", year)
      .replace("{doi}", doi);

    // 出現順の場合は番号を追加
    if (citationNumber !== undefined) {
      result = `${citationNumber}. ${result}`;
    }

    // 余分なスペースを削除
    result = result.replace(/\s+/g, " ").trim();

    return result;
  }

  /**
   * 著者名をフォーマット
   */
  private formatAuthors(
    authors: string | string[],
    rules: CitationStyle["authorRules"]
  ): string {
    return this.authorFormatter.format(authors, rules);
  }

  /**
   * タイトルをフォーマット
   */
  private formatTitle(
    title: string,
    config: CitationStyle["title"]
  ): string {
    if (!config.include || !title) {
      return "";
    }

    let formatted = title.trim();

    // タイトルケースの処理
    if (config.case === "sentence") {
      // 最初の文字のみ大文字、残りは小文字（ただし既存の大文字は保持）
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    // 末尾の句読点を追加（既に存在する場合は追加しない）
    if (
      config.endPunctuation &&
      !formatted.endsWith(config.endPunctuation)
    ) {
      formatted += config.endPunctuation;
    }

    return formatted;
  }

  /**
   * ジャーナル名をフォーマット
   * venueフィールドを正しく反映
   */
  private formatJournal(
    venue: string,
    config: CitationStyle["journal"],
    outputFormat: OutputFormat = "markdown"
  ): string {
    // venueが存在し、useVenueがtrueの場合はそれを使用
    // そうでない場合はfallbackAbbreviationを使用
    let journalName = "";
    if (config.useVenue && venue && venue.trim()) {
      journalName = venue.trim();
    } else if (config.fallbackAbbreviation) {
      journalName = config.fallbackAbbreviation;
    } else {
      journalName = venue || "";
    }

    if (!journalName) {
      return "";
    }

    // 出力形式に応じてマークアップ
    if (config.useItalic) {
      switch (outputFormat) {
        case "markdown":
          return `*${journalName}*`;
        case "html":
          return `<em>${journalName}</em>`;
        case "latex":
          return `\\textit{${journalName}}`;
      }
    }

    return journalName;
  }

  /**
   * 巻・ページ番号をフォーマット
   */
  private formatVolumePages(
    paper: PaperData,
    config: CitationStyle["volume"],
    outputFormat: OutputFormat = "markdown"
  ): { volume: string; pages: string } {
    const parts: string[] = [];

    // 巻数
    let volumeStr = "";
    if (paper.volume) {
      if (config.useBold) {
        switch (outputFormat) {
          case "markdown":
            volumeStr = `**${paper.volume}**`;
            break;
          case "html":
            volumeStr = `<strong>${paper.volume}</strong>`;
            break;
          case "latex":
            volumeStr = `\\textbf{${paper.volume}}`;
            break;
        }
      } else {
        volumeStr = paper.volume;
      }
    }

    // 号数
    if (config.includeIssue && paper.issue) {
      parts.push(`(${paper.issue})`);
    }

    // ページ番号または記事番号
    let pagesStr = "";
    if (config.format === "article-number") {
      // eLife形式: 記事番号（例: e12345）
      if (paper.articleNumber) {
        pagesStr = paper.articleNumber;
      } else if (paper.pages) {
        pagesStr = paper.pages;
      }
    } else if (config.format === "range" && paper.pages) {
      // ページ範囲
      pagesStr = paper.pages;
    } else if (config.format === "start-only" && paper.pages) {
      // 開始ページのみ
      const startPage = paper.pages.split(/[-–]/)[0];
      pagesStr = startPage;
    }

    return {
      volume: volumeStr,
      pages: pagesStr,
    };
  }

  /**
   * DOIをフォーマット
   */
  private formatDoi(
    doi: string | null | undefined,
    config: CitationStyle["doi"]
  ): string {
    if (!config.include || !doi) {
      return "";
    }

    // DOIが既にプレフィックスを含んでいる場合はそのまま使用
    if (doi.startsWith("doi:") || doi.startsWith("https://doi.org/")) {
      return doi;
    }

    return `${config.prefix}${doi}`;
  }

  /**
   * 年をフォーマット
   */
  private formatYear(
    year: number,
    config: CitationStyle["year"]
  ): string {
    if (config.format === "parentheses") {
      return `(${year})`;
    }
    return `, ${year}`;
  }
}

