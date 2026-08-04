"use client";
/**
 * LandingPage.js — the marketing/first-impression page at "/".
 *
 * Unlike every other screen in the app (fixed-position, self-contained app
 * shells with their own internal scroll), this one is a real scrolling
 * document — globals.css scopes `scroll-behavior: smooth` and unlocks
 * html/body height specifically off the presence of #noviq-landing below,
 * so nothing here leaks into the Resume Studio / Artisans shells.
 */
import { use3DIntensity } from "@/lib/use3DIntensity";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { WhyNoviq } from "./WhyNoviq";
import { HowItWorks } from "./HowItWorks";
import { CareerSection } from "./CareerSection";
import { ArtisanTeaser } from "./ArtisanTeaser";
import { FAQ } from "./FAQ";
import { FinalCTA } from "./FinalCTA";
import { Footer } from "./Footer";
import { ThreeDIntensityControl } from "./ThreeDIntensityControl";

export default function LandingPage({ onOpen, onOpenArtisans, onOpenDashboard }) {
  const { intensity, setIntensity } = use3DIntensity();

  return (
    <div id="noviq-landing" className="relative w-full bg-background text-foreground">
      <Navbar onOpen={onOpen} onOpenDashboard={onOpenDashboard} />
      <main>
        <Hero onOpen={onOpen} onOpenArtisans={onOpenArtisans} intensity={intensity} />
        <WhyNoviq />
        <HowItWorks />
        <CareerSection />
        <ArtisanTeaser onOpenArtisans={onOpenArtisans} />
        <FAQ />
        <FinalCTA onOpen={onOpen} />
      </main>
      <Footer onOpen={onOpen} />
      <ThreeDIntensityControl intensity={intensity} setIntensity={setIntensity} />
    </div>
  );
}
