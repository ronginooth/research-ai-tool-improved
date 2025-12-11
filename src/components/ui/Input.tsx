"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: LucideIcon;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  icon: Icon,
  fullWidth = false,
  className,
  ...props
}: InputProps) {
  const { theme } = useTheme();

  return (
    <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
      {label && (
        <label className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
        )}
        <input
          className={cn(
            "w-full px-3 py-2 rounded-lg border transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-1",
            Icon && "pl-10",
            error
              ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
              : "border-[var(--color-border)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]",
            "bg-[var(--color-surface)] text-[var(--color-text)]",
            "placeholder:text-[var(--color-text-secondary)]",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-[var(--color-text-secondary)]">{helperText}</p>
      )}
    </div>
  );
}





