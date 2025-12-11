// 要約項目の定義
export const SUMMARY_CATEGORIES = {
  tldr: {
    key: "tldr",
    label: "TL;DR",
    description: "論文の超要約（1-2文）",
  },
  findings: {
    key: "findings",
    label: "Findings",
    description: "主な発見・結果",
  },
  conclusions: {
    key: "conclusions",
    label: "Conclusions",
    description: "結論",
  },
  summarizedAbstract: {
    key: "summarizedAbstract",
    label: "Summarized Abstract",
    description: "要約された抄録",
  },
  results: {
    key: "results",
    label: "Results",
    description: "結果セクションの要約",
  },
  summarizedIntroduction: {
    key: "summarizedIntroduction",
    label: "Summarized Introduction",
    description: "要約されたイントロダクション",
  },
  methodsUsed: {
    key: "methodsUsed",
    label: "Methods Used",
    description: "使用された手法",
  },
  literatureSurvey: {
    key: "literatureSurvey",
    label: "Literature Survey",
    description: "文献調査・関連研究",
  },
  limitations: {
    key: "limitations",
    label: "Limitations",
    description: "研究の限界",
  },
  contributions: {
    key: "contributions",
    label: "Contributions",
    description: "研究の貢献",
  },
  practicalImplications: {
    key: "practicalImplications",
    label: "Practical Implications",
    description: "実用的な意義",
  },
  objectives: {
    key: "objectives",
    label: "Objectives",
    description: "研究目的",
  },
  researchGap: {
    key: "researchGap",
    label: "Research Gap",
    description: "研究ギャップ",
  },
} as const;

export type SummaryCategoryKey = keyof typeof SUMMARY_CATEGORIES;

