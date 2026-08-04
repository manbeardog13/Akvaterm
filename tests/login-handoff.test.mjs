import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const splash = fs.readFileSync(new URL("../js/splash.js", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../js/views/prijava.js", import.meta.url), "utf8");
const style = fs.readFileSync(new URL("../js/login-photo-style.js", import.meta.url), "utf8");
const globalStyle = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// Regression guard, 2026-08-04: this whole file is a single JS template
// literal (LOGIN_PHOTO_CSS). A literal backtick anywhere inside it — even
// inside a CSS comment, even in a matched pair — silently truncates the
// string and turns the rest of the file into garbage top-level JS. This
// exact bug shipped once during this session's audit: node --check passed
// (an even number of stray backticks parses as more, smaller template
// literals, which is syntactically "valid" JS) while the module failed to
// import in both Node and the browser with "Unexpected identifier
// 'background'". Only an actual import() catches it, which is why this test
// counts backticks directly rather than relying on --check.
test("the CSS-in-JS template literal has exactly its own two backticks — no stray ones in comments", () => {
  const backtickCount = (style.match(/`/g) || []).length;
  assert.equal(backtickCount, 2, "a comment or string inside LOGIN_PHOTO_CSS contains a literal backtick, which truncates the template literal — use plain quotes instead");
});

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
  // --pr-card-scale is .89, not the original -10% (.9): first superseded by
  // a later, more specific, audited operator instruction (the card's SHAPE
  // had to match the reference, landing at 1.05), then by "reduce the card
  // by about 15%" applied on top of that audited number. See the comment
  // above --pr-card-scale's definition for the full history.
  assert.match(style, /--pr-card-scale:\.89/);
  // .pr-wrap supplies the ONE gutter (safe-area-aware, same formula at every
  // breakpoint) — .pr-card must not subtract a second one on top of it.
  assert.match(style, /\.pr-wrap\{[\s\S]*?padding:max\(56px,[\s\S]*?\) 24px[\s\S]*?max\(56px,/);
  assert.match(style, /\.pr-card\{[\s\S]*?width:min\(calc\(var\(--pr-card-reference-width\) \* var\(--pr-card-scale\)\),100%\)/);
  assert.match(style, /backdrop-filter:blur\(6px\) saturate\(1\.02\)/);
  assert.match(style, /0 30px 80px -34px rgba\(0,0,0,\.4\)/);
  // Round 3b/3c audit: the outer white glow (0 0 60px rgba(255,255,255,…))
  // measured as part of the top rim's light trail even though it paints
  // outside the card box, and the near-zero fill couldn't reach the
  // reference's actual "flat smoky scrim" character — replaced with a real
  // semi-opaque neutral-grey fill (~.36-.44 alpha) that genuinely compresses
  // contrast instead of just tinting it.
  assert.doesNotMatch(style, /rgba\(255,255,255,\.09\)/);
  assert.match(style, /background:linear-gradient\(180deg,rgba\(16,16,16,\.16\)/);
  assert.doesNotMatch(style, /82vw|86vw|480px|560px|--pr-card-reference-scale/);
  // The two-layer background (padding-box, then border-box) trick was a real
  // bug (audited 2026-08-04): the border-box gradient wasn't confined to the
  // 1px ring and painted a milky wash across the whole face. Pin its
  // absence and the plain-border replacement. Radius is 45px, not the
  // original 30px — round-2 audit found 30px measured at 6.6% of card width
  // against the reference's ~10%.
  assert.doesNotMatch(style, /\) padding-box,[\s\S]{0,80}\) border-box/);
  assert.match(style, /border:1px solid rgba\(255,255,255,\.14\);border-radius:45px/);
  // Controls keep their accessibility floor regardless of the card scale —
  // these must stay literal pixel values, never run through a scale token.
  assert.match(style, /\.pr-input\{position:relative;display:flex;align-items:center;min-height:52px/);
  assert.match(style, /\.pr-card \.btn\{min-height:52px/);
  assert.match(style, /\.pr-forgot,\.pr-footlink\{min-height:44px/);
});

test("the card still materializes 1.6s in, but the photo is never blurred", () => {
  // Operator instruction, 2026-08-04, superseding the earlier "background
  // blurs in first" version: the photograph is sharp always — the ONLY blur
  // anywhere is the card's own backdrop-filter, an optical property of
  // looking through that one rectangle, not an effect on the photo layer.
  // The card's own 1.6s-delayed materialize entrance is unchanged.
  assert.doesNotMatch(style, /prPhotoBlurIn/);
  assert.doesNotMatch(style, /\.pr-scene-media img\{[^}]*animation:/);
  assert.match(style, /@keyframes prCardMaterialize\{/);
  assert.match(style, /\.pr-card\{[\s\S]*animation:prCardMaterialize 900ms cubic-bezier\(\.22,1,\.36,1\) 1600ms both/);
  assert.match(style, /@keyframes prCardParticleConverge\{/);
  assert.match(style, /\.pr-card>\.pr-particles\{position:absolute/);
  // No static opacity/transform on .pr-card itself: prefers-reduced-motion's
  // animation:none!important must fall back to the CSS-initial values
  // (opacity:1, transform:none), not a permanently-invisible frame-0 state.
  const cardRule = style.slice(style.indexOf(".pr-card{"), style.indexOf("@keyframes prCardMaterialize"));
  assert.doesNotMatch(cardRule, /opacity:0|transform:/);
  assert.match(style, /\.pr-particles,\.pr-particle\{transition:none!important;transform:none!important;animation:none!important/);
  assert.match(style, /\.pr-particles\{display:none\}/);
  assert.match(style, /prefers-reduced-motion:reduce[\s\S]*\.pr-scene-media img[\s\S]*animation:none!important/);
  // The particle field is timed to the same 1.6s mark via setTimeout in JS
  // (not a CSS animation-delay — the nodes do not exist before it fires),
  // and skipped entirely when motion is not allowed.
  assert.match(login, /function populateCardParticles\(container\)/);
  assert.match(login, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return;/);
  assert.match(login, /setTimeout\(\(\) => \{[\s\S]*?\}, 1600\);/);
  assert.match(login, /populateCardParticles\(container\);/);
  assert.match(login, /class="pr-particles" aria-hidden="true"/);
});

test("the glass is neutral, not brand-tinted, and light mode gets more light than dark", () => {
  assert.match(style, /backdrop-filter:blur\(6px\) saturate\(1\.02\) brightness\(var\(--pr-card-glass-lift\)\)/);
  assert.doesNotMatch(style, /brightness\(\.96\)/);
  // Operator reference, 2026-08-04 (the @uix.vikram job-card screenshot): the
  // material itself must not carry Akvaterm's teal/amber brand colour — only
  // the photograph behind it should supply colour. rgba() triples used by
  // the card's own fill/border/rim/sheen must be grey (R=G=B), never a tint.
  const cardBlock = style.slice(style.indexOf(".pr-card{"), style.indexOf(".pr-card>*{"));
  const rgbaTriples = [...cardBlock.matchAll(/rgba\((\d+),(\d+),(\d+),/g)];
  assert.ok(rgbaTriples.length > 5, "expected several rgba() colours in the card material rules");
  for (const [, r, g, b] of rgbaTriples) {
    assert.equal(r, g, `card material colour rgba(${r},${g},${b},…) is not neutral`);
    assert.equal(g, b, `card material colour rgba(${r},${g},${b},…) is not neutral`);
  }
  const darkLift = Number(style.match(/--pr-card-glass-lift:([\d.]+);/)[1]);
  const lightMatches = [...style.matchAll(/--pr-card-glass-lift:([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(lightMatches.length >= 3, "expected the base value plus two light-theme overrides");
  for (const value of lightMatches.slice(1)) assert.ok(value > darkLift, "light mode must be brighter than dark");
});

test("the idle login has no ambient device-tilt parallax", () => {
  assert.doesNotMatch(login, /id="prMotion"|class="pr-motion"|ICON_MOTION/);
  assert.doesNotMatch(login, /DeviceOrientationEvent|wirePhotoDepth|login-depth/);
  assert.doesNotMatch(style, /\.pr-motion/);
});

test("the glass sheen is a deliberate mouse-hover feature, not ambient motion", () => {
  // Distinct from the device-tilt parallax forbidden above: this only ever
  // reads pointer position on a fine, hover-capable pointer, and only moves
  // one small overlay element — it never reads orientation and never moves
  // the card itself. A real element, not a custom-property-driven
  // pseudo-element: that was tried and did not reliably repaint.
  assert.match(login, /function wireCardSheen\(container\)/);
  assert.match(login, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return;/);
  assert.match(login, /matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)\.matches\) return;/);
  assert.match(login, /card\.addEventListener\("pointermove"/);
  assert.match(login, /card\.addEventListener\("pointerleave"/);
  assert.match(login, /sheen\.style\.backgroundPosition = /);
  assert.match(login, /function sheenMarkup\(\)/);
  assert.match(login, /class="pr-sheen" aria-hidden="true"/);
  assert.match(login, /wireCardSheen\(container\);/);
  assert.doesNotMatch(login, /DeviceOrientationEvent/);
  assert.match(style, /\.pr-card>\.pr-sheen\{[\s\S]*?background-position:50% 0%/);
  assert.match(style, /\.pr-card>\.pr-sheen\{[\s\S]*?transition:background-position 420ms/);
  assert.doesNotMatch(style, /--pr-gx|--pr-gy/);
  assert.match(style, /prefers-reduced-motion:reduce[\s\S]*\.pr-sheen[\s\S]*animation:none!important/);
});

test("the login is one layout at every breakpoint — no bordered desktop-only frame", () => {
  assert.doesNotMatch(style, /\.pr-wrap\{[^}]*border:1px solid/);
  assert.match(style, /\.pr-wrap\{[\s\S]*?width:100%;min-height:100dvh/);
  assert.doesNotMatch(style, /width:min\(1320px,100%\)/);
  // The old desktop-only frame and its mobile-only override are both gone —
  // .pr-wrap/.pr-scene get exactly one base rule now, not a base + breakpoint
  // pair (the forced-colors override further down is a different, legitimate
  // rule — it hides the photo outright under that accessibility mode).
  assert.equal((style.match(/\.pr-wrap\{/g) || []).length, 1);
  const mobileBlock = style.slice(style.indexOf("@media(max-width:760px){"), style.indexOf("@media(max-width:380px)"));
  assert.doesNotMatch(mobileBlock, /\.pr-wrap\{|\.pr-scene\{/);
  assert.match(mobileBlock, /\.pr-scene-media img\{transform:scale\(1\.055\)\}/);
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
