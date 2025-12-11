import { Buffer } from "buffer";
import { aiProviderManager } from "@/lib/ai-provider-manager";
import {
  fetchHtmlPlainText,
  extractHtmlContexts,
  extractFigureCaptions,
} from "@/lib/paper-content";
import { supabaseAdmin } from "@/lib/supabase";
import {
  checkGrobidAvailable,
  processPdfWithGrobid,
  parseGrobidTei,
  convertGrobidToChunks,
} from "@/lib/grobid";

type ChunkSource = "pdf" | "html";

interface IngestOptions {
  paperId: string;
  userId?: string;
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

interface ParsePdfResult {
  chunks: InternalChunk[];
  grobidTeiXml?: string | null;
  grobidData?: any | null;
}

async function parsePdfChunks(pdfData: Buffer): Promise<ParsePdfResult> {
  // 大容量PDFの事前チェック
  const sizeMB = pdfData.length / (1024 * 1024);
  if (sizeMB > 50) {
    console.warn(`[PDF Parse] Large PDF detected (${sizeMB.toFixed(2)}MB). Consider using pdf-parse directly for faster processing.`);
  }
  
  // GROBIDが利用可能な場合は優先的に使用
  const grobidAvailable = await checkGrobidAvailable();
  console.log(`[PDF Parse] GROBID available: ${grobidAvailable}`);
  
  if (grobidAvailable) {
    try {
      console.log("[PDF Parse] Step 1: Using GROBID for PDF parsing...");
      const teiXml = await processPdfWithGrobid(pdfData);
      
      if (!teiXml) {
        console.warn("[PDF Parse] Step 1 failed: GROBID returned no TEI XML, falling back to pdf-parse");
      } else {
        console.log(`[PDF Parse] Step 1 success: GROBID returned TEI XML (${teiXml.length} bytes)`);
        
        console.log("[PDF Parse] Step 2: Parsing TEI XML...");
        const grobidResult = parseGrobidTei(teiXml);
        
        if (!grobidResult) {
          console.warn("[PDF Parse] Step 2 failed: TEI XML parsing failed, falling back to pdf-parse");
        } else if (grobidResult.sections.length === 0) {
          console.warn("[PDF Parse] Step 2 failed: GROBID result has no sections, falling back to pdf-parse");
        } else {
          console.log(`[PDF Parse] Step 2 success: Parsed ${grobidResult.sections.length} sections`);
          
          const grobidChunks = convertGrobidToChunks(
            grobidResult,
            MAX_CHARS_PER_CHUNK
          );
          const chunks: InternalChunk[] = grobidChunks.map((chunk) => ({
            text: chunk.text,
            source: "pdf" as const,
            sectionTitle: chunk.sectionTitle,
            pageNumber: chunk.pageNumber,
            chunkType: chunk.chunkType,
          }));
          console.log(`[PDF Parse] Success: GROBID extracted ${chunks.length} chunks from ${grobidResult.sections.length} sections`);
          return {
            chunks,
            grobidTeiXml: teiXml,
            grobidData: grobidResult,
          };
        }
      }
    } catch (error: any) {
      const errorType = error.code || error.message || "unknown";
      console.error(`[PDF Parse] Step 1/2 error (${errorType}): GROBID processing failed, falling back to pdf-parse:`, error.message || error);
    }
  } else {
    console.log("[PDF Parse] GROBID not available, using pdf-parse directly");
  }

  // フォールバック: pdf-parseを使用した確実な全文抽出
  console.log("[PDF Parse] Using pdf-parse for fallback text extraction");
  try {
    const pdfParse = await import("pdf-parse");
    const pdfInfo = await pdfParse.default(pdfData);
    
    const fullText = pdfInfo.text || "";
    
    if (fullText && fullText.trim().length > 0) {
      console.log(`[PDF Parse] Extracted ${fullText.length} characters from PDF`);
      
      // 全文をチャンクに分割
      const chunks: InternalChunk[] = [];
      const chunkTexts = splitTextIntoChunks(fullText, MAX_CHARS_PER_CHUNK);
      
      chunkTexts.forEach((chunkText, index) => {
        if (!chunkText.trim()) return;
        const chunkType = isFigureCaption(chunkText) ? "figure_pdf" : "pdf_text";
        chunks.push({
          text: chunkText,
          source: "pdf",
          sectionTitle: "Full Text",
          pageNumber: null, // pdf-parseはページ情報も提供可能だが、ここでは簡略化
          chunkType,
        });
      });
      
      console.log(`[PDF Parse] Created ${chunks.length} chunks from full text`);
      return {
        chunks,
        grobidTeiXml: null,
        grobidData: null,
      };
    } else {
      console.warn("[PDF Parse] No text extracted from PDF");
    }
  } catch (error: any) {
    console.error("[PDF Parse] Fallback extraction failed:", error.message || error);
    console.error("[PDF Parse] Error type:", error.code || "unknown");
  }

  // 最終フォールバック: 空のチャンクを返す
  console.warn("[PDF Parse] All extraction methods failed, returning empty chunks");
  return {
    chunks: [],
    grobidTeiXml: null,
    grobidData: null,
  };
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
  if (!supabaseAdmin) {
    return;
  }
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
  if (!supabaseAdmin) {
    return null;
  }
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
  if (!supabaseAdmin) {
    return 0;
  }

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
  if (!supabaseAdmin) {
    throw new Error("Supabase client is not initialized");
  }

  // paperIdはuser_library.id（UUID）として扱う
  // library_pdf_chunksテーブルのpaper_idはuser_library.id（UUID）を参照
  const { count: existingCount } = await supabaseAdmin
    .from("library_pdf_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("paper_id", paperId);

  // GROBIDの出力が既に保存されているかチェック（user_library.id（UUID）で検索）
  const { data: existingLibraryRecord, error: grobidCheckError } = await supabaseAdmin
    .from("user_library")
    .select("id, grobid_processed_at, grobid_tei_xml, grobid_data, paper_id")
    .eq("id", paperId) // user_library.id（UUID）で検索
    .maybeSingle();
  
  if (grobidCheckError) {
    console.error("[GROBID Debug] Failed to check existing GROBID output:", grobidCheckError);
  }

  const hasGrobidOutput = !!(existingLibraryRecord?.grobid_tei_xml || existingLibraryRecord?.grobid_data);
  console.log(`[GROBID Debug] Checking existing GROBID output - hasGrobidOutput: ${hasGrobidOutput}, existingCount: ${existingCount ?? 0}`);

  // 既に埋め込みが存在し、GROBIDの出力も保存されている場合のみスキップ
  if (!force && (existingCount ?? 0) > 0 && hasGrobidOutput) {
    console.log(`[GROBID Debug] Skipping - embeddings exist (${existingCount}) and GROBID output already saved`);
    return {
      pdfChunks: 0,
      htmlChunks: 0,
      totalChunks: existingCount ?? 0,
      skipped: true,
    };
  }

  // GROBIDの出力が保存されていない場合は、PDFを再解析してGROBIDの出力を保存する
  if (!hasGrobidOutput && (pdfBuffer || pdfUrl)) {
    console.log(`[GROBID Debug] GROBID output not found, will process PDF to save GROBID output`);
  }

  await clearExistingPaperContent(paperId);

  let resolvedHtml = fallbackHtml ?? null;
  if (!resolvedHtml && htmlUrl) {
    console.log(`Fetching HTML from: ${htmlUrl}`);
    resolvedHtml = await fetchHtmlPlainText(htmlUrl);
    console.log(`HTML fetch result: ${resolvedHtml ? "success" : "failed"}`);
  }

  let resolvedPdf = pdfBuffer ?? null;
  console.log(`[GROBID Debug] Initial PDF state - pdfBuffer: ${!!pdfBuffer}, pdfUrl: ${pdfUrl || 'null'}`);
  
  if (!resolvedPdf && pdfUrl) {
    console.log(`[GROBID Debug] Fetching PDF from URL: ${pdfUrl}`);
    resolvedPdf = await fetchPdfBuffer(pdfUrl);
    console.log(`[GROBID Debug] PDF fetch result: ${resolvedPdf ? `success (${resolvedPdf.length} bytes)` : 'failed'}`);
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
  
  console.log(`[GROBID Debug] About to parse PDF - resolvedPdf: ${!!resolvedPdf}, resolvedHtml: ${!!resolvedHtml}`);
  
  // GROBIDが利用可能かチェック（エラー保存の判定に使用）
  const grobidAvailable = resolvedPdf ? await checkGrobidAvailable() : false;
  
  const pdfResult = resolvedPdf ? await parsePdfChunks(resolvedPdf) : { chunks: [], grobidTeiXml: null, grobidData: null };
  const pdfChunks = pdfResult.chunks;
  console.log(`[GROBID Debug] PDF parsing completed - chunks: ${pdfChunks.length}, grobidTeiXml: ${!!pdfResult.grobidTeiXml}, grobidData: ${!!pdfResult.grobidData}`);

  // GROBIDの出力をuser_libraryテーブルに保存
  console.log(`[GROBID Debug] paperId: ${paperId}, userId: ${options.userId}`);
  console.log(`[GROBID Debug] grobidTeiXml exists: ${!!pdfResult.grobidTeiXml}, grobidData exists: ${!!pdfResult.grobidData}`);
  console.log(`[GROBID Debug] grobidTeiXml length: ${pdfResult.grobidTeiXml?.length || 0}, grobidData sections: ${pdfResult.grobidData?.sections?.length || 0}`);
  
  // GROBIDが利用可能だったが、出力がない場合（エラー）を保存
  if (grobidAvailable && resolvedPdf && !pdfResult.grobidTeiXml && !pdfResult.grobidData) {
    // GROBID処理が試みられたが失敗した場合、エラーを保存
    const errorMessage = "GROBID処理が失敗しました。フォールバック処理を使用しました。";
    console.warn(`[GROBID Debug] GROBID processing failed, saving error: ${errorMessage}`);
    
    if (supabaseAdmin) {
      try {
        // user_library.id（UUID）で更新
        const { error: updateError } = await supabaseAdmin
          .from("user_library")
          .update({
            grobid_processed_at: new Date().toISOString(),
          })
          .eq("id", paperId); // user_library.id（UUID）で更新
        
        if (updateError) {
          console.error("[GROBID Debug] Failed to save GROBID processed_at:", updateError);
        } else {
          console.log(`[GROBID Debug] GROBID processed_at saved successfully`);
        }
      } catch (error: any) {
        console.error("[GROBID Debug] Failed to save GROBID processed_at:", error);
      }
    }
  }
  
  if (pdfResult.grobidTeiXml || pdfResult.grobidData) {
    if (!supabaseAdmin) {
      console.error("[GROBID Debug] Supabase admin client is not initialized");
      throw new Error("Supabase client is not initialized");
    }
    
    try {
      // user_library.id（UUID）で更新
      const updateData: any = {
        grobid_tei_xml: pdfResult.grobidTeiXml,
        grobid_data: pdfResult.grobidData ? JSON.parse(JSON.stringify(pdfResult.grobidData)) : null,
        grobid_processed_at: new Date().toISOString(),
      };
      
      console.log(`[GROBID Debug] Updating user_library with id (UUID): ${paperId}`);
      
      // user_library.id（UUID）で更新
      const { data, error: grobidUpdateError } = await supabaseAdmin
        .from("user_library")
        .update(updateData)
        .eq("id", paperId) // user_library.id（UUID）で更新
        .select();
      
      if (grobidUpdateError) {
        console.error("[GROBID Debug] Failed to save GROBID output:", grobidUpdateError);
        console.error("[GROBID Debug] Error details:", JSON.stringify(grobidUpdateError, null, 2));
        console.error("[GROBID Debug] Error code:", grobidUpdateError.code);
        console.error("[GROBID Debug] Error message:", grobidUpdateError.message);
      } else {
        console.log(`[GROBID Debug] GROBID output saved successfully. Updated rows: ${data?.length || 0}`);
        if (data && data.length > 0) {
          console.log(`[GROBID Debug] Updated record id: ${data[0]?.id}, paperId: ${data[0]?.paper_id}, userId: ${data[0]?.user_id}`);
          console.log(`[GROBID Debug] grobid_tei_xml saved: ${!!data[0]?.grobid_tei_xml}, grobid_data saved: ${!!data[0]?.grobid_data}`);
        } else {
          console.warn(`[GROBID Debug] No rows updated. Check if libraryId (${paperId}) matches existing records.`);
          console.warn(`[GROBID Debug] Existing library record: ${JSON.stringify(existingLibraryRecord)}`);
        }
      }
    } catch (error: any) {
      console.error("[GROBID Debug] Exception while saving GROBID output:", error);
      console.error("[GROBID Debug] Error stack:", error?.stack);
      console.error("[GROBID Debug] Error message:", error?.message);
    }
  } else {
    console.log("[GROBID Debug] No GROBID output to save (grobidTeiXml and grobidData are both null)");
  }

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
