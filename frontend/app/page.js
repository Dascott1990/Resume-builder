"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Resume from "../components/premium/Resume";
import ErrorBoundary from "../components/premium/ErrorBoundary";
import Logo from "../components/premium/Logo";
import Logo3D from "../components/premium/Logo3D";
import Artisans from "../components/premium/Artisans";

// The "Open Resume Studio" screen — this is the first thing anyone sees,
// so it carries the brand instead of just a bare button on a black
// background. Wealthsimple-style: one dark surface, huge negative space,
// one obvious action, nothing competing for attention.
function Launcher({ onOpen, onOpenArtisans }) {
  return (
    <div
      className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-background p-6 font-sans"
      style={{
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      {/* Soft amber glow behind the mark — reads as ambient light, not a
          decoration bolted on top. Breathes on the same slow rhythm as the
          mark itself so the two feel like one living thing. */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.22, 0.38, 0.22] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)",
        }}
      />

      {/* The mark itself, huge and faint, sitting behind the foreground
          content — present, not decorative. Slow scale + opacity pulse so
          the screen feels alive while you decide to tap in. */}
      <motion.div
        aria-hidden="true"
        animate={{ scale: [1, 1.06, 1], opacity: [0.07, 0.13, 0.07] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-1/2 left-1/2 size-[min(85vw,620px)] -translate-x-1/2 -translate-y-1/2"
      >
        <Logo3D size="100%" style={{ width: "100%", height: "100%" }} />
      </motion.div>

      <div className="relative z-10 flex w-full max-w-[340px] flex-col items-center gap-[30px]">
        <Logo size={32} />

        <p className="m-0 text-center text-[15px] leading-relaxed text-muted-foreground">
          Every career deserves a second chance.
        </p>

        {/* whileTap gives an immediate, firm press response instead of the
            button waiting on the browser's default ~300ms tap handling —
            paired with touch-action: manipulation in globals.css. */}
        <motion.button
          onClick={onOpen}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", damping: 22, stiffness: 400 }}
          className="min-h-[52px] w-full select-none rounded-2xl border-none bg-primary text-[15.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]"
        >
          Open Resume Studio
        </motion.button>

        <button
          onClick={onOpenArtisans}
          className="border-none bg-transparent p-1 text-[13.5px] text-muted-foreground"
        >
          Find an Artisan →
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState("launcher"); // "launcher" | "resume" | "artisans"
  // Bumped on "Try Again" to force a fresh <Resume> instance without leaving
  // the studio — see ErrorBoundary's onReset below.
  const [sessionId, setSessionId] = useState(0);

  if (view === "launcher") {
    return (
      <Launcher
        onOpen={() => { setSessionId((id) => id + 1); setView("resume"); }}
        onOpenArtisans={() => setView("artisans")}
      />
    );
  }
  if (view === "artisans") {
    return (
      <ErrorBoundary onReset={() => setView("artisans")} onClose={() => setView("launcher")}>
        <Artisans onClose={() => setView("launcher")} />
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary
      // "Try Again": remount a clean Resume tree (clears whatever state caused
      // the crash) but stays open — the user doesn't lose their place in the app.
      onReset={() => setSessionId((id) => id + 1)}
      // "Close": actually leave the studio and go back to the launcher screen.
      onClose={() => setView("launcher")}
    >
      <Resume key={sessionId} onClose={() => setView("launcher")} />
    </ErrorBoundary>
  );
}