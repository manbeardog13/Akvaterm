# THE HOUSE STANDARD — every platform we build starts here

**Status: binding.** Operator instruction, 2026-08-02. This is not a style
suggestion and not a description of Akvaterm. It is the starting point for
**every future app and platform**, and a new project that does not begin from
these bones is wrong before its first commit.

> "set that font collection that are used on ASC throughout for the future of
> every project that we make and this kind of soft UI that ASC uses is the way
> I want every future project to be built up on"
>
> "every future login and every future app and platform we create must have a
> login screen built on these bones"

The reference implementation is the ASC platform
(`github.com/manbeardog13/ASC`), specifically `app/login.html` and
`design/login-arched-v2.html`.

---

## 1. Typography — Sora + Inter, and nothing else

| Role | Face | Weights | Case |
| --- | --- | --- | --- |
| Display (h1, h2, page titles) | **Sora** | 600, 700 | **Sentence case** |
| Text (everything else) | **Inter** | 400, 500, 600 | Sentence case |

**Sentence case is part of the standard, not a preference.** Sora is a
geometric sans with real lowercase. Setting it in caps produces exactly the
loud, wide heading this standard exists to avoid. Any `text-transform:
uppercase` on a display-face rule is a defect — the only permitted uppercase is
micro-type: eyebrows, meta labels and section kickers at 10–12px.

**Fonts are VENDORED. No runtime CDN, ever.** Fetch the `woff2` from the Google
Fonts CSS API with a current Chrome user agent, commit the files, and record
URLs and SHA-256 hashes in a `PROVENANCE.md` beside them. Both families ship as
variable fonts: two files each (latin + latin-ext), four files total, ~170 KB.

**`latin-ext` is not optional.** It is the subset that carries `č ć ž š đ Č Ć Ž
Š Đ`. Dropping it to save 12 KB breaks Croatian.

### The wordmark is exempt — and this is the trap

A logo keeps its own face and its own colours. Give it a **dedicated token**
(`--font-wordmark`) that no theme or palette sweep touches.

The failure mode is specific and silent: if a wordmark rule reads
`var(--font-text)`, then switching the house text face **re-faces the logo**
without touching the logo's own code, without an error, and without anything in
the diff naming the logo. Pin the wordmark to its own token *before* changing a
global font variable.

## 2. Geometry — the soft UI

| Thing | Value |
| --- | --- |
| Controls (inputs, buttons) | height **49px**, `border-radius` **14px** — NOT pills (measured off the reference) |
| Gap between stacked controls | 11px |
| Card / sheet radius | 22–36px |
| Card padding | 28px top, 24px sides (measured) |
| Card shadow | wide and soft: `0 30px 80px -30px` at low alpha, never a hard drop |
| Easing | `cubic-bezier(.22,1,.36,1)` |
| Entrance | staggered rise, ~40ms apart, opacity + transform **only** |

**Negative space is the feature.** What makes the reference read as premium is
not decoration, it is room. When a screen feels cheap, the fix is almost always
to remove something or add padding — not to add an effect.

**Never reserve empty vertical space for a message that is usually absent.**
Collapse it with `:empty`. A permanent dead band reads as a bug, which is the
opposite of negative space.

## 3. Every login screen — COPY THE TEMPLATE, DO NOT REBUILD IT

**The canonical login is [`docs/templates/login.html`](templates/login.html).
Copy that file. Change only its `:root` token block. Do not rebuild it.**

### Why this is a rule and not a suggestion

The Akvaterm login was rebuilt from scratch while "following" ASC, with values
read out of ASC's stylesheet and retyped one at a time. It took **six rounds**
and never converged. Three failures, each of which will repeat exactly:

1. **A declaration does not tell you which rule wins.** `.auth-logo` declared
   `max-width: 74%`; the rendered logo was **46.4%**. `.btn-amber` declared
   `text-transform: uppercase`; the app rendered sentence case. Both were copied
   faithfully. Both were wrong.
2. **Everything not consciously retyped silently vanishes.** The logo
   under-glow, the primary's glow, the theme cross-fade and the dark-mode
   control colours were never decided against — they simply never crossed over,
   and every one had to come back as a bug report.
3. **A local render and the user's device disagreed** — 93.6% of viewport
   against 81%. The device is the reference.

### The three laws this produced

> **COPY THE RULES. DO NOT RETYPE VALUES.**
> **MEASURE THE RENDERED PAGE, NOT THE SOURCE.**
> **WHERE A LOCAL RENDER AND THE DEVICE DISAGREE, THE DEVICE WINS.**

Measure with `getBoundingClientRect()` and `getComputedStyle()` at the *same*
viewport on both sides, and diff the numbers. Never present a retyped source
value as a measured one.

### THE LOGIN IS FINAL — this is the specification

**Status: closed, 2026-08-03 — amended 2026-08-04.** The Akvaterm login is the
reference implementation and `docs/templates/login.html` is its
copy-pasteable form. Every number below was measured off a rendered page at
**375×812** (desktop figures at **1280×720**, noted where they diverge).
Nothing here was read out of a stylesheet.

**2026-08-04 amendment, Akvaterm only:** operator instruction removed the
boot splash entirely, added a photo blur-in reveal and a particle-resolve
entrance to the card, and took a further **-10%** off the card's reference
width and its own vertical rhythm (not off the controls — see below). The
**card** and **card padding** rows below reflect the new measurements; every
other row is unchanged. This amendment was scoped to Akvaterm's own login
(`js/login-photo-style.js`, `js/views/prijava.js`) — `docs/templates/login.html`
still carries the pre-amendment recipe, deliberately: today's instruction did
not ask for the cross-project template to change, and propagating an
Akvaterm-specific compaction into the binding house template is a separate
decision this doc is not making for you.

#### Layout

| | value |
| --- | --- |
| page gutter | 24px each side |
| card | `width: min(412px * .9, 100%)` — **370.8px** at 1280 viewport, **327px** at 375 viewport (already gutter-capped there; the -10% has no room to apply) |
| card radius | **30px** |
| card padding | **19px / 16.3px / 15px** (28/24/22 × the card's own .68 vertical-rhythm compression — controls stay at their 44–52px floor) |
| logo | **46.4%** of the content column |
| title | **24px** Sora 600, `-.01em`, line-height 1.22 |
| subtitle | **13.5px**, 3px above / 20px below |
| social button | **50px** tall, **14px** radius, 14.5px/600 |
| divider | **"ili email"** — 11px, `.88px` tracking, uppercase, margin `16px 0` |
| fields | **50px** tall, **14px** radius, **11px** apart, filled + rim |
| forgot link | right-aligned, 12.5px, margin `2px 4px 10px` |
| primary | **50px**, **14px** radius, 15px/700, **sentence case** |
| footer | **"Prvi put?"** — 13px, **46px** below the primary |
| theme switch | 42×23 track, 18px thumb, **no glyph**, in the head row |

#### Material — light

| token | value |
| --- | --- |
| page | `#EEF0F1` |
| card fill (with blur) | `rgba(255,255,255,.44)` |
| card fill (fallback) | `rgba(255,255,255,.70)` |
| top rim | `rgba(255,255,255,.75)` |
| shadow | `0 1px 2px -1px rgba(20,18,15,.10)`, `0 6px 16px -8px rgba(20,18,15,.15)`, `0 24px 48px -24px rgba(20,18,15,.20)` |
| sheen | `rgba(255,255,255,.16)` |

#### Material — dark

| token | value |
| --- | --- |
| page | `#0A0C11` |
| card fill (with blur) | `rgba(30,32,38,.55)` |
| card fill (fallback) | `rgba(30,32,38,.88)` |
| top rim | `rgba(255,255,255,.16)` |
| shadow | `0 1px 2px -1px rgba(0,0,0,.50)`, `0 8px 20px -10px rgba(0,0,0,.55)`, `0 24px 48px -24px rgba(0,0,0,.62)` |
| inset rims | `inset 0 1px 0 rgba(255,255,255,.09)`, `inset 0 -1px 0 rgba(0,0,0,.3)` |
| sheen | `rgba(255,255,255,.07)` |
| social button | goes **dark** (`#17181C`), mark untouched |

Shared by both: `backdrop-filter: blur(34px) saturate(150%) brightness(108%)`,
grain at `.035` overlay, `.32s` cross-fade on every surface.

> **THE CARD MUST NOT INHERIT THE APP PALETTE.** Akvaterm's own glass tint is
> `hsl(187 44% 97%)` — a teal — and while the card used it, the "milky white"
> surface was a pale **green** pane. It shipped that way and had to be reported.
> Give the card its own fill/rim/shadow tokens per theme so a palette can never
> reach it.

### The card material — the exact recipe, extracted not reconstructed

Every value below was read off ASC's **running** card. They are inline in its
`app/login.html`, **not** in `css/styles.css` — which is why six rounds of
"reading ASC's stylesheet" kept missing pieces. Before copying anything,
confirm which file actually defines it.

| token | value | role |
| --- | --- | --- |
| `--shell` | `rgba(30,32,38,.55)` | translucent fill, used **with** the blur |
| `--shell-solid` | `rgba(30,32,38,.88)` | the no-`backdrop-filter` fallback |
| `--rim-top` | `rgba(255,255,255,.16)` | lit top border |
| `--shadow-card` | `0 1px 2px -1px rgba(0,0,0,.50)`, `0 8px 20px -10px rgba(0,0,0,.55)`, `0 24px 48px -24px rgba(0,0,0,.62)` | three stacked blacks |
| page | `#0a0c11` | the ground it rests on |

**Ship TWO fills, not one.** The solid `.88` is the base; `@supports` swaps in
the translucent `.55` only where there is a blur to sit behind it. One fill
leaves the card 45% transparent on an engine without `backdrop-filter`.

**A shadow token name means nothing across projects.** Akvaterm's own
`--shadow-card` is a *warm brown*; ASC's is three blacks. On a near-black page
a warm shadow does nothing at all, and the card looks pasted on rather than
resting. Reading the rule gives `var(--shadow-card)` and looks correct —
**resolve the token, don't read it.**

### The four layers of a card

Each is a separate job. Drop any one and it is a flat rectangle.

1. **Fill + blur** — `backdrop-filter: blur(34px) saturate(150%) brightness(108%)`.
   The **brightness lift is not optional**: without it a `.55`-alpha dark pane
   reads as a hole punched in the page rather than as glass.
2. **Rims** — `inset 0 1px 0` bright on top, `inset 0 -1px 0` dark on the
   bottom. Per theme: `.55`/`.05` light, `.09`/`.3` dark.
3. **Sheen** (`::before`) — pointer-tracked
   `radial-gradient(240px 180px at var(--gx,30%) var(--gy,0%), …)` at `.16`
   light / `.07` dark. Needs a tiny JS hook writing `--gx`/`--gy`.
4. **Grain** (`::after`) — an inline SVG `feTurbulence fractalNoise`,
   `baseFrequency 0.75`, at `opacity: .035` and `mix-blend-mode: overlay`.

> **The grain is what "milky" actually means.** No amount of tuning blur radius
> or alpha produces it. Every attempt to get a frosted look without it failed,
> and had to fail.

Content must carry `position: relative; z-index: 1` to clear layers 3 and 4.

### THE LOGO GLOW — two rules, and you must check which applies

The coloured glow under a wordmark is done **two different ways depending on
what the logo is.** Getting this wrong produces a hard rectangular edge around
the mark that appears *after a theme switch* — the single most confusing bug in
this whole exercise.

**Rule 1 — the logo is an IMAGE (`<img>`): use `filter: drop-shadow()`.**
This is ASC's way and it is correct there. An image has a real box for the
filter to be regioned to.
```css
.auth-logo { filter: drop-shadow(0 8px 22px rgba(255,78,27,.35)); }
```

**Rule 2 — the logo is TEXT: use `text-shadow`. Never `drop-shadow`.**
This is Akvaterm's way, and it exists because `drop-shadow` **is always
regioned to a box**. Giving it a bigger box does not remove the clipping, it
only *moves* it. `text-shadow` has no region at all: it rasterises with the
glyphs and ignores `contain: paint`, `overflow`, and inline-ness.
```css
.mark .a { text-shadow: 0 2px 6px rgba(0,0,140,.42), 0 6px 20px rgba(0,0,140,.34); }
.mark .b { text-shadow: 0 2px 6px rgba(214,37,46,.42), 0 6px 20px rgba(214,37,46,.34); }
```
Two shadows per half — a tight core plus a wide halo — is what reads as a glow
rather than a smudge. On a two-tone mark, apply one per half.

**Why the theme switch triggered it:** a filter region is computed once and is
not recomputed on that repaint, so the glow ends up drawn against a region that
no longer matches. That is why it looked fine until you toggled and came back.

### Installed-app chrome — the notch

`apple-mobile-web-app-status-bar-style` must be **`black-translucent`**, not
`default`. With `default`, iOS *reserves* the status-bar strip and the
installed app begins below it — a visible cut-off band under the notch. With
`black-translucent` the app extends underneath and the `env(safe-area-inset-*)`
padding every fixed surface already pays finally does its job. Those insets are
inert until this is set.

Pair it with `viewport-fit=cover`.

## 3b. The login contract

### Every login screen, on these bones

Required, in this order:

1. Wordmark
2. Heading, **sentence case, left aligned**, with a muted one-line subtitle
3. **Social sign-in FIRST** — full width, official mark, and it **follows the
   theme** (light ground in light, `--surface` in dark). The MARK is never
   re-coloured, which is all Google's guidelines actually require — they publish
   a dark button for exactly this. A permanently white button on a near-black
   card is the thing that looks broken.
4. Hairline divider with a lowercase label ("ili e-mailom")
5. Email + password as **filled fields with a real rim and no visible labels**
   — the field name lives in the `placeholder` and in `aria-label`, so the
   accessible name is unchanged and a row of uppercase micro-type leaves the
   screen. **Not pills**: the radius is 14px. A filled row with a rim reads as
   a recess IN the card; a white bordered box reads as sitting ON it.
6. Right-aligned "Zaboravljena lozinka?"
7. Primary action, full width, 14px radius, trailing arrow
8. Footer swap: "Prvi put ovdje? Napravi račun"

Two rules that are easy to get wrong:

- **The social button needs its OWN theme tokens, not the app's.** Give it
  `--goog-bg` / `--goog-ink` that flip with the theme. Reusing `--ink` on a
  hardcoded white ground renders white-on-white in dark mode — invisible, and
  *only* in dark mode, so it survives every light-theme review.
- **Never ship a link that does nothing.** No "Forgot password?" until password
  reset exists.

### The approval gate is ASC-specific — do not copy it

ASC holds a new account until an administrator approves it and assigns rights.
**Akvaterm deliberately does not** (operator instruction, 2026-08-02): a user
who signs in is active immediately. Copy the *look* of ASC's login, never that
gate, unless a project asks for it by name.

## 4. Light and dark, with a visible switch

Three states, and the third is the default:

| `html[data-theme]` | Behaviour |
| --- | --- |
| absent | **follow the system** via `prefers-color-scheme` |
| `"light"` / `"dark"` | explicit user choice, persisted |

The switch only ever writes an explicit value, so a user who has chosen keeps
their choice when the OS flips.

- Override **root** surface and ink tokens only. Everything else derives from
  them; overriding derived tokens is how a theme drifts out of step with itself.
- **Compute every contrast ratio.** Do not estimate. Light-theme accent inks are
  dark by construction and measure under 2:1 on a dark ground — all of them need
  re-pointing, not just the greys.
- **Translucent surfaces must be re-composed, not re-tinted.** If glass is built
  as `hsl(var(--tint) 97% / a)`, the 97% lightness is baked in and changing the
  tint still yields a near-white pane. Override the composed value.
- Re-tint `<meta name="theme-color">` on every flip, or iOS paints the notch
  surround in the other theme.
- A logo half that would *disappear* (navy on near-black is ~1.1:1) may move;
  the rest of the mark may not.

## 5. Navigation — a left drawer, never a bottom bar

- Slides from the left: `width: min(300px, 84vw)`, radius `0 22px 22px 0`,
  parked at `translateX(-103%)` (the extra 3% hides the shadow too).
- Slide **320ms**, scrim fade **280ms**, both on `cubic-bezier(.25,1,.5,1)` —
  the ground dims a beat before the drawer lands, so it reads as one gesture.
- **The scrim carries the blur.** Never blur the page content: an element with
  `filter`/`backdrop-filter` becomes a backdrop root and disables every glass
  surface beneath it for as long as it is applied.
- Icons in a fixed 20px column so every label aligns on one optical axis. That
  alignment is most of why the list reads as calm.
- Active row: filled pill + a 3px accent bar on the leading edge.
- Escape closes, the scrim closes, navigating closes; focus moves into the
  drawer on open and returns to the opener on close.

## 6. Icons

One inline SVG set, drawn on `currentColor`: 24px box, **1.7–1.8 stroke**,
round caps and joins. No icon font, no sprite fetch, no icon dependency. The
whole point is that the top bar and the drawer read as one hand.

---

### Why this file exists

So that the next project does not re-derive a type scale, re-guess a radius, or
rediscover — in production, in dark mode — that its sign-in button is white text
on white. Start here. Deviate only where a project genuinely differs, and say so
in that project's own docs.
