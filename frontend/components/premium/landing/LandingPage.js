"use client";
/**
 * LandingPage.js — the marketing/first-impression page at "/".
 *
 * Unlike every other screen in the app (fixed-position, self-contained app
 * shells with their own internal scroll), this one is a real scrolling
 * document — globals.css scopes `scroll-behavior: smooth` and unlocks
 * html/body height specifically off the presence of #noqeev-landing below,
 * so nothing here leaks into the Resume Studio shell.
 */
import { useEffect } from "react";
import { use3DIntensity } from "@/lib/use3DIntensity";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { SeeItHappenSection } from "./SeeItHappenSection";
import { WhyNoqeev } from "./WhyNoqeev";
import { HowItWorks } from "./HowItWorks";
import { FAQ } from "./FAQ";
import { FinalCTA } from "./FinalCTA";
import { Footer } from "./Footer";
import { ThreeDIntensityControl } from "./ThreeDIntensityControl";
import { DotNetworkBackground } from "./DotNetworkBackground";

export default function LandingPage({ onOpenSignup }) {
  const { intensity, setIntensity } = use3DIntensity();

  // Belt-and-suspenders for the globals.css `html:has(#noqeev-landing)`
  // rule above: that CSS selector is supposed to live-react the instant
  // this div lands in the DOM, but confirmed live, mobile/tablet only —
  // Navbar.js and ThreeDIntensityControl.js (both `position: fixed`) can
  // render in the wrong spot (the navbar effectively invisible, the 3D
  // control missing) until a scroll or a refresh forces a reflow. Desktop
  // never showed this; it's a known class of mobile WebKit bug where a
  // `:has()`-driven style change doesn't reliably repaint position:fixed
  // descendants on its own. Setting the same height unlock here too,
  // imperatively, on mount, doesn't depend on the CSS engine's own timing
  // — it just runs. Reverted on unmount so navigating to any other
  // (fixed-position app-shell) screen gets the default `height: 100%`
  // back exactly like before this ever ran.
  useEffect(() => {
    const html = document.documentElement;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = document.body.style.height;
    html.style.height = "auto";
    document.body.style.height = "auto";
    return () => {
      html.style.height = prevHtmlHeight;
      document.body.style.height = prevBodyHeight;
    };
  }, []);

  return (
    <div id="noqeev-landing" className="relative w-full bg-background text-foreground">
      {/* Fixed behind the whole scrolling page, not scoped to one section —
          a wallpaper, not a per-section decoration. Everything else below
          gets `relative z-10` so it's guaranteed to stack above the fixed
          z-0 canvas regardless of DOM order. */}
      <DotNetworkBackground />
      <div className="relative z-10">
        <Navbar onOpenSignup={onOpenSignup} />
        <main>
          <Hero onOpenSignup={onOpenSignup} intensity={intensity} />
          <SeeItHappenSection />
          <WhyNoqeev />
          <HowItWorks />
          <FAQ />
          <FinalCTA onOpenSignup={onOpenSignup} />
        </main>
        <Footer onOpenSignup={onOpenSignup} />
        <ThreeDIntensityControl intensity={intensity} setIntensity={setIntensity} />
      </div>
    </div>
  );
}
