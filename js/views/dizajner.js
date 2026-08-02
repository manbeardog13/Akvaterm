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

const DRAFT_KEY = "akv:diz-draft";      // {sceneId, perScene, savedAt}
const COACH_KEY = "akv:diz-coached";    // "1" once the user selected a surface
const RESERVE_KEY = "akv:diz-reserve";  // "1"/"0" — estimate reserve toggle
const DRAFT_DEBOUNCE_MS = 400;
const QUOTE_EMAIL = "info@akvaterm.hr";
const PULSE_MS = 2000;

// i18n with an inline Croatian fallback so the view demos well even before
// every dictionary key lands (t() returns the key itself when missing).
const T = (key, fb) => { const v = t(key); return v === key ? fb : v; };

const SURFACE_FB = { "pod": "Pod", "zid-lijevi": "Lijevi zid", "zid-desni": "Desni zid" };
const SCENE_FB = { "kupaonica": "Kupaonica", "kuhinja": "Kuhinja", "dnevni-boravak": "Dnevni boravak" };
const PATTERN_FB = { grid: "Mreža", runningBond: "Pomaknuti slog", herringbone: "Riblja kost", diagonal: "Dijagonalno" };
const GROUT_FB = { bijela: "Bijela", siva: "Siva", antracit: "Antracit" };

// ---------------------------------------------------------------------------
// Curated starter combinations — four named looks per scene, product ids from
// data/catalog.seed.json. Same shape sanitizeAssignments() accepts, so a combo
// is validated against the live catalog before it is applied.
// ---------------------------------------------------------------------------

const A = (productId, pattern, groutColorId, groutWidthMm) =>
  ({ productId, pattern, groutColorId, groutWidthMm });

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
      };
    }
  }
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
    out[s.id] = {
      productId: validTileId(e.productId),
      pattern: PATTERNS.some((p) => p.id === e.pattern) ? e.pattern : (PATTERNS[0] || { id: "grid" }).id,
      groutColorId: GROUT_COLORS.some((g) => g.id === e.groutColorId) ? e.groutColorId : (GROUT_COLORS[0] || { id: "bijela" }).id,
      groutWidthMm: GROUT_WIDTHS_MM.includes(Number(e.groutWidthMm)) ? Number(e.groutWidthMm) : 3,
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
 * groutWidthMm}}}, savedAt }
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
    .diz-head{margin:0 0 12px}
    .diz-head h1{font-size:24px;margin:0 0 2px}
    .diz-head p{margin:0;font-size:13px;color:var(--muted,#63676f)}
    .diz-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .diz-tab{min-height:44px;padding:10px 18px;border-radius:12px;border:1px solid var(--line,#d8d5ce);
      background:var(--surface,#fff);font:inherit;font-weight:600;cursor:pointer;color:inherit}
    .diz-tab[aria-pressed="true"]{background:var(--accent,#00008C);border-color:var(--accent,#00008C);color:#fff}
    .diz-surfaces{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .diz-surf{min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--line,#d8d5ce);
      background:var(--surface,#fff);font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:inherit;
      display:inline-flex;align-items:center;gap:8px}
    .diz-surf[aria-pressed="true"]{background:var(--accent,#00008C);border-color:var(--accent,#00008C);color:#fff}
    .diz-stage{position:relative;width:100%;max-width:min(100%,max(340px,calc((100vh - 330px)*10/7)));margin:0 auto 12px}
    .diz-cv{display:block;width:100%;aspect-ratio:${DESIGN_W}/${DESIGN_H};border-radius:14px;
      background:#e9e6df;box-shadow:0 1px 3px rgba(10,15,30,.14);cursor:pointer;touch-action:manipulation}
    .diz-overlay{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;background:none;border-radius:14px}
    .diz-chip{position:absolute;left:10px;top:10px;background:rgba(255,255,255,.92);border-radius:999px;
      padding:6px 14px;font-size:13px;font-weight:600;box-shadow:0 1px 3px rgba(10,15,30,.18);pointer-events:none}
    .diz-coach{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:3;
      width:calc(100% - 20px);max-width:380px;display:flex;align-items:center;gap:10px;
      padding:10px 10px 10px 14px;border-radius:14px;background:rgba(2,3,5,.8);color:#fff;
      font-size:12.5px;font-weight:600;box-shadow:0 8px 24px rgba(10,15,30,.28);pointer-events:none}
    .diz-coach[hidden]{display:none}
    .diz-coach p{margin:0;flex:1;min-width:0}
    .diz-coach button{pointer-events:auto;flex:none;min-height:44px;padding:8px 14px;border-radius:10px;
      border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.16);color:#fff;font:inherit;
      font-weight:700;font-size:12.5px;cursor:pointer}
    .diz-est{background:var(--surface,#fff);border:1px solid var(--line,#d8d5ce);border-radius:14px;
      padding:12px 14px;margin-bottom:12px}
    .diz-est-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .diz-est-toggle{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:13px;
      font-weight:600;cursor:pointer}
    .diz-est-toggle input{width:20px;height:20px;accent-color:var(--accent,#00008C);cursor:pointer}
    .diz-est-rows{list-style:none;margin:4px 0 0;padding:0}
    .diz-est-rows li{display:flex;gap:10px;align-items:baseline;justify-content:space-between;
      padding:6px 0;border-bottom:1px solid var(--hairline,rgba(28,22,16,.06));font-size:13px}
    .diz-est-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .diz-est-area{flex:none;color:var(--muted,#63676f);font-size:12px;white-space:nowrap}
    .diz-est-sub{flex:none;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
    .diz-est-total{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
      padding-top:9px;font-weight:800}
    .diz-est-total b{font-size:18px;font-variant-numeric:tabular-nums}
    .diz-est-note{margin:6px 0 0;font-size:11.5px;color:var(--muted,#63676f)}
    .diz-panel{background:var(--surface,#fff);border:1px solid var(--line,#d8d5ce);border-radius:14px;padding:14px}
    .diz-row{margin-bottom:12px}
    .diz-k{display:block;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
      color:var(--muted,#63676f);margin-bottom:6px}
    .diz-drawer{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch}
    .diz-sw{flex:0 0 auto;width:86px;min-height:44px;border:2px solid transparent;border-radius:12px;
      background:none;padding:4px;font:inherit;cursor:pointer;text-align:center;color:inherit}
    .diz-sw[aria-pressed="true"]{border-color:var(--accent,#00008C)}
    .diz-sw img,.diz-sw .diz-flat{width:78px;height:58px;border-radius:8px;display:block;object-fit:cover;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
    .diz-sw small{display:block;font-size:11px;line-height:1.25;margin-top:4px;color:inherit;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .diz-sw .diz-price{color:var(--muted,#63676f);font-size:10px}
    .diz-combos{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch}
    .diz-combo{flex:0 0 auto;min-width:104px;min-height:44px;border:2px solid transparent;border-radius:12px;
      background:none;padding:4px 6px;font:inherit;cursor:pointer;color:inherit;text-align:center}
    .diz-combo[aria-pressed="true"]{border-color:var(--accent,#00008C)}
    .diz-combo .diz-combo-sw{display:flex;gap:3px;justify-content:center}
    .diz-combo img,.diz-combo .diz-flat{width:28px;height:38px;border-radius:6px;display:block;object-fit:cover;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
    .diz-combo small{display:block;font-size:11px;line-height:1.25;margin-top:5px;font-weight:600}
    .diz-seg{display:flex;gap:6px;flex-wrap:wrap}
    .diz-seg button{min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--line,#d8d5ce);
      background:var(--surface,#fff);font:inherit;font-size:13px;cursor:pointer;color:inherit;
      display:inline-flex;align-items:center;gap:8px}
    /* Selected fill uses --accent navy (white text ≈15:1). --accent-2 is a
       fill/large-text blue: white 13px on it is 4.02:1 and fails AA. */
    .diz-seg button[aria-pressed="true"]{background:var(--accent,#00008C);border-color:var(--accent,#00008C);color:#fff}
    .diz-dot{width:18px;height:18px;border-radius:50%;display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
    .diz-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px}
    .diz-actions input{min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--line,#d8d5ce);
      font:inherit;flex:1 1 150px;min-width:120px;background:var(--surface,#fff);color:inherit}
    .diz-btn{min-height:44px;padding:10px 16px;border-radius:10px;border:1px solid var(--line,#d8d5ce);
      background:var(--surface,#fff);font:inherit;font-weight:600;cursor:pointer;color:inherit}
    .diz-btn.is-primary{background:var(--accent,#00008C);border-color:var(--accent,#00008C);color:#fff}
    .diz-btn:disabled{opacity:.45;cursor:default}
    .diz-compare{display:none;margin-bottom:12px}
    .diz-compare.is-open{display:block}
    .diz-cmp-grid{display:flex;gap:10px;flex-wrap:wrap}
    .diz-cmp-cell{flex:1 1 300px;min-width:260px}
    .diz-cmp-cell canvas{display:block;width:100%;aspect-ratio:${DESIGN_W}/${DESIGN_H};border-radius:12px;background:#e9e6df}
    .diz-cmp-cell .diz-k{margin-top:6px;text-align:center}
    .diz-tab:focus-visible,.diz-surf:focus-visible,.diz-sw:focus-visible,.diz-combo:focus-visible,
    .diz-seg button:focus-visible,.diz-btn:focus-visible,.diz-cv:focus-visible,.diz-coach button:focus-visible{
      outline:3px solid var(--accent,#00008C);outline-offset:2px}
    @media (prefers-reduced-motion:no-preference){.diz-tab,.diz-surf,.diz-seg button,.diz-btn{transition:background .15s,border-color .15s}}
  </style>
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
    <canvas class="diz-overlay" id="dizOverlay" aria-hidden="true"></canvas>
    <span class="diz-chip" id="dizChip"></span>
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
    const ids = orderedSurfaces().map((s) => (c.surfaces[s.id] || {}).productId);
    const thumbs = ids.slice(0, 3).map((id) => swatchMarkup(productById(id), 64)).join("");
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
  };

  on(S.el.tabs, "click", (e) => {
    const btn = e.target.closest("[data-scene]");
    if (!btn || btn.dataset.scene === S.sceneId) return;
    S.sceneId = btn.dataset.scene;
    ensureAssignments(scene());
    S.selected = defaultSurfaceId(scene());
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

  const ro = new ResizeObserver(() => { fitCanvas(); if (S.comparing) fitCompare(); scheduleRender(); });
  ro.observe(S.el.stage);
  S.observers.push(ro);
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
    const detail = [
      pattern ? patternLabel(pattern) : null,
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
      want.groutColorId === have.groutColorId && Number(want.groutWidthMm) === Number(have.groutWidthMm);
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
  ctx.fillStyle = `rgba(0,0,140,${0.06 + grow * 0.012})`;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 7 + grow;
  ctx.stroke();
  ctx.strokeStyle = "#00008C";
  ctx.lineWidth = 3 + grow;
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
