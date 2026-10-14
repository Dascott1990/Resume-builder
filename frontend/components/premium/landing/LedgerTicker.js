"use client";
/**
 * LedgerTicker.js — a new background layer behind CorporateSkyline.js,
 * deliberately not a change to that file (see its own file comment: the
 * towers are the Hero's one established showcase piece). This sits
 * underneath them: an open ledger low in the scene, each page running an
 * independent-speed horizontal tape of real résumé content — role,
 * metrics, skills, a tailoring result — the way a trading floor's ticker
 * scrolls prices. No literal bell graphic for "opening and closing"; a
 * slow pulse at the spine is the only nod to that rhythm.
 *
 * Content reuses the same demo candidate backend/app/api/landing_demo.py
 * already established (Program Manager, Northstar Analytics, etc.) rather
 * than inventing new resume content — one real, already-reviewed
 * "standing in for the visitor" identity, consistent with the rest of
 * this landing page's demo material.
 *
 * Always terminal-dark regardless of CorporateSkyline's day/night read —
 * this reads as a lit ledger/screen glowing behind the towers, not a
 * building that should re-tint with morning/afternoon light.
 */
const ROW_A = "PROGRAM MANAGER · NORTHSTAR ANALYTICS · 2022–PRESENT   ◆   CUT RELEASE CYCLE 22%   ◆   LED 5 CONCURRENT LAUNCHES   ◆   ";
const ROW_B = "STAKEHOLDER COMMUNICATION   ·   CROSS-FUNCTIONAL LEADERSHIP   ·   AGILE / SCRUM   ·   OKR REPORTING   ·   ";
const ROW_C = "B.A. BUSINESS ADMINISTRATION · UNIVERSITY OF TEXAS AT AUSTIN · 2015–2019   ◆   ";
const ROW_D = "KEYWORD MATCH 10/10   ▲   ATS SCORE 98   ▲   TAILORED IN UNDER 2 MINUTES   ▲   READY TO SEND   ▲   ";
const ROW_E = "OPERATIONS LEAD · BRIGHTLINE SOFTWARE · 2019–2022   ·   +30% CUSTOMER GROWTH   ·   ";
const ROW_F = "DOWNLOAD .DOCX   ◆   DOWNLOAD .PDF   ◆   NO WATERMARK   ◆   ";

function Tape({ text, top, size = 12.5, opacity = 0.88, color, durationS, delayS = 0 }) {
  return (
    <div
      className="absolute left-0 font-mono whitespace-nowrap [font-variant-numeric:tabular-nums]"
      style={{
        top, fontSize: size, color, opacity,
        textShadow: `0 0 10px ${color}55`,
        animation: `ledger-scroll ${durationS}s linear infinite`,
        animationDelay: `-${delayS}s`,
      }}
    >
      {text.repeat(2)}
    </div>
  );
}

export function LedgerTicker({ className = "" }) {
  const green = "#39e693";
  const gold = "#e8c384";
  return (
    <div
      id="ledger-ticker-root"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-[6%] mx-auto w-[72%] max-w-[560px] ${className}`}
      style={{ perspective: 1400 }}
    >
      {/* Breathing (scale/opacity only) lives on its own inner wrapper —
          kept separate from the outer element's centering so this
          animation's own `transform` never fights/replaces the layout
          transform a centering utility would otherwise need. */}
      <div className="[animation:ledger-breathe_6.5s_ease-in-out_infinite]">
      <div className="relative flex h-[108px] [transform:rotateX(38deg)] [transform-style:preserve-3d]">
        <div
          className="relative w-1/2 overflow-hidden rounded-l-[6px] rounded-r-none border-t"
          style={{
            background: "linear-gradient(180deg, #161b22 0%, #0e1218 100%)",
            borderColor: "rgba(232,195,132,0.14)",
            boxShadow: "inset -10px 0 24px -14px rgba(0,0,0,0.65)",
          }}
        >
          <Tape text={ROW_A} top={14} color={green} durationS={26} />
          <Tape text={ROW_B} top={38} size={11} opacity={0.4} color={green} durationS={33} delayS={6} />
          <Tape text={ROW_C} top={62} size={11} opacity={0.26} color={green} durationS={30} delayS={12} />
        </div>

        {/* Spine — the only literal "book" cue, plus the bell-pulse rhythm */}
        <div
          className="relative z-[2] w-[10px]"
          style={{
            background: "linear-gradient(180deg, rgba(232,195,132,0.55), rgba(232,195,132,0.08) 70%)",
            boxShadow: "0 0 22px 4px rgba(232,195,132,0.25)",
          }}
        >
          <span
            className="absolute top-1/2 left-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full [animation:ledger-pulse_6.5s_ease-out_infinite]"
            style={{ background: gold }}
          />
        </div>

        <div
          className="relative w-1/2 overflow-hidden rounded-r-[6px] rounded-l-none border-t"
          style={{
            background: "linear-gradient(180deg, #161b22 0%, #0e1218 100%)",
            borderColor: "rgba(232,195,132,0.14)",
            boxShadow: "inset 10px 0 24px -14px rgba(0,0,0,0.65)",
          }}
        >
          <Tape text={ROW_D} top={14} color={gold} durationS={31} delayS={4} />
          <Tape text={ROW_E} top={38} size={11} opacity={0.4} color={gold} durationS={28} delayS={10} />
          <Tape text={ROW_F} top={62} size={11} opacity={0.26} color={gold} durationS={35} delayS={2} />
        </div>
      </div>

      {/* Ledger cover — a thin dark lip under both pages so the spine reads
          as sitting IN a closed book, not floating on two flat planes. */}
      <div
        className="absolute inset-x-[-3%] bottom-[-10px] h-[11px] rounded-b-[8px]"
        style={{ background: "linear-gradient(180deg, #0a0d12, #05070a)", transform: "rotateX(38deg) translateZ(-4px)", opacity: 0.9 }}
      />
      </div>
    </div>
  );
}
