"use client";
/**
 * NavRail.js — the desktop left sidebar (Logo, Home/Jobs/Applications/
 * Profile, account card, theme toggle + notification bell). Started life
 * inline in Dashboard.js; pulled out here once JobsBoard.js needed the
 * exact same shell — every full-screen desktop view now mounts inside the
 * same persistent nav frame instead of JobsBoard's old isolated
 * back-button-header pattern, so navigating there doesn't feel like
 * leaving the app.
 *
 * `active` is a NAV_ITEMS id, or nothing (JobsBoard isn't one of the four
 * primary destinations, so it highlights none of them rather than
 * guessing which is "closest").
 */
import { tintFor, initialsOf } from "./artisanDisplay";
import Emoji3D from "./Emoji3D";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { ThemeToggle } from "./ThemeToggle";
import { QUICK_ACTION_ART } from "./quickActionArt";
import { DASHBOARD_ART } from "./dashboardArt";
import Logo from "../Logo";

function ArtTile({ art, size = 32, iconSize }) {
  const { Svg } = art;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[28%] bg-primary/10"
      style={{ width: size, height: size }}
    >
      <Svg size={iconSize || Math.round(size * 0.56)} />
    </span>
  );
}

export const NAV_ITEMS = [
  { id: "home", art: DASHBOARD_ART.home, label: "Home" },
  { id: "apply", art: QUICK_ACTION_ART.apply, label: "Jobs" },
  { id: "jobtracker", art: QUICK_ACTION_ART.tracker, label: "Applications" },
  { id: "profile", art: DASHBOARD_ART.profile, label: "Profile" },
];

export function NavRail({ active, user, onNavigate, onNotifClick }) {
  const unread = useUnreadNotifications();
  const needsAttention = unread.count > 0;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="p-5" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}><Logo size={22} /></div>
      <nav className="flex flex-col gap-1 px-3" aria-label="Dashboard">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-[13.5px] font-bold [-webkit-tap-highlight-color:transparent] ${
                isActive ? "bg-primary/10 text-primary" : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArtTile art={item.art} size={26} iconSize={15} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 px-3 pt-2">
        {user ? (
          <button
            onClick={() => onNavigate("profile")}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-left [-webkit-tap-highlight-color:transparent] hover:border-primary/30"
          >
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${user.avatar_emoji ? "" : "font-mono text-xs font-bold"} ${tintFor(user.name || user.email)}`}>
              {user.avatar_emoji ? <Emoji3D emoji={user.avatar_emoji} size={32} /> : initialsOf(user.name || user.email)}
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate text-[12.5px] font-bold text-foreground">{user.name || user.email}</p>
            </div>
          </button>
        ) : (
          <button
            onClick={() => onNavigate("profile")}
            className="w-full rounded-xl border border-primary/25 bg-primary/10 p-3 text-left [-webkit-tap-highlight-color:transparent]"
          >
            <p className="m-0 text-[12.5px] font-bold text-primary">Sign in</p>
            <p className="m-0 mt-0.5 text-[11px] leading-snug text-muted-foreground">Sync across devices</p>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border p-3">
        <ThemeToggle compact />
        <button
          onClick={onNotifClick}
          aria-label="Notifications"
          className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-transparent text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
        >
          <ArtTile art={DASHBOARD_ART.bell} size={24} iconSize={14} />
          {needsAttention && (
            unread.count > 0 ? (
              <span className="absolute top-1 right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                {unread.count > 9 ? "9+" : unread.count}
              </span>
            ) : (
              <span className="absolute top-1 right-1 size-2.5 rounded-full bg-destructive" />
            )
          )}
        </button>
      </div>
    </aside>
  );
}
