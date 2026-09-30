// Shared avatar-display helpers — a consistent tint + initials fallback
// for anywhere an account has no photo. Used by Settings.js's customer
// ACCOUNT card and Dashboard.js's own avatar rendering.

// Purely decorative categorical variety — a consistent, distinguishable
// tint per person (picked by hashing their name), not a status signal.
// Deliberately NOT drawn from the 4 fixed semantic tokens (destructive/
// success/warning/info) — those mean something specific (danger/success/
// warning/info) and reusing one here for "person #2's avatar" would be
// actively misleading, not simplification.
const AVATAR_TINTS = [
  "border-blue-500/25 bg-blue-500/10 text-blue-400",
  "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  "border-violet-500/25 bg-violet-500/10 text-violet-400",
];
export function tintFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function initialsOf(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}
