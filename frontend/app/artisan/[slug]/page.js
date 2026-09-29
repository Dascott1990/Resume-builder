/**
 * app/artisan/[slug]/page.js — a real, public, indexable URL for a single
 * artisan (noqeev.com/artisan/jane-doe-electrician-ottawa-<id>), so a
 * listing can rank in local search ("electrician in Ottawa") and so an
 * artisan has something real to paste into their own Instagram/TikTok/
 * WhatsApp bio, the way a LinkedIn or Linktree URL works. Every other
 * artisan-facing screen lives behind the main SPA shell's view-state
 * switch (see app/page.js) — fine once someone's already using Noqeev,
 * useless to a search engine or a cold link, which is exactly the gap
 * this route closes.
 *
 * Deliberately server-rendered (no "use client") so the content is in the
 * initial HTML for crawlers, not painted in after a client fetch.
 *
 * Contact info (phone/email) is in the API response but never printed
 * here — a publicly indexed page is exactly what spam scrapers crawl for
 * raw phone numbers/emails, and routing "let's talk" through the CTA
 * below (into the real app) is also the actual product funnel, not a
 * workaround.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Star, MapPin, Briefcase, ArrowRight } from "lucide-react";
import Logo from "@/components/premium/Logo";
import { artisanIdFromSlug, artisanSlug } from "@/lib/slugify";

const API = process.env.NEXT_PUBLIC_API_URL;
const SITE = "https://www.noqeev.com";

async function getArtisan(id) {
  if (!API || !id) return null;
  try {
    const res = await fetch(`${API}/api/v1/artisans/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data || null;
  } catch {
    return null;
  }
}

async function getPhotos(id) {
  if (!API || !id) return [];
  try {
    const res = await fetch(`${API}/api/v1/artisans/${id}/photos`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.data) ? body.data : [];
  } catch {
    return [];
  }
}

// A listing with no bio, no photos, and no track record yet is thin
// content — real, but not worth a search engine indexing today. It still
// renders fine for anyone with the direct link; it just asks not to be
// crawled until there's enough here to actually rank on. Revisit this bar
// as real listings accumulate real content.
function isIndexable(a, photoCount) {
  if (!a) return false;
  if (a.verification_status === "verified") return true;
  if ((a.rating_count || 0) > 0) return true;
  if ((a.bio || "").trim().length >= 40) return true;
  if (photoCount > 0) return true;
  return false;
}

export async function generateMetadata({ params }) {
  const id = artisanIdFromSlug(params.slug);
  const a = await getArtisan(id);
  if (!a) return { title: "Artisan not found" };

  const photos = await getPhotos(id);
  const title = `${a.name} — ${a.trade}${a.city ? ` in ${a.city}` : ""}`;
  const description = a.bio?.trim()
    ? a.bio.trim().slice(0, 155)
    : `${a.name} is a ${a.trade}${a.city ? ` serving ${a.city}` : ""} on Noqeev.${a.verification_status === "verified" ? " ID and insurance verified." : ""}`;
  const canonicalSlug = artisanSlug(a);

  return {
    title,
    description,
    alternates: { canonical: `/artisan/${canonicalSlug}` },
    robots: isIndexable(a, photos.length)
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: { type: "profile", url: `${SITE}/artisan/${canonicalSlug}`, title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function ArtisanPublicProfilePage({ params }) {
  const id = artisanIdFromSlug(params.slug);
  const a = await getArtisan(id);
  if (!a) notFound();

  const photos = await getPhotos(id);
  const canonicalSlug = artisanSlug(a);
  const verified = a.verification_status === "verified";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: a.name,
    description: a.bio || `${a.name}, ${a.trade}`,
    url: `${SITE}/artisan/${canonicalSlug}`,
    ...(a.city ? { areaServed: a.city } : {}),
    ...(a.rating_count > 0 && a.rating_avg
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: a.rating_avg, reviewCount: a.rating_count } }
      : {}),
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6 sm:px-8">
        <Link href="/" aria-label="Noqeev home">
          <Logo size={22} />
        </Link>
        <Link
          href="/"
          className="rounded-full border border-border bg-card px-4 py-2 text-[13px] font-bold text-foreground"
        >
          Open Noqeev
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-mono text-xl font-bold text-primary">
            {a.avatar_emoji || a.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-[clamp(1.5rem,4vw,2.1rem)] leading-tight font-bold text-foreground">{a.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Briefcase className="size-4 text-primary" />
                {a.trade}
              </span>
              {a.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {a.city}
                </span>
              )}
              {a.years_experience ? <span>{a.years_experience}+ years experience</span> : null}
              {a.rating_count > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="size-4 fill-primary text-primary" />
                  {a.rating_avg?.toFixed(1)} ({a.rating_count})
                </span>
              )}
            </div>
          </div>
        </div>

        {verified && (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[13px] font-bold text-primary-text">
            <ShieldCheck className="size-4" />
            ID and insurance verified by Noqeev
          </div>
        )}

        {a.bio && (
          <p className="m-0 mt-6 text-[15px] leading-relaxed text-foreground">{a.bio}</p>
        )}

        {photos.length > 0 && (
          <div className="mt-8">
            <h2 className="m-0 mb-3 text-[13px] font-bold tracking-wide text-muted-foreground uppercase">Recent work</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.slice(0, 9).map((p) => (
                <img
                  key={p.id}
                  src={`${API}/api/v1/artisans/${id}/photos/${p.id}/raw`}
                  alt={p.caption || `${a.name}'s work`}
                  className="aspect-square w-full rounded-xl border border-border object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}

        <Link
          href="/"
          className="mt-10 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border-none bg-primary px-7 text-[15.5px] font-bold text-primary-foreground sm:w-auto"
        >
          Message {a.name.split(" ")[0]} on Noqeev
          <ArrowRight className="size-4" />
        </Link>

        <p className="m-0 mt-10 text-[12px] leading-relaxed text-muted-foreground/80">
          Noqeev is an introduction platform. Listings are created by the artisans themselves;
          the verified badge above (when shown) means our team has reviewed a government ID and
          proof of insurance, not a guarantee of any specific job's outcome. See our{" "}
          <Link href="/terms" className="underline">Terms</Link>.
        </p>
      </main>
    </div>
  );
}
