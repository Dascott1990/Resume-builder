import ErrorScreen from "@/components/premium/shared/ErrorScreen";

// Next's App Router special file — renders for any URL that doesn't match a
// route (this app is mostly one client-rendered "/" with view state, so a
// real 404 here means an old/typo'd/bookmarked link, not a bad in-app nav).
export default function NotFound() {
  return <ErrorScreen variant="notfound" fullScreen closeHref="/" />;
}
