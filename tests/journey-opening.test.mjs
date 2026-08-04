import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const opening = fs.readFileSync(new URL("../js/journey-opening.js", import.meta.url), "utf8");
const atelier = fs.readFileSync(new URL("../js/views/atelier.js", import.meta.url), "utf8");
const aidock = fs.readFileSync(new URL("../js/aidock.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("the post-login route opens the journey on black before its blurred room arrives", () => {
  assert.match(opening, /\.aj-opening\{[^}]*background:#000/);
  assert.match(opening, /\.aj-backdrop\{[^}]*opacity:0[^}]*animation:ajBackdropIn/);
  assert.match(opening, /filter:blur\(26px\)/);
  assert.match(opening, /ajDarkCycle 24s/);
  assert.match(opening, /ajLightCycle 24s/);
});

test("the only sharp opening controls are the glass hamburger, question and Terma input", () => {
  assert.match(opening, /class="aj-menu"[\s\S]*<span><\/span><span><\/span><span><\/span>/);
  assert.match(opening, /class="aj-question"/);
  assert.match(opening, /class="aj-glass"/);
  assert.match(opening, /class="aj-terma">Terma</);
  assert.match(opening, /class="aj-input"/);
  assert.doesNotMatch(opening, /Terma AI|class="topbar"|class="tabbar"/);
});

test("Terma streams inside the same glass input and falls back locally", () => {
  assert.match(opening, /for await \(const event of chat/);
  assert.match(opening, /class="aj-response"[^>]*role="status"/);
  assert.match(opening, /if \(!isConfigured\(\)\) \{ paint\(localReply\(direction\)\); return; \}/);
  assert.match(opening, /directionFromBrief/);
});

test("Atelier suppresses legacy chrome and warms heavy local work behind the opening", () => {
  assert.match(atelier, /mountJourneyOpening/);
  assert.match(atelier, /const productsReady = db\.listProducts\(\)/);
  assert.match(atelier, /const roomReady = import\("\.\.\/room3d\.js"\)/);
  assert.match(atelier, /data-akv-journey/);
  assert.match(atelier, /class="atl-menu"[\s\S]*<span><\/span><span><\/span><span><\/span>/);
  assert.match(aidock, /HIDDEN_ROUTES = \['\/savjetnik', '\/prijava', '\/atelier'\]/);
  assert.match(worker, /"\.\/js\/journey-opening\.js"/);
});
