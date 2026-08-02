// ============================================================================
// gfx3d.js — the shared 3D core behind js/room3d.js (the 3D soba) and
// js/scene3d.js (the Dizajner scenes).
//
// It exists so there is exactly ONE implementation of the four things both
// renderers need, instead of two that drift:
//
//   1. GLB loading + caching — every .glb under vendor/models/ is fetched and
//      parsed ONCE and cloned per instance, so ten cabinets share one geometry
//      and one material set.
//   2. Box3 measurement → scale to the DOCUMENTED real-world size → re-origin
//      to the floor centre of the footprint. The Kenney models pivot at a
//      bounding-box CORNER and washbasin-pedestal.glb runs down to y = −0.40;
//      skipping the re-origin shifts every model by half its own footprint.
//   3. The physical-scale tile texturing: buildPatternCell → CanvasTexture with
//      repeat = surfaceMetres / cellMetres, SRGBColorSpace, RepeatWrapping and
//      the renderer's max anisotropy.
//   4. The placement maths the drag depends on — footprint, rotated extent,
//      travel limits, the 5 cm grid and the wall magnet.
//
// It also owns MODEL_SPECS: the per-file scale/yaw/size table. Every number in
// it is copied from vendor/models/PROVENANCE.md, where the bounding boxes were
// MEASURED by walking each glTF scene graph and transforming every accessor's
// POSITION min/max. Nothing here is eyeballed and nothing here may be guessed:
// if a fixture is not in this table it has no model, and a scene that wants it
// must do without it.
//
// This module renders nothing and owns no renderer, no camera and no scene. It
// is imported by both engines and by nothing else.
// ============================================================================

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildPatternCell } from "./texture.js";
import { GROUT_COLORS, cellMeters } from "./domain.js";

// Placement grid and wall magnet, in metres. Shared so a fixture dragged in the
// Dizajner and the same fixture dragged in the 3D soba settle identically.
export const GRID_M = 0.05;
export const WALL_SNAP_M = 0.15;

// ---- Iris palette (docs/DESIGN_SYSTEM.md — pixel-sampled, not invented) -----
// Only the values the WebGL scenes actually paint.
export const IRIS = {
  paper: 0xf2f2f2,     // --paper  #F2F2F2 — scene background
  teal600: 0x139eb1,   // --teal-600 #139EB1 — selection tint
  amber500: 0xeaa651,  // --amber-500 #EAA651 — selection outline
  sky200: 0xc0d8f2,    // --sky-200 #C0D8F2 — "model still loading" massing block
};

// Untextured room surfaces — what a bare (before-tiling) room looks like.
export const BARE_SURFACE_COLOR = { floor: 0xd8d6d2, wall: 0xf2f0ec };

// ============================================================================
// MODEL_SPECS — one entry per file in vendor/models/, keyed by FILE STEM
// ============================================================================
// `scale` and `sizeM` come straight from PROVENANCE.md: sizeM is measured-bbox
// × scale, i.e. the real-world size the model actually ends up at.
//
// The eight Kenney kitchen modules are authored on one grid, so PROVENANCE
// requires ONE shared scale across all of them or worktop heights stop lining
// up. That is KITCHEN_RUN_SCALE; do not give a kitchen module its own vector.
export const KITCHEN_RUN_SCALE = [1.3953, 2.0, 1.3333];

// `mountY` is the height (m) the model's own floor sits at inside its fixture
// group. 0 = stands on the floor. A non-zero value is an INSTALL height, i.e.
// an EU building convention, not something measured off the asset — each one is
// commented with where it comes from.
//
// `yaw` is a per-file correction, NOT a preference. The convention shared by
// both engines is "rotY 0 = back toward north (−Z)", and the three source kits
// do not agree with each other or internally. Every value below was VERIFIED
// against the actual files by rendering each model from due north and due south
// and by per-material centroids; the derivation is written out in full in
// js/room3d.js's history and is not re-derived here.
const M = (o) => Object.freeze(o);

export const MODEL_SPECS = Object.freeze({
  // ---- Kupaonica — sanitarije --------------------------------------------
  "bathtub": M({
    file: "bathtub.glb", yaw: 0,
    scale: [1.4286, 1.4286, 1.3393], sizeM: [1.7, 0.6, 0.75], mount: "floor", mountY: 0,
  }),
  "bathtub-freestanding": M({
    file: "bathtub-freestanding.glb", yaw: 0,
    scale: [1.1995, 0.7865, 1.1876], sizeM: [1.7, 0.62, 0.75], mount: "floor", mountY: 0,
  }),
  "toilet": M({
    file: "toilet.glb", yaw: Math.PI,
    scale: [1.1516, 1.7295, 1.404], sizeM: [0.36, 0.78, 0.67], mount: "floor", mountY: 0,
  }),
  "toilet-square": M({
    file: "toilet-square.glb", yaw: Math.PI,
    scale: [1.1858, 1.7295, 1.6012], sizeM: [0.36, 0.78, 0.62], mount: "floor", mountY: 0,
  }),
  "toilet-modern": M({
    file: "toilet-modern.glb", yaw: 0,
    scale: [1.4274, 1.4796, 1.427], sizeM: [0.36, 0.82, 0.66], mount: "floor", mountY: 0,
  }),
  "washbasin-vanity": M({
    file: "washbasin-vanity.glb", yaw: Math.PI,
    scale: [1.3953, 1.8016, 1.4375], sizeM: [0.6, 0.85, 0.46], mount: "floor", mountY: 0,
  }),
  "washbasin-pedestal": M({
    file: "washbasin-pedestal.glb", yaw: Math.PI,
    scale: [1.6176, 1.5179, 1.5517], sizeM: [0.55, 0.85, 0.45], mount: "floor", mountY: 0,
  }),
  "washbasin-vanity-wall": M({
    file: "washbasin-vanity-wall.glb", yaw: 0,
    scale: [0.8463, 1.1494, 1.0289], sizeM: [0.6, 0.55, 0.46], mount: "wall",
    // PROVENANCE: "gornji rub na 0.85 m". 0.85 − 0.55 tall = 0.30 m off the floor.
    mountY: 0.3,
  }),
  "shower-enclosure": M({
    file: "shower-enclosure.glb", yaw: Math.PI,
    scale: [1.602, 1.7824, 1.602], sizeM: [0.9, 1.95, 0.9], mount: "floor", mountY: 0,
  }),
  "bathroom-cabinet-tall": M({
    file: "bathroom-cabinet-tall.glb", yaw: Math.PI,
    scale: [1.7391, 1.7949, 1.2308], sizeM: [0.4, 0.7, 0.16], mount: "wall",
    // Install height: bottom 20 cm above a 0.85 m washbasin rim.
    mountY: 1.05,
  }),
  "bathroom-mirror": M({
    file: "bathroom-mirror.glb", yaw: Math.PI,
    scale: [1.9914, 1.8408, 0.831], sizeM: [0.6, 0.8, 0.12], mount: "wall",
    // Install height: same 1.05 m datum as the wall cabinet, so a run lines up.
    mountY: 1.05,
  }),
  "towel-rail": M({
    // PROVENANCE is explicit: this is a towel bar, NOT a heated towel rail.
    file: "towel-rail.glb", yaw: 0,
    scale: [0.375, 0.8578, 0.2158], sizeM: [0.6, 0.5, 0.1], mount: "wall", mountY: 0.9,
  }),

  // ---- Kuhinja — the run (one shared scale, see KITCHEN_RUN_SCALE) --------
  "kitchen-cabinet-base": M({
    file: "kitchen-cabinet-base.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.9, 0.6], mount: "floor", mountY: 0,
  }),
  "kitchen-cabinet-drawer": M({
    file: "kitchen-cabinet-drawer.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.9, 0.6], mount: "floor", mountY: 0,
  }),
  "kitchen-cabinet-corner": M({
    // 0.46 × 1.3953 = 0.642 and 0.46 × 1.3333 = 0.613 — the shared run scale is
    // mandatory, so the corner unit lands at 0.64 × 0.90 × 0.61, not the 0.90
    // PROVENANCE names as the ideal target. Worktop alignment wins.
    file: "kitchen-cabinet-corner.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.64, 0.9, 0.61], mount: "floor", mountY: 0,
  }),
  "kitchen-sink-unit": M({
    file: "kitchen-sink-unit.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.98, 0.6], mount: "floor", mountY: 0,
  }),
  "kitchen-stove": M({
    file: "kitchen-stove.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.9, 0.6], mount: "floor", mountY: 0,
  }),
  "kitchen-fridge": M({
    file: "kitchen-fridge.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 1.84, 0.39], mount: "floor", mountY: 0,
  }),
  "kitchen-cabinet-upper": M({
    file: "kitchen-cabinet-upper.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.78, 0.29], mount: "wall",
    // Install height: 0.90 m worktop + 0.55 m standard EU splashback gap.
    mountY: 1.45,
  }),
  "kitchen-hood": M({
    file: "kitchen-hood.glb", yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.74, 0.38], mount: "wall",
    // Install height: 0.65 m clearance over a 0.90 m hob.
    mountY: 1.55,
  }),

  // ---- Otvori i ostalo ----------------------------------------------------
  "door": M({
    file: "door.glb", yaw: 0,
    scale: [1.8519, 2.0307, 0.8818], sizeM: [0.9, 2.05, 0.1], mount: "wall", mountY: 0,
  }),
  "door-leaf": M({
    file: "door-leaf.glb", yaw: 0,
    scale: [0.4897, 0.4895, 0.4999], sizeM: [0.85, 2.05, 0.21], mount: "wall", mountY: 0,
  }),
  "window-large": M({
    file: "window-large.glb", yaw: 0,
    scale: [0.4912, 0.4887, 0.4961], sizeM: [0.9, 0.83, 0.07], mount: "wall",
    mountY: 0.9,   // Install height: standard 0.90 m sill.
  }),
  "window-small": M({
    file: "window-small.glb", yaw: 0,
    scale: [0.4956, 0.4927, 0.4961], sizeM: [0.46, 0.61, 0.07], mount: "wall",
    mountY: 1.2,   // Install height: high sill, the usual bathroom window.
  }),
  "ac-outdoor-unit": M({
    file: "ac-outdoor-unit.glb", yaw: 0,
    scale: [0.4913, 0.4959, 0.4929], sizeM: [0.51, 0.34, 0.38], mount: "floor", mountY: 0,
  }),
});

export const MODEL_STEMS = Object.freeze(Object.keys(MODEL_SPECS));

/** @returns {object|null} the spec for a vendor/models file stem, or null. */
export function modelSpec(stem) {
  return Object.prototype.hasOwnProperty.call(MODEL_SPECS, stem) ? MODEL_SPECS[stem] : null;
}

// ============================================================================
// Tile texturing — physical scale
// ============================================================================
// A 3D pattern cell is only ever seen across a whole wall, so raster past ~1k
// buys nothing while costing 4x the GPU memory: a 2048² RGBA cell is ~16 MB and
// a browsing session pins dozens of them. Mirrors texture.js's VARIANT_MULT so
// the estimate matches the canvas buildPatternCell will actually produce.
const MAX_3D_CELL_PX = 1024;
const MAX_3D_SCALE = 1.5;
const CELL_MULT = { grid: [2, 2], runningBond: [2, 1], herringbone: [1, 1], diagonal: [1, 1] };

export function cellScaleFor(product, pattern, groutWidthMm) {
  try {
    const m = cellMeters(product, pattern, groutWidthMm);
    const mult = CELL_MULT[pattern] || [2, 2];
    const maxMm = Math.max(m[0] * mult[0], m[1] * mult[1]) * 1000;
    if (Number.isFinite(maxMm) && maxMm > 0) {
      return Math.min(MAX_3D_SCALE, Math.max(0.25, MAX_3D_CELL_PX / maxMm));
    }
  } catch { /* pure-math helper — fall through to the safe default */ }
  return 0.5;
}

export function groutHexById(id) {
  const g = GROUT_COLORS.find((c) => c.id === id);
  return g ? g.hex : "#9a9a9a";
}

/** Only quarter turns tile seamlessly: a 45° rotation of a rectangular lattice
 *  has no axis-aligned period, so an arbitrary angle would show a visible seam
 *  at every cell boundary. Anything else is snapped to the nearest quarter. */
function quarterTurn(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n) || n === 0) return 0;
  return ((Math.round(n / 90) * 90) % 360 + 360) % 360;
}

/**
 * The one place a laid surface becomes a texture.
 *
 * @param {object} product           catalogue product (tileSizeMm drives the cell)
 * @param {object} opts              {pattern, groutColorId|groutColorHex, groutWidthMm, rotationDeg}
 * @param {[number,number]} surfaceMetres  the surface's real [width, height] in m
 * @param {number} maxAniso          renderer.capabilities.getMaxAnisotropy()
 * @returns {{texture:THREE.CanvasTexture, cellSizeMm:[number,number],
 *            normalized:object, rotationDeg:number}}
 *
 * repeat is surfaceMetres / cellMetres — literally "how many times does the
 * repeatable unit of this laying pattern fit across this wall", which is what
 * keeps a 600 mm tile 600 mm wide on screen at any room size.
 *
 * three composes the UV transform as R(rotation)·S(repeat), so at a quarter
 * turn the texture's u axis is driven by the surface's v axis: the repeat pair
 * has to be swapped as well as the angle set, or a rotated wall re-scales.
 */
export function makeSurfaceTexture(product, opts, surfaceMetres, maxAniso) {
  const normalized = {
    pattern: opts.pattern || "grid",
    groutColorHex: opts.groutColorHex || groutHexById(opts.groutColorId),
    groutWidthMm: Number.isFinite(opts.groutWidthMm) ? opts.groutWidthMm : 3,
  };
  const { canvas, cellSizeMm } = buildPatternCell(product, {
    ...normalized,
    scalePxPerMm: cellScaleFor(product, normalized.pattern, normalized.groutWidthMm),
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAniso;

  const cellW = cellSizeMm[0] / 1000, cellH = cellSizeMm[1] / 1000;
  const [sw, sh] = surfaceMetres;
  const rotationDeg = quarterTurn(opts.rotationDeg);
  if (rotationDeg === 90 || rotationDeg === 270) {
    texture.repeat.set(sh / cellW, sw / cellH);
  } else {
    texture.repeat.set(sw / cellW, sh / cellH);
  }
  if (rotationDeg) {
    texture.center.set(0.5, 0.5);
    texture.rotation = (rotationDeg * Math.PI) / 180;
  }
  return { texture, cellSizeMm, normalized, rotationDeg };
}

// ============================================================================
// Geometry helpers — footprint, rotated extent, travel limits, snapping
// ============================================================================

const _box = new THREE.Box3();

/**
 * Local-space floor footprint of a group, measured at identity.
 * @returns {{minX:number,maxX:number,minZ:number,maxZ:number,topY:number}}
 * Box3.setFromObject calls updateWorldMatrix(false,false) per node and then
 * recurses, so the traversal is self-correcting from the root down — only the
 * root's own transform has to be neutral, which is what we force here.
 */
export function measureFootprint(group) {
  const p = group.position.clone(), r = group.rotation.clone(), s = group.scale.clone();
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);
  group.updateMatrixWorld(true);
  _box.setFromObject(group);
  group.position.copy(p);
  group.rotation.copy(r);
  group.scale.copy(s);
  group.updateMatrixWorld(true);
  if (!Number.isFinite(_box.min.x) || _box.isEmpty()) {
    return { minX: -0.25, maxX: 0.25, minZ: -0.25, maxZ: 0.25, topY: 0.5 };
  }
  return { minX: _box.min.x, maxX: _box.max.x, minZ: _box.min.z, maxZ: _box.max.z, topY: _box.max.y };
}

/**
 * World-space AABB offsets of a footprint relative to the group origin, at yaw.
 * three's Object3D.rotation.y = t is R_y(t) = [[c,0,s],[0,1,0],[-s,0,c]], so a
 * local point maps to wx = lx·c + lz·s, wz = −lx·s + lz·c.
 */
export function rotatedExtent(fp, rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const corners = [[fp.minX, fp.minZ], [fp.maxX, fp.minZ], [fp.maxX, fp.maxZ], [fp.minX, fp.maxZ]];
  for (const [lx, lz] of corners) {
    const wx = lx * c + lz * s;
    const wz = -lx * s + lz * c;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wz < minZ) minZ = wz;
    if (wz > maxZ) maxZ = wz;
  }
  return { minX, maxX, minZ, maxZ };
}

/** Travel limits for the fixture ORIGIN, in room-local metres. The wall-flush
 *  position IS the bound, so snapping to lo/hi is "flush, bbox accounted for". */
export function limitsFor(fp, rotY, dims) {
  const e = rotatedExtent(fp, rotY);
  return {
    loX: -e.minX, hiX: dims.widthM - e.maxX,
    loZ: -e.minZ, hiZ: dims.depthM - e.maxZ,
  };
}

/** @returns {{v:number, anchor:-1|0|1}} */
export function axisSettle(v, lo, hi) {
  if (hi < lo) return { v: (lo + hi) / 2, anchor: 0 };       // wider than the room: centre it
  if (v <= lo + WALL_SNAP_M) return { v: lo, anchor: -1 };
  if (v >= hi - WALL_SNAP_M) return { v: hi, anchor: 1 };
  const g = Math.round(v / GRID_M) * GRID_M;
  return { v: Math.min(hi, Math.max(lo, g)), anchor: 0 };    // rounding can overshoot by 2.5 cm
}

/** Free axis: keep the world position, re-clamp. Anchored: recompute flush
 *  against THAT wall in the NEW room. */
export function reanchor(v, anchor, lo, hi) {
  if (hi < lo) return (lo + hi) / 2;
  if (anchor === -1) return lo;
  if (anchor === 1) return hi;
  return Math.min(hi, Math.max(lo, v));
}

/** Massing block shown the instant a fixture appears, replaced by the GLB.
 *  Sized to the model's documented real-world size so the swap barely moves.
 *  This is the ONE piece of primitive fixture geometry either engine may build,
 *  and it exists only to be thrown away. */
export function buildPlaceholder(sizeM) {
  const g = new THREE.Group();
  const [w, h, d] = sizeM;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: IRIS.sky200, roughness: 0.95, transparent: true, opacity: 0.55,
    }));
  box.castShadow = true;
  box.receiveShadow = false;
  box.position.y = h / 2;
  g.add(box);
  g.userData.placeholder = true;
  return g;
}

// ============================================================================
// GLB prototypes — loaded once per file, normalised, then cloned per instance
// ============================================================================

// Resolved against THIS MODULE rather than the document, so a deployment under
// a sub-path (GitHub Pages /Akvaterm/) resolves without a build step.
export const MODELS_URL = new URL("../vendor/models/", import.meta.url).href;

const protoCache = new Map();   // file -> Promise<{root, footprint}>
let gltfLoader = null;
let protoRefs = 0;

// KNOWN LIMITATION, measured not assumed — index.html's CSP vs embedded
// textures. GLTFLoader wraps a bufferView-backed image in a Blob and hands the
// resulting `blob:` URL to ImageBitmapLoader or to an <img>. index.html now
// allows blob: in BOTH img-src and connect-src, which is what lets the four
// textured files (toilet-modern, bathtub-freestanding, washbasin-vanity-wall,
// towel-rail) keep their colour maps. Remove blob: from either directive and
// those four silently render untextured.
function loaderFor() {
  if (!gltfLoader) gltfLoader = new GLTFLoader().setPath(MODELS_URL);
  return gltfLoader;
}

/**
 * @param {object} spec  entry from MODEL_SPECS (needs file + scale + yaw)
 * @param {number} maxAniso
 * @returns {Promise<{root:THREE.Group, footprint:object}>}
 *
 * Re-origin is the part that makes dragging feel right: the wrapper's origin
 * ends up at the FLOOR CENTRE of the footprint, so grab offsets stay small,
 * rotation turns about the object instead of swinging it, and the contact
 * shadow lands where the object touches the floor. Kenney's models pivot at a
 * bbox CORNER and washbasin-pedestal.glb even runs down to y = −0.40, so
 * skipping this step shifts every model by half its own footprint.
 */
export function loadPrototype(spec, maxAniso) {
  const cached = protoCache.get(spec.file);
  if (cached) return cached;

  const p = new Promise((resolve, reject) => {
    loaderFor().load(spec.file, resolve, undefined, reject);
  }).then((gltf) => {
    const inner = gltf.scene;
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const ctr = box.getCenter(new THREE.Vector3());
    const [sx, sy, sz] = spec.scale;
    inner.scale.set(sx, sy, sz);
    inner.position.set(-ctr.x * sx, -box.min.y * sy, -ctr.z * sz);
    // Yaw lives on its own wrapper: the model's own origin is at a bbox corner,
    // so rotating `inner` directly would swing the centring offset with it.
    const spin = new THREE.Group();
    spin.rotation.y = spec.yaw || 0;
    spin.add(inner);
    const root = new THREE.Group();
    root.add(spin);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;          // self-shadowing on low-poly furniture is noise
      o.userData.shared = true;         // disposeObject() must not free a shared resource
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.map) m.map.anisotropy = maxAniso;
    });
    return { root, footprint: measureFootprint(root) };
  });

  protoCache.set(spec.file, p);
  return p;
}

/** Refcount around the shared prototypes.
 *
 *  Two engines and the offscreen thumbnail renderer all clone from one cache.
 *  Without a count, an engine tearing down would force-dispose geometry another
 *  live consumer is still drawing — a use-after-free that shows up as a blank
 *  fixture rather than an exception, which is the worst kind. retain() on
 *  mount, release() on dispose; the cache is only actually freed at zero. */
export function retainPrototypes() { protoRefs++; }

export function releasePrototypes() {
  protoRefs = Math.max(0, protoRefs - 1);
  if (protoRefs > 0) return;
  for (const p of protoCache.values()) {
    p.then((proto) => disposeObject(proto.root, true)).catch(() => { /* never loaded */ });
  }
  protoCache.clear();
  gltfLoader = null;
}

/** @param {boolean} force  dispose even resources flagged as shared. */
export function disposeObject(root, force = false) {
  root.traverse((obj) => {
    // Lines and points carry geometry + material too — the selection outline is
    // a LineLoop, and an isMesh-only walk would leak it on every teardown.
    if (!obj.isMesh && !obj.isLine && !obj.isPoints) return;
    if (obj.userData.shared && !force) return;   // cloned GLB — the prototype owns it
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}
