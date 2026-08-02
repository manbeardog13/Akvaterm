// ============================================================================
// views/proizvod.js — product detail (#/proizvod/:id). Large procedural swatch
// (a live pattern-preview canvas for tiles, a material card for equipment),
// specs table, price, favorite toggle.
// The primary action depends on what the product IS: tiles route to
// #/dizajner?product=<id>, which honours them; equipment (23 of the 46 seed
// products) cannot be applied to a surface at all, so it gets a prepared
// inquiry text instead of a button that silently drops the product.
// With a ?area=<m2> in the hash query a tile also shows the order estimate
// (domain.orderEstimate) under its price.
// ============================================================================
import { PATTERNS, GROUT_COLORS, CATEGORIES, formatEur, orderEstimate } from "../domain.js";
import { getProduct, listFavorites, toggleFavorite } from "../db.js";
import { buildPatternCell } from "../texture.js";
import { esc, tf, ensureStyles, pickParam, priceLabel, formatLabel, catLabel, swatchAttrs, hydrateSwatches } from "./katalog.js";

const PATTERN_FALLBACK = { grid: "Ravno", runningBond: "Pomaknuto", herringbone: "Riblja kost", diagonal: "Dijagonalno" };
const KIND_LABELS = {
  marble: "Mramor-look gres", travertine: "Travertin-look gres", ceramic: "Keramika",
  concrete: "Beton-look gres", woodPlank: "Drvo-look gres", terrazzo: "Terrazzo",
  subway: "Metro pločica", hexMosaic: "Heksagon mozaik", metal: "Metal", flat: "Glatka površina",
};

// A share/deep link may carry a query INSIDE the hash (#/proizvod/ker-01?area=9);
// the router's capture group keeps it, so strip it off the id here the same way
// the dizajner view does.
function hashQuery() {
  const raw = String(location.hash || "").replace(/^#/, "");
  const at = raw.indexOf("?");
  return new URLSearchParams(at >= 0 ? raw.slice(at + 1) : "");
}

function productId(params) {
  const raw = String(pickParam(params, "id") ?? "").split("?")[0];
  try { return decodeURIComponent(raw); } catch { return raw; }
}

// Croatian decimal comma, trailing zeros trimmed: 13.75 -> "13,75", 13 -> "13".
function fmtNum(n) {
  const s = (Math.round(Number(n) * 100) / 100).toFixed(2)
    .replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return s.replace(".", ",");
}

// The plain-text inquiry a customer can paste into an e-mail or a message —
// the demo has no back end, so the view prepares the text and says so rather
// than pretending to send anything.
function inquiryText(p, cat) {
  const lines = [
    tf("prod.inqTitle", "Upit za ponudu — Akvaterm"),
    "",
    `${tf("prod.inqProduct", "Proizvod")}: ${p.name} (${p.id})`,
    `${tf("prod.brand", "Marka")}: ${p.brand}`,
    `${tf("prod.category", "Kategorija")}: ${catLabel(cat) || p.category}`,
  ];
  if (p.sizeCm) lines.push(`${tf("prod.size", "Dimenzije")}: ${p.sizeCm} cm`);
  lines.push(`${tf("prod.inqPrice", "Cijena iz demo kataloga")}: ${priceLabel(p)}`);
  lines.push(`${tf("prod.inqQty", "Količina")}: 1`);
  lines.push(
    "",
    `${tf("prod.inqName", "Ime i prezime")}:`,
    `${tf("prod.inqContact", "Telefon / e-pošta")}:`,
    `${tf("prod.inqNote", "Napomena")}:`,
  );
  return lines.join("\n");
}

export async function render(container, params) {
  ensureStyles();
  const id = productId(params);
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
  const areaM2 = Number(hashQuery().get("area"));
  const hasArea = isTile && Number.isFinite(areaM2) && areaM2 > 0;

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
    if (p.sizeCm) specRows.push([tf("prod.size", "Dimenzije"), `${p.sizeCm} cm`]);
    specRows.push([tf("prod.pricePiece", "Cijena po komadu"), formatEur(p.priceUnit)]);
  }

  container.innerHTML = `
    <a class="btn btn-ghost" href="#/katalog/${esc(p.category)}" style="margin-bottom:10px">← ${esc(tf("kat.back", "Katalog"))}</a>
    <div class="akv-prod">
      <div>
        ${isTile
          ? `<canvas class="akv-prev card" id="prodPrev" width="960" height="720" role="img"
               aria-label="${esc(tf("prod.previewAlt", "Pregled uzorka"))}"></canvas>
             <div class="akv-chiprow" role="group" aria-label="${esc(tf("prod.pattern", "Uzorak polaganja"))}" style="margin-top:10px">
               <span class="lab">${esc(tf("prod.pattern", "Uzorak"))}</span>
               ${PATTERNS.map((pt) => `<button type="button" class="akv-chip" data-pattern="${esc(pt.id)}" aria-pressed="false">${esc(tf(pt.i18nKey, PATTERN_FALLBACK[pt.id] || pt.id))}</button>`).join("")}
             </div>`
          : `<div class="akv-sw-wrap card" style="overflow:hidden;border-radius:12px">
               <img class="akv-prev" ${swatchAttrs(p, 512)} alt="" style="aspect-ratio:4/3">
               <span class="akv-eq-ico" style="font-size:72px">${esc(catIcon)}</span>
             </div>`}
      </div>
      <div class="card" style="padding:18px">
        <div class="muted" style="font-size:13px">${esc(p.brand)} · ${esc(catLabel(cat) || p.category)}</div>
        <h1 style="margin:4px 0 2px">${esc(p.name)}</h1>
        <div class="akv-bigprice">${esc(priceLabel(p))}</div>
        ${hasArea ? `<p class="akv-order muted" id="prodOrder"></p>` : ""}
        <p class="muted" style="margin:0 0 6px">${esc(p.desc)}</p>
        <table class="akv-specs">
          <tbody>
            ${specRows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
          </tbody>
        </table>
        <div class="akv-actions">
          ${isTile
            ? `<button type="button" class="btn btn-primary" id="applyBtn">${esc(tf("prod.apply", "Primijeni u dizajneru"))}</button>`
            : `<button type="button" class="btn btn-primary" id="inquiryBtn" aria-expanded="false" aria-controls="inquiryBox">${esc(tf("prod.inquiry", "Pripremi upit"))}</button>`}
          <button type="button" class="btn" id="favBtn" aria-pressed="${fav}">${fav ? "♥" : "♡"} ${esc(tf("prod.fav", "Favorit"))}</button>
        </div>
        ${isTile ? "" : `
        <p class="muted" style="font-size:12px;margin:10px 0 0">${esc(tf("prod.noDesigner", "Dizajner i 3D soba oblažu površine pločicama, pa se ova oprema u njima ne postavlja."))}</p>
        <div class="akv-inq" id="inquiryBox" hidden>
          <p class="muted" style="font-size:12px;margin:0">${esc(tf("prod.inqHelp", "Demo verzija ne šalje upite. Kopirajte pripremljeni tekst i pošaljite ga Akvatermu e-poštom ili porukom."))}</p>
          <textarea id="inquiryText" readonly rows="10" aria-label="${esc(tf("prod.inqAria", "Pripremljeni tekst upita"))}"></textarea>
          <div class="akv-actions" style="margin-top:8px">
            <button type="button" class="btn btn-primary" id="inquiryCopy">${esc(tf("prod.inqCopy", "Kopiraj tekst"))}</button>
          </div>
        </div>`}
        <p class="muted" style="font-size:12px;margin:12px 0 0">${esc(tf("prod.demoNote", "Ogledni demo proizvod — cijena i specifikacije nisu stvarna ponuda."))}</p>
      </div>
    </div>`;

  hydrateSwatches(container);

  // ---- preview canvas (tiles): live pattern switcher --------------------------
  if (isTile) {
    const canvas = container.querySelector("#prodPrev");
    const ctx = canvas.getContext("2d");
    const groutHex = GROUT_COLORS[0]?.hex || "#e8e6e1";
    let activePattern = PATTERNS[0]?.id || "grid";
    const orderEl = container.querySelector("#prodOrder");

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

    // "Koliko naručiti?" — the reserve follows the selected pattern, because
    // herringbone and diagonal really do cut more tile at the edges.
    const paintOrder = () => {
      if (!orderEl) return;
      const est = orderEstimate(p, areaM2, activePattern);
      const vars = { area: fmtNum(est.areaM2), total: fmtNum(est.totalM2), pct: est.reservePct };
      orderEl.textContent = tf(
        "prod.orderLine",
        `Za ${vars.area} m² naručite oko ${vars.total} m² — uključeno ${vars.pct}% rezerve za rezanje i lom.`,
        vars,
      );
    };

    const chips = container.querySelectorAll("[data-pattern]");
    const syncChips = () => chips.forEach((c) => {
      const on = c.dataset.pattern === activePattern;
      c.classList.toggle("on", on);
      c.setAttribute("aria-pressed", String(on));
    });
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        activePattern = chip.dataset.pattern;
        syncChips();
        paint();
        paintOrder();
      });
    });
    syncChips();
    paint();
    paintOrder();
  }

  // ---- actions ---------------------------------------------------------------
  const applyBtn = container.querySelector("#applyBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      location.hash = `#/dizajner?product=${encodeURIComponent(p.id)}`;
    });
  }

  const inquiryBtn = container.querySelector("#inquiryBtn");
  if (inquiryBtn) {
    const box = container.querySelector("#inquiryBox");
    const area = container.querySelector("#inquiryText");
    inquiryBtn.addEventListener("click", () => {
      const open = box.hidden;
      box.hidden = !open;
      inquiryBtn.setAttribute("aria-expanded", String(open));
      if (open) {
        area.value = inquiryText(p, cat);
        box.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    container.querySelector("#inquiryCopy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(area.value);
        window.AKV?.toast?.(tf("prod.inqCopied", "Tekst upita kopiran"));
      } catch {
        area.focus();
        area.select();
        window.AKV?.toast?.(tf("prod.inqSelect", "Tekst je označen — kopirajte ga tipkama Ctrl+C"));
      }
    });
  }

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
