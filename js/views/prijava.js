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
  authConfigured, getSession, signIn, signInWithGoogle, signUp,
  requestPasswordReset, signOut, rememberedEmail, rememberEmail,
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
  /* SIDE MARGIN SCALES WITH THE PHONE. A flat 16px left the card almost
     touching both edges on a 375px screen -- 343px of card in 375px of
     glass -- which is what made it feel cramped rather than placed.
     9vw gives the gutter a share of the viewport instead of a fixed
     number, so a 375px phone gets ~34px a side and the card lands near
     307px: about 10% narrower, which is the amount asked for. It is
     clamped at both ends so a 320px phone still gets 24px of air and a
     desktop does not run the gutter away (the card caps at 360px there
     regardless, so the upper bound only guards the tablet range). */
  padding:max(20px,env(safe-area-inset-top,0px)) 12px max(24px,env(safe-area-inset-bottom,0px));
}

/* margin:auto rather than align-items:center — an auto margin centres without
   ever clipping the top when the card is taller than the viewport. */
/* ASC's form column is min(880px)/2 = 440px carrying 40px side padding, i.e.
   360px of content. Ours was 412px of content inside 28px padding, which is
   why the card read noticeably larger than ASC's for the same six controls.
   Matched to ASC's content width instead of its outer width -- that is the
   measurement that decides how big a card FEELS. */
/* 81% OF THE VIEWPORT, measured off the operator's own phone screenshot.
   NOT off the code: a local copy of ASC renders .auth-card at 351px in a 375
   viewport (93.6%), because @media(max-width:759.5px) drops .login-canvas's
   horizontal padding to 0. The operator's device shows 81%. The two disagree,
   and the device wins - it is the thing being compared. Chasing the stylesheet
   is what produced a card that measured "identical" on content width while
   still looking bigger on screen. */
/* 351px at 375 = 93.6% of viewport, MEASURED off ASC's rendered card - not
   off the screenshot, which read 81% and produced a card with a 1.81 height
   ratio against ASC's 1.504. That ratio difference is the "elongated vs
   squashed" complaint: same content in a narrower column simply runs taller.
   Width is what fixes the shape; the height follows from it. */
.pr-wrap{margin:auto;width:100%;display:flex;flex-direction:column;gap:20px}

/* ---- wordmark above the card. Colours and face come from .wordmark in
   css/styles.css; nothing here recolours or re-faces it. ---- */
/* THE CARD TOP: mark left, theme switch right — ASC's .auth-shell row. */
/* THE SWITCH IS PINNED TO THE CARD CORNER, NOT LAID OUT WITH THE LOGO.
   ASC's .auth-seg is position:absolute; top:16px; right:16px (css/styles.css
   :1355-1357) - anchored to the card, so it sits ABOVE the logo's centre and
   closer to the corner than any padding would allow.
   Mine was a flex row with justify-content:space-between, which put it on the
   logo's baseline and inset it by the card's 26px padding. Same two elements,
   completely different anchor - and that is the placement difference. */
.pr-cardtop{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}
/* THE THEME SLIDER. Operator instruction, 2026-08-02: "replace the light/dark
   button with a little slider that has a background lighting of the logo -- for
   when it goes from light to dark there is a bluish under-colour, and switching
   from dark to light a reddish one below."

   So the glow under the track IS the wordmark, split: AKVA navy underneath the
   dark side, TERM red underneath the light side. The two halves of the logo are
   already a cool one and a warm one, so the control says which way it is going
   without a label.

   The glow is a real box-shadow on the track and it CROSS-FADES rather than
   animating the shadow itself: two absolutely positioned layers, each carrying
   a static shadow, swapped on opacity. Animating box-shadow repaints the
   element every frame, and this sits on a card that is already compositing
   glass. */
.pr-theme{
  flex:none;position:relative;width:42px;height:23px;padding:0;
  border:1px solid var(--line);border-radius:var(--r-pill);
  background:var(--glass-wash);cursor:pointer;
  transition:background var(--dur) var(--smooth),border-color var(--dur) var(--smooth);
}
.pr-theme:focus-visible{outline:2px solid var(--pr-link);outline-offset:3px}
/* NO GLOW. It was added on request and is removed on request: on a control
   this small it read as a smudge under the pill rather than as a signal, and
   the thumb's travel already says everything the glow was saying. */

/* The thumb. No glyph inside it: ASC's control is a plain pill and the
   operator asked for the indicator to go. What the control says, it says by
   POSITION and by the one-shot glow underneath - which is enough, and is why
   the sun/moon pair was noise rather than information. */
.pr-themeic{
  position:absolute;top:50%;left:2px;width:18px;height:18px;z-index:1;
  border-radius:50%;
  background:#FFFFFF;
  box-shadow:0 1px 3px rgba(20,16,14,.28),0 0 0 .5px rgba(20,16,14,.06);
  transition:transform 380ms var(--spring);
  transform:translateY(-50%);
}
.pr-theme[aria-pressed="true"] .pr-themeic{transform:translateY(-50%) translateX(19px)}

@media(prefers-reduced-motion:reduce){
  .pr-themeic,.pr-themeic svg{transition-duration:1ms}
}

/* Right-aligned "Zaboravljena lozinka?" — ASC's .auth-row--end. A button, not
   a link: it acts on the address already typed, it does not navigate. */
.pr-rowend{display:flex;justify-content:flex-end;margin:2px 4px 10px}
.pr-form fieldset{border:0;margin:0;padding:0;min-inline-size:0}
.pr-forgot{
  border:0;background:none;padding:4px 2px;cursor:pointer;
  font-family:var(--font-text);font-size:12.5px;font-weight:500;color:var(--muted);
  transition:color var(--dur) var(--smooth);
}
.pr-forgot:hover{color:var(--accent-ink);text-decoration:underline}
.pr-forgot:focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px;border-radius:6px}

/* The footer swap — ASC's .auth-create. */
.pr-foot{margin:18px 0 0;text-align:center;font-size:14px;color:var(--muted)}
.pr-footlink{
  border:0;background:none;padding:2px;cursor:pointer;
  font-family:var(--font-text);font-size:13px;font-weight:700;color:var(--accent-ink);
}
.pr-footlink:hover{text-decoration:underline}
.pr-footlink:focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px;border-radius:6px}

.pr-brand{display:flex;flex-direction:column;align-items:center;gap:12px}
/* ASC's .auth-logo is width:210px;max-width:74% (css/styles.css:772) - a big,
   confident mark, not a caption. Ours is TEXT rather than an image, so the
   match is on rendered WIDTH: this size puts AKVATERM at ~200px inside a 304px
   content column, i.e. ASC's 74%. It stopped shrinking - every previous value
   here was judged by eye, which is why it lost a step on each pass. */
/* 46.4% of the content column - ASC RENDERED, measured in the browser at
   375x812. The 74% used before came from .auth-logo in the stylesheet, which
   does not govern this breakpoint; the running page is the reference and the
   source was confidently wrong. */
.pr-mark{
  margin:0;font-size:clamp(27px,8.5vw,32px);line-height:1.12;
  /* ASC throws a drop-shadow in its BRAND colour under the mark
     (css/styles.css:1308, rgba(255,78,27,.35)). Ours is two-tone, so it takes
     two: navy under AKVA, red under TERM. drop-shadow follows the glyph
     outline rather than the box, which is the whole point - a box-shadow here
     would draw a rectangle behind the text. */
}
.pr-mark .akva{filter:drop-shadow(0 6px 16px rgba(0,0,140,.45))}
.pr-mark .term{filter:drop-shadow(0 6px 16px rgba(214,37,46,.45))}
:root[data-theme="dark"] .pr-mark .akva{filter:drop-shadow(0 6px 18px rgba(90,120,255,.50))}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .pr-mark .akva{filter:drop-shadow(0 6px 18px rgba(90,120,255,.50))}
}
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
/* ---- COLOUR AND SHAPE ----------------------------------------------------
   Operator instruction, 2026-08-02: "cut out the green in Akvaterm, have more
   pretty colours", and "look at how the ASC login button shape and shadowing
   looks and apply it".

   THE GREEN IS GONE. The app-wide accent is a teal (--accent #139EB1) which
   reads green on a large filled control, and the sign-in button was the largest
   one on the screen. It is replaced here by a blue that belongs to this brand
   rather than to the palette: AKVA is #00008C navy, so a saturated blue is the
   logo's own family, and it is the one hue that can sit beside the red half of
   the wordmark without arguing with it. These are scoped to this view - the
   app-wide palette is a separate piece of work.
     white on --pr-brand-2 #2B3FD8   7.49:1
     white on --pr-brand-3 #1E32AE   9.89:1
   The link tier has to flip by theme: #2B3FD8 is 6.69:1 on light --paper but
   only 2.23:1 on the dark one, so dark mode lifts it to #A9B8FF (8.72:1).

   SHAPE IS ASC'S, and it is NOT a pill. css/styles.css:813 sets .btn-amber to
   border-radius 13px at min-height 56px, and the fields to --radius 16px - soft
   rectangles, not capsules. The pill was this view's own invention and it is
   what made the card read rounder and softer than ASC's.

   SHADOW IS ASC'S TOO, and it is the detail that does the work: a wide COLOURED
   glow thrown well below the button (0 12px 28px -12px of the brand colour),
   not a neutral drop shadow. That is what lifts the primary off the card. */
.pr-card{
  /* THE GLASS RIM IS NEUTRAL HERE. css/styles.css builds .glass-* rims out of
     the teal identity (--glass-rim-top and friends carry --teal-300), and on a
     card this large it shows as a cyan cast down the top-left edge - visible in
     the side-by-side against ASC's clean white card, and the last of the green
     the operator asked to remove. Rebound locally to plain white so the glass
     still has a lit edge without a hue. */
  --glass-rim-top:rgba(255,255,255,.72);
  --glass-rim-bottom:rgba(255,255,255,.30);
  --glass-rim-side:rgba(255,255,255,.20);
  --glass-hairline:rgba(255,255,255,.38);
  --pr-field-bg:#F4F5F7;
  --pr-track:#E3E5EA;
  /* The Google button follows the theme, as ASC's does - its --surface goes
     #17181c in dark. The MARK is untouched either way, which is what Google's
     guidelines actually require; they publish a dark button precisely for this.
     A permanently white button on a near-black card is the thing that looks
     wrong, not the dark one. */
  --pr-goog-bg:#FFFFFF; --pr-goog-ink:#313131;
  --pr-goog-rim:rgba(0,0,0,.14); --pr-goog-rim-hi:rgba(0,0,0,.26);
  --pr-field-rim:rgba(20,16,14,.10);
  --pr-brand-1:#3355EE;
  --pr-brand-2:#2B3FD8;
  --pr-brand-3:#1E32AE;
  --pr-brand-ring:rgba(43,63,216,.60);
  --pr-link:#2B3FD8;
  --pr-r-ctl:14px;
  --pr-r-field:14px;
}
/* ASC's card is barely separable from its page - #17181C on a #020305 canvas -
   so it reads as part of the screen. Ours was --glass-bg-strong, a full step
   lighter than --paper, which is why it read as a grey block sitting ON the
   page rather than as the page. Dropped to a near-paper tone with the
   separation carried by the rim and the shadow instead of by the fill. */
:root[data-theme="dark"] .pr-card{background-color:rgba(30,32,38,.55);--pr-link:#A9B8FF;--pr-brand-ring:rgba(76,111,255,.55);
  --pr-field-bg:rgba(255,255,255,.06);--pr-track:rgba(255,255,255,.16);
  --pr-goog-bg:#17181C;--pr-goog-ink:#F4F5F7;--pr-goog-rim:rgba(244,245,247,.16);--pr-goog-rim-hi:rgba(244,245,247,.30);--pr-field-rim:rgba(244,245,247,.16);
  --glass-rim-top:rgba(255,255,255,.12);--glass-rim-bottom:rgba(255,255,255,.05);
  --glass-rim-side:rgba(255,255,255,.04);--glass-hairline:rgba(255,255,255,.08)}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .pr-card{background-color:rgba(30,32,38,.55);--pr-link:#A9B8FF;--pr-brand-ring:rgba(76,111,255,.55);
    --pr-field-bg:rgba(255,255,255,.06);--pr-track:rgba(255,255,255,.16);
    --pr-goog-bg:#17181C;--pr-goog-ink:#F4F5F7;--pr-goog-rim:rgba(244,245,247,.16);--pr-goog-rim-hi:rgba(244,245,247,.30);--pr-field-rim:rgba(244,245,247,.16);
  --pr-goog-bg:#17181C;--pr-goog-ink:#F4F5F7;--pr-goog-rim:rgba(244,245,247,.16);--pr-goog-rim-hi:rgba(244,245,247,.30);--pr-field-rim:rgba(244,245,247,.16);
    --glass-rim-top:rgba(255,255,255,.12);--glass-rim-bottom:rgba(255,255,255,.05);
    --glass-rim-side:rgba(255,255,255,.04);--glass-hairline:rgba(255,255,255,.08)}
}

/* The primary. ASC geometry, ASC shadow, this brand's blue. */
/* THE EDGE IS FOUR SHADOWS, NOT A BORDER. A 1px border on a gradient button
   flattens it: the line is one colour all the way round, so it fights the
   light the gradient is describing. These four do what a real moulded edge
   does instead, and each is a different job:
     inset 0 1px 0        a bright top lip, where the light hits
     inset 0 -1px 0       a dark bottom lip, where it falls away
     inset 0 0 0 1px      a faint containing rim, so the shape stays crisp
                          against the card at any zoom
     0 12px 28px -12px    the coloured glow beneath, thrown well below
   The result reads as a piece of moulded glass rather than a coloured
   rectangle, and it is why the rim brightens rather than the whole control
   lifting on hover. */
.pr-card .btn-primary{
  min-height:49px;border-radius:var(--pr-r-ctl);border:0;
  background:linear-gradient(150deg,var(--pr-brand-1),var(--pr-brand-2) 58%,var(--pr-brand-3));
  /* SENTENCE CASE. css/styles.css:815 sets .btn-amber to text-transform
     uppercase, but the shipped ASC login renders "Prijavi se" - so the rule is
     overridden somewhere downstream and the STYLESHEET is not the reference
     here, the running app is. Matching the CSS gave "PRIJAVI SE", which is the
     one thing that made the two buttons obviously different side by side.
     Tracking drops to .2px with it: .8px is spacing for capitals. */
  color:#fff;font-size:15px;font-weight:700;letter-spacing:.2px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.34),
    inset 0 -1px 0 rgba(0,0,0,.22),
    inset 0 0 0 1px rgba(255,255,255,.10),
    0 12px 26px -10px var(--pr-brand-ring);
  transition:transform 180ms var(--spring),box-shadow 220ms var(--smooth),filter 160ms ease;
}
@media(hover:hover) and (pointer:fine){
  .pr-card .btn-primary:hover{
    filter:brightness(1.05);transform:translateY(-1px);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.46),
      inset 0 -1px 0 rgba(0,0,0,.22),
      inset 0 0 0 1px rgba(255,255,255,.18),
      0 16px 32px -10px var(--pr-brand-ring);
  }
}
.pr-card .btn-primary:active{transform:scale(.99)}

/* Fields and the Google button follow the same corner, not a capsule. */
/* The radii live on the rules themselves further down: these sit EARLIER in
   the sheet, so an override here would lose to them at equal specificity.
   That is exactly what kept the fields capsule-shaped after the shape was
   supposedly changed. */
.pr-input:focus-within{border-color:var(--pr-brand-2);background:var(--surface);box-shadow:0 0 0 4px var(--pr-brand-ring)}
/* Every accent tier on this card moves off the teal with it. */
.pr-eyebrow{color:var(--pr-link)}
.pr-footlink{color:var(--pr-link)}
.pr-forgot:hover{color:var(--pr-link)}
.pr-theme:focus-visible,.pr-forgot:focus-visible,.pr-footlink:focus-visible{outline-color:var(--pr-link)}

/* ASC cross-fades its surfaces when the theme flips (css/styles.css:191,
   background-color .3s / color .3s) rather than cutting. Applied to every
   surface on this card, so the whole screen turns together instead of the
   card snapping while the page eases. */
.pr-card,.pr-input,.pr-google,.pr-theme,.pr-themeic{
  transition:background-color .32s var(--smooth),color .32s var(--smooth),border-color .32s var(--smooth);
}
/* ===== THE CARD, PORTED FROM ASC VERBATIM =====================================
   Extracted from the RUNNING ASC login (the rules are inline in its
   app/login.html, not in any stylesheet - which is why reading css/styles.css
   never found them and why this surface was missing pieces for six rounds).
   Copied rule for rule; only the colour tokens are re-pointed.

   FOUR LAYERS, and the two I never had are the reason it looked flat:

     base      radius 30, padding 30/26/24, --shadow-card, a lit top border,
               and a sheetIn entrance
     @supports blur(34px) saturate(150%) brightness(108%) over a TRANSLUCENT
               fill. The brightness lift is what stops a .55-alpha dark pane
               from reading as a hole.
     ::before  a pointer-tracked sheen -
               radial-gradient(240px 180px at var(--gx) var(--gy)) at .16
               light / .07 dark. wirePointerSheen() below already writes
               --gx/--gy, so this needed no JS.
     ::after   *** THE GRAIN ***  an inline SVG feTurbulence fractalNoise at
               opacity .035 and mix-blend-mode:overlay. THIS is what makes the
               surface read as milky frosted glass instead of a flat tint. It
               was the single biggest missing piece and no amount of adjusting
               blur or alpha would ever have produced it.

   The inset rims differ by theme and are ASC's own values, not derived. */
.pr-wrap .pr-card{
  position:relative;z-index:1;
  width:min(412px,100%);
  border-radius:30px;
  padding:30px 26px 24px;
  border-top:1px solid var(--glass-rim-top);
  box-shadow:var(--shadow-card),
             inset 0 1px 0 rgba(255,255,255,.55),
             inset 0 -1px 0 rgba(2,3,5,.05);
  animation:prCard 560ms var(--smooth) both;
}
:root[data-theme="dark"] .pr-wrap .pr-card{
  box-shadow:var(--shadow-card),
             inset 0 1px 0 rgba(255,255,255,.09),
             inset 0 -1px 0 rgba(0,0,0,.3);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .pr-wrap .pr-card{
    box-shadow:var(--shadow-card),
               inset 0 1px 0 rgba(255,255,255,.09),
               inset 0 -1px 0 rgba(0,0,0,.3);
  }
}
@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .pr-wrap .pr-card{
    -webkit-backdrop-filter:blur(34px) saturate(150%) brightness(108%);
            backdrop-filter:blur(34px) saturate(150%) brightness(108%);
  }
}
/* The sheen. --gx/--gy come from wirePointerSheen(). */
.pr-wrap .pr-card::before{
  content:"";position:absolute;inset:0;border-radius:inherit;
  pointer-events:none;z-index:0;
  background:radial-gradient(240px 180px at var(--gx,30%) var(--gy,0%),rgba(255,255,255,.16),transparent 70%);
  transition:opacity .3s;
}
:root[data-theme="dark"] .pr-wrap .pr-card::before{
  background:radial-gradient(240px 180px at var(--gx,30%) var(--gy,0%),rgba(255,255,255,.07),transparent 70%);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .pr-wrap .pr-card::before{
    background:radial-gradient(240px 180px at var(--gx,30%) var(--gy,0%),rgba(255,255,255,.07),transparent 70%);
  }
}
/* THE GRAIN. Verbatim from ASC, data URI and all. */
.pr-wrap .pr-card::after{
  content:"";position:absolute;inset:0;border-radius:inherit;
  pointer-events:none;z-index:0;
  opacity:.035;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}
/* Content sits above both decorative layers. */
.pr-wrap .pr-card>*{position:relative;z-index:1}

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
  margin:0;font-family:var(--font-display);font-weight:600;
  font-size:24px;line-height:1.22;letter-spacing:-.01em;
  color:var(--ink);text-wrap:balance;
}
/* ASC's rhythm, taken from design/login-arched-v2.html rather than guessed:
   .form .sub carries margin 6px top / 26px BOTTOM, and that bottom margin is
   the gap that separates the heading block from the first control. Without it
   the subtitle sits directly on the Google button and the card reads as one
   undifferentiated column - which is what "spacing between the elements is
   not good" was pointing at. The rest of the scale below is the same file:
   divider 18px, fields 12px apart, primary 12px after the forgot row,
   footer 20px. */
.pr-sub{margin:3px 0 20px;font-size:13.5px;line-height:1.5;color:var(--muted)}

/* ---- honest notice (CONFIG empty) ---- */
.pr-notice{
  display:flex;gap:11px;align-items:flex-start;
  margin:0 0 18px;padding:12px 13px;border-radius:var(--r-sm,12px);
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
.pr-form{margin:0}
.pr-field{display:block;margin-bottom:11px}
.pr-input{
  display:flex;align-items:center;gap:11px;padding:0 20px;
  /* FILLED AND BORDERLESS, which is ASC's field and the clearest difference in
     the side-by-side: --input-bg with no outline at rest, so the row reads as a
     recess in the card rather than as a drawn box sitting on it. The hairline
     only appears on focus, where it is doing real work. */
  background:var(--pr-field-bg);border:1px solid var(--pr-field-rim);border-radius:var(--pr-r-field,16px);
  transition:border-color var(--dur) var(--smooth),box-shadow var(--dur) var(--smooth),background var(--dur) var(--smooth);
}
.pr-input:focus-within{border-color:var(--accent-ink);box-shadow:0 0 0 4px var(--accent-ring)}
.pr-input .pr-ic{flex:none;display:grid;place-items:center;color:var(--muted)}
/* The global input rule owns font-size:16px (iOS must not zoom on focus); only
   the chrome is stripped here so the icon and the field read as one control. */
.pr-field input{
  flex:1;min-width:0;min-height:49px;font-size:15.5px;padding:9px 0;
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
/* COLLAPSED WHEN EMPTY. This reserved 19px plus a 13px margin at all times,
   and that 32px was the ENTIRE remaining height difference against ASC -
   560.5 vs 528 - after width, padding, radius and every control matched.
   ASC's .auth-err / .auth-ok carry a .hidden class instead of standing space.
   The form's message still gets its line WHILE VISIBLE; it just no longer
   holds a gap open when there is nothing to say. */
.pr-msg:empty{display:none}
.pr-msg{min-height:19px;margin:13px 0 0;font-size:13px;font-weight:600;line-height:1.4;text-align:center;color:var(--ink-2)}
#prGoogleMsg{min-height:0;margin:0}
#prGoogleMsg:not(:empty){margin-top:10px}
.pr-msg.is-err{color:var(--danger-ink)}
.pr-msg.is-ok{color:var(--ok-ink)}

/* Sentence case, not uppercase micro-caps — ASC's reads "ili e-mailom". */
/* ASC: uppercase, 11.5px, 1.6px tracking (css/styles.css .auth-divider). The
   lowercase version read as a sentence fragment rather than as a separator. */
.pr-div{
  display:flex;align-items:center;gap:14px;margin:16px 2px 14px;
  font-size:11.5px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;
  color:var(--muted);
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
  width:100%;min-height:49px;display:flex;align-items:center;justify-content:center;gap:12px;
  background:var(--pr-goog-bg);color:var(--pr-goog-ink);
  border:1px solid var(--pr-goog-rim);border-radius:var(--pr-r-ctl,14px);
  font-size:14.5px;font-weight:600;
}
.pr-google:hover:not(:disabled){border-color:var(--pr-goog-rim-hi)}
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
.pr-cardtop{animation:prMark 520ms var(--spring) 40ms both}
.pr-rule{animation:prRule 620ms var(--snap) 220ms both}
.pr-card{animation:prCard 620ms var(--smooth) 120ms both}
@keyframes prMark{from{opacity:0;transform:translateY(10px) scale(.96)}}
@keyframes prRule{from{opacity:0;transform:scaleX(.2)}}
@keyframes prCard{from{opacity:0;transform:translateY(24px) scale(.985)}}

@media (prefers-reduced-motion:reduce){
  .pr-cardtop,.pr-rule,.pr-card{animation:none}
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
const ICON_SUN = SVG(`<circle cx="12" cy="12" r="4.1"/><path d="M12 2.6v2.3M12 19.1v2.3M4.36 4.36l1.63 1.63M18.01 18.01l1.63 1.63M2.6 12h2.3M19.1 12h2.3M4.36 19.64l1.63-1.63M18.01 5.99l1.63-1.63"/>`, 17);
const ICON_MOON = SVG(`<path d="M20.4 13.4A8.3 8.3 0 0 1 10.6 3.6a8.4 8.4 0 1 0 9.8 9.8z"/>`, 17);
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

// THE LOGO LIVES INSIDE THE CARD NOW, with the theme switch opposite it.
// Operator instruction, 2026-08-02: "put the Akvaterm logo within this card and
// the light dark mode button as well ... look at how ASC place their elements
// and copy that precisely". ASC's login card opens with exactly this row — the
// mark top-left, the controls top-right (js/app.js:508-521, .auth-shell holding
// .auth-logo and .auth-seg) — and the card owns both.
//
// It used to sit above the card on the page ground, which is why the contrast
// note in this file's header measures it against --paper. It is measured
// against the GLASS now: --logo-navy #00008C on the worst-case strong-glass
// composite #D7DCDD is 11.28:1, --logo-red #d6252e is 3.74:1, and the mark is
// set at 26-30px weight 800, so the 3:1 large-text threshold is the one that
// applies and the red clears it. In dark theme AKVA takes --ink, exactly as
// css/styles.css already does for every other placement of the mark.
function cardTop() {
  return `
    <div class="pr-cardtop">
      <p class="pr-mark wordmark"><span class="akva">AKVA</span><span class="term">TERM</span></p>
      <button type="button" class="pr-theme" id="prTheme" aria-pressed="false"
              aria-label="${esc(tf("theme.label", "Tamna tema"))}">
        <span class="pr-themeic"></span>
      </button>
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

// mode: "signin" | "signup". ASC switches between the two INSIDE one card
// rather than routing to a second screen (js/app.js paintLogin), and that is
// the arrangement being copied: the card keeps its position, its logo and its
// theme switch, and only the body under the title changes.
let mode = "signin";

function signInMarkup(configured) {
  const signup = mode === "signup";

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
      value: rememberedEmail(),
    }) +
    field("prPass", "prijava.password", "Lozinka", {
      icon: ICON_LOCK, type: "password", name: "password",
      // new-password on the signup pass, or a password manager offers the
      // saved one instead of generating a fresh one.
      autocomplete: signup ? "new-password" : "current-password", eye: true,
    });

  // Sign-in only. There is nothing to recover on a form that is creating the
  // account, and offering it there invites the user to reset a password that
  // does not exist yet.
  const forgot = signup ? "" : `
        <div class="pr-rowend">
          <button type="button" class="pr-forgot" id="prForgot">${esc(tf("prijava.forgot", "Zaboravljena lozinka?"))}</button>
        </div>`;

  const cta = signup
    ? esc(tf("prijava.signupCta", "Napravi račun"))
    : esc(tf("prijava.submit", "Prijavi se"));

  // <fieldset disabled> is a NATIVE disable: on a build with no backend the
  // controls are not focusable and the form cannot be submitted at all, so
  // there is no path on which a password is typed into something that will
  // never check it.
  const form = `
    <form class="pr-form" id="prForm" novalidate autocomplete="on">
      <fieldset${configured ? "" : " disabled"}>
        ${fields}
        ${forgot}
        <button type="submit" class="btn btn-primary btn-lg" id="prSubmit">
          ${cta}${ICON_ARROW}
        </button>
      </fieldset>
      <p class="pr-msg" id="prMsg" role="status" aria-live="polite"></p>
    </form>`;

  // Disabled rather than hidden without a backend, and for the same reason the
  // email form is: a control that is present but plainly unavailable explains
  // the build, where a missing control just looks like a feature nobody built.
  const google = `
      <button type="button" class="btn btn-block pr-google" id="prGoogle"${configured ? "" : " disabled"}>
        ${ICON_GOOGLE}
        <span class="pr-glabel">${esc(tf("prijava.google", "Nastavi s Googleom"))}</span>
      </button>
      <p class="pr-msg" id="prGoogleMsg" role="status" aria-live="polite"></p>`;

  // The switch between the two modes. A <button>, not a link: it changes what
  // this card is, it does not navigate anywhere.
  const swap = signup
    ? `<p class="pr-foot">${esc(tf("prijava.haveAccount", "Već imate račun?"))}
         <button type="button" class="pr-footlink" id="prSwap">${esc(tf("prijava.toSignin", "Prijavite se"))}</button></p>`
    : `<p class="pr-foot">${esc(tf("prijava.firstTime", "Prvi put ovdje?"))}
         <button type="button" class="pr-footlink" id="prSwap">${esc(tf("prijava.createAccount", "Napravi račun"))}</button></p>`;

  // ORDER IS ASC'S, copied deliberately (see docs/HOUSE_STANDARD.md):
  // logo + theme switch, title, subtitle, Google, divider, fields, forgot,
  // primary, status, footer swap. On the signup side ASC puts the primary and
  // the divider the other way round - the fastest path stays first for a
  // RETURNING user, and for a NEW one the form is the point - and that
  // inversion is copied too rather than smoothed over.
  const body = signup
    ? `${form}
       <div class="pr-div">${esc(tf("prijava.or", "ili"))}</div>
       ${google}`
    : `${google}
       <div class="pr-div">${esc(tf("prijava.orEmail", "ili e-mailom"))}</div>
       ${form}`;

  return `
    <div class="pr-wrap">
      <section class="pr-card glass-strong" aria-labelledby="prTitle">
        ${cardTop()}
        <h1 class="pr-title" id="prTitle">${esc(signup
          ? tf("prijava.createTitle", "Otvorite račun")
          : tf("prijava.title", "Dobrodošli natrag"))}</h1>
        <p class="pr-sub">${esc(signup
          ? tf("prijava.createSub", "Spremite favorite i dizajne na svoj račun")
          : tf("prijava.sub", "Kupaonice, grijanje i klimatizacija"))}</p>
        ${notice}
        ${body}
        ${swap}
      </section>
    </div>`;
}

function signedInMarkup(email) {
  const initial = (email || "?").trim().charAt(0).toUpperCase() || "?";
  return `
    <div class="pr-wrap">
      <section class="pr-card glass-strong" aria-labelledby="prTitle">
        ${cardTop()}
        <h1 class="pr-title" id="prTitle">${esc(tf("prijava.signedInTitle", "Prijavljeni ste"))}</h1>
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
  wireCardTop(container);
}

// The theme switch and the mode swap. Wired even when there is no backend:
// the theme is a client preference and the swap only changes what this card
// renders, so neither depends on accounts being switched on.
function wireCardTop(container) {
  const themeBtn = container.querySelector("#prTheme");
  if (themeBtn) {
    const sync = () => {
      const stored = (() => { try { return localStorage.getItem("akv:theme") || ""; } catch { return ""; } })();
      const dark = stored ? stored === "dark"
        : Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
      themeBtn.setAttribute("aria-pressed", String(dark));
      return dark;
    };
    sync();
    themeBtn.addEventListener("click", () => {
      const dark = themeBtn.getAttribute("aria-pressed") === "true";
      // Written through the SAME key js/app.js owns, so the switch here and the
      // one in the drawer are one setting rather than two that disagree. app.js
      // re-reads it on its own next applyTheme(); the attribute write below is
      // what makes it take effect now.
      try { localStorage.setItem("akv:theme", dark ? "light" : "dark"); } catch { /* storage blocked */ }
      document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
      sync();
    });
  }

  const swap = container.querySelector("#prSwap");
  swap?.addEventListener("click", () => {
    mode = mode === "signup" ? "signin" : "signup";
    if (container.isConnected) render(container);
  });
}

// "Zaboravljena lozinka?" — a real reset mail, not a placeholder.
//
// The success wording is deliberately conditional ("if that address is
// registered"): Supabase does not reveal whether an address exists, because an
// endpoint that did would be an account-enumeration oracle. Saying "sent" would
// claim something this cannot actually know.
function wireForgot(container, say, emailInput) {
  const btn = container.querySelector("#prForgot");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const value = emailInput.value.trim();
    if (!value || !EMAIL_RE.test(value)) {
      setFieldError(emailInput, tf("prijava.forgotNeedEmail", "Upišite svoju e-mail adresu pa ponovno pritisnite."));
      emailInput.focus();
      return;
    }
    btn.disabled = true;
    try {
      await requestPasswordReset(value);
      say(tf("prijava.forgotSent", "Ako je adresa registrirana, poslali smo poveznicu za promjenu lozinke."), "is-ok");
    } catch (err) {
      const code = ERR_FALLBACK[err?.code] ? err.code : "other";
      say(tf("prijava.err." + code, ERR_FALLBACK[code]), "is-err");
    } finally {
      btn.disabled = false;
    }
  });
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

  wireForgot(container, say, emailInput);

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
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(emailInput.value.trim(), passInput.value);
        rememberEmail(emailInput.value.trim());
        if (needsConfirmation) {
          // The third state: the account exists but there is no session,
          // because the project confirms addresses by mail. Saying "welcome"
          // here would be a lie, and saying "failed" would be a worse one.
          say(tf("prijava.confirmSent", "Račun je otvoren. Provjerite e-poštu i potvrdite adresu."), "is-ok");
          return;
        }
        say(tf("prijava.createdOk", "Račun je otvoren."), "is-ok");
        window.AKV?.toast?.(tf("prijava.createdOk", "Račun je otvoren."));
        location.hash = "#/";
        return;
      }
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
