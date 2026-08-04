"use client";
import { ArrowRight, Hammer, Star, Phone } from "lucide-react";
import { Reveal, SECTION_WRAP, EYEBROW } from "./shared";

export function ArtisanTeaser({ onOpenArtisans }) {
  return (
    <section id="artisans" className="relative py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <div className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>Also on Noviq</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.2rem)] leading-tight font-bold text-foreground">
              Not every next chance is behind a desk.
            </h2>
            <p className="m-0 mt-4 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
              Browse local electricians, carpenters, movers, and more —
              or list yourself in under a minute. Same rules as the resume
              side: no account, real contact info, one tap to call.
            </p>
            <button
              onClick={onOpenArtisans}
              className="mt-6 flex min-h-[50px] items-center gap-2 rounded-2xl border border-border bg-card px-6 text-[14.5px] font-bold text-foreground [-webkit-tap-highlight-color:transparent]"
            >
              <Hammer className="size-4 text-primary" />
              Find an Artisan
              <ArrowRight className="size-4" />
            </button>
          </Reveal>

          <Reveal delay={0.1}>
            {/* Illustrative example, not a live listing — deliberately generic
                name/number (555 = the standard non-working placeholder) so
                this mockup never gets confused with a real person's info. */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-mono text-sm font-bold text-primary">
                  J
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-foreground">J. Alvarez</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-primary">Electrician</span>
                    <span className="rounded border border-dashed border-border font-mono text-[10px] text-muted-foreground">9+ YRS</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Star className="size-3.5 fill-primary text-primary" />
                  <span className="font-mono text-[11px]">4.9</span>
                </div>
              </div>
              <p className="m-0 mt-3.5 text-[12.5px] leading-relaxed text-foreground">
                Residential and light commercial wiring, panel upgrades, and
                troubleshooting. Same-week availability.
              </p>
              <div className="mt-3.5 flex items-center justify-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 py-2.5 text-[12.5px] font-bold text-primary">
                <Phone className="size-3.5" />
                (555) 019-0142
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
