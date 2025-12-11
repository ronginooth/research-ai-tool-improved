import { NextRequest, NextResponse } from "next/server";
import { decodePdfBase64, ingestPaperContent } from "@/lib/paper-ingest";

const DEFAULT_USER = "demo-user-123";

interface ProcessRequestBody {
  paperId?: string;
  userId?: string;
  pdfUrl?: string | null;
  htmlUrl?: string | null;
  pdfBase64?: string | null;
  fallbackHtml?: string | null;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProcessRequestBody;
    const paperId = body.paperId?.trim();
    const userId = body.userId?.trim() || DEFAULT_USER;

    if (!paperId) {
      return NextResponse.json(
        { error: "paperId は必須です" },
        { status: 400 }
      );
    }

    const pdfBuffer = decodePdfBase64(body.pdfBase64 ?? null);
    
    console.log(`[GROBID Debug] /api/library/process called - paperId: ${paperId}, userId: ${userId}`);
    console.log(`[GROBID Debug] Request body - pdfUrl: ${body.pdfUrl || 'null'}, htmlUrl: ${body.htmlUrl || 'null'}, pdfBase64: ${body.pdfBase64 ? `exists (${body.pdfBase64.length} chars)` : 'null'}`);
    console.log(`[GROBID Debug] Decoded PDF buffer: ${pdfBuffer ? `exists (${pdfBuffer.length} bytes)` : 'null'}`);

    const summary = await ingestPaperContent({
      paperId,
      userId,
      pdfUrl: body.pdfUrl ?? null,
      htmlUrl: body.htmlUrl ?? null,
      pdfBuffer: pdfBuffer ?? undefined,
      fallbackHtml: body.fallbackHtml ?? null,
      force: body.force ?? false,
    });
    
    console.log(`[GROBID Debug] ingestPaperContent completed - pdfChunks: ${summary.pdfChunks}, htmlChunks: ${summary.htmlChunks}, totalChunks: ${summary.totalChunks}`);

    return NextResponse.json({
      success: true,
      paperId,
      userId,
      summary,
    });
  } catch (error: any) {
    console.error("Library process error", error);
    return NextResponse.json(
      { error: error?.message || "GROBID解析に失敗しました" },
      { status: 500 }
    );
  }
}
