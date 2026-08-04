import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const splash = fs.readFileSync(new URL("../js/splash.js", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../js/views/prijava.js", import.meta.url), "utf8");
const style = fs.readFileSync(new URL("../js/login-photo-style.js", import.meta.url), "utf8");
const globalStyle = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the phone cue belongs to the existing 700 ms post-login handoff", () => {
  assert.match(splash, /const T_TOTAL = 700/);
  assert.match(splash, /animation:akvHandoffTurn " \+ T_TOTAL/);
  assert.match(splash, /@keyframes akvHandoffTurn[^{]*\{[\s\S]*rotate\(90deg\)/);
  assert.match(login, /async function leaveForApp\(\)[\s\S]*playSignInTransition\(\{[\s\S]*orientationCue/);
  assert.match(login, /navigate: \(\) => \{ location\.hash = "#\/atelier"; \}/);
  assert.doesNotMatch(login.slice(login.indexOf("function render"), login.indexOf("async function leaveForApp")), /buildOrientationCue|akv-orientation-cue/,
    "the cue is mounted while the login screen is still idle");
});

test("the cue is portrait-phone only and never locks orientation", () => {
  assert.match(splash, /height > width && width <= 760 && \(coarse \|\| touch\)/);
  assert.match(splash, /@media \(min-width:761px\),\(orientation:landscape\)/);
  assert.doesNotMatch(splash, /screen\.orientation\.lock|requestFullscreen/);
});

test("reduced motion is static and cleanup owns the overlay", () => {
  assert.match(splash, /akv-handoff-aperture\{animation:none!important;transform:rotate\(90deg\);opacity:\.75\}/);
  assert.match(splash, /run\.overlay\?\.remove\(\)/);
  assert.match(splash, /run\.overlay = null/);
});

test("the old boxed cue and flying wordmark language are gone", () => {
  assert.doesNotMatch(splash, /akv-orientation-cue|akv-signin-ghost|akv-signin-seam|cloneNode|\.topbar \.brand/);
  assert.doesNotMatch(index, /class="sp-tiles"|class="sp-rule"|class="sp-mark/);
  assert.doesNotMatch(globalStyle, /Branded splash|\.sp-tiles|\.sp-rule|@keyframes spSweep/);
  assert.match(index, /class="sp-aperture"/);
  assert.match(globalStyle, /Refractive cold open[\s\S]*login-interior-dark-4k\.webp/);
  assert.match(globalStyle, /#splash\{[\s\S]*?position:fixed;inset:0;z-index:9999/);
  assert.match(globalStyle, /\.sp-plane-a[\s\S]*\.sp-aperture[\s\S]*\.sp-depth/);
});

test("handoff motion is compositor-safe and contains no roaming glare", () => {
  assert.doesNotMatch(splash, /background-position|filter:|blur\(|radial-gradient|transitionend/);
  assert.match(splash, /The moving properties are opacity and transform only/);
});

test("the handoff warms only local modules without gating navigation", () => {
  assert.match(splash, /const HANDOFF_MODULES = \["\.\/views\/atelier\.js", "\.\/journey-opening\.js", "\.\/room3d\.js"\]/);
  assert.match(splash, /link\.rel = "modulepreload"/);
  assert.match(splash, /new URL\(specifier, import\.meta\.url\)\.href/);
  assert.doesNotMatch(splash, /await warmLocalJourneyModules|Promise\.all\(HANDOFF_MODULES/);
});

test("the glass card follows the measured House Standard width without shrinking its controls", () => {
  assert.match(style, /--pr-card-reference-width:412px/);
  assert.match(style, /width:min\(var\(--pr-card-reference-width\),calc\(100% - 48px\)\)/);
  assert.match(style, /max-width:760px[\s\S]*padding:max\(72px,[\s\S]*\) 24px max\(72px/);
  assert.match(style, /\.pr-card\{width:min\(var\(--pr-card-reference-width\),100%\)/);
  assert.match(style, /linear-gradient\(138deg,rgba\(255,255,255,\.105\)/);
  assert.match(style, /backdrop-filter:blur\(11px\) saturate\(1\.34\) contrast\(1\.045\)/);
  assert.match(style, /0 48px 120px -34px rgba\(0,0,0,\.76\)/);
  assert.doesNotMatch(style, /82vw|86vw|480px|560px|--pr-card-reference-scale/);
});

test("the idle login has no motion control or sensor controller", () => {
  assert.doesNotMatch(login, /id="prMotion"|class="pr-motion"|ICON_MOTION/);
  assert.doesNotMatch(login, /DeviceOrientationEvent|pointermove|wirePhotoDepth|login-depth/);
  assert.doesNotMatch(style, /\.pr-motion/);
});

test("light mode crossfades a matched render without recoloring the glass card", () => {
  const lightTheme = style.slice(
    style.indexOf("html[data-akv-auth][data-theme=light]"),
    style.indexOf("@media(prefers-color-scheme:light)"),
  );
  assert.match(lightTheme, /--pr-dark-photo-opacity:0/);
  assert.match(lightTheme, /--pr-light-photo-opacity:1/);
  assert.match(lightTheme, /--pr-card-light-reflection:1/);
  assert.doesNotMatch(lightTheme, /--pr-panel|--pr-text|--pr-muted|--pr-line|--pr-input|--pr-accent/);
  assert.doesNotMatch(style, /data-theme=light\][^{]*\.pr-card/);
  assert.match(style, /\.pr-scene-dark\{opacity:var\(--pr-dark-photo-opacity\)\}/);
  assert.match(style, /\.pr-scene-light\{opacity:var\(--pr-light-photo-opacity\)\}/);
  assert.doesNotMatch(style, /--pr-photo-filter|--pr-room-light|--pr-night-shade|brightness\(1\.22\)/);
  assert.match(style, /\.pr-card::after[\s\S]*opacity:var\(--pr-card-light-reflection\)/);
});

test("the photographic field rotates clockwise once and settles progressively", () => {
  assert.match(style, /animation:prSceneClockwiseSettle 96s cubic-bezier\(\.16,\.62,\.18,1\) both/);
  assert.match(style, /@keyframes prSceneClockwiseSettle\{from\{transform:rotate\(0deg\)\}to\{transform:rotate\(1\.35deg\)\}\}/);
  assert.match(style, /prefers-reduced-motion:reduce[\s\S]*\.pr-scene-media[\s\S]*animation:none!important/);
});

test("the approved 4K login photographs are optimized for static delivery", () => {
  for (const name of ["login-interior-dark-4k.webp", "login-interior-light-4k.webp"]) {
    const stat = fs.statSync(new URL(`../assets/images/${name}`, import.meta.url));
    assert.ok(stat.size > 250_000, `${name} is unexpectedly empty or placeholder-sized`);
    assert.ok(stat.size < 800_000, `${name} regressed to ${stat.size} bytes`);
  }
});
