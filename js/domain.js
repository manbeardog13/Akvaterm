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
// The repeatable unit of a laid surface, in meters: cell = (tile + grout) ×
// tile-count per axis (RESEARCH.md §3). Renderers divide the surface's real
// size by this to get texture repeat counts, so 2D and 3D stay in true scale.
//
// Per pattern:
//   grid         1×1 tile          → [(w+g), (h+g)]
//   runningBond  2 rows, half off  → [(w+g), 2·(h+g)] — the second row is
//                                    shifted half a tile; the repeat is 2 rows
//   herringbone  2-tile L units    → square of side 2·(long+g). The L unit is
//                                    one horizontal + one vertical tile; four
//                                    interlocked L units (8 tiles) form the
//                                    smallest axis-aligned square repeat. This
//                                    is exact for the 2:1 formats herringbone
//                                    is physically laid in, and the closest
//                                    square repeat for anything else.
//   diagonal     grid rotated 45°  → the grid cell, with rotationDeg = 45 so
//                                    renderers rotate the fill/texture instead
//                                    of inflating the cell by √2
//
// The return value is the contract's [w, h] array; a non-enumerable-ish extra
// `rotationDeg` property rides along as the rotation hint (0 except diagonal).
// Non-tile products (tileSizeMm null) get a neutral 1 m × 1 m cell.
export function cellMeters(product, pattern, groutWidthMm = 3) {
  const patternId = typeof pattern === "string" ? pattern : pattern?.id;
  const size = product?.tileSizeMm;
  let cell;
  let rotationDeg = 0;
  if (!Array.isArray(size) || size.length < 2) {
    cell = [1, 1];
  } else {
    const g = Math.max(0, Number(groutWidthMm) || 0);
    const w = (Number(size[0]) + g) / 1000;
    const h = (Number(size[1]) + g) / 1000;
    switch (patternId) {
      case "runningBond": {
        cell = [w, 2 * h];
        break;
      }
      case "herringbone": {
        const side = 2 * Math.max(w, h);
        cell = [side, side];
        break;
      }
      case "diagonal": {
        cell = [w, h];
        rotationDeg = 45;
        break;
      }
      default: {           // "grid" and anything unknown falls back to grid
        cell = [w, h];
      }
    }
  }
  cell.rotationDeg = rotationDeg;
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
export function formatEur(n) {
  const value = Number(n);
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;
  const [whole, cents] = Math.abs(safe).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped},${cents} €`;
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
