"use client";
/**
 * ArtisanQuickSetup.js — "Are you an artisan?" One screen, two required
 * fields (trade, phone), one button. Shown instead of the full
 * ArtisanAuth signup form when there's already a signed-in, verified
 * customer with no linked artisan account yet (see ArtisanDashboard.js's
 * sign-in gate) — everything else a signup would normally ask for (name,
 * email, a password) already exists on that customer session, so asking
 * for it again would just be re-stressing someone who already told this
 * app who they are once.
 *
 * No password field at all: this account is reached going forward the
 * same way it's reached right now, through the customer session (see
 * api/artisans.py's artisan_signup_via_customer/login-via-customer) — not
 * a second credential to invent and remember.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Btn } from "../guest/components/primitives";
import Logo3D from "../Logo3D";
import { TRADES } from "../shared/trades";
import { setArtisanToken } from "@/lib/artisanAuthToken";
import { artisanSignupViaCustomer } from "./api";

export default function ArtisanQuickSetup({ customerName, onSuccess, onUseDifferentAccount }) {
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!trade || !phone.trim()) {
      setError("Trade and phone are required.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await artisanSignupViaCustomer({ trade, phone: phone.trim(), city: city.trim() || undefined });
      setArtisanToken(data.token);
      toast.success("You're listed");
      onSuccess?.(data.artisan);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="relative flex h-full flex-col overflow-y-auto bg-background font-sans"
    >
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.14, 0.26, 0.14] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[-12%] left-1/2 size-[420px] -translate-x-1/2"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
          <div className="mb-4 flex size-16 items-center justify-center">
            <Logo3D style={{ width: 64, height: 64, display: "block" }} />
          </div>
          <p className="m-0 text-[22px] font-bold text-foreground">Are you an artisan?</p>
          <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            {customerName ? `Get job requests as ${customerName}` : "Get job requests"} — same account you're already signed into, no new password.
          </p>
        </motion.div>

        <motion.form
          onSubmit={submit} className="grid gap-0"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}
        >
          <div className="mb-3.5">
            <div className="mb-1.5 text-[13.5px] font-bold tracking-wide text-foreground">
              Trade<span className="text-primary"> *</span>
            </div>
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger className="h-[52px] w-full rounded-[10px] text-base">
                <SelectValue placeholder="Select a trade" />
              </SelectTrigger>
              <SelectContent>
                {TRADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Field label="Phone" required type="tel" value={phone} onChange={setPhone} placeholder="(xxx) xxx-xxxx" autoComplete="tel" />
          <Field label="City" hint="optional" value={city} onChange={setCity} placeholder="City" autoComplete="address-level2" />

          {error && (
            <div role="alert" className="mb-3 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
              {error}
            </div>
          )}

          <Btn variant="gold" type="submit" className="mt-1" disabled={submitting} loading={submitting}>
            {submitting ? "Listing you…" : "Yes, list me"}
          </Btn>
        </motion.form>

        {onUseDifferentAccount && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.2 }}
            className="m-0 text-center text-[13px] text-muted-foreground"
          >
            Not you?{" "}
            <button onClick={onUseDifferentAccount} className="border-none bg-transparent p-0 font-bold text-primary">
              Use a different artisan account
            </button>
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
