import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get("paperId");
    const title = searchParams.get("title");

    if (!paperId && !title) {
      return NextResponse.json(
        { error: "paperId or title parameter is required" },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    // 論文IDまたはタイトルで検索
    let query = supabaseAdmin.from("user_library").select("id, title");

    if (paperId) {
      query = query.eq("id", paperId);
    } else if (title) {
      query = query.ilike("title", `%${title}%`);
    }

    const { data: papers, error: paperError } = await query;

    if (paperError) {
      console.error("Paper fetch error:", paperError);
      return NextResponse.json(
        { error: "Failed to fetch paper", details: paperError },
        { status: 500 }
      );
    }

    if (!papers || papers.length === 0) {
      return NextResponse.json(
        { error: "Paper not found", paperId, title },
        { status: 404 }
      );
    }

    const paper = papers[0];

    // セクション情報を取得
    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("library_pdf_sections")
      .select("*")
      .eq("paper_id", paper.id)
      .order("order_index");

    if (sectionsError) {
      console.error("Sections fetch error:", sectionsError);
    }

    // チャンク情報を取得
    const sectionIds = sections?.map((s) => s.id) || [];
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from("library_pdf_chunks")
      .select("*")
      .in("section_id", sectionIds)
      .order("order_index");

    if (chunksError) {
      console.error("Chunks fetch error:", chunksError);
    }

    // 埋め込み情報を取得
    const chunkIds = chunks?.map((c) => c.id) || [];
    const { data: embeddings, error: embeddingsError } = await supabaseAdmin
      .from("library_pdf_embeddings")
      .select("chunk_id, model, created_at")
      .in("chunk_id", chunkIds);

    if (embeddingsError) {
      console.error("Embeddings fetch error:", embeddingsError);
    }

    // チャンク統計
    const stats = {
      totalSections: sections?.length || 0,
      totalChunks: chunks?.length || 0,
      totalEmbeddings: embeddings?.length || 0,
      chunkTypes: {} as Record<string, number>,
      totalCharacters: 0,
      averageChunkSize: 0,
    };

    if (chunks) {
      chunks.forEach((chunk) => {
        stats.chunkTypes[chunk.chunk_type] =
          (stats.chunkTypes[chunk.chunk_type] || 0) + 1;
        stats.totalCharacters += chunk.char_count || 0;
      });
      stats.averageChunkSize = Math.round(
        stats.totalCharacters / chunks.length
      );
    }

    return NextResponse.json({
      paper: {
        id: paper.id,
        title: paper.title,
      },
      stats,
      sections: sections || [],
      chunks:
        chunks?.map((chunk) => {
          const section = sections?.find((s) => s.id === chunk.section_id);
          return {
            id: chunk.id,
            section_id: chunk.section_id,
            chunk_type: chunk.chunk_type,
            char_count: chunk.char_count,
            order_index: chunk.order_index,
            page_number: section?.page_number,
            section_type: section?.section_type,
            text_preview:
              chunk.chunk_text.length > 200
                ? chunk.chunk_text.slice(0, 200) + "..."
                : chunk.chunk_text,
            full_text: chunk.chunk_text,
            has_embedding: embeddings?.some((e) => e.chunk_id === chunk.id),
          };
        }) || [],
    });
  } catch (error) {
    console.error("Debug chunks error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
