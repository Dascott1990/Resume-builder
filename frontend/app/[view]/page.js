// app/[view]/page.js — renders the exact same app shell as the root
// "/" route, for any single-segment path that corresponds to a real
// screen (see lib/viewRoutes.js's PATH_TO_VIEW). This is what makes a
// direct load or refresh of noqeev.com/resume, /profile, /tracker, etc.
// actually work instead of 404ing — before this route existed, those
// URLs were only ever reachable by first loading "/" and navigating
// client-side; the browser's own address bar DID show the right path
// once there (see app/page.js's URL-sync effect), but bookmarking it,
// sharing it, or hitting refresh landed on Next's default not-found
// page, since no route was actually registered for that path.
//
// An unrecognized single-segment path (a typo, a dead link) still 404s
// for real via notFound() below — this isn't a catch-all that swallows
// every bad URL into the app, only ones that match a real screen.
// Multi-segment unknown paths never reach this file at all; Next's own
// routing already 404s those on its own, since this only matches one
// segment.
//
// Static routes with their own literal page.js (app/admin, app/brand,
// app/pricing, etc.) are matched before a dynamic segment like this one
// regardless of file order, so none of them are at risk of being
// shadowed by this.
import { notFound } from "next/navigation";
import Home from "../page";
import { PATH_TO_VIEW } from "@/lib/viewRoutes";

export default function ViewRoute({ params }) {
  if (!PATH_TO_VIEW[params.view]) notFound();
  return <Home />;
}
