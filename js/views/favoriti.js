// ============================================================================
// views/favoriti.js — the favorites list (#/favoriti). Shows saved products in
// the shared catalog grid; unhearting a product removes its card immediately.
// Empty state points back to the catalog.
// ============================================================================
import { listProducts, listFavorites } from "../db.js";
import { ensureStyles, productCard, wireFavButtons, tf, esc } from "./katalog.js";

export async function render(container) {
  ensureStyles();
  const [products, favIds] = await Promise.all([listProducts(), listFavorites()]);
  const favSet = new Set(favIds);
  const rows = favIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);

  if (!rows.length) {
    container.innerHTML = `
      <header style="margin:4px 0 12px"><h1 style="margin:0">${esc(tf("fav.title", "Favoriti"))}</h1></header>
      <div class="akv-empty card">
        <div class="ico" aria-hidden="true">♡</div>
        <h2>${esc(tf("fav.emptyTitle", "Još nemate favorita"))}</h2>
        <p class="muted">${esc(tf("fav.emptyBody", "Dodirnite ♡ na proizvodu koji vam se sviđa i pronaći ćete ga ovdje."))}</p>
        <a class="btn btn-primary" href="#/" style="margin-top:10px">${esc(tf("fav.goCatalog", "U katalog"))}</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <header style="margin:4px 0 12px">
      <h1 style="margin:0 0 2px">${esc(tf("fav.title", "Favoriti"))}</h1>
      <p class="muted" style="margin:0">${rows.length} ${esc(tf("kat.productsShort", "proizvoda"))}</p>
    </header>
    <div class="akv-grid" id="favGrid">${rows.map((p) => productCard(p, favSet)).join("")}</div>`;

  wireFavButtons(container.querySelector("#favGrid"), favSet, (id, on) => {
    if (!on) {
      container.querySelector(`[data-pid="${CSS.escape(id)}"]`)?.remove();
      const left = container.querySelectorAll("#favGrid [data-pid]").length;
      if (!left) render(container);
      else {
        const count = container.querySelector("header .muted");
        if (count) count.textContent = `${left} ${tf("kat.productsShort", "proizvoda")}`;
      }
    }
  });
}

export function teardown() { /* no document-level listeners to release */ }
