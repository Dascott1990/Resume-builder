"use client";
/**
 * ArtisanAuth.js — sign in or create an artisan account. Separate from the
 * customer-facing Login/Signup (lib/useAuth) — see lib/artisanAuthToken.js
 * for why these are two independent sessions in the same browser.
 *
 * Visually mirrors Login.js's polish (amber glow, staggered entrance) —
 * same brand, same inspiration, just a different door in. The hero icon is
 * the existing Logo3D mark (see Logo3D.js) rather than a new asset: it
 * already carries its own WebGL-support check and three-layer fallback to
 * the flat 2D mark, so reusing it here costs nothing new and keeps every
 * "welcome" moment in the app speaking the same visual language.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, Wrench } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Btn } from "../guest/components/primitives";
import Logo3D from "../Logo3D";
import { TRADES } from "../shared/trades";
import { setArtisanToken } from "@/lib/artisanAuthToken";
import { artisanSignup, artisanLogin } from "./api";

const emptySignup = { name: "", trade: "", city: "", phone: "", email: "", password: "" };

export default function ArtisanAuth({ onClose, onSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(emptySignup);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const doLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setSubmitting(true);
    try {
      const data = await artisanLogin(email.trim(), password);
      setArtisanToken(data.token);
      toast.success(`Welcome back, ${data.artisan.name}`);
      onSuccess?.(data.artisan);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const doSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!(form.name && form.trade && form.phone && form.email && form.password)) {
      setError("Name, trade, phone, email, and password are required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await artisanSignup(form);
      setArtisanToken(data.token);
      toast.success("Account created");
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
      className="absolute inset-0 z-50 flex flex-col overflow-y-auto bg-background font-sans"
    >
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.14, 0.26, 0.14] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[-12%] left-1/2 size-[420px] -translate-x-1/2"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)" }}
      />

      <div
        className="relative flex shrink-0 items-center justify-between px-5 pb-5"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2 text-[12.5px] font-bold tracking-wide text-muted-foreground">
          <Wrench className="size-3.5" /> ARTISAN
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
        )}
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
          <div className="mb-4 flex size-16 items-center justify-center">
            <Logo3D style={{ width: 64, height: 64, display: "block" }} />
          </div>
          <p className="m-0 font-serif text-[22px] italic text-foreground">
            {mode === "login" ? "Artisan sign in" : "List yourself for job requests"}
          </p>
          <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            {mode === "login"
              ? "Sign in to see and accept job requests near you."
              : "Get notified when someone nearby needs your trade — accept the ones you want."}
          </p>
        </motion.div>

        {mode === "login" ? (
          <motion.form
            key="login" onSubmit={doLogin} className="grid gap-1"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}
          >
            <Field label="EMAIL" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <Field label="PASSWORD" required type="password" value={password} onChange={setPassword} placeholder="••••••••" />

            {error && (
              <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                {error}
              </div>
            )}

            <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Btn>
          </motion.form>
        ) : (
          <motion.form
            key="signup" onSubmit={doSignup} className="grid gap-0"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}
          >
            <Field label="Full name" required value={form.name} onChange={set("name")} placeholder="Full name" />
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
            <Field label="City" hint="optional" value={form.city} onChange={set("city")} placeholder="City" />
            <Field label="Phone" required type="tel" value={form.phone} onChange={set("phone")} placeholder="(xxx) xxx-xxxx" />
            <Field label="Email" required type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
            <Field label="Password" required type="password" value={form.password} onChange={set("password")} placeholder="At least 8 characters" />

            {error && (
              <div role="alert" className="mb-3 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                {error}
              </div>
            )}

            <Btn variant="gold" type="submit" className="mt-1" disabled={submitting} loading={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Btn>
          </motion.form>
        )}

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.2 }}
          className="m-0 text-center text-[13px] text-muted-foreground"
        >
          {mode === "login" ? (
            <>New here?{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} className="border-none bg-transparent p-0 font-bold text-primary">
                Create an account
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="border-none bg-transparent p-0 font-bold text-primary">
                Sign in
              </button>
            </>
          )}
        </motion.p>
      </div>
    </motion.div>
  );
}
