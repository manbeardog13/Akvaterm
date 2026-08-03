// ============================================================================
// views/atelier.js — the guided commissioning journey.
//
// This is the "Atelier" surface: a chaptered walk through js/journey.js,
// mounted over a live js/room3d.js room, directed by handle.camera.* (the
// director3d verbs). It is an ADDITIVE route — /soba3d, the free-form room, is
// completely untouched. This is a second front door into the same engine, not
// a replacement for the first.
//
// One glass surface, per the design-system budget the rest of the 3D views
// already observe: the floating guide card. Everything else is solid.
//
// CONTRACT WITH THE ENGINE (do not drift from these without re-reading the
// modules named):
//   - director3d verbs take SEMANTIC targets ('north-wall', 'floor', a fixture
//     kind), never internal surface ids. journey.js chapters already carry the
//     right target strings; this view passes them straight through.
//   - Every camera verb returns {ok, target, settled, cancelled, reason, done}
//     and never throws. A false `ok` degrades to "no camera move", never to a
//     broken screen — see onChapterChange().
//   - Glass-coverage state (room3d's own wall-to-glass blend) is engine-owned
//     and untouched here. This view only ever calls semantic camera verbs.
//   - Any future capture (thumbnail, spec) MUST go through
//     handle.camera.withOpaqueSurfaces(fn) — never read pixels directly.
// ============================================================================

import * as db from "../db.js";
import { t } from "../i18n.js";
import { createJourney, BATHROOM_V0 } from "../journey.js";
import { formatEur, orderEstimate } from "../domain.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const tt = (key, hr) => { const s = t(key); return s === key ? hr : s; };

// ---- module state (one active mount at a time, matching every sibling view) -
let mountToken = 0;
let api = null;             // room3d handle
let journey = null;
let products = [];
let container = null;
let reducedMotionMQ = null;
let panoramaOn = false;   // the ambient showcase's own on/off, tracked here because the engine has no notion of "chapters" to return to

function alive(token) { return token === mountToken && container && container.isConnected; }

// ---- persistence --------------------------------------------------------
// Saved under the SAME kind as soba3d ('room3d'), because it produces the
// exact record that view already knows how to load — a commission finished
// here can be opened in the free-form room, and vice versa. journeyState is
// additive: soba3d's loader ignores fields it doesn't recognise.
const AUTOSAVE_KEY = "akv:atelier-draft";

function autosave() {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
      room: journey.room,
      journeyState: journey.toJSON(),
      at: Date.now(),
    }));
  } catch { /* storage may be unavailable — the journey still works this session */ }
}

function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---- chapter -> camera --------------------------------------------------
// The ONE place a chapter's `intent` becomes a director call. journey.js
// never touches the camera directly — this is the seam the research report's
// "declare intent, the director computes the transform" rule describes.
function directCamera(chapter) {
  if (!api?.camera || !chapter) return;
  switch (chapter.intent) {
    case "returnToOverview": api.camera.returnToOverview(); break;
    case "focusSurface": api.camera.focusSurface(chapter.target ?? chapter.surface); break;
    case "inspectMaterial": api.camera.inspectMaterial(chapter.target ?? chapter.surface); break;
    case "orbitSelection": api.camera.orbitSelection(chapter.target ?? chapter.surface); break;
    default: api.camera.returnToOverview();
  }
}

// ---- markup ---------------------------------------------------------------
//
// GLASS BUDGET: exactly ONE simultaneous backdrop-filter surface, matching
// every sibling 3D view (see soba3d.js's own header note). That surface is
// .atl-guide. .atl-chapters and every option/button below is SOLID, so its
// contrast never depends on what the live room happens to show behind it.
//
// The token bridge and the glass recipe below are copied VERBATIM from
// js/views/soba3d.js rather than re-derived, including its measured contrast
// ratios and its five degradation paths. A second, slightly different glass
// recipe is exactly the defect that view's own history warns against — see
// its comment beginning "This previously painted rgba(235,238,242,.68)".
function shell() {
  return `
    <style>
      .atl{
        --atl-paper:var(--paper,#F2F2F2);
        --atl-ink:var(--ink,#313131);
        --atl-surface:var(--surface,#FFFFFF);
        --atl-teal-600:var(--teal-600,#139EB1);
        --atl-teal-700:var(--teal-700,#0D707D);
        --atl-amber-500:var(--amber-500,#EAA651);
        --atl-amber-ink:var(--amber-ink,#935616);
        --atl-mauve-ink:var(--mauve-600,#756168);
        --atl-line:var(--line-strong,rgba(104,52,15,.22));
        --atl-glass-bg:var(--glass-bg-text,hsl(187 44% 97% / .78));
        --atl-glass-solid:var(--glass-solid,#F4FAFB);
        --atl-glass-ink-muted:var(--glass-ink-muted,#5C4B51);
        --atl-glass-blur:var(--glass-blur-md,18px);
        --atl-shadow-2:var(--glass-shadow-2,0 2px 6px rgba(93,79,79,.14),0 12px 34px rgba(93,79,79,.22));
        --atl-rim-top:var(--glass-rim-top,rgba(255,255,255,.62));
        --atl-rim-bottom:var(--glass-rim-bottom,rgba(255,255,255,.26));
        --atl-rim-side:var(--glass-rim-side,rgba(255,255,255,.18));
        --atl-edge-dark:var(--glass-edge-dark,rgba(93,79,79,.12));
        --atl-r-sm:var(--r-sm,12px);
        --atl-r-md:var(--r-md,16px);
        --atl-r-lg:var(--r-lg,22px);
        --atl-r-pill:var(--r-pill,999px);
        /* Motion, bridged rather than invented. --spring is the house's own
           press-feedback curve — used elsewhere for small interactive
           controls (tab-bar icons, chips), never for panel-sized entrances
           ("a launch surface that boings is a toy" — css/styles.css's own
           words). Every option/chip/button here is exactly that class of
           small control, so it gets the same curve the rest of the app's
           buttons already use, not a new one. */
        --atl-dur:var(--dur,200ms);
        --atl-dur-2:var(--dur-2,380ms);
        --atl-smooth:var(--smooth,cubic-bezier(.25,1,.5,1));
        --atl-spring:var(--spring,cubic-bezier(.34,1.4,.5,1));
        color:var(--atl-ink);
        position:relative;
      }

      /* Explicit height, matching soba3d.js's .s3d-stage clamp — an
         absolutely-positioned stage needs a sized ancestor, not height:100%
         of #main's unconstrained flow. */
      .atl-root{position:relative;height:clamp(420px,84vh,760px);min-height:0}
      @media(min-width:720px){.atl-root{height:clamp(480px,80vh,820px)}}
      .atl-stage{position:absolute;inset:0;border-radius:var(--atl-r-lg);overflow:hidden;background:var(--atl-paper)}
      .atl-loading{
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        font-size:14px;font-weight:600;color:var(--atl-mauve-ink);background:var(--atl-paper);
        border-radius:var(--atl-r-lg);
      }

      /* THE ONE GLASS SURFACE. Recipe and contrast math copied from
         soba3d.js's .s3d-hud — see that file for the full derivation. Worst
         case (glass over a black floor) composites to #BEC3C4: --ink on it is
         7.30:1, --atl-glass-ink-muted is 4.57:1. Both pass AA at any size. */
      .atl-guide{
        position:absolute;left:12px;right:12px;bottom:64px;z-index:2;
        max-width:420px;
        padding:16px 18px;border-radius:var(--atl-r-lg);
        background:var(--atl-glass-bg);
        box-shadow:
          var(--atl-shadow-2),
          inset 0 1px 0 0 var(--atl-rim-top),
          inset 0 -1px 0 0 var(--atl-rim-bottom),
          inset 1px 0 0 0 var(--atl-rim-side),
          inset -1px 0 0 0 var(--atl-rim-side),
          inset 0 -12px 24px -18px var(--atl-edge-dark);
        -webkit-backdrop-filter:blur(18px) saturate(180%) brightness(1.06);
        backdrop-filter:blur(var(--atl-glass-blur)) saturate(180%) brightness(1.06);
        color:var(--atl-ink);
      }
      @media(min-width:720px){ .atl-guide{ left:24px; bottom:24px; } }

      .atl-progress{height:4px;border-radius:var(--atl-r-pill);background:rgba(104,52,15,.14);overflow:hidden;margin-bottom:10px}
      .atl-progress-fill{height:100%;background:var(--atl-teal-700);border-radius:inherit;width:0%}
      @media(prefers-reduced-motion:no-preference){.atl-progress-fill{transition:width .5s var(--smooth,ease)}}

      .atl-eyebrow{margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.08em;
        text-transform:uppercase;color:var(--atl-glass-ink-muted)}
      .atl-question{margin:0 0 4px;font-size:19px;font-weight:700;letter-spacing:-.01em;line-height:1.25}
      .atl-help{margin:0 0 12px;font-size:13.5px;line-height:1.4;color:var(--atl-glass-ink-muted)}
      .atl-stale{display:block;margin:0 0 10px;padding:8px 10px;border-radius:var(--atl-r-sm);
        background:var(--atl-surface);color:var(--atl-amber-ink);font-size:12.5px;font-weight:600}

      .atl-options{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
      .atl-empty{font-size:13px;color:var(--atl-glass-ink-muted);margin:0 0 14px}

      /* SOLID by design — see the header note above shell(). Each control's
         motion below is deliberately DIFFERENT, not one gesture reused five
         times — chosen from what the control means, not copy-pasted, while
         staying built from the same --atl-spring/--atl-smooth vocabulary so
         the set still reads as one system rather than five unrelated ideas.

         Option cards are things being WEIGHED against each other — the
         gesture is a lift, like picking a card up off a table to look at it,
         with a soft teal bloom that grows as you commit to it. */
      .atl-option{
        min-height:44px;padding:8px 14px;border:1px solid var(--atl-line);border-radius:var(--atl-r-pill);
        background:var(--atl-surface);color:var(--atl-ink);font:inherit;font-size:13.5px;font-weight:600;
        cursor:pointer;display:flex;align-items:center;gap:8px;
        box-shadow:0 0 0 0 rgba(13,112,125,0);
      }
      .atl-option:hover{border-color:var(--atl-amber-500);transform:translateY(-2px);
        box-shadow:0 6px 14px -8px rgba(13,112,125,.35)}
      .atl-option:active{transform:translateY(0) scale(.975)}
      .atl-option.is-selected{border-color:var(--atl-teal-700);background:var(--atl-teal-700);color:#FFFFFF}
      .atl-option:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:2px}
      .atl-option-product{padding-left:6px}
      .atl-swatch{width:22px;height:22px;border-radius:50%;flex:none;background:var(--atl-swatch,#ddd);
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
      .atl-option-meta{font-size:11.5px;font-weight:500;opacity:.82}

      .atl-summary-list{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-direction:column;gap:6px}
      .atl-summary-row{display:flex;justify-content:space-between;gap:12px;font-size:13.5px;
        font-variant-numeric:tabular-nums}
      .atl-summary-total{margin:0 0 4px;font-size:15px}
      .atl-summary-note{margin:0;font-size:12px;color:var(--atl-glass-ink-muted)}

      .atl-nav{display:flex;align-items:center;gap:10px}
      .atl-btn{
        min-height:44px;padding:8px 18px;border-radius:var(--atl-r-pill);border:1px solid transparent;
        font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
        background:var(--atl-surface);color:var(--atl-ink);box-shadow:0 1px 2px rgba(93,79,79,.18);
      }
      .atl-btn:disabled{opacity:.5;cursor:not-allowed}
      /* Back RECEDES — the quietest control on the panel, on purpose: a
         fade toward the edge of attention, no lift, no press-scale. Motion
         hierarchy communicates direction the way the copy already does. */
      .atl-btn:not(.atl-btn-primary):hover:not(:disabled){border-color:var(--atl-line);opacity:.72}
      /* Next / Zatraži ponudu PROPELS — a small forward nudge on hover (the
         journey's own direction of travel) and a warm bloom that deepens with
         teal rather than a generic shadow, echoing the glass rim-glow
         language already in css/styles.css. */
      .atl-btn.atl-btn-primary{margin-left:auto;background:var(--atl-teal-700);color:#FFFFFF;
        box-shadow:0 2px 6px -2px rgba(13,112,125,.4)}
      .atl-btn.atl-btn-primary:hover:not(:disabled){transform:translateX(3px);
        box-shadow:0 6px 16px -4px rgba(13,112,125,.55)}
      .atl-btn.atl-btn-primary:active:not(:disabled){transform:translateX(1px) scale(.97)}
      .atl-btn:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:2px}

      /* Chapter rail: SOLID chips, never glass — a second simultaneous blur
         surface would break the one-glass budget documented above. */
      .atl-chapters{
        position:absolute;left:12px;right:12px;top:12px;z-index:2;
        display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;
        padding:2px;
      }
      /* Chips are WAYPOINTS on a path, not cards to weigh — the motion is
         horizontal (a step along the rail), never the vertical lift the
         option cards use. */
      .atl-chip{
        flex:none;min-height:36px;padding:6px 12px;border-radius:var(--atl-r-pill);
        border:1px solid var(--atl-line);background:var(--atl-surface);color:var(--atl-ink);
        font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;
      }
      .atl-chip.is-done{border-color:var(--atl-teal-700)}
      .atl-chip.is-active{background:var(--atl-teal-700);color:#FFFFFF;border-color:var(--atl-teal-700)}
      .atl-chip:hover{transform:translateX(2px)}
      .atl-chip:active{transform:translateX(2px) scale(.94)}
      .atl-chip:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:2px}

      /* An amenity, not a step — SOLID, positioned opposite the guide card
         rather than inside its nav row, so it reads as belonging to the room
         rather than to the question sequence. */
      /* An atmosphere control, not a mechanism — no lift, no press-scale,
         just a soft amber glow that breathes in on hover and settles into a
         steady halo while active, the way a light dims up rather than a
         switch clicking. */
      .atl-panorama{
        position:absolute;right:12px;bottom:12px;z-index:2;
        min-height:40px;padding:8px 16px;border-radius:var(--atl-r-pill);
        border:1px solid var(--atl-line);background:var(--atl-surface);color:var(--atl-ink);
        font:inherit;font-size:13px;font-weight:600;letter-spacing:.02em;cursor:pointer;
        box-shadow:0 1px 2px rgba(93,79,79,.18),0 0 0 0 rgba(234,166,81,0);
      }
      @media(min-width:720px){ .atl-panorama{ right:24px; bottom:24px; } }
      .atl-panorama:hover{border-color:var(--atl-amber-500);
        box-shadow:0 1px 2px rgba(93,79,79,.18),0 0 18px 1px rgba(234,166,81,.30)}
      .atl-panorama[aria-pressed="true"]{border-color:var(--atl-teal-700);color:var(--atl-teal-700);
        box-shadow:0 1px 2px rgba(93,79,79,.18),0 0 20px 2px rgba(19,158,177,.28)}
      .atl-panorama:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:2px}
      @media (prefers-contrast:more){ .atl-panorama{border-color:var(--atl-ink)} }
      @media (forced-colors:active){
        .atl-panorama{background:ButtonFace;color:ButtonText;border:1px solid ButtonText}
        .atl-panorama[aria-pressed="true"]{background:Highlight;color:HighlightText}
      }

      /* ---- Degradation paths — the same five soba3d.js ships, landing on
         --atl-glass-solid. See that file for why each one is required. ---- */
      @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
        .atl-guide{background:var(--atl-glass-solid)}
      }
      @media (prefers-reduced-transparency:reduce){
        html:not([data-transparency="full"]) .atl-guide{
          background:var(--atl-glass-solid);-webkit-backdrop-filter:none;backdrop-filter:none;
        }
      }
      html[data-transparency="reduced"] .atl-guide{
        background:var(--atl-glass-solid);-webkit-backdrop-filter:none;backdrop-filter:none;
      }
      @media (prefers-contrast:more){
        .atl-guide{background:var(--atl-surface);border:1px solid var(--atl-ink);
          -webkit-backdrop-filter:none;backdrop-filter:none}
        .atl-option,.atl-chip,.atl-btn{border-color:var(--atl-ink)}
      }
      @media (forced-colors:active){
        .atl-guide{background:Canvas;border:1px solid CanvasText;
          -webkit-backdrop-filter:none;backdrop-filter:none;forced-color-adjust:none;color:CanvasText}
        .atl-option,.atl-chip,.atl-btn{background:ButtonFace;color:ButtonText;border:1px solid ButtonText}
        .atl-option.is-selected,.atl-chip.is-active,.atl-btn-primary{background:Highlight;color:HighlightText}
      }
      /* Transform on --atl-spring (the house's own small-control press curve),
         colour/shadow on --atl-smooth — the same split css/styles.css uses on
         every one of its own buttons (search --spring there). Distinct
         durations per control size: the chip is the smallest, quickest
         gesture; the primary CTA is held a touch longer so the forward nudge
         reads as deliberate rather than twitchy. */
      @media (prefers-reduced-motion:no-preference){
        .atl-option{transition:transform var(--atl-dur-2) var(--atl-spring),
          box-shadow var(--atl-dur-2) var(--atl-smooth),border-color var(--atl-dur) var(--atl-smooth),
          background-color var(--atl-dur) var(--atl-smooth),color var(--atl-dur) var(--atl-smooth)}
        .atl-btn{transition:transform var(--atl-dur-2) var(--atl-spring),
          box-shadow var(--atl-dur-2) var(--atl-smooth),border-color var(--atl-dur) var(--atl-smooth),
          opacity var(--atl-dur) var(--atl-smooth)}
        .atl-chip{transition:transform var(--atl-dur) var(--atl-spring),
          border-color var(--atl-dur) var(--atl-smooth),background-color var(--atl-dur) var(--atl-smooth),
          color var(--atl-dur) var(--atl-smooth)}
        .atl-panorama{transition:box-shadow var(--atl-dur-2) var(--atl-smooth),
          border-color var(--atl-dur) var(--atl-smooth),color var(--atl-dur) var(--atl-smooth)}
      }
      @media (prefers-reduced-motion:reduce){
        /* No transform anywhere — a hover lift or a forward nudge is still
           motion. Colour/shadow state changes remain instant, which reads as
           a clean state swap rather than as "the animation was removed". */
        .atl-option:hover,.atl-option:active,.atl-btn:hover,.atl-btn:active,
        .atl-chip:hover,.atl-chip:active{transform:none}
      }
      /* Never animate blur() — forces a full re-composite every frame. */
    </style>
    <div class="atl">
      <div class="atl-root">
        <div class="atl-stage" id="atl-stage" aria-label="${esc(tt("atelier.stage", "3D prikaz kupaonice"))}"></div>
        <div id="atl-loading" class="atl-loading" role="status" aria-live="polite">
          ${esc(tt("atelier.loading", "Priprema prostora…"))}
        </div>

        <nav class="atl-chapters" id="atl-chapters" aria-label="${esc(tt("atelier.chapters", "Koraci"))}"></nav>

        <button type="button" class="atl-panorama" id="atl-panorama" aria-pressed="false"
          aria-label="${esc(tt("atelier.panoramaLabel", "Panorama prostora"))}">
          ${esc(tt("atelier.panorama", "Panorama"))}
        </button>

        <div class="atl-guide" id="atl-guide" role="region"
             aria-label="${esc(tt("atelier.guideLabel", "Vodič kroz uređenje"))}">
          <div class="atl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="atl-progress-bar">
            <div class="atl-progress-fill" id="atl-progress-fill"></div>
          </div>
          <p class="atl-eyebrow" id="atl-eyebrow"></p>
          <h2 class="atl-question" id="atl-question"></h2>
          <p class="atl-help" id="atl-help"></p>
          <div class="atl-options" id="atl-options"></div>
          <div class="atl-summary" id="atl-summary" hidden></div>
          <div class="atl-nav">
            <button type="button" class="atl-btn" id="atl-back">${esc(tt("atelier.back", "Natrag"))}</button>
            <span class="atl-stale" id="atl-stale" hidden></span>
            <button type="button" class="atl-btn atl-btn-primary" id="atl-next">${esc(tt("atelier.next", "Dalje"))}</button>
          </div>
        </div>
      </div>
    </div>`;
}

function optionCard(chapter, opt, selected) {
  return `
    <button type="button" class="atl-option${selected ? " is-selected" : ""}"
      data-option="${esc(opt.id)}" aria-pressed="${selected ? "true" : "false"}">
      <span class="atl-option-label">${esc(opt.label)}</span>
    </button>`;
}

function productCard(p, selected) {
  const priceLabel = p.priceM2 != null ? `${formatEur(p.priceM2)} / m²` : "";
  return `
    <button type="button" class="atl-option atl-option-product${selected ? " is-selected" : ""}"
      data-product="${esc(p.id)}" aria-pressed="${selected ? "true" : "false"}"
      style="--atl-swatch:${esc(p.baseColorHex || "#ddd")}">
      <span class="atl-swatch"></span>
      <span class="atl-option-label">${esc(p.name)}</span>
      <span class="atl-option-meta">${esc(priceLabel)}</span>
    </button>`;
}

// ---- render one chapter's beat ---------------------------------------------
function renderChapter() {
  const cur = journey.current();
  const c = cur.chapter;
  const prog = journey.progress();

  container.querySelector("#atl-progress-fill").style.width = `${Math.round(prog.fraction * 100)}%`;
  container.querySelector("#atl-progress-bar").setAttribute("aria-valuenow", String(Math.round(prog.fraction * 100)));
  container.querySelector("#atl-eyebrow").textContent = `${cur.index + 1} / ${journey.chapters.length} — ${c.title}`;
  container.querySelector("#atl-question").textContent = c.question;
  container.querySelector("#atl-help").textContent = c.help || "";

  const staleEl = container.querySelector("#atl-stale");
  if (cur.stale) {
    staleEl.hidden = false;
    // Not an instruction — this system never destroys a decision, only
    // outdates it, so the copy states a fact rather than issuing one.
    staleEl.textContent = tt("atelier.stale", "Odabir se temeljio na prethodnom smjeru.");
  } else {
    staleEl.hidden = true;
  }

  const optionsEl = container.querySelector("#atl-options");
  const summaryEl = container.querySelector("#atl-summary");

  if (c.kind === "direction") {
    summaryEl.hidden = true;
    optionsEl.hidden = false;
    optionsEl.innerHTML = c.options
      .map((o) => optionCard(c, o, cur.decision?.optionId === o.id))
      .join("");
  } else if (c.kind === "surface" || c.kind === "fixtures") {
    summaryEl.hidden = true;
    optionsEl.hidden = false;
    const list = products.filter((p) => p.category === c.category);
    optionsEl.innerHTML = list.length
      ? list.slice(0, 8).map((p) => productCard(p, cur.decision?.productId === p.id)).join("")
      : `<p class="atl-empty">${esc(tt("atelier.noProducts", "Nema proizvoda u ovoj kategoriji."))}</p>`;
  } else if (c.kind === "summary") {
    optionsEl.hidden = true;
    summaryEl.hidden = false;
    summaryEl.innerHTML = renderSummary();
  }

  container.querySelector("#atl-back").disabled = cur.isFirst;
  const nextBtn = container.querySelector("#atl-next");
  nextBtn.disabled = c.kind !== "summary" && !cur.canAdvance;
  nextBtn.textContent = c.kind === "summary"
    ? tt("atelier.request", "Zatraži ponudu")
    : (c.required ? tt("atelier.next", "Dalje") : tt("atelier.skip", "Preskoči"));

  renderChapterNav(cur.index);
  // A chapter change always wins over the ambient showcase — director3d's
  // goto() (which directCamera reaches) already supersedes the tour at the
  // engine level; this just keeps the button's own pressed state honest.
  if (panoramaOn) setPanorama(false, { returnToChapter: false });
  directCamera(c);
  autosave();
}

function renderChapterNav(activeIndex) {
  const nav = container.querySelector("#atl-chapters");
  nav.innerHTML = journey.chapters.map((c, i) => {
    const answered = journey.isAnswered(c.id);
    const cls = ["atl-chip"];
    if (i === activeIndex) cls.push("is-active");
    if (answered) cls.push("is-done");
    return `<button type="button" class="${cls.join(" ")}" data-goto="${esc(c.id)}"
      aria-current="${i === activeIndex ? "step" : "false"}">${esc(c.title)}</button>`;
  }).join("");
}

function renderSummary() {
  const rows = journey.chapters
    .filter((c) => c.kind === "surface" && journey.isAnswered(c.id))
    .map((c) => {
      const d = journey.current().chapter.id === c.id ? journey.current().decision : null;
      const decision = d || Object.values(journey.assignments())[0];
      return c;
    });
  const assigns = journey.assignments();
  let total = 0;
  const lines = Object.entries(assigns).map(([surface, a]) => {
    const p = products.find((x) => x.id === a.productId);
    if (!p) return "";
    const areaM2 = surface === "floor" ? journey.room.widthM * journey.room.depthM
      : journey.room.widthM * journey.room.heightM;
    const est = orderEstimate(p, areaM2, "grid");
    total += est.total || 0;
    return `<li class="atl-summary-row"><span>${esc(p.name)}</span><span>${esc(formatEur(est.total || 0))}</span></li>`;
  }).filter(Boolean);
  return `
    <ul class="atl-summary-list">${lines.join("")}</ul>
    <p class="atl-summary-total">${esc(tt("atelier.estTotal", "Okvirna procjena"))}: <strong>${esc(formatEur(total))}</strong></p>
    <p class="atl-summary-note">${esc(tt("atelier.estNote", "Točnu ponudu izrađuje Akvaterm."))}</p>`;
}

// ---- interaction ------------------------------------------------------------
function applyDirectionDecision(optionId) {
  const chapter = journey.current().chapter;
  const opt = chapter.options.find((o) => o.id === optionId);
  if (!opt) return;
  journey.decide(chapter.id, { optionId });
  renderChapter();
}

function applyProductDecision(productId) {
  const chapter = journey.current().chapter;
  const p = products.find((x) => x.id === productId);
  if (!p) return;
  journey.decide(chapter.id, { productId });
  if (chapter.kind === "surface" && chapter.surface && api) {
    api.setSurface(chapter.surface, p, {});
  }
  renderChapter();
}

/** The ambient showcase's on/off — an amenity the customer opts into, never
 *  something the guide switches on its own. Turning it off eases back to
 *  whatever chapter is currently active, using the SAME directCamera() call
 *  a normal chapter transition uses — the return travels on the identical
 *  spring-eased verb as everything else, never a snap. */
function setPanorama(on, { returnToChapter = true } = {}) {
  panoramaOn = on;
  container.querySelector("#atl-panorama")?.setAttribute("aria-pressed", String(on));
  if (!api?.camera) return;
  if (on) {
    api.camera.playTour();
  } else {
    api.camera.stopTour();
    if (returnToChapter) directCamera(journey.current().chapter);
  }
}

function wire() {
  container.querySelector("#atl-panorama").addEventListener("click", () => {
    setPanorama(!panoramaOn);
  });

  container.querySelector("#atl-options").addEventListener("click", (e) => {
    const optBtn = e.target.closest("[data-option]");
    if (optBtn) { applyDirectionDecision(optBtn.dataset.option); return; }
    const prodBtn = e.target.closest("[data-product]");
    if (prodBtn) applyProductDecision(prodBtn.dataset.product);
  });

  container.querySelector("#atl-next").addEventListener("click", () => {
    const cur = journey.current();
    if (cur.chapter.kind === "summary") { requestQuote(); return; }
    const r = journey.next();
    if (r.ok) renderChapter();
  });

  container.querySelector("#atl-back").addEventListener("click", () => {
    journey.back();
    renderChapter();
  });

  container.querySelector("#atl-chapters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto]");
    if (!btn) return;
    // No confirmation gate — deliberately. A native confirm() dialog is raw
    // OS chrome inside a glass interface, and worse, it MISREPRESENTS what is
    // about to happen: nothing here is ever destroyed, only marked out of
    // date (see journey.js's revision contract). A gate implying an
    // irreversible action ahead would be dishonest. The chapter jumps
    // immediately; affectedBy()'s report surfaces in-place as the stale
    // banner on whichever chapter it actually touches, once the customer is
    // looking at it — a fact stated where it is true, not a warning issued
    // in advance of a harm that never occurs.
    journey.revise(btn.dataset.goto);
    renderChapter();
  });
}

function requestQuote() {
  const assigns = journey.assignments();
  const lines = Object.entries(assigns).map(([surface, a]) => {
    const p = products.find((x) => x.id === a.productId);
    return p ? `${surface}: ${p.name}` : "";
  }).filter(Boolean).join("%0D%0A");
  const subject = encodeURIComponent(tt("atelier.mailSubject", "Upit za kupaonicu — Akvaterm"));
  const body = encodeURIComponent(tt("atelier.mailBody", "Odabrano:\n") + "\n") + lines;
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// ---- lifecycle --------------------------------------------------------------
export async function render(el) {
  teardown();
  const token = ++mountToken;
  container = el;

  journey = createJourney(BATHROOM_V0);
  const saved = loadAutosave();
  if (saved?.journeyState) journey.restore(saved.journeyState);
  if (saved?.room) journey.setRoom(saved.room);

  const all = await db.listProducts();
  if (!alive(token)) return;
  products = all;

  container.innerHTML = shell();
  wire();

  const mod = await import("../room3d.js");
  if (!alive(token)) return;

  const initialAssignments = {};
  for (const [surface, a] of Object.entries(journey.assignments())) {
    const p = products.find((x) => x.id === a.productId);
    if (p) initialAssignments[surface] = { productId: p.id };
  }

  const handle = await mod.mountRoom(container.querySelector("#atl-stage"), {
    room: journey.room,
    assignments: initialAssignments,
    products,
    onReady: () => container.querySelector("#atl-loading")?.remove(),
    // The room's native resting state: free look is real, but once the
    // customer lets go and a short pause passes, the camera eases back to
    // whatever the guide is CURRENTLY asking about — re-reading journey.current()
    // at fire time, not the chapter that was active when they grabbed the
    // camera, so clicking "Dalje" while still looking around is honoured.
    // directCamera() is the same function the chapter transition itself uses,
    // so the return travels on the identical spring-eased verb as the
    // original move — never a snap back to a canned pose.
    onIdleReturn: () => {
      // A grab always wins over the showcase (room3d's own grab handler has
      // already interrupted it engine-side); this just keeps the button's
      // pressed state honest once the room actually settles back on a step.
      if (panoramaOn) { panoramaOn = false; container.querySelector("#atl-panorama")?.setAttribute("aria-pressed", "false"); }
      directCamera(journey?.current()?.chapter);
    },
  });
  if (!alive(token)) { handle.dispose(); return; }
  api = handle;

  // prefers-reduced-motion: short dissolves, no ceremonial orbit, no
  // continuous drift — mirrored into BOTH the director and the engine's own
  // glass blend, exactly as director3d/room3d document.
  reducedMotionMQ = matchMedia("(prefers-reduced-motion: reduce)");
  const applyReducedMotion = () => api?.camera?.setReducedMotion(reducedMotionMQ.matches);
  applyReducedMotion();
  reducedMotionMQ.addEventListener?.("change", applyReducedMotion);

  renderChapter();
}

export function teardown() {
  mountToken++;
  reducedMotionMQ?.removeEventListener?.("change", () => {});
  reducedMotionMQ = null;
  if (api) { api.camera?.stop(); api.dispose(); api = null; }
  journey = null;
  container = null;
  panoramaOn = false;
}
