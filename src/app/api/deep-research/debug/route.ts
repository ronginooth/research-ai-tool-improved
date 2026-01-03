import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Deep Research機能のデバッグ用エンドポイント
 * テーブルの存在確認と環境変数の確認を行います
 */
export async function GET(request: NextRequest) {
  try {
    const checks: Record<string, any> = {};

    // 1. 環境変数の確認
    checks.environment = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseAdminAvailable: !!supabaseAdmin,
    };

    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        checks,
        error: "Supabase admin client is not available. Check environment variables.",
      });
    }

    // 2. テーブルの存在確認
    const tables = [
      "deep_research_sessions",
      "deep_research_papers",
      "review_selected_papers",
    ];

    checks.tables = {};
    for (const tableName of tables) {
      try {
        // テーブルが存在するか確認（SELECT 1で確認）
        const { error } = await supabaseAdmin
          .from(tableName)
          .select("id")
          .limit(1);

        if (error) {
          // エラーコードでテーブルの存在を判定
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            checks.tables[tableName] = {
              exists: false,
              error: error.message,
              code: error.code,
            };
          } else {
            // テーブルは存在するが、他のエラー（RLSなど）
            checks.tables[tableName] = {
              exists: true,
              error: error.message,
              code: error.code,
            };
          }
        } else {
          checks.tables[tableName] = {
            exists: true,
            error: null,
          };
        }
      } catch (err) {
        checks.tables[tableName] = {
          exists: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    // 3. reviewsテーブルのカラム確認
    try {
      const { data, error } = await supabaseAdmin
        .from("reviews")
        .select("deep_research_session_id, selected_paper_count, total_papers_count")
        .limit(1);

      if (error) {
        if (error.code === "42703" || error.message?.includes("column")) {
          checks.reviewsColumns = {
            deep_research_session_id: false,
            selected_paper_count: false,
            total_papers_count: false,
            error: error.message,
          };
        } else {
          checks.reviewsColumns = {
            deep_research_session_id: true,
            selected_paper_count: true,
            total_papers_count: true,
            error: error.message,
          };
        }
      } else {
        checks.reviewsColumns = {
          deep_research_session_id: true,
          selected_paper_count: true,
          total_papers_count: true,
          error: null,
        };
      }
    } catch (err) {
      checks.reviewsColumns = {
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }

    // 4. テスト挿入（オプション）
    const testInsert = request.nextUrl.searchParams.get("testInsert") === "true";
    if (testInsert) {
      try {
        const { data, error } = await supabaseAdmin
          .from("deep_research_sessions")
          .insert({
            user_id: "test-user",
            query: "test query",
            status: "searching",
            search_sources: ["semantic_scholar"],
            total_papers: 0,
          })
          .select()
          .single();

        if (error) {
          checks.testInsert = {
            success: false,
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          };
        } else {
          checks.testInsert = {
            success: true,
            sessionId: data?.id,
          };
          // テストデータを削除
          await supabaseAdmin
            .from("deep_research_sessions")
            .delete()
            .eq("id", data.id);
        }
      } catch (err) {
        checks.testInsert = {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    return NextResponse.json({
      success: true,
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}



