// ============================================================================
// scene2d.js — Stage-1 preset-scene renderer for the 2D designer.
// Owns: renderScene(canvas, scene, assignments, products) and
// hitSurface(scene, canvasX, canvasY) per BUILD_CONTRACTS.md, plus the
// 4-corner homography warp helper used by data/scenes.js to paint a tiled
// pattern cell (from texture.js buildPatternCell) into a perspective quad.
// The warp subdivides each quad into a 24x24 mesh and drawImage-transforms
// each triangle — no external libs, plain canvas 2D.
// Coordinates: everything happens in the 1000x700 design space; renderScene
// scales the context to the canvas backing store, hitSurface expects
// design-space coordinates (the view converts client px -> design space).
// Pattern cells and tiled source canvases are cached so a re-render after a
// control change stays well under the 100ms budget.
// ============================================================================
import { buildPatternCell } from "./texture.js";
import { GROUT_COLORS } from "./domain.js";

export const DESIGN_W = 1000;
export const DESIGN_H = 700;

const MESH_N = 24;               // 24x24 mesh of triangle pairs per quad
const CELL_SCALE_PX_PER_MM = 0.5; // resolution of the pattern cell we request
const CELL_CACHE_MAX = 48;

// cell cache: one repeatable pattern cell per (product, pattern, grout) combo
const cellCache = new Map();
// tiled source cache: cell canvas -> Map(realSize key -> tiled canvas)
const tiledCache = new WeakMap();

// ---------------------------------------------------------------------------
// Public API — contract
// ---------------------------------------------------------------------------

/** Draw the whole illustrated scene into `canvas` (design space 1000x700). */
export function renderScene(canvas, scene, assignments, products) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !scene) return;
  const sx = canvas.width / DESIGN_W;
  const sy = canvas.height / DESIGN_H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
  const texFor = makeTexFor(assignments || {}, products || []);
  scene.draw(ctx, DESIGN_W, DESIGN_H, assignments || {}, texFor);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Topmost surface under a design-space point, or null. */
export function hitSurface(scene, canvasX, canvasY) {
  if (!scene) return null;
  for (let i = scene.surfaces.length - 1; i >= 0; i--) {
    const s = scene.surfaces[i];
    if (pointInQuad(s.quad, canvasX, canvasY)) return s.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public helpers used by data/scenes.js
// ---------------------------------------------------------------------------

/** Trace a quad path (4 corners, TL/TR/BR/BL order). */
export function pathQuad(ctx, quad) {
  ctx.beginPath();
  ctx.moveTo(quad[0][0], quad[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(quad[i][0], quad[i][1]);
  ctx.closePath();
}

/** Fill a quad with any fillStyle (color, gradient, pattern). */
export function fillQuad(ctx, quad, style) {
  ctx.save();
  pathQuad(ctx, quad);
  ctx.fillStyle = style;
  ctx.fill();
  ctx.restore();
}

/** Projective point inside a quad: (u,v) in [0,1]^2 -> design-space [x,y]. */
export function quadPoint(quad, u, v) {
  return homography(quad)(u, v);
}

/** Sub-quad of a quad in its own UV space (perspective-correct). */
export function subQuad(quad, u0, v0, u1, v1) {
  const H = homography(quad);
  return [H(u0, v0), H(u1, v0), H(u1, v1), H(u0, v1)];
}

/**
 * Paint a repeatable pattern cell into a perspective quad at physical scale:
 * the cell covers cellSizeMm of real surface, the quad covers realSizeM.
 */
export function drawTexturedQuad(ctx, quad, cellCanvas, cellSizeMm, realSizeM) {
  const src = tiledSource(cellCanvas, cellSizeMm, realSizeM);
  if (src) warpImageToQuad(ctx, src, quad, MESH_N);
}

/**
 * Homography warp: draw `img` into `quad` (TL/TR/BR/BL) by subdividing into
 * an n x n mesh and drawImage-transforming two triangles per mesh cell.
 */
export function warpImageToQuad(ctx, img, quad, n = MESH_N) {
  const sw = img.width, sh = img.height;
  if (!sw || !sh) return;
  const H = homography(quad);
  const pts = [];
  for (let j = 0; j <= n; j++) {
    const row = [];
    for (let i = 0; i <= n; i++) row.push(H(i / n, j / n));
    pts.push(row);
  }
  ctx.save();
  pathQuad(ctx, quad);
  ctx.clip();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const s0 = [(i / n) * sw, (j / n) * sh];
      const s1 = [((i + 1) / n) * sw, (j / n) * sh];
      const s2 = [((i + 1) / n) * sw, ((j + 1) / n) * sh];
      const s3 = [(i / n) * sw, ((j + 1) / n) * sh];
      const d0 = pts[j][i], d1 = pts[j][i + 1];
      const d2 = pts[j + 1][i + 1], d3 = pts[j + 1][i];
      drawTri(ctx, img, s0, s1, s2, d0, d1, d2);
      drawTri(ctx, img, s0, s2, s3, d0, d2, d3);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** texFor(surfaceId) -> {canvas, cellSizeMm} | null, built per render. */
function makeTexFor(assignments, products) {
  return (surfaceId) => {
    const a = assignments[surfaceId];
    if (!a || !a.productId) return null;
    const product = products.find((p) => p.id === a.productId);
    if (!product) return null;
    const groutColorHex =
      (GROUT_COLORS.find((g) => g.id === a.groutColorId) || GROUT_COLORS[0] || { hex: "#e8e6e1" }).hex;
    const key = [product.id, a.pattern, groutColorHex, a.groutWidthMm].join("|");
    let cell = cellCache.get(key);
    if (!cell) {
      try {
        cell = buildPatternCell(product, {
          pattern: a.pattern,
          groutColorHex,
          groutWidthMm: a.groutWidthMm,
          scalePxPerMm: CELL_SCALE_PX_PER_MM,
        });
      } catch (err) {
        return null; // texture pipeline unavailable -> scene falls back to flat fill
      }
      if (!cell || !cell.canvas) return null;
      cellCache.set(key, cell);
      if (cellCache.size > CELL_CACHE_MAX) cellCache.delete(cellCache.keys().next().value);
    }
    return cell;
  };
}

/** Repeat a pattern cell across a canvas representing realSizeM meters. */
function tiledSource(cellCanvas, cellSizeMm, realSizeM) {
  if (!cellCanvas || !cellCanvas.width || !cellCanvas.height) return null;
  const [rw, rh] = realSizeM;
  const key = rw.toFixed(3) + "x" + rh.toFixed(3);
  let perCell = tiledCache.get(cellCanvas);
  if (perCell && perCell.has(key)) return perCell.get(key);

  const pxPerM = Math.max(90, Math.min(1100 / Math.max(rw, rh), 400));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(rw * pxPerM));
  c.height = Math.max(2, Math.round(rh * pxPerM));
  const g = c.getContext("2d");
  const pat = g.createPattern(cellCanvas, "repeat");
  const cellPxW = (cellSizeMm[0] / 1000) * pxPerM;
  const cellPxH = (cellSizeMm[1] / 1000) * pxPerM;
  const m = new DOMMatrix();
  m.a = cellPxW / cellCanvas.width;
  m.d = cellPxH / cellCanvas.height;
  pat.setTransform(m);
  g.fillStyle = pat;
  g.fillRect(0, 0, c.width, c.height);

  if (!perCell) { perCell = new Map(); tiledCache.set(cellCanvas, perCell); }
  perCell.set(key, c);
  return c;
}

/**
 * Projective mapping unit square -> quad (Heckbert). Returns (u,v)->[x,y].
 * Quad corners: TL=(0,0), TR=(1,0), BR=(1,1), BL=(0,1).
 */
function homography(quad) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - sy * dx2) / det;
    h = (dx1 * sy - dy1 * sx) / det;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}

/** Affine drawImage of one source triangle onto one destination triangle. */
function drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
  // cull triangles fully outside the design viewport (floor quads extend far)
  const minX = Math.min(d0[0], d1[0], d2[0]), maxX = Math.max(d0[0], d1[0], d2[0]);
  const minY = Math.min(d0[1], d1[1], d2[1]), maxY = Math.max(d0[1], d1[1], d2[1]);
  if (maxX < -8 || minX > DESIGN_W + 8 || maxY < -8 || minY > DESIGN_H + 8) return;

  const denom =
    s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  if (!denom) return;
  const a = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / denom;
  const b = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / denom;
  const c = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / denom;
  const d = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / denom;
  const e = d0[0] - a * s0[0] - c * s0[1];
  const f = d0[1] - b * s0[0] - d * s0[1];

  // expand the destination triangle a hair from its centroid to hide seams
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
  const p0 = [cx + (d0[0] - cx) * 1.045, cy + (d0[1] - cy) * 1.045];
  const p1 = [cx + (d1[0] - cx) * 1.045, cy + (d1[1] - cy) * 1.045];
  const p2 = [cx + (d2[0] - cx) * 1.045, cy + (d2[1] - cy) * 1.045];

  // source sub-rect bounding box: bounds the rasterizer's work per triangle
  const sbx = Math.max(0, Math.floor(Math.min(s0[0], s1[0], s2[0])) - 1);
  const sby = Math.max(0, Math.floor(Math.min(s0[1], s1[1], s2[1])) - 1);
  const sbw = Math.min(img.width - sbx, Math.ceil(Math.max(s0[0], s1[0], s2[0])) - sbx + 2);
  const sbh = Math.min(img.height - sby, Math.ceil(Math.max(s0[1], s1[1], s2[1])) - sby + 2);
  if (sbw <= 0 || sbh <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, sbx, sby, sbw, sbh, sbx, sby, sbw, sbh);
  ctx.restore();
}

/** Convex point-in-quad: all edge cross products share a sign. */
function pointInQuad(quad, x, y) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % 4];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}
