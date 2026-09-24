"use client";
/**
 * ArtisanListingManager.js — a real, standalone "Edit profile" page for
 * an artisan's listing. Not a dashboard screen wearing a different
 * title: no IconTile branding badge, no card chrome, no status pill —
 * those belong to ArtisanDashboard.js, which is about running the
 * business day to day. This page has exactly one job (edit what a
 * customer sees: photo, details, portfolio, in that order) and looks
 * like it — plain header, one flowing column, a save bar that only
 * appears once there's actually something to save.
 *
 * The completion checklist below is computed entirely from real,
 * already-saved fields (photo, bio, city, years, ≥1 portfolio photo) —
 * not a fabricated "profile strength" metric with its own hidden model.
 * Deliberately excludes anything this marketplace has no real backend
 * for: a separate business name, a second category, a URL slug, an
 * Active/Pending/Draft status, a website field, operating hours,
 * address autocomplete, or a custom-attributes checklist (Wi-Fi,
 * wheelchair access, etc.) — none of that exists on the Artisan model,
 * and a control with no real action behind it is worse than no control.
 *
 * Reachable from ArtisanDashboard.js and from Settings.js's artisan
 * summary card — same screen either door.
 *
 * Deliberately does NOT include: availability toggle, notifications,
 * change-password, sign out, delete listing — those stay exactly where
 * they already live (the Dashboard, Settings) rather than tripling every
 * action across three screens. This page is content, not account admin.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Camera, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../guest/components/primitives";
import Emoji3D from "../shared/Emoji3D";
import { EmojiPicker } from "../shared/EmojiPicker";
import PortfolioGrid from "./PortfolioGrid";
import ArtisanProfile from "../ArtisanProfile";
import { tintFor, initialsOf, avatarPhotoUrl } from "../shared/artisanDisplay";
import { TRADES } from "../shared/trades";
import { usePortfolioPhotos } from "./usePortfolioPhotos";
import { artisanMe, artisanUpdateProfile, artisanUploadAvatarPhoto, artisanDeleteAvatarPhoto } from "./api";

const BIO_MAX = 600;
const EDITABLE_FIELDS = ["name", "trade", "city", "phone", "email", "years_experience", "bio", "avatar_emoji"];

export default function ArtisanListingManager({ onClose }) {
  const [artisan, setArtisan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const avatarFileInputRef = useRef(null);
  const cityFieldRef = useRef(null);
  const yearsFieldRef = useRef(null);
  const bioFieldRef = useRef(null);
  const photosSectionRef = useRef(null);

  const { photos, uploading: photoUploading, upload: uploadPhoto, remove: removePhoto, move: movePhoto } =
    usePortfolioPhotos(artisan?.id, null);

  useEffect(() => {
    artisanMe()
      .then((a) => { setArtisan(a); setForm(a); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(() => {
    if (!artisan || !form) return false;
    return EDITABLE_FIELDS.some((k) => (form[k] ?? "") !== (artisan[k] ?? ""));
  }, [artisan, form]);

  // What's actually missing, computed from real saved fields — no
  // separate "completion" model to drift out of sync with the profile
  // itself. Each item focuses the field it's about when tapped.
  const checklist = useMemo(() => {
    if (!artisan) return [];
    const items = [
      { done: artisan.has_avatar_photo || !!artisan.avatar_emoji, label: "Add a profile photo", onGo: () => avatarFileInputRef.current?.click() },
      { done: !!artisan.city, label: "Add your city", onGo: () => { cityFieldRef.current?.scrollIntoView({ block: "center" }); cityFieldRef.current?.focus(); } },
      { done: artisan.years_experience != null, label: "Add years of experience", onGo: () => { yearsFieldRef.current?.scrollIntoView({ block: "center" }); yearsFieldRef.current?.focus(); } },
      { done: !!artisan.bio, label: "Write a short bio", onGo: () => { bioFieldRef.current?.scrollIntoView({ block: "center" }); bioFieldRef.current?.focus(); } },
      { done: (photos?.length || 0) > 0, label: "Upload a photo of your work", onGo: () => photosSectionRef.current?.scrollIntoView({ block: "start" }) },
    ];
    return items;
  }, [artisan, photos]);
  const doneCount = checklist.filter((c) => c.done).length;
  const complete = checklist.length > 0 && doneCount === checklist.length;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await artisanUpdateProfile({
        name: form.name, trade: form.trade, city: form.city,
        phone: form.phone, email: form.email,
        years_experience: form.years_experience, bio: form.bio,
        avatar_emoji: form.avatar_emoji,
      });
      setArtisan(updated);
      setForm(updated);
      toast.success("Saved");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be 5MB or smaller."); return; }
    setAvatarUploading(true);
    try {
      const updated = await artisanUploadAvatarPhoto(file);
      setArtisan(updated);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarUploading(true);
    try {
      const updated = await artisanDeleteAvatarPhoto();
      setArtisan(updated);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!artisan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-5 text-center">
        <p className="m-0 text-[14px] font-medium text-foreground">Sign in to edit your profile</p>
        {onClose && (
          <button type="button" onClick={onClose} className="border-none bg-transparent p-0 text-[13px] font-medium text-primary">
            Back
          </button>
        )}
      </div>
    );
  }

  // Real preview, not a mockup — the exact screen a customer opens,
  // rendered with isMine=false so it shows what they'd actually see
  // (Message/Request footer, no edit controls) instead of a read-only
  // clone that could drift from the real thing.
  if (previewing) {
    return (
      <div className="relative h-full">
        <ArtisanProfile artisan={artisan} isMine={false} onBack={() => setPreviewing(false)} />
        <div className="pointer-events-none absolute top-0 right-0 left-0 flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]">
          <span className="rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background shadow-lg">
            Previewing as a customer
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Plain title bar — Back / title, nothing else. Save moves to a
          bottom bar that only shows up once there's something to save
          (see below), rather than sitting here permanently enabled. */}
      <div
        className="flex shrink-0 items-center justify-between px-4 pb-3"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        {onClose ? (
          <button type="button" onClick={onClose} className="flex items-center gap-0.5 border-none bg-transparent p-0 text-[15px] text-primary">
            <ChevronLeft className="size-4" /> Back
          </button>
        ) : <span />}
        <p className="m-0 text-[15px] font-semibold text-foreground">Edit profile</p>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5" style={{ paddingBottom: isDirty ? "88px" : "24px" }}>
        {!complete && (
          <div className="mb-6">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-foreground">Profile {Math.round((doneCount / checklist.length) * 100)}% complete</span>
              <span className="text-[11.5px] text-muted-foreground">{doneCount}/{checklist.length}</span>
            </div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
            </div>
            <div className="grid gap-1">
              {checklist.filter((c) => !c.done).map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.onGo}
                  className="flex items-center justify-between gap-2 border-none bg-transparent px-0 py-1 text-left text-[13px] text-foreground"
                >
                  {c.label}
                  <ChevronLeft className="size-3.5 rotate-180 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => avatarFileInputRef.current?.click()}
            disabled={avatarUploading}
            aria-label={artisan.has_avatar_photo ? "Change profile photo" : "Add a profile photo"}
            className={`relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border ${artisan.has_avatar_photo || form.avatar_emoji ? "" : "font-mono text-xl font-bold"} ${tintFor(artisan.name)}`}
          >
            {avatarUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : artisan.has_avatar_photo ? (
              <img src={avatarPhotoUrl(artisan.id, artisan.avatar_photo_version)} alt="" className="size-full object-cover" />
            ) : form.avatar_emoji ? (
              <Emoji3D emoji={form.avatar_emoji} size={80} />
            ) : (
              initialsOf(artisan.name)
            )}
            <span className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border border-background bg-foreground text-background">
              <Camera className="size-3" />
            </span>
          </button>
          <div className="flex items-center gap-3">
            {artisan.has_avatar_photo && (
              <button type="button" onClick={removeAvatar} disabled={avatarUploading} className="border-none bg-transparent p-0 text-[12.5px] text-muted-foreground disabled:opacity-50">
                Remove photo
              </button>
            )}
            {!artisan.has_avatar_photo && (
              <EmojiPicker value={form.avatar_emoji} onChange={(e) => setForm((f) => ({ ...f, avatar_emoji: e }))} />
            )}
          </div>
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        <Field label="Name" value={form.name || ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        <div className="mb-3.5">
          <div className="mb-1.5 text-[13.5px] font-bold tracking-wide text-foreground">Trade</div>
          <Select value={form.trade} onValueChange={(v) => setForm((f) => ({ ...f, trade: v }))}>
            <SelectTrigger className="h-[52px] w-full rounded-[10px] text-base">
              <SelectValue placeholder="Select a trade" />
            </SelectTrigger>
            <SelectContent>
              {TRADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13.5px] font-bold tracking-wide text-foreground">City</span>
              <span className="text-xs text-muted-foreground/60">optional</span>
            </div>
            <input
              ref={cityFieldRef}
              value={form.city || ""}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="h-[52px] w-full rounded-[10px] border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <div className="mb-1.5 text-[13.5px] font-bold tracking-wide text-foreground">Years experience</div>
            <input
              ref={yearsFieldRef}
              type="number"
              value={form.years_experience ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value }))}
              className="h-[52px] w-full rounded-[10px] border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <Field label="Phone" type="tel" value={form.phone || ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
        <Field label="Email" hint="optional" type="email" value={form.email || ""} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />

        <div className="mb-3.5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[13.5px] font-bold tracking-wide text-foreground">Bio</span>
            <span className="text-xs text-muted-foreground/60">{(form.bio || "").length}/{BIO_MAX}</span>
          </div>
          <textarea
            ref={bioFieldRef}
            rows={3}
            maxLength={BIO_MAX}
            value={form.bio || ""}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            className="min-h-[52px] w-full resize-y rounded-[10px] border border-input bg-transparent p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="my-6 border-t border-border" />

        <div ref={photosSectionRef}>
          <PortfolioGrid artisanId={artisan.id} photos={photos} uploading={photoUploading} upload={uploadPhoto} remove={removePhoto} move={movePhoto} />
        </div>

        <button
          type="button"
          onClick={() => setPreviewing(true)}
          className="mt-6 w-full border-none bg-transparent p-0 text-center text-[13px] font-medium text-primary"
        >
          Preview as a customer
        </button>
      </div>

      {/* Sticky save bar — appears only once there's actually something
          unsaved, same "don't show chrome with nothing to do" reasoning
          as the checklist above. */}
      {isDirty && (
        <div
          className="shrink-0 border-t border-border bg-background px-5 pt-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
