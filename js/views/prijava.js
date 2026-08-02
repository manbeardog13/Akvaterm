// ============================================================================
// views/prijava.js — the sign-in screen (#/prijava).
//
// Modelled on ASC's app/login.html: one centred card on a calm ground, the
// wordmark above it, a clear primary action, inline validation and a
// visible-but-not-alarming error line. Rendered in this app's Iris skin, in
// Croatian, inside the hash router rather than as a separate HTML page.
//
// ---------------------------------------------------------------------------
// WHAT IS REAL HERE, AND WHAT IS NOT — read this before changing any copy
// ---------------------------------------------------------------------------
// The public demo (https://manbeardog13.github.io/Akvaterm/) has NO accounts.
// js/config.js ships empty, so js/supabaseClient.js never creates a client and
// nothing in the app can check a password. This screen is therefore written to
// be truthful in two different deployments:
//
//   • CONFIG empty  — the card states plainly that sign-in is not switched on
//     in this build, the form is rendered but natively disabled (a <fieldset
//     disabled>, so the controls are not even focusable), and the ONLY enabled
//     primary action is "Nastavi kao gost", which walks straight into the
//     catalogue. Anyone who opens the public link reaches the app. This screen
//     is never a wall: it is not a gate on any route, no other view consults a
//     session, and there is no redirect into it from anywhere.
//
//   • CONFIG filled in — the form posts to supabase.auth.signInWithPassword()
//     through db.js's signIn(), and a success navigates to the catalogue.
//     THIS PATH IS UNTESTED ON THIS MACHINE, because there is no project to
//     point it at. It mirrors ASC's shipped call shape; that is a reasoned
//     claim, not an observed one.
//
// What signing in does NOT do, in either deployment: it does not sync
// favorites or designs. db.js mirrors WRITES to Supabase when a client exists
// and has never read them back, so the local store is still the only store.
// No string in js/i18n.js promises otherwise, and none should be added.
//
// ---------------------------------------------------------------------------
// CHROME SUPPRESSION — why this view touches <html>
// ---------------------------------------------------------------------------
// ASC's login is a single card on an empty ground, and the Akvaterm chrome
// would put a SECOND wordmark in the top bar directly above the card's own.
// So the view sets data-akv-auth on <html> and its scoped sheet hides .topbar
// and .tabbar for this route only. That attribute is a liability if it ever
// outlives the view — the whole app would lose its navigation — so it is
// cleared THREE ways, and the redundancy is deliberate:
//
//   1. teardown(), which js/app.js calls on the next navigation;
//   2. a module-level "akv:teardown" listener, which app.js fires on EVERY
//      navigation, including the ones where a view threw and app.js painted
//      its error card instead;
//   3. it is only ever SET after the markup is already in the document, so a
//      render that fails before that point never sets it at all.
//
// The card keeps its own way out regardless: "Nastavi kao gost" is an ordinary
// <a href="#/">, so it works even if every listener in this file failed to
// attach.
//
// ---------------------------------------------------------------------------
// GLASS BUDGET AND CONTRAST
// ---------------------------------------------------------------------------
// The card is .glass-strong from css/styles.css — a shared recipe, so it
// already carries all five degradation paths (@supports, prefers-reduced-
// transparency, html[data-transparency="reduced"], prefers-contrast /
// forced-colors, prefers-reduced-motion) and the guard rail that rebinds
// --muted / --ink-2 / --accent-ink / --accent-2-ink / --danger-ink / --ok-ink
// to their proven on-glass equivalents. This view invents no colour of its
// own; every value below is a token. Because .topbar and .tabbar are hidden on
// this route, the card is the ONLY backdrop-filter surface on screen — one,
// against a budget of two to three.
//
// Contrast, computed with the WCAG 2.x relative-luminance formula against the
// worst-case composite this system requires (the glass tint hsl(187 44% 97%)
// at --glass-alpha-strong .88 over a PURE BLACK backdrop = #D7DCDD), not
// against the ground it actually gets here (over --paper = #F4F9FA, which is
// lighter and scores higher on every row):
//
//   --ink              #313131 on #D7DCDD   9.40:1   title, input text
//   --glass-ink-muted  #5C4B51 on #D7DCDD   5.88:1   sub, labels, notes
//   --accent-on-glass  #0B5863 on #D7DCDD   5.86:1   eyebrow
//   --warm-on-glass    #744412 on #D7DCDD   5.88:1   notice heading
//   --danger-on-glass  #972417 on #D7DCDD   5.88:1   field + form errors
//   --ok-on-glass      #0F5B32 on #D7DCDD   5.92:1   success line
//
// The two panels inset inside the card paint --glass-wash (white at .42), so
// they LIGHTEN the composite to #E8EBEB in that same worst case:
//   --warm-on-glass    #744412 on #E8EBEB   6.79:1   notice heading
//   --glass-ink-muted  #5C4B51 on #E8EBEB   6.79:1   notice body, account email
//   --ink              #313131 on #E8EBEB  10.85:1   account row name
//
// Controls carry their own opaque ground, so they are measured against it:
//   --ink              #313131 on --surface #FFFFFF 13.01:1  input text
//   --glass-ink-muted  #5C4B51 on #FFFFFF    8.14:1  placeholders, field icons
//   --glass-ink-muted  #5C4B51 on --panel #E7E5E6  6.49:1  disabled field
//   --ink              #313131 on --panel #E7E5E6 10.38:1  disabled field value
//   #FFFFFF on --teal-700 #0D707D            5.78:1  primary button, light stop
//   #FFFFFF on --teal-800 #0B5A65            7.88:1  primary button, deep stop
//   #FFFFFF on --accent  (avatar initial)    5.78:1
//
// The wordmark sits OUTSIDE the card, on the page ground, and keeps its
// protected colours untouched (docs/DESIGN_SYSTEM.md, "Wordmark — EXEMPT"):
//   --logo-navy #00008C on --paper #F2F2F2                    13.61:1
//   --logo-red  #d6252e on --paper #F2F2F2                     4.51:1
//   --logo-navy on the warmest point of the ambient wash       11.88:1
//   --logo-red  on the warmest point of the ambient wash        3.93:1
// The mark is set at clamp(30px, 8.5vw, 38px) weight 800, so the 3:1
// large-text threshold applies and the red clears it on every ground the
// ambient can produce. (WCAG 1.4.3 exempts brand marks anyway; the numbers are
// recorded so the claim is checkable rather than assumed.)
//
// The notice and the account row paint --glass-wash (white, rgba(255,255,255,
// .42)) rather than a colour tint, because a tint painted ON glass must
// LIGHTEN it — a coloured tint darkens the composite and drops the text tiers
// below AA. That is the same technique the two standing bars use.
//
// ---------------------------------------------------------------------------
// A backtick must never appear inside the template literals below, not even in
// a comment: it terminates the string, and node --check still passes.
// ============================================================================

import { t } from "../i18n.js";
import {
  authConfigured, getSession, signIn, signInWithGoogle, signOut,
  rememberedEmail, rememberEmail,
} from "../db.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// t() with an inline Croatian fallback — a missing dictionary key must never
// leak a raw key onto a client-facing screen.
function tf(key, fallback, vars) {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

const AUTH_ATTR = "data-akv-auth";
const STYLE_ID = "akv-prijava-css";

// ---- scoped styles ---------------------------------------------------------
const CSS = `
/* Route-scoped chrome suppression. Only ever active while <html> carries
   data-akv-auth, which only this view sets and which is cleared on every
   navigation away (see the header). */
html[${AUTH_ATTR}] .topbar,
html[${AUTH_ATTR}] .tabbar{display:none}
html[${AUTH_ATTR}] #main{
  display:flex;
  padding:max(20px,env(safe-area-inset-top,0px)) 16px max(24px,env(safe-area-inset-bottom,0px));
}

/* margin:auto rather than align-items:center — an auto margin centres without
   ever clipping the top when the card is taller than the viewport. */
.pr-wrap{margin:auto;width:min(412px,100%);display:flex;flex-direction:column;gap:20px}

/* ---- wordmark above the card. Colours and face come from .wordmark in
   css/styles.css; nothing here recolours or re-faces it. ---- */
.pr-brand{display:flex;flex-direction:column;align-items:center;gap:12px}
.pr-mark{margin:0;font-size:clamp(30px,8.5vw,38px);line-height:1.15}
/* The splash's teal-to-amber gesture, at a quieter size. */
.pr-rule{
  width:64px;height:2px;border-radius:2px;
  background:linear-gradient(90deg,var(--accent-bright),var(--accent-2));
}

/* ---- the card ----
   CONCENTRIC CORNERS, the arithmetic css/styles.css spells out: an inset
   child's radius is the parent's minus the gap between them. The card takes
   --glass-radius-lg (the hero rung — this card IS the whole screen, the way
   ASC's .auth-card is) and its side padding is 22px, so every panel inset
   inside it lands on 34 - 22 = 12px, which is the --r-sm rung exactly. The
   literal in the var() fallback is that same 12px, so the rule still resolves
   if the token is ever renamed rather than collapsing to a square corner.
   Buttons stay pills: the scale is never used to "slightly round" a control. */
/* PADDING IS THE POINT. ASC's login reads premium mostly because of what is
   NOT in it: design/login-arched-v2.html gives its form column 96px of top
   padding and 44px of sides, and every control is 52px tall with 12px between.
   Nothing there is decorated — it is just given room. These numbers are that
   ratio brought down to a 430px phone card: 38px of top padding on a 28px
   side, against controls that are 54px tall.
   Concentric corners still hold: side padding 28px, so an inset panel lands on
   var(--r-2xl) - 28. Controls are pills and opt out of that arithmetic. */
.pr-card{padding:38px 28px 28px;border-radius:var(--glass-radius-lg)}
/* Optical refraction, ASC's touch: a soft highlight follows the pointer across
   the glass. Painted FIRST so every text sibling stacks above it, opacity-only
   so no blur is ever animated, and pointer devices only. */
.pr-sheen{
  position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
  background:radial-gradient(240px 180px at var(--gx,30%) var(--gy,0%),rgba(255,255,255,.30),transparent 70%);
  transition:opacity 320ms var(--smooth);
}
@media (hover:hover) and (pointer:fine){ .pr-card:hover .pr-sheen{opacity:1} }

.pr-eyebrow{display:block;color:var(--accent-ink)}
/* Sora 600, sentence case, LEFT aligned — ASC sets "Dobro došli natrag" this
   way and the calm comes from all three together. Centred uppercase display
   type is the loud version of the same words. */
.pr-title{
  margin:10px 0 0;font-family:var(--font-display);font-weight:600;
  font-size:clamp(25px,6.6vw,30px);line-height:1.2;letter-spacing:-.025em;
  color:var(--ink);text-wrap:balance;
}
.pr-sub{margin:7px 0 0;font-size:14px;line-height:1.5;color:var(--muted)}

/* ---- honest notice (CONFIG empty) ---- */
.pr-notice{
  display:flex;gap:11px;align-items:flex-start;
  margin:16px 0 0;padding:12px 13px;border-radius:var(--r-sm,12px);
  background:var(--glass-wash);border:1px solid var(--line);
}
.pr-notice .pr-nic{flex:none;margin-top:1px;color:var(--accent-2-ink)}
.pr-notice b{display:block;margin-bottom:3px;font-size:13.5px;font-weight:700;color:var(--accent-2-ink)}
.pr-notice span{display:block;font-size:12.5px;line-height:1.45;color:var(--ink-2)}

/* ---- form ----
   PILLS AT 54px. ASC's controls are 52px tall on a 26px radius — a full
   pill — with 12px between them and no visible labels at all. The label text
   moves into the placeholder and survives as the accessible name via
   aria-label, so nothing is lost to a screen reader and a whole row of
   uppercase micro-type leaves the screen. That subtraction is most of the
   difference in density between the two cards. */
.pr-form{margin:16px 0 0}
.pr-field{display:block;margin-bottom:12px}
.pr-input{
  display:flex;align-items:center;gap:11px;padding:0 20px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--r-pill);
  transition:border-color var(--dur) var(--smooth),box-shadow var(--dur) var(--smooth),background var(--dur) var(--smooth);
}
.pr-input:focus-within{border-color:var(--accent-ink);box-shadow:0 0 0 4px var(--accent-ring)}
.pr-input .pr-ic{flex:none;display:grid;place-items:center;color:var(--muted)}
/* The global input rule owns font-size:16px (iOS must not zoom on focus); only
   the chrome is stripped here so the icon and the field read as one control. */
.pr-field input{
  flex:1;min-width:0;min-height:54px;padding:11px 0;
  border:0;background:none;box-shadow:none;border-radius:0;
}
.pr-field input:focus{outline:none;border:0;box-shadow:none}
.pr-field input::placeholder{color:var(--muted)}
/* A natively disabled fieldset (the demo, where no password can be checked by
   anything) must LOOK disabled, or the card invites a password into a control
   that will never read it. :disabled is the state, not a class, so this cannot
   drift out of step with the markup. */
.pr-form fieldset:disabled .pr-input{background:var(--panel);cursor:not-allowed}
.pr-form fieldset:disabled .pr-field input{cursor:not-allowed}
.pr-eye{
  flex:none;width:var(--tap);height:var(--tap);margin-right:-10px;
  display:grid;place-items:center;border:0;background:none;border-radius:50%;
  color:var(--muted);cursor:pointer;-webkit-tap-highlight-color:transparent;
}
.pr-eye:focus-visible{outline:2px solid var(--accent-ink);outline-offset:-2px}
.pr-err{
  display:none;margin-top:6px;font-size:12.5px;font-weight:600;line-height:1.35;
  color:var(--danger-ink);
}
.pr-field.is-bad .pr-err{display:block}
.pr-field.is-bad .pr-input{border-color:var(--danger-ink);box-shadow:0 0 0 3px var(--red-ring)}

/* :empty COLLAPSES the row. Reserving height for a message that is usually
   absent leaves a dead band under the control — which is the opposite of
   negative space: it reads as a mistake, not as room. The form's own message
   still reserves its line (it appears and disappears while the user is looking
   straight at it, and a reflow there moves the button under their thumb); the
   Google one does not, because it only ever appears as the page unloads. */
.pr-msg{min-height:19px;margin:13px 0 0;font-size:13px;font-weight:600;line-height:1.4;text-align:center;color:var(--ink-2)}
#prGoogleMsg{min-height:0;margin:0}
#prGoogleMsg:not(:empty){margin-top:10px}
.pr-msg.is-err{color:var(--danger-ink)}
.pr-msg.is-ok{color:var(--ok-ink)}

/* Sentence case, not uppercase micro-caps — ASC's reads "ili e-mailom". */
.pr-div{
  display:flex;align-items:center;gap:14px;margin:18px 0;
  font-size:12px;font-weight:500;letter-spacing:0;color:var(--muted);
}
.pr-div::before,.pr-div::after{content:"";flex:1;height:1px;background:var(--line)}

/* ---- Google ----
   FIRST, above the email form. That order is the convention every major
   product uses and the one ASC follows: the fastest path is offered before
   the slowest one, and a returning user never reads the form at all.

   An OPAQUE white ground, not glass: the four Google colours must render as
   themselves, and a translucent surface composites whatever is behind the card
   into them. White also gives the mark the clear space its brand guidelines
   ask for. Text is --ink on #FFFFFF = 13.01:1. */
/* ⚠ THE LABEL COLOUR IS A LITERAL, NOT var(--ink). This control's ground is
   #FFFFFF in BOTH themes, because Google's mark may not be re-coloured and a
   translucent or dark ground would composite into it. --ink is #313131 in the
   light theme but #F2EFEC in the dark one, so a token here renders white text
   on the white ground — invisible, and only in dark mode. #313131 on #FFFFFF
   is 10.96:1 and holds in either theme. Same reason the border is a literal:
   --line is a light-on-dark rgba in dark mode and disappears against white. */
.pr-google{
  width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:11px;
  background:#FFFFFF;color:#313131;border:1px solid rgba(0,0,0,.14);border-radius:var(--r-pill);
  font-size:15px;font-weight:600;
}
.pr-google:hover:not(:disabled){background:#FFFFFF;border-color:rgba(0,0,0,.26)}
.pr-google[disabled]{opacity:.55;cursor:not-allowed}
.pr-google svg{flex:none}
/* The label carries the pending state; the mark must not spin or fade, so
   .is-busy is scoped to the text rather than the whole control. */
.pr-google.is-busy .pr-glabel{opacity:.6}

.pr-guest{width:100%}
.pr-note{margin:14px 0 0;font-size:12.5px;line-height:1.5;text-align:center;color:var(--muted)}
.pr-note+.pr-note{margin-top:5px}

/* ---- signed-in state ---- */
.pr-who{
  display:flex;align-items:center;gap:12px;
  margin:18px 0 0;padding:14px;border-radius:var(--r-sm,12px);
  background:var(--glass-wash);border:1px solid var(--line);
}
.pr-avatar{
  flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;
  background:var(--accent);color:var(--on-accent);font-weight:800;font-size:17px;line-height:1;
}
/* Scoped to .pr-whotext, NOT to .pr-who: ".pr-who span" is (0,1,1) and would
   out-specify .pr-avatar (0,1,0), repainting the initial in the muted email
   colour on the teal disc — measured at 1.53:1 before this was corrected. */
.pr-whotext{min-width:0}
.pr-whotext b{
  display:block;font-size:11.5px;font-weight:700;text-transform:uppercase;
  letter-spacing:var(--track-meta);color:var(--ink-2);
}
.pr-whotext span{display:block;margin-top:2px;font-size:13.5px;line-height:1.4;color:var(--ink);overflow-wrap:anywhere}
.pr-stack{margin-top:18px;display:flex;flex-direction:column;gap:10px}

/* ---- entrance. The router already fades and lifts .pr-wrap (styles.css
   riseIn); these layer the brand, the rule and the card on top of it so the
   card settles a beat after the mark, the way ASC's sheetIn does. ---- */
.pr-brand{animation:prMark 520ms var(--spring) 40ms both}
.pr-rule{animation:prRule 620ms var(--snap) 220ms both}
.pr-card{animation:prCard 620ms var(--smooth) 120ms both}
@keyframes prMark{from{opacity:0;transform:translateY(10px) scale(.96)}}
@keyframes prRule{from{opacity:0;transform:scaleX(.2)}}
@keyframes prCard{from{opacity:0;transform:translateY(24px) scale(.985)}}

@media (prefers-reduced-motion:reduce){
  .pr-brand,.pr-rule,.pr-card{animation:none}
  .pr-sheen{transition:none}
  .pr-input,.pr-card .btn{transition-duration:1ms}
}
/* The sheen is decoration over text-bearing glass; hardened modes drop it
   rather than tint what is underneath. */
@media (prefers-contrast:more){ .pr-sheen{display:none} }
@media (forced-colors:active){ .pr-sheen,.pr-rule{display:none} }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ---- icons -----------------------------------------------------------------
const SVG = (body, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const ICON_MAIL = SVG(`<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>`);
const ICON_LOCK = SVG(`<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>`);
const ICON_EYE = SVG(`<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>`);
const ICON_EYE_OFF = SVG(`<path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.6 4.3M6.5 7.7A17 17 0 0 0 2 12s3.5 6.5 10 6.5a9.7 9.7 0 0 0 3.4-.6"/><path d="M9.7 9.9a2.6 2.6 0 0 0 3.7 3.6"/>`);
const ICON_ARROW = SVG(`<path d="M5 12h14M13 6l6 6-6 6"/>`, 16);
const ICON_INFO = SVG(`<circle cx="12" cy="12" r="8.6"/><path d="M12 11.4v4.6M12 8.2v.1"/>`, 17);

// Google's "G". The only mark in this app that is NOT re-coloured to the Iris
// palette: Google's Third-Party Branding Guidelines require the four official
// colours unaltered, so it is filled, not stroked, and carries its own hex
// values rather than tokens. docs/DESIGN_SYSTEM.md records the exemption
// alongside the Akvaterm wordmark's.
const ICON_GOOGLE = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.2-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"/></svg>`;

// ---- markup ----------------------------------------------------------------
function cardHead(titleKey, titleFallback) {
  return `
    <span class="pr-sheen" aria-hidden="true"></span>
    <span class="t-meta pr-eyebrow">${esc(tf("prijava.eyebrow", "Prijava"))}</span>
    <h1 class="pr-title" id="prTitle">${esc(tf(titleKey, titleFallback))}</h1>`;
}

function brandMark() {
  return `
    <div class="pr-brand">
      <p class="pr-mark wordmark"><span class="akva">AKVA</span><span class="term">TERM</span></p>
      <span class="pr-rule" aria-hidden="true"></span>
    </div>`;
}

// The wrapper is a <div>, NOT a <label>: the password row contains a button
// (the reveal toggle), and a <label> may not contain a labelable descendant
// other than its own control. The label is a sibling with an explicit for=.
function field(id, labelKey, labelFallback, opts) {
  const eye = opts.eye
    ? `<button type="button" class="pr-eye" id="prEye" aria-pressed="false" aria-controls="${id}"
         aria-label="${esc(tf("prijava.showPassword", "Prikaži lozinku"))}">${ICON_EYE}</button>`
    : "";
  // NO VISIBLE LABEL. The field name moves into the placeholder, and aria-label
  // carries it for assistive technology — so the accessible name is unchanged
  // while a row of uppercase micro-type leaves the screen. The placeholder is
  // the LABEL text ("Email"), not an example value: a placeholder that only
  // shows a sample disappears on focus and takes the field's identity with it.
  const label = esc(tf(labelKey, labelFallback));
  return `
    <div class="pr-field">
      <span class="pr-input">
        <span class="pr-ic">${opts.icon}</span>
        <input id="${id}" type="${opts.type}" name="${opts.name}"
               autocomplete="${opts.autocomplete}"${opts.inputmode ? ` inputmode="${opts.inputmode}"` : ""}
               placeholder="${label}" aria-label="${label}"
               aria-describedby="${id}Err" aria-invalid="false"
               value="${esc(opts.value || "")}">
      ${eye}
      </span>
      <span class="pr-err" id="${id}Err"></span>
    </div>`;
}

function signInMarkup(configured) {
  const notice = configured ? "" : `
      <div class="pr-notice">
        <span class="pr-nic">${ICON_INFO}</span>
        <span class="pr-noticetext">
          <b>${esc(tf("prijava.offTitle", "Prijava još nije uključena"))}</b>
          <span>${esc(tf("prijava.offBody", "Ova verzija radi bez poslužitelja za račune, pa se prijava ne može dovršiti. Sve ostalo radi normalno."))}</span>
        </span>
      </div>`;

  const fields =
    field("prEmail", "prijava.email", "Email", {
      icon: ICON_MAIL, type: "email", name: "email", autocomplete: "email", inputmode: "email",
      placeholderKey: "prijava.emailPlaceholder", placeholderFallback: "ime@tvrtka.hr",
      value: rememberedEmail(),
    }) +
    field("prPass", "prijava.password", "Lozinka", {
      icon: ICON_LOCK, type: "password", name: "password", autocomplete: "current-password", eye: true,
      placeholderKey: "prijava.passwordPlaceholder", placeholderFallback: "Vaša lozinka",
    });

  // <fieldset disabled> is a NATIVE disable: on the demo the controls are not
  // focusable and the form cannot be submitted at all, so there is no path on
  // which a password is typed into something that will never check it.
  const form = `
    <form class="pr-form" id="prForm" novalidate autocomplete="on">
      <fieldset${configured ? "" : " disabled"}>
        ${fields}
        <button type="submit" class="btn btn-primary btn-lg" id="prSubmit">
          ${esc(tf("prijava.submit", "Prijavi se"))}${ICON_ARROW}
        </button>
      </fieldset>
      <p class="pr-msg" id="prMsg" role="status" aria-live="polite"></p>
    </form>`;

  // Disabled rather than hidden on the demo, and for the same reason the email
  // form is: a control that is present but plainly unavailable explains the
  // build, where a missing control just looks like a feature nobody built.
  const google = `
      <button type="button" class="btn btn-block pr-google" id="prGoogle"${configured ? "" : " disabled"}>
        ${ICON_GOOGLE}
        <span class="pr-glabel">${esc(tf("prijava.google", "Nastavi s Google računom"))}</span>
      </button>
      <p class="pr-msg" id="prGoogleMsg" role="status" aria-live="polite"></p>`;

  // The guest action is the ONLY enabled primary on the demo, and an ordinary
  // link either way, so the catalogue stays reachable even if no listener in
  // this file ever attached.
  const guestClass = configured ? "btn btn-block pr-guest" : "btn btn-primary btn-lg pr-guest";

  return `
    <div class="pr-wrap">
      ${brandMark()}
      <section class="pr-card glass-strong" aria-labelledby="prTitle">
        ${cardHead("prijava.title", "Dobrodošli natrag")}
        <p class="pr-sub">${esc(tf("prijava.sub", "Kupaonice, grijanje i klimatizacija"))}</p>
        ${notice}
        ${google}
        <div class="pr-div">${esc(tf("prijava.orEmail", "ili e-mailom"))}</div>
        ${form}
        <a class="${guestClass}" href="#/">${esc(tf("prijava.guest", "Nastavi kao gost"))}</a>
        ${configured ? "" : `<p class="pr-note">${esc(tf("prijava.guestHint", "Katalog, dizajner i 3D soba rade bez prijave."))}</p>`}
        <p class="pr-note">${esc(tf("prijava.localNote", "Favoriti i dizajni spremaju se na ovaj uređaj."))}</p>
      </section>
    </div>`;
}

function signedInMarkup(email) {
  const initial = (email || "?").trim().charAt(0).toUpperCase() || "?";
  return `
    <div class="pr-wrap">
      ${brandMark()}
      <section class="pr-card glass-strong" aria-labelledby="prTitle">
        ${cardHead("prijava.signedInTitle", "Prijavljeni ste")}
        <div class="pr-who">
          <span class="pr-avatar" aria-hidden="true">${esc(initial)}</span>
          <span class="pr-whotext">
            <b>${esc(tf("prijava.account", "Račun"))}</b>
            <span>${esc(email)}</span>
          </span>
        </div>
        <div class="pr-stack">
          <a class="btn btn-primary btn-lg" href="#/">${esc(tf("prijava.toCatalog", "U katalog"))}${ICON_ARROW}</a>
          <button type="button" class="btn btn-block" id="prSignOut">${esc(tf("prijava.signOut", "Odjava"))}</button>
        </div>
        <p class="pr-msg" id="prMsg" role="status" aria-live="polite"></p>
        <p class="pr-note">${esc(tf("prijava.localNote", "Favoriti i dizajni spremaju se na ovaj uređaj."))}</p>
      </section>
    </div>`;
}

// ---- validation ------------------------------------------------------------
// Deliberately loose: a strict RFC pattern rejects addresses that exist, and
// the server is the real authority. This only catches the typo classes the
// user can fix without a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ERR_FALLBACK = {
  credentials: "Email ili lozinka nisu točni.",
  unconfirmed: "Račun još nije potvrđen — provjerite email.",
  rate: "Previše pokušaja. Pričekajte trenutak pa pokušajte ponovno.",
  network: "Nema veze s poslužiteljem. Provjerite internet pa pokušajte ponovno.",
  unavailable: "Prijava nije dostupna u ovoj verziji.",
  other: "Prijava nije uspjela. Pokušajte ponovno.",
};

function setFieldError(input, message) {
  const wrap = input.closest(".pr-field");
  const slot = wrap?.querySelector(".pr-err");
  if (wrap) wrap.classList.toggle("is-bad", Boolean(message));
  if (slot) slot.textContent = message || "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

// ---- lifecycle -------------------------------------------------------------
function clearChrome() {
  document.documentElement.removeAttribute(AUTH_ATTR);
}
// Fires on EVERY navigation, including the ones where a view threw — see the
// header. Registered once, at module evaluation.
if (typeof window !== "undefined") window.addEventListener("akv:teardown", clearChrome);

let pointerCleanup = null;

export async function render(container) {
  ensureStyles();
  const configured = authConfigured();
  // Resolves to null immediately when unconfigured — no client, no request.
  const session = configured ? await getSession() : null;
  // The user navigated away while the session lookup was in flight: this
  // container is detached, so writing to it would be invisible, and setting
  // the chrome attribute would hide the navigation of the screen they are
  // actually looking at.
  if (!container.isConnected) return;

  const email = session?.user?.email || "";
  container.innerHTML = session ? signedInMarkup(email) : signInMarkup(configured);
  document.documentElement.setAttribute(AUTH_ATTR, "on");

  wirePointerSheen(container);
  if (session) wireSignedIn(container);
  else if (configured) { wireForm(container); wireGoogle(container); }
}

// Google is wired separately from wireForm() because it is NOT part of the
// form: it must keep working if the email form is absent, and a click on it
// must never submit the form's fields.
function wireGoogle(container) {
  const button = container.querySelector("#prGoogle");
  const msg = container.querySelector("#prGoogleMsg");
  if (!button) return;

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    if (msg) { msg.textContent = ""; msg.className = "pr-msg"; }
    button.classList.add("is-busy");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    try {
      await signInWithGoogle();
      // Resolved means "the redirect was issued", not "signed in". The browser
      // is now leaving for accounts.google.com, so the control stays disabled
      // deliberately — re-enabling it would invite a second click that starts a
      // competing OAuth attempt during the hand-off.
      if (msg) {
        msg.textContent = tf("prijava.googleRedirect", "Otvaramo Google prijavu…");
        msg.className = "pr-msg";
      }
    } catch (err) {
      const code = ERR_FALLBACK[err?.code] ? err.code : "other";
      if (msg) {
        msg.textContent = tf("prijava.err." + code, ERR_FALLBACK[code]);
        msg.className = "pr-msg is-err";
      }
      // Only restore the button on FAILURE — on success the page is unloading.
      button.classList.remove("is-busy");
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
    }
  });
}

// ASC's optical refraction. Pointer devices with motion allowed only; the
// property write is a CSS variable, so nothing layouts and no blur animates.
function wirePointerSheen(container) {
  pointerCleanup?.();
  pointerCleanup = null;
  const card = container.querySelector(".pr-card");
  if (!card) return;
  if (!window.matchMedia?.("(hover:hover) and (pointer:fine) and (prefers-reduced-motion: no-preference)").matches) return;
  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    if (!r.width || !r.height) return;
    card.style.setProperty("--gx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    card.style.setProperty("--gy", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };
  card.addEventListener("pointermove", onMove);
  pointerCleanup = () => card.removeEventListener("pointermove", onMove);
}

function wireSignedIn(container) {
  const button = container.querySelector("#prSignOut");
  const msg = container.querySelector("#prMsg");
  button?.addEventListener("click", async () => {
    button.classList.add("is-busy");
    button.disabled = true;
    await signOut();
    window.AKV?.toast?.(tf("prijava.signedOut", "Odjavljeni ste."));
    if (container.isConnected) render(container);
    else if (msg) msg.textContent = tf("prijava.signedOut", "Odjavljeni ste.");
  });
}

function wireForm(container) {
  const form = container.querySelector("#prForm");
  const emailInput = container.querySelector("#prEmail");
  const passInput = container.querySelector("#prPass");
  const submit = container.querySelector("#prSubmit");
  const msg = container.querySelector("#prMsg");
  const eye = container.querySelector("#prEye");
  if (!form || !emailInput || !passInput || !submit) return;

  const say = (text, kind) => {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "pr-msg" + (kind ? " " + kind : "");
  };
  const busy = (on) => {
    submit.classList.toggle("is-busy", on);
    submit.disabled = on;
    submit.setAttribute("aria-busy", String(on));
  };

  // Show / hide password. The label and the pressed state move together, so a
  // screen reader hears the current state rather than the eye glyph.
  eye?.addEventListener("click", () => {
    const reveal = passInput.type === "password";
    passInput.type = reveal ? "text" : "password";
    eye.innerHTML = reveal ? ICON_EYE_OFF : ICON_EYE;
    eye.setAttribute("aria-pressed", String(reveal));
    eye.setAttribute("aria-label", reveal
      ? tf("prijava.hidePassword", "Sakrij lozinku")
      : tf("prijava.showPassword", "Prikaži lozinku"));
    passInput.focus();
  });

  // Clear a field error as soon as the user starts fixing it; re-check on blur
  // only once the field has been submitted at least once, so nobody is told
  // their half-typed address is wrong.
  let submitted = false;
  const checkEmail = () => {
    const value = emailInput.value.trim();
    if (!value) return tf("prijava.errEmailRequired", "Unesite email adresu.");
    if (!EMAIL_RE.test(value)) return tf("prijava.errEmailInvalid", "Provjerite email adresu — nedostaje @ ili domena.");
    return "";
  };
  const checkPass = () => (passInput.value ? "" : tf("prijava.errPasswordRequired", "Unesite lozinku."));

  for (const [input, check] of [[emailInput, checkEmail], [passInput, checkPass]]) {
    input.addEventListener("input", () => setFieldError(input, ""));
    input.addEventListener("blur", () => { if (submitted) setFieldError(input, check()); });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitted = true;
    const emailError = checkEmail();
    const passError = checkPass();
    setFieldError(emailInput, emailError);
    setFieldError(passInput, passError);
    if (emailError || passError) {
      say("", "");
      (emailError ? emailInput : passInput).focus();
      return;
    }

    say("", "");
    busy(true);
    try {
      await signIn(emailInput.value.trim(), passInput.value);
      rememberEmail(emailInput.value.trim());
      say(tf("prijava.success", "Prijavljeni ste."), "is-ok");
      window.AKV?.toast?.(tf("prijava.success", "Prijavljeni ste."));
      location.hash = "#/";
    } catch (err) {
      const code = ERR_FALLBACK[err?.code] ? err.code : "other";
      say(tf("prijava.err." + code, ERR_FALLBACK[code]), "is-err");
      if (code === "credentials") { passInput.value = ""; passInput.focus(); }
    } finally {
      busy(false);
    }
  });
}

export function teardown() {
  clearChrome();
  pointerCleanup?.();
  pointerCleanup = null;
}
