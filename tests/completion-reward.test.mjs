import {
  COMPLETION_REWARD_KEY, completionRewardSignature, createCompletionRewardRegistry,
} from "../js/completion-reward.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const atelier = readFileSync(join(ROOT, "js/views/atelier.js"), "utf8");

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failures.push({ name, err }); console.log(`  FAIL ${name}\n       ${err.message}`); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    value(key) { return values.get(key); },
  };
}

console.log("\n[behaviour] finite completion reward");

test("semantically identical commissions have the same signature", () => {
  const a = { room: { widthM: 3, depthM: 2 }, decisions: { wall: "tile-a" } };
  const b = { decisions: { wall: "tile-a" }, room: { depthM: 2, widthM: 3 } };
  assert(completionRewardSignature(a) === completionRewardSignature(b),
    "object insertion order changed the completion identity");
});

test("a materially revised commission gets a different signature", () => {
  const a = { room: { widthM: 3 }, decisions: { wall: "tile-a" } };
  const b = { room: { widthM: 3 }, decisions: { wall: "tile-b" } };
  assert(completionRewardSignature(a) !== completionRewardSignature(b),
    "a changed product must be eligible for a newly earned reward");
});

test("the same completed commission is claimed once", () => {
  const registry = createCompletionRewardRegistry(memoryStorage());
  const commission = { decisions: { floor: "tile-a" } };
  assert(registry.claim(commission) === true, "first completion did not earn its reward");
  assert(registry.claim(commission) === false, "a revisit replayed the reward");
});

test("session storage prevents replay after a view remount", () => {
  const storage = memoryStorage();
  const commission = { decisions: { floor: "tile-a", basin: "basin-b" } };
  assert(createCompletionRewardRegistry(storage).claim(commission), "first mount did not claim");
  assert(!createCompletionRewardRegistry(storage).claim(commission), "remount replayed the same completion");
  assert(JSON.parse(storage.value(COMPLETION_REWARD_KEY)).length === 1,
    "completion history was not persisted as one bounded signature");
});

test("stored reward history stays bounded", () => {
  const storage = memoryStorage();
  const registry = createCompletionRewardRegistry(storage);
  for (let i = 0; i < 20; i++) registry.claim({ revision: i });
  assert(JSON.parse(storage.value(COMPLETION_REWARD_KEY)).length === 12,
    "completion history grew beyond its twelve-signature budget");
});

test("blocked storage still prevents duplicate rewards in memory", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  const registry = createCompletionRewardRegistry(blocked);
  const commission = { decisions: { floor: "tile-a" } };
  assert(registry.claim(commission), "blocked storage suppressed the first reward");
  assert(!registry.claim(commission), "blocked storage caused an in-session replay");
});

test("only a genuinely ready summary can claim the reward", () => {
  assert(/const celebrate = completion\.ready && completionRewards\.claim\(/.test(atelier),
    "the view can celebrate before proposal readiness is true");
});

test("the visual ritual is finite, decorative, and motion-query gated", () => {
  const mediaStart = atelier.indexOf("@media (prefers-reduced-motion:no-preference)");
  const keyframesStart = atelier.indexOf("@keyframes atl-completion-trace");
  const animationBlock = atelier.slice(mediaStart, keyframesStart);
  assert(mediaStart > 0 && keyframesStart > mediaStart, "completion animations escaped the no-preference query");
  assert(/atl-payoff\.is-celebrating/.test(animationBlock), "completion animation is not tied to the one-shot class");
  assert(!/infinite/.test(animationBlock), "completion reward became a perpetual animation");
  assert(/atl-completion-bloom[^>]+aria-hidden="true"/.test(atelier),
    "decorative bloom entered the accessibility tree");
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
