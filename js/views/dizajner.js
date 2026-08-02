// ============================================================================
// views/dizajner.js — the Dizajner, now driven by the REAL 3D engine.
//
// Operator, 2026-08-02: "dizajner section. why arent the elements in those
// rooms quality objects? that's guesswork kitchen counter and windows. i don't
// want that"
//
// So this view no longer draws anything. The old pipeline (js/scene2d.js +
// hand-authored draw() functions in data/scenes.js — an invented window, an
// invented worktop, a bezier sofa) is gone from here entirely: not imported,
// not called, not fallen back to. Every pixel inside the stage is produced by
// js/scene3d.js, which builds each scene from the vendored CC0 .glb models at
// the scale vendor/models/PROVENANCE.md measured. This file authors NO
// geometry of any kind.
//
// What this file still owns — and what had to keep working across the swap:
//   scene tabs · surface selection by tap AND keyboard · product drawer ·
//   pattern / grout colour / grout width · per-surface tile rotation ·
//   live price estimate · curated starter combinations · first-run coach mark ·
//   A/B compare · before/after wipe · draft persistence (akv:diz-draft, SAME
//   shape — js/views/katalog.js reads it) · share link + QR · "Zatraži ponudu"
//   mailto · the glass HUD.
//
// NEW, because the fixtures are real models rather than drawings: the user can
// drag the furniture, exactly as in the 3D room. The camera stays LOCKED —
// this is a designed view, not an orbit sandbox — so the only thing that moves
// is the furniture. A standing Croatian hint under the stage says so.
//
// ---------------------------------------------------------------------------
// HOW THE PIECES MAP ONTO THE ENGINE CONTRACT (docs/DESIGNER_REBUILD.md)
//
//   stage            mountScene(el, {sceneId, assignments, products,
//                                    onReady, onSelect})
//   tap / keyboard   onSelect(surfaceId|null) in, selectSurface(id) out.
//                    selectSurface() deliberately does not echo onSelect, so
//                    there is no feedback loop.
//   one control      setAssignment(surfaceId, entry)
//   combo / restore  setAssignments(obj)
//   scene tab        setScene(id) then setAssignments(thatScene'sEntries)
//   price estimate   listSurfaces().areaM2 — REAL geometry, never an authored
//                    number. There are no realSizeM fields anywhere here now.
//   before / after   setBareMode(true) → snapshotTo(2d) → setBareMode(false).
//                    The still is pixel-aligned with the live canvas because
//                    it is the same locked camera, so the wipe is a CSS
//                    clip-path over a frozen frame and costs nothing to drag.
//   A/B compare      snapshotTo(cvB) for the live side, renderSceneThumbnail()
//                    for the remembered A side.
//
// SURFACE IDS ARE NOT HARD-CODED. Everything the view needs about a surface —
// which exist, what they are, how big they are — comes from the scene
// definition and from listSurfaces(). The curated combinations are therefore
// authored by ROLE (floor look + wall looks in declaration order) rather than
// against literal ids like "zid-lijevi", so a scene may rename or add surfaces
// without silently dropping a combination.
//
// TILE LAYING OFFSET: kept, honestly labelled. The 3D texture pipeline
// (js/gfx3d.js makeSurfaceTexture) has no phase-shift parameter, so the offset
// does not show in the preview. It is a real instruction to the fitter, it is
// still stored in the draft and it still appears in the quote e-mail, and the
// hint under the control says exactly that rather than pretending.
//
// IRIS / GLASS NOTES ---------------------------------------------------------
// Unchanged from the 2D view and re-verified against it: exactly ONE
// backdrop-filter surface lives here (the canvas HUD), which with the standing
// top bar + tab bar pair is the whole 3-surface budget. Every colour is a
// var() on a shipped token; the few computed ratios are recorded next to the
// rule that needed them.
// ============================================================================
import { SCENES } from "../../data/scenes.js";
import * as db from "../db.js";
import { t } from "../i18n.js";
import { PATTERNS, GROUT_COLORS, formatEur, pricePerRoom } from "../domain.js";
// Namespace import as well: orderEstimate() is an optional, newer domain
// helper. A named import would break this whole module if it is not there
// yet, a namespace lookup simply yields undefined (see orderEstimateFor).
import * as domain from "../domain.js";
import { swatchDataUrl } from "../texture.js";

// The stage's letterbox. It used to come from js/scene2d.js's design space;
// it is now this view's own composition choice and nothing else depends on it.
const STAGE_W = 1000;
const STAGE_H = 700;

// Mirrors js/scene3d.js's FALLBACK_ROOM. Used only to compute a price when the
// engine is not available (no WebGL, module failed to load) — the same
// geometric rule the engine uses, never a per-surface authored number.
const FALLBACK_ROOM = { widthM: 3, depthM: 2.5, heightM: 2.6 };
const WALL_IDS = ["N", "E", "S", "W"];

const GROUT_WIDTHS_MM = [2, 3, 5, 8];

// Per-surface laying options. 0/90 is the honest set for a rectangular tile:
// 180 and 270 produce an identical repeat, and js/gfx3d.js snaps anything else
// to the nearest quarter turn anyway.
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
const WIPE_STEP = 2;                    // % per arrow key on the wipe divider

// i18n with an inline Croatian fallback so the view demos well even before
// every dictionary key lands (t() returns the key itself when missing).
const T = (key, fb) => { const v = t(key); return v === key ? fb : v; };

const SURFACE_FB = {
  "pod": "Pod",
  "zid-lijevi": "Lijevi zid",
  "zid-desni": "Desni zid",
  "zid-straznji": "Stražnji zid",
  "zid-prednji": "Prednji zid",
};
// Last resort when a scene declares a surface id this view has never seen and
// i18n has no key for it: name it by what it is, from the scene's own `kind`.
const KIND_FB = { floor: "Pod", wall: "Zid" };
const SCENE_FB = {
  "kupaonica": "Kupaonica",
  "mala-kupaonica": "Mala kupaonica",
  "kuhinja": "Kuhinja",
  "dnevni-boravak": "Dnevni boravak",
  "wc": "WC / toalet",
};
const PATTERN_FB = { grid: "Mreža", runningBond: "Pomaknuti slog", herringbone: "Riblja kost", diagonal: "Dijagonalno" };
const GROUT_FB = { bijela: "Bijela", siva: "Siva", antracit: "Antracit" };
const OFFSET_FB = { 0: "Bez pomaka", 0.25: "1/4 pločice", 0.5: "1/2 pločice" };
const OFFSET_SHORT = { 0: "0", 0.25: "¼", 0.5: "½" };

// Croatian names for the vendored model file stems, used only for the HUD line
// that tells the user which object they just grabbed. js/i18n.js already ships
// the whole `soba3d.fixture.<stem>` family; these are the inline fallbacks.
const FIXTURE_FB = {
  "bathtub": "Kada",
  "bathtub-freestanding": "Samostojeća kada",
  "toilet": "WC školjka",
  "toilet-square": "WC školjka (kvadratna)",
  "toilet-modern": "WC školjka (moderna)",
  "washbasin-vanity": "Umivaonik s ormarićem",
  "washbasin-vanity-wall": "Viseći umivaonik s ormarićem",
  "washbasin-pedestal": "Umivaonik na stupu",
  "shower-enclosure": "Tuš kabina",
  "bathroom-cabinet-tall": "Visoki kupaonski ormarić",
  "bathroom-mirror": "Ogledalo",
  "towel-rail": "Držač ručnika",
  "kitchen-cabinet-base": "Kuhinjski element",
  "kitchen-cabinet-drawer": "Kuhinjski element s ladicama",
  "kitchen-cabinet-corner": "Kutni kuhinjski element",
  "kitchen-cabinet-upper": "Gornji kuhinjski element",
  "kitchen-sink-unit": "Sudoper",
  "kitchen-stove": "Štednjak",
  "kitchen-fridge": "Hladnjak",
  "kitchen-hood": "Napa",
  "door": "Vrata",
  "door-leaf": "Vrata s krilom",
  "window-large": "Prozor (veliki)",
  "window-small": "Prozor (mali)",
  "ac-outdoor-unit": "Klima uređaj — vanjska jedinica",
};

// ---------------------------------------------------------------------------
// Curated starter combinations — four named looks per scene, product ids from
// data/catalog.seed.json.
//
// Authored by ROLE, not by surface id: `floor` is applied to every floor the
// scene declares, and `walls` is applied to the walls in the order the scene
// declares them, cycling if there are more walls than looks. That is what
// makes a combination survive a scene gaining, losing or renaming a surface —
// which the 3D rebuild does, since a scene's surfaces are now planes of a real
// room rather than quads of a drawing.
// ---------------------------------------------------------------------------

const A = (productId, pattern, groutColorId, groutWidthMm, rotationDeg = 0, offsetPct = 0) =>
  ({ productId, pattern, groutColorId, groutWidthMm, rotationDeg, offsetPct });

const COMBOS = {
  "kupaonica": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran",
      floor: A("ker-05", "grid", "bijela", 3),
      walls: [A("ker-11", "grid", "bijela", 3), A("ker-08", "runningBond", "bijela", 3), A("ker-11", "grid", "bijela", 3)] },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton",
      floor: A("ker-14", "grid", "siva", 3),
      walls: [A("ker-12", "grid", "siva", 3), A("ker-12", "grid", "siva", 3), A("ker-12", "grid", "siva", 3)] },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast",
      floor: A("ker-03", "grid", "antracit", 2),
      walls: [A("ker-20", "runningBond", "antracit", 3), A("ker-20", "runningBond", "antracit", 3), A("ker-21", "runningBond", "antracit", 3)] },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli",
      floor: A("ker-15", "runningBond", "bijela", 2),
      walls: [A("ker-08", "grid", "bijela", 2), A("ker-01", "grid", "bijela", 2), A("ker-08", "grid", "bijela", 2)] },
  ],
  "mala-kupaonica": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran",
      floor: A("ker-05", "grid", "bijela", 3),
      walls: [A("ker-08", "runningBond", "bijela", 2), A("ker-08", "runningBond", "bijela", 2), A("ker-11", "grid", "bijela", 2)] },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton",
      floor: A("ker-13", "grid", "siva", 3),
      walls: [A("ker-12", "grid", "siva", 3), A("ker-12", "grid", "siva", 3), A("ker-14", "grid", "siva", 3)] },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast",
      floor: A("ker-03", "grid", "antracit", 2),
      walls: [A("ker-20", "runningBond", "antracit", 2), A("ker-20", "runningBond", "antracit", 2), A("ker-21", "runningBond", "antracit", 2, 90)] },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli",
      floor: A("ker-15", "runningBond", "bijela", 2, 0, 0.5),
      walls: [A("ker-08", "grid", "bijela", 2), A("ker-08", "grid", "bijela", 2), A("ker-10", "grid", "bijela", 2)] },
  ],
  // WC / toalet — 1.4 × 1.9 m, so the looks stay small-format and the wall you
  // face carries the accent. (This scene replaced the hand-drawn "predsoblje"
  // corridor when data/scenes.js became data: the CC0 set has no hallway
  // furniture, so the corridor could not be built honestly. Its combinations
  // went with it rather than being left pointing at a scene that is gone.)
  "wc": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran",
      floor: A("ker-05", "grid", "bijela", 3),
      walls: [A("ker-08", "runningBond", "bijela", 2), A("ker-11", "grid", "bijela", 2), A("ker-08", "runningBond", "bijela", 2)] },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton",
      floor: A("ker-13", "grid", "siva", 3),
      walls: [A("ker-12", "grid", "siva", 3), A("ker-14", "grid", "siva", 3), A("ker-12", "grid", "siva", 3)] },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast",
      floor: A("ker-03", "grid", "antracit", 2),
      walls: [A("ker-20", "runningBond", "antracit", 2), A("ker-21", "runningBond", "antracit", 2), A("ker-20", "runningBond", "antracit", 2)] },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli",
      floor: A("ker-22", "grid", "bijela", 2),
      walls: [A("ker-08", "grid", "bijela", 2), A("ker-01", "grid", "bijela", 2), A("ker-08", "grid", "bijela", 2)] },
  ],
  "kuhinja": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran",
      floor: A("ker-05", "grid", "bijela", 3),
      walls: [A("ker-10", "grid", "bijela", 3), A("ker-08", "runningBond", "bijela", 3), A("ker-10", "grid", "bijela", 3)] },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton",
      floor: A("ker-12", "grid", "siva", 3),
      walls: [A("ker-14", "grid", "siva", 3), A("ker-14", "grid", "siva", 3), A("ker-14", "grid", "siva", 3)] },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast",
      floor: A("ker-13", "grid", "antracit", 3),
      walls: [A("ker-20", "runningBond", "antracit", 3), A("ker-21", "runningBond", "antracit", 3), A("ker-20", "runningBond", "antracit", 3)] },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli",
      floor: A("ker-15", "runningBond", "bijela", 2),
      walls: [A("ker-01", "grid", "bijela", 2), A("ker-08", "grid", "bijela", 2), A("ker-01", "grid", "bijela", 2)] },
  ],
  "dnevni-boravak": [
    { id: "mediteran", i18nKey: "diz.combo.mediteran", fb: "Mediteran",
      floor: A("ker-06", "grid", "bijela", 3),
      walls: [A("ker-09", "grid", "bijela", 3), A("ker-09", "grid", "bijela", 3), A("ker-09", "grid", "bijela", 3)] },
    { id: "topli-beton", i18nKey: "diz.combo.topliBeton", fb: "Topli beton",
      floor: A("ker-12", "grid", "siva", 3),
      walls: [A("ker-14", "grid", "siva", 3), A("ker-14", "grid", "siva", 3), A("ker-14", "grid", "siva", 3)] },
    { id: "kontrast", i18nKey: "diz.combo.kontrast", fb: "Crno-bijeli kontrast",
      floor: A("ker-03", "grid", "antracit", 2),
      walls: [A("ker-01", "grid", "bijela", 2), A("ker-01", "grid", "bijela", 2), A("ker-01", "grid", "bijela", 2)] },
    { id: "nordijski", i18nKey: "diz.combo.nordijski", fb: "Nordijski svijetli",
      floor: A("ker-17", "runningBond", "bijela", 2),
      walls: [A("ker-08", "grid", "bijela", 2), A("ker-18", "grid", "bijela", 2), A("ker-08", "grid", "bijela", 2)] },
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
// Bumped by every render() and every teardown(); an async mount whose token is
// stale drops its handle instead of attaching it to a view that is gone.
let mountToken = 0;

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

export async function render(container, params) {
  teardown();
  const token = ++mountToken;
  S = {
    container, products: [], tiles: [],
    sceneId: null, perScene: {}, selected: null,
    areas: new Map(),
    api: null, scene3d: null, mountToken: token,
    snapA: null, comparing: false, compareAKey: "",
    wipe: { on: false, pct: 50, dragging: false },
    fixture: null,                      // {index, model} while one is grabbed
    reserve: readFlag(RESERVE_KEY),
    coached: readFlag(COACH_KEY),
    reducedMotion: prefersReducedMotion(),
    draftTimer: 0, bareTimer: 0,
    observers: [], listeners: [],
  };

  const q = hashQuery();
  let sceneId = (paramSceneId(params) || q.path[1] || "").split("?")[0];

  S.products = (await db.listProducts()) || [];
  S.tiles = S.products.filter((p) => p.category === "keramika");
  if (!S || S.mountToken !== token) return;

  const wantsDesign = !!q.query.get("design");
  const wantsShare = !!q.query.get("a");

  // ?design= — load a saved design (scene kind only)
  if (wantsDesign) {
    const d = await db.getDesign(q.query.get("design"));
    if (!S || S.mountToken !== token) return;
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
  // Geometric areas so the price bar is right from the first paint; the engine
  // overwrites them with its own measurements as soon as it is up.
  S.areas = geometricAreas(scene());

  // ?product= — preselect a tile (from "primijeni u dizajneru")
  const pre = q.query.get("product");
  const preTile = pre ? S.tiles.find((p) => p.id === pre) : null;
  if (preTile) assignments()[S.selected].productId = preTile.id;

  container.innerHTML = markup();
  wire(container);
  renderSurfaceButtons();
  renderCombos();
  syncControls();

  if (preTile) {
    toast(`${T("diz.applied", "Primijenjeno")}: ${preTile.name} — ${surfaceLabel(S.selected)}`);
  }
  maybeCoach();

  await mountEngine(token);
}

export function teardown() {
  if (!S) return;
  mountToken++;
  if (S.draftTimer) { clearTimeout(S.draftTimer); S.draftTimer = 0; saveDraftNow(); }
  if (S.bareTimer) { clearTimeout(S.bareTimer); S.bareTimer = 0; }
  for (const o of S.observers) o.disconnect();
  for (const [target, type, fn] of S.listeners) target.removeEventListener(type, fn);
  if (S.api) { try { S.api.dispose(); } catch (err) { /* already gone */ } S.api = null; }
  S = null;
}

// ---------------------------------------------------------------------------
// state helpers
// ---------------------------------------------------------------------------

const sceneById = (id) => SCENES.find((s) => s.id === id) || null;
const scene = () => sceneById(S.sceneId);
const assignments = () => S.perScene[S.sceneId];
const current = () => assignments()[S.selected];

/** The surfaces a scene declares, defensively (a scene may ship none). */
const sceneSurfaces = (sc) => (sc && Array.isArray(sc.surfaces) ? sc.surfaces.filter((s) => s && s.id) : []);

/** Floors first, then walls — the order used by the buttons and arrow keys. */
function orderedSurfaces(sc = scene()) {
  return sceneSurfaces(sc).slice()
    .sort((a, b) => (a.kind === "floor" ? 0 : 1) - (b.kind === "floor" ? 0 : 1));
}

function defaultSurfaceId(sc) {
  const list = orderedSurfaces(sc);
  return list.length ? list[0].id : null;
}

function ensureAssignments(sc) {
  const a = S.perScene[sc.id] || (S.perScene[sc.id] = {});
  for (const s of sceneSurfaces(sc)) {
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
  for (const s of sceneSurfaces(sc)) {
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

// data/scenes.js carries a `nameHr` on every scene, so a scene added later is
// named correctly here without this file having to learn about it; SCENE_FB is
// only the third rung, below the dictionary and below the scene's own name.
const sceneLabel = (sc) => T(sc.i18nKey, sc.nameHr || SCENE_FB[sc.id] || sc.id);
const patternLabel = (p) => T(p.i18nKey, PATTERN_FB[p.id] || p.id);
const groutLabel = (g) => T(g.i18nKey, GROUT_FB[g.id] || g.id);
const comboLabel = (c) => T(c.i18nKey, c.fb);
const offsetLabel = (o) => OFFSET_SHORT[o] || String(o);
const offsetTitle = (o) => T("diz.offset." + String(o), OFFSET_FB[o] || String(o));
const rotationLabel = (d) => `${d}°`;
const productById = (id) => (id ? S.products.find((p) => p.id === id) || null : null);

/**
 * A surface's visible name. Tries, in order: the scene's own labelKey, the
 * shared `surface.<id>` key, this view's inline Croatian map, and finally the
 * surface's kind. Nothing here assumes a particular set of ids.
 */
function surfaceLabel(id) {
  if (!id) return T("designer.surface", "Površina");
  const surf = sceneSurfaces(scene()).find((s) => s.id === id);
  const fb = SURFACE_FB[id] || (surf ? KIND_FB[surf.kind === "floor" ? "floor" : "wall"] : null) || id;
  const key = surf && (surf.labelKey || surf.i18nKey);
  if (key) { const v = t(key); if (v !== key) return v; }
  return T("surface." + id, fb);
}

const fixtureLabel = (model) => T("soba3d.fixture." + model, FIXTURE_FB[model] || model);

function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (err) { return false; }
}

// ---------------------------------------------------------------------------
// Areas — REAL geometry only
// ---------------------------------------------------------------------------

const clampDimM = (v, fb) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fb);

/**
 * The same rule js/scene3d.js's surfaceLayout() applies, computed from the
 * scene's room block: floor = width × depth, a north/south wall = width ×
 * height, an east/west wall = depth × height. A scene that declares no `wall`
 * for a surface gets N, E, S, W in declaration order, exactly as the engine
 * does, so the two agree before the engine has even mounted.
 *
 * This exists only so the price bar is correct on the first paint and stays
 * correct if WebGL is unavailable. When the engine is up, listSurfaces()
 * measurements replace every value here.
 */
function geometricAreas(sc) {
  const r = (sc && sc.room) || {};
  const w = clampDimM(r.widthM, FALLBACK_ROOM.widthM);
  const d = clampDimM(r.depthM, FALLBACK_ROOM.depthM);
  const h = clampDimM(r.heightM, FALLBACK_ROOM.heightM);
  const out = new Map();
  let autoWall = 0;
  for (const s of sceneSurfaces(sc)) {
    if (out.has(s.id)) continue;
    if (s.kind === "floor") { out.set(s.id, w * d); continue; }
    const wall = WALL_IDS.includes(s.wall) ? s.wall : WALL_IDS[autoWall++ % WALL_IDS.length];
    out.set(s.id, (wall === "N" || wall === "S") ? w * h : d * h);
  }
  return out;
}

/** Pull the engine's measured areas over the geometric ones. */
function refreshAreas() {
  const next = geometricAreas(scene());
  if (S.api) {
    for (const s of S.api.listSurfaces()) {
      if (Number.isFinite(s.areaM2) && s.areaM2 > 0) next.set(s.id, s.areaM2);
    }
  }
  S.areas = next;
}

const areaFor = (id) => Number(S.areas.get(id)) || 0;

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
 * Draft contract — UNCHANGED by the 3D rebuild, and deliberately so: the
 * katalog "continue where you left off" card reads exactly this shape.
 * { sceneId, perScene:{[sceneId]:{[surfaceId]:{productId,pattern,groutColorId,
 * groutWidthMm,rotationDeg,offsetPct}}}, savedAt }
 * Fixture positions are NOT written here — that would change the shape for a
 * reader that has no use for them.
 */
function saveDraftNow() {
  if (!S || !S.sceneId) return;
  const perScene = {};
  for (const sc of SCENES) {
    const a = S.perScene[sc.id];
    if (!a) continue;
    const clean = {};
    for (const s of sceneSurfaces(sc)) {
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
     Iris skin for the Dizajner.

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
  /* The letterbox now lives on the stage itself: the engine's canvas is sized
     to its mount, not the other way round. */
  .diz-stage{position:relative;width:100%;aspect-ratio:${STAGE_W}/${STAGE_H};
    max-width:min(100%,max(340px,calc((100vh - 330px)*10/7)));margin:0 auto 10px;
    --diz-wipe:50%}
  .diz-mount{position:absolute;inset:0;border-radius:var(--diz-r);overflow:hidden;
    background:var(--panel);box-shadow:var(--shadow-card)}
  .diz-mount canvas{display:block;width:100%;height:100%}
  .diz-bare{position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;
    border-radius:var(--diz-r);pointer-events:none;background:none;
    clip-path:inset(0 calc(100% - var(--diz-wipe)) 0 0)}
  .diz-bare[hidden],.diz-wipe[hidden],.diz-wipe-tag[hidden]{display:none}
  /* The loading state uses the shipped .room3d-loading recipe (dark card +
     spinner) so the two 3D views look like one product while they warm up. */
  .diz-loading{z-index:4;border-radius:var(--diz-r)}
  .diz-fail{position:absolute;inset:0;z-index:4;display:flex;align-items:center;
    justify-content:center;text-align:center;padding:24px;border-radius:var(--diz-r);
    background:var(--panel);color:var(--muted);font-size:13px;line-height:1.5}

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
  /* BELOW the stage, never over it. It used to float across the bottom of the
     room (position:absolute; bottom:10px) where it covered the floor — i.e. the
     surface being edited whenever "Pod" was selected, which is the common case.
     Operator instruction, 2026-08-02: put the info text below the screen so it
     is not in the way. Normal flow also means it can never overlap the room on
     a short phone viewport, which the absolute version did as the stage shrank. */
  .diz-hud{position:relative;margin:8px 0 0;
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
  .diz-hud-btn:disabled{opacity:.55;cursor:default}
  /* Cost drop: while a pointer is down on the stage the HUD goes fully solid —
     blur off AND opaque, so the compositor stops reading back the canvas
     entirely for the duration of the drag. It is deliberately opaque rather
     than merely less transparent: a translucent value here would out-specify
     the reduced-transparency and forced-colours fallbacks in css/styles.css and
     hand a user who asked for no transparency a translucent panel mid-drag.
     Legibility goes UP, not down: --paper on --glass-solid-dark is 14.63:1
     against the 8.22:1 worst case of the live glass (computed). */
  /* Sibling selector, not descendant: the HUD now lives after the stage rather
     than inside it, so `.diz-stage.is-busy .diz-hud` would never match. */
  .diz-stage.is-busy + .diz-hud{
    backdrop-filter:none;-webkit-backdrop-filter:none;
    background-color:var(--glass-solid-dark)}

  /* ---- coach mark: the dark-glass TINT without the blur ------------------
     Deliberately not a second .glass-hud: two blurred surfaces in this view
     plus the standing top bar / tab bar pair would be four. It borrows only
     --glass-bg-dark, whose worst case (over a white backdrop) still gives
     --paper 8.22:1. */
  .diz-coach{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:5;
    width:calc(100% - 20px);max-width:410px;display:flex;align-items:center;gap:10px;
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

  /* ---- the "you can move the furniture" hint ---------------------------- */
  .diz-move-hint{margin:0 auto 14px;max-width:min(100%,max(340px,calc((100vh - 330px)*10/7)));
    display:flex;align-items:flex-start;gap:8px;font-family:var(--font-text);
    font-size:12px;line-height:1.45;color:var(--muted)}
  .diz-move-hint b{flex:none;font-weight:700;color:var(--ink)}

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
  .diz-cmp-cell canvas{display:block;width:100%;aspect-ratio:${STAGE_W}/${STAGE_H};
    border-radius:var(--diz-r-sm);background:var(--panel);box-shadow:var(--shadow-card)}
  .diz-cmp-cell .diz-k{margin:9px 0 0;text-align:center}

  /* ---- focus -------------------------------------------------------------- */
  .diz-root :focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:6px}
  /* The engine sets outline-offset:-3px on its own canvas so the ring stays
     inside the rounded mount instead of being clipped by overflow:hidden. */
  .diz-mount canvas:focus-visible{outline:3px solid var(--accent)}

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
    .diz-est-total span,.diz-move-hint{color:var(--ink)}
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
     colour/border transitions on the controls. */
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
    <div class="diz-mount" id="dizMount"></div>
    <canvas class="diz-bare" id="dizBare" aria-hidden="true" hidden></canvas>
    <span class="diz-wipe-tag is-before" id="dizWipeBefore" hidden>${esc(T("diz.before", "Prije"))}</span>
    <span class="diz-wipe-tag is-after" id="dizWipeAfter" hidden>${esc(T("diz.after", "Poslije"))}</span>
    <div class="diz-wipe" id="dizWipe" hidden>
      <span class="diz-wipe-line"></span>
      <span class="diz-wipe-grip" id="dizWipeGrip" role="slider" tabindex="0"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"
        aria-label="${esc(T("diz.wipeA11y", "Klizač usporedbe prije i poslije"))}">&#8942;</span>
    </div>
    <div class="diz-coach" id="dizCoach" hidden>
      <p>${esc(T("diz.coach", "Dodirnite površinu pa odaberite pločicu. Namještaj možete povući i premjestiti."))}</p>
      <button type="button" id="dizCoachOk">${esc(T("diz.coachOk", "U redu"))}</button>
    </div>
    <div class="room3d-loading diz-loading" id="dizLoading">
      <span class="spinner" aria-hidden="true"></span>${esc(T("diz.loading", "Učitavanje 3D prikaza…"))}
    </div>
  </div>
  <div class="diz-hud glass-hud" id="dizHud">
    <span class="diz-chip" id="dizChip"></span>
    <button class="diz-hud-btn" type="button" id="dizHudRotate" aria-pressed="false"
      title="${esc(T("diz.rotateHint", "Zakreni pločice za 90°"))}">90&deg;</button>
    <button class="diz-hud-btn" type="button" id="dizHudWipe" aria-pressed="false">${esc(T("diz.wipe", "Prije/poslije"))}</button>
  </div>
  <p class="diz-move-hint" id="dizMoveHint">
    <b>${esc(T("diz.moveHintLead", "Savjet:"))}</b>
    <span>${esc(T("diz.moveHint", "Namještaj i sanitarije stvarni su 3D modeli — povucite ih prstom ili mišem da ih premjestite. Tipkom R zakrećete odabrani predmet, strelicama ga pomičete. Pogled je fiksan."))}</span>
  </p>
  <p class="sr-only" id="dizStatus" aria-live="polite"></p>
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
    <p class="diz-est-note">${esc(T("diz.estNoteGeo", "Površine su izmjerene iz stvarne geometrije prostorije. Informativna procjena po demo cijenama — bez ugradnje, ljepila i fuge."))}</p>
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
      <p class="diz-hint">${esc(T("diz.offsetPreviewNote", "Pomak se bilježi u dizajnu i u upitu za ponudu; 3D prikaz ga zasad ne prikazuje."))}</p>
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
    // One thumb per surface, in the same order the combination is applied, so
    // the strip previews the actual result rather than a fixed trio.
    const built = comboAssignments(c);
    const ids = orderedSurfaces().map((s) => (built[s.id] || {}).productId);
    const thumbs = ids.slice(0, 4).map((id) => swatchMarkup(productById(id), 64)).join("");
    return `
      <button class="diz-combo" type="button" data-combo="${esc(c.id)}" aria-pressed="false">
        <span class="diz-combo-sw">${thumbs}</span>
        <small>${esc(comboLabel(c))}</small>
      </button>`;
  }).join("");
}

/**
 * Expand a role-authored combination against the CURRENT scene's surfaces:
 * every floor gets `floor`, and the walls get `walls` in declaration order,
 * cycling. Returns the same {surfaceId: entry} shape sanitizeAssignments takes.
 */
function comboAssignments(combo) {
  const out = {};
  if (!combo) return out;
  const walls = Array.isArray(combo.walls) && combo.walls.length ? combo.walls : [combo.floor];
  let wi = 0;
  for (const s of sceneSurfaces(scene())) {
    out[s.id] = s.kind === "floor" ? { ...combo.floor } : { ...walls[wi++ % walls.length] };
  }
  return out;
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
  S.cvA = $("#dizCvA");
  S.cvB = $("#dizCvB");
  S.el = {
    tabs: $("#dizTabs"), surfaces: $("#dizSurfaces"), chip: $("#dizChip"), surfK: $("#dizSurfK"),
    combos: $("#dizCombos"), drawer: $("#dizDrawer"), patterns: $("#dizPatterns"), grout: $("#dizGrout"),
    groutW: $("#dizGroutW"), compare: $("#dizCompare"), compareBtn: $("#dizCompareBtn"),
    setA: $("#dizSetA"), save: $("#dizSave"), quote: $("#dizQuote"), share: $("#dizShare"),
    name: $("#dizName"), stage: $("#dizStage"), mount: $("#dizMount"), loading: $("#dizLoading"),
    coach: $("#dizCoach"), coachOk: $("#dizCoachOk"), status: $("#dizStatus"),
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
    switchScene(btn.dataset.scene);
  });

  on(S.el.surfaces, "click", (e) => {
    const btn = e.target.closest("[data-surface]");
    if (!btn) return;
    selectSurface(btn.dataset.surface);
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

  // --- the engine's own fixture events ----------------------------------
  // They bubble from the renderer's canvas, so the mount is the natural place
  // to hear them; the canvas itself is created inside mountScene().
  on(S.el.mount, "akv:scene-fixture-selected", (e) => {
    S.fixture = e.detail || null;
    if (S.fixture) markCoached();
    syncChip();
  });
  on(S.el.mount, "akv:scene-fixture-moved", () => {
    // The furniture moved, so the "prije" still and the compare stills are now
    // out of date. Both are cheap frozen frames, so they are simply retaken.
    refreshBare(true);
    paintCompare();
  });

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
  on(S.el.mount, "pointerdown", () => setBusy(true));
  on(window, "pointerup", () => setBusy(false));
  on(window, "pointercancel", () => setBusy(false));

  on(S.el.setA, "click", () => {
    S.snapA = { sceneId: S.sceneId, assignments: clone(assignments()) };
    S.compareAKey = "";
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
      paintCompare();
    }
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

  // The engine keeps its own ResizeObserver on the mount and re-frames itself.
  // This one exists for the two things it cannot know about: the frozen "prije"
  // still and the compare stills.
  //
  // The bare still is deferred to a task rather than taken here: BOTH observers
  // fire in the same delivery, this one first (it was registered before the
  // engine mounted), so at this instant the renderer's drawing buffer is still
  // the OLD size and a snapshot taken now would be frozen at the wrong
  // resolution. A task runs after the whole delivery, by which time the engine
  // has resized. Deliberately not requestAnimationFrame: rAF is paused in a
  // hidden tab, and the wipe must not be left stale there.
  const ro = new ResizeObserver(() => {
    if (!S) return;
    if (S.comparing) { fitCompare(); paintCompare(); }
    if (S.wipe.on) scheduleBareRefresh();
  });
  ro.observe(S.el.stage);
  S.observers.push(ro);
}

// ---------------------------------------------------------------------------
// engine mount
// ---------------------------------------------------------------------------

async function mountEngine(token) {
  let mod;
  try {
    // Lazy: three.js and the engine enter the page only when the Dizajner does.
    mod = await import("../scene3d.js");
  } catch (err) {
    engineUnavailable();
    return;
  }
  if (!S || S.mountToken !== token) return;
  S.scene3d = mod;

  let handle;
  try {
    handle = await mod.mountScene(S.el.mount, {
      sceneId: S.sceneId,
      assignments: assignments(),
      products: S.products,
      onReady: () => {
        if (!S || S.mountToken !== token) return;
        if (S.el.loading) { S.el.loading.remove(); S.el.loading = null; }
      },
      onSelect: onEngineSelect,
    });
  } catch (err) {
    engineUnavailable();
    return;
  }
  if (!S || S.mountToken !== token) { try { handle.dispose(); } catch (e) { /* nothing to free */ } return; }

  S.api = handle;
  refreshAreas();
  S.api.selectSurface(S.selected);
  syncControls();
}

/**
 * No WebGL, or the engine module failed to load. The controls, the estimate
 * (on geometric areas) and the quote all still work; what is gone is the
 * picture, and the message says so rather than substituting a drawing.
 */
function engineUnavailable() {
  if (!S || !S.el) return;
  if (S.el.loading) { S.el.loading.remove(); S.el.loading = null; }
  if (S.el.mount.querySelector(".diz-fail")) return;
  const p = document.createElement("div");
  p.className = "diz-fail";
  p.textContent = T("diz.no3d",
    "3D prikaz nije dostupan na ovom uređaju. Odabir pločica, procjena cijene i upit za ponudu i dalje rade.");
  S.el.mount.appendChild(p);
  S.el.hudWipe.disabled = true;
}

/** onSelect from the engine: a tap on a surface, or keyboard cycling. */
function onEngineSelect(id) {
  if (!S) return;
  if (!id) {
    // A tap on empty space (or Escape). The whole control panel is bound to a
    // surface, so the view keeps one selected and simply re-asserts it.
    // selectSurface() does not echo onSelect, so this cannot loop.
    if (S.api) S.api.selectSurface(S.selected);
    return;
  }
  if (id === S.selected) return;
  S.selected = id;
  markCoached();
  syncControls();
}

// ---------------------------------------------------------------------------
// state changes
// ---------------------------------------------------------------------------

function switchScene(id) {
  S.sceneId = id;
  ensureAssignments(scene());
  S.selected = defaultSurfaceId(scene());
  S.fixture = null;
  history.replaceState(null, "", location.pathname + location.search + "#/dizajner/" + S.sceneId);
  for (const b of S.el.tabs.querySelectorAll("[data-scene]")) {
    b.setAttribute("aria-pressed", String(b.dataset.scene === S.sceneId));
  }
  if (S.api) {
    S.api.setScene(S.sceneId);
    // setScene keeps only the assignments whose surface ids the new scene also
    // declares — which is not this scene's own set, so install it explicitly.
    S.api.setAssignments(assignments());
    S.api.selectSurface(S.selected);
  }
  refreshAreas();
  renderSurfaceButtons();
  renderCombos();
  syncControls();
  scheduleDraftSave();
  if (S.wipe.on) refreshBare(true);
  if (S.comparing) paintCompare();
}

/** A control changed the current surface: retexture it, resync, persist. */
function afterChange() {
  if (S.api) S.api.setAssignment(S.selected, assignments()[S.selected] || null);
  syncControls();
  scheduleDraftSave();
  if (S.comparing) paintCompare();
}

function selectSurface(id) {
  if (!S || !assignments()[id]) return;
  S.selected = id;
  S.fixture = null;
  markCoached();
  if (S.api) S.api.selectSurface(id);
  syncControls();
}

function applyCombo(comboId) {
  const combo = (COMBOS[S.sceneId] || []).find((c) => c.id === comboId);
  if (!combo) return;
  S.perScene[S.sceneId] = sanitizeAssignments(comboAssignments(combo), scene());
  ensureAssignments(scene());
  if (!assignments()[S.selected]) S.selected = defaultSurfaceId(scene());
  if (S.api) S.api.setAssignments(assignments());
  syncControls();
  scheduleDraftSave();
  if (S.comparing) paintCompare();
  toast(`${T("diz.comboApplied", "Kombinacija primijenjena")}: ${comboLabel(combo)}`);
}

function renderSurfaceButtons() {
  S.el.surfaces.innerHTML = surfaceButtonsMarkup();
}

function renderCombos() {
  S.el.combos.innerHTML = combosMarkup();
}

/** Toggle the "pointer is down on the stage" state that drops the HUD blur. */
function setBusy(on) {
  if (!S || !S.el || !S.el.stage) return;
  if (!on && S.wipe.dragging) return;    // a captured wipe drag is still going
  S.el.stage.classList.toggle("is-busy", !!on);
}

// ---------------------------------------------------------------------------
// before / after wipe
// ---------------------------------------------------------------------------

function setWipe(on) {
  if (!S) return;
  S.wipe.on = !!on && !!S.api;
  S.el.hudWipe.setAttribute("aria-pressed", String(S.wipe.on));
  S.el.bare.hidden = !S.wipe.on;
  S.el.wipe.hidden = !S.wipe.on;
  S.el.wipeBefore.hidden = !S.wipe.on;
  S.el.wipeAfter.hidden = !S.wipe.on;
  if (S.wipe.on) {
    refreshBare(true);
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
 * The "prije" half: the SAME scene, same locked camera, same real models, with
 * no tiles on any surface — which is exactly what setBareMode(true) gives. It
 * is snapshotted into a plain 2D canvas and left frozen there, so dragging the
 * divider is pure CSS clip-path and repaints nothing.
 *
 * Because it is the same camera, the still is pixel-registered with the live
 * canvas underneath it; that is the whole reason the wipe reads as one room.
 */
function scheduleBareRefresh() {
  if (!S || S.bareTimer) return;
  S.bareTimer = setTimeout(() => {
    if (!S) return;
    S.bareTimer = 0;
    refreshBare(true);
  }, 0);
}

function refreshBare(force) {
  if (!S || !S.wipe.on || !S.api) return;
  const cv = S.el.bare;
  const size = liveBufferSize();
  if (!size) return;
  const [w, h] = size;
  const resized = cv.width !== w || cv.height !== h;
  if (resized) { cv.width = w; cv.height = h; }
  if (!resized && !force) return;
  S.api.setBareMode(true);
  S.api.snapshotTo(cv);
  S.api.setBareMode(false);
}

/**
 * The DRAWING-BUFFER size of the live canvas, not its CSS box: snapshotTo()
 * renders at exactly the target's pixel dimensions, so matching the renderer's
 * own buffer makes the two halves of the wipe identical in framing AND in
 * sharpness. Reading the canvas is the only honest source for this — the
 * engine owns its pixel ratio and the contract does not expose it, and
 * assuming devicePixelRatio here is wrong the moment the two disagree (they do
 * whenever the device pixel ratio changes after mount).
 */
function liveBufferSize() {
  const cv = S.el.mount.querySelector("canvas");
  if (cv && cv.width > 0 && cv.height > 0) return [cv.width, cv.height];
  const r = S.el.mount.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return [Math.max(1, Math.round(r.width * dpr)), Math.max(1, Math.round(r.height * dpr))];
}

// ---------------------------------------------------------------------------
// A/B compare
// ---------------------------------------------------------------------------

function fitCompare() {
  sizeToWidth(S.cvA);
  sizeToWidth(S.cvB);
}

function sizeToWidth(canvas) {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(r.width * dpr);
  const h = Math.round((r.width * STAGE_H / STAGE_W) * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

/**
 * B is the live view, so it is a snapshot of the mounted renderer — no second
 * WebGL context. A is a remembered assignment set that may even belong to a
 * different scene, so it goes through renderSceneThumbnail(), which owns and
 * hands back its own context. A is only re-rendered when it actually changed:
 * it is a still of something the user is no longer editing.
 */
function paintCompare() {
  if (!S || !S.comparing) return;
  fitCompare();
  if (S.api) S.api.snapshotTo(S.cvB);
  if (!S.snapA || !S.scene3d) return;
  const key = `${S.snapA.sceneId}|${S.cvA.width}x${S.cvA.height}|${JSON.stringify(S.snapA.assignments)}`;
  if (key === S.compareAKey) return;
  S.compareAKey = key;
  S.scene3d.renderSceneThumbnail(S.cvA, S.snapA.sceneId, S.snapA.assignments, S.products);
}

// ---------------------------------------------------------------------------
// coach mark (first run only)
// ---------------------------------------------------------------------------

function maybeCoach() {
  if (!S || S.coached) return;
  S.el.coach.hidden = false;
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
}

// ---------------------------------------------------------------------------
// price estimate
// ---------------------------------------------------------------------------

/**
 * Per-surface order estimate. The area is the engine's MEASURED areaM2 — the
 * old authored realSizeM product is gone from this file entirely. Prefers
 * domain.orderEstimate(product, areaM2, pattern) when that helper exists;
 * otherwise falls back to the same rule the advisor FAQ teaches: +10% reserve,
 * +15% for herringbone/diagonal cuts.
 */
function orderEstimateFor(product, surf, entry) {
  const areaM2 = round2(areaFor(surf.id));
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
// control sync
// ---------------------------------------------------------------------------

function syncControls() {
  const a = current();
  syncChip();

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

  S.el.status.textContent = statusLine();
}

/**
 * The HUD line. It names the surface the controls are pointed at — unless the
 * user has just grabbed a piece of furniture, in which case it names that and
 * says what can be done with it, because that is what the next gesture affects.
 */
function syncChip() {
  if (!S || !S.el) return;
  if (S.fixture && S.fixture.model) {
    S.el.chip.textContent =
      `${fixtureLabel(S.fixture.model)} · ${T("diz.fixtureHudHint", "povucite · R zakret")}`;
    return;
  }
  S.el.chip.textContent = surfaceLabel(S.selected);
}

function comboMatches(comboId) {
  const combo = (COMBOS[S.sceneId] || []).find((c) => c.id === comboId);
  if (!combo) return false;
  const want = comboAssignments(combo);
  const a = assignments();
  const list = sceneSurfaces(scene());
  if (!list.length) return false;
  return list.every((s) => {
    const w = want[s.id];
    const have = a[s.id];
    if (!w || !have) return !w && !have;
    return w.productId === have.productId && w.pattern === have.pattern &&
      w.groutColorId === have.groutColorId && Number(w.groutWidthMm) === Number(have.groutWidthMm) &&
      normRotation(w.rotationDeg) === normRotation(have.rotationDeg) &&
      normOffset(w.offsetPct, w.pattern) === normOffset(have.offsetPct, have.pattern);
  });
}

/**
 * The screen-reader summary. js/scene3d.js maintains its own aria-label on the
 * canvas (room size, which surfaces are tiled, which keys do what) and this
 * does not fight it — it adds the part the engine has no business knowing:
 * which PRODUCT is on which surface.
 */
function statusLine() {
  const list = orderedSurfaces().map((s) => {
    const e = assignments()[s.id];
    const p = productById(e && e.productId);
    return `${surfaceLabel(s.id)} — ${p ? p.name : T("diz.noTile", "bez pločica")}`;
  });
  return `${sceneLabel(scene())}. ${list.join("; ")}. ` +
    `${T("diz.selected", "Odabrana površina")}: ${surfaceLabel(S.selected)}.`;
}
