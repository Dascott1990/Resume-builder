"use client";
/**
 * EmailAssetButton.js — "email this once it's ready to post": a shared
 * button used by both PostComposer.js and ScreenshotStudio.js. Deliberately
 * a real backend round-trip (POST /api/v1/brand/email-asset), not a
 * mailto: link — a mailto: can't carry a real image attachment, only text,
 * which would leave whoever's shipping this to a platform re-downloading
 * the file separately anyway.
 *
 * Remembers the last address used (same plain localStorage pattern as
 * assetKit.js's handle/theme persistence) so sending to the same person
 * twice in a row isn't retyping an email address every time.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Btn } from "@/components/premium/guest/components/primitives";
import { apiRequest } from "@/components/premium/shared/api";
import { blobToDataUrl } from "./assetKit";

const LAST_EMAIL_KEY = "noqeev_brand_last_email";

export function EmailAssetButton({ getBlob, filename, label }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(LAST_EMAIL_KEY) || ""; } catch { return ""; }
  });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.error("Invalid email.");
      return;
    }
    setSending(true);
    try {
      const blob = await getBlob();
      const dataUrl = await blobToDataUrl(blob);
      await apiRequest("/api/v1/brand/email-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: email.trim(),
          filename,
          note: label ? `Your ${label} post is attached — ready to ship.` : undefined,
          image_data_url: dataUrl,
        }),
      });
      try { localStorage.setItem(LAST_EMAIL_KEY, email.trim()); } catch { /* best-effort */ }
      toast.success(`Sent to ${email.trim()}`);
      setOpen(false);
    } catch (e) {
      toast.error(e.message || "Send failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Btn small variant="ghost" onClick={() => setOpen(true)} aria-label="Email this">
        <Mail className="size-4" />
      </Btn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton className="w-full max-w-[380px] gap-0 p-0 sm:max-w-[380px]">
          <div className="p-5">
            <p className="m-0 mb-3 flex items-center gap-2 text-[14px] font-bold text-foreground">
              <Mail className="size-4 text-primary" /> Email
            </p>
            <Input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className="h-11 rounded-[10px]" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            <Btn variant="gold" className="mt-3 w-full" onClick={send} disabled={sending} loading={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : "Send"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
