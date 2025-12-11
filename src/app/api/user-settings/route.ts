import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-client";
import { getUserSettings, saveUserSettings } from "@/lib/user-settings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const settings = await getUserSettings(userId);
    return NextResponse.json({
      success: true,
      settings: settings || {
        userId,
        customSupabaseUrl: null,
        customSupabaseAnonKey: null,
        customSupabaseServiceKey: null,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch user settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch user settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, customSupabaseUrl, customSupabaseAnonKey, customSupabaseServiceKey } =
      body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    // URLとAnon Keyの両方が設定されているか、両方とも空である必要がある
    if (
      (customSupabaseUrl && !customSupabaseAnonKey) ||
      (!customSupabaseUrl && customSupabaseAnonKey)
    ) {
      return NextResponse.json(
        { error: "Supabase URL and Anon Key must be set together" },
        { status: 400 }
      );
    }

    const success = await saveUserSettings(userId, {
      customSupabaseUrl: customSupabaseUrl || undefined,
      customSupabaseAnonKey: customSupabaseAnonKey || undefined,
      customSupabaseServiceKey: customSupabaseServiceKey || undefined,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to save user settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to save user settings:", error);
    return NextResponse.json(
      { error: "Failed to save user settings" },
      { status: 500 }
    );
  }
}









