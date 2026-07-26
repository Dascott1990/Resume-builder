"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Resume from "../components/premium/Resume";
import ErrorBoundary from "../components/premium/ErrorBoundary";
import Logo, { LogoMark } from "../components/premium/Logo";

const C = {
  bg:    "#0B0D14",
  text:  "#F5F2EA",
  muted: "#868C99",
  gold:  "#C9A24E",
  goldFg:"#1A1710",
  sans:  "'Helvetica Neue',Arial,sans-serif",
};

// The "Open Resume Studio" screen — this is the first thing anyone sees,
// so it carries the brand instead of just a bare button on a black
// background. Wealthsimple-style: one dark surface, huge negative space,
// one obvious action, nothing competing for attention.
function Launcher({ onOpen }) {
  return (
    <div
      style={{
        height: "100dvh",
        width: "100%",
        background: C.bg,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: C.sans,
        padding: "24px",
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        boxSizing: "border-box",
      }}
    >
      {/* Soft gold glow behind the mark — reads as ambient light, not a
          decoration bolted on top. Breathes on the same slow rhythm as the
          mark itself so the two feel like one living thing. */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.22, 0.38, 0.22] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "50%", left: "50%",
          width: 560, height: 560, transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(201,162,78,0.18) 0%, rgba(201,162,78,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* The mark itself, huge and faint, sitting behind the foreground
          content — present, not decorative. Slow scale + opacity pulse so
          the screen feels alive while you decide to tap in. */}
      <motion.div
        aria-hidden="true"
        animate={{ scale: [1, 1.06, 1], opacity: [0.07, 0.13, 0.07] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "50%", left: "50%",
          width: "min(85vw, 620px)", height: "min(85vw, 620px)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      >
        <LogoMark size="100%" style={{ width: "100%", height: "100%" }} />
      </motion.div>

      <div
        style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 30, width: "100%", maxWidth: 340,
        }}
      >
        <Logo size={32} />

        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.muted, textAlign: "center" }}>
          Every career deserves a second chance.
        </p>

        {/* whileTap gives an immediate, firm press response instead of the
            button waiting on the browser's default ~300ms tap handling —
            paired with touch-action: manipulation in globals.css. */}
        <motion.button
          onClick={onOpen}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", damping: 22, stiffness: 400 }}
          style={{
            width: "100%",
            minHeight: 52,
            borderRadius: 14,
            border: "none",
            background: C.gold,
            color: C.goldFg,
            fontSize: 15.5,
            fontWeight: 700,
            fontFamily: C.sans,
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            userSelect: "none",
          }}
        >
          Open Resume Studio
        </motion.button>
      </div>
    </div>
  );
}

export default function Home() {
  const [open, setOpen] = useState(true);
  // Bumped on "Try Again" to force a fresh <Resume> instance without leaving
  // the studio — see ErrorBoundary's onReset below.
  const [sessionId, setSessionId] = useState(0);

  if (!open) {
    return <Launcher onOpen={() => { setSessionId((id) => id + 1); setOpen(true); }} />;
  }
  return (
    <ErrorBoundary
      // "Try Again": remount a clean Resume tree (clears whatever state caused
      // the crash) but stays open — the user doesn't lose their place in the app.
      onReset={() => setSessionId((id) => id + 1)}
      // "Close": actually leave the studio and go back to the launcher screen.
      onClose={() => setOpen(false)}
    >
      <Resume key={sessionId} onClose={() => setOpen(false)} />
    </ErrorBoundary>
  );
}