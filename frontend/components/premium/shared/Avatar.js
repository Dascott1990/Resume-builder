"use client";
/**
 * Avatar.js — the one place that decides what represents a signed-in
 * user visually: a real uploaded photo (user.has_avatar_photo) wins,
 * then an emoji (user.avatar_emoji), then initials-on-a-tinted-circle.
 * PersonalProfile.js — the upload screen itself — already gets this right
 * with its own inline version; every OTHER screen that shows this
 * account's own avatar (Dashboard's greeting, NavRail's account card,
 * Profile.js) was re-deriving just the emoji/initials half of that same
 * fallback and silently dropping the real-photo case. Route all of those
 * through here instead so a real upload actually shows up everywhere an
 * avatar does, not just on the screen that uploaded it.
 */
import { UserRound } from "lucide-react";
import Emoji3D from "./Emoji3D";
import { tintFor, initialsOf } from "./artisanDisplay";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export function avatarPhotoUrl(userId, version) {
  const v = version ? `?v=${version}` : "";
  return `${API_BASE}/api/v1/auth/avatar-photo/${userId}${v}`;
}

export function Avatar({ user, size = 36, emojiSize, className = "" }) {
  // A bare "?" character used to stand in here whenever there was
  // nothing at all to go on (no photo, no emoji, and — during the brief
  // window before a profile finishes loading, or for a genuinely
  // name/email-less account — no name or email to derive initials from
  // either). Confirmed live: that read as a broken/placeholder-looking
  // icon, not an intentional empty state. A real person-outline glyph
  // (the same industry-standard "generic profile" shape every major app
  // uses) reads as "no photo set yet," not "something's wrong."
  const hasIdentity = !!(user?.name || user?.email);
  const name = user?.name || user?.email || "";
  const showInitials = !user?.has_avatar_photo && !user?.avatar_emoji && hasIdentity;
  const showGenericIcon = !user?.has_avatar_photo && !user?.avatar_emoji && !hasIdentity;
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border ${showInitials ? "font-mono font-bold" : ""} ${showGenericIcon ? "border-border bg-muted text-muted-foreground" : tintFor(name)} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
    >
      {user?.has_avatar_photo ? (
        <img src={avatarPhotoUrl(user.id, user.avatar_photo_version)} alt="" className="size-full object-cover" />
      ) : user?.avatar_emoji ? (
        <Emoji3D emoji={user.avatar_emoji} size={emojiSize || size} />
      ) : hasIdentity ? (
        initialsOf(name)
      ) : (
        <UserRound size={Math.round(size * 0.58)} strokeWidth={2} />
      )}
    </div>
  );
}
