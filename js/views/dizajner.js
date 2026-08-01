// ============================================================================
// views/dizajner.js — Stage-1 2D designer. Scene tabs, responsive letterboxed
// canvas stage, tap-to-select surfaces (highlight outline), keramika product
// drawer with swatches, pattern / grout color / grout width segmented
// controls, live re-render (<100ms via scene2d pattern caches), A/B compare
// (two assignment snapshots side by side), Spremi dizajn (db.saveDesign),
// share via serialized assignments in the location.hash query, and loading of
// ?product= (preselect) and ?design= (saved design) query parameters.
// ============================================================================
import { SCENES } from "../../data/scenes.js";
import { renderScene, hitSurface, DESIGN_W, DESIGN_H } from "../scene2d.js";
import * as db from "../db.js";
import { t } from "../i18n.js";
import { PATTERNS, GROUT_COLORS, formatEur } from "../domain.js";
import { swatchDataUrl } from "../texture.js";

const GROUT_WIDTHS_MM = [2, 3, 5, 8];

// i18n with an inline Croatian fallback so the view demos well even before
// every dictionary key lands (t() returns the key itself when missing).
const T = (key, fb) => { const v = t(key); return v === key ? fb : v; };

const SURFACE_FB = { "pod": "Pod", "zid-lijevi": "Lijevi zid", "zid-desni": "Desni zid" };
const SCENE_FB = { "kupaonica": "Kupaonica", "kuhinja": "Kuhinja", "dnevni-boravak": "Dnevni boravak" };
const PATTERN_FB = { grid: "Mreža", runningBond: "Pomaknuti slog", herringbone: "Riblja kost", diagonal: "Dijagonalno" };
const GROUT_FB = { bijela: "Bijela", siva: "Siva", antracit: "Antracit" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const toast = (msg) => { if (window.AKV && window.AKV.toast) window.AKV.toast(msg); };
const clone = (x) => JSON.parse(JSON.stringify(x));

// view state (reset on every render, released in teardown)
let S = null;

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

export async function render(container, params) {
  teardown();
  S = {
    container, products: [], tiles: [],
    sceneId: null, perScene: {}, selected: null,
    snapA: null, comparing: false,
    rafId: 0, observers: [],
  };

  const q = hashQuery();
  let sceneId = (paramSceneId(params) || q.path[1] || "").split("?")[0];

  S.products = (await db.listProducts()) || [];
  S.tiles = S.products.filter((p) => p.category === "keramika");

  // ?design= — load a saved design (scene kind only)
  if (q.query.get("design")) {
    const d = await db.getDesign(q.query.get("design"));
    if (d && d.kind === "scene" && sceneById(d.refId)) {
      sceneId = d.refId;
      S.perScene[sceneId] = clone(d.assignments || {});
    }
  }
  if (!sceneById(sceneId)) sceneId = SCENES[0].id;
  S.sceneId = sceneId;

  // ?a= — assignments serialized into the hash query (share links)
  if (q.query.get("a") && !S.perScene[sceneId]) {
    try { S.perScene[sceneId] = sanitizeAssignments(JSON.parse(q.query.get("a")), sceneById(sceneId)); }
    catch (err) { /* malformed share payload -> defaults */ }
  }

  ensureAssignments(scene());
  S.selected = (scene().surfaces.find((s) => s.kind === "floor") || scene().surfaces[0]).id;

  // ?product= — preselect a tile (from "primijeni u dizajneru")
  const pre = q.query.get("product");
  if (pre && S.tiles.some((p) => p.id === pre)) assignments()[S.selected].productId = pre;

  container.innerHTML = markup();
  wire(container);
  syncControls();
  fitCanvas();
  scheduleRender();
}

export function teardown() {
  if (!S) return;
  for (const o of S.observers) o.disconnect();
  if (S.rafId) cancelAnimationFrame(S.rafId);
  S = null;
}

// ---------------------------------------------------------------------------
// state helpers
// ---------------------------------------------------------------------------

const sceneById = (id) => SCENES.find((s) => s.id === id) || null;
const scene = () => sceneById(S.sceneId);
const assignments = () => S.perScene[S.sceneId];
const current = () => assignments()[S.selected];

function ensureAssignments(sc) {
  const a = S.perScene[sc.id] || (S.perScene[sc.id] = {});
  for (const s of sc.surfaces) {
    if (!a[s.id]) {
      a[s.id] = {
        productId: validTileId(s.defaultProductId),
        pattern: (PATTERNS[0] || { id: "grid" }).id,
        groutColorId: (GROUT_COLORS[0] || { id: "bijela" }).id,
        groutWidthMm: 3,
      };
    }
  }
}

function validTileId(id) {
  if (id && S.tiles.some((p) => p.id === id)) return id;
  return S.tiles.length ? S.tiles[0].id : null;
}

function sanitizeAssignments(raw, sc) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const s of sc.surfaces) {
    const e = raw[s.id];
    if (!e || typeof e !== "object") continue;
    out[s.id] = {
      productId: validTileId(e.productId),
      pattern: PATTERNS.some((p) => p.id === e.pattern) ? e.pattern : (PATTERNS[0] || { id: "grid" }).id,
      groutColorId: GROUT_COLORS.some((g) => g.id === e.groutColorId) ? e.groutColorId : (GROUT_COLORS[0] || { id: "bijela" }).id,
      groutWidthMm: GROUT_WIDTHS_MM.includes(Number(e.groutWidthMm)) ? Number(e.groutWidthMm) : 3,
    };
  }
  return out;
}

function hashQuery() {
  const raw = location.hash.slice(1);
  const qi = raw.indexOf("?");
  const path = (qi < 0 ? raw : raw.slice(0, qi)).split("/").filter(Boolean);
  const query = new URLSearchParams(qi < 0 ? "" : raw.slice(qi + 1));
  return { path, query };
}

function paramSceneId(params) {
  if (!params) return null;
  if (typeof params === "string") return params;
  if (Array.isArray(params)) return params[1] || null;
  return params.sceneId || params.id || null;
}

const sceneLabel = (sc) => T(sc.i18nKey, SCENE_FB[sc.id] || sc.id);
const surfaceLabel = (id) => T("surface." + id, SURFACE_FB[id] || id);
const patternLabel = (p) => T(p.i18nKey, PATTERN_FB[p.id] || p.id);
const groutLabel = (g) => T(g.i18nKey, GROUT_FB[g.id] || g.id);

// ---------------------------------------------------------------------------
// markup
// ---------------------------------------------------------------------------

function markup() {
  return `
  <style>
    .diz-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .diz-tab{min-height:44px;padding:10px 18px;border-radius:12px;border:1px solid var(--line,#d8d5ce);
      background:var(--card,#fff);font:inherit;font-weight:600;cursor:pointer;color:inherit}
    .diz-tab.is-on{background:var(--accent,#00008C);border-color:var(--accent,#00008C);color:#fff}
    .diz-stage{position:relative;width:100%;max-width:min(100%,max(340px,calc((100vh - 330px)*10/7)));margin:0 auto 12px}
    .diz-stage canvas{display:block;width:100%;aspect-ratio:${DESIGN_W}/${DESIGN_H};border-radius:14px;
      background:#e9e6df;box-shadow:0 1px 3px rgba(10,15,30,.14);cursor:pointer;touch-action:manipulation}
    .diz-chip{position:absolute;left:10px;top:10px;background:rgba(255,255,255,.92);border-radius:999px;
      padding:6px 14px;font-size:13px;font-weight:600;box-shadow:0 1px 3px rgba(10,15,30,.18);pointer-events:none}
    .diz-panel{background:var(--card,#fff);border:1px solid var(--line,#d8d5ce);border-radius:14px;padding:14px}
    .diz-row{margin-bottom:12px}
    .diz-k{display:block;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
      color:var(--muted,#6b6862);margin-bottom:6px}
    .diz-drawer{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch}
    .diz-sw{flex:0 0 auto;width:86px;min-height:44px;border:2px solid transparent;border-radius:12px;
      background:none;padding:4px;font:inherit;cursor:pointer;text-align:center;color:inherit}
    .diz-sw.is-on{border-color:var(--accent,#00008C)}
    .diz-sw img,.diz-sw .diz-flat{width:78px;height:58px;border-radius:8px;display:block;object-fit:cover;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
    .diz-sw small{display:block;font-size:11px;line-height:1.25;margin-top:4px;color:inherit;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .diz-sw .diz-price{color:var(--muted,#6b6862);font-size:10px}
    .diz-seg{display:flex;gap:6px;flex-wrap:wrap}
    .diz-seg button{min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--line,#d8d5ce);
      background:var(--card,#fff);font:inherit;font-size:13px;cursor:pointer;color:inherit;
      display:inline-flex;align-items:center;gap:8px}
    .diz-seg button.is-on{background:var(--accent-2,#1586c3);border-color:var(--accent-2,#1586c3);color:#fff}
    .diz-dot{width:18px;height:18px;border-radius:50%;display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
    .diz-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px}
    .diz-actions input{min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--line,#d8d5ce);
      font:inherit;flex:1 1 150px;min-width:120px;background:var(--card,#fff);color:inherit}
    .diz-btn{min-height:44px;padding:10px 16px;border-radius:10px;border:1px solid var(--line,#d8d5ce);
      background:var(--card,#fff);font:inherit;font-weight:600;cursor:pointer;color:inherit}
    .diz-btn.is-primary{background:var(--accent,#00008C);border-color:var(--accent,#00008C);color:#fff}
    .diz-btn:disabled{opacity:.45;cursor:default}
    .diz-compare{display:none;margin-bottom:12px}
    .diz-compare.is-open{display:block}
    .diz-cmp-grid{display:flex;gap:10px;flex-wrap:wrap}
    .diz-cmp-cell{flex:1 1 300px;min-width:260px}
    .diz-cmp-cell canvas{display:block;width:100%;aspect-ratio:${DESIGN_W}/${DESIGN_H};border-radius:12px;background:#e9e6df}
    .diz-cmp-cell .diz-k{margin-top:6px;text-align:center}
    @media (prefers-reduced-motion:no-preference){.diz-tab,.diz-seg button,.diz-btn{transition:background .15s,border-color .15s}}
  </style>
  <div class="diz-tabs" id="dizTabs">
    ${SCENES.map((sc) => `
      <button class="diz-tab ${sc.id === S.sceneId ? "is-on" : ""}" data-scene="${esc(sc.id)}">${esc(sceneLabel(sc))}</button>
    `).join("")}
  </div>
  <div class="diz-compare" id="dizCompare">
    <div class="diz-cmp-grid">
      <div class="diz-cmp-cell"><canvas id="dizCvA"></canvas><span class="diz-k">${esc(T("diz.aLabel", "A"))}</span></div>
      <div class="diz-cmp-cell"><canvas id="dizCvB"></canvas><span class="diz-k">${esc(T("diz.bLabel", "B — trenutno"))}</span></div>
    </div>
  </div>
  <div class="diz-stage" id="dizStage">
    <canvas id="dizCanvas" role="img" aria-label="${esc(T("diz.canvasAlt", "Ilustracija prostorije"))}"></canvas>
    <span class="diz-chip" id="dizChip"></span>
  </div>
  <div class="diz-panel">
    <div class="diz-row">
      <span class="diz-k" id="dizSurfK"></span>
      <div class="diz-drawer" id="dizDrawer">${drawerMarkup()}</div>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.pattern", "Uzorak polaganja"))}</span>
      <div class="diz-seg" id="dizPatterns">
        ${PATTERNS.map((p) => `<button data-pattern="${esc(p.id)}">${esc(patternLabel(p))}</button>`).join("")}
      </div>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.grout", "Boja fuge"))}</span>
      <div class="diz-seg" id="dizGrout">
        ${GROUT_COLORS.map((g) => `
          <button data-grout="${esc(g.id)}"><span class="diz-dot" style="background:${esc(g.hex)}"></span>${esc(groutLabel(g))}</button>
        `).join("")}
      </div>
    </div>
    <div class="diz-row">
      <span class="diz-k">${esc(T("diz.groutWidth", "Širina fuge"))}</span>
      <div class="diz-seg" id="dizGroutW">
        ${GROUT_WIDTHS_MM.map((mm) => `<button data-groutw="${mm}">${mm} mm</button>`).join("")}
      </div>
    </div>
    <div class="diz-actions">
      <button class="diz-btn" id="dizSetA">${esc(T("diz.setA", "Postavi A"))}</button>
      <button class="diz-btn" id="dizCompareBtn" disabled>${esc(T("diz.compare", "Usporedi A/B"))}</button>
      <input id="dizName" placeholder="${esc(T("diz.namePlaceholder", "Naziv dizajna"))}" maxlength="60">
      <button class="diz-btn is-primary" id="dizSave">${esc(T("diz.save", "Spremi dizajn"))}</button>
      <button class="diz-btn" id="dizShare">${esc(T("diz.share", "Podijeli"))}</button>
    </div>
  </div>`;
}

function drawerMarkup() {
  if (!S.tiles.length) {
    return `<p style="font-size:13px;color:var(--muted,#6b6862)">${esc(T("diz.noProducts", "Katalog pločica nije dostupan."))}</p>`;
  }
  return S.tiles.map((p) => {
    let sw = "";
    try { sw = swatchDataUrl(p, 128); } catch (err) { sw = ""; }
    const img = sw
      ? `<img src="${sw}" alt="">`
      : `<span class="diz-flat" style="background:${esc(p.baseColorHex || "#ccc")}"></span>`;
    const size = p.tileSizeMm ? `${p.tileSizeMm[0]}×${p.tileSizeMm[1]}` : "";
    const price = p.priceM2 != null ? `${formatEur(p.priceM2)}/m²` : "";
    return `
      <button class="diz-sw" data-product="${esc(p.id)}" title="${esc(p.name)}">
        ${img}
        <small>${esc(p.name)}</small>
        <small class="diz-price">${esc([size, price].filter(Boolean).join(" · "))}</small>
      </button>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------------

function wire(container) {
  const $ = (sel) => container.querySelector(sel);
  S.canvas = $("#dizCanvas");
  S.cvA = $("#dizCvA");
  S.cvB = $("#dizCvB");
  S.el = {
    tabs: $("#dizTabs"), chip: $("#dizChip"), surfK: $("#dizSurfK"),
    drawer: $("#dizDrawer"), patterns: $("#dizPatterns"), grout: $("#dizGrout"),
    groutW: $("#dizGroutW"), compare: $("#dizCompare"), compareBtn: $("#dizCompareBtn"),
    setA: $("#dizSetA"), save: $("#dizSave"), share: $("#dizShare"), name: $("#dizName"),
    stage: $("#dizStage"),
  };

  S.el.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-scene]");
    if (!btn || btn.dataset.scene === S.sceneId) return;
    S.sceneId = btn.dataset.scene;
    ensureAssignments(scene());
    S.selected = (scene().surfaces.find((s) => s.kind === "floor") || scene().surfaces[0]).id;
    history.replaceState(null, "", location.pathname + "#/dizajner/" + S.sceneId);
    for (const b of S.el.tabs.querySelectorAll("[data-scene]")) {
      b.classList.toggle("is-on", b.dataset.scene === S.sceneId);
    }
    syncControls();
    scheduleRender();
  });

  S.canvas.addEventListener("click", (e) => {
    const r = S.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * DESIGN_W;
    const y = ((e.clientY - r.top) / r.height) * DESIGN_H;
    const id = hitSurface(scene(), x, y);
    if (id) { S.selected = id; syncControls(); scheduleRender(); }
  });

  S.el.drawer.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-product]");
    if (!btn || !current()) return;
    current().productId = btn.dataset.product;
    syncControls();
    scheduleRender();
  });
  S.el.patterns.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pattern]");
    if (!btn || !current()) return;
    current().pattern = btn.dataset.pattern;
    syncControls();
    scheduleRender();
  });
  S.el.grout.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-grout]");
    if (!btn || !current()) return;
    current().groutColorId = btn.dataset.grout;
    syncControls();
    scheduleRender();
  });
  S.el.groutW.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-groutw]");
    if (!btn || !current()) return;
    current().groutWidthMm = Number(btn.dataset.groutw);
    syncControls();
    scheduleRender();
  });

  S.el.setA.addEventListener("click", () => {
    S.snapA = { sceneId: S.sceneId, assignments: clone(assignments()) };
    S.el.compareBtn.disabled = false;
    toast(T("diz.snapSet", "Snimka A postavljena"));
  });
  S.el.compareBtn.addEventListener("click", () => {
    S.comparing = !S.comparing;
    S.el.compare.classList.toggle("is-open", S.comparing);
    S.el.compareBtn.textContent = S.comparing
      ? T("diz.closeCompare", "Zatvori usporedbu")
      : T("diz.compare", "Usporedi A/B");
    if (S.comparing) fitCompare();
    scheduleRender();
  });

  S.el.save.addEventListener("click", async () => {
    const name = S.el.name.value.trim() ||
      `${sceneLabel(scene())} — ${new Date().toLocaleDateString("hr-HR")}`;
    await db.saveDesign({ kind: "scene", refId: S.sceneId, name, assignments: clone(assignments()) });
    toast(T("diz.saved", "Dizajn spremljen"));
  });

  S.el.share.addEventListener("click", async () => {
    const hash = "#/dizajner/" + S.sceneId + "?a=" + encodeURIComponent(JSON.stringify(assignments()));
    history.replaceState(null, "", location.pathname + hash);
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast(T("diz.shareCopied", "Poveznica kopirana"));
    } catch (err) {
      window.prompt(T("diz.shareManual", "Kopiraj poveznicu:"), url);
    }
  });

  const ro = new ResizeObserver(() => { fitCanvas(); if (S.comparing) fitCompare(); scheduleRender(); });
  ro.observe(S.el.stage);
  S.observers.push(ro);
}

// ---------------------------------------------------------------------------
// control sync + rendering
// ---------------------------------------------------------------------------

function syncControls() {
  const a = current();
  S.el.chip.textContent = surfaceLabel(S.selected);
  S.el.surfK.textContent =
    `${T("diz.products", "Pločice")} — ${surfaceLabel(S.selected)}`;
  for (const b of S.el.drawer.querySelectorAll("[data-product]")) {
    b.classList.toggle("is-on", !!a && b.dataset.product === a.productId);
  }
  for (const b of S.el.patterns.querySelectorAll("[data-pattern]")) {
    b.classList.toggle("is-on", !!a && b.dataset.pattern === a.pattern);
  }
  for (const b of S.el.grout.querySelectorAll("[data-grout]")) {
    b.classList.toggle("is-on", !!a && b.dataset.grout === a.groutColorId);
  }
  for (const b of S.el.groutW.querySelectorAll("[data-groutw]")) {
    b.classList.toggle("is-on", !!a && Number(b.dataset.groutw) === a.groutWidthMm);
  }
}

function fitCanvas() {
  sizeToElement(S.canvas);
}

function fitCompare() {
  sizeToElement(S.cvA);
  sizeToElement(S.cvB);
}

function sizeToElement(canvas) {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(r.width * dpr);
  const h = Math.round((r.width * DESIGN_H / DESIGN_W) * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

function scheduleRender() {
  if (!S || S.rafId) return;
  S.rafId = requestAnimationFrame(() => {
    if (!S) return;
    S.rafId = 0;
    paint();
  });
}

function paint() {
  renderScene(S.canvas, scene(), assignments(), S.products);
  paintSelection();
  if (S.comparing && S.snapA) {
    const scA = sceneById(S.snapA.sceneId) || scene();
    renderScene(S.cvA, scA, S.snapA.assignments, S.products);
    renderScene(S.cvB, scene(), assignments(), S.products);
  }
}

function paintSelection() {
  const surf = scene().surfaces.find((s) => s.id === S.selected);
  if (!surf) return;
  const ctx = S.canvas.getContext("2d");
  const sx = S.canvas.width / DESIGN_W, sy = S.canvas.height / DESIGN_H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.beginPath();
  ctx.moveTo(surf.quad[0][0], surf.quad[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(surf.quad[i][0], surf.quad[i][1]);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(21,134,195,0.07)";
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = "#00008C";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
