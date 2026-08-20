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
//
// The active-tab pill is a single element whose `left`/`width` are animated
// by index — deliberately NOT `layoutId` (framer-motion's cross-component
// shared-layout animation). This screen's parent (Resume.js) swaps this
// whole tree in and out via an `AnimatePresence` 3D flip; a `layoutId`
// element left mid-registration in framer's shared projection tree when
// that ancestor unmounts it stalls framer's global animation loop for the
// whole page — every motion value (including the flip's own opacity/rotateY)
// freezes at whatever value it was mid-transition, i.e. a blank screen that
// never recovers. Plain index-driven `left`/`width` has no cross-component
// state to leave dangling, so it can't wedge anything on unmount.
// Style is a special case (see StyleBottomSheet.js): tapping it never
// switches mobileView to "panel" like the other tabs — it opens a sheet
// over the always-visible preview instead, so mobileView stays "preview"
// the whole time it's open. Highlighting has to check styleSheetOpen
// directly rather than the panel/preview split every other tab uses.
function isActive(v, tab, mobileView, styleSheetOpen) {
  if (v.id === "style") return tab === "style" && styleSheetOpen;
  if (v.id === "preview") return mobileView === "preview" && !(tab === "style" && styleSheetOpen);
  return mobileView === "panel" && tab === v.id;
}

export function MobileNav({ tab, mobileView, styleSheetOpen, navHidden, onNavigate }) {
  const activeIndex = VIEWS.findIndex((v) => isActive(v, tab, mobileView, styleSheetOpen));
  const slot = 100 / VIEWS.length;

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
      {activeIndex >= 0 && (
        <motion.span
          animate={{ left: `${activeIndex * slot + slot * 0.16}%`, width: `${slot * 0.68}%` }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="pointer-events-none absolute top-[7px] bottom-[7px] rounded-[14px] border border-primary/25 bg-primary/[0.12]"
        />
      )}
      {VIEWS.map(v => {
        const active = isActive(v, tab, mobileView, styleSheetOpen);
        return (
          <motion.button key={v.id} role="tab" aria-selected={active} onClick={() => onNavigate(v.id)}
            whileTap={{ scale: 0.9 }}
            className="relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]">
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
