// ---------------------------------------------------------------------------
// js/splash.js — THE MARK TAKES ITS SEAT
// The post-login transition: the gesture that carries the user from the login
// card into the app. The launch splash in index.html is a separate thing with a
// separate owner; nothing in this file touches it.
// ---------------------------------------------------------------------------
//
// WHY A SHARED ELEMENT AND NOT AN EFFECT
//
// The login screen and the app shell already have exactly one thing in common,
// and it is the only thing that matters: the wordmark. js/views/prijava.js
// renders <p class="pr-mark wordmark"> centred above the card at
// clamp(30px,8.5vw,38px); js/app.js renders the identical markup as
// <a class="brand wordmark"> at the top-left of the bar at 22px; css/styles.css
// styles both from the one rule at .wordmark,.topbar .brand. So the transition
// is not decoration layered over a route change — it IS the mark travelling
// from the middle of the login screen to its seat in the bar, while the card it
// was standing on lets go and the app assembles underneath.
//
// Underneath it, the 64px teal-to-amber rule from .pr-rule opens across the
// whole viewport and dissolves. That is the identity's own sentence — AKVA is
// water and TERM is heat, and the seam between them is where the product lives.
// At 64px it is a modest underline; opened to full width the gradient's teal end
// runs off the left and its amber end off the right, so for a few frames the
// screen IS the seam. The mark rises through it and takes its place.
//
// This is deliberately NOT the ASC pattern the launch splash admits to
// borrowing (a mark that fades up over a bar that sweeps left to right). Nothing
// here sweeps and nothing here is progress-shaped: one thing travels, one thing
// opens, and they are the same gesture because the second releases the first.
//
// ---------------------------------------------------------------------------
// WHAT THIS MODULE REFUSES TO DO
// ---------------------------------------------------------------------------
//
// It never wedges the app. That is the whole design budget, spent before
// anything pretty was considered, because every other failure here is cosmetic
// and this one is total. Concretely:
//
//   - The watchdog is armed BEFORE the first DOM read, so a throw anywhere in
//     build, measurement or flight still lands in finish().
//   - Completion is driven by a timer, never by transitionend. A transition
//     that is interrupted, coalesced, or never started because the tab was
//     backgrounded fires nothing; setTimeout fires anyway (throttled, but it
//     fires). transitionend is not listened for at all — there is nothing to
//     miss.
//   - The promise NEVER rejects. prijava.js calls this from inside the try
//     block that also catches signIn() failures; a rejection there would paint
//     "wrong password" over a successful sign-in.
//   - Navigation is guaranteed. If anything at all goes wrong, finish() calls
//     the navigate hook before it resolves. A stuck overlay is bad; stranding a
//     signed-in user on the login screen is worse, so the route change is the
//     one side effect that survives every failure path.
//   - Every overlay node is pointer-events:none and lives on document.body,
//     outside #app, so it can neither intercept a tap nor be orphaned by
//     app.js's swapMain(). The worst visible failure this module can produce is
//     a wordmark parked mid-air over a fully working app for 1.5 s.
//
// ---------------------------------------------------------------------------
// CONSTRAINTS THIS FILE HONOURS
// ---------------------------------------------------------------------------
//
//   - Zero static imports. At departure it issues best-effort same-origin
//     modulepreload hints for the next local journey surfaces, but never awaits
//     them and never lets a warm-up delay navigation.
//   - Only opacity and transform are ever animated. left/top/width are written
//     once at build time to place a fixed overlay and never touched again;
//     that is placement, not animation, and it costs no frame.
//   - The wordmark is copied, never restyled. The ghost is a cloneNode of the
//     real mark carrying its own class list, so --logo-navy / --logo-red and
//     the dark-theme override at css/styles.css:743 keep owning its colour. No
//     font-family, font-weight, font-style or colour is written by this file.
//   - Both themes work by construction: the only colour this module introduces
//     is read off the live .pr-rule with getComputedStyle, so the seam is
//     whatever the login rule already resolved to in the active theme.
//   - The injected CSS is assembled from an array of ordinary quoted strings
//     rather than a template literal, so the backtick hazard that silently
//     truncates the CSS blocks in prijava.js and katalog.js cannot exist here.
//
// ---------------------------------------------------------------------------

// Class on <html> while the ghost is in flight. It hides the real top-bar
// wordmark so the app does not show two of them at once; LAND then dissolves
// the real one back in underneath the ghost's fade-out.
const FLY = "akv-signin-fly";
const LAND = "akv-signin-land";
const STYLE_ID = "akv-signin-transition-css";

// ---- timeline (ms from the call) -------------------------------------------
// Read this as the storyboard. Every number below is enforced by a timer, not
// hoped for: T_TOTAL is armed at t=0 and the flight is fitted into whatever
// budget is left when it actually gets to start, so the promise settles at
// ~700 ms whether the router took one frame to hand over the top bar or ten.
const T_CARD_OUT = 200;    // 0   -> 200   the card lets go
const T_SEAM_DELAY = 150;  //              the seam waits for the card to commit
const T_SEAM_OPEN = 410;   // 150 -> 560   the seam opens across the viewport
const T_SEAM_FADE = 200;   // 360 -> 560   and dissolves as it reaches the edges
const T_NAV = 190;         // 190          hand over to the router
const T_DEST_POLL = 260;   // 190 -> 450   wait for the top bar to be measurable
const T_FLIGHT_MAX = 380;  //              the flight, fitted to the budget left
const T_FLIGHT_MIN = 200;
const T_LAND = 90;         //              ghost out / real brand in
const T_TOTAL = 700;       // 700          the promise settles here
const T_WATCHDOG = 1500;   // 1500         and here if literally everything failed

// A teardown inside this window is the one MY navigation caused, so it must not
// be read as the user leaving. After it, akv:teardown means what it says.
const T_TEARDOWN_GRACE = 140;

// Reduced motion is a different, much shorter piece: a plain cross-fade with no
// motion at all, matching how css/styles.css:863 and prijava.js:339 treat it —
// dropped, not shortened.
const T_REDUCED_NAV = 80;
const T_REDUCED_TOTAL = 140;

// Default selectors. Every one is an option so that the coupling to prijava.js
// and app.js is declared at the call site rather than buried in a stylesheet.
const SEL_FROM = ".pr-mark";
const SEL_RULE = ".pr-rule";
const SEL_CARD = ".pr-card";
const SEL_WRAP = ".pr-wrap";
const SEL_TO = ".topbar .brand";

// Already local and service-worker-owned. These hints move fetch/parse work into
// the intentional 700 ms handoff without turning that beat into a progress gate.
const HANDOFF_MODULES = ["./views/katalog.js", "./views/atelier.js", "./views/savjetnik.js"];

// Easing tokens with literal fallbacks. var() works in inline styles, but this
// module can be imported into a page that has not loaded css/styles.css yet
// (a test harness, a future route-level split), and an unresolvable var in a
// transition shorthand invalidates the whole declaration — which would leave
// the ghost snapping instead of flying.
const SMOOTH = "var(--smooth,cubic-bezier(.25,1,.5,1))";
const SNAP = "var(--snap,cubic-bezier(.22,1,.36,1))";

// Only used if .pr-rule is gone and there is nothing live to sample.
const SEAM_FALLBACK = "linear-gradient(90deg,var(--accent-bright,#139EB1),var(--accent-2,#EAA651))";

/** Nominal wall-clock length of the full transition, for callers that schedule around it. */
export const SIGN_IN_TRANSITION_MS = T_TOTAL;

// ---- injected stylesheet ---------------------------------------------------
// Deliberately tiny. Everything positional is written inline on the nodes,
// because inline wins the cascade outright and this module must not lose a
// specificity argument with a stylesheet it does not own. What is left here is
// exactly the two things that CANNOT be inline: a rule targeting an element
// this module does not create (.topbar .brand), and the hardened-mode guards,
// which need !important precisely so they can override the inline styles above.
const CSS = [
  "/* Injected by js/splash.js. Structural only — see the file header. */",
  "html." + FLY + " .topbar .brand{opacity:0}",
  "html." + FLY + "." + LAND + " .topbar .brand{opacity:1;transition:opacity " + T_LAND + "ms " + SMOOTH +
    ",transform var(--dur,200ms) var(--spring,cubic-bezier(.34,1.4,.5,1))}",
  ".akv-orientation-cue{position:fixed;z-index:2147483645;left:50%;top:50%;display:flex;align-items:center;gap:15px;" +
    "width:max-content;max-width:calc(100vw - 40px);padding:14px 18px 14px 15px;border:1px solid rgba(255,255,255,.22);" +
    "border-radius:20px;background:rgba(9,12,11,.72);color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.32);" +
    "backdrop-filter:blur(18px) saturate(1.08);-webkit-backdrop-filter:blur(18px) saturate(1.08);pointer-events:none;" +
    "transform:translate3d(-50%,-44%,0);opacity:0;animation:akvOrientationCue " + T_TOTAL + "ms " + SMOOTH + " both}",
  ".akv-orientation-device{position:relative;display:block;width:25px;height:42px;flex:0 0 auto;border:1.7px solid currentColor;" +
    "border-radius:7px;transform-origin:50% 50%;animation:akvOrientationTurn " + T_TOTAL + "ms " + SNAP + " both}",
  ".akv-orientation-device:before{content:'';position:absolute;left:50%;top:3px;width:7px;height:1.5px;border-radius:2px;" +
    "background:currentColor;transform:translateX(-50%);opacity:.72}",
  ".akv-orientation-device:after{content:'';position:absolute;left:50%;bottom:3px;width:3px;height:3px;border:1px solid currentColor;" +
    "border-radius:50%;transform:translateX(-50%);opacity:.72}",
  ".akv-orientation-copy{display:block;min-width:0}.akv-orientation-copy strong,.akv-orientation-copy span{display:block}",
  ".akv-orientation-copy strong{font:650 13px/1.2 var(--font-text,system-ui,sans-serif);letter-spacing:.01em}",
  ".akv-orientation-copy span{margin-top:4px;color:rgba(255,255,255,.64);font:500 11px/1.3 var(--font-text,system-ui,sans-serif)}",
  "@keyframes akvOrientationTurn{0%,18%{transform:rotate(0deg)}72%,100%{transform:rotate(90deg)}}",
  "@keyframes akvOrientationCue{0%{opacity:0;transform:translate3d(-50%,-42%,0)}12%,78%{opacity:1;transform:translate3d(-50%,-50%,0)}100%{opacity:0;transform:translate3d(-50%,-54%,0)}}",
  "@media (min-width:761px),(orientation:landscape){.akv-orientation-cue{display:none!important}}",
  // SAFETY, not styling. If the class ever outlived a run — it cannot, but the
  // cost of being wrong is an app with no wordmark — reduced motion still shows
  // the real bar, and no overlay can paint.
  "@media (prefers-reduced-motion:reduce){",
  "  .akv-signin-ghost,.akv-signin-seam{display:none!important}",
  "  .akv-orientation-cue{animation:none!important;opacity:1;transform:translate3d(-50%,-50%,0)}",
  "  .akv-orientation-device{animation:none!important;transform:rotate(90deg)}",
  "  html." + FLY + " .topbar .brand{opacity:1!important}",
  "}",
  // The seam is a gradient hairline carrying no information. Forced-colors
  // repaints gradients as flat system colours, where it reads as a stray border.
  "@media (forced-colors:active){",
  "  .akv-signin-seam{display:none!important}",
  "  .akv-orientation-cue{border:1px solid CanvasText;background:Canvas;color:CanvasText;forced-color-adjust:auto}",
  "  .akv-orientation-copy span{color:CanvasText}",
  "  html." + FLY + " .topbar .brand{opacity:1!important}",
  "}",
].join("\n");

let stylesInjected = false;

function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;                       // latch first: a throw below must not retry forever
  try {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  } catch (err) {
    warn("could not inject styles", err);
  }
}

// ---- small helpers ---------------------------------------------------------

function warn(message, err) {
  // Never let diagnostics be the thing that breaks the transition.
  try { console.warn("[splash] " + message, err || ""); } catch { /* no console */ }
}

/** Resolve an option that may be an Element, a selector string, or absent. */
function pick(ref, fallbackSelector) {
  try {
    if (ref && typeof ref === "object" && ref.nodeType === 1) return ref;
    if (ref === null || ref === false) return null;          // explicit opt-out
    const sel = typeof ref === "string" && ref ? ref : fallbackSelector;
    return sel ? document.querySelector(sel) : null;
  } catch (err) {
    warn("selector failed", err);
    return null;
  }
}

// The INK BOX, not the element box — and the difference is the whole flight.
//
// .pr-mark is a shrink-to-fit item in a centred column flex, so today its
// element rect happens to be its text. .topbar .brand is NOT: it carries
// min-height:var(--tap), so its element rect is a 44px touch target with 25px
// of text floating in the middle of it. Aligning element rects would drop the
// mark visibly low in the bar. A Range over each element's contents gives the
// line box the glyphs actually occupy in both cases, which also means this
// keeps working if .pr-mark is ever changed to a block.
function textRect(el) {
  if (!el) return null;
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    if (r && r.width > 0.5 && r.height > 0.5) return r;
  } catch (err) {
    warn("range measurement failed", err);
  }
  try {
    const r = el.getBoundingClientRect();
    if (r && r.width > 0.5 && r.height > 0.5) return r;
  } catch { /* detached */ }
  return null;                                  // display:none, detached, or empty
}

function prefersReduced() {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

function isPortraitPhone() {
  try {
    const viewport = window.visualViewport;
    const width = Number(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
    const height = Number(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    const coarse = !!window.matchMedia?.("(pointer: coarse)").matches;
    const touch = Number(navigator.maxTouchPoints || 0) > 0;
    return width > 0 && height > width && width <= 760 && (coarse || touch);
  } catch {
    return false;
  }
}

function warmLocalJourneyModules() {
  try {
    if (!document.head) return;
    const existing = Array.from(document.querySelectorAll("link[data-akv-handoff-preload]"));
    for (const specifier of HANDOFF_MODULES) {
      const href = new URL(specifier, import.meta.url).href;
      if (existing.some((link) => link.href === href)) continue;
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = href;
      link.setAttribute("data-akv-handoff-preload", "");
      document.head.appendChild(link);
      existing.push(link);
    }
  } catch (err) {
    warn("local module warm-up failed", err);
  }
}

function buildOrientationCue(run) {
  if (run.opts.orientationCue === false || !isPortraitPhone()) return null;
  try {
    const copy = run.opts.orientationCue && typeof run.opts.orientationCue === "object"
      ? run.opts.orientationCue
      : {};
    const cue = document.createElement("div");
    cue.className = "akv-orientation-cue";
    cue.setAttribute("role", "status");
    cue.setAttribute("aria-live", "polite");

    const device = document.createElement("span");
    device.className = "akv-orientation-device";
    device.setAttribute("aria-hidden", "true");

    const words = document.createElement("span");
    words.className = "akv-orientation-copy";
    const title = document.createElement("strong");
    title.textContent = String(copy.title || "Okrenite telefon");
    const detail = document.createElement("span");
    detail.textContent = String(copy.detail || "Više prostora za vaš projekt");
    words.append(title, detail);
    cue.append(device, words);
    document.body.appendChild(cue);
    run.orientationCue = cue;
    return cue;
  } catch (err) {
    warn("orientation cue failed", err);
    return null;
  }
}

function now() {
  try { return performance.now(); } catch { return Date.now(); }
}

// ---- run bookkeeping -------------------------------------------------------
// One transition can be in flight at a time. A second call supersedes the first
// rather than racing it for the same <html> classes.
let active = null;

/** Snapshot an element's inline style so cleanup can put it back exactly. */
function remember(run, el) {
  if (!el) return el;
  try { run.restore.push([el, el.style.cssText]); } catch { /* exotic node */ }
  return el;
}

function later(run, fn, ms) {
  try { run.timers.push(setTimeout(fn, ms)); } catch (err) { warn("timer failed", err); }
}

// A filling entrance animation OUTRANKS inline style.
//
// prijava.js gives .pr-brand, .pr-rule and .pr-card animation-fill-mode:both
// with only a from-keyframe, so after they finish they keep applying a
// synthesised 100% keyframe forever. CSS animations sit above inline
// declarations in the cascade, so writing el.style.opacity on one of these does
// not fade it — it feeds the implicit to-keyframe, which the still-filling
// animation applies at once. The result is a snap, not a departure. Cancelling
// the animation first hands the property back to the normal cascade, where
// inline style and its transition can do their job.
function releaseAnimation(el) {
  if (!el) return;
  try {
    el.style.animation = "none";
    void el.offsetWidth;                        // flush, so the next write starts a transition
  } catch (err) {
    warn("could not release animation", err);
  }
}

// ---- the one exit ----------------------------------------------------------

function cleanup(run) {
  // Ordered by consequence. The <html> classes are what hide app chrome, so
  // they come off first and every step is guarded on its own — one failure must
  // never skip the rest.
  try {
    const list = document.documentElement.classList;
    list.remove(FLY);
    list.remove(LAND);
  } catch (err) { warn("class cleanup failed", err); }

  for (const id of run.timers) { try { clearTimeout(id); } catch { /* gone */ } }
  run.timers.length = 0;

  if (run.raf) { try { cancelAnimationFrame(run.raf); } catch { /* gone */ } run.raf = 0; }

  for (const off of run.listeners) { try { off(); } catch { /* gone */ } }
  run.listeners.length = 0;

  for (const node of [run.ghost, run.seam, run.orientationCue]) {
    try { if (node && node.remove) node.remove(); } catch (err) { warn("overlay removal failed", err); }
  }
  run.ghost = null;
  run.seam = null;
  run.orientationCue = null;

  // Restored LAST, because these are the caller's own elements and are usually
  // already detached by app.js's swapMain() by the time we get here — harmless
  // either way, and exactly right when the run was cancelled before navigation.
  for (const pair of run.restore) {
    try { pair[0].style.cssText = pair[1]; } catch { /* detached */ }
  }
  run.restore.length = 0;
}

// Idempotent, total, and the only way out. Every timer, listener and error path
// funnels here.
function finish(run, reason) {
  if (run.settled) return;
  run.settled = true;

  // THE ONE SIDE EFFECT THAT MUST SURVIVE EVERYTHING.
  // "superseded" means a newer run owns the navigation; "teardown" means a
  // navigation already happened and is what woke us. Every other reason —
  // including watchdog, cancel, and a throw during build — still owes the user
  // the route change they just signed in for.
  if (reason !== "superseded" && reason !== "teardown") {
    try { navigateOnce(run); } catch (err) { warn("navigation on finish failed", err); }
  }

  try { cleanup(run); } catch (err) { warn("cleanup failed", err); }

  if (active === run) active = null;
  try { run.settle({ reason: reason, reduced: !!run.reduced, flew: !!run.landed }); } catch (err) {
    warn("resolve failed", err);
  }
}

// Called at the hand-off beat, and again by finish() as a backstop. The latch
// makes the second call free.
function navigateOnce(run) {
  if (run.navigated) return;
  run.navigated = true;
  if (run.navigate === false || run.navigate === null) return;   // caller owns the route change
  try {
    run.navigate();
  } catch (err) {
    warn("navigate hook threw", err);
  }
}

// ---- the reduced / degraded path -------------------------------------------
// Used both for prefers-reduced-motion and for "there is nothing left to
// animate from" — a plain opacity cross-fade over the whole login wrap, no
// transform anywhere, settled in 140 ms.
function playPlainFade(run, reason) {
  const wrap = pick(run.opts.wrap, SEL_WRAP) || pick(run.opts.card, SEL_CARD);
  if (wrap) {
    // Fading the WRAP rather than the card takes the mark, the rule and the
    // card together in one stroke, and a parent's opacity composites the whole
    // subtree — so the children's still-filling entrance animations, which own
    // their own opacity, cannot fight it.
    remember(run, wrap);
    try {
      wrap.style.transition = "opacity " + T_REDUCED_NAV + "ms linear";
      wrap.style.opacity = "0";
    } catch (err) {
      warn("plain fade failed", err);
    }
  }
  later(run, () => navigateOnce(run), T_REDUCED_NAV);
  later(run, () => finish(run, reason), T_REDUCED_TOTAL);
}

// ---- the full transition ---------------------------------------------------

function buildGhost(run, fromEl, fromRect) {
  // COPY, NEVER RESTYLE. cloneNode keeps .wordmark (and .pr-mark, and anything
  // added later such as .wordmark-on-dark), so every protected colour rule in
  // css/styles.css:723-752 still selects it — including the dark-theme override
  // that is the one place the identity is allowed to move. This file writes no
  // colour and no font property onto the mark at all.
  let ghost;
  try {
    ghost = fromEl.cloneNode(true);
  } catch (err) {
    warn("could not clone the mark", err);
    return null;
  }

  try {
    // Duplicate ids are invalid and would break any getElementById aimed at the
    // real mark while both are in the document.
    ghost.removeAttribute("id");
    const withIds = ghost.querySelectorAll ? ghost.querySelectorAll("[id]") : [];
    for (const node of withIds) node.removeAttribute("id");

    ghost.classList.add("akv-signin-ghost");
    ghost.setAttribute("aria-hidden", "true");

    // Pin the size the source resolved to. .pr-mark's clamp() is vw-based so it
    // would resolve identically out of context, but pinning costs nothing and
    // makes the flight independent of where the ghost is parented.
    let fontSize = "";
    try { fontSize = getComputedStyle(fromEl).fontSize || ""; } catch { /* no view */ }

    // z-index 101 sits above the top bar (30) and the toast rail (60) so the
    // mark flies over the arriving app, and below the drawer scrim (114) so a
    // drawer opened mid-flight is still on top of it.
    ghost.style.cssText =
      "position:fixed;left:0;top:0;margin:0;padding:0;z-index:101;" +
      "pointer-events:none;transform-origin:top left;display:inline-block;" +
      "animation:none;transition:none;will-change:transform,opacity;" +
      (fontSize ? "font-size:" + fontSize + ";" : "");

    document.body.appendChild(ghost);
  } catch (err) {
    warn("could not place the ghost", err);
    try { ghost.remove(); } catch { /* never attached */ }
    return null;
  }

  // Measure the ghost's OWN ink box while it is untransformed at the viewport
  // origin. Because left/top are 0 and transform-origin is the top-left corner,
  // the element's local coordinate space is the viewport's, so this rect is
  // literally the local offset of the glyphs inside the node — which is what
  // the FLIP arithmetic below needs, and what makes it exact rather than
  // approximately right.
  const g0 = textRect(ghost);
  if (!g0) {
    try { ghost.remove(); } catch { /* attached, but empty */ }
    return null;
  }

  // Placed before the browser ever gets a chance to paint: build, measure and
  // position all happen in one task, so the ghost is never seen at the origin.
  const fx = fromRect.left - g0.left;
  const fy = fromRect.top - g0.top;
  try { ghost.style.transform = "translate(" + fx + "px," + fy + "px)"; } catch { /* detached */ }

  run.ghost = ghost;
  run.g0 = g0;
  run.fromRect = fromRect;
  return ghost;
}

function buildSeam(run, ruleEl) {
  // The seam is the login rule, promoted. Its geometry and its gradient are
  // SAMPLED off the live element rather than restated, so it is automatically
  // whatever .pr-rule currently is in whichever theme is active — this module
  // introduces no colour of its own and therefore has no colour to check.
  const rect = ruleEl ? (() => { try { return ruleEl.getBoundingClientRect(); } catch { return null; } })() : null;
  if (!rect || rect.width < 1) return null;

  let image = "";
  let radius = "";
  try {
    const cs = getComputedStyle(ruleEl);
    image = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : "";
    radius = cs.borderRadius || "";
  } catch { /* no view */ }

  let seam;
  try {
    seam = document.createElement("span");
    seam.className = "akv-signin-seam";
    seam.setAttribute("aria-hidden", "true");
    seam.style.cssText =
      "position:fixed;z-index:100;pointer-events:none;transform-origin:50% 50%;" +
      "left:" + rect.left + "px;top:" + rect.top + "px;" +
      "width:" + rect.width + "px;height:" + rect.height + "px;" +
      "border-radius:" + (radius || "2px") + ";" +
      "background-image:" + (image || SEAM_FALLBACK) + ";" +
      "will-change:transform,opacity;";
    document.body.appendChild(seam);
  } catch (err) {
    warn("could not place the seam", err);
    return null;
  }

  // Open past both edges. The gradient rides the scale, so at full extent the
  // teal end has run off the left of the viewport and the amber end off the
  // right — the screen is briefly the seam itself. 1.6x the viewport so the
  // ends are genuinely gone rather than parked visibly at the margins; a fixed
  // element contributes nothing to scrollable overflow, so overshooting is free
  // and cannot produce a scrollbar.
  let k = 8;
  try {
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    if (vw > 0) k = Math.max(2, (vw * 1.6) / rect.width);
  } catch { /* no window metrics */ }

  try {
    seam.style.transition =
      "transform " + T_SEAM_OPEN + "ms " + SMOOTH + " " + T_SEAM_DELAY + "ms," +
      "opacity " + T_SEAM_FADE + "ms linear " + (T_SEAM_DELAY + T_SEAM_OPEN - T_SEAM_FADE) + "ms";
    void seam.offsetWidth;                      // commit the from-frame
    seam.style.transform = "scaleX(" + k + ")";
    seam.style.opacity = "0";
  } catch (err) {
    warn("seam animation failed", err);
  }

  run.seam = seam;
  return seam;
}

function departCard(run) {
  const card = pick(run.opts.card, SEL_CARD);
  if (!card) return;
  remember(run, card);
  releaseAnimation(card);
  try {
    card.style.transition =
      "opacity " + T_CARD_OUT + "ms " + SMOOTH + ",transform " + T_CARD_OUT + "ms " + SMOOTH;
    card.style.opacity = "0";
    // Exactly the reverse of prijava.js's own prCard entrance. The card does not
    // fly anywhere, because it has nowhere to go — it settles back down and lets
    // go, which is what makes the mark the only thing that travels.
    card.style.transform = "translateY(10px) scale(.985)";
  } catch (err) {
    warn("card departure failed", err);
  }
}

// Hide the real mark and rule the instant their stand-ins exist. No transition:
// the ghost is pixel-aligned on top of the mark at this moment, so the swap is
// invisible by construction rather than by being fast.
function hideSource(run, fromEl, ruleEl) {
  for (const el of [fromEl, ruleEl]) {
    if (!el) continue;
    remember(run, el);
    releaseAnimation(el);
    try { el.style.opacity = "0"; } catch { /* detached */ }
  }
}

// The destination cannot be measured before navigation and must not be guessed
// after it.
//
// While the login view is up, prijava.js:144 holds .topbar at display:none, so
// getBoundingClientRect returns zeroes — there is no rect to read. Navigation
// is what fixes that: app.js's route() fires akv:teardown, prijava's listener
// clears data-akv-auth, and the bar gets a box in that same task. But
// location.hash = "#/" queues a task rather than dispatching synchronously, so
// a single rAF after it is a race, not a measurement.
//
// So: poll for the rect. This waits for the condition itself rather than for a
// duration someone guessed, which is why it is deterministic even though it
// looks like polling. In practice it resolves on the first or second frame.
function pollDestination(run) {
  const deadline = now() + T_DEST_POLL;

  const tick = () => {
    run.raf = 0;
    if (run.settled || run.flew) return;
    const dest = pick(run.opts.to, SEL_TO);
    const rect = dest ? textRect(dest) : null;
    if (rect) { flight(run, rect); return; }
    if (now() >= deadline) { flight(run, null); return; }
    try { run.raf = requestAnimationFrame(tick); } catch { flight(run, null); }
  };

  // rAF is frozen in a backgrounded tab, so the deadline gets a timer of its
  // own rather than trusting a frame to arrive and notice it has expired.
  later(run, () => { if (!run.settled && !run.flew) flight(run, null); }, T_DEST_POLL + 20);
  tick();
}

// destRect === null means we never got a seat to fly to. Rather than invent
// one, the mark dissolves upward from where it stands — the same gesture,
// unresolved, which is honest and reads fine.
function flight(run, destRect) {
  if (run.flew || run.settled) return;
  run.flew = true;

  const ghost = run.ghost;
  const g0 = run.g0;
  const from = run.fromRect;
  if (!ghost || !g0 || !from) return;           // finish() is already scheduled

  // Fit the flight into whatever is left of the 700 ms, so a slow hand-off
  // shortens the travel instead of overrunning the promise.
  const remaining = (run.start + T_TOTAL) - now() - T_LAND;
  const dur = Math.max(T_FLIGHT_MIN, Math.min(T_FLIGHT_MAX, remaining));

  let scale;
  let targetLeft;
  let targetTop;
  let fade = false;

  if (destRect) {
    // Both rects are ink boxes of the same string in the same face, so their
    // width ratio IS the type-size ratio — self-correcting, and uniform, so the
    // letterforms never distort. Clamped because a pathological measurement
    // must produce a dull flight, not a mark the size of the room.
    scale = destRect.width / from.width;
    if (!isFinite(scale) || scale <= 0) scale = 0.6;
    scale = Math.max(0.15, Math.min(2.5, scale));
    targetLeft = destRect.left;
    targetTop = destRect.top;
  } else {
    scale = 0.94;
    targetLeft = from.left + (from.width * (1 - scale)) / 2;
    targetTop = from.top - 18;
    fade = true;
  }

  // FLIP. With transform-origin at the ghost's top-left corner and the element
  // pinned at the viewport origin, a local point p maps to scale*p + translate,
  // so putting the ink box's local corner (g0.left, g0.top) onto the target is
  // just a subtraction. No compounding, no reflow, one composited property.
  const tx = targetLeft - scale * g0.left;
  const ty = targetTop - scale * g0.top;

  try {
    ghost.style.transition =
      "transform " + dur + "ms " + SNAP + (fade ? ",opacity " + dur + "ms " + SMOOTH : "");
    void ghost.offsetWidth;
    ghost.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    if (fade) ghost.style.opacity = "0";
  } catch (err) {
    warn("flight failed", err);
  }

  // The landing. The ghost fades out over the real brand fading in, across the
  // same pixels at the same size, so the hand-back is a dissolve rather than a
  // swap. LAND drives the real one; see the injected sheet.
  later(run, () => {
    if (run.settled) return;
    run.landed = !!destRect;
    try { document.documentElement.classList.add(LAND); } catch { /* gone */ }
    if (fade) return;                            // already dissolving
    try {
      // The transform transition is re-declared with the value it already
      // finished on, so restating the shorthand cannot restart or snap it.
      ghost.style.transition =
        "transform " + dur + "ms " + SNAP + ",opacity " + T_LAND + "ms " + SMOOTH;
      ghost.style.opacity = "0";
    } catch (err) {
      warn("landing failed", err);
    }
  }, dur);
}

function playFull(run) {
  const fromEl = pick(run.opts.from, SEL_FROM);
  const fromRect = textRect(fromEl);

  // SAFE WHEN THE SOURCE IS ALREADY GONE. A view that was torn down, a mark
  // that was never rendered, a caller that fired this twice — all land here,
  // and all get the plain fade plus a guaranteed navigation instead of a
  // half-built overlay.
  if (!fromEl || !fromRect) {
    playPlainFade(run, "degraded:no-source");
    return;
  }

  const ruleEl = pick(run.opts.rule, SEL_RULE);

  const ghost = buildGhost(run, fromEl, fromRect);
  if (!ghost) {
    playPlainFade(run, "degraded:no-ghost");
    return;
  }

  buildSeam(run, ruleEl);
  // The real mark and rule are suppressed only AFTER their stand-ins are on
  // screen, so there is never a frame with neither.
  hideSource(run, fromEl, ruleEl);
  departCard(run);

  // Only now, with a stand-in on screen for everything about to disappear, is
  // it safe to hide the app's own wordmark ahead of the landing.
  try { document.documentElement.classList.add(FLY); } catch { /* gone */ }

  later(run, () => {
    if (run.settled) return;
    navigateOnce(run);
    pollDestination(run);
  }, T_NAV);

  later(run, () => finish(run, "done"), T_TOTAL);
}

// ---- public API ------------------------------------------------------------

/**
 * Play the post-login transition: the wordmark travels from the centre of the
 * login screen to its seat in the top bar while the teal-to-amber seam opens
 * beneath it and the app assembles underneath.
 *
 * Resolves in ~700 ms (~140 ms under prefers-reduced-motion, or when there is
 * nothing left to animate from). NEVER REJECTS, so it is safe to await inside a
 * try block that is catching something else.
 *
 * The module owns the route change by default and guarantees it: if any part of
 * the animation fails, the navigate hook still runs before the promise settles.
 *
 * @param {object}  [options]
 * @param {Element|string}       [options.from]  source mark. Default ".pr-mark".
 * @param {Element|string}       [options.rule]  source seam. Default ".pr-rule".
 * @param {Element|string}       [options.card]  departing card. Default ".pr-card".
 * @param {Element|string}       [options.wrap]  reduced-motion fade target. Default ".pr-wrap".
 * @param {Element|string}       [options.to]    destination mark. Default ".topbar .brand".
 * @param {Function|false}       [options.navigate]  called at the hand-off beat.
 *        Default sets location.hash = "#/". Pass false to own the route change
 *        yourself — the module will then never navigate, including on failure.
 * @param {boolean}              [options.reduced]   force the plain-fade path.
 * @param {{title?:string,detail?:string}|false} [options.orientationCue]
 *        portrait-phone handoff copy, or false to suppress the cue.
 * @param {AbortSignal}          [options.signal]    aborting cancels the run.
 * @returns {Promise<{reason:string,reduced:boolean,flew:boolean}> & {cancel:Function}}
 */
export function playSignInTransition(options) {
  const opts = options || {};

  // A second call supersedes the first rather than racing it for the same
  // <html> classes and the same overlay z-index.
  if (active) { try { cancelSignInTransition("superseded"); } catch { /* already gone */ } }

  let settle = () => {};
  const promise = new Promise((res) => { settle = res; });

  const run = {
    opts: opts,
    settle: settle,
    start: now(),
    settled: false,
    navigated: false,
    flew: false,
    landed: false,
    reduced: false,
    raf: 0,
    timers: [],
    listeners: [],
    restore: [],
    ghost: null,
    seam: null,
    orientationCue: null,
    g0: null,
    fromRect: null,
    navigate: typeof opts.navigate === "function"
      ? opts.navigate
      : (opts.navigate === false || opts.navigate === null
        ? false
        : () => { location.hash = "#/"; }),
    // A teardown before this instant is the one our own navigation caused.
    ignoreTeardownUntil: 0,
  };
  run.ignoreTeardownUntil = run.start + T_NAV + T_TEARDOWN_GRACE;

  active = run;

  // ARMED BEFORE ANY DOM WORK. Everything below this line may throw; none of it
  // can stop the app from being handed back.
  later(run, () => finish(run, "watchdog"), T_WATCHDOG);

  try {
    // app.js fires akv:teardown at the top of every route(), so a real
    // navigation anywhere kills the run. The grace window above is what keeps
    // it from killing the run on OUR OWN navigation, which fires the very same
    // event about five milliseconds after we ask for it.
    const onTeardown = () => {
      if (now() < run.ignoreTeardownUntil) return;
      finish(run, "teardown");
    };
    window.addEventListener("akv:teardown", onTeardown);
    run.listeners.push(() => window.removeEventListener("akv:teardown", onTeardown));

    // A document that is going away should not leave a pending promise behind.
    const onPageHide = () => finish(run, "pagehide");
    window.addEventListener("pagehide", onPageHide);
    run.listeners.push(() => window.removeEventListener("pagehide", onPageHide));

    if (opts.signal) {
      if (opts.signal.aborted) {
        finish(run, "aborted");
        return decorate(promise, run);
      }
      const onAbort = () => finish(run, "aborted");
      opts.signal.addEventListener("abort", onAbort);
      run.listeners.push(() => {
        try { opts.signal.removeEventListener("abort", onAbort); } catch { /* gone */ }
      });
    }

    ensureStyles();
    warmLocalJourneyModules();
    buildOrientationCue(run);

    if (opts.reduced === true || prefersReduced()) {
      run.reduced = true;
      playPlainFade(run, "reduced");
    } else {
      playFull(run);
    }
  } catch (err) {
    // The transition is decoration; the sign-in is not. Anything unexpected
    // ends the run immediately, which navigates and resolves.
    warn("transition failed to start", err);
    finish(run, "error");
  }

  return decorate(promise, run);
}

// The brief asks for "a way to cancel it" tied to the call, and a module-level
// cancel for everyone else. Both exist, and both are the same latch.
function decorate(promise, run) {
  try {
    Object.defineProperty(promise, "cancel", {
      value: (reason) => { finish(run, typeof reason === "string" ? reason : "cancelled"); },
      configurable: true,
    });
  } catch { /* frozen Promise subclass — cancelSignInTransition() still works */ }
  return promise;
}

/**
 * Cancel the in-flight transition, if there is one. The overlay is removed and
 * the promise resolves at once.
 *
 * Cancelling stops the ANIMATION, not the sign-in: unless the run was
 * superseded, the pending route change still fires, because leaving a
 * signed-in user on the login screen is the one outcome worse than a stuck
 * overlay. Callers that want to own the route change entirely should pass
 * { navigate: false } instead of relying on cancel.
 *
 * @param {string} [reason]
 * @returns {boolean} true if a run was cancelled.
 */
export function cancelSignInTransition(reason) {
  if (!active) return false;
  finish(active, typeof reason === "string" ? reason : "cancelled");
  return true;
}

/** True while a transition is running. Exposed for tests and for re-entrancy checks. */
export function isSignInTransitionActive() {
  return !!active && !active.settled;
}
