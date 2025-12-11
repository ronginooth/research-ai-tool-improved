/**
 * 著者名フォーマッター
 * 著者名のパース、フォーマット、et al.処理を担当
 */

import { CitationStyle } from "../citation-styles/types";

export class AuthorFormatter {
  /**
   * 著者名をフォーマット
   */
  format(authors: string | string[], rules: CitationStyle["authorRules"]): string {
    const authorList = this.parseAuthors(authors);

    if (authorList.length === 0) {
      return "Unknown Author";
    }

    // et al.を使用するかどうかを決定
    const useEtAl = rules.etAlAfter > 0 && authorList.length > rules.etAlAfter;
    const authorsToShow = useEtAl
      ? authorList.slice(0, rules.etAlAfter)
      : authorList;

    // 各著者名をフォーマット
    const formattedAuthors = authorsToShow.map((author) =>
      this.formatAuthorName(author, rules.format)
    );

    // 著者名を結合
    let result = "";
    if (formattedAuthors.length === 1) {
      result = formattedAuthors[0];
    } else if (formattedAuthors.length === 2) {
      result = `${formattedAuthors[0]}${rules.finalDelimiter}${formattedAuthors[1]}`;
    } else {
      // 3名以上の場合
      const allButLast = formattedAuthors.slice(0, -1).join(rules.delimiter);
      const last = formattedAuthors[formattedAuthors.length - 1];
      result = `${allButLast}${rules.finalDelimiter}${last}`;
    }

    // et al.を追加
    if (useEtAl) {
      result += " et al.";
    }

    return result;
  }

  /**
   * 著者名を配列に変換
   */
  private parseAuthors(authors: string | string[]): string[] {
    if (Array.isArray(authors)) {
      return authors;
    }
    // 文字列の場合、カンマまたは&で分割
    return authors
      .split(/[,&]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  }

  /**
   * 著者名から姓を抽出（Family name）
   */
  extractLastName(author: string): string {
    if (!author || !author.trim()) {
      return "";
    }

    // "Smith, J. A." または "Smith J. A." または "Smith" の形式を想定
    // カンマがある場合は、カンマの前が姓
    // カンマがない場合は、最初の単語が姓
    const trimmed = author.trim();

    if (trimmed.includes(",")) {
      // "Smith, J. A." 形式
      const parts = trimmed.split(",");
      return parts[0].trim();
    } else {
      // "Smith J. A." または "Smith" 形式
      const parts = trimmed.split(/\s+/);
      return parts[0] || trimmed;
    }
  }

  /**
   * 著者名からイニシャルを抽出
   */
  private extractInitials(author: string): string {
    // "Smith, J. A." または "Smith J. A." の形式を想定
    const parts = author.trim().split(/[,\s]+/);
    if (parts.length > 1) {
      return parts.slice(1).join(" ");
    }
    return "";
  }

  /**
   * 著者名をフォーマット（LastName FirstInitial形式）
   */
  private formatAuthorName(
    author: string,
    format: "LastName FirstInitial" | "LastName FirstName"
  ): string {
    const lastName = this.extractLastName(author);
    const initials = this.extractInitials(author);

    if (format === "LastName FirstInitial") {
      if (initials) {
        return `${lastName}, ${initials}`;
      }
      return lastName;
    }
    // LastName FirstName形式（現時点では未使用）
    return author;
  }
}



