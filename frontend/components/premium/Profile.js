"use client";
/**
 * Profile.js — the account hub reached from the Home/Jobs/Applications/
 * Profile nav. One well-arranged home for everything account-shaped:
 * identity (hands off to PersonalProfile.js), appearance, security,
 * shortcuts back into the app's core features, and the app-level odds and
 * ends (help, sign out). Replaces the old Settings.js, which mixed a
 * customer account card with a whole parallel artisan-account card — now
 * that there's only one account type, this is a flatter, real "hub"
 * instead of "settings screen."
 *
 * Two rows here are deliberately honest about not being real yet rather
 * than faked: Invite friends and Security center's 2FA row are both
 * labeled "Coming soon" and disabled — there is no referral system and no
 * two-factor flow in this backend today. "Resumes built" is a real count
 * from the signed-in account's own saved resumes, not a fabricated limit —
 * this app has no actual resume cap to report.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  X, User, Palette, LogOut, ChevronRight, Loader2, Trash2, HelpCircle,
  Gift, ShieldCheck, FileText, ScanLine, ClipboardList, Sparkles, Lock, Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import Emoji3D from "./shared/Emoji3D";
import { tintFor, initialsOf } from "./shared/artisanDisplay";
import { ThemeModePicker } from "./shared/ThemeToggle";
import { useBrightness } from "@/lib/useBrightness";
import { useAuth } from "@/lib/useAuth";
import { apiListSaved } from "./guest/api";
import ChangePasswordForm from "./shared/ChangePasswordForm";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

function GroupLabel({ children }) {
  return <p className="m-0 mb-1.5 px-1 font-mono text-[10px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{children}</p>;
}

function Row({ icon: Icon, label, sublabel, onClick, disabled, danger, trailing }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 border-none bg-transparent p-3.5 text-left [-webkit-tap-highlight-color:transparent] disabled:opacity-50 ${danger ? "text-destructive" : "text-foreground"}`}
    >
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${danger ? "border-destructive/25 bg-destructive/10" : "border-border bg-muted"}`}>
        <Icon className={`size-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`m-0 text-[13px] font-bold ${danger ? "text-destructive" : "text-foreground"}`}>{label}</p>
        {sublabel && <p className="m-0 truncate text-[11.5px] text-muted-foreground">{sublabel}</p>}
      </div>
      {trailing !== undefined ? trailing : !disabled && <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />}
    </button>
  );
}

function BrightnessSlider() {
  const { brightness, setBrightness, min, max, default: defaultValue } = useBrightness();
  return (
    <div className="p-3.5 pt-0">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="m-0 text-[12px] font-semibold text-muted-foreground">Screen brightness</p>
        <span className="font-mono text-[11px] text-muted-foreground/70">{brightness}%</span>
      </div>
      <input type="range" min={min} max={max} step={5} value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="w-full accent-primary" />
      {brightness !== defaultValue && (
        <button type="button" onClick={() => setBrightness(defaultValue)} className="border-none bg-transparent p-0 text-[10.5px] font-bold text-primary">Reset</button>
      )}
    </div>
  );
}

export default function Profile({ onClose, onOpenLogin, onOpenPersonalProfile, go }) {
  const { user, loading: authLoading, changePassword, logout, deleteAccount } = useAuth();
  const [securityOpen, setSecurityOpen] = useState(false);
  const [confirmDeleteAccountOpen, setConfirmDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savedResumesCount, setSavedResumesCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    apiListSaved().then((list) => setSavedResumesCount(list.length)).catch(() => {});
  }, [user]);

  const deleteMyAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      toast.success("Your account has been deleted.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans text-foreground"
    >
      <div className="flex shrink-0 items-center justify-between px-5 pb-3.5" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3">
          <IconTile icon={User} size="sm" />
          <p className="m-0 text-[17px] font-bold text-foreground">Profile</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-10" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        )}
      </div>

      <div
        className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col gap-5 overflow-y-auto px-5 lg:max-w-2xl"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        {authLoading ? (
          <Card className="flex items-center justify-center p-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : !user ? (
          <Card className="grid justify-items-center gap-2.5 p-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted">
              <User className="size-[18px] text-muted-foreground" />
            </div>
            <p className="m-0 text-[13.5px] font-bold text-foreground">Not signed in</p>
            <p className="m-0 max-w-[240px] text-[12.5px] leading-relaxed text-muted-foreground">Sync across devices</p>
            <Btn small variant="gold" onClick={onOpenLogin}>Sign in</Btn>
          </Card>
        ) : (
          <button
            type="button"
            onClick={onOpenPersonalProfile}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left [-webkit-tap-highlight-color:transparent]"
          >
            <div className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border ${user.has_avatar_photo || user.avatar_emoji ? "" : "font-mono text-sm font-bold"} ${tintFor(user.name || user.email)}`}>
              {user.avatar_emoji ? <Emoji3D emoji={user.avatar_emoji} size={48} /> : initialsOf(user.name || user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[14px] font-bold text-foreground">{user.name || "No name set"}</p>
              <p className="m-0 truncate text-[12px] text-muted-foreground">{user.email}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
          </button>
        )}

        {user && (
          <div>
            <GroupLabel>Shortcuts</GroupLabel>
            <Card className="divide-y divide-border p-0">
              <Row icon={FileText} label="Build a resume" onClick={() => go("resume")} />
              <Row icon={ScanLine} label="CV Scan" onClick={() => go("scan")} />
              <Row icon={ClipboardList} label="Applications" onClick={() => go("jobtracker")} />
              <Row icon={Sparkles} label="Jobs" sublabel="Apply with AI" onClick={() => go("apply")} />
              <Row icon={Building2} label="Job board" sublabel="Browse verified listings" onClick={() => go("jobsboard")} />
            </Card>
          </div>
        )}

        {user && (
          <div>
            <GroupLabel>Grow</GroupLabel>
            <Card className="divide-y divide-border p-0">
              <Row icon={Gift} label="Invite friends" sublabel="Coming soon" disabled />
              <Row icon={FileText} label="Resumes built" trailing={<span className="font-mono text-[13px] font-bold text-foreground">{savedResumesCount}</span>} onClick={() => go("resume", { viewAllResumes: true })} />
            </Card>
          </div>
        )}

        <div>
          <GroupLabel>App</GroupLabel>
          <Card className="p-0">
            <div className="p-3.5">
              <ThemeModePicker />
            </div>
            <div className="border-t border-border">
              <BrightnessSlider />
            </div>
          </Card>
        </div>

        {user && (
          <div>
            <GroupLabel>Security</GroupLabel>
            <Card className="p-0">
              <Row icon={Lock} label="Change password" onClick={() => setSecurityOpen((v) => !v)} trailing={<ChevronRight className={`size-4 shrink-0 text-muted-foreground/50 transition-transform ${securityOpen ? "rotate-90" : ""}`} />} />
              {securityOpen && (
                <div className="border-t border-border p-3.5">
                  <ChangePasswordForm onSubmit={changePassword} />
                </div>
              )}
              <div className="border-t border-border">
                <Row icon={ShieldCheck} label="Two-factor authentication" sublabel="Coming soon" disabled />
              </div>
            </Card>
          </div>
        )}

        <div>
          <GroupLabel>Help</GroupLabel>
          <Card className="divide-y divide-border p-0">
            <a href="mailto:support@noqeev.com" className="flex w-full items-center gap-3 p-3.5 text-left text-foreground">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                <HelpCircle className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[13px] font-bold">Help & support</p>
                <p className="m-0 truncate text-[11.5px] text-muted-foreground">support@noqeev.com</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </a>
          </Card>
        </div>

        {user && (
          <div className="grid gap-1">
            <button type="button" onClick={logout} className="flex items-center gap-1.5 justify-self-start border-none bg-transparent p-1 text-[12.5px] font-semibold text-muted-foreground">
              <LogOut className="size-3.5" /> Sign out
            </button>
            <AlertDialog open={confirmDeleteAccountOpen} onOpenChange={setConfirmDeleteAccountOpen}>
              <AlertDialogTrigger asChild>
                <button type="button" disabled={deletingAccount} className="flex items-center gap-1.5 justify-self-start border-none bg-transparent p-1 text-[12.5px] font-bold text-destructive disabled:opacity-50">
                  {deletingAccount ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  {deletingAccount ? "Deleting…" : "Delete my account"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This can't be undone — your saved resumes, job tracker, and profile are permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={deleteMyAccount}>Delete account</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </motion.div>
  );
}
