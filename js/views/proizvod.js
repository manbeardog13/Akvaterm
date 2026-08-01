// ============================================================================
// views/proizvod.js — product detail (#/proizvod/:id). Large procedural swatch
// (a live pattern-preview canvas for tiles, a material card for equipment),
// specs table, price, favorite toggle and the "Primijeni u dizajneru" action
// which routes to #/dizajner?product=<id>.
// ============================================================================
import { PATTERNS, GROUT_COLORS, CATEGORIES, formatEur } from "../domain.js";
import { getProduct, listFavorites, toggleFavorite } from "../db.js";
import { buildPatternCell, swatchDataUrl } from "../texture.js";
import { esc, tf, ensureStyles, pickParam, priceLabel, formatLabel, catLabel } from "./katalog.js";

const PATTERN_FALLBACK = { grid: "Ravno", runningBond: "Pomaknuto", herringbone: "Riblja kost", diagonal: "Dijagonalno" };
const KIND_LABELS = {
  marble: "Mramor-look gres", travertine: "Travertin-look gres", ceramic: "Keramika",
  concrete: "Beton-look gres", woodPlank: "Drvo-look gres", terrazzo: "Terrazzo",
  subway: "Metro pločica", hexMosaic: "Heksagon mozaik", metal: "Metal", flat: "Glatka površina",
};

export async function render(container, params) {
  ensureStyles();
  const id = pickParam(params, "id");
  const p = await getProduct(id);
  if (!p) {
    container.innerHTML = `
      <div class="banner banner-danger" style="margin:12px 0">${esc(tf("prod.notFound", "Proizvod nije pronađen."))}</div>
      <a class="btn" href="#/">← ${esc(tf("kat.back", "Katalog"))}</a>`;
    return;
  }

  const favIds = await listFavorites();
  let fav = favIds.includes(p.id);
  const isTile = Array.isArray(p.tileSizeMm);
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const catIcon = cat?.icon || "📦";

  const specRows = [];
  specRows.push([tf("prod.brand", "Marka"), p.brand]);
  specRows.push([tf("prod.category", "Kategorija"), catLabel(cat) || p.category]);
  if (isTile) {
    specRows.push([tf("prod.format", "Format"), formatLabel(p)]);
    specRows.push([tf("prod.finish", "Završna obrada"), p.glossy ? tf("kat.glossy", "Sjajna") : tf("kat.mat", "Mat")]);
    specRows.push([tf("prod.surface", "Površina"), KIND_LABELS[p.textureKind] || p.textureKind]);
    specRows.push([tf("prod.priceM2", "Cijena po m²"), formatEur(p.priceM2)]);
  } else {
    specRows.push([tf("prod.unit", "Jedinica"), tf("prod.perPiece", "komad")]);
    specRows.push([tf("prod.pricePiece", "Cijena po komadu"), formatEur(p.priceUnit)]);
  }

  container.innerHTML = `
    <a class="btn btn-ghost" href="${isTile ? `#/katalog/${esc(p.category)}` : "#/"}" style="margin-bottom:10px">← ${esc(tf("kat.back", "Katalog"))}</a>
    <div class="akv-prod">
      <div>
        ${isTile
          ? `<canvas class="akv-prev card" id="prodPrev" width="960" height="720" role="img"
               aria-label="${esc(tf("prod.previewAlt", "Pregled uzorka"))}"></canvas>
             <div class="akv-chiprow" role="group" aria-label="${esc(tf("prod.pattern", "Uzorak polaganja"))}" style="margin-top:10px">
               <span class="lab">${esc(tf("prod.pattern", "Uzorak"))}</span>
               ${PATTERNS.map((pt) => `<button type="button" class="akv-chip" data-pattern="${esc(pt.id)}">${esc(tf(pt.i18nKey, PATTERN_FALLBACK[pt.id] || pt.id))}</button>`).join("")}
             </div>`
          : `<div class="akv-sw-wrap card" style="overflow:hidden;border-radius:12px">
               <img class="akv-prev" src="${swatchDataUrl(p, 512)}" alt="" style="aspect-ratio:4/3">
               <span class="akv-eq-ico" style="font-size:72px">${esc(catIcon)}</span>
             </div>`}
      </div>
      <div class="card" style="padding:18px">
        <div class="muted" style="font-size:13px">${esc(p.brand)} · ${esc(catLabel(cat) || p.category)}</div>
        <h1 style="margin:4px 0 2px">${esc(p.name)}</h1>
        <div class="akv-bigprice">${esc(priceLabel(p))}</div>
        <p class="muted" style="margin:0 0 6px">${esc(p.desc)}</p>
        <table class="akv-specs">
          <tbody>
            ${specRows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
          </tbody>
        </table>
        <div class="akv-actions">
          <button type="button" class="btn btn-primary" id="applyBtn">${esc(tf("prod.apply", "Primijeni u dizajneru"))}</button>
          <button type="button" class="btn" id="favBtn" aria-pressed="${fav}">${fav ? "♥" : "♡"} ${esc(tf("prod.fav", "Favorit"))}</button>
        </div>
        <p class="muted" style="font-size:12px;margin:12px 0 0">${esc(tf("prod.demoNote", "Ogledni demo proizvod — cijena i specifikacije nisu stvarna ponuda."))}</p>
      </div>
    </div>`;

  // ---- preview canvas (tiles): live pattern switcher --------------------------
  if (isTile) {
    const canvas = container.querySelector("#prodPrev");
    const ctx = canvas.getContext("2d");
    const groutHex = GROUT_COLORS[0]?.hex || "#e8e6e1";
    let activePattern = PATTERNS[0]?.id || "grid";

    const paint = () => {
      const [tw, th] = p.tileSizeMm;
      // aim for roughly 3 tiles across the 960px preview
      const scale = Math.min(0.8, Math.max(0.12, 300 / Math.max(tw, th)));
      const { canvas: cell } = buildPatternCell(p, {
        pattern: activePattern,
        groutColorHex: groutHex,
        groutWidthMm: 3,
        scalePxPerMm: scale,
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = ctx.createPattern(cell, "repeat");
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const chips = container.querySelectorAll("[data-pattern]");
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        activePattern = chip.dataset.pattern;
        chips.forEach((c) => c.classList.toggle("on", c.dataset.pattern === activePattern));
        paint();
      });
    });
    chips.forEach((c) => c.classList.toggle("on", c.dataset.pattern === activePattern));
    paint();
  }

  // ---- actions ---------------------------------------------------------------
  container.querySelector("#applyBtn").addEventListener("click", () => {
    location.hash = `#/dizajner?product=${encodeURIComponent(p.id)}`;
  });

  const favBtn = container.querySelector("#favBtn");
  favBtn.addEventListener("click", async () => {
    const favs = await toggleFavorite(p.id);
    fav = favs.includes(p.id);
    favBtn.setAttribute("aria-pressed", String(fav));
    favBtn.textContent = `${fav ? "♥" : "♡"} ${tf("prod.fav", "Favorit")}`;
    window.AKV?.toast?.(fav ? tf("kat.favAdded", "Dodano u favorite") : tf("kat.favRemoved", "Uklonjeno iz favorita"));
  });
}

export function teardown() { /* no document-level listeners to release */ }
