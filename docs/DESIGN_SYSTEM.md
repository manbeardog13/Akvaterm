# Akvaterm design system — Iris

Derived from two operator-supplied references. **Every colour below was sampled from the actual
image file with a pixel reader — none is an impression or an approximation.**

- Palette reference: a teal iris in a golden field with a five-swatch column
  (736×736; swatch bands verified as flat 110–128 px runs at column x=648).
- Type reference: "SIMPLE PLEASURE — MONTELISA × MAGI SANS" (heavy condensed display over a
  light, widely-tracked geometric sans).

## Why this palette fits Akvaterm

The company name is *akva* + *term* — water and heat. The reference resolves to exactly that
opposition: a cool teal (the iris) against warm amber and burnt brown (the field). So the palette
is not decoration bolted onto the brand, it *is* the brand's meaning:

- **teal = voda** — vodoinstalacija, klimatizacija, solarni sistemi
- **amber/brown = toplina** — centralno grijanje, kotlovi, radijatori

## Sampled values

### Swatch column (the five reference colours)

| token | hex | sampled at | role |
| --- | --- | --- | --- |
| `--sky-200` | `#C0D8F2` | rows 0–126 | pale blue — tints, selected backgrounds, sky in scenes |
| `--teal-600` | `#139EB1` | rows 161–271 | **primary accent** — the iris |
| `--mauve-400` | `#A6979C` | rows 304–431 | warm neutral — muted text, borders, stone |
| `--amber-500` | `#EAA651` | rows 462–575 | **secondary accent** — heat, highlights, CTA warmth |
| `--brown-800` | `#68340F` | rows 608–735 | deep ground — dark surfaces, footer, contrast anchor |

### Photograph tones (supporting range, sampled from the image)

| token | hex | role |
| --- | --- | --- |
| `--teal-300` | `#09AFBD` | bright teal highlight (glass rim light, active glow) |
| `--teal-400` | `#40AFCA` | cyan-teal (gradients, water cues) |
| `--amber-600` | `#B96C1C` | burnt amber (heat cues, hover on amber) |
| `--brown-700` | `#83440F` | warm brown midtone |
| `--shadow-warm` | `#5D4F4F` | warm shadow tone — use for shadows instead of neutral black |

### Typography reference tones

| token | hex | role |
| --- | --- | --- |
| `--ink` | `#313131` | body text — a warm charcoal, **never pure black** |
| `--paper` | `#F2F2F2` | page background |

## Derived tokens (compute, do not invent)

Implementation must **compute and verify** any additional shade rather than guessing it:

- `--teal-700` `#0D707D` — darkened `--teal-600` until it reaches **≥4.5:1 on `--paper`** for small
  text. Measured: **5.17:1 on `--paper`**, **5.78:1 on `--surface` `#FFFFFF`**, and white on it
  **5.78:1**.
- `--amber-ink` `#935616` — a darkened amber that reaches ≥4.5:1 on `--paper`. Measured **5.23:1**.
  `--amber-500` itself is **1.86:1 on `--paper`** — a **surface/large-text colour only**, never
  small text on light.
- Every text-on-tint pair ships an `-ink` variant proven ≥4.5:1 (the rule inherited from ASC).

### The `--accent` deviation, stated plainly

`--teal-600` `#139EB1` is the **sampled** iris and the palette's primary accent — but it is **not**
what `--accent` points at in `css/styles.css`, and that is deliberate.

`--accent` is used by the views in **both** directions: as `color:var(--accent)` on white *and* as
`background:var(--accent);color:#fff`. The sampled iris fails both — **2.86:1 on `--paper`**, and
white on it is **3.20:1**. One token cannot serve both roles at that lightness. So:

| token | value | role |
| --- | --- | --- |
| `--accent` | **`#0D707D`** (the derived `--teal-700`) | anything carrying or backing **text** |
| `--accent-bright` | **`#139EB1`** (the sampled iris) | fills, rims, gradients, glows — **never text** |

The sampled iris therefore still ships, unmodified, under `--accent-bright`; what changed is only
which token the text roles resolve to. Read literally, "`--accent` = `#139EB1`" is not what the code
does — this table is what it does, and the reason is AA, not taste.

## Wordmark — EXEMPT from this palette

**Operator instruction, 2026-08-02: "keep the logo original in font and color."**

The wordmark is Akvaterm's own identity, not a surface for the Iris system. It keeps its
original treatment verbatim:

| | value |
| --- | --- |
| AKVA | `--logo-navy` `#00008C` |
| TERM | `--logo-red` `#d6252e` |
| face | the **text** face, italic, weight 800, letter-spacing −0.01em — **not** the Anton display face |
| on dark | AKVA switches to `--on-dark`; TERM keeps its red |

Those two colours live in dedicated `--logo-*` tokens in `css/styles.css` and are deliberately
**outside the rebindable ink set**, so the glass guard rails never recolour the logo the way they
recolour body text.

As shipped and verified in the browser, the top-bar wordmark is Figtree italic 800 at 22 px
(`--logo-navy` / `--logo-red`), and the splash wordmark the same treatment at 34 px. At 22 px bold
the WCAG large-text threshold (3:1) applies; at `--paper` the normal-text threshold (4.5:1) is met
anyway.

**Contrast, recomputed** (sRGB relative luminance, WCAG 2.x — the figures previously recorded here,
"navy 15.3:1, red 4.55:1", were wrong in the third significant figure and are corrected):

| pair | ratio | verdict |
| --- | ---: | --- |
| navy `#00008C` on `--paper` `#F2F2F2` (splash) | **13.61:1** | passes AA at any size |
| red `#d6252e` on `--paper` `#F2F2F2` (splash) | **4.51:1** | passes AA normal text, barely |
| navy on the top bar's solid tint `#F4FAFB` | **14.44:1** | passes |
| red on the top bar's solid tint `#F4FAFB` | **4.78:1** | passes |
| navy on the glass **worst case** `#BEC3C4` | **8.55:1** | passes |
| red on the glass **worst case** `#BEC3C4` | **2.83:1** | **misses even the 3:1 large-text bar** |

The last row is the one to know about. `#BEC3C4` is the glass tint at `--glass-alpha-text` .78 over
a pure-black backdrop — the worst-case composite this system requires every glass pair to be
measured against — and it is reachable, because the designer's `--dark` `#1B120B` canvas stage can
scroll under the bars. On the page at rest the bar composites to `#F4FAFB` and the red measures
4.78:1, so this is a worst-case gap, not the everyday state.

**It is not fixed by recolouring.** The operator instruction above is binding: the red stays
`#d6252e`. The fix, when it is made, belongs in `css/styles.css` and must work by changing what is
*behind* the wordmark — a white wash or a raised alpha under the brand area, the same technique the
sheet already uses for the active nav pill — never by changing the mark.

A future palette sweep that greps for `#00008C` / `#d6252e` will find them here, named and
commented. **They are not leftovers of a retired identity — leave them alone.** The Iris palette
applies to everything around the logo, not to the logo.

## Typography

The reference names **Montelisa** and **Magi Sans**. **Both are commercial faces: they are not
licensed for this project, they are not shipped, and no file in this repository contains either
of them.** The pairing is reproduced with open-licence (SIL OFL 1.1) substitutes chosen to match
the reference's *structure* — a heavy condensed grotesque for display, a geometric sans for text:

| reference face | shipped substitute | licence |
| --- | --- | --- |
| Montelisa (display) | **Anton** — `--font-display` | SIL OFL 1.1, `vendor/fonts/OFL-Anton.txt` |
| Magi Sans (text) | **Figtree** — `--font-text` | SIL OFL 1.1, `vendor/fonts/OFL-Figtree.txt` |

Both are vendored as woff2 under `vendor/fonts/` and loaded from this origin only — there is no
`fonts.googleapis.com` request at runtime and the CSP's `font-src` is `'self'`. Croatian diacritic
(č ć ž š đ) coverage is proven per file by `cmap` parsing, and the byte counts, SHA-256 digests and
source URLs are recorded in `vendor/fonts/PROVENANCE.md`. The `latin-ext` slices carry the
diacritics and are not optional.

The one exception is the wordmark, which is set in the **text** face (Figtree) italic 800, not in
Anton — see "Wordmark — EXEMPT from this palette" above.

Scale, following the reference's contrast between a dense headline and airy supporting text:

| role | treatment |
| --- | --- |
| display / h1 | display face, heavy, tight tracking (≈ −0.02em), large |
| section h2 | display face or text face 700, moderate tracking |
| card title | text face 600 |
| body | text face 400, 15–16px, line-height 1.55 |
| meta / small | text face 500, 12–13px, **wide tracking (≈ 0.08em), uppercase** — this is the
  "PLEASURE / MONTELISA X MAGI SANS" gesture from the reference and is the signature of the system |
| buttons | text face 600, slight positive tracking |

## Liquid glass

Surfaces float as translucent glass over the tiled/photographic content beneath. Rules:

1. **Legibility outranks the effect.** Any glass panel carrying small text needs enough backdrop
   opacity (or a scrim layer) that text still measures ≥4.5:1. Verify, don't assume.
2. **Layer budget.** Glass is expensive on mobile; a screen shows at most a few glass surfaces
   (top bar, tab bar, one floating panel). Do not make every card glass.
3. **Fallbacks are mandatory — there are five of them**, and every glass surface in the tree,
   including one declared inside a view's own scoped `<style>`, must ship all five. They all land
   on the *same* opaque tint, so nothing reflows when one fires:

   | # | trigger | behaviour |
   | --- | --- | --- |
   | 1 | `@supports not (backdrop-filter: blur(1px))` | solid tinted surface |
   | 2 | `@media (prefers-reduced-transparency: reduce)` | solid, blur removed |
   | 3 | **`html[data-transparency="reduced"]`** — the manual switch | solid, blur removed |
   | 4 | `@media (prefers-contrast: more)` / `(forced-colors: active)` | solid + hardened borders / OS colours |
   | 5 | `@media (prefers-reduced-motion: reduce)` | no motion response |

   **Path 3 is not a duplicate of path 2 and is not optional.** Safari never reports
   `prefers-reduced-transparency`, and iOS is the bulk of this audience — path 3 is the *only* way
   those users can turn the blur off. `js/app.js` owns the switch ("Smanji prozirnost" in the Više
   menu) and writes the attribute; every glass surface owes it a rule.

   Path 2 must be written `html:not([data-transparency="full"]) …`. `data-transparency="full"` is a
   user explicitly asking to keep the glass, and an explicit choice outranks an OS hint. A surface
   that leaves path 2 ungated stays pinned solid for that user while the rest of the screen turns
   back to glass.
4. Glass takes its tint from the palette — a teal-leaning cool glass on light content, warm amber
   rim light on hover — never a grey glass.
5. `blur()` is **never animated** — the compositor re-samples the backdrop every frame. Hover and
   focus responses are `box-shadow` only.

Exact `--glass-*` token values, rim-highlight recipe, and per-component usage are specified by
the liquid-glass research and recorded in `css/styles.css` next to the tokens.
