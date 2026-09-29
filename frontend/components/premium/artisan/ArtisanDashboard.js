"use client";
/**
 * ArtisanDashboard.js — an artisan's one and only home base once signed in.
 * A bottom nav, same shape as the customer-facing "Hire an artisan" side
 * (see Artisans.js), with three tabs:
 *   - Dashboard: toggle availability, triage incoming requests, track
 *     in-progress/completed jobs, payouts, reputation.
 *   - Messages: every accepted/completed job's conversation in one list.
 *   - Profile: the one place to list, edit, and delete — photo, fields,
 *     portfolio, notifications, password, sign out, delete listing. This
 *     used to be split across a separate ArtisanListingManager.js screen
 *     and duplicated again in the app's generic Settings.js; both are gone
 *     now in favor of one tab that does all of it.
 * Gated by ArtisanAuth until a token exists (see lib/artisanAuthToken.js).
 * No props — this mounts as the entire body of Artisans.js's "I'm an
 * artisan" persona (see that file), which supplies the shared header and
 * persona switch above it; everything artisan-specific stays self-
 * contained in this file and its own imports, not scattered elsewhere.
 *
 * Two card treatments on purpose: the "Requests for you" pool is a triage
 * list — one-tap Accept/Decline right on the card, no dialog in the way.
 * In-progress/completed jobs open JobDetailDialog for anything beyond the
 * summary (contact info, scheduling, messages/payment).
 *
 * The availability status card is pinned above the scrolling job list
 * (not inside it) — same fix as ArtisanProfile.js/JobDetailDialog.js's
 * sticky contact sheets: the one fact that decides whether customers can
 * even reach this artisan shouldn't scroll out of view once there are
 * enough job cards to fill the screen.
 */
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, MapPin, Clock, ChevronLeft, Wrench, RefreshCw, ClipboardList, Hammer,
  CheckCircle2, Inbox, Star, MessageCircle, Banknote, Trash2, Camera,
  Home, User, Phone, Check, Bell, LogOut, ShieldCheck, ShieldAlert, FileUp, Copy,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Btn, Field } from "../guest/components/primitives";
import { truncateBio, tintFor, initialsOf, avatarPhotoUrl } from "../shared/artisanDisplay";
import { artisanSlug } from "@/lib/slugify";
import Emoji3D from "../shared/Emoji3D";
import StarRating from "../shared/StarRating";
import DeleteListingDialog from "../shared/DeleteListingDialog";
import ChangePasswordForm from "../shared/ChangePasswordForm";
import { EmojiPicker } from "../shared/EmojiPicker";
import { BottomNav } from "../shared/BottomNav";
import { TRADES } from "../shared/trades";
import { getArtisanToken, setArtisanToken } from "@/lib/artisanAuthToken";
import { useAuth } from "@/lib/useAuth";
import ArtisanAuth from "./ArtisanAuth";
import ArtisanQuickSetup from "./ArtisanQuickSetup";
import ArtisanProfile from "../ArtisanProfile";
import JobDetailDialog from "./JobDetailDialog";
import MessageThreadDialog from "./MessageThreadDialog";
import PortfolioGrid from "./PortfolioGrid";
import { usePortfolioPhotos } from "./usePortfolioPhotos";
import {
  artisanMe, artisanSetAvailability, artisanPool, artisanAccepted,
  artisanAcceptRequest, artisanDeclineRequest, artisanCompleteRequest,
  artisanProposeTime, artisanConfirmTime,
  artisanGetThread, artisanPostMessage, artisanMarkThreadRead, artisanUnreadCount,
  artisanUnreadThreads, artisanReviews, artisanConnectOnboard, artisanConnectStatus,
  artisanDeleteMe, artisanUpdateProfile, artisanUploadAvatarPhoto, artisanDeleteAvatarPhoto,
  artisanSubmitVerification,
  artisanChangePassword, artisanLoginViaCustomer,
} from "./api";

const BIO_MAX = 600;
const EDITABLE_FIELDS = ["name", "trade", "city", "phone", "email", "years_experience", "bio", "avatar_emoji"];

function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_META = {
  accepted: { label: "Accepted", className: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]" },
  completed: { label: "Completed", className: "border-border bg-muted text-muted-foreground" },
};

function SectionLabel({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
      <Icon className="size-3" /> {children}
    </span>
  );
}

function EmptyRow({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground/60" />
      <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

// forwardRef matters here, not cosmetically: this is a direct child of
// AnimatePresence in popLayout mode below, which clones in a ref (via its
// internal PopChild) to measure the element for exit animations. A plain
// function component can't receive that ref — same gotcha documented on
// Btn in guest/components/primitives.js.
const PoolCard = forwardRef(function PoolCard({ j, busy, onAccept, onDecline }, ref) {
  return (
    <motion.div ref={ref} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      <Card className="gap-0 overflow-hidden border-l-[3px] border-l-primary p-3.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-bold text-foreground">{j.trade}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground/70">{new Date(j.created_at).toLocaleDateString()}</span>
        </div>
        {j.city && (
          <div className="mb-1 flex items-center gap-1">
            <MapPin className="size-[11px] text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">{j.city}</span>
          </div>
        )}
        <p className="m-0 mb-2.5 text-[12.5px] leading-relaxed text-foreground">{j.description}</p>
        <div className="flex gap-2">
          {/* "primary" (a neutral filled button, not gold) rather than
              plain ghost — Accept and Decline are opposite actions, so
              they still need to read apart from each other at a glance;
              it just shouldn't be gold repeated on every card in a list
              that can be many cards long (see Assets tab's own fix for
              why solid gold-per-row is the thing to avoid, not fill vs.
              outline itself). */}
          <Btn small variant="primary" disabled={busy} loading={busy} onClick={onAccept}>Accept</Btn>
          <Btn small variant="ghost" disabled={busy} onClick={onDecline}>Decline</Btn>
        </div>
      </Card>
    </motion.div>
  );
});

function CompactJobCard({ j, onOpen }) {
  const meta = STATUS_META[j.status];
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }}>
      <Card
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        className="cursor-pointer gap-0 overflow-hidden p-3.5"
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-bold text-foreground">{j.trade}</span>
          {meta && (
            <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] font-bold ${meta.className}`}>
              {meta.label}
            </Badge>
          )}
        </div>
        {j.city && (
          <div className="mb-1 flex items-center gap-1">
            <MapPin className="size-[11px] text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">{j.city}</span>
          </div>
        )}
        <p className="m-0 mb-1.5 text-[12.5px] leading-relaxed text-foreground">{truncateBio(j.description)}</p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
          <Clock className="size-[11px]" />
          {new Date(j.created_at).toLocaleDateString()}
        </div>
      </Card>
    </motion.div>
  );
}

export default function ArtisanDashboard({ onArtisanChange }) {
  const { user: customerUser } = useAuth();
  const [signedIn, setSignedIn] = useState(null); // null = checking
  // Set when the sign-in gate below finds a verified customer session but
  // no linked artisan account yet — shows the one-tap ArtisanQuickSetup
  // instead of the full ArtisanAuth form (see that gate's own comment).
  // "Use a different artisan account" forces the full form anyway.
  const [needsQuickSetup, setNeedsQuickSetup] = useState(false);
  const [artisan, setArtisan] = useState(null);
  const [form, setForm] = useState(null); // Profile tab's editable draft, synced from `artisan` on load/save
  const [pool, setPool] = useState(null);
  const [accepted, setAccepted] = useState(null);
  const [togglingAvail, setTogglingAvail] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState(null); // job id whose detail dialog is open, or null
  const [threadOpenId, setThreadOpenId] = useState(null); // job id whose MessageThreadDialog is open, or null — the Messages tab's own, separate from openId
  const [unread, setUnread] = useState(0);
  // Bottom-nav tab: "dashboard" (everything this screen always showed),
  // "messages" (every accepted/completed job's conversation, one place
  // instead of only reachable by opening each job's own detail dialog),
  // and "profile" (list/edit/delete/account, all of it — see file header).
  const [tab, setTab] = useState("dashboard");
  const [unreadThreads, setUnreadThreads] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [payoutStatus, setPayoutStatus] = useState(null); // { payouts_enabled, onboarding_started } | null while loading
  const [connectingPayouts, setConnectingPayouts] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Profile tab editing state — merged in from the old ArtisanListingManager.js.
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInputRef = useRef(null);
  const cityFieldRef = useRef(null);
  const yearsFieldRef = useRef(null);
  // Verification — see backend/app/api/artisans.py's /me/verification.
  // Both files are picked before anything's sent (submitVerification
  // below requires both together), so this is local draft state, not
  // uploaded on selection the way the single avatar photo is.
  const [idDocFile, setIdDocFile] = useState(null);
  const [insuranceDocFile, setInsuranceDocFile] = useState(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const idDocInputRef = useRef(null);
  const insuranceDocInputRef = useRef(null);
  const bioFieldRef = useRef(null);
  const photosSectionRef = useRef(null);

  const { photos, uploading: photoUploading, upload: uploadPhoto, remove: removePhoto, move: movePhoto } =
    usePortfolioPhotos(artisan?.id, null);

  const loadAll = async () => {
    try {
      const [me, poolData, acceptedData] = await Promise.all([artisanMe(), artisanPool(), artisanAccepted()]);
      setArtisan(me);
      setForm(me);
      setPool(poolData);
      setAccepted(acceptedData);
      setSignedIn(true);
    } catch {
      setArtisanToken(null);
      setSignedIn(false);
    }
  };

  useEffect(() => {
    if (getArtisanToken()) { loadAll(); return; }
    // No artisan session yet — if there's already a signed-in, verified
    // customer whose email matches an existing artisan account (see
    // artisanLoginViaCustomer's own backend comment), sign straight into
    // it instead of showing a sign-in screen for an account they already
    // have. Any failure here — not signed in as a customer, unverified
    // email, no matching account — is just "nothing to auto-sign into,"
    // so it falls through to the normal ArtisanAuth screen silently.
    artisanLoginViaCustomer()
      .then((data) => { setArtisanToken(data.token); loadAll(); })
      .catch((e) => {
        // 404 specifically means "verified customer session, just no
        // linked artisan account yet" — everything else (401/403: no
        // customer session at all, or an unverified email) has nothing
        // to offer a one-tap setup for, so it's the plain sign-in screen.
        if (e.status === 404) setNeedsQuickSetup(true);
        setSignedIn(false);
      });
  }, []);

  // Reports the signed-in artisan (or null, once signed out/deleted) up to
  // whoever's hosting this screen — Artisans.js uses it to show a real
  // avatar in the shared header instead of a generic icon, same as every
  // other avatar in the app (photo → emoji → initials). Read-only mirror
  // of `artisan`, not a second fetch — this dashboard stays the one source
  // of truth for it.
  useEffect(() => {
    onArtisanChange?.(artisan);
  }, [artisan, onArtisanChange]);

  // The artisan's own public reputation — the same rating/reviews a
  // customer sees on ArtisanProfile.js, surfaced here too so they don't
  // have to go find their own public listing to see it. Fetch-once is
  // fine (a new review only ever follows a job the artisan just marked
  // complete, not something that changes mid-session on its own).
  useEffect(() => {
    if (!artisan?.id) return;
    artisanReviews(artisan.id).then(setReviews).catch(() => setReviews([]));
  }, [artisan?.id]);

  // Payout readiness (see backend/app/api/payments.py) — fetch-once on
  // sign-in is enough for the same reason reviews are: nothing changes
  // this mid-session except the artisan themselves leaving for Stripe's
  // onboarding flow and coming back, which remounts this screen anyway.
  useEffect(() => {
    if (!signedIn) return;
    artisanConnectStatus().then(setPayoutStatus).catch(() => setPayoutStatus({ payouts_enabled: false, onboarding_started: false }));
  }, [signedIn]);

  const startPayoutOnboarding = async () => {
    setConnectingPayouts(true);
    try {
      const { url } = await artisanConnectOnboard();
      window.location.href = url;
    } catch (e) {
      toast.error(e.message);
      setConnectingPayouts(false);
    }
  };

  // Unread badge on the Messages tab — a slower, separate poll from the
  // message thread's own 4s cadence (see MessageThread.js): this only
  // needs to feel current, not live, while no specific thread is open.
  // Threads (the per-job breakdown, for the Messages tab's list) piggyback
  // on the same poll rather than running a second interval for what's
  // really one fetch of related data.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const poll = () => Promise.all([artisanUnreadCount(), artisanUnreadThreads()])
      .then(([count, threads]) => { if (!cancelled) { setUnread(count.count); setUnreadThreads(threads); } })
      .catch(() => {});
    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [signedIn]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const [poolData, acceptedData] = await Promise.all([artisanPool(), artisanAccepted()]);
      setPool(poolData);
      setAccepted(acceptedData);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleAvailability = async (checked) => {
    setTogglingAvail(true);
    try {
      const updated = await artisanSetAvailability(checked);
      setArtisan(updated);
      // Availability no longer gates visibility into requests already sent
      // (see backend's pool()) — only whether NEW ones can be created — so
      // toggling off does NOT clear the pool here anymore, just refreshes.
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTogglingAvail(false);
    }
  };

  const accept = async (id) => {
    setActingId(id);
    try {
      await artisanAcceptRequest(id);
      toast.success("Job accepted");
      await refresh();
    } catch (e) {
      toast.error(e.message);
      await refresh();
    } finally {
      setActingId(null);
    }
  };

  const decline = async (id) => {
    setActingId(id);
    try {
      await artisanDeclineRequest(id);
      toast.success("Request declined");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const proposeTime = async (scheduledAt) => {
    setActingId(openId);
    try {
      await artisanProposeTime(openId, scheduledAt);
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const confirmTime = async () => {
    setActingId(openId);
    try {
      await artisanConfirmTime(openId);
      toast.success("Time confirmed");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const complete = async () => {
    setActingId(openId);
    try {
      const updated = await artisanCompleteRequest(openId);
      if (updated.warning) toast.warning(updated.warning);
      else toast.success("Marked complete");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const signOut = () => {
    setArtisanToken(null);
    setSignedIn(false);
    setArtisan(null);
  };

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteListing = async () => {
    setDeleting(true);
    try {
      await artisanDeleteMe();
      setArtisanToken(null);
      setSignedIn(false);
      setArtisan(null);
      toast.success("Your listing has been taken down.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Profile tab: list/edit/delete, all of it ─────────────────────────
  const isDirty = useMemo(() => {
    if (!artisan || !form) return false;
    return EDITABLE_FIELDS.some((k) => (form[k] ?? "") !== (artisan[k] ?? ""));
  }, [artisan, form]);

  // What's actually missing, computed from real saved fields — no
  // separate "completion" model to drift out of sync with the profile
  // itself. Each item focuses the field it's about when tapped.
  const checklist = useMemo(() => {
    if (!artisan) return [];
    return [
      { done: artisan.has_avatar_photo || !!artisan.avatar_emoji, label: "Add a profile photo", onGo: () => avatarFileInputRef.current?.click() },
      { done: !!artisan.city, label: "Add your city", onGo: () => { cityFieldRef.current?.scrollIntoView({ block: "center" }); cityFieldRef.current?.focus(); } },
      { done: artisan.years_experience != null, label: "Add years of experience", onGo: () => { yearsFieldRef.current?.scrollIntoView({ block: "center" }); yearsFieldRef.current?.focus(); } },
      { done: !!artisan.bio, label: "Write a short bio", onGo: () => { bioFieldRef.current?.scrollIntoView({ block: "center" }); bioFieldRef.current?.focus(); } },
      { done: (photos?.length || 0) > 0, label: "Upload a photo of your work", onGo: () => photosSectionRef.current?.scrollIntoView({ block: "start" }) },
    ];
  }, [artisan, photos]);
  const doneCount = checklist.filter((c) => c.done).length;
  const profileComplete = checklist.length > 0 && doneCount === checklist.length;

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await artisanUpdateProfile({
        name: form.name, trade: form.trade, city: form.city,
        phone: form.phone, email: form.email,
        years_experience: form.years_experience, bio: form.bio,
        avatar_emoji: form.avatar_emoji,
      });
      setArtisan(updated);
      setForm(updated);
      toast.success("Saved");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be 5MB or smaller."); return; }
    setAvatarUploading(true);
    try {
      const updated = await artisanUploadAvatarPhoto(file);
      setArtisan(updated);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarUploading(true);
    try {
      const updated = await artisanDeleteAvatarPhoto();
      setArtisan(updated);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const submitVerification = async () => {
    if (!idDocFile || !insuranceDocFile) { toast.error("Choose both a government ID and proof of insurance."); return; }
    setSubmittingVerification(true);
    try {
      const updated = await artisanSubmitVerification(idDocFile, insuranceDocFile);
      setArtisan(updated);
      setIdDocFile(null);
      setInsuranceDocFile(null);
      toast.success("Submitted — we'll review it and let you know.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmittingVerification(false);
    }
  };

  // Instant, not bundled into a "Save" button — a preference toggle should
  // behave like the availability Switch above (takes effect immediately),
  // not sit half-changed until someone remembers to save.
  const toggleNotify = async (field, checked) => {
    const previous = artisan[field];
    setArtisan((a) => ({ ...a, [field]: checked }));
    try {
      await artisanUpdateProfile({ [field]: checked });
    } catch (e) {
      setArtisan((a) => ({ ...a, [field]: previous }));
      toast.error(e.message);
    }
  };

  if (signedIn === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2.5 bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!signedIn) {
    if (needsQuickSetup) {
      return (
        <ArtisanQuickSetup
          customerName={customerUser?.name}
          onSuccess={loadAll}
          onUseDifferentAccount={() => setNeedsQuickSetup(false)}
        />
      );
    }
    return <ArtisanAuth onSuccess={loadAll} />;
  }

  // Real preview, not a mockup — the exact screen a customer opens,
  // rendered with isMine=false so it shows what they'd actually see
  // (Message/Request footer, no edit controls) instead of a read-only
  // clone that could drift from the real thing.
  if (previewing) {
    return (
      <div className="relative h-full">
        <ArtisanProfile artisan={artisan} isMine={false} onBack={() => setPreviewing(false)} />
        <div className="pointer-events-none absolute top-0 right-0 left-0 flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]">
          <span className="rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background shadow-lg">
            Previewing as a customer
          </span>
        </div>
      </div>
    );
  }

  const inProgress = (accepted || []).filter((j) => j.status === "accepted");
  const history = (accepted || []).filter((j) => j.status === "completed");
  const openJob = [...inProgress, ...history].find((j) => j.id === openId) || null;
  const threadJob = [...inProgress, ...history].find((j) => j.id === threadOpenId) || null;
  const tint = tintFor(artisan?.name || "?");

  // Every accepted/completed job IS a conversation (messaging only opens
  // once a job's accepted — see backend's post_message) — no separate
  // "conversations" list to fetch, just the same jobs already loaded
  // above, joined against the unread-threads poll for a badge/preview.
  const conversations = [...inProgress, ...history];
  const unreadByJob = Object.fromEntries(unreadThreads.map((t) => [t.job_request_id, t]));

  const NAV_ITEMS = [
    { id: "dashboard", Icon: Home, label: "Dashboard" },
    { id: "messages", Icon: MessageCircle, label: "Messages", badge: unread },
    { id: "profile", Icon: User, label: "Profile" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {tab === "dashboard" && <>
      {/* Availability is the single most important fact on this screen —
          it decides whether any customer can reach this artisan at all —
          so it gets real visual weight: a glowing ring around the avatar
          when live (an actual pulsing sonar-style ring, not just a border
          tint), an ambient glow breathing behind the whole card, and the
          avatar itself desaturated when off. Pinned outside the scrolling
          list below (see the file-level comment) so it never scrolls out
          of view. */}
      <div className="shrink-0 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3.5">
        <Card
          className="relative flex flex-row items-center justify-between gap-3 overflow-hidden p-3.5 transition-colors"
          style={artisan?.is_available ? {
            borderColor: "color-mix(in oklch, var(--success) 35%, var(--border))",
            background: "color-mix(in oklch, var(--success) 6%, var(--card))",
          } : undefined}
        >
          {/* Ambient glow, not just a border tint — purely decorative
              (aria-hidden, no pointer events), absent entirely when off
              so a quiet status doesn't compete for attention. */}
          {artisan?.is_available && (
            <motion.div
              aria-hidden="true"
              animate={{ opacity: [0.5, 0.85, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute -top-10 -left-6 size-32 rounded-full blur-3xl"
              style={{ background: "var(--success)" }}
            />
          )}

          <div className="relative flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              {/* The sonar-style pulse this card's own comment always
                  promised but never actually built — a ring expanding
                  outward and fading, the classic "this is live right now"
                  micro-interaction. */}
              {artisan?.is_available && (
                <motion.div
                  aria-hidden="true"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 1.7, opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full"
                  style={{ background: "var(--success)" }}
                />
              )}
              <div
                className={`relative flex size-11 items-center justify-center overflow-hidden rounded-full border transition-all duration-500 ${artisan?.has_avatar_photo || artisan?.avatar_emoji ? "" : "font-mono text-sm font-bold"} ${tint} ${!artisan?.is_available ? "opacity-50 grayscale" : ""}`}
                style={artisan?.is_available ? {
                  boxShadow: "0 0 0 3px color-mix(in oklch, var(--success) 25%, transparent), 0 0 18px color-mix(in oklch, var(--success) 40%, transparent)",
                } : undefined}
              >
                {artisan?.has_avatar_photo ? (
                  <img src={avatarPhotoUrl(artisan.id, artisan.avatar_photo_version)} alt="" className="size-full object-cover" />
                ) : artisan?.avatar_emoji ? (
                  <Emoji3D emoji={artisan.avatar_emoji} size={44} />
                ) : (
                  initialsOf(artisan?.name || "?")
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate text-[13.5px] font-bold text-foreground">{artisan?.name}</p>
              <p className="m-0 text-[12px] text-muted-foreground">{artisan?.trade} · {artisan?.city || "No city set"}</p>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2.5">
            <span className={`flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-[0.1em] ${artisan?.is_available ? "text-[var(--success)]" : "text-muted-foreground/60"}`}>
              {artisan?.is_available && (
                <motion.span
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="size-[7px] shrink-0 rounded-full bg-[var(--success)]"
                />
              )}
              {artisan?.is_available ? "LIVE" : "OFF"}
            </span>
            <Switch checked={!!artisan?.is_available} disabled={togglingAvail} onCheckedChange={toggleAvailability} />
          </div>
        </Card>

        {/* Where escrow actually lands — a job's payment can't be
            released to this artisan (see JobDetailDialog.js's "Release
            payment" action) until Stripe confirms this account can
            receive a Transfer. Visible here even once ready, not hidden
            after setup, so it's always clear payouts are live. */}
        {payoutStatus && !payoutStatus.payouts_enabled ? (
          <Card className="mt-2.5 flex flex-row items-center justify-between gap-3 p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                <Banknote className="size-[18px] text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="m-0 text-[13.5px] font-bold text-foreground">
                  {payoutStatus.onboarding_started ? "Finish payout setup" : "Set up payouts"}
                </p>
                <p className="m-0 text-[12px] text-muted-foreground">
                  Required before you can be paid for a completed job.
                </p>
              </div>
            </div>
            <Btn small variant="gold" disabled={connectingPayouts} loading={connectingPayouts} onClick={startPayoutOnboarding}>
              {payoutStatus.onboarding_started ? "Finish" : "Set up"}
            </Btn>
          </Card>
        ) : payoutStatus?.payouts_enabled ? (
          <Card className="mt-2.5 flex flex-row items-center gap-3 p-3.5" style={{
            borderColor: "color-mix(in oklch, var(--success) 35%, var(--border))",
            background: "color-mix(in oklch, var(--success) 6%, var(--card))",
          }}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/15">
              <CheckCircle2 className="size-[16px] text-[var(--success)]" />
            </div>
            <p className="m-0 text-[13px] font-bold text-foreground">Payouts ready — escrowed jobs can be released to you.</p>
          </Card>
        ) : null}
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5"
        style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between">
          <SectionLabel icon={ClipboardList}>REQUESTS FOR YOU ({pool?.length ?? 0})</SectionLabel>
          <button type="button" onClick={refresh} className="flex items-center gap-1 border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="grid gap-2.5">
          {!artisan?.is_available && (
            <EmptyRow icon={Wrench}>
              You're off — customers can't send you new requests right now, but anything already sent still shows here.
            </EmptyRow>
          )}
          {pool?.length === 0 && (
            <EmptyRow icon={Inbox}>Nothing waiting on you right now.</EmptyRow>
          )}
          <AnimatePresence mode="popLayout">
            {(pool || []).map((j) => (
              <PoolCard key={j.id} j={j} busy={actingId === j.id}
                onAccept={() => accept(j.id)} onDecline={() => decline(j.id)} />
            ))}
          </AnimatePresence>
        </div>

        {inProgress.length > 0 && (
          <>
            <SectionLabel icon={Hammer}>IN PROGRESS</SectionLabel>
            <div className="grid gap-2.5">
              {inProgress.map((j) => <CompactJobCard key={j.id} j={j} onOpen={() => setOpenId(j.id)} />)}
            </div>
          </>
        )}

        {history.length > 0 && (
          <>
            <SectionLabel icon={CheckCircle2}>COMPLETED</SectionLabel>
            <div className="grid gap-2.5 pb-2">
              {history.map((j) => <CompactJobCard key={j.id} j={j} onOpen={() => setOpenId(j.id)} />)}
            </div>
          </>
        )}

        {/* The same rating/reviews a customer sees on ArtisanProfile.js —
            surfaced here too so the artisan doesn't have to go find their
            own public listing to see how recent jobs went. */}
        <SectionLabel icon={Star}>YOUR REPUTATION</SectionLabel>
        <Card className="grid gap-3 p-3.5">
          <div className="flex items-center gap-2.5">
            {artisan?.rating_count > 0 ? (
              <>
                <span className="text-xl font-bold text-foreground">{artisan.rating_avg.toFixed(1)}</span>
                <StarRating readOnly value={artisan.rating_avg} size="size-3.5" />
                <span className="text-[12px] text-muted-foreground">
                  ({artisan.rating_count} rating{artisan.rating_count === 1 ? "" : "s"})
                </span>
              </>
            ) : (
              <span className="text-[12.5px] text-muted-foreground">No ratings yet</span>
            )}
          </div>
          {reviews?.length > 0 && (
            <div className="grid gap-2.5 border-t border-border pt-3">
              {reviews.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <StarRating readOnly value={r.stars} size="size-3" />
                      {r.verified && (
                        <Badge variant="outline" className="rounded-full border-[var(--success)]/30 bg-[var(--success)]/10 text-[9px] font-bold text-[var(--success)]">
                          Verified job
                        </Badge>
                      )}
                    </div>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground/70">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="m-0 mt-1 text-[12px] leading-relaxed text-foreground">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
          {reviews !== null && reviews.length === 0 && (
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <MessageCircle className="size-3.5 shrink-0 text-muted-foreground/60" />
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">No reviews yet — they'll show up here once a completed job gets rated.</p>
            </div>
          )}
        </Card>
      </div>
      </>}

      {/* Messages tab — every accepted/completed job's conversation in one
          list instead of only reachable by opening that specific job's own
          detail dialog. Tapping a row opens MessageThreadDialog (its own
          state, threadOpenId — separate from the Dashboard tab's openId/
          JobDetailDialog below): a dedicated chat screen, not the same
          scheduling/escrow dialog the Dashboard tab's cards open. See
          JobDetailDialog.js's own header comment for why they're split. */}
      {tab === "messages" && (
        <div
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))]"
          style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
        >
          <SectionLabel icon={MessageCircle}>MESSAGES</SectionLabel>
          {conversations.length === 0 && (
            <EmptyRow icon={Inbox}>Conversations open once you've accepted a job — nothing yet.</EmptyRow>
          )}
          {conversations.map((j) => {
            const thread = unreadByJob[j.id];
            return (
              <Card
                key={j.id}
                role="button"
                tabIndex={0}
                onClick={() => setThreadOpenId(j.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setThreadOpenId(j.id); } }}
                className="cursor-pointer flex-row items-center gap-3 p-3.5"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${tintFor(j.contact_name || "?")}`}>
                  {initialsOf(j.contact_name || "?")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13.5px] font-bold text-foreground">{j.contact_name || "Customer"}</span>
                    {thread?.unread_count > 0 && (
                      <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-bold text-primary-foreground">
                        {thread.unread_count > 9 ? "9+" : thread.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="m-0 truncate text-[12px] text-muted-foreground">
                    {thread?.preview || `${j.trade} — tap to view conversation`}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Profile tab — the one place to list, edit, and delete. Photo,
          name/trade/city/years/phone/email/bio, portfolio, and a preview
          of exactly what a customer sees (see the previewing early-return
          above) — merged in from the old ArtisanListingManager.js —
          followed by account-level controls that used to live in a
          duplicate copy on Settings.js's artisan card: notifications,
          password, sign out, delete listing. */}
      {tab === "profile" && form && (
        <div
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))]"
          style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
        >
          <SectionLabel icon={User}>PROFILE</SectionLabel>

          {!profileComplete && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-foreground">Profile {Math.round((doneCount / checklist.length) * 100)}% complete</span>
                <span className="text-[11.5px] text-muted-foreground">{doneCount}/{checklist.length}</span>
              </div>
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
              </div>
              <div className="grid gap-1">
                {checklist.filter((c) => !c.done).map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={c.onGo}
                    className="flex items-center justify-between gap-2 border-none bg-transparent px-0 py-1 text-left text-[13px] text-foreground"
                  >
                    {c.label}
                    <ChevronLeft className="size-3.5 rotate-180 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label={artisan.has_avatar_photo ? "Change profile photo" : "Add a profile photo"}
              className={`relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border ${artisan.has_avatar_photo || form.avatar_emoji ? "" : "font-mono text-xl font-bold"} ${tintFor(artisan.name)}`}
            >
              {avatarUploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : artisan.has_avatar_photo ? (
                <img src={avatarPhotoUrl(artisan.id, artisan.avatar_photo_version)} alt="" className="size-full object-cover" />
              ) : form.avatar_emoji ? (
                <Emoji3D emoji={form.avatar_emoji} size={80} />
              ) : (
                initialsOf(artisan.name)
              )}
              <span className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border border-background bg-foreground text-background">
                <Camera className="size-3" />
              </span>
            </button>
            <div className="flex items-center gap-3">
              {artisan.has_avatar_photo && (
                <button type="button" onClick={removeAvatar} disabled={avatarUploading} className="border-none bg-transparent p-0 text-[12.5px] text-muted-foreground disabled:opacity-50">
                  Remove photo
                </button>
              )}
              {!artisan.has_avatar_photo && (
                <EmojiPicker value={form.avatar_emoji} onChange={(e) => setForm((f) => ({ ...f, avatar_emoji: e }))} />
              )}
            </div>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>

          <Field label="Name" value={form.name || ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <div className="-mt-2.5">
            <div className="mb-1.5 text-[13.5px] font-bold tracking-wide text-foreground">Trade</div>
            <Select value={form.trade} onValueChange={(v) => setForm((f) => ({ ...f, trade: v }))}>
              <SelectTrigger className="h-[52px] w-full rounded-[10px] text-base">
                <SelectValue placeholder="Select a trade" />
              </SelectTrigger>
              <SelectContent>
                {TRADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13.5px] font-bold tracking-wide text-foreground">City</span>
                <span className="text-xs text-muted-foreground/60">optional</span>
              </div>
              <input
                ref={cityFieldRef}
                value={form.city || ""}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="h-[52px] w-full rounded-[10px] border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <div className="mb-1.5 text-[13.5px] font-bold tracking-wide text-foreground">Years experience</div>
              <input
                ref={yearsFieldRef}
                type="number"
                value={form.years_experience ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value }))}
                className="h-[52px] w-full rounded-[10px] border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <Field label="Phone" type="tel" value={form.phone || ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <Field label="Email" hint="optional" type="email" value={form.email || ""} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13.5px] font-bold tracking-wide text-foreground">Bio</span>
              <span className="text-xs text-muted-foreground/60">{(form.bio || "").length}/{BIO_MAX}</span>
            </div>
            <textarea
              ref={bioFieldRef}
              rows={3}
              maxLength={BIO_MAX}
              value={form.bio || ""}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              className="min-h-[52px] w-full resize-y rounded-[10px] border border-input bg-transparent p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {isDirty && (
            <Btn small variant="gold" disabled={saving} loading={saving} onClick={saveProfile} className="justify-self-start">
              <Check className="size-3.5" /> {saving ? "Saving…" : "Save changes"}
            </Btn>
          )}

          <div ref={photosSectionRef} className="border-t border-border pt-4">
            <PortfolioGrid artisanId={artisan.id} photos={photos} uploading={photoUploading} upload={uploadPhoto} remove={removePhoto} move={movePhoto} />
          </div>

          {/* Get Verified — a real, human-reviewed pipeline (see backend/
              app/api/artisans.py's /me/verification and admin.py's review
              queue), NOT an automated background-check API. An admin
              looks at these two documents and approves or rejects by
              hand; only "verified" unlocks the trust badge customers see
              (ArtisanSeniorHelp.js, ArtisanProfile.js). */}
          <div className="border-t border-border pt-4">
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground">
              <ShieldCheck className="size-3" /> GET VERIFIED
            </span>

            {artisan.verification_status === "verified" && (
              <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3.5">
                <ShieldCheck className="size-5 shrink-0 text-success" />
                <p className="m-0 text-[13px] font-semibold text-foreground">
                  Verified — your ID and insurance were reviewed and approved. Customers see this on your profile.
                </p>
              </div>
            )}

            {artisan.verification_status === "pending" && (
              <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-3.5">
                <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
                <p className="m-0 text-[13px] font-semibold text-foreground">
                  Submitted — our team is reviewing your documents.
                </p>
              </div>
            )}

            {(!artisan.verification_status || artisan.verification_status === "unverified" || artisan.verification_status === "rejected") && (
              <div className="mt-2.5 flex flex-col gap-2.5">
                {artisan.verification_status === "rejected" && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p className="m-0 text-[13px] text-foreground">
                      {artisan.verification_notes || "Your last submission wasn't approved."} Upload new documents to try again.
                    </p>
                  </div>
                )}
                <p className="m-0 text-[12.5px] text-muted-foreground">
                  Upload a government ID and proof of insurance to get a verified badge customers see when you're matched to them.
                </p>
                <button
                  type="button"
                  onClick={() => idDocInputRef.current?.click()}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3.5 py-3 text-left text-[13px] font-semibold text-foreground"
                >
                  {idDocFile ? idDocFile.name : "Government ID"}
                  <FileUp className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
                <input ref={idDocInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setIdDocFile(e.target.files?.[0] || null)} />
                <button
                  type="button"
                  onClick={() => insuranceDocInputRef.current?.click()}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3.5 py-3 text-left text-[13px] font-semibold text-foreground"
                >
                  {insuranceDocFile ? insuranceDocFile.name : "Proof of insurance"}
                  <FileUp className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
                <input ref={insuranceDocInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setInsuranceDocFile(e.target.files?.[0] || null)} />
                <Btn small variant="gold" disabled={submittingVerification || !idDocFile || !insuranceDocFile} loading={submittingVerification} onClick={submitVerification}>
                  Submit for review
                </Btn>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className="w-full border-none bg-transparent p-0 text-center text-[13px] font-medium text-primary"
          >
            Preview as a customer
          </button>

          {/* The real, public, indexable URL for this listing (see
              app/artisan/[slug]/page.js) — the whole point of it existing
              is that an artisan can hand it out themselves (Instagram bio,
              a text to a customer, a QR code at a market stall), so it
              needs to be one tap to grab, not something they have to know
              to construct. */}
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/artisan/${artisanSlug(artisan)}`;
              navigator.clipboard.writeText(url).then(
                () => toast.success("Public profile link copied"),
                () => toast.error("Couldn't copy — try again")
              );
            }}
            className="flex w-full items-center justify-center gap-1.5 border-none bg-transparent p-0 text-center text-[13px] font-medium text-primary"
          >
            <Copy className="size-3.5" />
            Copy your public profile link
          </button>

          <div className="grid gap-2.5 rounded-lg border border-border p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground">
              <Bell className="size-3" /> NOTIFICATIONS
            </span>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-foreground">New job requests</span>
              <Switch checked={artisan.notify_new_request} onCheckedChange={(c) => toggleNotify("notify_new_request", c)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-foreground">New messages</span>
              <Switch checked={artisan.notify_new_message} onCheckedChange={(c) => toggleNotify("notify_new_message", c)} />
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <ChangePasswordForm onSubmit={artisanChangePassword} />
          </div>

          <button type="button" onClick={signOut} className="flex items-center gap-1.5 justify-self-center border-none bg-transparent p-2 text-[12.5px] font-semibold text-muted-foreground">
            <LogOut className="size-3.5" /> Sign out
          </button>

          <DeleteListingDialog
            name={artisan.name}
            open={confirmDeleteOpen}
            onOpenChange={setConfirmDeleteOpen}
            onConfirm={deleteListing}
            trigger={
              <button
                type="button"
                disabled={deleting}
                className="flex items-center gap-1.5 justify-self-center border-none bg-transparent p-2 text-[12.5px] font-bold text-destructive disabled:opacity-50"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {deleting ? "Removing…" : "Delete my listing"}
              </button>
            }
          />
        </div>
      )}

      <JobDetailDialog
        open={!!openJob}
        onClose={() => setOpenId(null)}
        job={openJob}
        viewerIsArtisan
        busy={actingId === openId}
        onProposeTime={proposeTime}
        onConfirmTime={confirmTime}
        onComplete={complete}
      />

      <MessageThreadDialog
        open={!!threadJob}
        onClose={() => setThreadOpenId(null)}
        job={threadJob}
        viewerIsArtisan
        onFetchMessages={artisanGetThread}
        onSendMessage={artisanPostMessage}
        onMarkMessagesRead={artisanMarkThreadRead}
      />

      <BottomNav items={NAV_ITEMS} active={tab} onChange={setTab} />
    </div>
  );
}
