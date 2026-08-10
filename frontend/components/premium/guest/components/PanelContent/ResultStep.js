"use client";
import { Fragment, useState } from "react";
import { Check } from "lucide-react";
import { Btn, TextLink, KwPill } from "../primitives";
import { ApplyBanner } from "../ApplyBanner";
import { AtsScoreModal } from "../AtsScoreModal";

// ── Step 3 result — one bold action, everything else a quiet text link ───────
export function ResultStep({
  genResult, application, coverLetter, isPhone, isDesktop, downloading, resume, jobDescription,
  onOpenPackage, onDownloadWord, onOpenPreview, onDownloadPdf, onBuildAnother, onApplyAts,
}) {
  const [atsOpen, setAtsOpen] = useState(false);
  return (
    <div className="p-4 pt-0 pb-[18px]">
      <div className="mb-4 border-b border-border pb-3.5">
        <p className="m-0 mb-1 flex items-center gap-2 font-serif text-lg italic text-foreground">
          <Check className="size-[15px] text-[var(--success)]" /> Resume ready
        </p>
        <p className="m-0 text-[12.5px] text-muted-foreground">
          {isPhone ? "Open Preview to edit" : "Click any text to edit"}
          {genResult.job_location && ` · ${genResult.job_location}`}
        </p>
      </div>

      {genResult.keywords?.length > 0 && (
        <div className="mb-4">
          <p className="m-0 mb-1.5 text-[11.5px] text-muted-foreground">
            Keywords matched
          </p>
          <div className="flex flex-wrap gap-y-[3px]">
            {genResult.keywords.map((k, i) => (
              <Fragment key={k}>
                {i > 0 && <span className="mx-1.5 text-muted-foreground/60">·</span>}
                <KwPill word={k} />
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {application && (
        <div className="mb-4">
          <ApplyBanner application={application} />
        </div>
      )}

      {/* One bold action, full stop. If Optimize produced a cover letter +
          tips, that whole package already got a first look in the modal
          right after generation — "Review & Download" just reopens it,
          it doesn't show a second, competing copy of the same content
          inline here. Everything else is a quiet text link, not another
          box fighting for the same attention as the one real action. */}
      <div className="flex flex-col gap-2.5">
        {coverLetter ? (
          <Btn variant="gold" icon="FileDown" onClick={onOpenPackage}
            disabled={!!downloading} loading={downloading === "docx"}>
            Review & Download
          </Btn>
        ) : (
          <Btn variant="gold" icon="FileDown" onClick={onDownloadWord}
            disabled={!!downloading} loading={downloading === "docx"}>
            Download Word
          </Btn>
        )}

        <div className="flex flex-wrap items-center justify-center [row-gap:2px]">
          {!isDesktop && (
            <>
              <TextLink onClick={onOpenPreview}>Open Preview</TextLink>
              <span className="px-1.5 text-xs text-muted-foreground/60">·</span>
            </>
          )}
          {!coverLetter && (
            <>
              <TextLink onClick={onDownloadPdf} disabled={!!downloading}>Download PDF</TextLink>
              <span className="px-1.5 text-xs text-muted-foreground/60">·</span>
            </>
          )}
          <TextLink onClick={() => setAtsOpen(true)}>ATS score</TextLink>
          <span className="px-1.5 text-xs text-muted-foreground/60">·</span>
          <TextLink onClick={onBuildAnother}>Build another</TextLink>
        </div>
      </div>

      <AtsScoreModal
        open={atsOpen}
        onClose={() => setAtsOpen(false)}
        resume={resume}
        jobDescription={jobDescription}
        onApply={onApplyAts}
      />
    </div>
  );
}
