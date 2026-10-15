"use client";
/**
 * app/brand/page.js — the brand toolkit's front door.
 *
 * Flat destinations, not a scrolling stack — switched via a fixed bottom
 * nav (components/premium/shared/BottomNav.js, the same one Dashboard.js
 * already uses) rather than a sticky top tab strip, so switching never
 * costs a scroll-to-top first. Each opens to exactly the one thing it's
 * for; nothing to scroll past to reach another tool.
 *
 * Today (the fixed status panel, see TodayPanel.js), Assets (logo exports
 * + this month's signature color), Create (the post composer), Story (the
 * multi-clip story composer), Capture (the screenshot studio) — the 5
 * tools someone actually reaches for daily. SEO (Search Console stats)
 * and Reference (the mark's own design rationale, read-only docs) used to
 * live in a "More" menu here; both got cut for being low-frequency
 * clutter competing with the daily tools. SEO stats still exist, just not
 * in this nav — see components/premium/brand/BrandWorkspaceView.js.
 *
 * Which destination was left open is remembered per device
 * (assetKit.js's loadBrandUiState/saveBrandUiState) so returning here
 * picks up exactly where someone left off.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/premium/Logo";
import { BottomNav } from "@/components/premium/shared/BottomNav";
import { Sparkles, Layers, Clapperboard, Camera, ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import { LogoDownloads } from "./LogoDownloads";
import { PostComposer } from "./PostComposer";
import { StoryComposer } from "./story/StoryComposer";
import { SignatureTheme } from "./SignatureTheme";
import { ScreenshotStudio } from "./ScreenshotStudio";
import { NotificationBell } from "./NotificationBell";
import { TodayPanel } from "@/components/premium/brand/TodayPanel";
import { apiRequest } from "@/components/premium/shared/api";
import { AdminGate } from "@/components/admin/AdminGate";
import { Btn } from "@/components/premium/guest/components/primitives";
import { DEFAULT_ACCENT } from "./postTemplates";
import { loadBrandUiState, saveBrandUiState } from "./assetKit";
import { useLanguage } from "@/lib/i18n";

// Colors only — the mark + wordmark already show in the header just
// above, so repeating them here would just be the same thing twice.
function AtAGlanceStrip() {
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {["#F6E6B3", "#f59e0b", "#5C4419"].map((hex) => (
        <span key={hex} className="size-3.5 rounded-full border border-border" style={{ background: hex }} />
      ))}
    </div>
  );
}

// "Today" first — not appended at the end. Its entire purpose is "here's
// what's happening," which by convention belongs where a returning
// visitor's eye lands first (see TodayPanel.js's own docstring).
const ZONES = [
  { id: "today", Icon: CalendarClock, label: "Today" },
  { id: "assets", Icon: Sparkles, label: "Assets" },
  { id: "create", Icon: Layers, label: "Create" },
  { id: "story", Icon: Clapperboard, label: "Story" },
  { id: "capture", Icon: Camera, label: "Capture" },
];

export default function BrandPage() {
  const { t } = useLanguage();
  return (
    <AdminGate title={t("brandShell.adminSignInTitle")} subtitle={t("brandShell.adminSignInSubtitle")}>
      {() => <BrandWorkspaceShell />}
    </AdminGate>
  );
}

function BrandWorkspaceShell() {
  const { t } = useLanguage();
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [zone, setZone] = useState("today");
  const [uiLoaded, setUiLoaded] = useState(false);
  // This product is single-tenant — there's exactly one "our workspace"
  // behind this whole page, not a per-visitor concept. Resolved once on
  // load via GET /workspace/default (auto-creates it the first time
  // anything needs it), no token in the URL. By the time this component
  // ever mounts, AdminGate (see the default export above) has already
  // confirmed a real admin session, and apiRequest already attaches that
  // same session's Authorization header to every request automatically
  // (see components/premium/shared/api.js) — nothing left to gate here.
  const [workspaceToken, setWorkspaceToken] = useState(null);
  const [workspaceError, setWorkspaceError] = useState(false);

  const loadWorkspace = () => {
    setWorkspaceError(false);
    apiRequest("/api/v1/workspace/default")
      .then((ws) => setWorkspaceToken(ws.token))
      .catch(() => setWorkspaceError(true));
  };
  useEffect(loadWorkspace, []);

  // Loaded after mount, never in a useState initializer — this file is
  // rendered on the server first (no localStorage there), so reading it
  // eagerly would mismatch whatever the client actually has stored. Same
  // "default first, hydrate for real in an effect" pattern this page's
  // own sub-components already use for the handle/signature theme.
  useEffect(() => {
    const stored = loadBrandUiState();
    setZone(stored.zone);
    setUiLoaded(true);
  }, []);

  useEffect(() => {
    if (!uiLoaded) return; // don't clobber the stored state with pre-load defaults
    saveBrandUiState({ zone });
  }, [zone, uiLoaded]);

  const zonesLocalized = ZONES.map((z) => ({ ...z, label: t(`brandShell.zone${z.id.charAt(0).toUpperCase()}${z.id.slice(1)}`) }));

  return (
    <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground">
      {/* padding-bottom is set inline below (clearance for the fixed
          BottomNav), which overrides any pb-* class here — so only pt-*
          is meaningful in this className. Kept intentionally small: this
          top padding is pure dead space before any zone's actual content
          starts. */}
      <div
        className="mx-auto w-full max-w-4xl px-6 pt-6 sm:px-10 sm:pt-10"
        style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back out to wherever "/" would already send someone —
                Dashboard for a returning visitor, the landing page for a
                first-time one (see app/page.js's own ENTERED_KEY switch)
                — so this never has to guess which one applies. */}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground no-underline hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> {t("personalProfile.back")}
            </Link>
            <Logo size={26} />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </div>

        <AtAGlanceStrip />

        {zone === "today" && (
          <div className="mt-4">
            {workspaceError ? (
              <div className="mx-auto max-w-sm rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
                <p className="m-0 mb-3 text-[13px] font-semibold text-destructive">{t("brandShell.couldntLoadWorkspace")}</p>
                <Btn small variant="ghost" onClick={loadWorkspace}>{t("brandShell.tryAgain")}</Btn>
              </div>
            ) : workspaceToken ? (
              <TodayPanel token={workspaceToken} />
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
          </div>
        )}

        {zone === "assets" && (
          <div className="mt-4 grid gap-6">
            <SignatureTheme onLockIn={setAccent} />
            <LogoDownloads />
          </div>
        )}

        {zone === "create" && (
          <div className="mt-4">
            <PostComposer accent={accent} />
          </div>
        )}

        {zone === "story" && (
          <div className="mt-4">
            <StoryComposer accent={accent} />
          </div>
        )}

        {zone === "capture" && (
          <div className="mt-4">
            <ScreenshotStudio />
          </div>
        )}
      </div>
      <BottomNav items={zonesLocalized} active={zone} onChange={setZone} />
    </div>
  );
}
