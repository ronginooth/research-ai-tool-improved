"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Settings, Database, Save, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [settings, setSettings] = useState({
    customSupabaseUrl: "",
    customSupabaseAnonKey: "",
    customSupabaseServiceKey: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/user-settings?userId=${user.id}`);
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          customSupabaseUrl: data.settings.customSupabaseUrl || "",
          customSupabaseAnonKey: data.settings.customSupabaseAnonKey || "",
          customSupabaseServiceKey: data.settings.customSupabaseServiceKey || "",
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...settings,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("設定を保存しました");
      } else {
        toast.error(data.error || "設定の保存に失敗しました");
      }
    } catch (error) {
      toast.error("エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setSettings({
      customSupabaseUrl: "",
      customSupabaseAnonKey: "",
      customSupabaseServiceKey: "",
    });
    toast("設定をクリアしました。保存してください。");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">設定</h1>
          </div>

          {/* Supabase設定セクション */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                独自のSupabase設定（オプション）
              </h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              デフォルトのSupabaseを使用する場合は、何も設定する必要はありません。
              独自のSupabaseプロジェクトを使用する場合は、以下を設定してください。
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Supabase URL
                </label>
                <input
                  type="text"
                  value={settings.customSupabaseUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, customSupabaseUrl: e.target.value })
                  }
                  placeholder="https://xxxxx.supabase.co"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Supabase Anon Key
                </label>
                <div className="relative">
                  <input
                    type={showKeys ? "text" : "password"}
                    value={settings.customSupabaseAnonKey}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        customSupabaseAnonKey: e.target.value,
                      })
                    }
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(!showKeys)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showKeys ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Supabase Service Role Key（オプション）
                </label>
                <div className="relative">
                  <input
                    type={showKeys ? "text" : "password"}
                    value={settings.customSupabaseServiceKey}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        customSupabaseServiceKey: e.target.value,
                      })
                    }
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(!showKeys)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showKeys ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  サーバーサイド操作が必要な場合のみ設定してください
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  保存
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  クリア
                </button>
              </div>
            </div>
          </div>

          {/* 戻るリンク */}
          <div className="pt-6 border-t border-slate-200">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
