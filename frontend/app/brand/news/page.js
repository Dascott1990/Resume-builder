"use client";
/**
 * app/brand/news/page.js — the full view behind /brand's bell "See all".
 * Two genuinely different things, kept visually separate rather than
 * merged into one list:
 *
 * - Updates: admin-authored (backend/app/api/brand.py's BrandNews) — full
 *   CRUD here (edit, mark resolved/reopen, delete), since these are real
 *   posts an admin owns.
 * - World feed: auto-fetched technology (Hacker News), physics (arXiv),
 *   history (Wikipedia's "on this day") — refreshed on a timer server-
 *   side (utils/world_feed.py), read-only aside from dismissing an item
 *   nobody wants cluttering the list. Real external links, not summaries
 *   invented here.
 *
 * Admin-gated like the rest of the notification system — this isn't
 * customer-facing.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Check, Pencil, Trash2, X, Newspaper, Globe, Cpu, Atom, Landmark,
} from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Logo from "@/components/premium/Logo";

const CATEGORY_META = {
  world: { label: "World", Icon: Globe },
  tech: { label: "Technology", Icon: Cpu },
  physics: { label: "Physics", Icon: Atom },
  history: { label: "History", Icon: Landmark },
};

function timeAgo(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function UpdateRow({ item, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body || "");
  const [link, setLink] = useState(item.link || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const updated = await apiRequest(`/api/v1/brand/news/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), link: link.trim() }),
      });
      onSaved(updated);
      setEditing(false);
    } catch (e) {
      toast.error(e.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleResolved = async () => {
    try {
      const updated = await apiRequest(`/api/v1/brand/news/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !item.resolved }),
      });
      onSaved(updated);
    } catch (e) {
      toast.error(e.message || "Try again.");
    }
  };

  const remove = async () => {
    try {
      await apiRequest(`/api/v1/brand/news/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
    } catch (e) {
      toast.error(e.message || "Try again.");
    }
  };

  if (editing) {
    return (
      <div className="grid gap-2 rounded-xl border border-primary/30 bg-primary/[0.03] p-3.5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-[8px] text-[13px]" placeholder="Title" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="rounded-[8px] text-[13px]" placeholder="Details (optional)" />
        <Input value={link} onChange={(e) => setLink(e.target.value)} className="h-9 rounded-[8px] text-[13px]" placeholder="Link (optional)" />
        <div className="flex gap-1.5">
          <Btn small variant="gold" onClick={save} disabled={saving} loading={saving}>Save</Btn>
          <Btn small variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${item.resolved ? "border-border bg-card/60 opacity-60" : "border-border bg-card"}`}>
      <div className="min-w-0 flex-1">
        <p className={`m-0 text-[13.5px] font-bold ${item.resolved ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.title}</p>
        {item.body && <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{item.body}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground/60">{timeAgo(item.created_at)}</span>
          {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-[10.5px] font-semibold text-primary">Open link</a>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={toggleResolved} title={item.resolved ? "Reopen" : "Mark done"}
          className={`flex size-7 items-center justify-center rounded-lg ${item.resolved ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Check className="size-3.5" />
        </button>
        <button type="button" onClick={() => setEditing(true)} title="Edit" className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
          <Pencil className="size-3.5" />
        </button>
        <button type="button" onClick={remove} title="Delete" className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function WorldFeedRow({ item, onDeleted }) {
  const remove = async () => {
    try {
      await apiRequest(`/api/v1/brand/world-feed/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
    } catch (e) {
      toast.error(e.message || "Try again.");
    }
  };
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
      <div className="min-w-0 flex-1">
        <a href={item.url} target="_blank" rel="noreferrer" className="m-0 block text-[13px] font-semibold text-foreground no-underline hover:text-primary">
          {item.title}
        </a>
        {item.summary && <p className="m-0 mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.summary}</p>}
        <span className="mt-1 block text-[10.5px] text-muted-foreground/60">{timeAgo(item.published_at || item.fetched_at)}</span>
      </div>
      <button type="button" onClick={remove} title="Dismiss"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export default function BrandNewsPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [feed, setFeed] = useState([]);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    apiRequest("/api/v1/admin/me")
      .then(() => { setIsAdmin(true); loadUpdates(); loadFeed(); })
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUpdates = () => apiRequest("/api/v1/brand/news").then(setUpdates).catch(() => {});
  const loadFeed = () => apiRequest("/api/v1/brand/world-feed").then(setFeed).catch(() => {});

  const shownFeed = category === "all" ? feed : feed.filter((f) => f.category === category);

  if (checking) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <Logo size={24} />
        <p className="m-0 text-[13.5px] text-muted-foreground">Admin sign-in required.</p>
        <Link href="/admin" className="text-[13px] font-semibold text-primary no-underline">Go to admin →</Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground">
      <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:px-10 sm:py-14">
        <Link href="/brand" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground no-underline hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Brand kit
        </Link>

        <div className="mb-8">
          <p className="m-0 mb-4 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/60 uppercase">Updates</p>
          {updates.length === 0 ? (
            <p className="m-0 text-[13px] text-muted-foreground">No updates yet.</p>
          ) : (
            <div className="grid gap-2">
              {updates.map((u) => (
                <UpdateRow
                  key={u.id} item={u}
                  onSaved={(next) => setUpdates((list) => list.map((x) => (x.id === next.id ? next : x)))}
                  onDeleted={(id) => setUpdates((list) => list.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/60 uppercase">
              <Newspaper className="size-3.5" /> World feed
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCategory("all")} aria-pressed={category === "all"}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${category === "all" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                All
              </button>
              {Object.entries(CATEGORY_META).map(([id, m]) => (
                <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${category === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                  <m.Icon className="size-3" /> {m.label}
                </button>
              ))}
            </div>
          </div>
          {shownFeed.length === 0 ? (
            <p className="m-0 text-[13px] text-muted-foreground">Nothing here yet — refreshes automatically every few minutes.</p>
          ) : (
            <div className="grid gap-2">
              {shownFeed.map((item) => (
                <WorldFeedRow key={item.id} item={item} onDeleted={(id) => setFeed((list) => list.filter((x) => x.id !== id))} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
