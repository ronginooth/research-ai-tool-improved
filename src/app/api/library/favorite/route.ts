import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForUser } from "@/lib/api-utils";

// お気に入りを追加/削除
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = "demo-user-123", paperId, isFavorite } = body;

    if (!paperId || typeof isFavorite !== "boolean") {
      return NextResponse.json(
        { error: "論文IDとお気に入り状態が必要です" },
        { status: 400 }
      );
    }

    // ユーザー設定に基づいてSupabaseクライアントを取得
    const { adminClient } = await getSupabaseForUser(request, userId);

    if (!adminClient) {
      return NextResponse.json(
        { error: "データベース接続エラー" },
        { status: 500 }
      );
    }

    // お気に入り状態を更新
    const { data, error } = await adminClient
      .from("user_library")
      .update({ is_favorite: isFavorite })
      .eq("id", paperId)
      .eq("user_id", userId)
      .select();

    if (error) {
      console.error("Database error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Error details:", error.details);
      
      // カラムが存在しない場合のエラーメッセージを追加
      if (error.code === "42703" || error.message?.includes("column") || error.message?.includes("is_favorite")) {
        return NextResponse.json(
          { 
            success: false,
            error: "データベースエラー: is_favoriteカラムが存在しません。マイグレーションを実行してください。",
            details: error.message,
            code: error.code
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { 
          success: false,
          error: "データベースエラーが発生しました",
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    // 更新されたレコードが存在しない場合
    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "論文が見つかりませんでした",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      isFavorite,
      message: isFavorite ? "お気に入りに追加しました" : "お気に入りから削除しました",
    });
  } catch (error) {
    console.error("Favorite toggle error:", error);
    return NextResponse.json(
      { error: "お気に入りの更新に失敗しました" },
      { status: 500 }
    );
  }
}

