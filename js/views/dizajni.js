// ============================================================================
// views/dizajni.js — saved designs (#/dizajni). Lists localStorage/Supabase
// designs newest-first with the products they use, opens them back in the
// dizajner (2D scene) or 3D room, and deletes with an inline two-step confirm.
// Empty state points to the dizajner.
// ============================================================================
import { listDesigns, deleteDesign, listProducts } from "../db.js";
import { swatchDataUrl } from "../texture.js";
import { ensureStyles, tf, esc } from "./katalog.js";

const armTimers = new Set();

const fmtDate = (iso) => {
  try {
    return new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return ""; }
};

// Croatian plural for "površina": 1 površina, 2–4 površine, 5+ površina.
const surfacesLabel = (n) => {
  const mod10 = n % 10, mod100 = n % 100;
  const word = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? "površine" : "površina";
  return `${n} ${word}`;
};

const openHash = (d) => d.kind === "room3d"
  ? `#/soba3d?design=${encodeURIComponent(d.id)}`
  : `#/dizajner/${encodeURIComponent(d.refId)}?design=${encodeURIComponent(d.id)}`;

export async function render(container) {
  ensureStyles();
  const [designs, products] = await Promise.all([listDesigns(), listProducts()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = [...designs].sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));

  if (!rows.length) {
    container.innerHTML = `
      <header style="margin:4px 0 12px"><h1 style="margin:0">${esc(tf("diz.title", "Moji dizajni"))}</h1></header>
      <div class="akv-empty card">
        <div class="ico" aria-hidden="true">🎨</div>
        <h2>${esc(tf("diz.emptyTitle", "Još nema spremljenih dizajna"))}</h2>
        <p class="muted">${esc(tf("diz.emptyBody", "Otvorite dizajner, odaberite prostoriju i pločice, pa spremite svoj prvi dizajn."))}</p>
        <a class="btn btn-primary" href="#/dizajner" style="margin-top:10px">${esc(tf("diz.goDesigner", "Otvori dizajner"))}</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <header style="margin:4px 0 12px">
      <h1 style="margin:0 0 2px">${esc(tf("diz.title", "Moji dizajni"))}</h1>
      <p class="muted" style="margin:0">${rows.length} ${esc(tf("diz.countShort", "dizajna"))}</p>
    </header>
    <div id="dizList">
      ${rows.map((d) => {
        const assignments = d.assignments || {};
        const usedIds = [...new Set(Object.values(assignments).map((a) => a?.productId).filter(Boolean))];
        const swatches = usedIds.slice(0, 4).map((pid) => byId.get(pid)).filter(Boolean);
        const kindLabel = d.kind === "room3d" ? tf("diz.kind3d", "3D soba") : tf("diz.kindScene", "2D scena");
        return `
        <section class="card akv-dcard" data-did="${esc(d.id)}">
          <div class="akv-dsw" aria-hidden="true">
            ${swatches.length
              ? swatches.map((p) => `<img src="${swatchDataUrl(p, 64)}" alt="" width="36" height="36">`).join("")
              : `<span style="font-size:28px">🎨</span>`}
          </div>
          <div class="akv-dbody">
            <div style="font-weight:700">${esc(d.name || tf("diz.unnamed", "Dizajn bez naziva"))}</div>
            <div class="muted" style="font-size:12px">
              <span class="chip">${esc(kindLabel)}</span>
              ${esc(surfacesLabel(Object.keys(assignments).length))}${d.savedAt ? ` · ${esc(fmtDate(d.savedAt))}` : ""}
            </div>
          </div>
          <div class="akv-dactions">
            <a class="btn btn-primary" href="${openHash(d)}">${esc(tf("diz.open", "Otvori"))}</a>
            <button type="button" class="btn" data-del="${esc(d.id)}">${esc(tf("diz.delete", "Obriši"))}</button>
          </div>
        </section>`;
      }).join("")}
    </div>`;

  // Two-step inline delete: first tap arms the button, second tap (within
  // 2.5 s) deletes; the arm state reverts on timeout.
  container.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.armed !== "1") {
        btn.dataset.armed = "1";
        btn.classList.add("btn-danger");
        btn.textContent = tf("diz.confirmDelete", "Potvrdi brisanje");
        const timer = setTimeout(() => {
          armTimers.delete(timer);
          btn.dataset.armed = "";
          btn.classList.remove("btn-danger");
          btn.textContent = tf("diz.delete", "Obriši");
        }, 2500);
        armTimers.add(timer);
        return;
      }
      await deleteDesign(btn.dataset.del);
      window.AKV?.toast?.(tf("diz.deleted", "Dizajn obrisan"));
      render(container);
    });
  });
}

export function teardown() {
  for (const timer of armTimers) clearTimeout(timer);
  armTimers.clear();
}
