// Server Component wrapping app/reset-password/page.js ("use client", so
// it can't export metadata itself). Auth-utility page — never indexed.
export const metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }) {
  return children;
}
