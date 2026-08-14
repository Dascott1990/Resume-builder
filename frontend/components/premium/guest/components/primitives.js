"use client";
import { forwardRef, useState } from "react";
import { Loader2, ChevronRight, Eye, FileDown, Plus, RefreshCw, Sparkles, Trash2, Check, Clipboard, Pencil, MessageCircle, Gauge, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const BTN_ICONS = { ChevronRight, Eye, FileDown, Plus, RefreshCw, Sparkles, Trash2, Check, Clipboard, Pencil, MessageCircle, Gauge, Lock };


// ── Button ─────────────────────────────────────────────────────────────────────
// Only one filled button exists ("gold" the single call-to-action per screen).
// Everything else is an outline or plain text; no colour-tinted boxes.
// variant mapping onto shadcn's Button variants:
//   gold → default (bg-primary),  primary → secondary,  ghost → outline,  danger → destructive
const VARIANT_MAP = { gold: "default", primary: "secondary", ghost: "outline", danger: "destructive" };

// forwardRef matters here, not just cosmetically: Btn gets used as the
// `asChild` child of Radix triggers (AlertDialogTrigger in the delete-listing
// flow) Radix's Slot needs a real ref to the rendered DOM node to manage
// focus-return-on-close. Without forwardRef, React silently drops the ref
// (function components can't receive one directly pre-React-19) and Radix
// loses track of the trigger element.
export const Btn = forwardRef(function Btn(
  { children, onClick, disabled, variant = "primary", small, icon, loading, className, type, ...rest }, ref
) {
  const Icon = icon ? BTN_ICONS[icon] : null;
  const sizeClasses = small
    ? "h-11 w-auto min-h-11 gap-1.5 rounded-[10px] px-4 text-sm"
    : "h-[54px] w-full min-h-[54px] gap-2 rounded-xl px-[18px] text-[15px]";
  return (
    <Button
      ref={ref}
      type={type}
      variant={VARIANT_MAP[variant] || "secondary"}
      disabled={!!disabled}
      onClick={disabled ? undefined : onClick}
      className={`${sizeClasses} font-bold ${className || ""}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-[17px] animate-spin" /> : Icon && <Icon className={small ? "size-4" : "size-[18px]"} />}
      {children}
    </Button>
  );
});

// ── Text link ──────────────────────────────────────────────────────────────────
// The deliberate counterpart to Btn: every screen gets exactly ONE bold button
// (gold or primary). Everything else "Open Preview", "Build another", format
// alternatives is a plain-text link like this, never another boxed button.
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
// `hintOnFocus` is for the static "here's an example of what to type" hints
// (e.g. "City, Province", "Role | Company | Years") — with five-plus fields
// on one screen, showing all of them at once is exactly the clutter a
// placeholder is supposed to avoid. Set it and the hint stays hidden until
// this field is actually focused and empty, then disappears the moment
// there's a real value — it's done its job once you've started typing.
// Leave it unset (the default) for hints that are live feedback rather than
// a static example — a running character count, a status that changes with
// other state — those should stay visible regardless of focus.
export function Field({ label, required, hint, hintOnFocus = false, value, onChange, placeholder, type = "text", multiline, rows = 3, mono }) {
  const [focused, setFocused] = useState(false);
  const showHint = hint && (!hintOnFocus || (focused && !String(value ?? "").trim()));
  const focusHandlers = hintOnFocus ? { onFocus: () => setFocused(true), onBlur: () => setFocused(false) } : {};
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13.5px] font-bold tracking-wide text-foreground">
          {label}{required && <span className="text-primary"> *</span>}
        </span>
        {showHint && <span className="text-xs text-muted-foreground/60">{hint}</span>}
      </div>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`min-h-[52px] resize-y rounded-[10px] text-base ${mono ? "font-mono" : ""}`}
          {...focusHandlers}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          className={`h-[52px] rounded-[10px] text-base ${mono ? "font-mono" : ""}`}
          {...focusHandlers}
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

// ── Keyword list plain words, no pill chrome ──────────────────────────────────
export function KwPill({ word }) {
  return <span className="whitespace-nowrap text-[12.5px] text-foreground">{word}</span>;
}
