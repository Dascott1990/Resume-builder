import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="m-0 overscroll-none bg-background">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}