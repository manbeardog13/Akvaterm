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
// So the cache name follows this line automatically from APP_V.
// and the two cannot drift the way they did when service-worker.js carried its
// own literal. service-worker.js's FALLBACK_VERSION is now only what a
// registration WITHOUT the query would fall back to; keep it equal to this
// string anyway, so a hand-registered worker lands in the same cache.
// The worker's SHELL list must still cover every shipped file.
export const APP_V = "v11";

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
// REDUCED TRANSPARENCY IS REMOVED. Operator instruction, 2026-08-03:
// "completely remove the option to reduce transparency."
//
// This pins html[data-transparency="full"] and nothing else, which is the whole
// change. Every reduced-transparency rule in the app - the ten in
// css/styles.css and the scoped copies in each view - is written as
// `html:not([data-transparency="full"]) ...`, deliberately, so that an explicit
// "keep the glass" always wins. Setting it permanently therefore switches off
// BOTH paths at once: the manual toggle and the OS-level
// @media (prefers-reduced-transparency: reduce).
//
// Doing it this way rather than deleting ~385 CSS rules is not laziness, it is
// the safe edit: those rules live inside JS template literals in ten view
// files, and a script that walks braces to remove them cannot tell a CSS block
// from an object literal. One was attempted and gutted eleven files; it was
// reverted. If the rules are ever genuinely deleted, do it by hand, per file.
//
// THE ACCESSIBILITY COST, recorded because it is real and was flagged before
// the change: Safari never reports prefers-reduced-transparency, and iOS is
// most of this audience, so this switch was the ONLY way those users could turn
// the blur off. There is now no way. The other degradation paths are untouched
// - @supports (no backdrop-filter), prefers-contrast and forced-colors all
// still fire, and they cover legibility; what is gone is the transparency
// preference specifically.
function applyTransparency() {
  document.documentElement.dataset.transparency = "full";
  return false;
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
  // The guided commissioning journey. ADDITIVE: /soba3d (the free-form room)
  // is untouched — this is a second front door into the same room3d engine,
  // driven by js/journey.js and director3d's camera verbs. See
  // docs/specs/cinematic-journey.md. Deliberately NOT added to NAV below: the
  // tab bar's corner clearance was hand-measured in-browser for its current
  // five columns (four NAV entries + "Više" — see .tabbar__surface's comment
  // in css/styles.css), and a sixth column changes that geometry. The route
  // works standalone regardless — ROUTES and NAV are independent — so this is
  // reachable at #/atelier without touching chrome that could not be
  // re-verified visually in this session. Wiring nav entry is a follow-up.
  { pattern: /^\/atelier$/,            load: () => import("./views/atelier.js") },
  { pattern: /^\/savjetnik$/,          load: () => import("./views/savjetnik.js") },
  { pattern: /^\/favoriti$/,           load: () => import("./views/favoriti.js") },
  { pattern: /^\/dizajni$/,            load: () => import("./views/dizajni.js") },
  // Sign-in. Reachable ONLY from the "Više" menu — nothing redirects into it,
  // no other route consults a session, and js/views/prijava.js always offers
  // "Nastavi kao gost". The app is usable signed out, by design, and on the
  // public demo there is no backend to sign in to at all.
  { pattern: /^\/prijava$/,            load: () => import("./views/prijava.js") },
  // Credits. Not decoration: two of the vendored 3D models are CC-BY 3.0, and
  // that licence's one condition is that the author is credited somewhere a
  // person can actually reach. A credits view with no route pointing at it
  // satisfies nothing — see the header of js/views/zasluge.js.
  { pattern: /^\/zasluge$/,            load: () => import("./views/zasluge.js") },
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
  // Drawer glyphs. Same construction as the four above — 24px box, 1.7 stroke,
  // round joins, drawn on currentColor — so the drawer and the top bar read as
  // one icon set rather than two.
  burger: SVG(`<path d="M4 7h16M4 12h16M4 17h16"/>`),
  favoriti: SVG(`<path d="M12 20.2S3.8 15.4 3.8 9.7A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 8.2 2.3c0 5.7-8.2 10.5-8.2 10.5z"/>`),
  dizajni: SVG(`<path d="M12 3.2l8.4 4.3-8.4 4.3-8.4-4.3z"/><path d="M3.6 12l8.4 4.3 8.4-4.3M3.6 16.4l8.4 4.3 8.4-4.3"/>`),
  prijava: SVG(`<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>`),
  sun: SVG(`<circle cx="12" cy="12" r="4.1"/><path d="M12 2.6v2.3M12 19.1v2.3M4.36 4.36l1.63 1.63M18.01 18.01l1.63 1.63M2.6 12h2.3M19.1 12h2.3M4.36 19.64l1.63-1.63M18.01 5.99l1.63-1.63"/>`),
  moon: SVG(`<path d="M20.4 13.4A8.3 8.3 0 0 1 10.6 3.6a8.4 8.4 0 1 0 9.8 9.8z"/>`),
  close: SVG(`<path d="M6 6l12 12M18 6L6 18"/>`),
  // Zasluge — an award ribbon, the one glyph that reads as "credit given"
  // rather than "information" or "settings".
  // Terma — a spark, the conventional "this is AI" mark.
  terma: SVG(`<path d="M12 3.4l1.8 4.6 4.6 1.8-4.6 1.8-1.8 4.6-1.8-4.6L5.6 9.8l4.6-1.8z"/><path d="M18.3 15.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>`),
  zasluge: SVG(`<circle cx="12" cy="9" r="5.4"/><path d="M8.6 13.4L7.2 20.6l4.8-2.5 4.8 2.5-1.4-7.2"/>`),
  signout: SVG(`<path d="M15.4 16.6l4.2-4.6-4.2-4.6"/><path d="M19.2 12H9.4"/><path d="M12.4 4.4H5.6a1.2 1.2 0 0 0-1.2 1.2v12.8a1.2 1.2 0 0 0 1.2 1.2h6.8"/>`),
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
  // THE "..." IS NOW TERMA. Its menu held Favoriti, Dizajni and Odjava - all
  // three already in the left drawer, so it was three duplicate rows behind an
  // extra tap. The slot is better spent on the one thing that has nowhere else
  // to live. openMore()/closeMore() stay in this file because the popover
  // machinery is still referenced by the route handler; nothing renders a
  // trigger for it any more.
  const moreBtn = () =>
    `<button type="button" class="btn btn-ghost terma-btn" id="termaBtn"
             aria-haspopup="dialog" aria-expanded="false" aria-controls="aiPanel">
       <span class="terma-shine" aria-hidden="true"></span>
       <span class="ic">${ICONS.terma}</span><span class="lbl">${esc(T("terma.name", "Terma AI"))}</span>
     </button>`;
  // Drawer row. Same <a> shape as the top-nav link, plus the icon column the
  // ASC sidebar aligns every label against.
  const sideLink = (n) =>
    `<a class="sb-item" href="#${n.route}" data-route="${n.route}">${ICONS[n.icon]}<span class="t">${esc(T(n.key, n.fb))}</span></a>`;

  root.innerHTML = `
    <header class="topbar">
      <span class="topbar__surface" aria-hidden="true"></span>
      <div class="topbar__inner">
        <button type="button" class="sb-burger" id="sideOpen"
                aria-label="${esc(T("a11y.openMenu", "Otvori izbornik"))}"
                aria-controls="sideNav" aria-expanded="false">${ICONS.burger}</button>
        <a class="brand wordmark" href="#/" aria-label="Akvaterm"><span class="akva">AKVA</span><span class="term">TERM</span></a>
        <nav class="topbar-nav" aria-label="${esc(T("a11y.primaryNav", "Glavna navigacija"))}">${NAV.map((n) => link(n)).join("")}</nav>
        <span class="spacer"></span>
        ${moreBtn()}
      </div>
    </header>
    <main id="main"></main>

    <!-- The scrim is a SIBLING of the drawer, not a child: it must paint over
         the whole app while the drawer paints over IT, and a child cannot sit
         behind its own parent. It carries the backdrop blur. -->
    <div class="side-scrim" id="sideScrim" hidden></div>
    <aside class="side" id="sideNav" aria-hidden="true">
      <div class="sb-head">
        <span class="sb-eyebrow">${esc(T("a11y.sections", "Odjeljci"))}</span>
        <button type="button" class="sb-x" id="sideClose"
                aria-label="${esc(T("a11y.closeMenu", "Zatvori izbornik"))}">${ICONS.close}</button>
      </div>
      <nav class="sb-nav" aria-label="${esc(T("a11y.primaryNav", "Glavna navigacija"))}">
        ${NAV.map(sideLink).join("")}
        <div class="sb-div" role="presentation"></div>
        <span class="sb-eyebrow2">${esc(T("nav.vise", "Više"))}</span>
        ${sideLink({ route: "/favoriti", key: "nav.favoriti", fb: "Favoriti", icon: "favoriti" })}
        ${sideLink({ route: "/dizajni", key: "nav.dizajni", fb: "Moji dizajni", icon: "dizajni" })}
        ${sideLink({ route: "/prijava", key: "nav.prijava", fb: "Prijava", icon: "prijava" })}
        ${sideLink({ route: "/zasluge", key: "nav.zasluge", fb: "Zasluge", icon: "zasluge" })}
      </nav>
      <div class="sb-foot">
        <!-- THE ACCOUNT ROW. ASC's drawer ends with a user card (app/app.css
             .sb-foot / .sb-user), and this one had only a theme switch, so
             there was nowhere in the menu to see who you are or to sign out.
             The label is filled in by paintAccountRow() once the session is
             known -- it renders signed-out by default because that is the
             honest state before the lookup returns, and a row that guessed
             would flicker from a wrong name to the right one. -->
        <a class="sb-item sb-acct" id="sideAcct" href="#/prijava" data-route="/prijava">
          <span class="sb-ava" id="sideAva" aria-hidden="true">?</span>
          <span class="sb-uid">
            <b id="sideAcctName">${esc(T("nav.prijava", "Prijava"))}</b>
            <span id="sideAcctSub">${esc(T("account.signedOut", "Niste prijavljeni"))}</span>
          </span>
        </a>
        <button type="button" class="sb-item sb-signout" id="sideSignOut" hidden>
          ${ICONS.signout}<span class="t">${esc(T("prijava.signOut", "Odjava"))}</span>
        </button>
        <button type="button" class="sb-item sb-theme" id="themeToggle" aria-pressed="false">
          <span class="sb-themeic">${ICONS.sun}${ICONS.moon}</span>
          <span class="t">${esc(T("theme.label", "Tamna tema"))}</span>
          <span class="sb-switch" aria-hidden="true"><i></i></span>
        </button>
      </div>
    </aside>

    <div id="toasts" class="toasts" aria-live="polite"></div>`;
}

// ---- Left drawer ------------------------------------------------------------
// Replaces the bottom tab bar (operator instruction, 2026-08-02: menus slide in
// from the left, ASC's pattern, "and not fixed on the bottom").
//
// THE STATE LIVES ON <html>, not on the drawer element, for the same reason the
// transparency switch does: the scrim, the drawer transform and the scroll lock
// are three different elements, and one attribute drives all three from CSS
// without any of them needing a reference to the others.
//
// `hidden` on the scrim is toggled a frame apart from the class, deliberately:
// an element going from display:none straight to opacity:1 does not transition
// at all — the browser has no previous computed value to interpolate from. So
// the scrim is un-hidden first, then the class lands on the NEXT frame.
const SIDE_ATTR = "side-open";
let sideRestoreFocus = null;
let frameWired = false;

function sideOpen() {
  const scrim = document.getElementById("sideScrim");
  const drawer = document.getElementById("sideNav");
  if (!drawer) return;
  sideRestoreFocus = document.activeElement;
  if (scrim) scrim.hidden = false;
  requestAnimationFrame(() => {
    document.documentElement.classList.add(SIDE_ATTR);
    drawer.setAttribute("aria-hidden", "false");
    document.getElementById("sideOpen")?.setAttribute("aria-expanded", "true");
    // Focus moves INTO the drawer, or a keyboard user is left behind a scrim
    // they cannot reach, tabbing through content they cannot see.
    drawer.querySelector(".sb-item")?.focus({ preventScroll: true });
  });
}

function sideClose() {
  const drawer = document.getElementById("sideNav");
  const scrim = document.getElementById("sideScrim");
  if (!document.documentElement.classList.contains(SIDE_ATTR)) return;
  document.documentElement.classList.remove(SIDE_ATTR);
  drawer?.setAttribute("aria-hidden", "true");
  document.getElementById("sideOpen")?.setAttribute("aria-expanded", "false");
  // Re-hide only AFTER the fade, or the scrim vanishes instantly and the
  // drawer appears to slide out from behind nothing.
  if (scrim) {
    const done = () => { if (!document.documentElement.classList.contains(SIDE_ATTR)) scrim.hidden = true; };
    scrim.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 400);   // fallback when the transition is skipped
  }
  // Restore focus to whatever opened it, but never to a detached node.
  if (sideRestoreFocus?.isConnected) sideRestoreFocus.focus({ preventScroll: true });
  sideRestoreFocus = null;
}

function wireSide() {
  document.getElementById("sideSignOut")?.addEventListener("click", async () => {
    await signOut();
    authedEmail = null;
    paintAccountRow();
    toast(T("prijava.signedOut", "Odjavljeni ste."));
    sideClose();
    if (location.hash.replace(/^#/, "").split("?")[0] === "/prijava") route();
  });
  paintAccountRow();
  document.getElementById("sideOpen")?.addEventListener("click", sideOpen);
  document.getElementById("sideClose")?.addEventListener("click", sideClose);
  document.getElementById("sideScrim")?.addEventListener("click", sideClose);
  // Escape closes, as it does for the popover — one habit, not two.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") sideClose();
  });
  // A drawer that survives navigation would cover the page the user just asked
  // for. route() also calls this, so a link inside the drawer closes it.
  window.addEventListener("hashchange", sideClose);
}

// ---- Theme ------------------------------------------------------------------
// Three states, and the third is the default: html[data-theme] absent means
// "follow the system", which css/styles.css implements with a
// prefers-color-scheme query. The switch only ever writes an explicit value,
// so a user who has chosen keeps their choice when the OS flips.
const THEME_KEY = "akv:theme";

function storedTheme() {
  try { return localStorage.getItem(THEME_KEY) || ""; } catch { return ""; }
}

function systemPrefersDark() {
  return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
}

function themeIsDark() {
  const stored = storedTheme();
  return stored ? stored === "dark" : systemPrefersDark();
}

// iOS paints the area around the notch from <meta name="theme-color">. It is
// static markup, so it has to be re-tinted whenever the theme moves or the top
// of the screen stays light while the app goes dark.
function setThemeColor(dark) {
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
  m.setAttribute("content", dark ? "#0A0C11" : "#EEF0F1");
}

function applyTheme() {
  const stored = storedTheme();
  const root = document.documentElement;
  if (stored) root.setAttribute("data-theme", stored);
  else root.removeAttribute("data-theme");
  const dark = themeIsDark();
  setThemeColor(dark);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.setAttribute("aria-pressed", String(dark));
}

function wireTheme() {
  applyTheme();
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    try { localStorage.setItem(THEME_KEY, themeIsDark() ? "light" : "dark"); } catch { /* storage blocked — the theme still flips for this session */ }
    applyTheme();
  });
  // Follow the system only while the user has expressed no preference.
  window.matchMedia?.("(prefers-color-scheme: dark)")
    ?.addEventListener?.("change", () => { if (!storedTheme()) applyTheme(); });
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
  // No special case for favoriti/dizajni/prijava any more. They used to be
  // excluded because only the four top-nav links carried data-route and none of
  // them should light up on those routes; the drawer now carries them too, so
  // an exact route match is both correct and sufficient — the top bar has no
  // link to match, and the drawer row lights up as it should.
  document.querySelectorAll("[data-route]").forEach((a) => {
    const on = a.dataset.route === base;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // The "Više" button highlights on exactly the routes that live behind it.
  // Recomputed here rather than reusing the loop above: those routes have no
  // [data-route] link in the TOP bar, so the loop never visits them.
  const behindMore = seg === "favoriti" || seg === "dizajni" || seg === "prijava";
  document.querySelectorAll(".more-btn").forEach((b) => b.classList.toggle("active", behindMore));
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

// Read at module evaluation, BEFORE supabase-js strips the OAuth parameters
// from the address bar — by the time a session arrives the evidence is gone.
// Two distinct returns to recognise:
//   ?code=...   — the PKCE hand-back; a session is about to appear
//   ?error=...  — Google or Supabase refused (user pressed "Cancel", the
//                 client is misconfigured, the account is not permitted)
// Query string, not fragment: see js/supabaseClient.js on why this app must
// stay on the PKCE flow.
const oauthReturn = (() => {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("error")) return { kind: "error", detail: q.get("error_description") || q.get("error") };
    if (q.get("code")) return { kind: "code" };
  } catch { /* no URL API, or an exotic address — treat as an ordinary load */ }
  return null;
})();

/** Paint the drawer's account row from the current session. Called wherever
 *  authedEmail moves, and once after the frame is built — the row is created
 *  before the session lookup resolves, so it has to be filled in rather than
 *  rendered once. */
function paintAccountRow() {
  const name = document.getElementById("sideAcctName");
  const sub = document.getElementById("sideAcctSub");
  const ava = document.getElementById("sideAva");
  const out = document.getElementById("sideSignOut");
  if (!name || !sub) return;
  if (authedEmail) {
    name.textContent = authedEmail.split("@")[0];
    sub.textContent = authedEmail;
    if (ava) ava.textContent = authedEmail.trim().charAt(0).toUpperCase() || "?";
    if (out) out.hidden = false;
  } else {
    name.textContent = T("nav.prijava", "Prijava");
    sub.textContent = T("account.signedOut", "Niste prijavljeni");
    if (ava) ava.textContent = "?";
    if (out) out.hidden = true;
  }
}

function watchAuthState() {
  if (!authConfigured()) { paintAccountRow(); return; }
  getSession().then((session) => { authedEmail = session?.user?.email || null; paintAccountRow(); }).catch(() => {});

  // Only the FIRST session after an OAuth return is worth announcing. Without
  // this latch every page load of an already-signed-in user would toast, since
  // onAuthChange also fires for the restored INITIAL_SESSION.
  let announce = oauthReturn?.kind === "code";

  // App-lifetime subscription: a session that expires, or a sign-in performed
  // on the login screen, must move this label without a reload.
  onAuthChange((session) => {
    authedEmail = session?.user?.email || null;
    paintAccountRow();
    if (announce && authedEmail) {
      announce = false;
      toast(T("prijava.success", "Prijavljeni ste."));
    }
  });

  // A failed return leaves no session and fires no auth event, so it would
  // otherwise be completely silent — the user would land back on the catalogue
  // with no sign that anything was attempted.
  if (oauthReturn?.kind === "error") {
    console.warn("[auth] OAuth return carried an error:", oauthReturn.detail);
    toast(T("prijava.err.other", "Prijava nije uspjela. Pokušajte ponovno."));
    // supabase-js only cleans the address bar on SUCCESS, so clear the failure
    // parameters here — otherwise the hash router keeps them across every
    // subsequent navigation and a reload re-announces a stale failure.
    try {
      history.replaceState(null, "", window.location.pathname + window.location.hash);
    } catch { /* replaceState blocked — a visible query string is harmless */ }
  }
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
  const transparencyItem = "";   // removed with the feature; see applyTransparency()
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
  // Wired AFTER mountFrame(), and once: mountFrame() returns early when the
  // frame already exists, so these elements are built exactly one time and
  // their listeners must be attached exactly one time with them.
  if (!frameWired) {
    frameWired = true;
    wireSide();
    wireTheme();
    // Terma's dock. Mounted ONCE, into the app frame rather than into a view,
    // because it is deliberately the one element that outlives a navigation:
    // an answer still streaming must survive the page the user moved to while
    // waiting for it, and the conversation must still be there when they come
    // back. It wires its own route visibility off hashchange, so nothing here
    // has to know which routes it hides on.
    //
    // Lazy-imported and fire-and-forget: it is not on the first-paint path, and
    // a failure to load it must never take the app down with it.
    import("./aidock.js")
      .then((m) => {
        m.mount();
        document.getElementById("termaBtn")?.addEventListener("click", (e) => {
          e.stopPropagation();   // the dock closes on any outside pointerdown
          m.toggle();
          // Sync aria-expanded to match the dock's new state. The button is
          // created with aria-expanded="false" (line 314) but never updated as
          // the dock opens or closes, breaking accessibility — screen readers
          // report the dialog as closed even when open. Use isOpen() to query
          // the current state and update the button; use rAF to let toggle()
          // settle before reading the state.
          if (typeof m.isOpen === "function") {
            requestAnimationFrame(() => {
              document.getElementById("termaBtn")?.setAttribute("aria-expanded", String(m.isOpen()));
            });
          }
        });
      })
      .catch((err) => console.warn("[app] Terma dock unavailable:", err?.message || err));
  }
  setActiveNav(path);
  closeMore();
  sideClose();
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

// THE LOGIN SCREEN IS THE FRONT DOOR (operator instruction, 2026-08-02: "this
// login page is the first page that has to load when starting up the
// platform"). A COLD START with no route lands on #/prijava.
//
// This is still not an auth GATE, and the difference matters: no route checks a
// session, nothing redirects into #/prijava from anywhere else, and the card's
// own "Nastavi kao gost" is an ordinary <a href="#/">. It is the first screen,
// not a locked one — one tap past it and the whole app is there.
//
// Only when the hash is EMPTY. A deep link (a shared design, a product, the
// OAuth return) must open what it points at; sending those to the login screen
// would break every link the app hands out.
//
// history.replaceState, NOT location.replace or a hash assignment. Both of
// those fire a hashchange, and that event races the route() call below: two
// route() calls start, the second bumps navSeq, and the first — the one whose
// render is already in flight — hits its own stale() guard and returns without
// painting. The result is a correct URL and an empty screen. replaceState
// rewrites the address silently, so exactly one route() runs, and it reads the
// hash this line just wrote. It also leaves no history entry, so Back does not
// bounce off the login screen.
if (!location.hash || location.hash === "#" || location.hash === "#/") {
  if (oauthReturn === null) {   // returning FROM Google — do not intercept
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}#/prijava`);
    } catch { /* replaceState blocked — the app opens on the catalogue instead */ }
  }
}

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
