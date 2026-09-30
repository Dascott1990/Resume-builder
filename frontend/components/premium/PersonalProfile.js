"use client";
/**
 * PersonalProfile.js — reached by tapping the avatar next to the Dashboard
 * greeting. Pure identity: name, avatar (real photo or emoji), phone
 * number, account type, email. Everything else about the account — theme,
 * password, delete account, shortcuts — lives one level up on the Profile
 * hub (see Profile.js), which is where this screen's own "Back" goes.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Btn } from "./guest/components/primitives";
import Emoji3D from "./shared/Emoji3D";
import { tintFor, initialsOf } from "./shared/artisanDisplay";
import { EmojiPicker } from "./shared/EmojiPicker";
import { useAuth } from "@/lib/useAuth";
import { apiRequest } from "./shared/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function avatarPhotoUrl(userId, version) {
  const v = version ? `?v=${version}` : "";
  return `${API_BASE}/api/v1/auth/avatar-photo/${userId}${v}`;
}

export default function PersonalProfile({ onClose }) {
  const { user, loading: authLoading, updateProfile, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setPhone(user.phone || "");
    setAvatarEmoji(user.avatar_emoji || null);
  }, [user]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), avatar_emoji: avatarEmoji });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const pickPhoto = () => fileInputRef.current?.click();

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiRequest("/api/v1/auth/avatar-photo", { method: "POST", body: form });
      await refreshUser();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err.message || "Couldn't upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    setUploadingPhoto(true);
    try {
      await apiRequest("/api/v1/auth/avatar-photo", { method: "DELETE" });
      await refreshUser();
    } catch (err) {
      toast.error(err.message || "Couldn't remove that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const dirty =
    user &&
    (name.trim() !== (user.name || "") ||
      phone.trim() !== (user.phone || "") ||
      avatarEmoji !== (user.avatar_emoji || null));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans text-foreground"
    >
      <div className="flex shrink-0 items-center gap-3 px-5 pb-3.5" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Button variant="ghost" size="icon" className="size-10" aria-label="Back" onClick={onClose}>
          <ArrowLeft className="size-5" />
        </Button>
        <p className="m-0 text-[17px] font-bold text-foreground">Personal profile</p>
      </div>

      <div
        className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col gap-4 overflow-y-auto px-5 lg:max-w-2xl"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        {authLoading || !user ? (
          <Card className="flex items-center justify-center p-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : (
          <>
            <Card className="grid justify-items-center gap-3 p-6 text-center">
              <div className="relative">
                <div className={`flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border ${user.has_avatar_photo || avatarEmoji ? "" : "font-mono text-xl font-bold"} ${tintFor(user.name || user.email)}`}>
                  {user.has_avatar_photo ? (
                    <img src={avatarPhotoUrl(user.id, user.avatar_photo_version)} alt="" className="size-full object-cover" />
                  ) : avatarEmoji ? (
                    <Emoji3D emoji={avatarEmoji} size={80} />
                  ) : (
                    initialsOf(user.name || user.email)
                  )}
                </div>
                <button
                  type="button"
                  onClick={pickPhoto}
                  disabled={uploadingPhoto}
                  aria-label="Change photo"
                  className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground disabled:opacity-60"
                >
                  {uploadingPhoto ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={pickPhoto} className="border-none bg-transparent p-0 text-[12.5px] font-bold text-primary">
                  Change photo
                </button>
                {user.has_avatar_photo && (
                  <button type="button" onClick={removePhoto} className="flex items-center gap-1 border-none bg-transparent p-0 text-[12.5px] font-semibold text-muted-foreground">
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                )}
              </div>
              <EmojiPicker value={avatarEmoji} onChange={setAvatarEmoji} />
            </Card>

            <div>
              <Card className="grid gap-3 p-3.5">
                <Field label="Name" hint="optional" placeholder="Your name" value={name} onChange={setName} />
                <Field label="Phone number" hint="optional" placeholder="e.g. (555) 123-4567" type="tel" value={phone} onChange={setPhone} />
                <div>
                  <p className="m-0 mb-1 text-[12px] font-semibold text-muted-foreground">Account type</p>
                  <p className="m-0 text-[13.5px] font-bold text-foreground">Personal account</p>
                </div>
                <div>
                  <p className="m-0 mb-1 text-[12px] font-semibold text-muted-foreground">Email address</p>
                  <div className="flex items-center gap-1.5">
                    <p className="m-0 truncate text-[13.5px] font-bold text-foreground">{user.email}</p>
                    {user.email_verified && <CheckCircle2 className="size-3.5 shrink-0 text-[var(--success)]" />}
                  </div>
                </div>
                <Btn small variant="gold" className="justify-self-start" disabled={savingProfile || !dirty} loading={savingProfile} onClick={saveProfile}>
                  Save profile
                </Btn>
              </Card>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
