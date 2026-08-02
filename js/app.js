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
// ============================================================================

import { t, LANG } from "./i18n.js";
import { initSupabase } from "./supabaseClient.js";

// Bumped on every ship; the service worker's CACHE name is `akv-${APP_V}`
// ("akv-v1") and its SHELL list must cover every shipped file.
export const APP_V = "v1";

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
// Wordmark colors ride on the contract tokens (--accent navy, --brand-red) so
// the identity holds even before styles.css refines the classes.
function mountFrame() {
  if (document.getElementById("main")) return;
  const link = (n) =>
    `<a href="#${n.route}" data-route="${n.route}"><span class="ic">${ICONS[n.icon]}</span><span class="lbl">${esc(T(n.key, n.fb))}</span></a>`;
  const moreLabel = esc(T("nav.vise", "Više"));
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#/" aria-label="Akvaterm">
        <span class="brand-akva" style="color:var(--accent, #00008C);font-style:italic;font-weight:700">AKVA</span><span class="brand-term" style="color:var(--brand-red, #d6252e);font-style:italic;font-weight:700">TERM</span>
      </a>
      <nav class="topbar-nav" aria-label="${esc(T("a11y.primaryNav", "Glavna navigacija"))}">${NAV.map(link).join("")}</nav>
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost more-btn" aria-haspopup="menu" aria-expanded="false"><span class="ic">${ICONS.vise}</span><span class="lbl">${moreLabel}</span></button>
    </header>
    <main id="main"></main>
    <nav class="tabbar" aria-label="${esc(T("a11y.sections", "Odjeljci"))}">
      ${NAV.map(link).join("")}
      <button type="button" class="more-btn tab-more" aria-haspopup="menu" aria-expanded="false"><span class="ic">${ICONS.vise}</span><span class="lbl">${moreLabel}</span></button>
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

function setActiveNav(path) {
  const seg = path.split("/")[1] || "";
  let base = "/" + seg;
  if (seg === "" || seg === "katalog" || seg === "proizvod") base = "/";
  const onMore = seg === "favoriti" || seg === "dizajni";
  document.querySelectorAll("[data-route]").forEach((a) => {
    a.classList.toggle("active", !onMore && a.dataset.route === base);
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

// ---- "Više" popover (Favoriti + Moji dizajni) -------------------------------
let moreCleanup = null;
function closeMore() {
  const pop = document.getElementById("morePop");
  if (!pop) return;
  document.querySelectorAll(".more-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
  if (moreCleanup) { moreCleanup(); moreCleanup = null; }
  pop.remove();
}
function openMore(anchor) {
  if (document.getElementById("morePop")) { closeMore(); return; }
  anchor.setAttribute("aria-expanded", "true");
  const pop = document.createElement("div");
  pop.id = "morePop";
  pop.className = "card menu-pop";
  pop.setAttribute("role", "menu");
  pop.style.cssText = "position:fixed;z-index:50;min-width:200px;padding:6px;box-shadow:var(--shadow-pop, 0 8px 24px rgba(0,0,0,.18))";
  const item = (route, label) =>
    `<a href="#${route}" role="menuitem" class="btn btn-ghost" style="justify-content:flex-start;width:100%">${label}</a>`;
  pop.innerHTML = item("/favoriti", esc(T("nav.favoriti", "Favoriti"))) + item("/dizajni", esc(T("nav.dizajni", "Moji dizajni")));
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
  pop.addEventListener("click", (e) => { if (e.target.closest("a[role=menuitem]")) closeMore(); });
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
window.addEventListener("hashchange", route);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
route();
