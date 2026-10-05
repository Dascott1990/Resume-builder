"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Download } from "lucide-react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
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
    // Fixed viewport stage, strict — not min-h, not a 90% peek (tried and
    // reverted): a locked 100svh frame with its own flex column is what
    // actually lets the rest of this layout be a real blueprint (navbar
    // row, centered stage, bottom-pinned scroll hint) instead of
    // everything fighting over leftover space. svh, not dvh/vh: dvh
    // recalculates as a mobile browser's own address bar shows/hides
    // (confirmed live, caused the fixed navbar to need a reflow before
    // appearing); plain vh is taller than the real visible viewport on
    // first paint on the same class of browser. svh is sized as if the
    // chrome is always expanded — the one option that's actually stable.
    <section
      id="top"
      ref={heroRef}
      className="dark relative flex h-[100svh] w-full flex-col overflow-hidden bg-background"
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

      {/* Navbar.js floats fixed above this whole section and isn't part of
          this flex column at all — this spacer just reserves its exact
          height (h-16, matching Navbar.js's own) so the centered stage
          below starts its math from where the navbar actually ends, not
          from the top of the viewport underneath it. Hero content never
          inherits spacing FROM the navbar this way — the two are fully
          decoupled, which is the actual fix for "fighting over the same
          vertical space." */}
      <div className="h-16 shrink-0" aria-hidden="true" />

      {/* The center stage: everything below the navbar row, and the
          headline/CTA/graphic cluster sits in the true optical center of
          it — not pinned to the top, not pinned to the bottom. */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:px-12">
          {/* ── Text column — no logo repeated here, Navbar.js already
              carries the full lockup, fixed and persistent through this
              whole section, so a second one would just compete for the
              same glance. ── */}
          <div className="order-1 flex flex-col items-center text-center lg:items-start lg:text-left">
            {/* Detected, not hardcoded — Noqeev isn't an Ottawa-only
                product, see lib/useVisitorLocation.js. Renders nothing
                until a real city comes back, so there's no placeholder
                flash or a wrong-city guess ever shown. */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-3"
            >
              <LocationPill />
            </motion.div>

            {/* Headline → subheadline: tight (they're one thought).
                Subheadline → CTA: a distinctly larger, deliberate gap. */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="m-0 text-balance text-[clamp(1.6rem,5.4vw,3.4rem)] leading-[1.08] font-bold tracking-tight text-foreground"
            >
              Tailored resumes, matched to the job.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="m-0 mt-2 text-[13.5px] leading-snug text-muted-foreground sm:text-[15.5px] sm:leading-relaxed"
            >
              Set up your profile once. Tailor unlimited resumes after that.
            </motion.p>

            {/* Signup is the primary CTA now — set up a profile once,
                reuse it for every resume. Paired with Download, shown
                only while installing is actually a real, available
                action (see useInstallPrompt) — it disappears on its own
                the moment the app is installed. */}
            {/* flex-row (and the buttons' own shrink-to-content width)
                only kicks in at lg, the SAME breakpoint where the column
                above switches from centered to left-aligned — both
                switch together so there's never a width where the
                buttons disagree with the text above them. */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex w-full max-w-sm flex-col items-center gap-2 lg:max-w-none lg:flex-row lg:justify-start lg:gap-3"
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

          {/* ── The showcase: a real isometric corporate tower cluster
              (see HeroScene.js/CorporateSkyline.js) — no platform card
              under it on purpose (no border, no background, no rounded
              panel): the towers' own base mask fades them straight into
              this panel's transparent ground, so they read as rising out
              of the page, not standing on a block. ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ y: panelY, opacity: panelOpacity }}
            className="order-2 lg:order-none"
          >
            <div
              aria-hidden="true"
              className="relative h-[150px] w-full sm:h-[240px] lg:h-[400px]"
            >
              <div className="absolute inset-0" style={{ opacity: intensity, transition: "opacity 0.25s ease" }}>
                <HeroScene />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Absolute, not in the flex flow — independent of the centered
          stage above so it never moves if that cluster's own height
          changes, pinned to a strict bottom safety margin. */}
      <motion.a
        href="#features"
        aria-label="Scroll to explore"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1 text-muted-foreground/60"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
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
