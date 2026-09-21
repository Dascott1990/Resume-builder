// Only the one genuinely public, indexable URL. /brand and /brand/news
// are internal tooling (noindexed — see app/brand/layout.js) and must
// never appear here: listing a noindexed URL in the sitemap is a
// contradictory signal to Google.
export default function sitemap() {
  const base = "https://www.noqeev.com";
  return [{ url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 }];
}
