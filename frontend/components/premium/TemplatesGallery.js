"use client";
/**
 * TemplatesGallery.js — Dashboard's Templates card "See all" destination.
 * Every real (layout, accent color, font) combination — 5 layouts × 6
 * accents × 6 fonts, all already real and renderable (shared/
 * resumeLayouts/registry.js, guest/constants.js's ACCENTS/FONTS) = 180,
 * comfortably inside the 150-200 target for every region. Region (US/
 * Canada, UK/Commonwealth, Continental Europe, default — lib/
 * resumeRegions.js, the same honest grouping resume.py's own AI-tailoring
 * prompts already use) only changes page size and the Resume/CV label
 * shown, never which colors/fonts are offered — there's no real basis for
 * "this color is popular in your country."
 *
 * Picking a card saves the full triple (lib/templatePreference.js) that
 * the NEXT resume you start reads as its default style — this screen
 * never touches a resume directly, so it's safe to open from Home at any
 * time, built or not.
 */
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, TriangleAlert, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { NavRail } from "./shared/NavRail";
import { NotificationsDialog } from "./shared/NotificationsDialog";
import { DocThumb } from "./shared/ResumeTemplateThumb";
import { layouts } from "./shared/resumeLayouts/registry";
import { ACCENTS, FONTS } from "./guest/constants";
import { REGION_LIST, REGIONS, useDetectedRegion } from "@/lib/resumeRegions";
import {
  getPreferredStyle, setPreferredStyle, getPreferredTemplate,
  getRegionOverride, setRegionOverride,
} from "@/lib/templatePreference";
import { loadDraft, clearDraft } from "./guest/useGuestDraft";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/i18n";

const BATCH_SIZE = 24;

function TemplateCard({ combo, selected, onSelect, name, thumbWidth, pageSize }) {
  const { t } = useLanguage();
  const { layout, accent, font } = combo;
  const atsTitle = layout.atsSafe ? t("templates.atsSafe") : layout.atsNote;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${layout.label} ${accent.label} ${font.label}`}
      aria-pressed={selected}
      className="flex flex-col items-center gap-2 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
    >
      <div className={`relative rounded-xl p-1 transition-colors ${selected ? "bg-primary/10 ring-2 ring-primary/50" : "ring-1 ring-border"}`}>
        <DocThumb layoutId={layout.id} active width={thumbWidth} name={name} accent={accent.id} font={font.id} pageSize={pageSize} />
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
      <span className="text-center text-[11.5px] font-bold text-foreground">
        {layout.label} · {accent.label} · {font.label}
      </span>
    </button>
  );
}

// A labeled, filled "tray" per filter group — plain flex-wrap chips of
// uneven text width (e.g. "Minimal" next to "Times New Roman") wrapped
// raggedly, a different number per row depending on word length, worst
// in the narrow w-72 aside. A fixed 2-column grid instead of flex-wrap
// means every chip lands in a clean, aligned cell regardless of its own
// text length; the soft filled background (no border — "frameless") is
// what reads as one grouped control instead of loose chips floating
// directly on the aside's own background.
function FilterRow({ label, options, value, onChange, allLabel }) {
  const chip = (id, text, active) => (
    <button
      key={id ?? "all"} type="button" onClick={() => onChange(id)} title={text}
      className={`truncate rounded-md px-2.5 py-1.5 text-left text-[11.5px] font-semibold [-webkit-tap-highlight-color:transparent] ${
        active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div>
      <p className="m-0 mb-1.5 text-[11px] font-semibold text-muted-foreground/80">{label}</p>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1.5">
        {chip(null, allLabel, value === null)}
        {options.map((o) => chip(o.id, o.label, value === o.id))}
      </div>
    </div>
  );
}

export default function TemplatesGallery({ onClose, onNavigate }) {
  const { t } = useLanguage();
  const LAYOUTS = layouts(t);
  const { user } = useAuth();
  const { isDesktop, width: viewportWidth } = useViewport();
  const unread = useUnreadNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  // Collapsed by default — confirmed live this needed fixing: a region
  // explainer sentence, 4 region pills, and 3 full filter-chip rows all
  // stacked meant scrolling past a wall of controls before a single
  // template was visible, worst on mobile. Region is now one compact
  // select; the three filter rows only ever show once someone actually
  // asks to narrow things down.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Region: a manual override (set once, this device only) always wins;
  // otherwise whatever country_code actually detected, falling back to
  // REGIONS.default until (or unless) detection ever resolves.
  const detectedRegion = useDetectedRegion();
  const [regionOverrideId, setRegionOverrideIdState] = useState(() => getRegionOverride());
  const activeRegion = (regionOverrideId && REGIONS[regionOverrideId]) || detectedRegion || REGIONS.default;
  const chooseRegion = (id) => {
    setRegionOverrideIdState(id);
    setRegionOverride(id);
  };

  const combos = useMemo(() => {
    const list = [];
    for (const l of LAYOUTS) {
      for (const a of ACCENTS) {
        for (const f of FONTS) {
          list.push({ id: `${l.id}-${a.id}-${f.id}`, layout: l, accent: a, font: f });
        }
      }
    }
    return list;
  }, [LAYOUTS]);

  const [filterLayout, setFilterLayout] = useState(null);
  const [filterAccent, setFilterAccent] = useState(null);
  const [filterFont, setFilterFont] = useState(null);
  const visibleCombos = useMemo(
    () => combos.filter((c) =>
      (!filterLayout || c.layout.id === filterLayout) &&
      (!filterAccent || c.accent.id === filterAccent) &&
      (!filterFont || c.font.id === filterFont)
    ),
    [combos, filterLayout, filterAccent, filterFont]
  );

  // A returning visitor's own already-picked combination can land well
  // past the first batch (combos are generated layout-then-accent-then-
  // font, so e.g. "minimal" alone starts 72 entries in) — its checkmark
  // is still real (state/localStorage are correct regardless), just not
  // visible until "Load more" reaches it. Deliberately not force-expanded
  // to cover it: the worst case (a preference near the very end) would
  // mean rendering all 180 cards on mount for that visitor, exactly the
  // jank this batching exists to avoid — a rare, purely cosmetic gap is
  // the better trade than reintroducing that for everyone.
  const [shown, setShown] = useState(BATCH_SIZE);
  useEffect(() => { setShown(BATCH_SIZE); }, [filterLayout, filterAccent, filterFont]);

  const initialSelectedId = (() => {
    const rich = getPreferredStyle();
    if (rich?.layout && rich?.accent && rich?.font) return `${rich.layout}-${rich.accent}-${rich.font}`;
    const layoutOnly = getPreferredTemplate();
    return layoutOnly ? `${layoutOnly}-navy-calibri` : "classic-navy-calibri";
  })();
  const [selected, setSelected] = useState(initialSelectedId);

  const thumbWidth = viewportWidth > 0 ? (() => {
    const containerPad = isDesktop ? 64 : 40;
    const containerCap = isDesktop ? 896 : Infinity;
    const columns = viewportWidth >= 640 ? 3 : 2;
    const effectiveWidth = Math.min(viewportWidth, containerCap) - containerPad;
    const cellWidth = (effectiveWidth - 12 * (columns - 1)) / columns;
    return Math.max(90, Math.min(172, Math.floor(cellWidth - 8)));
  })() : 148;

  const pick = (combo) => {
    setSelected(combo.id);
    setPreferredStyle({ layout: combo.layout.id, accent: combo.accent.id, font: combo.font.id });
  };

  // Same draft-confirmation guard as before this screen expanded — see
  // the original docstring's reasoning, unchanged by the gallery rework.
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

  const activeFilterCount = [filterLayout, filterAccent, filterFont].filter(Boolean).length;

  // One compact line: a real native <select> for region (far less vertical
  // space than 4 wrapping pills, and a more conventional control for "pick
  // one of a few options" than a button row), the resulting format inline
  // next to it, and a single "Filters" toggle on the right — the three
  // chip rows only ever mount once that's actually opened.
  const controlsRow = (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="relative">
        <select
          value={activeRegion.id}
          onChange={(e) => chooseRegion(e.target.value)}
          className="appearance-none rounded-lg border border-border bg-background py-1.5 pr-7 pl-3 text-[12.5px] font-semibold text-foreground [-webkit-tap-highlight-color:transparent]"
        >
          {REGION_LIST.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
      <span className="text-[11.5px] text-muted-foreground">{t("templates.formatLabel", { docType: activeRegion.docLabel })}</span>
      <button
        type="button" onClick={() => setFiltersOpen((v) => !v)}
        className={`ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold [-webkit-tap-highlight-color:transparent] ${
          activeFilterCount > 0 ? "border-primary bg-primary/10 text-primary-text" : "border-border text-foreground"
        }`}
      >
        <SlidersHorizontal className="size-3.5" />
        {t("templates.filters")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>
    </div>
  );

  const filterRows = filtersOpen && (
    <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
      <FilterRow label={t("styleTab.layout")} options={LAYOUTS.map((l) => ({ id: l.id, label: l.label }))} value={filterLayout} onChange={setFilterLayout} allLabel={t("templates.filterAllLayouts")} />
      <FilterRow label={t("styleTab.accentColor")} options={ACCENTS.map((a) => ({ id: a.id, label: a.label }))} value={filterAccent} onChange={setFilterAccent} allLabel={t("templates.filterAllColors")} />
      <FilterRow label={t("styleTab.fontFamily")} options={FONTS.map((f) => ({ id: f.id, label: f.label }))} value={filterFont} onChange={setFilterFont} allLabel={t("templates.filterAllFonts")} />
    </div>
  );

  const grid = (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibleCombos.slice(0, shown).map((c) => (
          <TemplateCard
            key={c.id} combo={c} selected={selected === c.id} onSelect={() => pick(c)}
            name={user?.name} thumbWidth={thumbWidth} pageSize={activeRegion.pageSize}
          />
        ))}
      </div>
      {shown < visibleCombos.length && (
        <div className="mt-5 flex justify-center">
          <button
            type="button" onClick={() => setShown((s) => s + BATCH_SIZE)}
            className="rounded-xl border border-border bg-background px-5 py-2.5 text-[13px] font-semibold text-foreground [-webkit-tap-highlight-color:transparent]"
          >
            {t("templates.loadMore")}
          </button>
        </div>
      )}
    </>
  );

  const intro = (
    <p className="m-0 mb-4 text-[13px] leading-relaxed text-muted-foreground">
      {t("templates.pickLayoutIntro")}
    </p>
  );

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
    // Same real three-column shape JobsBoard.js already uses (NavRail +
    // main + a w-72 controls aside), not a two-column screen with
    // leftover empty space next to it — Region and Filters live here
    // instead of inline above the grid, always visible rather than a
    // toggle, matching how JobsBoard's own Filters aside behaves.
    const desktopAside = (
      <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-card p-5">
        <div>
          <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{t("templates.region")}</p>
          <div className="flex flex-col gap-1.5">
            {REGION_LIST.map((r) => (
              <button
                key={r.id} type="button" onClick={() => chooseRegion(r.id)}
                className={`rounded-lg border px-3 py-2 text-left text-[12.5px] font-semibold [-webkit-tap-highlight-color:transparent] ${
                  activeRegion.id === r.id ? "border-primary bg-primary/10 text-primary-text" : "border-border text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="m-0 mt-2 text-[11.5px] text-muted-foreground">{t("templates.formatLabel", { docType: activeRegion.docLabel })}</p>
        </div>
        <div>
          <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{t("templates.filters")}</p>
          <div className="flex flex-col gap-3">
            <FilterRow label={t("styleTab.layout")} options={LAYOUTS.map((l) => ({ id: l.id, label: l.label }))} value={filterLayout} onChange={setFilterLayout} allLabel={t("templates.filterAllLayouts")} />
            <FilterRow label={t("styleTab.accentColor")} options={ACCENTS.map((a) => ({ id: a.id, label: a.label }))} value={filterAccent} onChange={setFilterAccent} allLabel={t("templates.filterAllColors")} />
            <FilterRow label={t("styleTab.fontFamily")} options={FONTS.map((f) => ({ id: f.id, label: f.label }))} value={filterFont} onChange={setFilterFont} allLabel={t("templates.filterAllFonts")} />
          </div>
        </div>
      </aside>
    );

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
        {desktopAside}
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
        {controlsRow}
        {filterRows}
        {grid}
      </div>
      <div className="shrink-0 border-t border-border bg-background px-5 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {renderDoneButton(true)}
      </div>
      {confirmStartDialog}
    </motion.div>
  );
}
