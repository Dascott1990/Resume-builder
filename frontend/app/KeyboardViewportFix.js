"use client";
import { useEffect } from "react";

// Every real screen in this app is a `position: fixed`/`absolute inset-0`
// shell sized against #__next's own height (see globals.css's own
// comment on that element — "every other screen is a fixed-position app
// shell"). That shell's height was a hardcoded `100%`, which resolves
// against the LAYOUT viewport — on mobile, opening the keyboard shrinks
// the VISUAL viewport (what's actually visible above the keyboard) but
// leaves the layout viewport's size untouched, so a shell sized to
// `height: 100%` never shrinks to match, and nothing in the page tells
// the browser the focused input is now sitting behind the keyboard
// instead of above it — confirmed live as exactly this: an input field
// at or below the keyboard's own top edge, with no scroll happening to
// bring it back into view, because the fixed shell gives the browser no
// taller-than-viewport document to scroll in the first place.
//
// Fixes both ends of that gap:
//   1. Tracks the VisualViewport API's real height in a CSS custom
//      property (--app-vh), which globals.css's `#__next` rule now reads
//      instead of a bare 100% — every inset-0 shell in the app
//      automatically shrinks to the actually-visible area the instant the
//      keyboard opens, site-wide, with no per-screen change needed.
//   2. A single `focusin` listener (capture phase — catches every input/
//      textarea/select/contenteditable anywhere, no per-component opt-in)
//      scrolls the newly focused field into view once the keyboard
//      animation has actually finished — iOS needs real time here; firing
//      scrollIntoView() immediately on focus measures the pre-keyboard
//      layout and scrolls to the wrong position. Keyed off visualViewport's
//      own resize event (fires when the keyboard finishes animating in),
//      not a fixed timeout guess.
//
// VisualViewport is undefined in a handful of older/non-mobile browsers
// (most of them with no on-screen keyboard to begin with) — every listener
// below is skipped entirely in that case, leaving the old 100% behavior
// as the fallback, same as before this fix existed.
export function KeyboardViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const setAppVh = () => root.style.setProperty("--app-vh", `${vv.height}px`);
    setAppVh();

    let focusedEl = null;
    const scrollFocusedIntoView = () => {
      if (!focusedEl) return;
      focusedEl.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    const onResize = () => { setAppVh(); scrollFocusedIntoView(); };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", setAppVh);

    // Capture phase — a plain bubbling `focus` listener on document never
    // fires at all, since `focus`/`blur` don't bubble; `focusin`/`focusout`
    // are the bubbling equivalents and `addEventListener`'s capture flag
    // isn't actually required for those, but keeping it true costs nothing
    // and guarantees this always sees the event first, before any
    // individual field's own onFocus handler could stop its propagation.
    const onFocusIn = (e) => {
      const el = e.target;
      const tag = el?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !el?.isContentEditable) return;
      focusedEl = el;
    };
    const onFocusOut = () => { focusedEl = null; };
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);

    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", setAppVh);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      root.style.removeProperty("--app-vh");
    };
  }, []);

  return null;
}
