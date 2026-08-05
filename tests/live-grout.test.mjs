// Deterministic coverage for Atelier's continuously adjustable grout finish.
// No DOM, three.js or GPU is required: the browser adapter owns pixels while
// this suite proves timing, interruption and physical-width normalization.

import {
  LIVE_GROUT, advanceLiveGrout, groutHalfUv,
} from "../js/live-grout.js";
import { surfaceFinishForDecision } from "../js/commissioning.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (path) => readFileSync(join(ROOT, path), "utf8");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failures.push(name); console.log(`  FAIL ${name}\n       ${err.message}`); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function close(a, b, epsilon, message) {
  if (Math.abs(a - b) > epsilon) throw new Error(`${message}: ${a} vs ${b}`);
}

console.log("\n[finish] saved material decisions stay valid");

test("old Atelier drafts receive the guided grid-and-grout defaults", () => {
  const finish = surfaceFinishForDecision({ productId: "ker-01" });
  assert(finish.pattern === "grid", `unexpected pattern ${finish.pattern}`);
  assert(finish.groutColorId === "siva", `unexpected colour ${finish.groutColorId}`);
  assert(finish.groutWidthMm === 3, `unexpected width ${finish.groutWidthMm}`);
});

test("unsupported persisted values fail closed to guided presets", () => {
  const finish = surfaceFinishForDecision({
    pattern: "spiral", groutColorId: "ultraviolet", groutWidthMm: 99,
  });
  assert(finish.pattern === "grid", "Atelier exposed an unsupported pattern");
  assert(finish.groutColorId === "siva", "Atelier exposed an unsupported grout colour");
  assert(finish.groutWidthMm === 3, "Atelier exposed an unsupported grout width");
});

console.log("\n[geometry] millimetres become tile-local UVs");

test("a 6 mm joint reserves 3 mm on each side of a tile edge", () => {
  const half = groutHalfUv(6, [600, 300]);
  close(half[0], 3 / 600, 1e-12, "horizontal half-width is wrong");
  close(half[1], 3 / 300, 1e-12, "vertical half-width is wrong");
});

test("invalid dimensions cannot create NaN or cover an entire tile", () => {
  const half = groutHalfUv(Infinity, [0, -20]);
  assert(half.every(Number.isFinite), `non-finite UV widths: ${half}`);
  assert(half.every((value) => value >= 0 && value < 0.5), `unsafe UV widths: ${half}`);
});

console.log("\n[motion] grout is continuous and interruptible");

function travel(fps, seconds, from, target) {
  let value = [...from];
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    value = advanceLiveGrout(value, target, dt).value;
  }
  return value;
}

test("30/60/120 fps reach the same visible finish in equal wall-clock time", () => {
  const from = [2, 0.8, 0.8, 0.8];
  const target = [8, 0.06, 0.06, 0.06];
  // 0.4 s is an exact whole-frame interval at all three refresh rates.
  const a = travel(30, 0.4, from, target);
  const b = travel(60, 0.4, from, target);
  const c = travel(120, 0.4, from, target);
  for (let i = 0; i < 4; i++) {
    close(a[i], b[i], 1e-9, `30 vs 60 fps diverged at ${i}`);
    close(b[i], c[i], 1e-9, `60 vs 120 fps diverged at ${i}`);
  }
});

test("a new target continues from the exact current value", () => {
  const start = [3, 0.5, 0.5, 0.5];
  const first = advanceLiveGrout(start, [8, 0.1, 0.1, 0.1], 0.12).value;
  const redirected = advanceLiveGrout(first, [2, 0.9, 0.9, 0.9], 0).value;
  for (let i = 0; i < 4; i++) close(redirected[i], first[i], 1e-12, `retarget snapped at ${i}`);
});

test("motion settles exactly and reduced motion commits immediately", () => {
  const target = [5, 0.2, 0.3, 0.4];
  let value = [2, 0.9, 0.8, 0.7];
  let done = false;
  for (let i = 0; i < 240 && !done; i++) ({ value, done } = advanceLiveGrout(value, target, 1 / 60));
  assert(done, "live grout chased an asymptote forever");
  assert(value.every((part, i) => part === target[i]), `settled values did not snap exactly: ${value}`);
  const reduced = advanceLiveGrout([2, 1, 1, 1], target, 1 / 60, { reducedMotion: true });
  assert(reduced.done && reduced.value.every((part, i) => part === target[i]), "reduced motion animated");
});

test("the response constant stays in the deliberate material-motion range", () => {
  assert(LIVE_GROUT.tau >= 0.08 && LIVE_GROUT.tau <= 0.18, `unexpected tau ${LIVE_GROUT.tau}`);
});

console.log("\n[contract] the browser adapter stays uniform-only and bounded");

const room3d = src("js/room3d.js");
const gfx3d = src("js/gfx3d.js");
const atelier = src("js/views/atelier.js");
const worker = src("service-worker.js");

test("the shader uses one pinned program and three uniforms", () => {
  assert(/LIVE_GROUT_PROGRAM_KEY = "akv-live-grout-grid-v1"/.test(room3d), "program key is not pinned");
  for (const name of ["uAkvGroutHalf", "uAkvGroutColor", "uAkvTileRepeat"]) {
    assert(room3d.includes(`shader.uniforms.${name}`), `${name} is not a runtime uniform`);
  }
});

test("each grid axis is filtered separately before union", () => {
  assert(/dFdx\( akvGridUv\.x \)[\s\S]{0,100}dFdy\( akvGridUv\.x \)/.test(room3d), "x derivative missing");
  assert(/dFdx\( akvGridUv\.y \)[\s\S]{0,100}dFdy\( akvGridUv\.y \)/.test(room3d), "y derivative missing");
  assert(/akvCoverage\.x \+ akvCoverage\.y - akvCoverage\.x \* akvCoverage\.y/.test(room3d), "axis coverage is not unioned");
  assert(!/fwidth\s*\(\s*min/.test(room3d), "the known diagonal-derivative shimmer path returned");
});

test("live grout is grid-only and leaves the tile canvas ungrouted", () => {
  assert(/opts\.liveGrout === true && pattern === "grid"/.test(gfx3d), "live path is not bounded to grid");
  assert(/const bakedGroutWidthMm = liveGrout \? 0 : normalized\.groutWidthMm/.test(gfx3d), "canvas still bakes live grout");
});

test("grout motion keeps the on-demand render loop alive only while active", () => {
  assert(/if \(updateSurfaceGrout\(dt\)\) again = true;/.test(room3d), "grout is absent from the damage loop");
  assert(/advanceLiveGrout\(state\.current, state\.target, dt/.test(room3d), "engine does not carry current values forward");
});

test("Atelier persists finish decisions and exposes touch-sized controls", () => {
  assert(/journey\.decide\(chapter\.id, \{ productId, \.\.\.surfaceFinishForDecision/.test(atelier), "product choice drops finish state");
  assert(/min-width:44px;min-height:44px/.test(atelier), "grout controls miss the touch target floor");
  assert(/data-grout-color/.test(atelier) && /data-grout-step/.test(atelier), "grout controls are not wired");
});

test("the grout width control is a continuous stepper, not a flat pick-one list (operator instruction, 2026-08-05)", () => {
  assert(/function stepGroutWidth/.test(atelier), "stepGroutWidth() is missing");
  assert(/function groutWidthStepper/.test(atelier), "groutWidthStepper() markup is missing");
  assert(/atl-grout-readout/.test(atelier), "the live current-value readout is missing");
  assert(!/data-grout-width=/.test(atelier), "the old flat pick-one buttons are still present");
  assert(/api\.camera\.followGroutLine\(target\)/.test(atelier), "entering the grout sub-step never calls the existing followGroutLine() camera verb");
});

test("the service worker precaches nothing (retired, operator instruction 2026-08-04)", () => {
  assert(!worker.includes('"./js/live-grout.js"'), "the kill switch must not carry a shell/precache list");
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
