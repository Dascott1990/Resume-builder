"use client";
/**
 * app/brand/page.js — the design record for the Noqeev mark, kept as a
 * real route in this app (not an external doc) so it survives alongside
 * the code it describes and stays reviewable in git history the same way
 * everything else here does.
 *
 * Split into two zones so a visit only surfaces what it came for: Tools
 * (download/share, the monthly theme picker, the post composer, the
 * screenshot studio — working utilities) and Reference (the mark's own
 * rationale, the wordmark, the rejected-concept archive — read-only).
 * Both zones are made of collapsible sections rather than one continuous
 * scroll, and which zone/sections were left open is remembered per device
 * (see assetKit.js's loadBrandUiState/saveBrandUiState) so returning here
 * picks up exactly where someone left off.
 *
 * The shipped mark's preview below renders through the real
 * <LogoMark>/<Logo> components, not a hand-copied SVG duplicate — this
 * page can never drift out of sync with what the app actually ships.
 */
import { useEffect, useState } from "react";
import Logo, { LogoMark, MARK_PATH, MARK_STROKE } from "@/components/premium/Logo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Download, PenSquare, Camera, Type, Archive } from "lucide-react";
import { Section } from "./BrandSection";
import { LogoDownloads } from "./LogoDownloads";
import { PostComposer } from "./PostComposer";
import { SignatureTheme } from "./SignatureTheme";
import { ScreenshotStudio } from "./ScreenshotStudio";
import { DEFAULT_ACCENT } from "./postTemplates";
import { loadBrandUiState, saveBrandUiState } from "./assetKit";

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

// Always-visible, non-interactive — instant orientation on the mark,
// colors, and wordmark without opening anything (the Canva-brand-kit
// reference point: the summary sits up front, the deeper docs are below).
function AtAGlanceStrip() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/60 px-5 py-3.5 sm:gap-5">
      <LogoMark size={22} />
      <div className="flex items-center gap-1.5">
        {["#F6E6B3", "#f59e0b", "#5C4419"].map((hex) => (
          <span key={hex} className="size-3.5 rounded-full border border-border" style={{ background: hex }} />
        ))}
      </div>
      <span className="h-4 w-px bg-border" />
      <span style={{ fontFamily: "var(--font-wordmark)" }} className="text-[13px] font-extrabold tracking-[0.02em] text-foreground">
        NOQEEV
      </span>
      <span className="ml-auto text-[10.5px] text-muted-foreground/60">Brand kit at a glance</span>
    </div>
  );
}

export default function BrandPage() {
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [zone, setZone] = useState("tools");
  const [openSections, setOpenSections] = useState({ tools: ["download"], reference: ["mark"] });
  const [uiLoaded, setUiLoaded] = useState(false);

  // Loaded after mount, never in a useState initializer — this file is
  // rendered on the server first (no localStorage there), so reading it
  // eagerly would mismatch whatever the client actually has stored. Same
  // "default first, hydrate for real in an effect" pattern this page's
  // own sub-components already use for the handle/signature theme.
  useEffect(() => {
    const stored = loadBrandUiState();
    setZone(stored.zone);
    setOpenSections(stored.openSections);
    setUiLoaded(true);
  }, []);

  useEffect(() => {
    if (!uiLoaded) return; // don't clobber the stored state with pre-load defaults
    saveBrandUiState({ zone, openSections });
  }, [zone, openSections, uiLoaded]);

  const isOpen = (zoneKey, id) => (openSections[zoneKey] || []).includes(id);
  const toggleSection = (zoneKey, id) => {
    setOpenSections((prev) => {
      const current = prev[zoneKey] || [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...prev, [zoneKey]: next };
    });
  };

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

        <AtAGlanceStrip />

        <div className="sticky top-0 z-10 -mx-6 mt-8 bg-background/95 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10">
          <Tabs value={zone} onValueChange={setZone}>
            <TabsList>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="reference">Reference</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {zone === "tools" && (
          <div className="mt-6 grid gap-6">
            {/* ── This month's signature theme — docked, not a section to scroll past ── */}
            <SignatureTheme onLockIn={setAccent} />

            {/* ── Download & share ── */}
            <Section
              icon={Download}
              eyebrow="Download & share"
              description="Real files, generated on the spot from the same mark shipped in the app — never a stale export someone made once and forgot to update. Pick whichever fits: a profile photo, an icon on its own background, a banner, or the raw vector."
              open={isOpen("tools", "download")}
              onOpenChange={() => toggleSection("tools", "download")}
            >
              <LogoDownloads />
            </Section>

            {/* ── Create a post ── */}
            <Section
              icon={PenSquare}
              eyebrow="Create a post"
              description="Whoever's on posting duty today doesn't need a separate design tool — pick a shape, write the words (or let AI draft them), download it sized for wherever it's going. Colors, gradient, and type are already the brand's own; nothing to match by eye."
              open={isOpen("tools", "post")}
              onOpenChange={() => toggleSection("tools", "post")}
            >
              <PostComposer accent={accent} />
            </Section>

            {/* ── Screenshot studio ── */}
            <Section
              icon={Camera}
              eyebrow="Turn a real screen into a post"
              description="Capture an actual screen (or upload one), crop it, blur anything that shouldn't be public, drop it in a frame, sign it, ship it."
              open={isOpen("tools", "screenshot")}
              onOpenChange={() => toggleSection("tools", "screenshot")}
            >
              <ScreenshotStudio />
            </Section>
          </div>
        )}

        {zone === "reference" && (
          <div className="mt-6 grid gap-6">
            {/* ── Shipped mark ── */}
            <Section
              icon={Sparkles}
              eyebrow="Shipped"
              title="Ascending Q"
              open={isOpen("reference", "mark")}
              onOpenChange={() => toggleSection("reference", "mark")}
            >
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex size-32 shrink-0 items-center justify-center rounded-2xl border border-border bg-background">
                  <LogoMark size={92} />
                </div>
                <div className="grid gap-4">
                  <p className="m-0 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                    A squared bowl — a page, not a circle — with its tail broken loose: instead
                    of settling back down the way a real Q's tail does, it kicks up and out into
                    a flat-cut point. Legible as Noqeev's own initial at any size, which neither
                    of the other two directions could claim. One continuous stroked path, six
                    points, five straight segments — see the full rationale in Logo.js.
                  </p>

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
            </Section>

            {/* ── Wordmark / type ── */}
            <Section
              icon={Type}
              eyebrow="Wordmark"
              open={isOpen("reference", "wordmark")}
              onOpenChange={() => toggleSection("reference", "wordmark")}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
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
            </Section>

            {/* ── Explored, set aside ── */}
            <Section
              icon={Archive}
              eyebrow="Explored, set aside"
              open={isOpen("reference", "explored")}
              onOpenChange={() => toggleSection("reference", "explored")}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-6">
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

                <div className="rounded-2xl border border-border bg-background p-6">
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
            </Section>
          </div>
        )}

        <p className="m-0 mt-14 border-t border-border pt-5 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground/50">
          /brand — internal design reference, not linked from product navigation.
        </p>
      </div>
    </div>
  );
}
