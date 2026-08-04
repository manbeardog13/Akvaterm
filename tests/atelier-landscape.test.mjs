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

test("landscape is a full-bleed room with one right-side decision lens", () => {
  assert.match(atelier, /@media\(min-width:560px\) and \(orientation:landscape\)/);
  assert.match(atelier, /\.atl-root\{position:fixed;inset:0;height:auto;min-height:100dvh\}/);
  assert.match(atelier, /\.atl-stage\{inset:0;border-radius:0;background:#020403\}/);
  assert.match(atelier, /\.atl-guide\{[\s\S]*left:auto;right:max\(16px,[\s\S]*width:min\(360px,42vw\)/);
  assert.match(atelier, /backdrop-filter:blur\(14px\) saturate\(145%\) brightness\(\.91\)/);
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
  assert.match(atelier, /width:min\(330px,48vw\)/);
});

test("landscape motion never animates blur and offers a still alternative", () => {
  const motion = atelier.slice(atelier.indexOf("@media(min-width:560px) and (orientation:landscape) and (prefers-reduced-motion:no-preference)"));
  assert.match(motion, /atl-room-enter[\s\S]*atl-workspace-control-in/);
  assert.doesNotMatch(motion.slice(0, motion.indexOf("</style>")), /@keyframes[^}]+\{[^}]*filter:/);
  assert.match(atelier, /@media \(prefers-reduced-motion:reduce\)/);
});

test("the room amenity uses human language rather than a technical mode label", () => {
  assert.match(i18n, /"atelier\.panorama": "Pogled 360°"/);
  assert.match(i18n, /"atelier\.panoramaLabel": "Pokreni pogled kroz prostor"/);
});
