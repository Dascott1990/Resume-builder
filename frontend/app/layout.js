export const metadata = { title: "Resume Builder" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0B0D14" }}>{children}</body>
    </html>
  );
}
