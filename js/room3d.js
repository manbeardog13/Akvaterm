// ============================================================================
// room3d.js — Stage-2 parametric 3D room (lazy module, three.js via import map).
//
// Owns: scene/camera/renderer lifecycle, the parametric room (floor + 4 walls,
// near walls auto-hidden by camera azimuth so the room reads open), the fixture
// catalogue (finished CC0 .glb models from vendor/models/, see its
// PROVENANCE.md) and per-surface tiling through the shared pattern cell
// (texture.js buildPatternCell → CanvasTexture).
// Surfaces: 'floor' | 'wallN' | 'wallS' | 'wallE' | 'wallW'.
//
// Fixture coords: x ∈ [0..widthM] from the W wall, z ∈ [0..depthM] from the
// N wall, rotY radians (0 = back toward north), ax/az ∈ {-1,0,1} wall anchors.
// Converted to centered scene space internally.
//
// Contract: export async mountRoom(el, {room, assignments, products, onReady})
//   -> { dispose(), setSurface(surfaceId, product, opts), setDims(w,d,h),
//        setFixtures(list), rotateSelected(delta), clearSelection(),
//        selectByIndex(i) }
//
// ---------------------------------------------------------------------------
// MOVABLE FIXTURES — hand-rolled raycast-to-floor drag.
//
// three's DragControls and TransformControls are both disqualified here and the
// reasons were read out of the r185 source, not assumed:
//   * DragControls builds its drag plane from camera.getWorldDirection(), so a
//     bath climbs into the air under this app's tilted camera, and it offers no
//     axis/plane/mode option to constrain it. Its rotation tumbles around
//     camera-aligned axes.
//   * TransformControls is a CAD gizmo with thin arrow handles far under the
//     44 px touch target, and it is 51.7 KB.
//   * BOTH hard-set domElement.style.touchAction = 'none' in connect(), which
//     would permanently destroy the page-scroll contract this module keeps.
// So the drag below is ~200 lines against THREE.Plane / Raycaster, which are
// already in the vendored three.module.js — zero new vendored bytes for drag.
//
// The safety of "disable orbit mid-gesture" rests on OrbitControls.js:1585
// `function onPointerMove( event ) { if ( this.enabled === false ) return; }`:
// the camera only ever moves inside that guarded handler, so clearing
// controls.enabled during our pointerdown stops all subsequent camera motion
// regardless of listener order. Its onPointerUp has no such guard and always
// cleans itself up, so no state can get stuck either way.
//
// ---------------------------------------------------------------------------
// Interaction discipline (review fixes, all still in force):
//   * Intent-gated controls — until the user deliberately taps/clicks the
//     canvas, wheel zoom is off and one-finger touch does nothing.
//   * The canvas is `touch-action: pan-y` whenever nothing is selected, so a
//     vertical page swipe that starts on the room scrolls the page. It flips to
//     `none` only while a fixture is selected — and MDN is explicit that
//     touch-action is latched at gesture start, which is exactly why dragging
//     on touch is two-step: one tap selects, the next gesture drags.
//   * On-demand rendering — frames are drawn on control change, resize, damping
//     settle, model arrival and content change, never as a rAF treadmill.
//   * Accessible — the canvas carries role/aria-label (dims, tiled surfaces and
//     the current selection, kept current), orbits with the arrow keys / + -,
//     nudges the selected fixture with the arrow keys and rotates with R.
// ============================================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildPatternCell } from "./texture.js";
import { GROUT_COLORS, cellMeters } from "./domain.js";
import { t } from "./i18n.js";

const DIM_MIN = 1.5, DIM_MAX = 8;
const SURFACE_IDS = ["floor", "wallN", "wallE", "wallS", "wallW"];

// Placement grid and wall magnet, in metres.
const GRID_M = 0.05;
const WALL_SNAP_M = 0.15;

// i18n with an inline Croatian fallback (t() returns the key when missing), so
// the assistive-tech description is Croatian even before the dictionary lands.
const tt = (key, hr) => { const s = t(key); return s === key ? hr : s; };

const SURFACE_HR = {
  floor: "pod",
  wallN: "sjeverni zid",
  wallE: "istočni zid",
  wallS: "južni zid",
  wallW: "zapadni zid",
};

// OrbitControls' `touches` switch falls through to "do nothing" for any value
// outside THREE.TOUCH — three ships no TOUCH.NONE, so this sentinel is the
// documented way to disable a finger count.
const TOUCH_NONE = -1;

// ---- Iris palette (docs/DESIGN_SYSTEM.md — pixel-sampled, not invented) -----
// Only the values this module actually paints into the WebGL scene.
const IRIS = {
  paper: 0xf2f2f2,     // --paper  #F2F2F2 — scene background
  teal600: 0x139eb1,   // --teal-600 #139EB1 — selection footprint tint
  amber500: 0xeaa651,  // --amber-500 #EAA651 — selection outline
  sky200: 0xc0d8f2,    // --sky-200 #C0D8F2 — "model still loading" massing block
};

// A 3D pattern cell is only ever seen across a whole wall, so raster past ~1k
// buys nothing while costing 4x the GPU memory: a 2048² RGBA cell is ~16 MB and
// a browsing session pins dozens of them. Mirrors texture.js's VARIANT_MULT so
// the estimate matches the canvas that buildPatternCell will actually produce.
const MAX_3D_CELL_PX = 1024;
const MAX_3D_SCALE = 1.5;
const CELL_MULT = { grid: [2, 2], runningBond: [2, 1], herringbone: [1, 1], diagonal: [1, 1] };

function cellScaleFor(product, pattern, groutWidthMm) {
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

// "2,55" — Croatian decimal comma, trailing zeros trimmed.
const fmtM = (n) => String(Math.round((Number(n) || 0) * 100) / 100).replace(".", ",");
// Outward normals (pointing away from the room) — a wall is hidden while the
// camera stands on its outside, so the interior always reads open.
const OUTWARD = {
  wallN: new THREE.Vector3(0, 0, -1),
  wallS: new THREE.Vector3(0, 0, 1),
  wallE: new THREE.Vector3(1, 0, 0),
  wallW: new THREE.Vector3(-1, 0, 0),
};

const clampDim = (v, fallback) =>
  Number.isFinite(v) ? Math.min(DIM_MAX, Math.max(DIM_MIN, v)) : fallback;

function groutHexById(id) {
  const g = GROUT_COLORS.find((c) => c.id === id);
  return g ? g.hex : "#9a9a9a";
}

// ============================================================================
// Fixture catalogue
// ============================================================================
// Every `scale` and `sizeM` below is copied from vendor/models/PROVENANCE.md,
// where the bounding boxes were MEASURED by walking each glTF scene graph and
// transforming every accessor's POSITION min/max — they are not estimates and
// they are not eyeballed here. sizeM is measured-bbox × scale, i.e. the real
// world size the model actually ends up at.
//
// The eight Kenney kitchen modules are authored on one grid, so PROVENANCE
// requires ONE shared scale across all of them or worktop heights stop lining
// up. That is this constant; do not give a kitchen module its own vector.
const KITCHEN_RUN_SCALE = [1.3953, 2.0, 1.3333];

// `mountY` is the height (m) the model's own floor sits at inside the fixture
// group. 0 = stands on the floor. A non-zero value is an INSTALL height, i.e.
// an EU building convention, not something measured off the asset — each one is
// commented with where it comes from so the operator can move it.
// `mount:'wall'` only affects labelling and the default placement.
//
// `yaw` is a per-file correction, NOT a preference. This module's convention is
// "rotY 0 = back toward north (−Z)", but the three source kits do not agree with
// each other or internally (PROVENANCE already records that toilet.glb runs
// Z −0.477…0 while toilet-square.glb runs 0…+0.387). Each value below was
// VERIFIED, not assumed, by two independent checks run against the actual files
// in a browser:
//   1. Rendering every model from due south (+Z) AND due north (−Z) and reading
//      which side carries the front detail — door frames, handles, drawer pulls,
//      the seat in front of a cistern, mirror glass, a condenser fan.
//   2. Per-material centroids, which decide it numerically where a render is
//      ambiguous. Examples actually measured:
//        kitchen-hood     `_defaultMat #ffffff` back plate at zn = +0.500 (the
//                         +Z extreme plane) → wall side is +Z → yaw π
//        kitchen-cabinet-base `woodDark #af764b` door frame at zn = −0.456 → π
//        bathroom-mirror  `glass` at zn = −0.150 vs `wood` at +0.386 → π
//        shower-enclosure `glass` at (xn +0.153, zn −0.153) → the wall corner is
//                         (−X, +Z), so yaw π puts it in a NORTH-EAST corner
//        bathtub.glb      Z-symmetric (flatMinZ == flatMaxZ == 0.149) → yaw is
//                         cosmetic, left at 0
// A vertex-flatness heuristic was tried and DISCARDED: on kitchen-cabinet-corner
// and bathroom-cabinet-tall it pointed at the wrong face, because a tessellated
// curve or a recessed door frame piles vertices on the front. It is recorded
// here so nobody re-derives these numbers from it.
const FIXTURE_SPECS = {
  // ---- Kupaonica — sanitarije ------------------------------------------
  kada: {
    hr: "Kada", group: "kupaonica", file: "bathtub.glb",
    yaw: 0,
    scale: [1.4286, 1.4286, 1.3393], sizeM: [1.7, 0.6, 0.75], mount: "floor",
  },
  kadaSlobodna: {
    hr: "Samostojeća kada", group: "kupaonica", file: "bathtub-freestanding.glb",
    yaw: 0,
    scale: [1.1995, 0.7865, 1.1876], sizeM: [1.7, 0.62, 0.75], mount: "floor",
  },
  wc: {
    hr: "WC školjka", group: "kupaonica", file: "toilet.glb",
    yaw: Math.PI,
    scale: [1.1516, 1.7295, 1.404], sizeM: [0.36, 0.78, 0.67], mount: "floor",
  },
  wcKockasti: {
    hr: "WC školjka, kockasta", group: "kupaonica", file: "toilet-square.glb",
    yaw: Math.PI,
    scale: [1.1858, 1.7295, 1.6012], sizeM: [0.36, 0.78, 0.62], mount: "floor",
  },
  wcModerni: {
    hr: "WC školjka, moderna", group: "kupaonica", file: "toilet-modern.glb",
    yaw: 0,
    scale: [1.4274, 1.4796, 1.427], sizeM: [0.36, 0.82, 0.66], mount: "floor",
  },
  umivaonik: {
    hr: "Umivaonik s ormarićem", group: "kupaonica", file: "washbasin-vanity.glb",
    yaw: Math.PI,
    scale: [1.3953, 1.8016, 1.4375], sizeM: [0.6, 0.85, 0.46], mount: "floor",
  },
  umivaonikStup: {
    hr: "Umivaonik na stupu", group: "kupaonica", file: "washbasin-pedestal.glb",
    yaw: Math.PI,
    scale: [1.6176, 1.5179, 1.5517], sizeM: [0.55, 0.85, 0.45], mount: "floor",
  },
  umivaonikViseci: {
    hr: "Viseći umivaonik", group: "kupaonica", file: "washbasin-vanity-wall.glb",
    yaw: 0,
    scale: [0.8463, 1.1494, 1.0289], sizeM: [0.6, 0.55, 0.46], mount: "wall",
    // PROVENANCE: "gornji rub na 0.85 m". 0.85 − 0.55 tall = 0.30 m off the floor.
    mountY: 0.3,
  },
  tusKabina: {
    hr: "Tuš kabina", group: "kupaonica", file: "shower-enclosure.glb",
    yaw: Math.PI,
    scale: [1.602, 1.7824, 1.602], sizeM: [0.9, 1.95, 0.9], mount: "floor",
  },
  ormaricVisoki: {
    hr: "Zidni ormarić", group: "kupaonica", file: "bathroom-cabinet-tall.glb",
    yaw: Math.PI,
    scale: [1.7391, 1.7949, 1.2308], sizeM: [0.4, 0.7, 0.16], mount: "wall",
    // Install height: bottom 20 cm above a 0.85 m washbasin rim.
    mountY: 1.05,
  },
  ogledalo: {
    hr: "Ogledalo s policom", group: "kupaonica", file: "bathroom-mirror.glb",
    yaw: Math.PI,
    scale: [1.9914, 1.8408, 0.831], sizeM: [0.6, 0.8, 0.12], mount: "wall",
    // Install height: same 1.05 m datum as the wall cabinet, so a run lines up.
    mountY: 1.05,
  },
  drzacRucnika: {
    // PROVENANCE is explicit: this is a towel bar, NOT a heated towel rail.
    hr: "Držač ručnika", group: "kupaonica", file: "towel-rail.glb",
    yaw: 0,
    scale: [0.375, 0.8578, 0.2158], sizeM: [0.6, 0.5, 0.1], mount: "wall",
    mountY: 0.9,
  },

  // ---- Kuhinja — the run (one shared scale, see KITCHEN_RUN_SCALE) ------
  kuhinjaDonji: {
    hr: "Donji element 60", group: "kuhinja", file: "kitchen-cabinet-base.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.9, 0.6], mount: "floor",
  },
  kuhinjaLadice: {
    hr: "Donji element s ladicama", group: "kuhinja", file: "kitchen-cabinet-drawer.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.9, 0.6], mount: "floor",
  },
  kuhinjaKutni: {
    // 0.46 × 1.3953 = 0.642 and 0.46 × 1.3333 = 0.613 — the shared run scale is
    // mandatory, so the corner unit lands at 0.64 × 0.90 × 0.61, not the 0.90
    // PROVENANCE names as the ideal target. Worktop alignment wins.
    hr: "Kutni donji element", group: "kuhinja", file: "kitchen-cabinet-corner.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.64, 0.9, 0.61], mount: "floor",
  },
  sudoper: {
    hr: "Sudoper element", group: "kuhinja", file: "kitchen-sink-unit.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.98, 0.6], mount: "floor",
  },
  stednjak: {
    hr: "Štednjak 60", group: "kuhinja", file: "kitchen-stove.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.9, 0.6], mount: "floor",
  },
  hladnjak: {
    hr: "Hladnjak", group: "kuhinja", file: "kitchen-fridge.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 1.84, 0.39], mount: "floor",
  },
  kuhinjaGornji: {
    hr: "Gornji element 60", group: "kuhinja", file: "kitchen-cabinet-upper.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.78, 0.29], mount: "wall",
    // Install height: 0.90 m worktop + 0.55 m standard EU splashback gap.
    mountY: 1.45,
  },
  napa: {
    hr: "Napa 60", group: "kuhinja", file: "kitchen-hood.glb",
    yaw: Math.PI,
    scale: KITCHEN_RUN_SCALE, sizeM: [0.6, 0.74, 0.38], mount: "wall",
    // Install height: 0.65 m clearance over a 0.90 m hob.
    mountY: 1.55,
  },

  // ---- Otvori i ostalo --------------------------------------------------
  vrata: {
    hr: "Vrata s dovratnikom", group: "ostalo", file: "door.glb",
    yaw: 0,
    scale: [1.8519, 2.0307, 0.8818], sizeM: [0.9, 2.05, 0.1], mount: "wall", mountY: 0,
  },
  vrataKrilo: {
    hr: "Vrata (krilo)", group: "ostalo", file: "door-leaf.glb",
    yaw: 0,
    scale: [0.4897, 0.4895, 0.4999], sizeM: [0.85, 2.05, 0.21], mount: "wall", mountY: 0,
  },
  prozorVeliki: {
    hr: "Prozor veliki", group: "ostalo", file: "window-large.glb",
    yaw: 0,
    scale: [0.4912, 0.4887, 0.4961], sizeM: [0.9, 0.83, 0.07], mount: "wall",
    mountY: 0.9,   // Install height: standard 0.90 m sill.
  },
  prozorMali: {
    hr: "Prozor mali", group: "ostalo", file: "window-small.glb",
    yaw: 0,
    scale: [0.4956, 0.4927, 0.4961], sizeM: [0.46, 0.61, 0.07], mount: "wall",
    mountY: 1.2,   // Install height: high sill, the usual bathroom window.
  },
  klimaVanjska: {
    hr: "Vanjska jedinica klime", group: "ostalo", file: "ac-outdoor-unit.glb",
    yaw: 0,
    scale: [0.4913, 0.4959, 0.4929], sizeM: [0.51, 0.34, 0.38], mount: "floor",
  },

  // ---- No CC0 model exists — primitive geometry, and that is documented ---
  // PROVENANCE.md records the searches: Poly Pizza has 16 radiators and every
  // one is CC-BY; Sketchfab's downloadable CC0 pool returns 0; Poly Haven has no
  // building fixtures; neither Kenney's nor Quaternius' kits include one. The
  // same is true of an indoor wall split unit. Both are simple slabs, which is
  // the one shape primitive geometry models honestly.
  radijator: {
    hr: "Radijator", group: "ostalo", build: "radijator",
    sizeM: [0.9, 0.6, 0.06], mount: "wall", mountY: 0.2,
  },
  klima: {
    hr: "Klima (unutarnja)", group: "ostalo", build: "klima",
    sizeM: [0.84, 0.3, 0.21], mount: "wall",
    // Sits just under the ceiling, so it follows the room height.
    mountY: (dims) => Math.max(1.7, dims.heightM - 0.35) - 0.15,
  },
};

// js/i18n.js is the authority for UI copy and already ships a
// `soba3d.fixture.<id>` family that deliberately carries the GLB basename
// spellings alongside the Croatian ones. Map each persisted type id to the key
// that family actually holds, so the label resolves through the dictionary and
// the `hr` literal above stays what it is meant to be — a safety net for a
// partial deployment. The persisted ids themselves never change: saved designs
// depend on them.
const FIXTURE_I18N_KEY = {
  kada: "kada", kadaSlobodna: "bathtub-freestanding", tusKabina: "tusKabina",
  wc: "wc", wcKockasti: "toilet-square", wcModerni: "toilet-modern",
  umivaonik: "umivaonik", umivaonikStup: "washbasin-pedestal",
  umivaonikViseci: "washbasin-vanity-wall", ogledalo: "ogledalo",
  ormaricVisoki: "bathroom-cabinet-tall", drzacRucnika: "drzacRucnika",
  kuhinjaDonji: "kitchen-cabinet-base", kuhinjaLadice: "kitchen-cabinet-drawer",
  kuhinjaKutni: "kitchen-cabinet-corner", sudoper: "sudoper", stednjak: "stednjak",
  hladnjak: "hladnjak", kuhinjaGornji: "kitchen-cabinet-upper", napa: "napa",
  vrata: "vrata", vrataKrilo: "door-leaf", prozorVeliki: "window-large",
  prozorMali: "window-small", radijator: "radijator", klima: "klima",
  klimaVanjska: "ac-outdoor-unit",
};

const fixtureLabel = (type) => {
  const spec = FIXTURE_SPECS[type];
  if (!spec) return type;
  return tt(`soba3d.fixture.${FIXTURE_I18N_KEY[type] || type}`, spec.hr);
};

export const FIXTURE_TYPE_IDS = Object.keys(FIXTURE_SPECS);

/** Public, read-only catalogue for the view's palette (label + grouping). */
export const FIXTURE_CATALOGUE = FIXTURE_TYPE_IDS.map((type) => ({
  type,
  hr: fixtureLabel(type),
  group: FIXTURE_SPECS[type].group,
  sizeM: FIXTURE_SPECS[type].sizeM.slice(),
  mount: FIXTURE_SPECS[type].mount,
}));

const specOf = (type) => FIXTURE_SPECS[type] || null;
const mountYOf = (spec, dims) =>
  (typeof spec.mountY === "function" ? spec.mountY(dims) : (spec.mountY || 0));

// ---- Materials -------------------------------------------------------------

const matMatte = () => new THREE.MeshStandardMaterial({ color: 0xeceae6, roughness: 0.85 });
const matDark = () => new THREE.MeshStandardMaterial({ color: 0x565b60, roughness: 0.6 });
const matChrome = () => new THREE.MeshStandardMaterial({ color: 0xc7cbd0, roughness: 0.3, metalness: 0.7 });

function shadowed(mesh, receive = true) {
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  return mesh;
}

// ---- Primitive builders (only where no CC0 model exists) -------------------
// Both build with their own base at y = 0; the group's `mountY` lifts them.

function buildRadijator() {
  const g = new THREE.Group();
  const panel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), matMatte()));
  panel.position.set(0, 0.3, 0);
  g.add(panel);
  const finGeo = new THREE.BoxGeometry(0.08, 0.56, 0.015);
  for (let i = 0; i < 8; i++) {
    const fin = new THREE.Mesh(finGeo, matMatte());
    fin.position.set(-0.36 + i * 0.103, 0.3, 0.037);
    g.add(fin);
  }
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 10), matChrome());
  valve.rotation.z = Math.PI / 2;
  valve.position.set(0.5, 0.04, 0);
  g.add(valve);
  return g;
}

function buildKlima() {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.3, 0.21),
    new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.4, metalness: 0.02 })), false);
  body.position.set(0, 0.15, 0);
  g.add(body);
  const slat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.02), matDark());
  slat.position.set(0, 0.04, 0.1);
  g.add(slat);
  return g;
}

const PRIMITIVE_BUILDERS = { radijator: buildRadijator, klima: buildKlima };

/** Massing block shown the instant a fixture is added, replaced by the GLB.
 *  Sized to the model's documented real-world size so the swap barely moves. */
function buildPlaceholder(sizeM) {
  const g = new THREE.Group();
  const [w, h, d] = sizeM;
  const box = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: IRIS.sky200, roughness: 0.95, transparent: true, opacity: 0.55,
    })), false);
  box.position.y = h / 2;
  g.add(box);
  g.userData.placeholder = true;
  return g;
}

// ---- Geometry helpers ------------------------------------------------------

const _box = new THREE.Box3();

/**
 * Local-space floor footprint of a group, measured at identity.
 * @returns {{minX:number,maxX:number,minZ:number,maxZ:number,topY:number}}
 * Box3.setFromObject calls updateWorldMatrix(false,false) per node and then
 * recurses, so the traversal is self-correcting from the root down — only the
 * root's own transform has to be neutral, which is what we force here.
 */
function measureFootprint(group) {
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
function rotatedExtent(fp, rotY) {
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
function limitsFor(fp, rotY, dims) {
  const e = rotatedExtent(fp, rotY);
  return {
    loX: -e.minX, hiX: dims.widthM - e.maxX,
    loZ: -e.minZ, hiZ: dims.depthM - e.maxZ,
  };
}

/** @returns {{v:number, anchor:-1|0|1}} */
function axisSettle(v, lo, hi) {
  if (hi < lo) return { v: (lo + hi) / 2, anchor: 0 };       // wider than the room: centre it
  if (v <= lo + WALL_SNAP_M) return { v: lo, anchor: -1 };
  if (v >= hi - WALL_SNAP_M) return { v: hi, anchor: 1 };
  const g = Math.round(v / GRID_M) * GRID_M;
  return { v: Math.min(hi, Math.max(lo, g)), anchor: 0 };    // rounding can overshoot by 2.5 cm
}

/** Free axis: keep the world position, re-clamp. Anchored: recompute flush
 *  against THAT wall in the NEW room — this is the whole resize fix. */
function reanchor(v, anchor, lo, hi) {
  if (hi < lo) return (lo + hi) / 2;
  if (anchor === -1) return lo;
  if (anchor === 1) return hi;
  return Math.min(hi, Math.max(lo, v));
}

// ---- GLB prototypes --------------------------------------------------------
// Loaded once per file, normalised, then cloned per instance so every copy of a
// cabinet shares one geometry and one material set.

// Resolved against THIS MODULE rather than the document, so a deployment under
// a sub-path (GitHub Pages /Akvaterm/) resolves without a build step.
const MODELS_URL = new URL("../vendor/models/", import.meta.url).href;
const protoCache = new Map();   // file -> Promise<{root, footprint}>
let gltfLoader = null;

// KNOWN LIMITATION, measured not assumed — index.html's CSP vs embedded
// textures. GLTFLoader wraps a bufferView-backed image in a Blob and hands the
// resulting `blob:` URL to ImageBitmapLoader (GLTFLoader.js:3314 and :2606;
// Chrome/modern Safari take that branch, Safari <17 and Firefox <98 fall back
// to TextureLoader and an <img>). Both were tested live against this app's
// policy and BOTH are refused: fetch() by `connect-src 'self'` and <img> by
// `img-src 'self' data:`. three then logs "Couldn't load texture" and resolves
// the material without a map, so the model still renders — verified — but four
// files lose their texture: toilet-modern.glb, bathtub-freestanding.glb,
// washbasin-vanity-wall.glb and towel-rail.glb (PROVENANCE lists exactly these
// four as carrying an embedded image; the other 21 have none and are unaffected).
// The fix is a one-line CSP change in index.html, which this module does not
// own: add `blob:` to img-src AND to connect-src.
function loaderFor() {
  if (!gltfLoader) gltfLoader = new GLTFLoader().setPath(MODELS_URL);
  return gltfLoader;
}

/**
 * @param {object} spec  entry from FIXTURE_SPECS (needs file + scale)
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
function loadPrototype(spec, maxAniso) {
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

/** Frees the shared prototypes. Pending loads dispose themselves on arrival. */
function disposePrototypes() {
  for (const p of protoCache.values()) {
    p.then((proto) => disposeObject(proto.root, true)).catch(() => { /* never loaded */ });
  }
  protoCache.clear();
  gltfLoader = null;
}

/** @param {boolean} force  dispose even resources flagged as shared. */
function disposeObject(root, force = false) {
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

// ============================================================================
// Mount
// ============================================================================

export async function mountRoom(el, { room = {}, assignments = {}, products = [], onReady } = {}) {
  const dims = {
    widthM: clampDim(room.widthM, 3),
    depthM: clampDim(room.depthM, 2.5),
    heightM: clampDim(room.heightM, 2.6),
  };
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // + shadow.radius = soft edges (PCFSoft is deprecated in r185)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvasEl = renderer.domElement;
  canvasEl.style.display = "block";
  canvasEl.style.width = "100%";
  canvasEl.style.height = "100%";
  // Named, focusable and keyboard-operable: without this the room is a silent,
  // unreachable region for assistive tech and pointer-only for everyone else.
  canvasEl.setAttribute("role", "img");
  canvasEl.setAttribute("tabindex", "0");
  canvasEl.setAttribute("aria-keyshortcuts",
    "ArrowLeft ArrowRight ArrowUp ArrowDown Plus Minus R Shift+R Escape");
  canvasEl.style.outlineOffset = "-3px";
  el.appendChild(canvasEl);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(IRIS.paper);   // --paper #F2F2F2

  // RoomEnvironment IBL + one shadow-casting directional (the contract's pair).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  if (typeof envScene.dispose === "function") envScene.dispose();

  const sun = new THREE.DirectionalLight(0xfff6ea, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);

  // ---- Interaction state ---------------------------------------------------
  const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);   // n·p + c = 0  ⇒  y = 0
  const _ndc = new THREE.Vector2();
  const _ray = new THREE.Raycaster();
  const _hit = new THREE.Vector3();
  const fixtureRecs = [];
  const recByGroup = new Map();
  let selected = null;
  let dragId = null;      // pointer that is actually moving a fixture
  let swallowId = null;   // pointer that only selected — orbit suppressed, no move
  let dragMoved = false;
  const grab = { dx: 0, dz: 0, ax: 0, az: 0 };

  // Registered BEFORE `new OrbitControls(...)` purely so the AT_TARGET dispatch
  // order is deterministic. Correctness does NOT depend on it: `pointerdown`
  // targets the canvas itself, so per the DOM Standard's inner-invoke algorithm
  // the capture flag is ignored at AT_TARGET and listeners run in REGISTRATION
  // order — which is why the old `capture: true` on this listener never did what
  // its comment claimed. What actually makes disabling orbit mid-gesture safe is
  // OrbitControls' `if (this.enabled === false) return;` move guard.
  canvasEl.addEventListener("pointerdown", onPointerDown);
  canvasEl.addEventListener("pointermove", onPointerMove);
  canvasEl.addEventListener("pointerup", onPointerUp);
  canvasEl.addEventListener("pointercancel", onPointerUp);
  canvasEl.addEventListener("lostpointercapture", onPointerUp);
  canvasEl.addEventListener("pointerleave", onPointerLeave);

  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // never under the floor
  controls.minDistance = 1.2;
  controls.enablePan = false;                  // the room stays framed

  // ---- Intent gate ---------------------------------------------------------
  // OrbitControls' constructor sets touch-action:none, which is exactly the
  // scroll trap the review caught. We take it back to pan-y: a vertical swipe
  // over the room scrolls the page whenever no fixture is selected. Wheel zoom
  // and one-finger orbit only switch on after a deliberate click or tap.
  let armed = false;
  controls.enableZoom = false;
  controls.touches = { ONE: TOUCH_NONE, TWO: TOUCH_NONE };
  syncTouchAction();

  function arm() {
    if (armed || disposed) return;
    armed = true;
    controls.enableZoom = true;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    // The view fades its "drag to rotate" hint on this.
    canvasEl.dispatchEvent(new CustomEvent("akv:room-armed", { bubbles: true }));
  }
  function disarm() {
    if (!armed || disposed) return;
    armed = false;
    controls.enableZoom = false;
    controls.touches = { ONE: TOUCH_NONE, TWO: TOUCH_NONE };
  }

  // MDN, CSS touch-action: "After a gesture starts, changes to touch-action will
  // not have any impact on the behavior of the current gesture." So this can
  // only ever take effect on the NEXT gesture — which is precisely why dragging
  // on touch is tap-to-select then drag, and why nothing is selected by default.
  function syncTouchAction() {
    canvasEl.style.touchAction = selected ? "none" : "pan-y";
  }

  // ---- Surfaces ------------------------------------------------------------
  const surfaceRecs = {};
  for (const sid of SURFACE_IDS) {
    const mat = new THREE.MeshStandardMaterial({
      color: sid === "floor" ? 0xd8d6d2 : 0xf2f0ec,
      roughness: 0.9,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
    surfaceRecs[sid] = { mesh };
  }

  const surfaceSizeM = (sid) => {
    if (sid === "floor") return [dims.widthM, dims.depthM];
    if (sid === "wallN" || sid === "wallS") return [dims.widthM, dims.heightM];
    return [dims.depthM, dims.heightM];
  };

  function layout() {
    const w = dims.widthM, d = dims.depthM, h = dims.heightM;
    const place = (sid, geo, pos, rot) => {
      const mesh = surfaceRecs[sid].mesh;
      mesh.geometry.dispose();
      mesh.geometry = geo;
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
    };
    place("floor", new THREE.PlaneGeometry(w, d), [0, 0, 0], [-Math.PI / 2, 0, 0]);
    place("wallN", new THREE.PlaneGeometry(w, h), [0, h / 2, -d / 2], [0, 0, 0]);
    place("wallS", new THREE.PlaneGeometry(w, h), [0, h / 2, d / 2], [0, Math.PI, 0]);
    place("wallE", new THREE.PlaneGeometry(d, h), [w / 2, h / 2, 0], [0, -Math.PI / 2, 0]);
    place("wallW", new THREE.PlaneGeometry(d, h), [-w / 2, h / 2, 0], [0, Math.PI / 2, 0]);

    const span = Math.max(w, d);
    sun.position.set(w * 0.8, h * 2.2 + 1.5, d * 0.6);
    const sc = sun.shadow.camera;
    const ext = span * 0.9 + 1;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.near = 0.5; sc.far = h * 4 + span * 3;
    sc.updateProjectionMatrix();

    controls.target.set(0, h * 0.35, 0);
    controls.maxDistance = span * 4;
  }

  layout();
  camera.position.set(dims.widthM * 0.75, dims.heightM * 1.15, dims.depthM * 1.35);
  controls.update();

  // ---- Texturing through the shared pattern cell ---------------------------
  const applied = {}; // surfaceId -> { product, opts } for re-apply on setDims

  function resetSurface(sid) {
    const mat = surfaceRecs[sid].mesh.material;
    if (mat.map) { mat.map.dispose(); mat.map = null; }
    mat.color.set(sid === "floor" ? 0xd8d6d2 : 0xf2f0ec);
    mat.roughness = 0.9;
    mat.needsUpdate = true;
  }

  function applySurface(sid, product, opts = {}) {
    const rec = surfaceRecs[sid];
    if (!rec) return;
    if (!product) {
      applied[sid] = null;
      resetSurface(sid);
      updateAriaLabel();
      return;
    }
    const normalized = {
      pattern: opts.pattern || "grid",
      groutColorHex: opts.groutColorHex || groutHexById(opts.groutColorId),
      groutWidthMm: Number.isFinite(opts.groutWidthMm) ? opts.groutWidthMm : 3,
    };
    const { canvas, cellSizeMm } = buildPatternCell(product, {
      ...normalized,
      scalePxPerMm: cellScaleFor(product, normalized.pattern, normalized.groutWidthMm),
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAniso;
    const [sw, sh] = surfaceSizeM(sid);
    tex.repeat.set(sw / (cellSizeMm[0] / 1000), sh / (cellSizeMm[1] / 1000));
    const mat = rec.mesh.material;
    if (mat.map) mat.map.dispose();
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.roughness = product.glossy ? 0.28 : 0.8;
    mat.needsUpdate = true;
    applied[sid] = { product, opts: normalized };
    updateAriaLabel();
  }

  // ---- Accessible name -----------------------------------------------------
  // Kept current with dims, tiling AND selection, so a screen-reader user always
  // hears what the sighted user is looking at and which keys do what right now.
  function updateAriaLabel() {
    const tiled = SURFACE_IDS
      .filter((sid) => applied[sid])
      .map((sid) => tt(`soba3d.surface.${sid}`, SURFACE_HR[sid]).toLocaleLowerCase("hr-HR"));
    const parts = [
      tt("soba3d.a11y.canvas", "3D prikaz prostorije"),
      `${fmtM(dims.widthM)} × ${fmtM(dims.depthM)} × ${fmtM(dims.heightM)} m`,
      tiled.length
        ? `${tt("soba3d.a11y.tiled", "Obložene površine")}: ${tiled.join(", ")}`
        : tt("soba3d.a11y.untiled", "Nijedna površina još nije obložena"),
    ];
    if (selected) {
      parts.push(
        `${tt("soba3d.a11y.selected", "Odabrano")}: ${fixtureLabel(selected.type)}, ` +
        `${fmtM(selected.x)} m ${tt("soba3d.a11y.fromWest", "od zapadnog zida")}, ` +
        `${fmtM(selected.z)} m ${tt("soba3d.a11y.fromNorth", "od sjevernog zida")}`);
      parts.push(tt("soba3d.a11y.keysMove",
        "Strelicama pomičite opremu, tipkom R okrenite, Escape poništava odabir"));
    } else {
      parts.push(tt("soba3d.a11y.keys", "Strelicama okrenite prikaz, tipkama + i − približite"));
    }
    canvasEl.setAttribute("aria-label", parts.join(". ") + ".");
  }

  // ---- Fixtures ------------------------------------------------------------
  const fixturesGroup = new THREE.Group();
  scene.add(fixturesGroup);
  let fixturesState = [];
  let swapToken = 0;      // invalidates in-flight model swaps across rebuilds

  /** Snap + clamp + derive wall anchors from a raw pointer-derived position.
   *  Order is deliberate: the wall magnet is tested on the RAW value BEFORE the
   *  clamp, so dragging past a wall snaps flush instead of sticking at the
   *  bound, and the 5 cm grid only applies in the free middle so a wall-flush
   *  fixture is never nudged 2 cm off its wall by rounding. */
  function settle(rec, rawX, rawZ) {
    const L = limitsFor(rec.footprint, rec.rotY, dims);
    const a = axisSettle(rawX, L.loX, L.hiX);
    const b = axisSettle(rawZ, L.loZ, L.hiZ);
    rec.x = a.v; rec.ax = a.anchor;
    rec.z = b.v; rec.az = b.anchor;
  }

  function applyRec(rec) {
    rec.group.position.set(rec.x - dims.widthM / 2, 0, rec.z - dims.depthM / 2);
    rec.group.rotation.y = rec.rotY;
  }

  /** Resize reflow. Free fixtures KEEP their world position and are re-clamped;
   *  wall-anchored fixtures follow their wall into the new room. Nothing is ever
   *  re-centred, which is the bug the operator hit. */
  function reflow() {
    for (const rec of fixtureRecs) {
      if (!rec) continue;
      const spec = specOf(rec.type);
      if (spec) rec.holder.position.y = mountYOf(spec, dims);
      const L = limitsFor(rec.footprint, rec.rotY, dims);
      rec.x = reanchor(rec.x, rec.ax, L.loX, L.hiX);
      rec.z = reanchor(rec.z, rec.az, L.loZ, L.hiZ);
      applyRec(rec);
    }
    syncSelectionRing();
  }

  /** Re-place a record after its ROTATION changed, the same way reflow()
   *  re-places it after the ROOM changed.
   *
   *  Rotating changes the footprint's world extent, so the flush position on
   *  every wall moves. settle() is the WRONG tool here: it re-derives BOTH
   *  anchors from proximity against the NEW extent, so a fixture that was flush
   *  ends up parked short of its wall and silently reverts to ax/az = 0 (free)
   *  — after which reflow() no longer walks it with that wall and the next
   *  setDims() strands it. That is the operator's original "stranded fixture",
   *  reached through the rotate button instead of the dimension field.
   *
   *  So: an anchored axis is re-derived flush against the wall it is already
   *  anchored to, using the new extent (reanchor(), exactly as reflow() does).
   *  Only a FREE axis goes through axisSettle(), where the wall magnet may
   *  legitimately acquire a new anchor because the turn brought that edge
   *  within WALL_SNAP_M of a wall. */
  function resettleAfterRotate(rec) {
    const L = limitsFor(rec.footprint, rec.rotY, dims);
    if (rec.ax !== 0) {
      rec.x = reanchor(rec.x, rec.ax, L.loX, L.hiX);
    } else {
      const a = axisSettle(rec.x, L.loX, L.hiX);
      rec.x = a.v; rec.ax = a.anchor;
    }
    if (rec.az !== 0) {
      rec.z = reanchor(rec.z, rec.az, L.loZ, L.hiZ);
    } else {
      const b = axisSettle(rec.z, L.loZ, L.hiZ);
      rec.z = b.v; rec.az = b.anchor;
    }
  }

  function buildRec(f, index) {
    const spec = specOf(f.type);
    if (!spec) return null;
    const group = new THREE.Group();
    const holder = new THREE.Group();
    holder.position.y = mountYOf(spec, dims);
    group.add(holder);

    const builder = spec.build ? PRIMITIVE_BUILDERS[spec.build] : null;
    holder.add(builder ? builder() : buildPlaceholder(spec.sizeM));

    const rec = {
      i: index,
      type: f.type,
      group,
      holder,
      footprint: measureFootprint(group),
      x: Number.isFinite(Number(f.x)) ? Number(f.x) : dims.widthM / 2,
      z: Number.isFinite(Number(f.z)) ? Number(f.z) : dims.depthM / 2,
      rotY: Number.isFinite(Number(f.rotY)) ? Number(f.rotY) : 0,
      ax: 0, az: 0,
    };
    // Records that have never been through settle() have unknown anchors, and a
    // saved design predating ax/az has none either. Running it once here derives
    // them from the intended position, which is what makes even an untouched
    // starter room survive a resize — and removes today's silent 7.5 cm gaps.
    const hasAnchors = f.ax === -1 || f.ax === 1 || f.az === -1 || f.az === 1;
    settle(rec, rec.x, rec.z);
    if (hasAnchors) { rec.ax = f.ax | 0; rec.az = f.az | 0; }
    applyRec(rec);
    fixturesGroup.add(group);
    recByGroup.set(group, rec);
    if (spec.file) queueModel(rec, spec);
    return rec;
  }

  /** Placeholder → real model. Guarded by `disposed` and a monotonic token so a
   *  load started for a previous room can never land in the current one. */
  function queueModel(rec, spec) {
    const token = swapToken;
    loadPrototype(spec, maxAniso).then((proto) => {
      if (disposed || token !== swapToken || !recByGroup.has(rec.group)) return;
      for (const child of [...rec.holder.children]) {
        disposeObject(child);
        rec.holder.remove(child);
      }
      rec.holder.add(proto.root.clone(true));
      // The GLB footprint is not the placeholder's, so re-measure and re-settle
      // against the room before anyone can drag it.
      rec.footprint = measureFootprint(rec.group);
      const L = limitsFor(rec.footprint, rec.rotY, dims);
      rec.x = reanchor(rec.x, rec.ax, L.loX, L.hiX);
      rec.z = reanchor(rec.z, rec.az, L.loZ, L.hiZ);
      applyRec(rec);
      if (selected === rec) syncSelectionRing();
      requestRender();
    }).catch(() => {
      // Offline or a missing file: the massing block stays, and it still drags,
      // rotates and clamps exactly like the model would. Nothing is logged in a
      // happy path and nothing is retried in a loop.
    });
  }

  function disposeRec(rec) {
    if (selected === rec) setSelected(null);
    recByGroup.delete(rec.group);
    disposeObject(rec.group);
    fixturesGroup.remove(rec.group);
  }

  /** Diffed rebuild: a record whose type is unchanged keeps its group (and its
   *  loaded model), so a dimension keystroke or a re-push never re-runs a loader
   *  and never destroys the current selection.
   *  fixtureRecs is index-aligned with the caller's list — an unknown type
   *  leaves a null hole rather than shifting every index under the events we
   *  emit, which the view resolves back into `room.fixtures[index]`. */
  function syncFixtures(list) {
    fixturesState = Array.isArray(list) ? list.map((f) => ({ ...f })) : [];
    const keepSelected = selected ? selected.i : -1;
    for (let i = 0; i < fixturesState.length; i++) {
      const f = fixturesState[i];
      const rec = fixtureRecs[i];
      if (rec && rec.type === f.type) {
        rec.i = i;
        if (Number.isFinite(Number(f.x))) rec.x = Number(f.x);
        if (Number.isFinite(Number(f.z))) rec.z = Number(f.z);
        if (Number.isFinite(Number(f.rotY))) rec.rotY = Number(f.rotY);
        if (f.ax === -1 || f.ax === 0 || f.ax === 1) rec.ax = f.ax;
        if (f.az === -1 || f.az === 0 || f.az === 1) rec.az = f.az;
        // Re-clamp before painting. This is the ONE public entry point that
        // takes x/z straight from the caller, and nothing upstream guarantees
        // those numbers fit the room currently on screen (a design saved in a
        // 4 m room, re-pushed into a 2 m one, would otherwise be placed through
        // a wall). Same pass reflow() runs: an anchored axis re-derives flush
        // against its wall, a free axis is clamped where it stands. buildRec(),
        // reflow() and queueModel() all do this already; this branch did not.
        const L = limitsFor(rec.footprint, rec.rotY, dims);
        rec.x = reanchor(rec.x, rec.ax, L.loX, L.hiX);
        rec.z = reanchor(rec.z, rec.az, L.loZ, L.hiZ);
        applyRec(rec);
        continue;
      }
      if (rec) disposeRec(rec);
      fixtureRecs[i] = buildRec(f, i);
    }
    for (let i = fixturesState.length; i < fixtureRecs.length; i++) {
      if (fixtureRecs[i]) disposeRec(fixtureRecs[i]);
    }
    fixtureRecs.length = fixturesState.length;
    if (keepSelected >= 0) setSelected(fixtureRecs[keepSelected] || null);
    syncSelectionRing();
  }

  /** Current placement of every fixture, index-aligned with the caller's list.
   *  The view writes these back after a resize so the next save records the
   *  reflowed positions rather than the pre-resize ones. */
  function readFixtures() {
    return fixtureRecs.map((r) =>
      (r ? { index: r.i, x: r.x, z: r.z, rotY: r.rotY, ax: r.ax, az: r.az } : null));
  }

  // ---- Selection affordance ------------------------------------------------
  // A footprint quad on the floor plus an always-visible outline, not a
  // wireframe box: it reads correctly from above, communicates the clamp, and
  // stays visible even under a bath that covers its own footprint entirely.
  const selRing = new THREE.Group();
  selRing.visible = false;
  const selQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: IRIS.teal600, transparent: true, opacity: 0.3, depthWrite: false,
    }));
  selQuad.rotation.x = -Math.PI / 2;
  selQuad.position.y = 0.003;
  selQuad.raycast = () => {};
  selRing.add(selQuad);
  const loopGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, 0.004, -0.5), new THREE.Vector3(0.5, 0.004, -0.5),
    new THREE.Vector3(0.5, 0.004, 0.5), new THREE.Vector3(-0.5, 0.004, 0.5),
  ]);
  const selLoop = new THREE.LineLoop(loopGeo,
    new THREE.LineBasicMaterial({ color: IRIS.amber500, depthTest: false }));
  selLoop.renderOrder = 999;
  selLoop.raycast = () => {};
  selRing.add(selLoop);
  scene.add(selRing);   // NOT in fixturesGroup — it must never be raycast or rebuilt with it

  function syncSelectionRing() {
    if (!selected) { selRing.visible = false; return; }
    const e = rotatedExtent(selected.footprint, selected.rotY);
    const sx = Math.max(0.05, e.maxX - e.minX);
    const sz = Math.max(0.05, e.maxZ - e.minZ);
    selRing.scale.set(sx, 1, sz);
    selRing.position.set(
      selected.x + (e.minX + e.maxX) / 2 - dims.widthM / 2,
      0,
      selected.z + (e.minZ + e.maxZ) / 2 - dims.depthM / 2);
    selRing.visible = true;
  }

  function setSelected(rec) {
    if (selected === rec) return;
    selected = rec || null;
    syncTouchAction();
    syncSelectionRing();
    updateAriaLabel();
    canvasEl.dispatchEvent(new CustomEvent("akv:fixture-selected", {
      bubbles: true,
      detail: selected
        ? { index: selected.i, type: selected.type, label: fixtureLabel(selected.type) }
        : null,
    }));
    requestRender();
  }

  function emitMoved(rec) {
    canvasEl.dispatchEvent(new CustomEvent("akv:fixture-moved", {
      bubbles: true,
      detail: { index: rec.i, x: rec.x, z: rec.z, rotY: rec.rotY, ax: rec.ax, az: rec.az },
    }));
  }

  // ---- Picking and dragging ------------------------------------------------

  function toNDC(e) {
    const r = canvasEl.getBoundingClientRect();
    return _ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  function pickFixture(e) {
    _ray.setFromCamera(toNDC(e), camera);
    const hits = _ray.intersectObjects(fixturesGroup.children, true);   // sorted near → far
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && o.parent !== fixturesGroup) o = o.parent;
    return o ? recByGroup.get(o) || null : null;
  }

  function onPointerDown(e) {
    if (disposed) return;
    if (e.pointerType !== "touch") arm();
    if (!e.isPrimary) return;

    // Take focus explicitly. The canvas is already tabindex="0", but the drag
    // branch below calls e.preventDefault() on pointerdown, which suppresses the
    // compatibility mousedown — and mousedown's default action is what would
    // otherwise move focus here. Without this line the keyboard shortcuts the
    // canvas advertises via aria-keyshortcuts (R, the arrow nudge, Escape) can
    // fail to reach it after the user selects a fixture with the mouse.
    // Unconditional and cheap: no branch has to reason about whether the
    // suppression applies in the engine it is running on.
    try { canvasEl.focus({ preventScroll: true }); } catch { canvasEl.focus(); }

    const rec = pickFixture(e);
    if (!rec) { setSelected(null); return; }     // empty space: orbit works normally

    const wasSelected = selected === rec;
    setSelected(rec);

    // Touch is two-step by necessity: touch-action was still `pan-y` when this
    // gesture started, so the browser owns any vertical movement and will fire
    // pointercancel. The tap that selects therefore only selects — and it does
    // not orbit either, which would be a jarring spin under the finger.
    if (e.pointerType === "touch" && !wasSelected) {
      controls.enabled = false;
      swallowId = e.pointerId;
      return;
    }

    // Ray parallel to the floor, or the floor behind the camera: abort WITHOUT
    // disabling orbit. Ray.intersectPlane returns null in both cases and a stale
    // _hit would teleport the fixture.
    if (!_ray.ray.intersectPlane(FLOOR, _hit)) return;

    controls.enabled = false;                    // kills OrbitControls' move handler
    dragId = e.pointerId;
    dragMoved = false;
    grab.dx = rec.x - (_hit.x + dims.widthM / 2);   // keep the grabbed point under the pointer
    grab.dz = rec.z - (_hit.z + dims.depthM / 2);
    grab.ax = rec.ax;
    grab.az = rec.az;
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* already released */ }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (disposed || e.pointerId !== dragId || !selected) return;
    _ray.setFromCamera(toNDC(e), camera);
    if (!_ray.ray.intersectPlane(FLOOR, _hit)) return;   // mandatory null guard
    settle(selected,
      _hit.x + dims.widthM / 2 + grab.dx,
      _hit.z + dims.depthM / 2 + grab.dz);
    applyRec(selected);
    syncSelectionRing();
    dragMoved = true;
    requestRender();
  }

  function onPointerUp(e) {
    // Arming a touch gesture happens on release, not on press: arming mid-
    // gesture would let one swipe both scroll the page and spin the camera.
    if (e.type === "pointerup" && e.pointerType === "touch" && e.isPrimary) arm();

    if (e.pointerId === swallowId) {
      swallowId = null;
      controls.enabled = true;
      return;
    }
    if (e.pointerId !== dragId) return;
    dragId = null;
    try { canvasEl.releasePointerCapture(e.pointerId); } catch { /* not capturing */ }
    controls.enabled = true;
    if (!selected || !dragMoved) { dragMoved = false; return; }
    dragMoved = false;
    faceNewWall(selected);
    updateAriaLabel();
    emitMoved(selected);
    requestRender();
  }

  function onPointerLeave(e) {
    if (e.pointerType !== "touch" && dragId === null && swallowId === null) disarm();
  }

  /** "Prisloni uza zid": a fixture that has just BECOME flush with a wall turns
   *  to face into the room, using the module's own convention (0 = back toward
   *  north). Only on a NEWLY entered snap and only on drop — a fixture spinning
   *  under the finger mid-drag is disorienting, and re-facing one the user
   *  deliberately turned would fight them. */
  function faceNewWall(rec) {
    let rotY = null;
    if (rec.az !== 0 && rec.az !== grab.az) rotY = rec.az === -1 ? 0 : Math.PI;
    else if (rec.ax !== 0 && rec.ax !== grab.ax) rotY = rec.ax === -1 ? Math.PI / 2 : -Math.PI / 2;
    if (rotY === null || Math.abs(rotY - rec.rotY) < 1e-6) return;
    rec.rotY = rotY;
    // The new extent may not fit where the old one did — and the fixture has
    // just BECOME flush, so the anchor it acquired one line ago is the thing
    // that must survive the turn. See resettleAfterRotate().
    resettleAfterRotate(rec);
    applyRec(rec);
    syncSelectionRing();
  }

  function rotateSelected(delta) {
    const rec = selected;
    if (!rec) return;
    const next = rec.rotY + delta;
    rec.rotY = Math.atan2(Math.sin(next), Math.cos(next));   // normalise to (−π, π]
    resettleAfterRotate(rec);        // mandatory: the extent changed. NOT settle() —
                                     // that would drop the wall anchor. See the helper.
    applyRec(rec);
    syncSelectionRing();
    updateAriaLabel();
    emitMoved(rec);
    requestRender();
  }

  /** Arrow-key nudge, in the room axis that currently points right/away on
   *  screen — pressing Right always moves the fixture right, from any azimuth. */
  const _camFwd = new THREE.Vector3();
  function nudgeSelected(screenX, screenZ, step) {
    const rec = selected;
    if (!rec) return;
    camera.getWorldDirection(_camFwd);
    _camFwd.y = 0;
    if (_camFwd.lengthSq() < 1e-6) _camFwd.set(0, 0, -1);
    _camFwd.normalize();
    // Snap the view direction to the nearest room axis, then derive "right".
    const fx = Math.abs(_camFwd.x) > Math.abs(_camFwd.z) ? Math.sign(_camFwd.x) : 0;
    const fz = fx === 0 ? Math.sign(_camFwd.z) || -1 : 0;
    const rx = -fz, rz = fx;    // right = forward rotated −90° about +Y
    settle(rec,
      rec.x + (screenX * rx + screenZ * fx) * step,
      rec.z + (screenX * rz + screenZ * fz) * step);
    applyRec(rec);
    syncSelectionRing();
    updateAriaLabel();
    emitMoved(rec);
    requestRender();
  }

  // ---- Open-room wall hiding by camera azimuth -----------------------------
  const camDir = new THREE.Vector3();
  function updateWallVisibility() {
    camera.getWorldPosition(camDir).sub(controls.target);
    camDir.y = 0;
    if (camDir.lengthSq() < 1e-6) return;
    camDir.normalize();
    for (const sid of ["wallN", "wallE", "wallS", "wallW"]) {
      surfaceRecs[sid].mesh.visible = camDir.dot(OUTWARD[sid]) <= 0.35;
    }
  }

  // ---- Sizing / loop / lifecycle -------------------------------------------
  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }

  let raf = 0;
  let readyFired = false;

  // On-demand rendering: a still room costs nothing. Frames are requested by
  // the controls' 'change' event (which OrbitControls also fires from inside
  // update() while damping settles, so the glide still animates), by resize, by
  // every content mutation and by each model arriving.
  function renderFrame() {
    raf = 0;
    if (disposed) return;
    controls.update();
    updateWallVisibility();
    renderer.render(scene, camera);
    if (!readyFired) {
      readyFired = true;
      if (typeof onReady === "function") onReady();
    }
  }
  function requestRender() {
    if (disposed || raf) return;
    raf = requestAnimationFrame(renderFrame);
  }
  controls.addEventListener("change", requestRender);

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // ---- Keyboard ------------------------------------------------------------
  // Arrows orbit the camera when nothing is selected and nudge the fixture when
  // something is — the same keys, the mode announced in the aria-label.
  const _kbOffset = new THREE.Vector3();
  const _kbSpherical = new THREE.Spherical();
  function orbitBy(dTheta, dPhi) {
    _kbOffset.copy(camera.position).sub(controls.target);
    _kbSpherical.setFromVector3(_kbOffset);
    _kbSpherical.theta += dTheta;
    _kbSpherical.phi = Math.min(controls.maxPolarAngle, Math.max(0.08, _kbSpherical.phi + dPhi));
    _kbOffset.setFromSpherical(_kbSpherical);
    camera.position.copy(controls.target).add(_kbOffset);
    camera.lookAt(controls.target);
    requestRender();
  }
  function dollyBy(factor) {
    _kbOffset.copy(camera.position).sub(controls.target);
    const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, _kbOffset.length() * factor));
    _kbOffset.setLength(len);
    camera.position.copy(controls.target).add(_kbOffset);
    requestRender();
  }
  function onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const orbitStep = e.shiftKey ? 0.22 : 0.08;
    const nudge = e.shiftKey ? GRID_M * 4 : GRID_M;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":  selected ? nudgeSelected(-1, 0, nudge) : orbitBy(-orbitStep, 0); break;
      case "ArrowRight": selected ? nudgeSelected(1, 0, nudge) : orbitBy(orbitStep, 0); break;
      case "ArrowUp":    selected ? nudgeSelected(0, 1, nudge) : orbitBy(0, -orbitStep); break;
      case "ArrowDown":  selected ? nudgeSelected(0, -1, nudge) : orbitBy(0, orbitStep); break;
      case "+": case "=": dollyBy(0.88); break;
      case "-": case "_": dollyBy(1.14); break;
      case "r": case "R": rotateSelected(e.shiftKey ? -Math.PI / 2 : Math.PI / 2); break;
      case "Escape": setSelected(null); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); arm(); }
  }
  canvasEl.addEventListener("keydown", onKeyDown);

  // Initial state from the caller's saved design.
  for (const [sid, a] of Object.entries(assignments || {})) {
    if (!a) continue;
    const product = products.find((p) => p.id === a.productId);
    if (product) {
      applySurface(sid, product, {
        pattern: a.pattern,
        groutColorId: a.groutColorId,
        groutWidthMm: a.groutWidthMm,
      });
    }
  }
  syncFixtures(Array.isArray(room.fixtures) ? room.fixtures : []);
  updateAriaLabel();
  requestRender();

  return {
    setSurface(surfaceId, product, opts) {
      applySurface(surfaceId, product, opts || {});
      requestRender();
    },

    setDims(w, d, h) {
      dims.widthM = clampDim(w, dims.widthM);
      dims.depthM = clampDim(d, dims.depthM);
      dims.heightM = clampDim(h, dims.heightM);
      layout();
      // reflow(), NOT a rebuild: rebuilding every group on every keystroke would
      // re-run a loader per fixture and destroy the selection mid-edit.
      reflow();
      for (const [sid, rec] of Object.entries(applied)) {
        if (rec) applySurface(sid, rec.product, rec.opts);
      }
      updateAriaLabel();
      requestRender();
    },

    setFixtures(list) {
      syncFixtures(list);
      updateAriaLabel();
      requestRender();
    },

    // ---- Additive surface (the contract's four methods are unchanged) ------
    getFixtures() { return readFixtures(); },

    getCatalogue() { return FIXTURE_CATALOGUE; },

    rotateSelected(delta) { rotateSelected(delta); },

    selectByIndex(i) { setSelected(fixtureRecs[i] || null); },

    clearSelection() { setSelected(null); },

    dispose() {
      if (disposed) return;
      disposed = true;
      swapToken++;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      controls.removeEventListener("change", requestRender);
      canvasEl.removeEventListener("pointerdown", onPointerDown);
      canvasEl.removeEventListener("pointermove", onPointerMove);
      canvasEl.removeEventListener("pointerup", onPointerUp);
      canvasEl.removeEventListener("pointercancel", onPointerUp);
      canvasEl.removeEventListener("lostpointercapture", onPointerUp);
      canvasEl.removeEventListener("pointerleave", onPointerLeave);
      canvasEl.removeEventListener("keydown", onKeyDown);
      canvasEl.style.touchAction = "pan-y";
      controls.dispose();
      recByGroup.clear();
      fixtureRecs.length = 0;
      disposeObject(scene, true);
      disposePrototypes();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvasEl.remove();
    },
  };
}
