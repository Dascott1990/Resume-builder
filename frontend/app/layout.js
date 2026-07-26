export const metadata = {
  title: "Noviq — AI Resume Builder",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noviq",
  },
};

// Locking the viewport is what actually stops the "page" from ever pinch-
// or double-tap-zooming like a website — without this, no amount of
// per-button CSS fixes matters, since the whole document can still zoom.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0B0D14",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0B0D14", overscrollBehavior: "none" }}>{children}</body>
    </html>
  );
}