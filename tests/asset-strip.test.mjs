// Deterministic coverage for Atelier's floating asset-strip drift/index math.
// No DOM is required: js/asset-strip.js keeps the arithmetic separate from
// its own pointer/rAF wiring, the same split js/live-grout.js uses for the
// grout shader math versus room3d.js's DOM/GL side.

import { ASSET_STRIP_DRIFT, nextDriftOffset, nearestCardIndex } from "../js/asset-strip.js";

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

console.log("\n[drift] auto-crawl is continuous and frame-rate independent");

function travel(fps, seconds, offset, bounds, direction) {
  let o = offset, d = direction;
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    ({ offset: o, direction: d } = nextDriftOffset(o, dt, ASSET_STRIP_DRIFT.speedPxPerSec, bounds, d));
  }
  return { offset: o, direction: d };
}

test("30/60/120 fps drift the same visible distance in equal wall-clock time", () => {
  const bounds = { min: -2000, max: 0 };
  // 0.5s is an exact whole-frame interval at all three refresh rates, and
  // well short of hitting either bound at the crawling drift speed.
  const a = travel(30, 0.5, 0, bounds, -1);
  const b = travel(60, 0.5, 0, bounds, -1);
  const c = travel(120, 0.5, 0, bounds, -1);
  close(a.offset, b.offset, 1e-9, "30 vs 60 fps diverged");
  close(b.offset, c.offset, 1e-9, "60 vs 120 fps diverged");
  assert(a.offset < 0, "drift did not move right-to-left (offset should decrease)");
});

test("reaching a bound reverses direction and reflects the overshoot back in, never overshoots past it", () => {
  const bounds = { min: -20, max: 0 };
  // One huge frame (a stalled tab) would fling a naive integrator way past
  // the bound; the reflection must still land inside [min, max].
  const { offset, direction } = nextDriftOffset(-15, 2, ASSET_STRIP_DRIFT.speedPxPerSec, bounds, -1);
  assert(offset >= bounds.min && offset <= bounds.max, `offset ${offset} escaped [${bounds.min}, ${bounds.max}]`);
  assert(direction === 1, "direction did not reverse at the lower bound");
});

test("ping-pongs indefinitely between both ends without ever wrapping", () => {
  const bounds = { min: -50, max: 0 };
  let offset = 0, direction = -1;
  let sawMin = false, sawMax = false;
  for (let i = 0; i < 400; i += 1) {
    ({ offset, direction } = nextDriftOffset(offset, 0.25, ASSET_STRIP_DRIFT.speedPxPerSec, bounds, direction));
    assert(offset >= bounds.min - 1e-9 && offset <= bounds.max + 1e-9, `escaped bounds at step ${i}: ${offset}`);
    if (offset <= bounds.min + 1e-6) sawMin = true;
    if (offset >= bounds.max - 1e-6) sawMax = true;
  }
  assert(sawMin && sawMax, "never reached both ends across 100s of simulated drift");
});

test("a track shorter than its viewport (min === max) never drifts anywhere", () => {
  const bounds = { min: 0, max: 0 };
  const { offset, direction } = nextDriftOffset(0, 1, ASSET_STRIP_DRIFT.speedPxPerSec, bounds, -1);
  assert(offset === 0, "a non-scrollable strip moved");
  assert(direction === 1, "degenerate bounds did not settle to a stable direction");
});

console.log("\n[index] offset -> nearest card, for drag-release settling and a11y reporting");

test("offset 0 is always card 0", () => {
  assert(nearestCardIndex(0, 120, 6) === 0, "offset 0 did not resolve to the first card");
});

test("a whole card-step offset resolves exactly, not off-by-one", () => {
  assert(nearestCardIndex(-360, 120, 6) === 3, "3 card-widths of offset did not resolve to index 3");
});

test("clamps to the last card rather than reading past the end", () => {
  assert(nearestCardIndex(-9999, 120, 6) === 5, "out-of-range offset was not clamped to the last card");
});

test("zero cards or a zero card-step degrade to index 0, not NaN or a crash", () => {
  assert(nearestCardIndex(-100, 120, 0) === 0, "empty strip did not degrade to 0");
  assert(Number.isFinite(nearestCardIndex(-100, 0, 6)), "zero card-step produced a non-finite index");
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
