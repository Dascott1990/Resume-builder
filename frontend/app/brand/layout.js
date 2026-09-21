// Server Component wrapping app/brand/page.js ("use client", so it can't
// export metadata itself). Internal tooling for now — no public link
// anywhere points here (see app/robots.js) — so this is explicitly
// noindexed rather than inheriting the root's generic title/description.
// Also covers /brand/news, which nests under this layout automatically.
export const metadata = {
  title: "Brand Kit",
  robots: { index: false, follow: false },
};

export default function BrandLayout({ children }) {
  return (
    <>
      {/* The text-layer font library for /brand's post + story composers
          (see FONT_STACKS in postTemplates.js) — a curated set spanning
          the registers a real caption/video-editing tool offers (impact/
          condensed, geometric, bold display, script, marker, serif,
          editorial serif, mono, rounded), not house taste, picked for
          being genuinely common in the category. Moved here from the root
          layout: real measurement showed this 9-family request was the
          single biggest render-blocking cost on the landing page, which
          never uses any of these — Caveat and Unbounded (the two families
          actually needed site-wide) still load from app/layout.js.
          Next.js App Router hoists <link>/<meta> tags rendered anywhere in
          the tree into <head> automatically, deduplicated against the
          root layout's own preconnect hints. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Poppins:wght@400;600;700;800&family=Anton&family=Oswald:wght@500;700&family=Montserrat:wght@700;800&family=Space+Mono:wght@400;700&family=Baloo+2:wght@600;700&family=Permanent+Marker&family=Playfair+Display:wght@700;800&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
