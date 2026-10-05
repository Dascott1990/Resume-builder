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
