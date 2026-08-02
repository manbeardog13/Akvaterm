// ============================================================================
// views/dizajner.js — Stage-1 2D designer. Scene tabs, responsive letterboxed
// canvas stage, surface selection by tap OR keyboard (visible surface buttons
// + arrow keys on the stage), curated starter combinations, keramika product
// drawer with swatches, pattern / grout color / grout width segmented
// controls, a live price estimate bar (Procjena cijene), live re-render
// (<100ms via scene2d pattern caches), A/B compare (two assignment snapshots
// side by side), Spremi dizajn (db.saveDesign), Zatraži ponudu (mailto with a
// plain-text summary), share via serialized assignments in the location.hash
// query (QR panel when js/qrshare.js is present, clipboard otherwise), a
// debounced localStorage draft ("akv:diz-draft") restored on the next visit,
// a first-run coach mark, and loading of ?product= (preselect) and ?design=
// (saved design) query parameters.
//
// Selection is painted on a separate overlay canvas stacked over the scene
// canvas: switching surfaces (and the coach-mark pulse) never re-renders the
// scene, and the scene render stays untouched by UI chrome.
//
// Stage layers, bottom to top: scene canvas -> bare-room canvas (clipped by
// the before/after wipe) -> selection overlay -> wipe divider -> glass HUD ->
// coach mark.
//
// IRIS / GLASS NOTES ---------------------------------------------------------
// Colours are the pixel-sampled tokens from docs/DESIGN_SYSTEM.md, referenced
// as var(--token, <sampled hex>) so the view is correct whether or not
// css/styles.css has landed the token yet. Derived shades (--teal-700,
// the HUD glass tint) were computed, not guessed, and every text pair is
// recorded next to its rule with the measured ratio.
//
// Exactly ONE backdrop-filter surface lives in this view: the canvas HUD. The
// standing pair (top bar + tab bar) plus this HUD is the whole 3-surface
// budget, so the panels, the estimate bar and the coach mark are painted with
// opaque/tinted layers instead of blur. The HUD also drops its blur while the
// user is dragging on the stage (.is-busy), and blur is never animated.
// ============================================================================
import { SCENES } from "../../data/scenes.js";
import { renderScene, hitSurface, DESIGN_W, DESIGN_H } from "../scene2d.js";
import * as db from "../db.js";
import { t } from "../i18n.js";
import { PATTERNS, GROUT_COLORS, formatEur, pricePerRoom } from "../domain.js";
// Namespace import as well: orderEstimate() is an optional, newer domain
// helper. A named import would break this whole module if it is not there
// yet, a namespace lookup simply yields undefined (see orderEstimateFor).
import * as domain from "../domain.js";
import { swatchDataUrl } from "../texture.js";

const GROUT_WIDTHS_MM = [2, 3, 5, 8];

// Per-surface laying options handed to scene2d.js. 0/90 is the honest set for
// a rectangular tile: 180 and 270 produce an identical repeat.
const ROTATIONS_DEG = [0, 90];
// Laying offset as a fraction of one repeat cell. Only patterns whose repeat is
// a real course support it as a decision a tiler makes on site; herringbone and
// diagonal repeat on a large synthesised square where a phase shift is not a
// laying choice, so the control is disabled (not hidden) for those.
const OFFSETS = [0, 0.25, 0.5];
const OFFSET_PATTERNS = new Set(["grid", "runningBond"]);

const DRAFT_KEY = "akv:diz-draft";      // {sceneId, perScene, savedAt}
const COACH_KEY = "akv:diz-coached";    // "1" once the user selected a surface
const RESERVE_KEY = "akv:diz-reserve";  // "1"/"0" — estimate reserve toggle
const DRAFT_DEBOUNCE_MS = 400;
const QUOTE_EMAIL = "info@akvaterm.hr";
const PULSE_MS = 2000;
const WIPE_STEP = 2;                    // % per arrow key on the wipe divider

// i18n with an inline Croatian fallback so the view demos well even before
// every dictionary key lands (t() returns the key itself when missing).
const T = (key, fb) => { const v = t(key); return v === key ? fb : v; };

const SURFACE_FB = {
  "pod": "Pod",
  "zid-lijevi": "Lijevi zid",
  "zid-desni": "Desni zid",
  "zid-straznji": "Stražnji zid",
};
const SCENE_FB = {
  "kupaonica": "Kupaonica",
  "mala-kupaonica": "Mala kupaonica",
  "kuhinja": "Kuhinja",
  "dnevni-boravak": "Dnevni boravak",
  "predsoblje": "Predsoblje",
};
const PATTERN_FB = { grid: "Mreža", runningBond: "Pomaknuti slog", herringbone: "Riblja kost", diagonal: "Dijagonalno" };
const GROUT_FB = { bijela: "Bijela", siva: "Siva", antracit: "Antracit" };
const OFFSET_FB = { 0: "Bez pomaka", 0.25: "1/4 pločice", 0.5: "1/2 pločice" };
const OFFSET_SHORT = { 0: "0", 0.25: "¼", 0.5: "½" };

// ---------------------------------------------------------------------------
// Curated starter combinations — four named looks per scene, product ids from
// data/catalog.seed.json. Same shape sanitizeAssignments() accepts, so a combo
// is validated against the live catalog before it is applied.
// ---------------------------------------------------------------------------

const A = (productId, pattern, groutColorId, groutWidthMm, rotationDeg = 0, offsetPct = 0) =>
  ({ productId, pattern, groutColorId, groutWidthMm, rotationDeg, offsetPct });

const COMBOS = {
  "kupaonica": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran", surfaces: {
      "pod": A("ker-05", "grid", "bijela", 3),
      "zid-lijevi": A("ker-11", "grid", "bijela", 3),
      "zid-desni": A("ker-08", "runningBond", "bijela", 3),
    } },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton", surfaces: {
      "pod": A("ker-14", "grid", "siva", 3),
      "zid-lijevi": A("ker-12", "grid", "siva", 3),
      "zid-desni": A("ker-12", "grid", "siva", 3),
    } },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast", surfaces: {
      "pod": A("ker-03", "grid", "antracit", 2),
      "zid-lijevi": A("ker-20", "runningBond", "antracit", 3),
      "zid-desni": A("ker-20", "runningBond", "antracit", 3),
    } },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli", surfaces: {
      "pod": A("ker-15", "runningBond", "bijela", 2),
      "zid-lijevi": A("ker-08", "grid", "bijela", 2),
      "zid-desni": A("ker-01", "grid", "bijela", 2),
    } },
  ],
  // Mala kupaonica adds a fourth surface (the back wall), which is the scene's
  // point: a compact room reads best with a single accent plane facing you.
  "mala-kupaonica": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran", surfaces: {
      "pod": A("ker-05", "grid", "bijela", 3),
      "zid-lijevi": A("ker-08", "runningBond", "bijela", 2),
      "zid-desni": A("ker-08", "runningBond", "bijela", 2),
      "zid-straznji": A("ker-11", "grid", "bijela", 2),
    } },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton", surfaces: {
      "pod": A("ker-13", "grid", "siva", 3),
      "zid-lijevi": A("ker-12", "grid", "siva", 3),
      "zid-desni": A("ker-12", "grid", "siva", 3),
      "zid-straznji": A("ker-14", "grid", "siva", 3),
    } },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast", surfaces: {
      "pod": A("ker-03", "grid", "antracit", 2),
      "zid-lijevi": A("ker-20", "runningBond", "antracit", 2),
      "zid-desni": A("ker-20", "runningBond", "antracit", 2),
      "zid-straznji": A("ker-21", "runningBond", "antracit", 2, 90),
    } },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli", surfaces: {
      "pod": A("ker-15", "runningBond", "bijela", 2, 0, 0.5),
      "zid-lijevi": A("ker-08", "grid", "bijela", 2),
      "zid-desni": A("ker-08", "grid", "bijela", 2),
      "zid-straznji": A("ker-10", "grid", "bijela", 2),
    } },
  ],
  // Predsoblje: the corridor floor is the star, so every combo commits to an
  // orientation for it — planks running the length of the hall (rotation 90).
  "predsoblje": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran", surfaces: {
      "pod": A("ker-05", "grid", "bijela", 3, 90),
      "zid-lijevi": A("ker-09", "grid", "bijela", 3),
      "zid-desni": A("ker-09", "grid", "bijela", 3),
      "zid-straznji": A("ker-19", "grid", "bijela", 3),
    } },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton", surfaces: {
      "pod": A("ker-12", "grid", "siva", 3),
      "zid-lijevi": A("ker-14", "grid", "siva", 3),
      "zid-desni": A("ker-14", "grid", "siva", 3),
      "zid-straznji": A("ker-13", "grid", "siva", 3),
    } },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast", surfaces: {
      "pod": A("ker-18", "grid", "antracit", 2),
      "zid-lijevi": A("ker-01", "grid", "bijela", 2, 90),
      "zid-desni": A("ker-01", "grid", "bijela", 2, 90),
      "zid-straznji": A("ker-03", "grid", "antracit", 2),
    } },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli", surfaces: {
      "pod": A("ker-15", "runningBond", "bijela", 2, 90, 0.5),
      "zid-lijevi": A("ker-08", "grid", "bijela", 2),
      "zid-desni": A("ker-08", "grid", "bijela", 2),
      "zid-straznji": A("ker-17", "grid", "bijela", 2, 90),
    } },
  ],
  "kuhinja": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran", surfaces: {
      "pod": A("ker-05", "grid", "bijela", 3),
      "zid-lijevi": A("ker-10", "grid", "bijela", 3),
      "zid-desni": A("ker-08", "runningBond", "bijela", 3),
    } },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton", surfaces: {
      "pod": A("ker-12", "grid", "siva", 3),
      "zid-lijevi": A("ker-14", "grid", "siva", 3),
      "zid-desni": A("ker-14", "grid", "siva", 3),
    } },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast", surfaces: {
      "pod": A("ker-13", "grid", "antracit", 3),
      "zid-lijevi": A("ker-20", "runningBond", "antracit", 3),
      "zid-desni": A("ker-21", "runningBond", "antracit", 3),
    } },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli", surfaces: {
      "pod": A("ker-15", "runningBond", "bijela", 2),
      "zid-lijevi": A("ker-01", "grid", "bijela", 2),
      "zid-desni": A("ker-08", "grid", "bijela", 2),
    } },
  ],
  "dnevni-boravak": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran", surfaces: {
      "pod": A("ker-06", "grid", "bijela", 3),
      "zid-lijevi": A("ker-09", "grid", "bijela", 3),
      "zid-desni": A("ker-09", "grid", "bijela", 3),
    } },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton", surfaces: {
      "pod": A("ker-12", "grid", "siva", 3),
      "zid-lijevi": A("ker-14", "grid", "siva", 3),
      "zid-desni": A("ker-14", "grid", "siva", 3),
    } },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast", surfaces: {
      "pod": A("ker-03", "grid", "antracit", 2),
      "zid-lijevi": A("ker-01", "grid", "bijela", 2),
      "zid-desni": A("ker-01", "grid", "bijela", 2),
    } },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli", surfaces: {
      "pod": A("ker-17", "runningBond", "bijela", 2),
      "zid-lijevi": A("ker-08", "grid", "bijela", 2),
      "zid-desni": A("ker-18", "grid", "bijela", 2),
    } },
  ],
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const toast = (msg) => { if (window.AKV && window.AKV.toast) window.AKV.toast(msg); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmtM2 = (n) => `${round2(n).toFixed(2).replace(".", ",")} m²`;

// view state (reset on every render, released in teardown)
let S = null;

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

export async function render(container, params) {
  teardown();
  S = {
    container, products: [], tiles: [],
    sceneId: null, perScene: {}, selected: null,
    snapA: null, comparing: false,
    wipe: { on: false, pct: 50, dragging: false }, bareKey: "",
    reserve: readFlag(RESERVE_KEY),
    coached: readFlag(COACH_KEY),
    reducedMotion: prefersReducedMotion(),
    rafId: 0, pulseRaf: 0, pulseUntil: 0, draftTimer: 0,
    observers: [], listeners: [],
  };

  const q = hashQuery();
  let sceneId = (paramSceneId(params) || q.path[1] || "").split("?")[0];

  S.products = (await db.listProducts()) || [];
  S.tiles = S.products.filter((p) => p.category === "keramika");

  const wantsDesign = !!q.query.get("design");
  const wantsShare = !!q.query.get("a");

  // ?design= — load a saved design (scene kind only)
  if (wantsDesign) {
    const d = await db.getDesign(q.query.get("design"));
    if (d && d.kind === "scene" && sceneById(d.refId)) {
      sceneId = d.refId;
      S.perScene[sceneId] = clone(d.assignments || {});
    }
  }

  // Draft — restored only when neither ?design= nor ?a= is in play; an
  // explicit link always wins over "where you left off".
  if (!wantsDesign && !wantsShare) {
    const draftScene = restoreDraft();
    if (draftScene && !sceneId) sceneId = draftScene;
  }

  if (!sceneById(sceneId)) sceneId = SCENES[0].id;
  S.sceneId = sceneId;

  // ?a= — assignments serialized into the hash query (share links)
  if (wantsShare && !S.perScene[sceneId]) {
    try { S.perScene[sceneId] = sanitizeAssignments(JSON.parse(q.query.get("a")), sceneById(sceneId)); }
    catch (err) { /* malformed share payload -> defaults */ }
  }

  ensureAssignments(scene());
  S.selected = defaultSurfaceId(scene());

  // ?product= — preselect a tile (from "primijeni u dizajneru")
  const pre = q.query.get("product");
  const preTile = pre ? S.tiles.find((p) => p.id === pre) : null;
  if (preTile) assignments()[S.selected].productId = preTile.id;

  container.innerHTML = markup();
  wire(container);
  renderSurfaceButtons();
  renderCombos();
  syncControls();
  fitCanvas();
  scheduleRender();

  if (preTile) {
    toast(`${T("diz.applied", "Primijenjeno")}: ${preTile.name} — ${surfaceLabel(S.selected)}`);
  }
  maybeCoach();
}

export function teardown() {
  if (!S) return;
  if (S.draftTimer) { clearTimeout(S.draftTimer); S.draftTimer = 0; saveDraftNow(); }
  for (const o of S.observers) o.disconnect();
  for (const [target, type, fn] of S.listeners) target.removeEventListener(type, fn);
  if (S.rafId) cancelAnimationFrame(S.rafId);
  if (S.pulseRaf) cancelAnimationFrame(S.pulseRaf);
  S = null;
}

// ---------------------------------------------------------------------------
// state helpers
// ---------------------------------------------------------------------------

const sceneById = (id) => SCENES.find((s) => s.id === id) || null;
const scene = () => sceneById(S.sceneId);
const assignments = () => S.perScene[S.sceneId];
const current = () => assignments()[S.selected];

/** Floors first, then walls — the order used by the buttons and arrow keys. */
function orderedSurfaces(sc = scene()) {
  return sc.surfaces.slice().sort((a, b) => (a.kind === "floor" ? 0 : 1) - (b.kind === "floor" ? 0 : 1));
}

const defaultSurfaceId = (sc) => orderedSurfaces(sc)[0].id;

function ensureAssignments(sc) {
  const a = S.perScene[sc.id] || (S.perScene[sc.id] = {});
  for (const s of sc.surfaces) {
    if (!a[s.id]) {
      a[s.id] = {
        productId: validTileId(s.defaultProductId),
        pattern: (PATTERNS[0] || { id: "grid" }).id,
        groutColorId: (GROUT_COLORS[0] || { id: "bijela" }).id,
        groutWidthMm: 3,
        rotationDeg: normRotation(s.defaultRotationDeg),
        offsetPct: 0,
      };
    } else {
      // A draft or share link written before rotation/offset existed carries
      // neither field; fill them in rather than leaving them undefined.
      const e = a[s.id];
      if (e.rotationDeg === undefined) e.rotationDeg = normRotation(s.defaultRotationDeg);
      if (e.offsetPct === undefined) e.offsetPct = 0;
    }
  }
}

const normRotation = (deg) => (Number(deg) === 90 ? 90 : 0);

function normOffset(pct, pattern) {
  if (!OFFSET_PATTERNS.has(pattern)) return 0;
  const n = Number(pct);
  return OFFSETS.includes(n) ? n : 0;
}

function validTileId(id) {
  if (id && S.tiles.some((p) => p.id === id)) return id;
  return S.tiles.length ? S.tiles[0].id : null;
}

function sanitizeAssignments(raw, sc) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const s of sc.surfaces) {
    const e = raw[s.id];
    if (!e || typeof e !== "object") continue;
    const pattern = PATTERNS.some((p) => p.id === e.pattern) ? e.pattern : (PATTERNS[0] || { id: "grid" }).id;
    out[s.id] = {
      productId: validTileId(e.productId),
      pattern,
      groutColorId: GROUT_COLORS.some((g) => g.id === e.groutColorId) ? e.groutColorId : (GROUT_COLORS[0] || { id: "bijela" }).id,
      groutWidthMm: GROUT_WIDTHS_MM.includes(Number(e.groutWidthMm)) ? Number(e.groutWidthMm) : 3,
      // Rotation defaults to the surface's own hint only when the payload is
      // silent about it, so an explicit 0 in a share link stays 0.
      rotationDeg: e.rotationDeg === undefined
        ? normRotation(s.defaultRotationDeg)
        : normRotation(e.rotationDeg),
      offsetPct: normOffset(e.offsetPct, pattern),
    };
  }
  return out;
}

function hashQuery() {
  const raw = location.hash.slice(1);
  const qi = raw.indexOf("?");
  const path = (qi < 0 ? raw : raw.slice(0, qi)).split("/").filter(Boolean);
  const query = new URLSearchParams(qi < 0 ? "" : raw.slice(qi + 1));
  return { path, query };
}

// app.js calls render(main, match.m.slice(1)), so #/dizajner/:sceneId arrives
// as params[0] (the single capture group) — same convention as katalog.js.
function paramSceneId(params) {
  if (!params) return null;
  if (typeof params === "string") return params;
  if (Array.isArray(params)) return params[0] || null;
  return params.sceneId || params.id || null;
}

const sceneLabel = (sc) => T(sc.i18nKey, SCENE_FB[sc.id] || sc.id);
const surfaceLabel = (id) => T("surface." + id, SURFACE_FB[id] || id);
const patternLabel = (p) => T(p.i18nKey, PATTERN_FB[p.id] || p.id);
const groutLabel = (g) => T(g.i18nKey, GROUT_FB[g.id] || g.id);
const comboLabel = (c) => T(c.i18nKey, c.fb);
const offsetLabel = (o) => OFFSET_SHORT[o] || String(o);
const offsetTitle = (o) => T("diz.offset." + String(o), OFFSET_FB[o] || String(o));
const rotationLabel = (d) => `${d}°`;
const productById = (id) => (id ? S.products.find((p) => p.id === id) || null : null);

function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (err) { return false; }
}

// ---------------------------------------------------------------------------
// localStorage: draft, coach flag, reserve toggle (all failure-tolerant)
// ---------------------------------------------------------------------------

function readJson(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch (err) { return null; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* storage full/blocked */ }
}
function readFlag(key) {
  try { return localStorage.getItem(key) === "1"; } catch (err) { return false; }
}
function writeFlag(key, on) {
  try { localStorage.setItem(key, on ? "1" : "0"); } catch (err) { /* storage full/blocked */ }
}

/**
 * Draft contract (also read by the katalog "continue where you left off" card):
 * { sceneId, perScene:{[sceneId]:{[surfaceId]:{productId,pattern,groutColorId,
 * groutWidthMm,rotationDeg,offsetPct}}}, savedAt }
 * The two laying fields are additive: katalog.js hands the whole assignment
 * object straight to renderScene, which ignores fields it does not know.
 */
function saveDraftNow() {
  if (!S || !S.sceneId) return;
  const perScene = {};
  for (const sc of SCENES) {
    const a = S.perScene[sc.id];
    if (!a) continue;
    const clean = {};
    for (const s of sc.surfaces) {
      const e = a[s.id];
      if (!e || !e.productId) continue;
      clean[s.id] = {
        productId: e.productId,
        pattern: e.pattern,
        groutColorId: e.groutColorId,
        groutWidthMm: e.groutWidthMm,
        rotationDeg: normRotation(e.rotationDeg),
        offsetPct: normOffset(e.offsetPct, e.pattern),
      };
    }
    if (Object.keys(clean).length) perScene[sc.id] = clean;
  }
  if (!Object.keys(perScene).length) return;
  writeJson(DRAFT_KEY, { sceneId: S.sceneId, perScene, savedAt: new Date().toISOString() });
}

function scheduleDraftSave() {
  if (!S) return;
  if (S.draftTimer) clearTimeout(S.draftTimer);
  S.draftTimer = setTimeout(() => { S.draftTimer = 0; saveDraftNow(); }, DRAFT_DEBOUNCE_MS);
}

/** Returns the draft's scene id when it is usable, else null. */
function restoreDraft() {
  const d = readJson(DRAFT_KEY);
  if (!d || typeof d !== "object" || !d.perScene || typeof d.perScene !== "object") return null;
  let restored = false;
  for (const sc of SCENES) {
    const clean = sanitizeAssignments(d.perScene[sc.id], sc);
    if (Object.keys(clean).length) { S.perScene[sc.id] = clean; restored = true; }
  }
  if (!restored) return null;
  return sceneById(d.sceneId) ? d.sceneId : null;
}

// ---------------------------------------------------------------------------
// markup
// ---------------------------------------------------------------------------

function markup() {
  return `
  <style>
  /* =========================================================================
     Iris skin for the 2D designer.

     This block adds NO new palette. Every colour is a var() on a token that
     css/styles.css defines and whose ratio is recorded in its contrast ledger;
     the glass is the shipped .glass-hud recipe, not a second one. The only
     numbers written here are the ones this view had to compute for itself
     (marked "computed"), each with the pair it proves.

     GLASS BUDGET: exactly one backdrop-filter surface lives in this view — the
     canvas HUD. With the standing .topbar + .tabbar pair that is 3, the stated
     maximum. The panels, the estimate bar, the coach mark and the wipe chrome
     are therefore opaque or plain-translucent, never blurred. Blur is switched,
     never animated.
     ========================================================================= */
  .diz-root{
    --diz-r:var(--radius,22px);
    --diz-r-sm:var(--radius-sm,12px);
    --diz-pill:var(--radius-pill,999px);
    color:var(--ink);
  }

  /* ---- type ------------------------------------------------------------- */
  .diz-head{margin:0 0 16px}
  /* Anton. Croatian carons (Č Š Ž) reach 1.100em in this face, so display text
     never gets a line-height under 1.05 and never sits in a clipped box —
     hence the explicit overflow:visible and the descender padding. */
  .diz-head h1{
    font-family:var(--font-display);font-weight:400;text-transform:uppercase;
    font-size:clamp(2.1rem,7.5vw,3.1rem);letter-spacing:-.015em;line-height:1.06;
    margin:0 0 5px;padding-bottom:.06em;overflow:visible;color:var(--ink)}
  .diz-head p{margin:0;font-family:var(--font-text);font-weight:400;font-size:14px;
    line-height:1.5;color:var(--muted)}
  /* The reference's credit-line gesture: small, heavy, widely tracked, upper. */
  .diz-k{display:block;font-family:var(--font-text);font-size:11.5px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}

  /* ---- scene tabs ------------------------------------------------------- */
  .diz-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .diz-tab{min-height:var(--tap,44px);padding:11px 18px;border-radius:var(--diz-pill);
    border:1px solid var(--line-strong);background:var(--surface);cursor:pointer;
    font-family:var(--font-text);font-size:12.5px;font-weight:600;letter-spacing:.1em;
    text-transform:uppercase;color:var(--ink);white-space:nowrap}
  /* Pressed = solid --accent, so the label is --on-accent on 5.78:1 rather than
     white on a translucency. --accent-bright (the sampled iris) is only 3.20:1
     under white and appears here as the rim, never as a text ground. */
  .diz-tab[aria-pressed="true"]{background:var(--accent);border-color:transparent;
    color:var(--on-accent);box-shadow:inset 0 1px 0 var(--teal-300)}
  @media(hover:hover) and (pointer:fine){
    .diz-tab:hover{border-color:var(--accent)}
    .diz-tab[aria-pressed="true"]:hover{filter:brightness(1.08)}
  }

  /* ---- surface pills ---------------------------------------------------- */
  .diz-surfaces{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .diz-surf{min-height:var(--tap,44px);padding:9px 16px;border-radius:var(--diz-pill);
    border:1px solid var(--line-strong);background:var(--surface);cursor:pointer;
    font-family:var(--font-text);font-size:13px;font-weight:600;color:var(--ink);
    display:inline-flex;align-items:center;gap:8px}
  .diz-surf[aria-pressed="true"]{background:var(--accent);border-color:transparent;color:var(--on-accent)}

  /* ---- stage ------------------------------------------------------------ */
  .diz-stage{position:relative;width:100%;
    max-width:min(100%,max(340px,calc((100vh - 330px)*10/7)));margin:0 auto 14px;
    --diz-wipe:50%}
  .diz-cv{display:block;width:100%;aspect-ratio:${DESIGN_W}/${DESIGN_H};
    border-radius:var(--diz-r);background:var(--panel);cursor:pointer;
    touch-action:manipulation;box-shadow:var(--shadow-card)}
  .diz-bare,.diz-overlay{position:absolute;left:0;top:0;width:100%;height:100%;
    border-radius:var(--diz-r);pointer-events:none;background:none}
  .diz-bare{clip-path:inset(0 calc(100% - var(--diz-wipe)) 0 0)}
  .diz-overlay{z-index:2}
  .diz-bare[hidden],.diz-wipe[hidden],.diz-wipe-tag[hidden]{display:none}

  /* ---- before / after wipe ---------------------------------------------- */
  /* Sits BELOW the HUD (z-index 2 vs 3) so the 46px drag strip can never steal
     a tap from a HUD button when the divider happens to cross it. */
  .diz-wipe{position:absolute;top:0;bottom:0;left:var(--diz-wipe);width:46px;
    margin-left:-23px;z-index:2;cursor:ew-resize;touch-action:none;
    display:flex;align-items:center;justify-content:center}
  /* The divider is itself a light/dark pair for the same reason the selection
     outline is: --glass-solid core inside a --dark hairline stays visible over
     any tile the user picks. */
  .diz-wipe-line{position:absolute;top:10px;bottom:10px;left:50%;width:3px;margin-left:-1.5px;
    border-radius:2px;background:var(--glass-solid);
    box-shadow:0 0 0 1px var(--dark),var(--glass-shadow-1)}
  /* Opaque, not glass: it rides over unpredictable canvas pixels and the glass
     budget is already spent. --ink on --glass-solid = 12.34:1 (computed). */
  .diz-wipe-grip{position:relative;width:var(--tap,44px);height:var(--tap,44px);
    border-radius:50%;border:1px solid var(--line-strong);background:var(--glass-solid);
    color:var(--ink);display:flex;align-items:center;justify-content:center;
    font-size:16px;font-weight:700;letter-spacing:-.08em;
    box-shadow:var(--glass-shadow-2)}
  /* --paper on opaque --glass-solid-dark = 14.63:1 (computed). */
  .diz-wipe-tag{position:absolute;top:12px;z-index:2;pointer-events:none;
    background:var(--glass-solid-dark);color:var(--paper);border-radius:var(--diz-pill);
    padding:6px 12px;font-family:var(--font-text);font-size:10.5px;font-weight:700;
    letter-spacing:.12em;text-transform:uppercase;box-shadow:var(--glass-shadow-1)}
  .diz-wipe-tag.is-before{left:12px}
  .diz-wipe-tag.is-after{right:12px}

  /* ---- canvas HUD — the view's ONE glass surface ------------------------ */
  /* Recipe comes from .glass-hud in css/styles.css (dark glass, --glass-blur-sm,
     contain:paint) — this view does not define a second glass. At the shipped
     --glass-alpha-dark of .82, --paper on it measures 8.22:1 in its worst case
     (a white backdrop) and 15.56:1 over black, both re-verified here against
     the live computed style. Everything below only lays out its contents. */
  .diz-hud{position:absolute;left:10px;right:10px;bottom:10px;z-index:3;
    display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:7px 8px}
  .diz-chip{flex:1 1 auto;min-width:0;padding:0 6px;color:var(--glass-on-dark);
    font-family:var(--font-text);font-size:11.5px;font-weight:700;letter-spacing:.1em;
    text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  /* HUD buttons keep the glass itself as their ground rather than adding a
     lighter island: a translucent light pill pulls the composite UP toward the
     --paper label, and even 12% alpha already drops it to 4.23:1 (computed) —
     the fill and the text converge. So the label keeps the glass's own 8.22:1,
     and the button is identified by a rim that measures 4.64:1 against it,
     clearing the 3:1 non-text boundary rule (WCAG 1.4.11).
     That rim is the only colour literal in this block, and deliberately: it is
     --paper at 66% alpha, and no shipped on-dark line token gets near 3:1
     there (--line-dark is .14, --glass-hairline .34), so reaching for a token
     would have been a wrong reference rather than a tidier one. The coach
     mark's button uses the same value for the same reason. */
  .diz-hud-btn{position:relative;flex:none;min-height:38px;padding:9px 13px;border-radius:10px;
    border:1px solid rgba(242,242,242,.66);background:transparent;
    color:var(--glass-on-dark);font-family:var(--font-text);font-size:11.5px;
    font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;
    white-space:nowrap}
  /* 38px keeps the HUD from eating the canvas on a phone, so the 44px tap rule
     is met by extending the HIT area past the painted box — the same trick
     .glass-chip uses in css/styles.css. 38 + 4 + 4 = 46, i.e. 44 with a pixel
     of rounding slack at each edge. */
  .diz-hud-btn::before{content:"";position:absolute;inset:-4px 0;border-radius:inherit}
  .diz-hud-btn[aria-pressed="true"]{background:var(--accent);border-color:transparent;
    color:var(--on-accent)}
  /* Cost drop: while a pointer is down on the stage the HUD goes fully solid —
     blur off AND opaque, so the compositor stops reading back the canvas
     entirely for the duration of the drag. It is deliberately opaque rather
     than merely less transparent: a translucent value here would out-specify
     the reduced-transparency and forced-colours fallbacks in css/styles.css and
     hand a user who asked for no transparency a translucent panel mid-drag.
     Legibility goes UP, not down: --paper on --glass-solid-dark is 14.63:1
     against the 8.22:1 worst case of the live glass (computed). */
  .diz-stage.is-busy .diz-hud{
    backdrop-filter:none;-webkit-backdrop-filter:none;
    background-color:var(--glass-solid-dark)}

  /* ---- coach mark: the dark-glass TINT without the blur ------------------
     Deliberately not a second .glass-hud: two blurred surfaces in this view
     plus the standing top bar / tab bar pair would be four. It borrows only
     --glass-bg-dark, whose worst case (over a white backdrop) still gives
     --paper 8.22:1. */
  .diz-coach{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:5;
    width:calc(100% - 20px);max-width:390px;display:flex;align-items:center;gap:10px;
    padding:10px 10px 10px 14px;border-radius:var(--glass-radius-sm);
    background:var(--glass-bg-dark);color:var(--glass-on-dark);
    font-family:var(--font-text);font-size:12.5px;font-weight:600;line-height:1.4;
    box-shadow:var(--glass-shadow-2);pointer-events:none}
  .diz-coach[hidden]{display:none}
  .diz-coach p{margin:0;flex:1;min-width:0}
  .diz-coach button{pointer-events:auto;flex:none;min-height:var(--tap,44px);padding:8px 14px;
    border-radius:10px;border:1px solid rgba(242,242,242,.66);background:transparent;
    color:var(--glass-on-dark);font-family:var(--font-text);font-weight:700;font-size:12px;
    letter-spacing:.06em;text-transform:uppercase;cursor:pointer}

  /* ---- estimate bar — the warm half of the identity --------------------- */
  /* Opaque --surface under a --accent-2-tint wash; its darkest point is the
     tint at full strength, where --ink is 11.12:1, --muted 4.90:1 and
     --brown-800 8.60:1 (computed). No blur: see the budget note. */
  .diz-est{position:relative;border:1px solid var(--hairline);border-radius:var(--diz-r);
    padding:15px 17px;margin-bottom:14px;box-shadow:var(--shadow-card);
    background:linear-gradient(158deg,var(--accent-2-tint) 0%,transparent 62%),var(--surface)}
  .diz-est-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .diz-est-toggle{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap,44px);
    font-family:var(--font-text);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--ink)}
  .diz-est-toggle input{width:20px;height:20px;accent-color:var(--accent);cursor:pointer}
  .diz-est-rows{list-style:none;margin:2px 0 0;padding:0}
  .diz-est-rows li{display:flex;gap:10px;align-items:baseline;justify-content:space-between;
    padding:8px 0;border-bottom:1px solid var(--hairline);font-size:13px}
  .diz-est-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .diz-est-area{flex:none;color:var(--muted);font-size:11.5px;white-space:nowrap;
    font-variant-numeric:tabular-nums}
  .diz-est-sub{flex:none;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .diz-est-total{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding-top:12px}
  .diz-est-total span{font-family:var(--font-text);font-size:11.5px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  /* Anton on the total. Same metric rule as the h1: line-height 1.06, room for
     the descender, nothing clipping it. */
  .diz-est-total b{font-family:var(--font-display);font-weight:400;font-size:27px;
    line-height:1.06;letter-spacing:-.01em;color:var(--brown-800);
    font-variant-numeric:tabular-nums;padding-bottom:.04em}
  .diz-est-note{margin:9px 0 0;font-size:11.5px;line-height:1.45;color:var(--muted)}

  /* ---- control panel ---------------------------------------------------- */
  /* Cool half: --accent-tint over --surface. Darkest point --ink 11.41:1,
     --muted 5.02:1, --accent 5.07:1 (computed). */
  .diz-panel{border:1px solid var(--hairline);border-radius:var(--diz-r);padding:17px;
    box-shadow:var(--shadow-card);
    background:linear-gradient(152deg,var(--accent-tint) 0%,transparent 58%),var(--surface)}
  .diz-row{margin-bottom:17px}
  .diz-row:last-of-type{margin-bottom:12px}
  .diz-hint{margin:7px 0 0;font-size:11.5px;line-height:1.45;color:var(--muted)}

  /* ---- product drawer --------------------------------------------------- */
  .diz-drawer{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 10px;-webkit-overflow-scrolling:touch}
  .diz-sw{flex:0 0 auto;width:88px;min-height:var(--tap,44px);border:2px solid transparent;
    border-radius:var(--diz-r-sm);background:none;padding:5px;font:inherit;cursor:pointer;
    text-align:center;color:var(--ink)}
  .diz-sw[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-tint)}
  .diz-sw img,.diz-sw .diz-flat{width:78px;height:58px;border-radius:9px;display:block;
    object-fit:cover;box-shadow:inset 0 0 0 1px var(--line-strong)}
  .diz-sw small{display:block;font-size:11px;line-height:1.3;margin-top:5px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .diz-sw .diz-price{color:var(--muted);font-size:10px;letter-spacing:.03em}

  /* ---- curated combinations --------------------------------------------- */
  .diz-combos{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 10px;-webkit-overflow-scrolling:touch}
  .diz-combo{flex:0 0 auto;min-width:132px;min-height:var(--tap,44px);border:2px solid transparent;
    border-radius:var(--diz-r-sm);background:none;padding:7px 6px;font:inherit;cursor:pointer;
    color:var(--ink);text-align:center}
  .diz-combo[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-tint)}
  .diz-combo .diz-combo-sw{display:flex;gap:3px;justify-content:center}
  .diz-combo img,.diz-combo .diz-flat{width:26px;height:40px;border-radius:6px;display:block;
    object-fit:cover;box-shadow:inset 0 0 0 1px var(--line-strong)}
  .diz-combo small{display:block;margin-top:8px;font-family:var(--font-text);font-size:10px;
    font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:1.35}

  /* ---- segmented controls ----------------------------------------------- */
  .diz-seg{display:flex;gap:6px;flex-wrap:wrap}
  .diz-seg button{min-height:var(--tap,44px);padding:9px 15px;border-radius:var(--diz-pill);
    border:1px solid var(--line-strong);background:var(--surface);cursor:pointer;
    font-family:var(--font-text);font-size:12.5px;font-weight:600;color:var(--ink);
    display:inline-flex;align-items:center;gap:8px}
  .diz-seg button[aria-pressed="true"]{background:var(--accent);border-color:transparent;
    color:var(--on-accent);box-shadow:inset 0 1px 0 var(--teal-300)}
  /* Disabled controls are exempt from 1.4.3; .55 still measures 3.28:1. */
  .diz-seg button:disabled{opacity:.55;cursor:default}
  .diz-dot{width:18px;height:18px;border-radius:50%;display:inline-block;
    box-shadow:inset 0 0 0 1px var(--line-strong)}

  /* ---- actions ----------------------------------------------------------- */
  .diz-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px}
  .diz-actions input{min-height:var(--tap,44px);padding:10px 15px;border-radius:var(--diz-pill);
    border:1px solid var(--line-input);font:inherit;font-size:15px;flex:1 1 170px;min-width:140px;
    background:var(--surface);color:var(--ink)}
  .diz-actions input::placeholder{color:var(--muted)}
  .diz-btn{min-height:var(--tap,44px);padding:11px 19px;border-radius:var(--diz-pill);
    border:1px solid var(--line-strong);background:var(--surface);cursor:pointer;
    font-family:var(--font-text);font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--ink)}
  .diz-btn.is-primary{background:var(--accent);border-color:transparent;color:var(--on-accent);
    box-shadow:inset 0 1px 0 var(--teal-300),0 8px 18px -10px var(--accent-ring)}
  .diz-btn:disabled{opacity:.55;cursor:default}
  @media(hover:hover) and (pointer:fine){
    .diz-btn:hover{border-color:var(--accent)}
    .diz-btn.is-primary:hover{filter:brightness(1.08)}
  }

  /* ---- A/B compare ------------------------------------------------------- */
  .diz-compare{display:none;margin-bottom:14px}
  .diz-compare.is-open{display:block}
  .diz-cmp-grid{display:flex;gap:12px;flex-wrap:wrap}
  .diz-cmp-cell{flex:1 1 300px;min-width:260px}
  .diz-cmp-cell canvas{display:block;width:100%;aspect-ratio:${DESIGN_W}/${DESIGN_H};
    border-radius:var(--diz-r-sm);background:var(--panel);box-shadow:var(--shadow-card)}
  .diz-cmp-cell .diz-k{margin:9px 0 0;text-align:center}

  /* ---- focus -------------------------------------------------------------- */
  .diz-root :focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:6px}

  /* =========================================================================
     DEGRADATION. The HUD carries .glass-hud, and css/styles.css already ships
     all four paths for that class — including the html[data-transparency]
     escape hatches behind the "Smanji prozirnost" toggle in the Više menu. So
     nothing below re-states the HUD: duplicating it here would out-specify
     that contract and break the user's explicit "keep the glass" choice.
     What IS here is this view's own chrome, which css/styles.css cannot know
     about: the coach mark (the only other translucent surface), the wipe
     furniture, the two tinted panels and the control set.
     ========================================================================= */

  /* Path 1 — engine cannot do backdrop-filter: nothing to do. The coach mark,
     the wipe chrome and both panels are opaque or plainly translucent by
     construction; none of them ever asked for a blur. */

  /* Path 2 — reduced transparency, mirroring the same two triggers (OS hint
     and manual toggle) css/styles.css uses, so the coach mark follows the
     user's choice instead of only the OS one. */
  @media (prefers-reduced-transparency:reduce){
    html:not([data-transparency="full"]) .diz-coach{background:var(--dark)}
  }
  html[data-transparency="reduced"] .diz-coach{background:var(--dark)}

  /* Path 3 — high contrast: lift every secondary tier to --ink, thicken the
     control boundaries, drop the panel washes to flat --surface. */
  @media (prefers-contrast:more){
    .diz-coach{background:var(--dark)}
    .diz-head p,.diz-k,.diz-hint,.diz-est-note,.diz-est-area,.diz-sw .diz-price,
    .diz-est-total span{color:var(--ink)}
    .diz-tab,.diz-surf,.diz-seg button,.diz-btn,.diz-hud-btn,.diz-wipe-grip{border-width:2px}
    .diz-est-rows li{border-bottom-color:var(--line-strong)}
    .diz-est,.diz-panel{background:var(--surface);border-color:var(--ink)}
  }
  /* Path 3b — forced colours. .glass-hud is already handled upstream; these are
     this view's own surfaces. */
  @media (forced-colors:active){
    .diz-coach,.diz-wipe-tag,.diz-wipe-grip{
      background:Canvas;color:CanvasText;border:1px solid CanvasText;
      backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none}
    .diz-wipe-line{background:CanvasText;box-shadow:none}
    .diz-tab,.diz-surf,.diz-seg button,.diz-btn,.diz-hud-btn{
      border:1px solid ButtonText;background:ButtonFace;color:ButtonText;box-shadow:none}
    .diz-tab[aria-pressed="true"],.diz-surf[aria-pressed="true"],
    .diz-seg button[aria-pressed="true"],.diz-hud-btn[aria-pressed="true"],
    .diz-btn.is-primary{background:Highlight;color:HighlightText;forced-color-adjust:none}
    .diz-sw[aria-pressed="true"],.diz-combo[aria-pressed="true"]{outline:3px solid Highlight}
    .diz-est,.diz-panel{background:Canvas;border-color:CanvasText}
  }
  /* Path 4 — reduced motion. Nothing here animates blur(); these are the
     colour/border transitions on the controls and the coach-mark pulse (which
     js/views/dizajner.js also skips in JS via prefersReducedMotion()). */
  @media (prefers-reduced-motion:no-preference){
    .diz-tab,.diz-surf,.diz-seg button,.diz-btn,.diz-hud-btn,.diz-sw,.diz-combo{
      transition:background-color var(--dur,200ms) var(--glass-ease,ease),
                 border-color var(--dur,200ms) var(--glass-ease,ease),
                 color var(--dur,200ms) var(--glass-ease,ease),
                 filter var(--dur,200ms) var(--glass-ease,ease)}
  }
  @media (prefers-reduced-motion:reduce){
    .diz-root *,.diz-root *::before,.diz-root *::after{transition:none!important;animation:none!important}
  }
  </style>
  <div class="diz-root">
  <header class="diz-head">
    <h1>${esc(T("diz.title", "Dizajner"))}</h1>
    <p>${esc(T("designer.pickSurface", "Dodirnite površinu, zatim odaberite proizvod"))}</p>
  </header>
  <div class="diz-tabs" id="dizTabs" role="group" aria-label="${esc(T("diz.scenesA11y", "Prostorije"))}">
    ${SCENES.map((sc) => `
      <button class="diz-tab" type="button" data-scene="${esc(sc.id)}" aria-pressed="${sc.id === S.sceneId}">${esc(sceneLabel(sc))}</button>
    `).join("")}
  </div>
  <div class="diz-surfaces" id="dizSurfaces" role="group" aria-label="${esc(T("diz.surfacesA11y", "Površine u prostoriji"))}"></div>
  <div class="diz-compare" id="dizCompare">
    <div class="diz-cmp-grid">
      <div class="diz-cmp-cell"><canvas id="dizCvA"></canvas><span class="diz-k">${esc(T("diz.aLabel", "Verzija A"))}</span></div>
      <div class="diz-cmp-cell"><canvas id="dizCvB"></canvas><span class="diz-k">${esc(T("diz.bLabel", "Trenutna verzija (B)"))}</span></div>
    </div>
  </div>
  <div class="diz-stage" id="dizStage">
    <canvas class="diz-cv" id="dizCanvas" role="img" tabindex="0"
      aria-label="${esc(T("diz.canvasAlt", "Ilustracija prostorije"))}"></canvas>
    <canvas class="diz-bare" id="dizBare" aria-hidden="true" hidden></canvas>
    <canvas class="diz-overlay" id="dizOverlay" aria-hidden="true"></canvas>
    <span class="diz-wipe-tag is-before" id="dizWipeBefore" hidden>${esc(T("diz.before", "Prije"))}</span>
    <span class="diz-wipe-tag is-after" id="dizWipeAfter" hidden>${esc(T("diz.after", "Poslije"))}</span>
    <div class="diz-wipe" id="dizWipe" hidden>
      <span class="diz-wipe-line"></span>
      <span class="diz-wipe-grip" id="dizWipeGrip" role="slider" tabindex="0"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"
        aria-label="${esc(T("diz.wipeA11y", "Klizač usporedbe prije i poslije"))}">&#8942;</span>
    </div>
    <div class="diz-hud glass-hud" id="dizHud">
      <span class="diz-chip" id="dizChip"></span>
      <button class="diz-hud-btn" type="button" id="dizHudRotate" aria-pressed="false"
        title="${esc(T("diz.rotateHint", "Zakreni pločice za 90°"))}">90&deg;</button>
      <button class="diz-hud-btn" type="button" id="dizHudWipe" aria-pressed="false">${esc(T("diz.wipe", "Prije/poslije"))}</button>
    </div>
    <div class="diz-coach" id="dizCoach" hidden>
      <p>${esc(T("designer.pickSurface", "Dodirnite površinu, zatim odaberite proizvod"))}</p>
      <button type="button" id="dizCoachOk">${esc(T("diz.coachOk", "U redu"))}</button>
    </div>
  </div>
  <section class="diz-est" id="dizEst" aria-labelledby="dizEstK">
    <div class="diz-est-head">
      <span class="diz-k" id="dizEstK" style="margin:0">${esc(T("designer.estimate", "Procjena cijene"))}</span>
      <label class="diz-est-toggle">
        <input type="checkbox" id="dizReserve" ${S.reserve ? "checked" : ""}>
        ${esc(T("diz.reserve", "+10% rezerve"))}
      </label>
    </div>
    <ul class="diz-est-rows" id="dizEstRows"></ul>
    <div class="diz-est-total">
      <span>${esc(T("diz.total", "Ukupno"))}</span>
      <b id="dizEstTotal" aria-live="polite"></b>
    </div>
    <p class="diz-est-note">${esc(T("diz.estNote", "Informativna procjena po demo cijenama — bez ugradnje, ljepila i fuge."))}</p>
  </section>
  <div class="diz-panel">
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.combos", "Gotove kombinacije"))}</span>
      <div class="diz-combos" id="dizCombos" role="group" aria-label="${esc(T("diz.combos", "Gotove kombinacije"))}"></div>
    </div>
    <div class="diz-row">
      <span class="diz-k" id="dizSurfK"></span>
      <div class="diz-drawer" id="dizDrawer" role="group" aria-label="${esc(T("diz.products", "Pločice"))}">${drawerMarkup()}</div>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.pattern", "Uzorak polaganja"))}</span>
      <div class="diz-seg" id="dizPatterns" role="group" aria-label="${esc(T("diz.pattern", "Uzorak polaganja"))}">
        ${PATTERNS.map((p) => `<button type="button" data-pattern="${esc(p.id)}" aria-pressed="false">${esc(patternLabel(p))}</button>`).join("")}
      </div>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.rotation", "Rotacija pločice"))}</span>
      <div class="diz-seg" id="dizRotation" role="group" aria-label="${esc(T("diz.rotation", "Rotacija pločice"))}">
        ${ROTATIONS_DEG.map((d) => `<button type="button" data-rotation="${d}" aria-pressed="false">${d}&deg;</button>`).join("")}
      </div>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.offset", "Pomak slaganja"))}</span>
      <div class="diz-seg" id="dizOffset" role="group" aria-label="${esc(T("diz.offset", "Pomak slaganja"))}">
        ${OFFSETS.map((o) => `<button type="button" data-offset="${o}" aria-pressed="false">${esc(offsetLabel(o))}</button>`).join("")}
      </div>
      <p class="diz-hint" id="dizOffsetHint" hidden>${esc(T("diz.offsetNa", "Pomak se ne primjenjuje na riblju kost i dijagonalu."))}</p>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.grout", "Boja fuge"))}</span>
      <div class="diz-seg" id="dizGrout" role="group" aria-label="${esc(T("diz.grout", "Boja fuge"))}">
        ${GROUT_COLORS.map((g) => `
          <button type="button" data-grout="${esc(g.id)}" aria-pressed="false"><span class="diz-dot" style="background:${esc(g.hex)}"></span>${esc(groutLabel(g))}</button>
        `).join("")}
      </div>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.groutWidth", "Širina fuge"))}</span>
      <div class="diz-seg" id="dizGroutW" role="group" aria-label="${esc(T("diz.groutWidth", "Širina fuge"))}">
        ${GROUT_WIDTHS_MM.map((mm) => `<button type="button" data-groutw="${mm}" aria-pressed="false">${mm} mm</button>`).join("")}
      </div>
    </div>
    <div class="diz-actions">
      <button class="diz-btn" type="button" id="dizSetA">${esc(T("diz.setA", "Zapamti ovu verziju (A)"))}</button>
      <button class="diz-btn" type="button" id="dizCompareBtn" disabled
        title="${esc(T("diz.compareHint", "Najprije zapamtite verziju A"))}">${esc(T("diz.compare", "Usporedi s verzijom A"))}</button>
      <input id="dizName" placeholder="${esc(T("diz.namePlaceholder", "Naziv dizajna"))}" maxlength="60"
        aria-label="${esc(T("diz.nameA11y", "Naziv dizajna"))}">
      <button class="diz-btn is-primary" type="button" id="dizSave">${esc(T("diz.save", "Spremi dizajn"))}</button>
      <button class="diz-btn" type="button" id="dizQuote">${esc(T("diz.quote", "Zatraži ponudu"))}</button>
      <button class="diz-btn" type="button" id="dizShare">${esc(T("diz.share", "Podijeli"))}</button>
    </div>
  </div>
  </div>`;
}

function drawerMarkup() {
  if (!S.tiles.length) {
    return `<p style="font-size:13px;color:var(--muted,#63676f)">${esc(T("diz.noProducts", "Katalog pločica nije dostupan."))}</p>`;
  }
  return S.tiles.map((p) => {
    const size = p.tileSizeMm ? `${p.tileSizeMm[0]}×${p.tileSizeMm[1]}` : "";
    const price = p.priceM2 != null ? `${formatEur(p.priceM2)}/m²` : "";
    return `
      <button class="diz-sw" type="button" data-product="${esc(p.id)}" aria-pressed="false" title="${esc(p.name)}">
        ${swatchMarkup(p, 128)}
        <small>${esc(p.name)}</small>
        <small class="diz-price">${esc([size, price].filter(Boolean).join(" · "))}</small>
      </button>`;
  }).join("");
}

function swatchMarkup(product, sizePx) {
  let sw = "";
  try { sw = product ? swatchDataUrl(product, sizePx) : ""; } catch (err) { sw = ""; }
  return sw
    ? `<img src="${sw}" alt="">`
    : `<span class="diz-flat" style="background:${esc((product && product.baseColorHex) || "#ccc")}"></span>`;
}

function surfaceButtonsMarkup() {
  return orderedSurfaces().map((s) => `
    <button class="diz-surf" type="button" data-surface="${esc(s.id)}" aria-pressed="false">${esc(surfaceLabel(s.id))}</button>
  `).join("");
}

function combosMarkup() {
  const list = COMBOS[S.sceneId] || [];
  if (!list.length) return "";
  return list.map((c) => {
    // One thumb per surface: the new scenes have four, and a combo that only
    // showed three would hide the accent wall that is the point of the look.
    const ids = orderedSurfaces().map((s) => (c.surfaces[s.id] || {}).productId);
    const thumbs = ids.slice(0, 4).map((id) => swatchMarkup(productById(id), 64)).join("");
    return `
      <button class="diz-combo" type="button" data-combo="${esc(c.id)}" aria-pressed="false">
        <span class="diz-combo-sw">${thumbs}</span>
        <small>${esc(comboLabel(c))}</small>
      </button>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------------

function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  S.listeners.push([target, type, fn]);
}

function wire(container) {
  const $ = (sel) => container.querySelector(sel);
  S.canvas = $("#dizCanvas");
  S.overlay = $("#dizOverlay");
  S.cvA = $("#dizCvA");
  S.cvB = $("#dizCvB");
  S.el = {
    tabs: $("#dizTabs"), surfaces: $("#dizSurfaces"), chip: $("#dizChip"), surfK: $("#dizSurfK"),
    combos: $("#dizCombos"), drawer: $("#dizDrawer"), patterns: $("#dizPatterns"), grout: $("#dizGrout"),
    groutW: $("#dizGroutW"), compare: $("#dizCompare"), compareBtn: $("#dizCompareBtn"),
    setA: $("#dizSetA"), save: $("#dizSave"), quote: $("#dizQuote"), share: $("#dizShare"),
    name: $("#dizName"), stage: $("#dizStage"), coach: $("#dizCoach"), coachOk: $("#dizCoachOk"),
    estRows: $("#dizEstRows"), estTotal: $("#dizEstTotal"), reserve: $("#dizReserve"),
    rotation: $("#dizRotation"), offset: $("#dizOffset"), offsetHint: $("#dizOffsetHint"),
    hudRotate: $("#dizHudRotate"), hudWipe: $("#dizHudWipe"),
    bare: $("#dizBare"), wipe: $("#dizWipe"), wipeGrip: $("#dizWipeGrip"),
    wipeBefore: $("#dizWipeBefore"), wipeAfter: $("#dizWipeAfter"),
  };
  for (const b of S.el.offset.querySelectorAll("[data-offset]")) {
    b.title = offsetTitle(Number(b.dataset.offset));
  }

  on(S.el.tabs, "click", (e) => {
    const btn = e.target.closest("[data-scene]");
    if (!btn || btn.dataset.scene === S.sceneId) return;
    S.sceneId = btn.dataset.scene;
    ensureAssignments(scene());
    S.selected = defaultSurfaceId(scene());
    S.bareKey = "";                      // the "prije" half belongs to a scene
    history.replaceState(null, "", location.pathname + location.search + "#/dizajner/" + S.sceneId);
    for (const b of S.el.tabs.querySelectorAll("[data-scene]")) {
      b.setAttribute("aria-pressed", String(b.dataset.scene === S.sceneId));
    }
    renderSurfaceButtons();
    renderCombos();
    syncControls();
    scheduleDraftSave();
    scheduleRender();
  });

  on(S.el.surfaces, "click", (e) => {
    const btn = e.target.closest("[data-surface]");
    if (!btn) return;
    selectSurface(btn.dataset.surface);
  });

  on(S.canvas, "click", (e) => {
    const r = S.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * DESIGN_W;
    const y = ((e.clientY - r.top) / r.height) * DESIGN_H;
    const id = hitSurface(scene(), x, y);
    if (id) selectSurface(id);
  });

  // Keyboard access to the stage: arrows cycle the scene's surfaces so the
  // walls are reachable without a pointer (WCAG 2.1.1).
  on(S.canvas, "keydown", (e) => {
    const list = orderedSurfaces();
    const i = Math.max(0, list.findIndex((s) => s.id === S.selected));
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % list.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + list.length) % list.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    if (next < 0) return;
    e.preventDefault();
    selectSurface(list[next].id);
  });

  on(S.el.combos, "click", (e) => {
    const btn = e.target.closest("[data-combo]");
    if (!btn) return;
    applyCombo(btn.dataset.combo);
  });

  on(S.el.drawer, "click", (e) => {
    const btn = e.target.closest("[data-product]");
    if (!btn || !current()) return;
    current().productId = btn.dataset.product;
    afterChange();
  });
  on(S.el.patterns, "click", (e) => {
    const btn = e.target.closest("[data-pattern]");
    if (!btn || !current()) return;
    current().pattern = btn.dataset.pattern;
    // A pattern with no meaningful laying phase drops the offset rather than
    // keeping a value the renderer would silently ignore.
    current().offsetPct = normOffset(current().offsetPct, current().pattern);
    afterChange();
  });
  on(S.el.rotation, "click", (e) => {
    const btn = e.target.closest("[data-rotation]");
    if (!btn || !current()) return;
    current().rotationDeg = normRotation(btn.dataset.rotation);
    afterChange();
  });
  on(S.el.offset, "click", (e) => {
    const btn = e.target.closest("[data-offset]");
    if (!btn || btn.disabled || !current()) return;
    current().offsetPct = normOffset(btn.dataset.offset, current().pattern);
    afterChange();
  });
  on(S.el.hudRotate, "click", () => {
    if (!current()) return;
    current().rotationDeg = current().rotationDeg === 90 ? 0 : 90;
    afterChange();
  });
  on(S.el.grout, "click", (e) => {
    const btn = e.target.closest("[data-grout]");
    if (!btn || !current()) return;
    current().groutColorId = btn.dataset.grout;
    afterChange();
  });
  on(S.el.groutW, "click", (e) => {
    const btn = e.target.closest("[data-groutw]");
    if (!btn || !current()) return;
    current().groutWidthMm = Number(btn.dataset.groutw);
    afterChange();
  });

  on(S.el.reserve, "change", () => {
    S.reserve = !!S.el.reserve.checked;
    writeFlag(RESERVE_KEY, S.reserve);
    syncControls();   // the drawer heading carries the same per-surface subtotal
  });

  on(S.el.coachOk, "click", () => dismissCoach());

  // --- before/after wipe -----------------------------------------------
  on(S.el.hudWipe, "click", () => setWipe(!S.wipe.on));

  const wipeFromEvent = (clientX) => {
    const r = S.el.stage.getBoundingClientRect();
    if (!r.width) return;
    S.wipe.pct = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    applyWipe();
  };
  on(S.el.wipe, "pointerdown", (e) => {
    e.preventDefault();
    setBusy(true);
    S.wipe.dragging = true;
    try { S.el.wipe.setPointerCapture(e.pointerId); } catch (err) { /* not captured -> window fallback */ }
    wipeFromEvent(e.clientX);
  });
  on(S.el.wipe, "pointermove", (e) => { if (S.wipe.dragging) wipeFromEvent(e.clientX); });
  const endWipeDrag = (e) => {
    if (!S || !S.wipe.dragging) return;
    S.wipe.dragging = false;
    setBusy(false);
    try { if (e && e.pointerId != null) S.el.wipe.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
  };
  on(S.el.wipe, "pointerup", endWipeDrag);
  on(S.el.wipe, "pointercancel", endWipeDrag);
  on(S.el.wipeGrip, "keydown", (e) => {
    let next = S.wipe.pct;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next += WIPE_STEP;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next -= WIPE_STEP;
    else if (e.key === "PageUp") next += WIPE_STEP * 5;
    else if (e.key === "PageDown") next -= WIPE_STEP * 5;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 100;
    else return;
    e.preventDefault();
    e.stopPropagation();
    S.wipe.pct = Math.max(0, Math.min(100, next));
    applyWipe();
  });

  // Dragging or tapping on the stage is the moment the blur costs the most,
  // so the HUD drops it for the duration (never animated, just switched).
  on(S.canvas, "pointerdown", () => setBusy(true));
  on(window, "pointerup", () => setBusy(false));
  on(window, "pointercancel", () => setBusy(false));

  on(S.el.setA, "click", () => {
    S.snapA = { sceneId: S.sceneId, assignments: clone(assignments()) };
    S.el.compareBtn.disabled = false;
    S.el.compareBtn.removeAttribute("title");
    toast(T("diz.snapSet", "Verzija A zapamćena"));
  });

  on(S.el.compareBtn, "click", () => {
    S.comparing = !S.comparing;
    S.el.compare.classList.toggle("is-open", S.comparing);
    S.el.compareBtn.setAttribute("aria-expanded", String(S.comparing));
    S.el.compareBtn.textContent = S.comparing
      ? T("diz.closeCompare", "Zatvori usporedbu")
      : T("diz.compare", "Usporedi s verzijom A");
    if (S.comparing) {
      fitCompare();
      // The compare grid sits above the stage; without this the button looks
      // like it did nothing on a scrolled-down page. Read the geometry first:
      // that forces the layout AND the browser's scroll-anchoring adjustment
      // (which otherwise scrolls the page down by the panel's height) to
      // settle, so scrollIntoView aims at the panel's final position.
      void S.el.compare.getBoundingClientRect();
      S.el.compare.scrollIntoView({ behavior: S.reducedMotion ? "auto" : "smooth", block: "start" });
    }
    scheduleRender();
  });

  on(S.el.save, "click", async () => {
    const name = S.el.name.value.trim() ||
      `${sceneLabel(scene())} — ${new Date().toLocaleDateString("hr-HR")}`;
    await db.saveDesign({ kind: "scene", refId: S.sceneId, name, assignments: clone(assignments()) });
    toast(T("diz.saved", "Dizajn spremljen"));
  });

  on(S.el.quote, "click", () => {
    const subject = `${T("diz.quoteSubject", "Upit za ponudu")} — ${sceneLabel(scene())}`;
    const body = quoteBody();
    location.href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast(T("diz.quoteSent", "Otvaramo e-poštu s vašim dizajnom"));
  });

  on(S.el.share, "click", async () => {
    const url = shareUrl();
    history.replaceState(null, "", url);
    // Optional QR panel (js/qrshare.js). Missing module -> clipboard as before.
    try {
      const mod = await import("../qrshare.js");
      if (mod && typeof mod.openSharePanel === "function") {
        await mod.openSharePanel(url, {
          title: T("diz.share", "Podijeli"),
          text: `${T("diz.shareText", "Dizajn")} — ${sceneLabel(scene())}`,
        });
        return;
      }
    } catch (err) { /* qrshare.js not shipped (yet) -> clipboard fallback */ }
    try {
      await navigator.clipboard.writeText(url);
      toast(T("diz.shareCopied", "Poveznica kopirana"));
    } catch (err) {
      window.prompt(T("diz.shareManual", "Kopiraj poveznicu:"), url);
    }
  });

  const flush = () => { if (S && S.draftTimer) { clearTimeout(S.draftTimer); S.draftTimer = 0; } saveDraftNow(); };
  on(window, "pagehide", flush);
  on(document, "visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

  const ro = new ResizeObserver(() => {
    fitCanvas();
    if (S.comparing) fitCompare();
    if (S.wipe.on) { sizeToElement(S.el.bare); S.bareKey = ""; }
    scheduleRender();
  });
  ro.observe(S.el.stage);
  S.observers.push(ro);
}

/** Toggle the "pointer is down on the stage" state that drops the HUD blur. */
function setBusy(on) {
  if (!S || !S.el || !S.el.stage) return;
  if (!on && S.wipe.dragging) return;    // a captured wipe drag is still going
  S.el.stage.classList.toggle("is-busy", !!on);
}

function setWipe(on) {
  if (!S) return;
  S.wipe.on = !!on;
  S.el.hudWipe.setAttribute("aria-pressed", String(S.wipe.on));
  S.el.bare.hidden = !S.wipe.on;
  S.el.wipe.hidden = !S.wipe.on;
  S.el.wipeBefore.hidden = !S.wipe.on;
  S.el.wipeAfter.hidden = !S.wipe.on;
  if (S.wipe.on) {
    sizeToElement(S.el.bare);
    renderBare();
    applyWipe();
    S.el.wipeGrip.focus({ preventScroll: true });
  } else {
    setBusy(false);
  }
}

/** Position the divider and mirror it into the slider's accessible value. */
function applyWipe() {
  if (!S || !S.wipe.on) return;
  const pct = Math.round(S.wipe.pct);
  S.el.stage.style.setProperty("--diz-wipe", pct + "%");
  S.el.wipeGrip.setAttribute("aria-valuenow", String(pct));
  S.el.wipeGrip.setAttribute("aria-valuetext",
    `${T("diz.before", "Prije")} ${pct}% / ${T("diz.after", "Poslije")} ${100 - pct}%`);
}

/**
 * The "prije" half: the same scene with NO assignments, which makes every
 * surface fall through to its bare-plaster gradient. Rendered only when the
 * wipe is open and only when the scene or the canvas size actually changed —
 * dragging the divider is pure CSS clip-path and repaints nothing.
 */
function renderBare() {
  if (!S || !S.wipe.on || !S.el.bare || !S.el.bare.width) return;
  const key = `${S.sceneId}|${S.el.bare.width}x${S.el.bare.height}`;
  if (S.bareKey === key) return;
  renderScene(S.el.bare, scene(), {}, S.products);
  S.bareKey = key;
}

/** A control changed the current surface: repaint, resync, persist. */
function afterChange() {
  syncControls();
  scheduleDraftSave();
  scheduleRender();
}

function selectSurface(id) {
  if (!S || !assignments()[id]) return;
  S.selected = id;
  markCoached();
  syncControls();
  paintSelection();
}

function applyCombo(comboId) {
  const combo = (COMBOS[S.sceneId] || []).find((c) => c.id === comboId);
  if (!combo) return;
  S.perScene[S.sceneId] = sanitizeAssignments(combo.surfaces, scene());
  ensureAssignments(scene());
  if (!assignments()[S.selected]) S.selected = defaultSurfaceId(scene());
  syncControls();
  scheduleDraftSave();
  scheduleRender();
  toast(`${T("diz.comboApplied", "Kombinacija primijenjena")}: ${comboLabel(combo)}`);
}

function renderSurfaceButtons() {
  S.el.surfaces.innerHTML = surfaceButtonsMarkup();
}

function renderCombos() {
  S.el.combos.innerHTML = combosMarkup();
}

// ---------------------------------------------------------------------------
// coach mark (first run only)
// ---------------------------------------------------------------------------

function maybeCoach() {
  if (!S || S.coached) return;
  S.el.coach.hidden = false;
  if (S.reducedMotion) return;
  S.pulseUntil = performance.now() + PULSE_MS;
  pulseLoop();
}

function pulseLoop() {
  if (!S || !S.pulseUntil) return;
  paintSelection();
  if (performance.now() < S.pulseUntil) {
    S.pulseRaf = requestAnimationFrame(pulseLoop);
  } else {
    S.pulseRaf = 0;
    S.pulseUntil = 0;
    paintSelection();
  }
}

function markCoached() {
  if (!S || S.coached) return;
  S.coached = true;
  writeFlag(COACH_KEY, true);
  dismissCoach();
}

function dismissCoach() {
  if (!S) return;
  S.coached = true;
  writeFlag(COACH_KEY, true);
  S.el.coach.hidden = true;
  if (S.pulseRaf) { cancelAnimationFrame(S.pulseRaf); S.pulseRaf = 0; }
  S.pulseUntil = 0;
  paintSelection();
}

// ---------------------------------------------------------------------------
// price estimate
// ---------------------------------------------------------------------------

/**
 * Per-surface order estimate. Prefers domain.orderEstimate(product, areaM2,
 * pattern) when that helper exists; otherwise falls back to the same rule the
 * advisor FAQ teaches: +10% reserve, +15% for herringbone/diagonal cuts.
 */
function orderEstimateFor(product, surf, entry) {
  const areaM2 = round2((surf.realSizeM[0] || 0) * (surf.realSizeM[1] || 0));
  const pattern = entry ? entry.pattern : "grid";
  let reservePct = (pattern === "herringbone" || pattern === "diagonal") ? 15 : 10;
  let totalM2 = round2(areaM2 * (1 + reservePct / 100));
  try {
    const est = typeof domain.orderEstimate === "function"
      ? domain.orderEstimate(product, areaM2, pattern)
      : null;
    if (est) {
      if (Number.isFinite(Number(est.reservePct))) reservePct = Number(est.reservePct);
      if (Number.isFinite(Number(est.totalM2))) totalM2 = round2(est.totalM2);
    }
  } catch (err) { /* helper may land later — local fallback stands */ }
  return { areaM2, reservePct, totalM2 };
}

function estimateRows() {
  const a = assignments();
  return orderedSurfaces().map((surf) => {
    const entry = a[surf.id] || null;
    const product = productById(entry && entry.productId);
    const est = orderEstimateFor(product, surf, entry);
    const billedM2 = S.reserve ? est.totalM2 : est.areaM2;
    const subtotal = product ? pricePerRoom(product, billedM2) : 0;
    return { surf, entry, product, ...est, billedM2, subtotal };
  });
}

function syncEstimate() {
  const rows = estimateRows();
  const total = rows.reduce((sum, r) => sum + r.subtotal, 0);
  S.el.estRows.innerHTML = rows.map((r) => {
    const name = r.product ? r.product.name : T("diz.noTile", "bez pločica");
    const area = S.reserve
      ? `${fmtM2(r.billedM2)} (+${r.reservePct}%)`
      : fmtM2(r.billedM2);
    return `<li>
      <span class="diz-est-name">${esc(surfaceLabel(r.surf.id))} — ${esc(name)}</span>
      <span class="diz-est-area">${esc(area)}</span>
      <span class="diz-est-sub">${esc(formatEur(r.subtotal))}</span>
    </li>`;
  }).join("");
  S.el.estTotal.textContent = formatEur(total);
  return rows;
}

// ---------------------------------------------------------------------------
// quote (mailto) summary
// ---------------------------------------------------------------------------

function shareUrl() {
  const hash = "#/dizajner/" + S.sceneId + "?a=" + encodeURIComponent(JSON.stringify(assignments()));
  return location.href.split("#")[0] + hash;
}

function quoteBody() {
  const rows = estimateRows();
  const total = rows.reduce((sum, r) => sum + r.subtotal, 0);
  const lines = [];
  lines.push(T("diz.quoteIntro", "Poštovani, želim ponudu za sljedeći dizajn:"));
  lines.push("");
  lines.push(`${T("diz.quoteRoom", "Prostorija")}: ${sceneLabel(scene())}`);
  lines.push("");
  for (const r of rows) {
    const pattern = PATTERNS.find((p) => p.id === (r.entry && r.entry.pattern));
    const grout = GROUT_COLORS.find((g) => g.id === (r.entry && r.entry.groutColorId));
    const rot = r.entry ? normRotation(r.entry.rotationDeg) : 0;
    const off = r.entry ? normOffset(r.entry.offsetPct, r.entry.pattern) : 0;
    const detail = [
      pattern ? patternLabel(pattern) : null,
      rot ? `${T("diz.rotation", "Rotacija pločice").toLowerCase()} ${rotationLabel(rot)}` : null,
      off ? `${T("diz.offset", "Pomak slaganja").toLowerCase()} ${offsetTitle(off).toLowerCase()}` : null,
      grout ? `${T("diz.grout", "Boja fuge").toLowerCase()} ${groutLabel(grout).toLowerCase()}` : null,
      r.entry ? `${r.entry.groutWidthMm} mm` : null,
    ].filter(Boolean).join(", ");
    lines.push(`${surfaceLabel(r.surf.id)}: ${r.product ? r.product.name : T("diz.noTile", "bez pločica")}${detail ? ` (${detail})` : ""}`);
    lines.push(`  ${fmtM2(r.areaM2)} · ${T("diz.withReserve", "s rezervom")} +${r.reservePct}%: ${fmtM2(r.totalM2)} · ${formatEur(r.subtotal)}`);
  }
  lines.push("");
  lines.push(`${T("diz.total", "Ukupno")} (${T("diz.estimateShort", "procjena")}): ${formatEur(total)}`);
  lines.push("");
  lines.push(`${T("diz.quoteLink", "Poveznica na dizajn")}:`);
  lines.push(shareUrl());
  lines.push("");
  lines.push(T("diz.quoteFooter", "Poslano iz Akvaterm dizajnera. Cijene su demo podaci i informativne su."));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// control sync + rendering
// ---------------------------------------------------------------------------

function syncControls() {
  const a = current();
  S.el.chip.textContent = surfaceLabel(S.selected);
  S.canvas.setAttribute("aria-label", canvasLabel());

  for (const b of S.el.surfaces.querySelectorAll("[data-surface]")) {
    b.setAttribute("aria-pressed", String(b.dataset.surface === S.selected));
  }
  for (const b of S.el.drawer.querySelectorAll("[data-product]")) {
    b.setAttribute("aria-pressed", String(!!a && b.dataset.product === a.productId));
  }
  for (const b of S.el.patterns.querySelectorAll("[data-pattern]")) {
    b.setAttribute("aria-pressed", String(!!a && b.dataset.pattern === a.pattern));
  }
  for (const b of S.el.grout.querySelectorAll("[data-grout]")) {
    b.setAttribute("aria-pressed", String(!!a && b.dataset.grout === a.groutColorId));
  }
  for (const b of S.el.groutW.querySelectorAll("[data-groutw]")) {
    b.setAttribute("aria-pressed", String(!!a && Number(b.dataset.groutw) === a.groutWidthMm));
  }
  for (const b of S.el.combos.querySelectorAll("[data-combo]")) {
    b.setAttribute("aria-pressed", String(comboMatches(b.dataset.combo)));
  }

  const rot = a ? normRotation(a.rotationDeg) : 0;
  for (const b of S.el.rotation.querySelectorAll("[data-rotation]")) {
    b.setAttribute("aria-pressed", String(Number(b.dataset.rotation) === rot));
  }
  S.el.hudRotate.setAttribute("aria-pressed", String(rot === 90));
  S.el.hudRotate.setAttribute("aria-label",
    `${T("diz.rotation", "Rotacija pločice")}: ${rotationLabel(rot)}`);

  const offsettable = !!a && OFFSET_PATTERNS.has(a.pattern);
  const off = a ? normOffset(a.offsetPct, a.pattern) : 0;
  for (const b of S.el.offset.querySelectorAll("[data-offset]")) {
    b.disabled = !offsettable;
    b.setAttribute("aria-pressed", String(offsettable && Number(b.dataset.offset) === off));
  }
  S.el.offsetHint.hidden = offsettable;

  const rows = syncEstimate();
  const mine = rows.find((r) => r.surf.id === S.selected);
  const parts = [`${T("diz.products", "Pločice")} — ${surfaceLabel(S.selected)}`];
  if (mine) parts.push(fmtM2(mine.billedM2), formatEur(mine.subtotal));
  S.el.surfK.textContent = parts.join(" · ");
}

function comboMatches(comboId) {
  const combo = (COMBOS[S.sceneId] || []).find((c) => c.id === comboId);
  if (!combo) return false;
  const a = assignments();
  return scene().surfaces.every((s) => {
    const want = combo.surfaces[s.id];
    const have = a[s.id];
    if (!want || !have) return !want && !have;
    return want.productId === have.productId && want.pattern === have.pattern &&
      want.groutColorId === have.groutColorId && Number(want.groutWidthMm) === Number(have.groutWidthMm) &&
      normRotation(want.rotationDeg) === normRotation(have.rotationDeg) &&
      normOffset(want.offsetPct, want.pattern) === normOffset(have.offsetPct, have.pattern);
  });
}

function canvasLabel() {
  const list = orderedSurfaces().map((s) => {
    const e = assignments()[s.id];
    const p = productById(e && e.productId);
    return `${surfaceLabel(s.id)} — ${p ? p.name : T("diz.noTile", "bez pločica")}`;
  });
  return `${T("diz.canvasAlt", "Ilustracija prostorije")}: ${sceneLabel(scene())}. ${list.join("; ")}. ` +
    `${T("diz.selected", "Odabrana površina")}: ${surfaceLabel(S.selected)}. ` +
    `${T("diz.canvasKeys", "Strelicama mijenjate površinu.")}`;
}

function fitCanvas() {
  sizeToElement(S.canvas);
  sizeToElement(S.overlay);
  if (S.el && S.el.bare) sizeToElement(S.el.bare);
}

function fitCompare() {
  sizeToElement(S.cvA);
  sizeToElement(S.cvB);
}

function sizeToElement(canvas) {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(r.width * dpr);
  const h = Math.round((r.width * DESIGN_H / DESIGN_W) * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

function scheduleRender() {
  if (!S || S.rafId) return;
  S.rafId = requestAnimationFrame(() => {
    if (!S) return;
    S.rafId = 0;
    paint();
  });
}

function paint() {
  renderScene(S.canvas, scene(), assignments(), S.products);
  renderBare();
  paintSelection();
  if (S.comparing && S.snapA) {
    const scA = sceneById(S.snapA.sceneId) || scene();
    renderScene(S.cvA, scA, S.snapA.assignments, S.products);
    renderScene(S.cvB, scene(), assignments(), S.products);
  }
}

/** Selection highlight — own overlay canvas, so it never re-renders the scene. */
function paintSelection() {
  if (!S || !S.overlay || !S.overlay.width) return;
  const ctx = S.overlay.getContext("2d");
  if (!ctx) return;
  const sx = S.overlay.width / DESIGN_W, sy = S.overlay.height / DESIGN_H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, S.overlay.width, S.overlay.height);
  const surf = scene().surfaces.find((s) => s.id === S.selected);
  if (!surf) return;

  let grow = 0;
  if (S.pulseUntil) {
    const k = 0.5 - 0.5 * Math.cos((performance.now() / 340) * Math.PI * 2);
    grow = k * 4;
  }

  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.beginPath();
  ctx.moveTo(surf.quad[0][0], surf.quad[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(surf.quad[i][0], surf.quad[i][1]);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  // --teal-600 wash over the selected surface (decorative, not the indicator).
  ctx.fillStyle = `rgba(19,158,177,${0.09 + grow * 0.014})`;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();
  ctx.lineJoin = "round";
  // The indicator is a PAIR, and the pair is what carries WCAG 1.4.11 (3:1 for
  // non-text UI) against a backdrop the user chooses: --paper #F2F2F2 and
  // --dark #1B120B measure 16.48:1 against each other, and if two colours were
  // BOTH under 3:1 against the same backdrop they could be at most 9:1 apart —
  // so at least one of these two always clears 3:1, whatever tile is beneath.
  // A --paper + --teal-600 pair is only 2.86:1 apart and does NOT hold: it was
  // measured failing against light stone, mid grey, amber and the teal tile
  // itself, which is why the sampled iris is the thin top hairline here and
  // not the identifying stroke.
  ctx.strokeStyle = "rgba(242,242,242,0.95)";
  ctx.lineWidth = 8 + grow;
  ctx.stroke();
  ctx.strokeStyle = "rgba(27,18,11,0.95)";
  ctx.lineWidth = 4 + grow;
  ctx.stroke();
  ctx.strokeStyle = "#139EB1";
  ctx.lineWidth = 1.5 + grow * 0.5;
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
