"use client";
import { Loader2, ChevronRight, Eye, FileDown, Plus, RefreshCw, Sparkles, Trash2, Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const BTN_ICONS = { ChevronRight, Eye, FileDown, Plus, RefreshCw, Sparkles, Trash2, Check, Clipboard };

// ── Button ─────────────────────────────────────────────────────────────────────
// Only one filled button exists ("gold" — the single call-to-action per screen).
// Everything else is an outline or plain text; no colour-tinted boxes.
// variant mapping onto shadcn's Button variants:
//   gold → default (bg-primary),  primary → secondary,  ghost → outline,  danger → destructive
const VARIANT_MAP = { gold: "default", primary: "secondary", ghost: "outline", danger: "destructive" };

export function Btn({ children, onClick, disabled, variant = "primary", small, icon, loading, className }) {
  const Icon = icon ? BTN_ICONS[icon] : null;
  const sizeClasses = small
    ? "h-11 w-auto min-h-11 gap-1.5 rounded-[10px] px-4 text-sm"
    : "h-[54px] w-full min-h-[54px] gap-2 rounded-xl px-[18px] text-[15px]";
  return (
    <Button
      variant={VARIANT_MAP[variant] || "secondary"}
      disabled={!!disabled}
      onClick={disabled ? undefined : onClick}
      className={`${sizeClasses} font-bold ${className || ""}`}
    >
      {loading ? <Loader2 className="size-[17px] animate-spin" /> : Icon && <Icon className={small ? "size-4" : "size-[18px]"} />}
      {children}
    </Button>
  );
}

// ── Text link ──────────────────────────────────────────────────────────────────
// The deliberate counterpart to Btn: every screen gets exactly ONE bold button
// (gold or primary). Everything else — "Open Preview", "Build another", format
// alternatives — is a plain-text link like this, never another boxed button.
export function TextLink({ children, onClick, disabled, small }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={!!disabled}
      className={`touch-manipulation border-none bg-transparent font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed disabled:opacity-40 ${
        small ? "min-h-7 px-0.5 py-1 text-xs" : "min-h-8 px-1 py-1.5 text-[13px]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Input / Textarea ───────────────────────────────────────────────────────────
export function Field({ label, required, hint, value, onChange, placeholder, multiline, rows = 3, mono }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13.5px] font-bold tracking-wide text-foreground">
          {label}{required && <span className="text-primary"> *</span>}
        </span>
        {hint && <span className="text-xs text-muted-foreground/60">{hint}</span>}
      </div>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`min-h-[52px] resize-y rounded-[10px] text-base ${mono ? "font-mono" : ""}`}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type="text"
          className={`h-[52px] rounded-[10px] text-base ${mono ? "font-mono" : ""}`}
        />
      )}
    </div>
  );
}

// ── Progress steps ─────────────────────────────────────────────────────────────
export function Steps({ current }) {
  const steps = ["Your Info", "Job Posting"];
  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xl font-bold text-foreground">{steps[current - 1]}</span>
        <span className="text-[13px] font-semibold text-muted-foreground">Step {current} of {steps.length}</span>
      </div>
      <div className="flex gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className={`h-[5px] flex-1 rounded-sm ${i < current ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}

// ── Keyword list — plain words, no pill chrome ──────────────────────────────────
export function KwPill({ word }) {
  return <span className="whitespace-nowrap text-[12.5px] text-foreground">{word}</span>;
}
