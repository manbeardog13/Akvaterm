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
  /* Champagne gold, not green (operator instruction, 2026-08-04 — "this is
     annoying the green"). Replaces the pale olive-green accent everywhere
     it appeared on this screen: primary button fill, focus rings, the
     notice icon, the avatar chip. */
  --pr-input:rgba(255,255,255,.075);--pr-accent:#e6d7a8;
  --pr-accent-ink:#17130a;--pr-danger:#ff9a88;--pr-ok:#a9e3bd;
  --pr-dark-photo-opacity:1;--pr-light-photo-opacity:0;
  --pr-card-light-reflection:0;
  --pr-card-reference-width:412px;
  /* Superseded 2026-08-04: the original -10% here was the operator's own
     later instruction — "match the reference card's SHAPE" — to a card
     ~0.75 wide:tall, audited live against ~0.6 at .9. This is a real
     conflict with the earlier "-10% narrower" instruction; shape fidelity
     to the explicit, repeated, audited reference wins.
     Round 1 (.9 -> 1.1): two reviewers independently measured 371x621
     (0.597) against the reference and converged on ~455px wide.
     Round 2, after Pillow-measuring the reference JPEG directly: its real
     ratio is 0.745-0.761, not ~0.73 — 1.1 landed at 0.786-0.809, ~5-8% wide.
     1.05 targeted the corrected number and was confirmed live at 0.750 by
     six independent measurements across two audit rounds.
     Operator instruction, 2026-08-04: "reduce the card by about 15%" —
     applied as a uniform 0.85x on top of the audited 1.05, preserving the
     0.750 ratio rather than letting it drift (0.85x on width alone would
     have; scaling width and vscale by the same factor keeps both
     dimensions shrinking together, matching the ratio's own derivation). */
  --pr-card-scale:.89;
  /* Originally the 52px/44px controls HOUSE_STANDARD.md protects couldn't
     shrink, so vscale did all the compressible-spacing work alone. Operator
     instruction, 2026-08-04, "scale the buttons": that floor is gone by
     explicit request now (controls cut to 44px/38px directly on their own
     rules, below) — this token still compresses everything else the same
     way it always did.
     .3 (chasing an exact -15% height target) read as cramped on a real
     device — "look how tight everything is... perfect spacing... marvelous"
     (operator, 2026-08-04). .8 restores real breathing room between every
     element; the card is a little taller than the -15% target as a direct
     result, and that trade was made on purpose — spacing quality over a
     specific height number. */
  --pr-card-vscale:.8;
  /* The one dial for "how much light passes through the glass." Round 2
     (Pillow-measured against the reference JPEG): the reference glass
     DARKENS its backdrop, where 1 here measured as net-neutral-to-lightening.
     Round 3, against a controlled A/B (identical frame with/without the
     card): .9 combined with the new dark scrim fill still only reached
     0.927-0.949 against a like-for-like reference measurement of 0.820 —
     roughly a third of the needed darkening. .82 targets that number
     directly. Light theme (below) was found to apply NO darkening at all
     (a real bug: --pr-card-glass-lift was 1 there, and light-OS visitors
     saw zero darkening even before any theme JS ran) — .88 fixes that while
     staying the lighter of the two per the operator's original instruction. */
  --pr-card-glass-lift:.82;
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
/* Operator instruction, 2026-08-04: the photograph itself is never blurred —
   it is sharp everywhere, all the time. The ONLY blur anywhere on this
   screen is the card's own backdrop-filter, which is an optical property of
   looking THROUGH that one rectangle of glass, not an effect applied to the
   photo layer. The card still has its own entrance (prCardMaterialize,
   below), 1.6s after the threshold opens — that timing is unchanged, it was
   only ever the background's blur-in that is gone. */

/* HOUSE_STANDARD.md defines a 412px canonical card and records 327px at
   375x812 once its 24px page gutters are paid; --pr-card-scale then takes a
   further 10% off both dimensions. Controls and hit targets never scale —
   only the sheet's own vertical rhythm compresses to make the height follow. */
.pr-card{
  position:relative;z-index:3;isolation:isolate;display:flex;flex-direction:column;justify-content:center;
  /* .pr-wrap's own padding (above) is the ONLY page gutter — do not double
     it here. But "100%" as the mobile ceiling was a real bug (found live,
     2026-08-04): on a phone the calc() value almost always EXCEEDS available
     width, so min() picked the 100% ceiling every time — meaning
     --pr-card-scale had NO visible effect below roughly a 460px viewport at
     all. A "-15% smaller" instruction landed on desktop and was invisible on
     the phone it was tested on. Capping the ceiling at 85% of available
     width (not 100%) gives mobile the same real size cut, with genuine
     margin around the card instead of edge-to-edge full-bleed. */
  width:min(calc(var(--pr-card-reference-width) * var(--pr-card-scale)),85%);min-width:0;margin:44px auto;
  padding:calc(28px * var(--pr-card-vscale)) calc(24px * var(--pr-card-vscale)) calc(22px * var(--pr-card-vscale));
  color:var(--pr-text);
  /* TRANSLUCENT GLASS (operator instruction, 2026-08-04, repeated). Audited
     2026-08-04: the previous two-layer background (padding-box, then
     border-box) trick was a REAL BUG, not a tuning value — the border-box
     gradient layer (up to .5 alpha) is not confined to the 1px ring the way
     that trick requires; it only stays ring-only when the padding-box layer
     over it is opaque enough to hide it in the interior. Ours wasn't (by
     design), so that "border gradient" was painting straight across the
     whole card face — the actual dominant cause of the milky look,
     independently confirmed by two reviewers. Fixed by dropping the trick
     entirely: a single low-alpha fill, a plain translucent border colour
     (no gradient), and the inset box-shadow below for the top rim — which
     both reviewers separately confirmed already reads correctly on its own.
     NOTE FOR FUTURE EDITS: this whole file is one JS template literal — a
     literal backtick anywhere in here (including inside a comment) silently
     truncates it. node --check does not catch this; only an actual
     import()/module load does. That is exactly the bug that broke this
     file for a while during this same audit. */
  /* Round 2 audit (2026-08-04, Pillow-measured against the reference JPEG):
     radius should be ~10% of card width not 6.6% (45px not 30px); the
     reference's glass DARKENS its backdrop (0.75-0.91x) where this card was
     net-neutral-to-lightening; and the top rim read 7.56x brighter than its
     interior where the reference is a soft 2.27x.
     Round 3a: fixing radius/brightness/rim-alpha wasn't enough — a reviewer
     measured that the fill's own white top-stop plus the inset top-rim
     glow were ADDITIVELY CANCELLING the brightness(.9) darkening (measured
     net transfer 0.93-1.09, i.e. still net-neutral). The reference's rim
     is a PLAIN 1px border at alpha .138 and NOTHING else stacked on it — no
     inset glow. .14 was already correct; the inset highlight below it was
     the redundant, over-bright second layer. Removed.
     Round 3b, against a pixel-exact background plate (card hidden, same
     frame diffed): still 1.28x its own true backdrop. That round's reviewer
     read the reference's face as a near-flat scrim (std 3.4) and pushed the
     fill to .36-.44 alpha to compress contrast, not just tint it.
     Round 4, with a more careful sample (excluding text, checking multiple
     regions): the reference glass actually PRESERVES real structure — std
     8.8 on a clean band, std 29.7 where the chair crosses it — the "std 3.4"
     read came from an unrepresentative slice. At .36-.44 the live glass had
     over-corrected: transmission 0.77 against a corroborated ~0.82-0.85
     target, contrast halved. Cut back to .16-.24 — still, on a real device,
     read as "still not transparent" (operator, 2026-08-04, direct — the most
     reliable signal in this whole thread beats any further agent pixel
     analysis). Cut again, harder, trusting that over the contested target
     numbers: real scene detail should be the dominant thing you see. */
  background:linear-gradient(180deg,rgba(14,14,14,.07),rgba(10,10,10,.09) 50%,rgba(6,6,6,.12) 100%);
  border:1px solid rgba(255,255,255,.14);border-radius:45px;
  /* The outer white glow measured as part of the rim's light trail even
     though it paints outside the card box — removed. */
  box-shadow:0 30px 80px -34px rgba(0,0,0,.4),inset 0 -1px 0 rgba(0,0,0,.1);
  /* Blur: the two round-2 reviewers disagreed by nearly 4x on the reference's
     actual blur radius (one estimated ~12px-equivalent, the other measured a
     10-90% edge transition and derived ~3px-equivalent). 6px sits between
     them pending a real screenshot to arbitrate. */
  backdrop-filter:blur(6px) saturate(1.02) brightness(var(--pr-card-glass-lift));
  -webkit-backdrop-filter:blur(6px) saturate(1.02) brightness(var(--pr-card-glass-lift));overflow:hidden;
  /* The card is not placed — it materializes, 1.6s after the threshold
     opens (operator instruction, 2026-08-04), once the background behind it
     has already resolved from blur to clarity. */
  animation:prCardMaterialize 900ms cubic-bezier(.22,1,.36,1) 1600ms both;
}
/* prCardMaterialize handles the sheet itself; the .pr-particles field
   (populated in js/views/prijava.js, skipped entirely under reduced motion)
   is what makes it read as particles coalescing into glass out of thin air,
   rather than a plain fade/scale. Both start at the same 1.6s mark. */
@keyframes prCardMaterialize{
  from{opacity:0;transform:scale(.94) translateY(8px);filter:blur(14px)}
  to{opacity:1;transform:none;filter:none}
}
.pr-card>.pr-particles{position:absolute;z-index:2;inset:-64px;pointer-events:none;overflow:visible}
.pr-particle{
  position:absolute;top:50%;left:50%;display:block;opacity:0;
  transform:translate3d(0,0,0);mix-blend-mode:screen;filter:blur(.8px);border-radius:999px;
  background:radial-gradient(circle,rgba(255,255,255,.95) 0,rgba(255,255,255,.34) 40%,rgba(255,255,255,0) 76%);
  animation:prCardParticleConverge var(--pr-particle-duration) cubic-bezier(.22,1,.36,1) var(--pr-particle-delay) both;
}
@keyframes prCardParticleConverge{
  0%{opacity:0;transform:translate3d(var(--pr-particle-x),var(--pr-particle-y),0) scale(.18);filter:blur(3px)}
  50%{opacity:.9}
  100%{opacity:0;transform:translate3d(0,0,0) scale(.04);filter:blur(.4px)}
}
.pr-card::before{
  content:"";position:absolute;z-index:0;inset:1px;pointer-events:none;border-radius:44px;
  /* Round 3 audit: this pseudo's side inset rims and top wash were measured
     as a SECOND bright band stacked just inside the border — the reference
     has one plain 1px border and nothing behind it. Cut down to a single
     soft bottom darkening, which reinforces the reference's own darkening
     instead of fighting it, and nothing bright at all. */
  box-shadow:inset 0 -22px 34px -28px rgba(0,0,0,.14);
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
  position:absolute;z-index:0;inset:1px;pointer-events:none;border-radius:44px;
  /* Audited 2026-08-04, round 1 (independent agent review): at .28 this
     alone painted a near-opaque white wash over ~70% of the card's top — the
     single biggest cause of the "still not transparent" complaint. Cut to
     .12. Round 2: still measured as a +20 to +25 luminance bloom at its
     centre against a reference that has no such bloom at all (one clean
     glass row read dead-flat). Cut further to .05 — present as a faint
     highlight for the pointer-hover state to still read against, not a body
     of its own. */
  background-image:radial-gradient(closest-side,rgba(255,255,255,.05),transparent 72%);
  background-size:85% 70%;background-repeat:no-repeat;background-position:50% 0%;
  transition:background-position 420ms cubic-bezier(.22,1,.36,1);
}
.pr-card::after{
  /* Round 4 audit: this light-theme-only layer was the one place the earlier
     "one plain border, nothing stacked" principle never got applied — its
     border-top/box-shadow measured a real, unambiguous lightening defect at
     the top (up to 3.85x its backdrop) and right edge (2.24x) in light
     theme specifically, the exact "glass lightens instead of darkens"
     failure rounds 2-3 fixed everywhere else. --pr-card-glass-lift already
     carries "light gets a little more light than dark" on its own; this
     layer was redundant with it and is cut down to nothing brighter than
     the border itself. */
  content:"";position:absolute;z-index:0;inset:2px;pointer-events:none;border-radius:43px;
  opacity:var(--pr-card-light-reflection);transition:opacity 1100ms cubic-bezier(.22,1,.36,1);
}
.pr-card>*{position:relative;z-index:1}
.pr-cardtop{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:calc(20px * var(--pr-card-vscale))}
/* Every font-size below is ~15% off its pre-2026-08-04 value, same factor as
   the card itself (operator instruction: "reducing everything... including
   text" — not just the card's box). Interactive control HEIGHTS (44/52px)
   are the one thing still excluded — that is an accessibility tap-target
   floor, not a look-and-feel choice. */
.pr-mark{margin:0;font-size:clamp(20px,2.4vw,26px);line-height:1;letter-spacing:-.055em}
.pr-mark .akva{color:#f8f8f4;text-shadow:none}.pr-mark .term{color:#e4454d;text-shadow:none}
.pr-theme{
  position:relative;width:39px;height:38px;padding:0;flex:none;border:0;
  border-radius:999px;background:transparent;cursor:pointer;
}
.pr-theme::before{content:"";position:absolute;inset:9px 0;border:1px solid var(--pr-line);border-radius:999px;background:var(--pr-soft)}
.pr-themeic{position:absolute;z-index:1;top:12px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--pr-text);transition:transform 260ms cubic-bezier(.2,.85,.25,1)}
.pr-theme[aria-pressed=true] .pr-themeic{transform:translateX(20px)}
.pr-theme:focus-visible{outline:2px solid var(--pr-accent);outline-offset:3px}
/* clamp bounds scaled down with the card (2026-08-04, "-15% more"): at the
   old 30-45px range "Dobrodošli natrag" wrapped to two lines on the now-
   narrower card, adding a full extra line of height back — the opposite of
   what a size reduction should do. Measured live: 38px is the largest size
   that still fits the longest title on one line at the new width. */
/* "Just a itsy bitsy" bump (operator instruction, 2026-08-04). First tried
   +2px both ends (28-40px) and it wrapped at the card's actual width —
   measured live, 37.72px was the real one-line ceiling at 366.67px. 37px
   is the largest safe value under that. */
.pr-title{margin:0;color:var(--pr-text);font-family:var(--font-display);font-size:clamp(28px,3.4vw,37px);font-weight:450;line-height:1.03;letter-spacing:-.04em}
.pr-sub{margin:calc(12px * var(--pr-card-vscale)) 0 calc(26px * var(--pr-card-vscale));color:var(--pr-muted);font-size:12px;line-height:1.5}
.pr-notice{display:flex;gap:10px;margin:0 0 calc(18px * var(--pr-card-vscale));padding:calc(12px * var(--pr-card-vscale)) calc(14px * var(--pr-card-vscale));border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-soft);color:var(--pr-muted)}
.pr-nic{display:flex;flex:none;color:var(--pr-accent)}
.pr-noticetext{font-size:10px;line-height:1.45}.pr-noticetext b{display:block;margin-bottom:2px;color:var(--pr-text);font-size:10px}.pr-noticetext span{display:block}
.pr-form fieldset{min-inline-size:0;margin:0;padding:0;border:0}.pr-form fieldset[disabled]{opacity:.5}
.pr-field{margin-bottom:calc(11px * var(--pr-card-vscale))}.pr-input{position:relative;display:flex;align-items:center;min-height:44px;border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-input);transition:border-color 160ms ease,background 160ms ease}
.pr-input:focus-within{border-color:rgba(230,215,168,.72);background:rgba(255,255,255,.1);box-shadow:0 0 0 3px rgba(230,215,168,.09)}
/* The icon and the reveal button used to sit in the flex flow, which shrank
   the <input> itself down to the gap between them -- so the native
   iOS/Safari focus-and-autofill highlight (which traces the INPUT's own
   box, not .pr-input's) started after the icon and, on the password field
   only, stopped short of the eye button, making the two fields look wired
   differently (operator report, 2026-08-05, on-device screenshots). Taking
   icon and eye out of flow makes the input the pill's full edge-to-edge
   box on both fields, so any native ring traces the same rectangle either
   way. */
.pr-ic{position:absolute;left:16px;top:50%;transform:translateY(-50%);display:flex;color:var(--pr-muted);pointer-events:none}
.pr-input input{width:100%;min-width:0;padding:0 14px 0 48px;border:0;outline:0;background:transparent;color:var(--pr-text);font:500 13px/1 var(--font-text)}
.pr-input.has-eye input{padding-right:44px}
.pr-input input::placeholder{color:var(--pr-muted);opacity:1}.pr-eye{position:absolute;right:3px;top:50%;transform:translateY(-50%);display:grid;place-items:center;min-width:38px;min-height:38px;padding:0;border:0;background:transparent;color:var(--pr-muted);cursor:pointer}.pr-eye:focus-visible{outline:2px solid var(--pr-accent);outline-offset:-4px;border-radius:11px}
.pr-err{display:block;min-height:0;margin:4px 3px 0;color:var(--pr-danger);font-size:10px;line-height:1.35}.pr-err:not(:empty){min-height:16px}.pr-field.is-bad .pr-input{border-color:var(--pr-danger)}
.pr-rowend{display:flex;justify-content:flex-end;margin:-2px 2px calc(10px * var(--pr-card-vscale))}.pr-forgot,.pr-footlink{min-height:38px;padding:0;border:0;background:none;color:var(--pr-muted);font:600 11px/1 var(--font-text);cursor:pointer}.pr-footlink{display:inline-flex;align-items:center;vertical-align:middle;color:var(--pr-accent);margin-left:5px}.pr-forgot:hover,.pr-footlink:hover{color:var(--pr-text)}.pr-forgot:focus-visible,.pr-footlink:focus-visible{outline:2px solid var(--pr-accent);outline-offset:2px;border-radius:5px}
/* Button/input heights cut ~15% too (operator instruction, 2026-08-04,
   "scale the buttons"): 52px->44px, 44px->38px. Below the WCAG 44px
   guideline on the primary controls now — a deliberate call by the product
   owner, not an oversight; flagging it here so it reads as intentional. */
.pr-card .btn{min-height:44px;border-radius:14px;font-size:11px;font-weight:700;letter-spacing:.01em;box-shadow:none}.pr-card .btn-primary{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid rgba(255,255,255,.32);background:var(--pr-accent);color:var(--pr-accent-ink);box-shadow:0 14px 34px -18px rgba(230,215,168,.72)}
.pr-card .btn-primary:hover{filter:brightness(1.04);transform:translateY(-1px)}.pr-card .btn:focus-visible{outline:2px solid var(--pr-accent);outline-offset:3px}.pr-card .btn:disabled{cursor:not-allowed;filter:none;transform:none;box-shadow:none}
.pr-google{position:relative;display:grid!important;grid-template-columns:28px 1fr 28px;align-items:center;width:100%;border:1px solid var(--pr-line)!important;background:var(--pr-soft)!important;color:var(--pr-text)!important}.pr-google>svg{justify-self:center}.pr-glabel{justify-self:center}.pr-google.is-busy .pr-glabel{opacity:.55}
.pr-div{display:flex;align-items:center;gap:12px;margin:calc(16px * var(--pr-card-vscale)) 0;color:var(--pr-muted);font-size:9px;text-transform:uppercase;letter-spacing:.12em}.pr-div::before,.pr-div::after{content:"";height:1px;flex:1;background:var(--pr-line)}
.pr-msg{min-height:0;margin:calc(6px * var(--pr-card-vscale)) 0 0;color:var(--pr-muted);font-size:10px;line-height:1.4;text-align:center}.pr-msg:not(:empty){min-height:17px}.pr-msg.is-err{color:var(--pr-danger)}.pr-msg.is-ok{color:var(--pr-ok)}
.pr-guest{margin-top:calc(16px * var(--pr-card-vscale))}.pr-guesthint{margin:calc(9px * var(--pr-card-vscale)) 0 0;color:var(--pr-muted);font-size:10px;line-height:1.45;text-align:center}
.pr-foot{margin:calc(32px * var(--pr-card-vscale)) 0 0;text-align:center;color:var(--pr-muted);font-size:11px}.pr-note{margin:calc(16px * var(--pr-card-vscale)) 0 0;color:var(--pr-muted);font-size:10px;line-height:1.45;text-align:center}
.pr-who{display:flex;align-items:center;gap:13px;margin:calc(24px * var(--pr-card-vscale)) 0;padding:calc(14px * var(--pr-card-vscale));border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-soft)}.pr-avatar{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:50%;background:var(--pr-accent);color:var(--pr-accent-ink);font-weight:800}.pr-whotext{min-width:0}.pr-whotext b,.pr-whotext span{display:block}.pr-whotext b{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--pr-muted)}.pr-whotext span{margin-top:3px;color:var(--pr-text);font-size:11px;overflow-wrap:anywhere}.pr-stack{display:flex;flex-direction:column;gap:calc(10px * var(--pr-card-vscale))}
/* Theme changes the photographic state, never the glass sheet. Both files are
   full 4K renders of the same room; no CSS exposure trick is used. */
html[data-akv-auth][data-theme=light]{
  --pr-dark-photo-opacity:0;--pr-light-photo-opacity:1;
  --pr-card-light-reflection:1;--pr-card-glass-lift:.88;
}
@media(prefers-color-scheme:light){
  html[data-akv-auth]:not([data-theme=dark]){--pr-dark-photo-opacity:0;--pr-light-photo-opacity:1;--pr-card-light-reflection:1;--pr-card-glass-lift:.88}
}

/* Below 760px the only thing that changes is typography and the photo's own
   crop compensation (a portrait 4K source needs a different object-fit crop
   on a portrait viewport than a landscape one) — layout, gutters, the glass
   card recipe and the background treatment are the SAME rule everywhere. */
@media(max-width:760px){
  .pr-scene-media img{transform:scale(1.055)}
  .pr-card{min-height:auto;margin:auto}
  /* Measured live at the 85%-capped mobile width (293px on a 393px phone):
     34px wrapped "Dobrodošli natrag" to two lines. 29px is the largest size
     that still fits it on one, confirmed the same way the desktop clamp
     was earlier. */
  .pr-title{font-size:clamp(24px,9vw,29px)}.pr-sub{margin-bottom:calc(20px * var(--pr-card-vscale))}.pr-foot{margin-top:calc(26px * var(--pr-card-vscale))}
}
@media(max-width:380px){.pr-notice{padding:calc(10px * var(--pr-card-vscale)) calc(11px * var(--pr-card-vscale))}.pr-cardtop{margin-bottom:calc(24px * var(--pr-card-vscale))}}
@media(max-height:760px) and (max-width:760px){.pr-card{margin-top:68px}.pr-cardtop{margin-bottom:calc(22px * var(--pr-card-vscale))}.pr-sub{margin-bottom:calc(16px * var(--pr-card-vscale))}.pr-foot{margin-top:calc(22px * var(--pr-card-vscale))}}

@media(prefers-reduced-motion:reduce){
  .pr-wrap,.pr-card,.pr-sheen,.pr-scene-media,.pr-scene-media img,.pr-themeic,.pr-card .btn,
  .pr-card::after,.pr-particles,.pr-particle{transition:none!important;transform:none!important;animation:none!important}
  .pr-particles{display:none}
}
@media(prefers-reduced-transparency:reduce){html:not([data-transparency=full]) .pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}}
html[data-transparency=reduced] .pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}
@media(prefers-contrast:more){.pr-card,.pr-input,.pr-notice,.pr-google{border-width:2px!important}.pr-card::before,.pr-card::after,.pr-sheen,.pr-scene::after{display:none}.pr-muted{opacity:1}}
@media(forced-colors:active){
  .pr-wrap,.pr-card,.pr-input,.pr-notice,.pr-google,.pr-who{forced-color-adjust:auto;border:1px solid CanvasText;background:Canvas;color:CanvasText}
  .pr-scene{display:none}.pr-card{width:min(var(--pr-card-reference-width),calc(100% - 32px))}.pr-mark .akva,.pr-mark .term,.pr-title,.pr-sub,.pr-noticetext,.pr-noticetext b{color:CanvasText}.pr-card .btn-primary{background:Highlight;color:HighlightText}
}
`;
