"use client";
/**
 * NotificationBell.js — three real things, nothing invented:
 *
 * 1. Locally-computed reminders (no signature theme this month, nothing
 *    shipped in a week) — read straight from data this page already
 *    tracks, see assetKit.js.
 * 2. The news feed — real admin-authored updates (backend/app/api/brand.py
 *    /news), not a fabricated external feed. Whoever's signed in as admin
 *    gets a small composer right here to post one.
 * 3. Real Web Push (VAPID) — "Enable notifications" opens an actual
 *    browser subscription and saves it server-side; posting a news item
 *    fans a real push out to everyone subscribed, delivered even with the
 *    tab closed. Needs a production service worker to actually receive a
 *    push — see ServiceWorkerRegister.js, which only registers outside
 *    dev — so this only round-trips for real on a deployed build, not
 *    `next dev`.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Send, BellRing, BellOff } from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import { loadSignatureTheme, loadLastShipped } from "./assetKit";

const SHIP_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function PushToggle({ isAdmin }) {
  const [state, setState] = useState("checking"); // checking | unsupported | off | on | busy

  useEffect(() => {
    if (!isAdmin) { setState("unsupported"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setState("unsupported"); return; }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) { setState("off"); return; }
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    }).catch(() => setState("off"));
  }, [isAdmin]);

  const enable = async () => {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast.error("Notifications blocked."); setState("off"); return; }
      const { key } = await apiRequest("/api/v1/brand/push/vapid-public-key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
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
      <button type="button" onClick={disable} className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left text-[12.5px] font-semibold text-primary hover:bg-muted">
        <BellRing className="size-3.5" /> Notifications on
      </button>
    );
  }
  return (
    <button type="button" onClick={enable} disabled={state === "busy" || state === "checking"}
      className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left text-[12.5px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">
      <BellOff className="size-3.5" /> {state === "busy" ? "…" : "Enable notifications"}
    </button>
  );
}

function NewsComposer({ onPosted }) {
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
      setTitle("");
      setOpen(false);
      onPosted();
      toast.success("Posted.");
    } catch (e) {
      toast.error(e.message || "Try again.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left text-[12.5px] font-semibold text-muted-foreground hover:bg-muted">
        <Send className="size-3.5" /> Post an update
      </button>
    );
  }
  return (
    <div className="flex gap-1.5 p-1.5">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="What's new"
        className="h-9 rounded-[8px] text-[12.5px]" onKeyDown={(e) => { if (e.key === "Enter") post(); }} />
      <Btn small variant="gold" onClick={post} disabled={sending} loading={sending}>Send</Btn>
    </div>
  );
}

export function NotificationBell({ onGoToAssets, onGoToCreate }) {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [news, setNews] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadNews = () => {
    apiRequest("/api/v1/brand/news").then(setNews).catch(() => setNews([]));
  };

  useEffect(() => {
    const list = [];
    if (!loadSignatureTheme()) list.push({ id: "theme", text: "No signature theme set this month", onClick: onGoToAssets });
    const lastShipped = loadLastShipped();
    if (!lastShipped || Date.now() - lastShipped > SHIP_REMINDER_MS) {
      list.push({ id: "ship", text: "Nothing shipped in over a week", onClick: onGoToCreate });
    }
    setReminders(list);
    loadNews();
    apiRequest("/api/v1/admin/me").then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = reminders.length > 0 || news.length > 0;

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-label="Notifications"
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" />
        {badge && <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 z-20 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
            {reminders.map((r) => (
              <button key={r.id} type="button" onClick={() => { r.onClick?.(); setOpen(false); }}
                className="block w-full rounded-lg p-2.5 text-left text-[12.5px] text-foreground hover:bg-muted">
                {r.text}
              </button>
            ))}

            {news.length > 0 && (
              <div className="mt-1 border-t border-border pt-1">
                {news.map((n) => (
                  n.link ? (
                    <a key={n.id} href={n.link} target="_blank" rel="noreferrer"
                      className="block rounded-lg p-2.5 text-[12.5px] text-foreground no-underline hover:bg-muted">
                      <p className="m-0 font-semibold">{n.title}</p>
                      <p className="m-0 mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                    </a>
                  ) : (
                    <div key={n.id} className="rounded-lg p-2.5 text-[12.5px] text-foreground">
                      <p className="m-0 font-semibold">{n.title}</p>
                      <p className="m-0 mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                    </div>
                  )
                ))}
              </div>
            )}

            {reminders.length === 0 && news.length === 0 && (
              <p className="m-0 p-3 text-[12.5px] text-muted-foreground">Nothing pending</p>
            )}

            {isAdmin && (
              <div className="mt-1 border-t border-border pt-1">
                <PushToggle isAdmin={isAdmin} />
                <NewsComposer onPosted={loadNews} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
