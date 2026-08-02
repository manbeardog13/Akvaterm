// ============================================================================
// data/scenes.js — the five designer scenes, procedurally DRAWN (vector
// illustration on canvas, no photos). Each scene renders a room as exact
// projective quads (mirrored in surfaces[] with realSizeM for physical tile
// scale), fixtures as clean vector shapes with soft shadows, and an ambient
// gradient + baked shadow pass applied AFTER the surface textures so tiles sit
// under light.
// Surfaces receive textures through texFor(surfaceId) ->
// {canvas, cellSizeMm, offsetPct?} and are painted with the homography mesh
// warp from js/scene2d.js.
// Design space: 1000x700. Quad corner order everywhere: TL, TR, BR, BL.
//
// Cameras (deliberately different, so the scene strip is not five of the same
// picture):
//   kupaonica / kuhinja / dnevni-boravak  — corner perspective, 2 walls + floor
//   mala-kupaonica                        — frontal one-point, 3 walls + floor
//   predsoblje                            — deep corridor one-point, 3 + floor
//
// LIGHTING (Iris): every tone below is DERIVED from the five pixel-sampled
// palette colours in docs/DESIGN_SYSTEM.md via MIX()/RGBA() — nothing here is
// an eyeballed hex. The rooms are lit like the reference photograph: a warm
// amber key from the window side, a cool teal fill from the opposite side, and
// warm (never neutral-black) shadows built on --shadow-warm / --brown-800.
// ============================================================================
import { drawTexturedQuad, fillQuad, quadPoint, subQuad } from "../js/scene2d.js";

// ---------------------------------------------------------------------------
// Iris palette — pixel-sampled values, docs/DESIGN_SYSTEM.md. Held as RGB
// triples so every scene tone can be MIXed/alpha'd from them rather than
// invented. Contrast is not a concern inside the canvas illustration (no text
// is drawn there); the contrast-critical pairs all live in the view chrome.
// ---------------------------------------------------------------------------
const HEX = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const MIX = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const RGB = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const RGBA = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

const SKY_200 = HEX("#C0D8F2");
const TEAL_600 = HEX("#139EB1");
const TEAL_300 = HEX("#09AFBD");
const TEAL_400 = HEX("#40AFCA");
const MAUVE_400 = HEX("#A6979C");
const AMBER_500 = HEX("#EAA651");
const AMBER_600 = HEX("#B96C1C");
const BROWN_800 = HEX("#68340F");
const BROWN_700 = HEX("#83440F");
const SHADOW_WARM = HEX("#5D4F4F");
const PAPER = HEX("#F2F2F2");
const WHITE = [255, 255, 255];

/** Derived materials — every one a MIX of sampled colours, never a new hex. */
const MAT = {
  porcelain:   RGB(MIX(WHITE, SKY_200, 0.05)),          // sanitary ware
  porcelainLo: RGB(MIX(WHITE, SKY_200, 0.14)),          // its shaded face
  porcelainHi: RGB(WHITE),
  chrome:      RGB(MIX(MAUVE_400, SKY_200, 0.42)),      // taps, rails, rods
  chromeDark:  RGB(MIX(MAUVE_400, SHADOW_WARM, 0.45)),
  stone:       RGB(MIX(PAPER, MAUVE_400, 0.16)),        // counter slabs
  stoneLo:     RGB(MIX(PAPER, MAUVE_400, 0.32)),
  woodWarm:    RGB(MIX(BROWN_700, AMBER_500, 0.34)),    // vanity / cabinet fronts
  woodWarmLo:  RGB(MIX(BROWN_800, AMBER_600, 0.22)),
  woodLight:   RGB(MIX(AMBER_500, PAPER, 0.30)),        // cutting board, shelves
  cabinetCool: RGB(MIX(TEAL_600, SHADOW_WARM, 0.52)),   // kitchen cabinet fronts
  cabinetCoolLo: RGB(MIX(TEAL_600, SHADOW_WARM, 0.72)),
  upholstery:  RGB(MIX(TEAL_600, SHADOW_WARM, 0.38)),   // sofa body
  upholsteryHi: RGB(MIX(TEAL_400, PAPER, 0.30)),
  upholsteryLo: RGB(MIX(TEAL_600, SHADOW_WARM, 0.58)),
  textileWarm: RGB(MIX(PAPER, AMBER_500, 0.24)),        // curtains, towels
  textileWarmLo: RGB(MIX(PAPER, AMBER_600, 0.30)),
  terracotta:  RGB(MIX(AMBER_600, BROWN_700, 0.30)),    // pot, throw pillow
  foliage:     RGB(MIX(TEAL_600, AMBER_600, 0.42)),     // plant — teal+amber = olive
  trim:        RGB(MIX(PAPER, WHITE, 0.55)),            // frames, sills, doors
  trimLo:      RGB(MIX(PAPER, MAUVE_400, 0.13)),
  glassTeal:   RGBA(TEAL_400, 0.24),                    // shower / partition glass
  glassLine:   RGBA(MIX(TEAL_600, SHADOW_WARM, 0.5), 0.45),
  glassRim:    RGBA(TEAL_300, 0.55),                    // bright rim light on glass
  skyGlassHi:  RGB(MIX(SKY_200, WHITE, 0.62)),
  darkAppl:    RGB(MIX(SHADOW_WARM, BROWN_800, 0.55)),  // hob, dark appliances
};

// Shadow/light inks. Warm shadow per the design system ("use --shadow-warm for
// shadows instead of neutral black"); key light amber, fill light teal.
const SH = SHADOW_WARM;                 // contact + drop shadows
const SH_DEEP = MIX(SHADOW_WARM, BROWN_800, 0.55);   // ambient occlusion
const KEY = AMBER_500;                  // warm key light
const FILL = TEAL_600;                  // cool fill light
const SEAM = MIX(SHADOW_WARM, BROWN_800, 0.35);

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

/** Trace an arbitrary point list as a closed path (for clipping). */
function pathPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Vertical face standing on the floor segment p0->p1, heights in px. */
function vface(p0, p1, h0, h1) {
  return [[p0[0], p0[1] - h0], [p1[0], p1[1] - h1], [p1[0], p1[1]], [p0[0], p0[1]]];
}

/** Soft elliptical contact shadow — warm, per the Iris shadow rule. */
function softShadow(ctx, x, y, rx, ry, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, RGBA(SH_DEEP, alpha));
  g.addColorStop(0.65, RGBA(SH_DEEP, alpha * 0.45));
  g.addColorStop(1, RGBA(SH_DEEP, 0));
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
  g.addColorStop(0, RGBA(SH, alpha));
  g.addColorStop(1, RGBA(SH, 0));
  poly(ctx, [p0, p1, [p1[0] + nx * len, p1[1] + ny * len], [p0[0] + nx * len, p0[1] + ny * len]], g);
}

/**
 * Screen px per real metre across a quad at parameter v, given the quad's real
 * width. quadPoint() is the exact perspective map, so this is measured geometry
 * rather than a hand-tuned constant: a 0.9 m object at depth v is simply
 * 0.9 * spanScale(quad, v, widthM) pixels tall on screen.
 */
function spanScale(quad, v, widthM) {
  const a = quadPoint(quad, 0, v), b = quadPoint(quad, 1, v);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / widthM;
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

/**
 * Frontal one-point room: a flat back wall, two side walls converging toward
 * the viewer and the floor running out of frame. `b` is the back-wall rect
 * (bx0..bx1, by0..by1), `n` the near frame (nx0..nx1, nyTop..nyBase).
 * u runs near->far on the left wall and far->near on the right wall, so both
 * side walls tile away from the camera.
 */
function frontalRoom(o) {
  const back = [[o.bx0, o.by0], [o.bx1, o.by0], [o.bx1, o.by1], [o.bx0, o.by1]];
  const wallL = [[o.nx0, o.nyTop], [o.bx0, o.by0], [o.bx0, o.by1], [o.nx0, o.nyBase]];
  const wallR = [[o.bx1, o.by0], [o.nx1, o.nyTop], [o.nx1, o.nyBase], [o.bx1, o.by1]];
  const floor = [[o.bx0, o.by1], [o.bx1, o.by1], [o.nx1, o.nyBase], [o.nx0, o.nyBase]];
  const ceil = [[o.nx0, o.nyTop], [o.nx1, o.nyTop], [o.bx1, o.by0], [o.bx0, o.by0]];
  return { o, back, wallL, wallR, floor, ceil };
}

/** One surface: warped texture when assigned, quiet plaster fallback when not. */
function drawSurface(ctx, s, texFor, fallback) {
  const tex = texFor(s.id);
  if (tex && tex.canvas) {
    // offsetPct (laying offset) rides along on the texture record; absent on an
    // older texFor implementation, in which case the warp uses no phase shift.
    drawTexturedQuad(ctx, s.quad, tex.canvas, tex.cellSizeMm, s.realSizeM, tex.offsetPct);
  } else {
    fillQuad(ctx, s.quad, quadGradient(ctx, s.quad, fallback));
  }
}

// Bare-plaster fallbacks, derived: paper warmed toward mauve/brown so an
// untiled room already sits in the Iris world instead of reading cold grey.
const FALLBACK_WALL_L = [[0, RGB(MIX(PAPER, MAUVE_400, 0.13))], [1, RGB(MIX(PAPER, MAUVE_400, 0.30))]];
const FALLBACK_WALL_R = [[0, RGB(MIX(PAPER, MAUVE_400, 0.20))], [1, RGB(MIX(PAPER, MAUVE_400, 0.36))]];
const FALLBACK_WALL_B = [[0, RGB(MIX(PAPER, MAUVE_400, 0.10))], [1, RGB(MIX(PAPER, MAUVE_400, 0.26))]];
const FALLBACK_FLOOR = [[0, RGB(MIX(PAPER, BROWN_700, 0.22))], [1, RGB(MIX(PAPER, BROWN_700, 0.33))]];

/** Warm ambient backdrop behind the walls (paper warmed toward amber/brown). */
function drawBackdrop(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 700);
  g.addColorStop(0, RGB(MIX(PAPER, AMBER_500, 0.07)));
  g.addColorStop(0.5, RGB(MIX(PAPER, AMBER_600, 0.10)));
  g.addColorStop(1, RGB(MIX(PAPER, BROWN_700, 0.16)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1000, 700);
}

/**
 * The light rig, shared by every scene and drawn AFTER the surface textures.
 * `key` is the warm amber source (window / lamp side), `fill` the cool teal
 * bounce from the opposite side — the reference photograph's teal-in-amber
 * relationship, applied to the room rather than only to the chrome.
 */
function lightPass(ctx, key, fill) {
  // warm key wash
  const kw = ctx.createRadialGradient(key[0], key[1], 30, key[0], key[1], 660);
  kw.addColorStop(0, RGBA(KEY, 0.15));
  kw.addColorStop(0.55, RGBA(KEY, 0.06));
  kw.addColorStop(1, RGBA(KEY, 0));
  ctx.fillStyle = kw;
  ctx.fillRect(0, 0, 1000, 700);
  // cool teal fill from the opposite side
  const fw = ctx.createRadialGradient(fill[0], fill[1], 40, fill[0], fill[1], 720);
  fw.addColorStop(0, RGBA(FILL, 0.085));
  fw.addColorStop(1, RGBA(FILL, 0));
  ctx.fillStyle = fw;
  ctx.fillRect(0, 0, 1000, 700);
  // warm vignette, so the frame closes on brown rather than on grey
  const vg = ctx.createRadialGradient(500, 250, 140, 500, 330, 780);
  vg.addColorStop(0, RGBA(BROWN_800, 0));
  vg.addColorStop(1, RGBA(BROWN_800, 0.17));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, 1000, 700);
}

/**
 * Corner-room ambient + baked shadow pass: corner ambient occlusion, wall-base
 * contact bands, hairline seams, then the shared light rig.
 * `key` defaults opposite `fill` so existing call sites keep one argument.
 */
function shadePass(ctx, room, key, fill) {
  const { o, wallL, wallR } = room;
  const k = key || [500, 180];
  const f = fill || [1000 - k[0], 620];
  // corner AO band
  const ao = ctx.createLinearGradient(o.cx - 85, 0, o.cx + 85, 0);
  ao.addColorStop(0, RGBA(SH_DEEP, 0));
  ao.addColorStop(0.5, RGBA(SH_DEEP, 0.12));
  ao.addColorStop(1, RGBA(SH_DEEP, 0));
  ctx.fillStyle = ao;
  ctx.fillRect(o.cx - 85, 0, 170, 700);
  // baked shadow along both wall bases onto the floor
  edgeShadow(ctx, wallL[3], wallL[2], 26, 0.17);
  edgeShadow(ctx, wallR[3], wallR[2], 26, 0.17);
  // hairline seams: wall bases, corner, wall tops
  seg(ctx, wallL[3], wallL[2], RGBA(SEAM, 0.22), 2, "butt");
  seg(ctx, wallR[3], wallR[2], RGBA(SEAM, 0.22), 2, "butt");
  seg(ctx, [o.cx, o.cTop], [o.cx, o.cBase], RGBA(SEAM, 0.14), 2, "butt");
  seg(ctx, wallL[0], wallL[1], RGBA(SEAM, 0.09), 2, "butt");
  seg(ctx, wallR[0], wallR[1], RGBA(SEAM, 0.09), 2, "butt");
  lightPass(ctx, k, f);
}

/** The same rig for a frontal/corridor room: seams on both inside corners. */
function frontalShadePass(ctx, room, key, fill) {
  const { back, wallL, wallR, floor } = room;
  for (const x of [back[0][0], back[1][0]]) {
    const ao = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
    ao.addColorStop(0, RGBA(SH_DEEP, 0));
    ao.addColorStop(0.5, RGBA(SH_DEEP, 0.11));
    ao.addColorStop(1, RGBA(SH_DEEP, 0));
    ctx.fillStyle = ao;
    ctx.fillRect(x - 60, 0, 120, 700);
  }
  edgeShadow(ctx, floor[0], floor[1], 24, 0.19);      // back wall base
  edgeShadow(ctx, wallL[3], wallL[2], 22, 0.15);
  edgeShadow(ctx, wallR[2], wallR[3], 22, 0.15);
  seg(ctx, back[3], back[2], RGBA(SEAM, 0.24), 2, "butt");
  seg(ctx, back[0], back[3], RGBA(SEAM, 0.15), 2, "butt");
  seg(ctx, back[1], back[2], RGBA(SEAM, 0.15), 2, "butt");
  seg(ctx, wallL[3], wallL[2], RGBA(SEAM, 0.20), 2, "butt");
  seg(ctx, wallR[3], wallR[2], RGBA(SEAM, 0.20), 2, "butt");
  seg(ctx, back[0], back[1], RGBA(SEAM, 0.10), 2, "butt");
  lightPass(ctx, key, fill);
}

/** Window with frame, sky, sun glow and a mullion, as a wall sub-quad. */
function drawWindow(ctx, wall, u0, v0, u1, v1) {
  const frame = subQuad(wall, u0, v0, u1, v1);
  const iu = (u1 - u0) * 0.07, iv = (v1 - v0) * 0.07;
  const glass = subQuad(wall, u0 + iu, v0 + iv, u1 - iu, v1 - iv);
  poly(ctx, frame, MAT.trim, RGBA(SEAM, 0.20), 2);
  poly(ctx, glass, quadGradient(ctx, glass, [
    [0, RGB(SKY_200)],
    [0.72, MAT.skyGlassHi],
    [1, RGB(MIX(SKY_200, WHITE, 0.82))],
  ]));
  // sun glow — the warm key light entering the room
  const gp = quadPoint(wall, u0 + (u1 - u0) * 0.68, v0 + (v1 - v0) * 0.30);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(glass[0][0], glass[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(glass[i][0], glass[i][1]);
  ctx.closePath();
  ctx.clip();
  const sun = ctx.createRadialGradient(gp[0], gp[1], 4, gp[0], gp[1], 90);
  sun.addColorStop(0, RGBA(MIX(AMBER_500, WHITE, 0.55), 0.9));
  sun.addColorStop(1, RGBA(AMBER_500, 0));
  ctx.fillStyle = sun;
  ctx.fillRect(gp[0] - 100, gp[1] - 100, 200, 200);
  ctx.restore();
  // mullion + inner frame line
  const um = (u0 + u1) / 2;
  seg(ctx, quadPoint(wall, um, v0 + iv), quadPoint(wall, um, v1 - iv), MAT.trim, 5, "butt");
  poly(ctx, glass, null, RGBA(SEAM, 0.24), 2);
  // sill with its own shadow
  const sill = subQuad(wall, u0 - 0.015, v1, u1 + 0.015, v1 + 0.035);
  poly(ctx, sill, MAT.trimLo, RGBA(SEAM, 0.18), 1.5);
  edgeShadow(ctx, sill[3], sill[2], 14, 0.13);
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
    // warm key from the mirror/window side, cool teal bounce off the shower glass
    shadePass(ctx, room, [700, 130], [120, 600]);

    // --- WC silhouette near the corner (right wall, behind the vanity) ---
    const cb = F(0.935, 0.165);
    softShadow(ctx, cb[0], cb[1] + 8, 58, 15, 0.26);
    const c0 = F(0.985, 0.10), c1 = F(0.985, 0.235);
    poly(ctx, vface(c0, c1, 118, 122), MAT.porcelain, RGBA(SEAM, 0.16), 1.5);   // cistern
    poly(ctx, [
      [c0[0] - 3, c0[1] - 118], [c1[0] + 3, c1[1] - 122],
      [c1[0] + 3, c1[1] - 112], [c0[0] - 3, c0[1] - 108],
    ], MAT.porcelainLo);                                                                // lid
    ctx.fillStyle = MAT.chrome;
    ctx.fillRect((c0[0] + c1[0]) / 2 - 7, (c0[1] + c1[1]) / 2 - 119, 14, 5);      // button
    poly(ctx, [                                                                    // pedestal
      [cb[0] - 16, cb[1] - 58], [cb[0] + 16, cb[1] - 58],
      [cb[0] + 11, cb[1]], [cb[0] - 11, cb[1]],
    ], MAT.porcelainLo);
    ctx.save();                                                                    // bowl + seat
    ctx.translate(cb[0], cb[1] - 60);
    ctx.scale(1, 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, 33, 0, Math.PI * 2);
    ctx.fillStyle = MAT.porcelain;
    ctx.fill();
    ctx.strokeStyle = RGBA(SEAM, 0.18);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.strokeStyle = RGBA(SEAM, 0.14);
    ctx.stroke();
    ctx.restore();

    // --- mirror above the vanity (right wall) ---
    const mirror = subQuad(room.wallR, 0.36, 0.14, 0.66, 0.50);
    poly(ctx, mirror, quadGradient(ctx, mirror, [[0, RGB(MIX(SKY_200, SHADOW_WARM, 0.18))], [1, MAT.skyGlassHi]]), MAT.chromeDark, 4);
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
    poly(ctx, vface(wF, fF, hF - 12, hF - 12), MAT.woodWarmLo);                      // far end face
    const front = vface(fF, fN, hF - 12, hN - 12);
    poly(ctx, front, MAT.woodWarm, RGBA(SH_DEEP, 0.28), 1.5);                    // front face
    const dm = [(fF[0] + fN[0]) / 2, (fF[1] + fN[1]) / 2];
    seg(ctx, [dm[0], dm[1] - (hF + hN) / 2 + 16], dm, RGBA(SH_DEEP, 0.32), 2); // door seam
    seg(ctx, [dm[0] - 34, dm[1] - (hF + hN) / 2 + 34], [dm[0] - 16, dm[1] - (hF + hN) / 2 + 35], MAT.chrome, 4);
    seg(ctx, [dm[0] + 16, dm[1] - (hF + hN) / 2 + 36], [dm[0] + 34, dm[1] - (hF + hN) / 2 + 37], MAT.chrome, 4);
    // counter slab (slight overhang)
    const top = [
      [wF[0], wF[1] - hF], [wN[0], wN[1] - hN],
      [fN[0] - 6, fN[1] - hN + 2], [fF[0] - 6, fF[1] - hF + 2],
    ];
    poly(ctx, top, MAT.stone, RGBA(SEAM, 0.20), 1.5);
    poly(ctx, [top[3], top[2], [top[2][0], top[2][1] + 9], [top[3][0], top[3][1] + 9]], MAT.stoneLo);
    // basin + faucet
    const bc = F(0.90, 0.52), bh = hTopR(0.52);
    ctx.save();
    ctx.translate(bc[0], bc[1] - bh);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fillStyle = MAT.porcelainHi;
    ctx.fill();
    ctx.strokeStyle = RGBA(SEAM, 0.26);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 4, 30, 0, Math.PI * 2);
    ctx.fillStyle = MAT.porcelain;
    ctx.fill();
    ctx.restore();
    const fc = F(0.975, 0.52);
    seg(ctx, [fc[0], fc[1] - bh - 2], [fc[0], fc[1] - bh - 26], MAT.chrome, 4);
    seg(ctx, [fc[0], fc[1] - bh - 26], [fc[0] - 16, fc[1] - bh - 22], MAT.chrome, 4);

    // --- towel on the right wall ---
    const t0 = quadPoint(room.wallR, 0.74, 0.34), t1 = quadPoint(room.wallR, 0.84, 0.335);
    seg(ctx, t0, t1, MAT.chromeDark, 4);
    poly(ctx, [
      [t0[0] + 4, t0[1] + 2], [t1[0] - 4, t1[1] + 2],
      [t1[0] - 2, t1[1] + 74], [t0[0] + 2, t0[1] + 78],
    ], MAT.textileWarm, RGBA(SEAM, 0.16), 1.5);

    // --- shower: head, drain, glass panel last (translucent) ---
    const hp = quadPoint(room.wallL, 0.80, 0.13);
    seg(ctx, hp, [hp[0] + 26, hp[1] + 9], MAT.chromeDark, 5);
    ctx.save();
    ctx.translate(hp[0] + 30, hp[1] + 12);
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = MAT.chrome;
    ctx.fill();
    ctx.restore();
    const dr = F(0.74, 0.075);
    ctx.save();
    ctx.translate(dr[0], dr[1]);
    ctx.scale(1, 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = RGBA(SH, 0.5);
    ctx.fill();
    ctx.restore();
    const g0 = F(0.48, 0.16), g1 = F(0.96, 0.16);
    softShadow(ctx, (g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 + 4, 120, 14, 0.18);
    const glass = vface(g0, g1, 372, 298);
    poly(ctx, glass, MAT.glassTeal, MAT.glassLine, 2);
    seg(ctx, glass[0], glass[1], MAT.chrome, 5);                                   // chrome top bar
    seg(ctx, glass[0], glass[3], MAT.chrome, 4);                                   // chrome near edge
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
    // warm key through the left window, cool fill from the worktop side
    shadePass(ctx, room, [190, 200], [880, 620]);

    // --- window on the left wall + light spilling onto the floor ---
    drawWindow(ctx, room.wallL, 0.28, 0.16, 0.78, 0.60);
    poly(ctx, [F(0.30, 0.02), F(0.76, 0.02), F(0.90, 0.52), F(0.44, 0.60)], RGBA(AMBER_500, 0.09));

    // --- lower cabinets + counter along the right wall ---
    const wF = F(1, 0.10), wN = F(1, 0.86), fF = F(0.78, 0.10), fN = F(0.78, 0.86);
    const hF = hTop(0.10), hN = hTop(0.86);
    edgeShadow(ctx, [fF[0], fF[1]], [fN[0], fN[1]], 22, 0.22);
    poly(ctx, vface(wF, fF, hF - 9, hF - 9), MAT.cabinetCoolLo);                          // far end face
    const front = vface(fF, fN, hF - 9, hN - 9);
    poly(ctx, front, MAT.cabinetCool, RGBA(SH_DEEP, 0.32), 1.5);
    // toe-kick
    poly(ctx, [[fF[0], fF[1] - 13], [fN[0], fN[1] - 15], fN, fF], RGBA(SH_DEEP, 0.32));
    // door seams + handles
    for (const t of [0.25, 0.5, 0.75]) {
      const p = F(0.78, 0.10 + t * 0.76);
      const hh = hTop(0.10 + t * 0.76) - 9;
      seg(ctx, [p[0], p[1] - hh], p, RGBA(SH_DEEP, 0.36), 2, "butt");
    }
    for (const t of [0.12, 0.37, 0.62, 0.87]) {
      const v = 0.10 + t * 0.76;
      const p = F(0.78, v), hh = hTop(v) - 9;
      seg(ctx, [p[0] + 6, p[1] - hh + 14], [p[0] + 30, p[1] - hh + 15], MAT.chrome, 4);
    }
    // countertop slab
    const top = [
      [wF[0], wF[1] - hF], [wN[0], wN[1] - hN],
      [fN[0] - 7, fN[1] - hN + 2], [fF[0] - 7, fF[1] - hF + 2],
    ];
    poly(ctx, top, MAT.stone, RGBA(SEAM, 0.20), 1.5);
    poly(ctx, [top[3], top[2], [top[2][0], top[2][1] + 9], [top[3][0], top[3][1] + 9]], MAT.stoneLo);
    // sink + faucet
    const sink = [F(0.845, 0.235), F(0.965, 0.235), F(0.965, 0.365), F(0.845, 0.365)]
      .map((p, i) => [p[0], p[1] - hTop([0.235, 0.235, 0.365, 0.365][i])]);
    poly(ctx, sink, MAT.stoneLo, RGBA(SEAM, 0.26), 1.5);
    const fb = F(0.985, 0.30), fh = hTop(0.30);
    ctx.beginPath();
    ctx.moveTo(fb[0], fb[1] - fh);
    ctx.lineTo(fb[0], fb[1] - fh - 26);
    ctx.quadraticCurveTo(fb[0] - 2, fb[1] - fh - 38, fb[0] - 18, fb[1] - fh - 34);
    ctx.strokeStyle = MAT.chrome;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
    // hob with four rings
    const hobPts = [F(0.845, 0.56), F(0.975, 0.56), F(0.975, 0.76), F(0.845, 0.76)]
      .map((p, i) => [p[0], p[1] - hTop([0.56, 0.56, 0.76, 0.76][i]) - 1]);
    poly(ctx, hobPts, MAT.darkAppl, RGBA(SH_DEEP, 0.38), 1.5);
    for (const [ru, rv, rr] of [[0.88, 0.61, 9], [0.945, 0.61, 7], [0.88, 0.71, 7], [0.945, 0.71, 9]]) {
      const p = F(ru, rv), ph = hTop(rv) + 1;
      ctx.save();
      ctx.translate(p[0], p[1] - ph);
      ctx.scale(1, 0.45);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.strokeStyle = RGBA(MIX(SKY_200, WHITE, 0.5), 0.4);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    // cutting board leaning by the sink — a small warm touch
    const cbp = F(0.86, 0.455), cbh = hTop(0.455);
    poly(ctx, [
      [cbp[0] - 2, cbp[1] - cbh - 44], [cbp[0] + 26, cbp[1] - cbh - 40],
      [cbp[0] + 30, cbp[1] - cbh + 2], [cbp[0] + 2, cbp[1] - cbh + 2],
    ], MAT.woodLight, RGBA(SH_DEEP, 0.32), 1.5);
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
    // warm key through the right window, cool fill from the doorway
    shadePass(ctx, room, [720, 175], [130, 590]);

    // --- vrata (door) on the left wall ---
    const frame = subQuad(room.wallL, 0.50, 0.06, 0.82, 0.985);
    poly(ctx, frame, MAT.trim, RGBA(SEAM, 0.22), 2.5);
    const door = subQuad(room.wallL, 0.525, 0.085, 0.795, 0.975);
    poly(ctx, door, quadGradient(ctx, door, [[0, MAT.textileWarm], [1, MAT.trimLo]]), RGBA(SEAM, 0.18), 1.5);
    for (const [pv0, pv1] of [[0.10, 0.44], [0.54, 0.88]]) {
      const panel = [
        quadPoint(door, 0.16, pv0), quadPoint(door, 0.84, pv0),
        quadPoint(door, 0.84, pv1), quadPoint(door, 0.16, pv1),
      ];
      poly(ctx, panel, null, RGBA(SEAM, 0.16), 2);
    }
    const hp = quadPoint(door, 0.88, 0.52);
    ctx.beginPath();
    ctx.arc(hp[0], hp[1], 4, 0, Math.PI * 2);
    ctx.fillStyle = MAT.chromeDark;
    ctx.fill();
    seg(ctx, [hp[0] - 2, hp[1]], [hp[0] - 14, hp[1] + 1], MAT.chromeDark, 3.5);

    // --- prozor (window) with curtains on the right wall ---
    const rod0 = quadPoint(room.wallR, 0.28, 0.05), rod1 = quadPoint(room.wallR, 0.84, 0.05);
    drawWindow(ctx, room.wallR, 0.34, 0.12, 0.78, 0.55);
    seg(ctx, rod0, rod1, MAT.chromeDark, 4);
    for (const [cu0, cu1] of [[0.29, 0.36], [0.76, 0.83]]) {
      const cq = subQuad(room.wallR, cu0, 0.055, cu1, 0.72);
      poly(ctx, cq, quadGradient(ctx, cq, [[0, MAT.textileWarm], [1, MAT.textileWarmLo]]), RGBA(SEAM, 0.15), 1.5);
      for (const fu of [0.3, 0.55, 0.8]) {
        seg(ctx, quadPoint(cq, fu, 0.02), quadPoint(cq, fu, 0.98), RGBA(SEAM, 0.11), 2, "butt");
      }
    }

    // --- rug ---
    const rug = [F(0.26, 0.16), F(0.88, 0.16), F(0.96, 0.64), F(0.34, 0.68)];
    poly(ctx, rug, RGBA(MIX(AMBER_500, PAPER, 0.42), 0.55), RGBA(BROWN_700, 0.32), 2);
    poly(ctx, [F(0.31, 0.21), F(0.83, 0.21), F(0.90, 0.59), F(0.39, 0.62)], null, RGBA(BROWN_700, 0.24), 2);

    // --- sofa (back toward the left wall) ---
    const sofaShadow = F(0.52, 0.50);
    softShadow(ctx, sofaShadow[0], sofaShadow[1] + 4, 190, 34, 0.30);
    // backrest prism (v 0.26..0.33): top face then front face
    const bB0 = F(0.34, 0.26), bB1 = F(0.70, 0.26);
    const bF0 = F(0.34, 0.33), bF1 = F(0.70, 0.33);
    poly(ctx, [
      [bB0[0], bB0[1] - 136], [bB1[0], bB1[1] - 144],
      [bF1[0], bF1[1] - 146], [bF0[0], bF0[1] - 138],
    ], MAT.upholsteryLo);
    poly(ctx, vface(bF0, bF1, 138, 146), MAT.upholstery, RGBA(SH_DEEP, 0.26), 2);
    // back cushions leaning on the backrest
    for (const [cu0, cu1] of [[0.36, 0.465], [0.48, 0.585], [0.60, 0.69]]) {
      const q = [
        [F(cu0, 0.335)[0], F(cu0, 0.335)[1] - 132], [F(cu1, 0.335)[0], F(cu1, 0.335)[1] - 136],
        [F(cu1, 0.335)[0], F(cu1, 0.335)[1] - 84], [F(cu0, 0.335)[0], F(cu0, 0.335)[1] - 82],
      ];
      poly(ctx, q, MAT.upholsteryHi, RGBA(SH_DEEP, 0.24), 2);
    }
    // seat prism (v 0.33..0.47): left end face, top face, front face
    poly(ctx, vface(F(0.34, 0.33), F(0.34, 0.47), 76, 78), MAT.upholsteryLo);
    poly(ctx, [
      [F(0.34, 0.33)[0], F(0.34, 0.33)[1] - 76], [F(0.70, 0.33)[0], F(0.70, 0.33)[1] - 82],
      [F(0.70, 0.47)[0], F(0.70, 0.47)[1] - 84], [F(0.34, 0.47)[0], F(0.34, 0.47)[1] - 78],
    ], MAT.upholsteryHi);
    poly(ctx, vface(F(0.34, 0.47), F(0.70, 0.47), 78, 84), MAT.upholstery, RGBA(SH_DEEP, 0.26), 2);
    // seat cushions on the top face
    for (const [cu0, cu1] of [[0.355, 0.46], [0.475, 0.58], [0.595, 0.685]]) {
      const q = [
        [F(cu0, 0.34)[0], F(cu0, 0.34)[1] - 80], [F(cu1, 0.34)[0], F(cu1, 0.34)[1] - 82],
        [F(cu1, 0.465)[0], F(cu1, 0.465)[1] - 86], [F(cu0, 0.465)[0], F(cu0, 0.465)[1] - 84],
      ];
      poly(ctx, q, MAT.upholsteryHi, RGBA(SH_DEEP, 0.24), 2);
    }
    // armrests: end face (u0 side), front face, top face
    for (const [au0, au1] of [[0.315, 0.365], [0.665, 0.715]]) {
      const a0 = F(au0, 0.24), a1 = F(au1, 0.24), a2 = F(au1, 0.49), a3 = F(au0, 0.49);
      poly(ctx, vface(a0, a3, 100, 104), MAT.upholstery);
      poly(ctx, vface(a3, a2, 104, 106), MAT.upholsteryLo, RGBA(SH_DEEP, 0.26), 2);
      poly(ctx, [
        [a0[0], a0[1] - 100], [a1[0], a1[1] - 102],
        [a2[0], a2[1] - 106], [a3[0], a3[1] - 104],
      ], MAT.upholsteryHi);
    }
    // throw pillow accent on the seat
    const pp = [
      [F(0.405, 0.35)[0], F(0.405, 0.35)[1] - 122], [F(0.465, 0.345)[0], F(0.465, 0.345)[1] - 126],
      [F(0.47, 0.375)[0], F(0.47, 0.375)[1] - 88], [F(0.41, 0.38)[0], F(0.41, 0.38)[1] - 86],
    ];
    poly(ctx, pp, MAT.terracotta, RGBA(SH_DEEP, 0.32), 2);

    // --- plant near the viewer, right side ---
    const pot = F(0.88, 0.74);
    softShadow(ctx, pot[0], pot[1] + 4, 44, 12, 0.24);
    poly(ctx, [
      [pot[0] - 26, pot[1] - 46], [pot[0] + 26, pot[1] - 46],
      [pot[0] + 18, pot[1]], [pot[0] - 18, pot[1]],
    ], MAT.terracotta, RGBA(SH_DEEP, 0.32), 2);
    ctx.strokeStyle = MAT.foliage;
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

  // i18nKey matches the shipped dictionary entry in js/i18n.js ("scene.dnevni-boravak");
  // the previous camelCase key missed and fell through to the view's inline fallback.
  return { id: "dnevni-boravak", i18nKey: "scene.dnevni-boravak", draw, surfaces };
}

// ---------------------------------------------------------------------------
// Scene 4 — Mala kupaonica (compact bathroom), FRONTAL one-point camera.
// A deliberately different viewpoint from the three corner rooms: you stand in
// a narrow room and look straight at the back wall, so the two side walls read
// as steep converging planes and the back wall becomes a natural accent-tile
// surface. Geometry is metrically consistent, not eyeballed:
//   back wall 1.7 m x 2.5 m drawn 258 x 380 px  -> 151.8 px/m both axes
//   near frame                 drawn 1140 x 1680 px -> 670.6 / 672 px/m
// i.e. one camera, one scale factor (4.42x over 2.1 m of depth, eye at 1.5 m).
// ---------------------------------------------------------------------------

function makeMalaKupaonica() {
  const room = frontalRoom({
    bx0: 371, bx1: 629, by0: 90, by1: 470,
    nx0: -70, nx1: 1070, nyTop: -430, nyBase: 1250,
  });
  const W_M = 1.7, D_M = 2.1, H_M = 2.5;
  const surfaces = [
    { id: "zid-lijevi",   kind: "wall",  quad: room.wallL, realSizeM: [D_M, H_M], defaultProductId: "ker-08" },
    { id: "zid-desni",    kind: "wall",  quad: room.wallR, realSizeM: [D_M, H_M], defaultProductId: "ker-08" },
    { id: "zid-straznji", kind: "wall",  quad: room.back,  realSizeM: [W_M, H_M], defaultProductId: "ker-11" },
    { id: "pod",          kind: "floor", quad: room.floor, realSizeM: [W_M, D_M], defaultProductId: "ker-22" },
  ];
  const F = (u, v) => quadPoint(room.floor, u, v);
  const B = (u, v) => quadPoint(room.back, u, v);
  const R = (u, v) => quadPoint(room.wallR, u, v);
  const L = (u, v) => quadPoint(room.wallL, u, v);
  const mPx = (v) => spanScale(room.floor, v, W_M);   // px per metre at floor depth v
  const wallV = (h) => 1 - h / H_M;                   // height in m -> wall v

  function draw(ctx, w, h, assignments, texFor) {
    ctx.save();
    drawBackdrop(ctx);

    // ceiling wedge — plaster, never a tileable surface
    fillQuad(ctx, room.ceil, quadGradient(ctx, room.ceil, [
      [0, RGB(MIX(PAPER, AMBER_500, 0.05))],
      [1, RGB(MIX(PAPER, MAUVE_400, 0.16))],
    ]));

    drawSurface(ctx, surfaces[0], texFor, FALLBACK_WALL_L);
    drawSurface(ctx, surfaces[1], texFor, FALLBACK_WALL_R);
    drawSurface(ctx, surfaces[2], texFor, FALLBACK_WALL_B);
    drawSurface(ctx, surfaces[3], texFor, FALLBACK_FLOOR);
    // key from the back-left (frosted window over the shower), teal fill right
    frontalShadePass(ctx, room, [330, 190], [860, 560]);

    // --- recessed ceiling light + its warm pool on the back wall ------------
    const lp = quadPoint(room.ceil, 0.5, 0.62);
    const lg = ctx.createRadialGradient(lp[0], lp[1], 6, lp[0], lp[1], 210);
    lg.addColorStop(0, RGBA(MIX(AMBER_500, WHITE, 0.6), 0.5));
    lg.addColorStop(1, RGBA(AMBER_500, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(lp[0] - 220, lp[1] - 60, 440, 300);
    ctx.beginPath();
    ctx.ellipse(lp[0], lp[1], 26, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = MAT.porcelainHi;
    ctx.fill();
    ctx.strokeStyle = RGBA(SEAM, 0.20);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- shower zone, back-left: tray + fixed glass panel -------------------
    const t0 = F(0.02, 0.02), t1 = F(0.44, 0.02), t2 = F(0.44, 0.50), t3 = F(0.02, 0.50);
    const lipF = 0.06 * mPx(0.02), lipN = 0.06 * mPx(0.50);   // 6 cm tray upstand
    poly(ctx, [
      [t0[0], t0[1] - lipF], [t1[0], t1[1] - lipF],
      [t2[0], t2[1] - lipN], [t3[0], t3[1] - lipN],
    ], MAT.porcelain, RGBA(SEAM, 0.20), 1.5);
    poly(ctx, vface(t3, t2, lipN, lipN), MAT.porcelainLo, RGBA(SEAM, 0.22), 1.5);
    edgeShadow(ctx, t3, t2, 16, 0.15);
    // drain
    const dr = F(0.23, 0.26);
    ctx.save();
    ctx.translate(dr[0], dr[1] - 0.06 * mPx(0.26));
    ctx.scale(1, 0.36);
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = MAT.chromeDark;
    ctx.fill();
    ctx.restore();
    // shower head + riser on the left wall
    const sh = L(0.80, wallV(2.05));
    seg(ctx, L(0.80, wallV(1.15)), sh, MAT.chrome, 5);
    seg(ctx, sh, L(0.72, wallV(2.02)), MAT.chrome, 5);
    const hd = L(0.71, wallV(2.01));
    ctx.save();
    ctx.translate(hd[0], hd[1]);
    ctx.scale(0.42, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = MAT.chrome;
    ctx.fill();
    ctx.restore();
    // fixed glass panel standing on the tray's open edge (drawn late = see-through)
    const g0 = F(0.44, 0.03), g1 = F(0.44, 0.50);
    const gh0 = 2.0 * mPx(0.03), gh1 = 2.0 * mPx(0.50);
    const gq = vface(g0, g1, gh0 - lipF, gh1 - lipN);
    poly(ctx, gq, MAT.glassTeal, MAT.glassLine, 2);
    seg(ctx, gq[0], gq[1], MAT.chrome, 5);
    seg(ctx, gq[1], gq[2], MAT.chrome, 4);
    seg(ctx, gq[0], gq[3], MAT.glassRim, 2);   // teal-300 rim light down the far edge
    ctx.save();
    pathPoly(ctx, gq);
    ctx.clip();
    poly(ctx, [
      [gq[0][0] + 18, gq[0][1]], [gq[0][0] + 54, gq[0][1]],
      [gq[3][0] + 120, gq[3][1]], [gq[3][0] + 84, gq[3][1]],
    ], "rgba(255,255,255,0.18)");
    ctx.restore();

    // --- wall-hung WC on the right wall, back half -------------------------
    const wc = F(0.86, 0.20);
    const wcM = mPx(0.20);
    softShadow(ctx, wc[0], wc[1] + 4, 0.42 * wcM, 0.12 * wcM, 0.26);
    const wcTop = wc[1] - 0.42 * wcM;
    poly(ctx, [                                                   // bowl body
      [wc[0] - 0.20 * wcM, wcTop], [wc[0] + 0.22 * wcM, wcTop - 0.03 * wcM],
      [wc[0] + 0.15 * wcM, wcTop + 0.30 * wcM], [wc[0] - 0.13 * wcM, wcTop + 0.30 * wcM],
    ], MAT.porcelain, RGBA(SEAM, 0.18), 1.5);
    ctx.save();
    ctx.translate(wc[0], wcTop);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, 0.22 * wcM, 0, Math.PI * 2);
    ctx.fillStyle = MAT.porcelainHi;
    ctx.fill();
    ctx.strokeStyle = RGBA(SEAM, 0.20);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // flush plate on the wall above it
    poly(ctx, subQuad(room.wallR, 0.26, wallV(1.22), 0.36, wallV(1.02)), MAT.porcelainHi, RGBA(SEAM, 0.20), 1.5);

    // --- towel rail with a folded towel, right wall, near half -------------
    const r0 = R(0.66, wallV(1.35)), r1 = R(0.86, wallV(1.35));
    seg(ctx, r0, r1, MAT.chrome, 5);
    poly(ctx, [
      [r0[0], r0[1] + 3], [r1[0], r1[1] + 3],
      [r1[0], r1[1] + 0.55 * mPx(0.72)], [r0[0], r0[1] + 0.50 * mPx(0.72)],
    ], MAT.textileWarm, RGBA(SEAM, 0.16), 1.5);

    // --- back wall: wall-hung basin, tap, round mirror, shelf --------------
    const bScale = spanScale(room.back, 0.5, W_M);
    const bc = B(0.5, wallV(0.86));
    softShadow(ctx, bc[0], bc[1] + 0.16 * bScale, 0.40 * bScale, 0.10 * bScale, 0.20);
    poly(ctx, [                                                    // basin body
      [bc[0] - 0.30 * bScale, bc[1]], [bc[0] + 0.30 * bScale, bc[1]],
      [bc[0] + 0.19 * bScale, bc[1] + 0.19 * bScale], [bc[0] - 0.19 * bScale, bc[1] + 0.19 * bScale],
    ], MAT.porcelain, RGBA(SEAM, 0.20), 1.5);
    ctx.save();
    ctx.translate(bc[0], bc[1]);
    ctx.scale(1, 0.30);
    ctx.beginPath();
    ctx.arc(0, 0, 0.30 * bScale, 0, Math.PI * 2);
    ctx.fillStyle = MAT.porcelainHi;
    ctx.fill();
    ctx.strokeStyle = RGBA(SEAM, 0.22);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0.03 * bScale, 0.21 * bScale, 0, Math.PI * 2);
    ctx.fillStyle = MAT.porcelain;
    ctx.fill();
    ctx.restore();
    const tp = B(0.5, wallV(1.02));
    seg(ctx, [tp[0], tp[1] + 0.16 * bScale], tp, MAT.chrome, 5);
    seg(ctx, tp, [tp[0], tp[1] - 0.02 * bScale], MAT.chrome, 5);
    seg(ctx, [tp[0], tp[1] - 0.01 * bScale], [tp[0], tp[1] + 0.02 * bScale], MAT.chromeDark, 4);
    // round mirror + its cool rim light
    const mc = B(0.5, wallV(1.62));
    const mr = 0.29 * bScale;
    ctx.beginPath();
    ctx.arc(mc[0], mc[1], mr, 0, Math.PI * 2);
    const mg = ctx.createLinearGradient(mc[0] - mr, mc[1] - mr, mc[0] + mr, mc[1] + mr);
    mg.addColorStop(0, RGB(MIX(SKY_200, SHADOW_WARM, 0.20)));
    mg.addColorStop(0.55, MAT.skyGlassHi);
    mg.addColorStop(1, RGB(MIX(SKY_200, WHITE, 0.35)));
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.strokeStyle = MAT.chromeDark;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(mc[0], mc[1], mr - 2, 0, Math.PI * 2);
    ctx.clip();
    poly(ctx, [
      [mc[0] - mr, mc[1] - mr * 0.15], [mc[0] - mr * 0.35, mc[1] - mr],
      [mc[0] - mr * 0.02, mc[1] - mr], [mc[0] - mr, mc[1] + mr * 0.35],
    ], "rgba(255,255,255,0.30)");
    ctx.restore();
    // slim shelf under the mirror with two bottles (amber + teal)
    const sq = subQuad(room.back, 0.30, wallV(1.24), 0.70, wallV(1.20));
    poly(ctx, sq, MAT.trim, RGBA(SEAM, 0.18), 1.5);
    for (const [su, bh, col] of [[0.38, 0.16, MAT.terracotta], [0.44, 0.12, RGB(TEAL_600)]]) {
      const p = B(su, wallV(1.24));
      poly(ctx, [
        [p[0] - 0.035 * bScale, p[1] - bh * bScale], [p[0] + 0.035 * bScale, p[1] - bh * bScale],
        [p[0] + 0.035 * bScale, p[1]], [p[0] - 0.035 * bScale, p[1]],
      ], col, RGBA(SEAM, 0.18), 1.2);
    }
    ctx.restore();
  }

  return { id: "mala-kupaonica", i18nKey: "scene.mala-kupaonica", draw, surfaces };
}

// ---------------------------------------------------------------------------
// Scene 5 — Predsoblje (entrance hall), DEEP one-point corridor camera.
// The most extreme viewpoint of the five: a 1.4 x 4.0 m hallway, so both side
// walls run the full depth of the frame and a long-format floor tile (or a
// plank laid along the corridor) is the point of the scene.
//   back wall 1.4 m x 2.6 m drawn 162 x 300 px    -> 115.7 / 115.4 px/m
//   near frame              drawn 1140 x 2118 px  -> 814.3 / 814.6 px/m
// ---------------------------------------------------------------------------

function makePredsoblje() {
  const room = frontalRoom({
    bx0: 419, bx1: 581, by0: 170, by1: 470,
    nx0: -70, nx1: 1070, nyTop: -565, nyBase: 1553,
  });
  const W_M = 1.4, D_M = 4.0, H_M = 2.6;
  const surfaces = [
    { id: "zid-lijevi",   kind: "wall",  quad: room.wallL, realSizeM: [D_M, H_M], defaultProductId: "ker-12" },
    { id: "zid-desni",    kind: "wall",  quad: room.wallR, realSizeM: [D_M, H_M], defaultProductId: "ker-12" },
    { id: "zid-straznji", kind: "wall",  quad: room.back,  realSizeM: [W_M, H_M], defaultProductId: "ker-14" },
    // defaultRotationDeg is an optional hint the designer view reads when it
    // first fills in an assignment: a plank floor in a hallway runs along the
    // hallway, and the surface's u axis runs ACROSS it.
    { id: "pod",          kind: "floor", quad: room.floor, realSizeM: [W_M, D_M], defaultProductId: "ker-15", defaultRotationDeg: 90 },
  ];
  const F = (u, v) => quadPoint(room.floor, u, v);
  const B = (u, v) => quadPoint(room.back, u, v);
  const L = (u, v) => quadPoint(room.wallL, u, v);
  const R = (u, v) => quadPoint(room.wallR, u, v);
  const mPx = (v) => spanScale(room.floor, v, W_M);
  const wallV = (h) => 1 - h / H_M;

  function draw(ctx, w, h, assignments, texFor) {
    ctx.save();
    drawBackdrop(ctx);

    fillQuad(ctx, room.ceil, quadGradient(ctx, room.ceil, [
      [0, RGB(MIX(PAPER, MAUVE_400, 0.20))],
      [1, RGB(MIX(PAPER, AMBER_500, 0.08))],
    ]));

    drawSurface(ctx, surfaces[0], texFor, FALLBACK_WALL_L);
    drawSurface(ctx, surfaces[1], texFor, FALLBACK_WALL_R);
    drawSurface(ctx, surfaces[2], texFor, FALLBACK_WALL_B);
    drawSurface(ctx, surfaces[3], texFor, FALLBACK_FLOOR);
    // key from the glazed front door at the end, cool fill off the near mirror
    frontalShadePass(ctx, room, [500, 330], [180, 640]);

    // --- ulazna vrata (front door) on the back wall -------------------------
    const bScale = spanScale(room.back, 0.5, W_M);
    const frame = subQuad(room.back, 0.155, wallV(2.10), 0.845, 1);
    poly(ctx, frame, MAT.trim, RGBA(SEAM, 0.24), 2.5);
    const door = subQuad(room.back, 0.185, wallV(2.05), 0.815, 1);
    poly(ctx, door, quadGradient(ctx, door, [
      [0, RGB(MIX(BROWN_700, AMBER_500, 0.42))],
      [1, RGB(MIX(BROWN_800, AMBER_600, 0.28))],
    ]), RGBA(SEAM, 0.26), 1.5);
    // glazed strip — the warm daylight source of the scene
    const lite = subQuad(door, 0.58, 0.10, 0.86, 0.52);
    poly(ctx, lite, quadGradient(ctx, lite, [
      [0, RGB(MIX(AMBER_500, WHITE, 0.55))],
      [1, MAT.skyGlassHi],
    ]), RGBA(SEAM, 0.28), 2);
    for (const lv of [0.24, 0.38]) {
      seg(ctx, quadPoint(lite, 0, lv), quadPoint(lite, 1, lv), RGBA(SEAM, 0.22), 2, "butt");
    }
    // recessed panel + lever handle
    poly(ctx, [
      quadPoint(door, 0.13, 0.60), quadPoint(door, 0.87, 0.60),
      quadPoint(door, 0.87, 0.92), quadPoint(door, 0.13, 0.92),
    ], null, RGBA(SEAM, 0.24), 2);
    const dh = quadPoint(door, 0.14, 0.50);
    seg(ctx, dh, [dh[0] + 0.10 * bScale, dh[1]], MAT.chrome, 4);
    // daylight spilling from the door across the floor
    poly(ctx, [F(0.14, 0.0), F(0.86, 0.0), F(1.02, 0.30), F(-0.02, 0.30)], RGBA(AMBER_500, 0.10));

    // --- pendant lamp on a cord, hung from the ceiling ---------------------
    const cTop = quadPoint(room.ceil, 0.5, 0.30);
    const lampY = cTop[1] + 96;
    seg(ctx, cTop, [cTop[0], lampY], MAT.chromeDark, 2.5);
    poly(ctx, [
      [cTop[0] - 34, lampY], [cTop[0] + 34, lampY],
      [cTop[0] + 20, lampY + 40], [cTop[0] - 20, lampY + 40],
    ], MAT.terracotta, RGBA(SEAM, 0.24), 2);
    const gl = ctx.createRadialGradient(cTop[0], lampY + 42, 4, cTop[0], lampY + 42, 300);
    gl.addColorStop(0, RGBA(MIX(AMBER_500, WHITE, 0.5), 0.42));
    gl.addColorStop(1, RGBA(AMBER_500, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(cTop[0] - 320, lampY, 640, 380);

    // --- left wall: tall mirror + low shoe cabinet --------------------------
    const mirror = subQuad(room.wallL, 0.30, wallV(1.95), 0.50, wallV(0.75));
    poly(ctx, mirror, quadGradient(ctx, mirror, [
      [0, MAT.skyGlassHi],
      [1, RGB(MIX(SKY_200, SHADOW_WARM, 0.26))],
    ]), MAT.chromeDark, 4);
    ctx.save();
    pathPoly(ctx, mirror);
    ctx.clip();
    poly(ctx, [
      quadPoint(mirror, 0.05, 0), quadPoint(mirror, 0.34, 0),
      quadPoint(mirror, 0.62, 1), quadPoint(mirror, 0.33, 1),
    ], "rgba(255,255,255,0.26)");
    ctx.restore();
    // shoe cabinet standing against the left wall (floor u 0..0.30)
    const c0 = F(0.02, 0.30), c1 = F(0.02, 0.62), c2 = F(0.34, 0.62), c3 = F(0.34, 0.30);
    const chF = 0.52 * mPx(0.30), chN = 0.52 * mPx(0.62);
    softShadow(ctx, (c1[0] + c3[0]) / 2, (c1[1] + c3[1]) / 2 + 6, 0.6 * mPx(0.46), 0.16 * mPx(0.46), 0.26);
    poly(ctx, [                                                   // top face
      [c0[0], c0[1] - chF], [c3[0], c3[1] - chF],
      [c2[0], c2[1] - chN], [c1[0], c1[1] - chN],
    ], MAT.stone, RGBA(SEAM, 0.20), 1.5);
    poly(ctx, vface(c3, c2, chF, chN), MAT.woodWarm, RGBA(SH_DEEP, 0.30), 1.5);   // front
    poly(ctx, vface(c1, c2, chN, chN), MAT.woodWarmLo);                            // near end
    const dmid = F(0.34, 0.46), dmh = 0.52 * mPx(0.46);
    seg(ctx, [dmid[0], dmid[1] - dmh + 8], [dmid[0], dmid[1] - 6], RGBA(SH_DEEP, 0.34), 2, "butt");
    seg(ctx, [dmid[0] - 0.16 * mPx(0.46), dmid[1] - dmh + 0.10 * mPx(0.46)],
      [dmid[0] - 0.04 * mPx(0.46), dmid[1] - dmh + 0.10 * mPx(0.46)], MAT.chrome, 4);
    seg(ctx, [dmid[0] + 0.04 * mPx(0.46), dmid[1] - dmh + 0.10 * mPx(0.46)],
      [dmid[0] + 0.16 * mPx(0.46), dmid[1] - dmh + 0.10 * mPx(0.46)], MAT.chrome, 4);
    // a small vase on top, warm accent
    const vs = F(0.14, 0.40), vsh = 0.52 * mPx(0.40);
    poly(ctx, [
      [vs[0] - 0.05 * mPx(0.40), vs[1] - vsh - 0.24 * mPx(0.40)],
      [vs[0] + 0.05 * mPx(0.40), vs[1] - vsh - 0.24 * mPx(0.40)],
      [vs[0] + 0.07 * mPx(0.40), vs[1] - vsh], [vs[0] - 0.07 * mPx(0.40), vs[1] - vsh],
    ], MAT.terracotta, RGBA(SEAM, 0.22), 1.5);

    // --- right wall: coat rail with two coats, radiator below --------------
    const k0 = R(0.34, wallV(1.72)), k1 = R(0.64, wallV(1.72));
    seg(ctx, k0, k1, MAT.chromeDark, 4);
    for (const [ku, col, drop] of [[0.40, MAT.textileWarmLo, 0.86], [0.53, RGB(MIX(TEAL_600, SHADOW_WARM, 0.42)), 0.78]]) {
      const a = R(ku, wallV(1.72));
      const b = R(ku, wallV(1.72 - drop));
      const halfTop = Math.abs(R(ku + 0.045, wallV(1.72))[0] - a[0]);
      const halfBot = Math.abs(R(ku + 0.055, wallV(1.72 - drop))[0] - b[0]);
      poly(ctx, [
        [a[0] - halfTop, a[1]], [a[0] + halfTop, a[1]],
        [b[0] + halfBot, b[1]], [b[0] - halfBot, b[1]],
      ], col, RGBA(SEAM, 0.20), 1.5);
    }
    // panel radiator lower down the right wall
    const rad = subQuad(room.wallR, 0.72, wallV(0.78), 0.90, wallV(0.18));
    poly(ctx, rad, MAT.trim, RGBA(SEAM, 0.22), 2);
    for (const ru of [0.25, 0.5, 0.75]) {
      seg(ctx, quadPoint(rad, ru, 0.06), quadPoint(rad, ru, 0.94), RGBA(SEAM, 0.18), 2.5, "butt");
    }

    // --- doormat in front of the door + a warm runner ----------------------
    poly(ctx, [F(0.20, 0.04), F(0.80, 0.04), F(0.84, 0.16), F(0.16, 0.16)],
      RGBA(MIX(BROWN_700, AMBER_500, 0.30), 0.55), RGBA(SH_DEEP, 0.28), 2);
    ctx.restore();
  }

  return { id: "predsoblje", i18nKey: "scene.predsoblje", draw, surfaces };
}

export const SCENES = [
  makeKupaonica(),
  makeMalaKupaonica(),
  makeKuhinja(),
  makeDnevniBoravak(),
  makePredsoblje(),
];
