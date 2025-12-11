import { supabaseAdmin } from "./supabase-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserSupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  customSupabaseUrl?: string;
  customSupabaseAnonKey?: string;
  customSupabaseServiceKey?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ユーザー設定を取得
 */
export async function getUserSettings(
  userId: string,
  client?: SupabaseClient | null
): Promise<UserSettings | null> {
  const adminClient = client || supabaseAdmin;
  if (!adminClient) {
    return null;
  }

  try {
    const { data, error } = await adminClient
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      // PGRST116は"not found"エラー、PGRST205は"table not found"エラー
      // どちらも正常なケース（テーブルが存在しない、またはレコードが存在しない）
      if (error.code === "PGRST116" || error.code === "PGRST205") {
        // テーブルが存在しない、またはレコードが見つからない場合は null を返す（エラーではない）
        return null;
      }
      // その他のエラーはログに記録
      console.warn("Failed to fetch user settings:", error);
      return null;
    }

    return data;
  } catch (error) {
    // テーブルが存在しない場合など、予期しないエラーも無視して null を返す
    console.warn("Error fetching user settings (ignored):", error);
    return null;
  }
}

/**
 * ユーザー設定を保存・更新
 */
export async function saveUserSettings(
  userId: string,
  config: {
    customSupabaseUrl?: string;
    customSupabaseAnonKey?: string;
    customSupabaseServiceKey?: string;
  },
  client?: SupabaseClient | null
): Promise<boolean> {
  const adminClient = client || supabaseAdmin;
  if (!adminClient) {
    return false;
  }

  try {
    const { error } = await adminClient.from("user_settings").upsert(
      {
        user_id: userId,
        custom_supabase_url: config.customSupabaseUrl || null,
        custom_supabase_anon_key: config.customSupabaseAnonKey || null,
        custom_supabase_service_key: config.customSupabaseServiceKey || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("Failed to save user settings:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving user settings:", error);
    return false;
  }
}

/**
 * ユーザー設定からSupabase設定を取得
 */
export function getUserSupabaseConfig(
  settings: UserSettings | null
): UserSupabaseConfig | undefined {
  if (!settings?.customSupabaseUrl || !settings?.customSupabaseAnonKey) {
    return undefined;
  }

  return {
    url: settings.customSupabaseUrl,
    anonKey: settings.customSupabaseAnonKey,
    serviceRoleKey: settings.customSupabaseServiceKey || undefined,
  };
}
