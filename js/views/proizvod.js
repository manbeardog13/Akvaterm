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

// Iris skin note — this view carries the catalogue's ONE extra backdrop-filter
// surface: .akv-rail, the pattern switcher floating over the tile preview. Nav +
// tab bar are the standing pair, so a product page shows three glass surfaces at
// most, which is the top of the budget. Everything else here (spec panel, swatch
// frame, inquiry box) is opaque or a plain translucent tint.
//
// Rail contrast, recomputed against the alpha css/styles.css actually ships
// (--glass-alpha-text .78 — an earlier draft of this note assumed 0.64 and a
// #A3A3A3 composite, which the app never rendered). The rail's worst case is
// the tint over a PURE BLACK tile, and brightness(1.06) cannot lift black, so
// nothing is darker: hsl(187 44% 97%) #F4FAFB @ .78 over #000000 = #BEC3C4.
// On that surface --ink #313131 measures 7.31:1 and --teal-700 #0D707D only
// 3.25:1 — which is why rail text is --ink ONLY and the active chip is an
// OPAQUE --teal-700 fill carrying white at 5.78:1, not tinted glass. All three
// figures are computed, not carried over; the styles themselves live in
// katalog.js (.akv-rail, .akv-chip) and degrade through the five paths there,
// including the manual html[data-transparency="reduced"] switch iOS depends on.

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
      <div class="akv-empty">
        <div class="ico" aria-hidden="true">🔎</div>
        <h2 class="t-h2 akv-display-2">${esc(tf("prod.notFound", "Proizvod nije pronađen."))}</h2>
        <a class="akv-btn akv-btn-primary t-button" href="#/">← ${esc(tf("kat.back", "Katalog"))}</a>
      </div>`;
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
    <a class="akv-back t-button" href="#/katalog/${esc(p.category)}">← ${esc(tf("kat.back", "Katalog"))}</a>
    <div class="akv-prod">
      <div>
        ${isTile
          ? `<div class="akv-prevwrap">
               <canvas class="akv-prev" id="prodPrev" width="960" height="720" role="img"
                 aria-label="${esc(tf("prod.previewAlt", "Pregled uzorka"))}"></canvas>
               <div class="akv-rail akv-chiprow" role="group" aria-label="${esc(tf("prod.pattern", "Uzorak polaganja"))}">
                 <span class="lab t-meta akv-meta">${esc(tf("prod.patternShort", "Uzorak"))}</span>
                 ${PATTERNS.map((pt) => `<button type="button" class="akv-chip" data-pattern="${esc(pt.id)}" aria-pressed="false">${esc(tf(pt.i18nKey, PATTERN_FALLBACK[pt.id] || pt.id))}</button>`).join("")}
               </div>
             </div>`
          : `<div class="akv-sw-wrap akv-eqwrap">
               <img class="akv-prev" ${swatchAttrs(p, 512)} alt="" style="aspect-ratio:4/3">
               <span class="akv-eq-ico" aria-hidden="true" style="font-size:76px">${esc(catIcon)}</span>
             </div>`}
      </div>
      <div class="akv-panel">
        <span class="t-meta akv-meta">${esc(p.brand)} · ${esc(catLabel(cat) || p.category)}</span>
        <h1 class="t-h2 akv-display-2">${esc(p.name)}</h1>
        <div class="akv-bigprice t-numeric akv-num">${esc(priceLabel(p))}</div>
        ${hasArea ? `<p class="akv-order" id="prodOrder"></p>` : ""}
        <p class="t-body akv-lead" style="margin:0">${esc(p.desc)}</p>
        <table class="akv-specs">
          <tbody>
            ${specRows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
          </tbody>
        </table>
        <div class="akv-actions">
          ${isTile
            ? `<button type="button" class="akv-btn akv-btn-primary t-button" id="applyBtn">${esc(tf("prod.apply", "Primijeni u dizajneru"))}</button>`
            : `<button type="button" class="akv-btn akv-btn-primary t-button" id="inquiryBtn" aria-expanded="false" aria-controls="inquiryBox">${esc(tf("prod.inquiry", "Pripremi upit"))}</button>`}
          <button type="button" class="akv-btn t-button" id="favBtn" aria-pressed="${fav}">${fav ? "♥" : "♡"} ${esc(tf("prod.fav", "Favorit"))}</button>
        </div>
        ${isTile ? "" : `
        <p class="akv-fine">${esc(tf("prod.noDesigner", "Dizajner i 3D soba oblažu površine pločicama, pa se ova oprema u njima ne postavlja."))}</p>
        <div class="akv-inq" id="inquiryBox" hidden>
          <p class="akv-fine" style="margin:0">${esc(tf("prod.inqHelp", "Demo verzija ne šalje upite. Kopirajte pripremljeni tekst i pošaljite ga Akvatermu e-poštom ili porukom."))}</p>
          <textarea id="inquiryText" readonly rows="10" aria-label="${esc(tf("prod.inqAria", "Pripremljeni tekst upita"))}"></textarea>
          <div class="akv-actions" style="margin-top:10px">
            <button type="button" class="akv-btn akv-btn-warm t-button" id="inquiryCopy">${esc(tf("prod.inqCopy", "Kopiraj tekst"))}</button>
          </div>
        </div>`}
        <p class="akv-fine">${esc(tf("prod.demoNote", "Ogledni demo proizvod — cijena i specifikacije nisu stvarna ponuda."))}</p>
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
