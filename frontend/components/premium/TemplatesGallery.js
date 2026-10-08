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
import { ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { NavRail } from "./shared/NavRail";
import { NotificationsDialog } from "./shared/NotificationsDialog";
import { TemplatePreview } from "./shared/TemplatePreview";
import { layouts } from "./shared/resumeLayouts/registry";
import { getPreferredTemplate, setPreferredTemplate } from "@/lib/templatePreference";
import { clearDraft } from "./guest/useGuestDraft";
import { useLanguage } from "@/lib/i18n";

function TemplateCard({ layout, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={layout.label}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-3 rounded-2xl border p-5 text-center [-webkit-tap-highlight-color:transparent] ${
        selected ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <TemplatePreview layoutId={layout.id} width={120} height={156} />
      <div>
        <p className="m-0 flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-foreground">
          {layout.label}
          {selected && <Check className="size-3.5 text-primary" />}
        </p>
        <p className="m-0 mt-0.5 text-[11.5px] text-muted-foreground">{layout.description}</p>
      </div>
    </button>
  );
}

export default function TemplatesGallery({ onClose, onNavigate }) {
  const { t } = useLanguage();
  const LAYOUTS = layouts(t);
  const { user } = useAuth();
  const { isDesktop } = useViewport();
  const unread = useUnreadNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [selected, setSelected] = useState(() => getPreferredTemplate() || "classic");

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
  // draft instead of starting fresh).
  const done = () => {
    clearDraft();
    onNavigate?.("resume");
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
        <TemplateCard key={l.id} layout={l} selected={selected === l.id} onSelect={() => pick(l.id)} />
      ))}
    </div>
  );

  const intro = (
    <p className="m-0 mb-5 text-[13px] leading-relaxed text-muted-foreground">
      {t("templates.pickLayoutIntro")}
    </p>
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
    </motion.div>
  );
}
