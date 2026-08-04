// The login threshold is art-directed exclusively from the operator's supplied
// photo set and the approved project-local cinematic interior derived from it:
// one photographic field, one compact translucent card, and no scene copy.
// The image is shipped with the static site; there is no runtime image service,
// GPU dependency, external request, or borrowed interface artwork.

export const LOGIN_PHOTO_CSS = `
html[data-akv-auth] .topbar,
html[data-akv-auth] .tabbar{display:none}
html[data-akv-auth]{
  --pr-page:#d9ddd4;--pr-shell:#0b0d0c;--pr-panel:#0a0b0b;
  --pr-text:#f7f7f2;--pr-muted:rgba(247,247,242,.58);
  --pr-line:rgba(255,255,255,.13);--pr-soft:rgba(255,255,255,.065);
  --pr-input:rgba(255,255,255,.075);--pr-accent:#d7e2ba;
  --pr-accent-ink:#10130d;--pr-danger:#ff9a88;--pr-ok:#a9e3bd;
  --pr-dark-photo-opacity:1;--pr-light-photo-opacity:0;
  --pr-card-light-reflection:0;
  --pr-card-reference-width:412px;
  /* A further -10% on top of the already-compact House Standard reference
     (operator instruction, 2026-08-04). Width applies the factor directly;
     vertical rhythm (padding/margins, NOT control hit-targets — see the note
     above .pr-card) is scaled by the same factor so both dimensions shrink
     together. */
  --pr-card-scale:.9;
  /* The fixed-height controls (52px inputs/buttons, 44px links) that
     HOUSE_STANDARD.md protects cannot shrink, so a flat .9 on every margin
     only bought ~3% off the total card height. --pr-card-vscale compresses
     just the compressible vertical rhythm (paddings, margins, gaps) harder
     than the width itself shrinks, so the -10% height target lands on the
     one thing actually free to move. Measured live against a 1280x720
     viewport, unconfigured/guest build, sign-in mode. */
  --pr-card-vscale:.68;
  /* The one dial for "how much light passes through the glass." 1 is
     neutral — no lift, no dimming, matching a real pane of glass. Dark theme
     stays at neutral; light theme (below) is set a little above it —
     operator instruction: light mode gets a little more light than dark. */
  --pr-card-glass-lift:1;
}
html[data-akv-auth] body{min-height:100%;overflow-x:hidden;overflow-y:auto;background:#0b0d0c}
html[data-akv-auth] #main{width:100%;max-width:none;min-height:100dvh;margin:0;padding:0;display:flex}
/* ONE full-bleed layout at every breakpoint — desktop, tablet and phone all
   get the same login (operator instruction, 2026-08-04): the photograph
   fills the viewport edge to edge and the card floats over it, with no
   bordered "panel inside a panel" frame that only used to appear at wide
   viewports. The safe-area-aware padding formula below already adapts
   itself (env() resolves to 0 off-device), so it needs no breakpoint. */
.pr-wrap{
  position:relative;isolation:isolate;display:grid;place-items:center;
  width:100%;min-height:100dvh;margin:0;
  padding:max(56px,calc(env(safe-area-inset-top,0px) + 40px)) 24px
          max(56px,calc(env(safe-area-inset-bottom,0px) + 40px));
}

/* Project-local cinematic interior. The approved photograph is content, not a
   decorative network fetch: it is precached by service-worker.js and remains
   usable on GitHub Pages and offline. Fixed, not absolute, at every
   breakpoint: the background stays pinned behind the card even if a very
   short viewport makes the page scroll. */
.pr-scene{
  position:fixed;z-index:0;inset:0;overflow:hidden;background:#0b0d0c;
}
.pr-scene-media{
  position:absolute;inset:0;display:block;overflow:hidden;
  transform-origin:50% 50%;animation:prSceneClockwiseSettle 96s cubic-bezier(.16,.62,.18,1) both;
}
.pr-scene-media img{
  position:absolute;inset:0;width:100%;height:100%;display:block;
  object-fit:cover;object-position:50% 50%;transform:scale(1.025);
  transform-origin:50% 50%;
  transition:opacity 1100ms cubic-bezier(.22,1,.36,1);
}
.pr-scene-dark{opacity:var(--pr-dark-photo-opacity)}
.pr-scene-light{opacity:var(--pr-light-photo-opacity)}
.pr-scene::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.28) 45%,rgba(0,0,0,.52));
}
@keyframes prSceneClockwiseSettle{from{transform:rotate(0deg)}to{transform:rotate(1.35deg)}}

/* HOUSE_STANDARD.md defines a 412px canonical card and records 327px at
   375x812 once its 24px page gutters are paid; --pr-card-scale then takes a
   further 10% off both dimensions. Controls and hit targets never scale —
   only the sheet's own vertical rhythm compresses to make the height follow. */
.pr-card{
  position:relative;z-index:3;isolation:isolate;display:flex;flex-direction:column;justify-content:center;
  /* .pr-wrap's own padding (above) is the ONLY gutter now — do not double it
     here. That used to be split between a desktop rule (no wrap padding, so
     the card subtracted its own 48px) and a mobile override (wrap already
     padded, so the card just took 100%); unifying .pr-wrap's padding across
     breakpoints means this rule can simply be the one the mobile override
     used to be. */
  width:min(calc(var(--pr-card-reference-width) * var(--pr-card-scale)),100%);min-width:0;margin:44px auto;
  padding:calc(28px * var(--pr-card-vscale)) calc(24px * var(--pr-card-vscale)) calc(22px * var(--pr-card-vscale));
  color:var(--pr-text);
  /* Neutral glass, not tinted glass (operator reference, 2026-08-04 — the
     @uix.vikram job-card screenshot): the material itself carries almost no
     colour of its own. What reads as "premium" there is how MUCH of the real
     scene survives through it, not a green/amber wash on top of it. Pushed
     to maximum transparency (operator instruction, 2026-08-04): the fill is
     nearly gone — the border ring is what still reads as "a card" at all. */
  background:
    linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01) 46%,rgba(0,0,0,.03) 100%) padding-box,
    linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.06)) border-box;
  border:1px solid transparent;border-radius:30px;
  box-shadow:0 40px 100px -32px rgba(0,0,0,.55),0 0 70px -18px rgba(255,255,255,.1),
    inset 0 1.5px 0 rgba(255,255,255,.85),inset 0 -1px 0 rgba(0,0,0,.14);
  /* Liquid-glass, pushed to maximum transparency (operator instruction,
     2026-08-04): blur alone does the "glass" work now — saturate/contrast
     stay near-neutral so the scene behind isn't recoloured, and there is no
     entrance choreography left to compete with it. The card is simply
     there, fully resolved, the instant the view mounts. The bent-edge
     highlight and pointer-tracked sheen below are CSS-only, no SVG
     feDisplacementMap (Safari risk). */
  backdrop-filter:blur(13px) saturate(1.04) brightness(var(--pr-card-glass-lift));
  -webkit-backdrop-filter:blur(13px) saturate(1.04) brightness(var(--pr-card-glass-lift));overflow:hidden;
}
.pr-card::before{
  content:"";position:absolute;z-index:0;inset:1px;pointer-events:none;border-radius:29px;
  background-image:linear-gradient(180deg,rgba(255,255,255,.05),transparent 20%,transparent 78%,rgba(255,255,255,.02));
  /* The wider, softer inset shadows here (28-30px spread) are the "bend" —
     light gathers and warps toward the card's own edges rather than a flat
     1px ring, which is what reads as refraction without an SVG filter. */
  box-shadow:inset 1.5px 0 rgba(255,255,255,.1),inset -1.5px 0 rgba(255,255,255,.06),
    inset 0 18px 30px -26px rgba(255,255,255,.4),inset 0 -20px 32px -28px rgba(0,0,0,.16);
}
/* The pointer-tracked sheen — a real element, not a custom-property-driven
   pseudo-element: background-position on a pseudo whose value derives from a
   var() set on the host does not reliably repaint on every engine, so this
   is the one layer prijava.js's wireCardSheen() sets directly with
   element.style, which is unconditionally reliable. The default 50%/0% is
   the resting "light falls from above" position the reference image shows
   even with no pointer nearby; JS only overrides it on a real mouse hover
   and eases back to it on pointerleave via the transition below. */
.pr-card>.pr-sheen{
  position:absolute;z-index:0;inset:1px;pointer-events:none;border-radius:29px;
  background-image:radial-gradient(closest-side,rgba(255,255,255,.28),transparent 72%);
  background-size:85% 70%;background-repeat:no-repeat;background-position:50% 0%;
  transition:background-position 420ms cubic-bezier(.22,1,.36,1);
}
.pr-card::after{
  content:"";position:absolute;z-index:0;inset:2px;pointer-events:none;border-radius:28px;
  border-top:1px solid rgba(255,255,255,.35);border-right:1px solid rgba(255,255,255,.14);
  box-shadow:inset 0 13px 24px -24px rgba(255,255,255,.7),inset -14px 0 26px -28px rgba(255,255,255,.28);
  opacity:var(--pr-card-light-reflection);transition:opacity 1100ms cubic-bezier(.22,1,.36,1);
}
.pr-card>*{position:relative;z-index:1}
.pr-cardtop{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:calc(20px * var(--pr-card-vscale))}
.pr-mark{margin:0;font-size:clamp(24px,2.4vw,31px);line-height:1;letter-spacing:-.055em}
.pr-mark .akva{color:#f8f8f4;text-shadow:none}.pr-mark .term{color:#e4454d;text-shadow:none}
.pr-theme{
  position:relative;width:46px;height:44px;padding:0;flex:none;border:0;
  border-radius:999px;background:transparent;cursor:pointer;
}
.pr-theme::before{content:"";position:absolute;inset:9px 0;border:1px solid var(--pr-line);border-radius:999px;background:var(--pr-soft)}
.pr-themeic{position:absolute;z-index:1;top:12px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--pr-text);transition:transform 260ms cubic-bezier(.2,.85,.25,1)}
.pr-theme[aria-pressed=true] .pr-themeic{transform:translateX(20px)}
.pr-theme:focus-visible{outline:2px solid var(--pr-accent);outline-offset:3px}
.pr-title{margin:0;color:var(--pr-text);font-family:var(--font-display);font-size:clamp(30px,3.4vw,45px);font-weight:450;line-height:1.03;letter-spacing:-.04em}
.pr-sub{margin:calc(12px * var(--pr-card-vscale)) 0 calc(26px * var(--pr-card-vscale));color:var(--pr-muted);font-size:14px;line-height:1.5}
.pr-notice{display:flex;gap:10px;margin:0 0 calc(18px * var(--pr-card-vscale));padding:calc(12px * var(--pr-card-vscale)) calc(14px * var(--pr-card-vscale));border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-soft);color:var(--pr-muted)}
.pr-nic{display:flex;flex:none;color:var(--pr-accent)}
.pr-noticetext{font-size:11.5px;line-height:1.45}.pr-noticetext b{display:block;margin-bottom:2px;color:var(--pr-text);font-size:12px}.pr-noticetext span{display:block}
.pr-form fieldset{min-inline-size:0;margin:0;padding:0;border:0}.pr-form fieldset[disabled]{opacity:.5}
.pr-field{margin-bottom:calc(11px * var(--pr-card-vscale))}.pr-input{position:relative;display:flex;align-items:center;min-height:52px;border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-input);transition:border-color 160ms ease,background 160ms ease}
.pr-input:focus-within{border-color:rgba(215,226,186,.72);background:rgba(255,255,255,.1);box-shadow:0 0 0 3px rgba(215,226,186,.09)}
.pr-ic{display:flex;margin-left:16px;color:var(--pr-muted)}
.pr-input input{width:100%;min-width:0;padding:0 14px;border:0;outline:0;background:transparent;color:var(--pr-text);font:500 15px/1 var(--font-text)}
.pr-input input::placeholder{color:var(--pr-muted);opacity:1}.pr-eye{display:grid;place-items:center;min-width:44px;min-height:44px;margin-right:3px;padding:0;border:0;background:transparent;color:var(--pr-muted);cursor:pointer}.pr-eye:focus-visible{outline:2px solid var(--pr-accent);outline-offset:-4px;border-radius:11px}
.pr-err{display:block;min-height:0;margin:4px 3px 0;color:var(--pr-danger);font-size:11.5px;line-height:1.35}.pr-err:not(:empty){min-height:16px}.pr-field.is-bad .pr-input{border-color:var(--pr-danger)}
.pr-rowend{display:flex;justify-content:flex-end;margin:-2px 2px calc(10px * var(--pr-card-vscale))}.pr-forgot,.pr-footlink{min-height:44px;padding:0;border:0;background:none;color:var(--pr-muted);font:600 12px/1 var(--font-text);cursor:pointer}.pr-footlink{display:inline-flex;align-items:center;vertical-align:middle;color:var(--pr-accent);margin-left:5px}.pr-forgot:hover,.pr-footlink:hover{color:var(--pr-text)}.pr-forgot:focus-visible,.pr-footlink:focus-visible{outline:2px solid var(--pr-accent);outline-offset:2px;border-radius:5px}
.pr-card .btn{min-height:52px;border-radius:14px;font-size:13px;font-weight:700;letter-spacing:.01em;box-shadow:none}.pr-card .btn-primary{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid rgba(255,255,255,.32);background:var(--pr-accent);color:var(--pr-accent-ink);box-shadow:0 14px 34px -18px rgba(215,226,186,.72)}
.pr-card .btn-primary:hover{filter:brightness(1.04);transform:translateY(-1px)}.pr-card .btn:focus-visible{outline:2px solid var(--pr-accent);outline-offset:3px}.pr-card .btn:disabled{cursor:not-allowed;filter:none;transform:none;box-shadow:none}
.pr-google{position:relative;display:grid!important;grid-template-columns:28px 1fr 28px;align-items:center;width:100%;border:1px solid var(--pr-line)!important;background:var(--pr-soft)!important;color:var(--pr-text)!important}.pr-google>svg{justify-self:center}.pr-glabel{justify-self:center}.pr-google.is-busy .pr-glabel{opacity:.55}
.pr-div{display:flex;align-items:center;gap:12px;margin:calc(16px * var(--pr-card-vscale)) 0;color:var(--pr-muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.pr-div::before,.pr-div::after{content:"";height:1px;flex:1;background:var(--pr-line)}
.pr-msg{min-height:0;margin:calc(6px * var(--pr-card-vscale)) 0 0;color:var(--pr-muted);font-size:12px;line-height:1.4;text-align:center}.pr-msg:not(:empty){min-height:17px}.pr-msg.is-err{color:var(--pr-danger)}.pr-msg.is-ok{color:var(--pr-ok)}
.pr-guest{margin-top:calc(16px * var(--pr-card-vscale))}.pr-guesthint{margin:calc(9px * var(--pr-card-vscale)) 0 0;color:var(--pr-muted);font-size:11.5px;line-height:1.45;text-align:center}
.pr-foot{margin:calc(32px * var(--pr-card-vscale)) 0 0;text-align:center;color:var(--pr-muted);font-size:12px}.pr-note{margin:calc(16px * var(--pr-card-vscale)) 0 0;color:var(--pr-muted);font-size:12px;line-height:1.45;text-align:center}
.pr-who{display:flex;align-items:center;gap:13px;margin:calc(24px * var(--pr-card-vscale)) 0;padding:calc(14px * var(--pr-card-vscale));border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-soft)}.pr-avatar{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:50%;background:var(--pr-accent);color:var(--pr-accent-ink);font-weight:800}.pr-whotext{min-width:0}.pr-whotext b,.pr-whotext span{display:block}.pr-whotext b{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--pr-muted)}.pr-whotext span{margin-top:3px;color:var(--pr-text);font-size:13px;overflow-wrap:anywhere}.pr-stack{display:flex;flex-direction:column;gap:calc(10px * var(--pr-card-vscale))}
/* Theme changes the photographic state, never the glass sheet. Both files are
   full 4K renders of the same room; no CSS exposure trick is used. */
html[data-akv-auth][data-theme=light]{
  --pr-dark-photo-opacity:0;--pr-light-photo-opacity:1;
  --pr-card-light-reflection:1;--pr-card-glass-lift:1.08;
}
@media(prefers-color-scheme:light){
  html[data-akv-auth]:not([data-theme=dark]){--pr-dark-photo-opacity:0;--pr-light-photo-opacity:1;--pr-card-light-reflection:1;--pr-card-glass-lift:1.08}
}

/* Below 760px the only thing that changes is typography and the photo's own
   crop compensation (a portrait 4K source needs a different object-fit crop
   on a portrait viewport than a landscape one) — layout, gutters, the glass
   card recipe and the background treatment are the SAME rule everywhere. */
@media(max-width:760px){
  .pr-scene-media img{transform:scale(1.055)}
  .pr-card{min-height:auto;margin:auto}
  .pr-title{font-size:clamp(29px,9vw,38px)}.pr-sub{margin-bottom:calc(20px * var(--pr-card-vscale))}.pr-foot{margin-top:calc(26px * var(--pr-card-vscale))}
}
@media(max-width:380px){.pr-notice{padding:calc(10px * var(--pr-card-vscale)) calc(11px * var(--pr-card-vscale))}.pr-cardtop{margin-bottom:calc(24px * var(--pr-card-vscale))}}
@media(max-height:760px) and (max-width:760px){.pr-card{margin-top:68px}.pr-cardtop{margin-bottom:calc(22px * var(--pr-card-vscale))}.pr-sub{margin-bottom:calc(16px * var(--pr-card-vscale))}.pr-foot{margin-top:calc(22px * var(--pr-card-vscale))}}

@media(prefers-reduced-motion:reduce){
  .pr-wrap,.pr-card,.pr-sheen,.pr-scene-media,.pr-scene-media img,.pr-themeic,.pr-card .btn,
  .pr-card::after{transition:none!important;transform:none!important;animation:none!important}
}
@media(prefers-reduced-transparency:reduce){html:not([data-transparency=full]) .pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}}
html[data-transparency=reduced] .pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}
@media(prefers-contrast:more){.pr-card,.pr-input,.pr-notice,.pr-google{border-width:2px!important}.pr-card::before,.pr-card::after,.pr-sheen,.pr-scene::after{display:none}.pr-muted{opacity:1}}
@media(forced-colors:active){
  .pr-wrap,.pr-card,.pr-input,.pr-notice,.pr-google,.pr-who{forced-color-adjust:auto;border:1px solid CanvasText;background:Canvas;color:CanvasText}
  .pr-scene{display:none}.pr-card{width:min(var(--pr-card-reference-width),calc(100% - 32px))}.pr-mark .akva,.pr-mark .term,.pr-title,.pr-sub,.pr-noticetext,.pr-noticetext b{color:CanvasText}.pr-card .btn-primary{background:Highlight;color:HighlightText}
}
`;
