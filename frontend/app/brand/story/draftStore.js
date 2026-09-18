"use client";
/**
 * draftStore.js — every in-progress Story is its own saved draft, not
 * one single slot: "New Story" (StoryComposer.js) saves whatever's
 * currently open and starts a blank one, and "My Stories" lists every
 * saved draft to switch back to. IndexedDB, not localStorage: clips are
 * real uploaded video/image File objects, easily tens of MB, and
 * localStorage is string-only with a ~5-10MB total quota — nowhere near
 * enough. IndexedDB stores File/Blob objects directly (structured clone
 * preserves name/type/lastModified) under a much larger, browser-managed
 * quota, so the actual clip files round-trip intact.
 *
 * Each draft is keyed by its own id (see newStoryId); which one is
 * "the one currently open" is a separate, tiny localStorage pointer
 * (ACTIVE_KEY) — plain strings, no Blob content, no reason for that part
 * to live in IndexedDB too.
 */
const DB_NAME = "noqeev_brand_drafts";
const DB_VERSION = 1;
const STORE = "story";
const LEGACY_KEY = "current"; // pre-multi-draft single-slot key, migrated below
const ACTIVE_KEY = "noqeev_story_active_id";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
  }));
}

export function newStoryId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `story_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Every call is best-effort: a draft failing to save/load should never
// block editing or throw the composer into an error state — losing the
// autosave is far better than losing the ability to keep working.
export async function saveStoryDraft(id, data) {
  try {
    await tx("readwrite", (store) => store.put({ ...data, id, updatedAt: Date.now() }, id));
  } catch {
    /* best-effort */
  }
}

export async function loadStoryDraft(id) {
  try {
    return (await tx("readonly", (store) => store.get(id))) || null;
  } catch {
    return null;
  }
}

export async function deleteStoryDraft(id) {
  try {
    await tx("readwrite", (store) => store.delete(id));
  } catch {
    /* best-effort */
  }
}

// Lightweight rows for the "My Stories" switcher — full records (clip
// File blobs and all) held in memory just long enough to strip them down
// to {id, name, updatedAt, clipCount}, newest first. Fine at the scale
// this is ever used at (someone's own handful of in-progress stories),
// not worth a second summary-only object store for.
export async function listStoryDrafts() {
  try {
    const all = (await tx("readonly", (store) => store.getAll())) || [];
    return all
      .filter((d) => d && d.id)
      .map((d) => ({ id: d.id, name: d.name || "Untitled story", updatedAt: d.updatedAt || 0, clipCount: d.clips?.length || 0 }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getActiveStoryId() {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
export function setActiveStoryId(id) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* best-effort */ }
}

// One-time upgrade path for anyone who already had a draft saved under
// the old single-slot scheme (LEGACY_KEY) before "New Story"/"My
// Stories" existed — gives it a real id and makes it the active draft,
// instead of it just silently becoming unreachable.
export async function migrateLegacyDraft() {
  try {
    const legacy = await tx("readonly", (store) => store.get(LEGACY_KEY));
    if (!legacy) return null;
    const id = newStoryId();
    await tx("readwrite", (store) => store.put({ ...legacy, id, name: "My story", updatedAt: Date.now() }, id));
    await tx("readwrite", (store) => store.delete(LEGACY_KEY));
    return id;
  } catch {
    return null;
  }
}
