"use client";
/**
 * ArtisanListingManager.js — one real place to manage everything about
 * what a customer actually sees: profile details and the work portfolio.
 * Previously scattered — profile fields lived in Settings.js, portfolio
 * photos were only reachable by opening your own PUBLIC listing from
 * Browse (ArtisanProfile.js's isMine-gated PhotoPortfolio) — with no
 * single "manage my listing" screen at all, the way Fiverr's gig manager
 * or Thumbtack's pro profile page works.
 *
 * Reachable from ArtisanDashboard.js (where an artisan actually spends
 * their time) and from Settings.js's now-slimmed-down Artisan Account
 * summary card — same data/endpoints either door, not two different
 * copies that can drift.
 *
 * Deliberately does NOT include: notifications, change-password, sign
 * out, delete listing — those stay exactly where they already live
 * (Settings for account/security preferences, the Dashboard for the
 * delete action) rather than tripling every action across three screens.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, X, Loader2, ImagePlus, Eye, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Btn } from "../guest/components/primitives";
import { IconTile } from "../shared/IconTile";
import Emoji3D from "../shared/Emoji3D";
import { EmojiPicker } from "../shared/EmojiPicker";
import PhotoPortfolio from "./PhotoPortfolio";
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
      toast.success("Listing updated");
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
      toast.success("Profile photo updated");
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
      toast.success("Profile photo removed");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!artisan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-5 text-center">
        <Wrench className="size-8 text-muted-foreground" />
        <p className="m-0 text-sm font-bold text-foreground">Sign in to manage your listing</p>
        {onClose && <Btn small variant="ghost" onClick={onClose}>Back</Btn>}
      </div>
    );
  }

  // Real preview, not a mockup — the exact screen a customer opens,
  // rendered with isMine=false so it shows what they'd actually see
  // (Message/Request footer, no edit controls) instead of a fake
  // read-only clone that could drift from the real thing.
  if (previewing) {
    return (
      <div className="relative h-full">
        <ArtisanProfile artisan={artisan} isMine={false} onBack={() => setPreviewing(false)} />
        <div className="pointer-events-none absolute top-0 right-0 left-0 flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]">
          <span className="rounded-full bg-foreground px-3 py-1 text-[11px] font-bold text-background shadow-lg">
            Previewing as a customer
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div
        className="flex shrink-0 items-center justify-between px-5 pb-3.5"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3">
          <IconTile icon={Wrench} size="sm" />
          <p className="m-0 font-serif text-[17px] italic text-foreground">Manage my listing</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-[12.5px] font-bold text-primary"
        >
          <Eye className="size-3.5" /> Preview as a customer
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className={`flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border ${artisan.has_avatar_photo || form.avatar_emoji ? "" : "font-mono text-base font-bold"} ${tintFor(artisan.name)}`}>
            {artisan.has_avatar_photo ? (
              <img src={avatarPhotoUrl(artisan.id, artisan.avatar_photo_version)} alt="" className="size-full object-cover" />
            ) : form.avatar_emoji ? (
              <Emoji3D emoji={form.avatar_emoji} size={56} />
            ) : (
              initialsOf(artisan.name)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[14.5px] font-bold text-foreground">{artisan.name}</p>
            <p className="m-0 text-[12.5px] text-muted-foreground">{artisan.trade}</p>
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

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => avatarFileInputRef.current?.click()}
            disabled={avatarUploading}
            className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-bold text-primary disabled:opacity-50"
          >
            {avatarUploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {artisan.has_avatar_photo ? "Change profile photo" : "Set a profile photo"}
          </button>
          {artisan.has_avatar_photo && (
            <button type="button" onClick={removeAvatar} disabled={avatarUploading} className="border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground disabled:opacity-50">
              Remove
            </button>
          )}
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        <div className="mb-4">
          <EmojiPicker value={form.avatar_emoji} onChange={(e) => setForm((f) => ({ ...f, avatar_emoji: e }))} />
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

        <Btn variant="gold" className="mb-6" disabled={saving} loading={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </Btn>

        <PhotoPortfolio artisan={artisan} isMine editToken={null} />
      </div>
    </div>
  );
}
