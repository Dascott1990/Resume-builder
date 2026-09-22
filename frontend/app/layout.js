import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import OfflineBanner from "@/components/premium/shared/OfflineBanner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { ACCENT_INIT_SCRIPT } from "@/lib/accentColor";
import { BRIGHTNESS_INIT_SCRIPT } from "@/lib/brightness";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { KeepAlive } from "./KeepAlive";

const SITE_NAME = "Noqeev";
const SITE_TITLE = "Noqeev — AI Resume Builder";
const SITE_DESCRIPTION = "Tailored, ATS-ready resumes in minutes. Anonymous by default, account optional.";

export const metadata = {
  metadataBase: new URL("https://www.noqeev.com"),
  title: { default: SITE_TITLE, template: "%s — Noqeev" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  // Root gets an explicit index:true rather than relying on default
  // behavior, since every other route in the app now sets an explicit
  // noindex (see app/brand/layout.js, app/admin/layout.js, etc.) — the
  // root should say what it means too, not be the one implicit case.
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: {
    type: "website",
    url: "https://www.noqeev.com",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    // No `images` here on purpose — app/opengraph-image.js's file
    // convention makes Next resolve this correctly on its own; hand-
    // listing the URL here would be a second source of truth that can
    // silently drift (wrong size/type) from the real generated image.
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noqeev",
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
        {/* Organization + WebSite structured data — static, app-authored
            objects with no user input anywhere in them, so JSON.stringify
            into dangerouslySetInnerHTML here has no injection surface (the
            usual reason to avoid that API doesn't apply to a hardcoded
            payload). No SearchAction/sitelinks-searchbox schema — there's
            no real site-search endpoint, and fabricating one would just be
            structured-data spam. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: SITE_NAME,
              url: "https://www.noqeev.com",
              logo: "https://www.noqeev.com/icon-512.png",
              description: SITE_DESCRIPTION,
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              url: "https://www.noqeev.com",
            }),
          }}
        />
        {/* Caveat + Unbounded — the two families this page (and every
            non-/brand route) actually needs: Caveat is the handwriting
            font drawn onto the pen-writing 3D scene's canvas textures
            (PaperTransformScene.js, used on Hero.js), Unbounded is the
            wordmark face (--font-wordmark in globals.css) rendered on
            every page via Logo.js. Both self-hosted via @font-face in
            globals.css now, not a live fonts.googleapis.com/fonts.gstatic.com
            request — see that file's own comment for why (Google Fonts
            loaded live leaks every visitor's IP to Google on every page
            load). Same family names as before on purpose, so canvas
            contexts and any other by-name font-family reference resolve
            exactly the way they did before this change — nothing else
            needed to be touched. /brand's own 9-family composer library
            still loads live from Google (app/brand/layout.js) — lower
            exposure (internal tool only, not every visitor) and higher
            risk to self-host blind (heavily referenced by name across
            canvas-rendering code); flagged as a follow-up, not done here. */}
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