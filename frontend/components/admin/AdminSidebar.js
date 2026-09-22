"use client";
/**
 * AdminSidebar.js — persistent left-column navigation for the admin panel,
 * replacing the horizontal Tabs/TabsList strip that used to overflow and
 * need sideways scrolling at 8 items. Grouped, not alphabetical: Overview
 * alone, then Content (the things admins moderate day to day), then
 * Operations (infrastructure-facing — vendors, system health).
 *
 * Rendered twice by AdminDashboard.js — once as a static lg:+ column, once
 * inside a mobile slide-out drawer — same content, same nav definition,
 * so the two surfaces can never drift out of sync with each other. Same
 * AnimatePresence + backdrop shape app/brand/page.js's own MoreMenu
 * already established this session, not a new pattern.
 */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  LayoutGrid, Users, FileText, Briefcase, Star, Wrench, Package, Activity,
  Sparkles, KeyRound, LogOut, Loader2,
} from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { Button } from "@/components/ui/button";
import Logo from "@/components/premium/Logo";

export const NAV_GROUPS = [
  { label: null, items: [{ id: "overview", label: "Overview", Icon: LayoutGrid }] },
  {
    label: "Content",
    items: [
      { id: "users", label: "Users", Icon: Users },
      { id: "resumes", label: "Resumes", Icon: FileText },
      { id: "applications", label: "Applications", Icon: Briefcase },
      { id: "reviews", label: "Reviews", Icon: Star },
      { id: "artisans", label: "Artisans", Icon: Wrench },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "vendors", label: "Vendors", Icon: Package },
      { id: "system", label: "System", Icon: Activity },
    ],
  },
];

// Moved here from AdminDashboard.js (was previously defined and used only
// there) — the sidebar's own footer is now the one place this renders.
// Goes through the exact same email-token flow a locked-out user would use
// themselves (see backend/app/api/admin.py's file docblock) — the admin
// panel triggers it, it never sees or sets anyone's password.
function ChangePasswordButton({ email }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
      toast.success(`Password reset link sent to ${email}.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <p className="m-0 px-2.5 py-2 text-[12px] text-muted-foreground">Reset link sent</p>;
  }
  return (
    <Button variant="ghost" size="sm" onClick={send} disabled={sending} className="justify-start">
      {sending ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
      Change password
    </Button>
  );
}

export function AdminSidebar({ activeSection, onNavigate, adminUser, onSignOut }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <Logo size={22} />
        <span className="text-[13px] font-semibold text-muted-foreground">Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label || "root"} className={i > 0 ? "mt-4" : ""}>
            {group.label && (
              <p className="m-0 mb-1 px-2.5 font-mono text-[10.5px] font-bold tracking-[0.12em] text-muted-foreground/60 uppercase">
                {group.label}
              </p>
            )}
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${
                      active ? "bg-primary/10 text-primary-text" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.Icon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-2.5 py-3">
        <p className="m-0 truncate px-2.5 pb-2 text-[11.5px] text-muted-foreground">{adminUser?.email}</p>
        <div className="grid gap-1">
          <Button variant="ghost" size="sm" asChild className="justify-start">
            <Link href="/brand"><Sparkles className="size-3.5" /> Brand kit</Link>
          </Button>
          <ChangePasswordButton email={adminUser?.email} />
          <Button variant="ghost" size="sm" onClick={onSignOut} className="justify-start">
            <LogOut className="size-3.5" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
