// ============================================================================
// views/soba3d.js — "3D soba": Stage-2 parametric room designer.
// Dimension inputs (Š/D/V, 1.5–8 m), a grouped fixture palette backed by the
// finished CC0 .glb models in vendor/models/, surface selector, and the same
// product-drawer + pattern/grout controls as the 2D dizajner — all driving
// js/room3d.js, which is dynamic-imported on first render so three.js never
// loads until this tab is opened.
//
// Opens with a designed starter room (tiled floor + walls, kada/umivaonik/wc)
// so the first frame reads as a bathroom rather than a white box, restores a
// saved design from `#/soba3d?design=<id>`, prices the room live and hands the
// summary to Akvaterm via "Zatraži ponudu".
// Saves via db.saveDesign with kind 'room3d'.
//
// ---------------------------------------------------------------------------
// MOVING THE FURNITURE. room3d.js owns the interaction; this view owns the
// record. It listens for two events off the stage:
//   akv:fixture-selected -> {index, type, label} | null   → shows the HUD
//   akv:fixture-moved    -> {index, x, z, rotY, ax, az}   → writes the record
// and it never answers a move by calling api.setFixtures(), which would rebuild
// every group and drop the model that is currently under the user's finger.
//
// ---------------------------------------------------------------------------
// GLASS BUDGET. The design system allows 2–3 simultaneous backdrop-filter
// surfaces; the app shell's top bar and mobile tab bar are the standing pair.
// This view therefore ships EXACTLY ONE: the floating canvas HUD. The hint chip
// and every panel below the stage are solid tinted surfaces, deliberately.
// All four degradation paths (@supports, reduced-transparency, contrast/forced-
// colors, reduced-motion) are shipped with it.
// ============================================================================

import * as db from "../db.js";
import { t } from "../i18n.js";
import { PATTERNS, GROUT_COLORS, formatEur, pricePerRoom } from "../domain.js";
import { swatchDataUrl } from "../texture.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// i18n with Croatian fallback: keys stay the contract surface, the literal
// guarantees Croatian text even before the dictionary carries the key.
const tt = (key, hr) => { const s = t(key); return s === key ? hr : s; };

const SURFACES = [
  { id: "floor", key: "soba3d.surface.floor", hr: "Pod" },
  { id: "wallN", key: "soba3d.surface.wallN", hr: "Sjeverni zid" },
  { id: "wallE", key: "soba3d.surface.wallE", hr: "Istočni zid" },
  { id: "wallS", key: "soba3d.surface.wallS", hr: "Južni zid" },
  { id: "wallW", key: "soba3d.surface.wallW", hr: "Zapadni zid" },
];

// The fixture palette. Types, Croatian names and real-world sizes mirror
// FIXTURE_SPECS in js/room3d.js, whose numbers come from
// vendor/models/PROVENANCE.md (measured bounding boxes, not estimates).
// `w` is the model's real width in metres — used only for the default
// placement maths below, so a 1.70 m bath is not dropped 0.10 m from a wall.
const FIXTURE_GROUPS = [
  {
    id: "kupaonica", key: "soba3d.group.kupaonica", hr: "Kupaonica",
    items: [
      { type: "kada", key: "soba3d.fixture.kada", hr: "Kada", w: 1.7, d: 0.75 },
      { type: "kadaSlobodna", key: "soba3d.fixture.bathtub-freestanding", hr: "Samostojeća kada", w: 1.7, d: 0.75 },
      { type: "tusKabina", key: "soba3d.fixture.tusKabina", hr: "Tuš kabina", w: 0.9, d: 0.9 },
      { type: "wc", key: "soba3d.fixture.wc", hr: "WC školjka", w: 0.36, d: 0.67 },
      { type: "wcKockasti", key: "soba3d.fixture.toilet-square", hr: "WC školjka, kockasta", w: 0.36, d: 0.62 },
      { type: "wcModerni", key: "soba3d.fixture.toilet-modern", hr: "WC školjka, moderna", w: 0.36, d: 0.66 },
      { type: "umivaonik", key: "soba3d.fixture.umivaonik", hr: "Umivaonik s ormarićem", w: 0.6, d: 0.46 },
      { type: "umivaonikStup", key: "soba3d.fixture.washbasin-pedestal", hr: "Umivaonik na stupu", w: 0.55, d: 0.45 },
      { type: "umivaonikViseci", key: "soba3d.fixture.washbasin-vanity-wall", hr: "Viseći umivaonik", w: 0.6, d: 0.46 },
      { type: "ogledalo", key: "soba3d.fixture.ogledalo", hr: "Ogledalo s policom", w: 0.6, d: 0.12 },
      { type: "ormaricVisoki", key: "soba3d.fixture.bathroom-cabinet-tall", hr: "Zidni ormarić", w: 0.4, d: 0.16 },
      { type: "drzacRucnika", key: "soba3d.fixture.drzacRucnika", hr: "Držač ručnika", w: 0.6, d: 0.1 },
    ],
  },
  {
    id: "kuhinja", key: "soba3d.group.kuhinja", hr: "Kuhinja",
    items: [
      { type: "kuhinjaDonji", key: "soba3d.fixture.kitchen-cabinet-base", hr: "Donji element 60", w: 0.6, d: 0.6 },
      { type: "kuhinjaLadice", key: "soba3d.fixture.kitchen-cabinet-drawer", hr: "Donji element s ladicama", w: 0.6, d: 0.6 },
      { type: "kuhinjaKutni", key: "soba3d.fixture.kitchen-cabinet-corner", hr: "Kutni donji element", w: 0.64, d: 0.61 },
      { type: "sudoper", key: "soba3d.fixture.sudoper", hr: "Sudoper element", w: 0.6, d: 0.6 },
      { type: "stednjak", key: "soba3d.fixture.stednjak", hr: "Štednjak 60", w: 0.6, d: 0.6 },
      { type: "hladnjak", key: "soba3d.fixture.hladnjak", hr: "Hladnjak", w: 0.6, d: 0.39 },
      { type: "kuhinjaGornji", key: "soba3d.fixture.kitchen-cabinet-upper", hr: "Gornji element 60", w: 0.6, d: 0.29 },
      { type: "napa", key: "soba3d.fixture.napa", hr: "Napa 60", w: 0.6, d: 0.38 },
    ],
  },
  {
    id: "ostalo", key: "soba3d.group.ostalo", hr: "Otvori i ostalo",
    items: [
      { type: "vrata", key: "soba3d.fixture.vrata", hr: "Vrata s dovratnikom", w: 0.9, d: 0.1 },
      { type: "vrataKrilo", key: "soba3d.fixture.door-leaf", hr: "Vrata (krilo)", w: 0.85, d: 0.21 },
      { type: "prozorVeliki", key: "soba3d.fixture.window-large", hr: "Prozor veliki", w: 0.9, d: 0.07 },
      { type: "prozorMali", key: "soba3d.fixture.window-small", hr: "Prozor mali", w: 0.46, d: 0.07 },
      { type: "radijator", key: "soba3d.fixture.radijator", hr: "Radijator", w: 0.9, d: 0.06 },
      { type: "klima", key: "soba3d.fixture.klima", hr: "Klima (unutarnja)", w: 0.84, d: 0.21 },
      { type: "klimaVanjska", key: "soba3d.fixture.ac-outdoor-unit", hr: "Vanjska jedinica klime", w: 0.51, d: 0.38 },
    ],
  },
];

const FIXTURE_TYPES = FIXTURE_GROUPS.flatMap((g) => g.items);
const fixtureSpec = (type) => FIXTURE_TYPES.find((f) => f.type === type) || null;

// Which run a kitchen module belongs to: 'base' is the worktop row on the floor,
// 'upper' is the wall row above it. They are laid out independently so a hood
// does not push a fridge sideways.
const KITCHEN_ROW = {
  kuhinjaDonji: "base", kuhinjaLadice: "base", kuhinjaKutni: "base",
  sudoper: "base", stednjak: "base", hladnjak: "base",
  kuhinjaGornji: "upper", napa: "upper",
};

const PATTERN_HR = { grid: "Mreža", runningBond: "Pomak ½", herringbone: "Riblja kost", diagonal: "Dijagonala" };
const GROUT_HR = { bijela: "Bijela", siva: "Siva", antracit: "Antracit" };

const GROUT_WIDTHS_MM = [2, 3, 4, 5, 6, 8];
const DIM_MIN = 1.5, DIM_MAX = 8;
const DEFAULT_ROOM = { widthM: 3, depthM: 2.5, heightM: 2.6 };

// Curated first impression: a dark marble floor with light marble walls and the
// three fixtures every bathroom has. Ids are from data/catalog.seed.json and
// fall back to whatever keramika the catalog does carry.
const STARTER = {
  floorProductId: "ker-03",
  wallProductId: "ker-02",
  floorGroutId: "siva",
  wallGroutId: "bijela",
  fixtures: ["kada", "umivaonik", "wc"],
};

const RESERVE_PCT = 10;         // the +10% cutting reserve the advisor teaches
const QUOTE_EMAIL = "info@akvaterm.hr";

const clampDim = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(DIM_MAX, Math.max(DIM_MIN, n)) : fallback;
};

// "2,55" — Croatian decimal comma, trailing zeros trimmed.
const fmtM = (n) => String(Math.round((Number(n) || 0) * 100) / 100).replace(".", ",");
// "7,50" — always two decimals, for m² figures that read as measurements.
const fmtArea = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",");

// Sensible first placement per fixture type, derived from current room dims and
// from the fixture's OWN real size — a 1.70 m bath is placed by its centre, so
// half its length is what has to clear the wall. room3d.js then runs the same
// settle() every drag uses, which snaps it flush and records the wall anchor.
function defaultFixture(type, room) {
  const w = room.widthM, d = room.depthM;
  const s = fixtureSpec(type);
  const halfW = (s ? s.w : 0.5) / 2;
  const halfD = (s ? s.d : 0.5) / 2;
  const mid = { x: w / 2, z: d / 2 };
  // Kitchen modules park in a RUN along the north wall rather than all landing
  // on the same spot: each new one starts where the widths already placed on
  // its own row end. Without this, adding six units drops six overlapping boxes
  // in one corner. room3d.js re-clamps whatever this produces, so overflowing
  // the wall is safe — it just stops at the east end.
  const runX = (row) => {
    let x = 0;
    for (const f of room.fixtures) {
      const o = fixtureSpec(f.type);
      if (!o || !KITCHEN_ROW[f.type] || KITCHEN_ROW[f.type] !== row) continue;
      x += o.w;
    }
    return x + halfW;
  };
  if (KITCHEN_ROW[type]) {
    return { type, x: Math.min(w - halfW, runX(KITCHEN_ROW[type])), z: halfD, rotY: 0, ax: 0, az: -1 };
  }
  switch (type) {
    // Long items along the west wall, running north–south.
    case "kada": case "kadaSlobodna":
      return { type, x: halfD, z: d / 2, rotY: Math.PI / 2, ax: -1, az: 0 };
    // Corner of the north-east.
    case "tusKabina":
      return { type, x: w - halfW, z: halfD, rotY: 0, ax: 1, az: -1 };
    case "wc": case "wcKockasti": case "wcModerni":
      return { type, x: Math.max(halfW, w - 0.55), z: halfD, rotY: 0, ax: 0, az: -1 };
    case "umivaonik": case "umivaonikStup": case "umivaonikViseci":
      return { type, x: w - halfD, z: Math.min(d - halfW, d / 2 + 0.9), rotY: -Math.PI / 2, ax: 1, az: 0 };
    case "ogledalo": case "ormaricVisoki":
      return { type, x: w - halfD, z: Math.min(d - halfW, d / 2 + 0.9), rotY: -Math.PI / 2, ax: 1, az: 0 };
    case "drzacRucnika": case "radijator":
      return { type, x: w / 2, z: d - halfD, rotY: Math.PI, ax: 0, az: 1 };
    case "klima":
      return { type, x: w / 2, z: halfD, rotY: 0, ax: 0, az: -1 };
    case "vrata": case "vrataKrilo": case "prozorVeliki": case "prozorMali":
      return { type, x: w / 2, z: halfD, rotY: 0, ax: 0, az: -1 };
    default:
      return { type, x: mid.x, z: mid.z, rotY: 0, ax: 0, az: 0 };
  }
}

// ---- View state (reset on every render) ------------------------------------
let api = null;          // mountRoom handle
let mountToken = 0;      // guards the async import against teardown races
let products = [];
let room = null;
let assignments = {};
let activeSurface = "floor";
let controls = { pattern: "grid", groutColorId: GROUT_COLORS[0]?.id ?? "siva", groutWidthMm: 3 };
let reserveOn = false;
let designId = null;     // set when opened through ?design= — saving updates in place
let designName = "";
let selectedFixture = null;   // {index, type, label} mirrored from room3d.js

// app.js fires "akv:teardown" on EVERY navigation, including one that happens
// while this view is still awaiting its catalog/three.js imports. Without this
// listener a view abandoned mid-render is never torn down (app.js only calls
// teardown() on the view it managed to finish) and its render loop + WebGL
// context leak for the lifetime of the page.
function onGlobalTeardown() { teardown(); }

export async function render(container) {
  teardown();
  const token = mountToken;                 // teardown() just bumped it
  window.addEventListener("akv:teardown", onGlobalTeardown);
  const alive = () => token === mountToken && container.isConnected;

  room = { ...DEFAULT_ROOM, fixtures: [] };
  assignments = {};
  activeSurface = "floor";
  controls = { pattern: "grid", groutColorId: GROUT_COLORS[0]?.id ?? "siva", groutWidthMm: 3 };
  reserveOn = false;
  designId = null;
  designName = "";
  selectedFixture = null;

  const all = await db.listProducts();
  if (!alive()) return;
  products = all.filter((p) => p.category === "keramika" && Array.isArray(p.tileSizeMm));

  // ?design= — restore a saved 3D room (dizajni.js links here). The hash
  // carries its own query, exactly like the 2D dizajner's share links.
  const wanted = hashQuery().get("design");
  if (wanted) {
    const saved = await db.getDesign(wanted);
    if (!alive()) return;
    if (saved && saved.kind === "room3d") {
      designId = saved.id || null;
      designName = String(saved.name ?? "");
      room = {
        widthM: clampDim(saved.room?.widthM, DEFAULT_ROOM.widthM),
        depthM: clampDim(saved.room?.depthM, DEFAULT_ROOM.depthM),
        heightM: clampDim(saved.room?.heightM, DEFAULT_ROOM.heightM),
        fixtures: sanitizeFixtures(saved.room?.fixtures),
      };
      assignments = sanitizeAssignments(saved.assignments);
    }
  }
  if (!designId) seedStarterRoom();
  adoptControlsFrom(assignments[activeSurface]);

  container.innerHTML = markup();

  wire(container);
  syncActiveStates(container);
  renderFixtureList(container);
  renderEstimate(container);
  renderHud(container);

  // Lazy: three.js + room3d enter the page only on the first 3D render.
  const mod = await import("../room3d.js");
  if (!alive()) return;
  const handle = await mod.mountRoom(container.querySelector("#s3d-stage"), {
    room,
    assignments,
    products,
    onReady: () => container.querySelector("#s3d-loading")?.remove(),
  });
  if (!alive()) { handle.dispose(); return; }   // torn down mid-import
  api = handle;
  // room3d.js runs settle() on every record as it builds it, which derives the
  // wall anchors the saved design may predate. Pull them straight back so the
  // first save records real anchors rather than zeros.
  syncFixturesFromRoom();
}

export function teardown() {
  mountToken++;
  window.removeEventListener("akv:teardown", onGlobalTeardown);
  if (api) { api.dispose(); api = null; }
  selectedFixture = null;
}

// ---- Restore / seed --------------------------------------------------------

// The query of a hash route: "#/soba3d?design=dz-1" -> URLSearchParams.
function hashQuery() {
  const raw = location.hash.slice(1);
  const qi = raw.indexOf("?");
  return new URLSearchParams(qi < 0 ? "" : raw.slice(qi + 1));
}

const productExists = (id) => products.some((p) => p.id === id);

function pickProductId(preferred, fallbackIndex = 0) {
  if (productExists(preferred)) return preferred;
  return products[fallbackIndex]?.id ?? products[0]?.id ?? null;
}

function sanitizeAssignments(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const s of SURFACES) {
    const e = raw[s.id];
    if (!e || typeof e !== "object" || !productExists(e.productId)) continue;
    out[s.id] = {
      productId: e.productId,
      pattern: PATTERNS.some((p) => p.id === e.pattern) ? e.pattern : "grid",
      groutColorId: GROUT_COLORS.some((g) => g.id === e.groutColorId) ? e.groutColorId : (GROUT_COLORS[0]?.id ?? "siva"),
      groutWidthMm: GROUT_WIDTHS_MM.includes(Number(e.groutWidthMm)) ? Number(e.groutWidthMm) : 3,
    };
  }
  return out;
}

// ax/az are the wall anchors that make a fixture follow its wall when the room
// is resized. A design saved before they existed simply has none, so they
// default to 0 (free) and room3d.js derives them on build.
const anchor = (v) => (v === -1 || v === 1 ? v : 0);

function sanitizeFixtures(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((f) => f && FIXTURE_TYPES.some((x) => x.type === f.type))
    .map((f) => ({
      type: f.type,
      x: Number.isFinite(Number(f.x)) ? Number(f.x) : 0,
      z: Number.isFinite(Number(f.z)) ? Number(f.z) : 0,
      rotY: Number.isFinite(Number(f.rotY)) ? Number(f.rotY) : 0,
      ax: anchor(Number(f.ax)),
      az: anchor(Number(f.az)),
    }));
}

// A designed room on first paint: tiled floor + four walls and the three
// fixtures a bathroom always has, so the feature explains itself.
function seedStarterRoom() {
  if (!products.length) return;
  const floorId = pickProductId(STARTER.floorProductId, 0);
  const wallId = pickProductId(STARTER.wallProductId, 1);
  const grout = (id) => (GROUT_COLORS.some((g) => g.id === id) ? id : (GROUT_COLORS[0]?.id ?? "siva"));
  if (floorId) {
    assignments.floor = { productId: floorId, pattern: "grid", groutColorId: grout(STARTER.floorGroutId), groutWidthMm: 3 };
  }
  if (wallId) {
    for (const s of SURFACES) {
      if (s.id === "floor") continue;
      assignments[s.id] = { productId: wallId, pattern: "grid", groutColorId: grout(STARTER.wallGroutId), groutWidthMm: 3 };
    }
  }
  room.fixtures = STARTER.fixtures.map((type) => defaultFixture(type, room));
}

function adoptControlsFrom(a) {
  if (!a) return;
  controls = { pattern: a.pattern, groutColorId: a.groutColorId, groutWidthMm: a.groutWidthMm };
}

/** Pull room3d.js's settled/reflowed placements back into the saved record. */
function syncFixturesFromRoom() {
  const placed = api?.getFixtures?.();
  if (!Array.isArray(placed)) return;
  for (const p of placed) {
    if (!p) continue;
    const f = room.fixtures[p.index];
    if (!f) continue;
    f.x = p.x; f.z = p.z; f.rotY = p.rotY; f.ax = p.ax; f.az = p.az;
  }
}

// ---- Pricing ---------------------------------------------------------------
// Floor = width × depth; each wall = its own run × height. Openings, adhesive
// and labour are out of scope — the note under the figure says so.

function surfaceAreaM2(surfaceId) {
  if (surfaceId === "floor") return room.widthM * room.depthM;
  if (surfaceId === "wallN" || surfaceId === "wallS") return room.widthM * room.heightM;
  return room.depthM * room.heightM;
}

function estimateRows() {
  const rows = [];
  for (const s of SURFACES) {
    const a = assignments[s.id];
    if (!a) continue;
    const product = products.find((p) => p.id === a.productId);
    if (!product) continue;
    const areaM2 = surfaceAreaM2(s.id);
    rows.push({
      surfaceId: s.id,
      product,
      pattern: a.pattern,
      areaM2,
      subtotal: pricePerRoom(product, areaM2),
    });
  }
  return rows;
}

const estimateTotal = (rows) => rows.reduce((sum, r) => sum + r.subtotal, 0);
const withReserve = (total) => Math.round(total * (1 + RESERVE_PCT / 100) * 100) / 100;

// ---- Labels ----------------------------------------------------------------

const surfaceLabel = (s) => esc(tt(s.key, s.hr));
const surfaceLabelById = (id) => {
  const s = SURFACES.find((x) => x.id === id);
  return s ? tt(s.key, s.hr) : id;
};
const patternLabelById = (id) => {
  const p = PATTERNS.find((x) => x.id === id);
  return p ? tt(p.i18nKey, PATTERN_HR[p.id] || p.id) : id;
};
const fixtureLabel = (type) => {
  const f = fixtureSpec(type);
  return f ? tt(f.key, f.hr) : type;
};

// ============================================================================
// Markup
// ============================================================================
// Colour discipline: every hex below is either a pixel-sampled Iris token from
// docs/DESIGN_SYSTEM.md or a shade DERIVED from one and verified numerically.
// The contrast figures in the comments were computed with the WCAG 2.x relative
// luminance formula, not estimated. The two derived tokens are:
//
//   --teal-700  #0E7484  = --teal-600 #139EB1 darkened (×0.756, rounded)
//                          4.87:1 on --paper #F2F2F2, 5.45:1 on #FFFFFF.
//                          White text on it: 5.45:1.  AA at any size.
//   --amber-ink #8A5F2C  = --amber-500 #EAA651 darkened (×0.60, rounded)
//                          5.00:1 on --paper, 5.59:1 on #FFFFFF.
//   --mauve-ink #6E6266  = --mauve-400 #A6979C darkened; 5.83:1 on #FFFFFF.
//                          (--mauve-400 itself is only 2.79:1 and can never
//                          carry small text.)
//
// The reason those exist at all: --teal-600 FAILS as a small-text background.
//   white on --teal-600 = 3.20:1   → 3:1 large-bold only, never body text
//   --ink on --teal-600 = 4.06:1   → still under 4.5:1
//   --teal-600 on --paper = 2.86:1 → not a text colour on light
// so --teal-600 is used ONLY as a 3D scene tint and as a decorative rule here.
// Filled controls use --teal-700.
//
// Anton hazard, measured from the font: Croatian carons (Č Š Ž) reach 1.100em,
// so every Anton line here is line-height ≥ 1.05 and no Anton box is clipped or
// overflow:hidden. Figtree is safe at any line-height.

function markup() {
  return `
    <style>
      /* ---------------------------------------------------------------
         Iris tokens, scoped to this view so it renders correctly whether
         or not css/styles.css has landed its own :root yet.
         --------------------------------------------------------------- */
      .s3d{
        --s3d-paper:#F2F2F2; --s3d-ink:#313131;
        --s3d-teal-600:#139EB1; --s3d-teal-700:#0E7484;
        --s3d-amber-500:#EAA651; --s3d-amber-ink:#8A5F2C;
        --s3d-brown-800:#68340F; --s3d-sky-200:#C0D8F2;
        --s3d-mauve-400:#A6979C; --s3d-mauve-ink:#6E6266;
        --s3d-line:#D8D3D4; --s3d-surface:#FFFFFF;
        /* Glass: --paper pulled 14% toward --sky-200, so the glass is cool and
           teal-leaning rather than grey (design system rule 4). */
        --s3d-glass-tint:235,238,242;
        --s3d-glass-alpha:.68;
        --s3d-glass-blur:18px;
        color:var(--s3d-ink);
      }
      .s3d :where(h1,h2){text-wrap:balance}

      /* Display type — Anton. line-height 1.05 is the measured floor for Č Š Ž
         (carons reach 1.100em); nothing here clips or hides overflow. */
      .s3d-title{
        font-family:var(--font-display,'Anton',system-ui,sans-serif);font-weight:400;
        font-size:clamp(2rem,5vw,3rem);line-height:1.08;letter-spacing:-.015em;
        text-transform:uppercase;margin:0;overflow:visible;
      }
      .s3d-title .s3d-title-accent{color:var(--s3d-teal-700)}  /* 4.87:1 on --paper */
      .s3d-sub{
        font-family:var(--font-text,'Figtree',system-ui,sans-serif);font-weight:300;
        font-size:14px;line-height:1.55;letter-spacing:.02em;margin:8px 0 16px;
        color:var(--s3d-mauve-ink);                            /* 5.83:1 on #FFFFFF */
        max-width:64ch;
      }
      /* Meta / section label — the reference's signature gesture. */
      .s3d-label{
        font-family:var(--font-text,'Figtree',system-ui,sans-serif);
        font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
        color:var(--s3d-mauve-ink);margin:0 0 10px;display:flex;align-items:center;gap:10px;
      }
      .s3d-label::after{content:"";flex:1;height:1px;background:var(--s3d-line)}

      /* ---------------------------------------------------------------
         Stage + the one glass surface in this view
         --------------------------------------------------------------- */
      .s3d-stage{height:clamp(340px,54vh,580px);aspect-ratio:auto;min-height:0;
        border-radius:18px;background:var(--s3d-paper);
        box-shadow:0 10px 30px rgba(93,79,79,.16),0 1px 2px rgba(93,79,79,.12)}
      .s3d-stage canvas{border-radius:18px}

      /* THE canvas HUD — this view's only backdrop-filter surface. */
      .s3d-hud{
        position:absolute;left:12px;right:12px;bottom:12px;z-index:2;
        display:flex;flex-wrap:wrap;gap:8px;align-items:center;
        padding:10px 12px;border-radius:16px;
        background:rgba(235,238,242,.68);
        border:1px solid rgba(255,255,255,.55);
        box-shadow:0 8px 24px rgba(93,79,79,.20),inset 0 1px 0 rgba(255,255,255,.75);
        /* Safari silently drops -webkit-backdrop-filter when it contains a
           var(), so this line is written with LITERAL values on purpose. The
           unprefixed line below carries the token. Do not "tidy" them together. */
        -webkit-backdrop-filter:saturate(1.5) blur(18px);
        backdrop-filter:saturate(1.5) blur(var(--s3d-glass-blur));
        /* CONTRAST, computed not eyeballed. Worst case is the glass composited
           over a pure-black backdrop (the room can show an antracit floor):
             C = .68×(235,238,242) + .32×(0,0,0) = (160,162,165)
             --ink #313131 on that            = 5.07:1  ✔
           Best case, over pure white:
             --ink #313131 on (248,249,250)   = 11.75:1 ✔
           So body text on this panel is AA at any size in every case. Note that
           --teal-700 as TEXT on the glass is only 2.13:1 over black — the accent
           is carried by the rim and by solid fills, never by text colour. */
        color:var(--s3d-ink);
      }
      .s3d-hud[hidden]{display:none}
      .s3d-hud-name{
        font-weight:600;font-size:14px;letter-spacing:.01em;margin-right:auto;
        display:flex;align-items:center;gap:8px;min-width:0;
      }
      .s3d-hud-name .s3d-dot{width:10px;height:10px;border-radius:50%;flex:none;
        background:var(--s3d-teal-600);box-shadow:0 0 0 3px rgba(19,158,177,.22)}
      .s3d-hud-name b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .s3d-hud-pos{font-size:12px;font-weight:500;letter-spacing:.06em;
        color:var(--s3d-ink);opacity:.82;font-variant-numeric:tabular-nums}

      /* Controls ON the glass are SOLID, so their contrast is independent of
         whatever the room shows behind them. */
      .s3d-hbtn{
        min-height:40px;padding:8px 14px;border-radius:11px;border:1px solid transparent;
        font:inherit;font-size:13.5px;font-weight:600;letter-spacing:.02em;cursor:pointer;
        background:#FFFFFF;color:var(--s3d-ink);              /* 13.01:1 */
        box-shadow:0 1px 2px rgba(93,79,79,.18);
      }
      .s3d-hbtn.is-primary{background:var(--s3d-teal-700);color:#FFFFFF}  /* 5.45:1 */
      .s3d-hbtn.is-danger{background:#FFFFFF;color:var(--s3d-amber-ink)}  /* 5.59:1 */
      .s3d-hbtn:hover{border-color:var(--s3d-amber-500)}      /* warm amber rim on hover */
      .s3d-hbtn:focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:2px}

      /* The hint chip is deliberately SOLID: the glass budget for this screen is
         already spent on the HUD (top bar + tab bar are the standing pair). */
      .s3d-hint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);
        max-width:calc(100% - 24px);padding:8px 14px;border-radius:999px;
        background:#EBEEF2;color:var(--s3d-ink);              /* 11.18:1 */
        font-size:13px;font-weight:600;letter-spacing:.01em;
        box-shadow:0 2px 8px rgba(93,79,79,.22);pointer-events:none;text-align:center;z-index:1}
      .s3d-hint.is-gone{opacity:0}

      /* ---- Degradation paths (all four, mandatory) ------------------- */
      @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
        .s3d-hud{background:#EBEEF2}      /* solid tint — --ink on it is 11.18:1 */
      }
      @media (prefers-reduced-transparency:reduce){
        .s3d-hud{background:#EBEEF2;-webkit-backdrop-filter:none;backdrop-filter:none}
      }
      @media (prefers-contrast:more){
        .s3d-hud{background:#FFFFFF;border-color:var(--s3d-ink);
          -webkit-backdrop-filter:none;backdrop-filter:none}
        .s3d-hbtn{border-color:var(--s3d-ink)}
        .s3d-chip,.s3d-fix,.s3d-est,.s3d-prod{border-color:var(--s3d-ink)}
      }
      @media (forced-colors:active){
        .s3d-hud{background:Canvas;border:1px solid CanvasText;
          -webkit-backdrop-filter:none;backdrop-filter:none;forced-color-adjust:none;color:CanvasText}
        .s3d-hbtn{background:ButtonFace;color:ButtonText;border:1px solid ButtonText}
        .s3d-hbtn.is-primary{background:Highlight;color:HighlightText}
        .s3d-chip.is-active{background:Highlight;color:HighlightText;border-color:Highlight}
      }
      @media (prefers-reduced-motion:no-preference){
        .s3d-hint{transition:opacity .35s var(--smooth,ease)}
        .s3d-chip,.s3d-hbtn,.s3d-prod{transition:background-color .18s ease,border-color .18s ease,color .18s ease}
      }
      /* Never animate blur() — it forces a full re-composite every frame. */

      /* ---------------------------------------------------------------
         Solid panels below the stage
         --------------------------------------------------------------- */
      .s3d-section{margin-top:20px}
      .s3d-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .s3d-dim{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;
        letter-spacing:.04em;text-transform:uppercase;color:var(--s3d-mauve-ink)}
      .s3d-dim input,.s3d-dim select{width:88px;min-height:44px;padding:6px 10px;
        border:1px solid var(--s3d-line);border-radius:11px;font:inherit;font-size:15px;
        font-weight:600;letter-spacing:0;text-transform:none;
        background:var(--s3d-surface);color:var(--s3d-ink)}
      .s3d-dim select{width:auto}
      .s3d-dim input:focus-visible,.s3d-dim select:focus-visible{
        outline:3px solid var(--s3d-teal-700);outline-offset:1px}

      .s3d-chip{min-height:44px;padding:8px 15px;border:1px solid var(--s3d-line);border-radius:999px;
        background:var(--s3d-surface);font:inherit;font-size:14px;font-weight:500;
        letter-spacing:.01em;cursor:pointer;color:var(--s3d-ink)}          /* 13.01:1 */
      .s3d-chip:hover{border-color:var(--s3d-amber-500)}
      .s3d-chip.is-active{border-color:var(--s3d-teal-700);background:var(--s3d-teal-700);
        color:#FFFFFF;font-weight:600}                                     /* 5.45:1 */
      .s3d-chip:focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:2px}
      .s3d-chip .s3d-mark{margin-left:6px;font-weight:700;color:var(--s3d-teal-700)}
      .s3d-chip.is-active .s3d-mark{color:#FFFFFF}
      .s3d-add{font-size:13.5px;padding:8px 13px}

      .s3d-grout{width:44px;height:44px;border-radius:50%;border:2px solid var(--s3d-line);cursor:pointer;padding:0}
      .s3d-grout.is-active{border-color:var(--s3d-teal-700);box-shadow:0 0 0 2px var(--s3d-surface) inset}
      .s3d-grout:focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:2px}

      .s3d-drawer{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 10px;-webkit-overflow-scrolling:touch}
      .s3d-prod{flex:0 0 128px;border:2px solid var(--s3d-line);border-radius:14px;background:var(--s3d-surface);
        padding:8px;text-align:left;font:inherit;cursor:pointer;color:var(--s3d-ink);
        box-shadow:0 1px 3px rgba(93,79,79,.14)}
      .s3d-prod.is-active{border-color:var(--s3d-teal-700)}
      .s3d-prod:focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:2px}
      .s3d-prod img{width:112px;height:84px;object-fit:cover;border-radius:9px;display:block}
      .s3d-prod .s3d-pname{font-size:13px;font-weight:600;margin:7px 0 2px;line-height:1.3}
      .s3d-prod .s3d-pmeta{font-size:12px;font-weight:500;letter-spacing:.04em;color:var(--s3d-mauve-ink)}

      .s3d-fixgroup{margin-bottom:10px}
      .s3d-fixgroup>summary{
        cursor:pointer;list-style:none;min-height:44px;display:flex;align-items:center;gap:8px;
        font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
        color:var(--s3d-mauve-ink)}
      .s3d-fixgroup>summary::-webkit-details-marker{display:none}
      .s3d-fixgroup>summary::before{content:"＋";font-weight:700;color:var(--s3d-teal-700)}
      .s3d-fixgroup[open]>summary::before{content:"−"}
      .s3d-fixgroup>summary:focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:2px}

      .s3d-fix{display:flex;align-items:center;gap:6px;min-height:44px;padding:0 6px 0 14px;
        border:1px solid var(--s3d-line);border-radius:999px;background:var(--s3d-surface);
        font-size:14px;color:var(--s3d-ink)}
      .s3d-fix.is-selected{border-color:var(--s3d-teal-700);box-shadow:0 0 0 2px rgba(19,158,177,.22)}
      .s3d-fix .s3d-fixname{background:none;border:0;font:inherit;color:inherit;cursor:pointer;
        padding:0;min-height:44px}
      .s3d-fix button{min-width:44px;min-height:44px;border:0;border-radius:50%;background:none;
        font:inherit;font-size:18px;line-height:1;cursor:pointer;color:var(--s3d-amber-ink)}
      .s3d-fix button:hover{background:rgba(234,166,81,.20);color:var(--s3d-amber-ink)}
      .s3d-fix :focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:2px}

      .s3d-est{background:var(--s3d-surface);border:1px solid var(--s3d-line);
        border-radius:16px;padding:16px}
      .s3d-est-head{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between}
      .s3d-est-total{font-family:var(--font-display,'Anton',system-ui,sans-serif);
        font-size:30px;line-height:1.1;letter-spacing:-.01em;
        color:var(--s3d-teal-700);font-variant-numeric:tabular-nums}         /* 5.45:1 on #FFF */
      .s3d-est-res{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:14px;cursor:pointer}
      .s3d-est-list{list-style:none;margin:12px 0 0;padding:0;font-size:13px}
      .s3d-est-list li{display:flex;flex-wrap:wrap;gap:4px 10px;justify-content:space-between;
        padding:8px 0;border-top:1px solid var(--s3d-line)}
      .s3d-est-list .s3d-est-sum{font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
      .s3d-est-note{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--s3d-mauve-ink)}

      .s3d-save{display:flex;flex-wrap:wrap;gap:8px}
      .s3d-save input{flex:1 1 200px;min-height:44px;padding:6px 14px;border:1px solid var(--s3d-line);
        border-radius:11px;font:inherit;background:var(--s3d-surface);color:var(--s3d-ink)}
      .s3d-save input:focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:1px}
      .s3d-btn{min-height:44px;padding:10px 22px;border:1px solid var(--s3d-line);
        border-radius:11px;background:var(--s3d-surface);font:inherit;font-weight:600;
        font-size:14px;letter-spacing:.02em;cursor:pointer;color:var(--s3d-ink)}
      .s3d-btn:hover{border-color:var(--s3d-amber-500)}
      .s3d-btn:focus-visible{outline:3px solid var(--s3d-teal-700);outline-offset:2px}
      .s3d-btn.is-primary{border-color:var(--s3d-teal-700);background:var(--s3d-teal-700);color:#FFFFFF}
      .s3d-help{margin:10px 0 0;font-size:12.5px;line-height:1.55;color:var(--s3d-mauve-ink)}
      .s3d-help kbd{font:inherit;font-weight:700;color:var(--s3d-ink);
        border:1px solid var(--s3d-line);border-radius:6px;padding:1px 6px;background:var(--s3d-surface)}
    </style>

    <div class="s3d">
      <header class="view-stage">
        <h1 class="s3d-title">${esc(tt("soba3d.title", "3D soba"))}</h1>
      </header>
      <p class="s3d-sub">${esc(tt("soba3d.sub", "Zadajte dimenzije prostorije, dodajte gotovu opremu i povucite je po podu. Obložite svaku površinu pločicama."))}</p>

      <div class="room3d-stage s3d-stage" id="s3d-stage">
        <div class="room3d-loading" id="s3d-loading"><span class="spinner" aria-hidden="true"></span>${esc(tt("soba3d.loading", "Učitavanje 3D prikaza…"))}</div>
        <span class="s3d-hint" id="s3d-hint" aria-hidden="true">${esc(tt("soba3d.hint", "Povucite za okretanje. Dodirnite opremu pa je povucite po podu."))}</span>
        <div class="s3d-hud" id="s3d-hud" hidden role="group" aria-label="${esc(tt("soba3d.hudLabel", "Odabrana oprema"))}"></div>
      </div>
      <p class="s3d-help">${esc(tt("soba3d.moveHint", "Povucite opremu po podu da je premjestite."))}
        ${esc(tt("soba3d.helpTouch", "Na dodirnom zaslonu prvo je dodirnite, pa povucite."))}
        ${esc(tt("soba3d.rotateHint", "Zakreće se u koracima od 90°."))}
        ${esc(tt("soba3d.helpKeys", "Tipkovnica:"))}
        <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> ${esc(tt("soba3d.helpMove", "pomiču odabranu opremu,"))}
        <kbd>R</kbd> ${esc(tt("soba3d.helpRotate", "okreće,"))}
        <kbd>Esc</kbd> ${esc(tt("soba3d.helpEsc", "poništava odabir."))}</p>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.dims", "Dimenzije (m)"))}</p>
        <div class="s3d-row">
          ${dimInput("widthM", tt("soba3d.width", "Širina"))}
          ${dimInput("depthM", tt("soba3d.depth", "Dubina"))}
          ${dimInput("heightM", tt("soba3d.height", "Visina"))}
        </div>
      </section>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.estimate", "Procjena cijene"))}</p>
        <div class="s3d-est">
          <div class="s3d-est-head">
            <span class="s3d-est-total" id="s3d-est-total" role="status">—</span>
            <label class="s3d-est-res">
              <input type="checkbox" id="s3d-reserve"${reserveOn ? " checked" : ""}>
              ${esc(tt("soba3d.reserve", "+10% rezerve"))}
            </label>
          </div>
          <ul class="s3d-est-list" id="s3d-est-list"></ul>
          <p class="s3d-est-note">${esc(tt("soba3d.estimateNote", "Informativna procjena za pločice po m². Ne uključuje otvore, ljepilo, fugu, opremu ni ugradnju."))}</p>
        </div>
      </section>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.fixtures", "Oprema"))}</p>
        <div id="s3d-fix-add">
          ${FIXTURE_GROUPS.map(fixtureGroupMarkup).join("")}
        </div>
        <div class="s3d-row" id="s3d-fix-list" style="margin-top:12px"></div>
      </section>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.surfaces", "Površina"))}</p>
        <div class="s3d-row" id="s3d-surfaces">
          ${SURFACES.map((s) => `<button type="button" class="s3d-chip" data-surface="${s.id}" aria-pressed="false"><span class="s3d-sname">${surfaceLabel(s)}</span></button>`).join("")}
        </div>
      </section>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.products", "Pločice"))}</p>
        <div class="s3d-drawer" id="s3d-drawer">
          ${products.length ? products.map(productCard).join("") : `<p class="s3d-sub">${esc(tt("soba3d.empty", "Nema proizvoda u katalogu."))}</p>`}
        </div>
      </section>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.pattern", "Uzorak polaganja"))}</p>
        <div class="s3d-row" id="s3d-patterns">
          ${PATTERNS.map((p) => `<button type="button" class="s3d-chip" data-pattern="${p.id}" aria-pressed="false">${esc(tt(p.i18nKey, PATTERN_HR[p.id] || p.id))}</button>`).join("")}
        </div>
      </section>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.grout", "Fuga"))}</p>
        <div class="s3d-row">
          <span id="s3d-grouts" class="s3d-row">
            ${GROUT_COLORS.map((g) => `<button type="button" class="s3d-grout" data-grout="${g.id}" aria-pressed="false" style="background:${g.hex}" title="${esc(tt(g.i18nKey, GROUT_HR[g.id] || g.id))}" aria-label="${esc(tt(g.i18nKey, GROUT_HR[g.id] || g.id))}"></button>`).join("")}
          </span>
          <label class="s3d-dim">${esc(tt("soba3d.groutWidth", "Širina fuge"))}
            <select id="s3d-grout-w">
              ${GROUT_WIDTHS_MM.map((mm) => `<option value="${mm}"${mm === controls.groutWidthMm ? " selected" : ""}>${mm} mm</option>`).join("")}
            </select>
          </label>
        </div>
      </section>

      <section class="s3d-section">
        <p class="s3d-label">${esc(tt("soba3d.saveTitle", "Spremi dizajn"))}</p>
        <div class="s3d-save">
          <input id="s3d-name" type="text" value="${esc(designName || tt("soba3d.defaultName", "Moja 3D soba"))}" maxlength="60" aria-label="${esc(tt("soba3d.nameLabel", "Naziv dizajna"))}">
          <button type="button" class="s3d-btn is-primary" id="s3d-save">${esc(tt("soba3d.save", "Spremi"))}</button>
          <button type="button" class="s3d-btn" id="s3d-quote">${esc(tt("soba3d.quote", "Zatraži ponudu"))}</button>
        </div>
      </section>
    </div>`;
}

function fixtureGroupMarkup(g, i) {
  return `
    <details class="s3d-fixgroup"${i === 0 ? " open" : ""}>
      <summary>${esc(tt(g.key, g.hr))}</summary>
      <div class="s3d-row" style="margin-top:8px">
        ${g.items.map((f) => `<button type="button" class="s3d-chip s3d-add" data-add-fixture="${f.type}">+ ${esc(tt(f.key, f.hr))}</button>`).join("")}
      </div>
    </details>`;
}

function dimInput(prop, label) {
  return `
    <label class="s3d-dim">${esc(label)}
      <input type="number" min="${DIM_MIN}" max="${DIM_MAX}" step="0.1" value="${room[prop]}" data-dim="${prop}" inputmode="decimal">
    </label>`;
}

function productCard(p) {
  const size = p.tileSizeMm ? `${p.tileSizeMm[0] / 10}×${p.tileSizeMm[1] / 10} cm` : "";
  const price = p.priceM2 != null ? `${formatEur(p.priceM2)}/m²` : "";
  return `
    <button type="button" class="s3d-prod" data-product="${esc(p.id)}" aria-pressed="false">
      <img src="${swatchDataUrl(p, 256)}" alt="">
      <span class="s3d-pname">${esc(p.name)}</span>
      <span class="s3d-pmeta">${esc([size, price].filter(Boolean).join(" · "))}</span>
    </button>`;
}

// ---- Wiring ----------------------------------------------------------------

function wire(container) {
  container.querySelectorAll("[data-dim]").forEach((input) =>
    input.addEventListener("change", () => {
      const v = clampDim(input.value, room[input.dataset.dim]);
      input.value = String(v);
      room[input.dataset.dim] = v;
      api?.setDims(room.widthM, room.depthM, room.heightM);
      // setDims REFLOWS rather than re-centres: free fixtures keep their world
      // position and are re-clamped, wall-anchored ones follow their wall. Read
      // the result back so the saved record matches what is on screen.
      syncFixturesFromRoom();
      renderEstimate(container);
      renderHud(container);
    }));

  container.querySelectorAll("[data-add-fixture]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const type = btn.dataset.addFixture;
      room.fixtures.push(defaultFixture(type, room));
      api?.setFixtures(room.fixtures);
      syncFixturesFromRoom();
      api?.selectByIndex(room.fixtures.length - 1);
      renderFixtureList(container);
      window.AKV?.toast?.(`${fixtureLabel(type)} — ${tt("soba3d.moveHint", "Povucite opremu po podu da je premjestite.")}`);
    }));

  container.querySelectorAll("[data-surface]").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeSurface = btn.dataset.surface;
      const a = assignments[activeSurface];
      if (a) {
        adoptControlsFrom(a);
        container.querySelector("#s3d-grout-w").value = String(a.groutWidthMm);
      }
      syncActiveStates(container);
    }));

  container.querySelectorAll("[data-product]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const product = products.find((p) => p.id === btn.dataset.product);
      if (product) assign(container, product);
    }));

  container.querySelectorAll("[data-pattern]").forEach((btn) =>
    btn.addEventListener("click", () => {
      controls.pattern = btn.dataset.pattern;
      reapply(container);
    }));

  container.querySelectorAll("[data-grout]").forEach((btn) =>
    btn.addEventListener("click", () => {
      controls.groutColorId = btn.dataset.grout;
      reapply(container);
    }));

  container.querySelector("#s3d-grout-w").addEventListener("change", (e) => {
    controls.groutWidthMm = parseInt(e.target.value, 10) || 3;
    reapply(container);
  });

  container.querySelector("#s3d-reserve").addEventListener("change", (e) => {
    reserveOn = !!e.target.checked;
    renderEstimate(container);
  });

  const stage = container.querySelector("#s3d-stage");

  // The stage's hint chip retires the moment the room is actually touched
  // (room3d.js announces the intent gate opening).
  stage.addEventListener("akv:room-armed", () => {
    const hint = container.querySelector("#s3d-hint");
    if (!hint) return;
    hint.classList.add("is-gone");
    setTimeout(() => hint.remove(), 400);
  });

  // room3d.js owns the drag; this view owns the record.
  stage.addEventListener("akv:fixture-selected", (e) => {
    selectedFixture = e.detail || null;
    renderHud(container);
    markSelectedInList(container);
  });

  stage.addEventListener("akv:fixture-moved", (e) => {
    const d = e.detail;
    const f = room.fixtures[d.index];
    if (!f) return;
    f.x = d.x; f.z = d.z; f.rotY = d.rotY; f.ax = d.ax; f.az = d.az;
    // Deliberately NOT api.setFixtures(): that rebuilds every group and would
    // drop the model the user is holding.
    renderHud(container);
  });

  container.querySelector("#s3d-save").addEventListener("click", async () => {
    const name = container.querySelector("#s3d-name").value.trim() || tt("soba3d.defaultName", "Moja 3D soba");
    syncFixturesFromRoom();
    const stored = await db.saveDesign({
      // Reopened designs update in place instead of piling up duplicates.
      id: designId || undefined,
      kind: "room3d",
      refId: null,
      name,
      assignments,
      room: {
        widthM: room.widthM,
        depthM: room.depthM,
        heightM: room.heightM,
        fixtures: room.fixtures.map((f) => ({ ...f })),
      },
    });
    designId = stored?.id ?? designId;
    designName = name;
    window.AKV?.toast?.(tt("soba3d.saved", "Dizajn je spremljen."));
  });

  container.querySelector("#s3d-quote").addEventListener("click", () => {
    requestQuote(container);
  });
}

// ---- The canvas HUD --------------------------------------------------------
// Rebuilt on selection change and after every move, so the read-out is the
// actual placement rather than a stale one.

function renderHud(container) {
  const hud = container.querySelector("#s3d-hud");
  if (!hud) return;
  if (!selectedFixture) {
    hud.hidden = true;
    hud.innerHTML = "";
    return;
  }
  const f = room.fixtures[selectedFixture.index];
  // The view resolves the label itself: js/i18n.js is the authority for copy,
  // and room3d.js only carries an inline fallback for its own aria-label.
  const name = fixtureLabel(selectedFixture.type) || selectedFixture.label;
  const pos = f
    ? `${fmtM(f.x)} × ${fmtM(f.z)} m`
    : "";
  hud.hidden = false;
  hud.innerHTML = `
    <span class="s3d-hud-name">
      <span class="s3d-dot" aria-hidden="true"></span>
      <b>${esc(name)}</b>
      <span class="s3d-hud-pos">${esc(pos)}</span>
    </span>
    <button type="button" class="s3d-hbtn is-primary" id="s3d-rot"
      aria-label="${esc(tt("soba3d.rotateStep", "Zakreni za 90°"))}"
      aria-keyshortcuts="R">${esc(tt("soba3d.rotateStep", "Zakreni za 90°"))}</button>
    <button type="button" class="s3d-hbtn is-danger" id="s3d-del">${esc(tt("soba3d.remove", "Ukloni"))}</button>
    <button type="button" class="s3d-hbtn" id="s3d-done">${esc(tt("soba3d.deselect", "Poništi odabir"))}</button>`;

  hud.querySelector("#s3d-rot").addEventListener("click", () => {
    api?.rotateSelected(Math.PI / 2);
    renderHud(container);
  });
  hud.querySelector("#s3d-del").addEventListener("click", () => {
    const i = selectedFixture.index;
    const label = fixtureLabel(room.fixtures[i]?.type);
    api?.clearSelection();
    room.fixtures.splice(i, 1);
    api?.setFixtures(room.fixtures);
    renderFixtureList(container);
    renderHud(container);
    window.AKV?.toast?.(`${label} — ${tt("soba3d.removed", "uklonjeno")}`);
  });
  hud.querySelector("#s3d-done").addEventListener("click", () => {
    api?.clearSelection();
  });
}

function assign(container, product) {
  assignments[activeSurface] = {
    productId: product.id,
    pattern: controls.pattern,
    groutColorId: controls.groutColorId,
    groutWidthMm: controls.groutWidthMm,
  };
  pushSurface(product);
  syncActiveStates(container);
  renderEstimate(container);
}

// Pattern/grout change re-applies to the active surface only when it already
// has a product — picking controls first, tile second also works.
function reapply(container) {
  const a = assignments[activeSurface];
  if (a) {
    a.pattern = controls.pattern;
    a.groutColorId = controls.groutColorId;
    a.groutWidthMm = controls.groutWidthMm;
    const product = products.find((p) => p.id === a.productId);
    if (product) pushSurface(product);
  }
  syncActiveStates(container);
}

function pushSurface(product) {
  api?.setSurface(activeSurface, product, {
    pattern: controls.pattern,
    groutColorHex: GROUT_COLORS.find((g) => g.id === controls.groutColorId)?.hex,
    groutColorId: controls.groutColorId,
    groutWidthMm: controls.groutWidthMm,
  });
}

function syncActiveStates(container) {
  container.querySelectorAll("[data-surface]").forEach((btn) => {
    const isActive = btn.dataset.surface === activeSurface;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    // "Tiled" is a state, not a success — a checkmark plus a spoken suffix,
    // never a green dot carrying the meaning on its own.
    const has = Boolean(assignments[btn.dataset.surface]);
    let mark = btn.querySelector(".s3d-mark");
    if (has && !mark) {
      mark = document.createElement("span");
      mark.className = "s3d-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✓";
      btn.appendChild(mark);
    }
    if (!has && mark) mark.remove();
    const name = surfaceLabelById(btn.dataset.surface);
    btn.setAttribute("aria-label", has
      ? `${name} — ${tt("soba3d.tiled", "pločice odabrane")}`
      : `${name} — ${tt("soba3d.untiled", "bez pločica")}`);
  });
  const currentAssignment = assignments[activeSurface];
  container.querySelectorAll("[data-product]").forEach((btn) => {
    const on = currentAssignment?.productId === btn.dataset.product;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  container.querySelectorAll("[data-pattern]").forEach((btn) => {
    const on = btn.dataset.pattern === controls.pattern;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  container.querySelectorAll("[data-grout]").forEach((btn) => {
    const on = btn.dataset.grout === controls.groutColorId;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function markSelectedInList(container) {
  container.querySelectorAll("[data-fixture-index]").forEach((el) => {
    const on = selectedFixture && Number(el.dataset.fixtureIndex) === selectedFixture.index;
    el.classList.toggle("is-selected", !!on);
    const btn = el.querySelector(".s3d-fixname");
    if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function renderFixtureList(container) {
  const box = container.querySelector("#s3d-fix-list");
  if (!box) return;
  box.innerHTML = room.fixtures.map((f, i) => {
    const name = fixtureLabel(f.type);
    return `
      <span class="s3d-fix" data-fixture-index="${i}">
        <button type="button" class="s3d-fixname" data-pick-fixture="${i}" aria-pressed="false"
          aria-label="${esc(t("soba3d.selected", { name }) === "soba3d.selected" ? `Odabrano: ${name}` : t("soba3d.selected", { name }))}">${esc(name)}</button>
        <button type="button" data-rm-fixture="${i}" aria-label="${esc(`${tt("soba3d.remove", "Ukloni")}: ${name}`)}">×</button>
      </span>`;
  }).join("");
  box.querySelectorAll("[data-pick-fixture]").forEach((btn) =>
    btn.addEventListener("click", () => {
      api?.selectByIndex(parseInt(btn.dataset.pickFixture, 10));
    }));
  box.querySelectorAll("[data-rm-fixture]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.rmFixture, 10);
      api?.clearSelection();
      room.fixtures.splice(i, 1);
      api?.setFixtures(room.fixtures);
      renderFixtureList(container);
      renderHud(container);
    }));
  markSelectedInList(container);
}

// ---- Live estimate ---------------------------------------------------------

function renderEstimate(container) {
  const totalEl = container.querySelector("#s3d-est-total");
  const listEl = container.querySelector("#s3d-est-list");
  if (!totalEl || !listEl) return;

  const rows = estimateRows();
  const total = estimateTotal(rows);
  const shown = reserveOn ? withReserve(total) : total;

  totalEl.textContent = rows.length
    ? formatEur(shown)
    : tt("soba3d.estimateEmpty", "Odaberite pločice");

  listEl.innerHTML = rows.map((r) => `
    <li>
      <span class="s3d-est-what">${esc(`${surfaceLabelById(r.surfaceId)} · ${r.product.name} · ${patternLabelById(r.pattern)} · ${fmtArea(r.areaM2)} m²`)}</span>
      <span class="s3d-est-sum">${esc(formatEur(r.subtotal))}</span>
    </li>`).join("");
}

// ---- Quote (mailto — no backend needed in demo mode) -----------------------

function quoteSummary() {
  const rows = estimateRows();
  const total = estimateTotal(rows);
  const lines = [];
  lines.push(tt("soba3d.quoteIntro", "Poštovani, molim ponudu za sljedeću prostoriju:"));
  lines.push("");
  lines.push(`${tt("soba3d.dims", "Dimenzije (m)")}: ${fmtM(room.widthM)} × ${fmtM(room.depthM)} × ${fmtM(room.heightM)} m`);
  lines.push("");
  if (rows.length) {
    lines.push(`${tt("soba3d.surfaces", "Površina")}:`);
    for (const r of rows) {
      lines.push(`- ${surfaceLabelById(r.surfaceId)}: ${r.product.name} (${patternLabelById(r.pattern)}) — ${fmtArea(r.areaM2)} m² — ${formatEur(r.subtotal)}`);
    }
    lines.push("");
    lines.push(`${tt("soba3d.estimate", "Procjena cijene")}: ${formatEur(total)}`);
    lines.push(`${tt("soba3d.reserve", "+10% rezerve")}: ${formatEur(withReserve(total))}`);
  } else {
    lines.push(tt("soba3d.quoteNoTiles", "Pločice još nisu odabrane."));
  }
  if (room.fixtures.length) {
    lines.push("");
    lines.push(`${tt("soba3d.fixtures", "Oprema")}:`);
    for (const f of room.fixtures) {
      lines.push(`- ${fixtureLabel(f.type)} — ${fmtM(f.x)} m ${tt("soba3d.fromWest", "od zapadnog zida")}, ${fmtM(f.z)} m ${tt("soba3d.fromNorth", "od sjevernog zida")}`);
    }
  }
  lines.push("");
  lines.push(tt("soba3d.quoteNote", "Procjena je informativna i ne uključuje ugradnju."));
  lines.push(location.href);
  return lines.join("\n");
}

function requestQuote(container) {
  const subject = `${tt("soba3d.quoteSubject", "Upit za ponudu")} — ${container.querySelector("#s3d-name")?.value.trim() || tt("soba3d.title", "3D soba")}`;
  const href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(quoteSummary())}`;
  window.location.href = href;
  window.AKV?.toast?.(tt("soba3d.quoteSent", "Otvaramo poruku s vašim odabirom."));
}
