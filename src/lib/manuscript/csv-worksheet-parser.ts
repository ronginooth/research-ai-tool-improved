/**
 * CSV形式のワークシート解析ライブラリ
 * PMC3987331形式（25-30パラグラフのIMRaD形式）に対応
 */

import { ParagraphStructure, WorksheetStructure } from "./worksheet-parser";

/**
 * CSV形式のワークシートを解析
 */
export function parseCsvWorksheet(csvContent: string, title?: string): WorksheetStructure {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error("CSVファイルが空です");
  }

  // ヘッダー行を解析
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);
  
  // 必須カラムを確認
  const requiredColumns = ["paragraph", "Topic sentence", "Section"];
  const missingColumns = requiredColumns.filter(
    (col) => !headers.includes(col)
  );
  if (missingColumns.length > 0) {
    throw new Error(`必須カラムが見つかりません: ${missingColumns.join(", ")}`);
  }

  const paragraphs: ParagraphStructure[] = [];
  let order = 0;

  // データ行を解析
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    if (values.length < headers.length) {
      // カラム数が足りない場合は空文字で埋める
      while (values.length < headers.length) {
        values.push("");
      }
    }

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    // パラグラフ情報を抽出
    const paragraphTitle = row["paragraph"] || "";
    const topicSentence = row["Topic sentence"] || "";
    const sectionName = row["Section"] || "";
    const memo = row["Memo"] || "";

    if (!paragraphTitle || !sectionName) {
      continue; // 必須情報がない場合はスキップ
    }

    // セクションタイプを正規化
    const sectionType = normalizeSectionType(sectionName);
    if (!sectionType) {
      console.warn(`[CSV Parser] Unknown section type: ${sectionName}, skipping row ${i + 1}`);
      continue;
    }

    // パラグラフ番号を生成（IDカラムがある場合は使用、なければ順番で生成）
    let paragraphNumber = row["ID"] || `P${order + 1}`;
    if (!paragraphNumber.startsWith("P")) {
      paragraphNumber = `P${order + 1}`;
    }

    paragraphs.push({
      paragraphNumber,
      sectionType,
      title: paragraphTitle.trim(),
      description: topicSentence.trim(),
      order: order++,
    });
  }

  // セクション別に分類
  const sections = {
    introduction: paragraphs.filter((p) => p.sectionType === "introduction"),
    methods: paragraphs.filter((p) => p.sectionType === "methods"),
    results: paragraphs.filter((p) => p.sectionType === "results"),
    discussion: paragraphs.filter((p) => p.sectionType === "discussion"),
  };

  return {
    title: title || "Untitled Worksheet",
    paragraphs,
    sections,
  };
}

/**
 * CSV行を解析（カンマ区切り、引用符対応）
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされた引用符
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        // 引用符の開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // カンマで区切る（引用符の外の場合のみ）
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // 最後の値を追加
  values.push(current.trim());

  return values;
}

/**
 * セクション名を正規化
 */
function normalizeSectionType(sectionName: string): "introduction" | "methods" | "results" | "discussion" | null {
  const normalized = sectionName.trim().toLowerCase();
  
  if (
    normalized.includes("introduction") ||
    normalized.includes("イントロダクション") ||
    normalized === "intro"
  ) {
    return "introduction";
  } else if (
    normalized.includes("methods") ||
    normalized === "方法" ||
    normalized === "method"
  ) {
    return "methods";
  } else if (
    normalized.includes("results") ||
    normalized === "結果" ||
    normalized === "result"
  ) {
    return "results";
  } else if (
    normalized.includes("discussion") ||
    normalized === "考察" ||
    normalized === "discuss"
  ) {
    return "discussion";
  }

  return null;
}

/**
 * PMC3987331形式のテンプレートCSVを生成
 */
export function generateTemplateCsv(): string {
  const template = `ID,paragraph,Topic sentence,Section,Memo
PA-01,Problem - what is known?,,Introduction,
PA-02,Contextualization,,Introduction,
PA-03,Knowledge gap - what is not known?,,Introduction,
PA-04,Definition and purpose of the study,,Introduction,
PA-05,Population and sample - inclusion and/or exclusion criteria; reference to the informed consent form and approval by the ethics committee,,Methods,
PA-06,"Population and sample II - description of specific sampling subgroups or, when necessary, in-depth detailing of procedures connected to follow-up and losses",,Methods,
PA-07,Main methods - most important variable or procedure,,Methods,
PA-08,Main methods II - unfolding the paragraph above,,Methods,
PA-09,Secondary methods - less important variables,,Methods,
PA-10,Study protocol - detailing of what has been done and how it has been done,,Methods,
PA-11,Study protocol II - additional data when necessary and justified,,Methods,
PA-12,Statistical analysis - descriptive and inferential methods,,Methods,
PA-13,Statistical analysis II - software and significance level,,Methods,
PA-14,General data - description of sample and information about the patient selection flow and actual performance of the study,,Results,
PA-15,Main results - the most important variables,,Results,
PA-16,Main results II - additional results and other analyzes of the most important variables,,Results,
PA-17,Secondary results - the other study variables,,Results,
PA-18,Secondary results II - additional results of variables or the interrelation or interaction between them,,Results,
PA-19,Secondary results III - additional results of variables or the interrelation or interaction between them,,Results,
PA-20,Other results and analysis carried out in the study,,Results,
PA-21,"The problem and the study's ""original"" proposal - discussing again the study's problem",,Discussion,
PA-22,Interpretation of the main result - meaning of what has been found,,Discussion,
PA-23,Comparison with the literature - how this result confirms previous data,,Discussion,
PA-24,Further comparison with the literature - exploring methodological or mechanistic differences,,Discussion,
PA-25,"The main result's contribution to knowledge - the ""novelty"" or main message or contribution of the research to the current state-of-the-art",,Discussion,
PA-26,Interpretation of secondary results - what these results inform or mean,,Discussion,
PA-27,Interpretation of secondary results II,,Discussion,
PA-28,Comparison of this study with previous ones - the contribution and developments in this study for the area's knowledge,,Discussion,
PA-29,"Limits of the study - strengths and weaknesses; the weaknesses and methodological problems of the study and, especially, how these limitations may hinder the practical application of the results and their interpretations. The strengths of the study may also be stressed, possibilities may be pointed out, as well as issues to be further researched - other knowledge gaps",,Discussion,
PA-30,"Conclusions and implications - this represents a synthesis of the study, usually answering the hypothesis reported in the final paragraph of the introductory section, solving the study objective.",,Discussion,`;

  return template;
}


