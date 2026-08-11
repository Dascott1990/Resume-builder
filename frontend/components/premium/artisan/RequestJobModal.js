"use client";
/**
 * RequestJobModal.js — the customer half of the "Uber/Lyft for artisans"
 * flow: post what you need, and any signed-in, available artisan whose
 * trade/city match (see backend/app/api/requests.py) can see it in their
 * pool and accept it. No target artisan is chosen here — this is a
 * broadcast to the matching pool, not a message to one specific person.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList } from "lucide-react";
import { apiRequest } from "../shared/api";
import { Field, Btn } from "../guest/components/primitives";
import { TRADES } from "../shared/trades";

const emptyForm = { trade: "", city: "", description: "", contact_name: "", contact_phone: "", contact_email: "" };

export default function RequestJobModal({ open, onClose, defaultTrade }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...emptyForm, trade: defaultTrade || "" });
    setError("");
    setDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.trade || !form.description.trim() || !form.contact_name.trim() || !form.contact_phone.trim()) {
      setError("Trade, description, your name, and phone are required.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setDone(true);
      toast.success("Request posted");
    } catch (err) {
      setError(err.message || "Could not post this request. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex max-h-[85dvh] w-full max-w-[440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <div className="min-h-0 overflow-y-auto overscroll-contain p-[22px] [-webkit-overflow-scrolling:touch]">
          <p className="m-0 mb-4 flex items-center gap-2 font-serif text-xl italic text-foreground">
            <ClipboardList className="size-[17px] text-primary" /> Post a job request
          </p>

          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="m-0 text-sm font-bold text-foreground">Request posted</p>
              <p className="m-0 max-w-[300px] text-[12.5px] leading-relaxed text-muted-foreground">
                Available {form.trade.toLowerCase()}s in your area have been notified. Check "My requests" for updates.
              </p>
              <Btn small variant="gold" onClick={onClose}>Done</Btn>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-0">
              <div className="mb-3.5">
                <div className="mb-1.5 text-[13.5px] font-bold tracking-wide text-foreground">
                  Trade<span className="text-primary"> *</span>
                </div>
                <Select value={form.trade} onValueChange={set("trade")}>
                  <SelectTrigger className="h-[52px] w-full rounded-[10px] text-base">
                    <SelectValue placeholder="Select a trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Field label="City" hint="optional" placeholder="City" value={form.city} onChange={set("city")} />
              <Field label="Description" required multiline rows={3}
                placeholder="What do you need done?" value={form.description} onChange={set("description")} />
              <Field label="Your name" required placeholder="Full name" value={form.contact_name} onChange={set("contact_name")} />
              <Field label="Your phone" required type="tel" placeholder="(xxx) xxx-xxxx" value={form.contact_phone} onChange={set("contact_phone")} />
              <Field label="Your email" hint="optional" type="email" placeholder="you@example.com" value={form.contact_email} onChange={set("contact_email")} />

              {error && (
                <div role="alert" className="mb-3 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              <Btn variant="gold" type="submit" disabled={submitting} loading={submitting}>
                {submitting ? "Posting…" : "Post request"}
              </Btn>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
