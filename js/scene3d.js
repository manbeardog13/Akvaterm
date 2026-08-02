// ============================================================================
// scene3d.js — the Dizajner engine. Real rooms, real models, locked camera.
//
// Operator, 2026-08-02: "dizajner section. why arent the elements in those
// rooms quality objects? that's guesswork kitchen counter and windows. i don't
// want that" — and, about the 3D room: "do not try to recreate it yourself
// because your guesswork keeps on breaking."
//
// So: NO fixture geometry is authored here. Every object in a scene is a
// finished CC0 .glb from vendor/models/, placed at the scale that
// vendor/models/PROVENANCE.md MEASURED. If a scene wants something that has no
// model, the scene does without it — an honest empty wall beats an invented
// one. The only primitive geometry in this file is the room shell itself
// (floor and wall planes) and the loading placeholder, which exists purely to
// be replaced by the real model a few hundred milliseconds later.
//
// The heavy lifting — GLB load/cache, measure → scale → re-origin, the
// physical-scale tile texturing, the placement maths — is imported from
// js/gfx3d.js, which js/room3d.js imports too. One implementation, not two.
//
// ---------------------------------------------------------------------------
// COORDINATE CONVENTION — this is what data/scenes.js must author against.
//
// Everything a scene declares is in ROOM-LOCAL METRES, the same convention
// js/room3d.js uses for fixtures:
//
//     x runs 0 … widthM  from the WEST wall
//     z runs 0 … depthM  from the NORTH wall
//     y runs 0 … heightM from the FLOOR
//
// A camera therefore usually sits OUTSIDE that box (e.g. posM [4.6, 1.65, 4.2]
// in a 3 × 2.5 m room), looking back at a target inside it. The engine converts
// to its own centred scene space internally; no scene ever sees centred
// coordinates.
//
//     rotY is radians, 0 = the object's back faces NORTH (−Z), turning
//     positive the way three.js turns about +Y.
//
// ---------------------------------------------------------------------------
// SCENE DEFINITION (data/scenes.js) — read, never written, by this module:
//
//   { id, i18nKey,
//     room:   { widthM, depthM, heightM },
//     camera: { posM:[x,y,z], targetM:[x,y,z], fov },
//     surfaces: [ { id, kind:'floor'|'wall', wall:'N'|'E'|'S'|'W'|null,
//                   labelKey, defaultProductId } ],
//     fixtures: [ { model:'<file stem in vendor/models>', posM:[x,z], rotY,
//                   wall:'N'|'E'|'S'|'W'|null } ] }
//
// `model` is a FILE STEM — "kitchen-cabinet-base", not "kitchen-cabinet-base.glb"
// and not a Croatian type id. gfx3d.MODEL_SPECS is the list of legal values; a
// fixture naming anything else is SKIPPED, silently in the happy path and
// visibly in inspect().skippedFixtures. That is the rule about invented objects
// enforced in code rather than in a comment.
//
// `wall` on a fixture is a magnet: the named wall's axis is set flush (bounding
// box accounted for) and, when the fixture declares no rotY, it turns to face
// into the room. `wall` on a surface picks which plane of the shell it is.
//
// ---------------------------------------------------------------------------
// PUBLIC API — binding, from docs/DESIGNER_REBUILD.md:
//
//   mountScene(el, {sceneId, assignments, products, onReady, onSelect})
//     -> { dispose, setAssignment, setAssignments, setScene, selectSurface,
//          listSurfaces, setBareMode, snapshotTo }
//   renderSceneThumbnail(canvas2d, sceneId, assignments, products) -> Promise
//
// Additive, NOT part of the contract, safe to ignore: `inspect()` returns a
// plain-data snapshot of the built scene (no three.js objects) for tests and
// diagnostics, and `sceneId` accepts a scene OBJECT as well as an id so a test
// can drive the engine without touching data/scenes.js.
//
// ---------------------------------------------------------------------------
// INTERACTION. The camera is LOCKED — this is a designed view, not a sandbox,
// so there is no OrbitControls here and the addon is never even imported. The
// FIXTURES are draggable, with the identical raycast-to-floor drag the 3D room
// uses (bounds clamp, 5 cm grid, wall magnet, face-the-wall on drop), and the
// identical touch-action policy: the canvas is `pan-y` — a vertical swipe that
// starts on it scrolls the page — and only flips to `none` while a fixture is
// selected. MDN is explicit that touch-action latches at gesture start, which
// is exactly why dragging on touch is two-step: one tap selects, the next
// gesture drags.
//
// Rendering is damage-driven: frames are drawn on mutation, resize, model
// arrival and snapshot, never as a rAF treadmill. Snapshots render
// SYNCHRONOUSLY rather than through rAF, so they work in a background tab
// where rAF is paused.
// ============================================================================

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SCENES } from "../data/scenes.js";
import { t } from "./i18n.js";
import {
  GRID_M, IRIS, BARE_SURFACE_COLOR,
  modelSpec, makeSurfaceTexture,
  measureFootprint, rotatedExtent, limitsFor, axisSettle, reanchor,
  buildPlaceholder, loadPrototype, retainPrototypes, releasePrototypes, disposeObject,
} from "./gfx3d.js";

// i18n with an inline Croatian fallback (t() returns the key when missing), so
// the assistive-tech description is Croatian even before the dictionary lands.
const tt = (key, hr) => { const s = t(key); return s === key ? hr : s; };

const WALL_IDS = ["N", "E", "S", "W"];

// Outward normals, pointing away from the room interior. A wall the camera
// stands OUTSIDE of would occlude the view, so it is hidden.
const OUTWARD = {
  N: new THREE.Vector3(0, 0, -1),
  S: new THREE.Vector3(0, 0, 1),
  E: new THREE.Vector3(1, 0, 0),
  W: new THREE.Vector3(-1, 0, 0),
};

const WALL_HR = { N: "sjeverni zid", E: "istočni zid", S: "južni zid", W: "zapadni zid" };

// Transitional shell for a scene that has not been converted to the 3D format
// yet. It builds a ROOM (floor + walls, primitive geometry, which is allowed)
// and NO fixtures — never an invented object. data/scenes.js is expected to
// carry a real `room` block; when it does this constant is dead.
const FALLBACK_ROOM = { widthM: 3, depthM: 2.5, heightM: 2.6 };

// Default framing when a scene declares no camera: a corner three-quarter view.
const FALLBACK_CAMERA = { fov: 42 };

// A designed view must not lose its composition on a narrow phone. The authored
// fov is treated as the VERTICAL fov at this reference aspect; below it the
// vertical fov opens up so the HORIZONTAL coverage stays put, which is what the
// composition was framed on.
const REF_ASPECT = 4 / 3;
const MAX_FOV = 85;

// Numbers only, and deliberately NOT `Number(v)`: Number(null) is 0 and
// Number("") is 0, so a scene that simply omits `room` would coerce to a
// 0 × 0 × 0 room with zero-area surfaces — which then silently prices at
// 0 EUR. Caught by mounting a scene that predates the 3D format.
const clampPos = (v, fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
/** Room dimensions additionally have to be positive to describe a room. */
const clampDimM = (v, fallback) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback);
const fmtM = (n) => String(Math.round((Number(n) || 0) * 100) / 100).replace(".", ",");

function framedFov(baseFov, aspect) {
  const fov = Number.isFinite(baseFov) && baseFov > 1 ? baseFov : FALLBACK_CAMERA.fov;
  if (!Number.isFinite(aspect) || aspect <= 0 || aspect >= REF_ASPECT) return fov;
  const halfH = Math.atan(Math.tan((fov * Math.PI) / 360) * REF_ASPECT);
  return Math.min(MAX_FOV, (2 * Math.atan(Math.tan(halfH) / aspect) * 180) / Math.PI);
}

/** Accepts a scene id or a scene object; returns the definition or null. */
function resolveScene(sceneId) {
  if (sceneId && typeof sceneId === "object") return sceneId;
  return (SCENES || []).find((s) => s && s.id === sceneId) || null;
}

function roomOf(def) {
  const r = def && def.room ? def.room : null;
  return {
    widthM: clampDimM(r && r.widthM, FALLBACK_ROOM.widthM),
    depthM: clampDimM(r && r.depthM, FALLBACK_ROOM.depthM),
    heightM: clampDimM(r && r.heightM, FALLBACK_ROOM.heightM),
  };
}

/**
 * Geometry of one surface of the room shell, in centred scene space.
 * areaM2 comes straight from these two real dimensions — it is what the price
 * estimate multiplies, so it may never be an authored number.
 */
function surfaceLayout(kind, wall, dims) {
  const { widthM: w, depthM: d, heightM: h } = dims;
  if (kind === "floor") {
    return {
      sizeM: [w, d], areaM2: w * d,
      pos: [0, 0, 0], rot: [-Math.PI / 2, 0, 0],
      inward: new THREE.Vector3(0, 1, 0),
    };
  }
  switch (wall) {
    case "S": return {
      sizeM: [w, h], areaM2: w * h,
      pos: [0, h / 2, d / 2], rot: [0, Math.PI, 0], inward: new THREE.Vector3(0, 0, -1),
    };
    case "E": return {
      sizeM: [d, h], areaM2: d * h,
      pos: [w / 2, h / 2, 0], rot: [0, -Math.PI / 2, 0], inward: new THREE.Vector3(-1, 0, 0),
    };
    case "W": return {
      sizeM: [d, h], areaM2: d * h,
      pos: [-w / 2, h / 2, 0], rot: [0, Math.PI / 2, 0], inward: new THREE.Vector3(1, 0, 0),
    };
    default: return {   // "N" and anything unrecognised
      sizeM: [w, h], areaM2: w * h,
      pos: [0, h / 2, -d / 2], rot: [0, 0, 0], inward: new THREE.Vector3(0, 0, 1),
    };
  }
}

/** Wall anchors and a default facing for a fixture that names a wall. */
function wallAnchor(wall) {
  switch (wall) {
    case "N": return { ax: 0, az: -1, rotY: 0 };
    case "S": return { ax: 0, az: 1, rotY: Math.PI };
    case "W": return { ax: -1, az: 0, rotY: Math.PI / 2 };
    case "E": return { ax: 1, az: 0, rotY: -Math.PI / 2 };
    default: return { ax: 0, az: 0, rotY: 0 };
  }
}

// ============================================================================
// Stage — scene graph, lights, camera, surfaces, fixtures.
// Shared by the live mount and the offscreen thumbnail so there is one way a
// Dizajner scene is built.
// ============================================================================

function createStage(renderer, def, products) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const dims = roomOf(def);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(IRIS.paper);   // --paper #F2F2F2

  // RoomEnvironment IBL + one shadow-casting key light: the same pair the 3D
  // room uses, so a bath looks like the same bath in both places.
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

  const camera = new THREE.PerspectiveCamera(FALLBACK_CAMERA.fov, 1, 0.05, 120);

  const surfacesGroup = new THREE.Group();
  const fixturesGroup = new THREE.Group();
  scene.add(surfacesGroup);
  scene.add(fixturesGroup);

  const surfaceRecs = new Map();     // surfaceId -> rec
  const surfaceOrder = [];           // stable, for keyboard cycling
  const fixtureRecs = [];
  const recByGroup = new Map();
  const skippedFixtures = [];
  let pendingModels = 0;
  let resolveReady;
  const ready = new Promise((res) => { resolveReady = res; });
  let onModelArrived = null;         // set by the live mount
  let alive = true;

  const toSceneX = (x) => x - dims.widthM / 2;
  const toSceneZ = (z) => z - dims.depthM / 2;

  // ---- Lights and camera framing -------------------------------------------
  const { widthM: w, depthM: d, heightM: h } = dims;
  const span = Math.max(w, d);
  sun.position.set(w * 0.8, h * 2.2 + 1.5, d * 0.6);
  const sc = sun.shadow.camera;
  const ext = span * 0.9 + 1;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
  sc.near = 0.5; sc.far = h * 4 + span * 3;
  sc.updateProjectionMatrix();

  const camDef = (def && def.camera) || {};
  const posM = Array.isArray(camDef.posM) ? camDef.posM : [w + 1.6, h * 0.62, d + 1.6];
  const targetM = Array.isArray(camDef.targetM) ? camDef.targetM : [w / 2, h * 0.42, d / 2];
  const baseFov = Number.isFinite(camDef.fov) ? camDef.fov : FALLBACK_CAMERA.fov;
  const camTarget = new THREE.Vector3(
    toSceneX(clampPos(targetM[0], w / 2)),
    clampPos(targetM[1], h * 0.42),
    toSceneZ(clampPos(targetM[2], d / 2)));
  camera.position.set(
    toSceneX(clampPos(posM[0], w + 1.6)),
    clampPos(posM[1], h * 0.62),
    toSceneZ(clampPos(posM[2], d + 1.6)));
  camera.lookAt(camTarget);

  // ---- zoom on a locked camera -------------------------------------------
  // Operator instruction, 2026-08-02: the app must not zoom, EXCEPT the
  // designer and the 3D room. The camera here stays locked in position and
  // orientation — this is a framed scene, not an orbit sandbox — so "zoom" is
  // a FOV dolly rather than a moving camera: the framing tightens, the angle
  // never changes, and nothing can be knocked out of composition.
  //
  // Clamped to 0.45x-1.0x of the scene's authored FOV. Zooming OUT past the
  // authored framing is deliberately not offered: the scene was composed to
  // fill the stage, and a wider FOV only reveals the void outside the room.
  const ZOOM_MIN = 0.45, ZOOM_MAX = 1;
  let zoom = 1;

  function applyZoom(next) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    if (Math.abs(z - zoom) < 1e-4) return false;
    zoom = z;
    setAspect(lastAspect);
    return true;
  }

  let lastAspect = 1;
  function setAspect(aspect) {
    lastAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    camera.aspect = lastAspect;
    camera.fov = framedFov(baseFov, camera.aspect) * zoom;
    camera.updateProjectionMatrix();
    updateSurfaceVisibility();
  }

  // A wall the camera stands outside of would sit between the viewer and the
  // room. Locked camera, so this settles once — but setAspect re-runs it, which
  // is free and keeps the rule true if a scene is ever given a moving camera.
  const _camDir = new THREE.Vector3();
  function updateSurfaceVisibility() {
    _camDir.copy(camera.position).sub(camTarget);
    _camDir.y = 0;
    if (_camDir.lengthSq() < 1e-6) return;
    _camDir.normalize();
    for (const rec of surfaceRecs.values()) {
      if (rec.kind !== "wall") continue;
      rec.mesh.visible = _camDir.dot(OUTWARD[rec.wall] || OUTWARD.N) <= 0.35;
    }
  }

  // ---- Surfaces ------------------------------------------------------------
  // Only the surfaces the scene DECLARES get a plane. An undeclared wall is not
  // drawn at all, which is both the honest reading of the scene definition and
  // the reason a locked corner view never has a wall in front of it.
  const rawSurfaces = Array.isArray(def && def.surfaces) ? def.surfaces : [];
  let autoWall = 0;
  for (const s of rawSurfaces) {
    if (!s || !s.id || surfaceRecs.has(s.id)) continue;
    const kind = s.kind === "floor" ? "floor" : "wall";
    // A scene predating the 3D format has no `wall`; assign N, E, S, W in
    // declaration order so it still builds something coherent.
    const wall = kind === "wall"
      ? (WALL_IDS.includes(s.wall) ? s.wall : WALL_IDS[autoWall++ % WALL_IDS.length])
      : null;
    const L = surfaceLayout(kind, wall, dims);
    const mat = new THREE.MeshStandardMaterial({
      color: kind === "floor" ? BARE_SURFACE_COLOR.floor : BARE_SURFACE_COLOR.wall,
      roughness: 0.9, metalness: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(L.sizeM[0], L.sizeM[1]), mat);
    mesh.position.set(...L.pos);
    mesh.rotation.set(...L.rot);
    mesh.receiveShadow = true;
    surfacesGroup.add(mesh);
    const rec = {
      id: s.id, kind, wall,
      labelKey: s.labelKey || s.i18nKey || null,
      defaultProductId: s.defaultProductId || null,
      mesh, sizeM: L.sizeM, areaM2: L.areaM2, inward: L.inward,
    };
    surfaceRecs.set(s.id, rec);
    surfaceOrder.push(s.id);
  }

  // ---- Fixtures ------------------------------------------------------------
  function settle(rec, rawX, rawZ) {
    const L = limitsFor(rec.footprint, rec.rotY, dims);
    const a = axisSettle(rawX, L.loX, L.hiX);
    const b = axisSettle(rawZ, L.loZ, L.hiZ);
    rec.x = a.v; rec.ax = a.anchor;
    rec.z = b.v; rec.az = b.anchor;
  }

  function applyRec(rec) {
    rec.group.position.set(toSceneX(rec.x), 0, toSceneZ(rec.z));
    rec.group.rotation.y = rec.rotY;
  }

  function buildFixture(f, index) {
    const spec = modelSpec(f && f.model);
    if (!spec) {
      // No model, no object. This is the operator's rule, enforced.
      if (f && f.model) skippedFixtures.push(String(f.model));
      return null;
    }
    const group = new THREE.Group();
    const holder = new THREE.Group();
    holder.position.y = spec.mountY || 0;
    group.add(holder);
    holder.add(buildPlaceholder(spec.sizeM));

    const anchor = wallAnchor(WALL_IDS.includes(f.wall) ? f.wall : null);
    const pos = Array.isArray(f.posM) ? f.posM : [];
    const rec = {
      i: index, model: f.model, group, holder,
      footprint: measureFootprint(group),
      x: clampPos(pos[0], dims.widthM / 2),
      z: clampPos(pos[1], dims.depthM / 2),
      rotY: Number.isFinite(Number(f.rotY)) ? Number(f.rotY) : anchor.rotY,
      ax: 0, az: 0,
    };
    settle(rec, rec.x, rec.z);
    // A declared wall wins over whatever the magnet decided from the raw
    // position: the scene said "against the north wall", so it is flush against
    // the north wall even if the author's z was 8 cm out.
    if (anchor.ax || anchor.az) {
      const L = limitsFor(rec.footprint, rec.rotY, dims);
      if (anchor.ax) { rec.ax = anchor.ax; rec.x = reanchor(rec.x, anchor.ax, L.loX, L.hiX); }
      if (anchor.az) { rec.az = anchor.az; rec.z = reanchor(rec.z, anchor.az, L.loZ, L.hiZ); }
    }
    applyRec(rec);
    fixturesGroup.add(group);
    recByGroup.set(group, rec);
    queueModel(rec, spec);
    return rec;
  }

  /** Placeholder → real model. Guarded by `alive` so a load started for a scene
   *  that has since been swapped can never land in the current one. */
  function queueModel(rec, spec) {
    pendingModels++;
    loadPrototype(spec, maxAniso).then((proto) => {
      if (!alive || !recByGroup.has(rec.group)) return;
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
      if (typeof onModelArrived === "function") onModelArrived(rec);
    }).catch(() => {
      // Offline or a missing file: the massing block stays, and it still drags
      // and clamps exactly like the model would. Nothing is logged in a happy
      // path and nothing is retried in a loop.
    }).finally(() => {
      pendingModels--;
      if (pendingModels === 0) resolveReady();
    });
  }

  const rawFixtures = Array.isArray(def && def.fixtures) ? def.fixtures : [];
  rawFixtures.forEach((f, i) => {
    const rec = buildFixture(f, i);
    if (rec) fixtureRecs.push(rec);
  });
  if (pendingModels === 0) resolveReady();

  updateSurfaceVisibility();

  // ---- Texturing -----------------------------------------------------------
  const assignments = {};   // surfaceId -> assignment object (kept through bare mode)
  let bare = false;

  function paintBare(rec) {
    const mat = rec.mesh.material;
    if (mat.map) { mat.map.dispose(); mat.map = null; }
    mat.color.set(rec.kind === "floor" ? BARE_SURFACE_COLOR.floor : BARE_SURFACE_COLOR.wall);
    mat.roughness = 0.9;
    mat.needsUpdate = true;
  }

  function paintSurface(sid) {
    const rec = surfaceRecs.get(sid);
    if (!rec) return false;
    const a = assignments[sid];
    const product = a && a.productId
      ? (products || []).find((p) => p && p.id === a.productId)
      : null;
    if (bare || !product) { paintBare(rec); return true; }
    const { texture } = makeSurfaceTexture(product, {
      pattern: a.pattern,
      groutColorId: a.groutColorId,
      groutColorHex: a.groutColorHex,
      groutWidthMm: a.groutWidthMm,
      rotationDeg: a.rotationDeg,
    }, rec.sizeM, maxAniso);
    const mat = rec.mesh.material;
    if (mat.map) mat.map.dispose();
    mat.map = texture;
    mat.color.set(0xffffff);
    mat.roughness = product.glossy ? 0.28 : 0.8;
    mat.needsUpdate = true;
    return true;
  }

  function setAssignment(sid, assignment) {
    if (!surfaceRecs.has(sid)) return false;
    assignments[sid] = assignment && assignment.productId ? { ...assignment } : null;
    return paintSurface(sid);
  }

  function setAssignments(obj) {
    for (const sid of surfaceRecs.keys()) {
      const a = obj ? obj[sid] : null;
      assignments[sid] = a && a.productId ? { ...a } : null;
      paintSurface(sid);
    }
  }

  function setBare(next) {
    const b = !!next;
    if (b === bare) return false;
    bare = b;
    for (const sid of surfaceRecs.keys()) paintSurface(sid);
    return true;
  }

  function dispose() {
    alive = false;
    recByGroup.clear();
    fixtureRecs.length = 0;
    surfaceRecs.clear();
    surfaceOrder.length = 0;
    // force=false: the cloned GLB meshes are flagged `shared` and belong to the
    // prototype cache, which is refcounted and freed by releasePrototypes().
    // Forcing here would tear geometry out from under any other live consumer.
    disposeObject(scene, false);
    scene.environment = null;
    envRT.dispose();
    pmrem.dispose();
  }

  return {
    scene, camera, camTarget, dims, def,
    surfaceRecs, surfaceOrder, fixtureRecs, recByGroup, fixturesGroup,
    skippedFixtures, ready, maxAniso,
    assignments,
    isBare: () => bare,
    setAspect, setAssignment, setAssignments, setBare, paintSurface,
    settle, applyRec,
    setOnModelArrived: (fn) => { onModelArrived = fn; },
    dispose,
  };
}

// ============================================================================
// mountScene — the live, interactive, locked-camera view
// ============================================================================

export async function mountScene(el, {
  sceneId,
  assignments = {},
  products = [],
  onReady,
  onSelect,
} = {}) {
  retainPrototypes();
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // + shadow.radius = soft edges
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const canvasEl = renderer.domElement;
  canvasEl.style.display = "block";
  canvasEl.style.width = "100%";
  canvasEl.style.height = "100%";
  canvasEl.style.touchAction = "pan-y";
  canvasEl.style.outlineOffset = "-3px";
  canvasEl.setAttribute("role", "img");
  canvasEl.setAttribute("tabindex", "0");
  canvasEl.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown R Escape");
  el.appendChild(canvasEl);

  let stage = createStage(renderer, resolveScene(sceneId), products);
  let currentSceneId = (stage.def && stage.def.id) || sceneId || null;

  // ---- Selection affordances ----------------------------------------------
  // Two of them, and they are different things: a SURFACE outline (what the
  // product drawer is about to re-tile) and a FIXTURE footprint (what a drag
  // will move). Both are added to the renderer's scene, never to the groups
  // that get raycast or rebuilt.
  // EDGE ONLY — never a wash over the tiles. Operator instruction, 2026-08-02:
  // selecting a surface used to lay a translucent teal plane over the whole of
  // it, which tinted every tile underneath. That defeats the one thing the
  // designer is for: you pick a surface, then scroll the drawer comparing tile
  // COLOURS, and the colours were being shifted by the very act of selecting.
  // So the affordance is now a band hugging the border and nothing else.
  //
  // The band is rebuilt in real metres on every selection rather than scaled
  // from a unit square, because surfSel is scaled non-uniformly (a 3.6 x 2.6 m
  // wall) and a scaled ring would come out thicker on one axis than the other.
  // Rebuilding costs 8 vertices on a click — cheaper than the tint it replaces.
  const surfSel = new THREE.Group();
  surfSel.visible = false;
  const surfBand = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: IRIS.amber500, transparent: true, opacity: 0.95,
      depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }));
  surfBand.renderOrder = 999;
  surfBand.raycast = () => {};
  surfSel.add(surfBand);

  const SURF_BAND_M = 0.045;   // ~4.5 cm of border, readable without crowding

  /** Rebuild the border band as a rectangular ring w x h metres, centred on 0. */
  function buildSurfaceBand(w, h) {
    const bw = Math.min(SURF_BAND_M, w / 6, h / 6);   // never eat a small surface
    const ox = w / 2, oy = h / 2, ix = ox - bw, iy = oy - bw;
    // Four quads (top, bottom, left, right) as two triangles each.
    const quad = (ax, ay, bx, by, cx, cy, dx, dy) => [
      ax, ay, 0, bx, by, 0, cx, cy, 0,
      ax, ay, 0, cx, cy, 0, dx, dy, 0,
    ];
    const v = [
      ...quad(-ox, oy, ox, oy, ox, iy, -ox, iy),        // top
      ...quad(-ox, -iy, ox, -iy, ox, -oy, -ox, -oy),    // bottom
      ...quad(-ox, iy, -ix, iy, -ix, -iy, -ox, -iy),    // left
      ...quad(ix, iy, ox, iy, ox, -iy, ix, -iy),        // right
    ];
    surfBand.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    surfBand.geometry = g;
  }

  const fixSel = new THREE.Group();
  fixSel.visible = false;
  const fixQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: IRIS.teal600, transparent: true, opacity: 0.3, depthWrite: false,
    }));
  fixQuad.rotation.x = -Math.PI / 2;
  fixQuad.position.y = 0.003;
  fixQuad.raycast = () => {};
  fixSel.add(fixQuad);
  const fixLoop = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0.004, -0.5), new THREE.Vector3(0.5, 0.004, -0.5),
      new THREE.Vector3(0.5, 0.004, 0.5), new THREE.Vector3(-0.5, 0.004, 0.5),
    ]),
    new THREE.LineBasicMaterial({ color: IRIS.amber500, depthTest: false }));
  fixLoop.renderOrder = 999;
  fixLoop.raycast = () => {};
  fixSel.add(fixLoop);

  // The overlays outlive any single stage, so they are detached BEFORE a stage
  // is torn down. stage.dispose() walks its whole scene graph and frees the
  // geometry and materials it finds; leaving the overlays parented there would
  // dispose them on every setScene() and then re-add the freed objects, which
  // three papers over by silently re-uploading — a resource churn that only
  // shows up as a slow leak, not as an error.
  function attachOverlays() {
    stage.scene.add(surfSel);
    stage.scene.add(fixSel);
  }
  function detachOverlays() {
    stage.scene.remove(surfSel);
    stage.scene.remove(fixSel);
  }
  attachOverlays();

  let selectedSurface = null;   // surfaceId
  let selectedFixture = null;   // fixture rec

  function syncSurfaceOutline() {
    const rec = selectedSurface ? stage.surfaceRecs.get(selectedSurface) : null;
    if (!rec || !rec.mesh.visible) { surfSel.visible = false; return; }
    surfSel.position.copy(rec.mesh.position).addScaledVector(rec.inward, 0.006);
    surfSel.rotation.copy(rec.mesh.rotation);
    // Scale stays 1: the band carries its real metre dimensions, so its width
    // is even on all four sides regardless of the surface's aspect ratio.
    surfSel.scale.set(1, 1, 1);
    buildSurfaceBand(rec.sizeM[0], rec.sizeM[1]);
    surfSel.visible = true;
  }

  function syncFixtureOutline() {
    if (!selectedFixture) { fixSel.visible = false; return; }
    const e = rotatedExtent(selectedFixture.footprint, selectedFixture.rotY);
    fixSel.scale.set(Math.max(0.05, e.maxX - e.minX), 1, Math.max(0.05, e.maxZ - e.minZ));
    fixSel.position.set(
      selectedFixture.x + (e.minX + e.maxX) / 2 - stage.dims.widthM / 2,
      0,
      selectedFixture.z + (e.minZ + e.maxZ) / 2 - stage.dims.depthM / 2);
    fixSel.visible = true;
  }

  function syncTouchAction() {
    canvasEl.style.touchAction = selectedFixture ? "none" : "pan-y";
  }

  // ---- Accessible name -----------------------------------------------------
  function updateAriaLabel() {
    const tiled = [...stage.surfaceRecs.values()]
      .filter((r) => stage.assignments[r.id])
      .map((r) => surfaceLabel(r).toLocaleLowerCase("hr-HR"));
    const parts = [
      tt("dizajner.a11y.canvas", "3D prikaz scene"),
      `${fmtM(stage.dims.widthM)} × ${fmtM(stage.dims.depthM)} × ${fmtM(stage.dims.heightM)} m`,
      tiled.length
        ? `${tt("dizajner.a11y.tiled", "Obložene površine")}: ${tiled.join(", ")}`
        : tt("dizajner.a11y.untiled", "Nijedna površina još nije obložena"),
    ];
    if (selectedFixture) {
      parts.push(tt("dizajner.a11y.keysMove",
        "Strelicama pomičite opremu, tipkom R okrenite, Escape poništava odabir"));
    } else {
      const cur = selectedSurface ? stage.surfaceRecs.get(selectedSurface) : null;
      if (cur) parts.push(`${tt("dizajner.a11y.selected", "Odabrano")}: ${surfaceLabel(cur)}`);
      parts.push(tt("dizajner.a11y.keys",
        "Strelicama birate površinu, Escape poništava odabir"));
    }
    canvasEl.setAttribute("aria-label", parts.join(". ") + ".");
  }

  function surfaceLabel(rec) {
    const hr = rec.kind === "floor" ? "pod" : (WALL_HR[rec.wall] || "zid");
    return rec.labelKey ? tt(rec.labelKey, hr) : hr;
  }

  // ---- Rendering -----------------------------------------------------------
  let raf = 0;
  let readyFired = false;

  function renderNow() {
    if (disposed) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    renderer.render(stage.scene, stage.camera);
  }

  function renderFrame() {
    raf = 0;
    if (disposed) return;
    renderer.render(stage.scene, stage.camera);
  }

  function requestRender() {
    if (disposed || raf) return;
    raf = requestAnimationFrame(renderFrame);
  }

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    stage.setAspect(w / h);
    syncSurfaceOutline();
    requestRender();
  }

  // ---- Picking and dragging ------------------------------------------------
  const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);   // y = 0
  const _ndc = new THREE.Vector2();
  const _ray = new THREE.Raycaster();
  const _hit = new THREE.Vector3();
  let dragId = null;
  let swallowId = null;
  let dragMoved = false;
  const grab = { dx: 0, dz: 0, ax: 0, az: 0 };

  function toNDC(e) {
    const r = canvasEl.getBoundingClientRect();
    return _ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  function pickFixture() {
    const hits = _ray.intersectObjects(stage.fixturesGroup.children, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && o.parent !== stage.fixturesGroup) o = o.parent;
    return o ? stage.recByGroup.get(o) || null : null;
  }

  function pickSurface() {
    const meshes = [...stage.surfaceRecs.values()].filter((r) => r.mesh.visible).map((r) => r.mesh);
    const hits = _ray.intersectObjects(meshes, false);
    if (!hits.length) return null;
    for (const rec of stage.surfaceRecs.values()) if (rec.mesh === hits[0].object) return rec.id;
    return null;
  }

  function setSelectedFixture(rec) {
    if (selectedFixture === rec) return;
    selectedFixture = rec || null;
    syncTouchAction();
    syncFixtureOutline();
    updateAriaLabel();
    canvasEl.dispatchEvent(new CustomEvent("akv:scene-fixture-selected", {
      bubbles: true,
      detail: selectedFixture ? { index: selectedFixture.i, model: selectedFixture.model } : null,
    }));
    requestRender();
  }

  function applySurfaceSelection(sid, fire) {
    selectedSurface = sid && stage.surfaceRecs.has(sid) ? sid : null;
    syncSurfaceOutline();
    updateAriaLabel();
    requestRender();
    if (fire && typeof onSelect === "function") onSelect(selectedSurface);
  }

  function onPointerDown(e) {
    if (disposed || !e.isPrimary) return;
    try { canvasEl.focus({ preventScroll: true }); } catch { canvasEl.focus(); }
    _ray.setFromCamera(toNDC(e), stage.camera);

    const rec = pickFixture();
    if (!rec) {
      setSelectedFixture(null);
      applySurfaceSelection(pickSurface(), true);
      return;
    }

    const wasSelected = selectedFixture === rec;
    setSelectedFixture(rec);

    // Touch is two-step by necessity: touch-action was still `pan-y` when this
    // gesture started, so the browser owns any vertical movement and will fire
    // pointercancel. The tap that selects therefore only selects.
    if (e.pointerType === "touch" && !wasSelected) { swallowId = e.pointerId; return; }

    // Ray parallel to the floor, or the floor behind the camera: abort. A stale
    // _hit would teleport the fixture.
    if (!_ray.ray.intersectPlane(FLOOR, _hit)) return;

    dragId = e.pointerId;
    dragMoved = false;
    grab.dx = rec.x - (_hit.x + stage.dims.widthM / 2);
    grab.dz = rec.z - (_hit.z + stage.dims.depthM / 2);
    grab.ax = rec.ax;
    grab.az = rec.az;
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* already released */ }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (disposed || e.pointerId !== dragId || !selectedFixture) return;
    _ray.setFromCamera(toNDC(e), stage.camera);
    if (!_ray.ray.intersectPlane(FLOOR, _hit)) return;   // mandatory null guard
    stage.settle(selectedFixture,
      _hit.x + stage.dims.widthM / 2 + grab.dx,
      _hit.z + stage.dims.depthM / 2 + grab.dz);
    stage.applyRec(selectedFixture);
    syncFixtureOutline();
    dragMoved = true;
    requestRender();
  }

  function onPointerUp(e) {
    if (e.pointerId === swallowId) { swallowId = null; return; }
    if (e.pointerId !== dragId) return;
    dragId = null;
    try { canvasEl.releasePointerCapture(e.pointerId); } catch { /* not capturing */ }
    if (!selectedFixture || !dragMoved) { dragMoved = false; return; }
    dragMoved = false;
    faceNewWall(selectedFixture);
    updateAriaLabel();
    emitMoved(selectedFixture);
    requestRender();
  }

  /** "Prisloni uza zid": a fixture that has just BECOME flush with a wall turns
   *  to face into the room. Only on a NEWLY entered snap and only on drop. */
  function faceNewWall(rec) {
    let rotY = null;
    if (rec.az !== 0 && rec.az !== grab.az) rotY = rec.az === -1 ? 0 : Math.PI;
    else if (rec.ax !== 0 && rec.ax !== grab.ax) rotY = rec.ax === -1 ? Math.PI / 2 : -Math.PI / 2;
    if (rotY === null || Math.abs(rotY - rec.rotY) < 1e-6) return;
    rec.rotY = rotY;
    resettleAfterRotate(rec);
    stage.applyRec(rec);
    syncFixtureOutline();
  }

  /** Rotating changes the footprint's world extent, so the flush position on
   *  every wall moves. An ANCHORED axis is re-derived flush against the wall it
   *  is already anchored to; only a FREE axis goes through the magnet, where it
   *  may legitimately acquire a new anchor. Using settle() for both would drop
   *  the anchor and strand the fixture. */
  function resettleAfterRotate(rec) {
    const L = limitsFor(rec.footprint, rec.rotY, stage.dims);
    if (rec.ax !== 0) rec.x = reanchor(rec.x, rec.ax, L.loX, L.hiX);
    else { const a = axisSettle(rec.x, L.loX, L.hiX); rec.x = a.v; rec.ax = a.anchor; }
    if (rec.az !== 0) rec.z = reanchor(rec.z, rec.az, L.loZ, L.hiZ);
    else { const b = axisSettle(rec.z, L.loZ, L.hiZ); rec.z = b.v; rec.az = b.anchor; }
  }

  function emitMoved(rec) {
    canvasEl.dispatchEvent(new CustomEvent("akv:scene-fixture-moved", {
      bubbles: true,
      detail: { index: rec.i, model: rec.model, x: rec.x, z: rec.z, rotY: rec.rotY },
    }));
  }

  function nudgeSelected(dx, dz, step) {
    const rec = selectedFixture;
    if (!rec) return;
    stage.settle(rec, rec.x + dx * step, rec.z + dz * step);
    stage.applyRec(rec);
    syncFixtureOutline();
    updateAriaLabel();
    emitMoved(rec);
    requestRender();
  }

  function cycleSurface(delta) {
    const order = stage.surfaceOrder;
    if (!order.length) return;
    const i = selectedSurface ? order.indexOf(selectedSurface) : -1;
    const next = order[((i + delta) % order.length + order.length) % order.length];
    applySurfaceSelection(next, true);
  }

  function onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = e.shiftKey ? GRID_M * 4 : GRID_M;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft": selectedFixture ? nudgeSelected(-1, 0, step) : cycleSurface(-1); break;
      case "ArrowRight": selectedFixture ? nudgeSelected(1, 0, step) : cycleSurface(1); break;
      case "ArrowUp": selectedFixture ? nudgeSelected(0, -1, step) : cycleSurface(-1); break;
      case "ArrowDown": selectedFixture ? nudgeSelected(0, 1, step) : cycleSurface(1); break;
      case "r": case "R": {
        const rec = selectedFixture;
        if (!rec) { handled = false; break; }
        const next = rec.rotY + (e.shiftKey ? -Math.PI / 2 : Math.PI / 2);
        rec.rotY = Math.atan2(Math.sin(next), Math.cos(next));   // normalise to (−π, π]
        resettleAfterRotate(rec);
        stage.applyRec(rec);
        syncFixtureOutline();
        updateAriaLabel();
        emitMoved(rec);
        requestRender();
        break;
      }
      case "Escape":
        if (selectedFixture) setSelectedFixture(null);
        else applySurfaceSelection(null, true);
        break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  // ---- zoom input ----------------------------------------------------------
  // Wheel/trackpad on desktop, two-finger pinch on touch. The page itself can
  // no longer zoom (viewport user-scalable=no + touch-action:pan-y), so these
  // gestures are free to mean "camera" here without fighting the browser.
  //
  // preventDefault on wheel is why the listener is explicitly NOT passive: the
  // wheel would otherwise scroll the page under the stage while the camera also
  // dollied, which is exactly the "swimming" the operator asked to remove.
  function onWheel(e) {
    e.preventDefault();
    if (applyZoom(zoom * (e.deltaY > 0 ? 1.08 : 1 / 1.08))) requestRender();
  }
  canvasEl.addEventListener("wheel", onWheel, { passive: false });

  // Pinch: tracked from raw pointer events rather than a gesture API, because
  // touch-action:pan-y already forbids the browser's own pinch, so the two
  // pointers arrive here intact. A pinch is only recognised while exactly two
  // are down, and it never starts a fixture drag — onPointerDown bails out.
  const zoomPointers = new Map();
  let pinchBase = 0, pinchZoomBase = 1;
  function pinchDistance() {
    const [a, b] = [...zoomPointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function onZoomPointerDown(e) {
    zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zoomPointers.size === 2) { pinchBase = pinchDistance(); pinchZoomBase = zoom; }
  }
  function onZoomPointerMove(e) {
    if (!zoomPointers.has(e.pointerId)) return;
    zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zoomPointers.size !== 2 || pinchBase <= 0) return;
    // A pinch never fights a fixture drag: if one finger already grabbed a
    // model, that gesture owns the interaction until it ends.
    if (dragId !== null) return;
    e.preventDefault();
    // Fingers apart -> larger distance -> smaller FOV -> closer view.
    if (applyZoom(pinchZoomBase * (pinchBase / pinchDistance()))) requestRender();
  }
  function onZoomPointerUp(e) {
    zoomPointers.delete(e.pointerId);
    if (zoomPointers.size < 2) pinchBase = 0;
  }
  canvasEl.addEventListener("pointerdown", onZoomPointerDown);
  canvasEl.addEventListener("pointermove", onZoomPointerMove);
  canvasEl.addEventListener("pointerup", onZoomPointerUp);
  canvasEl.addEventListener("pointercancel", onZoomPointerUp);
  canvasEl.addEventListener("lostpointercapture", onZoomPointerUp);

  canvasEl.addEventListener("pointerdown", onPointerDown);
  canvasEl.addEventListener("pointermove", onPointerMove);
  canvasEl.addEventListener("pointerup", onPointerUp);
  canvasEl.addEventListener("pointercancel", onPointerUp);
  canvasEl.addEventListener("lostpointercapture", onPointerUp);
  canvasEl.addEventListener("keydown", onKeyDown);

  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // ---- Wire the stage up ---------------------------------------------------
  function wireStage(initialAssignments) {
    stage.setOnModelArrived((rec) => {
      if (selectedFixture === rec) syncFixtureOutline();
      requestRender();
    });
    stage.setAssignments(initialAssignments || {});
    resize();
    if (!el.clientWidth || !el.clientHeight) stage.setAspect(1);
    updateAriaLabel();
    renderNow();          // synchronous: works with rAF paused (background tab)
  }
  wireStage(assignments);

  // onReady means "the frame the user will actually judge has painted", so it
  // waits for the models rather than for the placeholder frame — and it renders
  // synchronously first, so a background tab still fires it.
  stage.ready.then(() => {
    if (disposed || readyFired) return;
    readyFired = true;
    renderNow();
    if (typeof onReady === "function") onReady();
  });

  // ---- Public API ----------------------------------------------------------
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      canvasEl.removeEventListener("pointerdown", onPointerDown);
      canvasEl.removeEventListener("pointermove", onPointerMove);
      canvasEl.removeEventListener("pointerup", onPointerUp);
      canvasEl.removeEventListener("pointercancel", onPointerUp);
      canvasEl.removeEventListener("lostpointercapture", onPointerUp);
      canvasEl.removeEventListener("keydown", onKeyDown);
      // Zoom listeners — same lifetime as the drag ones, or a disposed stage
      // keeps a wheel handler alive and leaks the whole closure with it.
      canvasEl.removeEventListener("wheel", onWheel);
      canvasEl.removeEventListener("pointerdown", onZoomPointerDown);
      canvasEl.removeEventListener("pointermove", onZoomPointerMove);
      canvasEl.removeEventListener("pointerup", onZoomPointerUp);
      canvasEl.removeEventListener("pointercancel", onZoomPointerUp);
      canvasEl.removeEventListener("lostpointercapture", onZoomPointerUp);
      zoomPointers.clear();
      canvasEl.style.touchAction = "pan-y";
      selectedFixture = null;
      selectedSurface = null;
      detachOverlays();
      stage.dispose();
      disposeObject(surfSel, true);
      disposeObject(fixSel, true);
      releasePrototypes();
      renderer.dispose();
      // The browser caps live WebGL contexts at ~16 and the Dizajner mounts,
      // unmounts and re-mounts as the user moves between scenes and saved
      // designs, so the context is surrendered explicitly rather than left for
      // the GC to get round to.
      if (typeof renderer.forceContextLoss === "function") renderer.forceContextLoss();
      canvasEl.remove();
    },

    setAssignment(surfaceId, assignment) {
      if (disposed) return;
      if (stage.setAssignment(surfaceId, assignment)) { updateAriaLabel(); requestRender(); }
    },

    setAssignments(obj) {
      if (disposed) return;
      stage.setAssignments(obj || {});
      updateAriaLabel();
      requestRender();
    },

    setScene(nextSceneId) {
      if (disposed) return;
      const def = resolveScene(nextSceneId);
      if (!def) return;
      const keptAssignments = { ...stage.assignments };
      const wasBare = stage.isBare();
      detachOverlays();
      stage.dispose();
      selectedFixture = null;
      selectedSurface = null;
      stage = createStage(renderer, def, products);
      currentSceneId = def.id || nextSceneId;
      attachOverlays();
      surfSel.visible = false;
      fixSel.visible = false;
      if (wasBare) stage.setBare(true);
      // Surface ids are per scene, so only ids the NEW scene declares survive —
      // which is what a caller restoring a shared design wants. Handed to
      // wireStage() rather than re-applied after it, so a swap builds each
      // surface's texture once instead of twice.
      wireStage(keptAssignments);
      syncTouchAction();
      updateAriaLabel();
      renderNow();
    },

    selectSurface(surfaceId) {
      if (disposed) return;
      // Programmatic selection deliberately does NOT fire onSelect: the caller
      // already knows, and echoing it back is how a view ends up in a loop.
      setSelectedFixture(null);
      applySurfaceSelection(surfaceId, false);
    },

    listSurfaces() {
      return [...stage.surfaceRecs.values()].map((r) => ({
        id: r.id,
        kind: r.kind,
        labelKey: r.labelKey,
        areaM2: Math.round(r.areaM2 * 1000) / 1000,
      }));
    },

    setBareMode(on) {
      if (disposed) return;
      if (stage.setBare(on)) { updateAriaLabel(); renderNow(); }
    },

    snapshotTo(canvas2d) {
      if (disposed || !canvas2d) return;
      const cw = canvas2d.width | 0, ch = canvas2d.height | 0;
      if (!cw || !ch) return;
      const ctx = canvas2d.getContext("2d");
      if (!ctx) return;
      const prevPR = renderer.getPixelRatio();
      const prevSize = renderer.getSize(new THREE.Vector2());
      // Render at exactly the target's pixel dimensions so the copy is 1:1 and
      // the framing matches the target's aspect instead of being stretched.
      renderer.setPixelRatio(1);
      renderer.setSize(cw, ch, false);
      stage.setAspect(cw / ch);
      syncSurfaceOutline();
      // render → drawImage in ONE task. The drawing buffer is cleared before the
      // next composite, not immediately, so a synchronous copy is valid and
      // preserveDrawingBuffer (which costs memory on every frame) is not needed.
      renderer.render(stage.scene, stage.camera);
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(renderer.domElement, 0, 0, cw, ch);
      renderer.setPixelRatio(prevPR);
      renderer.setSize(prevSize.x, prevSize.y, false);
      if (prevSize.x && prevSize.y) stage.setAspect(prevSize.x / prevSize.y);
      syncSurfaceOutline();
      renderNow();
    },

    // ---- Additive, not part of the binding contract -----------------------
    /** Plain-data snapshot of what is actually in the scene graph. No three.js
     *  objects cross this boundary — it is for tests, diagnostics and honest
     *  reporting, and it is the only way to assert "that cabinet is a real GLB
     *  at 0.60 m" without reaching into module internals. */
    inspect() {
      const box = new THREE.Box3();
      stage.scene.updateMatrixWorld(true);
      return {
        sceneId: currentSceneId,
        room: { ...stage.dims },
        bare: stage.isBare(),
        camera: {
          posM: [
            stage.camera.position.x + stage.dims.widthM / 2,
            stage.camera.position.y,
            stage.camera.position.z + stage.dims.depthM / 2,
          ],
          fov: stage.camera.fov,
          aspect: stage.camera.aspect,
        },
        skippedFixtures: stage.skippedFixtures.slice(),
        surfaces: [...stage.surfaceRecs.values()].map((r) => ({
          id: r.id, kind: r.kind, wall: r.wall, labelKey: r.labelKey,
          areaM2: r.areaM2, sizeM: r.sizeM.slice(), visible: r.mesh.visible,
          hasMap: !!r.mesh.material.map,
          repeat: r.mesh.material.map
            ? [r.mesh.material.map.repeat.x, r.mesh.material.map.repeat.y] : null,
          textureRotation: r.mesh.material.map ? r.mesh.material.map.rotation : null,
          colorSpace: r.mesh.material.map ? r.mesh.material.map.colorSpace : null,
          anisotropy: r.mesh.material.map ? r.mesh.material.map.anisotropy : null,
        })),
        fixtures: stage.fixtureRecs.map((rec) => {
          box.setFromObject(rec.group);
          let placeholder = false, meshes = 0;
          rec.group.traverse((o) => {
            if (o.userData && o.userData.placeholder) placeholder = true;
            if (o.isMesh) meshes++;
          });
          return {
            model: rec.model, index: rec.i,
            posM: [rec.x, rec.z], rotY: rec.rotY, ax: rec.ax, az: rec.az,
            mountY: rec.holder.position.y,
            worldPos: [rec.group.position.x, rec.group.position.y, rec.group.position.z],
            boxMin: [box.min.x, box.min.y, box.min.z],
            boxMax: [box.max.x, box.max.y, box.max.z],
            sizeM: [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
            fromModel: !placeholder, meshCount: meshes,
          };
        }),
        selectedSurface,
        selectedFixture: selectedFixture ? selectedFixture.i : null,
        touchAction: canvasEl.style.touchAction,
        rafPending: raf !== 0,
        drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
      };
    },
  };
}

// ============================================================================
// renderSceneThumbnail — one-shot offscreen still
// ============================================================================
// Called from list views (saved designs, the scene strip). Browsers cap live
// WebGL contexts at around 16, so leaking one per saved design would break the
// app after a dozen thumbnails: this creates ONE renderer, uses it, and hands
// the context back with dispose() + forceContextLoss() in a finally block.
//
// Calls are serialised through a single promise chain, so N thumbnails cost one
// live context at a time rather than N, and an in-flight thumbnail can never
// race a scene teardown for the shared prototypes (both hold a refcount).

let thumbQueue = Promise.resolve();

export function renderSceneThumbnail(canvas2d, sceneId, assignments, products) {
  const run = async () => {
    // Yield to the event loop between queued stills. Each one is a fresh WebGL
    // context and costs ~100 ms of main thread; back-to-back they would be one
    // unbroken long task and a saved-designs list would feel frozen while it
    // filled in. This does not make a single thumbnail faster — it makes the
    // list interactive while they arrive.
    await new Promise((r) => setTimeout(r, 0));
    return renderThumbnailNow(canvas2d, sceneId, assignments, products);
  };
  thumbQueue = thumbQueue.then(run, run);
  return thumbQueue;
}

async function renderThumbnailNow(canvas2d, sceneId, assignments, products) {
  const def = resolveScene(sceneId);
  const cw = canvas2d ? (canvas2d.width | 0) : 0;
  const ch = canvas2d ? (canvas2d.height | 0) : 0;
  if (!def || !cw || !ch) return;
  const ctx = canvas2d.getContext("2d");
  if (!ctx) return;

  retainPrototypes();
  let renderer = null;
  let stage = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(cw, ch, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    stage = createStage(renderer, def, products || []);
    stage.setAspect(cw / ch);
    stage.setAssignments(assignments || {});
    await stage.ready;                     // placeholders would be a lie in a still
    renderer.render(stage.scene, stage.camera);
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(renderer.domElement, 0, 0, cw, ch);
  } catch {
    // A thumbnail is decoration. A failed one leaves the canvas as it was
    // rather than taking the list view down with it.
  } finally {
    if (stage) stage.dispose();
    releasePrototypes();
    if (renderer) {
      renderer.dispose();
      if (typeof renderer.forceContextLoss === "function") renderer.forceContextLoss();
    }
  }
}
