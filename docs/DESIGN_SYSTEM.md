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

- `--teal-700` — darkened `--teal-600` until it reaches **≥4.5:1 on `--paper`** for small text.
  Verify with a contrast calculation and record the result in a CSS comment.
- `--amber-ink` — a darkened amber that reaches ≥4.5:1 on `--paper`; `--amber-500` itself is a
  **surface/large-text colour only**, it does not pass AA as small text on light.
- Every text-on-tint pair ships an `-ink` variant proven ≥4.5:1 (the rule inherited from ASC).

## Wordmark

`AKVA` in `--teal-600`, `TERM` in `--amber-600`. Heavy condensed display face, tight tracking.
The previous navy/red wordmark is retired.

## Typography

The reference names **Montelisa** and **Magi Sans**, which are commercial faces — they are not
licensed for this project and are not shipped. The pairing is reproduced with open-licence
(SIL OFL) substitutes that match the reference's *structure*: a heavy condensed grotesque for
display, a light geometric sans for text. The chosen families, their verified Croatian
diacritic (č ć ž š đ) coverage, and their vendored woff2 provenance are recorded in
`vendor/fonts/PROVENANCE.md`.

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
3. **Fallbacks are mandatory**: `@supports not (backdrop-filter: blur(1px))` → solid tinted
   surface; `prefers-reduced-transparency: reduce` → solid; `prefers-reduced-motion` → no
   动 response. All three already exist as patterns in `css/styles.css`.
4. Glass takes its tint from the palette — a teal-leaning cool glass on light content, warm amber
   rim light on hover — never a grey glass.

Exact `--glass-*` token values, rim-highlight recipe, and per-component usage are specified by
the liquid-glass research and recorded in `css/styles.css` next to the tokens.
