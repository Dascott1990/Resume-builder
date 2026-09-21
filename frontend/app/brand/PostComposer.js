"use client";
/**
 * PostComposer.js — "create a post": start from a shape (or an AI draft),
 * then make it yours — drag anything anywhere, change its font/size/
 * spacing/alignment, add an emoji or a GIF/image sticker. The same "start
 * from a template, then customize freely" shape real design tools use, not
 * a locked layout and not a blank canvas either.
 *
 * The on-screen <canvas> IS the export target — drawn at full platform
 * resolution and scaled down only via CSS, so what downloads is
 * pixel-identical to what's on screen.
 *
 * Desktop/tablet: unchanged sticky-canvas + side-by-side grid. On phone,
 * that same sticky treatment applied to the WHOLE canvas box was the
 * actual bug worth fixing here — a tall preset (Story/Portrait, 9:16)
 * makes that box nearly the full viewport height, and pinning something
 * that tall pushes Download/Email so far down they read as having
 * vanished, even though nothing was removed. Mirrors StoryComposer.js's
 * phone layout instead: canvas stays the visible base, Download/Email
 * stay immediately reachable right under it, and the longer edit
 * controls (AI draft, Start from, Add, layer styling, Handle) move into
 * a BottomSheet — every single control still here, just relocated.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Download, Loader2, Type, Smile, ImagePlus, Undo2, Redo2, Pencil,
  FilePlus2, Images, FileImage, Trash2, Upload, Share2, Check, Sparkles, Copy,
} from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BottomSheet } from "@/components/premium/shared/BottomSheet";
import { useViewport } from "@/lib/useViewport";
import { apiRequest } from "@/components/premium/shared/api";
import {
  loadMarkImage, ensureFontsReady, canvasToPngBlob, downloadBlob, shareOrDownloadBlob, resizeImageToDataUrl,
  loadHandle, saveHandle, loadAiHistory, pushAiHistory,
  savePostDraft, loadPostDraft, deletePostDraft, listPostDrafts,
  getActivePostId, setActivePostId, newPostId, migrateLegacyPostDraft,
} from "./assetKit";
import {
  renderPost, PLATFORMS, DEFAULT_ACCENT, SHAPES, INITIAL_LAYOUTS,
  makeTextLayer, makeStickerLayer,
} from "./postTemplates";
import { EmailAssetButton } from "./EmailAssetButton";
import { LayerPanel } from "./LayerPanel";
import { AiSuggestPanel, timeOfDay } from "./AiSuggestPanel";

const STICKER_EMOJI = ["✨", "🔥", "🎉", "💪", "🙌", "👀", "✅", "📈", "💼", "🎯", "☕", "⚡", "🚀", "💡", "🏆", "⏳"];

// Feature-detected out entirely on browsers with no navigator.share
// (most desktop browsers) rather than shown everywhere and quietly
// behaving like a second Download button — same guard Story's
// ExportPanel.js uses for its own Share button.
const CAN_SHARE_FILES = typeof navigator !== "undefined" && !!navigator.share;

// Module-scope, not React state — only resets on an actual page load, so
// the "picked up your draft" toast fires once per visit to the site, not
// once per remount (switching /brand zones away from Create and back).
let hasShownPostDraftToast = false;

// Sample copy for manually picking a shape (distinct from the AI draft
// path, which supplies its own real content) — same defaults the old
// fixed-field composer shipped with.
const SHAPE_DEFAULTS = {
  tip: { eyebrow: "Noqeev · Daily tip", headline: "Cut your resume to one page before you cut anything else.", subtext: "A recruiter spends seconds on page two. Say the important thing first." },
  quote: { eyebrow: "", headline: "A gap on your resume isn't the end of the story.", subtext: "— Noqeev" },
  stat: { eyebrow: "Noqeev · By the numbers", headline: "3 minutes", subtext: "The average time it takes to tailor a resume with Noqeev." },
};

const makePostName = () => `Post — ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

function relativeTime(ts) {
  if (!ts) return "";
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function PostComposer({ accent = DEFAULT_ACCENT }) {
  const { isPhone } = useViewport();
  const [sheetOpen, setSheetOpen] = useState(false);
  // How tall the Edit sheet is allowed to be, measured fresh every time it
  // opens (see openEditSheet below) — null until then, which falls back to
  // BottomSheet's own default cap. Same fix as StoryComposer.js's own
  // sheetMaxHeight: BottomSheet's 64vh default was tuned against Guest
  // Mode's shorter preview, and this canvas (up to 560px wide, full-height
  // on a portrait/story shape) is often taller than that leaves room for.
  const [sheetMaxHeight, setSheetMaxHeight] = useState(null);
  const canvasBlockRef = useRef(null);
  const [shapeId, setShapeId] = useState("tip");
  const [platformId, setPlatformId] = useState("square");
  const [layers, setLayersRaw] = useState(() => INITIAL_LAYOUTS.tip(SHAPE_DEFAULTS.tip));
  // Every shape's own last-edited content, keyed by shape id — NOT
  // derived from `layers` on demand. Before this existed, switchShape
  // threw away whatever was typed the moment you looked at another
  // shape (always reset to canned SHAPE_DEFAULTS), and the download
  // preview had to fake the other two shapes' content by blindly
  // reformatting the ACTIVE shape's raw text through their layout
  // functions — which is exactly why a Stat preview could end up
  // showing a full sentence crammed into its one-number slot, or a
  // Quote preview showing recruiter-advice text where an attribution
  // belongs: it was never that shape's real content to begin with. Kept
  // in sync with `layers` below, and persisted in the post draft
  // (savePostDraft/loadPostDraft) so it survives a reload too.
  const [layersByShape, setLayersByShape] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [handle, setHandle] = useState("");
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Download preview: clicking Download shows all 3 shapes (Tip/Quote/
  // Stat) side by side, each with its OWN real content (layersByShape),
  // so "download" means "download whichever of these actual posts you
  // want" — not just whatever shape happens to be open right now.
  // shapePreviews is {tip: dataUrl, quote: dataUrl, stat: dataUrl};
  // selectedShapeIds is which of those are checked for the actual
  // download.
  const [downloadPreviewOpen, setDownloadPreviewOpen] = useState(false);
  const [shapePreviews, setShapePreviews] = useState(null);
  const [selectedShapeIds, setSelectedShapeIds] = useState(() => new Set());
  const [downloadingSelected, setDownloadingSelected] = useState(false);
  // AI posting plan — advisory only (see suggest_posting_plan, api/brand.py):
  // when/where/how to post each of the 3 posts. Fetched alongside the
  // preview, not blocking it — the previews render immediately, the plan
  // fills in a moment later.
  const [postingPlan, setPostingPlan] = useState(null);
  const [postingPlanLoading, setPostingPlanLoading] = useState(false);
  // Per-post captions — the text that goes IN the caption box when
  // actually publishing (see suggest_captions, api/brand.py), distinct
  // from the fixed on-image text. {tip: "...", quote: "...", stat: "..."}
  const [captions, setCaptions] = useState(null);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [gifUrlOpen, setGifUrlOpen] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [historyTick, setHistoryTick] = useState(0); // bumped on every undo/redo/commit so the buttons' disabled state re-renders
  // Which saved draft (assetKit.js's multi-draft store) is currently
  // open, and its own display name — null until the mount effect below
  // resolves which post should be active. postsOpen/postsList back the
  // "My Posts" switcher sheet.
  const [postId, setPostId] = useState(null);
  const [postName, setPostName] = useState(null);
  const [postsOpen, setPostsOpen] = useState(false);
  const [postsList, setPostsList] = useState([]);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const markImgRef = useRef(null);
  const stickerImagesRef = useRef({});
  const boxesRef = useRef(new Map());
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false); // a plain click (no movement) shouldn't push a no-op history step
  // Undo history — snapshots of the whole layers array, not per-field
  // diffs; a post has at most a handful of layers, so this stays cheap
  // and sidesteps ever having to reconcile a diff/patch format.
  const historyRef = useRef([layers]);
  const historyIndexRef = useRef(0);

  // One committed step per discrete action (add/delete/style change/drag
  // finished) — NOT per pointermove or per input tick, so undo reverses
  // "that drag" or "that edit" in one press, the way a real design tool's
  // undo behaves, not fifty tiny steps for one gesture.
  const commitLayers = (updater) => {
    setLayersRaw((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(next);
      if (historyRef.current.length > 50) historyRef.current.shift();
      historyIndexRef.current = historyRef.current.length - 1;
      setHistoryTick((t) => t + 1);
      return next;
    });
  };
  // Live position during an active drag — updates what's on screen without
  // spamming the history stack; the drag's actual history entry is
  // committed once, at pointer-up, with wherever it ended.
  const setLayersLive = (updater) => setLayersRaw(updater);
  const setLayers = commitLayers;

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setLayersRaw(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
    setHistoryTick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setLayersRaw(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
    setHistoryTick((t) => t + 1);
  }, []);
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      // Skip while typing anywhere (a text field, the handle input, the AI
      // prompt) — Cmd+Z there should undo the text, not a layer edit.
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Which draft is active, resolved once on mount — a refresh used to
  // lose every layer and every restyle with nothing to show for it.
  // First-ever visit (or an old pre-multi-draft single slot) gets a
  // real id via migrateLegacyPostDraft/newPostId instead of staying
  // postId === null.
  const restoredRef = useRef(false);
  useEffect(() => {
    setHandle(loadHandle());
    Promise.all([loadMarkImage(), ensureFontsReady()]).then(([img]) => { markImgRef.current = img; setReady(true); });

    let id = getActivePostId();
    if (!id) {
      id = migrateLegacyPostDraft() || newPostId();
      setActivePostId(id);
    }
    setPostId(id);

    const draft = loadPostDraft(id);
    setPostName(draft?.name || makePostName());
    if (draft?.layers?.length) {
      setLayersRaw(draft.layers);
      historyRef.current = [draft.layers];
      historyIndexRef.current = 0;
      setHistoryTick((t) => t + 1);
      if (draft.shapeId) setShapeId(draft.shapeId);
      if (draft.platformId) setPlatformId(draft.platformId);
      if (draft.layersByShape) setLayersByShape(draft.layersByShape);
      // Restoring itself has to run every mount — switching to another
      // /brand zone and back unmounts this component entirely (page.js
      // only renders it while zone === "create"), wiping its React state,
      // so re-loading the draft is what makes coming straight back to
      // Create still show what you had. The toast confirming that is a
      // one-time "in case you just refreshed" notice, though — showing it
      // on every single tab switch back to Create was the actual bug
      // (10 visits, 10 toasts). hasShownPostDraftToast is a plain module
      // variable, not React state, so it only resets on an actual page
      // load, not a remount.
      if (!hasShownPostDraftToast) {
        toast.success("Picked up your last post.");
        hasShownPostDraftToast = true;
      }
    }
    restoredRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced so a dragged slider or fast typing doesn't write on every
  // intermediate value — autosaves after every settled change instead of
  // an explicit "save" action, so forgetting to press one can't lose
  // anything. Skipped until the restore above has resolved postId, so
  // the initial default layers (before a draft is checked for) never
  // overwrite a real draft that just hasn't loaded yet, and saved under
  // THIS post's own id — not a single fixed slot — so switching away
  // never clobbers another draft's save.
  useEffect(() => {
    if (!restoredRef.current || !postId) return;
    const timer = setTimeout(() => savePostDraft(postId, { name: postName, shapeId, platformId, layers, layersByShape }), 600);
    return () => clearTimeout(timer);
  }, [layers, shapeId, platformId, postId, postName, layersByShape]);

  // Resets every piece of post-specific state to blank, without touching
  // storage — the shared tail of New Post, switching to another draft,
  // and deleting the one currently open.
  const resetComposerState = (nextId, nextName, restoredLayers, restoredShapeId = "tip", restoredPlatformId = "square", restoredLayersByShape = {}) => {
    const nextLayers = restoredLayers?.length ? restoredLayers : INITIAL_LAYOUTS[restoredShapeId](SHAPE_DEFAULTS[restoredShapeId]);
    setActivePostId(nextId);
    setPostId(nextId);
    setPostName(nextName);
    setLayersRaw(nextLayers);
    setLayersByShape({ ...restoredLayersByShape, [restoredShapeId]: nextLayers });
    historyRef.current = [nextLayers];
    historyIndexRef.current = 0;
    setHistoryTick((t) => t + 1);
    setSelectedId(null);
    setShapeId(restoredShapeId);
    setPlatformId(restoredPlatformId);
  };

  // Saves whatever's open right now under its OWN id immediately (not
  // waiting on the debounced autosave above) — used right before
  // switching away from it, so nothing from it can be lost in the gap.
  const persistCurrentPost = () => {
    if (!postId) return;
    savePostDraft(postId, { name: postName, shapeId, platformId, layers, layersByShape });
  };

  const startNewPost = () => {
    persistCurrentPost();
    resetComposerState(newPostId(), makePostName());
    toast.success("Started a new post — your other one is saved.");
  };

  const refreshPostsList = () => setPostsList(listPostDrafts());
  const openPostsPanel = () => { refreshPostsList(); setPostsOpen(true); };

  // Opens the Edit sheet sized to whatever room is ACTUALLY left below the
  // canvas, measured live — same fix as StoryComposer.js's openEditSheet.
  // rect.bottom is viewport-relative; + window.scrollY turns it into a
  // fixed document position, correct regardless of scroll position when
  // this is called. Floored at 280px so an unusually tall canvas (a
  // portrait/story shape) on a short device never squeezes the sheet down
  // to something too cramped to actually use.
  const openEditSheet = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const rect = canvasBlockRef.current?.getBoundingClientRect();
    if (rect) {
      const canvasBottomInDocument = rect.bottom + window.scrollY;
      setSheetMaxHeight(Math.max(280, window.innerHeight - canvasBottomInDocument - 12));
    }
    setSheetOpen(true);
  };

  const switchToPost = (id) => {
    if (id === postId) { setPostsOpen(false); return; }
    persistCurrentPost();
    const draft = loadPostDraft(id);
    resetComposerState(id, draft?.name || "Untitled post", draft?.layers, draft?.shapeId || "tip", draft?.platformId || "square", draft?.layersByShape);
    setPostsOpen(false);
    toast.success(`Switched to "${draft?.name || "Untitled post"}".`);
  };

  const deletePost = (id, e) => {
    e.stopPropagation();
    deletePostDraft(id);
    if (id === postId) resetComposerState(newPostId(), makePostName());
    refreshPostsList();
    toast.success("Deleted.");
  };

  const updateHandle = (v) => { setHandle(v); saveHandle(v); };

  const switchShape = (id) => {
    setShapeId(id);
    // Restore that shape's own last-edited content if it has any —
    // only a shape that's genuinely never been visited falls back to
    // canned defaults. Switching Tip -> Quote -> back to Tip no longer
    // wipes whatever was typed into Tip.
    setLayers(layersByShape[id] || INITIAL_LAYOUTS[id](SHAPE_DEFAULTS[id]));
    setSelectedId(null);
  };

  const applySuggestion = (data) => {
    const template = INITIAL_LAYOUTS[data.template] ? data.template : "tip";
    setShapeId(template);
    setLayers(INITIAL_LAYOUTS[template]({ eyebrow: data.eyebrow, headline: data.headline, subtext: data.subtext }));
    setSelectedId(null);
  };

  const addText = () => {
    const layer = makeTextLayer({ text: "Your text" });
    setLayers((ls) => [...ls, layer]);
    setSelectedId(layer.id);
    setStickerPickerOpen(false);
  };
  const addEmoji = (emoji) => {
    const layer = makeStickerLayer({ kind: "emoji", value: emoji });
    setLayers((ls) => [...ls, layer]);
    setSelectedId(layer.id);
    setStickerPickerOpen(false);
  };
  const addGif = async () => {
    const url = gifUrl.trim();
    if (!url) return;
    setGifLoading(true);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous"; // required so the export canvas isn't tainted by a cross-origin image
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not load that link as an image."));
        el.src = url;
      });
      stickerImagesRef.current = { ...stickerImagesRef.current, [url]: img };
      const layer = makeStickerLayer({ kind: "image", value: url, sizeFrac: 0.3 });
      setLayers((ls) => [...ls, layer]);
      setSelectedId(layer.id);
      setGifUrl("");
      setGifUrlOpen(false);
    } catch {
      toast.error("Couldn't load that link.");
    } finally {
      setGifLoading(false);
    }
  };
  // A device upload, not just a pasted URL — resizeImageToDataUrl turns
  // it into an inline data: URL (see assetKit.js) rather than an object
  // URL, so it's plain JSON and survives the draft autosave/reload like
  // every other layer does, instead of pointing at a blob that's gone
  // the moment the tab closes.
  const addUploadedImage = async (file) => {
    if (!file) return;
    setUploadLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Couldn't read that image."));
        el.src = dataUrl;
      });
      stickerImagesRef.current = { ...stickerImagesRef.current, [dataUrl]: img };
      const layer = makeStickerLayer({ kind: "image", value: dataUrl, sizeFrac: 0.3 });
      setLayers((ls) => [...ls, layer]);
      setSelectedId(layer.id);
      setStickerPickerOpen(false);
    } catch (e) {
      toast.error(e.message || "Couldn't load that image.");
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateLayer = (next) => setLayers((ls) => ls.map((l) => (l.id === next.id ? next : l)));
  const deleteSelected = () => {
    setLayers((ls) => ls.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    const src = layers.find((l) => l.id === selectedId);
    if (!src) return;
    const copy = { ...src, id: `${src.id}-copy-${Date.now()}`, x: clamp01(src.x + 0.03), y: clamp01(src.y + 0.03) };
    setLayers((ls) => [...ls, copy]);
    setSelectedId(copy.id);
  };
  // z-order is just array order — later elements draw on top (see
  // postTemplates.js's renderPost, and hitTest above walking the array
  // backwards so the topmost layer wins a click too).
  const sendSelectedToBack = () => {
    setLayers((ls) => {
      const layer = ls.find((l) => l.id === selectedId);
      if (!layer) return ls;
      return [layer, ...ls.filter((l) => l.id !== selectedId)];
    });
  };
  const bringSelectedToFront = () => {
    setLayers((ls) => {
      const layer = ls.find((l) => l.id === selectedId);
      if (!layer) return ls;
      return [...ls.filter((l) => l.id !== selectedId), layer];
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !markImgRef.current) return;
    const { w, h } = PLATFORMS[platformId];
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    boxesRef.current = renderPost(ctx, w, h, layers, markImgRef.current, accent, handle, stickerImagesRef.current);
  };
  useEffect(() => { if (ready) draw(); }, [ready, layers, platformId, accent, handle]);
  // Mirrors whatever's currently being edited into layersByShape under
  // its OWN shape id, on every change — this is what makes "each shape
  // keeps its own real content" true without switchShape or the download
  // preview having to special-case anything: they just read this cache.
  useEffect(() => { setLayersByShape((prev) => ({ ...prev, [shapeId]: layers })); }, [layers, shapeId]);

  // ── Drag-to-reposition — hit-test the last-rendered boxes (topmost
  // layer first), then track the pointer's offset from the layer's own
  // anchor so dragging doesn't "snap" the layer to the cursor's tip. ─────
  const pointFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const hitTest = (px, py) => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const box = boxesRef.current.get(layers[i].id);
      if (box && px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h) return layers[i];
    }
    return null;
  };
  const onPointerDown = (e) => {
    const p = pointFromEvent(e);
    const hit = hitTest(p.x, p.y);
    setSelectedId(hit?.id || null);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { w, h } = PLATFORMS[platformId];
    dragRef.current = { id: hit.id, dx: p.x / w - hit.x, dy: p.y / h - hit.y };
    dragMovedRef.current = false;
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const p = pointFromEvent(e);
    const { w, h } = PLATFORMS[platformId];
    const { id, dx, dy } = dragRef.current;
    const nx = clamp01(p.x / w - dx), ny = clamp01(p.y / h - dy);
    dragMovedRef.current = true;
    setLayersLive((ls) => ls.map((l) => (l.id === id ? { ...l, x: nx, y: ny } : l)));
  };
  const onPointerUp = () => {
    // Bake the whole drag into ONE history step, taken here at drag-end —
    // committing per pointermove would make undo reverse a drag one pixel
    // at a time instead of putting the layer back where it started.
    if (dragRef.current && dragMovedRef.current) commitLayers(layers);
    dragRef.current = null;
  };

  const exportBlob = () => canvasToPngBlob(canvasRef.current);
  const exportFilename = () => `noqeev-${shapeId}-${platformId}.png`;
  const handleShare = async () => {
    setSharing(true);
    try {
      const result = await shareOrDownloadBlob(await exportBlob(), exportFilename(), `My ${shapeId} post, made with Noqeev`);
      if (result === "downloaded") toast.success("Sharing wasn't available here — downloaded instead.");
      else if (result === "shared") toast.success("Shared.");
    } catch { toast.error("Try again."); }
    finally { setSharing(false); }
  };

  // Pull a shape's actual content back out of ITS OWN layersByShape entry
  // by role (see INITIAL_LAYOUTS, postTemplates.js — every text layer it
  // seeds carries a role: "eyebrow"/"headline"/"subtext"), falling back
  // to SHAPE_DEFAULTS only for a shape that's never actually been
  // visited. This is the fix for downloads not matching each post
  // card's real words: there used to be no such thing as "Quote's own
  // content" or "Stat's own content" — only the currently active shape's
  // raw text, blindly reformatted through the other two shapes' layout
  // functions on the fly, which is exactly how a Stat preview could end
  // up with a full sentence crammed into its one-number slot. Now every
  // shape genuinely has its own stored content (layersByShape), so this
  // is just reading it back, never guessing at it.
  const shapeContent = (id) => {
    const shapeLayers = layersByShape[id] || INITIAL_LAYOUTS[id](SHAPE_DEFAULTS[id]);
    const get = (role) => shapeLayers.find((l) => l.role === role)?.text || "";
    let headline = get("headline");
    if (id === "quote") headline = headline.replace(/^"|"$/g, "");
    return { eyebrow: get("eyebrow"), headline, subtext: get("subtext") };
  };

  const allShapesContent = () => {
    const out = {};
    for (const s of SHAPES) out[s.id] = shapeContent(s.id);
    return out;
  };

  const shapeFilename = (id) => `noqeev-${id}-${platformId}.png`;

  // Renders one shape into its OWN offscreen canvas, straight from ITS
  // OWN stored layers — no more deriving from a different shape's text.
  const renderShapeCanvas = (id) => {
    const { w, h } = platform;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const ctx = off.getContext("2d");
    const shapeLayers = layersByShape[id] || INITIAL_LAYOUTS[id](SHAPE_DEFAULTS[id]);
    renderPost(ctx, w, h, shapeLayers, markImgRef.current, accent, handle, stickerImagesRef.current);
    return off;
  };

  const nowContext = () => ({
    time_of_day: timeOfDay(new Date().getHours()),
    day_of_week: new Date().toLocaleDateString(undefined, { weekday: "long" }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const fetchPostingPlan = async (shapesContent) => {
    setPostingPlanLoading(true);
    try {
      const data = await apiRequest("/api/v1/brand/suggest-posting-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shapesContent, ...nowContext() }),
      });
      setPostingPlan(data.plan || []);
    } catch {
      // Advisory-only feature — a failed suggestion shouldn't block the
      // actual download, so this fails silently into an empty plan
      // rather than a toast the user didn't ask for.
      setPostingPlan([]);
    } finally {
      setPostingPlanLoading(false);
    }
  };

  const fetchCaptions = async (shapesContent) => {
    setCaptionsLoading(true);
    try {
      const data = await apiRequest("/api/v1/brand/suggest-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shapesContent, avoid: loadAiHistory() }),
      });
      setCaptions(data);
      pushAiHistory(data.tip, data.quote, data.stat);
    } catch {
      // Advisory-only feature — same reasoning as fetchPostingPlan above.
      setCaptions({});
    } finally {
      setCaptionsLoading(false);
    }
  };

  const openDownloadPreview = () => {
    const previews = {};
    for (const s of SHAPES) previews[s.id] = renderShapeCanvas(s.id).toDataURL("image/png");
    setShapePreviews(previews);
    setSelectedShapeIds(new Set([shapeId]));
    setPostingPlan(null);
    setCaptions(null);
    setDownloadPreviewOpen(true);
    const shapesContent = allShapesContent();
    fetchPostingPlan(shapesContent);
    fetchCaptions(shapesContent);
  };

  const copyCaption = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Caption copied.");
    } catch {
      toast.error("Couldn't copy — select and copy the text manually.");
    }
  };

  const toggleShapeSelected = (id) => {
    setSelectedShapeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDownloadSelected = async () => {
    if (!selectedShapeIds.size) return;
    setDownloadingSelected(true);
    try {
      // Staggered, not fired all at once — rapid concurrent downloads can
      // trip a browser's own popup/multi-download guard, which would
      // silently drop everything after the first.
      let i = 0;
      for (const id of selectedShapeIds) {
        const blob = await (await fetch(shapePreviews[id])).blob();
        downloadBlob(blob, shapeFilename(id));
        i += 1;
        if (i < selectedShapeIds.size) await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(selectedShapeIds.size === 1 ? "Downloaded." : `Downloaded ${selectedShapeIds.size} images.`);
      setDownloadPreviewOpen(false);
    } catch {
      toast.error("Try again.");
    } finally {
      setDownloadingSelected(false);
    }
  };

  const platform = PLATFORMS[platformId];
  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  // Plain JSX values below, NOT `() => (...)` components defined in this
  // function's own body — a function declared in here is a brand-new
  // reference every render, so e.g. <EditControls /> was a different
  // component TYPE to React on every keystroke in the Handle/AI-prompt
  // inputs, fully unmounting/remounting the whole subtree instead of just
  // re-rendering it — which drops focus and forces a re-click before the
  // next character. A plain JSX variable has no separate identity to
  // break; it's just part of this render, so React diffs it normally.
  const canvasBlock = (
    <>
      <div className="flex w-full max-w-[560px] items-center justify-end gap-1">
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
          <Undo2 className="size-4" />
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Redo"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
          <Redo2 className="size-4" />
        </button>
      </div>
      {/* Sized with CSS aspect-ratio, not a JS-computed pixel width — the
          box just fills its container (capped by max-w) and the browser
          works out the height, so a wide shape like Landscape can never
          blow past a narrow screen the way a fixed px width did. Wider
          cap than before (560px, matching the resume preview's own
          "as large as the layout can spare" treatment) — easier to see
          exactly where a drag lands at real editing precision.

          On phone specifically, that width-driven sizing is capped by
          HEIGHT instead (same reasoning as PreviewPlayer.js's own preview
          box) — without it, a portrait/story shape's canvas grows to the
          full screen width and derives a ~600px-tall box from that, which
          pushes the Download/Email row far enough down the page that it
          landed UNDER the fixed BottomNav (confirmed live: the Download
          button was half-covered by the nav on Portrait, nothing to do
          with any control on top of it — the canvas itself was simply too
          tall). Desktop keeps the original width-driven sizing; there's
          no competing fixed bottom chrome there to collide with. */}
      <div
        className="relative mx-auto flex w-full max-w-[560px] items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
        style={{
          aspectRatio: `${platform.w} / ${platform.h}`,
          ...(isPhone ? { maxHeight: "34vh", width: `min(100%, calc(34vh * ${platform.w / platform.h}), 560px)` } : {}),
        }}
      >
        {!ready ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="block h-full w-full"
            style={{ cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {Object.entries(PLATFORMS).map(([id, r]) => (
          <button key={id} type="button" onClick={() => setPlatformId(id)} aria-pressed={platformId === id} title={r.sub}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${platformId === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {r.label}
          </button>
        ))}
      </div>
    </>
  );

  const editControls = (
    <div className="grid gap-4">
      <AiSuggestPanel onSuggestion={applySuggestion} />

      <div>
        <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Start from</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPES.map((s) => (
            <button key={s.id} type="button" onClick={() => switchShape(s.id)} aria-pressed={shapeId === s.id}
              className={`rounded-lg border px-2 py-2 text-center ${shapeId === s.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>
              <span className="text-[12px] font-bold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Add</p>
        <div className="flex flex-wrap gap-1.5">
          <Btn small variant="ghost" onClick={addText}><Type className="size-3.5" /> Text</Btn>
          <Btn small variant="ghost" onClick={() => { setStickerPickerOpen((v) => !v); setGifUrlOpen(false); }}><Smile className="size-3.5" /> Emoji</Btn>
          <Btn small variant="ghost" onClick={() => { setGifUrlOpen((v) => !v); setStickerPickerOpen(false); }}><ImagePlus className="size-3.5" /> GIF / Image</Btn>
          <Btn small variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadLoading} loading={uploadLoading}>
            <Upload className="size-3.5" /> Upload
          </Btn>
          <input
            ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => addUploadedImage(e.target.files?.[0])}
          />
        </div>
        {stickerPickerOpen && (
          // 6 columns, not 8 — at a real 44px touch target (down from
          // size-8/32px) 8 columns would overflow this sidebar's width.
          <div className="mt-2 grid grid-cols-6 gap-1.5 rounded-lg border border-border bg-card p-2">
            {STICKER_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => addEmoji(e)} className="flex size-11 items-center justify-center rounded-md text-lg hover:bg-muted">{e}</button>
            ))}
          </div>
        )}
        {gifUrlOpen && (
          <div className="mt-2 flex gap-1.5">
            <Input value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="Image/GIF link" className="h-9 rounded-[8px] text-[12.5px]" onKeyDown={(e) => { if (e.key === "Enter") addGif(); }} />
            <Btn small variant="gold" onClick={addGif} disabled={gifLoading} loading={gifLoading}>Add</Btn>
          </div>
        )}
      </div>

      {selectedLayer ? (
        <LayerPanel
          layer={selectedLayer} onChange={updateLayer} onDelete={deleteSelected}
          onDuplicate={duplicateSelected} onFront={bringSelectedToFront} onBack={sendSelectedToBack}
          accent={accent}
        />
      ) : (
        <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
          Tap to style
        </p>
      )}

      <div>
        <label className="mb-1.5 block text-[11.5px] font-bold tracking-wide text-foreground">Handle</label>
        <Input value={handle} onChange={(e) => updateHandle(e.target.value)} className="h-10 rounded-[10px] text-[13.5px]" />
      </div>
    </div>
  );

  const downloadRow = (
    <div className="flex gap-2">
      <Btn variant="gold" onClick={openDownloadPreview} disabled={!ready || sharing} className="flex-1">
        <Download className="size-4" /> Download
      </Btn>
      {CAN_SHARE_FILES && (
        <Btn small variant="ghost" onClick={handleShare} disabled={!ready || sharing} loading={sharing} aria-label="Share to another device">
          <Share2 className="size-4" />
        </Btn>
      )}
      <EmailAssetButton getBlob={exportBlob} filename={exportFilename()} label={shapeId} />

      <Dialog open={downloadPreviewOpen} onOpenChange={setDownloadPreviewOpen}>
        <DialogContent showCloseButton className="w-full max-w-[440px] gap-0 p-0">
          <div className="max-h-[85vh] overflow-y-auto p-5">
            <p className="m-0 mb-1 text-[14px] font-bold text-foreground">Choose what to download</p>
            <p className="m-0 mb-4 text-[12.5px] text-muted-foreground">
              Same content, three ready-made variants — pick any or all.
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              {SHAPES.map((s) => {
                const selected = selectedShapeIds.has(s.id);
                return (
                  <button
                    key={s.id} type="button" onClick={() => toggleShapeSelected(s.id)} aria-pressed={selected}
                    className={`relative overflow-hidden rounded-lg border text-left ${selected ? "border-primary" : "border-border"}`}
                  >
                    {shapePreviews?.[s.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shapePreviews[s.id]} alt={s.label} className="aspect-square w-full object-cover" />
                    )}
                    <div className={`absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/80"}`}>
                      {selected && <Check className="size-3" strokeWidth={3} />}
                    </div>
                    <p className="m-0 border-t border-border bg-card px-1.5 py-1 text-center text-[11px] font-bold text-foreground">{s.label}</p>
                  </button>
                );
              })}
            </div>

            <Btn
              variant="gold" className="mt-4 w-full" onClick={handleDownloadSelected}
              disabled={!selectedShapeIds.size || downloadingSelected} loading={downloadingSelected}
            >
              <Download className="size-4" />
              {downloadingSelected ? "Downloading…" : selectedShapeIds.size ? `Download (${selectedShapeIds.size})` : "Select at least one"}
            </Btn>

            {/* Captions — the text that goes IN the caption box when
                actually publishing, distinct from each post's fixed
                on-image text. One per shape, each grounded in THAT
                shape's own real content (see suggest_captions,
                api/brand.py) — never a generic line reused across all
                three. */}
            <div className="mt-5 border-t border-border pt-4">
              <p className="m-0 mb-2.5 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground/70 uppercase">
                <Sparkles className="size-3.5 text-primary" /> Captions
              </p>
              {captionsLoading && (
                <div className="grid gap-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
                </div>
              )}
              {!captionsLoading && captions && Object.values(captions).some(Boolean) && (
                <div className="grid gap-2">
                  {SHAPES.filter((s) => captions[s.id]).map((s) => (
                    <div key={s.id} className="rounded-lg border border-border bg-card p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="m-0 text-[11px] font-bold text-primary">{s.label}</p>
                        <button type="button" onClick={() => copyCaption(captions[s.id])} aria-label={`Copy ${s.label} caption`}
                          className="shrink-0 text-muted-foreground hover:text-foreground">
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                      <p className="m-0 mt-0.5 text-[12px] leading-snug text-foreground">{captions[s.id]}</p>
                    </div>
                  ))}
                </div>
              )}
              {!captionsLoading && captions && !Object.values(captions).some(Boolean) && (
                <p className="m-0 text-[12px] text-muted-foreground">Couldn't write captions right now — the download still works fine.</p>
              )}
            </div>

            {/* Advisory only — see suggest_posting_plan, api/brand.py. Never
                connects to a real handle or schedules anything; just tells
                someone what to do with the file(s) they just downloaded. */}
            <div className="mt-5 border-t border-border pt-4">
              <p className="m-0 mb-2.5 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground/70 uppercase">
                <Sparkles className="size-3.5 text-primary" /> Suggested posting plan
              </p>
              {postingPlanLoading && (
                <div className="grid gap-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
                </div>
              )}
              {!postingPlanLoading && postingPlan?.length > 0 && (
                <div className="grid gap-2">
                  {postingPlan.map((entry, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-2.5">
                      <p className="m-0 text-[12.5px] font-bold text-foreground">{entry.platform}</p>
                      <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted-foreground">{entry.action}</p>
                      {entry.timing && <p className="m-0 mt-1 font-mono text-[10.5px] text-primary">{entry.timing}</p>}
                    </div>
                  ))}
                </div>
              )}
              {!postingPlanLoading && postingPlan?.length === 0 && (
                <p className="m-0 text-[12px] text-muted-foreground">Couldn't get a suggestion right now — the download still works fine.</p>
              )}
              <p className="m-0 mt-3 text-[11px] leading-snug text-muted-foreground/70">
                Guidance only — nothing is scheduled or posted automatically.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // This post's name + New Post/My Posts — sits above everything else
  // regardless of phone/desktop layout, so it's always reachable without
  // first having to finish or lose whatever's currently open.
  const postHeader = (
    <div className="flex items-center justify-between gap-2">
      <p className="m-0 min-w-0 truncate text-[13px] font-bold text-foreground">{postName || "Post"}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        {/* On phone, Edit sits right here next to My Posts — the same
            "editing tools live at the top of the content, not floating
            over it" placement Snapchat uses — instead of the fixed
            bottom-right button this used to be. Icon-only: with My Posts
            and New already in this row, a third full icon+label button
            overflowed the header on a narrow phone (confirmed live — New
            was clipped off the right edge) — dropping just this one's
            label was enough to fit all three again. */}
        {isPhone && (
          <button
            type="button" onClick={openEditSheet} title="Edit content & style" aria-label="Edit content & style"
            className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
        )}
        <Btn small variant="ghost" onClick={openPostsPanel}>
          <Images className="size-3.5" /> My Posts
        </Btn>
        <Btn small variant="ghost" onClick={startNewPost}>
          <FilePlus2 className="size-3.5" /> New
        </Btn>
      </div>
    </div>
  );

  const postsPanel = (
    <BottomSheet open={postsOpen} onClose={() => setPostsOpen(false)} title="My Posts">
      <div className="grid gap-2 p-4">
        {postsList.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
            No other saved posts yet.
          </p>
        ) : (
          postsList.map((p) => (
            // A <div role="button">, not a real <button> — it wraps
            // another real <button> (Delete) below, and nesting
            // interactive elements inside a <button> is invalid HTML.
            <div key={p.id} role="button" tabIndex={0} onClick={() => switchToPost(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchToPost(p.id); } }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left ${p.id === postId ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card"}`}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileImage className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13px] font-bold text-foreground">
                  {p.name}{p.id === postId ? " (current)" : ""}
                </p>
                <p className="m-0 text-[11px] text-muted-foreground">
                  {p.layerCount} layer{p.layerCount === 1 ? "" : "s"} · {relativeTime(p.updatedAt)}
                </p>
              </div>
              <button type="button" onClick={(e) => deletePost(p.id, e)} title="Delete"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </BottomSheet>
  );

  if (isPhone) {
    return (
      <div className="grid gap-4">
        {postHeader}
        {/* Canvas as the base view, NOT sticky here — a tall preset
            (Story/Portrait) can make this box nearly the full viewport
            height on a phone, and pinning something that tall is what
            pushed Download/Email out of easy reach in the first place. */}
        <div ref={canvasBlockRef} className="flex min-w-0 w-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
          {canvasBlock}
        </div>
        {downloadRow}
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit" maxHeightPx={sheetMaxHeight}>
          <div className="p-4">
            {editControls}
          </div>
        </BottomSheet>
        {postsPanel}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {postHeader}
      <div className="grid gap-5 sm:grid-cols-[1fr_300px]">
        {/* Sticky, not a plain grid item — without this, scrolling down
            into the controls sidebar carries the canvas out of view along
            with it, so a style change made down there has nothing on
            screen to actually show its result until scrolling back up.
            self-start is required alongside sticky: a grid item stretches
            to its row's full height by default, which would make this
            element as tall as its sibling and leave no room to visibly
            "stick" as the page scrolls past it. */}
        <div className="sticky top-4 flex min-w-0 w-full flex-col items-center gap-3 self-start rounded-2xl border border-border bg-card p-5">
          {canvasBlock}
        </div>

        <div className="grid gap-4">
          {editControls}
          {downloadRow}
        </div>
      </div>
      {postsPanel}
    </div>
  );
}
