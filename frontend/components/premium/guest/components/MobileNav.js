"use client";
import { motion } from "framer-motion";
import { Sparkles, Palette, Eye, Layout, Settings } from "lucide-react";

const VIEWS = [
  { id: "new",       Icon: Sparkles, label: "Build" },
  { id: "style",     Icon: Palette,  label: "Style" },
  { id: "preview",   Icon: Eye,      label: "Preview" },
  { id: "templates", Icon: Layout,   label: "Saved" },
  { id: "settings",  Icon: Settings, label: "Settings" },
];

// ── Mobile/tablet: floating frosted-glass bottom bar ──────────────────────────
// Two layers of defense against ever covering a button:
// 1. `position: fixed`, not a flex child — it used to sit in normal flex flow,
//    which meant it only stayed put if every scrollable div above it was
//    perfectly bounded. Fixed positioning takes it out of that flow entirely:
//    pinned to the nearest transformed ancestor (the flip-page wrapper in
//    Resume.js), itself pinned to the viewport, so content scroll can't drag
//    it anywhere. Every scroll container reserves `mobileNavClearance` at its
//    bottom so the last button always has clear room below it — this is the
//    actual guarantee.
// 2. On top of that: it recedes (fade + slide + shrink) while someone is
//    actively scrolling down, and returns on scroll-up or near the top — the
//    same idea as Instagram's bar shrinking on scroll. `pointerEvents: none`
//    while hidden means it can never intercept a tap even mid-transition.
export function MobileNav({ tab, mobileView, navHidden, onNavigate }) {
  return (
    <motion.nav role="tablist" aria-label="View"
      initial={false}
      animate={{ y: navHidden ? 90 : 0, opacity: navHidden ? 0 : 1, scale: navHidden ? 0.94 : 1 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className="fixed right-3 left-3 z-40 flex rounded-[22px] border border-white/[0.14] pt-1.5 pb-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.07)_inset] backdrop-blur-[28px] backdrop-saturate-[190%]"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        background: "color-mix(in oklch, var(--card) 80%, transparent)",
        pointerEvents: navHidden ? "none" : "auto",
      }}>
      {VIEWS.map(v => {
        const active = v.id === "preview" ? mobileView === "preview" : (mobileView === "panel" && tab === v.id);
        return (
          <motion.button key={v.id} role="tab" aria-selected={active} onClick={() => onNavigate(v.id)}
            whileTap={{ scale: 0.9 }}
            className="relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]">
            {active && (
              <motion.span layoutId="navActivePill" transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="absolute top-px right-[16%] bottom-px left-[16%] rounded-[14px] border border-primary/25 bg-primary/[0.12]" />
            )}
            <motion.span animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 380 }}
              className="relative flex">
              <v.Icon className={`size-[21px] ${active ? "text-primary" : "text-muted-foreground/60"}`} />
            </motion.span>
            <span className={`relative text-[12.5px] ${active ? "font-bold text-primary" : "font-medium text-muted-foreground/60"} tracking-[0.01em]`}>
              {v.label}
            </span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}
