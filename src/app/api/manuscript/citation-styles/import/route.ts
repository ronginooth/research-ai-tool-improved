import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import { StyleImporter } from "@/lib/manuscript/citation-styles/style-importer";
import { CitationStyle } from "@/lib/manuscript/citation-styles/types";

const DEFAULT_USER = "demo-user-123";

/**
 * JSONファイルまたはURLからスタイルをインポート
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const { jsonData, url, formData } = body;

    if (!jsonData && !url && !formData) {
      return NextResponse.json(
        { error: "jsonData, url, または formData が必要です" },
        { status: 400 }
      );
    }

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase client is not initialized" },
        { status: 500 }
      );
    }

    const importer = new StyleImporter();
    let style: CitationStyle;

    // インポート方法に応じて処理
    if (jsonData) {
      style = await importer.importFromJSON(jsonData);
    } else if (url) {
      style = await importer.importFromURL(url);
    } else if (formData) {
      style = await importer.importFromUI(formData);
    } else {
      return NextResponse.json(
        { error: "インポート方法が指定されていません" },
        { status: 400 }
      );
    }

    // スタイルをDBに保存
    const { data, error } = await adminClient
      .from("citation_styles")
      .insert({
        user_id: userId,
        name: style.id,
        display_name: style.displayName,
        style_json: style,
        is_system: false,
        source_type: url ? "url" : jsonData ? "imported" : "user",
        source_url: url || null,
      })
      .select()
      .single();

    if (error) {
      // 既に存在する場合は更新
      if (error.code === "23505") {
        // unique constraint violation
        const { data: updated, error: updateError } = await adminClient
          .from("citation_styles")
          .update({
            display_name: style.displayName,
            style_json: style,
            source_type: url ? "url" : jsonData ? "imported" : "user",
            source_url: url || null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("name", style.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return NextResponse.json({ style: updated.style_json });
      }
      throw error;
    }

    return NextResponse.json({ style: data.style_json });
  } catch (error: any) {
    console.error("Failed to import citation style:", error);
    return NextResponse.json(
      { error: error?.message || "スタイルのインポートに失敗しました" },
      { status: 500 }
    );
  }
}



