"use client";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/useTheme";

// ── Theme toggle ──────────────────────────────────────────────────────────────
// Icon-only by default (`compact`) for tight spaces like a mobile header;
// the full labeled row variant is for the desktop sidebar's account
// section, matching the Sign in/out button it sits next to. Simple 2-state
// flip (light/dark) on purpose — there's no room for a 3-way control here,
// and picking "System" is a deliberate choice that belongs in Settings'
// own ThemeModePicker below, not a quick header tap.
export function ThemeToggle({ compact = false, bare = false, className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        // `bare` drops this button's own border/fill — for when it sits
        // inside a shared pill container (NavRail.js, Dashboard.js's
        // mobile header) that already supplies the one outer border, so
        // the icon row reads as one grouped control instead of three
        // separately-bordered circles scattered with gaps between them.
        className={`flex size-9 items-center justify-center rounded-full [-webkit-tap-highlight-color:transparent] ${
          bare
            ? "border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            : "border border-border bg-muted text-foreground"
        } ${className}`}
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

// ── Theme mode picker — the real 3-way Light/Dark/System control ───────────
// Settings-only. "System" is a genuine, always-reselectable third state
// (see lib/theme.js's resolveMode), not just the implicit default before a
// first tap the way it used to be.
const MODES = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];
export function ThemeModePicker({ className = "" }) {
  const { mode, setMode } = useTheme();
  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className}`}>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setMode(m.id)}
          aria-pressed={mode === m.id}
          className={`flex flex-col items-center gap-1 rounded-lg border px-2.5 py-2 text-[11.5px] font-semibold [-webkit-tap-highlight-color:transparent] ${
            mode === m.id ? "border-foreground/30 bg-muted text-foreground" : "border-border bg-transparent text-muted-foreground"
          }`}
        >
          <m.Icon className="size-4" />
          {m.label}
        </button>
      ))}
    </div>
  );
}
