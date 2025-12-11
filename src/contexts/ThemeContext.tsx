"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ColorScheme = "original" | "light" | "dark" | "blue" | "green" | "purple" | "orange";

export interface ThemeConfig {
  scheme: ColorScheme;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

const colorSchemes: Record<ColorScheme, ThemeConfig> = {
  original: {
    scheme: "original",
    primary: "#1e293b", // slate-800 (元々のbg-slate-800)
    secondary: "#64748b", // slate-500
    accent: "#475569", // slate-600
    background: "#f1f5f9", // slate-100 (元々のbg-slate-100)
    surface: "#ffffff",
    text: "#1e293b", // slate-800 (元々のtext-slate-800)
    textSecondary: "#64748b", // slate-500 (元々のtext-slate-500/600)
    border: "#e2e8f0", // slate-200 (元々のborder-slate-200)
    success: "#10b981", // emerald-500
    warning: "#f59e0b", // amber-500
    error: "#ef4444", // red-500
  },
  light: {
    scheme: "light",
    primary: "#0ea5e9", // sky-500
    secondary: "#64748b", // slate-500
    accent: "#8b5cf6", // violet-500
    background: "#f8fafc", // slate-50
    surface: "#ffffff",
    text: "#1e293b", // slate-800
    textSecondary: "#64748b", // slate-500
    border: "#e2e8f0", // slate-200
    success: "#10b981", // emerald-500
    warning: "#f59e0b", // amber-500
    error: "#ef4444", // red-500
  },
  dark: {
    scheme: "dark",
    primary: "#38bdf8", // sky-400
    secondary: "#94a3b8", // slate-400
    accent: "#a78bfa", // violet-400
    background: "#0f172a", // slate-900
    surface: "#1e293b", // slate-800
    text: "#f1f5f9", // slate-100
    textSecondary: "#cbd5e1", // slate-300
    border: "#334155", // slate-700
    success: "#34d399", // emerald-400
    warning: "#fbbf24", // amber-400
    error: "#f87171", // red-400
  },
  blue: {
    scheme: "blue",
    primary: "#3b82f6", // blue-500
    secondary: "#60a5fa", // blue-400
    accent: "#2563eb", // blue-600
    background: "#eff6ff", // blue-50
    surface: "#ffffff",
    text: "#1e3a8a", // blue-900
    textSecondary: "#3b82f6", // blue-500
    border: "#bfdbfe", // blue-200
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
  },
  green: {
    scheme: "green",
    primary: "#10b981", // emerald-500
    secondary: "#34d399", // emerald-400
    accent: "#059669", // emerald-600
    background: "#ecfdf5", // emerald-50
    surface: "#ffffff",
    text: "#064e3b", // emerald-900
    textSecondary: "#10b981", // emerald-500
    border: "#a7f3d0", // emerald-200
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
  },
  purple: {
    scheme: "purple",
    primary: "#8b5cf6", // violet-500
    secondary: "#a78bfa", // violet-400
    accent: "#7c3aed", // violet-600
    background: "#f5f3ff", // violet-50
    surface: "#ffffff",
    text: "#4c1d95", // violet-900
    textSecondary: "#8b5cf6", // violet-500
    border: "#c4b5fd", // violet-300
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
  },
  orange: {
    scheme: "orange",
    primary: "#f97316", // orange-500
    secondary: "#fb923c", // orange-400
    accent: "#ea580c", // orange-600
    background: "#fff7ed", // orange-50
    surface: "#ffffff",
    text: "#7c2d12", // orange-900
    textSecondary: "#f97316", // orange-500
    border: "#fed7aa", // orange-200
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
  },
};

interface ThemeContextType {
  theme: ThemeConfig;
  setScheme: (scheme: ColorScheme) => void;
  availableSchemes: ColorScheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>("light");

  useEffect(() => {
    // localStorageから保存されたテーマを読み込む
    const saved = localStorage.getItem("colorScheme") as ColorScheme | null;
    if (saved && colorSchemes[saved]) {
      setSchemeState(saved);
    } else {
      // デフォルトはオリジナル（元々のデザイン）
      setSchemeState("original");
    }
  }, []);

  const setScheme = (newScheme: ColorScheme) => {
    setSchemeState(newScheme);
    localStorage.setItem("colorScheme", newScheme);
    
    // HTML要素にクラスを追加/削除
    const html = document.documentElement;
    html.classList.remove("original", "light", "dark", "blue", "green", "purple", "orange");
    html.classList.add(newScheme);
  };

  const theme = colorSchemes[scheme];

  useEffect(() => {
    // テーマ変更時にHTMLクラスを更新
    const html = document.documentElement;
    html.classList.remove("original", "light", "dark", "blue", "green", "purple", "orange");
    html.classList.add(scheme);
    
    // CSS変数を設定
    const root = document.documentElement;
    root.style.setProperty("--color-primary", theme.primary);
    root.style.setProperty("--color-secondary", theme.secondary);
    root.style.setProperty("--color-accent", theme.accent);
    root.style.setProperty("--color-background", theme.background);
    root.style.setProperty("--color-surface", theme.surface);
    root.style.setProperty("--color-text", theme.text);
    root.style.setProperty("--color-text-secondary", theme.textSecondary);
    root.style.setProperty("--color-border", theme.border);
    root.style.setProperty("--color-success", theme.success);
    root.style.setProperty("--color-warning", theme.warning);
    root.style.setProperty("--color-error", theme.error);
  }, [scheme, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setScheme,
        availableSchemes: Object.keys(colorSchemes) as ColorScheme[],
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

