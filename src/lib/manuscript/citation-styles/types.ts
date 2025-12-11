/**
 * Citation Style の型定義
 */

export interface CitationStyle {
  id: string;
  name: string;
  displayName: string;
  isSystem?: boolean;
  sort: {
    mode: "citation-order" | "alphabetical" | "year-then-author" | "volume-year";
    key: "firstAuthor.lastName" | "year" | "citation_order" | "volume";
  };
  authorRules: {
    maxAuthors: number;
    etAlAfter: number;
    delimiter: string;
    finalDelimiter: string;
    format: "LastName FirstInitial" | "LastName FirstName";
  };
  title: {
    include: boolean;
    case: "sentence" | "title";
    endPunctuation: string;
  };
  journal: {
    useItalic: boolean;
    useVenue: boolean;
    fallbackAbbreviation: string;
  };
  volume: {
    useBold: boolean;
    includeIssue: boolean;
    format: "range" | "start-only" | "article-number";
    pageSeparator: string;
  };
  doi: {
    include: boolean;
    prefix: string;
  };
  year: {
    format: "parentheses" | "comma";
  };
  template: string;
}



