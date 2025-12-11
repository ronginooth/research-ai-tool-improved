/**
 * パラグラフ生成ライブラリ
 * AIを使用してパラグラフの文章を生成
 * OpenAIとGeminiの両方に対応
 */

import { openai } from "@/lib/openai";
import { callGemini } from "@/lib/gemini";

export interface ParagraphGenerationOptions {
  paragraphTitle: string;
  paragraphDescription: string;
  existingContent?: string;
  citations: Array<{
    title: string;
    authors: string;
    year: number;
    context?: string;
    keyPoints?: string[];
    abstract?: string;
    venue?: string;
  }>;
  citationStyle: "apa" | "vancouver" | "nature";
  targetWordCount?: number;
  language: "en" | "ja";
  sectionType?: "introduction" | "methods" | "results" | "discussion";
  contextParagraphs?: Array<{
    paragraphNumber: string;
    title: string;
    description: string;
    content?: string;
    sectionType: string;
    isBefore: boolean;
  }>;
  relatedParagraphs?: Array<{
    paragraphNumber: string;
    title: string;
    description: string;
    content?: string;
    sectionType: string;
  }>;
  provider?: "openai" | "gemini" | "auto";
}

/**
 * パラグラフの文章を生成
 */
export async function generateParagraphContent(
  options: ParagraphGenerationOptions
): Promise<string> {
  // 要件を配列として構築
  const requirements: string[] = [
    `Write in ${options.language === "en" ? "English" : "Japanese"}`,
    options.citations.length > 0
      ? `Use ${options.citationStyle} citation style and integrate all provided citations naturally`
      : "No citations to include, focus on the topic sentence",
    "Maintain scientific accuracy and clarity",
    "Follow IMRaD format conventions for the section type",
  ];

  // Methodsセクション用の特別な指示を追加
  if (options.sectionType === "methods") {
    requirements.push(
      `CRITICAL FOR METHODS SECTION: Focus ONLY on what was done (procedures, protocols, materials, and methods). Do NOT include:
   - Results or findings
   - Interpretations or significance
   - Discussion of outcomes
   - Conclusions or implications
   Write concisely and objectively, describing only the implementation details.`
    );
  }

  // コンテキストパラグラフの要件
  if (options.contextParagraphs && options.contextParagraphs.length > 0) {
    requirements.push(
      "CRITICAL: Ensure smooth transitions with the context paragraphs. Connect logically to preceding paragraphs and set up following paragraphs naturally."
    );
  }

  // 関連パラグラフの要件
  if (options.relatedParagraphs && options.relatedParagraphs.length > 0) {
    requirements.push(
      "Maintain consistency with related paragraphs in the same section"
    );
  }

  // 単語数の要件
  requirements.push(
    options.targetWordCount
      ? `Aim for approximately ${options.targetWordCount} words`
      : "Aim for approximately 130 words (standard paragraph length)"
  );

  // 要件を番号付きリストに変換
  const requirementsText = requirements
    .map((req, index) => `${index + 1}. ${req}`)
    .join("\n");

  const prompt = `
You are a scientific writing assistant. Generate a paragraph for a research manuscript following the IMRaD format (Introduction, Methods, Results, Discussion).

Paragraph Information:
- Title: ${options.paragraphTitle}
- Description/Topic Sentence: ${options.paragraphDescription}
${
  options.existingContent
    ? `- Existing Content (to enhance): ${options.existingContent}`
    : ""
}
${
  options.targetWordCount
    ? `- Target Word Count: ${options.targetWordCount} (approximately 130 words per paragraph is standard)`
    : ""
}

${
  options.citations.length > 0
    ? `Citations to incorporate:
${options.citations
  .map(
    (citation, index) => `
${index + 1}. ${citation.title} (${citation.authors}, ${citation.year}${
      citation.venue ? `, ${citation.venue}` : ""
    })
   ${
     citation.abstract
       ? `Abstract: ${citation.abstract.substring(0, 300)}...`
       : ""
   }
   Context: ${citation.context || "General reference"}
   ${citation.keyPoints ? `Key points: ${citation.keyPoints.join(", ")}` : ""}
`
  )
  .join("\n")}`
    : "No citations provided. Generate the paragraph based on the topic sentence and related paragraphs only."
}

${
  options.contextParagraphs && options.contextParagraphs.length > 0
    ? `Context Paragraphs (immediately before and after this paragraph - use these to maintain flow and continuity):
${options.contextParagraphs
  .map(
    (para, index) => `
${index + 1}. ${para.isBefore ? "[BEFORE]" : "[AFTER]"} ${
      para.paragraphNumber
    }: ${para.title} (${para.sectionType})
   Description: ${para.description}
   ${
     para.content
       ? `Content: ${para.content.substring(0, 300)}...`
       : "(No content yet)"
   }
`
  )
  .join("\n")}

IMPORTANT: Use the context paragraphs to ensure smooth transitions. If there are paragraphs before this one, make sure your generated paragraph connects logically to them. If there are paragraphs after, ensure your paragraph sets up what follows.`
    : ""
}

${
  options.relatedParagraphs && options.relatedParagraphs.length > 0
    ? `Related Paragraphs (same section, for consistency):
${options.relatedParagraphs
  .map(
    (para, index) => `
${index + 1}. ${para.paragraphNumber}: ${para.title} (${para.sectionType})
   Description: ${para.description}
   ${
     para.content
       ? `Content: ${para.content.substring(0, 200)}...`
       : "(No content yet)"
   }
`
  )
  .join("\n")}`
    : ""
}

Requirements:
${requirementsText}

Generate the paragraph content:
  `;

  // プロバイダーの決定（autoの場合は利用可能なものを自動選択）
  const provider = options.provider || "auto";
  let selectedProvider: "openai" | "gemini" = "openai";

  if (provider === "auto") {
    // 利用可能なプロバイダーを自動選択
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      selectedProvider = "gemini";
    } else if (openaiKey) {
      selectedProvider = "openai";
    } else {
      throw new Error(
        "AIプロバイダーが利用できません。GEMINI_API_KEYまたはOPENAI_API_KEYを設定してください。"
      );
    }
  } else {
    selectedProvider = provider;
  }

  console.log(`[Paragraph Generator] Using provider: ${selectedProvider}`);

  try {
    if (selectedProvider === "gemini") {
      return await generateWithGemini(prompt);
    } else {
      return await generateWithOpenAI(prompt);
    }
  } catch (error: any) {
    console.error("[Paragraph Generator] Error details:", {
      provider: selectedProvider,
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      stack: error?.stack,
    });

    // より詳細なエラーメッセージを提供
    if (
      error?.message?.includes("API key") ||
      error?.message?.includes("API_KEY")
    ) {
      throw new Error(
        `${
          selectedProvider === "gemini" ? "Gemini" : "OpenAI"
        } APIキーが無効です。環境変数を確認してください。`
      );
    } else if (error?.status === 401) {
      throw new Error(
        `${
          selectedProvider === "gemini" ? "Gemini" : "OpenAI"
        } APIキーが無効です。認証に失敗しました。`
      );
    } else if (error?.status === 429) {
      throw new Error(
        `${
          selectedProvider === "gemini" ? "Gemini" : "OpenAI"
        } APIのレート制限に達しました。しばらく待ってから再試行してください。`
      );
    } else if (error?.status === 500) {
      throw new Error(
        `${
          selectedProvider === "gemini" ? "Gemini" : "OpenAI"
        } APIサーバーエラーが発生しました。しばらく待ってから再試行してください。`
      );
    } else if (error?.message) {
      throw new Error(`文章生成に失敗しました: ${error.message}`);
    } else {
      throw new Error(
        `文章生成に失敗しました: ${error?.toString() || "不明なエラー"}`
      );
    }
  }
}

/**
 * OpenAIを使用してパラグラフを生成
 */
async function generateWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEYが設定されていません。環境変数を確認してください。"
    );
  }

  if (!openai) {
    throw new Error("OpenAI client is not initialized");
  }

  console.log("[Paragraph Generator] Calling OpenAI API...");
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a scientific writing assistant. Generate well-structured, accurate scientific paragraphs.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = completion.choices[0].message.content || "";
  if (!content) {
    throw new Error("AIからの応答が空でした");
  }

  console.log(
    "[Paragraph Generator] Successfully generated content with OpenAI"
  );
  return content;
}

/**
 * Geminiを使用してパラグラフを生成
 */
async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEYが設定されていません。環境変数を確認してください。"
    );
  }

  console.log("[Paragraph Generator] Calling Gemini API...");

  // システムメッセージとプロンプトを結合
  const fullPrompt = `You are a scientific writing assistant. Generate well-structured, accurate scientific paragraphs.

${prompt}`;

  const content = await callGemini(fullPrompt);

  if (!content || content.trim().length === 0) {
    throw new Error("AIからの応答が空でした");
  }

  console.log(
    "[Paragraph Generator] Successfully generated content with Gemini"
  );
  return content.trim();
}

/**
 * 既存のパラグラフを補完
 */
export async function enhanceParagraphContent(
  existingContent: string,
  newCitations: Array<{
    title: string;
    authors: string;
    year: number;
    keyPoints?: string[];
  }>,
  sectionType?: "introduction" | "methods" | "results" | "discussion"
): Promise<string> {
  // 要件を配列として構築
  const requirements: string[] = [
    "Maintain the existing structure and flow",
    "Integrate new citations naturally",
    "Ensure smooth transitions",
    "Maintain scientific accuracy",
    "Do not remove existing content unless it contradicts new citations",
  ];

  // Methodsセクション用の特別な指示を追加
  if (sectionType === "methods") {
    requirements.push(
      "CRITICAL FOR METHODS SECTION: If this is a Methods section paragraph, ensure that you do NOT add any results, findings, interpretations, or significance. Focus ONLY on procedures, protocols, materials, and methods."
    );
  }

  // 要件を番号付きリストに変換
  const requirementsText = requirements
    .map((req, index) => `${index + 1}. ${req}`)
    .join("\n");

  const prompt = `
You are a scientific writing assistant. Enhance an existing paragraph by incorporating new citations.

Existing Paragraph:
${existingContent}

New Citations to Add:
${newCitations
  .map(
    (citation, index) => `
${index + 1}. ${citation.title} (${citation.authors}, ${citation.year})
   Key points: ${citation.keyPoints?.join(", ") || "N/A"}
`
  )
  .join("\n")}

Requirements:
${requirementsText}

Enhanced paragraph:
  `;

  // プロバイダーの決定（autoの場合は利用可能なものを自動選択）
  const provider = "auto"; // enhanceParagraphContentでは常にautoを使用
  let selectedProvider: "openai" | "gemini" = "openai";

  if (provider === "auto") {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      selectedProvider = "gemini";
    } else if (openaiKey) {
      selectedProvider = "openai";
    } else {
      throw new Error(
        "AIプロバイダーが利用できません。GEMINI_API_KEYまたはOPENAI_API_KEYを設定してください。"
      );
    }
  }

  try {
    if (selectedProvider === "gemini") {
      const fullPrompt = `You are a scientific writing assistant. Enhance existing paragraphs by incorporating new citations naturally.

${prompt}`;
      const content = await callGemini(fullPrompt);
      if (!content || content.trim().length === 0) {
        throw new Error("AIからの応答が空でした");
      }
      return content.trim();
    } else {
      return await generateEnhancementWithOpenAI(prompt);
    }
  } catch (error: any) {
    console.error("Paragraph enhancement error:", error);
    throw new Error(
      `文章補完に失敗しました: ${error?.message || "不明なエラー"}`
    );
  }
}

/**
 * OpenAIを使用してパラグラフを補完
 */
async function generateEnhancementWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEYが設定されていません。環境変数を確認してください。"
    );
  }

  if (!openai) {
    throw new Error("OpenAI client is not initialized");
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a scientific writing assistant. Enhance existing paragraphs by incorporating new citations naturally.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.5,
    max_tokens: 2000,
  });

  return completion.choices[0].message.content || "";
}
