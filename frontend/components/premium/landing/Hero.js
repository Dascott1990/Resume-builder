"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Download } from "lucide-react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import Logo from "../Logo";
import { InstallInstructionsModal } from "./InstallInstructionsModal";
import { LocationPill } from "./shared";
import { HeroScene } from "./HeroScene";

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

export function Hero({ onOpenSignup, intensity }) {
  const heroRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const { canShow: canInstall, isIOS, showInstalledBadge, isPrompting, promptInstall, dismissAfterIOSInstructions } = useInstallPrompt();
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const handleDownloadClick = () => {
    if (isPrompting) return; // a prompt is already in flight — ignore rapid re-clicks
    isIOS ? setIosInstructionsOpen(true) : promptInstall();
  };
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });

  // The showcase drifts and settles slower than the page scrolls, the
  // "this scrolls like 3D" cue.
  const panelY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : 90]);
  const panelOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.2]);

  return (
    <section
      id="top"
      ref={heroRef}
      // h-[100dvh], not min-h: the whole hero — headline, CTA, the
      // skyline panel, and the scroll hint at the very bottom — has to
      // fit in exactly one screen on every breakpoint, never taller.
      // Confirmed live this was the bug with min-h: on a short phone
      // viewport the stacked mobile layout ran past 100dvh, pushing the
      // "Scroll" hint below the fold — the one thing whose entire job is
      // to be visible without scrolling. Paddings/gaps below are tuned
      // tighter on mobile specifically to make that fit true, not just
      // declared.
      className="dark relative flex h-[100dvh] w-full flex-col justify-center overflow-hidden bg-background pt-6 pb-4 sm:pt-10 sm:pb-6 lg:pt-20 lg:pb-10"
      style={{ scrollMarginTop: "64px" }}
    >
      <motion.div
        aria-hidden="true"
        animate={reducedMotion ? undefined : { opacity: [0.16, 0.3, 0.16] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[-10%] right-[-8%] size-[680px]"
        style={{
          background: "radial-gradient(circle, rgba(52,211,153,0.22) 0%, rgba(52,211,153,0.05) 45%, transparent 72%)",
        }}
      />

      <div className="relative z-10 mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 items-center gap-3 px-6 sm:gap-5 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:px-12">
        {/* ── Text column, message + action, always readable, never behind the 3D ── */}
        <div className="order-1 flex flex-col items-center gap-2.5 text-center sm:gap-4 lg:items-start lg:gap-6 lg:text-left">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}>
            <Logo size={34} />
          </motion.div>

          {/* Detected, not hardcoded — Noqeev isn't an Ottawa-only product,
              see lib/useVisitorLocation.js. Renders nothing until a real
              city comes back, so there's no placeholder flash or a
              wrong-city guess ever shown. */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <LocationPill />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="m-0 text-balance text-[clamp(1.6rem,5.4vw,3.4rem)] leading-[1.08] font-bold tracking-tight text-foreground"
          >
            Tailored resumes, built to get you hired.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="m-0 text-[13.5px] leading-snug text-muted-foreground sm:text-[15.5px] sm:leading-relaxed"
          >
            Set up your profile once. Tailor unlimited resumes after that.
          </motion.p>

          {/* Signup is the primary CTA now — set up a profile once, reuse
              it for every resume, per the onboarding redesign. Guest mode
              still needs no account at all; it's one quiet tap away right
              below instead of the headline promise. Paired with Download,
              shown only while installing is actually a real, available
              action (see useInstallPrompt) — it disappears on its own the
              moment the app is installed, so nobody's ever staring at a
              button with nothing left to do. Resume Studio doesn't need
              its own line here; it's one tap away once inside the
              Dashboard, and still linked from the nav/footer/final CTA
              further down the page. */}
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
            className="flex w-full max-w-sm flex-col items-center gap-2 lg:max-w-none lg:flex-row lg:justify-start lg:gap-3"
          >
            <motion.button
              onClick={onOpenSignup}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
              className="flex min-h-[44px] w-full select-none items-center justify-center gap-2 rounded-2xl border-none bg-primary px-7 text-[14px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] sm:min-h-[54px] sm:text-[15.5px] lg:w-auto"
            >
              Create Your Resume
              <ArrowRight className="size-4" />
            </motion.button>
            {(canInstall || showInstalledBadge) && (
              <motion.button
                onClick={showInstalledBadge || isPrompting ? undefined : handleDownloadClick}
                disabled={showInstalledBadge || isPrompting}
                whileTap={showInstalledBadge || isPrompting ? undefined : { scale: 0.96 }}
                transition={{ type: "spring", damping: 22, stiffness: 400 }}
                className={`flex min-h-[44px] w-full select-none items-center justify-center gap-2 rounded-2xl border border-border bg-transparent px-7 text-[14px] font-bold [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] sm:min-h-[54px] sm:text-[15.5px] lg:w-auto ${
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

        {/* ── The floating-blocks showcase: two real screenshots of the
            actual product (desktop + mobile Dashboard) scattered among
            abstract matte/frame shapes, in its own display case beside the
            text instead of sitting behind it. One unified panel for every
            breakpoint (previously desktop got a boxed panel and mobile got
            a full-bleed WebGL wallpaper behind the text; that wallpaper's
            gone along with the isDesktop/mounted branching it needed, this
            is plain CSS + two <div> backgrounds, cheap enough to just
            always render). ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ y: panelY, opacity: panelOpacity }}
          className="order-2 lg:order-none"
        >
          <div
            aria-hidden="true"
            className="relative h-[160px] w-full overflow-hidden rounded-[28px] border border-white/[0.1] sm:h-[280px] lg:h-[420px]"
            style={{ boxShadow: "inset 0 0 70px rgba(0,0,0,0.45), 0 24px 70px rgba(0,0,0,0.4)" }}
          >
            <div className="absolute inset-0" style={{ opacity: intensity, transition: "opacity 0.25s ease" }}>
              <HeroScene />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.a
        href="#features"
        aria-label="Scroll to explore"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="relative z-10 mt-6 flex flex-col items-center gap-1 text-muted-foreground/60 lg:mt-10"
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
