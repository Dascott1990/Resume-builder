"use client";
import { Reveal, SECTION_WRAP } from "./shared";
import { LogoMark } from "../Logo";

// The brand's own story, said plainly — the short pillar and the tall one,
// bridged. This is the section that explains *why* the mark looks the way
// it does, for anyone who scrolls slowly enough to wonder.
export function CareerSection() {
  return (
    <section className="relative overflow-hidden border-y border-border py-24 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]"
      >
        <LogoMark size="100%" style={{ width: "100%", height: "100%" }} />
      </div>

      <div className={`${SECTION_WRAP} relative`}>
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="m-0 text-balance font-serif text-[clamp(1.5rem,4.2vw,2.5rem)] leading-[1.35] font-medium text-foreground italic">
            "A gap on your resume isn't the end of the story. A layoff, a
            career change, a first job after years away — they're all just
            the short pillar. Noviq is the bridge to the tall one."
          </p>
          <p className="m-0 mt-6 text-[13px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
            No judgment. No account required. Just a better resume, fast.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
