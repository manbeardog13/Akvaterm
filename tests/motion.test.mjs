// ============================================================================
// tests/motion.test.mjs — deterministic regression coverage for the cinematic
// director. Runs in plain Node with no browser, no GPU and no dependencies:
//
//     node tests/motion.test.mjs
//
// TWO KINDS OF TEST LIVE HERE, AND THE DIFFERENCE MATTERS.
//
//   [behaviour] exercises the REAL code path. js/motion.js is imported and run;
//               these are genuine proofs of the timing and latch behaviour,
//               because room3d and director3d call exactly these functions.
//
//   [contract]  asserts a structural invariant by reading the source. These are
//               deterministic and they catch the regressions that matter most
//               (a ceiling leaking into the estimate, glass writing product
//               state), but they prove the code SAYS the right thing, not that
//               it DOES it at runtime. They are not a substitute for the visual
//               acceptance run, which remains outstanding.
//
// Nothing here can prove how the room LOOKS. That needs a real animation frame.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  springScalar, blendFactor, latchGlass, stepBlend, driftAxis, isSettled,
} from "../js/motion.js";
import {
  MASKED_REVEAL, advanceMaskedReveal, maskedRevealAlpha, maskedRevealTransform,
} from "../js/masked-reveal.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(join(ROOT, p), "utf8");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failures.push({ name, err }); console.log(`  FAIL ${name}\n       ${err.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function close(a, b, eps, msg) {
  if (Math.abs(a - b) > eps) throw new Error(`${msg} (${a} vs ${b}, tolerance ${eps})`);
}

// Mirrors of the constants the engine uses. Kept in step by the [contract]
// tests below, so a change in the engine that is not reflected here fails
// loudly rather than silently invalidating every timing test.
const GLASS = { enter: 0.14, exit: 0.02, tau: 0.22, tauReduced: 0.09 };

// ---------------------------------------------------------------------------
console.log("\n[behaviour] frame-rate independence");
// ---------------------------------------------------------------------------

/** Run the spring for `seconds` of wall-clock at a fixed step. */
function travel(fps, seconds, smoothTime = 1.45) {
  const dt = 1 / fps;
  let x = 0, v = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    [x, v] = springScalar(x, v, 10, smoothTime, dt);
  }
  return x;
}

test("30/60/120 fps travel the same distance in the same wall-clock time", () => {
  const a = travel(30, 1.0), b = travel(60, 1.0), c = travel(120, 1.0);
  // The integrator is approximate, so equality is not the bar — a customer
  // noticing that the room moves faster on a 120 Hz phone is. 1% of the
  // journey is far below that.
  close(a, b, 0.1, "30 vs 60 fps diverged");
  close(b, c, 0.1, "60 vs 120 fps diverged");
  // A critically damped spring has covered ~40% at t = smoothTime — this
  // assertion originally expected near-arrival, which was simply wrong about
  // the maths. What matters is that it is decisively under way and has not
  // overshot; arrival is asserted separately below.
  assert(a > 3 && a < 5, `expected ~40% of travel after 1s, got ${a}`);
  assert(a <= 10, `overshoot: ${a}`);
});

test("travel arrives (but never overshoots) given a few time constants", () => {
  const x = travel(60, 5.0);
  assert(x > 9.5, `expected arrival after 5s, got ${x}`);
  assert(x <= 10.0001, `overshoot: ${x}`);
});

test("glass blend reaches the same opacity at the same time at any fps", () => {
  const run = (fps) => {
    const dt = 1 / fps;
    let g = 0;
    for (let t = 0; t < 0.44 - 1e-9; t += dt) g = stepBlend(g, 1, blendFactor(dt, GLASS.tau));
    return g;
  };
  const a = run(30), b = run(60), c = run(120);
  close(a, b, 0.01, "glass blend differs 30 vs 60");
  close(b, c, 0.01, "glass blend differs 60 vs 120");
  // Two time constants ≈ 86% — the blend must be substantially complete, not
  // still crawling, or a wall would visibly lag the camera crossing it.
  assert(a > 0.8, `expected >0.8 after 2 tau, got ${a}`);
});

test("a stalled frame cannot fling the camera past its target", () => {
  let x = 0, v = 0;
  [x, v] = springScalar(x, v, 10, 1.45, 2.0);   // one absurd 2-second frame
  assert(x <= 10.0001, `overshoot on long frame: ${x}`);
  assert(Number.isFinite(x) && Number.isFinite(v), "spring produced NaN/Infinity");
});

// ---------------------------------------------------------------------------
console.log("\n[behaviour] hysteresis — jitter must not pulse a wall");
// ---------------------------------------------------------------------------

/** Count latch flips across a facing sequence. */
function flips(sequence, start = 0) {
  let want = start, n = 0;
  for (const f of sequence) {
    const next = latchGlass(want, f, GLASS.enter, GLASS.exit);
    if (next !== want) n++;
    want = next;
  }
  return { flips: n, final: want };
}

test("jitter around the ENTER threshold flips at most once", () => {
  // Camera hovering on the enter threshold, wobbling by the amplitude of the
  // idle drift itself — the exact condition that made the old single-threshold
  // version strobe.
  const seq = [];
  for (let i = 0; i < 200; i++) seq.push(GLASS.enter + (i % 2 ? 0.01 : -0.01));
  const r = flips(seq);
  assert(r.flips <= 1, `expected <=1 flip, got ${r.flips}`);
  assert(r.final === 1, "should have latched to glass");
});

test("jitter around the EXIT threshold flips at most once", () => {
  const seq = [];
  for (let i = 0; i < 200; i++) seq.push(GLASS.exit + (i % 2 ? 0.005 : -0.005));
  const r = flips(seq, 1);
  assert(r.flips <= 1, `expected <=1 flip, got ${r.flips}`);
  assert(r.final === 0, "should have released to opaque");
});

test("the dead band between thresholds holds state (no flip either way)", () => {
  const mid = (GLASS.enter + GLASS.exit) / 2;
  assert(latchGlass(0, mid, GLASS.enter, GLASS.exit) === 0, "opaque should stay opaque mid-band");
  assert(latchGlass(1, mid, GLASS.enter, GLASS.exit) === 1, "glass should stay glass mid-band");
});

// ---------------------------------------------------------------------------
console.log("\n[behaviour] journey sequences");
// ---------------------------------------------------------------------------

test("overview -> north wall -> outside -> re-entry: two walls may be glass at a corner", () => {
  // A corner pose sits outside two walls at once. Both must latch — the failure
  // being guarded against is a rule that only ever glasses one wall and leaves
  // the second one opaque and edge-on to camera.
  const cornerFacings = { wallN: 0.72, wallE: 0.68, wallS: -0.72, wallW: -0.68 };
  const state = {};
  for (const [sid, f] of Object.entries(cornerFacings)) {
    state[sid] = latchGlass(0, f, GLASS.enter, GLASS.exit);
  }
  assert(state.wallN === 1 && state.wallE === 1, "both corner walls must become glass");
  assert(state.wallS === 0 && state.wallW === 0, "far walls must stay opaque");
});

test("re-entry releases every wall back to opaque", () => {
  let n = 1, e = 1;
  n = latchGlass(n, -0.9, GLASS.enter, GLASS.exit);
  e = latchGlass(e, -0.9, GLASS.enter, GLASS.exit);
  assert(n === 0 && e === 0, "walls must release once the camera is back inside");
});

test("rapid interruptions redirect without restarting (velocity is carried)", () => {
  // north wall -> floor -> vanity -> north wall, retargeting mid-flight.
  let x = 0, v = 0;
  const targets = [10, -4, 7, 10];
  const speeds = [];
  for (const target of targets) {
    for (let i = 0; i < 12; i++) [x, v] = springScalar(x, v, target, 1.45, 1 / 60);
    speeds.push(Math.abs(v));
    assert(Number.isFinite(x) && Number.isFinite(v), "interruption produced NaN");
  }
  // The decisive property: at every hand-over the camera is still MOVING. A
  // tween would have to zero its velocity to restart from a canned beginning.
  assert(speeds.every((s) => s > 0), "velocity was lost across a retarget");
});

test("re-tiling mid-transition resumes cleanly from a known baseline", () => {
  // room3d sets rec.glass = null when a surface is re-tiled, so the blend
  // re-derives from the new opaque state instead of the half-faded old one.
  let g = 0;
  for (let i = 0; i < 5; i++) g = stepBlend(g, 1, blendFactor(1 / 60, GLASS.tau));
  assert(g > 0 && g < 1, "precondition: should be mid-blend");
  g = 0;                                     // <- the re-tile reset
  for (let i = 0; i < 5; i++) g = stepBlend(g, 1, blendFactor(1 / 60, GLASS.tau));
  assert(g > 0 && g < 1 && Number.isFinite(g), `resumed blend invalid: ${g}`);
});

// ---------------------------------------------------------------------------
console.log("\n[behaviour] masked material replacement");
// ---------------------------------------------------------------------------

test("the mask preserves every pixel at the start and reveals every pixel at the end", () => {
  for (const uv of [0, 0.25, 0.5, 0.75, 1]) {
    close(maskedRevealAlpha(uv, 0), 0, 1e-9, `start alpha at ${uv}`);
    close(maskedRevealAlpha(uv, 1), 1, 1e-9, `end alpha at ${uv}`);
  }
});

test("the feather is monotonic and local while the reveal is moving", () => {
  const samples = [0, 0.25, 0.5, 0.75, 1].map((uv) => maskedRevealAlpha(uv, 0.5));
  for (let i = 1; i < samples.length; i++) {
    assert(samples[i - 1] >= samples[i], `mask reversed at sample ${i}: ${samples}`);
  }
  assert(samples[0] === 1 && samples.at(-1) === 0,
    `mid-reveal must preserve one side and replace the other: ${samples}`);
});

test("30/60/120 fps finish the material reveal in equal wall-clock time", () => {
  const run = (fps) => {
    let progress = 0;
    const dt = 1 / fps;
    for (let elapsed = 0; elapsed < MASKED_REVEAL.duration + 0.1; elapsed += dt) {
      progress = advanceMaskedReveal(progress, dt);
    }
    return maskedRevealTransform(progress);
  };
  for (const fps of [30, 60, 120]) assert(run(fps).done, `${fps} fps did not settle`);
});

test("reduced motion settles faster and drift is suppressed", () => {
  const steps = (tau) => {
    let g = 0, n = 0;
    while (g < 0.95 && n < 10000) { g = stepBlend(g, 1, blendFactor(1 / 60, tau)); n++; }
    return n;
  };
  assert(steps(GLASS.tauReduced) < steps(GLASS.tau), "reduced motion must settle sooner");
  assert(driftAxis(12.3, 0, 23.7) === 0, "zero amplitude must produce zero drift");
});

test("settlement requires both proximity AND low speed", () => {
  assert(isSettled(0.001, 0.001), "close and slow should settle");
  assert(!isSettled(0.001, 5), "close but fast must not settle (mid-overshoot)");
  assert(!isSettled(5, 0.001), "far but slow must not settle (start of travel)");
});

test("drift never repeats within a long session", () => {
  // Non-commensurate periods: the summed wander must not return to its start.
  const periods = [23.7, 31.3, 17.9];
  const at = (t) => periods.reduce((s, p, i) => s + driftAxis(t, 0.085, p, i * 1.3), 0);
  const start = at(0);
  let repeats = 0;
  for (let t = 1; t < 600; t += 0.5) if (Math.abs(at(t) - start) < 1e-6) repeats++;
  assert(repeats === 0, `drift repeated ${repeats} times inside 10 minutes`);
});

// ---------------------------------------------------------------------------
console.log("\n[contract] structural invariants (source assertions)");
// ---------------------------------------------------------------------------

const room3d = src("js/room3d.js");
const director3d = src("js/director3d.js");

test("ceiling is NOT in SURFACE_IDS", () => {
  const line = room3d.match(/const SURFACE_IDS = \[[^\]]*\]/)[0];
  assert(!/ceiling/i.test(line), `ceiling leaked into SURFACE_IDS: ${line}`);
  assert(/const ceiling = new THREE\.Mesh/.test(room3d), "ceiling mesh missing entirely");
});

test("ceiling cannot reach assignments, estimates or the specification", () => {
  // Everything customer-facing iterates SURFACE_IDS or `applied`; the ceiling
  // is in neither, so there is no path by which it becomes a priced line.
  assert(!/applied\s*\[\s*["']ceiling/.test(room3d), "ceiling written into applied[]");
  assert(!/surfaceRecs\s*\[\s*["']ceiling/.test(room3d), "ceiling registered as a product surface");
});

test("the glass path never writes product state", () => {
  const start = room3d.indexOf("function applyGlass");
  const end = room3d.indexOf("function withOpaqueSurfaces");
  assert(start > 0 && end > start, "could not locate the glass block");
  const block = room3d.slice(start, end);
  assert(!/applied\s*\[/.test(block), "applyGlass touches applied[]");
  assert(!/\.product\s*=/.test(block), "applyGlass assigns a product");
});

test("applied[] is written only by applySurface", () => {
  const writes = [...room3d.matchAll(/applied\[[^\]]+\]\s*=/g)];
  const applyStart = room3d.indexOf("function applySurface");
  const applyEnd = room3d.indexOf("function updateAriaLabel");
  for (const m of writes) {
    assert(m.index > applyStart && m.index < applyEnd,
      `applied[] written outside applySurface at offset ${m.index}`);
  }
  assert(writes.length >= 1, "expected applySurface to write applied[]");
});

test("the masked reveal is render-only and releases every temporary resource", () => {
  const start = room3d.indexOf("function finishSurfaceReveal");
  const end = room3d.indexOf("function beginSurfaceReveal");
  assert(start > 0 && end > start, "could not locate masked reveal cleanup");
  const cleanup = room3d.slice(start, end);
  assert(!/applied\s*\[/.test(cleanup), "reveal cleanup mutates product state");
  assert(/rec\.mesh\.remove\(reveal\.overlay\)/.test(cleanup), "overlay is not removed");
  assert(/reveal\.material\.dispose\(\)/.test(cleanup), "temporary material is not disposed");
  assert(/reveal\.mask\.dispose\(\)/.test(cleanup), "temporary mask is not disposed");
  assert(/else reveal\.texture\.dispose\(\)/.test(cleanup), "cancelled target texture is leaked");
});

test("masked reveals are on-demand, interruptible, and bypassed during restoration", () => {
  assert(/finishSurfaceReveal\(rec, true\);[\s\S]{0,220}applied\[sid\]/.test(room3d),
    "a newer surface choice does not settle its predecessor");
  assert(/if \(updateSurfaceReveals\(dt\)\) again = true;/.test(room3d),
    "the render loop does not stay alive only while a reveal is active");
  assert(/groutWidthMm: a\.groutWidthMm,[\s\S]{0,40}\}, false\);/.test(room3d),
    "restored assignments animate instead of mounting at their final state");
  assert(/if \(reducedMotion\)[\s\S]{0,160}finishSurfaceReveal\(rec, true\)/.test(room3d),
    "reduced motion does not settle an active reveal immediately");
});

test("capture is a reversible transaction that restores on throw", () => {
  assert(/function withOpaqueSurfaces/.test(room3d), "withOpaqueSurfaces missing");
  const start = room3d.indexOf("function withOpaqueSurfaces");
  const block = room3d.slice(start, start + 2200);
  assert(/catch\s*\(err\)\s*{\s*restore\(\);/.test(block), "no restore on synchronous throw");
  assert(/\(e\) => { restore\(\); throw e; }/.test(block), "no restore on async rejection");
  assert(!/forceOpaqueSurfaces\s*\(\)/.test(room3d), "the one-way guard still exists");
});

test("disposal marks destroyed BEFORE cancelling, so no verb can re-arm", () => {
  const start = director3d.indexOf("dispose() {");
  const block = director3d.slice(start, start + 400);
  const d = block.indexOf("destroyed = true");
  const c = block.indexOf('cancel("disposed")');
  assert(d > -1 && c > -1, "dispose does not both mark and cancel");
  assert(d < c, "destroyed must be set before cancel to close the race");
});

test("every verb refuses to arm motion after disposal", () => {
  for (const verb of ["focusSurface", "inspectMaterial", "orbitSelection", "followGroutLine", "returnToOverview", "revealRoom"]) {
    const i = director3d.indexOf(`function ${verb}(`);
    assert(i > 0, `${verb} missing`);
    const head = director3d.slice(i, i + 260);
    assert(/if \(destroyed\) return makeResult/.test(head), `${verb} lacks a disposal guard`);
  }
});

test("the payoff reveal is a finite goto, never an automatic standing orbit", () => {
  const i = director3d.indexOf("function revealRoom");
  const block = director3d.slice(i, i + 520);
  assert(i > 0, "revealRoom missing");
  assert(/return goto\(/.test(block), "reveal does not use the interruptible finite move path");
  assert(!/orbitSelection|playTour/.test(block), "the automatic payoff entered a standing motion state");
});

test("unknown targets report ok:false instead of failing silently", () => {
  assert(/return makeResult\(target, false, "unknown-target"\)/.test(director3d),
    "no unknown-target result path");
  assert(/result\._finish\("cancelled", reason\)/.test(director3d) || /if \(!ok\) result\._finish/.test(director3d),
    "a failed result never settles its promise");
});

test("a new move supersedes rather than queues", () => {
  const i = director3d.indexOf("function goto(");
  const block = director3d.slice(i, i + 700);
  assert(/cancel\("superseded"\)/.test(block), "goto does not cancel the previous move");
});

test("resize cancels the pending result without moving the camera", () => {
  const i = room3d.indexOf("function resize()");
  const block = room3d.slice(i, i + 900);
  assert(/director\.cancel\("resized"\)/.test(block), "resize does not cancel");
  assert(!/camera\.position\.set/.test(block), "resize must not reposition the camera");
});

test("engine constants match the values these tests assume", () => {
  const g = room3d.match(/const GLASS = \{[\s\S]*?\};/)[0];
  for (const [k, v] of Object.entries(GLASS)) {
    assert(new RegExp(`${k}:\\s*${v}`).test(g), `GLASS.${k} is no longer ${v} — update the tests`);
  }
});

test("walls receive but never cast shadows", () => {
  const i = room3d.indexOf("const surfaceRecs = {}");
  const block = room3d.slice(i, i + 900);
  assert(/receiveShadow = true/.test(block), "walls should receive shadow");
  assert(!/castShadow = true/.test(block), "a transparent wall must not cast an opaque shadow");
});

// ---------------------------------------------------------------------------
console.log("\n[contract] the ambient showcase (room tour) and idle-return");
// ---------------------------------------------------------------------------

test("playTour and stopTour are standing states, not one-shot moves", () => {
  const start = director3d.indexOf("function playTour");
  assert(start > 0, "playTour missing");
  const block = director3d.slice(start, start + 700);
  assert(/orbit = null/.test(block), "playTour does not clear a conflicting orbit");
  assert(/activeMove = makeResult\("tour"/.test(block), "playTour's result must be linked to activeMove, or it can never resolve as cancelled");
});

test("goto() clears both standing states, not just the active-move promise", () => {
  // The bug this guards: cancel() only resolves activeMove's PROMISE. Without
  // goto() also nulling `orbit`/`tour`, update()'s standing-state branch would
  // keep overwriting the position goto() just set, on every following frame.
  const start = director3d.indexOf("function goto(pos, target, time, name)");
  const block = director3d.slice(start, start + 800);
  assert(/orbit = null/.test(block) && /tour = null/.test(block),
    "goto() does not clear orbit/tour — a running tour would fight a fresh chapter move");
});

test("every exit path (yieldToUser, settleIntoDrift, returnToOverview) clears the tour", () => {
  for (const fn of ["function yieldToUser", "function settleIntoDrift", "function returnToOverview"]) {
    const start = director3d.indexOf(fn);
    assert(start > 0, `${fn} missing`);
    const block = director3d.slice(start, start + 300);
    assert(/tour = null/.test(block), `${fn} does not clear tour`);
  }
});

test("tour and settle are both excluded from the settled-promise check", () => {
  assert(/if \(activeMove && !orbit && !tour\)/.test(director3d),
    "a standing state must never be reported as settled — it ends by being stopped or superseded, not by arriving");
});

test("the room's idle-return defaults to settleIntoDrift when no chapter owns it", () => {
  // /soba3d (the free-form room) passes no onIdleReturn — the free-form room
  // must keep its original "breathe wherever the user left it" behaviour.
  const i = room3d.indexOf("function armIdleReturn");
  const block = room3d.slice(i, i + 500);
  assert(/typeof onIdleReturn === "function"/.test(block), "no fallback branch for a caller that supplied no callback");
  assert(/director\.settleIntoDrift\(\)/.test(block), "missing the unchanged free-form fallback");
});

test("a re-grab during the idle grace period cancels the pending return", () => {
  const i = room3d.indexOf("function onCinematicGrab");
  const block = room3d.slice(i, i + 300);
  assert(/clearTimeout\(idleReturnTimer\)/.test(block),
    "onCinematicGrab must cancel any pending return unconditionally, or a second look-around stroke gets yanked back mid-gesture");
});

test("the idle-return timer is cleared on disposal", () => {
  const i = room3d.indexOf("dispose() {");
  const block = room3d.slice(i, i + 1500);
  assert(/clearTimeout\(idleReturnTimer\)/.test(block),
    "an armed return firing after dispose() would touch a destroyed renderer");
});

test("the guide never uses utilitarian control vocabulary in user-visible copy", () => {
  const atelier = src("js/views/atelier.js");
  // Spot-check the specific phrasing this was corrected away from — a raw
  // regression here means the premium-vocabulary instruction silently eroded.
  assert(!/>\s*Play tour\s*</i.test(atelier), "a 'Play tour' label leaked into markup");
  assert(!/window\.confirm/.test(atelier), "a native confirm() dialog leaked back in — it reads as raw OS chrome inside a glass UI");
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
