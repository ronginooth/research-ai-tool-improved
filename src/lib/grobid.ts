/**
 * GROBID API クライアント
 * PDFをGROBIDサーバーに送信して構造化テキストを取得
 */

import axios from "axios";
import * as cheerio from "cheerio";

const GROBID_BASE_URL =
  process.env.GROBID_BASE_URL || "http://localhost:8070";

export interface GrobidSection {
  title: string | null;
  paragraphs: string[];
  subsections?: GrobidSection[];
}

export interface GrobidFigure {
  id?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  pageNumber?: number | null;
}

export interface GrobidResult {
  title: string | null;
  authors: string[];
  abstract: string | null;
  sections: GrobidSection[];
  references: string[];
  figures: GrobidFigure[];
}

/**
 * GROBIDサーバーが利用可能かチェック
 */
export async function checkGrobidAvailable(): Promise<boolean> {
  try {
    const response = await axios.get(`${GROBID_BASE_URL}/api/isalive`, {
      timeout: 5000, // 5秒でタイムアウト
    });
    return response.status === 200;
  } catch (error: any) {
    const errorType = error.code === "ECONNREFUSED" ? "connection fail" 
                     : error.code === "ETIMEDOUT" ? "timeout"
                     : "unknown";
    console.warn(`[GROBID] Server check failed (${errorType}):`, error.message);
    return false;
  }
}

/**
 * PDFをGROBIDに送信してTEI/XMLを取得
 * axiosを使用してストリーム処理を簡素化
 */
export async function processPdfWithGrobid(
  pdfBuffer: Buffer
): Promise<string | null> {
  try {
    console.log("[GROBID] Sending PDF to GROBID, size:", pdfBuffer.length, "bytes");
    
    // 大容量PDFの事前チェック（50MB超は警告）
    const sizeMB = pdfBuffer.length / (1024 * 1024);
    if (sizeMB > 50) {
      console.warn(`[GROBID] Large PDF detected (${sizeMB.toFixed(2)}MB). Processing may take longer.`);
    }

    // FormDataを使用（Node.js環境ではform-dataパッケージが必要）
    const FormDataModule = await import("form-data");
    const FormDataClass = FormDataModule.default || FormDataModule;
    const formData = new FormDataClass();
    formData.append("input", pdfBuffer, {
      filename: "document.pdf",
      contentType: "application/pdf",
    });
    formData.append("consolidateHeader", "1");

    console.log(`[GROBID] Sending request to: ${GROBID_BASE_URL}/api/processFulltextDocument`);
    
    const response = await axios.post(
      `${GROBID_BASE_URL}/api/processFulltextDocument`,
      formData,
      {
        timeout: 300000, // 5分（300秒）に延長（大容量PDFに対応）
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: formData.getHeaders(),
      }
    );

    console.log(`[GROBID] Response status: ${response.status}`);
    
    if (response.status !== 200) {
      console.error(`[GROBID] API error: status ${response.status}`);
      return null;
    }

    const teiXml = response.data;
    console.log(`[GROBID] TEI XML received, length: ${teiXml?.length || 0} bytes`);
    
    if (!teiXml || typeof teiXml !== "string" || teiXml.trim().length === 0) {
      console.error("[GROBID] Error: empty response");
      return null;
    }
    
    console.log(`[GROBID] TEI XML preview (first 500 chars): ${teiXml.substring(0, 500)}`);
    return teiXml;
  } catch (error: any) {
    const errorType = error.code === "ECONNREFUSED" ? "connection fail"
                     : error.code === "ETIMEDOUT" || error.message?.includes("timeout") ? "timeout"
                     : error.response?.status ? `api error (${error.response.status})`
                     : "unknown";
    console.error(`[GROBID] Processing failed (${errorType}):`, error.message || error);
    if (error.response?.data) {
      console.error(`[GROBID] Error response:`, String(error.response.data).substring(0, 500));
    }
    return null;
  }
}

/**
 * TEI/XMLをパースして構造化データを取得
 * cheerioを使用してXMLパースを改善
 */
export function parseGrobidTei(teiXml: string): GrobidResult | null {
  try {
    console.log(`[GROBID] Parsing TEI XML, length: ${teiXml.length} bytes`);
    
    // cheerioでXMLをパース（xmlMode: trueでXMLとして扱う）
    const $ = cheerio.load(teiXml, { 
      xmlMode: true,
      decodeEntities: false,
    });

    // タイトルを抽出
    const title = $('title[level="a"][type="main"]').first().text().trim() || null;
    if (!title) {
      // フォールバック: type="main"がない場合
      const altTitle = $('title[level="a"]').first().text().trim() || null;
      if (altTitle) {
        console.log(`[GROBID] Using alternative title format`);
      }
    }
    console.log(`[GROBID] Parsed title: ${title || 'not found'}`);

    // 著者情報を抽出
    const authors: string[] = [];
    $('author').each((i, elem) => {
      const forename = $(elem).find('forename').first().text().trim();
      const surname = $(elem).find('surname').first().text().trim();
      if (forename || surname) {
        authors.push(`${forename} ${surname}`.trim());
      }
    });
    console.log(`[GROBID] Parsed authors: ${authors.length}`);

    // Abstractを抽出
    const abstract = $('abstract').first().text().trim().replace(/\s+/g, " ") || null;
    console.log(`[GROBID] Parsed abstract: ${abstract ? `${abstract.length} chars` : 'not found'}`);

    // 本文のセクションを抽出
    const sections: GrobidSection[] = [];
    const body = $('body').first();
    
    if (body.length > 0) {
      // セクション（div[type="section"]）を抽出
      $('div[type="section"]', body).each((i, elem) => {
        const sectionTitle = $(elem).find('head').first().text().trim() || null;
        const paragraphs: string[] = [];
        
        $(elem).find('p').each((j, pElem) => {
          const pText = $(pElem).text().trim().replace(/\s+/g, " ");
          if (pText.length > 10) {
            paragraphs.push(pText);
          }
        });

        if (paragraphs.length > 0) {
          sections.push({
            title: sectionTitle,
            paragraphs,
          });
        }
      });

      // セクションが見つからない場合は、すべての段落を1つのセクションとして扱う
      if (sections.length === 0) {
        const allParagraphs: string[] = [];
        $('p', body).each((j, pElem) => {
          const pText = $(pElem).text().trim().replace(/\s+/g, " ");
          if (pText.length > 10) {
            allParagraphs.push(pText);
          }
        });
        if (allParagraphs.length > 0) {
          sections.push({
            title: "Main Content",
            paragraphs: allParagraphs,
          });
          console.log(`[GROBID] No sections found, using all paragraphs as single section`);
        }
      }
    }

    // 参考文献を抽出
    const references: string[] = [];
    $('biblStruct').each((i, elem) => {
      const refTitle = $(elem).find('title').first().text().trim();
      if (refTitle) {
        references.push(refTitle);
      }
    });

    // 図表（figures）を抽出
    const figures: GrobidFigure[] = [];
    $('figure').each((i, elem) => {
      const figureId = $(elem).attr('xml:id') || $(elem).attr('id') || `figure-${i + 1}`;
      const figureTitle = $(elem).find('head').first().text().trim() || null;
      const figureDesc = $(elem).find('figDesc').first().text().trim() || null;
      
      // ページ番号を抽出（可能な場合）
      // GROBIDのTEI/XMLでは、ページ番号は通常pb要素や@n属性で表現される
      let pageNumber: number | null = null;
      const pbElement = $(elem).closest('div').find('pb').first();
      if (pbElement.length > 0) {
        const nAttr = pbElement.attr('n');
        if (nAttr) {
          const parsed = parseInt(nAttr, 10);
          if (!isNaN(parsed)) {
            pageNumber = parsed;
          }
        }
      }
      
      // 図表の説明を結合
      const description = figureDesc || figureTitle || null;
      
      if (figureTitle || figureDesc) {
        figures.push({
          id: figureId,
          title: figureTitle,
          caption: figureDesc,
          description: description,
          pageNumber: pageNumber,
        });
      }
    });
    
    console.log(`[GROBID] Parsed figures: ${figures.length}`);

    const result = {
      title,
      authors,
      abstract,
      sections,
      references,
      figures,
    };
    
    console.log(`[GROBID] Parsed result - title: ${!!title}, authors: ${authors.length}, abstract: ${!!abstract}, sections: ${sections.length}, references: ${references.length}, figures: ${figures.length}`);
    
    return result;
  } catch (error: any) {
    console.error("[GROBID] Parse error:", error.message || error);
    console.error("[GROBID] Error stack:", error?.stack);
    return null;
  }
}

/**
 * GROBID結果をチャンク形式に変換
 */
export function convertGrobidToChunks(
  grobidResult: GrobidResult,
  maxCharsPerChunk: number = 1500
): Array<{
  text: string;
  sectionTitle: string | null;
  pageNumber: number | null;
  chunkType: string;
}> {
  const chunks: Array<{
    text: string;
    sectionTitle: string | null;
    pageNumber: number | null;
    chunkType: string;
  }> = [];

  // Abstractをチャンク化
  if (grobidResult.abstract) {
    const abstractChunks = splitTextIntoChunks(
      grobidResult.abstract,
      maxCharsPerChunk
    );
    abstractChunks.forEach((chunk) => {
      chunks.push({
        text: chunk,
        sectionTitle: "Abstract",
        pageNumber: null,
        chunkType: "abstract",
      });
    });
  }

  // セクションごとにチャンク化
  grobidResult.sections.forEach((section) => {
    section.paragraphs.forEach((paragraph) => {
      const paragraphChunks = splitTextIntoChunks(
        paragraph,
        maxCharsPerChunk
      );
      paragraphChunks.forEach((chunk) => {
        chunks.push({
          text: chunk,
          sectionTitle: section.title,
          pageNumber: null,
          chunkType: "section_text",
        });
      });
    });
  });

  return chunks;
}

/**
 * テキストをチャンクに分割（既存のロジックを再利用）
 */
function splitTextIntoChunks(
  text: string,
  maxChars: number
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

