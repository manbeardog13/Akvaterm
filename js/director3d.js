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
// The timing maths lives in a dependency-free module so it can be proved in
// plain Node without a browser or a GPU. See tests/motion.test.mjs.
import { springScalar, blendFactor, driftAxis, isSettled } from "./motion.js";

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

/** Vector3 wrapper over the pure per-axis spring in motion.js. */
function springTo(current, velocity, target, smoothTime, dt) {
  if (!(dt > 0)) return;
  for (const axis of ["x", "y", "z"]) {
    const [p, v] = springScalar(current[axis], velocity[axis], target[axis], smoothTime, dt);
    current[axis] = p;
    velocity[axis] = v;
  }
}

// ---------------------------------------------------------------------------
// MOVE RESULTS — the engine contract the commissioning guide programs against.
//
// Every verb returns one of these immediately and never throws. `settled` and
// `cancelled` are LIVE: the same object is mutated as the move resolves, and
// `done` settles once, so a caller may either poll the fields or await the
// promise. Unknown targets come back {ok:false, reason:'unknown-target'} rather
// than failing silently — a typo in a journey definition must be diagnosable
// without being fatal to the customer's session.
//
// Only ONE move is ever live. A new request supersedes the old one rather than
// queueing behind it: obsolete camera travel is worse than no travel, because
// the room would visibly finish answering a question the customer has already
// moved past.
// ---------------------------------------------------------------------------
function makeResult(target, ok, reason) {
  let settle;
  const result = {
    ok, target: target ?? null, settled: false, cancelled: false,
    reason: reason ?? null,
    done: new Promise((res) => { settle = res; }),
  };
  result._finish = (kind, why) => {
    if (result.settled || result.cancelled) return;
    if (kind === "settled") result.settled = true;
    else { result.cancelled = true; result.reason = why ?? result.reason; }
    settle({ ok: result.ok, target: result.target, settled: result.settled, cancelled: result.cancelled, reason: result.reason });
  };
  if (!ok) result._finish("cancelled", reason);
  return result;
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

  // ---- move lifecycle ------------------------------------------------------
  let activeMove = null;
  let destroyed = false;

  /** Cancel any pending move. Safe to call repeatedly and after disposal — the
   *  point is that no stale callback may ever resolve as "settled" once the
   *  room it described is gone. */
  function cancel(reason = "superseded") {
    if (activeMove) { activeMove._finish("cancelled", reason); activeMove = null; }
  }

  // ---- the verbs -----------------------------------------------------------
  function goto(pos, target, time, name) {
    // Supersede rather than queue: the newest request replaces the old one and
    // the spring carries its current position AND velocity into it, so the
    // change of mind is a redirection, not a restart.
    cancel("superseded");
    // A standing state (orbit, tour) that was active must be cleared here too,
    // not just have its activeMove promise cancelled — cancel() only resolves
    // the PROMISE. Without this, update()'s `if (tour) {...}` block would keep
    // silently overwriting the basePos/baseTarget this call is about to set,
    // on every subsequent frame, fighting a move that believes it already won.
    orbit = null;
    tour = null;
    basePos.copy(pos);
    baseTarget.copy(target);
    smoothTime = reducedMotion ? Math.min(time, 0.45) : time;
    manual = false;
    driftScale = 0;           // suppress wander while travelling...
    requestFrame && requestFrame();
    activeMove = makeResult(name, true, null);
    return activeMove;
  }

  /** THE journey's entry point. Takes a semantic target — 'north-wall',
   *  'floor', 'vanity', 'cabinets' — and does the right thing for its kind, so
   *  a new question and a spoken revision ("change the north wall") are the
   *  same call. Unknown targets are a no-op, never a throw. */
  function focusSurface(target, opts = {}) {
    if (destroyed) return makeResult(target, false, "disposed");
    const f = surfaceFrame(target);
    if (!f) {
      const obj = resolveFixture && resolveFixture(target);
      if (obj) return focusObject(obj, opts, target);
      return makeResult(target, false, "unknown-target");
    }
    const dist = opts.distance ?? Math.max(f.w, f.h) * 0.95 + 0.6;
    const pos = f.center.clone().addScaledVector(f.normal, dist);
    if (f.sid === "floor") pos.y = Math.max(pos.y, dims.heightM * 0.9);
    else pos.y = Math.min(dims.heightM * 0.62, f.center.y + f.h * 0.12);
    return goto(pos, f.center.clone(), SMOOTH.travel, target);
  }

  /** Lean in at a SHALLOW, oblique angle so relief, grout and specular roll are
   *  all visible. Straight-on is the one angle that hides every one of them:
   *  no parallax across the grout, no highlight travel, no sense of depth. */
  function inspectMaterial(target, { grazing = 22, distance = 0.62 } = {}) {
    if (destroyed) return makeResult(target, false, "disposed");
    const f = surfaceFrame(target);
    const sid = f && f.sid;
    if (!f) return makeResult(target, false, "unknown-target");
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
    return goto(eye, f.center.clone(), SMOOTH.inspect, target);
  }

  /** Ceremonial arc around one representative tile, kept centred throughout.
   *  Driven from update() rather than set once, because the anchor must stay
   *  framed while the arc travels. */
  let orbit = null;
  function orbitSelection(target, { radius = 0.8, speed = 0.055, uv = [0.5, 0.5] } = {}) {
    if (destroyed) return makeResult(target, false, "disposed");
    const f = surfaceFrame(target);
    const sid = f && f.sid;
    if (!f) return makeResult(target, false, "unknown-target");
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = f.normal.clone().cross(up).normalize();
    const anchor = f.center.clone()
      .addScaledVector(tangent, (uv[0] - 0.5) * f.w * 0.6)
      .addScaledVector(up, sid === "floor" ? 0 : (uv[1] - 0.5) * f.h * 0.4);
    if (reducedMotion) return makeResult(target, false, "reduced-motion");
    cancel("superseded");
    tour = null;
    orbit = { anchor, normal: f.normal.clone(), tangent, radius, speed, phase: 0, sid };
    smoothTime = SMOOTH.orbit;
    manual = false;
    driftScale = 0;
    requestFrame && requestFrame();
    // Linked into activeMove (not just returned standalone) so a LATER verb's
    // cancel("superseded") resolves THIS promise as cancelled instead of
    // leaving it pending forever — a standing state still owes its caller a
    // real settlement eventually, even though "settled" itself never fires
    // for it (see the exclusion in update()).
    activeMove = makeResult(target, true, null);
    return activeMove;
  }

  /** Track along a grout line at close range — the movement that sells the
   *  material as real rather than as a numeric property being edited. */
  function followGroutLine(target, { distance = 0.34, speed = 0.06 } = {}) {
    if (destroyed) return makeResult(target, false, "disposed");
    const f = surfaceFrame(target);
    const sid = f && f.sid;
    if (!f) return makeResult(target, false, "unknown-target");
    cancel("superseded");
    tour = null;
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
    activeMove = makeResult(target, true, null);   // see orbitSelection's comment on why
    return activeMove;
  }

  // ---------------------------------------------------------------------------
  // THE ROOM TOUR — an ambient showcase the customer opts into, not something
  // the guide ever triggers on its own.
  //
  // A handful of wide establishing angles around the room, held with a slow
  // settle and connected by ordinary spring travel, looping until the customer
  // interrupts it — grabs the camera, advances the guide, or presses stop.
  // Nothing new under the hood: a tour is goto()-shaped poses advanced on a
  // hold timer, generated from the room's own dimensions rather than authored
  // per preset, so it works for any room the journey produces.
  //
  // Azimuths are deliberately OFF the room's own axes: dead-on to a wall is
  // the least interesting frame a wide shot can hold, and axis-aligned angles
  // are exactly where the glass-coverage hysteresis thresholds sit closest to
  // the camera's crossing — off-axis avoids grazing them needlessly.
  // ---------------------------------------------------------------------------
  const TOUR = {
    azimuthsDeg: [35, 125, 215, 305],
    elevation: 1.18,
    holdSeconds: 4.4,
    smoothTime: 2.6,   // slower than orbit's 2.2 — a tour is an unhurried look, not an inspection
  };

  function tourPose(azimuthDeg) {
    const r = Math.max(dims.widthM, dims.depthM) * 1.05 + 0.4;
    const rad = THREE.MathUtils.degToRad(azimuthDeg);
    return {
      pos: new THREE.Vector3(Math.sin(rad) * r, dims.heightM * TOUR.elevation, Math.cos(rad) * r),
      target: new THREE.Vector3(0, dims.heightM * 0.35, 0),
    };
  }

  let tour = null;

  function playTour(opts = {}) {
    if (destroyed) return makeResult("tour", false, "disposed");
    cancel("superseded");
    orbit = null;
    const azimuths = Array.isArray(opts.azimuths) && opts.azimuths.length ? opts.azimuths : TOUR.azimuthsDeg;
    tour = { azimuths, index: 0, hold: opts.holdSeconds ?? TOUR.holdSeconds, holding: 0 };
    smoothTime = reducedMotion ? Math.min(TOUR.smoothTime, 0.45) : TOUR.smoothTime;
    const first = tourPose(azimuths[0]);
    basePos.copy(first.pos);
    baseTarget.copy(first.target);
    manual = false;
    driftScale = 0;
    requestFrame && requestFrame();
    activeMove = makeResult("tour", true, null);
    return activeMove;
  }

  /** Explicit stop. Resolves the tour's own promise as cancelled — a tour
   *  ending is an intentional halt, never a "settle". */
  function stopTour() {
    tour = null;
    cancel("tour-stopped");
  }

  function focusObject(object3d, { distance = 1.5 } = {}, name) {
    if (destroyed) return makeResult(name, false, "disposed");
    if (!object3d) return makeResult(name, false, "unknown-target");
    object3d.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(object3d.matrixWorld);
    const dir = new THREE.Vector3(0.7, 0.45, 0.9).normalize();
    return goto(c.clone().addScaledVector(dir, distance), c, SMOOTH.travel, name ?? "object");
  }

  function returnToOverview() {
    if (destroyed) return makeResult("overview", false, "disposed");
    orbit = null;
    tour = null;
    const o = overviewPose();
    return goto(o.pos, o.target, SMOOTH.recover, "overview");
  }

  /** Stop directing and let the room breathe where it stands. */
  function settleIntoDrift() {
    cancel("settled-into-drift");
    orbit = null;
    tour = null;
    basePos.copy(camera.position);
    baseTarget.copy(controls.target);
    smoothTime = SMOOTH.travel;
    manual = false;
  }

  /** The user grabbed the camera: the director stands down without a fight,
   *  keeping its base poses in sync so a later verb starts from reality. */
  function yieldToUser() {
    cancel("user-took-control");
    manual = true;
    orbit = null;
    tour = null;
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

    // Tour advancement: hold at the current waypoint until the camera has
    // actually ARRIVED (not just until a timer elapses — a slow first travel
    // must not have its hold eaten by transit time) and stayed for `hold`
    // seconds, then hand the NEXT waypoint to basePos/baseTarget. Nothing
    // downstream needs to know this happened: it flows through the ordinary
    // `else` branch below exactly like any other goto(), because a tour IS
    // just basePos/baseTarget changing on a timer rather than by a single call.
    if (tour) {
      const arrived = isSettled(camera.position.distanceTo(basePos), posVel.length());
      tour.holding = arrived ? tour.holding + step : 0;
      if (arrived && tour.holding >= tour.hold) {
        tour.index = (tour.index + 1) % tour.azimuths.length;
        const next = tourPose(tour.azimuths[tour.index]);
        basePos.copy(next.pos);
        baseTarget.copy(next.target);
        tour.holding = 0;
      }
    }

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

    // Arrival is measured against the BASE pose, never the drifted one: the
    // wander is deliberately perpetual, so a move compared against it could
    // never be declared settled and `done` would hang forever. Orbit and tour
    // are both standing states rather than a single journey, so neither ever
    // settles — a standing state ends by being explicitly stopped or by a
    // later verb superseding it (see cancel() calls at each entry point).
    if (activeMove && !orbit && !tour) {
      if (isSettled(camera.position.distanceTo(basePos), posVel.length())) {
        activeMove._finish("settled");
        activeMove = null;
      }
    }

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
    playTour, stopTour,
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
        orbit: !!orbit, tour: tour ? { index: tour.index, holding: +tour.holding.toFixed(2) } : false,
        manual, driftScale: +driftScale.toFixed(3),
      };
    },
    cancel,
    dispose() {
      // Ordered deliberately: mark destroyed FIRST so any verb racing this call
      // returns {ok:false, reason:'disposed'} instead of arming new motion
      // against a renderer that is going away.
      destroyed = true;
      cancel("disposed");
      orbit = null;
      manual = true;
    },
  };
}
