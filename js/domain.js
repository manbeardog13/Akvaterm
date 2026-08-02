// ============================================================================
// domain.js — pure catalog/room rules: categories, laying patterns, grout
// colors, the physical-scale pattern-cell math, pricing and formatting.
// No DOM, no storage, no network — everything here is testable in isolation.
// UI labels are i18n keys; rendering them is the views' job.
// ============================================================================

export const CATEGORIES = [
  { id: "keramika",   icon: "🧱", i18nKey: "cat.keramika" },
  { id: "sanitarije", icon: "🚿", i18nKey: "cat.sanitarije" },
  { id: "armature",   icon: "🚰", i18nKey: "cat.armature" },
  { id: "grijanje",   icon: "🔥", i18nKey: "cat.grijanje" },
  { id: "klima",      icon: "❄️", i18nKey: "cat.klima" },
];

export const PATTERNS = [
  { id: "grid",        i18nKey: "pattern.grid" },
  { id: "runningBond", i18nKey: "pattern.runningBond" },
  { id: "herringbone", i18nKey: "pattern.herringbone" },
  { id: "diagonal",    i18nKey: "pattern.diagonal" },
];

export const GROUT_COLORS = [
  { id: "bijela",   hex: "#e8e6e1", i18nKey: "grout.bijela" },
  { id: "siva",     hex: "#9a9a9a", i18nKey: "grout.siva" },
  { id: "antracit", hex: "#3a3a3a", i18nKey: "grout.antracit" },
];

// ---- Pattern-cell physical scale ------------------------------------------
// The repeatable unit of a laid surface: cell = (tile + grout) × tile-count
// per axis (RESEARCH.md §3). Renderers divide the surface's real size by this
// to get texture repeat counts, so 2D and 3D stay in true scale.
//
// This module is the SINGLE source of the cell math: js/texture.js imports
// `patternCellMm`, `herringboneUnit` and `diagonalUnit` and lays its tiles on
// exactly these pitches, so the advertised cell and the drawn layout can never
// disagree (they did, by 2×, before this was unified).
//
// Per pattern:
//   grid         1×1 tile          → [(w+g), (h+g)]
//   runningBond  2 rows, half off  → [(w+g), 2·(h+g)] — the second row is
//                                    shifted half a tile; the repeat is 2 rows
//   herringbone  2-tile L units    → square of side 2·n·b, see herringboneUnit
//   diagonal     grid rotated 45°  → square of side √2·p·ph, see diagonalUnit
//
// The return value is the contract's [w, h] array; an extra `rotationDeg`
// property rides along. It is 0 for every pattern: the diagonal rotation is
// baked into the cell (the tiles inside it are drawn at 45°), so a renderer
// must NOT rotate the fill again.
// Non-tile products (tileSizeMm null) get a neutral 1 m × 1 m cell.

const DEFAULT_TILE_MM = [600, 600];
const RATIO_TERM_MAX = 8;   // bound on the p/q snap of the diagonal lattice

function normTile(tileSizeMm) {
  const w = Number(Array.isArray(tileSizeMm) ? tileSizeMm[0] : NaN);
  const h = Number(Array.isArray(tileSizeMm) ? tileSizeMm[1] : NaN);
  return [
    Number.isFinite(w) && w > 0 ? w : DEFAULT_TILE_MM[0],
    Number.isFinite(h) && h > 0 ? h : DEFAULT_TILE_MM[1],
  ];
}
const normGrout = (g) => Math.max(0, Number(g) || 0);

// Nearest p/q to a positive ratio with both terms <= limit (ties prefer the
// smaller product, i.e. the smaller repeat cell).
function snapRatio(ratio, limit = RATIO_TERM_MAX) {
  const r = Number(ratio);
  const target = Math.min(limit, Math.max(1 / limit, Number.isFinite(r) && r > 0 ? r : 1));
  let best = { p: 1, q: 1, err: Infinity };
  for (let q = 1; q <= limit; q++) {
    const p = Math.min(limit, Math.max(1, Math.round(target * q)));
    const err = Math.abs(p / q - target);
    if (err < best.err - 1e-12 || (Math.abs(err - best.err) <= 1e-12 && p * q < best.p * best.q)) {
      best = { p, q, err };
    }
  }
  return { p: best.p, q: best.q };
}

/**
 * Herringbone unit. Tiles are laid as L-pairs on the pitch a × b (long × short
 * side + grout): the lattice m·(−b, b) + k·(a+b, a−b) covers the plane exactly
 * once. It only has a finite axis-aligned period when a/b is rational with
 * small terms, so — exactly like the diagonal lattice — the pitch is nudged
 * onto the nearest p/q with both terms ≤ 8, the error split evenly over both
 * axes (≤ 1% for every seed format). The old code instead rounded the aspect
 * to a whole number ≥ 2, which drew a 600×600 tile as a 1203×600 domino
 * (twice its real length) and a 610×406 tile as a 406×406 square.
 * Period 2·p·b = 2·q·a, holding exactly 4·p·q tiles. A square tile gives
 * p = q = 1, i.e. the plain grid — square tiles cannot be laid in herringbone
 * and that is the honest rendering.
 */
export function herringboneUnit(tileSizeMm, groutWidthMm = 3) {
  const [tw, th] = normTile(tileSizeMm);
  const g = normGrout(groutWidthMm);
  const a0 = Math.max(tw, th) + g, b0 = Math.min(tw, th) + g;
  const { p, q } = snapRatio(a0 / b0);
  const f = Math.sqrt((p / q) / (a0 / b0));   // (a0·f) / (b0/f) === p/q
  const a = a0 * f, b = b0 / f;
  return { a, b, p, q, periodMm: 2 * p * b };
}

/**
 * Diagonal unit: the true tw×th grid rotated 45°, NOT an averaged square (a
 * 300×100 metro tile used to be redrawn as a 200×200 square). A 45°-rotated
 * rectangular lattice only has a finite axis-aligned period when the pitch
 * ratio is rational with small terms, so the pitch is nudged onto the nearest
 * p/q with both terms ≤ 8 — the error is split evenly over both axes and stays
 * around 1% for every seed format. Period √2·p·ph = √2·q·pw, holding exactly
 * 2·p·q tiles.
 */
export function diagonalUnit(tileSizeMm, groutWidthMm = 3) {
  const [tw, th] = normTile(tileSizeMm);
  const g = normGrout(groutWidthMm);
  const pw0 = tw + g, ph0 = th + g;
  const { p, q } = snapRatio(pw0 / ph0);
  const f = Math.sqrt((p / q) / (pw0 / ph0));   // pw·f / (ph/f) === p/q
  const pw = pw0 * f, ph = ph0 / f;
  return { pw, ph, p, q, periodMm: Math.SQRT2 * p * ph };
}

/** The repeat period of a laid surface in MILLIMETRES — [w, h]. */
export function patternCellMm(product, pattern, groutWidthMm = 3) {
  const patternId = typeof pattern === "string" ? pattern : pattern?.id;
  const size = product?.tileSizeMm;
  if (!Array.isArray(size) || size.length < 2) return [1000, 1000];
  const g = normGrout(groutWidthMm);
  const w = normTile(size)[0] + g, h = normTile(size)[1] + g;
  switch (patternId) {
    case "runningBond":
      return [w, 2 * h];
    case "herringbone": {
      const { periodMm } = herringboneUnit(size, g);
      return [periodMm, periodMm];
    }
    case "diagonal": {
      const { periodMm } = diagonalUnit(size, g);
      return [periodMm, periodMm];
    }
    default:             // "grid" and anything unknown falls back to grid
      return [w, h];
  }
}

/** The same period in METRES — the contract surface. */
export function cellMeters(product, pattern, groutWidthMm = 3) {
  const mm = patternCellMm(product, pattern, groutWidthMm);
  const cell = [mm[0] / 1000, mm[1] / 1000];
  cell.rotationDeg = 0;   // rotation is baked into the cell, never re-applied
  return cell;
}

// ---- Pricing ---------------------------------------------------------------
// Tiles (unit "m2") price by covered area; equipment (unit "kom") prices per
// piece regardless of room size. Unknown pricing yields 0 — views show it as
// price-on-request rather than crashing.
export function pricePerRoom(product, areaM2) {
  if (!product) return 0;
  const area = Math.max(0, Number(areaM2) || 0);
  if (product.unit === "m2" && Number.isFinite(product.priceM2)) {
    return Math.round(product.priceM2 * area * 100) / 100;
  }
  if (Number.isFinite(product.priceUnit)) return product.priceUnit;
  return 0;
}

// Croatian EUR formatting: thousands dot, decimal comma, trailing € —
// "1.234,56 €". Formatted by hand so the output is byte-stable everywhere
// (Intl inserts a non-breaking space on some engines).
// The sign is decided AFTER rounding, so -0.001 formats as "0,00 €" and never
// as the nonsense "-0,00 €".
export function formatEur(n) {
  const value = Number(n);
  const safe = Number.isFinite(value) ? value : 0;
  const [whole, cents] = Math.abs(safe).toFixed(2).split(".");
  const negative = safe < 0 && (whole !== "0" || cents !== "00");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped},${cents} €`;
}

// ---- Ordering ---------------------------------------------------------------
// "Koliko naručiti?" — the reserve a tiler adds on top of the measured area for
// cuts and breakage. Diagonal and herringbone lay-ups cut far more tile at the
// edges, so they carry the higher 15% the advisor FAQ teaches; everything else
// gets the standard 10%.
// Pure function, no DOM: {areaM2, reservePct, totalM2} (+ boxes when the
// product declares a box coverage — no seed product does yet, so the field is
// simply absent rather than guessed).
const HIGH_WASTE_PATTERNS = new Set(["herringbone", "diagonal"]);
const round2 = (n) => Math.round(n * 100) / 100;

export function orderEstimate(product, areaM2, pattern) {
  const patternId = typeof pattern === "string" ? pattern : pattern?.id;
  const area = round2(Math.max(0, Number(areaM2) || 0));
  // Products sold per piece (unit "kom") are not ordered by area — no reserve.
  const byArea = !product || product.unit === "m2" || Array.isArray(product?.tileSizeMm);
  const reservePct = byArea ? (HIGH_WASTE_PATTERNS.has(patternId) ? 15 : 10) : 0;
  const totalM2 = round2(area * (1 + reservePct / 100));
  const out = { areaM2: area, reservePct, totalM2 };
  const perBox = Number(product?.boxM2 ?? product?.m2PerBox);
  if (Number.isFinite(perBox) && perBox > 0) out.boxes = Math.ceil(totalM2 / perBox);
  return out;
}

// ---- Ids -------------------------------------------------------------------
// Sortable-ish unique ids: prefix, base36 timestamp, an in-session counter
// (same-millisecond safety) and a random tail. Pure function of time+chance;
// no storage touched.
let idSeq = 0;
export function newId(prefix = "id") {
  idSeq = (idSeq + 1) % 1296;
  const stamp = Date.now().toString(36);
  const seq = idSeq.toString(36).padStart(2, "0");
  const tail = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}${seq}-${tail}`;
}
