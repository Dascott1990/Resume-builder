"use client";
/**
 * app/brand/page.js — the design record for the Noqeev mark, kept as a
 * real route in this app (not an external doc) so it survives alongside
 * the code it describes and stays reviewable in git history the same way
 * everything else here does.
 *
 * Four flat destinations, not a scrolling stack — Assets (logo exports +
 * this month's signature color), Create (the post composer), Capture (the
 * screenshot studio), and Reference (the mark's own rationale, read-only).
 * Each opens to exactly the one thing it's for; nothing to scroll past to
 * reach another tool. Which destination — and which Reference sections —
 * were left open is remembered per device (assetKit.js's
 * loadBrandUiState/saveBrandUiState) so returning here picks up exactly
 * where someone left off.
 *
 * The shipped mark's preview below renders through the real
 * <LogoMark>/<Logo> components, not a hand-copied SVG duplicate — this
 * page can never drift out of sync with what the app actually ships.
 */
import { useEffect, useState } from "react";
import Logo, { LogoMark, MARK_PATH, MARK_STROKE } from "@/components/premium/Logo";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Type, Archive } from "lucide-react";
import { Section } from "./BrandSection";
import { LogoDownloads } from "./LogoDownloads";
import { PostComposer } from "./PostComposer";
import { SignatureTheme } from "./SignatureTheme";
import { ScreenshotStudio } from "./ScreenshotStudio";
import { NotificationBell } from "./NotificationBell";
import { DEFAULT_ACCENT } from "./postTemplates";
import { loadBrandUiState, saveBrandUiState } from "./assetKit";

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
    { px: 16, cap: "16px" },
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

// Colors only — the mark + wordmark already show in the header just
// above, so repeating them here would just be the same thing twice.
function AtAGlanceStrip() {
  return (
    <div className="mt-5 flex items-center gap-1.5">
      {["#F6E6B3", "#f59e0b", "#5C4419"].map((hex) => (
        <span key={hex} className="size-3.5 rounded-full border border-border" style={{ background: hex }} />
      ))}
    </div>
  );
}

export default function BrandPage() {
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [zone, setZone] = useState("assets");
  const [openSections, setOpenSections] = useState({ reference: ["mark"] });
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

  const isOpen = (id) => (openSections.reference || []).includes(id);
  const toggleSection = (id) => {
    setOpenSections((prev) => {
      const current = prev.reference || [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...prev, reference: next };
    });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground">
      <div className="mx-auto w-full max-w-4xl px-6 py-14 sm:px-10 sm:py-20">
        <div className="flex items-center justify-between">
          <Logo size={26} />
          <NotificationBell onGoToAssets={() => setZone("assets")} onGoToCreate={() => setZone("create")} />
        </div>

        <AtAGlanceStrip />

        <div className="sticky top-0 z-10 -mx-6 mt-8 overflow-x-auto bg-background/95 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10">
          <Tabs value={zone} onValueChange={setZone}>
            <TabsList>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="capture">Capture</TabsTrigger>
              <TabsTrigger value="reference">Reference</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {zone === "assets" && (
          <div className="mt-6 grid gap-6">
            <SignatureTheme onLockIn={setAccent} />
            <LogoDownloads />
          </div>
        )}

        {zone === "create" && (
          <div className="mt-6">
            <PostComposer accent={accent} />
          </div>
        )}

        {zone === "capture" && (
          <div className="mt-6">
            <ScreenshotStudio />
          </div>
        )}

        {zone === "reference" && (
          <div className="mt-6 grid gap-6">
            {/* ── Shipped mark ── */}
            <Section
              icon={Sparkles}
              eyebrow="Shipped"
              title="Ascending Q"
              open={isOpen("mark")}
              onOpenChange={() => toggleSection("mark")}
            >
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex size-32 shrink-0 items-center justify-center rounded-2xl border border-border bg-background">
                  <LogoMark size={92} />
                </div>
                <div className="grid gap-4">
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-[#0a0a0a] px-5 py-4">
                    <Logo size={26} />
                  </div>

                  <SizeProof path={MARK_PATH} stroke={MARK_STROKE} />

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
              open={isOpen("wordmark")}
              onOpenChange={() => toggleSection("wordmark")}
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
            </Section>

            {/* ── Explored, set aside ── */}
            <Section
              icon={Archive}
              eyebrow="Rejected"
              open={isOpen("explored")}
              onOpenChange={() => toggleSection("explored")}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-6">
                  <div className="mb-4 flex size-24 items-center justify-center rounded-xl border border-border bg-[#0a0a0a]">
                    <RisingLinesPreview />
                  </div>
                  <h3 className="m-0 text-[15px] font-bold text-foreground">Rising Lines</h3>
                  <p className="m-0 mt-1 text-[12px] text-muted-foreground">Too easy to copy</p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-6">
                  <div className="mb-4 flex size-24 items-center justify-center rounded-xl border border-border bg-[#0a0a0a]">
                    <TurningPointPreview />
                  </div>
                  <h3 className="m-0 text-[15px] font-bold text-foreground">Turning Point</h3>
                  <p className="m-0 mt-1 text-[12px] text-muted-foreground">Too generic a shape</p>
                </div>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
