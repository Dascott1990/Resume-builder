"use client";
/**
 * app/help/page.js — a real, standalone URL for ArtisanSeniorHelp.js
 * (noqeev.com/help), not just a screen reachable from inside the app.
 *
 * The rest of the artisan-hiring flow lives behind the main SPA shell
 * (app/page.js's view-state switch) — fine for someone already using
 * Noqeev, but the actual audience for the senior concierge flow is often
 * someone finding it FOR a parent or grandparent: a link texted by an
 * adult child, a QR code on a flyer at a senior center, a bookmark saved
 * once and reused. None of that works if reaching the flow first requires
 * opening the app, finding Dashboard, and knowing to scroll to a card —
 * this route skips all of it. A plain static import (not the dynamicScreen
 * wrapper app/page.js uses for its own in-SPA screens) is correct here:
 * this page is its own separate bundle already, so there's no shared
 * initial-load weight to defer.
 */
import { useRouter } from "next/navigation";
import ArtisanSeniorHelp from "@/components/premium/artisan/ArtisanSeniorHelp";

export default function HelpPage() {
  const router = useRouter();
  return <ArtisanSeniorHelp onClose={() => router.push("/")} />;
}
