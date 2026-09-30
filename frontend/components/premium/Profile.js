"use client";
/**
 * Profile.js — the account hub reached from the Home/Jobs/Applications/
 * Profile nav. Layout follows the approved design reference exactly (see
 * the "Dashboard redesign: desktop view" artifact's account-hub window):
 * a hero identity row, then two grouped columns on desktop (Account+Grow
 * on the left, Shortcuts+App on the right, sign-out/delete in their own
 * small card below) collapsing to one column on mobile.
 *
 * Two rows are deliberately honest about not being real yet rather than
 * faked: Invite a friend and the security panel's 2FA note are both
 * labeled "Coming soon" — there is no referral system and no two-factor
 * flow in this backend today. "Resumes built" is a real count, not a
 * fabricated account limit — this app has no actual resume cap to report.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  X, User, LogOut, ChevronRight, Loader2, Trash2, HelpCircle,
  Gift, ShieldCheck, FileText, ScanLine, ClipboardList, Sparkles, Lock,
  Building2, Palette, ClipboardList as JobsIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Btn } from "./guest/components/primitives";
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

function Row({ icon: Icon, label, sublabel, onClick, disabled, danger, trailing, expanded }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 border-none bg-transparent p-3.5 text-left [-webkit-tap-highlight-color:transparent] disabled:opacity-50 ${danger ? "text-destructive" : "text-foreground"}`}
    >
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${danger ? "border-destructive/25 bg-destructive/10" : "border-border bg-muted"}`}>
        <Icon className={`size-3.5 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`m-0 text-[13px] font-bold ${danger ? "text-destructive" : "text-foreground"}`}>{label}</p>
        {sublabel && <p className="m-0 truncate text-[11.5px] text-muted-foreground">{sublabel}</p>}
      </div>
      {trailing !== undefined ? trailing : !disabled && (
        <ChevronRight className={`size-4 shrink-0 text-muted-foreground/50 transition-transform ${expanded ? "rotate-90" : ""}`} />
      )}
    </button>
  );
}

function BrightnessSlider() {
  const { brightness, setBrightness, min, max, default: defaultValue } = useBrightness();
  return (
    <div>
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
  const [appearanceOpen, setAppearanceOpen] = useState(false);
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
        <p className="m-0 text-[17px] font-bold text-foreground">Profile</p>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-10" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        )}
      </div>

      <div
        className="mx-auto w-full min-h-0 max-w-xl flex-1 overflow-y-auto px-5 lg:max-w-3xl"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        {authLoading ? (
          <Card className="flex items-center justify-center p-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : !user ? (
          <Card className="mb-5 grid justify-items-center gap-2.5 p-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted">
              <User className="size-[18px] text-muted-foreground" />
            </div>
            <p className="m-0 text-[13.5px] font-bold text-foreground">Not signed in</p>
            <p className="m-0 max-w-[240px] text-[12.5px] leading-relaxed text-muted-foreground">Sync across devices</p>
            <Btn small variant="gold" onClick={onOpenLogin}>Sign in</Btn>
          </Card>
        ) : (
          // Hero identity row — matches the account hub's own hero: a
          // bigger avatar, name, and "N resumes built · Personal
          // account" instead of the smaller card-with-chevron this used
          // to be (that action still exists, just as its own "Personal
          // profile" row inside Account below, same as the reference).
          <div className="mb-6 flex items-center gap-4">
            <button
              type="button" onClick={onOpenPersonalProfile} aria-label="Personal profile"
              className={`flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border [-webkit-tap-highlight-color:transparent] ${user.avatar_emoji ? "" : "font-mono text-lg font-bold"} ${tintFor(user.name || user.email)}`}
            >
              {user.avatar_emoji ? <Emoji3D emoji={user.avatar_emoji} size={64} /> : initialsOf(user.name || user.email)}
            </button>
            <div className="min-w-0">
              <p className="m-0 truncate text-[19px] font-bold text-foreground">{user.name || user.email.split("@")[0]}</p>
              <p className="m-0 mt-0.5 truncate text-[12.5px] text-muted-foreground">{savedResumesCount} resume{savedResumesCount === 1 ? "" : "s"} built · Personal account</p>
            </div>
          </div>
        )}

        {user && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left column — Account, Grow */}
            <div>
              <div className="mb-6">
                <GroupLabel>Account</GroupLabel>
                <Card className="p-0">
                  <Row icon={User} label="Personal profile" sublabel={user.email} onClick={onOpenPersonalProfile} />
                  <div className="border-t border-border">
                    <Row icon={Lock} label="Security center" onClick={() => setSecurityOpen((v) => !v)} expanded={securityOpen} />
                  </div>
                  {securityOpen && (
                    <div className="border-t border-border p-3.5">
                      <ChangePasswordForm onSubmit={changePassword} />
                      <p className="m-0 mt-3 text-[11px] text-muted-foreground">Two-factor authentication — coming soon.</p>
                    </div>
                  )}
                  <div className="border-t border-border">
                    <Row
                      icon={FileText} label="Resumes built"
                      trailing={<span className="font-mono text-[13px] font-bold text-foreground">{savedResumesCount}</span>}
                      onClick={() => go("resume", { viewAllResumes: true })}
                    />
                  </div>
                </Card>
              </div>

              <div>
                <GroupLabel>Grow</GroupLabel>
                <Card className="p-0">
                  <Row icon={Gift} label="Invite a friend" sublabel="Coming soon" disabled />
                </Card>
              </div>
            </div>

            {/* Right column — Shortcuts, App, then a small separate
                sign-out/delete card matching the reference's own
                un-grouped final card. */}
            <div>
              <div className="mb-6">
                <GroupLabel>Shortcuts</GroupLabel>
                <Card className="p-0">
                  <Row icon={FileText} label="My resumes" onClick={() => go("resume", { viewAllResumes: true })} />
                  <div className="border-t border-border"><Row icon={ScanLine} label="CV Scan" onClick={() => go("scan")} /></div>
                  <div className="border-t border-border"><Row icon={ClipboardList} label="Job tracker" onClick={() => go("jobtracker")} /></div>
                  <div className="border-t border-border"><Row icon={Sparkles} label="Jobs" sublabel="Apply with AI" onClick={() => go("apply")} /></div>
                  <div className="border-t border-border"><Row icon={Building2} label="Job board" sublabel="Browse verified listings" onClick={() => go("jobsboard")} /></div>
                </Card>
              </div>

              <div className="mb-6">
                <GroupLabel>App</GroupLabel>
                <Card className="p-0">
                  <Row icon={Palette} label="Appearance" onClick={() => setAppearanceOpen((v) => !v)} expanded={appearanceOpen} />
                  {appearanceOpen && (
                    <div className="border-t border-border p-3.5">
                      <div className="mb-3"><ThemeModePicker /></div>
                      <BrightnessSlider />
                    </div>
                  )}
                  <div className="border-t border-border">
                    <a href="mailto:support@noqeev.com" className="flex w-full items-center gap-3 p-3.5 text-left text-foreground">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                        <HelpCircle className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-[13px] font-bold">Help &amp; support</p>
                        <p className="m-0 truncate text-[11.5px] text-muted-foreground">support@noqeev.com</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </a>
                  </div>
                </Card>
              </div>

              <Card className="p-0">
                <button type="button" onClick={logout} className="flex w-full items-center gap-3 border-none bg-transparent p-3.5 text-left text-muted-foreground [-webkit-tap-highlight-color:transparent]">
                  <LogOut className="size-3.5" /> <span className="text-[13px] font-semibold">Sign out</span>
                </button>
                <div className="border-t border-border">
                  <AlertDialog open={confirmDeleteAccountOpen} onOpenChange={setConfirmDeleteAccountOpen}>
                    <AlertDialogTrigger asChild>
                      <button type="button" disabled={deletingAccount} className="flex w-full items-center gap-3 border-none bg-transparent p-3.5 text-left text-destructive [-webkit-tap-highlight-color:transparent] disabled:opacity-50">
                        {deletingAccount ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        <span className="text-[13px] font-bold">{deletingAccount ? "Deleting…" : "Delete my account"}</span>
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
              </Card>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
