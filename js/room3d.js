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
// SHARED CORE. Everything this module and js/scene3d.js (the Dizajner) both
// need lives in js/gfx3d.js and is imported from there: the MODEL_SPECS table
// (file / scale / sizeM / yaw / install height, all from
// vendor/models/PROVENANCE.md), the GLB prototype cache with its
// measure → scale → re-origin pass, the pattern-cell → CanvasTexture tiling at
// physical scale, and the placement maths (footprint, rotated extent, travel
// limits, 5 cm grid, wall magnet). What stays here is what only a free-orbit
// room has: OrbitControls, the intent gate, wall hiding by camera azimuth, the
// Croatian fixture catalogue and the two primitives with no CC0 model.
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
import { t } from "./i18n.js";
// The shared 3D core. GLB loading/caching, the measure→scale→re-origin pass,
// the physical-scale tile texturing and the placement maths live in ONE place
// so js/scene3d.js (the Dizajner) and this module cannot drift apart.
import {
  GRID_M, IRIS, BARE_SURFACE_COLOR,
  MODEL_SPECS,
  makeSurfaceTexture,
  measureFootprint, rotatedExtent, limitsFor, axisSettle, reanchor,
  buildPlaceholder, loadPrototype, retainPrototypes, releasePrototypes, disposeObject,
} from "./gfx3d.js";
import { createDirector } from "./director3d.js";

const DIM_MIN = 1.5, DIM_MAX = 8;
const SURFACE_IDS = ["floor", "wallN", "wallE", "wallS", "wallW"];

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

// ============================================================================
// Fixture catalogue
// ============================================================================
// This table is the room's LABELLING and PERSISTENCE layer: it maps a saved
// design's Croatian type id (`kada`, `sudoper`, …) onto a file in
// vendor/models/. The geometry facts — file name, scale vector, real-world
// sizeM, yaw correction, mount and install height — all come from
// `MODEL_SPECS` in js/gfx3d.js, which copies them from
// vendor/models/PROVENANCE.md, where the bounding boxes were MEASURED by
// walking each glTF scene graph and transforming every accessor's POSITION
// min/max. They are not estimates and they are not restated here: `...MODEL("x")`
// spreads the one authoritative record. The persisted type ids never change —
// saved designs depend on them.
//
// The eight Kenney kitchen modules are authored on one grid and PROVENANCE
// requires ONE shared scale across all of them or worktop heights stop lining
// up; that is `KITCHEN_RUN_SCALE`, which lives in gfx3d.js beside the specs it
// governs. Do not give a kitchen module its own vector.
//
// `yaw` is a per-file correction, NOT a preference. The shared convention is
// "rotY 0 = back toward north (−Z)", but the three source kits do not agree with
// each other or internally (PROVENANCE already records that toilet.glb runs
// Z −0.477…0 while toilet-square.glb runs 0…+0.387). Each value in MODEL_SPECS
// was VERIFIED, not assumed, by two independent checks run against the actual
// files in a browser:
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
// Every geometry fact is spread in from gfx3d.js's MODEL_SPECS by file stem.
// A `mount`/`mountY` written after the spread would override the shared record
// — none does today, and any that ever does is a deliberate room-only override
// that must say why.
const MODEL = (stem) => MODEL_SPECS[stem];

const FIXTURE_SPECS = {
  // ---- Kupaonica — sanitarije ------------------------------------------
  kada: { hr: "Kada", group: "kupaonica", ...MODEL("bathtub") },
  kadaSlobodna: { hr: "Samostojeća kada", group: "kupaonica", ...MODEL("bathtub-freestanding") },
  wc: { hr: "WC školjka", group: "kupaonica", ...MODEL("toilet") },
  wcKockasti: { hr: "WC školjka, kockasta", group: "kupaonica", ...MODEL("toilet-square") },
  wcModerni: { hr: "WC školjka, moderna", group: "kupaonica", ...MODEL("toilet-modern") },
  umivaonik: { hr: "Umivaonik s ormarićem", group: "kupaonica", ...MODEL("washbasin-vanity") },
  umivaonikStup: { hr: "Umivaonik na stupu", group: "kupaonica", ...MODEL("washbasin-pedestal") },
  umivaonikViseci: { hr: "Viseći umivaonik", group: "kupaonica", ...MODEL("washbasin-vanity-wall") },
  tusKabina: { hr: "Tuš kabina", group: "kupaonica", ...MODEL("shower-enclosure") },
  ormaricVisoki: { hr: "Zidni ormarić", group: "kupaonica", ...MODEL("bathroom-cabinet-tall") },
  ogledalo: { hr: "Ogledalo s policom", group: "kupaonica", ...MODEL("bathroom-mirror") },
  // PROVENANCE is explicit: this is a towel bar, NOT a heated towel rail.
  drzacRucnika: { hr: "Držač ručnika", group: "kupaonica", ...MODEL("towel-rail") },

  // ---- Kuhinja — the run (one shared scale, see KITCHEN_RUN_SCALE) ------
  kuhinjaDonji: { hr: "Donji element 60", group: "kuhinja", ...MODEL("kitchen-cabinet-base") },
  kuhinjaLadice: { hr: "Donji element s ladicama", group: "kuhinja", ...MODEL("kitchen-cabinet-drawer") },
  kuhinjaKutni: { hr: "Kutni donji element", group: "kuhinja", ...MODEL("kitchen-cabinet-corner") },
  sudoper: { hr: "Sudoper element", group: "kuhinja", ...MODEL("kitchen-sink-unit") },
  stednjak: { hr: "Štednjak 60", group: "kuhinja", ...MODEL("kitchen-stove") },
  hladnjak: { hr: "Hladnjak", group: "kuhinja", ...MODEL("kitchen-fridge") },
  kuhinjaGornji: { hr: "Gornji element 60", group: "kuhinja", ...MODEL("kitchen-cabinet-upper") },
  napa: { hr: "Napa 60", group: "kuhinja", ...MODEL("kitchen-hood") },

  // ---- Otvori i ostalo --------------------------------------------------
  vrata: { hr: "Vrata s dovratnikom", group: "ostalo", ...MODEL("door") },
  vrataKrilo: { hr: "Vrata (krilo)", group: "ostalo", ...MODEL("door-leaf") },
  prozorVeliki: { hr: "Prozor veliki", group: "ostalo", ...MODEL("window-large") },
  prozorMali: { hr: "Prozor mali", group: "ostalo", ...MODEL("window-small") },
  klimaVanjska: { hr: "Vanjska jedinica klime", group: "ostalo", ...MODEL("ac-outdoor-unit") },

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

// ---- What moved to js/gfx3d.js ---------------------------------------------
// measureFootprint / rotatedExtent / limitsFor / axisSettle / reanchor, the
// placeholder massing block, the GLB prototype cache (loadPrototype /
// retain / release / disposeObject) and the pattern-cell → CanvasTexture pass
// are all imported now. The Dizajner engine drags fixtures and lays tiles with
// exactly the same maths, so there is one implementation, not two.

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

  // The renderer FIRST, and the refcount only once it exists. On a device
  // without WebGL this constructor throws, and a retain taken above it would
  // never be matched by the release in dispose(), because there is no handle
  // to dispose — the prototype cache would be pinned for the session.
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  retainPrototypes();
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
  //
  // Rebuildable, and that is the whole reason this is a function: PMREM's
  // result is RENDERED into a WebGLRenderTarget, not uploaded from CPU-side
  // data, so after a lost-and-restored context three has no source to
  // re-upload it from and scene.environment samples as nothing — every
  // polished surface in gfx3d.js MATERIAL_TUNING collapses to flat matte
  // (a metal has no diffuse term; the environment is all it has to reflect).
  // See js/scene3d.js buildEnvironment() for the measured numbers. The
  // generator is rebuilt too, not reused: its internal targets and blur
  // materials belong to the context that just died.
  let pmrem = null;
  let envRT = null;
  function buildEnvironment() {
    scene.environment = null;
    if (envRT) { envRT.dispose(); envRT = null; }
    if (pmrem) { pmrem.dispose(); pmrem = null; }
    pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    if (typeof envScene.dispose === "function") envScene.dispose();
  }
  buildEnvironment();

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
  const bareColor = (sid) =>
    (sid === "floor" ? BARE_SURFACE_COLOR.floor : BARE_SURFACE_COLOR.wall);

  const surfaceRecs = {};
  for (const sid of SURFACE_IDS) {
    const mat = new THREE.MeshStandardMaterial({
      color: bareColor(sid),
      roughness: 0.9,
      metalness: 0,
      // Walls stay visible as glass once the camera crosses behind them, and a
      // back-face-culled plane viewed from outside is invisible — which is the
      // exposed edge the coverage rule forbids, reintroduced by omission.
      side: sid === "floor" ? THREE.FrontSide : THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
    surfaceRecs[sid] = { mesh };
  }

  // ---- Ceiling: coverage geometry, NOT a product surface -------------------
  // The coverage rule forbids void, and looking up used to show exactly that:
  // SURFACE_IDS is floor + four walls and nothing above.
  //
  // It is deliberately NOT added to SURFACE_IDS. That list is the module's
  // published contract and drives assignments, the estimate, the aria label and
  // the surface picker in the view. A ceiling that entered it would become a
  // tileable product the customer never asked for and a line the estimate would
  // have to price. It exists to close the box, so it is built here, lit like a
  // wall, and never cast into shadow (a ceiling shadow reads as a dirty
  // smudge overhead rather than as depth).
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      color: BARE_SURFACE_COLOR.wall, roughness: 0.95, metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  ceiling.receiveShadow = false;
  ceiling.castShadow = false;
  scene.add(ceiling);

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
    // Faces down into the room, and slightly oversized so no seam can open at
    // the wall junction when the camera grazes a corner.
    ceiling.geometry.dispose();
    ceiling.geometry = new THREE.PlaneGeometry(w * 1.02, d * 1.02);
    ceiling.position.set(0, h, 0);
    ceiling.rotation.set(Math.PI / 2, 0, 0);

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
    mat.color.set(bareColor(sid));
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
    // gfx3d.makeSurfaceTexture is the single tiling pass: buildPatternCell →
    // CanvasTexture, sRGB, RepeatWrapping, max anisotropy, and
    // repeat = surfaceMetres / cellMetres so a 600 mm tile stays 600 mm.
    const { texture, normalized } =
      makeSurfaceTexture(product, opts, surfaceSizeM(sid), maxAniso);
    const mat = rec.mesh.material;
    if (mat.map) mat.map.dispose();
    mat.map = texture;
    mat.color.set(0xffffff);
    mat.roughness = product.glossy ? 0.28 : 0.8;
    // Re-tiling redefines what "opaque" means for this surface, so the glass
    // blend has to be told its new baseline or the next frame would blend
    // toward the PREVIOUS product's roughness.
    rec.baseRoughness = mat.roughness;
    rec.glass = null;
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

  // ---- Glass edges instead of cut-away walls -------------------------------
  // THE COVERAGE RULE (operator, 2026-08-03): the screen is always covered and
  // an edge is never shown. See docs/specs/cinematic-journey.md.
  //
  // This used to set `mesh.visible = false` on any wall the camera had moved
  // behind, so the room read as open. That is precisely what the rule forbids:
  // a hidden wall is an exposed edge and a hole onto the background, and it
  // POPS — a boolean has no in-between frame.
  //
  // A wall now becomes GLASS rather than being cut away. It keeps its tiling,
  // ghosted, and keeps occupying the frame, so there is no edge to catch. The
  // ramp is smooth, so the transition is continuous at every camera speed.
  // GLASS IS CAMERA COVERAGE ONLY — a hard contract, not a convention.
  // It touches nothing but render state: never `applied[sid]` (the selected
  // product), never assignments, quantities, the estimate, the saved design or
  // its specification. `readFixtures()` and `updateAriaLabel()` read `applied`,
  // so both are blind to it by construction. A wall returns to its EXACT prior
  // opaque state, restored field by field from the snapshot taken before the
  // first blend rather than recomputed — recomputation is how "almost the same"
  // creeps in over a session.
  const camDir = new THREE.Vector3();
  const GLASS = {
    enter: 0.14,    // camera has crossed outside this far -> become glass
    exit: 0.02,     // ...and must come back this far before turning solid again
    floor: 0.14,    // minimum presence: never fully invisible, never an edge
    tau: 0.22,      // blend time constant, seconds
    tauReduced: 0.09,
  };

  /** The hysteresis gap between enter and exit is the whole point: with a
   *  single threshold, camera jitter or idle drift sitting exactly on it makes
   *  a wall pulse between opaque and glass every frame. Latching the intent and
   *  requiring a real excursion to flip it back removes that entirely. */
  function updateWallVisibility(dt) {
    camera.getWorldPosition(camDir).sub(controls.target);
    camDir.y = 0;
    if (camDir.lengthSq() < 1e-6) return false;
    camDir.normalize();
    let blending = false;
    const tau = reducedMotion ? GLASS.tauReduced : GLASS.tau;
    // Exponential approach, frame-rate independent: equal wall-clock time
    // produces equal progress whether the device runs at 60 or 120 Hz.
    const k = 1 - Math.exp(-Math.max(dt, 0) / tau);
    for (const sid of ["wallN", "wallE", "wallS", "wallW"]) {
      const rec = surfaceRecs[sid];
      const facing = camDir.dot(OUTWARD[sid]);   // >0 = camera outside this wall
      if (rec.glassWanted) { if (facing < GLASS.exit) rec.glassWanted = 0; }
      else if (facing > GLASS.enter) rec.glassWanted = 1;
      const want = rec.glassWanted ? 1 : 0;
      const cur = rec.glass ?? 0;
      const next = Math.abs(want - cur) < 0.001 ? want : cur + (want - cur) * k;
      if (next !== cur) { applyGlass(rec, next); blending = true; }
    }
    return blending;
  }

  /** Blend one surface between its exact opaque state and glass.
   *  `needsUpdate` recompiles the shader program, so it is set ONLY when the
   *  transparent flag actually flips — never per frame. */
  function applyGlass(rec, g) {
    const mat = rec.mesh.material;
    if (!rec.opaqueState) {
      rec.opaqueState = {
        transparent: mat.transparent, opacity: mat.opacity,
        depthWrite: mat.depthWrite, roughness: mat.roughness,
        renderOrder: rec.mesh.renderOrder,
      };
    }
    const o = rec.opaqueState;
    const wasTransparent = mat.transparent;
    rec.glass = g;
    if (g <= 0.002) {
      // Restore verbatim, then forget — so the next blend re-snapshots from a
      // known-good opaque state rather than from a half-faded one.
      mat.transparent = o.transparent; mat.opacity = o.opacity;
      mat.depthWrite = o.depthWrite; mat.roughness = o.roughness;
      rec.mesh.renderOrder = o.renderOrder;
      rec.glass = 0;
      rec.opaqueState = null;
    } else {
      mat.transparent = true;
      mat.opacity = o.opacity - g * (o.opacity - GLASS.floor);
      // A transparent surface must not write depth or it punches a hole in what
      // is behind it; sorting decides order instead. renderOrder 1 keeps glass
      // drawn after every opaque surface, which is what stops two simultaneous
      // glass walls at a corner from flickering against each other.
      mat.depthWrite = false;
      rec.mesh.renderOrder = 1;
      mat.roughness = o.roughness * (1 - g) + 0.06 * g;
    }
    if (wasTransparent !== mat.transparent) mat.needsUpdate = true;
  }

  /** Run `fn` with every coverage wall forced fully opaque, then restore the
   *  exact prior glass state — even if `fn` throws or rejects.
   *
   *  A one-way "force opaque" was the wrong shape: it made every capture a
   *  destructive act on the live view, so a thumbnail taken mid-journey would
   *  silently flatten the room the customer was looking at. This is a
   *  transaction instead. The restore runs in `finally`, because a capture that
   *  fails must not be able to strand the room in capture state — that failure
   *  mode is invisible until someone notices the walls stopped going to glass.
   *
   *  Thumbnails and specifications record the DESIGN; glass is a fact about
   *  where the camera happens to be standing, and must never reach either.
   */
  function withOpaqueSurfaces(fn) {
    const walls = ["wallN", "wallE", "wallS", "wallW"];
    const saved = walls.map((sid) => {
      const rec = surfaceRecs[sid];
      return { sid, wanted: rec.glassWanted ?? 0, glass: rec.glass ?? 0 };
    });
    for (const { sid } of saved) {
      const rec = surfaceRecs[sid];
      rec.glassWanted = 0;
      if (rec.glass) applyGlass(rec, 0);
    }
    const restore = () => {
      for (const s of saved) {
        const rec = surfaceRecs[s.sid];
        rec.glassWanted = s.wanted;
        if (s.glass) applyGlass(rec, s.glass);
      }
      requestRender();
    };
    let out;
    try {
      out = fn();
    } catch (err) {
      restore();
      throw err;
    }
    // A thenable capture keeps the room opaque until it actually completes.
    if (out && typeof out.then === "function") {
      return out.then(
        (v) => { restore(); return v; },
        (e) => { restore(); throw e; },
      );
    }
    restore();
    return out;
  }

  // ---- Sizing / loop / lifecycle -------------------------------------------
  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // The framing a move was composed for no longer holds, so the pending
    // result is cancelled rather than allowed to report "settled" for a shot
    // that is now a different shot. The camera itself is NOT disturbed: it
    // keeps travelling to the same pose, so the customer sees no jump.
    director.cancel("resized");
    requestRender();
  }

  // ---- Cinematic director --------------------------------------------------
  // The journey declares intent; director3d computes the movement. See that
  // file for why the motion is spring-driven rather than tweened.
  const director = createDirector({
    camera, controls, dims, surfaceRecs,
    requestFrame: () => requestRender(),
    // Semantic fixture targets ('vanity', 'cabinets', 'bath'...) resolve
    // against the placed fixtures by kind, so the guide names what the customer
    // named and the catalogue can grow without touching the target table.
    resolveFixture: (name) => {
      const want = String(name || "").toLowerCase();
      const rec = fixtureRecs.find((r) => String(r?.f?.kind || "").toLowerCase() === want);
      return rec ? rec.group : null;
    },
  });
  let cinematic = false;
  let lastFrameT = 0;
  // Mirrored here as well as in the director: the glass blend is engine-side
  // and must shorten under reduced motion even when nothing is directing.
  let reducedMotion = typeof matchMedia === "function"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A living camera cannot be damage-driven: it needs a frame every frame. This
  // is the ONE place the module's on-demand rendering contract is suspended,
  // and only while the journey is actually directing. It stops the moment the
  // tab is hidden — a background tab must not hold the GPU awake, and the
  // context-loss guards above exist precisely because this app runs near the
  // browser's live-context ceiling.
  function startCinematic() {
    if (disposed || cinematic) return;
    cinematic = true;
    controls.enabled = false;   // the director owns the camera; no tug of war
    lastFrameT = 0;
    requestRender();
  }
  function stopCinematic() {
    cinematic = false;
    controls.enabled = true;
    // Hand OrbitControls back a state consistent with where the camera ended up.
    controls.update();
  }
  function onVisibility() {
    if (document.visibilityState === "visible" && cinematic) { lastFrameT = 0; requestRender(); }
  }
  document.addEventListener("visibilitychange", onVisibility);

  // Touching the room hands control to the user mid-movement; letting go lets
  // the room breathe again from wherever they left it, rather than snapping
  // back to a canned pose.
  function onCinematicGrab() { if (cinematic) { director.yieldToUser(); stopCinematic(); } }
  function onCinematicRelease() {
    if (!director.isIdle() || disposed) return;
    director.settleIntoDrift();
    startCinematic();
  }
  canvasEl.addEventListener("pointerdown", onCinematicGrab);
  canvasEl.addEventListener("pointerup", onCinematicRelease);

  let raf = 0;
  let readyFired = false;

  // On-demand rendering: a still room costs nothing. Frames are requested by
  // the controls' 'change' event (which OrbitControls also fires from inside
  // update() while damping settles, so the glide still animates), by resize, by
  // every content mutation and by each model arriving.
  function renderFrame(now) {
    raf = 0;
    if (disposed) return;
    // First frame after a resume has no meaningful delta; clamp the rest so a
    // long stall advances one plausible step instead of integrating a
    // two-second gap and flinging the camera.
    const t = typeof now === "number" ? now : performance.now();
    const dt = lastFrameT ? Math.min((t - lastFrameT) / 1000, 0.05) : 1 / 60;
    lastFrameT = t;
    let again = false;
    if (cinematic) {
      again = director.update(dt) && document.visibilityState !== "hidden";
      // NOT controls.update(): OrbitControls re-derives camera.position from its
      // own spherical state, which would overwrite the director's transform
      // every frame. While directing, the look-at is applied straight.
      camera.lookAt(controls.target);
    } else {
      controls.update();
    }
    // The glass blend runs on its own clock, so a wall mid-transition keeps the
    // loop alive even when the camera itself has settled.
    if (updateWallVisibility(dt)) again = true;
    renderer.render(scene, camera);
    if (!readyFired) {
      readyFired = true;
      if (typeof onReady === "function") onReady();
    }
    if (again) requestRender();
  }
  function requestRender() {
    if (disposed || raf) return;
    raf = requestAnimationFrame(renderFrame);
  }
  controls.addEventListener("change", requestRender);

  // ---- Context loss --------------------------------------------------------
  // A dropped WebGL context is the browser doing its job, not an exotic
  // failure: live contexts are capped at roughly 16 per browser, and this
  // room holds one while the user browses saved designs. Without
  // preventDefault() on the lost event the context is never restorable — the
  // default is to give up permanently.
  function onContextLost(e) { e.preventDefault(); }
  // three's own restore listener was registered when the renderer was
  // constructed, so it runs before this one — which is what makes rebuilding
  // here safe. It re-uploads every texture and buffer that still has its
  // source data on the CPU; the PMREM environment is the one thing here it
  // cannot restore (rendered, not uploaded — see buildEnvironment()). Unlike
  // the Dizajner there is no one-shot shadow depth map to re-arm: this
  // renderer leaves shadow.autoUpdate at its default, so the depth pass
  // re-rasterises on the next frame anyway. (If damage-driven shadows are
  // ever ported over in the consolidation, re-arm them here too.) The frame
  // is drawn synchronously because rendering is damage-driven — nothing else
  // would repaint a still room — and rAF is paused in a background tab.
  function onContextRestored() {
    buildEnvironment();
    renderFrame();
  }
  canvasEl.addEventListener("webglcontextlost", onContextLost);
  canvasEl.addEventListener("webglcontextrestored", onContextRestored);

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

    // ---- Cinematic direction ----------------------------------------------
    // Declarative: the journey names a target and an intent, never a transform.
    camera: {
      focusSurface(sid, o) { startCinematic(); director.focusSurface(sid, o); },
      inspectMaterial(sid, o) { startCinematic(); director.inspectMaterial(sid, o); },
      orbitSelection(sid, o) { startCinematic(); director.orbitSelection(sid, o); },
      followGroutLine(sid, o) { startCinematic(); director.followGroutLine(sid, o); },
      focusObject(obj, o) { startCinematic(); director.focusObject(obj, o); },
      returnToOverview() { startCinematic(); director.returnToOverview(); },
      settleIntoDrift() { startCinematic(); director.settleIntoDrift(); },
      stop() { stopCinematic(); },
      // Reduced motion: short dissolve, no ceremonial orbit, no continuous
      // drift. Set on BOTH — the glass blend is engine-side and would otherwise
      // keep its full-length transition while the camera had gone still.
      setReducedMotion(v) { reducedMotion = !!v; director.setReducedMotion(v); },
      /** Reversible capture transaction — see withOpaqueSurfaces(). */
      withOpaqueSurfaces(fn) { return withOpaqueSurfaces(fn); },
      get debug() { return { ...director.debug, cinematic }; },
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
      canvasEl.removeEventListener("webglcontextlost", onContextLost);
      canvasEl.removeEventListener("webglcontextrestored", onContextRestored);
      canvasEl.removeEventListener("pointerdown", onCinematicGrab);
      canvasEl.removeEventListener("pointerup", onCinematicRelease);
      document.removeEventListener("visibilitychange", onVisibility);
      cinematic = false;
      director.dispose();
      canvasEl.style.touchAction = "pan-y";
      controls.dispose();
      recByGroup.clear();
      fixtureRecs.length = 0;
      disposeObject(scene);
      // Refcounted: the shared GLB prototypes are only actually freed when the
      // last consumer (this room, a mounted Dizajner scene, an in-flight
      // thumbnail render) lets go. See gfx3d.js.
      releasePrototypes();
      if (envRT) { envRT.dispose(); envRT = null; }
      if (pmrem) { pmrem.dispose(); pmrem = null; }
      renderer.dispose();
      // The browser caps live WebGL contexts at ~16 and this view mounts and
      // unmounts as the user moves between the room and saved designs, so the
      // context is surrendered explicitly rather than left for the GC to get
      // round to. Listeners are already off, so the lost event this fires is
      // unobserved.
      if (typeof renderer.forceContextLoss === "function") renderer.forceContextLoss();
      canvasEl.remove();
    },
  };
}
