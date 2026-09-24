"use client";
/**
 * DotNetworkBackground.js — the landing page's ambient backdrop: a field
 * of soft dots, thin lines drawn between whichever ones happen to be
 * close together, each dot drifting slowly and independently. Fixed
 * behind the whole scrolling page (not tied to any one section) so it
 * reads as a wallpaper, not a decoration bolted onto the Hero — which
 * already has its own 3D showcase and doesn't need a second, competing
 * effect layered on top of it.
 *
 * Plain Canvas 2D, not a particle library — a few dozen dots redrawn once
 * a frame is cheap enough that a library would only add weight, not
 * capability. Speeds are deliberately tiny (a dot crosses maybe 20px a
 * minute) — "blended into the background" was the ask, not "moving
 * wallpaper you notice." prefers-reduced-motion gets a single static
 * frame, same posture Hero.js's own usePrefersReducedMotion already
 * takes elsewhere on this page.
 */
import { useEffect, useRef } from "react";

const DOT_SPACING = 90; // px between grid cells before jitter — density knob
const CONNECT_DISTANCE = 130; // px — dots farther apart than this never get a line
const DOT_RADIUS = 1.4;
const DRIFT_SPEED = 0.045; // px/frame ≈ 2.7px/s — intentionally almost imperceptible

function usePrefersReducedMotion() {
  const ref = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    ref.current = mq.matches;
    const onChange = (e) => { ref.current = e.matches; };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return ref;
}

export function DotNetworkBackground() {
  const canvasRef = useRef(null);
  const reducedMotionRef = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let dots = [];
    let raf = null;
    let w = 0, h = 0, dpr = 1;

    // Read once per (re)build — color-mix + CSS custom properties resolve
    // through getComputedStyle, so light/dark mode and any future accent
    // change are picked up automatically without this file knowing the
    // actual color values.
    const readColors = () => {
      const styles = getComputedStyle(document.documentElement);
      return {
        dot: styles.getPropertyValue("--foreground").trim() || "#000",
        line: styles.getPropertyValue("--foreground").trim() || "#000",
      };
    };

    const buildDots = () => {
      const cols = Math.ceil(w / DOT_SPACING) + 1;
      const rows = Math.ceil(h / DOT_SPACING) + 1;
      const next = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const angle = Math.random() * Math.PI * 2;
          next.push({
            x: x * DOT_SPACING + (Math.random() - 0.5) * DOT_SPACING * 0.6,
            y: y * DOT_SPACING + (Math.random() - 0.5) * DOT_SPACING * 0.6,
            vx: Math.cos(angle) * DRIFT_SPEED,
            vy: Math.sin(angle) * DRIFT_SPEED,
          });
        }
      }
      dots = next;
    };

    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots();
    };

    const draw = () => {
      const { dot: dotColor, line: lineColor } = readColors();
      ctx.clearRect(0, 0, w, h);

      // Connections first (so dots paint on top of line ends, not the
      // other way around) — O(n²) is fine at this dot count (a few
      // hundred at most on a wide desktop viewport).
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= CONNECT_DISTANCE) continue;
          const opacity = (1 - dist / CONNECT_DISTANCE) * 0.12;
          ctx.strokeStyle = `color-mix(in oklch, ${lineColor} ${opacity * 100}%, transparent)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = `color-mix(in oklch, ${dotColor} 22%, transparent)`;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      if (!reducedMotionRef.current) {
        for (const d of dots) {
          d.x += d.vx;
          d.y += d.vy;
          // Wrap around the edges (with a little slack) rather than
          // bouncing — bouncing reads as a "thing" you track with your
          // eye; wrapping just keeps the field looking uniformly alive
          // with no obvious event to notice.
          if (d.x < -20) d.x = w + 20;
          if (d.x > w + 20) d.x = -20;
          if (d.y < -20) d.y = h + 20;
          if (d.y > h + 20) d.y = -20;
        }
      }
      draw();
      raf = reducedMotionRef.current ? null : requestAnimationFrame(step);
    };

    resize();
    step();

    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        if (reducedMotionRef.current) draw();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    // The animation loop re-reads colors every frame, so a live theme
    // change self-corrects within ~16ms there — but useTheme.js toggles
    // dark mode by adding/removing a plain `.dark` class on <html>, not by
    // firing any event this component could otherwise hear, and with
    // reduced motion on, that loop never runs at all (draw() only ever
    // fires once, at mount). Without this, anyone who toggles theme after
    // that single draw is stuck looking at dots painted in the OLD
    // theme's color — visually close to invisible against a background
    // that's now the opposite of what they were drawn for.
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
    };
  }, [reducedMotionRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-full opacity-70"
    />
  );
}
