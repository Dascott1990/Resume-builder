"use client";
/**
 * BrandWorkspaceView.js — the branding workspace: no login, no signup,
 * no account — the token in the URL (page.js's own ?ws=<token> deep
 * link, same shape as the bookmarklet's ?jd=) is the entire access
 * control, checked once on mount against GET /api/v1/workspace/me
 * (backend/app/api/brand_workspace.py) rather than trusted blind.
 *
 * Two zones, not one continuous scroll: Reference (the mark's own
 * rationale — read-only, doesn't touch the token/API at all) and Tools
 * (composer, downloads, scheduler — everything that actually reads/
 * writes this workspace's data). Switching zones is a plain toggle, not
 * a route change — there's nothing here worth deep-linking to a
 * sub-zone the way /brand/page.js's five-zone BottomNav does.
 */
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Type, Archive, Wrench, Layers, Clapperboard, AlertTriangle } from "lucide-react";
import Logo, { LogoMark, MARK_PATH, MARK_STROKE } from "@/components/premium/Logo";
import { Section } from "@/app/brand/BrandSection";
import { apiRequest } from "@/components/premium/shared/api";
import { WORKSPACE_TOKEN_HEADER, workspaceFetch } from "./workspaceApi";
import { ComposerTool } from "./ComposerTool";
import { LogoDownloads } from "@/app/brand/LogoDownloads";
import { StoryTool } from "./StoryTool";
import { SchedulerTool } from "./SchedulerTool";
import { TodayPanel } from "./TodayPanel";

function Swatch({ hex, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-[18px] shrink-0 rounded border border-border" style={{ background: hex }} />
      <span className="font-mono text-[11.5px] text-muted-foreground">{hex}{label ? ` — ${label}` : ""}</span>
    </div>
  );
}

function SizeProof({ path, stroke }) {
  const sizes = [{ px: 28 }, { px: 20 }, { px: 16 }];
  return (
    <div className="flex items-end gap-6">
      {sizes.map((s) => (
        <div key={s.px} className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 100 100" width={s.px} height={s.px}>
            <path d={path} fill="none" stroke="#f59e0b" strokeWidth={stroke} strokeLinecap="butt" strokeLinejoin="round" />
          </svg>
          <span className="font-mono text-[10px] text-muted-foreground">{s.px}px</span>
        </div>
      ))}
    </div>
  );
}

function ReferenceZone() {
  const [open, setOpen] = useState({ mark: true, wordmark: false, rejected: false });
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="grid gap-4">
      <Section icon={Sparkles} eyebrow="Shipped" title="Ascending Q" open={open.mark} onOpenChange={() => toggle("mark")}>
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

      <Section icon={Type} eyebrow="Wordmark" open={open.wordmark} onOpenChange={() => toggle("wordmark")}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[34px] font-extrabold text-foreground" style={{ fontFamily: "var(--font-wordmark)", letterSpacing: "0.02em" }}>
            NOQEEV
          </span>
          <span className="font-mono text-[11.5px] text-muted-foreground">Unbounded · 800</span>
        </div>
      </Section>

      <Section icon={Archive} eyebrow="Rejected concepts" open={open.rejected} onOpenChange={() => toggle("rejected")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-6">
            <div className="mb-4 flex size-24 items-center justify-center rounded-xl border border-border bg-[#0a0a0a]">
              <svg viewBox="0 0 100 100" width={48} height={48}>
                <path d="M15 75 L40 45 L60 60 L85 25" fill="none" stroke="#f59e0b" strokeWidth={7} strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="m-0 text-[15px] font-bold text-foreground">Rising Lines</h3>
            <p className="m-0 mt-1 text-[12px] text-muted-foreground">Too easy to copy</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-6">
            <div className="mb-4 flex size-24 items-center justify-center rounded-xl border border-border bg-[#0a0a0a]">
              <svg viewBox="0 0 100 100" width={48} height={48}>
                <circle cx="50" cy="50" r="30" fill="none" stroke="#f59e0b" strokeWidth={7} />
              </svg>
            </div>
            <h3 className="m-0 text-[15px] font-bold text-foreground">Turning Point</h3>
            <p className="m-0 mt-1 text-[12px] text-muted-foreground">Too generic a shape</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function ToolsZone({ token, workspace }) {
  const [open, setOpen] = useState({ composer: true, story: false, downloads: false, scheduler: false });
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="grid gap-4">
      <Section icon={Layers} eyebrow="Create" title="Post composer" open={open.composer} onOpenChange={() => toggle("composer")}>
        <ComposerTool token={token} />
      </Section>
      <Section icon={Clapperboard} eyebrow="Create" title="Story" open={open.story} onOpenChange={() => toggle("story")}>
        <StoryTool token={token} />
      </Section>
      <Section icon={Sparkles} eyebrow="Assets" title="Download & share" open={open.downloads} onOpenChange={() => toggle("downloads")}>
        <LogoDownloads />
      </Section>
      <Section icon={Wrench} eyebrow="Plan" title="Scheduler" open={open.scheduler} onOpenChange={() => toggle("scheduler")}>
        <SchedulerTool token={token} workspace={workspace} />
      </Section>
    </div>
  );
}

export function BrandWorkspaceView({ token, onClose }) {
  const [zone, setZone] = useState("tools");
  const [workspace, setWorkspace] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | invalid

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    workspaceFetch(token, "/api/v1/workspace/me")
      .then((data) => { setWorkspace(data); setStatus("ready"); })
      .catch(() => setStatus("invalid"));
  }, [token]);

  if (status === "loading") {
    return <div className="flex h-[100dvh] items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }
  if (status === "invalid") {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="m-0 text-[15px] font-bold text-foreground">This workspace link isn't valid.</p>
        <p className="m-0 text-[13px] text-muted-foreground">Check the link, or ask whoever shared it for a fresh one.</p>
        <button type="button" onClick={onClose} className="mt-2 text-[13px] font-semibold text-primary">Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-semibold text-muted-foreground no-underline hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back
          </button>
          <p className="m-0 min-w-0 truncate text-[13px] font-bold text-foreground">{workspace?.name || "Branding workspace"}</p>
        </div>

        {/* Fixed, always visible above both zones — not itself a zone,
            not collapsible, and not gated behind picking "Tools" first.
            See TodayPanel.js for why. */}
        <div className="mt-6">
          <TodayPanel token={token} />
        </div>

        {/* Two zones, not one continuous scroll — a plain toggle between
            them, not a route change (nothing here is worth deep-linking
            to a sub-zone). */}
        <div className="mb-6 flex gap-1.5 rounded-xl border border-border bg-card p-1">
          {[["tools", "Tools"], ["reference", "Reference"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setZone(id)} aria-pressed={zone === id}
              className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-bold ${zone === id ? "bg-primary/10 text-primary" : "bg-transparent text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {zone === "tools" ? <ToolsZone token={token} workspace={workspace} /> : <ReferenceZone />}
      </div>
    </div>
  );
}

export { WORKSPACE_TOKEN_HEADER };
