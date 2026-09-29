"use client";
// HeroScene.js — the Hero's visual panel: a handful of abstract matte/frame
// blocks scattered in 3D space around two real, sharp screenshots of the
// actual product (Dashboard, desktop and mobile). Earlier drafts tried a
// blurred-glass treatment over both invented line art and real screenshots —
// blur erases a light, mostly-white UI down to an unreadable smudge either
// way, so these stay fully crisp instead, like a photo held up rather than
// seen through frosted glass. Positions are percentage-based (not fixed px)
// so the whole composition scales cleanly across the panel's own responsive
// height (380px on mobile up to 560px on desktop, see Hero.js).

const TAG_STYLE = {
  position: "absolute",
  bottom: 8,
  left: 8,
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(11,13,15,0.72)",
  color: "#f4f1ea",
  fontFamily: "var(--font-display, inherit)",
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const ABSTRACT_BLOCKS = [
  { top: "10%", left: "6%", w: "20%", ratio: "4/3", kind: "matte", rot: "rotateX(10deg) rotateY(-16deg) rotateZ(5deg)" },
  { top: "6%", left: "40%", w: "13%", ratio: "1/1", kind: "matte", rot: "rotateX(-10deg) rotateY(14deg) rotateZ(10deg)" },
  { top: "58%", left: "70%", w: "16%", ratio: "3/4", kind: "frame", rot: "rotateX(14deg) rotateY(-10deg) rotateZ(-4deg)" },
  { top: "68%", left: "10%", w: "20%", ratio: "16/9", kind: "matte", rot: "rotateX(6deg) rotateY(26deg) rotateZ(-11deg)" },
  { top: "4%", left: "78%", w: "16%", ratio: "3/4", kind: "frame", rot: "rotateX(10deg) rotateY(34deg) rotateZ(0deg)" },
];

function AbstractBlock({ top, left, w, ratio, kind, rot }) {
  const isFrame = kind === "frame";
  return (
    <div
      className="absolute rounded-2xl"
      style={{
        top, left, width: w, aspectRatio: ratio,
        transform: `translate(-50%,-50%) ${rot}`,
        background: isFrame ? "transparent" : "linear-gradient(155deg, #34383d, #1c1f22)",
        border: isFrame ? "1.5px solid rgba(110,231,183,0.5)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isFrame ? "0 30px 70px -34px rgba(0,0,0,0.55)" : "0 46px 90px -30px rgba(0,0,0,0.65)",
      }}
    />
  );
}

export function HeroScene({ className }) {
  return (
    <div className={`relative h-full w-full ${className || ""}`} style={{ perspective: "1400px" }}>
      <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {ABSTRACT_BLOCKS.map((b, i) => <AbstractBlock key={i} {...b} />)}

        {/* Real desktop screenshot — sharp, not blurred */}
        <div
          className="absolute overflow-hidden rounded-2xl bg-cover bg-center"
          style={{
            top: "34%", left: "62%", width: "40%", aspectRatio: "5/3",
            backgroundImage: "url(/hero/dashboard-desktop.jpg)",
            transform: "translate(-50%,-50%) rotateX(6deg) rotateY(12deg) rotateZ(-5deg)",
            border: "2px solid rgba(255,255,255,0.92)",
            boxShadow: "0 55px 110px -28px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.4)",
          }}
        >
          <span style={TAG_STYLE}>Desktop</span>
        </div>

        {/* Real mobile screenshot, portrait — sharp, not blurred */}
        <div
          className="absolute overflow-hidden rounded-2xl bg-cover bg-center"
          style={{
            top: "62%", left: "24%", width: "17%", aspectRatio: "39/50",
            backgroundImage: "url(/hero/dashboard-mobile.jpg)",
            transform: "translate(-50%,-50%) rotateX(-8deg) rotateY(-16deg) rotateZ(6deg)",
            border: "2px solid rgba(255,255,255,0.92)",
            boxShadow: "0 55px 110px -28px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.4)",
          }}
        >
          <span style={TAG_STYLE}>Mobile</span>
        </div>
      </div>
    </div>
  );
}
