// Server Component wrapping app/verify-email/page.js ("use client", so
// it can't export metadata itself). Auth-utility page — never indexed.
export const metadata = {
  title: "Verify Email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }) {
  return children;
}
