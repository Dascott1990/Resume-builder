"use client";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Btn } from "../primitives";
import { useLanguage } from "@/lib/i18n";

export function SettingsTab({ saved, onResetStyle, onClearAll }) {
  const { t } = useLanguage();
  return (
    <div className="p-4">
      <p className="m-0 mb-4 font-serif text-[17px] italic text-foreground">
        {t("guestMode.settings")}
      </p>

      <div className="mb-4 border-b border-border pb-4">
        <p className="m-0 mb-0.5 text-[13px] font-semibold text-foreground">{t("settingsTab.styleDefaults")}</p>
        <Btn small variant="ghost" icon="RefreshCw" onClick={onResetStyle}>
          {t("settingsTab.resetStyle")}
        </Btn>
      </div>

      <div className="mb-4 border-b border-border pb-4">
        <p className="m-0 mb-0.5 text-[13px] font-semibold text-foreground">{t("settingsTab.savedResumes")}</p>
        <p className="m-0 mb-2.5 text-xs leading-relaxed text-muted-foreground">
          {saved.length > 0
            ? t(saved.length === 1 ? "settingsTab.resumesStoredOne" : "settingsTab.resumesStoredOther", { n: saved.length })
            : t("settingsTab.nothingSavedYet")}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Btn small variant="danger" icon="Trash2" disabled={saved.length === 0}>
              {t("settingsTab.clearAllSaved")}
            </Btn>
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
