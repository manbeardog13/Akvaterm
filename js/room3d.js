// ============================================================================
// room3d.js — Stage-2 parametric 3D room (lazy module, three.js via import map).
// Owns: scene/camera/renderer lifecycle, the parametric room (floor + 4 walls,
// near walls auto-hidden by camera azimuth so the room reads open), fixture
// primitives (kada, wc, umivaonik, radijator, klima) and per-surface tiling
// through the shared pattern cell (texture.js buildPatternCell → CanvasTexture).
// Surfaces: 'floor' | 'wallN' | 'wallS' | 'wallE' | 'wallW'.
// Fixture coords: x ∈ [0..widthM] from the W wall, z ∈ [0..depthM] from the
// N wall, rotY radians (0 = back toward north). Converted to centered scene
// space internally.
// Contract: export async mountRoom(el, {room, assignments, products, onReady})
//   -> { dispose(), setSurface(surfaceId, product, opts), setDims(w,d,h),
//        setFixtures(list) }
//
// Interaction discipline (review fixes):
//   * Intent-gated controls — until the user deliberately taps/clicks the
//     canvas, wheel zoom is off and one-finger touch does nothing, and the
//     canvas keeps `touch-action: pan-y` FOREVER so a vertical page swipe that
//     starts on the room always scrolls the page instead of orbiting it.
//   * On-demand rendering — frames are drawn on control change, resize, damping
//     settle and content change, never as an unconditional rAF treadmill.
//   * Accessible — the canvas carries role/aria-label (dims + tiled surfaces,
//     kept current) and orbits with the arrow keys / +- .
// ============================================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildPatternCell } from "./texture.js";
import { GROUT_COLORS, cellMeters } from "./domain.js";
import { t } from "./i18n.js";

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

// ---- Fixture primitive builders --------------------------------------------
// All matte white/grey, base resting on y=0, back toward -Z, castShadow on.

const matWhite = () => new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.4, metalness: 0.02 });
const matMatte = () => new THREE.MeshStandardMaterial({ color: 0xeceae6, roughness: 0.85 });
const matGrey = () => new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.85 });
const matDark = () => new THREE.MeshStandardMaterial({ color: 0x565b60, roughness: 0.6 });
const matChrome = () => new THREE.MeshStandardMaterial({ color: 0xc7cbd0, roughness: 0.3, metalness: 0.7 });

function shadowed(mesh, receive = true) {
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  return mesh;
}

function buildKada() {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.56, 0.75), matWhite()));
  body.position.y = 0.28;
  g.add(body);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.02, 0.59), matMatte());
  inset.position.y = 0.555;
  g.add(inset);
  // Rounded rim: capsule-ish cylinders along the top perimeter.
  const rimR = 0.035, rimY = 0.56;
  const alongX = new THREE.CylinderGeometry(rimR, rimR, 1.7, 12);
  const alongZ = new THREE.CylinderGeometry(rimR, rimR, 0.75, 12);
  for (const zc of [-0.375 + rimR, 0.375 - rimR]) {
    const rim = shadowed(new THREE.Mesh(alongX, matWhite()), false);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(0, rimY, zc);
    g.add(rim);
  }
  for (const xc of [-0.85 + rimR, 0.85 - rimR]) {
    const rim = shadowed(new THREE.Mesh(alongZ, matWhite()), false);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(xc, rimY, 0);
    g.add(rim);
  }
  return g;
}

function buildWc() {
  const g = new THREE.Group();
  const bowl = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.13, 0.4, 20), matWhite()));
  bowl.position.set(0, 0.2, 0.1);
  g.add(bowl);
  const seat = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 20), matWhite()), false);
  seat.position.set(0, 0.425, 0.1);
  g.add(seat);
  const cistern = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.16), matWhite()));
  cistern.position.set(0, 0.61, -0.18);
  g.add(cistern);
  const button = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.06), matChrome());
  button.position.set(0, 0.826, -0.18);
  g.add(button);
  return g;
}

function buildUmivaonik() {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), matDark());
  plinth.position.y = 0.025;
  g.add(plinth);
  const cabinet = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.52, 0.44), matGrey()));
  cabinet.position.y = 0.31;
  g.add(cabinet);
  const basin = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.46), matWhite()));
  basin.position.y = 0.62;
  g.add(basin);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 10), matChrome());
  riser.position.set(0, 0.76, -0.16);
  g.add(riser);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 10), matChrome());
  spout.rotation.x = Math.PI / 2;
  spout.position.set(0, 0.85, -0.09);
  g.add(spout);
  return g;
}

function buildRadijator() {
  const g = new THREE.Group();
  const panel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), matMatte()));
  panel.position.set(0, 0.5, 0);
  g.add(panel);
  const finGeo = new THREE.BoxGeometry(0.08, 0.56, 0.015);
  for (let i = 0; i < 8; i++) {
    const fin = new THREE.Mesh(finGeo, matMatte());
    fin.position.set(-0.36 + i * 0.103, 0.5, 0.037);
    g.add(fin);
  }
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 10), matChrome());
  valve.rotation.z = Math.PI / 2;
  valve.position.set(0.5, 0.24, 0);
  g.add(valve);
  return g;
}

function buildKlima(dims) {
  const g = new THREE.Group();
  const yc = Math.max(1.7, dims.heightM - 0.35);
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.3, 0.21), matWhite()), false);
  body.position.set(0, yc, 0);
  g.add(body);
  const slat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.02), matDark());
  slat.position.set(0, yc - 0.11, 0.1);
  g.add(slat);
  return g;
}

const FIXTURE_BUILDERS = {
  kada: buildKada,
  wc: buildWc,
  umivaonik: buildUmivaonik,
  radijator: buildRadijator,
  klima: buildKlima,
};

function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}

// ---- Mount -----------------------------------------------------------------

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
  // Named, focusable and keyboard-orbitable: without this the room is a silent,
  // unreachable region for assistive tech and pointer-only for everyone else.
  canvasEl.setAttribute("role", "img");
  canvasEl.setAttribute("tabindex", "0");
  canvasEl.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown");
  canvasEl.style.outlineOffset = "-3px";
  el.appendChild(canvasEl);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e8e6);

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
  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // never under the floor
  controls.minDistance = 1.2;
  controls.enablePan = false;                  // the room stays framed

  // ---- Intent gate ---------------------------------------------------------
  // OrbitControls' constructor sets touch-action:none, which is exactly the
  // scroll trap the review caught. We take it back to pan-y and keep it there:
  // a vertical swipe over the room always scrolls the page, at every moment of
  // the session. Wheel zoom and one-finger orbit only switch on after a
  // deliberate click (mouse/pen) or tap (touch) on the canvas.
  let armed = false;
  controls.enableZoom = false;
  controls.touches = { ONE: TOUCH_NONE, TWO: TOUCH_NONE };
  canvasEl.style.touchAction = "pan-y";

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

  // Capture phase so the gate opens before OrbitControls' own pointerdown
  // handler runs and the very same mouse drag already orbits. A touch gesture
  // is armed on pointerup instead: arming mid-gesture would let one swipe both
  // scroll the page and spin the camera.
  const onPointerDownCapture = (e) => { if (e.pointerType !== "touch") arm(); };
  const onPointerUpCapture = (e) => { if (e.pointerType === "touch") arm(); };
  // Leaving with the mouse hands the wheel back to the page.
  const onPointerLeave = (e) => { if (e.pointerType !== "touch") disarm(); };
  canvasEl.addEventListener("pointerdown", onPointerDownCapture, true);
  canvasEl.addEventListener("pointerup", onPointerUpCapture, true);
  canvasEl.addEventListener("pointerleave", onPointerLeave);

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
  // Kept current with dims and tiling, so a screen-reader user always hears
  // what the sighted user is looking at.
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
      tt("soba3d.a11y.keys", "Strelicama okrenite prikaz, tipkama + i − približite"),
    ];
    canvasEl.setAttribute("aria-label", parts.join(". ") + ".");
  }

  // ---- Fixtures ------------------------------------------------------------
  const fixturesGroup = new THREE.Group();
  scene.add(fixturesGroup);
  let fixturesState = [];

  function placeFixtures() {
    for (const child of [...fixturesGroup.children]) {
      disposeObject(child);
      fixturesGroup.remove(child);
    }
    for (const f of fixturesState) {
      const build = FIXTURE_BUILDERS[f.type];
      if (!build) continue;
      const g = build(dims);
      const px = Math.min(dims.widthM - 0.05, Math.max(0.05, f.x ?? dims.widthM / 2)) - dims.widthM / 2;
      const pz = Math.min(dims.depthM - 0.05, Math.max(0.05, f.z ?? dims.depthM / 2)) - dims.depthM / 2;
      g.position.set(px, 0, pz);
      g.rotation.y = f.rotY || 0;
      fixturesGroup.add(g);
    }
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
  // update() while damping settles, so the glide still animates), by resize and
  // by every content mutation below.
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

  // ---- Keyboard orbit ------------------------------------------------------
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
    const step = e.shiftKey ? 0.22 : 0.08;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":  orbitBy(-step, 0); break;
      case "ArrowRight": orbitBy(step, 0); break;
      case "ArrowUp":    orbitBy(0, -step); break;
      case "ArrowDown":  orbitBy(0, step); break;
      case "+": case "=": dollyBy(0.88); break;
      case "-": case "_": dollyBy(1.14); break;
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
  fixturesState = Array.isArray(room.fixtures) ? room.fixtures.map((f) => ({ ...f })) : [];
  placeFixtures();
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
      placeFixtures();
      for (const [sid, rec] of Object.entries(applied)) {
        if (rec) applySurface(sid, rec.product, rec.opts);
      }
      updateAriaLabel();
      requestRender();
    },

    setFixtures(list) {
      fixturesState = Array.isArray(list) ? list.map((f) => ({ ...f })) : [];
      placeFixtures();
      requestRender();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      controls.removeEventListener("change", requestRender);
      canvasEl.removeEventListener("pointerdown", onPointerDownCapture, true);
      canvasEl.removeEventListener("pointerup", onPointerUpCapture, true);
      canvasEl.removeEventListener("pointerleave", onPointerLeave);
      canvasEl.removeEventListener("keydown", onKeyDown);
      controls.dispose();
      disposeObject(scene);
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvasEl.remove();
    },
  };
}
