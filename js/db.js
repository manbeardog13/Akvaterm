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
//
// ⚠ WHAT THE MIRROR DOES AND DOES NOT DO TODAY. The rows below match
// supabase/schema.sql exactly (column names, id types, conflict targets), but
// `favorites` and `designs` are owner-only under RLS (`to authenticated`,
// `user_id = auth.uid()`). js/views/prijava.js is now the app's ONE caller of
// supabase.auth (email + password), so a signed-in session is reachable — but
// only on a deployment whose config.js carries real credentials. On the public
// demo CONFIG is empty, getSupabase() returns null forever, every mirrored
// write is a no-op and localStorage stays the one and only store. Even when
// signed in, READS stay local-first: nothing in this file has ever pulled
// favorites or designs back down from Postgres, so cross-device sync is NOT a
// shipped feature and must not be described as one (docs/SETUP.md says the
// same). What signing in changes today is the mirror's write leg, nothing else.
// ============================================================================

import { getSupabase, initSupabase, isConfigured } from "./supabaseClient.js";
import { newId } from "./domain.js";

const FAV_KEY = "akv:fav";
const DESIGNS_KEY = "akv:designs";
const OUTBOX_KEY = "akv:outbox";
const EMAIL_KEY = "akv:auth:email";

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

// ============================================================================
// AUTH — optional, and deliberately powerless over the rest of this file.
//
// The one hard rule: signing in must never become a precondition for using the
// app. Nothing above or below this block consults a session. Favorites and
// designs read and write localStorage whether a session exists or not, the
// catalog comes from the seed file either way, and there is no gate anywhere in
// the router. A signed-out visitor on the public demo has the whole app.
//
// So these helpers are a SEAM, not a gate:
//   • authConfigured()  — is there a backend at all? (config.js filled in)
//   • getSession()      — the current session, or null; never throws
//   • signIn()          — the only function here that throws, and only when a
//                         user has actively pressed "Prijavi se"
//   • signOut(), onAuthChange(), rememberedEmail()/rememberEmail()
//
// signIn() throws an Error carrying a `.code` rather than a sentence, because
// js/i18n.js is the authority for UI copy — the view maps the code to a
// Croatian string. A message invented here would bypass the dictionary and
// could never be translated.
// ============================================================================

/** True when config.js carries real Supabase credentials. False on the demo. */
export function authConfigured() {
  return isConfigured();
}

// Last known session, kept so synchronous callers (the "Više" menu label) can
// ask without awaiting. null means "signed out OR not configured OR not looked
// up yet" — every consumer treats all three the same way, which is why one
// value can carry them.
let sessionCache = null;

/** The cached session without a round trip. Call getSession() for the truth. */
export function currentSession() {
  return sessionCache;
}

/** The live session, or null. Resolves to null immediately when unconfigured
 *  (initSupabase() short-circuits), so calling this on the demo costs nothing
 *  and issues no network request. Never throws. */
export async function getSession() {
  const sb = await initSupabase();
  if (!sb) { sessionCache = null; return null; }
  try {
    const { data } = await sb.auth.getSession();
    sessionCache = data?.session ?? null;
  } catch (err) {
    console.warn("[db] auth: session lookup failed —", err?.message || err);
    sessionCache = null;
  }
  return sessionCache;
}

// Supabase phrases its auth failures in English prose. Classify them once,
// here, into codes the dictionary has entries for.
function authCode(error) {
  const message = error?.message || String(error);
  if (/invalid login credentials|invalid grant/i.test(message)) return "credentials";
  if (/email not confirmed|not confirmed/i.test(message)) return "unconfirmed";
  if (/rate limit|too many requests/i.test(message)) return "rate";
  if (/Failed to fetch|network|fetch failed|load failed/i.test(message)) return "network";
  return "other";
}

function authError(code, detail) {
  const err = new Error(detail || code);
  err.code = code;
  return err;
}

/** Email + password sign-in. Throws an Error with `.code` in
 *  { unavailable, credentials, unconfirmed, rate, network, other }. */
export async function signIn(email, password) {
  const sb = await initSupabase();
  if (!sb) throw authError("unavailable");
  let result;
  try {
    result = await sb.auth.signInWithPassword({
      email: String(email ?? "").trim().toLowerCase(),
      password: String(password ?? ""),
    });
  } catch (err) {
    // A thrown (rather than returned) failure is a transport failure.
    throw authError(authCode(err), err?.message);
  }
  if (result?.error) throw authError(authCode(result.error), result.error.message);
  sessionCache = result?.data?.session ?? null;
  return sessionCache;
}

/** Sign out. Clears the cache first, so the UI is honest even if the network
 *  call fails — a session that cannot be revoked remotely is still gone here. */
export async function signOut() {
  sessionCache = null;
  const sb = getSupabase();
  if (!sb) return;
  try { await sb.auth.signOut(); } catch (err) {
    console.warn("[db] auth: sign-out call failed —", err?.message || err);
  }
}

/** Subscribe to session changes. Returns an unsubscribe function; a no-op
 *  subscription on an unconfigured deployment, so callers need no branch. */
export function onAuthChange(callback) {
  let subscription = null;
  let cancelled = false;
  initSupabase().then((sb) => {
    if (!sb || cancelled) return;
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      sessionCache = session ?? null;
      try { callback(sessionCache); } catch { /* a listener must not break auth */ }
    });
    subscription = data?.subscription ?? null;
    // Unsubscribed while the library was still loading — honour it now.
    if (cancelled) { try { subscription?.unsubscribe(); } catch { /* already gone */ } }
  }).catch(() => { /* unconfigured or vendor file missing — stay silent */ });
  return () => {
    cancelled = true;
    try { subscription?.unsubscribe(); } catch { /* already gone */ }
    subscription = null;
  };
}

/** The last email that signed in successfully, for prefilling the form. A
 *  convenience only — it is NOT a credential and NOT a session. */
export function rememberedEmail() {
  try { return localStorage.getItem(EMAIL_KEY) || ""; } catch { return ""; }
}
export function rememberEmail(email) {
  try { localStorage.setItem(EMAIL_KEY, String(email ?? "").trim()); } catch { /* storage blocked */ }
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
    // Conflict target must be the table's only unique constraint — the
    // composite primary key (user_id, product_id). user_id is filled by the
    // column DEFAULT auth.uid(), which Postgres evaluates before conflict
    // resolution, so the client sends product_id alone.
    mirror("save the favorite",
      (sb) => sb.from("favorites").upsert({ product_id: id }, { onConflict: "user_id,product_id" }).select("product_id"),
      { table: "favorites", kind: "upsert", payload: { product_id: id }, onConflict: "user_id,product_id" });
  }
  return next;
}

// ---- Designs (akv:designs — array of Design objects) -----------------------
// Design: { id, kind:'scene'|'room3d', refId, name, assignments, room?, savedAt }
function readDesigns() {
  const list = readJson(DESIGNS_KEY, []);
  return Array.isArray(list) ? list.filter((d) => d && typeof d === "object") : [];
}

// How a design flattens into the `designs` table. Every key below is a real
// column in supabase/schema.sql and every value satisfies its constraint:
//   • id is TEXT there (not uuid) precisely because it is minted client-side
//     by newId('dz') — same reasoning as products.id matching the seed file;
//   • ref_id / name / assignments are NOT NULL, so they get defaults here
//     (soba3d saves refId:null — fall back to the design kind);
//   • room is nullable jsonb; user_id is left to DEFAULT auth.uid().
// No `payload` column exists — sending one made every write fail outright.
function designRow(d) {
  return {
    id: String(d.id),
    kind: d.kind === "room3d" ? "room3d" : "scene",   // matches the CHECK constraint
    ref_id: String(d.refId ?? d.kind ?? "design"),
    name: String(d.name || "Moj dizajn"),
    assignments: d.assignments && typeof d.assignments === "object" ? d.assignments : {},
    room: d.room && typeof d.room === "object" ? d.room : null,
    saved_at: d.savedAt,
  };
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
