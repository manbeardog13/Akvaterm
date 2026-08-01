// ============================================================================
// views/soba3d.js — "3D soba": Stage-2 parametric room designer.
// Dimension inputs (Š/D/V, 1.5–8 m), fixture add/remove chips, surface
// selector, and the same product-drawer + pattern/grout controls as the 2D
// dizajner — all driving js/room3d.js, which is dynamic-imported on first
// render so three.js never loads until this tab is opened.
// Saves via db.saveDesign with kind 'room3d'.
// ============================================================================

import * as db from "../db.js";
import { t } from "../i18n.js";
import { PATTERNS, GROUT_COLORS, formatEur } from "../domain.js";
import { swatchDataUrl } from "../texture.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// i18n with Croatian fallback: keys stay the contract surface, the literal
// guarantees Croatian text even before the dictionary carries the key.
const tt = (key, hr) => { const s = t(key); return s === key ? hr : s; };

const SURFACES = [
  { id: "floor", key: "soba3d.surface.floor", hr: "Pod" },
  { id: "wallN", key: "soba3d.surface.wallN", hr: "Sjeverni zid" },
  { id: "wallE", key: "soba3d.surface.wallE", hr: "Istočni zid" },
  { id: "wallS", key: "soba3d.surface.wallS", hr: "Južni zid" },
  { id: "wallW", key: "soba3d.surface.wallW", hr: "Zapadni zid" },
];

const FIXTURE_TYPES = [
  { type: "kada", key: "soba3d.fixture.kada", hr: "Kada" },
  { type: "wc", key: "soba3d.fixture.wc", hr: "WC" },
  { type: "umivaonik", key: "soba3d.fixture.umivaonik", hr: "Umivaonik s ormarićem" },
  { type: "radijator", key: "soba3d.fixture.radijator", hr: "Radijator" },
  { type: "klima", key: "soba3d.fixture.klima", hr: "Klima" },
];

const PATTERN_HR = { grid: "Mreža", runningBond: "Pomak ½", herringbone: "Riblja kost", diagonal: "Dijagonala" };
const GROUT_HR = { bijela: "Bijela", siva: "Siva", antracit: "Antracit" };

// Sensible first placement per fixture type, derived from current room dims.
function defaultFixture(type, room) {
  const w = room.widthM, d = room.depthM;
  switch (type) {
    case "kada": return { type, x: 0.45, z: d / 2, rotY: Math.PI / 2 };
    case "wc": return { type, x: w - 0.55, z: 0.35, rotY: 0 };
    case "umivaonik": return { type, x: w - 0.28, z: Math.min(d - 0.5, d / 2 + 0.9), rotY: -Math.PI / 2 };
    case "radijator": return { type, x: w / 2, z: d - 0.08, rotY: Math.PI };
    case "klima": return { type, x: w / 2, z: 0.13, rotY: 0 };
    default: return { type, x: w / 2, z: d / 2, rotY: 0 };
  }
}

// ---- View state (reset on every render) ------------------------------------
let api = null;          // mountRoom handle
let mountToken = 0;      // guards the async import against teardown races
let products = [];
let room = null;
let assignments = {};
let activeSurface = "floor";
let controls = { pattern: "grid", groutColorId: GROUT_COLORS[0]?.id ?? "siva", groutWidthMm: 3 };

export async function render(container) {
  teardown();
  room = { widthM: 3, depthM: 2.5, heightM: 2.6, fixtures: [] };
  assignments = {};
  activeSurface = "floor";
  controls = { pattern: "grid", groutColorId: GROUT_COLORS[0]?.id ?? "siva", groutWidthMm: 3 };

  const all = await db.listProducts();
  products = all.filter((p) => p.category === "keramika" && Array.isArray(p.tileSizeMm));

  container.innerHTML = `
    <style>
      .s3d-stage{position:relative;height:clamp(320px,52vh,560px);border-radius:12px;overflow:hidden;background:#e9e8e6}
      .s3d-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:#666}
      .s3d-section{margin-top:16px}
      .s3d-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#666;margin:0 0 8px}
      .s3d-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .s3d-dim{display:flex;align-items:center;gap:6px;font-size:14px}
      .s3d-dim input{width:76px;min-height:44px;padding:6px 8px;border:1px solid #ccc;border-radius:8px;font:inherit}
      .s3d-chip{min-height:44px;padding:8px 14px;border:1px solid #ccc;border-radius:999px;background:#fff;font:inherit;font-size:14px;cursor:pointer}
      .s3d-chip.is-active{border-color:var(--accent,#00008C);background:var(--accent,#00008C);color:#fff}
      .s3d-chip .s3d-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ok,#2fbf5b);margin-left:6px;vertical-align:1px}
      .s3d-grout{width:44px;height:44px;border-radius:50%;border:2px solid #ccc;cursor:pointer;padding:0}
      .s3d-grout.is-active{border-color:var(--accent,#00008C);box-shadow:0 0 0 2px #fff inset}
      .s3d-drawer{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch}
      .s3d-prod{flex:0 0 128px;border:2px solid transparent;border-radius:12px;background:#fff;padding:8px;text-align:left;font:inherit;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.12)}
      .s3d-prod.is-active{border-color:var(--accent,#00008C)}
      .s3d-prod img{width:112px;height:84px;object-fit:cover;border-radius:8px;display:block}
      .s3d-prod .s3d-pname{font-size:13px;font-weight:700;margin:6px 0 2px;line-height:1.25}
      .s3d-prod .s3d-pmeta{font-size:12px;color:#666}
      .s3d-fix{display:flex;align-items:center;gap:6px;min-height:44px;padding:6px 8px 6px 14px;border:1px solid #ccc;border-radius:999px;background:#fff;font-size:14px}
      .s3d-fix button{min-width:32px;min-height:32px;border:0;border-radius:50%;background:#eee;font:inherit;cursor:pointer}
      .s3d-save{display:flex;flex-wrap:wrap;gap:8px}
      .s3d-save input{flex:1 1 200px;min-height:44px;padding:6px 12px;border:1px solid #ccc;border-radius:8px;font:inherit}
      .s3d-save .s3d-btn{min-height:44px;padding:8px 20px;border:0;border-radius:8px;background:var(--accent,#00008C);color:#fff;font:inherit;font-weight:700;cursor:pointer}
    </style>
    <header class="view-stage"><div><h1>${esc(tt("soba3d.title", "3D soba"))}</h1></div></header>
    <p class="muted" style="font-size:13px;margin:4px 0 14px">${esc(tt("soba3d.sub", "Zadaj dimenzije prostorije, dodaj opremu i obloži svaku površinu pločicama."))}</p>

    <div class="s3d-stage" id="s3d-stage">
      <div class="s3d-loading" id="s3d-loading">${esc(tt("soba3d.loading", "Učitavanje 3D prikaza…"))}</div>
    </div>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.dims", "Dimenzije (m)"))}</p>
      <div class="s3d-row">
        ${dimInput("widthM", tt("soba3d.width", "Širina"))}
        ${dimInput("depthM", tt("soba3d.depth", "Dubina"))}
        ${dimInput("heightM", tt("soba3d.height", "Visina"))}
      </div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.fixtures", "Oprema"))}</p>
      <div class="s3d-row" id="s3d-fix-add">
        ${FIXTURE_TYPES.map((f) => `<button type="button" class="s3d-chip" data-add-fixture="${f.type}">+ ${esc(tt(f.key, f.hr))}</button>`).join("")}
      </div>
      <div class="s3d-row" id="s3d-fix-list" style="margin-top:8px"></div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.surfaces", "Površina"))}</p>
      <div class="s3d-row" id="s3d-surfaces">
        ${SURFACES.map((s) => `<button type="button" class="s3d-chip" data-surface="${s.id}">${esc(tt(s.key, s.hr))}</button>`).join("")}
      </div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.products", "Pločice"))}</p>
      <div class="s3d-drawer" id="s3d-drawer">
        ${products.length ? products.map(productCard).join("") : `<p class="muted">${esc(tt("soba3d.empty", "Nema proizvoda u katalogu."))}</p>`}
      </div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.pattern", "Uzorak polaganja"))}</p>
      <div class="s3d-row" id="s3d-patterns">
        ${PATTERNS.map((p) => `<button type="button" class="s3d-chip" data-pattern="${p.id}">${esc(tt(p.i18nKey, PATTERN_HR[p.id] || p.id))}</button>`).join("")}
      </div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.grout", "Fuga"))}</p>
      <div class="s3d-row">
        <span id="s3d-grouts" class="s3d-row">
          ${GROUT_COLORS.map((g) => `<button type="button" class="s3d-grout" data-grout="${g.id}" style="background:${g.hex}" title="${esc(tt(g.i18nKey, GROUT_HR[g.id] || g.id))}" aria-label="${esc(tt(g.i18nKey, GROUT_HR[g.id] || g.id))}"></button>`).join("")}
        </span>
        <label class="s3d-dim">${esc(tt("soba3d.groutWidth", "Širina fuge"))}
          <select id="s3d-grout-w" style="min-height:44px;border:1px solid #ccc;border-radius:8px;font:inherit;padding:6px">
            ${[2, 3, 4, 5, 6, 8].map((mm) => `<option value="${mm}">${mm} mm</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.saveTitle", "Spremi dizajn"))}</p>
      <div class="s3d-save">
        <input id="s3d-name" type="text" value="${esc(tt("soba3d.defaultName", "Moja 3D soba"))}" maxlength="60">
        <button type="button" class="s3d-btn" id="s3d-save">${esc(tt("soba3d.save", "Spremi"))}</button>
      </div>
    </section>`;

  wire(container);
  syncActiveStates(container);
  renderFixtureList(container);

  // Lazy: three.js + room3d enter the page only on the first 3D render.
  const token = ++mountToken;
  const mod = await import("../room3d.js");
  const handle = await mod.mountRoom(container.querySelector("#s3d-stage"), {
    room,
    assignments,
    products,
    onReady: () => container.querySelector("#s3d-loading")?.remove(),
  });
  if (token !== mountToken) { handle.dispose(); return; } // torn down mid-import
  api = handle;
}

export function teardown() {
  mountToken++;
  if (api) { api.dispose(); api = null; }
}

// ---- Template helpers ------------------------------------------------------

function dimInput(prop, label) {
  return `
    <label class="s3d-dim">${esc(label)}
      <input type="number" min="1.5" max="8" step="0.1" value="${room[prop]}" data-dim="${prop}" inputmode="decimal">
    </label>`;
}

function productCard(p) {
  const size = p.tileSizeMm ? `${p.tileSizeMm[0] / 10}×${p.tileSizeMm[1] / 10} cm` : "";
  const price = p.priceM2 != null ? `${formatEur(p.priceM2)}/m²` : "";
  return `
    <button type="button" class="s3d-prod" data-product="${esc(p.id)}">
      <img src="${swatchDataUrl(p, 256)}" alt="${esc(p.name)}">
      <span class="s3d-pname">${esc(p.name)}</span>
      <span class="s3d-pmeta">${esc([size, price].filter(Boolean).join(" · "))}</span>
    </button>`;
}

// ---- Wiring ----------------------------------------------------------------

function wire(container) {
  container.querySelectorAll("[data-dim]").forEach((input) =>
    input.addEventListener("change", () => {
      const v = Math.min(8, Math.max(1.5, parseFloat(input.value) || room[input.dataset.dim]));
      input.value = String(v);
      room[input.dataset.dim] = v;
      api?.setDims(room.widthM, room.depthM, room.heightM);
    }));

  container.querySelectorAll("[data-add-fixture]").forEach((btn) =>
    btn.addEventListener("click", () => {
      room.fixtures.push(defaultFixture(btn.dataset.addFixture, room));
      api?.setFixtures(room.fixtures);
      renderFixtureList(container);
    }));

  container.querySelectorAll("[data-surface]").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeSurface = btn.dataset.surface;
      const a = assignments[activeSurface];
      if (a) {
        controls = { pattern: a.pattern, groutColorId: a.groutColorId, groutWidthMm: a.groutWidthMm };
        container.querySelector("#s3d-grout-w").value = String(a.groutWidthMm);
      }
      syncActiveStates(container);
    }));

  container.querySelectorAll("[data-product]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const product = products.find((p) => p.id === btn.dataset.product);
      if (product) assign(container, product);
    }));

  container.querySelectorAll("[data-pattern]").forEach((btn) =>
    btn.addEventListener("click", () => {
      controls.pattern = btn.dataset.pattern;
      reapply(container);
    }));

  container.querySelectorAll("[data-grout]").forEach((btn) =>
    btn.addEventListener("click", () => {
      controls.groutColorId = btn.dataset.grout;
      reapply(container);
    }));

  container.querySelector("#s3d-grout-w").addEventListener("change", (e) => {
    controls.groutWidthMm = parseInt(e.target.value, 10) || 3;
    reapply(container);
  });

  container.querySelector("#s3d-save").addEventListener("click", async () => {
    const name = container.querySelector("#s3d-name").value.trim() || tt("soba3d.defaultName", "Moja 3D soba");
    await db.saveDesign({
      kind: "room3d",
      refId: null,
      name,
      assignments,
      room: {
        widthM: room.widthM,
        depthM: room.depthM,
        heightM: room.heightM,
        fixtures: room.fixtures.map((f) => ({ ...f })),
      },
    });
    window.AKV?.toast?.(tt("soba3d.saved", "Dizajn je spremljen."));
  });
}

function assign(container, product) {
  assignments[activeSurface] = {
    productId: product.id,
    pattern: controls.pattern,
    groutColorId: controls.groutColorId,
    groutWidthMm: controls.groutWidthMm,
  };
  pushSurface(product);
  syncActiveStates(container);
}

// Pattern/grout change re-applies to the active surface only when it already
// has a product — picking controls first, tile second also works.
function reapply(container) {
  const a = assignments[activeSurface];
  if (a) {
    a.pattern = controls.pattern;
    a.groutColorId = controls.groutColorId;
    a.groutWidthMm = controls.groutWidthMm;
    const product = products.find((p) => p.id === a.productId);
    if (product) pushSurface(product);
  }
  syncActiveStates(container);
}

function pushSurface(product) {
  api?.setSurface(activeSurface, product, {
    pattern: controls.pattern,
    groutColorHex: GROUT_COLORS.find((g) => g.id === controls.groutColorId)?.hex,
    groutColorId: controls.groutColorId,
    groutWidthMm: controls.groutWidthMm,
  });
}

function syncActiveStates(container) {
  container.querySelectorAll("[data-surface]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.surface === activeSurface);
    const has = Boolean(assignments[btn.dataset.surface]);
    let dot = btn.querySelector(".s3d-dot");
    if (has && !dot) { dot = document.createElement("span"); dot.className = "s3d-dot"; btn.appendChild(dot); }
    if (!has && dot) dot.remove();
  });
  const current = assignments[activeSurface];
  container.querySelectorAll("[data-product]").forEach((btn) =>
    btn.classList.toggle("is-active", current?.productId === btn.dataset.product));
  container.querySelectorAll("[data-pattern]").forEach((btn) =>
    btn.classList.toggle("is-active", btn.dataset.pattern === controls.pattern));
  container.querySelectorAll("[data-grout]").forEach((btn) =>
    btn.classList.toggle("is-active", btn.dataset.grout === controls.groutColorId));
}

function renderFixtureList(container) {
  const box = container.querySelector("#s3d-fix-list");
  box.innerHTML = room.fixtures.map((f, i) => {
    const def = FIXTURE_TYPES.find((x) => x.type === f.type);
    return `
      <span class="s3d-fix">${esc(def ? tt(def.key, def.hr) : f.type)}
        <button type="button" data-rm-fixture="${i}" aria-label="${esc(tt("soba3d.remove", "Ukloni"))}">×</button>
      </span>`;
  }).join("");
  box.querySelectorAll("[data-rm-fixture]").forEach((btn) =>
    btn.addEventListener("click", () => {
      room.fixtures.splice(parseInt(btn.dataset.rmFixture, 10), 1);
      api?.setFixtures(room.fixtures);
      renderFixtureList(container);
    }));
}
