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

// A greeting ("Good afternoon, X") should say one name, not whatever got
// typed into the name field whole — "Jordan Casey" read as a oddly
// formal "Good afternoon, Jordan Casey" every time, not how a real
// greeting talks to someone. Takes the FIRST whitespace-separated token
// exactly as filled in, not a hardcoded assumption that word order is
// always "First Last" (plenty of real names don't work that way) —
// whatever word came first in the field is what shows here, nothing
// reordered or guessed at beyond that.
export function firstNameOf(name) {
  return (name || "").trim().split(/\s+/)[0] || "";
}
