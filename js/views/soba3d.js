// ============================================================================
// views/soba3d.js — "3D soba": Stage-2 parametric room designer.
// Dimension inputs (Š/D/V, 1.5–8 m), fixture add/remove chips, surface
// selector, and the same product-drawer + pattern/grout controls as the 2D
// dizajner — all driving js/room3d.js, which is dynamic-imported on first
// render so three.js never loads until this tab is opened.
// Opens with a designed starter room (tiled floor + walls, kada/umivaonik/wc)
// so the first frame reads as a bathroom rather than a white box, restores a
// saved design from `#/soba3d?design=<id>`, prices the room live and hands the
// summary to Akvaterm via "Zatraži ponudu".
// Saves via db.saveDesign with kind 'room3d'.
// ============================================================================

import * as db from "../db.js";
import { t } from "../i18n.js";
import { PATTERNS, GROUT_COLORS, formatEur, pricePerRoom } from "../domain.js";
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

const GROUT_WIDTHS_MM = [2, 3, 4, 5, 6, 8];
const DIM_MIN = 1.5, DIM_MAX = 8;
const DEFAULT_ROOM = { widthM: 3, depthM: 2.5, heightM: 2.6 };

// Curated first impression: a dark marble floor with light marble walls and the
// three fixtures every bathroom has. Ids are from data/catalog.seed.json and
// fall back to whatever keramika the catalog does carry.
const STARTER = {
  floorProductId: "ker-03",
  wallProductId: "ker-02",
  floorGroutId: "siva",
  wallGroutId: "bijela",
  fixtures: ["kada", "umivaonik", "wc"],
};

const RESERVE_PCT = 10;         // the +10% cutting reserve the advisor teaches
const QUOTE_EMAIL = "info@akvaterm.hr";

const clampDim = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(DIM_MAX, Math.max(DIM_MIN, n)) : fallback;
};

// "2,55" — Croatian decimal comma, trailing zeros trimmed.
const fmtM = (n) => String(Math.round((Number(n) || 0) * 100) / 100).replace(".", ",");
// "7,50" — always two decimals, for m² figures that read as measurements.
const fmtArea = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",");

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
let reserveOn = false;
let designId = null;     // set when opened through ?design= — saving updates in place
let designName = "";

// app.js fires "akv:teardown" on EVERY navigation, including one that happens
// while this view is still awaiting its catalog/three.js imports. Without this
// listener a view abandoned mid-render is never torn down (app.js only calls
// teardown() on the view it managed to finish) and its render loop + WebGL
// context leak for the lifetime of the page.
function onGlobalTeardown() { teardown(); }

export async function render(container) {
  teardown();
  const token = mountToken;                 // teardown() just bumped it
  window.addEventListener("akv:teardown", onGlobalTeardown);
  const alive = () => token === mountToken && container.isConnected;

  room = { ...DEFAULT_ROOM, fixtures: [] };
  assignments = {};
  activeSurface = "floor";
  controls = { pattern: "grid", groutColorId: GROUT_COLORS[0]?.id ?? "siva", groutWidthMm: 3 };
  reserveOn = false;
  designId = null;
  designName = "";

  const all = await db.listProducts();
  if (!alive()) return;
  products = all.filter((p) => p.category === "keramika" && Array.isArray(p.tileSizeMm));

  // ?design= — restore a saved 3D room (dizajni.js links here). The hash
  // carries its own query, exactly like the 2D dizajner's share links.
  const wanted = hashQuery().get("design");
  if (wanted) {
    const saved = await db.getDesign(wanted);
    if (!alive()) return;
    if (saved && saved.kind === "room3d") {
      designId = saved.id || null;
      designName = String(saved.name ?? "");
      room = {
        widthM: clampDim(saved.room?.widthM, DEFAULT_ROOM.widthM),
        depthM: clampDim(saved.room?.depthM, DEFAULT_ROOM.depthM),
        heightM: clampDim(saved.room?.heightM, DEFAULT_ROOM.heightM),
        fixtures: sanitizeFixtures(saved.room?.fixtures),
      };
      assignments = sanitizeAssignments(saved.assignments);
    }
  }
  if (!designId) seedStarterRoom();
  adoptControlsFrom(assignments[activeSurface]);

  container.innerHTML = markup();

  wire(container);
  syncActiveStates(container);
  renderFixtureList(container);
  renderEstimate(container);

  // Lazy: three.js + room3d enter the page only on the first 3D render.
  const mod = await import("../room3d.js");
  if (!alive()) return;
  const handle = await mod.mountRoom(container.querySelector("#s3d-stage"), {
    room,
    assignments,
    products,
    onReady: () => container.querySelector("#s3d-loading")?.remove(),
  });
  if (!alive()) { handle.dispose(); return; }   // torn down mid-import
  api = handle;
}

export function teardown() {
  mountToken++;
  window.removeEventListener("akv:teardown", onGlobalTeardown);
  if (api) { api.dispose(); api = null; }
}

// ---- Restore / seed --------------------------------------------------------

// The query of a hash route: "#/soba3d?design=dz-1" -> URLSearchParams.
function hashQuery() {
  const raw = location.hash.slice(1);
  const qi = raw.indexOf("?");
  return new URLSearchParams(qi < 0 ? "" : raw.slice(qi + 1));
}

const productExists = (id) => products.some((p) => p.id === id);

function pickProductId(preferred, fallbackIndex = 0) {
  if (productExists(preferred)) return preferred;
  return products[fallbackIndex]?.id ?? products[0]?.id ?? null;
}

function sanitizeAssignments(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const s of SURFACES) {
    const e = raw[s.id];
    if (!e || typeof e !== "object" || !productExists(e.productId)) continue;
    out[s.id] = {
      productId: e.productId,
      pattern: PATTERNS.some((p) => p.id === e.pattern) ? e.pattern : "grid",
      groutColorId: GROUT_COLORS.some((g) => g.id === e.groutColorId) ? e.groutColorId : (GROUT_COLORS[0]?.id ?? "siva"),
      groutWidthMm: GROUT_WIDTHS_MM.includes(Number(e.groutWidthMm)) ? Number(e.groutWidthMm) : 3,
    };
  }
  return out;
}

function sanitizeFixtures(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((f) => f && FIXTURE_TYPES.some((x) => x.type === f.type))
    .map((f) => ({
      type: f.type,
      x: Number.isFinite(Number(f.x)) ? Number(f.x) : 0,
      z: Number.isFinite(Number(f.z)) ? Number(f.z) : 0,
      rotY: Number.isFinite(Number(f.rotY)) ? Number(f.rotY) : 0,
    }));
}

// A designed room on first paint: tiled floor + four walls and the three
// fixtures a bathroom always has, so the feature explains itself.
function seedStarterRoom() {
  if (!products.length) return;
  const floorId = pickProductId(STARTER.floorProductId, 0);
  const wallId = pickProductId(STARTER.wallProductId, 1);
  const grout = (id) => (GROUT_COLORS.some((g) => g.id === id) ? id : (GROUT_COLORS[0]?.id ?? "siva"));
  if (floorId) {
    assignments.floor = { productId: floorId, pattern: "grid", groutColorId: grout(STARTER.floorGroutId), groutWidthMm: 3 };
  }
  if (wallId) {
    for (const s of SURFACES) {
      if (s.id === "floor") continue;
      assignments[s.id] = { productId: wallId, pattern: "grid", groutColorId: grout(STARTER.wallGroutId), groutWidthMm: 3 };
    }
  }
  room.fixtures = STARTER.fixtures.map((type) => defaultFixture(type, room));
}

function adoptControlsFrom(a) {
  if (!a) return;
  controls = { pattern: a.pattern, groutColorId: a.groutColorId, groutWidthMm: a.groutWidthMm };
}

// ---- Pricing ---------------------------------------------------------------
// Floor = width × depth; each wall = its own run × height. Openings, adhesive
// and labour are out of scope — the note under the figure says so.

function surfaceAreaM2(surfaceId) {
  if (surfaceId === "floor") return room.widthM * room.depthM;
  if (surfaceId === "wallN" || surfaceId === "wallS") return room.widthM * room.heightM;
  return room.depthM * room.heightM;
}

function estimateRows() {
  const rows = [];
  for (const s of SURFACES) {
    const a = assignments[s.id];
    if (!a) continue;
    const product = products.find((p) => p.id === a.productId);
    if (!product) continue;
    const areaM2 = surfaceAreaM2(s.id);
    rows.push({
      surfaceId: s.id,
      product,
      pattern: a.pattern,
      areaM2,
      subtotal: pricePerRoom(product, areaM2),
    });
  }
  return rows;
}

const estimateTotal = (rows) => rows.reduce((sum, r) => sum + r.subtotal, 0);
const withReserve = (total) => Math.round(total * (1 + RESERVE_PCT / 100) * 100) / 100;

// ---- Labels ----------------------------------------------------------------

const surfaceLabel = (s) => esc(tt(s.key, s.hr));
const surfaceLabelById = (id) => {
  const s = SURFACES.find((x) => x.id === id);
  return s ? tt(s.key, s.hr) : id;
};
const patternLabelById = (id) => {
  const p = PATTERNS.find((x) => x.id === id);
  return p ? tt(p.i18nKey, PATTERN_HR[p.id] || p.id) : id;
};
const fixtureLabel = (type) => {
  const f = FIXTURE_TYPES.find((x) => x.type === type);
  return f ? tt(f.key, f.hr) : type;
};

// ---- Markup ----------------------------------------------------------------

function markup() {
  return `
    <style>
      /* Uses the shared 3D stage component from css/styles.css (.room3d-stage /
         .room3d-loading + branded spinner); only the height is view-specific. */
      .s3d-stage{height:clamp(320px,52vh,560px);aspect-ratio:auto;min-height:0}
      .s3d-hint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);
        max-width:calc(100% - 24px);padding:8px 14px;border-radius:999px;
        background:rgba(255,255,255,.92);color:var(--ink,#0a0c11);font-size:13px;font-weight:600;
        box-shadow:0 1px 3px rgba(10,15,30,.18);pointer-events:none;text-align:center}
      .s3d-hint.is-gone{opacity:0}
      @media (prefers-reduced-motion:no-preference){.s3d-hint{transition:opacity .35s var(--smooth,ease)}}
      .s3d-section{margin-top:16px}
      .s3d-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
        color:var(--muted,#63676f);margin:0 0 8px}
      .s3d-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .s3d-dim{display:flex;align-items:center;gap:6px;font-size:14px}
      .s3d-dim input{width:76px;min-height:44px;padding:6px 8px;border:1px solid var(--line-strong,#ccc);
        border-radius:var(--radius-sm,8px);font:inherit;background:var(--surface,#fff);color:inherit}
      .s3d-chip{min-height:44px;padding:8px 14px;border:1px solid var(--line-strong,#ccc);border-radius:999px;
        background:var(--surface,#fff);font:inherit;font-size:14px;cursor:pointer;color:inherit}
      .s3d-chip.is-active{border-color:var(--accent,#00008C);background:var(--accent,#00008C);color:var(--on-accent,#fff)}
      .s3d-chip .s3d-mark{margin-left:6px;font-weight:700;color:var(--accent,#00008C)}
      .s3d-chip.is-active .s3d-mark{color:var(--on-accent,#fff)}
      .s3d-grout{width:44px;height:44px;border-radius:50%;border:2px solid var(--line-strong,#ccc);cursor:pointer;padding:0}
      .s3d-grout.is-active{border-color:var(--accent,#00008C);box-shadow:0 0 0 2px var(--surface,#fff) inset}
      .s3d-drawer{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch}
      .s3d-prod{flex:0 0 128px;border:2px solid transparent;border-radius:12px;background:var(--surface,#fff);
        padding:8px;text-align:left;font:inherit;cursor:pointer;box-shadow:0 1px 3px rgba(10,15,30,.14);color:inherit}
      .s3d-prod.is-active{border-color:var(--accent,#00008C)}
      .s3d-prod img{width:112px;height:84px;object-fit:cover;border-radius:8px;display:block}
      .s3d-prod .s3d-pname{font-size:13px;font-weight:700;margin:6px 0 2px;line-height:1.25}
      .s3d-prod .s3d-pmeta{font-size:12px;color:var(--muted,#63676f)}
      .s3d-fix{display:flex;align-items:center;gap:6px;min-height:44px;padding:0 6px 0 14px;
        border:1px solid var(--line-strong,#ccc);border-radius:999px;background:var(--surface,#fff);font-size:14px}
      .s3d-fix button{min-width:44px;min-height:44px;border:0;border-radius:50%;background:none;
        font:inherit;font-size:18px;line-height:1;cursor:pointer;color:var(--muted,#63676f)}
      .s3d-fix button:hover{background:var(--hover,rgba(2,3,5,.05));color:inherit}
      .s3d-est{background:var(--surface,#fff);border:1px solid var(--line,rgba(28,22,16,.09));
        border-radius:14px;padding:14px}
      .s3d-est-head{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between}
      .s3d-est-total{font-size:22px;font-weight:700;color:var(--accent,#00008C)}
      .s3d-est-res{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:14px;cursor:pointer}
      .s3d-est-list{list-style:none;margin:10px 0 0;padding:0;font-size:13px}
      .s3d-est-list li{display:flex;flex-wrap:wrap;gap:4px 10px;justify-content:space-between;
        padding:6px 0;border-top:1px solid var(--line,rgba(28,22,16,.09))}
      .s3d-est-list .s3d-est-what{color:inherit}
      .s3d-est-list .s3d-est-sum{font-weight:700;white-space:nowrap}
      .s3d-est-note{margin:10px 0 0;font-size:12px;color:var(--muted,#63676f)}
      .s3d-save{display:flex;flex-wrap:wrap;gap:8px}
      .s3d-save input{flex:1 1 200px;min-height:44px;padding:6px 12px;border:1px solid var(--line-strong,#ccc);
        border-radius:var(--radius-sm,8px);font:inherit;background:var(--surface,#fff);color:inherit}
      .s3d-btn{min-height:44px;padding:8px 20px;border:1px solid var(--line-strong,#ccc);
        border-radius:var(--radius-sm,8px);background:var(--surface,#fff);font:inherit;font-weight:700;
        cursor:pointer;color:inherit}
      .s3d-btn.is-primary{border-color:var(--accent,#00008C);background:var(--accent,#00008C);color:var(--on-accent,#fff)}
    </style>
    <header class="view-stage"><div><h1>${esc(tt("soba3d.title", "3D soba"))}</h1></div></header>
    <p class="muted" style="font-size:13px;margin:4px 0 14px">${esc(tt("soba3d.sub", "Zadajte dimenzije prostorije, dodajte opremu i obložite svaku površinu pločicama."))}</p>

    <div class="room3d-stage s3d-stage" id="s3d-stage">
      <div class="room3d-loading" id="s3d-loading"><span class="spinner" aria-hidden="true"></span>${esc(tt("soba3d.loading", "Učitavanje 3D prikaza…"))}</div>
      <span class="s3d-hint" id="s3d-hint" aria-hidden="true">${esc(tt("soba3d.hint", "Povucite za okretanje, uštipnite za zumiranje."))}</span>
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
      <p class="s3d-label">${esc(tt("soba3d.estimate", "Procjena cijene"))}</p>
      <div class="s3d-est">
        <div class="s3d-est-head">
          <span class="s3d-est-total" id="s3d-est-total" role="status">—</span>
          <label class="s3d-est-res">
            <input type="checkbox" id="s3d-reserve"${reserveOn ? " checked" : ""}>
            ${esc(tt("soba3d.reserve", "+10% rezerve"))}
          </label>
        </div>
        <ul class="s3d-est-list" id="s3d-est-list"></ul>
        <p class="s3d-est-note">${esc(tt("soba3d.estimateNote", "Informativna procjena za pločice po m². Ne uključuje otvore, ljepilo, fugu, opremu ni ugradnju."))}</p>
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
        ${SURFACES.map((s) => `<button type="button" class="s3d-chip" data-surface="${s.id}" aria-pressed="false"><span class="s3d-sname">${surfaceLabel(s)}</span></button>`).join("")}
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
        ${PATTERNS.map((p) => `<button type="button" class="s3d-chip" data-pattern="${p.id}" aria-pressed="false">${esc(tt(p.i18nKey, PATTERN_HR[p.id] || p.id))}</button>`).join("")}
      </div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.grout", "Fuga"))}</p>
      <div class="s3d-row">
        <span id="s3d-grouts" class="s3d-row">
          ${GROUT_COLORS.map((g) => `<button type="button" class="s3d-grout" data-grout="${g.id}" aria-pressed="false" style="background:${g.hex}" title="${esc(tt(g.i18nKey, GROUT_HR[g.id] || g.id))}" aria-label="${esc(tt(g.i18nKey, GROUT_HR[g.id] || g.id))}"></button>`).join("")}
        </span>
        <label class="s3d-dim">${esc(tt("soba3d.groutWidth", "Širina fuge"))}
          <select id="s3d-grout-w" style="min-height:44px;border:1px solid var(--line-strong,#ccc);border-radius:8px;font:inherit;padding:6px;background:var(--surface,#fff);color:inherit">
            ${GROUT_WIDTHS_MM.map((mm) => `<option value="${mm}"${mm === controls.groutWidthMm ? " selected" : ""}>${mm} mm</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="s3d-section">
      <p class="s3d-label">${esc(tt("soba3d.saveTitle", "Spremi dizajn"))}</p>
      <div class="s3d-save">
        <input id="s3d-name" type="text" value="${esc(designName || tt("soba3d.defaultName", "Moja 3D soba"))}" maxlength="60" aria-label="${esc(tt("soba3d.nameLabel", "Naziv dizajna"))}">
        <button type="button" class="s3d-btn is-primary" id="s3d-save">${esc(tt("soba3d.save", "Spremi"))}</button>
        <button type="button" class="s3d-btn" id="s3d-quote">${esc(tt("soba3d.quote", "Zatraži ponudu"))}</button>
      </div>
    </section>`;
}

function dimInput(prop, label) {
  return `
    <label class="s3d-dim">${esc(label)}
      <input type="number" min="${DIM_MIN}" max="${DIM_MAX}" step="0.1" value="${room[prop]}" data-dim="${prop}" inputmode="decimal">
    </label>`;
}

function productCard(p) {
  const size = p.tileSizeMm ? `${p.tileSizeMm[0] / 10}×${p.tileSizeMm[1] / 10} cm` : "";
  const price = p.priceM2 != null ? `${formatEur(p.priceM2)}/m²` : "";
  return `
    <button type="button" class="s3d-prod" data-product="${esc(p.id)}" aria-pressed="false">
      <img src="${swatchDataUrl(p, 256)}" alt="">
      <span class="s3d-pname">${esc(p.name)}</span>
      <span class="s3d-pmeta">${esc([size, price].filter(Boolean).join(" · "))}</span>
    </button>`;
}

// ---- Wiring ----------------------------------------------------------------

function wire(container) {
  container.querySelectorAll("[data-dim]").forEach((input) =>
    input.addEventListener("change", () => {
      const v = clampDim(input.value, room[input.dataset.dim]);
      input.value = String(v);
      room[input.dataset.dim] = v;
      api?.setDims(room.widthM, room.depthM, room.heightM);
      renderEstimate(container);
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
        adoptControlsFrom(a);
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

  container.querySelector("#s3d-reserve").addEventListener("change", (e) => {
    reserveOn = !!e.target.checked;
    renderEstimate(container);
  });

  // The stage's hint chip retires the moment the room is actually touched
  // (room3d.js announces the intent gate opening).
  const stage = container.querySelector("#s3d-stage");
  stage.addEventListener("akv:room-armed", () => {
    const hint = container.querySelector("#s3d-hint");
    if (!hint) return;
    hint.classList.add("is-gone");
    setTimeout(() => hint.remove(), 400);
  });

  container.querySelector("#s3d-save").addEventListener("click", async () => {
    const name = container.querySelector("#s3d-name").value.trim() || tt("soba3d.defaultName", "Moja 3D soba");
    const stored = await db.saveDesign({
      // Reopened designs update in place instead of piling up duplicates.
      id: designId || undefined,
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
    designId = stored?.id ?? designId;
    designName = name;
    window.AKV?.toast?.(tt("soba3d.saved", "Dizajn je spremljen."));
  });

  container.querySelector("#s3d-quote").addEventListener("click", () => {
    requestQuote(container);
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
  renderEstimate(container);
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
    const isActive = btn.dataset.surface === activeSurface;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    // "Tiled" is a state, not a success — a checkmark plus a spoken suffix,
    // never a green dot carrying the meaning on its own.
    const has = Boolean(assignments[btn.dataset.surface]);
    let mark = btn.querySelector(".s3d-mark");
    if (has && !mark) {
      mark = document.createElement("span");
      mark.className = "s3d-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✓";
      btn.appendChild(mark);
    }
    if (!has && mark) mark.remove();
    const name = surfaceLabelById(btn.dataset.surface);
    btn.setAttribute("aria-label", has
      ? `${name} — ${tt("soba3d.tiled", "pločice odabrane")}`
      : `${name} — ${tt("soba3d.untiled", "bez pločica")}`);
  });
  const currentAssignment = assignments[activeSurface];
  container.querySelectorAll("[data-product]").forEach((btn) => {
    const on = currentAssignment?.productId === btn.dataset.product;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  container.querySelectorAll("[data-pattern]").forEach((btn) => {
    const on = btn.dataset.pattern === controls.pattern;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  container.querySelectorAll("[data-grout]").forEach((btn) => {
    const on = btn.dataset.grout === controls.groutColorId;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function renderFixtureList(container) {
  const box = container.querySelector("#s3d-fix-list");
  if (!box) return;
  box.innerHTML = room.fixtures.map((f, i) => {
    const name = fixtureLabel(f.type);
    return `
      <span class="s3d-fix">${esc(name)}
        <button type="button" data-rm-fixture="${i}" aria-label="${esc(`${tt("soba3d.remove", "Ukloni")}: ${name}`)}">×</button>
      </span>`;
  }).join("");
  box.querySelectorAll("[data-rm-fixture]").forEach((btn) =>
    btn.addEventListener("click", () => {
      room.fixtures.splice(parseInt(btn.dataset.rmFixture, 10), 1);
      api?.setFixtures(room.fixtures);
      renderFixtureList(container);
    }));
}

// ---- Live estimate ---------------------------------------------------------

function renderEstimate(container) {
  const totalEl = container.querySelector("#s3d-est-total");
  const listEl = container.querySelector("#s3d-est-list");
  if (!totalEl || !listEl) return;

  const rows = estimateRows();
  const total = estimateTotal(rows);
  const shown = reserveOn ? withReserve(total) : total;

  totalEl.textContent = rows.length
    ? formatEur(shown)
    : tt("soba3d.estimateEmpty", "Odaberite pločice");

  listEl.innerHTML = rows.map((r) => `
    <li>
      <span class="s3d-est-what">${esc(`${surfaceLabelById(r.surfaceId)} · ${r.product.name} · ${patternLabelById(r.pattern)} · ${fmtArea(r.areaM2)} m²`)}</span>
      <span class="s3d-est-sum">${esc(formatEur(r.subtotal))}</span>
    </li>`).join("");
}

// ---- Quote (mailto — no backend needed in demo mode) -----------------------

function quoteSummary() {
  const rows = estimateRows();
  const total = estimateTotal(rows);
  const lines = [];
  lines.push(tt("soba3d.quoteIntro", "Poštovani, molim ponudu za sljedeću prostoriju:"));
  lines.push("");
  lines.push(`${tt("soba3d.dims", "Dimenzije (m)")}: ${fmtM(room.widthM)} × ${fmtM(room.depthM)} × ${fmtM(room.heightM)} m`);
  lines.push("");
  if (rows.length) {
    lines.push(`${tt("soba3d.surfaces", "Površina")}:`);
    for (const r of rows) {
      lines.push(`- ${surfaceLabelById(r.surfaceId)}: ${r.product.name} (${patternLabelById(r.pattern)}) — ${fmtArea(r.areaM2)} m² — ${formatEur(r.subtotal)}`);
    }
    lines.push("");
    lines.push(`${tt("soba3d.estimate", "Procjena cijene")}: ${formatEur(total)}`);
    lines.push(`${tt("soba3d.reserve", "+10% rezerve")}: ${formatEur(withReserve(total))}`);
  } else {
    lines.push(tt("soba3d.quoteNoTiles", "Pločice još nisu odabrane."));
  }
  if (room.fixtures.length) {
    lines.push("");
    lines.push(`${tt("soba3d.fixtures", "Oprema")}: ${room.fixtures.map((f) => fixtureLabel(f.type)).join(", ")}`);
  }
  lines.push("");
  lines.push(tt("soba3d.quoteNote", "Procjena je informativna i ne uključuje ugradnju."));
  lines.push(location.href);
  return lines.join("\n");
}

function requestQuote(container) {
  const subject = `${tt("soba3d.quoteSubject", "Upit za ponudu")} — ${container.querySelector("#s3d-name")?.value.trim() || tt("soba3d.title", "3D soba")}`;
  const href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(quoteSummary())}`;
  window.location.href = href;
  window.AKV?.toast?.(tt("soba3d.quoteSent", "Otvaramo poruku s vašim odabirom."));
}
