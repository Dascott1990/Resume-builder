"use client";
/**
 * Settings.js — the one place to manage every account this app has, full
 * stop. Before this existed, account management was scattered across a
 * raw sign-in/out toggle in Dashboard.js's header (customer-only), a
 * separate "Sign out" link buried in ArtisanDashboard.js, and no
 * profile-editing or password-change UI anywhere for either account.
 *
 * The app runs two entirely independent account systems — a customer
 * session (lib/useAuth.js, Authorization: Bearer) and an artisan session
 * (lib/artisanAuthToken.js, X-Artisan-Token) — a browser can be signed
 * into both at once. This screen shows both, whichever ones are
 * currently signed in, side by side instead of scattered across the app.
 * It hands off to the existing Login.js/Signup.js/ArtisanAuth.js screens
 * for actual sign-in rather than building a fourth login form.
 *
 * Same "home base" shape as ArtisanDashboard.js: motion fade-in, header
 * with IconTile + close, mono-label sections, Card content blocks.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, X, User, Wrench, Palette, LogOut, KeyRound,
  CheckCircle2, Loader2, Check, Smile, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import Emoji3D from "./shared/Emoji3D";
import { ThemeToggle } from "./shared/ThemeToggle";
import { tintFor, initialsOf } from "./shared/artisanDisplay";
import { TRADES } from "./shared/trades";
import { useAuth } from "@/lib/useAuth";
import { useAccentColor } from "@/lib/useAccentColor";
import { useBrightness } from "@/lib/useBrightness";
import { getArtisanToken, setArtisanToken } from "@/lib/artisanAuthToken";
import { artisanMe, artisanUpdateProfile, artisanChangePassword } from "./artisan/api";

const AVATAR_EMOJI = [
  "😀", "😎", "🤓", "🥳", "🦄", "🐱", "🐶", "🦊",
  "🐼", "🚀", "⭐", "🔥", "💪", "🎯", "🏆", "🎨",
  "⚡", "🌈", "☕", "🎸",
];

function Section({ icon: Icon, children }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
      <Icon className="size-3" /> {children}
    </div>
  );
}

function SignInPrompt({ icon: Icon, title, body, ctaLabel, onCta }) {
  return (
    <Card className="grid justify-items-center gap-2.5 p-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted">
        <Icon className="size-[18px] text-muted-foreground" />
      </div>
      <p className="m-0 text-[13.5px] font-bold text-foreground">{title}</p>
      <p className="m-0 max-w-[240px] text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
      <Btn small variant="gold" onClick={onCta}>{ctaLabel}</Btn>
    </Card>
  );
}

// Shared by both the customer and artisan account cards — same fields,
// same validation, just a different onSubmit(current, next) call.
function ChangePasswordForm({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-bold text-primary">
        <KeyRound className="size-3.5" /> Change password
      </button>
    );
  }

  const submit = async () => {
    if (next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (next !== confirm) { toast.error("New passwords don't match"); return; }
    setSubmitting(true);
    try {
      await onSubmit(current, next);
      toast.success("Password updated");
      setOpen(false); setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-2.5 rounded-lg border border-border p-3">
      <Field label="Current password" type="password" value={current} onChange={setCurrent} placeholder="••••••••" />
      <Field label="New password" type="password" value={next} onChange={setNext} placeholder="At least 8 characters" />
      <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} placeholder="Retype new password" />
      <div className="flex gap-2">
        <Btn small variant="gold" disabled={submitting} loading={submitting} onClick={submit}>Update password</Btn>
        <Btn small variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>Cancel</Btn>
      </div>
    </div>
  );
}

// Device-local, not account data — see accentColor.js. Every color already
// has a foreground pair tuned for contrast against it, same as the
// swatch's own fill, so the selected check mark stays readable on all 7.
function AccentColorPicker() {
  const { accent, setAccent, colors } = useAccentColor();
  return (
    <div className="flex flex-wrap gap-2.5">
      {colors.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={c.label}
          aria-pressed={accent === c.id}
          onClick={() => setAccent(c.id)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{
            background: c.primary,
            boxShadow: accent === c.id ? `0 0 0 2px var(--card), 0 0 0 4px ${c.primary}` : "none",
          }}
        >
          {accent === c.id && <Check className="size-4" style={{ color: c.foreground }} />}
        </button>
      ))}
    </div>
  );
}

// Device-local, same as accent color — see lib/brightness.js for why this
// is an overlay effect rather than something that can touch the real
// hardware backlight. 100 is neutral and has no visual/perf cost at all;
// dragging either direction fades in a dim or brightening overlay live.
function BrightnessSlider() {
  const { brightness, setBrightness, min, max, default: defaultValue } = useBrightness();
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="m-0 text-[12px] font-semibold text-muted-foreground">Screen brightness</p>
        <span className="font-mono text-[11px] text-muted-foreground/70">{brightness}%</span>
      </div>
      <input
        type="range" min={min} max={max} step={5} value={brightness}
        onChange={(e) => setBrightness(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-muted-foreground/45">Dimmer</span>
        {brightness !== defaultValue && (
          <button
            type="button"
            onClick={() => setBrightness(defaultValue)}
            className="border-none bg-transparent p-0 text-[10.5px] font-bold text-primary"
          >
            Reset
          </button>
        )}
        <span className="font-mono text-[9px] text-muted-foreground/45">Brighter</span>
      </div>
    </div>
  );
}

// A curated grid rather than a full emoji picker/search — this only ever
// needs to answer "pick a fun avatar," not "find any of 3000 emoji."
// Reveal-on-tap, same collapsed-link pattern as ChangePasswordForm.
function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-bold text-primary">
        <Smile className="size-3.5" /> {value ? "Change avatar emoji" : "Set an avatar emoji"}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="grid grid-cols-8 gap-1.5">
        {AVATAR_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={e}
            onClick={() => { onChange(e); setOpen(false); }}
            className={`flex size-8 items-center justify-center rounded-lg text-base ${value === e ? "bg-primary/15 ring-1 ring-primary" : ""}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {value ? (
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
            Remove
          </button>
        ) : <span />}
        <button type="button" onClick={() => setOpen(false)} className="border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
          Close
        </button>
      </div>
    </div>
  );
}

export default function Settings({ onClose, onOpenLogin, onOpenArtisanAuth }) {
  const { user, loading: authLoading, updateProfile, changePassword, logout } = useAuth();
  const [name, setName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState(null);
  const [statusLine, setStatusLine] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  useEffect(() => {
    setName(user?.name || "");
    setAvatarEmoji(user?.avatar_emoji || null);
    setStatusLine(user?.status_line || "");
  }, [user?.id, user?.name, user?.avatar_emoji, user?.status_line]);

  const [artisan, setArtisan] = useState(null);
  const [artisanLoading, setArtisanLoading] = useState(true);
  const [artisanForm, setArtisanForm] = useState(null);
  const [savingArtisan, setSavingArtisan] = useState(false);

  useEffect(() => {
    if (!getArtisanToken()) { setArtisan(null); setArtisanLoading(false); return; }
    artisanMe()
      .then((a) => { setArtisan(a); setArtisanForm(a); })
      .catch(() => { setArtisanToken(null); setArtisan(null); })
      .finally(() => setArtisanLoading(false));
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), avatar_emoji: avatarEmoji, status_line: statusLine.trim() });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveArtisanProfile = async () => {
    setSavingArtisan(true);
    try {
      const updated = await artisanUpdateProfile({
        name: artisanForm.name, trade: artisanForm.trade, city: artisanForm.city,
        phone: artisanForm.phone, email: artisanForm.email,
        years_experience: artisanForm.years_experience, bio: artisanForm.bio,
        avatar_emoji: artisanForm.avatar_emoji,
      });
      setArtisan(updated);
      setArtisanForm(updated);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingArtisan(false);
    }
  };

  // Instant, not bundled into "Save profile" — a preference toggle should
  // behave like ArtisanDashboard.js's availability Switch (takes effect
  // immediately), not sit half-changed until someone remembers to hit Save.
  const toggleArtisanNotify = async (field, checked) => {
    const previous = artisan[field];
    setArtisan((a) => ({ ...a, [field]: checked }));
    setArtisanForm((f) => ({ ...f, [field]: checked }));
    try {
      await artisanUpdateProfile({ [field]: checked });
    } catch (e) {
      setArtisan((a) => ({ ...a, [field]: previous }));
      setArtisanForm((f) => ({ ...f, [field]: previous }));
      toast.error(e.message);
    }
  };

  const artisanSignOut = () => {
    setArtisanToken(null);
    setArtisan(null);
    setArtisanForm(null);
    toast.success("Signed out");
  };

  const header = (
    <div className="flex shrink-0 items-center justify-between px-5 pb-3.5" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-3">
        <IconTile icon={SettingsIcon} size="sm" />
        <p className="m-0 font-serif text-[17px] italic text-foreground">Settings</p>
      </div>
      {onClose && (
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="size-5" />
        </Button>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans text-foreground"
    >
      {header}
      <div
        className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col gap-4 overflow-y-auto px-5"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div>
          <Section icon={Palette}>APPEARANCE</Section>
          <Card className="grid gap-3 p-3.5">
            <ThemeToggle />
            <div className="border-t border-border pt-3">
              <p className="m-0 mb-2 text-[12px] font-semibold text-muted-foreground">Accent color</p>
              <AccentColorPicker />
            </div>
            <div className="border-t border-border pt-3">
              <BrightnessSlider />
            </div>
          </Card>
        </div>

        <div>
          <Section icon={User}>ACCOUNT</Section>
          {authLoading ? (
            <Card className="flex items-center justify-center p-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </Card>
          ) : !user ? (
            <SignInPrompt
              icon={User} title="Not signed in"
              body="Sign in to save resumes and job applications across devices."
              ctaLabel="Sign in" onCta={onOpenLogin}
            />
          ) : (
            <Card className="grid gap-3 p-3.5">
              <div className="flex items-center gap-3">
                <div className={`flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border ${avatarEmoji ? "" : "font-mono text-sm font-bold"} ${tintFor(user.name || user.email)}`}>
                  {avatarEmoji ? <Emoji3D emoji={avatarEmoji} size={44} /> : initialsOf(user.name || user.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="m-0 truncate text-[13.5px] font-bold text-foreground">{user.name || "No name set"}</p>
                    {user.status_line && <span className="truncate text-[12px] text-primary">· {user.status_line}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] text-muted-foreground">{user.email}</span>
                    {user.email_verified && <CheckCircle2 className="size-3 shrink-0 text-[var(--success,#22c55e)]" />}
                  </div>
                </div>
              </div>

              <Field label="Name" hint="optional" placeholder="Your name" value={name} onChange={setName} />
              <Field label="Status" hint="optional" placeholder="Open to work" value={statusLine} onChange={setStatusLine} />
              <EmojiPicker value={avatarEmoji} onChange={setAvatarEmoji} />
              <Btn
                small variant="gold" className="justify-self-start"
                disabled={
                  savingProfile ||
                  (name.trim() === (user.name || "") &&
                    avatarEmoji === (user.avatar_emoji || null) &&
                    statusLine.trim() === (user.status_line || ""))
                }
                loading={savingProfile} onClick={saveProfile}
              >
                Save profile
              </Btn>

              <div className="border-t border-border pt-3">
                <ChangePasswordForm onSubmit={changePassword} />
              </div>

              <button type="button" onClick={logout} className="flex items-center gap-1.5 justify-self-start border-none bg-transparent p-0 text-[12.5px] font-semibold text-muted-foreground">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </Card>
          )}
        </div>

        <div>
          <Section icon={Wrench}>ARTISAN ACCOUNT</Section>
          {artisanLoading ? (
            <Card className="flex items-center justify-center p-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </Card>
          ) : !artisan ? (
            <SignInPrompt
              icon={Wrench} title="No artisan account"
              body="Sign in or list yourself to receive job requests."
              ctaLabel="Sign in as an artisan" onCta={onOpenArtisanAuth}
            />
          ) : (
            <Card className="grid gap-3 p-3.5">
              <div className="flex items-center gap-3">
                <div className={`flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border ${artisanForm.avatar_emoji ? "" : "font-mono text-sm font-bold"} ${tintFor(artisan.name)}`}>
                  {artisanForm.avatar_emoji ? <Emoji3D emoji={artisanForm.avatar_emoji} size={44} /> : initialsOf(artisan.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[13.5px] font-bold text-foreground">{artisan.name}</p>
                  <p className="m-0 text-[12px] text-muted-foreground">{artisan.trade}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 gap-1 rounded-full text-[10px] font-bold ${
                    artisan.is_available
                      ? "border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[var(--success,#22c55e)]"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {artisan.is_available ? "Available" : "Off"}
                </Badge>
              </div>

              <div className="grid gap-2 rounded-lg border border-border p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground">
                  <Bell className="size-3" /> NOTIFICATIONS
                </span>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-foreground">New job requests</span>
                  <Switch
                    checked={artisan.notify_new_request}
                    onCheckedChange={(checked) => toggleArtisanNotify("notify_new_request", checked)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-foreground">New messages</span>
                  <Switch
                    checked={artisan.notify_new_message}
                    onCheckedChange={(checked) => toggleArtisanNotify("notify_new_message", checked)}
                  />
                </div>
              </div>

              <Field label="Name" value={artisanForm.name || ""} onChange={(v) => setArtisanForm((f) => ({ ...f, name: v }))} />
              <EmojiPicker
                value={artisanForm.avatar_emoji}
                onChange={(e) => setArtisanForm((f) => ({ ...f, avatar_emoji: e }))}
              />
              <div className="mb-3.5">
                <div className="mb-1.5 text-[13.5px] font-bold tracking-wide text-foreground">Trade</div>
                <Select value={artisanForm.trade} onValueChange={(v) => setArtisanForm((f) => ({ ...f, trade: v }))}>
                  <SelectTrigger className="h-[52px] w-full rounded-[10px] text-base">
                    <SelectValue placeholder="Select a trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="City" hint="optional" value={artisanForm.city || ""} onChange={(v) => setArtisanForm((f) => ({ ...f, city: v }))} />
                <Field label="Years experience" type="number" value={artisanForm.years_experience ?? ""} onChange={(v) => setArtisanForm((f) => ({ ...f, years_experience: v }))} />
              </div>
              <Field label="Phone" type="tel" value={artisanForm.phone || ""} onChange={(v) => setArtisanForm((f) => ({ ...f, phone: v }))} />
              <Field label="Email" type="email" value={artisanForm.email || ""} onChange={(v) => setArtisanForm((f) => ({ ...f, email: v }))} />
              <Field label="Bio" hint="optional" multiline rows={3} value={artisanForm.bio || ""} onChange={(v) => setArtisanForm((f) => ({ ...f, bio: v }))} />

              <Btn small variant="gold" className="justify-self-start" disabled={savingArtisan} loading={savingArtisan} onClick={saveArtisanProfile}>
                Save profile
              </Btn>

              <div className="border-t border-border pt-3">
                <ChangePasswordForm onSubmit={artisanChangePassword} />
              </div>

              <button type="button" onClick={onOpenArtisanAuth} className="flex items-center gap-1 justify-self-start border-none bg-transparent p-0 text-[12.5px] font-bold text-primary">
                Manage requests &amp; availability →
              </button>

              <button type="button" onClick={artisanSignOut} className="flex items-center gap-1.5 justify-self-start border-none bg-transparent p-0 text-[12.5px] font-semibold text-muted-foreground">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
