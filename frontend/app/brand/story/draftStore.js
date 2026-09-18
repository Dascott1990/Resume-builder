"use client";
/**
 * draftStore.js — Story's progress survives a refresh (or coming back
 * later) instead of vanishing, the way it did before. Not localStorage:
 * clips are real uploaded video/image File objects, easily tens of MB,
 * and localStorage is string-only with a ~5-10MB total quota — nowhere
 * near enough. IndexedDB stores File/Blob objects directly (structured
 * clone preserves name/type/lastModified) under a much larger,
 * browser-managed quota, so the actual clip files round-trip intact.
 *
 * Single always-current draft, not multiple named ones — this mirrors
 * how the tool is actually used (one story in progress at a time), same
 * shape as assetKit.js's single UI_STATE_KEY for /brand's own zone/
 * section state, just backed by IndexedDB instead of localStorage
 * because of the Blob content.
 */
const DB_NAME = "noqeev_brand_drafts";
const DB_VERSION = 1;
const STORE = "story";
const DRAFT_KEY = "current";

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

// Every call is best-effort: a draft failing to save/load should never
// block editing or throw the composer into an error state — losing the
// autosave is far better than losing the ability to keep working.
export async function saveStoryDraft(data) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, DRAFT_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* best-effort */
  }
}

export async function loadStoryDraft() {
  try {
    const db = await openDb();
    const data = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(DRAFT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return data;
  } catch {
    return null;
  }
}

export async function clearStoryDraft() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(DRAFT_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* best-effort */
  }
}
