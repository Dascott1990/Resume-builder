"use client";
/**
 * MobileFloatingNav.js — the glassmorphic floating nav island from the
 * approved monochrome mobile reference, shared by every mobile screen that
 * needs the bottom nav (Dashboard.js, JobsBoard.js, ...) instead of each
 * one carrying its own copy. Detached from both side edges and the bottom
 * edge (inset-x-4, a real bottom gap, not flush), a blurred translucent
 * surface, up to 4 plain single-stroke icon items (solid-filled + bold
 * label on the active tab, resting grey outline otherwise), and a "+"
 * create button as one literal pitch-black circle breaking through its own
 * top edge — the one deliberately theme-constant element on this whole
 * screen, same as a camera app's shutter button stays the same in light or
 * dark mode.
 *
 * `onCreate` is intentionally just a callback, not a fixed "open the
 * resume Create sheet" behavior — Dashboard.js opens its own CreateSheet;
 * JobsBoard.js (no saved-resume state of its own to build that sheet from)
 * just routes straight into Quick Build. Each screen decides what its own
 * "+" actually does; this component only owns how it looks and where it
 * sits.
 */
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function MobileFloatingNav({ items, active, onChange, onCreate }) {
  const { t } = useLanguage();
  return (
    <nav
      className="fixed inset-x-4 z-40 flex items-center rounded-[26px] border border-border/60 bg-background/80 shadow-[0_20px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-150"
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
    >
      {items.slice(0, 2).map((item) => (
        <NavGlyph key={item.id} item={item} isActive={item.id === active} onClick={() => onChange(item.id)} />
      ))}

      {/* Reserves the center slot the "+" floats above — the row stays a
          true even 4-up grid, the button itself is purely decorative/
          positioned via the absolute button below it. */}
      <span className="flex-1" aria-hidden="true" />

      {items.slice(2, 4).map((item) => (
        <NavGlyph key={item.id} item={item} isActive={item.id === active} onClick={() => onChange(item.id)} />
      ))}

      <motion.button
        type="button" onClick={onCreate} aria-label={t("navRail.create")}
        whileTap={{ scale: 0.9 }}
        // ring-white/15 is deliberately theme-constant, not a dark: variant
        // — it reads as a near-invisible edge-light against the light-mode
        // nav's own light surface (the solid black circle already has
        // plenty of contrast there on its own), and as the one thing that
        // actually separates this circle from a near-black dark-mode nav
        // surface, where a flat #0a0a0a-on-near-black had almost no visible
        // boundary beyond the drop shadow.
        className="absolute left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/15 ring-inset [-webkit-tap-highlight-color:transparent]"
        style={{ top: -22, background: "#0a0a0a" }}
      >
        <Plus className="size-6 text-white" strokeWidth={2} />
      </motion.button>
    </nav>
  );
}

function NavGlyph({ item, isActive, onClick }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={item.label} aria-selected={isActive}
      className="flex flex-1 flex-col items-center justify-center gap-1 border-none bg-transparent py-3 [-webkit-tap-highlight-color:transparent]"
    >
      <item.Icon
        className={`size-5 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`}
        strokeWidth={1.75}
        fill={isActive ? "currentColor" : "none"}
      />
      <span className={`text-[10px] ${isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground/50"}`}>
        {item.label}
      </span>
    </button>
  );
}
