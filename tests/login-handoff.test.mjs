import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const splash = fs.readFileSync(new URL("../js/splash.js", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../js/views/prijava.js", import.meta.url), "utf8");
const style = fs.readFileSync(new URL("../js/login-photo-style.js", import.meta.url), "utf8");

test("the phone cue belongs to the existing 700 ms post-login handoff", () => {
  assert.match(splash, /const T_TOTAL = 700/);
  assert.match(splash, /animation:akvOrientationCue " \+ T_TOTAL/);
  assert.match(splash, /@keyframes akvOrientationTurn[^{]*\{[\s\S]*rotate\(90deg\)/);
  assert.match(login, /async function leaveForApp\(\)[\s\S]*playSignInTransition\(\{[\s\S]*orientationCue/);
  assert.doesNotMatch(login.slice(login.indexOf("function render"), login.indexOf("async function leaveForApp")), /buildOrientationCue|akv-orientation-cue/,
    "the cue is mounted while the login screen is still idle");
});

test("the cue is portrait-phone only and never locks orientation", () => {
  assert.match(splash, /height > width && width <= 760 && \(coarse \|\| touch\)/);
  assert.match(splash, /@media \(min-width:761px\),\(orientation:landscape\)/);
  assert.doesNotMatch(splash, /screen\.orientation\.lock|requestFullscreen/);
});

test("reduced motion is static and cleanup owns the overlay", () => {
  assert.match(splash, /akv-orientation-device\{animation:none!important;transform:rotate\(90deg\)\}/);
  assert.match(splash, /\[run\.ghost, run\.seam, run\.orientationCue\]/);
  assert.match(splash, /run\.orientationCue = null/);
});

test("the handoff warms only local modules without gating navigation", () => {
  assert.match(splash, /const HANDOFF_MODULES = \["\.\/views\/katalog\.js", "\.\/views\/atelier\.js", "\.\/views\/savjetnik\.js"\]/);
  assert.match(splash, /link\.rel = "modulepreload"/);
  assert.match(splash, /new URL\(specifier, import\.meta\.url\)\.href/);
  assert.doesNotMatch(splash, /await warmLocalJourneyModules|Promise\.all\(HANDOFF_MODULES/);
});

test("the glass card keeps the operator-requested 75 percent footprint token", () => {
  assert.match(style, /--pr-card-reference-scale:\.75/);
  assert.match(style, /calc\(560px \* var\(--pr-card-reference-scale\)\)/);
  assert.match(style, /backdrop-filter:blur\(24px\)/);
});

test("the approved login photograph is optimized for static delivery", () => {
  const asset = new URL("../assets/images/login-interior-cinematic.webp", import.meta.url);
  const stat = fs.statSync(asset);
  assert.ok(stat.size > 50_000, "the project photograph is unexpectedly empty or placeholder-sized");
  assert.ok(stat.size < 150_000, `the login photograph regressed to ${stat.size} bytes`);
});
