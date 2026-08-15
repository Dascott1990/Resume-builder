"use client";
/**
 * RequestJobModal.js — "Request this artisan": a customer requests one
 * specific, named artisan from their profile (see ArtisanProfile.js's
 * primary CTA). Targeted, not a broadcast — only `targetArtisan` ever sees
 * this request, and only they can accept or decline it (see
 * backend/app/api/requests.py's create_request/pool/decline).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ClipboardList } from "lucide-react";
import { apiRequest } from "../shared/api";
import { Field, Btn } from "../guest/components/primitives";
import { useAuth } from "@/lib/useAuth";
import BookingAuthGate from "./BookingAuthGate";

const emptyForm = { city: "", description: "", amount: "", contact_name: "", contact_phone: "", contact_email: "" };

export default function RequestJobModal({ open, onClose, targetArtisan }) {
  const { user, loading: authLoading } = useAuth();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...emptyForm, city: targetArtisan?.city || "" });
    setError("");
    setDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Pulled out of submit() so postRequest() can enforce it on its OWN,
  // not just trust that whoever called it already ran submit()'s checks.
  // That trust is exactly what broke: the auth-gate's onSuccess below used
  // to call postRequest() straight from a signed-in-elsewhere callback,
  // with zero re-validation — the one path a stale `form` (or a future
  // caller) could reach the backend with a missing amount and surface its
  // raw "amount_cents is required..." message instead of this one.
  const validate = () => {
    if (!form.description.trim() || !form.contact_name.trim() || !form.contact_phone.trim()) {
      setError("Description, your name, and phone are required.");
      return false;
    }
    const amountNum = parseFloat(form.amount);
    if (!form.amount.trim() || !Number.isFinite(amountNum) || amountNum < 1 || amountNum > 50000) {
      setError("Enter what you're offering to pay — between $1 and $50,000.");
      return false;
    }
    return true;
  };

  const postRequest = async () => {
    setError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { amount, ...rest } = form;
      await apiRequest("/api/v1/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // In whole cents, not dollars — see backend's create_request.
        // Math.round guards against float weirdness like 19.99 * 100
        // landing on 1998.9999999999998.
        body: JSON.stringify({ ...rest, amount_cents: Math.round(parseFloat(amount) * 100), artisan_id: targetArtisan.id }),
      });
      setDone(true);
      toast.success("Request sent");
    } catch (err) {
      setError(err.message || "Could not send this request. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    // Booking requires a signed-in customer account (see backend's
    // require_customer_scope) — check here rather than letting the
    // request 401, so a signed-out visitor gets a sign-in prompt instead
    // of a confusing error after they've already filled out the form.
    if (!user) {
      setAuthGateOpen(true);
      return;
    }
    await postRequest();
  };

  if (!targetArtisan) return null;

  return (
    <>
    <Dialog open={open && !authGateOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex max-h-[85dvh] w-full max-w-[440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <div className="min-h-0 overflow-y-auto overscroll-contain p-[22px] [-webkit-overflow-scrolling:touch]">
          <p className="m-0 mb-1 flex items-center gap-2 font-serif text-xl italic text-foreground">
            <ClipboardList className="size-[17px] text-primary" /> Request {targetArtisan.name}
          </p>
          <p className="m-0 mb-4 text-[12.5px] text-muted-foreground">{targetArtisan.trade}</p>

          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="m-0 text-sm font-bold text-foreground">Request sent</p>
              <p className="m-0 max-w-[300px] text-[12.5px] leading-relaxed text-muted-foreground">
                {targetArtisan.name} has been notified. Check "My requests" for updates.
              </p>
              <Btn small variant="gold" onClick={onClose}>Done</Btn>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-0">
              <Field label="City" hint="optional" placeholder="City" value={form.city} onChange={set("city")} />
              <Field label="Description" required multiline rows={3}
                placeholder="What do you need done?" value={form.description} onChange={set("description")} />
              <Field label="What you're offering to pay" required type="number" hint="held in escrow, released once you confirm the job's done"
                placeholder="150" value={form.amount} onChange={set("amount")} />
              <Field label="Your name" required placeholder="Full name" value={form.contact_name} onChange={set("contact_name")} />
              <Field label="Your phone" required type="tel" placeholder="(xxx) xxx-xxxx" value={form.contact_phone} onChange={set("contact_phone")} />
              <Field label="Your email" hint="optional" type="email" placeholder="you@example.com" value={form.contact_email} onChange={set("contact_email")} />

              {error && (
                <div role="alert" className="mb-3 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              <Btn variant="gold" type="submit" disabled={submitting || authLoading} loading={submitting}>
                {submitting ? "Sending…" : "Send request"}
              </Btn>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <BookingAuthGate
      open={authGateOpen}
      onClose={() => setAuthGateOpen(false)}
      onSuccess={() => { setAuthGateOpen(false); postRequest(); }}
    />
    </>
  );
}
