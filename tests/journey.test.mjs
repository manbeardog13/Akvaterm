// ============================================================================
// tests/journey.test.mjs — the commissioning journey's sequencing rules.
//
//     node tests/journey.test.mjs
//
// Pure Node: js/journey.js has no DOM and no three.js, which is the reason the
// rules that decide a customer's path can be proved without a browser.
//
// The rule under most of these tests is the one that matters commercially:
// revisiting a decision must never destroy the work that followed it. A guided
// flow that punishes a change of mind is one people abandon.
// ============================================================================

import { createJourney, BATHROOM_V0, INTENT } from "../js/journey.js";

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failures.push(name); console.log(`  FAIL ${name}\n       ${err.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log("\n[definition] the bathroom journey is coherent");

test("chapters are ordered by decision weight, direction first", () => {
  const ids = BATHROOM_V0.chapters.map((c) => c.id);
  assert(ids[0] === "smjer", `expected direction first, got ${ids[0]}`);
  assert(ids[ids.length - 1] === "ponuda", "proposal must be last");
  assert(ids.indexOf("pod") < ids.indexOf("zidovi"), "floor anchors the palette, so it precedes walls");
});

test("every chapter names a real catalogue category or none at all", () => {
  const real = new Set(["keramika", "sanitarije", "armature", "grijanje", "klima"]);
  for (const c of BATHROOM_V0.chapters) {
    if (c.category) assert(real.has(c.category), `${c.id} names unknown category ${c.category}`);
  }
});

test("every camera intent is a real director verb", () => {
  const verbs = new Set(Object.values(INTENT));
  for (const c of BATHROOM_V0.chapters) {
    assert(verbs.has(c.intent), `${c.id} has unknown intent ${c.intent}`);
  }
});

test("surface chapters target real room3d surfaces", () => {
  const real = new Set(["floor", "wallN", "wallS", "wallE", "wallW"]);
  for (const c of BATHROOM_V0.chapters) {
    if (c.kind !== "surface") continue;
    for (const surface of (c.surfaces || [c.surface])) {
      assert(real.has(surface), `${c.id} targets unknown surface ${surface}`);
    }
  }
});

test("the wall decision covers and prices all four walls", () => {
  const j = createJourney();
  j.decide("zidovi", { productId: "ker-02" });
  const ids = Object.keys(j.assignments()).sort();
  assert(ids.join(",") === "wallE,wallN,wallS,wallW", `wall coverage is partial: ${ids}`);
});

console.log("\n[flow] advancing and blocking");

test("a required chapter blocks advance until answered", () => {
  const j = createJourney();
  j.decide("smjer", { optionId: "mirno" });
  j.next();                                   // -> pod (required)
  assert(j.current().chapter.id === "pod", "should be on the floor chapter");
  assert(!j.canAdvance(), "unanswered required chapter must block");
  j.decide("pod", { productId: "ker-01" });
  assert(j.canAdvance(), "answered chapter must unblock");
});

test("an optional chapter never blocks", () => {
  const j = createJourney();
  for (const [id, p] of [["smjer", { optionId: "toplo" }], ["pod", { productId: "ker-01" }],
                         ["zidovi", { productId: "ker-02" }], ["sanitarije", { fixtures: ["vanity"] }]]) {
    j.decide(id, p); j.next();
  }
  assert(j.current().chapter.id === "komfor", `expected komfor, got ${j.current().chapter.id}`);
  assert(j.canAdvance(), "an optional chapter must be skippable — deferring is not failing");
});

test("direction is a real decision, not a skippable welcome screen", () => {
  const j = createJourney();
  assert(!j.canAdvance(), "the journey must begin with an intentional direction");
  j.decide("smjer", { optionId: "toplo" });
  assert(j.canAdvance(), "choosing a direction must open the path forward");
});

test("an empty required equipment selection is not an answer", () => {
  const j = createJourney();
  j.revise("sanitarije");
  j.decide("sanitarije", { productIds: [] });
  assert(!j.isAnswered("sanitarije"), "empty multi-select must stay incomplete");
  j.decide("sanitarije", { productIds: ["san-01", "san-03"] });
  assert(j.isAnswered("sanitarije"), "one or more selected products must answer the chapter");
});

test("back never loses a decision", () => {
  const j = createJourney();
  j.decide("smjer", { optionId: "mirno" });
  j.next();
  j.decide("pod", { productId: "ker-05" });
  j.back();
  j.next();
  assert(j.current().decision.productId === "ker-05", "decision was lost on back/forward");
});

console.log("\n[revision] changing your mind must not destroy work");

test("revising the direction marks material chapters stale, never deletes them", () => {
  const j = createJourney();
  j.decide("smjer", { optionId: "mirno" });
  j.decide("pod", { productId: "ker-01" });
  j.decide("zidovi", { productId: "ker-02" });
  j.decide("sanitarije", { fixtures: ["vanity", "wc"] });

  j.decide("smjer", { optionId: "izrazito" });   // the change of mind

  assert(j.isAnswered("pod") === false, "floor should now read as stale");
  assert(j.current, "journey still usable");
  // The decisions themselves survive — that is the whole contract.
  assert(j.assignments().floor.productId === "ker-01", "the floor choice must still exist");
  assert(j.assignments().floor.stale === true, "and must be flagged stale");
});

test("fixtures are NOT staled by a direction change", () => {
  const j = createJourney();
  j.decide("smjer", { optionId: "mirno" });
  j.decide("sanitarije", { fixtures: ["vanity"] });
  j.decide("smjer", { optionId: "toplo" });
  assert(j.isAnswered("sanitarije"), "a mood change has no bearing on which fixtures exist");
});

test("affectedBy reports the damage BEFORE the customer commits", () => {
  const j = createJourney();
  j.decide("smjer", { optionId: "mirno" });
  j.decide("pod", { productId: "ker-01" });
  j.decide("zidovi", { productId: "ker-02" });
  const affected = j.affectedBy("smjer");
  assert(affected.includes("pod") && affected.includes("zidovi"),
    `expected both material chapters, got ${affected}`);
  // Reporting must not itself change anything.
  assert(j.isAnswered("pod"), "asking what would be affected must not stale it");
});

test("re-answering a staled chapter clears its stale flag", () => {
  const j = createJourney();
  j.decide("smjer", { optionId: "mirno" });
  j.decide("pod", { productId: "ker-01" });
  j.decide("smjer", { optionId: "izrazito" });
  assert(!j.isAnswered("pod"), "precondition: stale");
  j.decide("pod", { productId: "ker-09" });
  assert(j.isAnswered("pod"), "re-answering must clear stale");
  assert(j.assignments().floor.stale === false, "and clear it in the assignments too");
});

test("revise() on an unknown chapter reports rather than throws", () => {
  const j = createJourney();
  const r = j.revise("nonexistent");
  assert(r.ok === false && r.reason === "unknown-chapter", "must report, not throw");
});

console.log("\n[progress] motivating, and honest");

test("progress never starts at zero", () => {
  const j = createJourney();
  assert(j.progress().fraction > 0, "a fresh journey must not read as 0%");
});

test("progress rises with each answer and never exceeds 1", () => {
  const j = createJourney();
  let last = j.progress().fraction;
  for (const [id, p] of [["smjer", { optionId: "mirno" }], ["pod", { productId: "ker-01" }],
                         ["zidovi", { productId: "ker-02" }]]) {
    j.decide(id, p);
    const f = j.progress().fraction;
    assert(f > last, `progress did not rise after ${id}`);
    assert(f <= 1, `progress exceeded 1: ${f}`);
    last = f;
  }
});

test("staleness is surfaced in progress, not hidden", () => {
  const j = createJourney();
  j.decide("smjer", { optionId: "mirno" });
  j.decide("pod", { productId: "ker-01" });
  j.decide("smjer", { optionId: "izrazito" });
  assert(j.progress().staleCount === 1, "a stale chapter must be counted, not quietly dropped");
});

test("proposal readiness requires every required answer to be current", () => {
  const j = createJourney();
  assert(!j.completion().ready, "a fresh journey cannot be quote-ready");
  j.decide("smjer", { optionId: "mirno" });
  j.decide("pod", { productId: "ker-01" });
  j.decide("zidovi", { productId: "ker-02" });
  j.decide("sanitarije", { productIds: ["san-01"] });
  assert(j.completion().ready, `complete journey was not ready: ${j.completion().missing}`);
  j.decide("smjer", { optionId: "izrazito" });
  assert(!j.completion().ready, "stale surfaces cannot masquerade as quote-ready");
});

console.log("\n[persistence] a commission survives a reload");

test("toJSON/restore round-trips including staleness", () => {
  const a = createJourney();
  a.decide("smjer", { optionId: "mirno" });
  a.decide("pod", { productId: "ker-01" });
  a.decide("smjer", { optionId: "izrazito" });
  a.setRoom({ widthM: 3.1 });
  const saved = JSON.parse(JSON.stringify(a.toJSON()));   // must survive JSON

  const b = createJourney();
  const r = b.restore(saved);
  assert(r.ok, `restore failed: ${r.reason}`);
  assert(b.assignments().floor.productId === "ker-01", "decision lost across restore");
  assert(b.assignments().floor.stale === true, "staleness lost across restore (Set vs JSON)");
  assert(b.room.widthM === 3.1, "room dimensions lost across restore");
});

test("restoring a different journey is refused, not silently merged", () => {
  const j = createJourney();
  const r = j.restore({ journeyId: "kuhinja-v9", index: 0, decisions: {} });
  assert(r.ok === false && r.reason === "journey-mismatch", "must refuse a foreign save");
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exit(1);
