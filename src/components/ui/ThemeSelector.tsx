"use client";

import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Palette, Sun, Moon, Droplet } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

export function ThemeSelector() {
  const { theme, setScheme, availableSchemes } = useTheme();

  const schemeLabels: Record<string, string> = {
    original: "オリジナル",
    light: "ライト",
    dark: "ダーク",
    blue: "ブルー",
    green: "グリーン",
    purple: "パープル",
    orange: "オレンジ",
  };

  const schemeIcons: Record<string, typeof Sun> = {
    original: Palette,
    light: Sun,
    dark: Moon,
    blue: Droplet,
    green: Droplet,
    purple: Droplet,
    orange: Droplet,
  };

  return (
    <Card variant="elevated" padding="sm" className="w-full bg-[var(--color-surface)]/95 backdrop-blur-md shadow-xl border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-5 h-5 text-[var(--color-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          カラースキーム
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {availableSchemes.map((scheme) => {
          const Icon = schemeIcons[scheme] || Palette;
          const isActive = theme.scheme === scheme;
          
          return (
            <button
              key={scheme}
              onClick={() => setScheme(scheme)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200",
                isActive
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isActive
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-background)] text-[var(--color-text-secondary)]"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-[var(--color-text)]">
                {schemeLabels[scheme] || scheme}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

