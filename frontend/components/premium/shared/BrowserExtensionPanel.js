"use client";
/**
 * BrowserExtensionPanel.js — generate/revoke personal access tokens for
 * the Chrome extension (see backend/app/api/tokens.py). Lives inside
 * Profile.js's "App" card, same collapsible-row pattern as Appearance/
 * Security Center there. The raw token is shown exactly once, right
 * after creation — the backend only ever stores its hash, so there is no
 * "reveal again" later, same one-shot-secret discipline the rest of this
 * app already follows (e.g. the branding workspace's token).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plug, Plus, Copy, Trash2, Loader2, Check } from "lucide-react";
import { apiRequest } from "./api";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/i18n";

export default function BrowserExtensionPanel() {
  const { t } = useLanguage();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState(null);

  const load = () => {
    setLoading(true);
    apiRequest("/api/v1/tokens").then(setTokens).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    setCreating(true);
    try {
      const data = await apiRequest("/api/v1/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: t("extension.defaultLabel") }),
      });
      setJustCreated(data);
      setTokens((list) => [data, ...list]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const copyToken = async () => {
    if (!justCreated?.token) return;
    try {
      await navigator.clipboard.writeText(justCreated.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may be blocked — the box is still selectable text */ }
  };

  const revoke = async (id) => {
    try {
      await apiRequest(`/api/v1/tokens/${id}`, { method: "DELETE" });
      setTokens((list) => list.map((tk) => (tk.id === id ? { ...tk, revoked: true } : tk)));
      toast.success(t("extension.revoked"));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRevokeId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">{t("extension.description")}</p>

      {justCreated && (
        <div className="rounded-[9px] border border-primary/30 bg-primary/5 p-3">
          <p className="m-0 mb-1.5 text-[11.5px] font-bold text-foreground">{t("extension.copyNowTitle")}</p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate rounded-[6px] border border-border bg-background px-2 py-1.5 text-[11px]">{justCreated.token}</code>
            <button type="button" onClick={copyToken} aria-label={t("extension.copy")}
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground [-webkit-tap-highlight-color:transparent]">
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> {t("common.loading")}</div>
      ) : tokens.length === 0 ? (
        <p className="m-0 text-[12px] text-muted-foreground">{t("extension.noTokensYet")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tokens.map((tk) => (
            <div key={tk.id} className="flex items-center gap-2 rounded-[8px] border border-border p-2.5">
              <Plug className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[12px] font-bold text-foreground">{tk.label || t("extension.defaultLabel")}</p>
                <p className="m-0 text-[10.5px] text-muted-foreground">
                  {tk.revoked ? t("extension.statusRevoked") : tk.last_used_at ? t("extension.statusLastUsed", { date: new Date(tk.last_used_at).toLocaleDateString() }) : t("extension.statusNeverUsed")}
                </p>
              </div>
              {!tk.revoked && (
                <AlertDialog open={revokeId === tk.id} onOpenChange={(open) => setRevokeId(open ? tk.id : null)}>
                  <AlertDialogTrigger asChild>
                    <button type="button" aria-label={t("extension.revoke")} className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive [-webkit-tap-highlight-color:transparent]">
                      <Trash2 className="size-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("extension.revokeQuestion")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("extension.revokeDescription")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => revoke(tk.id)}>{t("extension.revoke")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={create} disabled={creating}
        className="flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-border text-[12px] font-bold text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-60 [-webkit-tap-highlight-color:transparent]">
        {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} {t("extension.createToken")}
      </button>
    </div>
  );
}
