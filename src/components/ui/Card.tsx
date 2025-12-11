"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined" | "filled";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  icon?: LucideIcon;
  title?: string;
  subtitle?: string;
}

export function Card({
  variant = "default",
  padding = "md",
  hover = false,
  icon: Icon,
  title,
  subtitle,
  className,
  children,
  ...props
}: CardProps) {
  const { theme } = useTheme();

  const baseStyles = "rounded-xl transition-all duration-200";
  
  const variants = {
    default: "bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm",
    elevated: "bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg",
    outlined: "bg-transparent border-2 border-[var(--color-border)]",
    filled: "bg-[var(--color-background)] border border-[var(--color-border)]",
  };

  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-5",
    lg: "p-6",
  };

  const hoverStyles = hover
    ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
    : "";

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        paddings[padding],
        hoverStyles,
        // カードの高さを統一（icon + title + subtitleがある場合）
        (Icon || title || subtitle) && !children ? "h-32 flex flex-col" : "",
        className
      )}
      {...props}
    >
      {(Icon || title || subtitle) && (
        <div className={children ? "mb-4" : "flex-1 flex flex-col"}>
          {Icon && (
            <div className="mb-2">
              <Icon className="w-6 h-6 text-[var(--color-primary)]" />
            </div>
          )}
          {title && (
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}


