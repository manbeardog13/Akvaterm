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
.akv-chiprow { display:flex; flex-wrap:wrap; gap:8px; margin:6px 0 4px; align-items:center; }
.akv-chiprow .lab { font-size:12px; font-weight:700; opacity:.7; min-width:78px; }
.akv-chip { border:1px solid rgba(0,0,0,.18); background:transparent; color:inherit; border-radius:999px; padding:10px 14px; min-height:44px; font-size:13px; cursor:pointer; }
.akv-chip.on { background:var(--accent,#00008C); border-color:var(--accent,#00008C); color:#fff; }
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
`;
  document.head.appendChild(style);
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
        <img class="akv-swatch" src="${swatchDataUrl(p)}" alt="" width="256" height="256">
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
    <h2 class="akv-sec-t">${esc(tf("kat.featured", "Izdvojeno"))}</h2>
    <div class="akv-grid" id="featGrid">${feat.map((p) => productCard(p, favSet)).join("")}</div>`;

  wireFavButtons(container.querySelector("#featGrid"), favSet);
}

function renderCategory(container, cat, products, favSet) {
  const rows = products.filter((p) => p.category === cat.id);
  const isTileCat = rows.some((p) => Array.isArray(p.tileSizeMm));

  const formats = [...new Set(rows.map(formatLabel).filter(Boolean))]
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const colors = COLOR_ORDER.filter((cid) => rows.some((p) => colorGroup(p.baseColorHex) === cid));
  const brands = [...new Set(rows.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "hr"));
  const finishes = isTileCat ? ["glossy", "mat"] : [];

  const state = { format: null, boja: null, finish: null, brand: null };
  const matches = (p) =>
    (!state.format || formatLabel(p) === state.format) &&
    (!state.boja || colorGroup(p.baseColorHex) === state.boja) &&
    (!state.finish || (state.finish === "glossy") === !!p.glossy) &&
    (!state.brand || p.brand === state.brand);

  const chipRow = (group, label, opts) => !opts.length || opts.length < 2 ? "" : `
    <div class="akv-chiprow" role="group" aria-label="${esc(label)}">
      <span class="lab">${esc(label)}</span>
      ${opts.map((o) => `<button type="button" class="akv-chip" data-fg="${esc(group)}" data-fv="${esc(o.value)}">${esc(o.label)}</button>`).join("")}
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
    <div class="akv-grid" id="catGrid" style="margin-top:12px"></div>`;

  const grid = container.querySelector("#catGrid");
  const countEl = container.querySelector("#catCount");

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
  };

  container.querySelectorAll(".akv-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.fg, value = chip.dataset.fv;
      state[group] = state[group] === value ? null : value;
      container.querySelectorAll(`.akv-chip[data-fg="${group}"]`)
        .forEach((c) => c.classList.toggle("on", state[group] === c.dataset.fv));
      apply();
    });
  });

  apply();
}
