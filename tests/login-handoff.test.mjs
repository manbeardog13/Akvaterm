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
});

test("the boot splash is retired outright, not just hidden", () => {
  // Operator instruction, 2026-08-04: no launch veil in front of the app.
  // index.html mounts straight into #app; app.js.js has nothing to hand off
  // to. The unrelated post-login handoff in splash.js is a different
  // mechanism (asserted above/below) and must not be touched by this.
  const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(index, /id="splash"|sp-stage|sp-plane|sp-aperture|sp-depth|sp-rim/);
  assert.doesNotMatch(index, /akvHideSplash|classList\.(add|remove)\("splashing"\)|MIN_MS|WATCHDOG_MS/);
  assert.doesNotMatch(globalStyle, /#splash\{|\.sp-plane|\.sp-aperture|\.sp-depth|\.sp-rim|@keyframes spPlaneA|@keyframes spApertureFocus/);
  assert.doesNotMatch(globalStyle, /html\.splashing #main\.view-enter/);
  assert.doesNotMatch(app, /akvHideSplash|revealApp|getElementById\("splash"\)/);
  // The zoom-lockdown script that shared the old inline <script> block with
  // the splash lifecycle must have survived the cut untouched.
  assert.match(index, /gesturestart.*gesturechange.*gestureend/s);
  assert.match(index, /function inZoomable\(t\)/);
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

test("the glass card follows the measured House Standard width, scaled down without shrinking its controls", () => {
  // HOUSE_STANDARD.md's 412px reference is unchanged; --pr-card-scale is the
  // separate -10% dial applied on top of it (operator instruction, 2026-08-04).
  assert.match(style, /--pr-card-reference-width:412px/);
  assert.match(style, /--pr-card-scale:\.9/);
  assert.match(style, /width:min\(calc\(var\(--pr-card-reference-width\) \* var\(--pr-card-scale\)\),calc\(100% - 48px\)\)/);
  assert.match(style, /max-width:760px[\s\S]*padding:max\(72px,[\s\S]*\) 24px max\(72px/);
  assert.match(style, /\.pr-card\{width:min\(calc\(var\(--pr-card-reference-width\) \* var\(--pr-card-scale\)\),100%\)/);
  assert.match(style, /backdrop-filter:blur\(9px\) saturate\(1\.28\) contrast\(1\.02\)/);
  assert.match(style, /0 48px 120px -34px rgba\(0,0,0,\.76\)/);
  assert.doesNotMatch(style, /82vw|86vw|480px|560px|--pr-card-reference-scale/);
  // Controls keep their accessibility floor regardless of the card scale —
  // these must stay literal pixel values, never run through a scale token.
  assert.match(style, /\.pr-input\{position:relative;display:flex;align-items:center;min-height:52px/);
  assert.match(style, /\.pr-card \.btn\{min-height:52px/);
  assert.match(style, /\.pr-forgot,\.pr-footlink\{min-height:44px/);
});

test("the card resolves from a particle field instead of just appearing", () => {
  assert.match(style, /@keyframes prCardMaterialize\{/);
  assert.match(style, /\.pr-card\{[\s\S]*animation:prCardMaterialize/);
  assert.match(style, /@keyframes prCardParticleConverge\{/);
  assert.match(style, /\.pr-card>\.pr-particles\{position:absolute/);
  // No static opacity/transform on .pr-card itself: prefers-reduced-motion's
  // animation:none!important must fall back to the CSS-initial values
  // (opacity:1, transform:none), not a permanently-invisible frame-0 state.
  const cardRule = style.slice(style.indexOf(".pr-card{"), style.indexOf("@keyframes prCardMaterialize"));
  assert.doesNotMatch(cardRule, /opacity:0|transform:/);
  assert.match(style, /\.pr-particles,\.pr-particle\{transition:none!important;transform:none!important;animation:none!important/);
  assert.match(style, /\.pr-particles\{display:none\}/);
  // The particle field is populated in JS only, and only when motion is
  // allowed — no particle nodes are ever created for a reduced-motion user.
  assert.match(login, /function populateCardParticles\(container\)/);
  assert.match(login, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(login, /populateCardParticles\(container\);/);
  assert.match(login, /class="pr-particles" aria-hidden="true"/);
});

test("the login photograph blurs into focus on arrival", () => {
  assert.match(style, /@keyframes prPhotoBlurIn\{from\{filter:blur\(22px\)[\s\S]*?to\{filter:none\}\}/);
  assert.match(style, /\.pr-scene-media img\{[\s\S]*animation:prPhotoBlurIn/);
  assert.doesNotMatch(style, /\.pr-scene-media img\{[^}]*filter:none;/);
  assert.match(style, /prefers-reduced-motion:reduce[\s\S]*\.pr-scene-media img[\s\S]*animation:none!important/);
});

test("the glass is brighter and clearer, and light mode gets more light than dark", () => {
  assert.match(style, /backdrop-filter:blur\(9px\) saturate\(1\.28\) contrast\(1\.02\) brightness\(var\(--pr-card-glass-lift\)\)/);
  assert.doesNotMatch(style, /brightness\(\.96\)/);
  const darkLift = Number(style.match(/--pr-card-glass-lift:([\d.]+);/)[1]);
  const lightMatches = [...style.matchAll(/--pr-card-glass-lift:([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(lightMatches.length >= 3, "expected the base value plus two light-theme overrides");
  for (const value of lightMatches.slice(1)) assert.ok(value > darkLift, "light mode must be brighter than dark");
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
