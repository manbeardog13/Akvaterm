// Pure regression coverage for the journey -> room -> proposal seam.
// No browser and no three.js required.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BATHROOM_V0 } from "../js/journey.js";
import {
  buildCommission, buildFixturePlan, decisionProductIds,
  productsForChapter, rankProductsForDirection, surfaceAreaM2, toggleProductChoice,
} from "../js/commissioning.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const products = JSON.parse(readFileSync(join(ROOT, "data/catalog.seed.json"), "utf8"));
const chapter = (id) => BATHROOM_V0.chapters.find((item) => item.id === id);

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

console.log("\n[choices] equipment behaves like a room, not a radio group");

test("fixture chapters can span heating and cooling categories", () => {
  const list = productsForChapter(chapter("komfor"), products);
  assert(list.some((p) => p.category === "grijanje"), "heating products missing");
  assert(list.some((p) => p.category === "klima"), "cooling products missing");
});

test("choosing an alternative replaces only its own fixture role", () => {
  const sanitary = chapter("sanitarije");
  let ids = toggleProductChoice(sanitary, null, "san-01");       // WC
  ids = toggleProductChoice(sanitary, { productIds: ids }, "san-03"); // basin
  ids = toggleProductChoice(sanitary, { productIds: ids }, "san-04"); // another basin
  assert(ids.includes("san-01"), "changing basin removed the WC");
  assert(!ids.includes("san-03") && ids.includes("san-04"), "basin alternative was not replaced");
});

test("old single-product drafts remain readable", () => {
  const ids = decisionProductIds({ productId: "san-03" });
  assert(ids.length === 1 && ids[0] === "san-03", `legacy product lost: ${ids}`);
});

test("direction ranks suggestions without removing catalogue choices", () => {
  const tiles = products.filter((product) => product.category === "keramika");
  const calm = rankProductsForDirection(tiles, "mirno");
  const dramatic = rankProductsForDirection(tiles, "izrazito");
  assert(calm.length === tiles.length && dramatic.length === tiles.length, "direction filtered products out");
  assert(calm[0].id !== dramatic[0].id, "opposing directions produced the same leading suggestion");
});

console.log("\n[proposal] the finished project has truthful quantities and money");

test("east/west wall area uses room depth, not width", () => {
  close(surfaceAreaM2("wallE", { widthM: 4, depthM: 2, heightM: 2.5 }), 5, 1e-9,
    "east wall area is wrong");
});

test("one wall decision becomes one proposal line covering all four walls", () => {
  const tile = products.find((p) => p.id === "ker-02");
  const assignments = Object.fromEntries(["wallN", "wallE", "wallS", "wallW"]
    .map((surface) => [surface, { productId: tile.id, stale: false }]));
  const result = buildCommission({
    chapters: BATHROOM_V0.chapters,
    decisions: { zidovi: { productId: tile.id } },
    assignments,
    room: { widthM: 2.4, depthM: 2, heightM: 2.6 },
    products,
  });
  assert(result.surfaces.length === 1, `expected one grouped wall line, got ${result.surfaces.length}`);
  close(result.surfaces[0].areaM2, 22.88, 1e-9, "four-wall area is wrong");
});

test("tile totals include reserve and equipment prices are added once", () => {
  const tile = products.find((p) => p.id === "ker-01");
  const wc = products.find((p) => p.id === "san-01");
  const result = buildCommission({
    chapters: BATHROOM_V0.chapters,
    decisions: {
      smjer: { optionId: "mirno" },
      pod: { productId: tile.id },
      sanitarije: { productIds: [wc.id] },
    },
    assignments: { floor: { productId: tile.id, pattern: "grid", stale: false } },
    room: { widthM: 2.4, depthM: 2, heightM: 2.6 },
    products,
  });
  const orderedM2 = 5.28; // 4.8 m² + the domain contract's 10% grid reserve
  const expected = Math.round((tile.priceM2 * orderedM2 + wc.priceUnit) * 100) / 100;
  close(result.total, expected, 1e-9, "commission total is wrong");
  assert(result.total > 0, "the old zero-total regression returned");
});

console.log("\n[room] selected products become honest, stable geometry");

test("only products with an honest analogue enter the 3D fixture plan", () => {
  const plan = buildFixturePlan({
    chapters: BATHROOM_V0.chapters,
    decisions: { sanitarije: { productIds: ["san-01", "san-02", "san-03"] } },
    room: BATHROOM_V0.room,
    catalogue: [
      { type: "wcModerni", sizeM: [0.36, 0.66, 0.66] },
      { type: "umivaonikViseci", sizeM: [0.6, 0.5, 0.46] },
    ],
  });
  assert(plan.length === 2, `expected WC + basin geometry, got ${plan.length}`);
  assert(!plan.some((f) => f.productId === "san-02"), "a WC seat was misrepresented as a room fixture");
});

test("a moved fixture keeps its placement when another choice renders", () => {
  const previous = [{
    type: "wcModerni", productId: "san-01", chapterId: "sanitarije",
    x: 1.23, z: 0.71, rotY: 1.2, ax: 0, az: 0,
  }];
  const plan = buildFixturePlan({
    chapters: BATHROOM_V0.chapters,
    decisions: { sanitarije: { productIds: ["san-01"] } },
    room: BATHROOM_V0.room,
    catalogue: [{ type: "wcModerni", sizeM: [0.36, 0.66, 0.66] }],
    previous,
  });
  assert(plan[0].x === 1.23 && plan[0].rotY === 1.2, "customer placement was reset");
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
