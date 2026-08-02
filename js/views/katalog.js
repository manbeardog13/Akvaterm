// ============================================================================
// views/katalog.js — catalog home (#/) and category listing (#/katalog/:id).
// Home: category cards, featured products and the demo-data disclaimer.
// Category: filter chips (format / boja / završna obrada / marka) over a
// product grid with procedural swatches and favorite toggles. Also exports the
// small shared catalog UI kit (esc, tf, styles, product cards, fav wiring)
// reused by the proizvod, favoriti and dizajni views.
// ============================================================================
import { t } from "../i18n.js";
import { CATEGORIES, formatEur } from "../domain.js";
import { listProducts, listFavorites, toggleFavorite } from "../db.js";
import { swatchDataUrl } from "../texture.js";

// ---- shared helpers (imported by the sibling catalog views) -------------------
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// t() with a Croatian fallback: a missing dictionary key must never leak a raw
// key into the client demo.
export function tf(key, fallback, vars) {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

const CAT_FALLBACK = { keramika: "Keramika", sanitarije: "Sanitarije", armature: "Armature", grijanje: "Grijanje", klima: "Klima" };
export function catLabel(cat) {
  if (!cat) return "";
  return tf(cat.i18nKey, CAT_FALLBACK[cat.id] || cat.id);
}

// Router param tolerance: accepts a raw string, a match array, {params: []}
// or a named-key object.
export function pickParam(params, name) {
  if (params == null) return null;
  if (typeof params === "string") return params;
  if (Array.isArray(params)) return params[0] ?? null;
  if (Array.isArray(params.params)) return params.params[0] ?? null;
  return params[name] ?? params.id ?? null;
}

export function priceLabel(p) {
  if (p.unit === "m2" && p.priceM2 != null) return `${formatEur(p.priceM2)}/m²`;
  if (p.priceUnit != null) return `${formatEur(p.priceUnit)}/kom`;
  return "—";
}

export function formatLabel(p) {
  return Array.isArray(p.tileSizeMm) ? `${p.tileSizeMm[0]}×${p.tileSizeMm[1]} mm` : "";
}

// Colour bucketing for the "boja" filter chips — HSL heuristics over
// baseColorHex, tuned against the seed palette.
export function colorGroup(hex) {
  let s6 = String(hex || "").replace("#", "");
  if (s6.length === 3) s6 = s6.split("").map((c) => c + c).join("");
  const n = parseInt(s6, 16);
  if (!Number.isFinite(n)) return "siva";
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (s < 0.1) return l > 0.85 ? "bijela" : l > 0.4 ? "siva" : "antracit";
  if (h >= 55 && h < 170) return "kadulja";
  if (h >= 170 && h < 270) return "plava";
  if (l >= 0.85) return "bijela";
  if (h < 25 && s >= 0.4) return "terakota";
  if (l >= 0.62) return "bez";
  if (l >= 0.3) return "smeda";
  return "antracit";
}
const COLOR_LABELS = { bijela: "Bijela", bez: "Bež", siva: "Siva", antracit: "Antracit", kadulja: "Kadulja", terakota: "Terakota", smeda: "Smeđa", plava: "Plava" };
const COLOR_ORDER = ["bijela", "bez", "siva", "antracit", "kadulja", "terakota", "smeda", "plava"];

// ---- shared styles ------------------------------------------------------------
export function ensureStyles() {
  if (document.getElementById("akv-catalog-css")) return;
  const style = document.createElement("style");
  style.id = "akv-catalog-css";
  style.textContent = `
.akv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:14px; }
.akv-pcard { position:relative; padding:0; overflow:hidden; }
.akv-pcard-a { display:block; color:inherit; text-decoration:none; }
.akv-sw-wrap { position:relative; }
.akv-swatch { display:block; width:100%; aspect-ratio:1; object-fit:cover; background:#eceae6; }
.akv-eq-ico { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:44px; text-shadow:0 2px 10px rgba(0,0,0,.18); pointer-events:none; }
.akv-pbody { padding:10px 12px 12px; }
.akv-pname { font-weight:700; font-size:14px; line-height:1.25; }
.akv-pmeta { font-size:12px; margin-top:2px; }
.akv-price { margin-top:6px; font-weight:700; font-size:14px; color:var(--accent,#00008C); font-variant-numeric:tabular-nums; }
.akv-fav { position:absolute; top:8px; right:8px; z-index:1; min-width:44px; min-height:44px; border:none; border-radius:999px; background:rgba(255,255,255,.9); font-size:20px; line-height:1; cursor:pointer; color:var(--brand-red,#d6252e); display:flex; align-items:center; justify-content:center; }
.akv-fav[aria-pressed="true"] { background:var(--brand-red,#d6252e); color:#fff; }
.akv-cats { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; margin:14px 0 22px; }
.akv-cat-card { display:flex; flex-direction:column; gap:6px; align-items:flex-start; padding:14px; text-decoration:none; color:inherit; }
.akv-cat-ico { font-size:26px; }
.akv-cat-n { font-weight:700; }
.akv-cat-c { font-size:12px; }
.akv-chiprow { display:flex; flex-wrap:nowrap; gap:8px; margin:6px 0 4px; align-items:center; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; -webkit-overflow-scrolling:touch; padding-bottom:2px; }
.akv-chiprow[hidden] { display:none; }
.akv-chiprow::-webkit-scrollbar { height:4px; }
.akv-chiprow::-webkit-scrollbar-thumb { background:rgba(0,0,0,.18); border-radius:999px; }
.akv-chiprow .lab { font-size:12px; font-weight:700; opacity:.7; min-width:78px; flex:0 0 auto; position:sticky; left:0; background:var(--bg,#fff); padding-right:2px; z-index:1; }
.akv-chip { flex:0 0 auto; white-space:nowrap; border:1px solid rgba(0,0,0,.18); background:transparent; color:inherit; border-radius:999px; padding:10px 14px; min-height:44px; font-size:13px; cursor:pointer; }
.akv-chip.on, .akv-chip[aria-pressed="true"] { background:var(--accent,#00008C); border-color:var(--accent,#00008C); color:#fff; }
.akv-chip .n { opacity:.6; font-variant-numeric:tabular-nums; margin-left:4px; font-size:12px; }
.akv-chip[aria-pressed="true"] .n { opacity:.85; }
.akv-chip.is-empty { opacity:.42; }
.akv-chip-clear { border-style:dashed; font-weight:700; }
.akv-resume { padding:0; overflow:hidden; margin:14px 0 4px; }
.akv-resume-a { display:flex; gap:14px; align-items:center; flex-wrap:wrap; color:inherit; text-decoration:none; padding:12px; }
.akv-resume-c { flex:0 0 auto; width:100%; max-width:320px; aspect-ratio:1000/700; border-radius:10px; background:#eceae6; display:block; }
.akv-resume-b { flex:1 1 200px; min-width:0; display:flex; flex-direction:column; gap:4px; align-items:flex-start; }
.akv-resume-t { font-weight:800; font-size:16px; }
.akv-resume-btn { margin-top:6px; }
.akv-sec-t { font-size:16px; font-weight:800; margin:22px 0 10px; }
.akv-empty { text-align:center; padding:40px 16px; }
.akv-empty .ico { font-size:40px; }
.akv-empty h2 { margin:10px 0 6px; }
.akv-prod { display:grid; gap:18px; grid-template-columns:1fr; margin-top:12px; }
@media (min-width:760px) { .akv-prod { grid-template-columns:1.1fr .9fr; align-items:start; } }
.akv-prev { width:100%; aspect-ratio:4/3; border-radius:12px; display:block; background:#eceae6; object-fit:cover; }
.akv-specs { width:100%; border-collapse:collapse; font-size:14px; margin-top:12px; }
.akv-specs th { text-align:left; padding:8px 10px 8px 0; font-weight:600; opacity:.65; white-space:nowrap; vertical-align:top; }
.akv-specs td { padding:8px 0; }
.akv-specs tr + tr th, .akv-specs tr + tr td { border-top:1px solid rgba(0,0,0,.07); }
.akv-bigprice { font-size:24px; font-weight:800; color:var(--accent,#00008C); margin:6px 0 8px; font-variant-numeric:tabular-nums; }
.akv-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
.akv-dcard { display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
.akv-dsw { display:flex; gap:4px; flex:0 0 auto; }
.akv-dsw img { width:36px; height:36px; border-radius:6px; display:block; }
.akv-dbody { flex:1 1 200px; min-width:0; }
.akv-dactions { display:flex; gap:8px; }
.akv-order { margin:0 0 8px; font-size:13px; }
.akv-inq { margin-top:12px; padding:12px; border:1px dashed rgba(0,0,0,.22); border-radius:12px; }
.akv-inq textarea { width:100%; min-height:196px; font:inherit; font-size:13px; line-height:1.5; padding:10px; margin-top:8px; border:1px solid rgba(0,0,0,.18); border-radius:8px; background:#fff; color:inherit; resize:vertical; }
`;
  document.head.appendChild(style);
}

// ---- lazy swatches --------------------------------------------------------------
// Generating a 256px procedural swatch costs 3-20 ms and toDataURL on top, so
// a 23-card category grid used to block the main thread for ~150 ms in one
// task. Cards now render with the placeholder background and their images are
// filled in small idle slices, visible cards first.
const SWATCH_SLICE = 3;
let swatchPass = 0;
// id -> product, so a pending <img> only has to carry its id (the seed catalog
// is 46 products, and db.js holds the same objects anyway)
const swatchSubjects = new Map();

const idle = (fn) =>
  (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 240 }) : setTimeout(fn, 16));

const nearViewport = (el) => {
  const r = el.getBoundingClientRect();
  const h = window.innerHeight || 800;
  return r.bottom > -h * 0.5 && r.top < h * 1.5;
};

/** Fill every pending [data-akv-swatch] image, a few per idle slice. */
export function hydrateSwatches(root = document) {
  const found = [...root.querySelectorAll("img[data-akv-swatch]")];
  if (!found.length) return;
  // visible (or nearly visible) cards first, the rest in document order;
  // the rects are read once, up front, so the sort does no layout work
  const pending = found
    .map((img, i) => ({ img, i, near: nearViewport(img) }))
    .sort((a, b) => Number(b.near) - Number(a.near) || a.i - b.i)
    .map((e) => e.img);
  let i = 0;
  const step = () => {
    let done = 0;
    while (i < pending.length && done < SWATCH_SLICE) {
      const img = pending[i++];
      const p = swatchSubjects.get(img.dataset.akvSwatch);
      delete img.dataset.akvSwatch;
      if (!img.isConnected || !p) continue;
      try { img.src = swatchDataUrl(p, Number(img.dataset.akvSize) || 256); } catch { /* keep the placeholder */ }
      done++;
    }
    if (i < pending.length) idle(step);
  };
  idle(step);
}

// productCard() is called while a template string is being built, so the nodes
// do not exist yet — queue one hydration pass for the next idle slot.
function queueSwatchHydration() {
  if (swatchPass) return;
  swatchPass = 1;
  idle(() => { swatchPass = 0; hydrateSwatches(); });
}

/** Register a product and return the attributes a pending swatch <img> needs. */
export function swatchAttrs(p, sizePx = 256) {
  swatchSubjects.set(p.id, p);
  queueSwatchHydration();
  return `data-akv-swatch="${esc(p.id)}" data-akv-size="${sizePx}"`;
}

// ---- product cards ------------------------------------------------------------
const CAT_ICONS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon]));

export function productCard(p, favSet) {
  const fav = favSet.has(p.id);
  const isTile = Array.isArray(p.tileSizeMm);
  const meta = [p.brand, formatLabel(p)].filter(Boolean).join(" · ");
  return `
  <article class="akv-pcard card" data-pid="${esc(p.id)}">
    <a class="akv-pcard-a" href="#/proizvod/${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}">
      <div class="akv-sw-wrap">
        <img class="akv-swatch" ${swatchAttrs(p, 256)} alt="" width="256" height="256">
        ${isTile ? "" : `<span class="akv-eq-ico">${esc(CAT_ICONS[p.category] || "📦")}</span>`}
      </div>
      <div class="akv-pbody">
        <div class="akv-pname">${esc(p.name)}</div>
        <div class="akv-pmeta muted">${esc(meta)}</div>
        <div class="akv-price">${esc(priceLabel(p))}</div>
      </div>
    </a>
    <button class="akv-fav" type="button" data-fav="${esc(p.id)}" aria-pressed="${fav}"
      aria-label="${esc(tf("kat.fav", "Dodaj u favorite"))}">${fav ? "♥" : "♡"}</button>
  </article>`;
}

export function wireFavButtons(root, favSet, onChange) {
  root.querySelectorAll("[data-fav]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.fav;
      const favs = await toggleFavorite(id);
      const on = favs.includes(id);
      if (on) favSet.add(id); else favSet.delete(id);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "♥" : "♡";
      window.AKV?.toast?.(on ? tf("kat.favAdded", "Dodano u favorite") : tf("kat.favRemoved", "Uklonjeno iz favorita"));
      onChange?.(id, on);
    });
  });
}

// ---- "Nastavite gdje ste stali" -------------------------------------------------
// The 2D designer persists its working state as akv:diz-draft
// ({sceneId, perScene, savedAt}); when one exists the home screen offers a warm
// re-entry with a real thumbnail of the draft. data/scenes.js + js/scene2d.js
// are imported dynamically so the cold catalog boot never pays for them.
const DRAFT_KEY = "akv:diz-draft";
const SCENE_FB = { "kupaonica": "Kupaonica", "kuhinja": "Kuhinja", "dnevni-boravak": "Dnevni boravak" };

function readDesignerDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.sceneId !== "string" || !d.sceneId) return null;
    const assignments = d.perScene && d.perScene[d.sceneId];
    if (!assignments || typeof assignments !== "object" || !Object.keys(assignments).length) return null;
    return { sceneId: d.sceneId, assignments, savedAt: d.savedAt };
  } catch { return null; }
}

function draftWhen(savedAt) {
  const ts = Date.parse(savedAt || "");
  if (!Number.isFinite(ts)) return "";
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return tf("kat.resumeToday", "danas");
  if (days === 1) return tf("kat.resumeYesterday", "jučer");
  try {
    return new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(ts));
  } catch { return ""; }
}

function resumeMarkup(draft) {
  return `
  <section class="card akv-resume" id="akvResume">
    <a class="akv-resume-a" href="#/dizajner/${encodeURIComponent(draft.sceneId)}">
      <canvas class="akv-resume-c" id="akvResumeC" width="640" height="448" role="img"
        aria-label="${esc(tf("kat.resumeAlt", "Pregled vašeg nedovršenog dizajna"))}"></canvas>
      <div class="akv-resume-b">
        <div class="akv-resume-t">${esc(tf("kat.resumeTitle", "Nastavite gdje ste stali"))}</div>
        <div class="muted" id="akvResumeSub" style="font-size:13px"></div>
        <span class="btn btn-primary akv-resume-btn">${esc(tf("kat.resumeCta", "Nastavi dizajn"))}</span>
      </div>
    </a>
  </section>`;
}

async function hydrateResume(container, draft, products) {
  const host = container.querySelector("#akvResume");
  if (!host) return;
  try {
    const [scenesMod, scene2d] = await Promise.all([
      import("../../data/scenes.js"),
      import("../scene2d.js"),
    ]);
    const scene = (scenesMod.SCENES || []).find((s) => s.id === draft.sceneId);
    if (!scene || !host.isConnected) { host.remove(); return; }
    scene2d.renderScene(host.querySelector("#akvResumeC"), scene, draft.assignments, products);
    const name = tf(scene.i18nKey, SCENE_FB[scene.id] || scene.id);
    const when = draftWhen(draft.savedAt);
    const sub = host.querySelector("#akvResumeSub");
    if (sub) sub.textContent = when ? `${name} · ${tf("kat.resumeSaved", "spremljeno")} ${when}` : name;
  } catch {
    host.remove();          // scenes unavailable (offline shell miss) — no dead card
  }
}

// ---- view ---------------------------------------------------------------------
const FEATURED_IDS = ["ker-01", "ker-18", "ker-15", "ker-22", "gri-05", "kli-05"];

export async function render(container, params) {
  ensureStyles();
  const categoryId = pickParam(params, "categoryId");
  const [products, favIds] = await Promise.all([listProducts(), listFavorites()]);
  const favSet = new Set(favIds);
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (cat) renderCategory(container, cat, products, favSet);
  else renderHome(container, products, favSet);
}

export function teardown() { /* no document-level listeners to release */ }

function renderHome(container, products, favSet) {
  const countBy = {};
  for (const p of products) countBy[p.category] = (countBy[p.category] || 0) + 1;
  const featured = FEATURED_IDS.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  const feat = featured.length ? featured : products.slice(0, 6);
  const draft = readDesignerDraft();

  container.innerHTML = `
    <header style="margin:4px 0 12px">
      <h1 style="margin:0 0 4px">${esc(tf("kat.title", "Katalog"))}</h1>
      <p class="muted" style="margin:0">${esc(tf("kat.sub", "Pločice i oprema za vaš dom — pregledajte, spremite favorite i primijenite u dizajneru."))}</p>
    </header>
    <div class="banner banner-info" style="margin-bottom:6px">${esc(tf("kat.demo", "Demo katalog — proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda."))}</div>
    <nav class="akv-cats" aria-label="${esc(tf("kat.categories", "Kategorije"))}">
      ${CATEGORIES.map((c) => `
        <a class="akv-cat-card card" href="#/katalog/${esc(c.id)}">
          <span class="akv-cat-ico" aria-hidden="true">${esc(c.icon)}</span>
          <span class="akv-cat-n">${esc(catLabel(c))}</span>
          <span class="akv-cat-c muted">${countBy[c.id] || 0} ${esc(tf("kat.productsShort", "proizvoda"))}</span>
        </a>`).join("")}
    </nav>
    ${draft ? resumeMarkup(draft) : ""}
    <h2 class="akv-sec-t">${esc(tf("kat.featured", "Izdvojeno"))}</h2>
    <div class="akv-grid" id="featGrid">${feat.map((p) => productCard(p, favSet)).join("")}</div>`;

  wireFavButtons(container.querySelector("#featGrid"), favSet);
  if (draft) hydrateResume(container, draft, products);
}

function renderCategory(container, cat, products, favSet) {
  const rows = products.filter((p) => p.category === cat.id);
  const isTileCat = rows.some((p) => Array.isArray(p.tileSizeMm));

  // Formats sorted by real tile AREA — "600×1200 before 600×600, 1200×200
  // last" (what parseInt of the label produced) reads arbitrary to a customer.
  const byArea = new Map();
  for (const p of rows) {
    const label = formatLabel(p);
    if (label && !byArea.has(label)) byArea.set(label, p.tileSizeMm[0] * p.tileSizeMm[1]);
  }
  const formats = [...byArea.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
  const colors = COLOR_ORDER.filter((cid) => rows.some((p) => colorGroup(p.baseColorHex) === cid));
  const brands = [...new Set(rows.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "hr"));
  const finishes = isTileCat ? ["glossy", "mat"] : [];

  const state = { format: null, boja: null, finish: null, brand: null };
  const matchesWith = (p, s) =>
    (!s.format || formatLabel(p) === s.format) &&
    (!s.boja || colorGroup(p.baseColorHex) === s.boja) &&
    (!s.finish || (s.finish === "glossy") === !!p.glossy) &&
    (!s.brand || p.brand === s.brand);
  const matches = (p) => matchesWith(p, state);
  // How many products this chip would leave if it were the value for its group.
  const countFor = (group, value) => rows.filter((p) => matchesWith(p, { ...state, [group]: value })).length;
  const activeCount = () => Object.values(state).filter(Boolean).length;

  const chipRow = (group, label, opts) => opts.length < 2 ? "" : `
    <div class="akv-chiprow" role="group" aria-label="${esc(label)}">
      <span class="lab">${esc(label)}</span>
      ${opts.map((o) => `
        <button type="button" class="akv-chip" data-fg="${esc(group)}" data-fv="${esc(o.value)}" aria-pressed="false">
          ${esc(o.label)}<span class="n" aria-hidden="true"></span>
        </button>`).join("")}
    </div>`;

  container.innerHTML = `
    <a class="btn btn-ghost" href="#/" style="margin-bottom:10px">← ${esc(tf("kat.back", "Katalog"))}</a>
    <header style="margin:0 0 10px">
      <h1 style="margin:0 0 2px">${esc(catLabel(cat))}</h1>
      <p class="muted" style="margin:0" id="catCount"></p>
    </header>
    ${chipRow("format", tf("kat.fFormat", "Format"), formats.map((f) => ({ value: f, label: f })))}
    ${chipRow("boja", tf("kat.fColor", "Boja"), colors.map((c) => ({ value: c, label: COLOR_LABELS[c] })))}
    ${chipRow("finish", tf("kat.fFinish", "Završna obrada"), finishes.map((f) => ({ value: f, label: f === "glossy" ? tf("kat.glossy", "Sjajna") : tf("kat.mat", "Mat") })))}
    ${chipRow("brand", tf("kat.fBrand", "Marka"), brands.map((b) => ({ value: b, label: b })))}
    <div class="akv-chiprow" id="catReset" hidden>
      <button type="button" class="akv-chip akv-chip-clear" id="catClear"></button>
    </div>
    <div class="akv-grid" id="catGrid" style="margin-top:12px"></div>`;

  const grid = container.querySelector("#catGrid");
  const countEl = container.querySelector("#catCount");
  const resetRow = container.querySelector("#catReset");
  const clearBtn = container.querySelector("#catClear");
  const chips = [...container.querySelectorAll(".akv-chip[data-fg]")];

  const syncChips = () => {
    for (const chip of chips) {
      const on = state[chip.dataset.fg] === chip.dataset.fv;
      const n = countFor(chip.dataset.fg, chip.dataset.fv);
      chip.classList.toggle("on", on);
      chip.setAttribute("aria-pressed", String(on));
      chip.classList.toggle("is-empty", n === 0 && !on);
      const slot = chip.querySelector(".n");
      if (slot) slot.textContent = ` ${n}`;
    }
    const active = activeCount();
    resetRow.hidden = active === 0;
    clearBtn.textContent = `${tf("kat.clearFilters", "Očisti")} (${active})`;
  };

  const apply = () => {
    const list = rows.filter(matches);
    countEl.textContent = `${list.length} ${tf("kat.productsShort", "proizvoda")}`;
    grid.innerHTML = list.length
      ? list.map((p) => productCard(p, favSet)).join("")
      : `<div class="akv-empty card" style="grid-column:1/-1">
           <div class="ico" aria-hidden="true">🔍</div>
           <h2>${esc(tf("kat.noMatch", "Nema proizvoda za odabrane filtre"))}</h2>
           <p class="muted">${esc(tf("kat.noMatchBody", "Pokušajte ukloniti neki od filtera."))}</p>
         </div>`;
    wireFavButtons(grid, favSet);
    syncChips();
  };

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const group = chip.dataset.fg, value = chip.dataset.fv;
      state[group] = state[group] === value ? null : value;
      apply();
    });
  }
  clearBtn.addEventListener("click", () => {
    for (const key of Object.keys(state)) state[key] = null;
    apply();
  });

  apply();
}
