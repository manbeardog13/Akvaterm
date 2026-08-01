// ============================================================================
// data/scenes.js — the three Stage-1 designer scenes, procedurally DRAWN
// (vector illustration on canvas, no photos). Each scene renders a corner-
// perspective room: two visible walls + floor as exact projective quads
// (mirrored in surfaces[] with realSizeM for physical tile scale), fixtures
// as clean vector shapes with soft shadows, and an ambient gradient + baked
// shadow pass applied AFTER the surface textures so tiles sit under light.
// Surfaces receive textures through texFor(surfaceId) -> {canvas, cellSizeMm}
// and are painted with the homography mesh warp from js/scene2d.js.
// Design space: 1000x700. Quad corner order everywhere: TL, TR, BR, BL.
// ============================================================================
import { drawTexturedQuad, fillQuad, quadPoint, subQuad } from "../js/scene2d.js";

// ---------------------------------------------------------------------------
// Small vector helpers
// ---------------------------------------------------------------------------

function poly(ctx, pts, fill, stroke, lw = 1.5) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.stroke(); }
}

function seg(ctx, p0, p1, style, lw = 2, cap = "round") {
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.lineCap = cap;
  ctx.stroke();
}

/** Vertical face standing on the floor segment p0->p1, heights in px. */
function vface(p0, p1, h0, h1) {
  return [[p0[0], p0[1] - h0], [p1[0], p1[1] - h1], [p1[0], p1[1]], [p0[0], p0[1]]];
}

/** Soft elliptical contact shadow. */
function softShadow(ctx, x, y, rx, ry, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(12,12,18,${alpha})`);
  g.addColorStop(0.65, `rgba(12,12,18,${alpha * 0.45})`);
  g.addColorStop(1, "rgba(12,12,18,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Soft shadow band bleeding from an edge onto the floor (baked AO). */
function edgeShadow(ctx, p0, p1, len, alpha) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L;
  if (ny < 0) { nx = -nx; ny = -ny; }
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  const g = ctx.createLinearGradient(mx, my, mx + nx * len, my + ny * len);
  g.addColorStop(0, `rgba(15,15,22,${alpha})`);
  g.addColorStop(1, "rgba(15,15,22,0)");
  poly(ctx, [p0, p1, [p1[0] + nx * len, p1[1] + ny * len], [p0[0] + nx * len, p0[1] + ny * len]], g);
}

/** Linear gradient running down a quad (v axis). */
function quadGradient(ctx, quad, stops) {
  const a = quadPoint(quad, 0.5, 0), b = quadPoint(quad, 0.5, 1);
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  for (const [off, col] of stops) g.addColorStop(off, col);
  return g;
}

// ---------------------------------------------------------------------------
// Room template: corner perspective, two walls + floor
// ---------------------------------------------------------------------------

function cornerRoom(o) {
  const wallL = [[o.lx, o.lTop], [o.cx, o.cTop], [o.cx, o.cBase], [o.lx, o.lBase]];
  const wallR = [[o.cx, o.cTop], [o.rx, o.rTop], [o.rx, o.rBase], [o.cx, o.cBase]];
  const floor = [[o.lx, o.lBase], [o.cx, o.cBase], [o.rx, o.rBase], [o.nx, o.ny]];
  return { o, wallL, wallR, floor };
}

/** Ceiling wedge + ambient backdrop behind the walls. */
function drawBackdrop(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 700);
  g.addColorStop(0, "#f2f0ea");
  g.addColorStop(0.5, "#e9e6df");
  g.addColorStop(1, "#ddd9d0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1000, 700);
}

/** One surface: warped texture when assigned, quiet plaster fallback when not. */
function drawSurface(ctx, s, texFor, fallback) {
  const tex = texFor(s.id);
  if (tex && tex.canvas) {
    drawTexturedQuad(ctx, s.quad, tex.canvas, tex.cellSizeMm, s.realSizeM);
  } else {
    fillQuad(ctx, s.quad, quadGradient(ctx, s.quad, fallback));
  }
}

const FALLBACK_WALL_L = [[0, "#e6e3dc"], [1, "#d9d6ce"]];
const FALLBACK_WALL_R = [[0, "#e1ded6"], [1, "#d3d0c7"]];
const FALLBACK_FLOOR = [[0, "#cec9bf"], [1, "#c2bcb1"]];

/**
 * Ambient gradient + baked shadow pass, drawn AFTER the surface textures:
 * corner ambient occlusion, wall-base contact bands, hairline seams, a soft
 * vignette and a directional light wash so the tiles sit under real light.
 */
function shadePass(ctx, room, light) {
  const { o, wallL, wallR } = room;
  // corner AO band
  const ao = ctx.createLinearGradient(o.cx - 85, 0, o.cx + 85, 0);
  ao.addColorStop(0, "rgba(20,20,30,0)");
  ao.addColorStop(0.5, "rgba(20,20,30,0.11)");
  ao.addColorStop(1, "rgba(20,20,30,0)");
  ctx.fillStyle = ao;
  ctx.fillRect(o.cx - 85, 0, 170, 700);
  // baked shadow along both wall bases onto the floor
  edgeShadow(ctx, wallL[3], wallL[2], 26, 0.16);
  edgeShadow(ctx, wallR[3], wallR[2], 26, 0.16);
  // hairline seams: wall bases, corner, wall tops
  seg(ctx, wallL[3], wallL[2], "rgba(40,40,48,0.20)", 2, "butt");
  seg(ctx, wallR[3], wallR[2], "rgba(40,40,48,0.20)", 2, "butt");
  seg(ctx, [o.cx, o.cTop], [o.cx, o.cBase], "rgba(40,40,48,0.13)", 2, "butt");
  seg(ctx, wallL[0], wallL[1], "rgba(40,40,48,0.08)", 2, "butt");
  seg(ctx, wallR[0], wallR[1], "rgba(40,40,48,0.08)", 2, "butt");
  // soft vignette
  const vg = ctx.createRadialGradient(500, 250, 140, 500, 330, 780);
  vg.addColorStop(0, "rgba(22,26,36,0)");
  vg.addColorStop(1, "rgba(22,26,36,0.15)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, 1000, 700);
  // directional light wash
  const lw = ctx.createRadialGradient(light[0], light[1], 30, light[0], light[1], 620);
  lw.addColorStop(0, "rgba(255,252,240,0.10)");
  lw.addColorStop(1, "rgba(255,252,240,0)");
  ctx.fillStyle = lw;
  ctx.fillRect(0, 0, 1000, 700);
}

/** Window with frame, sky, sun glow and a mullion, as a wall sub-quad. */
function drawWindow(ctx, wall, u0, v0, u1, v1) {
  const frame = subQuad(wall, u0, v0, u1, v1);
  const iu = (u1 - u0) * 0.07, iv = (v1 - v0) * 0.07;
  const glass = subQuad(wall, u0 + iu, v0 + iv, u1 - iu, v1 - iv);
  poly(ctx, frame, "#f4f3ef", "rgba(60,60,66,0.18)", 2);
  poly(ctx, glass, quadGradient(ctx, glass, [[0, "#a9cbe3"], [0.72, "#d5e8f6"], [1, "#e9f3fa"]]));
  // sun glow
  const gp = quadPoint(wall, u0 + (u1 - u0) * 0.68, v0 + (v1 - v0) * 0.30);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(glass[0][0], glass[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(glass[i][0], glass[i][1]);
  ctx.closePath();
  ctx.clip();
  const sun = ctx.createRadialGradient(gp[0], gp[1], 4, gp[0], gp[1], 90);
  sun.addColorStop(0, "rgba(255,252,235,0.85)");
  sun.addColorStop(1, "rgba(255,252,235,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(gp[0] - 100, gp[1] - 100, 200, 200);
  ctx.restore();
  // mullion + inner frame line
  const um = (u0 + u1) / 2;
  seg(ctx, quadPoint(wall, um, v0 + iv), quadPoint(wall, um, v1 - iv), "#f4f3ef", 5, "butt");
  poly(ctx, glass, null, "rgba(60,60,66,0.22)", 2);
  // sill with its own shadow
  const sill = subQuad(wall, u0 - 0.015, v1, u1 + 0.015, v1 + 0.035);
  poly(ctx, sill, "#eceae4", "rgba(60,60,66,0.16)", 1.5);
  edgeShadow(ctx, sill[3], sill[2], 14, 0.12);
}

// ---------------------------------------------------------------------------
// Scene 1 — Kupaonica (bathroom): vanity + mirror, shower glass, WC
// ---------------------------------------------------------------------------

function makeKupaonica() {
  const room = cornerRoom({
    cx: 380, cTop: 60, cBase: 460,
    lx: -60, lTop: -20, lBase: 600,
    rx: 1060, rTop: -15, rBase: 585,
    nx: 520, ny: 1900,
  });
  const surfaces = [
    { id: "zid-lijevi", kind: "wall", quad: room.wallL, realSizeM: [2.2, 2.6], defaultProductId: "ker-02" },
    { id: "zid-desni", kind: "wall", quad: room.wallR, realSizeM: [2.8, 2.6], defaultProductId: "ker-02" },
    { id: "pod", kind: "floor", quad: room.floor, realSizeM: [2.2, 2.8], defaultProductId: "ker-01" },
  ];
  const F = (u, v) => quadPoint(room.floor, u, v);
  const hTopR = (v) => (0.74 * (400 + 200 * v)) / 2.6; // vanity counter height in px along right wall

  function draw(ctx, w, h, assignments, texFor) {
    ctx.save();
    drawBackdrop(ctx);
    drawSurface(ctx, surfaces[0], texFor, FALLBACK_WALL_L);
    drawSurface(ctx, surfaces[1], texFor, FALLBACK_WALL_R);
    drawSurface(ctx, surfaces[2], texFor, FALLBACK_FLOOR);
    shadePass(ctx, room, [655, 150]);

    // --- WC silhouette near the corner (right wall, behind the vanity) ---
    const cb = F(0.935, 0.165);
    softShadow(ctx, cb[0], cb[1] + 8, 58, 15, 0.26);
    const c0 = F(0.985, 0.10), c1 = F(0.985, 0.235);
    poly(ctx, vface(c0, c1, 118, 122), "#f6f5f1", "rgba(70,70,76,0.14)", 1.5);   // cistern
    poly(ctx, [
      [c0[0] - 3, c0[1] - 118], [c1[0] + 3, c1[1] - 122],
      [c1[0] + 3, c1[1] - 112], [c0[0] - 3, c0[1] - 108],
    ], "#eeede8");                                                                // lid
    ctx.fillStyle = "#d4d3cd";
    ctx.fillRect((c0[0] + c1[0]) / 2 - 7, (c0[1] + c1[1]) / 2 - 119, 14, 5);      // button
    poly(ctx, [                                                                    // pedestal
      [cb[0] - 16, cb[1] - 58], [cb[0] + 16, cb[1] - 58],
      [cb[0] + 11, cb[1]], [cb[0] - 11, cb[1]],
    ], "#f1f0eb");
    ctx.save();                                                                    // bowl + seat
    ctx.translate(cb[0], cb[1] - 60);
    ctx.scale(1, 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, 33, 0, Math.PI * 2);
    ctx.fillStyle = "#f7f6f2";
    ctx.fill();
    ctx.strokeStyle = "rgba(70,70,76,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(70,70,76,0.12)";
    ctx.stroke();
    ctx.restore();

    // --- mirror above the vanity (right wall) ---
    const mirror = subQuad(room.wallR, 0.36, 0.14, 0.66, 0.50);
    poly(ctx, mirror, quadGradient(ctx, mirror, [[0, "#cfdde2"], [1, "#eef4f5"]]), "#8d9499", 4);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mirror[0][0], mirror[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(mirror[i][0], mirror[i][1]);
    ctx.closePath();
    ctx.clip();
    const m0 = quadPoint(room.wallR, 0.40, 0.14), m1 = quadPoint(room.wallR, 0.48, 0.50);
    poly(ctx, [m0, [m0[0] + 26, m0[1]], [m1[0] + 26, m1[1]], m1], "rgba(255,255,255,0.30)");
    ctx.restore();

    // --- vanity: cabinet + counter + basin + faucet (right wall) ---
    const wF = F(1, 0.36), wN = F(1, 0.68), fF = F(0.80, 0.36), fN = F(0.80, 0.68);
    const hF = hTopR(0.36), hN = hTopR(0.68);
    softShadow(ctx, (fF[0] + fN[0]) / 2, (fF[1] + fN[1]) / 2 + 6, 130, 26, 0.28);
    poly(ctx, vface(wF, fF, hF - 12, hF - 12), "#7d6349");                      // far end face
    const front = vface(fF, fN, hF - 12, hN - 12);
    poly(ctx, front, "#9a7b5c", "rgba(50,38,28,0.25)", 1.5);                    // front face
    const dm = [(fF[0] + fN[0]) / 2, (fF[1] + fN[1]) / 2];
    seg(ctx, [dm[0], dm[1] - (hF + hN) / 2 + 16], dm, "rgba(50,38,28,0.30)", 2); // door seam
    seg(ctx, [dm[0] - 34, dm[1] - (hF + hN) / 2 + 34], [dm[0] - 16, dm[1] - (hF + hN) / 2 + 35], "#d8d2c8", 4);
    seg(ctx, [dm[0] + 16, dm[1] - (hF + hN) / 2 + 36], [dm[0] + 34, dm[1] - (hF + hN) / 2 + 37], "#d8d2c8", 4);
    // counter slab (slight overhang)
    const top = [
      [wF[0], wF[1] - hF], [wN[0], wN[1] - hN],
      [fN[0] - 6, fN[1] - hN + 2], [fF[0] - 6, fF[1] - hF + 2],
    ];
    poly(ctx, top, "#e9e3d8", "rgba(60,50,40,0.18)", 1.5);
    poly(ctx, [top[3], top[2], [top[2][0], top[2][1] + 9], [top[3][0], top[3][1] + 9]], "#d9d2c5");
    // basin + faucet
    const bc = F(0.90, 0.52), bh = hTopR(0.52);
    ctx.save();
    ctx.translate(bc[0], bc[1] - bh);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(90,90,95,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 4, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#eef0f0";
    ctx.fill();
    ctx.restore();
    const fc = F(0.975, 0.52);
    seg(ctx, [fc[0], fc[1] - bh - 2], [fc[0], fc[1] - bh - 26], "#aeb6ba", 4);
    seg(ctx, [fc[0], fc[1] - bh - 26], [fc[0] - 16, fc[1] - bh - 22], "#aeb6ba", 4);

    // --- towel on the right wall ---
    const t0 = quadPoint(room.wallR, 0.74, 0.34), t1 = quadPoint(room.wallR, 0.84, 0.335);
    seg(ctx, t0, t1, "#9aa1a5", 4);
    poly(ctx, [
      [t0[0] + 4, t0[1] + 2], [t1[0] - 4, t1[1] + 2],
      [t1[0] - 2, t1[1] + 74], [t0[0] + 2, t0[1] + 78],
    ], "#e8e4da", "rgba(70,70,76,0.14)", 1.5);

    // --- shower: head, drain, glass panel last (translucent) ---
    const hp = quadPoint(room.wallL, 0.80, 0.13);
    seg(ctx, hp, [hp[0] + 26, hp[1] + 9], "#9aa1a5", 5);
    ctx.save();
    ctx.translate(hp[0] + 30, hp[1] + 12);
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#b9c0c4";
    ctx.fill();
    ctx.restore();
    const dr = F(0.74, 0.075);
    ctx.save();
    ctx.translate(dr[0], dr[1]);
    ctx.scale(1, 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(110,115,120,0.55)";
    ctx.fill();
    ctx.restore();
    const g0 = F(0.48, 0.16), g1 = F(0.96, 0.16);
    softShadow(ctx, (g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 + 4, 120, 14, 0.18);
    const glass = vface(g0, g1, 372, 298);
    poly(ctx, glass, "rgba(176,206,215,0.26)", "rgba(70,95,105,0.45)", 2);
    seg(ctx, glass[0], glass[1], "#b9c0c4", 5);                                   // chrome top bar
    seg(ctx, glass[0], glass[3], "#b9c0c4", 4);                                   // chrome near edge
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(glass[0][0], glass[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(glass[i][0], glass[i][1]);
    ctx.closePath();
    ctx.clip();
    poly(ctx, [
      [g0[0] + 30, g0[1] - 340], [g0[0] + 66, g0[1] - 340],
      [g0[0] + 130, g0[1]], [g0[0] + 94, g0[1]],
    ], "rgba(255,255,255,0.16)");
    ctx.restore();
    ctx.restore();
  }

  return { id: "kupaonica", i18nKey: "scene.kupaonica", draw, surfaces };
}

// ---------------------------------------------------------------------------
// Scene 2 — Kuhinja (kitchen): lower cabinets + counter, window
// ---------------------------------------------------------------------------

function makeKuhinja() {
  const room = cornerRoom({
    cx: 420, cTop: 70, cBase: 455,
    lx: -60, lTop: -25, lBase: 610,
    rx: 1060, rTop: -10, rBase: 580,
    nx: 520, ny: 1900,
  });
  const surfaces = [
    { id: "zid-lijevi", kind: "wall", quad: room.wallL, realSizeM: [2.6, 2.6], defaultProductId: "ker-04" },
    { id: "zid-desni", kind: "wall", quad: room.wallR, realSizeM: [3.4, 2.6], defaultProductId: "ker-04" },
    { id: "pod", kind: "floor", quad: room.floor, realSizeM: [2.6, 3.4], defaultProductId: "ker-03" },
  ];
  const F = (u, v) => quadPoint(room.floor, u, v);
  const hTop = (v) => (0.92 * (385 + 195 * v)) / 2.6; // counter height in px along right wall

  function draw(ctx, w, h, assignments, texFor) {
    ctx.save();
    drawBackdrop(ctx);
    drawSurface(ctx, surfaces[0], texFor, FALLBACK_WALL_L);
    drawSurface(ctx, surfaces[1], texFor, FALLBACK_WALL_R);
    drawSurface(ctx, surfaces[2], texFor, FALLBACK_FLOOR);
    shadePass(ctx, room, [160, 210]);

    // --- window on the left wall + light spilling onto the floor ---
    drawWindow(ctx, room.wallL, 0.28, 0.16, 0.78, 0.60);
    poly(ctx, [F(0.30, 0.02), F(0.76, 0.02), F(0.90, 0.52), F(0.44, 0.60)], "rgba(255,252,238,0.07)");

    // --- lower cabinets + counter along the right wall ---
    const wF = F(1, 0.10), wN = F(1, 0.86), fF = F(0.78, 0.10), fN = F(0.78, 0.86);
    const hF = hTop(0.10), hN = hTop(0.86);
    edgeShadow(ctx, [fF[0], fF[1]], [fN[0], fN[1]], 22, 0.22);
    poly(ctx, vface(wF, fF, hF - 9, hF - 9), "#525c5e");                          // far end face
    const front = vface(fF, fN, hF - 9, hN - 9);
    poly(ctx, front, "#5f6b6d", "rgba(30,36,38,0.30)", 1.5);
    // toe-kick
    poly(ctx, [[fF[0], fF[1] - 13], [fN[0], fN[1] - 15], fN, fF], "rgba(20,24,26,0.30)");
    // door seams + handles
    for (const t of [0.25, 0.5, 0.75]) {
      const p = F(0.78, 0.10 + t * 0.76);
      const hh = hTop(0.10 + t * 0.76) - 9;
      seg(ctx, [p[0], p[1] - hh], p, "rgba(25,30,32,0.35)", 2, "butt");
    }
    for (const t of [0.12, 0.37, 0.62, 0.87]) {
      const v = 0.10 + t * 0.76;
      const p = F(0.78, v), hh = hTop(v) - 9;
      seg(ctx, [p[0] + 6, p[1] - hh + 14], [p[0] + 30, p[1] - hh + 15], "#c3c9cc", 4);
    }
    // countertop slab
    const top = [
      [wF[0], wF[1] - hF], [wN[0], wN[1] - hN],
      [fN[0] - 7, fN[1] - hN + 2], [fF[0] - 7, fF[1] - hF + 2],
    ];
    poly(ctx, top, "#e8e2d6", "rgba(60,52,42,0.18)", 1.5);
    poly(ctx, [top[3], top[2], [top[2][0], top[2][1] + 9], [top[3][0], top[3][1] + 9]], "#d8d1c3");
    // sink + faucet
    const sink = [F(0.845, 0.235), F(0.965, 0.235), F(0.965, 0.365), F(0.845, 0.365)]
      .map((p, i) => [p[0], p[1] - hTop([0.235, 0.235, 0.365, 0.365][i])]);
    poly(ctx, sink, "#c9c4ba", "rgba(70,64,55,0.25)", 1.5);
    const fb = F(0.985, 0.30), fh = hTop(0.30);
    ctx.beginPath();
    ctx.moveTo(fb[0], fb[1] - fh);
    ctx.lineTo(fb[0], fb[1] - fh - 26);
    ctx.quadraticCurveTo(fb[0] - 2, fb[1] - fh - 38, fb[0] - 18, fb[1] - fh - 34);
    ctx.strokeStyle = "#aeb6ba";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
    // hob with four rings
    const hobPts = [F(0.845, 0.56), F(0.975, 0.56), F(0.975, 0.76), F(0.845, 0.76)]
      .map((p, i) => [p[0], p[1] - hTop([0.56, 0.56, 0.76, 0.76][i]) - 1]);
    poly(ctx, hobPts, "#2e3234", "rgba(0,0,0,0.35)", 1.5);
    for (const [ru, rv, rr] of [[0.88, 0.61, 9], [0.945, 0.61, 7], [0.88, 0.71, 7], [0.945, 0.71, 9]]) {
      const p = F(ru, rv), ph = hTop(rv) + 1;
      ctx.save();
      ctx.translate(p[0], p[1] - ph);
      ctx.scale(1, 0.45);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(235,238,240,0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    // cutting board leaning by the sink — a small warm touch
    const cbp = F(0.86, 0.455), cbh = hTop(0.455);
    poly(ctx, [
      [cbp[0] - 2, cbp[1] - cbh - 44], [cbp[0] + 26, cbp[1] - cbh - 40],
      [cbp[0] + 30, cbp[1] - cbh + 2], [cbp[0] + 2, cbp[1] - cbh + 2],
    ], "#b98d5f", "rgba(70,50,30,0.30)", 1.5);
    ctx.restore();
  }

  return { id: "kuhinja", i18nKey: "scene.kuhinja", draw, surfaces };
}

// ---------------------------------------------------------------------------
// Scene 3 — Dnevni boravak (living room): sofa, window, door
// ---------------------------------------------------------------------------

function makeDnevniBoravak() {
  const room = cornerRoom({
    cx: 350, cTop: 65, cBase: 465,
    lx: -60, lTop: -15, lBase: 595,
    rx: 1060, rTop: -25, rBase: 590,
    nx: 520, ny: 1900,
  });
  const surfaces = [
    { id: "zid-lijevi", kind: "wall", quad: room.wallL, realSizeM: [3.0, 2.7], defaultProductId: "ker-06" },
    { id: "zid-desni", kind: "wall", quad: room.wallR, realSizeM: [4.2, 2.7], defaultProductId: "ker-06" },
    { id: "pod", kind: "floor", quad: room.floor, realSizeM: [3.0, 4.2], defaultProductId: "ker-05" },
  ];
  const F = (u, v) => quadPoint(room.floor, u, v);

  function draw(ctx, w, h, assignments, texFor) {
    ctx.save();
    drawBackdrop(ctx);
    drawSurface(ctx, surfaces[0], texFor, FALLBACK_WALL_L);
    drawSurface(ctx, surfaces[1], texFor, FALLBACK_WALL_R);
    drawSurface(ctx, surfaces[2], texFor, FALLBACK_FLOOR);
    shadePass(ctx, room, [700, 190]);

    // --- vrata (door) on the left wall ---
    const frame = subQuad(room.wallL, 0.50, 0.06, 0.82, 0.985);
    poly(ctx, frame, "#efece6", "rgba(60,60,66,0.20)", 2.5);
    const door = subQuad(room.wallL, 0.525, 0.085, 0.795, 0.975);
    poly(ctx, door, quadGradient(ctx, door, [[0, "#e8e4da"], [1, "#ddd8cc"]]), "rgba(60,60,66,0.16)", 1.5);
    for (const [pv0, pv1] of [[0.10, 0.44], [0.54, 0.88]]) {
      const panel = [
        quadPoint(door, 0.16, pv0), quadPoint(door, 0.84, pv0),
        quadPoint(door, 0.84, pv1), quadPoint(door, 0.16, pv1),
      ];
      poly(ctx, panel, null, "rgba(60,60,66,0.14)", 2);
    }
    const hp = quadPoint(door, 0.88, 0.52);
    ctx.beginPath();
    ctx.arc(hp[0], hp[1], 4, 0, Math.PI * 2);
    ctx.fillStyle = "#8d9499";
    ctx.fill();
    seg(ctx, [hp[0] - 2, hp[1]], [hp[0] - 14, hp[1] + 1], "#8d9499", 3.5);

    // --- prozor (window) with curtains on the right wall ---
    const rod0 = quadPoint(room.wallR, 0.28, 0.05), rod1 = quadPoint(room.wallR, 0.84, 0.05);
    drawWindow(ctx, room.wallR, 0.34, 0.12, 0.78, 0.55);
    seg(ctx, rod0, rod1, "#6f767a", 4);
    for (const [cu0, cu1] of [[0.29, 0.36], [0.76, 0.83]]) {
      const cq = subQuad(room.wallR, cu0, 0.055, cu1, 0.72);
      poly(ctx, cq, quadGradient(ctx, cq, [[0, "#eae3d4"], [1, "#ddd4c1"]]), "rgba(80,74,62,0.14)", 1.5);
      for (const fu of [0.3, 0.55, 0.8]) {
        seg(ctx, quadPoint(cq, fu, 0.02), quadPoint(cq, fu, 0.98), "rgba(80,74,62,0.10)", 2, "butt");
      }
    }

    // --- rug ---
    const rug = [F(0.26, 0.16), F(0.88, 0.16), F(0.96, 0.64), F(0.34, 0.68)];
    poly(ctx, rug, "rgba(197,170,140,0.50)", "rgba(120,96,70,0.30)", 2);
    poly(ctx, [F(0.31, 0.21), F(0.83, 0.21), F(0.90, 0.59), F(0.39, 0.62)], null, "rgba(120,96,70,0.22)", 2);

    // --- sofa (back toward the left wall) ---
    const sofaShadow = F(0.52, 0.50);
    softShadow(ctx, sofaShadow[0], sofaShadow[1] + 4, 190, 34, 0.30);
    // backrest prism (v 0.26..0.33): top face then front face
    const bB0 = F(0.34, 0.26), bB1 = F(0.70, 0.26);
    const bF0 = F(0.34, 0.33), bF1 = F(0.70, 0.33);
    poly(ctx, [
      [bB0[0], bB0[1] - 136], [bB1[0], bB1[1] - 144],
      [bF1[0], bF1[1] - 146], [bF0[0], bF0[1] - 138],
    ], "#5d6e82");
    poly(ctx, vface(bF0, bF1, 138, 146), "#65768a", "rgba(35,42,52,0.25)", 2);
    // back cushions leaning on the backrest
    for (const [cu0, cu1] of [[0.36, 0.465], [0.48, 0.585], [0.60, 0.69]]) {
      const q = [
        [F(cu0, 0.335)[0], F(cu0, 0.335)[1] - 132], [F(cu1, 0.335)[0], F(cu1, 0.335)[1] - 136],
        [F(cu1, 0.335)[0], F(cu1, 0.335)[1] - 84], [F(cu0, 0.335)[0], F(cu0, 0.335)[1] - 82],
      ];
      poly(ctx, q, "#75879b", "rgba(40,48,58,0.22)", 2);
    }
    // seat prism (v 0.33..0.47): left end face, top face, front face
    poly(ctx, vface(F(0.34, 0.33), F(0.34, 0.47), 76, 78), "#61707f");
    poly(ctx, [
      [F(0.34, 0.33)[0], F(0.34, 0.33)[1] - 76], [F(0.70, 0.33)[0], F(0.70, 0.33)[1] - 82],
      [F(0.70, 0.47)[0], F(0.70, 0.47)[1] - 84], [F(0.34, 0.47)[0], F(0.34, 0.47)[1] - 78],
    ], "#78899a");
    poly(ctx, vface(F(0.34, 0.47), F(0.70, 0.47), 78, 84), "#6e7f8d", "rgba(35,42,52,0.25)", 2);
    // seat cushions on the top face
    for (const [cu0, cu1] of [[0.355, 0.46], [0.475, 0.58], [0.595, 0.685]]) {
      const q = [
        [F(cu0, 0.34)[0], F(cu0, 0.34)[1] - 80], [F(cu1, 0.34)[0], F(cu1, 0.34)[1] - 82],
        [F(cu1, 0.465)[0], F(cu1, 0.465)[1] - 86], [F(cu0, 0.465)[0], F(cu0, 0.465)[1] - 84],
      ];
      poly(ctx, q, "#7c8da0", "rgba(40,48,58,0.22)", 2);
    }
    // armrests: end face (u0 side), front face, top face
    for (const [au0, au1] of [[0.315, 0.365], [0.665, 0.715]]) {
      const a0 = F(au0, 0.24), a1 = F(au1, 0.24), a2 = F(au1, 0.49), a3 = F(au0, 0.49);
      poly(ctx, vface(a0, a3, 100, 104), "#6b7c8a");
      poly(ctx, vface(a3, a2, 104, 106), "#697a88", "rgba(35,42,52,0.25)", 2);
      poly(ctx, [
        [a0[0], a0[1] - 100], [a1[0], a1[1] - 102],
        [a2[0], a2[1] - 106], [a3[0], a3[1] - 104],
      ], "#728391");
    }
    // throw pillow accent on the seat
    const pp = [
      [F(0.405, 0.35)[0], F(0.405, 0.35)[1] - 122], [F(0.465, 0.345)[0], F(0.465, 0.345)[1] - 126],
      [F(0.47, 0.375)[0], F(0.47, 0.375)[1] - 88], [F(0.41, 0.38)[0], F(0.41, 0.38)[1] - 86],
    ];
    poly(ctx, pp, "#b9895e", "rgba(90,60,35,0.30)", 2);

    // --- plant near the viewer, right side ---
    const pot = F(0.88, 0.74);
    softShadow(ctx, pot[0], pot[1] + 4, 44, 12, 0.24);
    poly(ctx, [
      [pot[0] - 26, pot[1] - 46], [pot[0] + 26, pot[1] - 46],
      [pot[0] + 18, pot[1]], [pot[0] - 18, pot[1]],
    ], "#b06a4a", "rgba(90,50,30,0.30)", 2);
    ctx.strokeStyle = "#4f7a52";
    ctx.lineCap = "round";
    for (const [dx, dy, cx2, lw] of [
      [-56, -84, -76, 5], [-28, -116, -40, 6], [6, -126, 14, 6],
      [40, -104, 66, 5], [62, -66, 88, 5], [-10, -132, -2, 4],
    ]) {
      ctx.beginPath();
      ctx.moveTo(pot[0], pot[1] - 44);
      ctx.quadraticCurveTo(pot[0] + cx2, pot[1] - 66 + dy * 0.35, pot[0] + dx, pot[1] - 50 + dy);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
  }

  return { id: "dnevni-boravak", i18nKey: "scene.dnevniBoravak", draw, surfaces };
}

export const SCENES = [makeKupaonica(), makeKuhinja(), makeDnevniBoravak()];
