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

function PostRow({ post, overdue }) {
  const platforms = post.handles.map((h) => PLATFORM_LABELS[h.platform] || h.platform).join(", ");
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${overdue ? "border-destructive/30 bg-destructive/[0.04]" : "border-border bg-background"}`}>
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

function Section({ icon: Icon, iconClass, label, empty, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-bold text-foreground">
        <Icon className={`size-3.5 ${iconClass}`} /> {label}
      </div>
      {children || <p className="m-0 text-[12px] text-muted-foreground">{empty}</p>}
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
      <div className="mb-6 flex items-center justify-center rounded-2xl border border-border bg-card py-8 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const todayPosts = posts.filter((p) => isToday(p.scheduled_at));
  const overduePosts = posts.filter(isOverdue);

  return (
    <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-4">
      <p className="m-0 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/70 uppercase">Today</p>

      <Section icon={CalendarClock} iconClass="text-primary" label="Scheduled today" empty="Nothing scheduled for today.">
        {todayPosts.length > 0 && (
          <div className="grid gap-1.5">
            {todayPosts.map((p) => <PostRow key={p.id} post={p} overdue={isOverdue(p)} />)}
          </div>
        )}
      </Section>

      <Section icon={PenLine} iconClass="text-primary" label="Working on now" empty="No drafts in progress on this browser.">
        {drafts.length > 0 && (
          <div className="grid gap-1.5">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <p className="m-0 min-w-0 truncate text-[12.5px] font-bold text-foreground">{d.name}</p>
                <p className="m-0 shrink-0 text-[11px] text-muted-foreground">
                  {d.layerCount} layer{d.layerCount === 1 ? "" : "s"} · {timeAgo(d.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={AlertTriangle} iconClass="text-destructive" label="Needs attention" empty="Nothing overdue.">
        {overduePosts.length > 0 && (
          <div className="grid gap-1.5">
            {overduePosts.map((p) => <PostRow key={p.id} post={p} overdue />)}
          </div>
        )}
      </Section>
    </div>
  );
}
