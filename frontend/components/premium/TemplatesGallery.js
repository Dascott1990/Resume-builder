"use client";
/**
 * TemplatesGallery.js — Dashboard's Templates card "See all" destination.
 * Every real resume layout (shared/resumeLayouts/registry.js's LAYOUTS —
 * the same list GuestMode's own Style tab reads) in one scrollable grid.
 * Picking one just saves a preference (lib/templatePreference.js) that
 * the NEXT resume you start reads as its default layout — this screen
 * never touches a resume directly, so it's safe to open from Home at any
 * time, built or not.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { NavRail } from "./shared/NavRail";
import { NotificationsDialog } from "./shared/NotificationsDialog";
import { DocThumb } from "./shared/ResumeTemplateThumb";
import { layouts } from "./shared/resumeLayouts/registry";
import { getPreferredTemplate, setPreferredTemplate } from "@/lib/templatePreference";
import { loadDraft, clearDraft } from "./guest/useGuestDraft";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/i18n";

// Sharp, image-first collection item — no description or ATS paragraph
// under each one anymore (reported as cluttered/"buggy"-looking). The
// thumbnail carries the whole card now: a small corner badge for ATS
// status (icon + native title tooltip, not inline body copy) and the
// existing selected-checkmark overlay are the only things on top of it.
// Name stays as a single small caption, not a paragraph.
function TemplateCard({ layout, selected, onSelect, name, thumbWidth }) {
  const { t } = useLanguage();
  const atsTitle = layout.atsSafe ? t("templates.atsSafe") : layout.atsNote;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={layout.label}
      aria-pressed={selected}
      className="flex flex-col items-center gap-2 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
    >
      <div className={`relative rounded-xl p-1 transition-colors ${selected ? "bg-primary/10 ring-2 ring-primary/50" : "ring-1 ring-border"}`}>
        {/* active=true always, not tied to `selected` — this is a flat
            comparison grid, not a carousel with one focused card, so every
            template should read as a full-confidence preview. */}
        <DocThumb layoutId={layout.id} active width={thumbWidth} name={name} />
        {selected && (
          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
        <span
          title={atsTitle}
          className={`absolute bottom-2 left-2 flex size-5 items-center justify-center rounded-full shadow ${
            layout.atsSafe ? "bg-success text-white" : "bg-warning text-white"
          }`}
        >
          {layout.atsSafe ? <Check className="size-3" strokeWidth={3} /> : <TriangleAlert className="size-3" strokeWidth={2.5} />}
        </span>
      </div>
      <span className="text-[12.5px] font-bold text-foreground">{layout.label}</span>
    </button>
  );
}

export default function TemplatesGallery({ onClose, onNavigate }) {
  const { t } = useLanguage();
  const LAYOUTS = layouts(t);
  const { user } = useAuth();
  const { isDesktop, width: viewportWidth } = useViewport();
  const unread = useUnreadNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [selected, setSelected] = useState(() => getPreferredTemplate() || "classic");

  // The thumbnail renders through the real ResumeDocument at a fixed
  // pixel size (not a responsive image CSS can just shrink), so it has
  // to be computed from the ACTUAL grid-cell width or it silently
  // overflows its own card — confirmed live: a hardcoded 172px thumbnail
  // bled into the next card on every phone from 320–414px wide, since
  // the 2-column grid's real cell width there is only 134–181px. Mirrors
  // the exact container math below: px-8 (desktop, capped at max-w-4xl)
  // or px-5 (mobile/tablet), gap-3 between cards, 2 columns under the
  // grid's own sm: (640px) breakpoint and 3 at/above it, minus the 4px
  // ring padding (p-1) each thumbnail sits inside.
  const thumbWidth = viewportWidth > 0 ? (() => {
    const containerPad = isDesktop ? 64 : 40;
    const containerCap = isDesktop ? 896 : Infinity;
    const columns = viewportWidth >= 640 ? 3 : 2;
    const effectiveWidth = Math.min(viewportWidth, containerCap) - containerPad;
    const cellWidth = (effectiveWidth - 12 * (columns - 1)) / columns;
    return Math.max(90, Math.min(172, Math.floor(cellWidth - 8)));
  })() : 148;

  const pick = (id) => {
    setSelected(id);
    setPreferredTemplate(id);
  };

  // Picking a layout here is about starting the NEXT resume with it, per
  // this screen's own docstring above — so Done clears any unfinished
  // in-progress draft (not a saved resume, just unsubmitted form state)
  // before handing off to "new", the same way a stale draft would
  // otherwise silently override the layout someone just picked (GuestMode
  // reads docStyle from that draft first — confirmed live, picking Minimal
  // here and hitting Done without this landed back in an old Classic
  // draft instead of starting fresh). That clear is silent and
  // irreversible, though — if there's actually real unfinished work
  // sitting in it (a pasted job description, a generated resume, a cover
  // letter), confirm first instead of wiping it the instant Done is
  // tapped. An empty/never-touched draft (or just leftover tab/step/
  // docStyle navigation state) needs no prompt — nothing real to lose.
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const hasRealDraftContent = () => {
    const d = loadDraft();
    return !!(d && (d.jobDesc?.trim() || d.genResult || d.resume || d.coverLetter || d.interviewTips || d.application));
  };
  const startFresh = () => {
    setConfirmStartOpen(false);
    clearDraft();
    onNavigate?.("resume");
  };
  const done = () => {
    if (hasRealDraftContent()) setConfirmStartOpen(true);
    else startFresh();
  };

  const renderDoneButton = (fullWidth) => (
    <button
      type="button"
      onClick={done}
      className={`flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-[13.5px] font-bold whitespace-nowrap text-primary-foreground [-webkit-tap-highlight-color:transparent] ${fullWidth ? "w-full" : ""}`}
    >
      <Check className="size-4" /> {t("templates.done")}
    </button>
  );

  const grid = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {LAYOUTS.map((l) => (
        <TemplateCard key={l.id} layout={l} selected={selected === l.id} onSelect={() => pick(l.id)} name={user?.name} thumbWidth={thumbWidth} />
      ))}
    </div>
  );

  const intro = (
    <p className="m-0 mb-5 text-[13px] leading-relaxed text-muted-foreground">
      {t("templates.pickLayoutIntro")}
    </p>
  );

  // Shared between both breakpoint branches below — isDesktop forks into
  // two separate return trees past this point, so this needs to be
  // mounted in each one explicitly rather than once at the bottom.
  const confirmStartDialog = (
    <AlertDialog open={confirmStartOpen} onOpenChange={setConfirmStartOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("templates.confirmStartTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("templates.confirmStartDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={startFresh}>{t("templates.confirmStartAction")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isDesktop) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex bg-background font-sans text-foreground">
        <NavRail user={user} onNavigate={onNavigate} onNotifClick={() => setNotifOpen(true)} />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-8 py-8 pb-24">
            <p className="m-0 mb-1 text-[22px] font-bold text-foreground">{t("templates.heading")}</p>
            {intro}
            {grid}
          </div>
          <div className="pointer-events-none sticky bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-8 pt-8 pb-6">
            <div className="pointer-events-auto mx-auto w-full max-w-4xl">
              <div className="ml-auto w-fit">{renderDoneButton(false)}</div>
            </div>
          </div>
        </main>
        <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={() => { setNotifOpen(false); onNavigate?.("apply"); }} />
        {confirmStartDialog}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans text-foreground">
      <div className="flex shrink-0 items-center gap-3 px-5 pb-3" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        {onClose && (
          <button onClick={onClose} aria-label={t("personalProfile.back")} className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <p className="m-0 text-[16px] font-bold text-foreground">{t("templates.heading")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {intro}
        {grid}
      </div>
      <div className="shrink-0 border-t border-border bg-background px-5 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {renderDoneButton(true)}
      </div>
      {confirmStartDialog}
    </motion.div>
  );
}
