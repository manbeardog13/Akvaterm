// ============================================================================
// views/favoriti.js — the favorites list (#/favoriti). Shows saved products in
// the shared catalog grid; unhearting a product removes its card immediately.
// Empty state points back to the catalog.
// ============================================================================
import { listProducts, listFavorites } from "../db.js";
import { ensureStyles, productCard, wireFavButtons, pageHead, tf, esc } from "./katalog.js";

export async function render(container) {
  ensureStyles();
  const [products, favIds] = await Promise.all([listProducts(), listFavorites()]);
  const favSet = new Set(favIds);
  const rows = favIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);

  if (!rows.length) {
    container.innerHTML = `
      ${pageHead(tf("fav.eyebrow", "Vaš izbor"), tf("fav.title", "Favoriti"), "")}
      <div class="akv-empty">
        <div class="ico" aria-hidden="true">♡</div>
        <h2 class="t-h2 akv-display-2">${esc(tf("fav.emptyTitle", "Još nemate favorita"))}</h2>
        <p class="t-body akv-lead">${esc(tf("fav.emptyBody", "Dodirnite ♡ na proizvodu koji vam se sviđa i pronaći ćete ga ovdje."))}</p>
        <a class="akv-btn akv-btn-primary t-button" href="#/">${esc(tf("fav.goCatalog", "U katalog"))}</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    ${pageHead(tf("fav.eyebrow", "Vaš izbor"), tf("fav.title", "Favoriti"), "")}
    <p class="t-meta akv-meta" id="favCount" style="margin:-12px 0 16px">${rows.length} ${esc(tf("kat.productsShort", "proizvoda"))}</p>
    <div class="akv-grid" id="favGrid">${rows.map((p) => productCard(p, favSet)).join("")}</div>`;

  wireFavButtons(container.querySelector("#favGrid"), favSet, (id, on) => {
    if (!on) {
      container.querySelector(`[data-pid="${CSS.escape(id)}"]`)?.remove();
      const left = container.querySelectorAll("#favGrid [data-pid]").length;
      if (!left) render(container);
      else {
        const count = container.querySelector("#favCount");
        if (count) count.textContent = `${left} ${tf("kat.productsShort", "proizvoda")}`;
      }
    }
  });
}

export function teardown() { /* no document-level listeners to release */ }
