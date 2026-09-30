export default async function sitemap() {
  const base = "https://www.noqeev.com";
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
  ];
}
