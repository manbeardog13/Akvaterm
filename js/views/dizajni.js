// ============================================================================
// views/dizajni.js — saved designs (#/dizajni). Lists localStorage/Supabase
// designs newest-first with the products they use, opens them back in the
// dizajner (2D scene) or 3D room, and deletes with an inline two-step confirm.
// Empty state points to the dizajner.
// ============================================================================
import { listDesigns, deleteDesign, listProducts } from "../db.js";
import { swatchDataUrl } from "../texture.js";
import { ensureStyles, pageHead, tf, esc } from "./katalog.js";

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
      ${pageHead(tf("diz.eyebrow", "Spremljeno"), tf("diz.title", "Moji dizajni"), "")}
      <div class="akv-empty">
        <div class="ico" aria-hidden="true">🎨</div>
        <h2 class="t-h2 akv-display-2">${esc(tf("diz.emptyTitle", "Još nema spremljenih dizajna"))}</h2>
        <p class="t-body akv-lead">${esc(tf("diz.emptyBody", "Otvorite dizajner, odaberite prostoriju i pločice, pa spremite svoj prvi dizajn."))}</p>
        <a class="akv-btn akv-btn-primary t-button" href="#/dizajner">${esc(tf("diz.goDesigner", "Otvori dizajner"))}</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    ${pageHead(tf("diz.eyebrow", "Spremljeno"), tf("diz.title", "Moji dizajni"), "")}
    <p class="t-meta akv-meta" style="margin:-12px 0 16px">${rows.length} ${esc(tf("diz.countShort", "dizajna"))}</p>
    <div id="dizList">
      ${rows.map((d) => {
        const assignments = d.assignments || {};
        const usedIds = [...new Set(Object.values(assignments).map((a) => a?.productId).filter(Boolean))];
        const swatches = usedIds.slice(0, 4).map((pid) => byId.get(pid)).filter(Boolean);
        const kindLabel = d.kind === "room3d" ? tf("diz.kind3d", "3D soba") : tf("diz.kindScene", "2D scena");
        return `
        <section class="akv-dcard" data-did="${esc(d.id)}">
          <div class="akv-dsw" aria-hidden="true">
            ${swatches.length
              ? swatches.map((p) => `<img src="${swatchDataUrl(p, 64)}" alt="" width="40" height="40">`).join("")
              : `<span style="font-size:30px">🎨</span>`}
          </div>
          <div class="akv-dbody">
            <div class="akv-dname">${esc(d.name || tf("diz.unnamed", "Dizajn bez naziva"))}</div>
            <div class="akv-drow">
              <span class="akv-kind">${esc(kindLabel)}</span>
              <span class="t-meta akv-meta">${esc(surfacesLabel(Object.keys(assignments).length))}${d.savedAt ? ` · ${esc(fmtDate(d.savedAt))}` : ""}</span>
            </div>
          </div>
          <div class="akv-dactions">
            <a class="akv-btn akv-btn-primary t-button" href="${openHash(d)}">${esc(tf("diz.open", "Otvori"))}</a>
            <button type="button" class="akv-btn t-button" data-del="${esc(d.id)}">${esc(tf("diz.delete", "Obriši"))}</button>
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
        // --brown-700 fill, white label: 7.50:1. The Iris palette has no red,
        // so the destructive cue is the darkest warm ground, not a hue swap.
        btn.classList.add("akv-btn-danger");
        btn.textContent = tf("diz.confirmDelete", "Potvrdi brisanje");
        const timer = setTimeout(() => {
          armTimers.delete(timer);
          btn.dataset.armed = "";
          btn.classList.remove("akv-btn-danger");
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
