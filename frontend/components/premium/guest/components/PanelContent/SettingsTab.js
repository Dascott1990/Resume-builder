"use client";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Btn } from "../primitives";
import { TemplatePreview } from "../../../shared/TemplatePreview";
import { layouts, DEFAULT_LAYOUT } from "../../../shared/resumeLayouts/registry";
import { setPreferredTemplate } from "@/lib/templatePreference";
import { useLanguage } from "@/lib/i18n";

// Leads with the setting people actually touch (which template new resumes
// start from), shows its CURRENT value instead of just describing what the
// control does, and visually demotes the destructive action to last and
// smallest — the three things real settings-screen research converges on,
// and the exact opposite of how this screen used to read (two equal-weight
// cards, one of them a "delete everything" button, nothing about templates
// at all). Picking a card here does two things at once: persists the
// choice for the NEXT resume (lib/templatePreference.js, same mechanism
// TemplatesGallery's "Done" button already uses) and, if a resume is open
// right now, updates it live too (same as BuilderSidebar's own Templates
// tab) — so this never reads as a dead setting that "did nothing."
export function SettingsTab({ saved, docStyle, setDocStyle, onResetStyle, onClearAll }) {
  const { t } = useLanguage();
  const LAYOUTS = layouts(t);
  const currentLayoutId = docStyle?.layout || DEFAULT_LAYOUT;
  const currentLayout = LAYOUTS.find((l) => l.id === currentLayoutId) || LAYOUTS[0];

  const selectLayout = (id) => {
    setPreferredTemplate(id);
    setDocStyle?.((s) => ({ ...s, layout: id }));
  };

  return (
    <div className="p-4">
      <p className="m-0 mb-4 font-serif text-[17px] italic text-foreground">
        {t("guestMode.settings")}
      </p>

      <div className="mb-5">
        <p className="m-0 text-[13px] font-semibold text-foreground">{t("settingsTab.defaultTemplate")}</p>
        <p className="m-0 mb-2.5 text-xs text-muted-foreground">{t("settingsTab.currentlyUsing", { name: currentLayout.label })}</p>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => selectLayout(l.id)}
              aria-pressed={currentLayoutId === l.id}
              className={`flex flex-col items-center gap-1.5 rounded-[10px] border p-2 [-webkit-tap-highlight-color:transparent] ${
                currentLayoutId === l.id ? "border-foreground/40 bg-muted/60" : "border-border"
              }`}
            >
              <TemplatePreview layoutId={l.id} width={56} height={74} />
              <span className="text-center text-[10.5px] font-bold text-foreground">{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 border-t border-border pt-4">
        <p className="m-0 mb-0.5 text-[13px] font-semibold text-foreground">{t("settingsTab.styleDefaults")}</p>
        <Btn small variant="ghost" icon="RefreshCw" onClick={onResetStyle}>
          {t("settingsTab.resetStyle")}
        </Btn>
      </div>

      {/* Visually subordinate on purpose — smaller text, no card framing,
          last in the list — a destructive, rarely-used action shouldn't
          compete for attention with the two real settings above it. */}
      <div className="border-t border-border pt-3">
        <p className="m-0 mb-1 text-[11.5px] font-semibold text-muted-foreground">{t("settingsTab.savedResumes")}</p>
        <p className="m-0 mb-2 text-[11px] leading-relaxed text-muted-foreground/80">
          {saved.length > 0
            ? t(saved.length === 1 ? "settingsTab.resumesStoredOne" : "settingsTab.resumesStoredOther", { n: saved.length })
            : t("settingsTab.nothingSavedYet")}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={saved.length === 0}
              className="border-none bg-transparent p-0 text-[11.5px] font-semibold text-destructive/70 underline-offset-2 hover:text-destructive hover:underline disabled:opacity-40 disabled:no-underline [-webkit-tap-highlight-color:transparent]"
            >
              {t("settingsTab.clearAllSaved")}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settingsTab.deleteAllQuestion", { n: saved.length })}</AlertDialogTitle>
              <AlertDialogDescription>{t("settingsTab.cantUndo")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onClearAll}>{t("settingsTab.yesDelete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
