"use client";
/**
 * NotificationBell.js — a real task center behind /brand's bell, not a
 * hardcoded nudge. Overdue / today / upcoming / someday, add one with an
 * optional due date and calendar file, snooze it, check it off — the
 * same shape Things/Asana/Linear all converge on for "what's actually
 * due," because it's the shape that works. Recurring tasks (weekly post,
 * monthly theme) regenerate themselves the instant they're completed —
 * see backend/app/api/brand.py's PATCH handler.
 *
 * Below that: the team-authored news feed (real updates, not a
 * fabricated external one) and real Web Push — "Enable notifications"
 * opens an actual browser subscription; a due task or a posted update
 * both fan out a real push, delivered even with the tab closed. See
 * backend/app/utils/task_reminders.py for the scheduler that notices a
 * task come due with nobody in the app to see it happen.
 *
 * No admin gate — /brand is standalone, same as the rest of the page
 * (see api/brand.py's module docstring): unlisted in product nav is the
 * only thing keeping this from customers, not a login wall.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell, Send, BellRing, BellOff, Check, Plus, CalendarPlus, X, Clock, ArrowRight,
} from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { getToken } from "@/lib/authToken";
import { getBrandKey, setBrandKey } from "@/lib/brandKey";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "./assetKit";

const BASE = process.env.NEXT_PUBLIC_API_URL;

// A plain <a href> can't carry the Bearer token this endpoint requires —
// link navigation has no way to attach a custom Authorization header, so
// it would just hit a 403 instead of downloading. Fetching it ourselves
// (same downloadBlob pattern every other export on this page already
// uses) is what actually lets the token reach the request.
async function downloadTaskIcs(taskId, title) {
  const token = getToken();
  const brandKey = getBrandKey();
  const res = await fetch(`${BASE}/api/v1/brand/tasks/${taskId}/ics`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(brandKey ? { "X-Brand-Key": brandKey } : {}),
    },
  });
  if (!res.ok) throw new Error("Couldn't get that calendar file.");
  downloadBlob(await res.blob(), `${(title || "task").slice(0, 40).replace(/[^\w\- ]/g, "")}.ics`);
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function dateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketTasks(tasks) {
  const today = dateOnly(new Date());
  const buckets = { overdue: [], today: [], upcoming: [], noDate: [] };
  for (const t of tasks) {
    if (!t.due_at) { buckets.noDate.push(t); continue; }
    const d = dateOnly(new Date(t.due_at));
    if (d < today) buckets.overdue.push(t);
    else if (d.getTime() === today.getTime()) buckets.today.push(t);
    else buckets.upcoming.push(t);
  }
  buckets.upcoming.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  return buckets;
}

function dueLabel(iso) {
  const days = Math.round((dateOnly(new Date(iso)) - dateOnly(new Date())) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${-days}d overdue`;
  if (days < 7) return `In ${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function TaskRow({ task, overdue, onToggle, onSnooze, onDelete }) {
  return (
    <div className="group flex items-start gap-2 rounded-lg p-2 hover:bg-muted">
      <button type="button" onClick={() => onToggle(task, true)} aria-label="Mark done"
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-transparent hover:border-primary hover:text-primary">
        <Check className="size-3" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[12.5px] text-foreground">{task.title}</p>
        {task.due_at && (
          <span className={`text-[10.5px] font-semibold ${overdue ? "text-destructive" : "text-muted-foreground/70"}`}>
            {dueLabel(task.due_at)}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {task.due_at && (
          <>
            <button type="button" onClick={() => onSnooze(task)} title="Snooze 1 day" className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground">
              <Clock className="size-3" />
            </button>
            <button
              type="button" title="Add to calendar"
              onClick={() => downloadTaskIcs(task.id, task.title).catch((e) => toast.error(e.message))}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <CalendarPlus className="size-3" />
            </button>
          </>
        )}
        <button type="button" onClick={() => onDelete(task)} title="Delete" className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-destructive">
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}

function TaskSection({ label, tasks, overdue, ...handlers }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <p className="m-0 px-2 pt-2 pb-0.5 font-mono text-[9.5px] font-bold tracking-[0.1em] text-muted-foreground/50 uppercase">{label}</p>
      {tasks.map((t) => <TaskRow key={t.id} task={t} overdue={overdue} {...handlers} />)}
    </div>
  );
}

function QuickAddTask({ onAdded, onAuthError }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [recurring, setRecurring] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiRequest("/api/v1/brand/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), due_at: dueAt || undefined, recurring: recurring || undefined }),
      });
      setTitle(""); setDueAt(""); setRecurring(""); setOpen(false);
      onAdded();
    } catch (e) {
      if (!onAuthError?.(e)) toast.error(e.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-[12.5px] font-semibold text-primary hover:bg-muted">
        <Plus className="size-3.5" /> Add a task
      </button>
    );
  }
  return (
    <div className="grid gap-1.5 rounded-lg border border-border p-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="What needs doing"
        className="h-8 rounded-[6px] text-[12.5px]" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
      <div className="flex gap-1.5">
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
          className="h-8 flex-1 rounded-[6px] border border-border bg-transparent px-2 text-[11.5px] text-foreground" />
        <select value={recurring} onChange={(e) => setRecurring(e.target.value)}
          className="h-8 rounded-[6px] border border-border bg-transparent px-1.5 text-[11.5px] text-foreground">
          <option value="">Once</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <Btn small variant="gold" onClick={add} disabled={saving || !title.trim()} loading={saving}>Add</Btn>
    </div>
  );
}

function PushToggle() {
  const [state, setState] = useState("checking"); // checking | unsupported | off | on | busy

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setState("unsupported"); return; }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) { setState("off"); return; }
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    }).catch(() => setState("off"));
  }, []);

  const enable = async () => {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast.error("Notifications blocked."); setState("off"); return; }
      const { key } = await apiRequest("/api/v1/brand/push/vapid-public-key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const json = sub.toJSON();
      await apiRequest("/api/v1/brand/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState("on");
      toast.success("Notifications on.");
    } catch (e) {
      toast.error(e.message || "Couldn't enable notifications.");
      setState("off");
    }
  };

  const disable = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiRequest("/api/v1/brand/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      toast.error(e.message || "Try again.");
      setState("on");
    }
  };

  if (state === "unsupported") return null;
  if (state === "on") {
    return (
      <button type="button" onClick={disable} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-[12.5px] font-semibold text-primary hover:bg-muted">
        <BellRing className="size-3.5" /> Notifications on
      </button>
    );
  }
  return (
    <button type="button" onClick={enable} disabled={state === "busy" || state === "checking"}
      className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-[12.5px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">
      <BellOff className="size-3.5" /> {state === "busy" ? "…" : "Enable notifications"}
    </button>
  );
}

function NewsComposer({ onPosted, onAuthError }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sending, setSending] = useState(false);

  const post = async () => {
    if (!title.trim()) return;
    setSending(true);
    try {
      await apiRequest("/api/v1/brand/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setTitle(""); setOpen(false);
      onPosted();
      toast.success("Posted.");
    } catch (e) {
      if (!onAuthError?.(e)) toast.error(e.message || "Try again.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-[12.5px] font-semibold text-muted-foreground hover:bg-muted">
        <Send className="size-3.5" /> Post an update
      </button>
    );
  }
  return (
    <div className="flex gap-1.5 p-1">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="What's new"
        className="h-8 rounded-[6px] text-[12.5px]" onKeyDown={(e) => { if (e.key === "Enter") post(); }} />
      <Btn small variant="gold" onClick={post} disabled={sending} loading={sending}>Send</Btn>
    </div>
  );
}

// Tasks/news-write are the "genuinely internal-only" routes require_brand_key
// gates (see backend/app/utils/auth.py) — a shared secret, not a login, to
// match /brand's own no-login-wall design. Nothing in the browser knew that
// secret until now: this is the one place it gets entered and stashed
// locally so every apiRequest call can attach it (see shared/api.js).
function BrandKeyGate({ onUnlocked }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);

  const unlock = async () => {
    if (!value.trim()) return;
    setChecking(true);
    setBrandKey(value.trim());
    try {
      await apiRequest("/api/v1/brand/tasks"); // confirms the key is actually right before trusting it
      toast.success("Unlocked.");
      onUnlocked();
    } catch (e) {
      setBrandKey(null);
      toast.error(e.status === 401 ? "That key isn't right." : (e.message || "Try again."));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
      <p className="m-0 text-[12px] font-semibold text-foreground">Unlock tasks &amp; news</p>
      <p className="m-0 text-[11px] text-muted-foreground">This browser hasn't been given the brand key yet.</p>
      <div className="flex gap-1.5">
        <Input
          type="password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus autoComplete="off"
          placeholder="Brand key" className="h-8 rounded-[6px] text-[12.5px]"
          onKeyDown={(e) => { if (e.key === "Enter") unlock(); }}
        />
        <Btn small variant="gold" onClick={unlock} disabled={checking} loading={checking}>Unlock</Btn>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState({ open: [], done: [] });
  const [news, setNews] = useState([]);
  const [needsBrandKey, setNeedsBrandKey] = useState(false);

  const loadTasks = () => {
    apiRequest("/api/v1/brand/tasks")
      .then((d) => { setTasks(d); setNeedsBrandKey(false); })
      .catch((e) => { if (e.status === 401 || e.status === 503) setNeedsBrandKey(true); });
  };
  const loadNews = () => {
    apiRequest("/api/v1/brand/news").then(setNews).catch(() => setNews([]));
  };

  useEffect(() => {
    loadNews();
    loadTasks();
  }, []);

  // Shared by every write action below: a key that was valid a moment ago
  // (rotated on the backend, or just wrong) should re-lock instead of
  // repeating a confusing raw error every time.
  const onAuthError = (e) => {
    if (e.status === 401 || e.status === 503) { setBrandKey(null); setNeedsBrandKey(true); return true; }
    return false;
  };

  const toggleDone = async (task, done) => {
    setTasks((t) => ({ ...t, open: t.open.filter((x) => x.id !== task.id) })); // optimistic
    try {
      await apiRequest(`/api/v1/brand/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }),
      });
      loadTasks();
    } catch (e) {
      if (!onAuthError(e)) toast.error(e.message || "Try again.");
      loadTasks();
    }
  };
  const snoozeTask = async (task) => {
    try {
      await apiRequest(`/api/v1/brand/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snooze_days: 1 }),
      });
      loadTasks();
    } catch (e) { if (!onAuthError(e)) toast.error(e.message || "Try again."); }
  };
  const deleteTask = async (task) => {
    setTasks((t) => ({ ...t, open: t.open.filter((x) => x.id !== task.id) }));
    try {
      await apiRequest(`/api/v1/brand/tasks/${task.id}`, { method: "DELETE" });
    } catch (e) { if (!onAuthError(e)) toast.error(e.message || "Try again."); loadTasks(); }
  };

  const buckets = bucketTasks(tasks.open);
  const badgeCount = buckets.overdue.length + buckets.today.length;
  const hasBadge = badgeCount > 0 || news.length > 0;
  const taskHandlers = { onToggle: toggleDone, onSnooze: snoozeTask, onDelete: deleteTask };

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-label="Notifications"
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" />
        {hasBadge && (
          badgeCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9.5px] font-bold text-primary-foreground">
              {badgeCount}
            </span>
          ) : (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
          )
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 z-20 max-h-[75vh] w-80 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
            {needsBrandKey ? (
              <BrandKeyGate onUnlocked={loadTasks} />
            ) : (
              <>
                <QuickAddTask onAdded={loadTasks} onAuthError={onAuthError} />
                <TaskSection label="Overdue" tasks={buckets.overdue} overdue {...taskHandlers} />
                <TaskSection label="Today" tasks={buckets.today} {...taskHandlers} />
                <TaskSection label="Upcoming" tasks={buckets.upcoming} {...taskHandlers} />
                <TaskSection label="No date" tasks={buckets.noDate} {...taskHandlers} />
                {tasks.open.length === 0 && (
                  <p className="m-0 px-2 pb-1 text-[12.5px] text-muted-foreground">No open tasks</p>
                )}
              </>
            )}

            <div className="mt-1 border-t border-border pt-1">
              <p className="m-0 px-2 pt-1 pb-0.5 font-mono text-[9.5px] font-bold tracking-[0.1em] text-muted-foreground/50 uppercase">News</p>
              {news.slice(0, 3).map((n) => (
                <div key={n.id} className="rounded-lg p-2 text-[12.5px] text-foreground">
                  <p className={`m-0 font-semibold ${n.resolved ? "text-muted-foreground line-through" : ""}`}>{n.title}</p>
                  <p className="m-0 mt-0.5 text-[10.5px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                </div>
              ))}
              {/* World feed (tech/physics/history) only lives on the full
                  page — real, auto-fetched content deserves more room than
                  a dropdown, not a cramped preview of it here. */}
              <Link href="/brand/news" className="flex items-center gap-1 rounded-lg p-2 text-[12px] font-semibold text-primary no-underline hover:bg-muted">
                See all <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="mt-1 border-t border-border pt-1">
              <PushToggle />
              {!needsBrandKey && <NewsComposer onPosted={loadNews} onAuthError={onAuthError} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
