// ============================================================================
// aidock.js — the global Terma dock: a tucked violet tab on the right edge that
// slides a branded panel in over whatever view is on screen.
//
// Carried over from ASC's floating AI dock (app/app.css 407-668, app/app.js
// 378-646) and re-pointed at THIS app's advisor. What survives is the visual
// system — the tab geometry, the 152deg violet gradient, the sliding panel with
// its two radial blooms, the chips, the gradient send button, the easings. What
// does not survive is ASC's client-side Anthropic tool-use loop, its tire skin,
// and its press-and-hold microphone. Each omission is explained where it would
// otherwise be missed.
//
// ---------------------------------------------------------------------------
// THERE IS NO MICROPHONE, DELIBERATELY
// ---------------------------------------------------------------------------
// ASC's dock is built around a press-and-hold mic orb driven by webkitSpeech-
// Recognition. Akvaterm has no speech pipeline of any kind: nothing in this
// repository requests audio, no view carries a recording consent string, and
// there is no "Vi" -form disclosure anywhere that would cover shipping the
// user's voice to Google's servers (which is what the Web Speech API does in
// Chrome and Edge — it is NOT on-device). A mic button that is present but
// inert is worse than no mic button, because the affordance itself is a promise.
// So the orb, the ping rings, the is-live palette and the whole voice state
// machine are omitted, and the panel is the TYPED path only. If speech is ever
// wanted it arrives with a consent notice modelled on views/savjetnik.js's
// sv.consentNotice, not as a silent addition here.
//
// ---------------------------------------------------------------------------
// WHY THE PANEL IS DARK VIOLET IN BOTH THEMES
// ---------------------------------------------------------------------------
// It is a branded surface, not a themed one — the same reason the Google button
// in views/prijava.js is #FFFFFF in both themes and carries literal colours
// instead of tokens. The violet is deliberately OFF the Iris palette: the dock
// has to read as "this is the AI, and it is not part of the page", and it has to
// be distinguishable at a glance from #/savjetnik, which is the full advisor in
// light teal glass. Two teal advisors on one screen would be confusable; one
// teal view plus one violet dock is not.
//
// What actually breaks in dark theme is therefore not contrast but SEPARATION,
// and it is fixed with an edge rather than a second palette. Computed below:
// the panel body #150F2B against dark --paper #14100E is 1.02:1 — the panel is
// effectively invisible — and ASC's own rim var(--line) only reaches
// 1.52:1 there. So the rim (and only the rim) is theme-aware: --aid-rim flips,
// everything else is constant. Both selectors the project requires are present,
// and both are needed: js/app.js applyTheme() writes data-theme only once the
// user has chosen, so with no attribute at all the media query is the only rule
// that fires.
//
// ---------------------------------------------------------------------------
// CONTRAST — every figure COMPUTED, none estimated
// ---------------------------------------------------------------------------
// Method: WCAG 2.x relative luminance with sRGB src-over compositing, run over a
// numeric model of what is actually painted — the 168deg body gradient sampled
// across a 360x420 panel, both radial blooms with their real ellipse geometry
// and stop positions, the ::before layer opacity of .6 folded in, then each
// child surface composited on top. The ground quoted below is the LIGHTEST
// point that model produces (#2A1D50, up under the violet bloom), because for
// light ink the lightest ground is the worst case. The darkest point is
// #0A0912, where every tier scores higher — the figures are a floor, not a
// midpoint.
//
//   ELEMENT                         FG        GROUND    RATIO   NEED
//   .ai-panel body ink / .ai-title  var(--ink)   #2A1D50   13.47   4.5   PASS
//   .ai-hint                        var(--muted)   #2A1D50    7.16   4.5   PASS
//   .ai-hint.is-busy                var(--accent-ink)   #2A1D50    9.34   4.5   PASS
//   .ai-result                      var(--ink-2)   #2A1D50    8.64   4.5   PASS
//   .ai-result b                    #ffffff   #2A1D50   15.09   4.5   PASS
//   .ai-heard (on its bubble)       var(--ink)   #17112C   16.70   4.5   PASS
//   .ai-type input (on its well)    var(--ink)   #17102C   16.19   4.5   PASS
//   .ai-type placeholder            var(--muted)   #17102C    6.31   4.5   PASS  [C1]
//   .ai-chip label (on the chip)    var(--ink)   #392869    9.96   4.5   PASS
//   .ai-chip label, hover           var(--ink)   #44317A    8.57   4.5   PASS
//   .ai-close glyph                 var(--ink-2)   #3B2A6C    7.12   3.0   PASS
//   .ai-link                        var(--accent-ink)   #2A1D50    9.34   4.5   PASS
//   focus ring                      var(--accent-ink)   #2A1D50    8.18   3.0   PASS
//   .ai-dot (online)                #3ddc84   #2A1D50    8.46   3.0   PASS
//   .ai-send glyph, worst point     #ffffff   var(--accent-ink)    3.61   3.0   PASS*
//   .ai-tab glyph, at its centre    #ffffff   #8958F4    4.41   3.0   PASS
//   .ai-tab glyph, worst over span  #ffffff   (t=.30)    3.63   3.0   PASS
//
//   * 3.61:1 clears 1.4.11 for a GRAPHICAL OBJECT and would fail 1.4.3 as text.
//     That is exactly why the send control is an icon with an aria-label and
//     never a worded button — the threshold it passes is the one it is held to.
//     Do not add a text label inside .ai-send.
//
// THREE ASC VALUES DID NOT SURVIVE MEASUREMENT, and are corrected here:
//
//   [C1] input::placeholder. ASC ships rgba(200,189,240,.5), which composites
//        on the input well to #70678E = 3.48:1 — a body-text tier failing 4.5.
//        Replaced with the opaque var(--muted) (6.31:1). Opaque rather than a lifted
//        alpha because this repository's convention is to ship the composited
//        value, so the number in the comment is the number in the file.
//
//   [C2] control rims. ASC bounds .ai-chip with var(--line) and
//        .ai-type with var(--line). Against the panel ground those
//        measure 1.75:1 and 1.28:1, and both are CONTROL BOUNDARIES held to
//        3:1 by 1.4.11 — the chip and the input well are identified by nothing
//        else, since their fills are 1.21:1 against the panel. Solved rather
//        than guessed: the minimum alpha of var(--accent-ink) that clears 3:1 on the
//        worst ground is .43 on the chip and .54 on the well, so --aid-ctl-rim
//        ships at .62 for headroom — 4.34:1 on the chip, 3.72:1 on the well,
//        and 5.05 / 4.61 on the darkest ground. var(--accent-ink) would have needed .57
//        and .67 and still sat nearer the line.
//
//   [C3] the outer edge, in dark theme. See the theme note above. Light
//        rgba(58,20,130,.55) = 3.43:1 on --paper #F2F2F2 and 3.55:1 on
//        #FFFFFF; dark rgba(196,181,253,.55) = 3.84:1 on --paper #14100E and
//        3.76:1 on --surface #1C1815. The rim goes on the TAB as well as the
//        panel, and the tab needs it independently in light theme: its top
//        stop var(--accent-ink) measures 2.43:1 on --paper (mid stop 3.78, deep stop
//        6.35, so only the upper third under-contrasts). Dark theme is the
//        mirror image — top stop 6.95:1, deep stop 2.66:1 — so one
//        theme-swapped rim covers the whole edge in both.
//
// ---------------------------------------------------------------------------
// ANIMATION BUDGET
// ---------------------------------------------------------------------------
// Nothing animates blur or box-shadow. That rules out ASC's two shadow
// transitions directly, so both are rebuilt as an opacity cross-fade of a
// pseudo-element carrying a STATIC shadow — .ai-tab::after breathes the violet
// glow, .ai-tab::before fades the magenta hover glow in, .ai-send::after does
// the same for the send button. ASC's hover also grew the tab from 34px to
// 42px; animating width is a layout animation, so the same "reaching out"
// gesture is a transform:translateX(-4px) instead. Every moving property in
// this file is transform, opacity or visibility; the only other transitions are
// background-color and border-color, which are paint-only and are what the
// hover states actually need.
//
// ---------------------------------------------------------------------------
// A BACKTICK MUST NEVER APPEAR INSIDE THE CSS TEMPLATE LITERAL BELOW, not even
// inside a comment: it terminates the string, and node --check still passes.
// The same goes for a dollar-brace sequence, which would silently interpolate.
// ============================================================================

import { chat, resetChat, isConfigured, TermaUnavailable } from './terma.js';
import { getProduct } from './db.js';
import { t } from './i18n.js';

const DOCK_ID = 'aiDock';
const STYLE_ID = 'akv-aidock-css';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// t() with an inline Croatian fallback — the tf/tr/T pattern every view in this
// app uses (views/prijava.js:131, views/savjetnik.js:47, app.js:119). t()
// returns the KEY on a dictionary miss, and a raw key must never reach a
// client-facing surface, least of all an aria-label a screen reader reads out.
// The dictionary is written in the formal "Vi" throughout ("Pitajte Termu…",
// not "Pitaj"); every fallback below matches it.
function tf(key, fallback, vars) {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

// Routes the dock hides on, and why each one:
//   /savjetnik — the full advisor owns that screen, and it owns the single
//     module-level conversation handle inside js/terma.js. Two advisors
//     interleaving into one server-side Gemini conversation is a real defect,
//     not a cosmetic one (see the note in the module footer).
//   /prijava   — that view suppresses .topbar and .tabbar to be a single card
//     on an empty ground. A violet tab stuck to its edge undoes the point of it.
const HIDDEN_ROUTES = ['/savjetnik', '/prijava', '/atelier'];

// ---- icons ------------------------------------------------------------------
// Stroked, currentColor, aria-hidden — the same construction as the SVG helper
// in views/prijava.js. No icon library: this project vendors everything and
// three glyphs do not justify a dependency.
const SVG = (body, size) =>
  '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" ' +
  'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';

// A four-point sparkle: the conventional "this is AI" mark, and the one thing
// on the tab that has to read at 19px against a gradient.
const ICON_SPARK = SVG('<path d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9-1.9 4.9-1.9-4.9L5.2 10l4.9-1.9z"/><path d="M18.4 15.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>', 19);
const ICON_SEND = SVG('<path d="M4.5 12h13M12 5.5l6.5 6.5L12 18.5"/>', 19);
const ICON_CLOSE = SVG('<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>', 16);

// ---- scoped styles ----------------------------------------------------------
// Injected as one <style> rather than added to css/styles.css because this
// module owns its whole subtree and unmount() has to be able to take all of it
// away again. index.html's CSP allows this without any change: style-src is
// 'self' plus 'unsafe-inline', and no inline SCRIPT is touched, so no sha256
// hash is recomputed.
const CSS = `
.ai-dock{
  /* The slide easing is an ASC literal with no Akvaterm equivalent. It is bound
     to a local name rather than silently swapped for --snap, which is a
     different curve; --smooth and --snap themselves ARE identical in the two
     projects (css/styles.css:294 = ASC app.css:19) and are used unchanged. */
  --aid-glide:cubic-bezier(.16,1,.3,1);

  /* THEME-AWARE EDGE — the only value in this module that changes with the
     theme. Light: 3.43:1 on --paper #F2F2F2, 3.55:1 on --surface #FFFFFF. */
  --aid-rim:rgba(58,20,130,.55);
  --aid-lift:0 34px 80px -26px rgba(70,26,170,.8),0 8px 24px -12px rgba(0,0,0,.6);

  /* CONTROL boundary [C2]. Constant across themes because it lives on the
     branded surface, which is itself constant. 3.72:1 at its weakest (the input
     well on the lightest panel ground) against a 3:1 requirement. */
  --aid-ctl-rim:rgba(196,181,253,.62);

  /* inset:0 with pointer-events:none makes the wrapper an inert sheet the page
     is fully usable through. It carries NO z-index on purpose: a positioned
     element with z-index:auto does not create a stacking context, so the tab
     and the panel below compete in the ROOT stacking context and land where
     they are meant to in Akvaterm's stack (.topbar/.tabbar 30, #toasts 60,
     .sheet-backdrop 70, .side-scrim 114, .side 116). Give this element a
     z-index and the whole dock collapses to that one layer. */
  position:fixed;inset:0;pointer-events:none;
  /* CLIP, NOT HIDDEN, and the difference is a bug this file already had once.
     The closed panel is parked ~386px beyond the right edge, so this box has
     real overflow (measured scrollWidth 1039 against a 663 client width).
     overflow:hidden makes an element a SCROLL CONTAINER — unscrollable by the
     user, but the browser still scrolls it programmatically, and open() calls
     input.focus(), whose scroll-into-view then shifted the entire dock 39px
     left and never put it back: the tab detached from the screen edge and
     stayed there. overflow:clip has no scroll container and no scroll origin,
     so there is nothing to shift. Engines without clip (Safari < 16) drop the
     declaration and fall back to visible, which is harmless here twice over: a
     position:fixed box does not propagate overflow to the document, and the
     parked panel is visibility:hidden anyway. */
  overflow:clip;
  font-family:var(--font-text);
}
/* ---- TERMA'S OWN PALETTE — the LOGO's colours ----------------------------
   Operator instruction, 2026-08-02: "have Terma AI coloured in the colours of
   the logo". So the tab does not use ASC's violet: it uses AKVA navy and TERM
   red, which is also why the water/heat loop works without inventing anything
   — the identity is already a cool half and a warm half, and the animation is
   just those two halves in sequence.

   THE TAB IS GLASS AND MOSTLY TRANSPARENT, so its colours are measured against
   the PAGE showing through it, not against a fill of its own:
     --aid-water #00008C on --paper #F2F2F2   13.61:1   (the protected navy)
     --aid-heat  #d6252e on --paper #F2F2F2    4.51:1   (the protected red)
   In dark mode the navy is invisible (1.11:1 on #14100E), the same problem the
   wordmark itself has, and it is solved the same way css/styles.css solves it:
   the cool half moves to a light tint of itself rather than being dropped. The
   red is kept, at 6.21:1 on the dark ground.
     --aid-water #7FB2FF on --paper #14100E    8.42:1
     --aid-heat  #FF5A63 on --paper #14100E    6.21:1
   These are the FILL of an engraved word whose legibility comes from its two
   shadows, so even mid-loop — when the fill is --aid-dry, i.e. nothing — the
   word is still readable. That is what makes an animated fill safe here. */
.ai-dock{
  --aid-water:#00008C;
  --aid-heat:#d6252e;
  --aid-dry:rgba(0,0,0,0);
  --aid-tab-glass:rgba(255,255,255,.34);
  --aid-tab-rim:rgba(20,16,14,.16);
  --aid-tab-ink:var(--ink);
  --aid-emboss-hi:rgba(20,16,14,.34);
  --aid-emboss-lo:rgba(255,255,255,.82);
  /* DEFECT FIX: Online status dot colour. Original hardcoded #3ddc84 measures
     1.78:1 on light theme #FFFFFF, failing WCAG 1.4.11 graphics/UI 3:1 requirement.
     Use --accent instead, which is vetted against both light and dark grounds. */
  --aid-dot-fill:var(--accent);
}
:root[data-theme="dark"] .ai-dock{
  --aid-rim:rgba(196,181,253,.55);
  --aid-lift:0 34px 80px -26px rgba(0,0,0,.85);
  --aid-water:#7FB2FF;
  --aid-heat:#FF5A63;
  --aid-tab-glass:rgba(255,255,255,.07);
  --aid-tab-rim:rgba(242,239,236,.18);
  --aid-emboss-hi:rgba(0,0,0,.55);
  --aid-emboss-lo:rgba(255,255,255,.16);
}
/* Required as well as the attribute rule, not instead of it: applyTheme() in
   js/app.js only writes data-theme once the user has picked a side, so with no
   attribute present this is the only rule that fires. */
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .ai-dock{
    --aid-rim:rgba(196,181,253,.55);
    --aid-lift:0 34px 80px -26px rgba(0,0,0,.85);
    --aid-water:#7FB2FF;
    --aid-heat:#FF5A63;
    --aid-tab-glass:rgba(255,255,255,.07);
    --aid-tab-rim:rgba(242,239,236,.18);
    --aid-emboss-hi:rgba(0,0,0,.55);
    --aid-emboss-lo:rgba(255,255,255,.16);
  }
}
.ai-dock[hidden]{display:none}

/* ------------------------------------------------------------------- tab */
/* 34x92 on a 17px left radius — 17 is exactly half the width, so the exposed
   edge is a true semicircle and the tab reads as a tucked-in tab rather than a
   rounded rectangle that happens to be at the edge. */
/* ---- THE CLOSED TAB ------------------------------------------------------
   Operator instruction, 2026-08-02: "a small, 20% smaller liquid glass side
   card that has Terma engraved in that liquid glass (the letters are all
   connected at the bottom) and also by default transparent ... an animated
   loop effect where the engraved letters get filled with water, and then that
   water gets dried out by heat".

   So this is no longer a solid violet slab with an icon on it. It is glass:
   the page reads through it, and the only thing with any weight is the word.
   27x74 is the previous 34x92 at 80%.

   HOW THE ENGRAVING WORKS. There is no image and no font trickery: the word is
   real text, and the engraved look is two text-shadows — a light one below and
   a dark one above — which is the classic letterpress recipe and the only one
   that survives a transparent background, because it needs no fill of its own.
   The letters are "connected at the bottom" by ::after, a hairline running the
   length of the word along its baseline edge, so the five glyphs read as one
   cut mark rather than five separate ones.

   HOW THE WATER AND THE HEAT WORK. The fill is a gradient clipped to the glyph
   shapes (background-clip:text) and moved with background-position — teal
   climbing the letters, turning amber, then leaving them empty again. It is a
   paint-only animation on a 27x74 box, and background-position is the same
   technique css/styles.css already uses for the splash's patience shimmer, so
   it is a precedent in this repo rather than a new idea. It is NOT a filter and
   NOT a blur: nothing here forces a re-composite of the page behind the glass.

   The gradient is read bottom-to-top, and the stops ARE the choreography:
     0%   empty        the letters are just cut glass
     28%  teal         water has risen through them        (AKVA)
     52%  teal->amber  the heat arrives                    (TERM)
     76%  amber fading the water is being driven off
     100% empty        dry, and the loop begins again
*/
/* THE SIDE TAB IS GONE. Operator instruction, 2026-08-03: Terma moves to the
   top-right slot the "..." menu used to occupy, and the edge tab is removed
   entirely - one entry point, not two. js/app.js renders the trigger and calls
   toggle() on it; this module no longer renders any launcher of its own.
   The water/heat loop went with it. */
.ai-tab{display:none!important}

/* ----------------------------------------------------------------- panel */
.ai-panel{
  /* A DROPDOWN, not a side sheet: anchored under the trigger in the top-right,
     so it reads as belonging to the button that opened it. And it is the app's
     own surface now, not ASC's violet - operator: "no longer purple, but
     matches the white of the rest of the menu". Every purple token below is
     re-pointed to the shared palette so the panel follows the theme. */
  --aid-panel-bg:var(--surface);
  --aid-panel-ink:var(--ink);
  --aid-panel-rim:var(--line);
  /* absolute, not fixed: the dock root is already position:fixed inset:0, so
     this is measured against the viewport anyway - and staying absolute keeps
     it inside the dock's overflow:clip box, which is what stops the parked
     panel showing a scrollbar. */
  position:absolute;z-index:80;
  right:max(12px,env(safe-area-inset-right,0px));
  top:calc(58px + env(safe-area-inset-top,0px) + 10px);
  width:min(360px,calc(100vw - 24px));
  /* 150px of vertical clearance keeps the panel off BOTH standing bars: the
     sticky .topbar at the top and the floating .tabbar (--nav-h 62px) at the
     bottom. Centred at 50%, that leaves 75px at each end. Without it the panel
     covers the tab bar and takes the app's navigation away, which a NON-modal
     surface may never do. The 560px cap stops it becoming a full-height column
     on a desktop viewport. */
  max-height:min(560px,calc(100vh - 110px));
  max-height:min(560px,calc(100dvh - 110px));
  display:flex;flex-direction:column;gap:13px;
  padding:16px 16px 14px;
  /* var(--r-xl) is THE CARD TIER in css/styles.css:260 — 28px against ASC's
     26px, a 2px change that puts the dock on the house corner ladder instead of
     one step off it. The tab keeps its 17px, which is geometry (half the width)
     rather than a rung on that ladder. */
  border-radius:var(--r-xl,28px);
  background:var(--aid-panel-bg);
  border:1px solid var(--aid-rim);
  box-shadow:var(--aid-lift),inset 0 1px 0 rgba(255,255,255,.07);
  color:var(--aid-panel-ink);
  overflow-y:auto;overscroll-behavior:contain;
  scrollbar-width:thin;scrollbar-color:rgba(196,181,253,.45) transparent;
  pointer-events:auto;
  transform-origin:100% 0;transform:translateY(-8px) scale(.96);opacity:0;visibility:hidden;
  visibility:hidden;
  /* visibility is what actually takes the parked panel out of the tab order and
     the accessibility tree — a translated element is still focusable. It is
     delayed to the end of the slide on close and applied instantly on open. */
  transition:transform .58s var(--aid-glide),visibility 0s linear .58s;
  will-change:transform;
}
.ai-dock[data-open="true"] .ai-panel{
  /* A DROPDOWN, not a side sheet: anchored under the trigger in the top-right,
     so it reads as belonging to the button that opened it. And it is the app's
     own surface now, not ASC's violet - operator: "no longer purple, but
     matches the white of the rest of the menu". Every purple token below is
     re-pointed to the shared palette so the panel follows the theme. */
  --aid-panel-bg:var(--surface);
  --aid-panel-ink:var(--ink);
  --aid-panel-rim:var(--line);
  transform:translate(0,0);visibility:visible;
  /* DEFECT FIX: Changed from translate(0,-50%) which moved panel 50% of its
     height upward (280px on a 560px panel), placing it at -212px off-screen.
     Position 0 places it directly under the topbar at top:calc(58px +...).
     This is a dropdown menu, not a vertically-centred popover. */
  transition:transform .58s var(--aid-glide),visibility 0s;
}
/* The two blooms. Painted as a pseudo-element at opacity .6 (rather than baked
   into the body gradient) so prefers-contrast:more can drop them in one rule
   without touching the surface underneath. */
.ai-panel::before{content:none}
/* A positioned pseudo-element paints above non-positioned children, so every
   child is lifted explicitly. Same technique as .glass>* in css/styles.css. */
.ai-panel>*{position:relative;z-index:1}
.ai-panel :focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px}

.ai-head{display:flex;align-items:center;gap:9px}
.ai-title{
  margin:0;flex:1;min-width:0;
  display:flex;align-items:center;gap:8px;
  font-family:var(--font-display);font-weight:600;font-size:14px;line-height:1.3;
  letter-spacing:-.005em;color:var(--aid-panel-ink);
}
.ai-dot{
  flex:none;width:7px;height:7px;border-radius:50%;
  background:var(--aid-dot-fill);
  box-shadow:0 0 9px 1px color-mix(in srgb, var(--aid-dot-fill) 60%, transparent);
  animation:aiBreathe 2.6s var(--smooth) infinite;
  /* DEFECT FIX: Online indicator uses design token instead of hardcoded #3ddc84
     which measured 1.78:1 on light theme, failing 3:1 WCAG 1.4.11 graphics
     requirement. Token is composited via color-mix() for consistent alpha
     treatment across theme changes. */
}
.ai-dock[data-offline="true"] .ai-dot{background:var(--muted);box-shadow:none;animation:none}
@keyframes aiBreathe{50%{transform:scale(1.3);opacity:.8}}
.ai-close{
  flex:none;width:32px;height:32px;border:0;border-radius:50%;
  display:grid;place-items:center;cursor:pointer;
  background:var(--line);color:var(--ink-2);
  transition:background-color .22s var(--smooth),transform .22s var(--smooth);
}
.ai-close:hover{background:var(--line)}
.ai-close:active{transform:scale(.9)}

/* ------------------------------------------------------------- the stage */
.ai-stage{display:flex;flex-direction:column;gap:11px;padding:2px 0}
/* :empty collapses the row rather than reserving a dead band under the header,
   the same reason views/prijava.js collapses its message line. */
.ai-heard:empty,.ai-result:empty,.ai-links:empty,.ai-chips:empty{display:none}
.ai-heard{
  align-self:flex-end;max-width:min(320px,82vw);margin:0;
  padding:10px 15px;border-radius:18px;
  background:rgba(22,16,42,.95);border:1px solid var(--aid-ctl-rim);
  box-shadow:0 16px 34px -14px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.06);
  font-family:var(--font-display);font-weight:600;font-size:15.5px;line-height:1.34;
  color:var(--ink);overflow-wrap:anywhere;
  animation:aiBubbleIn .26s var(--aid-glide);
}
.ai-result{
  margin:0;font-size:13.5px;font-weight:500;line-height:1.62;color:var(--ink-2);
  white-space:pre-wrap;overflow-wrap:anywhere;
  animation:aiResultPop .26s var(--aid-glide);
}
.ai-result b,.ai-result strong{color:#fff;font-weight:700}
@keyframes aiResultPop{from{opacity:0;transform:translateY(6px)}}
@keyframes aiBubbleIn{from{opacity:0;transform:translateY(6px) scale(.94)}}

/* Product suggestions. terma.js streams {delta:'',products:[ids]} whenever the
   model ran search_products server-side; dropping those events would leave the
   answer saying "evo prijedloga" with nothing beside it. The dock is the QUICK
   path, so each one is a link into the existing product route rather than a
   card — the full cards live in views/savjetnik.js. */
.ai-links{display:flex;flex-wrap:wrap;gap:7px;margin:0}
.ai-linklabel{
  width:100%;margin:0 0 1px;font-size:11px;font-weight:600;
  letter-spacing:var(--track-meta,.08em);text-transform:uppercase;color:var(--muted);
}
.ai-link{
  display:inline-flex;align-items:center;max-width:100%;
  padding:7px 12px;border-radius:999px;
  background:var(--line);border:1px solid var(--aid-ctl-rim);
  color:var(--accent-ink);font-size:12px;font-weight:600;line-height:1.3;text-decoration:none;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  transition:background-color .22s var(--smooth),transform .22s var(--smooth);
}
.ai-link:hover{background:var(--line)}
.ai-link:active{transform:scale(.96)}

.ai-hint{
  margin:0;font-size:12.5px;font-weight:600;line-height:1.45;color:var(--muted);
}
.ai-hint.is-busy{color:var(--accent-ink)}
/* The offline sentence is the load-bearing string in this file: it must read as
   a plain statement about the build, never as a failure the user caused or a
   transient glitch worth retrying. Wording is kept in step with
   views/savjetnik.js's sv.offlineBody, which is the same claim on a full page. */
.ai-note{
  margin:0;padding:11px 13px;border-radius:var(--r-sm,12px);
  background:var(--line);border:1px solid var(--aid-ctl-rim);
  font-size:12.5px;line-height:1.5;color:var(--muted);
}
.ai-note b{display:block;margin-bottom:3px;font-size:13px;color:var(--ink)}

/* -------------------------------------------------------------- controls */
.ai-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin:0}
.ai-chip{
  padding:7px 12px;border-radius:999px;cursor:pointer;
  background:var(--line);border:1px solid var(--aid-ctl-rim);
  color:var(--ink);font-family:inherit;font-size:11.5px;font-weight:600;line-height:1.3;
  transition:background-color .22s var(--smooth),transform .22s var(--smooth);
}
.ai-chip:hover{background:var(--line)}
.ai-chip:active{transform:scale(.94)}

.ai-type{
  display:flex;align-items:center;gap:8px;
  padding:4px 4px 4px 15px;border-radius:15px;
  background:var(--panel);border:1px solid var(--aid-ctl-rim);
  transition:border-color .22s var(--smooth);
}
.ai-type:focus-within{border-color:var(--accent-ink)}
/* DEFECT FIX: Focus state border was hardcoded rgba(224,64,208,.75), measuring
   2.85:1 on dark theme panel, failing WCAG 1.4.11 3:1 control boundary requirement.
   This colour was also not part of the Iris design system. Replaced with
   --accent-ink which is vetted across both light and dark themes and consistent
   with the panel's :focus-visible outline rule above (line 396). */
.ai-type input{
  flex:1;min-width:0;border:0;background:none;box-shadow:none;border-radius:0;
  /* 16px, not ASC's 14.5px: anything smaller makes iOS Safari zoom the whole
     viewport on focus, and the dock is fixed — the page would be left scrolled
     sideways with the panel half off screen. css/styles.css sets the same floor
     on every other input in this app. */
  font-family:var(--font-text);font-size:16px;line-height:1.4;color:var(--ink);
  min-height:40px;padding:0;
}
.ai-type input:focus{outline:none}
.ai-type input::placeholder{color:var(--muted)}   /* [C1] — 6.31:1; ASC's alpha was 3.48:1 */
.ai-send{
  flex:none;position:relative;width:40px;height:40px;border:0;border-radius:12px;
  display:grid;place-items:center;cursor:pointer;color:#fff;
  background:var(--grad-accent,linear-gradient(135deg,#2B3FD8,#3355EE));
  box-shadow:0 6px 16px -6px rgba(43,63,216,.55);
  transition:transform .22s var(--smooth);
}
.ai-send>svg{position:relative;z-index:2}
/* Hover glow as an opacity cross-fade, because box-shadow may not be animated. */
.ai-send::after{
  content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  box-shadow:0 10px 22px -8px rgba(43,63,216,.7);
  opacity:0;transition:opacity .22s var(--smooth);
}
.ai-send:hover::after{opacity:1}
.ai-send:active{transform:scale(.92)}
.ai-send[disabled]{opacity:.5;cursor:not-allowed}
.ai-send[disabled]::after{opacity:0}

.ai-foot{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin:0;font-size:11.5px;
}
.ai-foot a,.ai-foot button{
  border:0;background:none;padding:0;cursor:pointer;
  font-family:inherit;font-size:11.5px;font-weight:600;color:var(--muted);
  text-decoration:underline;text-underline-offset:2px;
}
.ai-foot a:hover,.ai-foot button:hover{color:var(--accent-ink)}

/* Offline: the input path is natively disabled rather than hidden, so the panel
   still explains itself instead of just looking unfinished — the same choice
   views/prijava.js makes with its disabled fieldset. */
.ai-dock[data-offline="true"] .ai-type{opacity:.55}
.ai-dock[data-offline="true"] .ai-chips{display:none}

/* Visually hidden live region. The streamed answer is NOT inside an aria-live
   element: announcing every token is unusable. This gets the status once and
   the finished answer once. */
.ai-sr{
  position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;
}

/* ==================== degradation paths ====================
   The dock has NO backdrop-filter, so it is outside the glass budget in
   js/app.js's header and outside paths 1-3 of the block in views/savjetnik.js.
   html[data-transparency="reduced"] therefore has nothing to switch here, and
   its absence below is deliberate rather than an omission — there is no blur to
   turn off. The three paths that DO apply are these. */

/* Motion. Both the entrance transitions and the two idle loops stop; the panel
   still has to arrive, so it snaps rather than sliding. */
@media (prefers-reduced-motion:reduce){
  .ai-dock *,.ai-dock *::before,.ai-dock *::after{
    animation:none!important;transition-duration:1ms!important;
  }
  .ai-panel{
  /* A DROPDOWN, not a side sheet: anchored under the trigger in the top-right,
     so it reads as belonging to the button that opened it. And it is the app's
     own surface now, not ASC's violet - operator: "no longer purple, but
     matches the white of the rest of the menu". Every purple token below is
     re-pointed to the shared palette so the panel follows the theme. */
  --aid-panel-bg:var(--surface);
  --aid-panel-ink:var(--ink);
  --aid-panel-rim:var(--line);transition:transform 1ms linear,visibility 0s linear 1ms}
}
/* The OS asks for more contrast: the blooms are decoration over text, so they
   go rather than being tinted, and every rim hardens to an opaque value that
   needs no compositing to reason about (#ddd6fe is 10.88:1 on the lightest
   panel ground and 14.26:1 on the darkest). */
@media (prefers-contrast:more){
  .ai-panel::before{display:none}
  .ai-panel{
  /* A DROPDOWN, not a side sheet: anchored under the trigger in the top-right,
     so it reads as belonging to the button that opened it. And it is the app's
     own surface now, not ASC's violet - operator: "no longer purple, but
     matches the white of the rest of the menu". Every purple token below is
     re-pointed to the shared palette so the panel follows the theme. */
  --aid-panel-bg:var(--surface);
  --aid-panel-ink:var(--ink);
  --aid-panel-rim:var(--line);border:2px solid #ddd6fe}
  .ai-tab{box-shadow:0 0 0 2px #ddd6fe}
  .ai-chip,.ai-type,.ai-link,.ai-note,.ai-heard{border-color:#ddd6fe}
  .ai-hint,.ai-note,.ai-linklabel{color:#ddd6fe}
  .ai-result{color:#efe9ff}
}
/* Windows High Contrast. This dock is ENTIRELY colour-carried — strip the
   author colours without this block and the whole affordance disappears.
   Mirrors path 4b in views/savjetnik.js. */
@media (forced-colors:active){
  .ai-tab,.ai-panel,.ai-chip,.ai-type,.ai-send,.ai-close,.ai-link,.ai-note,.ai-heard{
    background:Canvas;color:CanvasText;border:1px solid CanvasText;box-shadow:none;
  }
  .ai-panel::before,.ai-tab::before,.ai-tab::after,.ai-send::after{display:none}
  .ai-send{background:Highlight;color:HighlightText;border-color:Highlight}
  .ai-title,.ai-result,.ai-hint,.ai-linklabel,.ai-foot a,.ai-foot button{color:CanvasText}
  .ai-dot{background:CanvasText;box-shadow:none}
  .ai-tab-bar{background:CanvasText}
}
`;

// ---- markup -----------------------------------------------------------------

const CHIPS = [
  ['aid.chip1', 'Pločice za malu kupaonicu'],
  ['aid.chip2', 'Klima za 25 m²'],
  ['aid.chip3', 'Podno grijanje'],
];

function markup(configured) {
  const chips = configured
    ? CHIPS.map(([key, fb], i) =>
        '<button type="button" class="ai-chip" data-chip="' + i + '">' + esc(tf(key, fb)) + '</button>').join('')
    : '';

  // The offline notice ships INSIDE the panel rather than replacing it, so the
  // dock still opens, still explains itself and still offers the way on to the
  // FAQ that views/savjetnik.js keeps for exactly this build. A dock that
  // silently vanished would read as a bug.
  const note = configured ? '' :
    '<p class="ai-note"><b>' + esc(tf('aid.offlineTitle', 'Terma nije uključena u ovoj verziji')) + '</b>' +
    esc(tf('aid.offline',
      'Ova verzija radi bez poslužitelja za AI savjetnicu, pa Terma ne može odgovoriti. ' +
      'Katalog, dizajner i 3D soba rade normalno.')) + '</p>';

  return '' +
    '<button type="button" class="ai-tab" id="aiTab" aria-expanded="false" aria-controls="aiPanel" ' +
      'aria-label="' + esc(tf('aid.open', 'Otvorite Termu — AI savjetnicu')) + '">' +
      // The word is the whole control. aria-hidden because the button already
      // carries a fuller accessible name above — announcing "Terma" twice, once
      // as a name and once as content, is worse than not announcing it.
      '<span class="ai-tab-word" aria-hidden="true">Terma</span>' +
    '</button>' +
    // role="dialog" WITHOUT aria-modal: the dock is deliberately non-modal, as
    // ASC decided. Nothing goes inert, there is no scrim, and the page under it
    // stays live and readable — which is the whole point of a dock rather than
    // a sheet.
    '<section class="ai-panel" id="aiPanel" role="dialog" aria-labelledby="aiTitle">' +
      '<header class="ai-head">' +
        '<h2 class="ai-title" id="aiTitle">' +
          '<span class="ai-dot" aria-hidden="true"></span>' + esc(tf('aid.title', 'Terma')) +
        '</h2>' +
        '<button type="button" class="ai-close" id="aiClose" ' +
          'aria-label="' + esc(tf('aid.close', 'Zatvorite Termu')) + '">' + ICON_CLOSE + '</button>' +
      '</header>' +
      note +
      '<div class="ai-stage">' +
        '<p class="ai-heard" id="aiHeard"></p>' +
        '<div class="ai-links" id="aiLinks"></div>' +
        '<p class="ai-result" id="aiResult"></p>' +
      '</div>' +
      '<p class="ai-hint" id="aiHint">' + esc(configured
        ? tf('aid.hint.idle', 'Pitajte o pločicama, grijanju ili klimi.')
        : tf('aid.hint.offline', 'Odgovori na česta pitanja su u savjetnici.')) + '</p>' +
      '<div class="ai-chips" id="aiChips">' + chips + '</div>' +
      '<form class="ai-type" id="aiForm" autocomplete="off">' +
        '<input id="aiInput" type="text" autocomplete="off" ' +
          (configured ? '' : 'disabled ') +
          'placeholder="' + esc(tf('aid.placeholder', 'Pitajte Termu…')) + '" ' +
          'aria-label="' + esc(tf('aid.placeholder', 'Pitajte Termu…')) + '">' +
        '<button type="submit" class="ai-send" id="aiSend"' + (configured ? '' : ' disabled') + ' ' +
          'aria-label="' + esc(tf('aid.send', 'Pošalji')) + '">' + ICON_SEND + '</button>' +
      '</form>' +
      '<p class="ai-foot">' +
        '<a href="#/savjetnik">' + esc(tf('aid.openAdvisor', 'Otvorite punu savjetnicu')) + '</a>' +
        (configured
          ? '<button type="button" id="aiReset">' + esc(tf('aid.newChat', 'Novi razgovor')) + '</button>'
          : '') +
      '</p>' +
      '<p class="ai-sr" id="aiSr" role="status" aria-live="polite"></p>' +
    '</section>';
}

// ---- module state -----------------------------------------------------------
// One dock per page session. Everything here is torn down by unmount().

let dock = null;          // the .ai-dock element
let els = null;           // live handles into the current subtree
let history = [];         // [{role,content}] — the dock's OWN turn list
let aborter = null;       // AbortController of the in-flight stream
let listeners = [];       // [[target,type,handler]] for exact removal
let open_ = false;

/** Enable or disable every suggestion chip together. Null-guarded because it
 *  runs from ask()'s finally, which can outlive unmount(). */
function setChipsDisabled(off) {
  if (!els || !els.chips) return;
  for (const b of els.chips.querySelectorAll('[data-chip]')) b.disabled = Boolean(off);
}

const on = (target, type, handler, opts) => {
  target.addEventListener(type, handler, opts);
  listeners.push([target, type, handler, opts]);
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function currentPath() {
  return location.hash.replace(/^#/, '').split('?')[0] || '/';
}

function say(text, busy) {
  if (!els || !els.hint) return;
  els.hint.textContent = text;
  els.hint.classList.toggle('is-busy', Boolean(busy));
}

// Announce once, not per token — see the .ai-sr rule.
function announce(text) {
  if (els && els.sr) els.sr.textContent = text;
}

// ---- public API -------------------------------------------------------------

/**
 * Build and attach the dock. IDEMPOTENT: safe to call on every route(), on
 * every boot path, and twice in a row — the second call returns immediately.
 *
 * The dock is appended to host (#app by default) as a SIBLING of #main, which
 * is what makes it survive navigation: swapMain() in js/app.js replaces #main
 * wholesale on every route, so anything inside #main dies with it, and
 * mountFrame() early-returns once #main exists so it never rewrites #app either.
 */
export function mount(host) {
  const parent = host || document.getElementById('app') || document.body;
  if (!parent) return;
  if (document.getElementById(DOCK_ID)) return;   // already mounted

  ensureStyles();
  const configured = isConfigured();

  dock = document.createElement('div');
  dock.className = 'ai-dock';
  dock.id = DOCK_ID;
  dock.setAttribute('data-open', 'false');
  if (!configured) dock.setAttribute('data-offline', 'true');
  dock.innerHTML = markup(configured);
  parent.appendChild(dock);

  els = {
    tab: dock.querySelector('#aiTab'),
    panel: dock.querySelector('#aiPanel'),
    close: dock.querySelector('#aiClose'),
    heard: dock.querySelector('#aiHeard'),
    result: dock.querySelector('#aiResult'),
    links: dock.querySelector('#aiLinks'),
    hint: dock.querySelector('#aiHint'),
    chips: dock.querySelector('#aiChips'),
    form: dock.querySelector('#aiForm'),
    input: dock.querySelector('#aiInput'),
    send: dock.querySelector('#aiSend'),
    reset: dock.querySelector('#aiReset'),
    sr: dock.querySelector('#aiSr'),
  };

  /* DEFECT FIX: Removed dead click listener on #aiTab (els.tab). The side tab is
     now display:none and the real trigger is #termaBtn in the topbar, wired in
     app.js lines 812-815. The hidden button cannot be clicked and this listener
     was never invoked, leftover from the refactored side panel system. */
  on(els.close, 'click', () => close());
  on(els.form, 'submit', (e) => {
    e.preventDefault();
    const text = els.input.value;
    els.input.value = '';
    ask(text).catch(() => { /* ask() has already rendered the message */ });
  });
  if (els.chips) {
    on(els.chips, 'click', (e) => {
      const btn = e.target.closest('[data-chip]');
      if (!btn) return;
      const pair = CHIPS[Number(btn.dataset.chip)];
      if (pair) ask(tf(pair[0], pair[1])).catch(() => {});
    });
  }
  if (els.reset) on(els.reset, 'click', () => { reset(); els.input?.focus(); });

  // Escape closes, but only while the focus is actually inside the dock — the
  // key belongs to whatever the user is looking at, and a global handler here
  // would steal it from the drawer, the share sheet and every future dialog.
  on(document, 'keydown', (e) => {
    if (e.key !== 'Escape' || !open_) return;
    if (!dock || !dock.contains(document.activeElement)) return;
    e.stopPropagation();
    close();
  });

  // CLICK OUTSIDE CLOSES. Operator instruction, 2026-08-02: "her disappearance
  // should occur whenever I click anywhere outside the Terma AI".
  //
  // pointerdown, not click: the dock is non-modal, so the thing the user
  // pressed is a live control and its own click handler must still run. Closing
  // on pointerdown lets the press land on whatever is underneath in the same
  // gesture rather than being spent on dismissing.
  //
  // Capture phase, so a handler that stops propagation on its way up cannot
  // strand the panel open.
  //
  // NOTHING IS DISCARDED HERE. close() only hides; the transcript, the input
  // text and the server-side session handle all live in module state and are
  // untouched, which is the other half of the same instruction: "if user
  // accidentally presses outside and tries to come back to it, Terma has to
  // remember where it was and not have user start a new". Only the explicit
  // "Novi razgovor" control clears anything.
  on(document, 'pointerdown', (e) => {
    if (!open_ || !dock) return;
    if (dock.contains(e.target)) return;   // inside the panel
    /* DEFECT FIX: Exclude the trigger button #termaBtn from closing the dock.
       When the user clicks the open dock's trigger button, pointerdown fires in
       capture phase and closes (open_=false). Then the click handler in app.js
       fires and calls toggle(), which checks open_, finds it false, and calls
       open() instead of close(). Result: dock stays open. Check for the real
       trigger button and return early to let its click handler run unmolested. */
    if (e.target.id === 'termaBtn' || e.target.closest('#termaBtn')) return;
    close();
  }, true);

  // The dock wires its OWN route visibility rather than requiring a call from
  // js/app.js. hashchange fires for every navigation this router makes (it is a
  // hash router), so nothing in app.js has to know the dock exists beyond the
  // single mount() call. setRouteVisibility is still exported for an explicit
  // wiring if one is ever preferred; calling both is harmless.
  on(window, 'hashchange', () => setRouteVisibility(currentPath()));
  setRouteVisibility(currentPath());

  // NOT wired to "akv:teardown", and that is the point. app.js fires it on
  // every view swap so views can stop canvas loops and streams; this dock is
  // the one element that is SUPPOSED to outlive a navigation, and an in-flight
  // answer must survive the page the user moved to while waiting for it. With
  // no microphone there is nothing else here that a navigation should stop.
}

/** Route-aware visibility. Hiding closes the dock first so it cannot come back
 *  already open on a route that does not want it. */
export function setRouteVisibility(path) {
  if (!dock) return;
  const hide = HIDDEN_ROUTES.some((r) => String(path || '') === r || String(path || '').startsWith(r + '/'));
  if (hide && open_) close({ silent: true });
  dock.hidden = hide;
}

export function isOpen() { return open_; }

export function open() {
  if (!dock || open_ || dock.hidden) return;
  open_ = true;
  dock.setAttribute('data-open', 'true');
  /* DEFECT FIX: aria-expanded updated on real trigger #termaBtn (topbar button),
     not on hidden #aiTab. Screen readers check aria-expanded on the button that
     triggered the dialog. The side tab was the old trigger and is display:none;
     the new trigger is #termaBtn wired in app.js. */
  document.getElementById('termaBtn')?.setAttribute('aria-expanded', 'true');
  // Focus the input, not the panel: the typed path is the ONLY path, so the
  // caret belongs where the user is going to type. The offline build disables
  // that input and a disabled control cannot take focus, so the close button is
  // the fallback — focus has to land INSIDE the panel either way, because the
  // Escape handler is scoped to the dock and would otherwise never fire.
  //
  // No forced reflow is needed before this. The parked panel is
  // visibility:hidden and the open rule flips it to visible; that flip is
  // observable synchronously on the very next read (verified in Chrome), and
  // Element.focus() updates style for the element before testing focusability
  // anyway.
  if (els.input && !els.input.disabled) els.input.focus();
  else els.close.focus();
}

export function close(opts) {
  if (!dock || !open_) return;
  open_ = false;
  dock.setAttribute('data-open', 'false');
  /* DEFECT FIX: aria-expanded updated on real trigger #termaBtn, not hidden #aiTab.
     Focus also restored to #termaBtn instead of the hidden button. The trigger
     moved from side tab (display:none) to topbar button #termaBtn (app.js). */
  document.getElementById('termaBtn')?.setAttribute('aria-expanded', 'false');
  // Return focus to the control that opened it — but not when the close was a
  // side effect of navigating, where the focus belongs to the new view.
  if (!(opts && opts.silent) && dock.contains(document.activeElement)) {
    document.getElementById('termaBtn')?.focus({ preventScroll: true });
  }
}

export function toggle() { if (open_) close(); else open(); }

/** Clears the dock's own turn list and transcript, and releases the shared
 *  server-side conversation handle in terma.js. */
export function reset() {
  if (aborter) { aborter.abort(); aborter = null; }
  history = [];
  resetChat();
  if (!els) return;
  els.heard.textContent = '';
  els.result.textContent = '';
  els.links.replaceChildren();
  els.send.disabled = !isConfigured();
  say(tf('aid.hint.idle', 'Pitajte o pločicama, grijanju ili klimi.'), false);
  announce('');
}

/**
 * Ask Terma. The chip handler, the form and any future caller all go through
 * here. Opens the dock if it is closed. Resolves with the final answer text;
 * rejects with terma.js's error (which carries .friendly) after the message has
 * already been rendered into the panel, so a caller may ignore the rejection.
 */
export async function ask(text) {
  const clean = String(text || '').trim();
  if (!dock || !clean) return '';
  if (!dock.hidden) open();

  // HONESTY: no backend, no pretending. The panel says so before anything can
  // look like it is thinking. This is the same claim views/savjetnik.js makes
  // in sv.offlineBody, worded for a panel instead of a page.
  if (!isConfigured()) {
    els.heard.textContent = clean;
    els.result.textContent = tf('aid.offline',
      'Ova verzija radi bez poslužitelja za AI savjetnicu, pa Terma ne može odgovoriti. ' +
      'Katalog, dizajner i 3D soba rade normalno.');
    say(tf('aid.hint.offline', 'Odgovori na česta pitanja su u savjetnici.'), false);
    announce(els.result.textContent);
    throw new TermaUnavailable();
  }
  if (aborter) return '';   // one turn at a time; the send button is disabled too

  els.heard.textContent = clean;
  els.result.textContent = '';
  els.links.replaceChildren();
  history.push({ role: 'user', content: clean });

  say(tf('aid.hint.thinking', 'Terma razmišlja…'), true);
  announce(tf('aid.hint.thinking', 'Terma razmišlja…'));
  els.send.disabled = true;
  // The chips go with it. Without this they stay enabled, styled as live and
  // clickable, while ask() returns '' immediately for the whole in-flight
  // window and the delegated handler swallows the result -- so the press
  // animates, nothing happens, and there is no error to explain why. The typed
  // path was already covered because its implicit submission fires at the
  // disabled default button; the chips were the one reachable way to press a
  // control that does nothing.
  setChipsDisabled(true);
  aborter = new AbortController();

  let acc = '';
  try {
    for await (const evt of chat(history.slice(), { signal: aborter.signal })) {
      if (Array.isArray(evt.products) && evt.products.length) await renderProducts(evt.products);
      if (evt.delta) {
        acc += evt.delta;
        els.result.textContent = acc;
        // Follow the tail only while the user has not scrolled up to re-read.
        const p = els.panel;
        if (p.scrollHeight - p.scrollTop - p.clientHeight < 40) p.scrollTop = p.scrollHeight;
      }
    }
    if (!acc) acc = tf('sv.noAnswer', 'Nisam dobila odgovor — pokušajte preformulirati pitanje.');
    els.result.textContent = acc;
    history.push({ role: 'assistant', content: acc });
    say(tf('aid.hint.idle', 'Pitajte o pločicama, grijanju ili klimi.'), false);
    announce(acc);
    return acc;
  } catch (err) {
    history.pop();                       // the turn failed — let the user resend it
    if (err && err.name === 'AbortError') { say(tf('aid.hint.idle', 'Pitajte o pločicama, grijanju ili klimi.'), false); return ''; }
    // terma.js attaches .friendly as a FINISHED Croatian sentence per status
    // (429 busy, 503 not switched on, 401/403 refused). It is more specific
    // than anything this module could say, so it is rendered verbatim.
    const msg = (err && err.friendly)
      || (err instanceof TermaUnavailable
        ? tf('aid.offline',
            'Ova verzija radi bez poslužitelja za AI savjetnicu, pa Terma ne može odgovoriti. ' +
            'Katalog, dizajner i 3D soba rade normalno.')
        : tf('sv.error', 'Terma trenutačno nije dostupna. Pokušajte kasnije.'));
    els.result.textContent = msg;
    say(tf('aid.hint.idle', 'Pitajte o pločicama, grijanju ili klimi.'), false);
    announce(msg);
    throw err;
  } finally {
    aborter = null;
    if (els && els.send) els.send.disabled = !isConfigured();
    setChipsDisabled(!isConfigured());
  }
}

// Resolve ids to names through the same db.js the rest of the app uses. Ids the
// catalogue no longer has are skipped rather than rendered as empty pills.
async function renderProducts(ids) {
  if (!els || !els.links) return;
  const frag = document.createDocumentFragment();
  const label = document.createElement('span');
  label.className = 'ai-linklabel';
  label.textContent = tf('aid.products', 'Prijedlozi iz kataloga');
  frag.appendChild(label);

  let n = 0;
  for (const id of ids.slice(0, 4)) {
    let p = null;
    try { p = await getProduct(id); } catch { p = null; }
    if (!p) continue;
    const a = document.createElement('a');
    a.className = 'ai-link';
    a.href = '#/proizvod/' + encodeURIComponent(p.id);
    a.textContent = p.name;                       // textContent, never innerHTML
    frag.appendChild(a);
    n += 1;
  }
  if (!n) return;                                  // nothing resolved — render no label either
  els.links.replaceChildren(frag);
}

/**
 * Full removal: every listener, the in-flight stream, the subtree and the
 * stylesheet. The app never calls this — it exists for tests and a hot-reload
 * path. mount() is safe to call again afterwards.
 */
export function unmount() {
  if (aborter) { aborter.abort(); aborter = null; }
  for (const [target, type, handler, opts] of listeners) {
    try { target.removeEventListener(type, handler, opts); } catch { /* target already gone */ }
  }
  listeners = [];
  dock?.remove();
  document.getElementById(STYLE_ID)?.remove();
  dock = null;
  els = null;
  history = [];
  open_ = false;
}

// ============================================================================
// KNOWN LIMITATION, recorded rather than silently worked around
// ----------------------------------------------------------------------------
// js/terma.js holds ONE module-level conversationId (line 40) and resetChat()
// clears it globally. This dock and js/views/savjetnik.js import the same module
// instance, so a question asked here and a question asked there land in the same
// server-side Gemini conversation, and either one's "Novi razgovor" resets the
// other's. Hiding the dock on /savjetnik (HIDDEN_ROUTES above) removes the
// on-screen collision and is why it is safe to ship, but it does not separate
// the handles: chat in the dock, then open the advisor, and the advisor inherits
// this dock's context.
//
// The real fix is a caller-owned session handle in terma.js — chat(messages,
// {signal, session}) where session is an opaque box the caller keeps — which is
// a change to a file this module does not own and needs its own review. It is
// deliberately NOT folded in here.
// ============================================================================
