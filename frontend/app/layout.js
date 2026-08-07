import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking, runs before hydration — reads the stored theme (or
            falls back to dark, the brand default) and sets the "dark"
            class immediately, so the very first paint already matches
            what was chosen last time. Without this, the server always
            renders dark (it has no way to know what's in this browser's
            localStorage), and a light-mode visitor would see a flash of
            dark before React mounts and corrects it. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="m-0 overscroll-none bg-background">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}