"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/useTheme";

// ── Theme toggle ──────────────────────────────────────────────────────────────
// Icon-only by default (`compact`) for tight spaces like a mobile header;
// the full labeled row variant is for the desktop sidebar's account
// section, matching the Sign in/out button it sits next to.
export function ThemeToggle({ compact = false, className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground [-webkit-tap-highlight-color:transparent] ${className}`}
      >
        {isDark ? <Sun className="size-[15px]" /> : <Moon className="size-[15px]" />}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`flex w-full items-center gap-2 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[13px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent] ${className}`}
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
