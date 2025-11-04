import { createClient, SupabaseClient } from "@supabase/supabase-js";

// デフォルトのSupabase設定（環境変数から）
const defaultSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const defaultSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const defaultSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ユーザー設定のSupabase設定型
export interface UserSupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/**
 * ユーザー設定に基づいてSupabaseクライアントを取得
 * @param userId ユーザーID
 * @param userConfig ユーザーが設定したSupabase設定（オプション）
 * @returns Supabaseクライアント
 */
export async function getSupabaseClient(
  userId?: string,
  userConfig?: UserSupabaseConfig
): Promise<SupabaseClient | null> {
  // ユーザー設定がある場合はそれを使用
  if (userConfig?.url && userConfig?.anonKey) {
    return createClient(userConfig.url, userConfig.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  // デフォルトのSupabase設定を使用
  if (defaultSupabaseUrl && defaultSupabaseKey) {
    return createClient(defaultSupabaseUrl, defaultSupabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return null;
}

/**
 * サーバーサイド用のSupabaseクライアントを取得
 * @param userId ユーザーID
 * @param userConfig ユーザーが設定したSupabase設定（オプション）
 * @returns Supabaseクライアント（管理者権限）
 */
export async function getSupabaseAdminClient(
  userId?: string,
  userConfig?: UserSupabaseConfig
): Promise<SupabaseClient | null> {
  // ユーザー設定がある場合はそれを使用
  if (userConfig?.url && userConfig?.serviceRoleKey) {
    return createClient(userConfig.url, userConfig.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  // デフォルトのSupabase設定を使用
  if (defaultSupabaseUrl && defaultSupabaseServiceKey) {
    return createClient(defaultSupabaseUrl, defaultSupabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return null;
}

/**
 * デフォルトのSupabaseクライアント（従来の互換性のため）
 */
export const supabase =
  defaultSupabaseUrl && defaultSupabaseKey
    ? createClient(defaultSupabaseUrl, defaultSupabaseKey)
    : null;

/**
 * デフォルトのSupabase管理者クライアント（従来の互換性のため）
 */
export const supabaseAdmin =
  defaultSupabaseUrl && defaultSupabaseServiceKey
    ? createClient(defaultSupabaseUrl, defaultSupabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
