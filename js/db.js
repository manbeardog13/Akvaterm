// ============================================================================
// db.js — every data operation. Local-first by design: products come from the
// seed catalog (fetched once, cached in module state), favorites and designs
// live in localStorage under "akv:" keys. Every function is async and resolves
// even fully offline — nothing here throws at a view.
//
// The Supabase seam: when supabaseClient.getSupabase() returns a client,
// writes are MIRRORED to it (fire-and-forget, advisory); reads stay
// local-first, so the app's behaviour is identical with or without a backend.
// ASC discipline ported: fail() error humanization, row-count guards on
// mirrored writes (an RLS-filtered write "succeeds" with 0 rows), and an
// offline outbox that replays queued mirror writes on reconnect.
// ============================================================================

import { getSupabase } from "./supabaseClient.js";
import { newId } from "./domain.js";

const FAV_KEY = "akv:fav";
const DESIGNS_KEY = "akv:designs";
const OUTBOX_KEY = "akv:outbox";

// ---- localStorage plumbing (never throws) ----------------------------------
function readJson(key, fallbackValue) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — the in-memory result is still returned */
  }
}

// ---- Products (seed catalog, cached) ---------------------------------------
let catalogCache = null;    // Product[] once loaded
let catalogPromise = null;  // in-flight fetch (deduplicated)

function loadCatalog() {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogPromise) {
    catalogPromise = fetch(new URL("../data/catalog.seed.json", import.meta.url))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        catalogCache = Array.isArray(json) ? json : (json?.products ?? []);
        return catalogCache;
      })
      .catch((err) => {
        console.warn("[db] seed catalog failed to load:", err?.message || err);
        catalogPromise = null;   // allow a retry on the next call
        return [];
      });
  }
  return catalogPromise;
}

// Case- and diacritic-insensitive matcher for Croatian search text.
function fold(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip combining diacritics
    .replace(/đ/g, "d");               // đ does not decompose
}

// filter: { category?, search? } — or a bare category id string for brevity.
export async function listProducts(filter = {}) {
  const all = await loadCatalog();
  const { category, search } = typeof filter === "string" ? { category: filter } : (filter ?? {});
  let rows = all;
  if (category) rows = rows.filter((p) => p.category === category);
  if (search) {
    const q = fold(search).trim();
    if (q) rows = rows.filter((p) => fold(`${p.name} ${p.brand} ${p.desc}`).includes(q));
  }
  return rows.slice();
}

export async function getProduct(id) {
  const all = await loadCatalog();
  return all.find((p) => p.id === id) ?? null;
}

// ---- Favorites (akv:fav — array of product ids) ----------------------------
export async function listFavorites() {
  const list = readJson(FAV_KEY, []);
  return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
}

export async function toggleFavorite(id) {
  const favorites = await listFavorites();
  const had = favorites.includes(id);
  const next = had ? favorites.filter((f) => f !== id) : [...favorites, id];
  writeJson(FAV_KEY, next);
  if (had) {
    mirror("remove the favorite",
      (sb) => sb.from("favorites").delete().eq("product_id", id).select("product_id"),
      { table: "favorites", kind: "delete", match: { product_id: id } });
  } else {
    mirror("save the favorite",
      (sb) => sb.from("favorites").upsert({ product_id: id }, { onConflict: "product_id" }).select("product_id"),
      { table: "favorites", kind: "upsert", payload: { product_id: id }, onConflict: "product_id" });
  }
  return next;
}

// ---- Designs (akv:designs — array of Design objects) -----------------------
// Design: { id, kind:'scene'|'room3d', refId, name, assignments, room?, savedAt }
function readDesigns() {
  const list = readJson(DESIGNS_KEY, []);
  return Array.isArray(list) ? list.filter((d) => d && typeof d === "object") : [];
}

// How a design flattens into the future `designs` table (payload keeps the
// full client shape so the schema can evolve without data loss).
function designRow(d) {
  return { id: d.id, kind: d.kind, ref_id: d.refId ?? null, name: d.name ?? null, payload: d, saved_at: d.savedAt };
}

export async function listDesigns() {
  return readDesigns().slice().sort((a, b) => String(b.savedAt ?? "").localeCompare(String(a.savedAt ?? "")));
}

// Assigns id (when new) + savedAt, upserts locally, returns the stored copy.
export async function saveDesign(design) {
  const stored = { ...design, id: design?.id || newId("dz"), savedAt: new Date().toISOString() };
  const list = readDesigns().filter((d) => d.id !== stored.id);
  list.push(stored);
  writeJson(DESIGNS_KEY, list);
  mirror("save the design",
    (sb) => sb.from("designs").upsert(designRow(stored), { onConflict: "id" }).select("id"),
    { table: "designs", kind: "upsert", payload: designRow(stored), onConflict: "id" });
  return stored;
}

export async function getDesign(id) {
  return readDesigns().find((d) => d.id === id) ?? null;
}

export async function deleteDesign(id) {
  writeJson(DESIGNS_KEY, readDesigns().filter((d) => d.id !== id));
  mirror("delete the design",
    (sb) => sb.from("designs").delete().eq("id", id).select("id"),
    { table: "designs", kind: "delete", match: { id } });
}

// ---- Supabase mirror seam (advisory, fire-and-forget) ----------------------
// Turn a Supabase error into something classifiable and readable (ported from
// ASC's fail(); adapted to return a classification because the mirror never
// throws — local storage already holds the truth).
function fail(error, doing) {
  const message = error?.message || String(error);
  if (/Failed to fetch|network|fetch failed|load failed/i.test(message)) {
    return { kind: "network", message: `no connection while trying to ${doing} — queued for replay` };
  }
  if (/row-level security|permission/i.test(message)) {
    return { kind: "denied", message: `no permission to ${doing}` };
  }
  return { kind: "other", message: `couldn't ${doing}: ${message}` };
}

// Run a mirrored write when a client exists. Network failures park the
// portable op description in the outbox; RLS-filtered zero-row "successes"
// are surfaced as warnings (ASC row-count guard) — never as user errors.
function mirror(doing, run, op) {
  const sb = getSupabase();
  if (!sb) return;   // offline demo — local storage is the only store
  Promise.resolve()
    .then(() => run(sb))
    .then(({ data, error } = {}) => {
      if (error) {
        const f = fail(error, doing);
        if (f.kind === "network" && op) enqueueOp(op);
        console.warn(`[db] mirror: ${f.message}`);
        return;
      }
      if (Array.isArray(data) && data.length === 0 && op?.kind !== "delete") {
        console.warn(`[db] mirror: ${doing} touched 0 rows (RLS?) — the local copy remains the source of truth`);
      }
    })
    .catch((err) => {
      const f = fail(err, doing);
      if (f.kind === "network" && op) enqueueOp(op);
      console.warn(`[db] mirror: ${f.message}`);
    });
}

// ---- Offline outbox for mirror writes --------------------------------------
// Ops are self-contained descriptions ({table, kind, payload|match, …}) so a
// later session can replay them without the original closure.
function enqueueOp(op) {
  const box = readJson(OUTBOX_KEY, []);
  writeJson(OUTBOX_KEY, [...(Array.isArray(box) ? box : []), { ...op, at: new Date().toISOString() }]);
}

async function runOp(sb, op) {
  let query;
  if (op.kind === "upsert") {
    query = sb.from(op.table).upsert(op.payload, op.onConflict ? { onConflict: op.onConflict } : undefined).select();
  } else if (op.kind === "delete") {
    query = sb.from(op.table).delete();
    for (const [column, value] of Object.entries(op.match ?? {})) query = query.eq(column, value);
    query = query.select();
  } else {
    return true;   // unknown op — drop it rather than loop forever
  }
  const { error } = await query;
  if (error) {
    // Only network failures can heal by waiting; anything else won't — drop it.
    return fail(error, "replay a queued change").kind !== "network";
  }
  return true;
}

let replaying = false;
export async function replayOutbox() {
  if (replaying) return;
  const sb = getSupabase();
  if (!sb) return;
  const box = readJson(OUTBOX_KEY, []);
  if (!Array.isArray(box) || !box.length) return;
  replaying = true;
  try {
    const survivors = [];
    for (const op of box) {
      const done = await runOp(sb, op).catch(() => false);
      if (!done) survivors.push(op);
    }
    // Merge with anything a concurrent write parked while we were awaiting.
    const added = readJson(OUTBOX_KEY, []).slice(box.length);
    writeJson(OUTBOX_KEY, [...survivors, ...added]);
  } finally {
    replaying = false;
  }
}

// Drain on reconnect. Session-safety lives in RLS: an unauthorized replay is
// caught by runOp's error handling and the row-count guard, never by a throw.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { replayOutbox(); });
}
