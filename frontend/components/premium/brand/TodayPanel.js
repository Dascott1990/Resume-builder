"use client";
/**
 * TodayPanel.js — the branding workspace's fixed, always-visible "what's
 * going on right now" summary. Three fixed questions, answered from data
 * that already exists — never generated, never an open-ended question box:
 *
 * 1. Scheduled today — GET /scheduled-posts (already fetched by
 *    SchedulerTool.js elsewhere), filtered to today's LOCAL calendar date
 *    at render time. One fetch on mount, no polling — this reads whatever
 *    is true the moment the panel is viewed, same "no new background
 *    infrastructure" reasoning the rest of this workspace follows.
 * 2. Working on now — assetKit.js's listPostDrafts(), which already reads
 *    every in-progress post straight out of this browser's localStorage.
 *    No server round-trip, no new storage — that system already existed
 *    for the Create zone's "My Posts" list.
 * 3. Needs attention — the exact same overdue rule brand_scheduler.py's
 *    own /scheduled-posts/due-count route already uses server-side
 *    (status === "scheduled" && scheduled_at <= now), computed here
 *    client-side from the same list already fetched for #1, rather than
 *    a second network call.
 *
 * Deliberately read-only — this is a status summary, not the scheduler
 * itself (SchedulerTool.js is still where marking a handle posted lives).
 */
import { useEffect, useState } from "react";
import { CalendarClock, PenLine, AlertTriangle, Loader2 } from "lucide-react";
import { workspaceFetch } from "./workspaceApi";
import { PLATFORM_LABELS, CONTENT_TYPE_LABELS, fmtDateTime } from "./SchedulerTool";
import { listPostDrafts } from "@/app/brand/assetKit";

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isOverdue(post) {
  return post.status === "scheduled" && new Date(post.scheduled_at) <= new Date();
}

function timeAgo(ms) {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Same glass-surface material Dashboard.js's own recent-activity rows use
// (see globals.css) — this panel is the branding workspace's direct
// equivalent of that screen's "what's going on" content, so it gets the
// same row treatment instead of the flat bordered boxes it had before.
// Overdue keeps a destructive tint layered on top of the glass base —
// still the same red-means-needs-action signal the rest of the app uses,
// just not a flat solid fill underneath it anymore.
function PostRow({ post, overdue }) {
  const platforms = post.handles.map((h) => PLATFORM_LABELS[h.platform] || h.platform).join(", ");
  return (
    <div className={`glass-surface flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 ${overdue ? "glass-surface-danger" : ""}`}>
      <div className="min-w-0">
        <p className="m-0 truncate text-[12.5px] font-bold text-foreground">{post.title}</p>
        <p className="m-0 text-[11px] text-muted-foreground">
          {CONTENT_TYPE_LABELS[post.content_type] || post.content_type} · {fmtDateTime(post.scheduled_at)}
          {platforms ? ` · ${platforms}` : ""}
        </p>
      </div>
      {overdue && <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">Due</span>}
    </div>
  );
}

// One accent (amber, for what's scheduled — the section with a real due
// time), neutral for what's just in progress, and destructive-red for
// what needs attention (a real severity signal, not decoration). Matches
// Dashboard.js's own Quick Actions row — see QUICK_ACTION_COLORS there.
const SECTION_COLORS = {
  amber: "border-primary/25 bg-primary/10 text-primary",
  neutral: "border-border bg-muted/60 text-muted-foreground",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
};

function Section({ icon: Icon, color, label, empty, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${SECTION_COLORS[color]}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-[11.5px] font-bold text-foreground">{label}</span>
      </div>
      {children || <p className="m-0 pl-8 text-[12px] text-muted-foreground">{empty}</p>}
    </div>
  );
}

export function TodayPanel({ token }) {
  const [posts, setPosts] = useState(null); // null = loading
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    workspaceFetch(token, "/api/v1/workspace/scheduled-posts").then(setPosts).catch(() => setPosts([]));
    // Local, synchronous, no fetch — reads whatever's on this browser
    // right now, refreshed each time the panel mounts.
    setDrafts(listPostDrafts());
  }, [token]);

  if (posts === null) {
    return (
      <div className="glass-surface mb-6 flex items-center justify-center rounded-2xl py-8 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const todayPosts = posts.filter((p) => isToday(p.scheduled_at));
  const overduePosts = posts.filter(isOverdue);

  return (
    <div className="glass-surface mb-6 grid gap-4 rounded-2xl p-4">
      <p className="m-0 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/70 uppercase">Today</p>

      <Section icon={CalendarClock} color="amber" label="Scheduled today" empty="Nothing scheduled for today.">
        {todayPosts.length > 0 && (
          <div className="grid gap-1.5">
            {todayPosts.map((p) => <PostRow key={p.id} post={p} overdue={isOverdue(p)} />)}
          </div>
        )}
      </Section>

      <Section icon={PenLine} color="neutral" label="Working on now" empty="No drafts in progress on this browser.">
        {drafts.length > 0 && (
          <div className="grid gap-1.5">
            {drafts.map((d) => (
              <div key={d.id} className="glass-surface flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
                <p className="m-0 min-w-0 truncate text-[12.5px] font-bold text-foreground">{d.name}</p>
                <p className="m-0 shrink-0 text-[11px] text-muted-foreground">
                  {d.layerCount} layer{d.layerCount === 1 ? "" : "s"} · {timeAgo(d.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={AlertTriangle} color="destructive" label="Needs attention" empty="Nothing overdue.">
        {overduePosts.length > 0 && (
          <div className="grid gap-1.5">
            {overduePosts.map((p) => <PostRow key={p.id} post={p} overdue />)}
          </div>
        )}
      </Section>
    </div>
  );
}
