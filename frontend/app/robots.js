// Next's dynamic robots convention — served automatically at the real
// /robots.txt URL. /admin, /reset-password, /verify-email, and /brand
// (internal tooling, no public link anywhere — see app/brand/layout.js)
// are disallowed here; /brand/news doesn't need its own entry since it's
// a sub-path of the already-disallowed /brand.
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/reset-password", "/verify-email", "/brand", "/api/"],
      },
    ],
    sitemap: "https://www.noqeev.com/sitemap.xml",
  };
}
