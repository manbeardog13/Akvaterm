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
function directCamera(chapter) {
  if (!api?.camera || !chapter) return;
  const fixtureTarget = chapter.kind === "fixtures"
    ? (roomFixtures.find((fixture) => fixture.chapterId === chapter.id
        && fixture.productId === preferredFixtureProductId)
      || roomFixtures.find((fixture) => fixture.chapterId === chapter.id))?.type
    : null;
  const target = fixtureTarget || chapter.target || chapter.surface;
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
        --atl-paper:var(--paper,#F2F2F2);
        --atl-ink:var(--ink,#313131);
        --atl-surface:var(--surface,#FFFFFF);
        --atl-teal-300:var(--teal-300,#86DCE6);
        --atl-teal-600:var(--teal-600,#139EB1);
        --atl-teal-700:var(--teal-700,#0D707D);
        --atl-amber-500:var(--amber-500,#EAA651);
        --atl-amber-ink:var(--amber-ink,#935616);
        --atl-brown-800:var(--brown-800,#68340F);
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
      .atl [hidden]{display:none!important}
      .atl-menu{position:fixed;z-index:8;left:max(18px,env(safe-area-inset-left,0px));top:max(18px,env(safe-area-inset-top,0px));display:grid;place-content:center;gap:5px;width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer}
      .atl-menu span{display:block;width:23px;height:2px;border-radius:999px;background:rgba(240,255,247,.70);box-shadow:0 1px rgba(255,255,255,.34),0 0 8px rgba(159,220,183,.16)}
      .atl-menu:focus-visible{outline:2px solid rgba(218,242,224,.88);outline-offset:3px;border-radius:12px}

      /* Explicit height, matching soba3d.js's .s3d-stage clamp — an
         absolutely-positioned stage needs a sized ancestor, not height:100%
         of #main's unconstrained flow. */
      .atl-root{position:relative;height:clamp(420px,84vh,760px);min-height:0}
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

      /* THE ONE GLASS SURFACE. Recipe and contrast math copied from
         soba3d.js's .s3d-hud — see that file for the full derivation. Worst
         case (glass over a black floor) composites to #BEC3C4: --ink on it is
         7.30:1, --atl-glass-ink-muted is 4.57:1. Both pass AA at any size. */
      .atl-guide{
        position:absolute;left:12px;right:12px;bottom:64px;z-index:2;
        max-width:420px;max-height:min(52dvh,400px);overflow:auto;overscroll-behavior:contain;
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
      @media(min-width:720px){ .atl-guide{ left:24px; right:max(24px,env(safe-area-inset-right,0px)); bottom:24px; } }
      .atl-guide.is-summary{max-width:min(540px,92vw);padding:20px 22px}
      .atl-guide[data-flow="forward"]{--atl-beat-x:10px}
      .atl-guide[data-flow="back"]{--atl-beat-x:-10px}

      .atl-progress{height:4px;border-radius:var(--atl-r-pill);background:rgba(104,52,15,.14);overflow:hidden;margin-bottom:10px}
      .atl-progress-fill{height:100%;background:var(--atl-teal-700);border-radius:inherit;width:0%}
      @media(prefers-reduced-motion:no-preference){.atl-progress-fill{transition:width .5s var(--smooth,ease)}}

      .atl-eyebrow{margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.08em;
        text-transform:uppercase;color:var(--atl-glass-ink-muted)}
      .atl-question{margin:0 0 4px;font-size:19px;font-weight:700;letter-spacing:-.01em;line-height:1.25}
      .atl-help{margin:0 0 12px;font-size:13.5px;line-height:1.4;color:var(--atl-glass-ink-muted)}
      .atl-stale{display:block;margin:0 0 10px;padding:8px 10px;border-radius:var(--atl-r-sm);
        background:var(--atl-surface);color:var(--atl-amber-ink);font-size:12.5px;font-weight:600}

      .atl-options{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;max-height:min(168px,22dvh);
        overflow:auto;overscroll-behavior:contain;padding:2px 3px 3px 2px;scrollbar-width:thin}
      .atl-empty{font-size:13px;color:var(--atl-glass-ink-muted);margin:0 0 14px}

      /* A material seam, not another chapter. It appears only after a tile is
         chosen and keeps both decisions in the same visual beat as the close-up
         camera. Every control is solid, so the one-glass budget remains intact. */
      .atl-material{display:grid;gap:8px;margin:-3px 0 14px;padding-top:10px;border-top:1px solid var(--atl-line)}
      .atl-material-head{display:grid;gap:2px}
      .atl-material-title{margin:0;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
        color:var(--atl-glass-ink-muted)}
      .atl-material-hint{margin:0;font-size:12px;line-height:1.35;color:var(--atl-glass-ink-muted)}
      .atl-grout-row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
      .atl-grout-label{min-width:70px;font-size:11.5px;font-weight:600;color:var(--atl-glass-ink-muted)}
      .atl-grout-color,.atl-grout-width{min-width:44px;min-height:44px;border:1px solid var(--atl-line);
        background:var(--atl-surface);color:var(--atl-ink);font:inherit;font-size:12px;font-weight:650;cursor:pointer}
      .atl-grout-color{width:44px;padding:0;border-radius:50%;background:var(--atl-grout-color,#ddd);
        box-shadow:inset 0 0 0 3px var(--atl-surface)}
      .atl-grout-color[aria-pressed="true"]{border-color:var(--atl-teal-700);
        box-shadow:inset 0 0 0 3px var(--atl-surface),0 0 0 2px var(--atl-teal-700)}
      .atl-grout-width{padding:7px 11px;border-radius:var(--atl-r-pill)}
      .atl-grout-width[aria-pressed="true"]{border-color:var(--atl-teal-700);background:var(--atl-teal-700);color:#fff}
      .atl-grout-color:focus-visible,.atl-grout-width:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:3px}

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
      .atl-option:active{transform:translateY(0) scale(.975)}
      .atl-option.is-selected{border-color:var(--atl-teal-700);background:var(--atl-teal-700);color:#FFFFFF}
      .atl-option:focus-visible{outline:3px solid var(--atl-teal-700);outline-offset:2px}
      .atl-option-product{padding-left:6px}
      .atl-swatch{width:22px;height:22px;border-radius:50%;flex:none;background:var(--atl-swatch,#ddd);
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
      .atl-option-meta{font-size:11.5px;font-weight:500;opacity:.82}
      .atl-option-mark{display:none;width:18px;height:18px;border-radius:50%;margin-left:auto;
        align-items:center;justify-content:center;background:rgba(255,255,255,.18);font-size:11px}
      .atl-option.is-selected .atl-option-mark{display:inline-flex}

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

      /* Sticky on every step, not just .is-summary (operator instruction,
         2026-08-05, from the atl-guide overlay audit): the guide's own
         max-height now regularly forces internal scrolling, and the nav
         buttons must stay reachable without the user discovering that
         scroll first. */
      .atl-nav{position:sticky;bottom:-1px;z-index:2;display:flex;align-items:center;gap:10px;
        padding-top:13px;background:linear-gradient(to bottom,transparent,var(--atl-glass-bg) 34%)}
      .atl-btn{
        min-height:44px;padding:8px 18px;border-radius:var(--atl-r-pill);border:1px solid transparent;
        font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
        background:var(--atl-surface);color:var(--atl-ink);box-shadow:0 1px 2px rgba(93,79,79,.18);
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
        .atl-option:hover{border-color:var(--atl-amber-500);transform:translateY(-2px);
          box-shadow:0 6px 14px -8px rgba(13,112,125,.35)}
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
        .atl-option,.atl-chip,.atl-btn,.atl-grout-color,.atl-grout-width{border-color:var(--atl-ink)}
      }
      @media (forced-colors:active){
        .atl-guide{background:Canvas;border:1px solid CanvasText;
          -webkit-backdrop-filter:none;backdrop-filter:none;forced-color-adjust:none;color:CanvasText}
        .atl-option,.atl-chip,.atl-btn,.atl-grout-color,.atl-grout-width{background:ButtonFace;color:ButtonText;border:1px solid ButtonText}
        .atl-option.is-selected,.atl-chip.is-active,.atl-btn-primary,
        .atl-grout-color[aria-pressed="true"],.atl-grout-width[aria-pressed="true"]{background:Highlight;color:HighlightText}
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
          right:calc(min(360px,42vw) + max(34px,env(safe-area-inset-right,0px)));
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
        .atl-guide{
          left:auto;right:max(16px,env(safe-area-inset-right,0px));
          top:max(16px,env(safe-area-inset-top,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));
          width:min(360px,42vw);max-width:none;max-height:none;padding:17px 19px 15px;
          border:1px solid transparent;border-radius:28px;
          background:
            linear-gradient(138deg,rgba(13,20,16,.70),rgba(6,11,8,.67) 43%,rgba(3,7,5,.76) 82%) padding-box,
            linear-gradient(145deg,rgba(255,255,255,.40),rgba(171,224,192,.13) 32%,rgba(223,166,106,.17) 74%,rgba(255,255,255,.08)) border-box;
          -webkit-backdrop-filter:blur(14px) saturate(145%) brightness(.91);
          backdrop-filter:blur(14px) saturate(145%) brightness(.91);
          box-shadow:
            var(--atl-shadow-2),inset 0 1px rgba(255,255,255,.16),
            inset 1px 0 rgba(180,230,201,.08),inset -1px 0 rgba(226,166,107,.055),
            inset 0 -18px 32px -28px rgba(98,165,126,.18);
          scrollbar-width:thin;scrollbar-color:rgba(221,237,226,.22) transparent;z-index:3;
        }
        .atl-guide.is-summary{width:min(430px,48vw);max-width:none;padding:18px 20px 15px}
        .atl-progress{height:2px;margin-bottom:12px;background:rgba(225,240,230,.11)}
        .atl-progress-fill{background:linear-gradient(90deg,#78BFA3,#D0B27B)}
        .atl-eyebrow{margin-bottom:6px;color:rgba(222,238,227,.52);font-size:10px;letter-spacing:.13em}
        .atl-question{margin-bottom:6px;font-size:clamp(18px,2.5vw,23px);font-weight:560;line-height:1.12;letter-spacing:-.025em}
        .atl-help{margin-bottom:12px;color:var(--atl-glass-ink-muted);font-size:12.5px;line-height:1.35}
        .atl-options{gap:7px;max-height:min(128px,33dvh);margin-bottom:12px;padding:1px 3px 2px 1px}
        .atl-option{
          width:100%;min-height:44px;padding:8px 11px;border-color:rgba(225,241,231,.13);
          border-radius:15px;background:rgba(255,255,255,.055);color:var(--atl-ink);font-size:12.5px;
        }
        .atl-option.is-selected{border-color:rgba(220,239,225,.52);background:rgba(218,235,222,.91);color:#111612}
        .atl-option-meta{margin-left:auto;color:inherit;opacity:.62}
        .atl-swatch{width:27px;height:27px;border-radius:10px}
        .atl-material{margin-top:-3px;margin-bottom:11px;padding-top:9px;border-top-color:rgba(225,241,231,.12)}
        .atl-grout-color,.atl-grout-width,.atl-btn{background:rgba(255,255,255,.07);color:var(--atl-ink);border-color:rgba(225,241,231,.14)}
        .atl-grout-color{box-shadow:inset 0 0 0 3px rgba(8,12,10,.82)}
        .atl-grout-color[aria-pressed="true"]{box-shadow:inset 0 0 0 3px rgba(8,12,10,.82),0 0 0 2px #8FCBB0}
        .atl-btn.atl-btn-primary{background:rgba(218,235,222,.93);color:#111612;box-shadow:none}
        .atl-panorama{
          left:max(18px,env(safe-area-inset-left,0px));right:auto;
          bottom:max(16px,env(safe-area-inset-bottom,0px));min-height:44px;
          border-color:rgba(229,243,234,.14);background:rgba(4,8,6,.52);color:rgba(239,246,241,.72);
          box-shadow:0 16px 40px -24px rgba(0,0,0,.82);
        }
      }

      /* Compact landscape phones keep the same composition, but the guide's
         own progress/eyebrow already states position, so the external waypoint
         rail yields its space rather than compressing the room into ribbons. */
      @media(min-width:560px) and (max-width:719px) and (orientation:landscape){
        .atl-chapters{display:none}
        .atl-guide{
          right:max(12px,env(safe-area-inset-right,0px));top:max(12px,env(safe-area-inset-top,0px));
          bottom:max(12px,env(safe-area-inset-bottom,0px));width:min(330px,48vw);
          padding:14px 15px 13px;border-radius:24px;
        }
        .atl-guide.is-summary{width:min(360px,54vw);padding:15px 16px 13px}
        .atl-question{font-size:17px}.atl-help{font-size:11.5px;margin-bottom:9px}
        .atl-options{max-height:min(112px,30dvh);margin-bottom:9px}
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
        .atl-grout-color,.atl-grout-width{transition:border-color var(--atl-dur) var(--atl-smooth),
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
        .atl-option:hover,.atl-option:active,.atl-btn:hover,.atl-btn:active,
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
          <div class="atl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="atl-progress-bar">
            <div class="atl-progress-fill" id="atl-progress-fill"></div>
          </div>
          <p class="atl-eyebrow" id="atl-eyebrow"></p>
          <h2 class="atl-question" id="atl-question"></h2>
          <p class="atl-help" id="atl-help"></p>
          <div class="atl-options" id="atl-options"></div>
          <div class="atl-material" id="atl-material" hidden></div>
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
  const priceLabel = p.priceM2 != null
    ? `${formatEur(p.priceM2)} / m²`
    : (p.priceUnit != null ? `${formatEur(p.priceUnit)} / kom` : "");
  return `
    <button type="button" class="atl-option atl-option-product${selected ? " is-selected" : ""}"
      data-product="${esc(p.id)}" aria-pressed="${selected ? "true" : "false"}"
      style="--atl-swatch:${esc(p.baseColorHex || "#ddd")}">
      <span class="atl-swatch"></span>
      <span class="atl-option-label">${esc(p.name)}</span>
      <span class="atl-option-meta">${esc(priceLabel)}</span>
      <span class="atl-option-mark" aria-hidden="true">✓</span>
    </button>`;
}

function materialControls(decision) {
  if (!decision?.productId) return "";
  const finish = surfaceFinishForDecision(decision);
  return `
    <div class="atl-material-head">
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
    <div class="atl-grout-row" role="group" aria-label="${esc(tt("atelier.groutWidth", "Širina fuge"))}">
      <span class="atl-grout-label" aria-hidden="true">${esc(tt("atelier.groutWidthShort", "Širina"))}</span>
      ${ATELIER_GROUT_WIDTHS_MM.map((width) => `
        <button type="button" class="atl-grout-width" data-grout-width="${width}"
          aria-pressed="${width === finish.groutWidthMm}">${width} mm</button>`).join("")}
    </div>`;
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

  const optionsEl = container.querySelector("#atl-options");
  const materialEl = container.querySelector("#atl-material");
  const summaryEl = container.querySelector("#atl-summary");
  const completion = journey.completion();
  guide.classList.toggle("is-summary", c.kind === "summary");

  if (c.kind === "direction") {
    materialEl.hidden = true;
    materialEl.innerHTML = "";
    summaryEl.hidden = true;
    optionsEl.hidden = false;
    optionsEl.innerHTML = c.options
      .map((o) => optionCard(c, o, cur.decision?.optionId === o.id))
      .join("");
  } else if (c.kind === "surface" || c.kind === "fixtures") {
    summaryEl.hidden = true;
    optionsEl.hidden = false;
    const available = productsForChapter(c, products);
    const list = c.kind === "surface"
      ? rankProductsForDirection(available, moodId)
      : available;
    const selected = new Set(c.kind === "fixtures"
      ? decisionProductIds(cur.decision)
      : (cur.decision?.productId ? [cur.decision.productId] : []));
    optionsEl.innerHTML = list.length
      ? list.map((p) => productCard(p, selected.has(p.id))).join("")
      : `<p class="atl-empty">${esc(tt("atelier.noProducts", "Nema proizvoda u ovoj kategoriji."))}</p>`;
    const controls = c.kind === "surface" ? materialControls(cur.decision) : "";
    materialEl.innerHTML = controls;
    materialEl.hidden = !controls;
  } else if (c.kind === "summary") {
    materialEl.hidden = true;
    materialEl.innerHTML = "";
    optionsEl.hidden = true;
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

  container.querySelector("#atl-material").addEventListener("click", (e) => {
    const color = e.target.closest("[data-grout-color]");
    if (color) { applyGroutDecision({ groutColorId: color.dataset.groutColor }); return; }
    const width = e.target.closest("[data-grout-width]");
    if (width) applyGroutDecision({ groutWidthMm: Number(width.dataset.groutWidth) });
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
}
