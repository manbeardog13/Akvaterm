import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const atelier = fs.readFileSync(new URL("../js/views/atelier.js", import.meta.url), "utf8");
const globalStyle = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const i18n = fs.readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8");

test("the journey keeps ownership of the full viewport after its opening", () => {
  assert.match(globalStyle, /html\[data-akv-journey\] \.topbar,[\s\S]*html\[data-akv-journey\] \.ai-panel,[\s\S]*html\[data-akv-journey\] #termaBtn\{display:none!important\}/);
  assert.match(globalStyle, /html\[data-akv-journey\] #main\{[\s\S]*position:fixed;inset:0;[\s\S]*max-width:none;min-height:100dvh;[\s\S]*overflow:hidden/);
  assert.match(globalStyle, /html\[data-akv-journey\] #main\.view-enter[\s\S]*animation:none!important/);
});

test("the deliberate menu uses the same optical material without reviving Terma", () => {
  assert.match(globalStyle, /html\[data-akv-journey\] \.side\{[\s\S]*width:min\(280px,76vw\)[\s\S]*backdrop-filter:blur\(16px\) saturate\(145%\) brightness\(\.9\)/);
  assert.match(globalStyle, /linear-gradient\(138deg,rgba\(12,18,14,\.76\),rgba\(4,8,6,\.68\) 72%\)/);
});

test("landscape is a full-bleed room; the bottom floating cluster is the same one portrait uses, no separate right-side card", () => {
  assert.match(atelier, /@media\(min-width:560px\) and \(orientation:landscape\)/);
  assert.match(atelier, /\.atl-root\{position:fixed;inset:0;height:auto;min-height:100dvh\}/);
  assert.match(atelier, /\.atl-stage\{inset:0;border-radius:0;background:#020403\}/);
  // The right-side "decision lens" card this test used to assert on is gone
  // (operator instruction, 2026-08-05, IMG_6516 — that exact card was
  // blocking two-thirds of the room). The landscape media query now only
  // caps .atl-guide's width, reusing the base rule's floating pieces.
  assert.doesNotMatch(atelier, /left:auto;right:max\(16px,[\s\S]{0,80}width:min\(360px,42vw\)/,
    "the removed right-side card must not have come back");
  const landscapeBlock = atelier.slice(
    atelier.indexOf("@media(min-width:560px) and (orientation:landscape){"),
    atelier.indexOf("Compact landscape phones"),
  );
  assert.match(landscapeBlock, /\.atl-guide\{max-width:420px\}/);
});

test("chapter waypoints stay compact without sacrificing touch geometry", () => {
  assert.match(atelier, /class="atl-chip-index"[\s\S]*padStart\(2, "0"\)/);
  assert.match(atelier, /class="atl-chip-label"/);
  assert.match(atelier, /aria-label="\$\{esc\(`\$\{i \+ 1\}\. \$\{c\.title\}`\)\}"/);
  assert.match(atelier, /min-width:44px;width:44px;min-height:44px;height:44px/);
  assert.match(atelier, /\.atl-panorama\{[\s\S]*min-height:44px/);
});

test("compact landscape phones keep the room instead of falling back to portrait", () => {
  assert.match(atelier, /@media\(min-width:560px\) and \(max-width:719px\) and \(orientation:landscape\)/);
  assert.match(atelier, /\.atl-chapters\{display:none\}/);
});

test("landscape motion never animates blur and offers a still alternative", () => {
  const motion = atelier.slice(atelier.indexOf("@media(min-width:560px) and (orientation:landscape) and (prefers-reduced-motion:no-preference)"));
  assert.match(motion, /atl-room-enter[\s\S]*atl-workspace-control-in/);
  assert.doesNotMatch(motion.slice(0, motion.indexOf("</style>")), /@keyframes[^}]+\{[^}]*filter:/);
  assert.match(atelier, /@media \(prefers-reduced-motion:reduce\)/);
});

test("the active room inherits the opening image until WebGL is ready", () => {
  assert.match(atelier, /\.atl-prelude\{[^}]*z-index:1[^}]*pointer-events:none/);
  assert.match(atelier, /\.atl-prelude img\{[^}]*object-position:center 58%[^}]*filter:blur\(16px\) saturate\(1\.10\) brightness\(1\.03\)/);
  assert.match(atelier, /\.atl-guide\{[\s\S]*z-index:2/);
  assert.match(atelier, /function resolveRoomPrelude\(\)[\s\S]*#atl-prelude[\s\S]*is-resolved/);
  assert.match(atelier, /onReady: resolveRoomPrelude/);
});

test("hover polish is restricted to precise pointers so touch cannot stick", () => {
  assert.match(atelier, /@media\(hover:hover\) and \(pointer:fine\)\{[\s\S]*\.atl-bubble:hover[\s\S]*\.atl-panorama:hover/);
});

test("phones without WebGL continue through the same journey on a static room", () => {
  assert.match(atelier, /try \{[\s\S]*await mod\.mountRoom[\s\S]*catch \(error\)/);
  assert.match(atelier, /WebGL room unavailable; continuing with the static room/);
  assert.match(atelier, /mountStaticRoom\(fixtureEventStage, handoffResult\?\.lightMix\)/);
  assert.match(atelier, /\.atl-static-room img\{[^}]*object-fit:cover[^}]*object-position:center 58%/);
  assert.match(atelier, /\.atl\[data-room="static"\] \.atl-panorama\{display:none\}/);
  assert.match(i18n, /"atelier\.staticStage": "Statični prikaz kupaonice"/);
});

test("the room amenity uses human language rather than a technical mode label", () => {
  assert.match(i18n, /"atelier\.panorama": "Pogled 360°"/);
  assert.match(i18n, /"atelier\.panoramaLabel": "Pokreni pogled kroz prostor"/);
});
