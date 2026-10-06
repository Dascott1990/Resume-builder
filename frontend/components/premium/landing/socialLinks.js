// socialLinks.js — Noqeev's real social profiles + the brand glyphs for
// each, used by Footer.js. Its own file, not inlined there, since the
// glyphs are the one place this app reaches for exact trademarked logo
// shapes rather than a generic icon — lucide-react (every other icon in
// this app) deliberately ships no brand/platform marks at all, so these
// are hand-authored path data instead of a library import, same
// "exact real geometry, not an approximation" standard Logo.js's own
// mark already holds itself to.
//
// Every icon is a single `currentColor` path on a 24x24 viewBox so it
// drops into the footer's existing muted-foreground/hover-foreground
// link styling with no extra color handling of its own.

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function ThreadsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.026 3.086.717 5.496 2.055 7.164 1.43 1.783 3.63 2.698 6.54 2.717 2.623-.02 4.358-.63 5.8-2.045 1.634-1.605 1.606-3.574 1.08-4.77-.31-.705-.873-1.29-1.629-1.71-.19 1.355-.615 2.44-1.268 3.233-.878 1.065-2.12 1.64-3.69 1.705-1.202.05-2.361-.23-3.267-.79-1.072-.66-1.698-1.665-1.765-2.833-.065-1.13.336-2.188 1.129-2.98.887-.888 2.17-1.364 3.628-1.34.937.016 1.812.136 2.608.357-.037-1.088-.258-1.882-.658-2.36-.52-.62-1.345-.934-2.452-.934h-.027c-.887 0-2.096.246-2.864 1.413l-1.733-1.14c1.03-1.56 2.692-2.42 4.602-2.42h.03c3.288.02 5.178 2.045 5.368 5.735.11.047.218.095.324.146 1.566.747 2.712 1.88 3.316 3.278.837 1.94.913 5.106-1.624 7.576-1.863 1.818-4.124 2.64-7.335 2.665z" />
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22.675 0h-21.35c-.734 0-1.325.591-1.325 1.325v21.351c0 .734.591 1.324 1.325 1.324h11.494v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24h-1.918c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.734 0 1.325-.59 1.325-1.324v-21.35c0-.734-.591-1.325-1.325-1.325z" />
    </svg>
  );
}

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function TikTokIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
    </svg>
  );
}

function MediumIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.57-1.19-5.75s.53-5.75 1.19-5.75c.66 0 1.19 2.57 1.19 5.75z" />
    </svg>
  );
}

// Real, live handles — update here (nowhere else) if any of these ever
// change or a new platform gets added.
export const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/NoqeevHQ", Icon: XIcon },
  { label: "Threads", href: "https://www.threads.net/@Noqeev", Icon: ThreadsIcon },
  { label: "Facebook", href: "https://www.facebook.com/share/1HoNTthpvM/?mibextid=wwXIfr", Icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/Noqeev", Icon: InstagramIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@Noqeev", Icon: TikTokIcon },
  { label: "Medium", href: "https://medium.com/@Noqeev", Icon: MediumIcon },
];
