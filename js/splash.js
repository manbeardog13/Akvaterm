// js/splash.js — POST-LOGIN REFRACTIVE HANDOFF
//
// A successful sign-in gets one precise 700 ms transition. On a portrait
// phone, a glass outline turns to landscape while its refracted edge expands
// into the black opening of the atelier. On an already-landscape or desktop
// viewport the same opening remains, without instructing the user to rotate.
//
// The transition is decorative and therefore failure-biased toward the app:
// navigation is timer-driven, the watchdog is armed before DOM work, the
// returned promise never rejects, and every exit path removes its overlay.

const STYLE_ID = "akv-handoff-css";
const T_NAV = 160;
const T_TOTAL = 700;
const T_REDUCED_NAV = 60;
const T_REDUCED_TOTAL = 160;
const T_WATCHDOG = 1500;
const T_TEARDOWN_GRACE = 150;

const HANDOFF_MODULES = ["./views/atelier.js", "./journey-opening.js", "./room3d.js"];

export const SIGN_IN_TRANSITION_MS = T_TOTAL;

const CSS = [
  "/* Injected by js/splash.js. The moving properties are opacity and transform only. */",
  ".akv-handoff{position:fixed;inset:0;z-index:2147483645;overflow:hidden;display:grid;place-items:center;background:#020403;pointer-events:none;isolation:isolate;animation:akvHandoffVeil " + T_TOTAL + "ms cubic-bezier(.22,1,.36,1) both}",
  ".akv-handoff-field{position:relative;width:min(72vw,390px);aspect-ratio:1;display:grid;place-items:center;perspective:1000px;transform:translateZ(0)}",
  ".akv-handoff-contour{position:absolute;inset:19%;border:1px solid rgba(197,232,212,.18);border-radius:31%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);opacity:0;animation:akvHandoffContour " + T_TOTAL + "ms cubic-bezier(.22,1,.36,1) both}",
  ".akv-handoff-contour:nth-child(2){inset:12%;border-color:rgba(181,213,196,.105);animation-delay:35ms;transform:rotate(-7deg)}",
  ".akv-handoff-contour:nth-child(3){inset:5%;border-color:rgba(190,141,91,.095);animation-delay:70ms;transform:rotate(9deg)}",
  ".akv-handoff-aperture{position:relative;width:48px;height:82px;border-radius:14px;border:1px solid rgba(235,248,240,.78);background:linear-gradient(142deg,rgba(255,255,255,.12),rgba(102,160,126,.055) 44%,rgba(181,119,66,.075));box-shadow:-2px 0 0 rgba(113,205,155,.2),2px 0 0 rgba(199,132,78,.16),inset 0 0 0 1px rgba(255,255,255,.09),0 22px 54px rgba(0,0,0,.58);transform-origin:center;animation:akvHandoffTurn " + T_TOTAL + "ms cubic-bezier(.2,.82,.2,1) both}",
  ".akv-handoff-aperture:before{content:'';position:absolute;left:50%;top:5px;width:12px;height:1px;border-radius:2px;background:rgba(240,248,243,.72);transform:translateX(-50%);opacity:.78}",
  ".akv-handoff-aperture:after{content:'';position:absolute;inset:5px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(162deg,rgba(82,130,102,.16),rgba(3,7,5,.28) 48%,rgba(136,83,48,.1));box-shadow:inset 9px 0 18px rgba(77,133,101,.07),inset -8px 0 16px rgba(170,104,57,.055)}",
  ".akv-handoff-copy{position:absolute;left:50%;top:calc(50% + 76px);width:max-content;max-width:70vw;transform:translate3d(-50%,8px,0);color:rgba(228,241,233,.64);font:500 10px/1.2 var(--font-text,system-ui,sans-serif);letter-spacing:.19em;text-transform:uppercase;opacity:0;animation:akvHandoffCopy " + T_TOTAL + "ms cubic-bezier(.22,1,.36,1) both}",
  ".akv-handoff-copy:before,.akv-handoff-copy:after{content:'';display:inline-block;width:18px;height:1px;margin:0 9px 3px;background:currentColor;opacity:.26}",
  "@keyframes akvHandoffTurn{0%,12%{opacity:0;transform:rotate(0deg) scale(.82)}22%{opacity:1;transform:rotate(0deg) scale(1)}64%{opacity:1;transform:rotate(90deg) scale(1.05)}82%{opacity:.72;transform:rotate(90deg) scale(4.8)}100%{opacity:0;transform:rotate(90deg) scale(8.4)}}",
  "@keyframes akvHandoffContour{0%,14%{opacity:0;transform:scale(.56) rotate(-5deg)}36%{opacity:.8;transform:scale(1) rotate(0deg)}72%{opacity:.22;transform:scale(1.3) rotate(3deg)}100%{opacity:0;transform:scale(1.72) rotate(5deg)}}",
  "@keyframes akvHandoffCopy{0%,18%{opacity:0;transform:translate3d(-50%,8px,0)}30%,58%{opacity:1;transform:translate3d(-50%,0,0)}76%,100%{opacity:0;transform:translate3d(-50%,-6px,0)}}",
  "@keyframes akvHandoffVeil{0%,74%{opacity:1}100%{opacity:0}}",
  "@media (min-width:761px),(orientation:landscape){.akv-handoff-copy{display:none}.akv-handoff-aperture{width:58px;height:94px;animation-name:akvHandoffOpen}}",
  "@keyframes akvHandoffOpen{0%,12%{opacity:0;transform:scale(.72)}30%{opacity:1;transform:scale(1)}76%{opacity:.72;transform:scale(5.2)}100%{opacity:0;transform:scale(9)}}",
  "@media (prefers-reduced-motion:reduce){.akv-handoff{animation:akvHandoffReduced " + T_REDUCED_TOTAL + "ms linear both}.akv-handoff-contour{display:none}.akv-handoff-aperture{animation:none!important;transform:rotate(90deg);opacity:.75}.akv-handoff-copy{animation:none!important;opacity:.72;transform:translate3d(-50%,0,0)}}",
  "@keyframes akvHandoffReduced{0%,58%{opacity:1}100%{opacity:0}}",
  "@media (forced-colors:active){.akv-handoff{background:Canvas}.akv-handoff-contour{display:none}.akv-handoff-aperture{border:1px solid CanvasText;background:Canvas;box-shadow:none;forced-color-adjust:auto}.akv-handoff-copy{color:CanvasText}}",
].join("\n");

let active = null;

function now() {
  try { return performance.now(); } catch { return Date.now(); }
}

function warn(message, error) {
  try { console.warn("[splash] " + message, error || ""); } catch { /* console unavailable */ }
}

function prefersReduced() {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function warmLocalJourneyModules() {
  for (const specifier of HANDOFF_MODULES) {
    try {
      const href = new URL(specifier, import.meta.url).href;
      if (document.querySelector('link[rel="modulepreload"][href="' + href + '"]')) continue;
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = href;
      document.head.appendChild(link);
    } catch (error) {
      warn("module warm-up skipped", error);
    }
  }
}

function wantsPhoneCue() {
  try {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const touch = (navigator.maxTouchPoints || 0) > 0;
    return height > width && width <= 760 && (coarse || touch);
  } catch { return false; }
}

function buildOverlay(run) {
  const overlay = document.createElement("div");
  overlay.className = "akv-handoff";
  overlay.setAttribute("aria-hidden", "true");

  const field = document.createElement("div");
  field.className = "akv-handoff-field";
  for (let index = 0; index < 3; index += 1) {
    const contour = document.createElement("i");
    contour.className = "akv-handoff-contour";
    field.appendChild(contour);
  }

  const aperture = document.createElement("i");
  aperture.className = "akv-handoff-aperture";
  field.appendChild(aperture);

  if (run.phoneCue) {
    const copy = document.createElement("span");
    copy.className = "akv-handoff-copy";
    copy.textContent = run.copy;
    field.appendChild(copy);
  }

  overlay.appendChild(field);
  document.body.appendChild(overlay);
  run.overlay = overlay;
}

function later(run, callback, delay) {
  const id = setTimeout(() => {
    run.timers = run.timers.filter((timer) => timer !== id);
    try { callback(); } catch (error) { warn("transition callback failed", error); finish(run, "error"); }
  }, delay);
  run.timers.push(id);
  return id;
}

function navigateOnce(run) {
  if (run.navigated || run.navigate === false) return;
  run.navigated = true;
  try { run.navigate(); } catch (error) { warn("navigation hook failed", error); }
}

function cleanup(run) {
  for (const timer of run.timers.splice(0)) clearTimeout(timer);
  for (const remove of run.listeners.splice(0)) {
    try { remove(); } catch { /* already detached */ }
  }
  try { run.overlay?.remove(); } catch { /* already removed */ }
  run.overlay = null;
}

function finish(run, reason) {
  if (!run || run.settled) return;
  run.settled = true;
  if (reason !== "superseded") navigateOnce(run);
  cleanup(run);
  if (active === run) active = null;
  try { run.settle({ reason, reduced: run.reduced, phoneCue: run.phoneCue }); } catch { /* promise already settled */ }
}

function decorate(promise, run) {
  try {
    Object.defineProperty(promise, "cancel", {
      value: (reason) => finish(run, typeof reason === "string" ? reason : "cancelled"),
      configurable: true,
    });
  } catch { /* module-level cancel remains available */ }
  return promise;
}

/**
 * Play the post-login handoff. It never rejects and guarantees navigation
 * unless the caller explicitly passes { navigate: false }.
 *
 * @param {object} [options]
 * @param {Function|false} [options.navigate]
 * @param {boolean} [options.reduced]
 * @param {{title?:string}|false} [options.orientationCue]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{reason:string,reduced:boolean,phoneCue:boolean}> & {cancel:Function}}
 */
export function playSignInTransition(options) {
  const opts = options || {};
  if (active) cancelSignInTransition("superseded");

  let settle = () => {};
  const promise = new Promise((resolve) => { settle = resolve; });
  const reduced = opts.reduced === true || prefersReduced();
  const phoneCue = opts.orientationCue !== false && wantsPhoneCue();
  const cueTitle = opts.orientationCue && typeof opts.orientationCue === "object"
    ? opts.orientationCue.title
    : "Zakrenite uređaj";

  const run = {
    settle,
    settled: false,
    navigated: false,
    reduced,
    phoneCue,
    copy: cueTitle || "Zakrenite uređaj",
    overlay: null,
    timers: [],
    listeners: [],
    navigate: typeof opts.navigate === "function"
      ? opts.navigate
      : (opts.navigate === false || opts.navigate === null ? false : () => { location.hash = "#/"; }),
    ignoreTeardownUntil: now() + (reduced ? T_REDUCED_NAV : T_NAV) + T_TEARDOWN_GRACE,
  };
  active = run;

  // Armed before DOM work. A visual failure can never strand a signed-in user.
  later(run, () => finish(run, "watchdog"), T_WATCHDOG);

  try {
    const onTeardown = () => {
      if (now() < run.ignoreTeardownUntil) return;
      finish(run, "teardown");
    };
    window.addEventListener("akv:teardown", onTeardown);
    run.listeners.push(() => window.removeEventListener("akv:teardown", onTeardown));

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
      run.listeners.push(() => opts.signal.removeEventListener("abort", onAbort));
    }

    ensureStyles();
    warmLocalJourneyModules();
    buildOverlay(run);

    later(run, () => navigateOnce(run), reduced ? T_REDUCED_NAV : T_NAV);
    later(run, () => finish(run, "done"), reduced ? T_REDUCED_TOTAL : T_TOTAL);
  } catch (error) {
    warn("transition failed to start", error);
    finish(run, "error");
  }

  return decorate(promise, run);
}

export function cancelSignInTransition(reason) {
  if (!active) return false;
  finish(active, typeof reason === "string" ? reason : "cancelled");
  return true;
}

export function isSignInTransitionActive() {
  return !!active && !active.settled;
}
