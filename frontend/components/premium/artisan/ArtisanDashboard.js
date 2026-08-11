"use client";
/**
 * ArtisanDashboard.js — an artisan's home base once signed in: toggle
 * availability, see the open request pool matching their trade/city,
 * accept one, and mark accepted jobs complete. Gated by ArtisanAuth until
 * a token exists (see lib/artisanAuthToken.js).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Clock, X, Wrench, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { IconTile } from "../shared/IconTile";
import { Btn } from "../guest/components/primitives";
import { getArtisanToken, setArtisanToken } from "@/lib/artisanAuthToken";
import ArtisanAuth from "./ArtisanAuth";
import { artisanMe, artisanSetAvailability, artisanPool, artisanAccepted, artisanAcceptRequest, artisanCompleteRequest } from "./api";

function RequestCard({ j, action }) {
  return (
    <Card className="gap-0 overflow-hidden p-3.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="text-[13.5px] font-bold text-foreground">{j.trade}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground/70">
          {new Date(j.created_at).toLocaleDateString()}
        </span>
      </div>
      {j.city && (
        <div className="mb-1 flex items-center gap-1">
          <MapPin className="size-[11px] text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">{j.city}</span>
        </div>
      )}
      <p className="m-0 mb-2 text-[12.5px] leading-relaxed text-foreground">{j.description}</p>
      {j.status === "accepted" && (
        <p className="m-0 mb-2 text-[12px] text-muted-foreground">
          Contact: {j.contact_name} · {j.contact_phone}{j.contact_email ? ` · ${j.contact_email}` : ""}
        </p>
      )}
      {action}
    </Card>
  );
}

export default function ArtisanDashboard({ onClose }) {
  const [signedIn, setSignedIn] = useState(null); // null = checking
  const [artisan, setArtisan] = useState(null);
  const [pool, setPool] = useState(null);
  const [accepted, setAccepted] = useState(null);
  const [togglingAvail, setTogglingAvail] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = async () => {
    try {
      const [me, poolData, acceptedData] = await Promise.all([artisanMe(), artisanPool(), artisanAccepted()]);
      setArtisan(me);
      setPool(poolData);
      setAccepted(acceptedData);
      setSignedIn(true);
    } catch {
      setArtisanToken(null);
      setSignedIn(false);
    }
  };

  useEffect(() => {
    if (getArtisanToken()) loadAll();
    else setSignedIn(false);
  }, []);

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
      if (checked) await refresh();
      else setPool([]);
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
      await refresh(); // someone else likely took it — sync the pool
    } finally {
      setActingId(null);
    }
  };

  const complete = async (id) => {
    setActingId(id);
    try {
      await artisanCompleteRequest(id);
      toast.success("Marked complete");
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

  const header = (
    <div
      className="flex shrink-0 items-center justify-between px-5 pb-3.5"
      style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
    >
      <div className="flex items-center gap-3">
        <IconTile icon={Wrench} size="sm" />
        <p className="m-0 font-serif text-[17px] italic text-foreground">Artisan dashboard</p>
      </div>
      {onClose && (
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="size-5" />
        </Button>
      )}
    </div>
  );

  if (signedIn === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2.5 bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!signedIn) {
    return <ArtisanAuth onClose={onClose} onSuccess={loadAll} />;
  }

  const inProgress = (accepted || []).filter((j) => j.status === "accepted");
  const history = (accepted || []).filter((j) => j.status === "completed");

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-background text-foreground"
    >
      {header}
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <Card className="flex flex-row items-center justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <p className="m-0 truncate text-[13.5px] font-bold text-foreground">{artisan?.name}</p>
            <p className="m-0 text-[12px] text-muted-foreground">{artisan?.trade} · {artisan?.city || "No city set"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[12px] font-semibold text-muted-foreground">
              {artisan?.is_available ? "Available" : "Off"}
            </span>
            <Switch checked={!!artisan?.is_available} disabled={togglingAvail} onCheckedChange={toggleAvailability} />
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
            OPEN REQUESTS ({pool?.length ?? 0})
          </span>
          <button type="button" onClick={refresh} className="flex items-center gap-1 border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="grid gap-2.5">
          {!artisan?.is_available && (
            <p className="m-0 rounded-lg border border-dashed border-border px-3 py-2.5 text-[12.5px] text-muted-foreground">
              Turn availability on to see and accept job requests.
            </p>
          )}
          {artisan?.is_available && pool?.length === 0 && (
            <p className="m-0 rounded-lg border border-dashed border-border px-3 py-2.5 text-[12.5px] text-muted-foreground">
              No open requests for {artisan.trade} near {artisan.city || "you"} right now.
            </p>
          )}
          {(pool || []).map((j) => (
            <RequestCard key={j.id} j={j} action={
              <Btn small variant="gold" disabled={actingId === j.id} loading={actingId === j.id} onClick={() => accept(j.id)}>
                Accept
              </Btn>
            } />
          ))}
        </div>

        {inProgress.length > 0 && (
          <>
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">IN PROGRESS</span>
            <div className="grid gap-2.5">
              {inProgress.map((j) => (
                <RequestCard key={j.id} j={j} action={
                  <Btn small variant="primary" disabled={actingId === j.id} loading={actingId === j.id} onClick={() => complete(j.id)}>
                    Mark complete
                  </Btn>
                } />
              ))}
            </div>
          </>
        )}

        {history.length > 0 && (
          <>
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">COMPLETED</span>
            <div className="grid gap-2.5 pb-2">
              {history.map((j) => <RequestCard key={j.id} j={j} />)}
            </div>
          </>
        )}

        <button type="button" onClick={signOut} className="justify-self-center border-none bg-transparent p-2 text-[12.5px] font-semibold text-muted-foreground">
          Sign out
        </button>
      </div>
    </div>
  );
}
