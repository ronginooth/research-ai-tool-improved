import { Buffer } from "buffer";
import { aiProviderManager } from "@/lib/ai-provider-manager";
import {
  fetchHtmlPlainText,
  extractHtmlContexts,
  extractFigureCaptions,
} from "@/lib/paper-content";
import { supabaseAdmin } from "@/lib/supabase";

type ChunkSource = "pdf" | "html";

interface IngestOptions {
  paperId: string;
  pdfUrl?: string | null;
  pdfBuffer?: Buffer;
  htmlUrl?: string | null;
  fallbackHtml?: string | null;
  force?: boolean;
}

interface InternalChunk {
  text: string;
  source: ChunkSource;
  sectionTitle: string | null;
  pageNumber: number | null;
  chunkType?: string;
}

interface IngestSummary {
  pdfChunks: number;
  htmlChunks: number;
  totalChunks: number;
  skipped?: boolean;
}

const MAX_CHARS_PER_CHUNK = 1500;
const EMBEDDING_BATCH_SIZE = 8;

function normalizeBase64(input?: string | null): string {
  if (!input) return "";
  const cleaned = input.trim();
  const commaIndex = cleaned.indexOf(",");
  if (cleaned.startsWith("data:")) {
    return commaIndex >= 0 ? cleaned.slice(commaIndex + 1) : "";
  }
  return cleaned;
}

function splitTextIntoChunks(
  text: string,
  maxChars = MAX_CHARS_PER_CHUNK
): string[] {
  const normalized = text.replace(/[\s\u0000]+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sentences = normalized
    .split(/([。．.!?？])/)
    .filter((s) => s.length > 0);
  const chunks: string[] = [];
  let buffer = "";

  const pushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }
    buffer = "";
  };

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if ((buffer + " " + trimmed).trim().length > maxChars) {
      pushBuffer();
      if (trimmed.length > maxChars) {
        for (let i = 0; i < trimmed.length; i += maxChars) {
          const slice = trimmed.slice(i, i + maxChars);
          if (slice.trim().length) {
            chunks.push(slice.trim());
          }
        }
      } else {
        buffer = trimmed;
      }
    } else {
      buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
    }
  }

  pushBuffer();
  return chunks;
}

function isFigureCaption(text: string): boolean {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return false;
  return /^(figure|fig\.|supplementary\s+figure|図)\s*[0-9a-z\-:]/i.test(
    trimmed
  );
}

async function fetchPdfBuffer(pdfUrl?: string | null): Promise<Buffer | null> {
  if (!pdfUrl) return null;
  try {
    const response = await fetch(pdfUrl, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("fetchPdfBuffer failed", response.status, pdfUrl);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn("fetchPdfBuffer error", error);
    return null;
  }
}

async function fetchOriginalHtml(htmlUrl: string): Promise<string | null> {
  try {
    const response = await fetch(htmlUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Research-AI-Tool-Improved/2.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("fetchOriginalHtml failed", response.status, htmlUrl);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn("fetchOriginalHtml error", error);
    return null;
  }
}

async function parsePdfChunks(pdfData: Buffer): Promise<InternalChunk[]> {
  const pageTexts: string[] = [];

  try {
    // pdf-libを使用してPDFを解析
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(pdfData);
    const pages = pdfDoc.getPages();

    // 各ページからテキストを抽出（pdf-libは直接テキスト抽出できないため、代替手段を使用）
    // 注: pdf-libはメタデータ中心なので、テキスト抽出には制限があります
    // 代わりに、PDFのバイト列から簡易的にテキストを抽出
    const pdfText = pdfData.toString("latin1");
    const textMatches = pdfText.match(/\((.*?)\)/g) || [];
    const extractedText = textMatches
      .map((match) => match.slice(1, -1))
      .filter((text) => text.length > 3 && /[a-zA-Z]/.test(text))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (extractedText) {
      // ページ数に応じて分割
      const pageCount = pages.length;
      const textPerPage = Math.ceil(extractedText.length / pageCount);
      for (let i = 0; i < pageCount; i++) {
        const start = i * textPerPage;
        const end = Math.min((i + 1) * textPerPage, extractedText.length);
        const pageText = extractedText.slice(start, end);
        if (pageText.trim()) {
          pageTexts.push(pageText);
        }
      }
    }
  } catch (error) {
    console.warn("PDF parsing failed, returning empty chunks:", error);
    return [];
  }

  const chunks: InternalChunk[] = [];
  pageTexts.forEach((pageText, index) => {
    const chunkTexts = splitTextIntoChunks(pageText);
    chunkTexts.forEach((chunkText) => {
      if (!chunkText) return;
      const chunkType = isFigureCaption(chunkText) ? "figure_pdf" : "pdf_text";
      chunks.push({
        text: chunkText,
        source: "pdf",
        sectionTitle: `Page ${index + 1}`,
        pageNumber: index + 1,
        chunkType,
      });
    });
  });

  return chunks;
}

async function parseHtmlChunks(
  htmlPlainText: string,
  originalHtml?: string
): Promise<InternalChunk[]> {
  const chunks: InternalChunk[] = [];

  // 1. 図キャプションを特別に抽出
  if (originalHtml) {
    const figureCaptions = extractFigureCaptions(originalHtml);
    console.log(`Found ${figureCaptions.length} figure captions`);

    figureCaptions.forEach((caption, index) => {
      chunks.push({
        text: caption,
        source: "html" as const,
        sectionTitle: "Figure Captions",
        pageNumber: null,
        chunkType: "figure_html",
      });
    });
  }

  // 2. 通常のHTMLコンテンツを処理
  const contexts = extractHtmlContexts(htmlPlainText, { maxContexts: 200 });
  contexts.forEach((context) => {
    const chunkTexts = splitTextIntoChunks(context.text);
    chunkTexts.forEach((chunkText) => {
      // 図キャプションと重複する可能性があるテキストはスキップ
      if (isFigureCaption(chunkText)) {
        return;
      }

      chunks.push({
        text: chunkText,
        source: "html" as const,
        sectionTitle: context.sectionTitle || "HTML 本文",
        pageNumber: null,
        chunkType: "html_text",
      });
    });
  });

  return chunks;
}

async function clearExistingPaperContent(paperId: string) {
  await supabaseAdmin
    .from("library_pdf_embeddings")
    .delete()
    .eq("paper_id", paperId);
  await supabaseAdmin
    .from("library_pdf_chunks")
    .delete()
    .eq("paper_id", paperId);
  await supabaseAdmin
    .from("library_pdf_sections")
    .delete()
    .eq("paper_id", paperId);
}

async function upsertSection(
  paperId: string,
  source: ChunkSource
): Promise<string | null> {
  const sectionTitle = source === "pdf" ? "PDF 全文" : "HTML 全文";
  const { data, error } = await supabaseAdmin
    .from("library_pdf_sections")
    .upsert(
      {
        paper_id: paperId,
        section_level: 1,
        section_title: sectionTitle,
        parent_section_id: null,
        order_index: source === "pdf" ? 0 : 1,
      },
      { onConflict: "paper_id,section_level,section_title" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`セクションの保存に失敗しました: ${error.message}`);
  }

  return data?.id ?? null;
}

async function storeChunks(
  paperId: string,
  chunks: InternalChunk[],
  source: ChunkSource
): Promise<number> {
  if (!chunks.length) return 0;

  const sectionId = await upsertSection(paperId, source);

  const chunkRows = chunks.map((chunk, index) => ({
    paper_id: paperId,
    section_id: sectionId,
    chunk_text: chunk.text,
    chunk_type:
      chunk.chunkType ?? (source === "pdf" ? "pdf_text" : "html_text"),
    order_index: index,
    page_number: chunk.pageNumber,
  }));

  const { data: insertedChunks, error: chunkError } = await supabaseAdmin
    .from("library_pdf_chunks")
    .insert(chunkRows)
    .select("id, chunk_text, order_index");

  if (chunkError) {
    throw new Error(`チャンクの保存に失敗しました: ${chunkError.message}`);
  }

  if (!insertedChunks?.length) {
    return 0;
  }

  const rows = Array.isArray(insertedChunks)
    ? insertedChunks
    : [insertedChunks];
  rows.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const embeddingPayload: any[] = [];
  for (const row of rows) {
    const text = String(row.chunk_text ?? "").trim();
    if (!text) continue;
    try {
      const embedding = await aiProviderManager.generateEmbedding(text);
      embeddingPayload.push({
        chunk_id: row.id,
        paper_id: paperId,
        embedding,
      });
      if (embeddingPayload.length >= EMBEDDING_BATCH_SIZE) {
        const batch = [...embeddingPayload];
        embeddingPayload.length = 0;
        const { error: embeddingError } = await supabaseAdmin
          .from("library_pdf_embeddings")
          .insert(batch);
        if (embeddingError) {
          throw new Error(
            `埋め込みの保存に失敗しました: ${embeddingError.message}`
          );
        }
      }
    } catch (error) {
      console.warn("generateEmbedding failed", error);
    }
  }

  if (embeddingPayload.length > 0) {
    const { error: embeddingError } = await supabaseAdmin
      .from("library_pdf_embeddings")
      .insert(embeddingPayload);
    if (embeddingError) {
      throw new Error(
        `埋め込みの保存に失敗しました: ${embeddingError.message}`
      );
    }
  }

  return rows.length;
}

export async function ingestPaperContent(
  options: IngestOptions
): Promise<IngestSummary> {
  const {
    paperId,
    pdfUrl,
    pdfBuffer,
    htmlUrl,
    fallbackHtml,
    force = false,
  } = options;

  if (!paperId) {
    throw new Error("paperId が指定されていません");
  }

  const { count: existingCount } = await supabaseAdmin
    .from("library_pdf_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("paper_id", paperId);

  if (!force && (existingCount ?? 0) > 0) {
    return {
      pdfChunks: 0,
      htmlChunks: 0,
      totalChunks: existingCount ?? 0,
      skipped: true,
    };
  }

  await clearExistingPaperContent(paperId);

  let resolvedHtml = fallbackHtml ?? null;
  if (!resolvedHtml && htmlUrl) {
    console.log(`Fetching HTML from: ${htmlUrl}`);
    resolvedHtml = await fetchHtmlPlainText(htmlUrl);
    console.log(`HTML fetch result: ${resolvedHtml ? "success" : "failed"}`);
  }

  let resolvedPdf = pdfBuffer ?? null;
  if (!resolvedPdf && pdfUrl) {
    resolvedPdf = await fetchPdfBuffer(pdfUrl);
  }

  if (!resolvedPdf && !resolvedHtml) {
    throw new Error(
      "PDF または HTML を取得できませんでした。URL またはファイルを確認してください。"
    );
  }

  // HTML処理のため、元のHTMLも取得
  const originalHtml = htmlUrl ? await fetchOriginalHtml(htmlUrl) : null;
  const htmlChunks = resolvedHtml
    ? await parseHtmlChunks(resolvedHtml, originalHtml || undefined)
    : [];
  const pdfChunks = resolvedPdf ? await parsePdfChunks(resolvedPdf) : [];

  let htmlStored = 0;
  let pdfStored = 0;

  if (htmlChunks.length > 0) {
    htmlStored = await storeChunks(paperId, htmlChunks, "html");
  }

  if (pdfChunks.length > 0) {
    pdfStored = await storeChunks(paperId, pdfChunks, "pdf");
  }

  return {
    pdfChunks: pdfStored,
    htmlChunks: htmlStored,
    totalChunks: pdfStored + htmlStored,
  };
}

export async function ensurePaperEmbeddings(options: {
  paperId: string;
  htmlUrl?: string | null;
  pdfUrl?: string | null;
  fallbackText?: string;
  force?: boolean;
}) {
  const { paperId, htmlUrl, pdfUrl, fallbackText, force } = options;
  return ingestPaperContent({
    paperId,
    htmlUrl,
    pdfUrl,
    fallbackHtml: fallbackText ?? null,
    force,
  });
}

export function decodePdfBase64(base64?: string | null): Buffer | null {
  const cleaned = normalizeBase64(base64);
  if (!cleaned) return null;
  try {
    return Buffer.from(cleaned, "base64");
  } catch (error) {
    console.warn("decodePdfBase64 failed", error);
    return null;
  }
}
