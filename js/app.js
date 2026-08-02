// ============================================================================
// app.js — routing + the app frame. Owns the hash router (ROUTES regex table,
// lazy view imports, navSeq staleness guard), the chrome (header with the
// AKVA|TERM wordmark, desktop top-nav + mobile tab bar, the "Više" popover),
// the toast area (exposed as window.AKV.toast) and the single service-worker
// registration. Views render into #main — a FRESH #main per navigation — and
// clean up via their optional teardown() export plus the "akv:teardown" event
// fired on every navigation. Once the first view has painted, app.js hands the
// branded splash back to index.html's bootstrap (window.akvHideSplash) so it
// fades on its own schedule rather than being removed mid-animation.
// Business rules live in domain.js; data access in db.js; chrome text in i18n.
//
// THERE IS NO AUTH GATE IN THIS ROUTER, and adding one would be a change of
// product, not a refactor. #/prijava is an ordinary route reachable from one
// row in the "Više" menu; every other route renders whether a session exists
// or not, and on the public demo config.js is empty so no session can exist at
// all. The only thing authentication touches in this file is which label that
// one menu row carries — see watchAuthState() below.
//
// ---------------------------------------------------------------------------
// Iris re-skin — what this file contributes to the liquid-glass chrome
// ---------------------------------------------------------------------------
// The top bar and the floating bottom tab bar are the app's TWO STANDING glass
// surfaces; the performance budget allows 2–3 backdrop-filter surfaces at once,
// so a modal (the QR share sheet, a bottom sheet) REPLACES a glass panel rather
// than adding a third. Nothing else in the chrome is glass.
//
// Both bars follow the same structure, and it is not cosmetic:
//
//     <header class="topbar">            <- the FIXED/STICKY wrapper, TRANSPARENT
//       <span class="topbar__surface">   <- ABSOLUTELY POSITIONED child, the glass
//       <div  class="topbar__inner">     <- the content row, env() safe-area padding
//
// Safari 26 samples background-color + backdrop-filter off position:fixed
// elements near the viewport edge in order to tint its own browser chrome. If
// the fixed wrapper itself carries the glass, Safari samples the PANEL instead
// of the page and the bar tints wrong. Keeping the wrapper transparent and
// moving the glass onto an absolutely positioned child fixes it. Do not
// "simplify" the surface span away.
//
// No colour literal appears in this file. The wordmark is plain
// `.wordmark > .akva/.term` markup and css/styles.css decides how it is painted.
//
// What it decides, verified against the shipped rule and in the browser: AKVA is
// --logo-navy #00008C and TERM is --logo-red #d6252e, set in the TEXT face
// (Figtree) italic 800 — NOT teal/amber, and NOT the Anton display face. The
// logo is EXEMPT from the Iris palette by standing operator instruction
// (2026-08-02, "keep the logo original in font and color"), which is why those
// two values live in dedicated --logo-* tokens outside the rebindable ink set.
// This comment previously claimed --teal-600 / --amber-600 "in the display
// face"; that described a repaint that was never applied and is corrected here.
//
// CSS CONTRACT — the class names this file emits, which css/styles.css must
// style. Changing a name here without changing it there yields an unstyled bar,
// so they are listed rather than left to be discovered:
//
//   .topbar                 transparent fixed/sticky wrapper
//   .topbar__surface        absolute inset:0, the glass (background + blur)
//   .topbar__inner          flex row, padding from env(safe-area-inset-left/right)
//   .tabbar                 transparent fixed wrapper (the floating pill)
//   .tabbar__surface        absolute inset:0, border-radius:inherit, the glass
//   .tabbar__item           one tab; also on the "Više" button
//   [aria-current="page"]   set alongside .active on the active tab
//   .brand.wordmark > .akva / .term      the two-colour wordmark (text face)
//   .menu-pop .menu-item                 a row in the "Više" popover
//   .menu-pop .menu-sep                  separator above the switch
//   .menu-toggle / .menu-toggle-text / .menu-item-label / .menu-item-hint /
//   .menu-switch > i                     the "Smanji prozirnost" switch
//   html[data-transparency="reduced"]    solid-surface override (see below)
//
// TYPE HAZARD, measured from the font, not assumed: Anton's Croatian carons
// (Č Š Ž) reach 1.100em, so any Anton heading needs line-height >= 1.05 and must
// never sit in a clipped or overflow:hidden box. "AKVATERM" carries no
// diacritic, but .topbar__inner must still not clip its children — a nav label
// or a view heading landing in the same row would lose its caron. Figtree is
// safe at any line-height.
// ============================================================================

import { t, LANG } from "./i18n.js";
import { initSupabase } from "./supabaseClient.js";
import { authConfigured, getSession, onAuthChange, signOut } from "./db.js";

// THE version literal. Bumped on every ship, and there is exactly one of it:
// the service worker is registered below as `./service-worker.js?v=${APP_V}`,
// reads that query back as its VERSION, and derives `CACHE = "akv-" + VERSION`.
// So the cache name follows this line automatically — it is "akv-v2" today —
// and the two cannot drift the way they did when service-worker.js carried its
// own literal. service-worker.js's FALLBACK_VERSION is now only what a
// registration WITHOUT the query would fall back to; keep it equal to this
// string anyway, so a hand-registered worker lands in the same cache.
// The worker's SHELL list must still cover every shipped file.
export const APP_V = "v2";

document.documentElement.lang = LANG;

// The mount element. index.html ships `<div id="app">` and css/styles.css
// styles that id — the two MUST agree, or the self-heal below fires on every
// boot and tears the branded splash out mid-choreography.
// Self-heal a stale/mismatched shell (ASC lesson): only when a cached old
// index.html without our mount element is served with this app.js do we rebuild
// the body, instead of silently white-screening. Exceptional path, not the
// normal one.
let root = document.getElementById("app");
if (!root) {
  document.body.innerHTML = "";
  root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
}
window.__akvBooted = true;   // recovery watchdogs can tell "bundle parsed" from "network dead"

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// t() with an inline Croatian fallback — the same tf/T pattern the views use.
// A dictionary miss must never leak a raw key into the UI or, worse, into an
// aria-label where a screen reader would read it aloud.
const T = (key, fb) => { const v = t(key); return v === key ? fb : v; };

// ---- Transparency preference ("Smanji prozirnost") --------------------------
// Every glass surface ships four automatic degradation paths in css/styles.css
// (@supports not backdrop-filter, prefers-reduced-transparency, prefers-contrast
// / forced-colors, prefers-reduced-motion). This fifth path is MANUAL, and it is
// not redundant: **Safari never reports prefers-reduced-transparency**, and iOS
// Safari is the bulk of this audience. Without a switch the entire iOS install
// base has no way to turn the blur off — so the switch is an accessibility
// requirement, not a preference panel nicety.
//
// State lives on <html> as data-transparency="reduced" and persists under
// "akv:transparency". Three stored states, deliberately:
//   "reduced" — user asked for solid surfaces
//   "full"    — user explicitly asked to keep the glass
//   (absent)  — AUTO: follow the OS. Never overrides a user who has chosen.
// Auto tracks the media query live, so turning the OS setting on mid-session
// takes effect without a reload.
const TRANSPARENCY_KEY = "akv:transparency";
const REDUCED = "reduced";
const FULL = "full";
const TRANSPARENCY_TOGGLE_ATTR = "data-akv-transparency";

const reducedTransparencyMQ =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-transparency: reduce)")
    : null;

/** The explicitly stored choice, or null when the user has never chosen.
 *  localStorage throws in Safari private mode / with storage blocked, so every
 *  access is guarded: a blocked store degrades to "follow the OS", never to a
 *  broken chrome. */
function storedTransparency() {
  try {
    const v = localStorage.getItem(TRANSPARENCY_KEY);
    return v === REDUCED || v === FULL ? v : null;
  } catch { return null; }
}

function transparencyIsReduced() {
  const stored = storedTransparency();
  if (stored) return stored === REDUCED;
  return !!reducedTransparencyMQ?.matches;
}

/** Write the state onto <html> and re-sync any mounted toggle.
 *
 *  All THREE states are expressed, not just the reduced one, because
 *  css/styles.css distinguishes them:
 *
 *    data-transparency="reduced"  -> an unconditional solid-surface rule
 *    data-transparency="full"     -> the OS reduced-transparency block is
 *                                    written `html:not([data-transparency="full"])`,
 *                                    so this attribute is the ONLY way a user
 *                                    who wants the glass can override an OS
 *                                    that asked for solid surfaces
 *    (absent)                     -> auto; the media query decides alone
 *
 *  Writing only "reduced" (as this first did) silently dropped the explicit
 *  "keep the glass" choice: the value was stored, the attribute was not, and
 *  the stylesheet went on forcing solid surfaces.
 */
function applyTransparency() {
  const html = document.documentElement;
  const stored = storedTransparency();
  const reduced = transparencyIsReduced();
  if (stored) html.dataset.transparency = stored;          // explicit: reduced | full
  else if (reduced) html.dataset.transparency = REDUCED;    // auto, OS asked for it
  else delete html.dataset.transparency;                    // auto, nothing to say
  document.querySelectorAll(`[${TRANSPARENCY_TOGGLE_ATTR}]`)
    .forEach((el) => el.setAttribute("aria-checked", String(reduced)));
  return reduced;
}

function setTransparencyReduced(reduced) {
  try { localStorage.setItem(TRANSPARENCY_KEY, reduced ? REDUCED : FULL); } catch { /* storage blocked — the attribute below still applies for this session */ }
  return applyTransparency();
}

applyTransparency();
// Only auto-mode follows the OS; an explicit choice must survive an OS change.
reducedTransparencyMQ?.addEventListener?.("change", () => {
  if (!storedTransparency()) applyTransparency();
});

// ---- Routes (each view exports `async render(container, params)` + optional
// `teardown()`); params is the array of regex capture groups. -----------------
const ROUTES = [
  { pattern: /^\/?$/,                  load: () => import("./views/katalog.js") },
  { pattern: /^\/katalog\/([^/]+)$/,   load: () => import("./views/katalog.js") },
  { pattern: /^\/proizvod\/([^/]+)$/,  load: () => import("./views/proizvod.js") },
  { pattern: /^\/dizajner$/,           load: () => import("./views/dizajner.js") },
  { pattern: /^\/dizajner\/([^/]+)$/,  load: () => import("./views/dizajner.js") },
  { pattern: /^\/soba3d$/,             load: () => import("./views/soba3d.js") },
  { pattern: /^\/savjetnik$/,          load: () => import("./views/savjetnik.js") },
  { pattern: /^\/favoriti$/,           load: () => import("./views/favoriti.js") },
  { pattern: /^\/dizajni$/,            load: () => import("./views/dizajni.js") },
  // Sign-in. Reachable ONLY from the "Više" menu — nothing redirects into it,
  // no other route consults a session, and js/views/prijava.js always offers
  // "Nastavi kao gost". The app is usable signed out, by design, and on the
  // public demo there is no backend to sign in to at all.
  { pattern: /^\/prijava$/,            load: () => import("./views/prijava.js") },
];

// Tab-bar / top-nav glyphs. Inline SVG (no icon font, no sprite fetch) drawn on
// currentColor so the active/inactive colour transitions come for free, sized by
// css/styles.css. The bottom tab bar is designed around this icon+label stack:
// without an .ic the active halo (styles.css .tabbar a.active::after) lands on
// the label instead of behind the icon.
const SVG = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const ICONS = {
  // Katalog — a field of tiles
  katalog: SVG(`<rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.7"/><rect x="13.4" y="3.4" width="7.2" height="7.2" rx="1.7"/><rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.7"/><rect x="13.4" y="13.4" width="7.2" height="7.2" rx="1.7"/>`),
  // Dizajner — a room corner in perspective (two walls + floor)
  dizajner: SVG(`<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 4l5.6 5.2v10.8M21 4l-5.6 5.2v10.8M8.6 9.2h6.8"/>`),
  // 3D soba — an isometric cube
  soba3d: SVG(`<path d="M12 2.8l8.6 4.6v9.2L12 21.2 3.4 16.6V7.4z"/><path d="M3.4 7.4L12 12l8.6-4.6M12 12v9.2"/>`),
  // Savjetnik — a speech bubble
  savjetnik: SVG(`<path d="M20.6 12.1c0 3.9-3.85 7.1-8.6 7.1-.95 0-1.86-.13-2.72-.36L4.2 20.4l1.42-3.5A6.75 6.75 0 0 1 3.4 12.1C3.4 8.2 7.25 5 12 5s8.6 3.2 8.6 7.1z"/>`),
  // Više — horizontal ellipsis
  vise: SVG(`<circle cx="5.6" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.4" cy="12" r="1.6" fill="currentColor" stroke="none"/>`),
};

const NAV = [
  { route: "/",          key: "nav.katalog",   fb: "Katalog",   icon: "katalog" },
  { route: "/dizajner",  key: "nav.dizajner",  fb: "Dizajner",  icon: "dizajner" },
  { route: "/soba3d",    key: "nav.soba3d",    fb: "3D soba",   icon: "soba3d" },
  { route: "/savjetnik", key: "nav.savjetnik", fb: "Savjetnik", icon: "savjetnik" },
];

// ---- App frame (built once) -------------------------------------------------
// The wordmark carries NO colour of its own: `.wordmark > .akva/.term` is the
// same markup index.html's splash already uses, and css/styles.css is the one
// place that decides AKVA is --logo-navy and TERM is --logo-red, both set in
// the text face. That is what lets a palette change be a one-file change — and
// what lets the logo sit OUT of that change, which is the point: it is exempt
// from the Iris palette by operator instruction. Emitting the two spans and
// nothing else is what keeps that decision in one file. Do not add a colour or
// a font-family here.
//
// `.topbar__surface` / `.tabbar__surface` are the absolutely positioned glass
// panes described in the file header — empty, aria-hidden, purely presentational.
function mountFrame() {
  if (document.getElementById("main")) return;
  const link = (n, cls) =>
    `<a href="#${n.route}" data-route="${n.route}"${cls ? ` class="${cls}"` : ""}><span class="ic">${ICONS[n.icon]}</span><span class="lbl">${esc(T(n.key, n.fb))}</span></a>`;
  const moreLabel = esc(T("nav.vise", "Više"));
  const moreBtn = (cls) =>
    `<button type="button" class="${cls}" aria-haspopup="menu" aria-expanded="false"><span class="ic">${ICONS.vise}</span><span class="lbl">${moreLabel}</span></button>`;
  root.innerHTML = `
    <header class="topbar">
      <span class="topbar__surface" aria-hidden="true"></span>
      <div class="topbar__inner">
        <a class="brand wordmark" href="#/" aria-label="Akvaterm"><span class="akva">AKVA</span><span class="term">TERM</span></a>
        <nav class="topbar-nav" aria-label="${esc(T("a11y.primaryNav", "Glavna navigacija"))}">${NAV.map((n) => link(n)).join("")}</nav>
        <span class="spacer"></span>
        ${moreBtn("btn btn-ghost more-btn")}
      </div>
    </header>
    <main id="main"></main>
    <nav class="tabbar" aria-label="${esc(T("a11y.sections", "Odjeljci"))}">
      <span class="tabbar__surface" aria-hidden="true"></span>
      ${NAV.map((n) => link(n, "tabbar__item")).join("")}
      ${moreBtn("more-btn tab-more tabbar__item")}
    </nav>
    <div id="toasts" class="toasts" aria-live="polite"></div>`;
}

// Every navigation gets a FRESH <main id="main">. A view whose data await is
// still in flight when the user navigates away then writes its markup into an
// element that is no longer in the document, so a slow view can never repaint
// itself over the newer one (the app.js-side stale() checks below only guard
// app.js's own steps — they cannot reach inside a view's awaits).
function swapMain() {
  const old = document.getElementById("main");
  const fresh = document.createElement("main");
  fresh.id = "main";
  if (old) old.replaceWith(fresh); else root.appendChild(fresh);
  return fresh;
}

// `.active` drives the visual state; `aria-current="page"` is the part assistive
// tech actually announces, and the glass tab bar's pressed-pill rule keys off it
// too — so the two must be set together, never one or the other.
function setActiveNav(path) {
  const seg = path.split("/")[1] || "";
  let base = "/" + seg;
  if (seg === "" || seg === "katalog" || seg === "proizvod") base = "/";
  const onMore = seg === "favoriti" || seg === "dizajni" || seg === "prijava";
  document.querySelectorAll("[data-route]").forEach((a) => {
    const on = !onMore && a.dataset.route === base;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.querySelectorAll(".more-btn").forEach((b) => b.classList.toggle("active", onMore));
}

// ---- Toasts (window.AKV.toast) ----------------------------------------------
export function toast(msg, kind = "") {
  const wrap = document.getElementById("toasts");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = "toast" + (kind ? ` toast-${kind}` : "");
  el.setAttribute("role", "status");
  el.textContent = msg;
  wrap.appendChild(el);
  // The enter/exit classes MUST stay "toast-in"/"toast-out": css/styles.css
  // parks .toast at opacity:0 and only .toast.toast-in lifts it into view.
  requestAnimationFrame(() => el.classList.add("toast-in"));
  setTimeout(() => {
    el.classList.remove("toast-in");
    el.classList.add("toast-out");
    const done = () => el.remove();
    el.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 400);   // fallback if the transition is skipped (reduced-motion)
  }, 3200);
}
window.AKV = { toast };

// ---- Auth state — consumed by ONE menu label --------------------------------
// This is the app's entire relationship with authentication. There is no gate:
// no route checks a session, no view refuses to render without one, and the
// catalogue, designer, 3D room and advisor behave identically signed in or
// out. All this decides is whether the "Više" menu offers "Prijava" (opening
// #/prijava) or "Odjava".
//
// It is CACHED rather than awaited because openMore() draws synchronously — a
// popover must not wait on the network to decide a row. The initial value,
// null, means "signed out, or not looked up yet"; both are shown the same way
// and both lead to a screen that explains the real state. On the public demo
// config.js is empty, so authConfigured() is false, nothing is ever looked up,
// and the row stays "Prijava" for the life of the session.
const SIGNOUT_ATTR = "data-akv-signout";
let authedEmail = null;

function watchAuthState() {
  if (!authConfigured()) return;   // no backend to ask, and nothing to change
  getSession().then((session) => { authedEmail = session?.user?.email || null; }).catch(() => {});
  // App-lifetime subscription: a session that expires, or a sign-in performed
  // on the login screen, must move this label without a reload.
  onAuthChange((session) => { authedEmail = session?.user?.email || null; });
}

// ---- "Više" popover (Favoriti + Moji dizajni + Prijava) ---------------------
let moreCleanup = null;
function closeMore() {
  const pop = document.getElementById("morePop");
  document.querySelectorAll(".more-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
  // Release the document-level listeners UNCONDITIONALLY — not only when the
  // popover element is still there. Returning early on a missing #morePop (as
  // this did) strands onDocClick with a closure over the detached popover, and
  // a stranded onDocClick then closes the NEXT popover on its first click
  // INSIDE it, because the element it tests containment against is the old one.
  // Harmless while every menu row navigated away on click; the "Smanji
  // prozirnost" switch is the first row that must survive being clicked.
  if (moreCleanup) { moreCleanup(); moreCleanup = null; }
  pop?.remove();
}
function openMore(anchor) {
  if (document.getElementById("morePop")) { closeMore(); return; }
  anchor.setAttribute("aria-expanded", "true");
  const pop = document.createElement("div");
  pop.id = "morePop";
  pop.className = "card menu-pop";
  pop.setAttribute("role", "menu");
  // Only the two declarations that are inseparable from the runtime coordinates
  // computed below stay inline; everything cosmetic (width, padding, radius,
  // elevation, the separator and switch) belongs to .menu-pop in styles.css.
  // z-index 64 sits ABOVE the glass bars (60) — a menu anchored to the tab bar
  // that paints under it is unusable — and below the sheet backdrop (70).
  pop.style.position = "fixed";
  pop.style.zIndex = "64";
  const item = (route, label) =>
    `<a href="#${route}" role="menuitem" class="btn btn-ghost menu-item">${label}</a>`;
  // role="menuitemcheckbox" + aria-checked is what makes a screen reader read
  // this as a switch inside the menu rather than as a plain command. The hint
  // line is not decoration: "Smanji prozirnost" alone does not tell a user what
  // is about to change on screen.
  const transparencyItem = `
      <div class="menu-sep" role="separator"></div>
      <button type="button" role="menuitemcheckbox" aria-checked="${transparencyIsReduced()}"
              class="btn btn-ghost menu-item menu-toggle" ${TRANSPARENCY_TOGGLE_ATTR}>
        <span class="menu-toggle-text">
          <span class="menu-item-label">${esc(T("nav.transparency", "Smanji prozirnost"))}</span>
          <span class="menu-item-hint">${esc(T("nav.transparencyHint", "Zamućeno staklo zamjenjuje puna boja — tekst je čitljiviji."))}</span>
        </span>
        <span class="menu-switch" aria-hidden="true"><i></i></span>
      </button>`;
  // "Odjava" is a BUTTON, not a link: signing out is an action, and rendering
  // it as a menu link would put a route in the URL that immediately undoes
  // itself. "Prijava" stays a link, so it works with middle-click, and so it
  // still works if this popover's click handler never attached.
  const authItem = authedEmail
    ? `<button type="button" role="menuitem" class="btn btn-ghost menu-item" ${SIGNOUT_ATTR}>${esc(T("nav.odjava", "Odjava"))}</button>`
    : item("/prijava", esc(T("nav.prijava", "Prijava")));
  pop.innerHTML =
    item("/favoriti", esc(T("nav.favoriti", "Favoriti"))) +
    item("/dizajni", esc(T("nav.dizajni", "Moji dizajni"))) +
    authItem +
    transparencyItem;
  document.body.appendChild(pop);

  // Position near the pressed button: above a bottom-tab anchor, below a
  // top-bar anchor, right-aligned to it either way.
  const r = anchor.getBoundingClientRect();
  if (r.top > window.innerHeight * 0.6) {
    pop.style.bottom = `${window.innerHeight - r.top + 8}px`;
  } else {
    pop.style.top = `${r.bottom + 8}px`;
  }
  pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;

  const onDocClick = (e) => { if (!pop.contains(e.target) && !e.target.closest?.(".more-btn")) closeMore(); };
  const onHash = () => closeMore();
  const onKey = (e) => { if (e.key === "Escape") closeMore(); };
  setTimeout(() => {
    document.addEventListener("click", onDocClick, true);
    window.addEventListener("hashchange", onHash);
    document.addEventListener("keydown", onKey);
  }, 0);
  moreCleanup = () => {
    document.removeEventListener("click", onDocClick, true);
    window.removeEventListener("hashchange", onHash);
    document.removeEventListener("keydown", onKey);
  };
  pop.addEventListener("click", (e) => {
    if (e.target.closest("a[role=menuitem]")) { closeMore(); return; }
    if (e.target.closest?.(`[${SIGNOUT_ATTR}]`)) {
      closeMore();
      // signOut() clears db.js's cached session before it awaits the network,
      // so the label is already correct even if the revoke call fails.
      signOut().then(() => {
        authedEmail = null;
        toast(T("prijava.signedOut", "Odjavljeni ste."));
        // If the login screen itself is on screen, repaint it into its
        // signed-out state rather than leaving a stale account card.
        if (location.hash.replace(/^#/, "").split("?")[0] === "/prijava") route();
      });
      return;
    }
    const toggle = e.target.closest?.(`[${TRANSPARENCY_TOGGLE_ATTR}]`);
    if (!toggle) return;
    // Deliberately does NOT close the menu: the whole point of the switch is
    // that the two bars behind the popover change under the user's finger, and
    // a menu that vanishes on tap hides the very thing being demonstrated.
    const reduced = setTransparencyReduced(toggle.getAttribute("aria-checked") !== "true");
    toast(reduced
      ? T("nav.transparencyOn", "Prozirnost je smanjena.")
      : T("nav.transparencyOff", "Prozirnost je uključena."));
  });
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest?.(".more-btn");
  if (btn) { e.preventDefault(); openMore(btn); }
});

// ---- Router -----------------------------------------------------------------
// Two layers guard against a slow view repainting over the screen the user has
// already navigated to:
//   1. navSeq — a route() run that finished after a newer one started must not
//      touch the DOM. This only covers app.js's OWN steps.
//   2. swapMain() — a fresh #main per navigation, so a view that writes its
//      markup after its own internal await (every view does: they await
//      db.listProducts() and only then set container.innerHTML) writes into a
//      detached element. app.js cannot reach inside a view's awaits, so the
//      container identity is what makes the abandoned write harmless.
let navSeq = 0;
let activeView = null;   // current view module, for its optional teardown()
async function route() {
  const seq = ++navSeq;
  const stale = () => seq !== navSeq;
  // A share link may carry a query INSIDE the hash — strip it before matching.
  const path = location.hash.replace(/^#/, "").split("?")[0] || "/";

  if (activeView && typeof activeView.teardown === "function") {
    try { activeView.teardown(); } catch { /* view cleanup must never block navigation */ }
  }
  activeView = null;
  // Views with live resources (canvas loops, three.js, streams) listen for
  // this and shut them down — it fires on EVERY view swap.
  window.dispatchEvent(new Event("akv:teardown"));

  mountFrame();
  setActiveNav(path);
  closeMore();
  const main = swapMain();

  const match = ROUTES.map((r) => ({ r, m: path.match(r.pattern) })).find((x) => x.m);
  if (!match) {
    main.innerHTML = `<div class="card"><h2>${esc(T("common.notFound", "Stranica nije pronađena."))}</h2>
      <p class="muted"><a href="#/">${esc(T("nav.katalog", "Katalog"))}</a></p></div>`;
    revealApp();
    return;
  }

  main.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  try {
    const mod = await match.r.load();
    if (stale()) return;                 // user already navigated elsewhere
    await mod.render(main, match.m.slice(1));
    if (stale()) return;
    activeView = mod;
    revealApp();                         // first real paint — let the splash fade out
    // Replay the view-enter transition so every navigation glides in.
    main.classList.remove("view-enter"); void main.offsetWidth; main.classList.add("view-enter");
  } catch (err) {
    if (stale()) return;                 // never overwrite the NEWER view with an error card
    console.error(err);
    main.innerHTML = `<div class="card"><h2>${esc(T("common.error", "Nešto je pošlo po zlu."))}</h2>
      <p class="muted">${esc(err?.message || "")}</p>
      <button id="reloadBtn" class="btn">${esc(T("common.reload", "Osvježi"))}</button></div>`;
    main.querySelector("#reloadBtn").addEventListener("click", () => location.reload());
    revealApp();
  }
}

// Hand the splash back to index.html's bootstrap so it honours its own
// minimum-display time and fade instead of being yanked out of the DOM
// mid-animation. The direct remove() is the stale-shell fallback only.
function revealApp() {
  if (typeof window.akvHideSplash === "function") window.akvHideSplash();
  else document.getElementById("splash")?.remove();
}

// ---- Boot -------------------------------------------------------------------
initSupabase();   // no-op in the offline demo; fire-and-forget when configured
watchAuthState(); // also a no-op in the demo; only ever moves a menu label
window.addEventListener("hashchange", route);
// Registered WITH ?v=${APP_V}: that query is the worker's only source of
// VERSION, so `akv-${APP_V}` is the cache name by construction rather than by
// two literals agreeing. It also makes the script URL change on every bump,
// which is what guarantees the browser fetches the new worker rather than
// byte-comparing the old one. Scope is unaffected — it comes from the path.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`./service-worker.js?v=${APP_V}`).catch(() => {});
  });
}
route();
