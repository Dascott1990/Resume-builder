"use client";
import { ArrowRight, Clapperboard, Captions } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW } from "./shared";

export function BrandTeaser({ onOpenDashboard }) {
  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-center py-24 sm:py-28">
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>Also on Noqeev</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.2rem)] leading-tight font-bold text-foreground">
              Look active while you're looking.
            </h2>
            <p className="m-0 mt-3 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
              A posts-and-video studio for your job search — AI captions, voice-over,
              and smooth clip transitions, all in your brand.
            </p>
            <button
              onClick={onOpenDashboard}
              className="mt-6 flex min-h-[54px] items-center gap-2 rounded-2xl border border-border bg-card px-6 text-[15.5px] font-bold text-foreground [-webkit-tap-highlight-color:transparent]"
            >
              <Clapperboard className="size-4 text-primary" />
              Dashboard
              <ArrowRight className="size-4" />
            </button>
          </Reveal>

          <Reveal delay={0.1}>
            {/* Illustrative mockup, not a live render — echoes the actual
                Story tool's vertical-frame + caption-pill look without
                pulling in a real export. */}
            <div className="mx-auto w-full max-w-[220px]">
              <div className="relative aspect-9/16 w-full overflow-hidden rounded-2xl border border-border bg-card">
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(160deg, color-mix(in oklch, var(--primary) 22%, transparent), transparent 60%)" }}
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 backdrop-blur-sm">
                  <Captions className="size-3 text-primary" />
                  <span className="font-mono text-[9.5px] font-bold tracking-wide text-foreground">SMOOTH JOIN</span>
                </div>
                <div className="absolute inset-x-3 bottom-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-center">
                  <p className="m-0 text-[12px] font-bold text-foreground">"Open to new roles"</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
