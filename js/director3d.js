// ============================================================================
// director3d.js — the cinematic camera director for the guided journey.
//
// CONTRACT
//   createDirector({ camera, controls, dims, surfaceRecs, requestFrame })
//     -> { focusSurface, inspectMaterial, orbitSelection, followGroutLine,
//          focusObject, returnToOverview, settleIntoDrift,
//          update(dtSeconds) -> boolean, yieldToUser(), setReducedMotion(bool),
//          isIdle(), dispose() }
//
// The journey declares INTENT ("look at the north wall the way you would lean
// in to read a tile") and the director computes the transform. No bespoke
// camera animation belongs in a question handler — that is the whole point.
//
// ---------------------------------------------------------------------------
// WHY SPRINGS AND NOT TWEENS
//
// A timed tween has a start pose baked into it, so an interruption mid-flight
// can only do one of two ugly things: snap to a new start, or finish the old
// move first. The brief forbids both ("continue smoothly from the camera's
// actual current transform and velocity — never restart from a canned
// beginning").
//
// A critically damped spring has no start pose at all. It only knows where it
// IS, how fast it is MOVING, and where it wants to BE. Retarget it mid-flight
// and position and velocity carry through untouched — interruption is free,
// because there is no timeline to interrupt. It also gives exactly the motion
// curve asked for, for free and for physical reasons rather than by taste:
// decisive at the start while the error is large, asymptotically slower as the
// error shrinks, never linear, never overshooting, and never arriving hard.
//
// "Critically damped" is the specific choice: under-damped would bounce past
// the target (a camera that wobbles reads as cheap), over-damped would crawl.
// Critical is the fastest approach that cannot overshoot.
//
// The integrator below is the standard stable implicit form (Game Programming
// Gems 4, "Critically Damped Ease-In/Ease-Out Smoothing"). It is unconditionally
// stable at any frame rate, which matters: a naive exponential lerp keyed off
// dt explodes on a long frame, and a dropped frame on a phone must not fling
// the camera across the room.
//
// ---------------------------------------------------------------------------
// WHY THE CAMERA NEVER STOPS
//
// The spring converges toward its target asymptotically, so it never formally
// arrives. That alone is not enough — converged is converged, and a still frame
// reads as frozen. So the target itself is never still: driftOffset() adds a
// slow, low-amplitude, multi-frequency wander to every target the director
// hands the spring.
//
// The frequencies are deliberately irrational multiples of each other, so the
// sum never repeats within a session. A looping drift is worse than none: the
// eye finds the period in about two cycles and the room starts to feel like a
// screensaver.
//
// The consequence to understand before changing anything here: the room3d
// renderer is DAMAGE-DRIVEN (it draws on change, not on a rAF treadmill — see
// requestRender there). A living camera means a continuous loop while the
// journey is active. update() therefore returns whether it wants another frame,
// and the caller owns the loop and must stop pumping it when the tab is hidden.
// ============================================================================

import * as THREE from "three";

// Spring stiffness expressed as the time to cover most of the distance. Bigger
// = lazier. These are the motion vocabulary's whole personality, so they live
// in one table rather than scattered as magic numbers at the call sites.
const SMOOTH = {
  travel: 1.45,   // room-scale moves: crossing to a wall
  inspect: 1.15,  // leaning in to a surface — a touch more decisive
  orbit: 2.20,    // ceremonial arc around a tile: slowest, most deliberate
  recover: 0.85,  // returning to overview: the most purposeful move there is
};

// Idle drift. Amplitudes are METRES and stay under the threshold where motion
// reads as motion rather than as life; the periods are seconds.
const DRIFT = {
  posAmp: 0.085,
  targetAmp: 0.030,
  // Irrational-ish ratios: no common period, so the wander never visibly loops.
  periods: [23.7, 31.3, 17.9, 41.1, 29.3, 37.7],
};

const _v = new THREE.Vector3();

// ---------------------------------------------------------------------------
// SEMANTIC TARGETS — the journey's whole vocabulary for "look here".
//
// The commissioning guide calls focusSurface('north-wall') for a new question
// AND for a natural-language revision ("change the north wall"), so this map is
// the single place a spoken target becomes geometry. It deliberately does NOT
// accept question copy: a target is a stable identifier with a lifetime, and
// question wording changes every time someone edits a sentence.
//
// Anything not listed here is resolved against fixture kinds (vanity, cabinets,
// bath, wc, radiator...) by the room, so the catalogue can grow without this
// table changing. Internal surface ids stay accepted so existing engine calls
// keep working, but new code should use the semantic names.
// ---------------------------------------------------------------------------
export const TARGETS = {
  "north-wall": "wallN",
  "south-wall": "wallS",
  "east-wall": "wallE",
  "west-wall": "wallW",
  "floor": "floor",
  // Aliases kept short because they are typed by hand in journey definitions.
  wallN: "wallN", wallS: "wallS", wallE: "wallE", wallW: "wallW",
};

/** Critically damped spring, per-axis, unconditionally stable.
 *  `smoothTime` is roughly the time to close most of the gap. */
function springTo(current, velocity, target, smoothTime, dt) {
  if (dt <= 0) return;
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  // Padé approximation of exp(-x): cheaper than Math.exp and, more importantly,
  // never returns a value that lets the implicit step overshoot.
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const axis of ["x", "y", "z"]) {
    const delta = current[axis] - target[axis];
    const temp = (velocity[axis] + omega * delta) * dt;
    velocity[axis] = (velocity[axis] - omega * temp) * exp;
    current[axis] = target[axis] + (delta + temp) * exp;
  }
}

export function createDirector({ camera, controls, dims, surfaceRecs, requestFrame, resolveFixture }) {
  /** Semantic target -> surface id, or null when it names a fixture instead.
   *  Unknown targets return null rather than throwing: a guide should degrade
   *  to "no camera move" on a typo, never break the customer's journey. */
  function toSurfaceId(target) {
    if (typeof target !== "string") return null;
    return TARGETS[target] || (surfaceRecs[target] ? target : null);
  }
  // Where the director WANTS the camera; the spring chases these.
  const basePos = camera.position.clone();
  const baseTarget = controls.target.clone();
  const posVel = new THREE.Vector3();
  const targetVel = new THREE.Vector3();

  let smoothTime = SMOOTH.travel;
  let reducedMotion = false;
  let manual = false;      // user has grabbed the camera; director stands down
  let elapsed = 0;
  let driftScale = 1;      // 0 while travelling, eases to 1 once settled

  // ---- drift ---------------------------------------------------------------
  // Two independent wanders (one for the eye, a smaller one for the look-at
  // point) so the framing breathes instead of the whole rig sliding as a block.
  const _drift = new THREE.Vector3();
  function driftOffset(t, amp, phase) {
    const p = DRIFT.periods;
    _drift.set(
      Math.sin((t / p[0]) * Math.PI * 2 + phase) * amp,
      Math.sin((t / p[1]) * Math.PI * 2 + phase * 1.7) * amp * 0.55,
      Math.cos((t / p[2]) * Math.PI * 2 + phase * 0.8) * amp,
    );
    return _drift;
  }

  // ---- geometry helpers ----------------------------------------------------
  // Surfaces are PlaneGeometry placed by room3d's layout(); their world matrix
  // already encodes position and rotation, so the inward normal and any point
  // on the face are derived from the mesh rather than re-deduced from dims.
  // Re-deriving would be a second source of truth that silently drifts the
  // first time a room shape changes.
  const _n = new THREE.Vector3();
  const _c = new THREE.Vector3();

  function surfaceFrame(target) {
    const sid = toSurfaceId(target);
    const mesh = sid && surfaceRecs[sid]?.mesh;
    if (!mesh) return null;
    mesh.updateWorldMatrix(true, false);
    _c.setFromMatrixPosition(mesh.matrixWorld);
    // Plane geometry faces +Z in local space; the world normal points INTO the
    // room for walls because layout() rotates each wall to face inward.
    _n.set(0, 0, 1).transformDirection(mesh.matrixWorld).normalize();
    const size = sid === "floor"
      ? [dims.widthM, dims.depthM]
      : (sid === "wallN" || sid === "wallS")
        ? [dims.widthM, dims.heightM]
        : [dims.depthM, dims.heightM];
    return { sid, center: _c.clone(), normal: _n.clone(), w: size[0], h: size[1] };
  }

  function overviewPose() {
    return {
      pos: new THREE.Vector3(dims.widthM * 0.75, dims.heightM * 1.15, dims.depthM * 1.35),
      target: new THREE.Vector3(0, dims.heightM * 0.35, 0),
    };
  }

  // ---- the verbs -----------------------------------------------------------
  function goto(pos, target, time) {
    basePos.copy(pos);
    baseTarget.copy(target);
    smoothTime = reducedMotion ? Math.min(time, 0.45) : time;
    manual = false;
    driftScale = 0;           // suppress wander while travelling...
    requestFrame && requestFrame();
  }

  /** THE journey's entry point. Takes a semantic target — 'north-wall',
   *  'floor', 'vanity', 'cabinets' — and does the right thing for its kind, so
   *  a new question and a spoken revision ("change the north wall") are the
   *  same call. Unknown targets are a no-op, never a throw. */
  function focusSurface(target, opts = {}) {
    const f = surfaceFrame(target);
    if (!f) {
      const obj = resolveFixture && resolveFixture(target);
      if (obj) focusObject(obj, opts);
      return;
    }
    const dist = opts.distance ?? Math.max(f.w, f.h) * 0.95 + 0.6;
    const pos = f.center.clone().addScaledVector(f.normal, dist);
    if (f.sid === "floor") pos.y = Math.max(pos.y, dims.heightM * 0.9);
    else pos.y = Math.min(dims.heightM * 0.62, f.center.y + f.h * 0.12);
    goto(pos, f.center.clone(), SMOOTH.travel);
  }

  /** Lean in at a SHALLOW, oblique angle so relief, grout and specular roll are
   *  all visible. Straight-on is the one angle that hides every one of them:
   *  no parallax across the grout, no highlight travel, no sense of depth. */
  function inspectMaterial(target, { grazing = 22, distance = 0.62 } = {}) {
    const f = surfaceFrame(target);
    const sid = f && f.sid;
    if (!f) return;
    const rad = THREE.MathUtils.degToRad(grazing);
    // A tangent along the surface, biased to the horizontal for walls so the
    // camera slides along the tile courses rather than climbing them.
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = sid === "floor"
      ? new THREE.Vector3(1, 0, 0)
      : _v.copy(f.normal).cross(up).normalize().clone();
    // Off the normal toward the tangent: sin(grazing) of normal, cos of tangent.
    const dir = f.normal.clone().multiplyScalar(Math.sin(rad))
      .addScaledVector(tangent, Math.cos(rad)).normalize();
    const eye = sid === "floor"
      ? f.center.clone().addScaledVector(dir, distance).setY(dims.heightM * 0.22)
      : f.center.clone().addScaledVector(dir, distance);
    if (sid !== "floor") eye.y = dims.heightM * 0.45;
    goto(eye, f.center.clone(), SMOOTH.inspect);
  }

  /** Ceremonial arc around one representative tile, kept centred throughout.
   *  Driven from update() rather than set once, because the anchor must stay
   *  framed while the arc travels. */
  let orbit = null;
  function orbitSelection(target, { radius = 0.8, speed = 0.055, uv = [0.5, 0.5] } = {}) {
    const f = surfaceFrame(target);
    const sid = f && f.sid;
    if (!f) return;
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = f.normal.clone().cross(up).normalize();
    const anchor = f.center.clone()
      .addScaledVector(tangent, (uv[0] - 0.5) * f.w * 0.6)
      .addScaledVector(up, sid === "floor" ? 0 : (uv[1] - 0.5) * f.h * 0.4);
    orbit = { anchor, normal: f.normal.clone(), tangent, radius, speed, phase: 0, sid };
    smoothTime = SMOOTH.orbit;
    manual = false;
    driftScale = 0;
    requestFrame && requestFrame();
  }

  /** Track along a grout line at close range — the movement that sells the
   *  material as real rather than as a numeric property being edited. */
  function followGroutLine(target, { distance = 0.34, speed = 0.06 } = {}) {
    const f = surfaceFrame(target);
    const sid = f && f.sid;
    if (!f) return;
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = f.normal.clone().cross(up).normalize();
    orbit = {
      anchor: f.center.clone(), normal: f.normal.clone(), tangent,
      radius: distance, speed, phase: 0, sid, track: true,
      span: (sid === "floor" ? f.w : f.w) * 0.32,
    };
    smoothTime = SMOOTH.inspect;
    manual = false;
    driftScale = 0;
    requestFrame && requestFrame();
  }

  function focusObject(object3d, { distance = 1.5 } = {}) {
    if (!object3d) return;
    object3d.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(object3d.matrixWorld);
    const dir = new THREE.Vector3(0.7, 0.45, 0.9).normalize();
    goto(c.clone().addScaledVector(dir, distance), c, SMOOTH.travel);
  }

  function returnToOverview() {
    orbit = null;
    const o = overviewPose();
    goto(o.pos, o.target, SMOOTH.recover);
  }

  /** Stop directing and let the room breathe where it stands. */
  function settleIntoDrift() {
    orbit = null;
    basePos.copy(camera.position);
    baseTarget.copy(controls.target);
    smoothTime = SMOOTH.travel;
    manual = false;
  }

  /** The user grabbed the camera: the director stands down without a fight,
   *  keeping its base poses in sync so a later verb starts from reality. */
  function yieldToUser() {
    manual = true;
    orbit = null;
    basePos.copy(camera.position);
    baseTarget.copy(controls.target);
    posVel.set(0, 0, 0);
    targetVel.set(0, 0, 0);
  }

  // ---- the loop ------------------------------------------------------------
  const _wantPos = new THREE.Vector3();
  const _wantTarget = new THREE.Vector3();

  /** Advance one frame. Returns true while it wants to keep being called. */
  function update(dt) {
    if (manual) return false;
    const step = Math.min(dt, 0.05);   // clamp: a stalled tab must not teleport
    elapsed += step;

    // Ease drift back in only once the travel has mostly resolved, so a long
    // move is clean and the wander appears as the camera settles.
    driftScale = Math.min(1, driftScale + step * 0.55);

    if (orbit) {
      orbit.phase += step * orbit.speed * (reducedMotion ? 0 : 1);
      const up = new THREE.Vector3(0, 1, 0);
      if (orbit.track) {
        // Slide along the grout line, staying close and square-ish to it.
        const slide = Math.sin(orbit.phase * Math.PI * 2) * orbit.span;
        _wantTarget.copy(orbit.anchor).addScaledVector(orbit.tangent, slide);
        _wantPos.copy(_wantTarget).addScaledVector(orbit.normal, orbit.radius);
        if (orbit.sid !== "floor") _wantPos.y = orbit.anchor.y + 0.05;
        else _wantPos.y = 0.42;
      } else {
        // Arc around the anchor tile, anchor held dead centre.
        const a = orbit.phase * Math.PI * 2;
        const swing = Math.sin(a) * 0.55;   // partial arc, not a full carousel
        const dir = orbit.normal.clone().multiplyScalar(Math.cos(swing))
          .addScaledVector(orbit.tangent, Math.sin(swing)).normalize();
        _wantTarget.copy(orbit.anchor);
        _wantPos.copy(orbit.anchor).addScaledVector(dir, orbit.radius)
          .addScaledVector(up, 0.10 + Math.sin(a * 0.5) * 0.05);
      }
    } else {
      _wantPos.copy(basePos);
      _wantTarget.copy(baseTarget);
    }

    if (!reducedMotion) {
      _wantPos.add(driftOffset(elapsed, DRIFT.posAmp * driftScale, 0));
      _wantTarget.add(driftOffset(elapsed, DRIFT.targetAmp * driftScale, 2.1));
    }

    springTo(camera.position, posVel, _wantPos, smoothTime, step);
    springTo(controls.target, targetVel, _wantTarget, smoothTime, step);

    // Under reduced motion the room still transitions, it simply stops
    // breathing: once converged there is nothing left to animate, so the
    // caller's loop is allowed to fall idle.
    if (reducedMotion) {
      const settled = camera.position.distanceToSquared(_wantPos) < 1e-6
        && controls.target.distanceToSquared(_wantTarget) < 1e-6;
      return !settled;
    }
    return true;   // living camera: always another frame
  }

  return {
    focusSurface, inspectMaterial, orbitSelection, followGroutLine,
    focusObject, returnToOverview, settleIntoDrift, yieldToUser, update,
    setReducedMotion(v) { reducedMotion = !!v; },
    isIdle: () => manual,
    // Live transform, not just the goal — the difference between the two is
    // what tells you the spring is actually working rather than snapping.
    get debug() {
      return {
        pos: camera.position.toArray().map((n) => +n.toFixed(4)),
        target: controls.target.toArray().map((n) => +n.toFixed(4)),
        wantPos: basePos.toArray().map((n) => +n.toFixed(4)),
        speed: +posVel.length().toFixed(4),
        orbit: !!orbit, manual, driftScale: +driftScale.toFixed(3),
      };
    },
    dispose() { orbit = null; manual = true; },
  };
}
