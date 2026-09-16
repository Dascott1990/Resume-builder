"use client";
/**
 * app/brand/page.js — the design record for the Noqeev mark, kept as a
 * real route in this app (not an external doc) so it survives alongside
 * the code it describes and stays reviewable in git history the same way
 * everything else here does.
 *
 * Documents what actually shipped (Ascending Q, Unbounded wordmark — see
 * Logo.js and globals.css's --font-wordmark) and the two directions that
 * were explored and set aside, with the reasoning for each. The shipped
 * mark's preview below renders through the real <LogoMark>/<Logo>
 * components, not a hand-copied SVG duplicate — this page can never drift
 * out of sync with what the app actually ships.
 */
import { useState } from "react";
import Logo, { LogoMark, MARK_PATH, MARK_STROKE } from "@/components/premium/Logo";
import { IconTile } from "@/components/premium/shared/IconTile";
import { Sparkles, Download, PenSquare, Camera } from "lucide-react";
import { LogoDownloads } from "./LogoDownloads";
import { PostComposer } from "./PostComposer";
import { SignatureTheme } from "./SignatureTheme";
import { ScreenshotStudio } from "./ScreenshotStudio";
import { DEFAULT_ACCENT } from "./postTemplates";

function Eyebrow({ children }) {
  return (
    <p className="m-0 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/60 uppercase">
      {children}
    </p>
  );
}

function Swatch({ hex, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-[18px] shrink-0 rounded border border-border" style={{ background: hex }} />
      <span className="font-mono text-[11.5px] text-muted-foreground">{hex}{label ? ` — ${label}` : ""}</span>
    </div>
  );
}

function SizeProof({ path, stroke }) {
  const sizes = [
    { px: 28, cap: "28px" },
    { px: 20, cap: "20px" },
    { px: 16, cap: "16px — tab" },
  ];
  return (
    <div className="flex items-end gap-6">
      {sizes.map((s) => (
        <div key={s.px} className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 100 100" width={s.px} height={s.px}>
            <defs>
              <linearGradient id={`sp-${s.px}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F6E6B3" />
                <stop offset="38%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#5C4419" />
              </linearGradient>
            </defs>
            <path d={path} fill="none" stroke={`url(#sp-${s.px})`} strokeWidth={stroke} strokeLinecap="butt" strokeLinejoin="round" />
          </svg>
          <span className="font-mono text-[9.5px] whitespace-nowrap text-muted-foreground/60">{s.cap}</span>
        </div>
      ))}
    </div>
  );
}

// The two directions that were explored and set aside — hand-drawn here
// since they never became real components, unlike the shipped mark above.
function RisingLinesPreview() {
  return (
    <svg viewBox="0 0 100 100" width="88" height="88">
      <defs>
        <linearGradient id="rl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6E6B3" /><stop offset="38%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#5C4419" />
        </linearGradient>
      </defs>
      <g transform="rotate(-9 50 50)">
        <rect x="22" y="20" width="56" height="11" rx="5.5" fill="url(#rl)" />
        <rect x="22" y="37" width="40" height="11" rx="5.5" fill="url(#rl)" />
        <rect x="22" y="54" width="48" height="11" rx="5.5" fill="url(#rl)" />
        <rect x="22" y="71" width="28" height="11" rx="5.5" fill="url(#rl)" />
      </g>
    </svg>
  );
}
function TurningPointPreview() {
  return (
    <svg viewBox="0 0 100 100" width="88" height="88">
      <defs>
        <linearGradient id="tp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6E6B3" /><stop offset="38%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#5C4419" />
        </linearGradient>
      </defs>
      <path d="M 26 86 L 26 20 L 60 20 L 84 4 L 96 26 L 74 26 L 74 86 Z" fill="url(#tp)" />
      <rect x="36" y="46" width="28" height="5" rx="2.5" fill="#0a0a0a" opacity="0.28" />
      <rect x="36" y="58" width="20" height="5" rx="2.5" fill="#0a0a0a" opacity="0.28" />
    </svg>
  );
}

export default function BrandPage() {
  const [accent, setAccent] = useState(DEFAULT_ACCENT);

  return (
    <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground">
      <div className="mx-auto w-full max-w-4xl px-6 py-14 sm:px-10 sm:py-20">
        <div className="mb-3">
          <Logo size={26} />
        </div>
        <Eyebrow>Brand mark — design record</Eyebrow>
        <h1 className="m-0 mt-3 max-w-xl text-balance font-serif text-[30px] italic leading-tight text-foreground sm:text-[38px]">
          How the mark became Ascending Q.
        </h1>
        <p className="m-0 mt-4 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
          Three directions went into review for the Noqeev icon. One shipped. This page keeps
          the other two on record along with the reasoning, rather than letting a rejected
          direction just disappear once a decision's made.
        </p>

        {/* ── Applied ── */}
        <div className="mt-12 rounded-2xl border border-primary/25 bg-primary/[0.04] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <IconTile icon={Sparkles} size="sm" />
            <span className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-primary uppercase">Shipped</span>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="flex size-32 shrink-0 items-center justify-center rounded-2xl border border-border bg-card">
              <LogoMark size={92} />
            </div>
            <div className="grid gap-4">
              <div>
                <h2 className="m-0 text-[19px] font-bold text-foreground">Ascending Q</h2>
                <p className="m-0 mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                  A squared bowl — a page, not a circle — with its tail broken loose: instead
                  of settling back down the way a real Q's tail does, it kicks up and out into
                  a flat-cut point. Legible as Noqeev's own initial at any size, which neither
                  of the other two directions could claim. One continuous stroked path, six
                  points, five straight segments — see the full rationale in Logo.js.
                </p>
              </div>

              <div>
                <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">In the header lockup</p>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-[#0a0a0a] px-5 py-4">
                  <Logo size={26} />
                </div>
              </div>

              <div>
                <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Holds at real UI sizes</p>
                <SizeProof path={MARK_PATH} stroke={MARK_STROKE} />
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">
                <Swatch hex="#F6E6B3" />
                <Swatch hex="#f59e0b" label="primary" />
                <Swatch hex="#5C4419" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Download & share ── */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="mb-1 flex items-center gap-2">
            <IconTile icon={Download} size="sm" />
            <Eyebrow>Download &amp; share</Eyebrow>
          </div>
          <p className="m-0 mt-2 mb-5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Real files, generated on the spot from the same mark shipped in the app — never a
            stale export someone made once and forgot to update. Pick whichever fits: a profile
            photo, an icon on its own background, a banner, or the raw vector.
          </p>
          <LogoDownloads />
        </div>

        {/* ── This month's signature theme ── */}
        <div className="mt-6">
          <SignatureTheme onLockIn={setAccent} />
        </div>

        {/* ── Create a post ── */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="mb-1 flex items-center gap-2">
            <IconTile icon={PenSquare} size="sm" />
            <Eyebrow>Create a post</Eyebrow>
          </div>
          <p className="m-0 mt-2 mb-5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Whoever's on posting duty today doesn't need a separate design tool — pick a shape,
            write the words (or let AI draft them), download it sized for wherever it's going.
            Colors, gradient, and type are already the brand's own; nothing to match by eye.
          </p>
          <PostComposer accent={accent} />
        </div>

        {/* ── Screenshot studio ── */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="mb-1 flex items-center gap-2">
            <IconTile icon={Camera} size="sm" />
            <Eyebrow>Turn a real screen into a post</Eyebrow>
          </div>
          <p className="m-0 mt-2 mb-5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Capture an actual screen (or upload one), crop it, blur anything that shouldn't be
            public, drop it in a frame, sign it, ship it.
          </p>
          <ScreenshotStudio />
        </div>

        {/* ── Wordmark / type ── */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <Eyebrow>Wordmark</Eyebrow>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <span
              className="text-[34px] font-extrabold text-foreground"
              style={{ fontFamily: "var(--font-wordmark)", letterSpacing: "0.02em" }}
            >
              NOQEEV
            </span>
            <span className="font-mono text-[11.5px] text-muted-foreground">Unbounded · 800</span>
          </div>
          <p className="m-0 mt-3 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Unbounded's squared, geometric letterforms are the deliberate pairing with the
            mark's own squared bowl — icon and wordmark built from the same blocky, flat-edged
            vocabulary instead of an icon dropped in front of an unrelated UI font. Replaces
            the previous Helvetica Neue treatment; the app's body text stays on{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">--font-sans</code>{" "}
            unchanged — only the wordmark moved.
          </p>
        </div>

        {/* ── Explored, set aside ── */}
        <div className="mt-12">
          <Eyebrow>Explored, set aside</Eyebrow>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex size-24 items-center justify-center rounded-xl border border-border bg-[#0a0a0a]">
                <RisingLinesPreview />
              </div>
              <h3 className="m-0 text-[15px] font-bold text-foreground">Rising Lines</h3>
              <p className="m-0 mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Four bars shaped like a resume's own header block, tilted nine degrees so the
                stack itself reads as ascending. Closest in spirit to the app's own loading-
                skeleton bars — familiar fast, but the most literal of the three, and the
                easiest for a competitor to redraw without much effort.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex size-24 items-center justify-center rounded-xl border border-border bg-[#0a0a0a]">
                <TurningPointPreview />
              </div>
              <h3 className="m-0 text-[15px] font-bold text-foreground">Turning Point</h3>
              <p className="m-0 mt-2 text-[13px] leading-relaxed text-muted-foreground">
                A page whose top-right corner opens straight into an arrowhead — document and
                trajectory as one continuous outline. The fastest "resume → growth" read of
                the three, but also the closest to the category's common shorthand.
              </p>
            </div>
          </div>
        </div>

        <p className="m-0 mt-14 border-t border-border pt-5 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground/50">
          /brand — internal design reference, not linked from product navigation.
        </p>
      </div>
    </div>
  );
}
