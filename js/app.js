// ============================================================================
// app.js — routing + the app frame. Owns the hash router (ROUTES regex table,
// lazy view imports, navSeq staleness guard), the chrome (header with the
// AKVA|TERM wordmark, desktop top-nav + mobile tab bar, the "Više" popover),
// the toast area (exposed as window.AKV.toast) and service-worker
// registration. Views render into #main and clean up via their optional
// teardown() export plus the "akv:teardown" event fired on every navigation.
// Business rules live in domain.js; data access in db.js; chrome text in i18n.
// ============================================================================

import { t, LANG } from "./i18n.js";
import { initSupabase } from "./supabaseClient.js";

// Bumped on every ship; the service worker's CACHE name is `akv-${APP_V}`
// ("akv-v1") and its SHELL list must cover every shipped file.
export const APP_V = "v1";

document.documentElement.lang = LANG;

// Self-heal a stale/mismatched shell (ASC lesson): if a cached old index.html
// without our mount element is served with this app.js, create the mount
// instead of silently white-screening.
let root = document.getElementById("app-root");
if (!root) {
  document.body.innerHTML = "";
  root = document.createElement("div");
  root.id = "app-root";
  document.body.appendChild(root);
}
window.__akvBooted = true;   // recovery watchdogs can tell "bundle parsed" from "network dead"

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

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

const NAV = [
  { route: "/",          key: "nav.katalog" },
  { route: "/dizajner",  key: "nav.dizajner" },
  { route: "/soba3d",    key: "nav.soba3d" },
  { route: "/savjetnik", key: "nav.savjetnik" },
];

// ---- App frame (built once) -------------------------------------------------
// Wordmark colors ride on the contract tokens (--accent navy, --brand-red) so
// the identity holds even before styles.css refines the classes.
function mountFrame() {
  if (document.getElementById("main")) return;
  const link = (n) => `<a href="#${n.route}" data-route="${n.route}">${t(n.key)}</a>`;
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#/" aria-label="Akvaterm">
        <span class="brand-akva" style="color:var(--accent, #00008C);font-style:italic;font-weight:700">AKVA</span><span class="brand-term" style="color:var(--brand-red, #d6252e);font-style:italic;font-weight:700">TERM</span>
      </a>
      <nav class="topbar-nav" aria-label="${esc(t("a11y.primaryNav"))}">${NAV.map(link).join("")}</nav>
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost more-btn" aria-haspopup="menu" aria-expanded="false">${t("nav.vise")}</button>
    </header>
    <main id="main"></main>
    <nav class="tabbar" aria-label="${esc(t("a11y.sections"))}">
      ${NAV.map(link).join("")}
      <button type="button" class="more-btn tab-more" aria-haspopup="menu" aria-expanded="false">${t("nav.vise")}</button>
    </nav>
    <div id="toasts" class="toasts" aria-live="polite"></div>`;
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
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => {
    el.classList.add("out");
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
  pop.innerHTML = item("/favoriti", t("nav.favoriti")) + item("/dizajni", t("nav.dizajni"));
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
// Every navigation gets a sequence number; a route() run that finished after a
// newer one started must not touch the DOM (a slow view load must never
// clobber the screen the user has already navigated to).
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
  const main = document.getElementById("main");

  const match = ROUTES.map((r) => ({ r, m: path.match(r.pattern) })).find((x) => x.m);
  if (!match) {
    main.innerHTML = `<div class="card"><h2>${t("common.notFound")}</h2>
      <p class="muted"><a href="#/">${t("nav.katalog")}</a></p></div>`;
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
    document.getElementById("splash")?.remove();   // first real paint — drop the shell splash
    // Replay the view-enter transition so every navigation glides in.
    main.classList.remove("view-enter"); void main.offsetWidth; main.classList.add("view-enter");
  } catch (err) {
    if (stale()) return;                 // never overwrite the NEWER view with an error card
    console.error(err);
    main.innerHTML = `<div class="card"><h2>${t("common.error")}</h2>
      <p class="muted">${esc(err?.message || "")}</p>
      <button id="reloadBtn" class="btn">${t("common.reload")}</button></div>`;
    main.querySelector("#reloadBtn").addEventListener("click", () => location.reload());
  }
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
