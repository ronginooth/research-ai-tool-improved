import { NextRequest } from "next/server";
import { getSupabaseAdminClient, getSupabaseClient } from "./supabase-client";
import { getUserSettings, getUserSupabaseConfig } from "./user-settings";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * APIルートでユーザーIDとユーザー設定からSupabaseクライアントを取得
 */
export async function getSupabaseForUser(
  request: NextRequest,
  userId?: string
): Promise<{
  client: SupabaseClient | null;
  adminClient: SupabaseClient | null;
  userId: string;
}> {
  // userIdを取得（クエリパラメータまたはリクエストボディから）
  const { searchParams } = new URL(request.url);
  const queryUserId = searchParams.get("userId");
  const finalUserId = userId || queryUserId || "demo-user-123";

  // ユーザー設定を取得（デフォルトのSupabaseAdminを使用）
  // 注意: この時点ではまだユーザー設定が分からないため、デフォルトのSupabaseを使用
  const { supabaseAdmin } = await import("./supabase-client");
  const settings = await getUserSettings(finalUserId, supabaseAdmin);
  const userConfig = getUserSupabaseConfig(settings);

  // Supabaseクライアントを取得
  const client = await getSupabaseClient(finalUserId, userConfig);
  const adminClient = await getSupabaseAdminClient(finalUserId, userConfig);

  return {
    client,
    adminClient,
    userId: finalUserId,
  };
}
