// ============================================================================
// texture.js — deterministic procedural tile textures + the shared pattern
// cell. Everything is seeded from product.id through a mulberry32 PRNG, so the
// same product always renders the same surface on every device, with zero
// image assets.
//
//   fillStyles                  generator registry keyed by product.textureKind
//   buildPatternCell(product, {pattern, groutColorHex, groutWidthMm,
//                              scalePxPerMm}) -> { canvas, cellSizeMm }
//                               the repeatable unit incl. grout — 2D scenes use
//                               it via ctx.createPattern, 3D via CanvasTexture
//   swatchDataUrl(product, sizePx=256) -> string   cached catalog swatch
//
// Cell math: the base period comes from domain.cellMeters() (metres -> mm; an
// internal fallback covers a missing/invalid result). grid and runningBond
// cells are doubled to 2x2 / 2x1 base periods so neighbouring tiles can carry
// slight per-tile tone variation without visible repetition. Herringbone lays
// tiles as n:1 dominoes on the short pitch b = min(tileSize) + grout with n
// snapped to the tile aspect (exact period 2nb x 2nb); diagonal uses a
// 45°-rotated square lattice on the averaged pitch.
// Both lattices are verified to cover the plane exactly once and repeat with
// the claimed period. Per-tile seeds derive from the tile position modulo the
// cell, so tiles that straddle a cell edge match their wrapped copies exactly.
// ============================================================================
import { cellMeters } from "./domain.js";

const TAU = Math.PI * 2;
const SQRT2 = Math.SQRT2;
const DEFAULT_TILE_MM = [600, 600];
const MAX_CELL_PX = 2048;

// ---- deterministic randomness -------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const seedFor = (product) => hashStr(String(product?.id ?? "akv"));

// ---- small colour helpers -----------------------------------------------------
function hexToRgb(hex) {
  let s = String(hex || "#cccccc").replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [204, 204, 204];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
// amt in -1..1: negative blends toward black, positive toward white
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const target = amt < 0 ? 0 : 255, f = Math.min(1, Math.abs(amt));
  const c = (v) => Math.round(v + (target - v) * f);
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
function isDark(hex) { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45; }

// ---- shared drawing helpers ---------------------------------------------------
// Midpoint-displacement polyline: the backbone of marble veins.
function veinPath(rand, x0, y0, x1, y1, depth, amp) {
  let pts = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const off = (rand() - 0.5) * 2 * amp;
      next.push([(ax + bx) / 2 - (dy / len) * off, (ay + by) / 2 + (dx / len) * off], [bx, by]);
    }
    pts = next; amp *= 0.55;
  }
  return pts;
}

function strokePolyline(ctx, pts, color, width, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

function speckle(ctx, w, h, rand, base, count, alpha) {
  const dark = shade(base, -0.22), light = shade(base, 0.28);
  for (let i = 0; i < count; i++) {
    const r = 0.4 + rand() * Math.min(w, h) * 0.006;
    ctx.globalAlpha = alpha * (0.5 + rand() * 0.5);
    ctx.fillStyle = rand() > 0.5 ? dark : light;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Diagonal gloss band — the one depth cue a glossy tile gets.
function sheen(ctx, w, h, rand, strength) {
  const ang = rand() * TAU;
  const r = Math.hypot(w, h) / 2;
  const cx = w / 2, cy = h / 2;
  const grad = ctx.createLinearGradient(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.42, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, `rgba(255,255,255,${strength})`);
  grad.addColorStop(0.58, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function softBlobs(ctx, w, h, rand, count, lightA, darkA, rMin, rMax) {
  const m = Math.min(w, h);
  for (let i = 0; i < count; i++) {
    const cx = rand() * w, cy = rand() * h;
    const r = m * (rMin + rand() * (rMax - rMin));
    const light = rand() > 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, light ? `rgba(255,255,255,${lightA})` : `rgba(0,0,0,${darkA})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

// ---- texture generators -------------------------------------------------------
// Each draws INTO an already base-filled, clipped rect (0,0)-(w,h).
// Signature: (ctx, w, h, product, rand, opts) — opts: {glossy, groutColorHex, seed}.

function drawMarble(ctx, w, h, p, rand, opts) {
  const base = p.baseColorHex, m = Math.min(w, h);
  softBlobs(ctx, w, h, rand, 7, 0.09, 0.05, 0.22, 0.65);
  const vein = p.accentColorHex || shade(base, isDark(base) ? 0.5 : -0.42);
  const nV = 2 + Math.floor(rand() * 3);
  for (let v = 0; v < nV; v++) {
    const vert = rand() > 0.5;
    const pts = vert
      ? veinPath(rand, rand() * w, -h * 0.05, rand() * w, h * 1.05, 5, w * 0.16)
      : veinPath(rand, -w * 0.05, rand() * h, w * 1.05, rand() * h, 5, h * 0.16);
    strokePolyline(ctx, pts, vein, m * 0.02, 0.05);
    strokePolyline(ctx, pts, vein, m * 0.008, 0.13);
    strokePolyline(ctx, pts, vein, m * 0.0032, 0.3);
    if (rand() > 0.45) {
      const at = pts[Math.floor(pts.length * (0.3 + rand() * 0.4))];
      const br = veinPath(rand, at[0], at[1], at[0] + (rand() - 0.5) * w * 0.5, at[1] + (rand() - 0.5) * h * 0.5, 4, m * 0.08);
      strokePolyline(ctx, br, vein, m * 0.005, 0.1);
      strokePolyline(ctx, br, vein, m * 0.002, 0.22);
    }
  }
  const lite = isDark(base) ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.8)";
  const nL = 1 + Math.floor(rand() * 2);
  for (let v = 0; v < nL; v++) {
    const pts = veinPath(rand, -w * 0.05, rand() * h, w * 1.05, rand() * h, 4, h * 0.12);
    strokePolyline(ctx, pts, lite, m * 0.006, 0.08);
  }
  if (opts.glossy) sheen(ctx, w, h, rand, 0.1);
}

function drawTravertine(ctx, w, h, p, rand, opts) {
  const base = p.baseColorHex, m = Math.min(w, h);
  const pit = p.accentColorHex || shade(base, -0.35);
  let y = 0;
  while (y < h) {
    const bh = Math.max(2, h * (0.06 + rand() * 0.07));
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = shade(base, (rand() - 0.5) * 0.12);
    ctx.fillRect(0, y, w, bh);
    ctx.globalAlpha = 1;
    // pores cluster along the band seam
    const nP = Math.round((w / m) * (3 + rand() * 6));
    for (let i = 0; i < nP; i++) {
      const rx = m * (0.008 + rand() * 0.028);
      ctx.globalAlpha = 0.15 + rand() * 0.28;
      ctx.fillStyle = pit;
      ctx.beginPath();
      ctx.ellipse(rand() * w, y + bh * (0.75 + rand() * 0.4), rx, rx * (0.25 + rand() * 0.3), 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    y += bh;
  }
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, rand() * h, w, m * (0.01 + rand() * 0.02));
  }
  ctx.globalAlpha = 1;
  if (opts.glossy) sheen(ctx, w, h, rand, 0.08);
}

function drawCeramic(ctx, w, h, p, rand, opts) {
  const m = Math.min(w, h);
  speckle(ctx, w, h, rand, p.baseColorHex, Math.round((w * h) / (m * m) * 90), 0.06);
  softBlobs(ctx, w, h, rand, 3, 0.04, 0.03, 0.3, 0.7);
  if (opts.glossy) {
    sheen(ctx, w, h, rand, 0.12);
    const grad = ctx.createRadialGradient(w * 0.25, h * 0.2, 0, w * 0.25, h * 0.2, m * 0.8);
    grad.addColorStop(0, "rgba(255,255,255,0.08)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawConcrete(ctx, w, h, p, rand) {
  const base = p.baseColorHex, m = Math.min(w, h);
  softBlobs(ctx, w, h, rand, 12 + Math.floor(rand() * 6), 0.045, 0.045, 0.15, 0.5);
  speckle(ctx, w, h, rand, base, Math.round((w * h) / (m * m) * 60), 0.05);
  // trowel sweeps
  for (let i = 0; i < 2 + Math.floor(rand() * 2); i++) {
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.strokeStyle = shade(base, rand() > 0.5 ? 0.14 : -0.14);
    ctx.lineWidth = m * (0.1 + rand() * 0.1);
    ctx.beginPath();
    const a0 = rand() * TAU;
    ctx.arc(rand() * w, rand() * h, m * (0.4 + rand() * 0.5), a0, a0 + 1.2 + rand() * 1.4);
    ctx.stroke();
    ctx.restore();
  }
  // pinholes
  const dark = shade(base, -0.4);
  for (let i = 0; i < 5 + Math.floor(rand() * 7); i++) {
    ctx.globalAlpha = 0.2 + rand() * 0.15;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, m * (0.002 + rand() * 0.004), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawWoodPlank(ctx, w, h, p, rand) {
  const base = p.baseColorHex;
  const horiz = w >= h;
  ctx.save();
  if (!horiz) { ctx.translate(0, h); ctx.rotate(-Math.PI / 2); }
  const L = horiz ? w : h, S = horiz ? h : w;
  // plank-level tint
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = shade(base, (rand() - 0.5) * 0.14);
  ctx.fillRect(0, 0, L, S);
  ctx.globalAlpha = 1;
  // grain
  const n = 8 + Math.floor(rand() * 5);
  const deep = p.accentColorHex || shade(base, -0.3);
  for (let i = 0; i < n; i++) {
    const yBase = ((i + 0.5) / n) * S + (rand() - 0.5) * S * 0.06;
    const amp = S * (0.012 + rand() * 0.03);
    const freq = (1 + rand() * 2.2) * TAU / L;
    const phase = rand() * TAU;
    const drift = ((rand() - 0.5) * S * 0.12) / L;
    const pts = [];
    const steps = 26;
    for (let sIx = 0; sIx <= steps; sIx++) {
      const x = (sIx / steps) * L;
      pts.push([x, yBase + Math.sin(x * freq + phase) * amp + x * drift]);
    }
    strokePolyline(ctx, pts, rand() > 0.45 ? deep : shade(base, -0.16), S * (0.008 + rand() * 0.018), 0.1 + rand() * 0.14);
  }
  // cathedral arcs
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = shade(base, 0.14);
    ctx.lineWidth = S * 0.02;
    ctx.beginPath();
    ctx.ellipse(L * (0.2 + rand() * 0.6), S * (0.3 + rand() * 0.4), L * (0.12 + rand() * 0.18), S * (0.14 + rand() * 0.2), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // occasional knot
  if (rand() < 0.4) {
    const kx = L * (0.15 + rand() * 0.7), ky = S * (0.25 + rand() * 0.5);
    const rings = 3 + Math.floor(rand() * 3);
    for (let r = rings; r >= 1; r--) {
      ctx.globalAlpha = 0.1 + (r === 1 ? 0.22 : 0.05);
      ctx.strokeStyle = shade(base, -0.42);
      ctx.lineWidth = S * 0.012;
      ctx.beginPath();
      ctx.ellipse(kx, ky, S * 0.055 * r, S * 0.04 * r, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = shade(base, -0.5);
    ctx.beginPath();
    ctx.ellipse(kx, ky, S * 0.03, S * 0.022, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // darker plank ends
  for (const xEnd of [0, L]) {
    const grad = ctx.createLinearGradient(xEnd, 0, xEnd === 0 ? L * 0.07 : L * 0.93, 0);
    grad.addColorStop(0, "rgba(0,0,0,0.08)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, L, S);
  }
  ctx.restore();
}

function drawTerrazzo(ctx, w, h, p, rand) {
  const base = p.baseColorHex, m = Math.min(w, h);
  const pitch = m / (5.5 + rand() * 2);
  const palette = [
    "#f4f1ea",
    shade(base, -0.42),
    p.accentColorHex || "#a15340",
    "#8d8d92",
    "#3b3937",
    "#c9b8a4",
  ];
  for (let jy = -pitch; jy < h + pitch; jy += pitch) {
    for (let jx = -pitch; jx < w + pitch; jx += pitch) {
      if (rand() < 0.16) continue;
      const cx = jx + rand() * pitch, cy = jy + rand() * pitch;
      let r = pitch * (0.16 + rand() * 0.22);
      if (rand() < 0.12) r *= 1.9;
      const color = palette[(rand() * palette.length) | 0];
      const nv = 3 + ((rand() * 4) | 0);
      const rot = rand() * TAU;
      ctx.beginPath();
      for (let v = 0; v < nv; v++) {
        const a = rot + (v / nv) * TAU;
        const rr = r * (0.6 + rand() * 0.5);
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = Math.max(0.4, r * 0.07);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawSubway(ctx, w, h, p, rand, opts) {
  const base = p.baseColorHex, m = Math.min(w, h);
  speckle(ctx, w, h, rand, base, Math.round((w * h) / (m * m) * 30), 0.04);
  const bw = m * 0.13;
  const light = "rgba(255,255,255,0.36)", dark = "rgba(0,0,0,0.26)";
  let grad = ctx.createLinearGradient(0, 0, 0, bw);
  grad.addColorStop(0, light); grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, bw);
  grad = ctx.createLinearGradient(0, 0, bw, 0);
  grad.addColorStop(0, light); grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, bw, h);
  grad = ctx.createLinearGradient(0, h, 0, h - bw);
  grad.addColorStop(0, dark); grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad; ctx.fillRect(0, h - bw, w, bw);
  grad = ctx.createLinearGradient(w, 0, w - bw, 0);
  grad.addColorStop(0, dark); grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad; ctx.fillRect(w - bw, 0, bw, h);
  // flat inner field with a gentle centre highlight
  grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.06)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  if (opts.glossy) sheen(ctx, w, h, rand, 0.14);
}

function drawHexMosaic(ctx, w, h, p, rand, opts) {
  const base = p.baseColorHex;
  ctx.fillStyle = opts.groutColorHex || "#dcd9d3";
  ctx.fillRect(0, 0, w, h);
  const R = Math.min(w, h) / 4.6;             // hex circumradius
  const stepX = R * Math.sqrt(3), stepY = R * 1.5;
  const seedBase = (opts.seed ?? 1) >>> 0;
  for (let row = -1; row * stepY < h + R; row++) {
    for (let col = -1; col * stepX < w + R; col++) {
      const cx = col * stepX + ((((row % 2) + 2) % 2) ? stepX / 2 : 0);
      const cy = row * stepY;
      const r2 = mulberry32((seedBase ^ hashStr(col + "," + row)) >>> 0);
      let fill = shade(base, (r2() - 0.5) * 0.16);
      if (p.accentColorHex && r2() < 0.1) fill = shade(p.accentColorHex, (r2() - 0.5) * 0.1);
      const rr = R * 0.93;                    // 7% grout line between hexes
      ctx.beginPath();
      for (let v = 0; v < 6; v++) {
        const a = Math.PI / 6 + (v / 6) * TAU; // pointy-top
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (p.glossy) {
        const grad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
        grad.addColorStop(0, "rgba(255,255,255,0.10)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
  }
}

function drawMetal(ctx, w, h, p, rand) {
  const base = p.baseColorHex;
  const n = Math.min(420, Math.max(60, Math.round(h * 1.1)));
  for (let i = 0; i < n; i++) {
    const y = rand() * h;
    ctx.globalAlpha = 0.02 + rand() * 0.05;
    ctx.strokeStyle = rand() > 0.5 ? "#ffffff" : "#000000";
    ctx.lineWidth = Math.max(0.4, h * 0.002);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (rand() - 0.5) * h * 0.01);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // anisotropic sheen bands perpendicular to the grain
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.28, "rgba(255,255,255,0.10)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.06)");
  grad.addColorStop(0.72, "rgba(255,255,255,0.08)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const vgrad = ctx.createLinearGradient(0, 0, 0, h);
  vgrad.addColorStop(0, "rgba(255,255,255,0.08)");
  vgrad.addColorStop(1, rgba(shade(base, -0.2), 0.1));
  ctx.fillStyle = vgrad;
  ctx.fillRect(0, 0, w, h);
}

function drawFlat(ctx, w, h, p, rand, opts) {
  const m = Math.min(w, h);
  speckle(ctx, w, h, rand, p.baseColorHex, Math.round((w * h) / (m * m) * 40), 0.025);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(255,255,255,0.05)");
  grad.addColorStop(1, "rgba(0,0,0,0.04)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  if (opts.glossy) sheen(ctx, w, h, rand, 0.07);
}

export const fillStyles = {
  ceramic: drawCeramic,
  marble: drawMarble,
  travertine: drawTravertine,
  concrete: drawConcrete,
  woodPlank: drawWoodPlank,
  terrazzo: drawTerrazzo,
  subway: drawSubway,
  hexMosaic: drawHexMosaic,
  metal: drawMetal,
  flat: drawFlat,
};

// ---- one tile face ------------------------------------------------------------
function drawTileFace(ctx, w, h, product, seed, opts) {
  const rand = mulberry32(seed);
  ctx.fillStyle = product.baseColorHex || "#cfcbc2";
  ctx.fillRect(0, 0, w, h);
  const gen = fillStyles[product.textureKind] || drawFlat;
  gen(ctx, w, h, product, rand, { glossy: !!product.glossy, ...opts, seed });
  // slight per-tile tone variation (anti-repetition)
  const tone = (mulberry32((seed ^ 0x9e3779b9) >>> 0)() - 0.5) * 0.06;
  ctx.fillStyle = tone >= 0 ? `rgba(255,255,255,${tone})` : `rgba(0,0,0,${-tone})`;
  ctx.fillRect(0, 0, w, h);
  // crisp edge definition
  const lw = Math.max(0.6, Math.min(w, h) * 0.004);
  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = lw;
  ctx.strokeRect(lw / 2, lw / 2, w - lw, h - lw);
}

// ---- pattern layout (all in millimetres) --------------------------------------
// Herringbone lays n:1 dominoes on the short pitch b = min(tw,th) + g with n
// snapped to the tile's real aspect (a 20×120 plank stays a 6:1 plank). The
// lattice m·(−b,b) + k·((n+1)b,(n−1)b) of L-pairs covers the plane exactly
// once and repeats with period 2nb — simulation-verified for n = 2..8.
function herringboneN(tw, th, g) {
  const b = Math.min(tw, th) + g;
  const n = Math.min(8, Math.max(2, Math.round((Math.max(tw, th) + g) / b)));
  return { b, n };
}

function internalPeriodMm(pattern, tw, th, g) {
  if (pattern === "runningBond") return [tw + g, 2 * (th + g)];
  if (pattern === "herringbone") { const { b, n } = herringboneN(tw, th, g); return [2 * n * b, 2 * n * b]; }
  if (pattern === "diagonal") { const s = (tw + th) / 2 + g; return [s * SQRT2, s * SQRT2]; }
  return [tw + g, th + g];
}

const VARIANT_MULT = { grid: [2, 2], runningBond: [2, 1], herringbone: [1, 1], diagonal: [1, 1] };

// Placements are pitch boxes {cx, cy, w, h, rot}; the renderer insets each by
// the grout width so grout shows between tiles and across cell edges.
function gridPlacements(tw, th, g, W, H, bond) {
  const pw = tw + g, ph = th + g, out = [];
  const rows = Math.ceil(H / ph) + 2, cols = Math.ceil(W / pw) + 3;
  for (let iy = -1; iy < rows; iy++) {
    const off = bond ? (((iy % 2) + 2) % 2) * (pw / 2) : 0;
    for (let ix = -2; ix < cols; ix++) {
      out.push({ cx: ix * pw + off + pw / 2, cy: iy * ph + ph / 2, w: pw, h: ph, rot: 0 });
    }
  }
  return out;
}

// n:1 herringbone (see herringboneN above). Each lattice point carries an
// L-pair: a horizontal a×b tile and a vertical b×a tile at its right end.
function herringbonePlacements(tw, th, g, W, H) {
  const { b, n } = herringboneN(tw, th, g);
  const a = n * b, out = [];
  const kMax = Math.ceil((W + H) / (2 * n * b)) + 3;
  for (let k = -kMax; k <= kMax; k++) {
    // oy = b(m + k(n−1)) must land within [−2a, H+2a]
    const mLo = Math.floor(-2 * a / b - k * (n - 1)) - 1;
    const mHi = Math.ceil((H + 2 * a) / b - k * (n - 1)) + 1;
    for (let m = mLo; m <= mHi; m++) {
      const ox = b * (-m + k * (n + 1)), oy = b * (m + k * (n - 1));
      if (ox < -2 * a || ox > W + 2 * a) continue;
      out.push({ cx: ox + a / 2, cy: oy + b / 2, w: a, h: b, rot: 0 });
      out.push({ cx: ox + a + b / 2, cy: oy + a / 2, w: b, h: a, rot: 0 });
    }
  }
  return out;
}

// 45°-rotated squares on the averaged pitch s; centres on half-offset rows.
function diagonalPlacements(tw, th, g, W, H) {
  const s = (tw + th) / 2 + g;
  const D = s * SQRT2, out = [];
  const rows = Math.ceil(H / (D / 2)) + 4, cols = Math.ceil(W / D) + 4;
  for (let j = -3; j < rows; j++) {
    const off = (((j % 2) + 2) % 2) * (D / 2);
    for (let i = -3; i < cols; i++) {
      out.push({ cx: i * D + off, cy: j * (D / 2), w: s, h: s, rot: Math.PI / 4 });
    }
  }
  return out;
}

function placementsFor(pattern, tw, th, g, W, H) {
  if (pattern === "runningBond") return gridPlacements(tw, th, g, W, H, true);
  if (pattern === "herringbone") return herringbonePlacements(tw, th, g, W, H);
  if (pattern === "diagonal") return diagonalPlacements(tw, th, g, W, H);
  return gridPlacements(tw, th, g, W, H, false);
}

// Seed key from the tile centre wrapped into the cell — periodic copies of an
// edge-straddling tile get the same seed, so cell edges join invisibly.
function wrapKey(v, period) {
  return Math.round((((v % period) + period) % period) * 2);
}

function drawPlacedTile(ctx, pl, g, product, seed, opts) {
  const fw = Math.max(0.5, pl.w - g), fh = Math.max(0.5, pl.h - g);
  ctx.save();
  ctx.translate(pl.cx, pl.cy);
  if (pl.rot) ctx.rotate(pl.rot);
  ctx.translate(-fw / 2, -fh / 2);
  ctx.beginPath();
  ctx.rect(0, 0, fw, fh);
  ctx.clip();
  drawTileFace(ctx, fw, fh, product, seed, opts);
  ctx.restore();
}

// ---- public: the pattern cell -------------------------------------------------
const cellCache = new Map();

export function buildPatternCell(product, opts = {}) {
  const pattern = opts.pattern || "grid";
  const groutColorHex = opts.groutColorHex || "#e8e6e1";
  const g = Number.isFinite(opts.groutWidthMm) ? Math.max(0, opts.groutWidthMm) : 3;
  const scalePxPerMm = Number.isFinite(opts.scalePxPerMm) && opts.scalePxPerMm > 0 ? opts.scalePxPerMm : 0.5;
  const key = [product?.id, pattern, groutColorHex, g, scalePxPerMm].join("|");
  const hit = cellCache.get(key);
  if (hit) return hit;

  const [tw, th] = Array.isArray(product?.tileSizeMm) ? product.tileSizeMm : DEFAULT_TILE_MM;
  const internal = internalPeriodMm(pattern, tw, th, g);
  // domain.js owns the physical cell math; adopt its base period when it agrees
  // with the drawn layout (within 25% per axis — pixel-exact when identical).
  // A herringbone/diagonal convention mismatch or an unusable value falls back
  // to the internal period so tiles are never visibly stretched. Values beyond
  // 100 m are assumed to be mm.
  let base = internal;
  try {
    const m = cellMeters(product, pattern, g);
    if (m && Number.isFinite(m[0]) && m[0] > 0 && Number.isFinite(m[1]) && m[1] > 0) {
      const mm = m[0] > 100 ? [m[0], m[1]] : [m[0] * 1000, m[1] * 1000];
      const rx = mm[0] / internal[0], ry = mm[1] / internal[1];
      if (rx > 0.8 && rx < 1.25 && ry > 0.8 && ry < 1.25) base = mm;
    }
  } catch { /* offline-safe: internal math */ }

  const mult = VARIANT_MULT[pattern] || [1, 1];
  const cellSizeMm = [base[0] * mult[0], base[1] * mult[1]];
  const layoutW = internal[0] * mult[0], layoutH = internal[1] * mult[1];

  let pxW = Math.max(2, Math.round(cellSizeMm[0] * scalePxPerMm));
  let pxH = Math.max(2, Math.round(cellSizeMm[1] * scalePxPerMm));
  const over = Math.max(pxW / MAX_CELL_PX, pxH / MAX_CELL_PX);
  if (over > 1) { pxW = Math.max(2, Math.round(pxW / over)); pxH = Math.max(2, Math.round(pxH / over)); }

  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = groutColorHex;
  ctx.fillRect(0, 0, pxW, pxH);
  // Map layout-mm space exactly onto the canvas so the period is seam-free
  // regardless of pixel rounding.
  ctx.setTransform(pxW / layoutW, 0, 0, pxH / layoutH, 0, 0);

  const baseSeed = seedFor(product);
  const faceOpts = { groutColorHex, glossy: !!product?.glossy };
  for (const pl of placementsFor(pattern, tw, th, g, layoutW, layoutH)) {
    const seed = (baseSeed ^ hashStr(wrapKey(pl.cx, layoutW) + ":" + wrapKey(pl.cy, layoutH))) >>> 0;
    drawPlacedTile(ctx, pl, g, product, seed, faceOpts);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const result = { canvas, cellSizeMm };
  cellCache.set(key, result);
  if (cellCache.size > 48) cellCache.delete(cellCache.keys().next().value);
  return result;
}

// ---- public: catalog swatch ---------------------------------------------------
const swatchCache = new Map();

export function swatchDataUrl(product, sizePx = 256) {
  const key = (product?.id ?? "?") + "|" + sizePx;
  const hit = swatchCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  const kind = product?.textureKind;

  if ((kind === "subway" || kind === "woodPlank") && Array.isArray(product.tileSizeMm)) {
    // elongated formats read better as a laid pattern than a stretched face
    const short = Math.min(product.tileSizeMm[0], product.tileSizeMm[1]);
    const groutWidthMm = kind === "woodPlank" ? 2 : 3;
    const { canvas: cell } = buildPatternCell(product, {
      pattern: "runningBond",
      groutColorHex: kind === "woodPlank" ? "#6f6a64" : "#e8e6e1",
      groutWidthMm,
      scalePxPerMm: sizePx / ((short + groutWidthMm) * 4),
    });
    ctx.fillStyle = ctx.createPattern(cell, "repeat");
    ctx.fillRect(0, 0, sizePx, sizePx);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, sizePx, sizePx);
    ctx.clip();
    drawTileFace(ctx, sizePx, sizePx, product || {}, seedFor(product), { groutColorHex: "#dcd9d3", glossy: !!product?.glossy });
    ctx.restore();
  }

  const url = canvas.toDataURL("image/png");
  swatchCache.set(key, url);
  if (swatchCache.size > 128) swatchCache.delete(swatchCache.keys().next().value);
  return url;
}
