"use client";
import { useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Btn, TextLink } from "./primitives";
import { CoverLetterView } from "./CoverLetterView";
import { ApplyBanner } from "./ApplyBanner";
import { InterviewChat } from "./InterviewChat";

// ── Package preview modal ─────────────────────────────────────────────────────
// Opens automatically right after Optimize finishes — the whole application
// package (resume summary, apply instructions, cover letter, interview tips)
// is reviewed here BEFORE anything downloads. One button downloads everything.
export function PackagePreviewModal({
  open, onClose, genResult, application, coverLetter, interviewTips, jobDescription,
  onCopyCoverLetter, copied, onDownloadAll, downloading,
  onCoverLetterDocx, onCoverLetterPdf, onCoverLetterChange,
}) {
  const [practiceOpen, setPracticeOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(88dvh,720px)] w-full max-w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        {/* Header — pinned */}
        <div className="shrink-0 border-b border-border px-[22px] pt-[22px] pb-3.5">
          <p className="m-0 mb-1 flex items-center gap-2 font-serif text-xl italic text-foreground">
            <Check className="size-[17px] text-[var(--success)]" /> Your application package is ready
          </p>
          <p className="m-0 text-[12.5px] text-muted-foreground">
            Review everything below, then download it all with one click.
            {genResult?.job_location && ` · ${genResult.job_location}`}
          </p>
        </div>

        {/* Body — the only part that scrolls */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[22px] py-4 [-webkit-overflow-scrolling:touch]">
          <div className="mb-4">
            <ApplyBanner application={application} />
          </div>

          {coverLetter && (
            <div className="mb-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                <p className="m-0 text-[11.5px] text-muted-foreground">
                  Cover letter <span className="text-muted-foreground/60">· click to edit</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Btn variant="ghost" icon={copied ? "Check" : "Clipboard"} onClick={onCopyCoverLetter} small>
                    {copied ? "Copied" : "Copy"}
                  </Btn>
                  <Btn variant="ghost" icon="FileDown" onClick={onCoverLetterDocx}
                    loading={downloading === "cl-docx"} disabled={!!downloading} small>
                    Word
                  </Btn>
                  <Btn variant="ghost" icon="FileDown" onClick={onCoverLetterPdf}
                    loading={downloading === "cl-pdf"} disabled={!!downloading} small>
                    PDF
                  </Btn>
                </div>
              </div>
              <CoverLetterView value={coverLetter} onChange={onCoverLetterChange} />
            </div>
          )}

          {interviewTips.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="m-0 text-[11.5px] text-muted-foreground">
                  Interview talking points
                </p>
                <Btn variant="ghost" icon="MessageCircle" onClick={() => setPracticeOpen(true)} small>
                  Practice
                </Btn>
              </div>
              <div className="flex flex-col gap-2">
                {interviewTips.map((tip, i) => (
                  <div key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-foreground">
                    <span className="shrink-0 text-primary">{i + 1}.</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <InterviewChat
          open={practiceOpen}
          onClose={() => setPracticeOpen(false)}
          jobDescription={jobDescription}
          interviewTips={interviewTips}
        />

        {/* Footer — pinned, stacked full-width so the primary action is
            never cramped or wrapped on a narrow phone; safe-area padding
            keeps it clear of the home-indicator on notched devices. */}
        <div
          className="flex shrink-0 flex-col gap-2 border-t border-border bg-popover px-[22px] pt-3.5"
          style={{ paddingBottom: "max(14px, calc(env(safe-area-inset-bottom) + 8px))" }}
        >
          <Btn variant="gold" icon="FileDown" onClick={onDownloadAll}
            disabled={!!downloading} loading={downloading === "docx"}>
            Download Package
          </Btn>
          <div className="flex items-center justify-center">
            <TextLink onClick={onCoverLetterPdf} disabled={!!downloading} small>Prefer PDF instead?</TextLink>
            <span className="px-1.5 text-[11px] text-muted-foreground/60">·</span>
            <TextLink onClick={onClose} small>Keep editing</TextLink>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
