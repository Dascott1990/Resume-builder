"use client";
/**
 * ArtisanListingManager.js — a real, standalone "Edit profile" page for
 * an artisan's listing. Not a dashboard screen wearing a different
 * title: no IconTile branding badge, no card chrome around the summary
 * row, no status pill — those belong to ArtisanDashboard.js, which is
 * about running the business day to day. This page has exactly one job
 * (edit what a customer sees: photo, details, portfolio, in that order)
 * and looks like it — plain header with Back/Save, one flowing column,
 * nothing decorative competing with the content.
 *
 * Reachable from ArtisanDashboard.js and from Settings.js's artisan
 * summary card — same screen either door.
 *
 * Deliberately does NOT include: availability toggle, notifications,
 * change-password, sign out, delete listing — those stay exactly where
 * they already live (the Dashboard, Settings) rather than tripling every
 * action across three screens. This page is content, not account admin.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Camera } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../guest/components/primitives";
import Emoji3D from "../shared/Emoji3D";
import { EmojiPicker } from "../shared/EmojiPicker";
import PortfolioGrid from "./PortfolioGrid";
import ArtisanProfile from "../ArtisanProfile";
import { tintFor, initialsOf, avatarPhotoUrl } from "../shared/artisanDisplay";
import { TRADES } from "../shared/trades";
import { artisanMe, artisanUpdateProfile, artisanUploadAvatarPhoto, artisanDeleteAvatarPhoto } from "./api";

export default function ArtisanListingManager({ onClose }) {
  const [artisan, setArtisan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const avatarFileInputRef = useRef(null);

  useEffect(() => {
    artisanMe()
      .then((a) => { setArtisan(a); setForm(a); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

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
      onClose?.();
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
      {/* Plain title bar — Back / title / Save, nothing else. Same shape
          any focused editor uses, not this app's marketing chrome. */}
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
        <button type="button" onClick={save} disabled={saving} className="border-none bg-transparent p-0 text-[15px] font-semibold text-primary disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
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
          <Field label="City" hint="optional" value={form.city || ""} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          <Field label="Years experience" type="number" value={form.years_experience ?? ""} onChange={(v) => setForm((f) => ({ ...f, years_experience: v }))} />
        </div>
        <Field label="Phone" type="tel" value={form.phone || ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
        <Field label="Email" hint="optional" type="email" value={form.email || ""} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
        <Field label="Bio" hint="optional" multiline rows={3} value={form.bio || ""} onChange={(v) => setForm((f) => ({ ...f, bio: v }))} />

        <div className="my-6 border-t border-border" />

        <PortfolioGrid artisanId={artisan.id} editToken={null} />

        <button
          type="button"
          onClick={() => setPreviewing(true)}
          className="mt-6 w-full border-none bg-transparent p-0 text-center text-[13px] font-medium text-primary"
        >
          Preview as a customer
        </button>
      </div>
    </div>
  );
}
