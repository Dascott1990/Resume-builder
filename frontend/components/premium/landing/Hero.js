"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, FileCheck2, ChevronDown } from "lucide-react";
import { useViewport } from "@/lib/useViewport";
import HeroScene3D from "../HeroScene3D";
import Logo from "../Logo";

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

const TRUST = [
  { Icon: ShieldCheck, label: "Anonymous by default, account optional" },
  { Icon: Zap, label: "Tailored in under 2 minutes" },
  { Icon: FileCheck2, label: "Real, editable .docx & PDF" },
];

export function Hero({ onOpen, onOpenArtisans, onOpenDashboard, intensity }) {
  const heroRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const { isDesktop } = useViewport();
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

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="m-0 max-w-lg text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-[16.5px]"
          >
            Tailored, ATS-ready resume, real .docx and PDF, account optional, nothing required to start
            {/*Paste a job posting, tell us who you are, and Noviq's AI writes a*/}
            {/*tailored, ATS-ready resume real .docx and PDF, no account, no*/}
            {/*login, no trace left behind.*/}
          </motion.p>

          {/* Dashboard is the primary CTA, it's the hub everything else
              (resume builder, CV scan, job tracker, artisan directory)
              lives inside, so the first tap always lands somewhere useful
              instead of committing to one specific tool immediately. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-sm flex-col items-center gap-3.5 sm:max-w-none sm:flex-row lg:justify-start"
          >
            <motion.button
              onClick={onOpenDashboard}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
              className="flex min-h-[54px] w-full select-none items-center justify-center gap-2 rounded-2xl border-none bg-primary px-7 text-[15.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] sm:w-auto"
            >
              Go to Dashboard
              <ArrowRight className="size-4" />
            </motion.button>
            <div className="flex items-center gap-4">
              <button
                onClick={onOpen}
                className="min-h-[44px] border-none bg-transparent px-2 text-[14px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent]"
              >
                Resume Studio →
              </button>
              <button
                onClick={onOpenArtisans}
                className="min-h-[44px] border-none bg-transparent px-2 text-[14px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent]"
              >
                Find an Artisan →
              </button>
            </div>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="m-0 mt-1 flex list-none flex-col flex-wrap items-center justify-center gap-x-6 gap-y-2.5 p-0 sm:flex-row lg:justify-start"
          >
            {TRUST.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground/80">
                <Icon className="size-[13px] text-primary" />
                {label}
              </li>
            ))}
          </motion.ul>
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
