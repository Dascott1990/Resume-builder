"use client";
/**
 * NotificationsDialog.js — the real notifications UI (Apply with AI run
 * updates — submitted/failed/cancelled/expired), shared by every screen
 * that mounts a notification-bell icon (Dashboard.js, JobsBoard.js, ...)
 * instead of a second hand-copy or a stub that just navigates elsewhere.
 * Pass the same `items`/`onOpenItem` shape useUnreadNotifications already
 * produces everywhere else it's used.
 */
import { Check, AlertTriangle, X, Inbox } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";

// Apply with AI's own item shape — the only kind useUnreadNotifications
// surfaces now that the artisan-message side of that hook is gone.
function applyRunNotifCopy(run, t) {
  let company = t("notif.thatApplication");
  try { company = new URL(run.target_url).hostname.replace(/^www\./, ""); } catch { /* keep the fallback */ }
  const map = {
    submitted: { Icon: Check, title: t("notif.submittedTitle", { company }), subtitle: t("notif.submittedSubtitle") },
    failed: { Icon: AlertTriangle, title: t("notif.failedTitle", { company }), subtitle: run.error_message || t("notif.failedSubtitle") },
    cancelled: { Icon: X, title: t("notif.cancelledTitle", { company }), subtitle: t("notif.nothingSubmitted") },
    expired: { Icon: AlertTriangle, title: t("notif.expiredTitle", { company }), subtitle: t("notif.nothingSubmitted") },
  };
  return map[run.status] || map.failed;
}

export function NotificationsDialog({ open, onClose, items, onOpenItem }) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex max-h-[70dvh] w-full max-w-[420px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <div className="shrink-0 border-b border-border p-4">
          <p className="m-0 text-lg font-bold text-foreground">{t("notif.title")}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="grid justify-items-center gap-2.5 px-5 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
                <Inbox className="size-[18px] text-muted-foreground" />
              </div>
              <p className="m-0 text-sm font-bold text-foreground">{t("notif.allCaughtUp")}</p>
            </div>
          ) : (
            items.map((it, i) => {
              const { Icon, title, subtitle } = applyRunNotifCopy(it.run, t);
              return (
                <motion.button
                  key={it.run.id}
                  type="button"
                  onClick={() => onOpenItem(it)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 6) * 0.03 }}
                  className="flex w-full items-start gap-3 border-b border-border p-4 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-bold text-foreground">{title}</p>
                    <p className="m-0 mt-0.5 truncate text-[12px] text-muted-foreground">{subtitle}</p>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
