// Portrait/mobile .atl-guide sizing — regression coverage for the overlay
// bug the operator reported live ("covers 99.999999999% of the screen"),
// confirmed by three independent audit passes (user-friendly, design and
// message-integrity lenses) to be a real 66-85% viewport-area occlusion of
// the 3D room the guide is supposed to float over, on 2026-08-05.

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

test("the base (portrait) guide is height-capped instead of near-full-screen", () => {
  const base = rule(atelier, ".atl-guide{");
  assert.doesNotMatch(base, /max-height:calc\(100% - 104px\)/, "the uncapped 100%-104px height budget must be gone");
  assert.match(base, /max-height:min\(52dvh,400px\)/);
});

test("the summary variant inherits the same height cap and cannot bleed past the viewport width", () => {
  assert.match(atelier, /\.atl-guide\.is-summary\{max-width:min\(540px,92vw\)/);
  const summaryRule = rule(atelier, ".atl-guide.is-summary{");
  assert.doesNotMatch(summaryRule, /max-height/, "is-summary must not re-widen the inherited base max-height");
});

test("the >=720px override restores a right margin too, not just left/bottom", () => {
  assert.match(atelier, /@media\(min-width:720px\)\{ \.atl-guide\{ left:24px; right:max\(24px,env\(safe-area-inset-right,0px\)\); bottom:24px; \} \}/);
});

test("the options list leaves real room for eyebrow/question/help/nav inside the shrunk frame", () => {
  const options = rule(atelier, ".atl-options{");
  assert.match(options, /max-height:min\(168px,22dvh\)/);
});

test("nav (Dalje/Natrag) stays reachable without discovering an internal scroll first", () => {
  const nav = rule(atelier, ".atl-nav{");
  assert.match(nav, /position:sticky;bottom:-1px/);
  assert.doesNotMatch(atelier, /\.atl-guide\.is-summary \.atl-nav\{/, "sticky nav should no longer be is-summary-only");
});

test("landscape's own corner-pinned recipe is untouched by the portrait fix", () => {
  assert.match(atelier, /\.atl-guide\{[\s\S]*left:auto;right:max\(16px,[\s\S]*width:min\(360px,42vw\)/);
});
