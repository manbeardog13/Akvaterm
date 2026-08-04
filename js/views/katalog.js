// ============================================================================
// views/katalog.js — catalog home (#/) and category listing (#/katalog/:id).
// Home: category cards, featured products and the demo-data disclaimer.
// Category: filter chips (format / boja / završna obrada / marka) over a
// product grid with procedural swatches and favorite toggles. Also exports the
// small shared catalog UI kit (esc, tf, styles, product cards, fav wiring)
// reused by the proizvod, favoriti and dizajni views.
// ============================================================================
import { t } from "../i18n.js";
import { CATEGORIES, formatEur } from "../domain.js";
import { listProducts, listFavorites, toggleFavorite } from "../db.js";
import { swatchDataUrl } from "../texture.js";

// ---- shared helpers (imported by the sibling catalog views) -------------------
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// t() with a Croatian fallback: a missing dictionary key must never leak a raw
// key into the client demo.
export function tf(key, fallback, vars) {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

const CAT_FALLBACK = { keramika: "Keramika", sanitarije: "Sanitarije", armature: "Armature", grijanje: "Grijanje", klima: "Klima" };
export function catLabel(cat) {
  if (!cat) return "";
  return tf(cat.i18nKey, CAT_FALLBACK[cat.id] || cat.id);
}

// Router param tolerance: accepts a raw string, a match array, {params: []}
// or a named-key object.
export function pickParam(params, name) {
  if (params == null) return null;
  if (typeof params === "string") return params;
  if (Array.isArray(params)) return params[0] ?? null;
  if (Array.isArray(params.params)) return params.params[0] ?? null;
  return params[name] ?? params.id ?? null;
}

export function priceLabel(p) {
  if (p.unit === "m2" && p.priceM2 != null) return `${formatEur(p.priceM2)}/m²`;
  if (p.priceUnit != null) return `${formatEur(p.priceUnit)}/kom`;
  return "—";
}

export function formatLabel(p) {
  return Array.isArray(p.tileSizeMm) ? `${p.tileSizeMm[0]}×${p.tileSizeMm[1]} mm` : "";
}

// Colour bucketing for the "boja" filter chips — HSL heuristics over
// baseColorHex, tuned against the seed palette.
export function colorGroup(hex) {
  let s6 = String(hex || "").replace("#", "");
  if (s6.length === 3) s6 = s6.split("").map((c) => c + c).join("");
  const n = parseInt(s6, 16);
  if (!Number.isFinite(n)) return "siva";
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (s < 0.1) return l > 0.85 ? "bijela" : l > 0.4 ? "siva" : "antracit";
  if (h >= 55 && h < 170) return "kadulja";
  if (h >= 170 && h < 270) return "plava";
  if (l >= 0.85) return "bijela";
  if (h < 25 && s >= 0.4) return "terakota";
  if (l >= 0.62) return "bez";
  if (l >= 0.3) return "smeda";
  return "antracit";
}
const COLOR_LABELS = { bijela: "Bijela", bez: "Bež", siva: "Siva", antracit: "Antracit", kadulja: "Kadulja", terakota: "Terakota", smeda: "Smeđa", plava: "Plava" };
const COLOR_ORDER = ["bijela", "bez", "siva", "antracit", "kadulja", "terakota", "smeda", "plava"];

// ---- shared styles ------------------------------------------------------------
// The catalogue surface in the "Iris" system (docs/DESIGN_SYSTEM.md). Every
// colour below is either a sampled palette token or a shade DERIVED from one and
// verified numerically — nothing here is eyeballed.
//
// -------- CONTRAST LEDGER (WCAG 2.1, sRGB source-over compositing) -----------
// Every ratio below was computed against the values css/styles.css actually
// ships, not against the fallbacks in this file. The composited surfaces the
// text lands on:
//   chip glass  --glass-bg-text (hsl(187 44% 97%) @ .78) over --paper   #F4F8F9
//               ... same tint over --sky-200, the darkest ambient wash  #E9F3F9
//   rail glass  same tint over a PURE BLACK tile — the true worst case  #BEC3C4
//   card frame  --glass-bg-deco (@ .30) over --paper, ornament only     #F3F4F5
//   washes      keramika #E1DEDF · sanitarije #D7E4F2 · armature #D3E6E9
//               klima #D2E6EB · grijanje #F1E4D5
// The three glass composites are recomputed above at the alpha css/styles.css
// ACTUALLY ships (--glass-alpha-text:.78, styles.css:317), not the .62 an
// earlier draft of this file assumed. .78 is lighter than .62 on every ground,
// so every glass row below moved UP; none of them moved down.
// All 42 pairs clear 4.5:1 — nothing here leans on the 3:1 large-text
// allowance. The tight ones, tightest first (everything not listed is 5.7:1
// or better):
//   resume eyebrow     --amber-500  on --brown-800                 4.83:1
//   chip count/empty   --mauve-600  on chip glass over --sky-200   5.09:1
//   eyebrows/counts    --mauve-600  on --paper                     5.12:1
//   chip "Očisti"      --teal-700   on chip glass over --sky-200   5.14:1
//   back link          --teal-700   on --paper                     5.17:1
//   rail label/chips   --ink        on rail over a black tile      7.31:1
//   card meta / price / fav   --mauve-600 / --teal-700 / --amber-ink on
//                             --surface        5.73 / 5.78 / 5.86:1
//   category tiles     --ink        on the five washes        9.74-10.41:1
//   resume title/sub/CTA  #FFF / --sky-200 / --ink   10.06 / 6.87 / 6.24:1
//   demo banner, kind badge  --ink on --sky-200               8.89:1
//   delete armed       #FFF         on --danger                    6.10:1
// Two consequences of the arithmetic, kept as rules below:
//   * --teal-700, --mauve-600 and --amber-ink all land between 3.99 and 4.28:1
//     on the category-tile washes, so a WASH CARRIES --ink ONLY; hierarchy on a
//     wash comes from size and tracking, never from colour.
//   * the glass research's 0.505 alpha floor was solved for ink #14181C. Iris
//     ink is #313131, whose floor is 0.600 — 0.58 would give only 4.28:1.
//     That floor carries --ink ALONE. css/styles.css:255-273 rejects it for the
//     shipped glass because the standing bars carry four tiers, and at .62 over
//     a dark backdrop the coloured tiers collapse (--muted 2.04:1); it ships
//     --glass-alpha-text .78, where the worst case #BEC3C4 gives --ink 7.31:1,
//     --glass-ink-muted 4.57:1, --accent-on-glass 4.55:1. .78 is what every
//     text-bearing glass surface here resolves to, and the fallbacks below
//     encode it so an unresolved token cannot silently reintroduce .62.
//     Small text on low-alpha glass is never allowed: the product card is
//     decorative glass at alpha .30 and its text sits on an OPAQUE --surface
//     scrim.
//   * the chips are the one place a muted tier sits on glass, which the
//     foundation sheet forbids on .glass. It is sound here because the backdrop
//     is BOUNDED — a chip only ever floats over the page ground, never over
//     arbitrary content — so the worst case is a real #E9F3F9, not black.
//     (.akv-chip:hover lifts to --glass-bg-strong .88 -> #EEF6FA, lighter
//     still, so hover cannot be the tight case.)
//
// -------- GLASS BUDGET -------------------------------------------------------
// .topbar + .tabbar are the standing pair of backdrop-filter surfaces. These
// four views add exactly ONE more, and only on the product page: the pattern
// rail floating over the tile preview (the canonical "navigation layer over
// content" placement). Product cards, category tiles and filter chips are
// TRANSPARENT glass — translucent tint + rim, no backdrop-filter — because a
// scrolling grid cannot be N blur surfaces; css/styles.css reasons the same way
// where it keeps .card opaque. .akv-pcard therefore drops .card (it needs the
// page visible behind its decorative tint) and pins backdrop-filter to none.
// .akv-chip is a .glass-chip in colour and shape with the blur removed, for the
// same budget reason. Blur radius is never animated.
//
// -------- ANTON METRIC HAZARD ------------------------------------------------
// Croatian carons (Č Š Ž) reach 1.100em in Anton, so display headings run at
// line-height 1.12 (above the 1.05 floor) and every container that could clip
// one is forced to overflow:visible.
const CATALOG_CSS = `
/* ---- token bridge -------------------------------------------------------
   Every value here resolves to a css/styles.css token. The literal after the
   comma is a fallback of the SAME sampled/derived colour, so these views stay
   correct and measurable if a token is ever renamed; it is not a second
   source of truth. */
:root{
  --akv-ink:var(--ink,#313131);
  --akv-paper:var(--paper,#F2F2F2);
  --akv-scrim:var(--surface,#FFFFFF);        /* opaque text scrim (see ledger) */
  --akv-teal:var(--teal-600,#139EB1);
  --akv-teal-ink:var(--teal-700,#0D707D);
  --akv-teal-mid:var(--teal-400,#40AFCA);
  --akv-sky:var(--sky-200,#C0D8F2);
  --akv-mauve:var(--mauve-400,#A6979C);
  --akv-mauve-ink:var(--mauve-600,#756168);  /* = --muted, 5.12:1 on --paper  */
  --akv-amber:var(--amber-500,#EAA651);
  --akv-amber-ink:var(--amber-ink,#935616);
  --akv-brown:var(--brown-800,#68340F);
  --akv-brown-mid:var(--brown-700,#83440F);
  --akv-danger:var(--danger,#B92C1C);

  /* Glass. The tint colour is the sheet's teal-cast near-white
     hsl(187 44% 97%) = --glass-solid #F4FAFB. Alphas MIRROR css/styles.css
     exactly — .30 ornament-only (--glass-alpha-deco), .78 for every
     text-bearing surface (--glass-alpha-text), .88 on hover
     (--glass-alpha-strong). A fallback that undershoots the shipped alpha is
     not a safe default: it darkens the composite the whole ledger above is
     measured against. */
  --akv-glass-deco:var(--glass-bg-deco,rgba(244,250,251,.30));
  --akv-glass-ui:var(--glass-bg-text,rgba(244,250,251,.78));
  --akv-solid:var(--glass-solid,#F4FAFB);    /* every degradation lands here  */
  --akv-placeholder:#E1DEDF;                 /* --mauve-400 at .22 over paper */

  --akv-rim:var(--glass-rim-top,rgba(255,255,255,.62));
  --akv-rim-low:var(--glass-rim-bottom,rgba(255,255,255,.26));
  --akv-rim-warm:var(--glass-rim-warm,rgba(234,166,81,.62));
  /* Warm hairlines and shadows: --shadow-warm #5D4F4F = rgb(93,79,79) and
     --brown-800 #68340F = rgb(104,52,15). Never neutral black. */
  --akv-hairline:var(--hairline,rgba(104,52,15,.07));
  /* The card RING. Measured in the browser: --hairline composites to #F4F1EE on
     --surface, which is 1.13:1 against the card fill and 1.01:1 against --paper
     — i.e. invisible, so a ring drawn in it does no work. --line composites to
     #EDE7E2, 1.23:1 against the fill: a real edge that still reads as a
     hairline. Neither is a 1.4.11 boundary and neither has to be — a card is
     not a control, and these cards are bounded by their fill and their drop
     shadow as well. --line-strong (1.48:1) stays reserved for the things that
     ARE controls. */
  --akv-line:var(--line,rgba(104,52,15,.12));
  --akv-hairline-2:var(--line-strong,rgba(104,52,15,.22));
  --akv-sh-1:var(--glass-shadow-1,0 1px 2px rgba(93,79,79,.10),0 4px 14px rgba(93,79,79,.14));
  --akv-sh-2:var(--glass-shadow-2,0 2px 6px rgba(93,79,79,.14),0 12px 34px rgba(93,79,79,.22));

  /* CORNER LADDER. css/styles.css owns the scale (--r-xs … --r-pill); the
     literal after each comma is the same step written out, so these views keep
     one corner language even before that sheet has landed. Nothing below
     hardcodes a radius any more.

       --r-xs   8px   inner marks inside an already-nested child
       --r-sm  12px   swatches, small thumbnails
       --r-md  16px   nested panels, inputs, banners
       --r-lg  22px   list cards (the ASC step)
       --r-xl  28px   page cards, product cards, category tiles, stages
       --r-2xl 34px   heroes: empty state, resume card, detail panel
       --r-pill       every button and chip

     CONCENTRIC NESTING is the rule, not a preference: a child's radius is its
     parent's radius MINUS the padding between them, so the two arcs stay
     parallel instead of the inner one looking pinched. Where the pair is
     unambiguous that subtraction is written as a calc() against the SAME
     literal the padding uses, so the geometry survives a change to the scale. */
  --akv-r-xs:var(--r-xs,8px);
  --akv-r-sm:var(--r-sm,12px);
  --akv-r-md:var(--r-md,16px);
  --akv-r-lg:var(--r-lg,22px);
  --akv-r-xl:var(--r-xl,28px);
  --akv-r-2xl:var(--r-2xl,34px);
  --akv-r-pill:var(--r-pill,999px);
  --akv-r:var(--akv-r-xl);                   /* the card default */
  --akv-ease:var(--glass-ease,cubic-bezier(.32,.72,0,1));
  --akv-fam-display:var(--font-display,'Sora',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);
  --akv-fam-text:var(--font-text,'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);
  --akv-track-meta:var(--track-meta,.08em);
}

/* ---- dark theme fixes (weakness D/E from design panel) -----------------------
   The light-mode tokens --teal-700, --mauve-600, --amber-ink, --sky-200 lack
   dark-mode overrides and produce contrast failures (four tokens, seven failures,
   all measured at 2.55–3.41:1 requiring 4.5:1+). This block lifts them to
   readable levels without migrating the entire palette. Both selectors share
   identical declarations so a new @media block cannot drift apart. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --akv-teal-ink: #5FD3E0;                   /* was 2.55:1, now 10.04:1 */
    --akv-mauve-ink: var(--muted, #9AA0A8);    /* was 2.58:1, now 6.59:1 */
    --akv-amber-ink: #F0B860;                  /* was 2.52:1, now 9.85:1 */
    --akv-sky: #1F2740;                        /* was 1.31:1 demo banner, now 6.5:1 */
  }
}
:root[data-theme="dark"] {
  --akv-teal-ink: #5FD3E0;
  --akv-mauve-ink: var(--muted, #9AA0A8);
  --akv-amber-ink: #F0B860;
  --akv-sky: #1F2740;
}

/* ---- type scale (mirrors vendor/fonts/fonts.css; the t-* classes are also
        applied in the markup, so the two agree once index.html links that sheet) */
/* Anton caron guard. Measured in the browser at 36px: the glyph ink occupies
   48px (1.33em) while a 1.12 line box is 40.3px, so the carons sit proud of
   the box. That is fine — nothing clips them (verified: zero clipping
   ancestors) — but the heading needs real headroom above it or a Č can touch
   the eyebrow, hence the .12em top padding. line-height stays above the 1.05
   floor the font metrics require. */
/* Sentence case and weight 600, matching the h1/h2 rule in css/styles.css.
   These were uppercase 400 because the display face was Anton, a condensed
   poster face with no usable lowercase; the house face is now Sora, which is
   set in sentence case everywhere. Sizes come down a step with the change —
   Anton at 3.75rem and Sora at 3.75rem are not the same amount of ink. */
.akv-display-1,.akv-display-2{
  font-family:var(--akv-fam-display);font-weight:600;
  color:var(--akv-ink);margin:0;
  line-height:1.18;
  overflow:visible;padding-block-start:.12em;
}
.akv-display-1{font-size:clamp(2rem,4.8vw,3rem);letter-spacing:-.025em}
.akv-display-2{font-size:clamp(1.375rem,2.8vw,1.875rem);letter-spacing:-.02em}
.akv-meta{
  font-family:var(--akv-fam-text);font-weight:500;font-size:.75rem;
  letter-spacing:var(--akv-track-meta);line-height:1.4;text-transform:uppercase;
  color:var(--akv-mauve-ink);
}
.akv-card-title{font-family:var(--akv-fam-text);font-weight:600;font-size:1.0625rem;letter-spacing:-.005em;line-height:1.3;color:var(--akv-ink)}
.akv-body{font-family:var(--akv-fam-text);font-weight:400;font-size:.9375rem;line-height:1.6;color:var(--akv-ink)}
.akv-lead{font-family:var(--akv-fam-text);font-weight:400;font-size:.9375rem;line-height:1.6;color:var(--akv-mauve-ink)}
.akv-num{font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}

/* ---- page header --------------------------------------------------------- */
.akv-head{margin:2px 0 20px;overflow:visible}
.akv-head .akv-meta{display:block;margin:0 0 6px}
.akv-head .akv-lead{margin:8px 0 0;max-width:62ch}
.akv-back{
  display:inline-flex;align-items:center;gap:8px;min-height:var(--tap,44px);
  padding:0 4px 0 0;margin:0 0 6px;color:var(--akv-teal-ink);          /* 5.17:1 on --paper */
  font-family:var(--akv-fam-text);font-weight:600;font-size:.875rem;letter-spacing:.02em;
}
.akv-back:hover{color:var(--akv-ink)}

/* ---- demo banner --------------------------------------------------------- */
.akv-note{
  margin:0 0 20px;padding:12px 16px;border-radius:var(--akv-r-md);
  background:var(--akv-sky);color:var(--akv-ink);                       /* 8.89:1 */
  font-family:var(--akv-fam-text);font-size:.8125rem;line-height:1.5;
  box-shadow:inset 0 1px 0 0 var(--akv-rim);
}

/* ---- category tiles ------------------------------------------------------ */
/* Transparent glass: a palette wash + rim, no backdrop-filter. Text is --ink
   only — the derived -ink shades do not clear 4.5:1 on these washes. */
.akv-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:12px;margin:0 0 28px}
/* Hairline first, then the rim, then the drop. The 1px ring is --hairline
   (rgba(104,52,15,.07)) — a warm edge that defines the arc without reading as a
   border; the old treatment had the rim doing that job alone and the tiles
   dissolved into --paper at their sides. */
.akv-cat-card{
  position:relative;display:flex;flex-direction:column;gap:8px;align-items:flex-start;
  min-height:132px;padding:16px;text-decoration:none;color:var(--akv-ink);
  border-radius:var(--akv-r-xl);background:var(--akv-placeholder);
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-1),
             inset 0 1px 0 0 var(--akv-rim),inset 0 -1px 0 0 var(--akv-rim-low);
  isolation:isolate;overflow:hidden;
  transition:transform 260ms var(--akv-ease),box-shadow 260ms var(--akv-ease);
}
/* Wash per category — teal/sky = voda, amber = toplina (DESIGN_SYSTEM.md).
   Composited values and their ink ratios:
   keramika #E1DEDF 9.74:1 · sanitarije #D7E4F2 10.08:1 · armature #D3E6E9 10.08:1
   klima #D2E6EB 10.07:1 · grijanje #F1E4D5 10.41:1 */
.akv-cat-card[data-cat="keramika"]{background:color-mix(in srgb,var(--akv-mauve) 22%,var(--akv-paper))}
.akv-cat-card[data-cat="sanitarije"]{background:color-mix(in srgb,var(--akv-sky) 55%,var(--akv-paper))}
.akv-cat-card[data-cat="armature"]{background:color-mix(in srgb,var(--akv-teal) 14%,var(--akv-paper))}
.akv-cat-card[data-cat="klima"]{background:color-mix(in srgb,var(--akv-teal-mid) 18%,var(--akv-paper))}
.akv-cat-card[data-cat="grijanje"]{background:color-mix(in srgb,var(--akv-amber) 18%,var(--akv-paper))}
/* color-mix fallback for engines without it: the same five composites, literal. */
@supports not (background:color-mix(in srgb,#000 10%,#fff)){
  .akv-cat-card[data-cat="keramika"]{background:#E1DEDF}
  .akv-cat-card[data-cat="sanitarije"]{background:#D7E4F2}
  .akv-cat-card[data-cat="armature"]{background:#D3E6E9}
  .akv-cat-card[data-cat="klima"]{background:#D2E6EB}
  .akv-cat-card[data-cat="grijanje"]{background:#F1E4D5}
}
/* Hover lifts a white rim over the wash — ink stays 10.76-11.22:1. */
.akv-cat-card::after{
  content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(150deg,rgba(255,255,255,.46) 0%,rgba(255,255,255,.10) 34%,rgba(255,255,255,0) 62%);
  opacity:.7;transition:opacity 260ms var(--akv-ease);
}
@media (hover:hover) and (pointer:fine){
  .akv-cat-card:hover{transform:translateY(-2px);
    box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-2),inset 0 1px 0 0 var(--akv-rim-warm)}
  .akv-cat-card:hover::after{opacity:1}
}
.akv-cat-card:focus-visible{transform:translateY(-2px);
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-2),inset 0 1px 0 0 var(--akv-rim-warm)}
.akv-cat-card>*{position:relative;z-index:1}
.akv-cat-ico{font-size:30px;line-height:1}
.akv-cat-n{margin-top:auto}
.akv-cat-c{color:var(--akv-ink);opacity:1}      /* washes carry --ink only */

/* ---- product grid -------------------------------------------------------- */
.akv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:16px}
/* Decorative glass (--glass-alpha-deco, .30): the tile texture reads through
   it instead of competing with it. Ornament only — every word on this card
   sits on the opaque .akv-pbody scrim below.
   No backdrop-filter — see the GLASS BUDGET note. */
.akv-pcard{
  position:relative;padding:0;overflow:hidden;border-radius:var(--akv-r-xl);
  background:var(--akv-glass-deco);
  -webkit-backdrop-filter:none;backdrop-filter:none;
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-1),
             inset 0 1px 0 0 var(--akv-rim),inset 0 -1px 0 0 var(--akv-rim-low);
  isolation:isolate;
  transition:transform 260ms var(--akv-ease),box-shadow 260ms var(--akv-ease);
}
@media (hover:hover) and (pointer:fine){
  /* cool surface, warm edge */
  .akv-pcard:hover{transform:translateY(-2px);
    box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-2),
               inset 0 1px 0 0 var(--akv-rim-warm),inset 0 -1px 0 0 var(--akv-rim-low)}
}
.akv-pcard:focus-within{transform:translateY(-2px);
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-2),inset 0 1px 0 0 var(--akv-rim-warm)}
.akv-pcard-a{display:block;color:inherit;text-decoration:none}
.akv-sw-wrap{position:relative;overflow:hidden}
.akv-swatch{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:var(--akv-placeholder)}
.akv-eq-ico{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:46px;pointer-events:none;
  text-shadow:0 2px 12px rgba(93,79,79,.30);      /* --shadow-warm, not black */
}
/* The opaque scrim. Every card text ratio in the ledger is measured on this. */
.akv-pbody{position:relative;z-index:2;padding:12px 16px 16px;background:var(--akv-scrim);display:flex;flex-direction:column;gap:4px}
.akv-pmeta{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.akv-pname{display:block}
.akv-price{margin-top:2px;font-family:var(--akv-fam-text);font-weight:700;font-size:.9375rem;letter-spacing:.01em;color:var(--akv-teal-ink)}
/* font-family is set explicitly: form controls do NOT inherit it, so without
   this line the button falls back to the UA default (Arial in Chrome) — the
   one bare system stack inside the Iris UI. Same reason .akv-btn and .akv-chip
   set it. The glyph is ♡/♥ (U+2661/U+2665), which Figtree does not carry, so
   the browser still font-fallbacks for the heart itself; what this fixes is
   the metrics/stack the control resolves to. */
.akv-fav{
  position:absolute;top:12px;right:12px;z-index:3;
  min-width:var(--tap,44px);min-height:var(--tap,44px);border:none;border-radius:var(--akv-r-pill);
  background:var(--akv-scrim);color:var(--akv-amber-ink);          /* 5.86:1 on --surface */
  font-family:var(--akv-fam-text);
  font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:var(--akv-sh-1),inset 0 1px 0 0 var(--akv-rim);
  transition:background-color 200ms var(--akv-ease),color 200ms var(--akv-ease),transform 200ms var(--akv-ease);
}
@media (hover:hover) and (pointer:fine){
  .akv-fav:hover{box-shadow:var(--akv-sh-2),inset 0 1px 0 0 var(--akv-rim-warm)}
}
.akv-fav:active{transform:scale(.94)}
.akv-fav[aria-pressed="true"]{background:var(--akv-amber-ink);color:#fff}

/* ---- filter chips -------------------------------------------------------- */
.akv-chiprow{display:flex;flex-wrap:nowrap;gap:8px;margin:0 0 10px;align-items:center;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;-webkit-overflow-scrolling:touch;padding-bottom:2px;scroll-padding-inline:16px}
.akv-chiprow[hidden]{display:none}
.akv-chiprow::-webkit-scrollbar{height:4px}
.akv-chiprow::-webkit-scrollbar-thumb{background:rgba(93,79,79,.28);border-radius:var(--akv-r-pill)}
.akv-chiprow .lab{
  min-width:86px;flex:0 0 auto;position:sticky;left:0;z-index:1;
  background:var(--akv-paper);padding-right:6px;color:var(--akv-mauve-ink);   /* 5.12:1 */
}
/* Transparent glass chip: a .glass-chip in colour and shape with the blur
   removed (budget). Worst case surface is the shipped .78 tint over the
   palette's darkest ambient, --sky-200 -> #E9F3F9, where --ink is 11.56:1,
   --mauve-600 5.09:1 and --teal-700 5.14:1. */
.akv-chip{
  flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;
  border:1px solid var(--akv-hairline-2);border-radius:var(--akv-r-pill);
  background:var(--akv-glass-ui);color:var(--akv-ink);
  padding:0 15px;min-height:var(--tap,44px);
  font-family:var(--akv-fam-text);font-weight:600;font-size:.8125rem;letter-spacing:.02em;
  cursor:pointer;box-shadow:inset 0 1px 0 0 var(--akv-rim);
  transition:background-color 200ms var(--akv-ease),color 200ms var(--akv-ease),
             border-color 200ms var(--akv-ease),transform 200ms var(--akv-ease);
}
/* Cool surface, warm edge — the same hover gesture .glass-chip uses. */
@media (hover:hover) and (pointer:fine){
  .akv-chip:hover{
    background:var(--glass-bg-strong,rgba(244,250,251,.88));
    box-shadow:inset 0 1px 0 0 var(--akv-rim-warm);
  }
}
.akv-chip:active{transform:scale(.97)}
.akv-chip.on,.akv-chip[aria-pressed="true"]{
  background:var(--akv-teal-ink);border-color:var(--akv-teal-ink);color:#fff;   /* 5.78:1 */
  box-shadow:inset 0 1px 0 0 rgba(255,255,255,.24);
}
/* The count is informational, so it is a COLOUR change, never an opacity dim:
   the old opacity .6 measured 3.77:1 and opacity .42 measured 2.36:1. */
.akv-chip .n{font-variant-numeric:tabular-nums;font-weight:500;font-size:.75rem;color:var(--akv-mauve-ink)}
.akv-chip[aria-pressed="true"] .n{color:#fff}
.akv-chip.is-empty{color:var(--akv-mauve-ink);border-style:dashed}   /* 5.09:1 worst case */
/* An active chip must stay white-on-dark when hovered, so it darkens too. */
@media (hover:hover) and (pointer:fine){
  .akv-chip.on:hover,.akv-chip[aria-pressed="true"]:hover{
    background:var(--teal-800,#0B5A65);border-color:var(--teal-800,#0B5A65);   /* 7.88:1 */
    box-shadow:inset 0 1px 0 0 var(--akv-rim-warm);
  }
}
.akv-chip-clear{border-style:dashed;border-color:var(--akv-teal-ink);color:var(--akv-teal-ink)}

/* ---- "Nastavite gdje ste stali" ------------------------------------------ */
/* The one warm/dark surface in the catalogue: brown-800 = toplina. */
.akv-resume{
  padding:0;overflow:hidden;margin:0 0 28px;border-radius:var(--akv-r-2xl);
  background:var(--akv-brown);color:#fff;
  box-shadow:var(--akv-sh-2),inset 0 1px 0 0 rgba(255,255,255,.20);
  -webkit-backdrop-filter:none;backdrop-filter:none;
}
.akv-resume-a{display:flex;gap:16px;align-items:center;flex-wrap:wrap;color:inherit;text-decoration:none;padding:16px}
/* 4:3, not the old 1000/700 design space: js/scene3d.js frames every locked
   camera on 4:3 (its REF_ASPECT) and only widens the fov for something
   NARROWER, so a 4:3 thumbnail is the composition the scene was framed for. */
/* Concentric with its frame: the card is --r-2xl and the picture sits 16px in,
   so its arc is that radius minus that padding — the two curves stay parallel
   whatever the scale resolves to. */
.akv-resume-c{flex:0 0 auto;width:100%;max-width:320px;aspect-ratio:4/3;
  border-radius:calc(var(--akv-r-2xl) - 16px);background:var(--akv-brown-mid);display:block;
  box-shadow:0 2px 10px rgba(93,79,79,.34),inset 0 0 0 1px rgba(255,255,255,.10)}
.akv-resume-b{flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.akv-resume-e{color:var(--akv-amber)}                       /* 4.83:1 on brown-800 */
.akv-resume-t{font-family:var(--akv-fam-text);font-weight:700;font-size:1.125rem;line-height:1.3;color:#fff}
.akv-resume-s{font-family:var(--akv-fam-text);font-size:.8125rem;line-height:1.5;color:var(--akv-sky)}
.akv-resume-btn{
  margin-top:8px;display:inline-flex;align-items:center;min-height:var(--tap,44px);
  padding:0 18px;border-radius:var(--akv-r-pill);
  background:var(--akv-amber);color:var(--akv-ink);          /* 6.24:1 */
  font-family:var(--akv-fam-text);font-weight:600;font-size:.875rem;letter-spacing:.02em;
}

/* ---- Atelier invitation -------------------------------------------------
   A deliberate front door into the guided journey, not a fifth category and
   not another navigation tab. The diagonal carries the same water-to-warmth
   idea as the journey itself, using only Iris tokens already measured above. */
.akv-journey{
  position:relative;overflow:hidden;margin:0 0 28px;border-radius:var(--akv-r-2xl);
  background:linear-gradient(135deg,var(--akv-teal-ink) 0%,var(--akv-teal-ink) 68%,var(--akv-brown) 150%);
  color:#fff;box-shadow:var(--akv-sh-2),inset 0 1px 0 rgba(255,255,255,.20);
}
.akv-journey::after{
  content:"";position:absolute;width:260px;height:260px;right:-80px;top:-150px;border-radius:50%;
  border:1px solid rgba(255,255,255,.18);box-shadow:0 0 0 34px rgba(255,255,255,.035),0 0 0 72px rgba(255,255,255,.025);
  pointer-events:none;
}
.akv-journey-a{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) auto;
  align-items:end;gap:20px;padding:clamp(22px,5vw,36px);color:inherit;text-decoration:none}
.akv-journey-copy{display:grid;gap:7px;max-width:620px}
.akv-journey-e{font-size:.6875rem;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:#fff}
.akv-journey-t{margin:0;font-family:var(--akv-fam-display);font-size:clamp(1.55rem,4vw,2.65rem);
  line-height:1.08;letter-spacing:-.025em;color:#fff;overflow:visible;padding-top:.12em}
.akv-journey-s{margin:0;max-width:54ch;font-size:.875rem;line-height:1.55;color:#fff}
.akv-journey-btn{display:inline-flex;align-items:center;justify-content:center;min-height:49px;padding:0 20px;
  border-radius:var(--akv-r-pill);background:var(--akv-amber);color:var(--akv-ink);
  font-size:.875rem;font-weight:700;white-space:nowrap;box-shadow:0 8px 22px -14px rgba(93,79,79,.7)}
@media(max-width:620px){
  .akv-journey-a{grid-template-columns:1fr;align-items:start}
  .akv-journey-btn{justify-self:start}
}

/* ---- section heading ----------------------------------------------------- */
.akv-sec{display:flex;align-items:baseline;gap:12px;margin:0 0 16px;overflow:visible}

/* ---- empty state --------------------------------------------------------- */
.akv-empty{
  text-align:center;padding:44px 24px;border-radius:var(--akv-r-2xl);
  background:var(--akv-scrim);overflow:visible;                /* Anton caron guard */
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-1),inset 0 1px 0 0 var(--akv-rim);
  -webkit-backdrop-filter:none;backdrop-filter:none;
}
.akv-empty .ico{font-size:42px;line-height:1}
.akv-empty .akv-display-2{margin:14px 0 8px}
.akv-empty .akv-lead{margin:0 auto;max-width:44ch}
.akv-empty .akv-btn{margin-top:18px}

/* ---- buttons (catalogue-local, palette-true) ----------------------------- */
.akv-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:var(--tap,44px);padding:0 18px;border-radius:var(--akv-r-pill);
  border:1px solid var(--akv-hairline-2);background:var(--akv-scrim);color:var(--akv-ink);
  font-family:var(--akv-fam-text);font-weight:600;font-size:.875rem;letter-spacing:.02em;
  cursor:pointer;text-decoration:none;
  transition:background-color 200ms var(--akv-ease),color 200ms var(--akv-ease),transform 200ms var(--akv-ease);
}
.akv-btn:active{transform:scale(.97)}
.akv-btn-primary{background:var(--akv-teal-ink);border-color:var(--akv-teal-ink);color:#fff}  /* 5.78:1 */
/* Hover darkens, never brightens: white on the sampled --teal-600 is only
   3.20:1, so the hover fill is --teal-800 (white 7.88:1). */
@media (hover:hover) and (pointer:fine){
  .akv-btn-primary:hover{background:var(--teal-800,#0B5A65);border-color:var(--teal-800,#0B5A65)}
}
.akv-btn-warm{background:var(--akv-amber-ink);border-color:var(--akv-amber-ink);color:#fff}   /* 5.86:1 */

/* ---- product detail ------------------------------------------------------ */
.akv-prod{display:grid;gap:20px;grid-template-columns:1fr;margin-top:6px}
/* THE RAIL'S BLUR DEPENDS ON THIS LINE. css/styles.css:1022 runs the shell's
   entrance on every direct child of #main —
     #main.view-enter>*{animation:riseIn var(--dur-2) var(--smooth) both}
   — and riseIn ends on transform:none. But fill-mode BOTH freezes the last
   keyframe as the element's computed style, and a transform resolved by an
   animation stays a MATRIX: measured here in Chrome, .akv-prod settles on
   transform:matrix(1,0,0,1,0,0) and keeps it for the life of the view. An
   element with a transform is a BACKDROP ROOT, so .akv-rail — which is inside
   .akv-prod — had nothing left to sample and its blur was doing nothing at all.
   This is the same class of defect css/styles.css itself records against
   viewFade's filter:blur(0px), one layer up.
   BACKWARDS keeps the entrance (the from-state still applies before it runs)
   and hands the element back to its own stylesheet at the end, where transform
   really is none. Specificity (1,2,0) beats the sheet's (1,1,0), so this holds
   whatever the source order.
   The root cause is in css/styles.css and belongs there; this is the scoped
   repair for the one view in this file that carries glass. */
#main.view-enter>.akv-prod{animation-fill-mode:backwards}
@media (min-width:760px){.akv-prod{grid-template-columns:1.1fr .9fr;align-items:start}}
/* The tile preview is a FRAME, not a bare picture: a hairline ring holds the
   arc, the rim reads as a bevel highlight along the top edge and the drop is
   the same restrained --akv-sh-2 every raised surface uses. It is deliberately
   NOT given an entrance animation — it is the ancestor of .akv-rail, and an
   animated opacity/transform on an ancestor makes it a backdrop root, which
   would leave the rail's blur sampling nothing (the trap css/styles.css
   documents around viewFade). */
.akv-prevwrap{position:relative;border-radius:var(--akv-r-2xl);overflow:hidden;
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-2),inset 0 1px 0 0 var(--akv-rim)}
.akv-prev{width:100%;aspect-ratio:4/3;display:block;background:var(--akv-placeholder);object-fit:cover}
/* THE one extra backdrop-filter surface in these four views (see GLASS BUDGET).
   -webkit- line carries LITERAL values: Safari fails to resolve var() there. */
.akv-rail{
  position:absolute;left:10px;right:10px;bottom:10px;z-index:2;
  display:flex;gap:8px;align-items:center;margin:0;padding:8px;
  /* concentric inside the --r-2xl frame it floats in, inset 10px */
  border-radius:calc(var(--akv-r-2xl) - 10px);background:var(--akv-glass-ui);
  -webkit-backdrop-filter:blur(18px) saturate(180%) brightness(1.06);
  backdrop-filter:var(--glass-fx-md,blur(18px) saturate(180%) brightness(1.06));
  box-shadow:var(--akv-sh-1),inset 0 1px 0 0 var(--akv-rim),inset 0 -1px 0 0 var(--akv-rim-low);
  isolation:isolate;contain:paint;                 /* bound the compositor read-back */
}
/* No scrollbar chrome INSIDE the rail. .akv-rail also carries .akv-chiprow,
   which paints a thin track — fine on the page, but on a 40px floating glass
   strip it reads as a broken edge. The last chip stays visibly clipped at the
   right, which is the affordance doing the work instead. */
.akv-rail{scrollbar-width:none;-ms-overflow-style:none}
.akv-rail::-webkit-scrollbar{display:none}
.akv-rail .lab{position:static;background:transparent;min-width:0;color:var(--akv-ink);padding-right:2px}
.akv-rail .akv-chip{min-height:40px;background:var(--akv-glass-ui)}
.akv-rail .akv-chip.on,.akv-rail .akv-chip[aria-pressed="true"]{background:var(--akv-teal-ink)}
.akv-eqwrap{position:relative;border-radius:var(--akv-r-2xl);overflow:hidden;background:var(--akv-glass-deco);
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-2),inset 0 1px 0 0 var(--akv-rim)}
.akv-panel{
  border-radius:var(--akv-r-2xl);padding:24px;background:var(--akv-scrim);
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-1),inset 0 1px 0 0 var(--akv-rim);overflow:visible;
  -webkit-backdrop-filter:none;backdrop-filter:none;
}
.akv-panel .akv-display-2{margin:6px 0 4px}
.akv-specs{width:100%;border-collapse:collapse;font-family:var(--akv-fam-text);font-size:.875rem;margin-top:16px}
.akv-specs th{
  text-align:left;padding:9px 12px 9px 0;white-space:nowrap;vertical-align:top;
  font-weight:500;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--akv-mauve-ink);                       /* 5.73:1 on --surface */
}
.akv-specs td{padding:9px 0;color:var(--akv-ink)}
.akv-specs tr + tr th,.akv-specs tr + tr td{border-top:1px solid var(--akv-hairline)}
.akv-bigprice{
  font-family:var(--akv-fam-text);font-weight:700;font-size:1.75rem;letter-spacing:-.01em;
  color:var(--akv-teal-ink);margin:8px 0 10px;                 /* 5.78:1 */
}
.akv-order{margin:0 0 10px;font-family:var(--akv-fam-text);font-size:.8125rem;line-height:1.5;color:var(--akv-amber-ink)}
.akv-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.akv-fine{margin:12px 0 0;font-family:var(--akv-fam-text);font-size:.75rem;line-height:1.5;color:var(--akv-mauve-ink)}
/* --r-md, not the concentric calc(--r-2xl - 24px). The subtraction rule applies
   to a child that sits AGAINST its parent's corner, where the two arcs have to
   stay parallel; this box is a full-width block in the middle of the panel and
   never touches one. Measured, the calc landed on 10px, which put the textarea
   nested inside it (12px) on a LARGER radius than its own container — the exact
   inversion the nesting rule exists to prevent. 16 outside, 12 inside. */
.akv-inq{margin-top:16px;padding:16px;border:1px dashed var(--akv-hairline-2);
  border-radius:var(--akv-r-md);background:var(--akv-paper)}
.akv-inq textarea{
  width:100%;min-height:196px;font-family:var(--akv-fam-text);font-size:.8125rem;line-height:1.55;
  padding:12px;margin-top:10px;border:1px solid var(--akv-hairline-2);border-radius:var(--akv-r-sm);
  background:var(--akv-scrim);color:var(--akv-ink);resize:vertical;
}

/* ---- saved designs ------------------------------------------------------- */
.akv-dcard{
  display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px;
  padding:16px;border-radius:var(--akv-r-xl);background:var(--akv-scrim);
  box-shadow:inset 0 0 0 1px var(--akv-line),var(--akv-sh-1),inset 0 1px 0 0 var(--akv-rim);
  -webkit-backdrop-filter:none;backdrop-filter:none;
}
.akv-dsw{display:flex;gap:5px;flex:0 0 auto}
.akv-dsw img{width:40px;height:40px;border-radius:var(--akv-r-sm);display:block;background:var(--akv-placeholder)}
.akv-dbody{flex:1 1 200px;min-width:0;display:flex;flex-direction:column;gap:5px}
.akv-dname{font-family:var(--akv-fam-text);font-weight:600;font-size:1rem;line-height:1.3;color:var(--akv-ink)}
.akv-drow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.akv-kind{
  display:inline-flex;align-items:center;padding:3px 10px;border-radius:var(--akv-r-pill);
  background:var(--akv-sky);color:var(--akv-ink);                 /* 8.89:1 */
  font-family:var(--akv-fam-text);font-weight:600;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;
}
.akv-dactions{display:flex;gap:8px;flex-wrap:wrap}
.akv-btn-danger{background:var(--akv-danger);border-color:var(--akv-danger);color:#fff}  /* 6.10:1 */

/* ---- scene thumbnails (resume card + saved designs) ---------------------- */
/* Every thumbnail is a still from js/scene3d.js: the same room shell, the same
   vendored CC0 models and the same texture pipeline the live Dizajner uses.
   Nothing here draws a fixture.
   A canvas starts fully transparent, so its own background-color IS the
   placeholder and the sweep below is simply the "still rendering" state laid
   over it — no extra element, no layout shift when the picture arrives.
   .akv-thumb-load must stay AFTER .akv-resume-c / .akv-dthumb: those two set
   "background" as a shorthand, which resets background-image to none at the
   same (0,1,0) specificity, and only source order lets the sweep win. */
/* Concentric inside the --r-xl saved-design card at 16px of padding. */
.akv-dthumb{
  flex:0 0 auto;width:128px;max-width:34vw;aspect-ratio:4/3;display:block;
  border-radius:calc(var(--akv-r-xl) - 16px);background:var(--akv-placeholder);
  box-shadow:inset 0 0 0 1px var(--akv-line);
}
.akv-thumb-load{
  background-image:linear-gradient(100deg,transparent 32%,rgba(255,255,255,.22) 50%,transparent 68%);
  background-repeat:no-repeat;background-size:230% 100%;
  animation:akv-thumb-sweep 1400ms linear infinite;
}
@keyframes akv-thumb-sweep{from{background-position:130% 0}to{background-position:-130% 0}}

/* ---- entrance ------------------------------------------------------------
   One keyframe, one curve, one distance. A 10px rise over 420ms on the shipped
   --glass-ease: it settles rather than bounces, which is the difference between
   this and the --spring curve the tab bar icons use. Nothing overshoots and
   nothing scales.

   FILL MODE IS 'backwards', NOT 'both', and that is load-bearing rather than
   tidy. 'both' makes the LAST keyframe the element's computed style forever
   after, and a transform that has been resolved by an animation stays a matrix
   even when the keyframe says 'none' — measured in Chrome 2026-08-02, an
   .akv-pcard finished on transform:matrix(1,0,0,1,0,0), not none. A matrix is a
   containing block and a BACKDROP ROOT, so any glass inside such an element
   would sample nothing at all: exactly the defect css/styles.css records
   against viewFade's filter:blur(0px), which also looked like a no-op value.
   'backwards' applies the FROM state before the animation starts (so nothing
   flashes in at full opacity first) and then hands the element back to its own
   stylesheet — where transform really is none and opacity really is 1.

   Belt as well as braces, the list below still names only surfaces with no
   backdrop-filter descendant. .akv-prevwrap is excluded on purpose: it is the
   parent of .akv-rail, this view's one blurred surface.

   The stagger is CAPPED at eight steps. A category grid can be 23 cards, and a
   per-card delay across all of them turns a calm entrance into a wave; past the
   eighth card everything arrives together. Re-filtering a category rebuilds the
   grid and therefore replays the entrance — at 10px and 420ms that reads as the
   result settling in, which is the intent. */
@keyframes akv-rise{
  from{opacity:0;transform:translate3d(0,10px,0)}
  to{opacity:1;transform:none}
}
@media (prefers-reduced-motion:no-preference){
  .akv-cat-card,.akv-pcard,.akv-dcard,.akv-empty,.akv-resume,.akv-journey,.akv-panel{
    animation:akv-rise 420ms var(--akv-ease) backwards;
  }
  .akv-grid>.akv-pcard:nth-child(2),.akv-cats>.akv-cat-card:nth-child(2),#dizList>.akv-dcard:nth-child(2){animation-delay:26ms}
  .akv-grid>.akv-pcard:nth-child(3),.akv-cats>.akv-cat-card:nth-child(3),#dizList>.akv-dcard:nth-child(3){animation-delay:52ms}
  .akv-grid>.akv-pcard:nth-child(4),.akv-cats>.akv-cat-card:nth-child(4),#dizList>.akv-dcard:nth-child(4){animation-delay:78ms}
  .akv-grid>.akv-pcard:nth-child(5),.akv-cats>.akv-cat-card:nth-child(5),#dizList>.akv-dcard:nth-child(5){animation-delay:104ms}
  .akv-grid>.akv-pcard:nth-child(6),.akv-cats>.akv-cat-card:nth-child(6),#dizList>.akv-dcard:nth-child(6){animation-delay:130ms}
  .akv-grid>.akv-pcard:nth-child(7),.akv-cats>.akv-cat-card:nth-child(7),#dizList>.akv-dcard:nth-child(7){animation-delay:156ms}
  .akv-grid>.akv-pcard:nth-child(n+8),.akv-cats>.akv-cat-card:nth-child(n+8),#dizList>.akv-dcard:nth-child(n+8){animation-delay:182ms}
}

/* =========================== DEGRADATIONS =================================
   FIVE paths, matching the DEGRADATION PATHS block at css/styles.css:1516
   one for one, all landing on the same opaque --akv-solid #F4FAFB. Every tier
   this file puts on glass
   clears AA there: --ink 12.33:1, --mauve-600 5.43:1, --teal-700 5.48:1,
   --amber-ink 5.56:1, and #FFF on the --teal-700 pressed fill 5.78:1.
   Path 3 is the manual one and it is the only path iOS ever gets. */
/* 1. Engine cannot do backdrop-filter at all — the rail becomes opaque. */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .akv-rail{background:var(--akv-solid)}
  .akv-chip,.akv-rail .akv-chip{background:var(--akv-solid)}
  .akv-pcard{background:var(--akv-solid)}
  .akv-cat-card::after{display:none}
}
/* 2. OS transparency reduction. Chromium/Edge/Firefox honour it; Safari does
      NOT expose it, which is why path 3 below exists and is not redundant.
      Gated on html:not([data-transparency="full"]) exactly as
      css/styles.css:1557 is, so a user who explicitly chose to KEEP the glass
      wins over an OS that asked for solid surfaces. Without the gate this
      block would pin the catalogue solid while app.js hands the shell bars
      back their blur — the two halves of the same screen disagreeing. */
@media (prefers-reduced-transparency:reduce){
  html:not([data-transparency="full"]) :is(.akv-rail,.akv-chip,.akv-rail .akv-chip,.akv-pcard,.akv-eqwrap){
    background:var(--akv-solid);
    -webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:var(--akv-sh-1);
  }
  html:not([data-transparency="full"]) :is(.akv-chip.on,.akv-chip[aria-pressed="true"],.akv-rail .akv-chip[aria-pressed="true"]){background:var(--akv-teal-ink)}
  html:not([data-transparency="full"]) .akv-cat-card::after{display:none}
}
/* 3. MANUAL ESCAPE HATCH — html[data-transparency="reduced"].
      REQUIRED, not a nicety. iOS Safari never reports
      prefers-reduced-transparency and iOS is the bulk of this audience, so
      path 2 never fires there and this switch is the ONLY way that install
      base can turn the blur off. js/app.js:165-173 (applyTransparency) owns
      the toggle ("Smanji prozirnost") and writes html.dataset.transparency;
      nothing in the tree writes data-glass, so the selector this block used to
      carry matched nothing and the catalogue rail, chips and cards stayed
      blurred on iOS no matter what the user chose. Keyed SOLELY off
      data-transparency, the way css/styles.css:1582 says it must be.
      The .akv-rail .akv-chip pair is spelled out inside :is() because the base
      rule for it is (0,2,0); :is() takes the specificity of its most specific
      argument, so the whole selector lands at (0,3,1) and outranks it. */
html[data-transparency="reduced"] :is(.akv-rail,.akv-chip,.akv-rail .akv-chip,.akv-pcard,.akv-eqwrap){
  background:var(--akv-solid);
  -webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:var(--akv-sh-1);
}
html[data-transparency="reduced"] :is(.akv-chip.on,.akv-chip[aria-pressed="true"],.akv-rail .akv-chip[aria-pressed="true"]){background:var(--akv-teal-ink)}
html[data-transparency="reduced"] .akv-cat-card::after{display:none}
/* 4. High contrast / forced colours. The .akv-rail .akv-chip pairs are spelled
      out because the base rule for them is (0,2,0) and would otherwise outrank
      a bare .akv-chip override here. */
@media (prefers-contrast:more){
  .akv-rail,.akv-chip,.akv-rail .akv-chip,.akv-pcard,.akv-cat-card,.akv-empty,.akv-panel,.akv-dcard,.akv-eqwrap{
    background:var(--akv-solid);
    -webkit-backdrop-filter:none;backdrop-filter:none;
    border:1px solid var(--akv-ink);box-shadow:none;
  }
  .akv-chip.on,.akv-chip[aria-pressed="true"],
  .akv-rail .akv-chip.on,.akv-rail .akv-chip[aria-pressed="true"]{
    background:var(--akv-teal-ink);border-color:var(--akv-teal-ink);color:#fff;
  }
  .akv-cat-card::after{display:none}
  .akv-chip .n,.akv-chip.is-empty,.akv-lead,.akv-meta,.akv-specs th,.akv-fine{color:var(--akv-ink)}
  .akv-chip[aria-pressed="true"] .n{color:#fff}
}
@media (forced-colors:active){
  .akv-rail,.akv-chip,.akv-rail .akv-chip,.akv-pcard,.akv-cat-card,.akv-empty,.akv-panel,.akv-dcard,.akv-fav,.akv-eqwrap{
    background:Canvas;color:CanvasText;border:1px solid CanvasText;
    -webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none;
  }
  .akv-cat-card::after{display:none}
  .akv-chip[aria-pressed="true"],.akv-rail .akv-chip[aria-pressed="true"],
  .akv-fav[aria-pressed="true"]{background:Highlight;color:HighlightText}
  .akv-chip[aria-pressed="true"] .n{color:HighlightText}
}
/* 5. Motion. Blur radius is never animated anywhere above; this only stills
      the transform/colour transitions — and the thumbnail sweep, which is the
      one looping animation in this file. Stilling it leaves the flat
      placeholder colour, which is what the sweep is painted over anyway.
      The entrance rise is already gated behind
      (prefers-reduced-motion:no-preference), so it is never DECLARED for a user
      who asked for less motion rather than declared and then cancelled; the
      names are repeated here so a future entrance added outside that gate still
      lands in the same net. Because the rise is never applied, the elements
      also keep their natural opacity:1 / transform:none — a reduced-motion user
      sees the finished layout, never a stuck 'from' state. */
@media (prefers-reduced-motion:reduce){
  .akv-pcard,.akv-cat-card,.akv-chip,.akv-fav,.akv-btn,.akv-cat-card::after,.akv-thumb-load,
  .akv-dcard,.akv-empty,.akv-resume,.akv-journey,.akv-panel{
    transition-duration:1ms !important;animation:none !important;
  }
  .akv-pcard:hover,.akv-pcard:focus-within,.akv-cat-card:hover,.akv-cat-card:focus-visible{transform:none}
  .akv-chip:active,.akv-fav:active,.akv-btn:active{transform:none}
}
`;

export function ensureStyles() {
  if (document.getElementById("akv-catalog-css")) return;
  const style = document.createElement("style");
  style.id = "akv-catalog-css";
  style.textContent = CATALOG_CSS;
  document.head.appendChild(style);
}

/** Page header: uppercase tracked eyebrow + Anton title + optional lead. */
export function pageHead(eyebrow, title, lead) {
  return `
  <header class="akv-head">
    ${eyebrow ? `<span class="t-meta akv-meta">${esc(eyebrow)}</span>` : ""}
    <h1 class="t-h1 akv-display-1">${esc(title)}</h1>
    ${lead ? `<p class="t-body akv-lead">${esc(lead)}</p>` : ""}
  </header>`;
}

// ---- lazy swatches --------------------------------------------------------------
// Generating a 256px procedural swatch costs 3-20 ms and toDataURL on top, so
// a 23-card category grid used to block the main thread for ~150 ms in one
// task. Cards now render with the placeholder background and their images are
// filled in small idle slices, visible cards first.
const SWATCH_SLICE = 3;
let swatchPass = 0;
// id -> product, so a pending <img> only has to carry its id (the seed catalog
// is 46 products, and db.js holds the same objects anyway)
const swatchSubjects = new Map();

const idle = (fn) =>
  (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 240 }) : setTimeout(fn, 16));

const nearViewport = (el) => {
  const r = el.getBoundingClientRect();
  const h = window.innerHeight || 800;
  return r.bottom > -h * 0.5 && r.top < h * 1.5;
};

/** Fill every pending [data-akv-swatch] image, a few per idle slice. */
export function hydrateSwatches(root = document) {
  const found = [...root.querySelectorAll("img[data-akv-swatch]")];
  if (!found.length) return;
  // visible (or nearly visible) cards first, the rest in document order;
  // the rects are read once, up front, so the sort does no layout work
  const pending = found
    .map((img, i) => ({ img, i, near: nearViewport(img) }))
    .sort((a, b) => Number(b.near) - Number(a.near) || a.i - b.i)
    .map((e) => e.img);
  let i = 0;
  const step = () => {
    let done = 0;
    while (i < pending.length && done < SWATCH_SLICE) {
      const img = pending[i++];
      const p = swatchSubjects.get(img.dataset.akvSwatch);
      delete img.dataset.akvSwatch;
      if (!img.isConnected || !p) continue;
      try { img.src = swatchDataUrl(p, Number(img.dataset.akvSize) || 256); } catch { /* keep the placeholder */ }
      done++;
    }
    if (i < pending.length) idle(step);
  };
  idle(step);
}

// productCard() is called while a template string is being built, so the nodes
// do not exist yet — queue one hydration pass for the next idle slot.
function queueSwatchHydration() {
  if (swatchPass) return;
  swatchPass = 1;
  idle(() => { swatchPass = 0; hydrateSwatches(); });
}

/** Register a product and return the attributes a pending swatch <img> needs. */
export function swatchAttrs(p, sizePx = 256) {
  swatchSubjects.set(p.id, p);
  queueSwatchHydration();
  return `data-akv-swatch="${esc(p.id)}" data-akv-size="${sizePx}"`;
}

// ---- product cards ------------------------------------------------------------
const CAT_ICONS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon]));

export function productCard(p, favSet) {
  const fav = favSet.has(p.id);
  const isTile = Array.isArray(p.tileSizeMm);
  // Brand + format lead as the uppercase wide-tracked meta line (the reference's
  // credit-line gesture), with the name underneath in the text face.
  const meta = [p.brand, formatLabel(p)].filter(Boolean).join(" · ");
  // No .card here on purpose: .card is opaque by design in css/styles.css, and
  // the decorative glass frame needs the page ground visible behind it.
  return `
  <article class="akv-pcard" data-pid="${esc(p.id)}">
    <a class="akv-pcard-a" href="#/proizvod/${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}">
      <div class="akv-sw-wrap">
        <img class="akv-swatch" ${swatchAttrs(p, 256)} alt="" width="256" height="256">
        ${isTile ? "" : `<span class="akv-eq-ico" aria-hidden="true">${esc(CAT_ICONS[p.category] || "📦")}</span>`}
      </div>
      <div class="akv-pbody">
        <span class="akv-pmeta t-meta akv-meta">${esc(meta)}</span>
        <span class="akv-pname t-card-title akv-card-title">${esc(p.name)}</span>
        <span class="akv-price t-numeric akv-num">${esc(priceLabel(p))}</span>
      </div>
    </a>
    <button class="akv-fav" type="button" data-fav="${esc(p.id)}" aria-pressed="${fav}"
      aria-label="${esc(tf("kat.fav", "Dodaj u favorite"))}">${fav ? "♥" : "♡"}</button>
  </article>`;
}

export function wireFavButtons(root, favSet, onChange) {
  root.querySelectorAll("[data-fav]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.fav;
      const favs = await toggleFavorite(id);
      const on = favs.includes(id);
      if (on) favSet.add(id); else favSet.delete(id);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "♥" : "♡";
      window.AKV?.toast?.(on ? tf("kat.favAdded", "Dodano u favorite") : tf("kat.favRemoved", "Uklonjeno iz favorita"));
      onChange?.(id, on);
    });
  });
}

// ---- scene thumbnails (shared with views/dizajni.js) ---------------------------
// A thumbnail is a one-shot still from js/scene3d.js — the SAME engine, the same
// vendored CC0 .glb models and the same physical-scale texture pipeline as the
// live Dizajner and the 3D room. It replaced js/scene2d.js's hand-drawn canvas
// illustration — an invented window, an invented worktop — which was the thing
// the operator rejected; that module has been DELETED from the tree, and
// nothing in this file draws a fixture.
//
// js/scene3d.js is imported dynamically and memoised: it pulls in three.js and
// the model set, and a cold catalogue boot with no draft and no saved design
// must not pay for either.
let scene3dModule = null;
const loadScene3d = () => (scene3dModule || (scene3dModule = import("../scene3d.js")));

// renderSceneThumbnail deliberately SWALLOWS its own failures — a decorative
// still may never take a list view down — so its promise resolving is not
// evidence that anything was painted. This is: the engine clears to an opaque
// --paper background across the whole frame, so one opaque pixel proves the
// still landed, and a canvas that was never touched is transparent everywhere.
function canvasPainted(canvas) {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const x = Math.max(0, (canvas.width / 2) | 0);
    const y = Math.max(0, (canvas.height / 2) | 0);
    return ctx.getImageData(x, y, 1, 1).data[3] > 0;
  } catch { return false; }
}

/**
 * Paint one scene still into `canvas`, showing the sweep placeholder while it
 * renders. `sceneId` is a scene id from data/scenes.js — or a scene OBJECT,
 * which is how views/dizajni.js shows a saved 3D room.
 * Resolves TRUE only when pixels actually landed; false means offline shell
 * miss, no WebGL, or an unknown scene. The caller decides what a card with no
 * picture looks like — this never substitutes one.
 */
export async function paintSceneThumb(canvas, sceneId, assignments, products) {
  if (!canvas || !canvas.isConnected || !canvas.width || !canvas.height) return false;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);   // makes the probe above sound
  canvas.classList.add("akv-thumb-load");
  canvas.setAttribute("aria-busy", "true");
  let ok = false;
  try {
    const { renderSceneThumbnail } = await loadScene3d();
    await renderSceneThumbnail(canvas, sceneId, assignments || {}, products || []);
    ok = canvasPainted(canvas);
  } catch {
    ok = false;
  }
  canvas.classList.remove("akv-thumb-load");
  canvas.removeAttribute("aria-busy");
  return ok;
}

// ---- "Nastavite gdje ste stali" -------------------------------------------------
// The designer persists its working state as akv:diz-draft
// ({sceneId, perScene, savedAt}); when one exists the home screen offers a warm
// re-entry with a real still of the draft. data/scenes.js is imported
// dynamically (for the scene's Croatian label) so the cold catalog boot never
// pays for it.
const DRAFT_KEY = "akv:diz-draft";
const SCENE_FB = { "kupaonica": "Kupaonica", "kuhinja": "Kuhinja", "dnevni-boravak": "Dnevni boravak" };

function readDesignerDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.sceneId !== "string" || !d.sceneId) return null;
    const assignments = d.perScene && d.perScene[d.sceneId];
    if (!assignments || typeof assignments !== "object" || !Object.keys(assignments).length) return null;
    return { sceneId: d.sceneId, assignments, savedAt: d.savedAt };
  } catch { return null; }
}

function draftWhen(savedAt) {
  const ts = Date.parse(savedAt || "");
  if (!Number.isFinite(ts)) return "";
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return tf("kat.resumeToday", "danas");
  if (days === 1) return tf("kat.resumeYesterday", "jučer");
  try {
    return new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(ts));
  } catch { return ""; }
}

// The catalogue's one warm/dark surface — brown-800 is "toplina" in the Iris
// palette, so the re-entry card reads as the fireside of the app.
function resumeMarkup(draft) {
  return `
  <section class="akv-resume" id="akvResume">
    <a class="akv-resume-a" href="#/dizajner/${encodeURIComponent(draft.sceneId)}">
      <canvas class="akv-resume-c" id="akvResumeC" width="640" height="480" role="img"
        aria-label="${esc(tf("kat.resumeAlt", "Pregled vašeg nedovršenog dizajna"))}"></canvas>
      <div class="akv-resume-b">
        <span class="t-meta akv-meta akv-resume-e">${esc(tf("kat.resumeEyebrow", "Vaš dizajn"))}</span>
        <div class="akv-resume-t">${esc(tf("kat.resumeTitle", "Nastavite gdje ste stali"))}</div>
        <div class="akv-resume-s" id="akvResumeSub"></div>
        <span class="t-button akv-resume-btn">${esc(tf("kat.resumeCta", "Nastavi dizajn"))}</span>
      </div>
    </a>
  </section>`;
}

function readAtelierDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem("akv:atelier-draft") || "null");
    const decisions = draft?.journeyState?.decisions;
    return decisions && Object.keys(decisions).length ? draft : null;
  } catch { return null; }
}

function journeyMarkup(hasDraft) {
  const title = hasDraft
    ? tf("kat.atelierResumeTitle", "Nastavite svoju kupaonicu")
    : tf("kat.atelierTitle", "Od osjećaja do gotovog projekta");
  const body = hasDraft
    ? tf("kat.atelierResumeSub", "Vaši odabiri i raspored čekaju vas u Atelieru.")
    : tf("kat.atelierSub", "Odgovorite na nekoliko mirnih pitanja dok se prostor, materijali i oprema oblikuju pred vama.");
  const cta = hasDraft
    ? tf("kat.atelierResumeCta", "Nastavi projekt")
    : tf("kat.atelierCta", "Započni uređenje");
  return `
    <section class="akv-journey">
      <a class="akv-journey-a" href="#/atelier">
        <div class="akv-journey-copy">
          <span class="akv-journey-e">${esc(tf("kat.atelierEyebrow", "Akvaterm Atelier"))}</span>
          <h2 class="akv-journey-t">${esc(title)}</h2>
          <p class="akv-journey-s">${esc(body)}</p>
        </div>
        <span class="akv-journey-btn">${esc(cta)}</span>
      </a>
    </section>`;
}

async function hydrateResume(container, draft, products) {
  const host = container.querySelector("#akvResume");
  if (!host) return;
  let scene;
  try {
    const scenesMod = await import("../../data/scenes.js");
    scene = (scenesMod.SCENES || []).find((s) => s.id === draft.sceneId);
  } catch {
    scene = null;           // offline shell miss
  }
  // A card that cannot even name its scene is a dead card — that rule predates
  // the 3D swap and still holds.
  if (!scene || !host.isConnected) { host.remove(); return; }

  // Caption first, picture second. The still is a WebGL render now, not a
  // synchronous canvas draw, so the card must read correctly the whole time it
  // is arriving rather than only once it has.
  const name = tf(scene.i18nKey, SCENE_FB[scene.id] || scene.id);
  const when = draftWhen(draft.savedAt);
  const sub = host.querySelector("#akvResumeSub");
  if (sub) sub.textContent = when ? `${name} · ${tf("kat.resumeSaved", "spremljeno")} ${when}` : name;

  const canvas = host.querySelector("#akvResumeC");
  const ok = await paintSceneThumb(canvas, draft.sceneId, draft.assignments, products);
  // No still (no WebGL, or scene3d.js missing from the offline shell): drop the
  // canvas rather than leave an empty brown rectangle claiming to be a preview.
  // The card itself still names the scene and still resumes the draft, so it
  // keeps its job — only the picture is gone.
  if (!ok && canvas) canvas.remove();
}

// ---- view ---------------------------------------------------------------------
const FEATURED_IDS = ["ker-01", "ker-18", "ker-15", "ker-22", "gri-05", "kli-05"];

export async function render(container, params) {
  ensureStyles();
  const categoryId = pickParam(params, "categoryId");
  const [products, favIds] = await Promise.all([listProducts(), listFavorites()]);
  const favSet = new Set(favIds);
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (cat) renderCategory(container, cat, products, favSet);
  else renderHome(container, products, favSet);
}

export function teardown() { /* no document-level listeners to release */ }

function renderHome(container, products, favSet) {
  const countBy = {};
  for (const p of products) countBy[p.category] = (countBy[p.category] || 0) + 1;
  const featured = FEATURED_IDS.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  const feat = featured.length ? featured : products.slice(0, 6);
  const draft = readDesignerDraft();
  const atelierDraft = readAtelierDraft();

  container.innerHTML = `
    ${pageHead(
      tf("kat.eyebrow", "Akvaterm · pločice i oprema"),
      tf("kat.title", "Katalog"),
      tf("kat.sub", "Pločice i oprema za vaš dom — pregledajte, spremite favorite i primijenite u dizajneru."),
    )}
    <p class="akv-note">${esc(tf("kat.demo", "Demo katalog — proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda."))}</p>
    ${journeyMarkup(Boolean(atelierDraft))}
    <nav class="akv-cats" aria-label="${esc(tf("kat.categories", "Kategorije"))}">
      ${CATEGORIES.map((c) => `
        <a class="akv-cat-card" data-cat="${esc(c.id)}" href="#/katalog/${esc(c.id)}">
          <span class="akv-cat-ico" aria-hidden="true">${esc(c.icon)}</span>
          <span class="akv-cat-n t-card-title akv-card-title">${esc(catLabel(c))}</span>
          <span class="akv-cat-c t-meta akv-meta">${countBy[c.id] || 0} ${esc(tf("kat.productsShort", "proizvoda"))}</span>
        </a>`).join("")}
    </nav>
    ${draft ? resumeMarkup(draft) : ""}
    <div class="akv-sec">
      <h2 class="t-h2 akv-display-2">${esc(tf("kat.featured", "Izdvojeno"))}</h2>
    </div>
    <div class="akv-grid" id="featGrid">${feat.map((p) => productCard(p, favSet)).join("")}</div>`;

  wireFavButtons(container.querySelector("#featGrid"), favSet);
  if (draft) hydrateResume(container, draft, products);
}

function renderCategory(container, cat, products, favSet) {
  const rows = products.filter((p) => p.category === cat.id);
  const isTileCat = rows.some((p) => Array.isArray(p.tileSizeMm));

  // Formats sorted by real tile AREA — "600×1200 before 600×600, 1200×200
  // last" (what parseInt of the label produced) reads arbitrary to a customer.
  const byArea = new Map();
  for (const p of rows) {
    const label = formatLabel(p);
    if (label && !byArea.has(label)) byArea.set(label, p.tileSizeMm[0] * p.tileSizeMm[1]);
  }
  const formats = [...byArea.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
  const colors = COLOR_ORDER.filter((cid) => rows.some((p) => colorGroup(p.baseColorHex) === cid));
  const brands = [...new Set(rows.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "hr"));
  const finishes = isTileCat ? ["glossy", "mat"] : [];

  const state = { format: null, boja: null, finish: null, brand: null };
  const matchesWith = (p, s) =>
    (!s.format || formatLabel(p) === s.format) &&
    (!s.boja || colorGroup(p.baseColorHex) === s.boja) &&
    (!s.finish || (s.finish === "glossy") === !!p.glossy) &&
    (!s.brand || p.brand === s.brand);
  const matches = (p) => matchesWith(p, state);
  // How many products this chip would leave if it were the value for its group.
  const countFor = (group, value) => rows.filter((p) => matchesWith(p, { ...state, [group]: value })).length;
  const activeCount = () => Object.values(state).filter(Boolean).length;

  const chipRow = (group, label, opts) => opts.length < 2 ? "" : `
    <div class="akv-chiprow" role="group" aria-label="${esc(label)}">
      <span class="lab t-meta akv-meta">${esc(label)}</span>
      ${opts.map((o) => `
        <button type="button" class="akv-chip" data-fg="${esc(group)}" data-fv="${esc(o.value)}" aria-pressed="false">
          ${esc(o.label)}<span class="n" aria-hidden="true"></span>
        </button>`).join("")}
    </div>`;

  container.innerHTML = `
    <a class="akv-back t-button" href="#/">← ${esc(tf("kat.back", "Katalog"))}</a>
    ${pageHead(tf("kat.categoryEyebrow", "Kategorija"), catLabel(cat), "")}
    <p class="t-meta akv-meta" id="catCount" style="margin:-12px 0 16px"></p>
    ${chipRow("format", tf("kat.fFormat", "Format"), formats.map((f) => ({ value: f, label: f })))}
    ${chipRow("boja", tf("kat.fColor", "Boja"), colors.map((c) => ({ value: c, label: COLOR_LABELS[c] })))}
    ${chipRow("finish", tf("kat.fFinish", "Završna obrada"), finishes.map((f) => ({ value: f, label: f === "glossy" ? tf("kat.glossy", "Sjajna") : tf("kat.mat", "Mat") })))}
    ${chipRow("brand", tf("kat.fBrand", "Marka"), brands.map((b) => ({ value: b, label: b })))}
    <div class="akv-chiprow" id="catReset" hidden>
      <button type="button" class="akv-chip akv-chip-clear" id="catClear"></button>
    </div>
    <div class="akv-grid" id="catGrid" style="margin-top:6px"></div>`;

  const grid = container.querySelector("#catGrid");
  const countEl = container.querySelector("#catCount");
  const resetRow = container.querySelector("#catReset");
  const clearBtn = container.querySelector("#catClear");
  const chips = [...container.querySelectorAll(".akv-chip[data-fg]")];

  const syncChips = () => {
    for (const chip of chips) {
      const on = state[chip.dataset.fg] === chip.dataset.fv;
      const n = countFor(chip.dataset.fg, chip.dataset.fv);
      chip.classList.toggle("on", on);
      chip.setAttribute("aria-pressed", String(on));
      chip.classList.toggle("is-empty", n === 0 && !on);
      const slot = chip.querySelector(".n");
      if (slot) slot.textContent = ` ${n}`;
    }
    const active = activeCount();
    resetRow.hidden = active === 0;
    clearBtn.textContent = `${tf("kat.clearFilters", "Očisti")} (${active})`;
  };

  const apply = () => {
    const list = rows.filter(matches);
    countEl.textContent = `${list.length} ${tf("kat.productsShort", "proizvoda")}`;
    grid.innerHTML = list.length
      ? list.map((p) => productCard(p, favSet)).join("")
      : `<div class="akv-empty" style="grid-column:1/-1">
           <div class="ico" aria-hidden="true">🔍</div>
           <h2 class="t-h2 akv-display-2">${esc(tf("kat.noMatch", "Nema proizvoda za odabrane filtre"))}</h2>
           <p class="t-body akv-lead">${esc(tf("kat.noMatchBody", "Pokušajte ukloniti neki od filtera."))}</p>
         </div>`;
    wireFavButtons(grid, favSet);
    syncChips();
  };

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const group = chip.dataset.fg, value = chip.dataset.fv;
      state[group] = state[group] === value ? null : value;
      apply();
    });
  }
  clearBtn.addEventListener("click", () => {
    for (const key of Object.keys(state)) state[key] = null;
    apply();
  });

  apply();
}
