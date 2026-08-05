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
import { formatEur, GROUT_COLORS } from "../domain.js";
import {
  ATELIER_GROUT_WIDTHS_MM,
  buildCommission, buildFixturePlan, decisionProductIds,
  productsForChapter, rankProductsForDirection, toggleProductChoice,
  surfaceFinishForDecision,
} from "../commissioning.js";
import { createCompletionRewardRegistry } from "../completion-reward.js";
import { mountJourneyOpening } from "../journey-opening.js";
import { createAssetStrip } from "../asset-strip.js";

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
let reducedMotionHandler = null;
let panoramaOn = false;   // the ambient showcase's own on/off, tracked here because the engine has no notion of "chapters" to return to
let roomFixtures = [];    // product-bound placements; persisted independently of journey decisions
let fixtureEventStage = null;
let lastChapterId = null;
let lastChapterIndex = -1;
let preferredFixtureProductId = null;
let opening = null;
// "product" shows the tile/fixture strip; "grout" shows the width stepper —
// never both, so a surface chapter still asks exactly one question at a
// time even though it covers two decisions (operator instruction,
// 2026-08-05: "this question only asks you for the tiles... that's on a
// completely another question").
let materialSubStep = "product";
let strip = null;             // asset-strip.js controller for the current #atl-options
let groutHoldTimer = null;
let groutHoldInterval = null;

const QUOTE_EMAIL = "info@akvaterm.hr";
const completionRewards = createCompletionRewardRegistry();

const groutLabel = (id) => {
  const color = GROUT_COLORS.find((item) => item.id === id);
  return color ? tt(color.i18nKey, color.id) : id;
};

const liveSurfaceOptions = (decision) => ({
  ...surfaceFinishForDecision(decision),
  liveGrout: true,
});

function alive(token) { return token === mountToken && container && container.isConnected; }

function clearJourneyChrome() {
  document.documentElement.removeAttribute("data-akv-journey");
}
if (typeof window !== "undefined") window.addEventListener("akv:teardown", clearJourneyChrome);

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
      fixtures: roomFixtures,
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
function directCamera(chapter, { subStep = materialSubStep } = {}) {
  if (!api?.camera || !chapter) return;
  const fixtureTarget = chapter.kind === "fixtures"
    ? (roomFixtures.find((fixture) => fixture.chapterId === chapter.id
        && fixture.productId === preferredFixtureProductId)
      || roomFixtures.find((fixture) => fixture.chapterId === chapter.id))?.type
    : null;
  const target = fixtureTarget || chapter.target || chapter.surface;
  // The grout sub-step gets its own camera verb — followGroutLine() already
  // existed in director3d.js (tracks close along the actual grout line) but
  // was never called from here; the stepper UI is the only piece that was
  // actually missing.
  if (chapter.kind === "surface" && subStep === "grout" && journey.current().decision?.productId) {
    api.camera.followGroutLine(target);
    return;
  }
  switch (chapter.intent) {
    case "returnToOverview": api.camera.returnToOverview(); break;
    case "focusSurface": api.camera.focusSurface(target); break;
    case "inspectMaterial": api.camera.inspectMaterial(target); break;
    case "orbitSelection": api.camera.orbitSelection(target); break;
    case "revealRoom": api.camera.revealRoom(); break;
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
function shell({ lightMix = 0 } = {}) {
  const preludeLight = Math.max(0, Math.min(1, Number(lightMix) || 0));
  return `
    <style>
      .atl{
        /* Dark by default in every orientation now, not just landscape
           (operator instruction, 2026-08-05: "have the background of the
           designer viewer not White") — this is the same dark palette
           landscape mode already proved out, just no longer gated behind an
           orientation media query. */
        --atl-paper:#020403;
        --atl-ink:#F1F5F1;
        --atl-surface:rgba(8,12,10,.78);
        --atl-teal-300:var(--teal-300,#86DCE6);
        --atl-teal-600:var(--teal-600,#139EB1);
        --atl-teal-700:var(--teal-700,#0D707D);
        --atl-amber-500:var(--amber-500,#EAA651);
        --atl-amber-ink:var(--amber-ink,#935616);
        --atl-brown-800:var(--brown-800,#68340F);
        --atl-mauve-ink:var(--mauve-600,#756168);
        --atl-line:rgba(224,241,230,.15);
        --atl-glass-bg:var(--glass-bg-text,hsl(187 44% 97% / .78));
        --atl-glass-solid:#151A17;
        --atl-glass-ink-muted:rgba(232,240,234,.62);
        --atl-glass-blur:var(--glass-blur-md,18px);
        --atl-shadow-2:0 34px 90px -28px rgba(0,0,0,.82);
        --atl-rim-top:var(--glass-rim-top,rgba(255,255,255,.62));
        --atl-rim-bottom:var(--glass-rim-bottom,rgba(255,255,255,.26));
        --atl-rim-side:var(--glass-rim-side,rgba(255,255,255,.18));
        --atl-edge-dark:var(--glass-edge-dark,rgba(93,79,79,.12));
        /* The bottom cluster's OWN, lighter recipe — genuinely see-through
           (operator instruction, 2026-08-05: "they must be see-through...
           transparent backgrounds"), distinct from --atl-glass-bg's heavier
           78%-alpha fill, which stays reserved for the one deliberate
           exception (.atl-guide.is-summary's document-style card). */
        --atl-float-bg:rgba(18,22,20,.30);
        --atl-float-border:rgba(255,255,255,.16);
        --atl-float-blur:16px;
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
      .atl [hidden]{display:none!important}
      .atl-menu{position:fixed;z-index:8;left:max(18px,env(safe-area-inset-left,0px));top:max(18px,env(safe-area-inset-top,0px));display:grid;place-content:center;gap:5px;width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer}
      .atl-menu span{display:block;width:23px;height:2px;border-radius:999px;background:rgba(240,255,247,.70);box-shadow:0 1px rgba(255,255,255,.34),0 0 8px rgba(159,220,183,.16)}
      .atl-menu:focus-visible{outline:2px solid rgba(218,242,224,.88);outline-offset:3px;border-radius:12px}

      /* Explicit height, matching soba3d.js's .s3d-stage clamp — an
         absolutely-positioned stage needs a sized ancestor, not height:100%
         of #main's unconstrained flow. */
      /* Its own dark background too, not just .atl-stage's — operator report,
         2026-08-05 (tablet): a ~0.7cm black stripe appeared the moment the
         stage went dark, almost certainly a pre-existing sub-pixel gap below
         .atl-root (height is a vh clamp, never guaranteed to reach exactly
         100%) that used to blend invisibly against a light stage and now
         shows as a stark seam against a light outer app shell. */
      .atl-root{position:relative;height:clamp(420px,84vh,760px);min-height:0;background:var(--atl-paper)}
      @media(min-width:720px){.atl-root{height:clamp(480px,80vh,820px)}}
      .atl-stage{position:absolute;inset:0;border-radius:var(--atl-r-lg);overflow:hidden;background:var(--atl-paper)}
      .atl-prelude{position:absolute;inset:0;z-index:1;overflow:hidden;border-radius:var(--atl-r-lg);pointer-events:none;background:#020403;opacity:1}
      .atl-prelude img{position:absolute;inset:-24px;width:calc(100% + 48px);height:calc(100% + 48px);object-fit:cover;object-position:center 58%;filter:blur(16px) saturate(1.10) brightness(1.03);transform:scale(1.035)}
      .atl-prelude-dark{opacity:calc(1 - var(--atl-prelude-light,0))}
      .atl-prelude-light{opacity:var(--atl-prelude-light,0)}
      .atl-prelude::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(1,3,2,.08),rgba(1,3,2,.28) 64%,rgba(1,3,2,.62))}
      .atl-prelude.is-resolved{opacity:0;transition:opacity .72s cubic-bezier(.25,1,.5,1)}
      .atl-static-room{position:absolute;inset:0;overflow:hidden;background:#020403}
      .atl-static-room img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 58%}
      .atl-static-room-dark{opacity:calc(1 - var(--atl-static-light,0))}
      .atl-static-room-light{opacity:var(--atl-static-light,0)}
      .atl-static-room::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(1,3,2,.06),transparent 48%,rgba(1,3,2,.42) 78%,rgba(1,3,2,.68))}
      .atl[data-room="static"] .atl-panorama{display:none}
      .atl-stage::after{
        content:"";position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;
        background:radial-gradient(circle at 72% 30%,rgba(19,158,177,.11),transparent 48%);
      }
      .atl[data-mood="mirno"] .atl-stage::after{opacity:1;
        background:radial-gradient(circle at 68% 26%,rgba(192,216,242,.18),transparent 52%)}
      .atl[data-mood="toplo"] .atl-stage::after{opacity:1;
        background:radial-gradient(circle at 72% 30%,rgba(234,166,81,.14),transparent 52%)}
      .atl[data-mood="izrazito"] .atl-stage::after{opacity:1;
        background:radial-gradient(circle at 72% 30%,rgba(104,52,15,.13),transparent 54%)}
      .atl[data-chapter="ponuda"] .atl-stage::after{opacity:1;
        background:radial-gradient(circle at 72% 34%,rgba(234,166,81,.13),transparent 42%),
          radial-gradient(circle at 48% 46%,rgba(19,158,177,.10),transparent 60%)}
      .atl-loading{
        position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;
        font-size:14px;font-weight:600;color:var(--atl-mauve-ink);background:var(--atl-paper);
        border-radius:var(--atl-r-lg);
      }

      /* FLOATING GLASS, not one card (operator instruction, 2026-08-05, after
         the earlier same-day .atl-guide size fix still wasn't enough — see
         IMG_6516: "the right panel, the card, that can be completely
         removed... I can't see shit because of that panel"). .atl-guide is
         now a layout-only wrapper with no background of its own; every piece
         inside it (the question label, each option bubble, the material
         controls) carries the SAME proven glass recipe individually, at a
         much smaller footprint, so the room shows through everywhere else.
         This is still "one glass RECIPE, never a second divergent one" (the
         rule this file used to phrase as "one glass surface" — see
         soba3d.js's own history of exactly that defect) — just applied to N
         small surfaces instead of one big one. Contrast math is unchanged:
         worst case (glass over a black floor) composites to #BEC3C4; --ink
         on it is 7.30:1, --atl-glass-ink-muted is 4.57:1, both pass AA. */
      .atl-guide{
        position:absolute;left:12px;right:12px;bottom:64px;z-index:2;
        max-width:420px;max-height:min(60dvh,460px);
        display:flex;flex-direction:column;gap:10px;
        overflow:visible;pointer-events:none;
      }
      .atl-guide > *{pointer-events:auto}
      @media(min-width:720px){ .atl-guide{ left:24px; right:max(24px,env(safe-area-inset-right,0px)); bottom:24px; } }
      .atl-guide[data-flow="forward"]{--atl-beat-x:10px}
      .atl-guide[data-flow="back"]{--atl-beat-x:-10px}

      /* The one deliberate exception: the final offer is a document to
         review, not a lens floating over a room the customer is done
         comparing materials in, so it keeps a real card. */
      .atl-guide.is-summary{
        max-width:min(540px,92vw);max-height:min(70dvh,560px);
        overflow:auto;overscroll-behavior:contain;padding:20px 22px;border-radius:var(--atl-r-lg);
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

      /* The question label — its own small glass pill, not the whole card. */
      .atl-question-group{
        display:block;max-width:100%;padding:8px 14px;border-radius:16px;
        border:1px solid var(--atl-float-border);
        background:var(--atl-float-bg);
        -webkit-backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        color:var(--atl-ink);
      }
      /* Not shown here any more — the chip rail's is-done/is-active states
         already communicate progress, and this bottom cluster is fighting
         for every millimetre of its ~2.5cm budget (operator instruction,
         2026-08-05). The element (and renderChapter()'s width write) stay in
         the DOM so nothing else has to change; it just never paints. */
      .atl-progress{display:none}
      .atl-progress-fill{height:100%;background:var(--atl-teal-700);border-radius:inherit;width:0%}

      .atl-eyebrow{margin:0 0 2px;font-size:10.5px;font-weight:600;letter-spacing:.07em;
        text-transform:uppercase;color:var(--atl-glass-ink-muted)}
      /* Typography pass (operator instruction, 2026-08-05: "the text...
         doesn't look good") — borrowed structurally from login-photo-style.js's
         .pr-title/.pr-sub (var(--font-display), tighter weight/tracking), not
         its gold; atelier keeps its own established teal/amber accent tokens. */
      .atl-question{margin:0 0 2px;font-family:var(--font-display);font-size:clamp(18px,4.2vw,21px);
        font-weight:560;letter-spacing:-.02em;line-height:1.15}
      /* Clamped to one line — the same ~2.5cm bottom-cluster budget above.
         The full help text is still in the DOM for a screen reader; sighted
         users get the question itself (the load-bearing content) and the
         short version of the hint. */
      .atl-help{margin:0;font-size:12.5px;line-height:1.35;color:var(--atl-glass-ink-muted);
        display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
      .atl-stale{display:block;margin:8px 0 0;padding:8px 10px;border-radius:var(--atl-r-sm);
        background:var(--atl-surface);color:var(--atl-amber-ink);font-size:12.5px;font-weight:600}

      /* The floating asset strip: .atl-strip is the clipping viewport,
         .atl-strip-track (== #atl-options) is the row asset-strip.js drives
         via transform:translateX(). No max-height/overflow:auto here anymore
         — that vertical-scroll budget existed only because the OLD flat
         wrap-list could grow past its box; a single-row horizontal strip
         can't, so the guide is shorter and the room behind it stays clearer. */
      .atl-strip{overflow:hidden;touch-action:pan-y;margin:0 -4px;padding:4px}
      .atl-strip-track{display:flex;flex-wrap:nowrap;gap:8px;will-change:transform;cursor:grab}
      .atl-strip-track:active{cursor:grabbing}
      .atl-strip-track.is-static{flex-wrap:wrap;transform:none!important;cursor:default;
        max-height:min(168px,22dvh);overflow:auto;overscroll-behavior:contain}
      .atl-empty{font-size:13px;color:var(--atl-glass-ink-muted);margin:0}

      /* Persistent "currently chosen" readout — the strip itself can drift
         the selected bubble off-screen, so the pick still needs to be
         visible without scrolling back to find it. */
      .atl-strip-current{display:none;align-items:center;gap:8px;padding:6px 12px;border-radius:var(--atl-r-pill);
        border:1px solid var(--atl-float-border);
        background:var(--atl-float-bg);
        -webkit-backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        color:var(--atl-ink);font-size:12.5px}
      .atl-strip-current.is-shown{display:inline-flex}
      .atl-strip-current strong{font-weight:700}
      .atl-strip-current span{color:var(--atl-glass-ink-muted);font-weight:500}

      /* A material seam, not another chapter — the grout sub-step replaces
         the tile strip in place (materialSubStep gating in renderChapter()),
         so only one of the two is ever visible: still one question at a time.
         Its own small glass pill now, since nothing wraps it anymore. */
      .atl-material{display:grid;gap:8px;padding:10px 14px;border-radius:16px;
        border:1px solid var(--atl-float-border);
        background:var(--atl-float-bg);
        -webkit-backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        color:var(--atl-ink)}
      .atl-material-head{display:grid;gap:2px}
      .atl-material-title{margin:0;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
        color:var(--atl-glass-ink-muted)}
      .atl-material-hint{margin:0;font-size:12px;line-height:1.35;color:var(--atl-glass-ink-muted)}
      .atl-material-back{align-self:start;min-height:32px;padding:4px 10px;border:0;background:transparent;
        color:var(--atl-glass-ink-muted);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;
        text-decoration:underline;text-underline-offset:2px}
      .atl-grout-row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
      .atl-grout-label{min-width:70px;font-size:11.5px;font-weight:600;color:var(--atl-glass-ink-muted)}
      .atl-grout-color{min-width:44px;min-height:44px;width:44px;padding:0;border:1px solid var(--atl-line);
        border-radius:50%;background:var(--atl-grout-color,#ddd);color:var(--atl-ink);font:inherit;cursor:pointer;
        box-shadow:inset 0 0 0 3px var(--atl-surface)}
      .atl-grout-color[aria-pressed="true"]{border-color:var(--atl-teal-700);
        box-shadow:inset 0 0 0 3px var(--atl-surface),0 0 0 2px var(--atl-teal-700)}
      .atl-grout-color:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:3px}

      /* The continuous-value stepper (grout width today; the general pattern
         for any future continuous property): step buttons flank a live
         readout instead of N flat "pick one" buttons, and the camera is
         already tracking the actual grout line the instant this mounts (see
         directCamera()'s materialSubStep==="grout" branch, which calls the
         previously-unused director3d.js followGroutLine()). */
      .atl-grout-stepper{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .atl-grout-step{min-width:44px;min-height:44px;padding:0;border:1px solid var(--atl-line);
        border-radius:50%;background:var(--atl-surface);color:var(--atl-ink);
        font:inherit;font-size:20px;font-weight:700;line-height:1;cursor:pointer}
      .atl-grout-step:disabled{opacity:.4;cursor:not-allowed}
      .atl-grout-step:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:3px}
      .atl-grout-readout{flex:1;text-align:center;font-size:13px;color:var(--atl-glass-ink-muted)}
      .atl-grout-readout strong{color:var(--atl-ink);font-size:15px;font-weight:700;
        font-variant-numeric:tabular-nums}

      /* Each bubble is its own small glass surface (same recipe as the
         question label above — see the note at .atl-guide) — translucent
         while available, going solid teal the instant it's chosen, so
         selection stays legible even while the strip keeps drifting.
         Motion is a lift, like picking a card up off a table to look at it,
         built from the same --atl-spring/--atl-smooth vocabulary the rest of
         this file's controls use. flex:none so drift/drag math in
         asset-strip.js has a stable card width to measure. */
      .atl-bubble{
        flex:none;min-height:44px;padding:8px 14px;border:1px solid var(--atl-float-border);border-radius:18px;
        background:var(--atl-float-bg);color:var(--atl-ink);font:inherit;font-size:13.5px;font-weight:600;
        cursor:pointer;display:flex;align-items:center;gap:8px;user-select:none;
        -webkit-backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
      }
      /* A faint refraction of the product's own colour through the glass
         (operator instruction, 2026-08-05) — layered ABOVE the plain
         --atl-float-bg fallback declared just above, so a browser that
         can't parse color-mix() keeps the plain glass instead of losing its
         background entirely. --atl-swatch is unset (falls through to
         "transparent") on direction bubbles, which have no product colour. */
      .atl-bubble[style*="--atl-swatch"]{
        background:
          linear-gradient(135deg,color-mix(in srgb,var(--atl-swatch,transparent) 26%,transparent),transparent 68%),
          var(--atl-float-bg);
      }
      .atl-bubble:active{transform:translateY(0) scale(.975)}
      .atl-bubble.is-selected{border-color:var(--atl-teal-700);background:var(--atl-teal-700);color:#FFFFFF;
        -webkit-backdrop-filter:none;backdrop-filter:none}
      .atl-bubble:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:2px}
      .atl-bubble-product{padding-left:6px}
      .atl-swatch{width:22px;height:22px;border-radius:50%;flex:none;background:var(--atl-swatch,#ddd);
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
      .atl-bubble-meta{font-size:11.5px;font-weight:500;opacity:.82;white-space:nowrap}
      .atl-bubble-mark{display:none;width:18px;height:18px;border-radius:50%;margin-left:auto;
        align-items:center;justify-content:center;background:rgba(255,255,255,.18);font-size:11px}
      .atl-bubble.is-selected .atl-bubble-mark{display:inline-flex}

      .atl-payoff{display:grid;gap:12px}
      .atl-guide.is-summary .atl-payoff{padding-bottom:56px}
      .atl-payoff-head{position:relative;isolation:isolate;display:grid;padding:14px 16px;border-radius:var(--atl-r-md);
        background:linear-gradient(135deg,var(--atl-teal-700) 0%,var(--atl-teal-700) 72%,var(--atl-brown-800) 145%);color:#fff;
        box-shadow:0 14px 30px -20px rgba(13,112,125,.7)}
      .atl-payoff-head::before{content:"";position:absolute;inset:0;z-index:3;border:2px solid rgba(255,255,255,.86);
        border-radius:inherit;box-shadow:0 0 0 1px rgba(234,166,81,.52),inset 0 0 22px rgba(134,220,230,.2);
        opacity:0;pointer-events:none}
      .atl-payoff-kicker{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;opacity:.78}
      .atl-payoff-head>strong{font-family:var(--font-display);font-size:clamp(28px,7vw,40px);
        position:relative;width:max-content;max-width:100%;line-height:1.05;letter-spacing:-.035em;margin:4px 0}
      .atl-payoff-head>strong::after{content:attr(data-total);position:absolute;inset:0;color:transparent;
        background:linear-gradient(90deg,#fff 0%,#ffe0a0 48%,#fff 100%);background-clip:text;
        -webkit-background-clip:text;clip-path:inset(0 100% 0 0);opacity:0;pointer-events:none}
      .atl-payoff-head>small{font-size:11.5px;opacity:.8}
      .atl-completion-bloom{position:absolute;inset:0;z-index:2;overflow:hidden;border-radius:inherit;
        pointer-events:none}
      .atl-completion-bloom i{--atl-bloom-x:0px;--atl-bloom-y:-50px;position:absolute;left:50%;top:48%;
        width:5px;height:5px;border-radius:50%;background:var(--atl-amber-500);opacity:0}
      .atl-completion-bloom i:nth-child(2n){border-radius:1px;background:#fff}
      .atl-completion-bloom i:nth-child(3n){background:var(--atl-teal-300)}
      .atl-completion-bloom i:nth-child(1){--atl-bloom-x:-145px;--atl-bloom-y:-46px}
      .atl-completion-bloom i:nth-child(2){--atl-bloom-x:-104px;--atl-bloom-y:58px}
      .atl-completion-bloom i:nth-child(3){--atl-bloom-x:-64px;--atl-bloom-y:-70px}
      .atl-completion-bloom i:nth-child(4){--atl-bloom-x:-22px;--atl-bloom-y:72px}
      .atl-completion-bloom i:nth-child(5){--atl-bloom-x:35px;--atl-bloom-y:-74px}
      .atl-completion-bloom i:nth-child(6){--atl-bloom-x:78px;--atl-bloom-y:64px}
      .atl-completion-bloom i:nth-child(7){--atl-bloom-x:118px;--atl-bloom-y:-56px}
      .atl-completion-bloom i:nth-child(8){--atl-bloom-x:150px;--atl-bloom-y:36px}
      .atl-project-meta{display:flex;flex-wrap:wrap;gap:6px}
      .atl-project-meta span{padding:5px 9px;border:1px solid var(--atl-line);border-radius:var(--atl-r-pill);
        background:var(--atl-surface);font-size:11.5px;font-weight:600}
      .atl-summary h3{margin:2px 0 0;font-size:11px;letter-spacing:.09em;text-transform:uppercase;
        color:var(--atl-glass-ink-muted)}
      .atl-summary-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
      .atl-summary-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
        padding:7px 0;border-bottom:1px solid var(--atl-line);font-size:13px;font-variant-numeric:tabular-nums}
      .atl-summary-row>span:first-child{display:grid;gap:2px;min-width:0}
      .atl-summary-row small{font-size:11.5px;color:var(--atl-glass-ink-muted);font-weight:500}
      .atl-summary-row>span:last-child{white-space:nowrap;font-weight:700}
      .atl-summary-row.is-stale{color:var(--atl-amber-ink)}
      .atl-ready,.atl-summary-warning{margin:0;padding:9px 11px;border-radius:var(--atl-r-sm);
        background:var(--atl-surface);font-size:12px;font-weight:700}
      .atl-ready{color:var(--atl-teal-700);box-shadow:inset 3px 0 0 var(--atl-teal-700)}
      .atl-summary-warning{color:var(--atl-amber-ink);box-shadow:inset 3px 0 0 var(--atl-amber-500)}
      .atl-summary-note{margin:0;font-size:11.5px;line-height:1.4;color:var(--atl-glass-ink-muted)}

      /* Back/Next float on their own now, clear of the bottom text+bubble
         band entirely (operator instruction, 2026-08-05: "above them...
         is the Terma text window and that's it" — reaching at most ~2.5cm
         from the bottom of the screen). A vertical pair on the right edge,
         mid-height, stays clear of the chip rail above and the bottom
         cluster below without crowding either. */
      .atl-nav{position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:2;
        display:flex;flex-direction:column;gap:10px}
      .atl-btn{
        min-height:44px;padding:8px 18px;border-radius:var(--atl-r-pill);border:1px solid var(--atl-float-border);
        font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
        background:var(--atl-float-bg);color:var(--atl-ink);
        -webkit-backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
        backdrop-filter:blur(var(--atl-float-blur)) saturate(150%);
      }
      .atl-btn:disabled{opacity:.5;cursor:not-allowed}
      /* Back RECEDES — the quietest control on the panel, on purpose: a
         fade toward the edge of attention, no lift, no press-scale. Motion
         hierarchy communicates direction the way the copy already does. */
      /* Next / Zatraži ponudu PROPELS — a small forward nudge on hover (the
         journey's own direction of travel) and a warm bloom that deepens with
         teal rather than a generic shadow, echoing the glass rim-glow
         language already in css/styles.css. */
      .atl-btn.atl-btn-primary{margin-left:auto;background:var(--atl-teal-700);color:#FFFFFF;
        box-shadow:0 2px 6px -2px rgba(13,112,125,.4)}
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
      .atl-panorama[aria-pressed="true"]{border-color:var(--atl-teal-700);color:var(--atl-teal-700);
        box-shadow:0 1px 2px rgba(93,79,79,.18),0 0 20px 2px rgba(19,158,177,.28)}
      .atl-panorama:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:2px}
      @media(hover:hover) and (pointer:fine){
        .atl-bubble:hover{border-color:var(--atl-amber-500);transform:translateY(-2px)}
        .atl-btn:not(.atl-btn-primary):hover:not(:disabled){border-color:var(--atl-line);opacity:.72}
        .atl-btn.atl-btn-primary:hover:not(:disabled){transform:translateX(3px);
          box-shadow:0 6px 16px -4px rgba(13,112,125,.55)}
        .atl-chip:hover{transform:translateX(2px)}
        .atl-panorama:hover{border-color:var(--atl-amber-500);
          box-shadow:0 1px 2px rgba(93,79,79,.18),0 0 18px 1px rgba(234,166,81,.30)}
      }
      @media (prefers-contrast:more){ .atl-panorama{border-color:var(--atl-ink)} }
      @media (forced-colors:active){
        .atl-panorama{background:ButtonFace;color:ButtonText;border:1px solid ButtonText}
        .atl-panorama[aria-pressed="true"]{background:Highlight;color:HighlightText}
      }

      /* ---- Degradation paths — the same five soba3d.js ships, landing on
         --atl-glass-solid. See that file for why each one is required.
         Retargeted from the old single .atl-guide surface to every small
         floating surface the panel-removal split it into. ---- */
      @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
        .atl-guide.is-summary,.atl-question-group,.atl-bubble,.atl-material,.atl-strip-current,.atl-btn{
          background:var(--atl-glass-solid)}
      }
      @media (prefers-reduced-transparency:reduce){
        html:not([data-transparency="full"]) .atl-guide.is-summary,
        html:not([data-transparency="full"]) .atl-question-group,
        html:not([data-transparency="full"]) .atl-bubble,
        html:not([data-transparency="full"]) .atl-material,
        html:not([data-transparency="full"]) .atl-strip-current,
        html:not([data-transparency="full"]) .atl-btn{
          background:var(--atl-glass-solid);-webkit-backdrop-filter:none;backdrop-filter:none;
        }
      }
      html[data-transparency="reduced"] .atl-guide.is-summary,
      html[data-transparency="reduced"] .atl-question-group,
      html[data-transparency="reduced"] .atl-bubble,
      html[data-transparency="reduced"] .atl-material,
      html[data-transparency="reduced"] .atl-strip-current,
      html[data-transparency="reduced"] .atl-btn{
        background:var(--atl-glass-solid);-webkit-backdrop-filter:none;backdrop-filter:none;
      }
      @media (prefers-contrast:more){
        .atl-guide.is-summary,.atl-question-group,.atl-bubble,.atl-material,.atl-strip-current,.atl-btn{
          background:var(--atl-surface);border:1px solid var(--atl-ink);
          -webkit-backdrop-filter:none;backdrop-filter:none}
        .atl-chip,.atl-grout-color,.atl-grout-step{border-color:var(--atl-ink)}
      }
      @media (forced-colors:active){
        .atl-guide.is-summary,.atl-question-group,.atl-bubble,.atl-material,.atl-strip-current,.atl-btn{
          background:Canvas;border:1px solid CanvasText;
          -webkit-backdrop-filter:none;backdrop-filter:none;forced-color-adjust:none;color:CanvasText}
        .atl-chip,.atl-grout-color,.atl-grout-step{background:ButtonFace;color:ButtonText;border:1px solid ButtonText}
        .atl-bubble.is-selected,.atl-chip.is-active,.atl-btn-primary,
        .atl-grout-color[aria-pressed="true"]{background:Highlight;color:HighlightText}
        .atl-payoff-head::before,.atl-payoff-head>strong::after,.atl-completion-bloom{display:none}
      }
      /* LANDSCAPE WORKSPACE — the phone rotation earns a genuinely wider
         composition. The room is the canvas; a single decision lens floats on
         the right and the chapter path compresses into numbered waypoints over
         the unobscured left field. No app header, dock or page gutter returns. */
      @media(min-width:560px) and (orientation:landscape){
        .atl{
          --atl-ink:#F1F5F1;--atl-surface:rgba(8,12,10,.78);
          --atl-glass-ink-muted:rgba(232,240,234,.62);
          --atl-line:rgba(224,241,230,.15);--atl-glass-solid:#151A17;
          --atl-shadow-2:0 34px 90px -28px rgba(0,0,0,.82);
          position:fixed;inset:0;overflow:hidden;background:#020403;color:var(--atl-ink);
        }
        .atl-root{position:fixed;inset:0;height:auto;min-height:100dvh}
        .atl-stage{inset:0;border-radius:0;background:#020403}
        .atl-prelude{border-radius:0}
        .atl-stage::before{
          content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
          background:linear-gradient(90deg,rgba(1,3,2,.08) 0%,transparent 48%,rgba(1,3,2,.38) 72%,rgba(1,3,2,.72) 100%);
        }
        .atl-loading{
          border-radius:0;background:transparent;color:transparent;
          font-size:11px;font-weight:650;letter-spacing:.13em;text-transform:uppercase;
        }
        .atl-menu{left:max(16px,env(safe-area-inset-left,0px));top:max(12px,env(safe-area-inset-top,0px))}
        .atl-menu span{background:rgba(9,14,11,.62);box-shadow:0 1px rgba(255,255,255,.54),0 0 9px rgba(0,0,0,.32)}
        .atl-chapters{
          left:max(72px,calc(env(safe-area-inset-left,0px) + 72px));
          right:max(72px,env(safe-area-inset-right,0px));
          top:max(12px,env(safe-area-inset-top,0px));padding:0;gap:7px;overflow:visible;
        }
        .atl-chip{
          position:relative;display:grid;grid-template-columns:40px 0fr;align-items:center;
          min-width:44px;width:44px;min-height:44px;height:44px;padding:0;
          overflow:hidden;border-color:rgba(231,245,236,.13);
          background:rgba(5,9,7,.46);color:rgba(239,246,241,.64);
          box-shadow:0 8px 24px -16px rgba(0,0,0,.78);
        }
        .atl-chip-index{font-size:10px;font-weight:750;letter-spacing:.04em;text-align:center}
        .atl-chip-label{min-width:0;overflow:hidden;font-size:11px;opacity:0}
        .atl-chip.is-active{
          grid-template-columns:40px 1fr;width:auto;padding-right:14px;
          background:rgba(222,238,226,.92);border-color:rgba(255,255,255,.48);color:#101511;
        }
        .atl-chip.is-active .atl-chip-label{opacity:1}
        .atl-chip.is-done:not(.is-active)::after{
          content:"";position:absolute;right:4px;bottom:4px;width:4px;height:4px;border-radius:50%;
          background:#9ED6B5;box-shadow:0 0 8px rgba(158,214,181,.48);
        }
        /* No more right-side "decision lens" card (operator instruction,
           2026-08-05, IMG_6516: this exact card was blocking two-thirds of
           the room in landscape — "I don't know the orientation of my
           bathtub"). The base rule's bottom-anchored floating cluster
           applies unchanged here too; only the chip rail above stays
           landscape-specific. */
        .atl-guide{max-width:420px}
        .atl-panorama{
          left:max(18px,env(safe-area-inset-left,0px));right:auto;
          bottom:max(16px,env(safe-area-inset-bottom,0px));min-height:44px;
          border-color:rgba(229,243,234,.14);background:rgba(4,8,6,.52);color:rgba(239,246,241,.72);
          box-shadow:0 16px 40px -24px rgba(0,0,0,.82);
        }
      }

      /* Compact landscape phones: the chip rail yields its space on a short
         viewport rather than compressing the room into ribbons. The bottom
         floating cluster no longer needs a special-cased width/position
         here — it was only ever tuned for the right-side card this
         breakpoint used to also carry. */
      @media(min-width:560px) and (max-width:719px) and (orientation:landscape){
        .atl-chapters{display:none}
        .atl-panorama{left:max(12px,env(safe-area-inset-left,0px));bottom:max(12px,env(safe-area-inset-bottom,0px))}
      }

      /* Transform on --atl-spring (the house's own small-control press curve),
         colour/shadow on --atl-smooth — the same split css/styles.css uses on
         every one of its own buttons (search --spring there). Distinct
         durations per control size: the chip is the smallest, quickest
         gesture; the primary CTA is held a touch longer so the forward nudge
         reads as deliberate rather than twitchy. */
      @media (prefers-reduced-motion:no-preference){
        .atl-stage::after{transition:opacity .7s var(--atl-smooth)}
        .atl-guide.is-beat-entering{animation:atl-beat-in .44s var(--atl-smooth) both}
        .atl-payoff.is-celebrating .atl-payoff-head{animation:atl-payoff-in .7s var(--atl-smooth) both}
        .atl-payoff.is-celebrating .atl-payoff-head::before{animation:atl-completion-trace 1.15s var(--atl-smooth) .08s both}
        .atl-payoff.is-celebrating .atl-payoff-head>strong::after{animation:atl-total-sweep .95s var(--atl-smooth) .18s both}
        .atl-payoff.is-celebrating .atl-completion-bloom i{animation:atl-completion-bloom .88s var(--atl-spring) both}
        .atl-payoff.is-celebrating .atl-completion-bloom i:nth-child(2n){animation-delay:.08s}
        .atl-payoff.is-celebrating .atl-completion-bloom i:nth-child(3n){animation-delay:.15s}
        .atl-bubble{transition:transform var(--atl-dur-2) var(--atl-spring),
          border-color var(--atl-dur) var(--atl-smooth),
          background-color var(--atl-dur) var(--atl-smooth),color var(--atl-dur) var(--atl-smooth)}
        .atl-btn{transition:transform var(--atl-dur-2) var(--atl-spring),
          box-shadow var(--atl-dur-2) var(--atl-smooth),border-color var(--atl-dur) var(--atl-smooth),
          opacity var(--atl-dur) var(--atl-smooth)}
        .atl-chip{transition:transform var(--atl-dur) var(--atl-spring),
          border-color var(--atl-dur) var(--atl-smooth),background-color var(--atl-dur) var(--atl-smooth),
          color var(--atl-dur) var(--atl-smooth)}
        .atl-panorama{transition:box-shadow var(--atl-dur-2) var(--atl-smooth),
          border-color var(--atl-dur) var(--atl-smooth),color var(--atl-dur) var(--atl-smooth)}
        .atl-grout-color,.atl-grout-step{transition:border-color var(--atl-dur) var(--atl-smooth),
          box-shadow var(--atl-dur) var(--atl-smooth),background-color var(--atl-dur) var(--atl-smooth),
          color var(--atl-dur) var(--atl-smooth)}
      }
      @media(min-width:560px) and (orientation:landscape) and (prefers-reduced-motion:no-preference){
        .atl-stage{animation:atl-room-enter .88s cubic-bezier(.22,1,.36,1) both}
        .atl-menu,.atl-chapters,.atl-panorama{animation:atl-workspace-control-in .62s cubic-bezier(.22,1,.36,1) .18s both}
        .atl-menu{animation-delay:.08s}.atl-panorama{animation-delay:.28s}
        .atl-chip-label{transition:opacity .22s cubic-bezier(.22,1,.36,1)}
      }
      @keyframes atl-room-enter{from{opacity:.28;transform:scale(1.018)}to{opacity:1;transform:none}}
      @keyframes atl-workspace-control-in{from{opacity:0;transform:translateY(-7px)}to{opacity:1;transform:none}}
      @keyframes atl-beat-in{
        from{opacity:.58;transform:translateX(var(--atl-beat-x,8px)) translateY(4px)}
        to{opacity:1;transform:translateX(0) translateY(0)}
      }
      @keyframes atl-payoff-in{
        from{opacity:.45;transform:scale(.975);box-shadow:0 0 0 rgba(13,112,125,0)}
        to{opacity:1;transform:scale(1);box-shadow:0 14px 30px -20px rgba(13,112,125,.7)}
      }
      @keyframes atl-completion-trace{
        0%{opacity:0;transform:scale(.985)}
        28%{opacity:.96}
        72%{opacity:.64}
        100%{opacity:0;transform:scale(1.018)}
      }
      @keyframes atl-total-sweep{
        0%{clip-path:inset(0 100% 0 0);opacity:0}
        18%{opacity:1}
        74%{clip-path:inset(0 0 0 0);opacity:1}
        100%{clip-path:inset(0 0 0 100%);opacity:0}
      }
      @keyframes atl-completion-bloom{
        0%{opacity:0;transform:translate(-50%,-50%) scale(.35) rotate(0)}
        20%{opacity:.92}
        100%{opacity:0;transform:translate(calc(-50% + var(--atl-bloom-x)),calc(-50% + var(--atl-bloom-y))) scale(.8) rotate(150deg)}
      }
      @media (prefers-reduced-motion:reduce){
        /* No transform anywhere — a hover lift or a forward nudge is still
           motion. Colour/shadow state changes remain instant, which reads as
           a clean state swap rather than as "the animation was removed". */
        .atl-bubble:hover,.atl-bubble:active,.atl-btn:hover,.atl-btn:active,
        .atl-chip:hover,.atl-chip:active{transform:none}
        .atl-prelude.is-resolved{opacity:0;transition:opacity .17s linear}
      }
      /* Never animate blur() — forces a full re-composite every frame. */
    </style>
    <div class="atl">
      <button class="atl-menu" type="button" aria-label="${esc(tt("a11y.openMenu", "Otvori izbornik"))}"><span></span><span></span><span></span></button>
      <div class="atl-root">
        <div class="atl-stage" id="atl-stage" aria-label="${esc(tt("atelier.stage", "3D prikaz kupaonice"))}"></div>
        <div class="atl-prelude" id="atl-prelude" aria-hidden="true" style="--atl-prelude-light:${preludeLight.toFixed(3)}">
          <img class="atl-prelude-dark" src="./assets/images/login-interior-dark-4k.webp" alt="" width="2160" height="3840" decoding="async">
          <img class="atl-prelude-light" src="./assets/images/login-interior-light-4k.webp" alt="" width="2160" height="3840" decoding="async">
        </div>
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
          <div class="atl-question-group">
            <div class="atl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="atl-progress-bar">
              <div class="atl-progress-fill" id="atl-progress-fill"></div>
            </div>
            <p class="atl-eyebrow" id="atl-eyebrow"></p>
            <h2 class="atl-question" id="atl-question"></h2>
            <p class="atl-help" id="atl-help"></p>
            <span class="atl-stale" id="atl-stale" hidden></span>
          </div>
          <span class="atl-strip-current" id="atl-strip-current"></span>
          <div class="atl-strip"><div class="atl-strip-track" id="atl-options"></div></div>
          <div class="atl-material" id="atl-material" hidden></div>
          <div class="atl-summary" id="atl-summary" hidden></div>
        </div>
        <div class="atl-nav" id="atl-nav">
          <button type="button" class="atl-btn" id="atl-back">${esc(tt("atelier.back", "Natrag"))}</button>
          <button type="button" class="atl-btn atl-btn-primary" id="atl-next">${esc(tt("atelier.next", "Dalje"))}</button>
        </div>
      </div>
    </div>`;
}

function optionCard(chapter, opt, selected) {
  return `
    <button type="button" class="atl-bubble${selected ? " is-selected" : ""}"
      data-option="${esc(opt.id)}" aria-pressed="${selected ? "true" : "false"}">
      <span class="atl-bubble-label">${esc(opt.label)}</span>
    </button>`;
}

function productPriceLabel(p) {
  return p.priceM2 != null
    ? `${formatEur(p.priceM2)} / m²`
    : (p.priceUnit != null ? `${formatEur(p.priceUnit)} / kom` : "");
}

function productCard(p, selected) {
  return `
    <button type="button" class="atl-bubble atl-bubble-product${selected ? " is-selected" : ""}"
      data-product="${esc(p.id)}" aria-pressed="${selected ? "true" : "false"}"
      style="--atl-swatch:${esc(p.baseColorHex || "#ddd")}">
      <span class="atl-swatch"></span>
      <span class="atl-bubble-label">${esc(p.name)}</span>
      <span class="atl-bubble-meta">${esc(productPriceLabel(p))}</span>
      <span class="atl-bubble-mark" aria-hidden="true">✓</span>
    </button>`;
}

// The continuous-value pattern (operator instruction, 2026-08-05): a step
// button flanks a live readout instead of N flat "pick one" buttons, and the
// camera is already tracking the actual grout line by the time this renders
// — see directCamera()'s materialSubStep==="grout" branch below, which
// finally calls the previously-unused director3d.js followGroutLine().
function groutWidthStepper(width) {
  const idx = ATELIER_GROUT_WIDTHS_MM.indexOf(width);
  const atMin = idx <= 0;
  const atMax = idx < 0 || idx >= ATELIER_GROUT_WIDTHS_MM.length - 1;
  return `
    <div class="atl-grout-stepper" role="group" aria-label="${esc(tt("atelier.groutWidth", "Širina fuge"))}">
      <button type="button" class="atl-grout-step" data-grout-step="prev" ${atMin ? "disabled" : ""}
        aria-label="${esc(tt("atelier.groutNarrower", "Uže"))}">−</button>
      <span class="atl-grout-readout" id="atl-grout-readout" aria-live="polite">
        ${esc(tt("atelier.groutCurrent", "Trenutni razmak"))}: <strong>${width} mm</strong>
      </span>
      <button type="button" class="atl-grout-step" data-grout-step="next" ${atMax ? "disabled" : ""}
        aria-label="${esc(tt("atelier.groutWider", "Šire"))}">+</button>
    </div>`;
}

function materialControls(decision) {
  if (!decision?.productId) return "";
  const finish = surfaceFinishForDecision(decision);
  return `
    <div class="atl-material-head">
      <button type="button" class="atl-material-back" data-material-back>
        ${esc(tt("atelier.backToTiles", "← Natrag na pločice"))}
      </button>
      <p class="atl-material-title">${esc(tt("atelier.groutDetail", "Detalj fuge"))}</p>
      <p class="atl-material-hint">${esc(tt("atelier.groutHint", "Prilagodite boju i širinu — spoj se mijenja pred vama."))}</p>
    </div>
    <div class="atl-grout-row" role="group" aria-label="${esc(tt("atelier.groutColor", "Boja fuge"))}">
      <span class="atl-grout-label" aria-hidden="true">${esc(tt("atelier.groutColor", "Boja"))}</span>
      ${GROUT_COLORS.map((color) => `
        <button type="button" class="atl-grout-color" data-grout-color="${esc(color.id)}"
          aria-label="${esc(groutLabel(color.id))}" aria-pressed="${color.id === finish.groutColorId}"
          style="--atl-grout-color:${esc(color.hex)}"></button>`).join("")}
    </div>
    ${groutWidthStepper(finish.groutWidthMm)}`;
}

// ---- render one chapter's beat ---------------------------------------------
function renderChapter() {
  const cur = journey.current();
  const c = cur.chapter;
  const prog = journey.progress();
  const moodId = journey.toJSON().decisions?.smjer?.optionId || "";
  const changedChapter = lastChapterId !== c.id;
  const flow = lastChapterIndex < 0 || cur.index >= lastChapterIndex ? "forward" : "back";
  lastChapterId = c.id;
  lastChapterIndex = cur.index;

  const guide = container.querySelector("#atl-guide");
  container.querySelector(".atl").dataset.mood = moodId;
  container.querySelector(".atl").dataset.chapter = c.id;
  guide.dataset.chapter = c.id;
  guide.dataset.flow = flow;
  if (changedChapter) {
    guide.scrollTop = 0;
    guide.classList.remove("is-beat-entering");
    void guide.offsetWidth;
    guide.classList.add("is-beat-entering");
  }

  container.querySelector("#atl-progress-fill").style.width = `${Math.round(prog.fraction * 100)}%`;
  container.querySelector("#atl-progress-bar").setAttribute("aria-valuenow", String(Math.round(prog.fraction * 100)));
  container.querySelector("#atl-eyebrow").textContent = `${cur.index + 1} / ${journey.chapters.length} — ${c.title}`;
  container.querySelector("#atl-question").textContent = c.question;
  container.querySelector("#atl-help").textContent = (c.help || "")
    + (c.kind === "surface" && moodId
      ? ` ${tt("atelier.directionOrder", "Prvi prijedlozi prate odabrani smjer.")}`
      : "");

  const staleEl = container.querySelector("#atl-stale");
  if (cur.stale) {
    staleEl.hidden = false;
    // Not an instruction — this system never destroys a decision, only
    // outdates it, so the copy states a fact rather than issuing one.
    staleEl.textContent = tt("atelier.stale", "Odabir se temeljio na prethodnom smjeru.");
  } else {
    staleEl.hidden = true;
  }

  if (changedChapter) {
    // Returning to an already-answered surface chapter opens straight on
    // fine-tuning the grout, not back at the tile you already picked.
    materialSubStep = (c.kind === "surface" && cur.decision?.productId) ? "grout" : "product";
  }

  const optionsEl = container.querySelector("#atl-options");
  const stripEl = optionsEl.parentElement;
  const currentEl = container.querySelector("#atl-strip-current");
  const materialEl = container.querySelector("#atl-material");
  const summaryEl = container.querySelector("#atl-summary");
  const completion = journey.completion();
  guide.classList.toggle("is-summary", c.kind === "summary");

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  strip?.destroy();
  strip = null;

  const showStrip = (list, selected, cardFor, currentLabel) => {
    stripEl.hidden = false;
    optionsEl.innerHTML = list.length
      ? list.map((item) => cardFor(item, selected.has(item.id))).join("")
      : `<p class="atl-empty">${esc(tt("atelier.noProducts", "Nema proizvoda u ovoj kategoriji."))}</p>`;
    optionsEl.classList.toggle("is-static", reducedMotion);
    if (!reducedMotion && list.length > 1) strip = createAssetStrip({ viewport: stripEl, track: optionsEl });
    if (currentEl) {
      currentEl.classList.toggle("is-shown", Boolean(currentLabel));
      currentEl.innerHTML = currentLabel || "";
    }
  };

  if (c.kind === "direction") {
    materialEl.hidden = true;
    materialEl.innerHTML = "";
    summaryEl.hidden = true;
    showStrip(c.options, new Set(cur.decision?.optionId ? [cur.decision.optionId] : []), (o, sel) => optionCard(c, o, sel), "");
  } else if (c.kind === "surface" || c.kind === "fixtures") {
    summaryEl.hidden = true;
    const available = productsForChapter(c, products);
    const list = c.kind === "surface"
      ? rankProductsForDirection(available, moodId)
      : available;
    const selected = new Set(c.kind === "fixtures"
      ? decisionProductIds(cur.decision)
      : (cur.decision?.productId ? [cur.decision.productId] : []));
    const pickedProduct = c.kind === "surface" ? products.find((p) => p.id === cur.decision?.productId) : null;
    const showGrout = c.kind === "surface" && materialSubStep === "grout" && pickedProduct;
    if (showGrout) {
      stripEl.hidden = true;
      if (currentEl) currentEl.classList.remove("is-shown");
    } else {
      showStrip(list, selected, (p, sel) => productCard(p, sel),
        pickedProduct ? `<strong>${esc(pickedProduct.name)}</strong><span> · ${esc(productPriceLabel(pickedProduct))}</span>` : "");
    }
    const controls = showGrout ? materialControls(cur.decision) : "";
    materialEl.innerHTML = controls;
    materialEl.hidden = !controls;
  } else if (c.kind === "summary") {
    materialEl.hidden = true;
    materialEl.innerHTML = "";
    stripEl.hidden = true;
    if (currentEl) currentEl.classList.remove("is-shown");
    summaryEl.hidden = false;
    const state = journey.toJSON();
    const celebrate = completion.ready && completionRewards.claim({
      room: journey.room,
      decisions: state.decisions,
      assignments: journey.assignments(),
    });
    summaryEl.innerHTML = renderSummary({ celebrate });
  }

  container.querySelector("#atl-back").disabled = cur.isFirst;
  const nextBtn = container.querySelector("#atl-next");
  nextBtn.disabled = c.kind === "summary" ? !completion.ready : !cur.canAdvance;
  nextBtn.textContent = c.kind === "summary"
    ? (completion.ready
      ? tt("atelier.request", "Zatraži ponudu")
      : tt("atelier.finishChoices", "Dovršite odabire"))
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
      aria-label="${esc(`${i + 1}. ${c.title}`)}" aria-current="${i === activeIndex ? "step" : "false"}">
      <span class="atl-chip-index" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
      <span class="atl-chip-label" aria-hidden="true">${esc(c.title)}</span>
    </button>`;
  }).join("");
}

function renderSummary({ celebrate = false } = {}) {
  const state = journey.toJSON();
  const commission = buildCommission({
    chapters: journey.chapters,
    decisions: state.decisions,
    assignments: journey.assignments(),
    room: journey.room,
    products,
  });
  const completion = journey.completion();
  const fmtM = (value) => String(Math.round((Number(value) || 0) * 100) / 100).replace(".", ",");

  const surfaceRows = commission.surfaces.map((row) => `
    <li class="atl-summary-row${row.stale ? " is-stale" : ""}">
      <span><strong>${esc(row.label)}</strong><small>${esc(row.product.name)} · ${esc(String(row.order.totalM2).replace(".", ","))} m² · ${esc(groutLabel(row.finish.groutColorId))} · ${row.finish.groutWidthMm} mm</small></span>
      <span>${esc(formatEur(row.subtotal))}</span>
    </li>`).join("");
  const equipmentRows = commission.equipment.map((row) => `
    <li class="atl-summary-row">
      <span><strong>${esc(row.product.name)}</strong><small>${esc(row.label)}</small></span>
      <span>${esc(formatEur(row.subtotal))}</span>
    </li>`).join("");
  const readiness = completion.ready
    ? `<p class="atl-ready">${esc(tt("atelier.ready", "Projekt je spreman za razgovor s Akvatermom."))}</p>`
    : `<p class="atl-summary-warning">${esc(tt("atelier.notReady", "Vratite se na označene korake i dovršite obavezne odabire."))}</p>`;

  return `
    <div class="atl-payoff${celebrate ? " is-celebrating" : ""}">
      <div class="atl-payoff-head">
        ${celebrate ? `<span class="atl-completion-bloom" aria-hidden="true">${"<i></i>".repeat(8)}</span>` : ""}
        <span class="atl-payoff-kicker">${esc(tt("atelier.project", "Projekt kupaonice"))}</span>
        <strong data-total="${esc(formatEur(commission.total))}">${esc(formatEur(commission.total))}</strong>
        <small>${esc(tt("atelier.demoEstimate", "Demo procjena materijala i odabrane opreme"))}</small>
      </div>
      <div class="atl-project-meta">
        <span>${esc(`${fmtM(journey.room.widthM)} × ${fmtM(journey.room.depthM)} × ${fmtM(journey.room.heightM)} m`)}</span>
        ${commission.direction ? `<span>${esc(commission.direction.label)}</span>` : ""}
      </div>
      ${surfaceRows ? `<h3>${esc(tt("atelier.surfaces", "Površine"))}</h3><ul class="atl-summary-list">${surfaceRows}</ul>` : ""}
      ${equipmentRows ? `<h3>${esc(tt("atelier.equipment", "Oprema"))}</h3><ul class="atl-summary-list">${equipmentRows}</ul>` : ""}
      ${readiness}
      <p class="atl-summary-note">${esc(tt("atelier.estNote", "Procjena je informativna i ne uključuje otvore, ljepilo, fugu ni ugradnju. Točnu ponudu izrađuje Akvaterm."))}</p>
    </div>`;
}

// ---- interaction ------------------------------------------------------------
function applyDirectionDecision(optionId) {
  const chapter = journey.current().chapter;
  const opt = chapter.options.find((o) => o.id === optionId);
  if (!opt) return;
  journey.decide(chapter.id, { optionId });
  previewDirection(optionId);
  renderChapter();
}

function previewDirection(optionId) {
  if (!api || Object.keys(journey.assignments()).length) return;
  const tiles = rankProductsForDirection(
    products.filter((product) => product.category === "keramika"),
    optionId,
  );
  const floor = tiles[0];
  const wall = tiles.find((product) => product.id !== floor?.id) || floor;
  const moodFinish = liveSurfaceOptions({
    groutColorId: optionId === "mirno" ? "bijela" : optionId === "izrazito" ? "antracit" : "siva",
    groutWidthMm: optionId === "izrazito" ? 5 : 3,
  });
  if (floor) api.setSurface("floor", floor, moodFinish);
  if (wall) {
    for (const surface of ["wallN", "wallE", "wallS", "wallW"]) api.setSurface(surface, wall, moodFinish);
  }
}

function applyProductDecision(productId) {
  const chapter = journey.current().chapter;
  const p = products.find((x) => x.id === productId);
  if (!p) return;
  if (chapter.kind === "fixtures") {
    const productIds = toggleProductChoice(chapter, journey.current().decision, productId);
    preferredFixtureProductId = productIds.includes(productId) ? productId : productIds[0] || null;
    journey.decide(chapter.id, { productIds });
    syncJourneyFixtures();
  } else {
    journey.decide(chapter.id, { productId, ...surfaceFinishForDecision(journey.current().decision) });
  }
  if (chapter.kind === "surface" && chapter.surface && api) {
    const opts = liveSurfaceOptions(journey.current().decision);
    for (const surface of (chapter.surfaces || [chapter.surface])) api.setSurface(surface, p, opts);
  }
  // The tile is chosen — the next question this same chapter has is grout,
  // never both at once (see the materialSubStep comment at its declaration).
  if (chapter.kind === "surface") materialSubStep = "grout";
  renderChapter();
}

function applyGroutDecision(patch) {
  const cur = journey.current();
  const chapter = cur.chapter;
  if (chapter.kind !== "surface" || !cur.decision?.productId) return;
  const product = products.find((item) => item.id === cur.decision.productId);
  if (!product) return;
  const finish = surfaceFinishForDecision({ ...cur.decision, ...patch });
  journey.decide(chapter.id, { ...cur.decision, ...finish, productId: product.id });
  const opts = { ...finish, liveGrout: true };
  for (const surface of (chapter.surfaces || [chapter.surface])) api?.setSurface(surface, product, opts);
  const materialEl = container.querySelector("#atl-material");
  materialEl.innerHTML = materialControls(journey.current().decision);
  autosave();
}

function stepGroutWidth(dir) {
  const cur = journey.current();
  const finish = surfaceFinishForDecision(cur.decision);
  const idx = ATELIER_GROUT_WIDTHS_MM.indexOf(finish.groutWidthMm);
  // Clamps at the ends rather than wrapping — jumping 8mm straight back to
  // 2mm would be exactly the kind of canned restart director3d.js's own
  // header already rejects for camera motion; the same principle applies to
  // a value the customer is actively fine-tuning by feel.
  const next = Math.max(0, Math.min(ATELIER_GROUT_WIDTHS_MM.length - 1, idx + dir));
  if (next === idx) return;
  applyGroutDecision({ groutWidthMm: ATELIER_GROUT_WIDTHS_MM[next] });
}

function syncJourneyFixtures() {
  if (!api) return;
  const state = journey.toJSON();
  roomFixtures = buildFixturePlan({
    chapters: journey.chapters,
    decisions: state.decisions,
    room: journey.room,
    catalogue: api.getCatalogue(),
    previous: roomFixtures,
  });
  api.setFixtures(roomFixtures);
  autosave();
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
  container.querySelector(".atl-menu")?.addEventListener("click", () => document.getElementById("sideOpen")?.click());
  container.querySelector("#atl-panorama").addEventListener("click", () => {
    setPanorama(!panoramaOn);
  });

  container.querySelector("#atl-options").addEventListener("click", (e) => {
    const optBtn = e.target.closest("[data-option]");
    if (optBtn) { applyDirectionDecision(optBtn.dataset.option); return; }
    const prodBtn = e.target.closest("[data-product]");
    if (prodBtn) applyProductDecision(prodBtn.dataset.product);
  });

  const materialEl = container.querySelector("#atl-material");
  materialEl.addEventListener("click", (e) => {
    const back = e.target.closest("[data-material-back]");
    if (back) { materialSubStep = "product"; renderChapter(); return; }
    const color = e.target.closest("[data-grout-color]");
    if (color) { applyGroutDecision({ groutColorId: color.dataset.groutColor }); return; }
    const step = e.target.closest("[data-grout-step]");
    if (step) stepGroutWidth(step.dataset.groutStep === "next" ? 1 : -1);
  });
  // Press-and-hold repeat on the stepper: one immediate step on press, then
  // repeating after a short pause so a customer can walk the value from 2mm
  // to 8mm without four separate taps.
  const clearGroutHold = () => {
    window.clearTimeout(groutHoldTimer); window.clearInterval(groutHoldInterval);
    groutHoldTimer = null; groutHoldInterval = null;
  };
  materialEl.addEventListener("pointerdown", (e) => {
    const step = e.target.closest("[data-grout-step]");
    if (!step || step.disabled) return;
    const dir = step.dataset.groutStep === "next" ? 1 : -1;
    clearGroutHold();
    groutHoldTimer = window.setTimeout(() => {
      groutHoldInterval = window.setInterval(() => stepGroutWidth(dir), 140);
    }, 450);
  });
  materialEl.addEventListener("pointerup", clearGroutHold);
  materialEl.addEventListener("pointerleave", clearGroutHold);
  materialEl.addEventListener("pointercancel", clearGroutHold);

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
  const completion = journey.completion();
  if (!completion.ready) {
    window.AKV?.toast?.(tt("atelier.notReady", "Dovršite obavezne odabire prije slanja."));
    return;
  }

  const state = journey.toJSON();
  const commission = buildCommission({
    chapters: journey.chapters,
    decisions: state.decisions,
    assignments: journey.assignments(),
    room: journey.room,
    products,
  });
  const fmtM = (value) => String(Math.round((Number(value) || 0) * 100) / 100).replace(".", ",");
  const lines = [
    tt("atelier.mailIntro", "Poštovani, molim razgovor i točnu ponudu za ovu kupaonicu:"),
    "",
    `${tt("atelier.dimensions", "Dimenzije")}: ${fmtM(journey.room.widthM)} × ${fmtM(journey.room.depthM)} × ${fmtM(journey.room.heightM)} m`,
  ];
  if (commission.direction) lines.push(`${tt("atelier.direction", "Smjer")}: ${commission.direction.label}`);
  if (commission.surfaces.length) {
    lines.push("", `${tt("atelier.surfaces", "Površine")}:`);
    for (const row of commission.surfaces) {
      lines.push(`- ${row.label}: ${row.product.name} — ${String(row.order.totalM2).replace(".", ",")} m² — ${groutLabel(row.finish.groutColorId)} ${row.finish.groutWidthMm} mm — ${formatEur(row.subtotal)}`);
    }
  }
  if (commission.equipment.length) {
    lines.push("", `${tt("atelier.equipment", "Oprema")}:`);
    for (const row of commission.equipment) lines.push(`- ${row.product.name} — ${formatEur(row.subtotal)}`);
  }
  lines.push(
    "",
    `${tt("atelier.estTotal", "Demo procjena")}: ${formatEur(commission.total)}`,
    tt("atelier.mailNote", "Procjena je informativna i ne uključuje otvore, ljepilo, fugu ni ugradnju."),
    "",
    location.href,
  );

  const subject = tt("atelier.mailSubject", "Upit za kupaonicu — Akvaterm");
  window.location.href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  window.AKV?.toast?.(tt("atelier.mailOpen", "Otvaramo poruku s vašim projektom."));
}

function onFixtureMoved(event) {
  const moved = event.detail;
  const fixture = roomFixtures[moved?.index];
  if (!fixture) return;
  Object.assign(fixture, {
    x: moved.x, z: moved.z, rotY: moved.rotY,
    ax: moved.ax, az: moved.az,
  });
  autosave();
}

function resolveRoomPrelude() {
  container?.querySelector("#atl-loading")?.remove();
  const prelude = container?.querySelector("#atl-prelude");
  if (!prelude) return;
  prelude.classList.add("is-resolved");
  window.setTimeout(() => prelude.remove(),
    matchMedia("(prefers-reduced-motion: reduce)").matches ? 190 : 760);
}

function mountStaticRoom(stage, lightMix = 0) {
  const mix = Math.max(0, Math.min(1, Number(lightMix) || 0));
  container?.querySelector(".atl")?.setAttribute("data-room", "static");
  stage.setAttribute("aria-label", tt("atelier.staticStage", "Statični prikaz kupaonice"));
  stage.innerHTML = `
    <div class="atl-static-room" aria-hidden="true" style="--atl-static-light:${mix.toFixed(3)}">
      <img class="atl-static-room-dark" src="./assets/images/login-interior-dark-4k.webp" alt="" width="2160" height="3840" decoding="async">
      <img class="atl-static-room-light" src="./assets/images/login-interior-light-4k.webp" alt="" width="2160" height="3840" decoding="async">
    </div>`;
  resolveRoomPrelude();
}

// ---- lifecycle --------------------------------------------------------------
export async function render(el) {
  teardown();
  const token = ++mountToken;
  container = el;
  document.documentElement.setAttribute("data-akv-journey", "opening");

  journey = createJourney(BATHROOM_V0);
  const saved = loadAutosave();
  if (saved?.journeyState) journey.restore(saved.journeyState);
  if (saved?.room) journey.setRoom(saved.room);
  roomFixtures = Array.isArray(saved?.fixtures) ? saved.fixtures.map((fixture) => ({ ...fixture })) : [];

  // Start local work during the quiet opening rather than after it. These
  // promises do not gate the question or turn the 700 ms handoff into a loader.
  const productsReady = db.listProducts();
  const roomReady = import("../room3d.js");
  opening = mountJourneyOpening(container, {
    onBrief: ({ brief, directionId }) => {
      journey?.decide("smjer", { optionId: directionId, brief }, Date.now());
      autosave();
    },
  });
  const openingResult = await opening.done;
  if (!alive(token) || openingResult?.cancelled) {
    opening?.dispose();
    opening = null;
    return;
  }
  const handoffResult = await opening?.transitionOut?.();
  opening?.dispose();
  opening = null;
  if (!alive(token)) return;
  if (journey.current().chapter.id === "smjer" && journey.canAdvance()) journey.next();
  document.documentElement.setAttribute("data-akv-journey", "active");

  const all = await productsReady;
  if (!alive(token)) return;
  products = all;

  container.innerHTML = shell(handoffResult);
  wire();

  const initialAssignments = {};
  for (const [surface, a] of Object.entries(journey.assignments())) {
    const p = products.find((x) => x.id === a.productId);
    if (p) initialAssignments[surface] = {
      productId: p.id,
      ...liveSurfaceOptions(a),
    };
  }

  fixtureEventStage = container.querySelector("#atl-stage");
  fixtureEventStage.addEventListener("akv:fixture-moved", onFixtureMoved);
  let handle = null;
  try {
    const mod = await roomReady;
    if (!alive(token)) return;
    handle = await mod.mountRoom(fixtureEventStage, {
    room: { ...journey.room, fixtures: roomFixtures },
    assignments: initialAssignments,
    products,
    onReady: resolveRoomPrelude,
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
  const restoredMood = journey.toJSON().decisions?.smjer?.optionId;
  if (restoredMood) previewDirection(restoredMood);
  syncJourneyFixtures();
  } catch (error) {
    if (!alive(token)) { handle?.dispose?.(); return; }
    console.warn("[atelier] WebGL room unavailable; continuing with the static room.", error);
    api = null;
    fixtureEventStage.replaceChildren();
    mountStaticRoom(fixtureEventStage, handoffResult?.lightMix);
  }

  // prefers-reduced-motion: short dissolves, no ceremonial orbit, no
  // continuous drift — mirrored into BOTH the director and the engine's own
  // glass blend, exactly as director3d/room3d document.
  reducedMotionMQ = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionHandler = () => api?.camera?.setReducedMotion(reducedMotionMQ.matches);
  reducedMotionHandler();
  reducedMotionMQ.addEventListener?.("change", reducedMotionHandler);

  renderChapter();
}

export function teardown() {
  mountToken++;
  opening?.dispose();
  opening = null;
  clearJourneyChrome();
  reducedMotionMQ?.removeEventListener?.("change", reducedMotionHandler);
  reducedMotionMQ = null;
  reducedMotionHandler = null;
  fixtureEventStage?.removeEventListener("akv:fixture-moved", onFixtureMoved);
  fixtureEventStage = null;
  if (api) { api.camera?.stop(); api.dispose(); api = null; }
  journey = null;
  container = null;
  panoramaOn = false;
  roomFixtures = [];
  lastChapterId = null;
  lastChapterIndex = -1;
  preferredFixtureProductId = null;
  strip?.destroy();
  strip = null;
  window.clearTimeout(groutHoldTimer);
  window.clearInterval(groutHoldInterval);
  groutHoldTimer = null;
  groutHoldInterval = null;
  materialSubStep = "product";
}
