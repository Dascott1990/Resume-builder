// Server Component wrapping app/admin/page.js ("use client", so it can't
// export metadata itself). Admin surface — never indexed.
export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return children;
}
