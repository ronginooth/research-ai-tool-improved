import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { parseWorksheet, structureToJson } from "@/lib/manuscript/worksheet-parser";
import { parseCsvWorksheet } from "@/lib/manuscript/csv-worksheet-parser";

const DEFAULT_USER = "demo-user-123";

/**
 * ワークシートファイルアップロード
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = (formData.get("userId") as string) || DEFAULT_USER;
    const title = (formData.get("title") as string) || file.name.replace(/\.md$/, "");

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが指定されていません" },
        { status: 400 }
      );
    }

    // ファイルを読み込む
    const content = await file.text();
    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv");

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      console.error("[Worksheet Upload] Supabase admin client is not initialized");
      return NextResponse.json(
        { 
          error: "Supabase client is not initialized",
          details: "環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定されているか確認してください"
        },
        { status: 500 }
      );
    }

    // ワークシートを解析（CSV形式またはMarkdown形式）
    let structure = null;
    let parsed: any = null;
    try {
      if (isCsv) {
        console.log("[Worksheet Upload] Parsing CSV format");
        parsed = parseCsvWorksheet(content, title);
      } else {
        console.log("[Worksheet Upload] Parsing Markdown format");
        parsed = parseWorksheet(content);
      }
      structure = structureToJson(parsed);
      console.log(`[Worksheet Upload] Parsed ${parsed.paragraphs.length} paragraphs`);
      console.log(`[Worksheet Upload] Sections: intro=${parsed.sections.introduction.length}, methods=${parsed.sections.methods.length}, results=${parsed.sections.results.length}, discussion=${parsed.sections.discussion.length}`);
    } catch (parseError) {
      console.error("[Worksheet Upload] Worksheet parsing error:", parseError);
      console.error("[Worksheet Upload] Parse error stack:", (parseError as Error)?.stack);
      // パースエラーがあってもワークシートは作成する
    }

    // ワークシートを保存
    const { data: worksheet, error: worksheetError } = await adminClient
      .from("manuscript_worksheets")
      .insert({
        user_id: userId,
        title,
        content,
        structure,
      })
      .select()
      .single();

    if (worksheetError) {
      console.error("[Worksheet Upload] Database error:", worksheetError);
      // テーブルが存在しない場合のエラーメッセージを改善
      if (worksheetError.code === "PGRST116" || worksheetError.code === "42P01") {
        return NextResponse.json(
          { 
            error: "データベーステーブルが見つかりません",
            details: "SupabaseのSQL Editorで database/migrations/add_manuscript_tables.sql を実行してください",
            code: worksheetError.code
          },
          { status: 500 }
        );
      }
      throw worksheetError;
    }

    // パラグラフが解析された場合は、パラグラフレコードも作成
    if (structure && structure.paragraphs && structure.paragraphs.length > 0 && parsed) {
      const paragraphInserts = parsed.paragraphs.map((p) => ({
        worksheet_id: worksheet.id,
        paragraph_number: p.paragraphNumber,
        section_type: p.sectionType,
        title: p.title,
        description: p.description,
        status: "pending",
        word_count: 0,
      }));

      console.log(`[Worksheet Upload] Inserting ${paragraphInserts.length} paragraphs`);
      
      if (paragraphInserts.length > 0) {
        const { data: insertedParagraphs, error: paraError } = await adminClient
          .from("manuscript_paragraphs")
          .insert(paragraphInserts)
          .select();

        if (paraError) {
          console.error("[Worksheet Upload] Paragraph insert error:", paraError);
          console.error("[Worksheet Upload] Paragraph insert error details:", JSON.stringify(paraError, null, 2));
          // エラーがあってもワークシートは作成済みなので続行
        } else {
          console.log(`[Worksheet Upload] Successfully inserted ${insertedParagraphs?.length || 0} paragraphs`);
        }
      }
    } else {
      console.warn("[Worksheet Upload] No paragraphs found in structure. Structure:", JSON.stringify(structure, null, 2));
    }

    return NextResponse.json({
      success: true,
      worksheet,
      parsed: structure !== null,
    });
  } catch (error: any) {
    console.error("[Worksheet Upload] Error:", error);
    console.error("[Worksheet Upload] Error stack:", error?.stack);
    return NextResponse.json(
      { 
        error: error?.message || "ワークシートのアップロードに失敗しました",
        details: error?.details || error?.code || "不明なエラーが発生しました",
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

