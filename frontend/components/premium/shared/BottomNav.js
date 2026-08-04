"use client";
import { motion } from "framer-motion";

// ── Mobile/tablet: floating frosted-glass bottom bar ──────────────────────────
// Same visual language as guest/components/MobileNav.js (fixed positioning,
// safe-area-aware bottom offset, sliding pill, spring physics) but generic —
// takes a plain `items` array instead of a hardcoded view list, so it isn't
// tied to Guest Mode's specific tab/preview state machine. Doesn't replicate
// MobileNav's scroll-hide behavior (that's wired to Guest Mode's own scroll
// instrumentation) — this bar stays always-visible, which is still a
// correct, common pattern on its own.
//
// The active pill's position is driven by plain index-based `left`/`width`,
// not framer-motion's `layoutId` (cross-component shared-layout animation).
// Any screen that mounts this inside a tree an ancestor `AnimatePresence`
// can unmount (a full-screen swap, a page transition) risks the exact same
// failure a `layoutId` pill hit in Guest Mode: torn out of framer's shared
// projection tree mid-registration, it stalls framer's global animation loop
// for the whole page — every motion value freezes at its current value, i.e.
// a blank screen that never recovers. Index-driven left/width has no
// cross-component state to leave dangling, so it can't wedge anything.
export function BottomNav({ items, active, onChange }) {
  const activeIndex = items.findIndex((item) => item.id === active);
  const slot = 100 / items.length;

  return (
    <motion.nav role="tablist" aria-label="View"
      className="fixed right-3 left-3 z-40 flex rounded-[22px] border border-white/[0.14] pt-1.5 pb-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.07)_inset] backdrop-blur-[28px] backdrop-saturate-[190%]"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        background: "color-mix(in oklch, var(--card) 80%, transparent)",
      }}>
      {activeIndex >= 0 && (
        <motion.span
          animate={{ left: `${activeIndex * slot + slot * 0.16}%`, width: `${slot * 0.68}%` }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="pointer-events-none absolute top-[7px] bottom-[7px] rounded-[14px] border border-primary/25 bg-primary/[0.12]"
        />
      )}
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <motion.button key={item.id} role="tab" aria-selected={isActive} onClick={() => onChange(item.id)}
            whileTap={{ scale: 0.9 }}
            className="relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]">
            <motion.span animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 380 }}
              className="relative flex">
              <item.Icon className={`size-[21px] ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />
            </motion.span>
            <span className={`relative text-[12.5px] ${isActive ? "font-bold text-primary" : "font-medium text-muted-foreground/60"} tracking-[0.01em]`}>
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}
