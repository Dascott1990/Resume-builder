import { artisanSlug } from "@/lib/slugify";

const API = process.env.NEXT_PUBLIC_API_URL;

// Same bar app/artisan/[slug]/page.js's own generateMetadata uses to
// decide index:true/false for that artisan's own page — kept in sync
// deliberately, listing a URL here that the page itself then noindexes is
// a contradictory signal to Google. Approximate here (browse() doesn't
// return a photo count the way the single-artisan fetch does) since a
// sitemap is a hint, not a hard contract; the page's own robots tag is
// what actually enforces this.
function looksIndexable(a) {
  return a.verification_status === "verified" || (a.rating_count || 0) > 0 || (a.bio || "").trim().length >= 40;
}

async function artisanUrls(base) {
  if (!API) return [];
  try {
    const res = await fetch(`${API}/api/v1/artisans?limit=100`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const body = await res.json();
    const items = Array.isArray(body?.data) ? body.data : [];
    return items
      .filter(looksIndexable)
      .map((a) => ({ url: `${base}/artisan/${artisanSlug(a)}`, changeFrequency: "weekly", priority: 0.6 }));
  } catch {
    return [];
  }
}

// /brand and /brand/news are internal tooling (noindexed — see
// app/brand/layout.js) and must never appear here: listing a noindexed
// URL in the sitemap is a contradictory signal to Google.
export default async function sitemap() {
  const base = "https://www.noqeev.com";
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    ...(await artisanUrls(base)),
  ];
}
