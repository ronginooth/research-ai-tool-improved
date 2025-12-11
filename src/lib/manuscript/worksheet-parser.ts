/**
 * ワークシート解析ライブラリ
 * Markdown形式のワークシートを解析してパラグラフ構造を抽出
 */

export interface ParagraphStructure {
  paragraphNumber: string; // P1, P2, etc.
  sectionType: "introduction" | "methods" | "results" | "discussion";
  title: string;
  description: string;
  order: number;
}

export interface WorksheetStructure {
  title: string;
  paragraphs: ParagraphStructure[];
  sections: {
    introduction: ParagraphStructure[];
    methods: ParagraphStructure[];
    results: ParagraphStructure[];
    discussion: ParagraphStructure[];
  };
}

/**
 * Markdownワークシートを解析してパラグラフ構造を抽出
 */
export function parseWorksheet(markdown: string): WorksheetStructure {
  const lines = markdown.split("\n");
  const paragraphs: ParagraphStructure[] = [];
  let currentSection: "introduction" | "methods" | "results" | "discussion" | null = null;
  let order = 0;

  // タイトルを抽出（最初の# で始まる行）
  let title = "Untitled Worksheet";
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // セクションタイプを検出
    // イントロダクション、方法、結果、考察の日本語表記にも対応
    // 形式: ## イントロダクション（P1〜P3） などにも対応
    if (line.match(/^##\s+(Introduction|Methods|Results|Discussion|イントロダクション|方法|結果|考察)/i)) {
      const sectionMatch = line.match(/^##\s+(.+?)(?:（|\(|$)/);
      if (sectionMatch) {
        const sectionName = sectionMatch[1].trim().toLowerCase();
        // 日本語表記にも対応
        if (sectionName.includes("introduction") || sectionName.includes("イントロダクション")) {
          currentSection = "introduction";
        } else if (sectionName.includes("methods") || sectionName === "方法") {
          currentSection = "methods";
        } else if (sectionName.includes("results") || sectionName === "結果") {
          currentSection = "results";
        } else if (sectionName.includes("discussion") || sectionName === "考察") {
          currentSection = "discussion";
        }
        console.log(`[Worksheet Parser] Detected section: ${sectionName} -> ${currentSection}`);
      }
      continue;
    }

    // パラグラフを検出（複数の形式に対応）
    // 形式1: ### P1: タイトル
    // 形式2: - **P1:** タイトル（太字のP1）
    // 形式3: - P1: タイトル
    let paragraphMatch = line.match(/^###\s+(P\d+):\s*(.+)$/);
    if (!paragraphMatch) {
      // - **P1:** 形式（太字のP1の後にコロンとスペース、またはスペースなし）
      paragraphMatch = line.match(/^-\s+\*\*(P\d+):\*\*\s*(.+)$/);
    }
    if (!paragraphMatch) {
      // - P1: 形式（太字ではない）
      paragraphMatch = line.match(/^-\s+(P\d+):\s*(.+)$/);
    }
    
    if (paragraphMatch && currentSection) {
      const paragraphNumber = paragraphMatch[1]; // P1, P2, etc.
      let titleAndDesc = paragraphMatch[2];
      
      console.log(`[Worksheet Parser] Found paragraph ${paragraphNumber} in section ${currentSection}: ${titleAndDesc.substring(0, 50)}...`);
      
      // 記入済みマークやチェックマークを除去
      titleAndDesc = titleAndDesc.replace(/\s*✅\s*記入済み.*$/i, "");
      titleAndDesc = titleAndDesc.replace(/\s*記入済み.*$/i, "");
      titleAndDesc = titleAndDesc.trim();
      
      // タイトルと説明を分離（括弧内の説明を抽出）
      let title = titleAndDesc;
      let description = "";

      // 括弧内の説明を抽出（例: "背景・既知の事実（精子鞭毛形成、キネシン分子モーター、男性不妊）"）
      const bracketMatch = titleAndDesc.match(/^(.+?)\s*[（(](.+?)[）)]\s*$/);
      if (bracketMatch) {
        title = bracketMatch[1].trim();
        description = bracketMatch[2].trim();
      } else if (titleAndDesc.includes(" - ")) {
        const parts = titleAndDesc.split(" - ", 2);
        title = parts[0].trim();
        description = parts[1].trim();
      } else if (titleAndDesc.includes(": ")) {
        const parts = titleAndDesc.split(": ", 2);
        title = parts[0].trim();
        description = parts[1].trim();
      }

      // 次の行をスキップしない（各行が独立したパラグラフエントリのため）

      paragraphs.push({
        paragraphNumber,
        sectionType: currentSection,
        title: title.trim(),
        description: description.trim(),
        order: order++,
      });
    }
  }

  // セクション別に分類
  const sections = {
    introduction: paragraphs.filter((p) => p.sectionType === "introduction"),
    methods: paragraphs.filter((p) => p.sectionType === "methods"),
    results: paragraphs.filter((p) => p.sectionType === "results"),
    discussion: paragraphs.filter((p) => p.sectionType === "discussion"),
  };

  return {
    title,
    paragraphs,
    sections,
  };
}

/**
 * パラグラフ構造をJSON形式に変換
 */
export function structureToJson(structure: WorksheetStructure): any {
  return {
    title: structure.title,
    totalParagraphs: structure.paragraphs.length,
    sections: {
      introduction: structure.sections.introduction.length,
      methods: structure.sections.methods.length,
      results: structure.sections.results.length,
      discussion: structure.sections.discussion.length,
    },
    paragraphs: structure.paragraphs.map((p) => ({
      number: p.paragraphNumber,
      section: p.sectionType,
      title: p.title,
      description: p.description,
      order: p.order,
    })),
  };
}

