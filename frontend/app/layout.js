import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { KeepAlive } from "./KeepAlive";

export const metadata = {
  title: "Noviq — AI Resume Builder",
  description: "Tailored, ATS-ready resumes in minutes. Anonymous by default, account optional.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noviq",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
        {/* Caveat — the handwriting font drawn onto the pen-writing 3D
            scene's canvas textures (PaperTransformScene.js). Loaded as a
            real stylesheet, not next/font, since it needs to be resolvable
            by name from a plain 2D canvas context inside a dynamically
            imported, ssr:false Three.js module. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="m-0 overscroll-none bg-background">
        {children}
        <Toaster position="top-center" />
        <ServiceWorkerRegister />
        <KeepAlive />
      </body>
    </html>
  );
}