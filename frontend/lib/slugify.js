// slugify.js — turns free text into a URL-safe, lowercase, hyphenated
// segment. Used to build human-readable artisan profile URLs
// (/artisan/jane-doe-electrician-ottawa-<id>) — the trailing id is what's
// actually looked up (see app/artisan/[slug]/page.js), everything before
// it is decorative, so this never needs to be reversible or unique on its
// own.
export function slugify(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Artisan ids are uuid4().hex — 32 lowercase hex characters, no hyphens
// (see backend/app/models.py's _gen_id) — so the last 32 characters of any
// slug are unambiguously the real id, whatever human-readable prefix a
// visitor's browser history, a shared link, or a stale bookmark carries.
export function artisanSlug(a) {
  const parts = [a.name, a.trade, a.city].filter(Boolean).map(slugify).filter(Boolean);
  return `${parts.join("-")}-${a.id}`;
}

export function artisanIdFromSlug(slug) {
  const id = String(slug || "").slice(-32);
  return /^[a-f0-9]{32}$/.test(id) ? id : null;
}
