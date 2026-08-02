// ============================================================================
// views/dizajni.js — saved designs (#/dizajni). Lists localStorage/Supabase
// designs newest-first with a real thumbnail of each one, opens them back in
// the dizajner or the 3D room, and deletes with an inline two-step confirm.
// Empty state points to the dizajner.
//
// The thumbnails are stills from js/scene3d.js: the same room shell, the same
// vendored CC0 .glb models and the same physical-scale tile pipeline the live
// designer renders with. Nothing on this screen is drawn by hand, and a card
// whose still cannot be produced falls back to the product swatches rather
// than to an illustration of a room nobody designed.
// ============================================================================
import { listDesigns, deleteDesign, listProducts } from "../db.js";
import { ensureStyles, pageHead, tf, esc, paintSceneThumb, swatchAttrs, hydrateSwatches } from "./katalog.js";

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

// ---------------------------------------------------------------------------
// What a card's thumbnail renders
// ---------------------------------------------------------------------------
// A `kind:'scene'` design names a scene in data/scenes.js, so its refId goes
// straight to the engine and the still is the designed scene, fixtures and all.
//
// A `kind:'room3d'` design has refId:null and carries its own room box instead
// (js/db.js: room:{widthM,depthM,heightM,fixtures}). js/scene3d.js accepts a
// scene OBJECT as well as an id, so the card can show that room at its real
// dimensions with its real tiles on it.
//
// It shows NO furniture, deliberately. A saved room stores fixture TYPE ids
// ('kada', 'sudoper', …), which are keys of FIXTURE_SPECS inside js/room3d.js;
// the scene engine takes vendor/models file stems ('bathtub',
// 'kitchen-sink-unit', …). That table is private to room3d.js and is not
// exported, so re-typing a copy of it here would be exactly the guesswork this
// rebuild exists to delete. An honestly empty tiled room beats an invented one.
const ROOM3D_SURFACES = [
  { id: "floor", kind: "floor", wall: null },
  { id: "wallN", kind: "wall", wall: "N" },
  { id: "wallE", kind: "wall", wall: "E" },
  { id: "wallS", kind: "wall", wall: "S" },
  { id: "wallW", kind: "wall", wall: "W" },
];

const posDim = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Scene id, synthesised scene object, or null when there is nothing to draw. */
function thumbTargetFor(d) {
  if (d.kind !== "room3d") return typeof d.refId === "string" && d.refId ? d.refId : null;
  const r = d.room;
  const w = posDim(r && r.widthM), dep = posDim(r && r.depthM), h = posDim(r && r.heightM);
  if (!w || !dep || !h) return null;
  // The camera is DERIVED from the room, never hand-placed per design: stand
  // back from the south-east corner by a fraction of the longer side and look
  // at the middle of the room. scene3d.js hides the two walls the camera is
  // standing outside of, so this is the usual cutaway of the north and west
  // walls plus the floor, at any room size.
  const back = Math.max(1.1, Math.max(w, dep) * 0.42);
  return {
    id: `room3d:${d.id}`,
    room: { widthM: w, depthM: dep, heightM: h },
    camera: {
      posM: [w + back, Math.min(h * 0.68, h - 0.35), dep + back],
      targetM: [w / 2, h * 0.42, dep / 2],
      fov: 42,
    },
    surfaces: ROOM3D_SURFACES,
    fixtures: [],
  };
}

/** Product swatches — the fallback when no still could be rendered. */
function swatchFallback(slot, design, byId) {
  const used = [...new Set(Object.values(design.assignments || {}).map((a) => a?.productId).filter(Boolean))];
  const swatches = used.slice(0, 4).map((pid) => byId.get(pid)).filter(Boolean);
  slot.innerHTML = swatches.length
    ? swatches.map((p) => `<img ${swatchAttrs(p, 64)} alt="" width="40" height="40">`).join("")
    : `<span style="font-size:30px">🎨</span>`;
  hydrateSwatches(slot);
}

// One pass per render(). A delete re-renders the list and a navigation tears it
// down; both bump the token so the loop below stops instead of spending a WebGL
// context on a card that no longer exists.
let thumbPass = 0;

async function paintThumbs(container, rows, products, byId) {
  const pass = ++thumbPass;
  const slots = [...container.querySelectorAll("[data-akv-thumb]")];
  // Strictly one at a time. js/scene3d.js already serialises its stills through
  // a single WebGL context (browsers cap live contexts at ~16) and yields to the
  // event loop between them, so awaiting them in order costs nothing extra —
  // and it is what makes the pass cancellable and the list interactive while
  // the pictures arrive.
  for (let i = 0; i < slots.length && i < rows.length; i++) {
    if (pass !== thumbPass) return;
    const slot = slots[i];
    const canvas = slot.querySelector("canvas");
    if (!canvas || !canvas.isConnected) continue;
    const design = rows[i];
    const target = thumbTargetFor(design);
    const ok = target
      ? await paintSceneThumb(canvas, target, design.assignments || {}, products)
      : false;
    if (pass !== thumbPass) return;
    if (!ok && slot.isConnected) swatchFallback(slot, design, byId);
  }
}

export async function render(container) {
  ensureStyles();
  thumbPass++;                       // stop any pass still running for the old list
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
        const kindLabel = d.kind === "room3d" ? tf("diz.kind3d", "3D soba") : tf("diz.kindScene", "2D scena");
        return `
        <section class="akv-dcard" data-did="${esc(d.id)}">
          <div class="akv-dsw" data-akv-thumb aria-hidden="true">
            <canvas class="akv-dthumb" width="288" height="216"></canvas>
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
        // .akv-btn-danger fills with --danger (= --red-warm #B92C1C) and
        // labels it white: 6.10:1, AA at any size. The sampled Iris palette
        // carries no red of its own, so css/styles.css:119-123 derives this one
        // by rotating --amber-600's hue 30.6 -> 6 at unchanged S/L — a warm red
        // that cannot be mistaken for the heat amber.
        // (An earlier note here claimed a --brown-700 fill at 7.50:1. That
        // ratio is real for #83440F, but this button has never painted it.)
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

  // Deliberately not awaited — the list is usable the moment it is in the DOM
  // and the pictures fill in behind it. The catch is there so a decorative
  // failure surfaces as one named warning instead of an unhandled rejection.
  paintThumbs(container, rows, products, byId)
    .catch((err) => console.warn("[dizajni] thumbnail pass stopped:", err?.message || err));
}

export function teardown() {
  thumbPass++;                       // stop the thumbnail pass on navigation
  for (const timer of armTimers) clearTimeout(timer);
  armTimers.clear();
}
