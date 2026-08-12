// Shared display helpers for artisan name/phone rendering — used by both
// Artisans.js (the card) and ArtisanProfile.js (the full profile). Split out
// so neither file has to import the other just to reuse these.

// Kept off amber on purpose — amber is the app's one primary/brand accent,
// so these categorical avatar tints use a separate palette to avoid
// visually colliding with it.
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

// Display-only formatting — the raw digits still go in the tel: href.
// A 10-digit US number reads as "(512) 555-0173" instead of a bare digit
// dump, which is most of what made listings look like a database export
// instead of a real directory.
export function formatPhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// JS-side truncation instead of CSS line-clamp — line-clamp's height math
// (font-size × line-height, then clip at N lines) is a few pixels off in
// some browsers right at the 2-line boundary, chopping the bottom of the
// last visible line instead of hiding it cleanly. Cutting the string itself
// sidesteps that entirely: the rendered text is always exactly what fits.
export function truncateBio(bio, max = 88) {
  if (!bio || bio.length <= max) return bio;
  const cut = bio.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

// Sub-km distances read as "450 m away" — "0.5 km away" makes a
// two-minutes-down-the-street artisan sound farther than they are.
export function formatDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}
