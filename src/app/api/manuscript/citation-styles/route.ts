import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";
import {
  getAvailableStyles,
  getStyleById,
  getDefaultStyle,
} from "@/lib/manuscript/citation-styles";
import { StyleImporter } from "@/lib/manuscript/citation-styles/style-importer";
import { CitationStyle } from "@/lib/manuscript/citation-styles/types";

const DEFAULT_USER = "demo-user-123";

/**
 * 利用可能なスタイル一覧を取得
 * 優先度: DB > ローカルJSON > フォールバック
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER;

    const { adminClient } = await getSupabaseForUser(request, userId);
    if (!adminClient) {
      // Supabaseが利用できない場合はシステムスタイルのみ返す
      return NextResponse.json({
        styles: getAvailableStyles(),
      });
    }

    // DBからユーザーカスタムスタイルを取得
    const { data: dbStyles, error: dbError } = await adminClient
      .from("citation_styles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("Failed to fetch custom styles from DB:", dbError);
      // DBエラーがあってもシステムスタイルは返す
    }

    // システムスタイルを取得
    const systemStyles = getAvailableStyles();

    // DBスタイルをCitationStyle形式に変換
    const customStyles: CitationStyle[] =
      dbStyles?.map((s: any) => s.style_json) || [];

    // システムスタイルとカスタムスタイルを結合
    const allStyles = [...systemStyles, ...customStyles];

    return NextResponse.json({
      styles: allStyles,
    });
  } catch (error: any) {
    console.error("Failed to fetch citation styles:", error);
    return NextResponse.json(
      { error: error?.message || "スタイルの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * カスタムスタイルを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER;
    const styleData = body.style;

    if (!styleData || !styleData.id || !styleData.name) {
      return NextResponse.json(
        { error: "スタイルデータが必要です" },
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

    // スタイルをDBに保存
    const { data, error } = await adminClient
      .from("citation_styles")
      .insert({
        user_id: userId,
        name: styleData.id,
        display_name: styleData.displayName || styleData.name,
        style_json: styleData,
        is_system: false,
        source_type: "user",
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
            display_name: styleData.displayName || styleData.name,
            style_json: styleData,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("name", styleData.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return NextResponse.json({ style: updated.style_json });
      }
      throw error;
    }

    return NextResponse.json({ style: data.style_json });
  } catch (error: any) {
    console.error("Failed to save citation style:", error);
    return NextResponse.json(
      { error: error?.message || "スタイルの保存に失敗しました" },
      { status: 500 }
    );
  }
}



