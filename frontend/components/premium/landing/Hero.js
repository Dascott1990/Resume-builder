"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Download } from "lucide-react";
import { useViewport } from "@/lib/useViewport";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import HeroScene3D from "../HeroScene3D";
import Logo from "../Logo";
import { InstallInstructionsModal } from "./InstallInstructionsModal";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function Hero({ onOpenDashboard, intensity }) {
  const heroRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const { isDesktop } = useViewport();
  const { canShow: canInstall, isIOS, showInstalledBadge, isPrompting, promptInstall, dismissAfterIOSInstructions } = useInstallPrompt();
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const handleDownloadClick = () => {
    if (isPrompting) return; // a prompt is already in flight — ignore rapid re-clicks
    isIOS ? setIosInstructionsOpen(true) : promptInstall();
  };
  // This page (unlike the app screens that only ever mount after a click,
  // never through SSR) is server-rendered at "/" , useViewport defaults to
  // a desktop width on the server, so branching on isDesktop immediately
  // would render a different tree than the client's real viewport and fail
  // hydration outright. Same fix Logo3D.js already uses for WebGL support:
  // render neither breakpoint's 3D layer until after mount (server output
  // and the first client paint both show just the text, byte-identical),
  // then upgrade to the real layout on the next tick, an ordinary
  // post-hydration re-render, not a mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });

  // The showcase drifts and settles slower than the page scrolls, the
  // "this scrolls like 3D" cue, on both the desktop panel and the mobile
  // wallpaper below.
  const panelY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : 90]);
  const panelOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.2]);

  return (
    <section
      id="top"
      ref={heroRef}
      className="relative w-full overflow-hidden pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28"
      style={{ scrollMarginTop: "64px" }}
    >
      <motion.div
        aria-hidden="true"
        animate={reducedMotion ? undefined : { opacity: [0.16, 0.3, 0.16] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[10%] right-[-10%] size-[680px]"
        style={{
          background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 70%)",
        }}
      />

      {/* ── Mobile/tablet: the 3D scene as full-bleed wallpaper behind the
          text, not a boxed showcase, a scrim gradient keeps the copy
          legible without flattening the scene to nothing. Rendered via a
          JS breakpoint check (not a CSS hidden/lg:block pair) so only one
          WebGL canvas ever mounts at a time, two live contexts for one
          hero is wasted GPU work neither device needs. */}
      {mounted && !isDesktop && (
        <motion.div
          aria-hidden="true"
          style={{ y: panelY, opacity: panelOpacity }}
          className="pointer-events-none absolute inset-0 z-0"
        >
          <div className="absolute inset-0" style={{ opacity: intensity * 0.4, transition: "opacity 0.25s ease" }}>
            <HeroScene3D style={{ width: "100%", height: "100%" }} />
          </div>
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, transparent 0%, transparent 30%, var(--background) 80%)" }}
          />
        </motion.div>
      )}

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12">
        {/* ── Text column, message + action, always readable, never behind the 3D ── */}
        <div className="order-1 flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}>
            <Logo size={34} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="m-0 text-balance text-[clamp(2rem,5.4vw,3.4rem)] leading-[1.06] font-bold tracking-tight text-foreground"
          >
            Every career deserves a second chance.
          </motion.h1>

          {/* Dashboard (the hub everything else — resume builder, CV scan,
              job tracker, artisan directory — lives inside) plus Download,
              shown only while installing is actually a real, available
              action (see useInstallPrompt) — it disappears on its own the
              moment the app is installed, so nobody's ever staring at a
              button with nothing left to do. Resume Studio and Find an
              Artisan don't need their own line here; both are one tap away
              once inside the Dashboard, and still linked from the nav/
              footer/final CTA further down the page. */}
          {/* flex-row (and the buttons' own shrink-to-content width) only
              kicks in at lg, the SAME breakpoint where the column above
              switches from centered/text-center to text-left/items-start.
              This used to switch to a row at sm (640px) while the column
              stayed centered until lg (1024px) — on every iPad width in
              between, that left a full-width row with no justify-content
              set, so it defaulted to packing left inside an otherwise
              perfectly centered hero: buttons visibly "fell" left instead
              of stacking centered under the headline like everything else
              on the page at that width. Now both switch together, so
              there's never a width where the buttons disagree with the
              text above them. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-sm flex-col items-center gap-3 lg:max-w-none lg:flex-row lg:justify-start"
          >
            <motion.button
              onClick={onOpenDashboard}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
              className="flex min-h-[54px] w-full select-none items-center justify-center gap-2 rounded-2xl border-none bg-primary px-7 text-[15.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] lg:w-auto"
            >
              Dashboard
              <ArrowRight className="size-4" />
            </motion.button>
            {(canInstall || showInstalledBadge) && (
              <motion.button
                onClick={showInstalledBadge || isPrompting ? undefined : handleDownloadClick}
                disabled={showInstalledBadge || isPrompting}
                whileTap={showInstalledBadge || isPrompting ? undefined : { scale: 0.96 }}
                transition={{ type: "spring", damping: 22, stiffness: 400 }}
                className={`flex min-h-[54px] w-full select-none items-center justify-center gap-2 rounded-2xl border border-border bg-transparent px-7 text-[15.5px] font-bold [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] lg:w-auto ${
                  showInstalledBadge || isPrompting ? "cursor-default text-muted-foreground" : "text-foreground"
                }`}
              >
                {showInstalledBadge ? (
                  <>
                    <Check className="size-4" />
                    Installed
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Download
                  </>
                )}
              </motion.button>
            )}
          </motion.div>

          <InstallInstructionsModal
            open={iosInstructionsOpen}
            onClose={() => {
              setIosInstructionsOpen(false);
              dismissAfterIOSInstructions();
            }}
          />
        </div>

        {/* ── Desktop only: the boxed 3D showcase, the resume, the people,
            the build, all bridged to the mark, in its own display case
            beside the text instead of sitting behind it. ── */}
        {mounted && isDesktop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ y: panelY, opacity: panelOpacity }}
            className="order-2 lg:order-none"
          >
            <div
              className="relative h-[380px] w-full overflow-hidden rounded-[28px] border border-white/[0.1] sm:h-[460px] lg:h-[560px]"
              style={{
                background: "radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--primary) 13%, transparent) 0%, transparent 65%), color-mix(in oklch, var(--card) 55%, transparent)",
                boxShadow: "inset 0 0 70px rgba(0,0,0,0.45), 0 24px 70px rgba(0,0,0,0.4)",
              }}
            >
              <div className="absolute inset-0" style={{ opacity: intensity, transition: "opacity 0.25s ease" }}>
                <HeroScene3D style={{ width: "100%", height: "100%" }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <motion.a
        href="#features"
        aria-label="Scroll to explore"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="relative z-10 mt-14 flex flex-col items-center gap-1 text-muted-foreground/60 lg:mt-16"
      >
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase">Scroll</span>
        <motion.span
          animate={reducedMotion ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </motion.a>
    </section>
  );
}
