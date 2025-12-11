/**
 * 引用ソーター
 * 複数のソートモードに対応
 */

import { CitationStyle } from "../citation-styles/types";
import { AuthorFormatter } from "./AuthorFormatter";

export interface SortableCitation {
  paper: {
    title: string;
    authors: string | string[];
    year: number;
    venue: string;
    volume?: string | null;
  };
  paragraph?: {
    paragraph_number: string;
  };
  citation_order: number;
}

export class CitationSorter {
  private authorFormatter: AuthorFormatter;

  constructor() {
    this.authorFormatter = new AuthorFormatter();
  }

  /**
   * 引用をソート
   */
  sort<T extends SortableCitation>(
    citations: T[],
    config: CitationStyle["sort"]
  ): T[] {
    switch (config.mode) {
      case "citation-order":
        return this.sortByCitationOrder(citations);
      case "alphabetical":
        return this.sortAlphabetically(citations);
      case "year-then-author":
        return this.sortByYearThenAuthor(citations);
      case "volume-year":
        return this.sortByVolumeYear(citations);
      default:
        return this.sortByCitationOrder(citations);
    }
  }

  /**
   * 出現順でソート
   */
  private sortByCitationOrder<T extends SortableCitation>(citations: T[]): T[] {
    return [...citations].sort((a, b) => {
      // パラグラフ番号でソート
      if (a.paragraph && b.paragraph) {
        const paraNumA =
          parseInt(a.paragraph.paragraph_number.replace("P", "")) || 0;
        const paraNumB =
          parseInt(b.paragraph.paragraph_number.replace("P", "")) || 0;
        if (paraNumA !== paraNumB) {
          return paraNumA - paraNumB;
        }
      } else if (a.paragraph && !b.paragraph) {
        // aにはparagraphがあるが、bにはない場合はaを前に
        return -1;
      } else if (!a.paragraph && b.paragraph) {
        // aにはparagraphがないが、bにはある場合はbを前に
        return 1;
      }
      // 同じパラグラフ内ではcitation_orderでソート
      const orderA = a.citation_order ?? 0;
      const orderB = b.citation_order ?? 0;
      return orderA - orderB;
    });
  }

  /**
   * アルファベット順でソート（firstAuthor.lastName）
   */
  private sortAlphabetically<T extends SortableCitation>(citations: T[]): T[] {
    return [...citations].sort((a, b) => {
      const authorA = this.authorFormatter.extractLastName(
        Array.isArray(a.paper.authors)
          ? a.paper.authors[0]
          : a.paper.authors
      );
      const authorB = this.authorFormatter.extractLastName(
        Array.isArray(b.paper.authors)
          ? b.paper.authors[0]
          : b.paper.authors
      );
      return authorA.localeCompare(authorB, "en", { sensitivity: "base" });
    });
  }

  /**
   * 年→著者名でソート
   */
  private sortByYearThenAuthor<T extends SortableCitation>(
    citations: T[]
  ): T[] {
    return [...citations].sort((a, b) => {
      // まず年でソート
      const yearA = a.paper.year || 0;
      const yearB = b.paper.year || 0;
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      // 年が同じ場合は著者名でソート
      const authorA = this.authorFormatter.extractLastName(
        Array.isArray(a.paper.authors)
          ? a.paper.authors[0]
          : a.paper.authors
      );
      const authorB = this.authorFormatter.extractLastName(
        Array.isArray(b.paper.authors)
          ? b.paper.authors[0]
          : b.paper.authors
      );
      return authorA.localeCompare(authorB, "en", { sensitivity: "base" });
    });
  }

  /**
   * 巻→年でソート
   */
  private sortByVolumeYear<T extends SortableCitation>(citations: T[]): T[] {
    return [...citations].sort((a, b) => {
      // まず巻でソート
      const volumeA = parseInt(a.paper.volume || "0") || 0;
      const volumeB = parseInt(b.paper.volume || "0") || 0;
      if (volumeA !== volumeB) {
        return volumeA - volumeB;
      }
      // 巻が同じ場合は年でソート
      const yearA = a.paper.year || 0;
      const yearB = b.paper.year || 0;
      return yearA - yearB;
    });
  }
}

