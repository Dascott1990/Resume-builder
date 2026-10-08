"use client";
/**
 * News.js — "What's new" (Noqeev's own product updates) and "Worth a look"
 * (the world-events feed), split out of Dashboard.js into its own screen.
 * Both were previously inline sections on Home; Home's mobile bottom nav
 * "News" tab now opens this screen instead of scrolling to them there —
 * same real content and endpoints, just given its own destination so it
 * has room to grow into a bigger feature on its own instead of competing
 * with Home's resume-building content for space.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, ChevronRight, Megaphone, Globe, Cpu, Atom, Landmark, Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import { apiRequest } from "./shared/api";
import Logo from "./Logo";
import { useLanguage } from "@/lib/i18n";

// Same source /brand/news reads (backend/app/api/brand.py's GET /news and
// /world-feed — both public reads, no admin gate) — this is the read-only
// consumer-facing view of the same real content, not a second copy of it.
const feedCategoryMeta = (t) => ({
  world: { label: t("news.categoryWorld"), Icon: Globe },
  tech: { label: t("news.categoryTechnology"), Icon: Cpu },
  physics: { label: t("news.categoryPhysics"), Icon: Atom },
  history: { label: t("news.categoryHistory"), Icon: Landmark },
  jobs: { label: t("news.categoryJobs"), Icon: Briefcase },
});

// Fixed (not random) scatter of points so server- and client-rendered markup
// match exactly — same dot-network visual language as the landing page's
// DotNetworkBackground, just recolored per category here.
const CATEGORY_ART_DOTS = [
  [8, 15], [22, 62], [35, 28], [48, 80], [58, 12],
  [70, 45], [82, 70], [91, 22], [15, 88], [62, 92],
];

function timeAgo(iso, t) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return t("common.today");
  if (days === 1) return t("common.yesterday");
  return t("common.daysAgo", { n: days });
}

// Every "Worth a look" card gets a brand-owned image: our own muted surface
// + dot pattern + the category's icon in our one accent color, generated
// entirely in CSS/SVG — see Dashboard.js's original comment on this (the
// reasoning carried over unchanged): no <img>, no external URL, nothing
// that can 404, hotlink-block, or come back blank once deployed.
function CategoryArt({ meta }) {
  const { Icon } = meta;
  return (
    <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {CATEGORY_ART_DOTS.map(([x, y], i) => (
          <circle key={i} cx={`${x}%`} cy={`${y}%`} r="1.6" fill="var(--primary)" fillOpacity="0.2" />
        ))}
      </svg>
      <Icon className="size-6 text-primary" strokeWidth={1.5} />
    </div>
  );
}

function SectionHeader({ children, onViewAll, viewAllLabel }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{children}</span>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-0.5 border-none bg-transparent p-0 text-[12px] font-bold text-primary">
          {viewAllLabel} <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

// Every external link on this screen (a "Worth a look" story, a "What's
// new" post) is a real, direct publisher URL, never a redirect or a
// shortened one — but it's still leaving Noqeev. The domain name in the
// button label already says where it goes; no paragraph explaining that
// further, and no color on either button — this is a plain confirmation,
// not a call to action either way.
function ExternalLinkDialog({ link, onClose }) {
  const domain = (() => {
    try { return new URL(link?.url || "").hostname.replace(/^www\./, ""); }
    catch { return null; }
  })();

  const { t } = useLanguage();
  const proceed = () => {
    window.open(link.url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Dialog open={!!link} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader><DialogTitle>{t("news.leavingNoqeev")}</DialogTitle></DialogHeader>
        <DialogFooter>
          <Btn small variant="ghost" onClick={onClose}>{t("common.cancel")}</Btn>
          <Btn small variant="ghost" onClick={proceed}>{domain ? t("news.continueTo", { domain }) : t("news.continue")}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function News({ onClose }) {
  const { t } = useLanguage();
  const FEED_CATEGORY_META = feedCategoryMeta(t);
  const [updates, setUpdates] = useState([]);
  const [worldFeed, setWorldFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllFeed, setShowAllFeed] = useState(false);
  const [pendingLink, setPendingLink] = useState(null); // { url } — see ExternalLinkDialog

  useEffect(() => {
    Promise.all([
      apiRequest("/api/v1/brand/news").then((list) => setUpdates(list.filter((u) => !u.resolved))).catch(() => []),
      apiRequest("/api/v1/brand/world-feed").then(setWorldFeed).catch(() => []),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans"
    >
      <header
        className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <Logo size={22} />
        {onClose && (
          <button onClick={onClose} aria-label={t("common.close")} className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
        )}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <IconTile icon={Megaphone} size="sm" />
          <h1 className="m-0 text-xl font-bold text-foreground">{t("news.title")}</h1>
        </div>

        {!loading && updates.length === 0 && worldFeed.length === 0 && (
          <p className="m-0 text-[12.5px] text-muted-foreground">{t("news.nothingNew")}</p>
        )}

        {updates.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
            <SectionHeader>
              <span className="flex items-center gap-1.5"><Megaphone className="size-3.5" /> {t("news.whatsNew")}</span>
            </SectionHeader>
            <div className="grid gap-2">
              {updates.slice(0, 3).map((u) => (
                <div key={u.id} className="glass-surface rounded-xl p-3">
                  <p className="m-0 text-[13px] font-bold text-foreground">{u.title}</p>
                  {u.body && <p className="m-0 mt-1 text-[12px] leading-relaxed text-muted-foreground">{u.body}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] text-muted-foreground/60">{timeAgo(u.created_at, t)}</span>
                    {u.link && (
                      <button
                        type="button" onClick={() => setPendingLink({ url: u.link })}
                        className="border-none bg-transparent p-0 text-[10.5px] font-semibold text-primary [-webkit-tap-highlight-color:transparent]"
                      >
                        {t("news.learnMore")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {worldFeed.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-6">
            <SectionHeader onViewAll={() => setShowAllFeed((v) => !v)} viewAllLabel={showAllFeed ? t("news.showLess") : t("common.viewAll")}>
              {t("news.worthALook")}
            </SectionHeader>
            {/* Horizontal, not another vertical list — this is idle-moment
                browsing, not a task queue. Items aren't lost when they
                scroll out of the default top-8 — the feed keeps everything
                fetched (up to 40 here) reachable via "View all" instead of
                only ever showing the newest 8. "View all" itself switches
                to a vertical grid, not just a longer version of the same
                horizontal strip. */}
            <div className={showAllFeed
              ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3"
              : "-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
            }>
              {worldFeed.slice(0, showAllFeed ? 40 : 8).map((item) => {
                const meta = FEED_CATEGORY_META[item.category] || FEED_CATEGORY_META.world;
                return (
                  <button
                    key={item.id} type="button" onClick={() => setPendingLink({ url: item.url })}
                    className={`glass-surface flex flex-col gap-2 overflow-hidden rounded-xl border-none p-2 text-left [-webkit-tap-highlight-color:transparent] ${showAllFeed ? "" : "w-56 shrink-0"}`}
                  >
                    <CategoryArt meta={meta} />
                    <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1">
                      <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-muted-foreground/70 uppercase">
                        <meta.Icon className="size-3" /> {meta.label}
                      </span>
                      <p className="m-0 text-[12.5px] leading-snug font-bold text-foreground">{item.title}</p>
                      <span className="mt-auto pt-1 text-[10px] text-muted-foreground/50">{timeAgo(item.published_at || item.fetched_at, t)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      <ExternalLinkDialog link={pendingLink} onClose={() => setPendingLink(null)} />
    </motion.div>
  );
}
