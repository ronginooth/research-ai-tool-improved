/**
 * 引用形式の定義
 * 各ジャーナルの引用スタイルを定義し、後から追加できるようにする
 */

export interface CitationFormatConfig {
  id: string;
  name: string;
  displayName: string;
  // 著者名の設定
  authorConfig: {
    maxAuthorsBeforeEtAl: number; // et al.を使う前の最大著者数
    useEtAl: boolean; // et al.を使用するか
    authorSeparator: string; // 著者間の区切り文字（", " または " & "）
    lastAuthorSeparator: string; // 最後の著者との区切り（", " または " & "）
    authorFormat: "LastName FirstInitial" | "LastName FirstName"; // 著者名のフォーマット
  };
  // タイトルの設定
  titleConfig: {
    includeTitle: boolean; // タイトルを含めるか
    titleCase: "sentence" | "title"; // タイトルの大文字化方法
    titleEndPunctuation: string; // タイトル末尾の句読点（"." または ""）
  };
  // ジャーナル名の設定
  journalConfig: {
    useItalic: boolean; // イタリック体を使用するか（Markdownでは*で囲む）
    abbreviation: string; // ジャーナル名の略称（venueが異なる場合は上書き）
  };
  // 巻・号・ページの設定
  volumeConfig: {
    useBold: boolean; // 巻数を太字にするか（Markdownでは**で囲む）
    includeIssue: boolean; // 号数を含めるか
    pageFormat: "range" | "start-only" | "article-number"; // ページ番号の形式
    pageSeparator: string; // ページ範囲の区切り（"-" または "–"）
  };
  // DOIの設定
  doiConfig: {
    includeDoi: boolean; // DOIを含めるか
    doiPrefix: string; // DOIのプレフィックス（"doi:" または "https://doi.org/"）
  };
  // 年の設定
  yearConfig: {
    format: "parentheses" | "comma"; // 年のフォーマット（"(2020)" または ", 2020"）
  };
}

/**
 * 各ジャーナルの引用形式設定
 */
export const CITATION_FORMATS: Record<string, CitationFormatConfig> = {
  nature: {
    id: "nature",
    name: "Nature",
    displayName: "Nature",
    authorConfig: {
      maxAuthorsBeforeEtAl: 6,
      useEtAl: true,
      authorSeparator: ", ",
      lastAuthorSeparator: " & ",
      authorFormat: "LastName FirstInitial",
    },
    titleConfig: {
      includeTitle: true,
      titleCase: "sentence",
      titleEndPunctuation: ".",
    },
    journalConfig: {
      useItalic: true,
      abbreviation: "Nature",
    },
    volumeConfig: {
      useBold: true,
      includeIssue: false,
      pageFormat: "range",
      pageSeparator: "–",
    },
    doiConfig: {
      includeDoi: true,
      doiPrefix: "doi:",
    },
    yearConfig: {
      format: "parentheses",
    },
  },
  cell: {
    id: "cell",
    name: "Cell",
    displayName: "Cell",
    authorConfig: {
      maxAuthorsBeforeEtAl: 3,
      useEtAl: true,
      authorSeparator: ", ",
      lastAuthorSeparator: ", ",
      authorFormat: "LastName FirstInitial",
    },
    titleConfig: {
      includeTitle: true,
      titleCase: "sentence",
      titleEndPunctuation: ".",
    },
    journalConfig: {
      useItalic: true,
      abbreviation: "Cell",
    },
    volumeConfig: {
      useBold: true,
      includeIssue: false,
      pageFormat: "range",
      pageSeparator: "–",
    },
    doiConfig: {
      includeDoi: true,
      doiPrefix: "doi:",
    },
    yearConfig: {
      format: "parentheses",
    },
  },
  science: {
    id: "science",
    name: "Science",
    displayName: "Science",
    authorConfig: {
      maxAuthorsBeforeEtAl: 5,
      useEtAl: true,
      authorSeparator: ", ",
      lastAuthorSeparator: ", ",
      authorFormat: "LastName FirstInitial",
    },
    titleConfig: {
      includeTitle: true,
      titleCase: "sentence",
      titleEndPunctuation: ".",
    },
    journalConfig: {
      useItalic: true,
      abbreviation: "Science",
    },
    volumeConfig: {
      useBold: true,
      includeIssue: false,
      pageFormat: "range",
      pageSeparator: "–",
    },
    doiConfig: {
      includeDoi: true,
      doiPrefix: "doi:",
    },
    yearConfig: {
      format: "parentheses",
    },
  },
  jcb: {
    id: "jcb",
    name: "J. Cell. Biol.",
    displayName: "J. Cell. Biol.",
    authorConfig: {
      maxAuthorsBeforeEtAl: 3,
      useEtAl: true,
      authorSeparator: ", ",
      lastAuthorSeparator: ", ",
      authorFormat: "LastName FirstInitial",
    },
    titleConfig: {
      includeTitle: true,
      titleCase: "sentence",
      titleEndPunctuation: ".",
    },
    journalConfig: {
      useItalic: true,
      abbreviation: "J. Cell Biol.",
    },
    volumeConfig: {
      useBold: true,
      includeIssue: false,
      pageFormat: "range",
      pageSeparator: "–",
    },
    doiConfig: {
      includeDoi: true,
      doiPrefix: "doi:",
    },
    yearConfig: {
      format: "parentheses",
    },
  },
  elife: {
    id: "elife",
    name: "eLife",
    displayName: "eLife",
    authorConfig: {
      maxAuthorsBeforeEtAl: 5,
      useEtAl: true,
      authorSeparator: ", ",
      lastAuthorSeparator: ", ",
      authorFormat: "LastName FirstInitial",
    },
    titleConfig: {
      includeTitle: true,
      titleCase: "sentence",
      titleEndPunctuation: ".",
    },
    journalConfig: {
      useItalic: true,
      abbreviation: "eLife",
    },
    volumeConfig: {
      useBold: true,
      includeIssue: false,
      pageFormat: "article-number", // eLifeは記事番号を使用
      pageSeparator: "",
    },
    doiConfig: {
      includeDoi: true,
      doiPrefix: "doi:",
    },
    yearConfig: {
      format: "parentheses",
    },
  },
};

/**
 * 利用可能な引用形式のリストを取得
 */
export function getAvailableFormats(): CitationFormatConfig[] {
  return Object.values(CITATION_FORMATS);
}

/**
 * 引用形式をIDで取得
 */
export function getFormatById(id: string): CitationFormatConfig | undefined {
  return CITATION_FORMATS[id];
}

/**
 * デフォルトの引用形式を取得
 */
export function getDefaultFormat(): CitationFormatConfig {
  return CITATION_FORMATS.nature;
}



