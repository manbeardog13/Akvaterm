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
| Controls (inputs, buttons) | height **52–54px**, `border-radius` = half the height (a full pill) |
| Gap between stacked controls | 12px |
| Card / sheet radius | 22–36px |
| Card padding | 38–44px top, 28px sides — **generous** |
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

### The verified geometry (375×812, measured — not read)

| | value |
| --- | --- |
| card width | **81%** of viewport |
| card radius | 30px |
| content column | 293px |
| logo | **46.4%** of the content column |
| title | **24px** Sora 600, -.01em |
| subtitle | 13.5px, 3px above / 20px below |
| controls | **49px** tall, **14px** radius |
| fields | 11px apart, filled, with a real rim |
| divider | 11.5px uppercase, .13em tracking |
| primary | 15px/700, **sentence case** |
| footer | 14px, 18px above |

### The four treatments that carry to every surface in the app

These are what "milky and smooth" actually means. Each is a construction, not a
colour, and dropping any one flattens the result:

- **Milky surface** — a translucent tint **plus** a real `backdrop-filter`
  blur, **plus** a bright `inset 0 1px 0` top rim, **plus** a wide soft shadow
  thrown far below (`0 30px 80px -30px`). All four, or it is a flat rectangle.
- **Moulded edge** — four shadows, never a border: bright top lip, dark bottom
  lip, containing rim, coloured glow below. A 1px border fights the gradient's
  light and flattens it.
- **Under-glow** — `filter: drop-shadow()` in the identity colour, applied per
  identity half. It follows the *glyph*; `box-shadow` would draw a rectangle.
- **Cross-fade, never a cut** — `.32s` on background/colour/border across every
  surface at once, so the screen turns together.

Motion is opacity and transform only. Never blur, never box-shadow, never a
layout property.

## 3b. The login contract

### Every login screen, on these bones

Required, in this order:

1. Wordmark
2. Heading, **sentence case, left aligned**, with a muted one-line subtitle
3. **Social sign-in FIRST** — full-width pill, official mark, opaque **white**
   ground in both themes
4. Hairline divider with a lowercase label ("ili e-mailom")
5. Email + password as **pill fields with no visible labels** — the field name
   lives in the `placeholder` and in `aria-label`, so the accessible name is
   unchanged and a row of uppercase micro-type leaves the screen
6. Primary action, full-width pill, with a trailing arrow
7. A quiet way past the screen

Two rules that are easy to get wrong:

- **The social button's label and border must be literal hex, not tokens.** Its
  ground is `#FFFFFF` in both themes because the brand mark may not be
  re-coloured. An `--ink` token renders white-on-white in dark mode —
  invisible, and *only* in dark mode, so it survives every light-theme review.
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
