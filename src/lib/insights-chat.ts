import { aiProviderManager } from "@/lib/ai-provider-manager";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchHtmlPlainText, extractHtmlContexts } from "@/lib/paper-content";
import { AdvancedSearchEngine } from "@/lib/advanced-search-engine";
import { callGemini } from "@/lib/gemini";
import { ensurePaperEmbeddings } from "@/lib/paper-ingest";
import {
  InsightsChatResponse,
  InsightsChatReference,
  InsightsChatParagraph,
  InsightsChatExternalReference,
  Paper,
} from "@/types";

const DEFAULT_USER = "demo-user-123";
const DEFAULT_MAX_REFERENCES = 8;
const MAX_HTML_CONTEXTS = 60;
const RELATED_PAPERS_LIMIT = 3;

interface GenerateOptions {
  paperId: string;
  userId?: string;
  question: string;
  htmlUrl?: string | null;
  textContexts?: string[];
  maxReferences?: number;
}

interface RankedContext extends InsightsChatReference {
  text: string;
  chunkType?: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function fetchLibraryRecord(paperId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_library")
    .select("title, authors, url, html_url")
    .eq("paper_id", paperId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load library record", error);
    return null;
  }

  return data as {
    title: string | null;
    authors: string | null;
    url: string | null;
    html_url: string | null;
  } | null;
}

async function ensureHtmlContexts(
  htmlUrl: string | null,
  questionEmbedding: number[],
  maxReferences: number
): Promise<RankedContext[]> {
  if (!htmlUrl) return [];
  const plainText = await fetchHtmlPlainText(htmlUrl);
  if (!plainText) return [];

  const contexts = extractHtmlContexts(plainText, {
    maxContexts: MAX_HTML_CONTEXTS,
  });

  const ranked: RankedContext[] = [];
  for (const ctx of contexts) {
    try {
      const embedding = await aiProviderManager.generateEmbedding(ctx.text);
      ranked.push({
        id: ctx.id,
        source: "html",
        sectionTitle: ctx.sectionTitle,
        pageNumber: null,
        similarity: cosineSimilarity(questionEmbedding, embedding),
        excerpt: ctx.text.slice(0, 240),
        text: ctx.text,
        chunkType: isFigureCaption(ctx.text) ? "figure_html" : "html_text",
      } as RankedContext);
    } catch (error) {
      console.warn("Embedding error", error);
    }
  }

  return ranked.slice(0, maxReferences * 2);
}

async function fetchPdfContexts(
  paperId: string,
  questionEmbedding: number[],
  maxReferences: number
): Promise<RankedContext[]> {
  const { data: embeddingRows, error } = await supabaseAdmin
    .from("library_pdf_embeddings")
    .select("chunk_id, embedding")
    .eq("paper_id", paperId);

  if (error) {
    console.warn("Failed to load embeddings", error);
    return [];
  }
  if (!embeddingRows?.length) return [];

  const chunkIds = embeddingRows.map((row: any) => row.chunk_id);
  const { data: chunks, error: chunkError } = await supabaseAdmin
    .from("library_pdf_chunks")
    .select("id, chunk_text, page_number, section_id, chunk_type")
    .in("id", chunkIds)
    .order("order_index", { ascending: true });

  if (chunkError) {
    console.warn("Failed to load chunks", chunkError);
    return [];
  }
  if (!chunks?.length) return [];

  const sectionIds = Array.from(
    new Set(chunks.map((chunk: any) => chunk.section_id).filter(Boolean))
  );
  const sectionMap = new Map<string, { title: string }>();
  if (sectionIds.length) {
    const { data: sections } = await supabaseAdmin
      .from("library_pdf_sections")
      .select("id, section_title")
      .in("id", sectionIds);
    sections?.forEach((sec: any) =>
      sectionMap.set(sec.id, { title: sec.section_title })
    );
  }

  const chunkMap = new Map(chunks.map((chunk: any) => [chunk.id, chunk]));

  const ranked: RankedContext[] = [];
  embeddingRows.forEach((row: any) => {
    const chunk = chunkMap.get(row.chunk_id);
    if (!chunk || !row.embedding?.length) return;
    const chunkType = chunk.chunk_type ?? "pdf_text";
    const isFigure = chunkType.startsWith("figure_");
    ranked.push({
      id: chunk.id,
      source: isFigure ? "pdf" : "pdf",
      sectionTitle: chunk.section_id
        ? sectionMap.get(chunk.section_id)?.title ?? "不明"
        : "不明",
      pageNumber: chunk.page_number,
      similarity: cosineSimilarity(questionEmbedding, row.embedding),
      excerpt: chunk.chunk_text.slice(0, 240),
      text: chunk.chunk_text,
      chunkType,
    });
  });

  return ranked
    .sort((a, b) => {
      const scoreA =
        a.similarity + (a.chunkType?.startsWith("figure_") ? 0.1 : 0);
      const scoreB =
        b.similarity + (b.chunkType?.startsWith("figure_") ? 0.1 : 0);
      return scoreB - scoreA;
    })
    .slice(0, maxReferences);
}

async function fetchRelatedPapers(question: string): Promise<Paper[]> {
  try {
    const engine = new AdvancedSearchEngine();
    return await engine.multilayerSearch(question, {
      query: question,
      limit: RELATED_PAPERS_LIMIT,
    } as any);
  } catch (error) {
    console.warn("Related search failed", error);
    return [];
  }
}

function buildPrompt(
  question: string,
  contexts: RankedContext[],
  related: Paper[],
  title?: string | null,
  authors?: string | null
) {
  const contextBlock = contexts
    .map((ctx) => {
      const label =
        ctx.source === "html"
          ? "HTML"
          : ctx.chunkType?.startsWith("figure_")
          ? "FIGURE"
          : "PDF";
      const location = [
        ctx.sectionTitle ?? "不明",
        ctx.pageNumber != null ? `p.${ctx.pageNumber}` : null,
      ]
        .filter(Boolean)
        .join(" / ");
      return `Context ${ctx.id} [${label}] (位置: ${
        location || "不明"
      })\n抜粋: ${ctx.text.slice(0, 500)}`;
    })
    .join("\n\n");

  const relatedBlock = related
    .map((paper, index) => {
      const label = `ref${index + 1}`;
      return `Reference ${label}\nタイトル: ${paper.title}\n著者: ${
        paper.authors || "不明"
      }\n出版: ${paper.venue || "不明"}\n年: ${paper.year || "不明"}\nURL: ${
        paper.url || "不明"
      }`;
    })
    .join("\n\n");

  const header = [
    title ? `対象論文タイトル: ${title}` : null,
    authors ? `著者: ${authors}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `あなたは研究論文のリサーチパートナーです。以下の質問に対して、提供された本文コンテキストと関連論文をもとに詳しく回答してください。回答は JSON で返却してください。

図や表に関する説明が含まれるコンテキストがあれば優先的に参照し、該当ページやセクションを明示してください。根拠が曖昧な場合はその旨を述べ、推測で補わないでください。

--- 対象論文情報 ---
${header || "(詳細情報なし)"}

--- コンテキスト一覧 ---
${contextBlock || "(コンテキストなし)"}

--- 関連論文候補 ---
${relatedBlock || "(候補なし)"}

--- 指示 ---
1. 回答は自然な日本語の段落に分割し、各段落に参照した contextIds を付与してください。
2. 引用が必要な箇所は、文章内で自然に参照したのち括弧で contextIds を補足してください。
3. 外部論文を参照した場合は externalReferences にまとめ、回答本文でもタイトル等を触れてください。
4. 図・表の説明に基づく場合は、対応するコンテキスト番号とページを明記してください。
5. 最後に followups として追加調査すべき点があれば列挙してください。

--- 出力フォーマット（JSON） ---
{
  "paragraphs": [
    {
      "content": "段落本文",
      "contextIds": ["ctx1", "ctx2"]
    }
  ],
  "externalReferences": [
    {
      "title": "関連論文タイトル",
      "url": "https://...",
      "summary": "該当論文の関連性や要約",
      "authors": "著者情報",
      "relation": "回答との関係"
    }
  ],
  "followups": ["追加で検討すべき質問や作業"]
}

--- 質問 ---
${question}`;
}

function parseModelOutput(raw: string): {
  paragraphs: InsightsChatParagraph[];
  externalReferences: InsightsChatExternalReference[];
  followups: string[];
} {
  if (!raw) return { paragraphs: [], externalReferences: [], followups: [] };
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    const paragraphs = Array.isArray(parsed.paragraphs)
      ? parsed.paragraphs
          .filter(
            (item: any) =>
              typeof item?.content === "string" &&
              item.content.trim().length > 0
          )
          .map((item: any) => ({
            content: item.content,
            contextIds: Array.isArray(item.contextIds)
              ? item.contextIds.filter((id: any) => typeof id === "string")
              : undefined,
          }))
      : [];

    const externalReferences = Array.isArray(parsed.externalReferences)
      ? parsed.externalReferences
          .filter((item: any) => typeof item?.title === "string")
          .map((item: any) => ({
            title: item.title,
            url: item.url,
            summary: item.summary,
            authors: item.authors,
            relation: item.relation,
          }))
      : [];

    const followups = Array.isArray(parsed.followups)
      ? parsed.followups.filter(
          (item: any) => typeof item === "string" && item.trim().length > 0
        )
      : [];

    return { paragraphs, externalReferences, followups };
  } catch (error) {
    console.warn("Failed to parse model output", error);
    return { paragraphs: [], externalReferences: [], followups: [] };
  }
}

export async function generateInsightsChatResponse(
  options: GenerateOptions
): Promise<InsightsChatResponse | null> {
  const {
    paperId,
    question,
    userId = DEFAULT_USER,
    htmlUrl,
    textContexts,
    maxReferences = DEFAULT_MAX_REFERENCES,
  } = options;

  const questionEmbedding = await aiProviderManager.generateEmbedding(question);

  const record = await fetchLibraryRecord(paperId, userId);

  const htmlContexts = await ensureHtmlContexts(
    htmlUrl ?? record?.html_url ?? record?.url ?? null,
    questionEmbedding,
    maxReferences
  );
  const pdfContexts = await fetchPdfContexts(
    paperId,
    questionEmbedding,
    maxReferences
  );

  if (!htmlContexts.length && !pdfContexts.length) {
    await ensurePaperEmbeddings({
      paperId,
      htmlUrl: htmlUrl ?? record?.html_url ?? record?.url ?? null,
      pdfUrl: record?.pdf_url ?? null,
      force: false,
    });

    const refreshedHtml = await ensureHtmlContexts(
      htmlUrl ?? record?.html_url ?? record?.url ?? null,
      questionEmbedding,
      maxReferences
    );
    const refreshedPdf = await fetchPdfContexts(
      paperId,
      questionEmbedding,
      maxReferences
    );

    htmlContexts.push(...refreshedHtml);
    pdfContexts.push(...refreshedPdf);
  }

  const manualContexts: RankedContext[] = textContexts
    ? textContexts.map((text, index) => ({
        id: `manual-${index}`,
        source: "html",
        sectionTitle: null,
        pageNumber: null,
        similarity: 0,
        excerpt: text.slice(0, 240),
        text,
      }))
    : [];

  let contexts = [...manualContexts, ...htmlContexts, ...pdfContexts].sort(
    (a, b) => {
      const bonusA = a.chunkType?.startsWith("figure_") ? 0.1 : 0;
      const bonusB = b.chunkType?.startsWith("figure_") ? 0.1 : 0;
      return b.similarity + bonusB - (a.similarity + bonusA);
    }
  );
  if (!contexts.length) return null;
  contexts = contexts.slice(0, maxReferences);

  const related = await fetchRelatedPapers(question);
  const prompt = buildPrompt(
    question,
    contexts,
    related,
    record?.title,
    record?.authors
  );
  const raw = await callGemini(prompt);
  const parsed = parseModelOutput(raw);

  const paragraphs = parsed.paragraphs.length
    ? parsed.paragraphs
    : [
        {
          content:
            raw || "回答を生成できませんでした。別の質問でお試しください。",
        },
      ];

  return {
    paperId,
    userId,
    question,
    paragraphs,
    references: contexts.map(({ text, chunkType, ...rest }) => ({
      ...rest,
      chunkType,
    })),
    externalReferences: parsed.externalReferences,
    followups: parsed.followups,
    relatedPapers: related,
  };
}
