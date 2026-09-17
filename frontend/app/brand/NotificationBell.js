"use client";
/**
 * NotificationBell.js — real, locally-computed reminders only (no signal
 * exists yet is best left absent, not filled with placeholder copy):
 * no signature theme set this month, or nothing shipped in over a week.
 * Both read from data this page already tracks (assetKit.js's
 * loadSignatureTheme / loadLastShipped) — nothing invented.
 *
 * Deliberately doesn't attempt real push notifications or an external
 * "what's new" feed — those need actual infrastructure (a push
 * subscription endpoint + service worker handler, a real content source)
 * this page has no backing for yet, not a bell icon pretending to have it.
 */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { loadSignatureTheme, loadLastShipped } from "./assetKit";

const SHIP_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

export function NotificationBell({ onGoToAssets, onGoToCreate }) {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    const list = [];
    if (!loadSignatureTheme()) {
      list.push({ id: "theme", text: "No signature theme set this month", onClick: onGoToAssets });
    }
    const lastShipped = loadLastShipped();
    if (!lastShipped || Date.now() - lastShipped > SHIP_REMINDER_MS) {
      list.push({ id: "ship", text: "Nothing shipped in over a week", onClick: onGoToCreate });
    }
    setReminders(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-label="Reminders"
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" />
        {reminders.length > 0 && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 z-20 w-64 rounded-xl border border-border bg-card p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
            {reminders.length === 0 ? (
              <p className="m-0 p-3 text-[12.5px] text-muted-foreground">Nothing pending</p>
            ) : (
              reminders.map((r) => (
                <button
                  key={r.id} type="button"
                  onClick={() => { r.onClick?.(); setOpen(false); }}
                  className="block w-full rounded-lg p-2.5 text-left text-[12.5px] text-foreground hover:bg-muted"
                >
                  {r.text}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
