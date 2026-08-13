import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import OfflineBanner from "@/components/premium/shared/OfflineBanner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { ACCENT_INIT_SCRIPT } from "@/lib/accentColor";
import { BRIGHTNESS_INIT_SCRIPT } from "@/lib/brightness";
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
        {/* Same reasoning, one property lower — the stored accent color
            (default amber) applied before first paint via inline style
            overrides on the CSS custom properties globals.css defines. */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_INIT_SCRIPT }} />
        {/* Same reasoning again, for the screen brightness overlay below —
            sets the two CSS variables its opacity reads from before first
            paint, so reopening the app at a saved dim/boost level doesn't
            flash neutral brightness first. */}
        <script dangerouslySetInnerHTML={{ __html: BRIGHTNESS_INIT_SCRIPT }} />
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
        <OfflineBanner />
        <Toaster position="top-center" />
        <ServiceWorkerRegister />
        <KeepAlive />
        {/* Screen brightness — see lib/brightness.js for why this is two
            always-mounted overlays (opacity driven purely by the CSS
            variables the script/hook above set) rather than a `filter` on
            a content wrapper: filter creates a new containing block for
            `position: fixed` descendants, which would silently break every
            fixed-position surface in the app underneath it. Both are inert
            — pointer-events:none, and at opacity 0 (the default/neutral
            value) they cost nothing visually or interactively. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[999999999] bg-black" style={{ opacity: "var(--brightness-dim-opacity, 0)" }} />
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[999999999] bg-white mix-blend-screen" style={{ opacity: "var(--brightness-boost-opacity, 0)" }} />
      </body>
    </html>
  );
}