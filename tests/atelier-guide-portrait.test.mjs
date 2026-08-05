// Portrait/mobile floating-guide coverage. Supersedes the earlier same-day
// height-cap fix (2026-08-05, first round: "covers 99.999999999% of the
// screen") — a later screenshot (IMG_6516, landscape) showed the same shrunk
// card was STILL blocking the room, so the card itself was removed in favour
// of small individually-floating glass elements: a question label, an
// auto-drifting bubble strip, and independent nav pills. This file checks
// that removal actually happened and stayed removed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const atelier = fs.readFileSync(new URL("../js/views/atelier.js", import.meta.url), "utf8");

function rule(source, selector) {
  const start = source.indexOf(selector);
  assert.ok(start >= 0, `selector not found: ${selector}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated rule: ${selector}`);
}

test("the base (non-summary) guide is a transparent layout wrapper, not a card", () => {
  const base = rule(atelier, ".atl-guide{");
  assert.doesNotMatch(base, /background:var\(--atl-glass-bg\)/, "the base guide must not carry the old full-card fill");
  assert.match(base, /display:flex;flex-direction:column/);
});

test("the summary/offer step is the one deliberate exception and keeps a real card", () => {
  const summaryRule = rule(atelier, ".atl-guide.is-summary{");
  assert.match(summaryRule, /background:var\(--atl-glass-bg\)/);
  assert.match(summaryRule, /overflow:auto/);
});

test("the question label is its own small floating glass pill, genuinely see-through", () => {
  const group = rule(atelier, ".atl-question-group{");
  assert.match(group, /background:var\(--atl-float-bg\)/, "must use the lighter float recipe, not the heavier is-summary one");
  assert.doesNotMatch(group, /var\(--atl-glass-bg\)/);
});

test("options render as an auto-drifting, swipeable strip of individual bubbles", () => {
  assert.match(atelier, /<div class="atl-strip"><div class="atl-strip-track" id="atl-options"><\/div><\/div>/);
  const track = rule(atelier, ".atl-strip-track{");
  assert.match(track, /will-change:transform/);
  const bubble = rule(atelier, ".atl-bubble{");
  assert.match(bubble, /background:var\(--atl-float-bg\)/);
  assert.match(bubble, /min-height:44px/, "bubbles must not drop below the touch-target floor");
});

test("import asset-strip.js and mount it for non-reduced-motion, skip it under reduced motion", () => {
  assert.match(atelier, /import \{ createAssetStrip \} from "\.\.\/asset-strip\.js"/);
  assert.match(atelier, /if \(!reducedMotion && list\.length > 1\) strip = createAssetStrip/);
  assert.match(atelier, /optionsEl\.classList\.toggle\("is-static", reducedMotion\)/);
});

test("a persistent 'currently chosen' readout survives the selected bubble drifting off-screen", () => {
  assert.match(atelier, /id="atl-strip-current"/);
  assert.match(atelier, /currentEl\.classList\.toggle\("is-shown"/);
});

test("nav (Dalje/Natrag) floats independently of the bottom text+bubble cluster", () => {
  assert.doesNotMatch(atelier, /<div class="atl-nav">[\s\S]{0,50}<button[^>]*id="atl-back"[\s\S]*<\/div>\s*<\/div>\s*<\/div>/,
    "nav must not be nested back inside .atl-guide's markup");
  const navRule = rule(atelier, ".atl-nav{");
  assert.match(navRule, /position:absolute/);
  assert.doesNotMatch(navRule, /position:sticky/, "the old sticky-footer nav treatment must be gone");
});

test("the >=720px override still restores a right margin, not just left/bottom", () => {
  assert.match(atelier, /@media\(min-width:720px\)\{ \.atl-guide\{ left:24px; right:max\(24px,env\(safe-area-inset-right,0px\)\); bottom:24px; \} \}/);
});

test("degradation paths (reduced transparency, forced colors, high contrast) target every new small surface, not the now-transparent .atl-guide", () => {
  const forced = atelier.slice(atelier.indexOf("@media (forced-colors:active){"), atelier.indexOf("@media (forced-colors:active){") + 900);
  assert.match(forced, /\.atl-question-group/);
  assert.match(forced, /\.atl-bubble/);
  assert.match(forced, /\.atl-material/);
});
