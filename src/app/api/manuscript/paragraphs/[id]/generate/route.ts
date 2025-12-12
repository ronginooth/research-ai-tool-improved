import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { generateParagraphContent, enhanceParagraphContent } from "@/lib/manuscript/paragraph-generator";

const DEFAULT_USER = "demo-user-123";

/**
 * パラグラフの文章をAI生成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const { id } = await params;
    const paragraphId = id;
    const {
      includeExistingContent = false,
      targetWordCount,
      citationStyle = "apa",
      language = "en",
    } = body;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    console.log(`[Paragraph Generate] Starting generation for paragraph ${paragraphId}, userId: ${userId}`);

    // パラグラフ情報を取得（JOINを使わずに直接取得）
    const { data: paragraph, error: paraError } = await adminClient
      .from("manuscript_paragraphs")
      .select("*")
      .eq("id", paragraphId)
      .single();

    if (paraError) {
      console.error("[Paragraph Generate] Paragraph fetch error:", paraError);
      throw paraError;
    }

    if (!paragraph) {
      return NextResponse.json(
        { error: "パラグラフが見つかりません" },
        { status: 404 }
      );
    }

    // ワークシートの所有者を確認
    const { data: worksheet, error: worksheetError } = await adminClient
      .from("manuscript_worksheets")
      .select("user_id")
      .eq("id", paragraph.worksheet_id)
      .eq("user_id", userId)
      .single();

    if (worksheetError || !worksheet) {
      console.error("[Paragraph Generate] Worksheet check error:", worksheetError);
      return NextResponse.json(
        { error: "ワークシートが見つかりません" },
        { status: 404 }
      );
    }

    console.log(`[Paragraph Generate] Paragraph found: ${paragraph.title}`);

    // 引用論文を取得（JOINを使わずに直接取得）
    const { data: citations, error: citError } = await adminClient
      .from("paragraph_citations")
      .select("*")
      .eq("paragraph_id", paragraphId)
      .order("citation_order", { ascending: true });

    if (citError) {
      console.error("[Paragraph Generate] Citations fetch error:", citError);
      throw citError;
    }

    console.log(`[Paragraph Generate] Found ${citations?.length || 0} citations`);

    // 引用がない場合でも生成可能（トピックセンテンスのみで生成）
    const hasCitations = citations && citations.length > 0;

    // 引用論文の詳細情報を取得（abstractも含める）
    let citationData: any[] = [];
    if (hasCitations) {
      const paperIds = citations.map((c: any) => c.paper_id);
      const { data: papers, error: papersError } = await adminClient
        .from("user_library")
        .select("id, title, authors, year, venue, abstract, grobid_data")
        .in("id", paperIds);

      if (papersError) {
        console.error("[Paragraph Generate] Papers fetch error:", papersError);
        throw papersError;
      }

      const papersMap = new Map(papers?.map((p: any) => [p.id, p]) || []);

      // 引用情報を整形（abstractとGROBIDデータも含める）
      citationData = citations.map((c: any) => {
        const paper = papersMap.get(c.paper_id);
        const grobidData = paper?.grobid_data as any;
        return {
          title: paper?.title || "Unknown",
          authors: paper?.authors || "Unknown",
          year: paper?.year || new Date().getFullYear(),
          venue: paper?.venue || undefined,
          abstract: paper?.abstract || grobidData?.abstract || undefined,
          context: c.citation_context || undefined,
          keyPoints: grobidData?.keyFindings || undefined,
        };
      });
    }

    console.log(`[Paragraph Generate] Citation data prepared: ${citationData.length} citations`);

    console.log(`[Paragraph Generate] Starting AI generation...`);

    // 前後のパラグラフを取得（文脈として使用）
    const currentParagraphNum = parseInt(paragraph.paragraph_number.replace("P", "")) || 0;
    
    // 前のパラグラフ（最大2つ）
    const { data: previousParagraphs, error: prevError } = await adminClient
      .from("manuscript_paragraphs")
      .select("paragraph_number, title, description, content, section_type")
      .eq("worksheet_id", paragraph.worksheet_id)
      .neq("id", paragraphId)
      .order("paragraph_number", { ascending: false });

    // 後のパラグラフ（最大2つ）
    const { data: nextParagraphs, error: nextError } = await adminClient
      .from("manuscript_paragraphs")
      .select("paragraph_number, title, description, content, section_type")
      .eq("worksheet_id", paragraph.worksheet_id)
      .neq("id", paragraphId)
      .order("paragraph_number", { ascending: true });

    if (prevError) {
      console.warn("[Paragraph Generate] Failed to fetch previous paragraphs:", prevError);
    }
    if (nextError) {
      console.warn("[Paragraph Generate] Failed to fetch next paragraphs:", nextError);
    }

    // 前後のパラグラフを数値でソートして取得
    const allParagraphs = [
      ...(previousParagraphs || []),
      ...(nextParagraphs || [])
    ].filter((p) => {
      const num = parseInt(p.paragraph_number.replace("P", "")) || 0;
      return num !== currentParagraphNum;
    });

    // 数値でソート
    allParagraphs.sort((a, b) => {
      const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
      const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
      return numA - numB;
    });

    // 現在のパラグラフの前後を特定
    const contextParagraphs: any[] = [];
    for (const p of allParagraphs) {
      const num = parseInt(p.paragraph_number.replace("P", "")) || 0;
      if (num < currentParagraphNum) {
        // 前のパラグラフ（最大2つ、近いものから）
        if (contextParagraphs.filter(p => parseInt(p.paragraph_number.replace("P", "")) < currentParagraphNum).length < 2) {
          contextParagraphs.push(p);
        }
      } else if (num > currentParagraphNum) {
        // 後のパラグラフ（最大2つ、近いものから）
        if (contextParagraphs.filter(p => parseInt(p.paragraph_number.replace("P", "")) > currentParagraphNum).length < 2) {
          contextParagraphs.push(p);
        }
      }
    }

    // 前後のパラグラフを順序付きで整理
    contextParagraphs.sort((a, b) => {
      const numA = parseInt(a.paragraph_number.replace("P", "")) || 0;
      const numB = parseInt(b.paragraph_number.replace("P", "")) || 0;
      return numA - numB;
    });

    console.log(`[Paragraph Generate] Context paragraphs: ${contextParagraphs.length} (before: ${contextParagraphs.filter(p => parseInt(p.paragraph_number.replace("P", "")) < currentParagraphNum).length}, after: ${contextParagraphs.filter(p => parseInt(p.paragraph_number.replace("P", "")) > currentParagraphNum).length})`);

    // 関連パラグラフ（同じセクション内の他のパラグラフ、最大3つ）
    const { data: relatedParagraphs, error: relatedError } = await adminClient
      .from("manuscript_paragraphs")
      .select("paragraph_number, title, description, content, section_type")
      .eq("worksheet_id", paragraph.worksheet_id)
      .eq("section_type", paragraph.section_type)
      .neq("id", paragraphId)
      .order("paragraph_number", { ascending: true })
      .limit(3);

    if (relatedError) {
      console.warn("[Paragraph Generate] Failed to fetch related paragraphs:", relatedError);
    }

    let generatedContent: string;

    try {
      if (includeExistingContent && paragraph.content) {
        // 既存の文章を補完
        console.log(`[Paragraph Generate] Enhancing existing content`);
        generatedContent = await enhanceParagraphContent(
          paragraph.content,
          citationData,
          paragraph.section_type as "introduction" | "methods" | "results" | "discussion" | undefined
        );
      } else {
        // 新規生成
        console.log(`[Paragraph Generate] Generating new content`);
        generatedContent = await generateParagraphContent({
          paragraphTitle: paragraph.title,
          paragraphDescription: paragraph.description || "",
          existingContent: includeExistingContent ? paragraph.content : undefined,
          citations: citationData,
          citationStyle,
          targetWordCount,
          language,
          sectionType: paragraph.section_type as "introduction" | "methods" | "results" | "discussion" | undefined,
          contextParagraphs: contextParagraphs.map((p: any) => ({
            paragraphNumber: p.paragraph_number,
            title: p.title,
            description: p.description || "",
            content: p.content || undefined,
            sectionType: p.section_type,
            isBefore: (parseInt(p.paragraph_number.replace("P", "")) || 0) < currentParagraphNum,
          })),
          relatedParagraphs: relatedParagraphs?.map((p: any) => ({
            paragraphNumber: p.paragraph_number,
            title: p.title,
            description: p.description || "",
            content: p.content || undefined,
            sectionType: p.section_type,
          })) || [],
        });
      }
      console.log(`[Paragraph Generate] Generated content length: ${generatedContent.length} characters`);
    } catch (genError: any) {
      console.error("[Paragraph Generate] AI generation error:", genError);
      console.error("[Paragraph Generate] Error stack:", genError?.stack);
      throw new Error(`AI生成エラー: ${genError?.message || "不明なエラー"}`);
    }

    // 生成された内容をパラグラフに保存
    const wordCount = generatedContent.split(/\s+/).filter((w) => w.length > 0).length;
    const { data: updatedParagraph, error: updateError } = await adminClient
      .from("manuscript_paragraphs")
      .update({
        content: generatedContent,
        word_count: wordCount,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paragraphId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      content: generatedContent,
      paragraph: updatedParagraph,
    });
  } catch (error: any) {
    console.error("Paragraph generation error:", error);
    return NextResponse.json(
      { error: error?.message || "文章生成に失敗しました" },
      { status: 500 }
    );
  }
}

