

===== ? =====
# AKVATERM — DESIGN PANEL BRIEF
Repo: `C:/NERO/workspaces/Akvaterm` · read-only pass, nothing edited · date 2026-08-03

---

## 1. WHAT AKVATERM SELLS

Source of truth: `C:/NERO/workspaces/Akvaterm/data/catalog.seed.json` — **46 products, all flagged `demo: true`**, loaded by `js/db.js:289` (`loadCatalog`). No image/photo field exists on any record. Five categories (`js/domain.js:8`), each with an emoji icon that is currently the only category graphic.

| Category (id) | Croatian label | Count | Icon in use |
|---|---|---|---|
| `keramika` | Keramika | **23** | 🧱 |
| `sanitarije` | Sanitarije | **7** | 🚿 |
| `armature` | Armature | **5** | 🚰 |
| `grijanje` | Grijanje | **6** | 🔥 |
| `klima` | Klimatizacija | **5** | ❄️ |

**Keramika (23)** — priced €19,50–64,50/m². Marble: Carrara Bianco (600×1200), Calacatta Oro (800×800), Nero Marquina, Grigio Imperiale. Travertine: Travertin Classico (610×406), Travertin Noce, Travertin Silver. Croatian-named ceramics: Dalmacija Bijela (250×400), Kaštela Bež, Pelješac Kadulja, Jadran Plava. Concrete: Beton Grigio, Beton Antracit (750×750), Beton Pijesak. Wood-plank: Hrast Natur (1200×200), Hrast Dimljeni, Jasen Sivi (900×150). Terrazzo Veneto, Terrazzo Rosso. Metro Bijela / Metro Antracit (300×100 subway). Heksagon Siva / Heksagon Terakota (300×260 hex).

**Sanitarije (7)** — €59–329/kom. Viseća WC školjka Pura Rimless, WC daska Pura soft-close, Umivaonik Slim 60, Nadgradni umivaonik Orbis, Tuš kada SlimStone 90, Tuš kada SlimStone 120 Antracit, Ugradbeni modul Instal 112.

**Armature (5)** — €89–249/kom. Slavina za umivaonik Uno Krom, Visoka slavina Alta Crna, Tuš set Rain 25, Termostatska garnitura Term S, Kuhinjska slavina Cucina Inox.

**Grijanje (6)** — €159–6.490/kom. Pločasti radijator Universal 22 (Viessmann), Kupaonski radijator Linea, Električni panel E-Panel 1000, Set podnog grijanja Comfort 10, **Toplinska pumpa Vitocal 150-A (€6.490)**, Kondenzacijski kotao Vitodens 100-W (€1.890).

**Klima (5)** — €599–1.190/kom. Daikin Sensira FTXF25D, Daikin Comfora FTXP35N, Mitsubishi MSZ-HR25VF, Mitsubishi MSZ-AY35VGK, Daikin Emura FTXJ35AB.

**Brands (11):** Adria Ceramica 9, Marmo Vivo 8, TerraNova 6, AquaLine 4, Nordika 4, Sanova 3, Viessmann 3, Termostroj 3, Daikin 3, Mitsubishi Electric 2, Norvik 1. The four real partner brands (Viessmann, Daikin, Mitsubishi, Termostroj) are the client's actual suppliers per `docs/RESEARCH.md:26`; the tile/sanitary brands are invented for the demo. 22 of 23 tiles carry `glossy` true/false; only tiles have `tileSizeMm`.

---

## 2. WHO THE USER IS

`docs/RESEARCH.md:26–28`, verified against the client site during research: **Akvaterm d.o.o., Bokeljska 12, Dubrovnik — a family mechanical-installations contractor since 1991** (Boris and Juraj Dujmović). Four service lines: vodoinstalacija, solarni sistemi, klimatizacija, centralno grijanje. **The real akvaterm.hr has no webshop, no catalogue, no prices, no SKUs.** This app is entirely new capability on synthetic data.

Two jobs the code is actually built around:

1. **The homeowner renovating a bathroom/kitchen.** Concrete evidence: five preset rooms in `data/scenes.js` (kupaonica 2,6×2,8 m, mala-kupaonica, kuhinja, dnevni-boravak, wc), tap-a-surface → pick tile → pick uzorak/fuga; favourites (♡ on every card, `js/views/favoriti.js`); saved designs; share by link + QR. The dictionary is formal-Vi Croatian throughout (`js/i18n.js`).
2. **The buyer preparing to ask for a quote.** `js/domain.js:193 orderEstimate()` computes area + a **10 % reserve, or 15 % for herringbone/diagonal** — that is a tiler's waste allowance, not a shopper feature. `js/views/proizvod.js:159` renders an `.akv-inq` box; `js/views/dizajner.js:107` hard-codes `QUOTE_EMAIL = "info@akvaterm.hr"` and `:1498` fires a `mailto:` carrying the full surface-by-surface specification including the laying offset. Price estimates are live per m² against real 3D geometry (`listSurfaces().areaM2`).

There is **no auth gate on any route** (`js/app.js:13–18`); the app is fully usable signed out.

---

## 3. WHAT THIS APP CAN DO THAT A COMPETITOR SITE CANNOT

**REAL and working today:**

- **Dizajner (`js/views/dizajner.js`, 100 KB)** — five preset rooms rendered by the *actual 3D engine* (`js/scene3d.js`, 84 KB) from vendored CC0 `.glb` models at measured scale. Camera is locked (designed view, not an orbit sandbox); furniture is draggable. Owns: surface selection by tap **and** keyboard, product drawer, 4 laying patterns, 3 grout colours, grout width, per-surface tile rotation, live price estimate, curated starter combinations, first-run coach mark, **A/B compare**, **before/after wipe** (CSS clip-path over a frozen frame), draft persistence (`akv:diz-draft`), share link + QR, quote mailto.
- **3D soba (`js/views/soba3d.js` + `js/room3d.js`)** — parametric room from width/depth/height; floor + 4 walls tiled with the same physically-scaled texture pipeline; **27 movable fixture types** (12 kupaonica, 8 kuhinja, 7 otvori/ostalo) that snap to walls, rotate with R, and cannot leave the room. Two-step drag on touch so vertical page scroll survives.
- **Procedural texture pipeline (`js/texture.js`, `js/domain.js`)** — 7 seeded generators (marble, travertine, concrete, woodPlank, terrazzo, subway, hexMosaic) + flat; deterministic, seamless, true-scale. `patternCellMm` is the single source of the cell maths shared by 2D canvas and `THREE.CanvasTexture`. **No photography anywhere in the repo.**
- **Favourites** — `js/db.js:335` / `js/views/favoriti.js`, localStorage `akv:fav`.
- **Saved designs** — `js/views/dizajni.js`, newest-first, each card shows a **real WebGL still** of that design; two-step inline delete.
- **Share** — `js/qrshare.js` (21 KB), vendored qrcode-generator; design travels by URL or QR.
- **Left drawer + theme switch** — `js/app.js:300+`; three theme states (system default, explicit light, explicit dark), persisted, `<meta theme-color>` re-tinted on flip (`js/app.js:430`).
- **PWA** — service worker precaches a 31-entry shell (~800 KB) incl. 4 woff2; three.js (2,3 MB) and models (1,86 MB) fetch in two ordered background phases and are skipped entirely on `Save-Data`/2G. Single version literal `APP_V = "v3"` (`js/app.js`).

**DEMO / CONDITIONAL:**

- **Terma advisor (`js/views/savjetnik.js` 50 KB + `js/terma.js`)** — `js/config.js` **is now filled in** (Supabase project `btcqaqstfbaenurhuvym`, publishable key, `termaFunction: "terma"`), and `supabase/functions/terma/index.ts` exists in the repo. Whether that function is deployed **cannot be verified from the tree**. When unreachable, `TermaUnavailable` is thrown and the view falls back to a static Croatian explainer + 6 canned FAQ answers. Photo analysis is gated behind a persisted consent (`akv:terma-consent`). **AI staging is labelled "AI impresija"**, paid-tier, always an explicit click.
- **Global violet AI dock (`js/aidock.js`, 54 KB)** — mounted once into the frame (`js/app.js:738`), visible on the catalogue; hidden only on `/savjetnik` and `/prijava`. Deliberately **off the Iris palette** (tab `#8958F4`, panel `#2A1D50`) so it reads as "not part of the page".
- **Prijava (`js/views/prijava.js`, 46 KB)** — real Supabase email/password + Google + password reset code paths, self-disabling `<fieldset disabled>` when unconfigured, always offers "Nastavi kao gost". Its own header still says "js/config.js ships empty" — **stale**, config is now filled. Cold start with no hash redirects to `#/prijava` (`js/app.js:810`).
- **NOT real: cross-device sync.** `js/db.js:437 mirror()` is fire-and-forget **write-only**; nothing ever reads favourites or designs back from Supabase. localStorage is the only read source. Signing in changes one menu label and nothing else.

---

## 4. THE CURRENT CATALOGUE PAGE, ELEMENT BY ELEMENT

`js/views/katalog.js` (1 184 lines). Two renders share one file. Frame: `#main` = `max-width 1180px`, `padding 18px 16px` mobile / `26px 24px 44px` ≥720px (`css/styles.css:1163`). Above it: glass top bar (58 px) with burger + AKVA|TERM wordmark + desktop nav + "Više". The bottom tab bar is **retired**. `#main.view-enter` fades and its direct children rise 12 px staggered 20/70/120/165/200 ms.

### Home (`#/`) — `renderHome()`, line 1054

1. **`<header class="akv-head">`** — eyebrow `.t-meta.akv-meta` "AKVATERM · PLOČICE I OPREMA", 12 px, weight 500, uppercase, tracking .08em, colour `--mauve-600 #756168`; then `h1.akv-display-1` "Katalog" — **Sora 600, `clamp(2rem, 4.8vw, 3rem)` = 32–48 px**, tracking −.025em, line-height 1.18, `padding-block-start:.12em`; then `.akv-lead` 15 px/1.6 in `--mauve-600`, max-width 62ch: *"Pločice i oprema za vaš dom — pregledajte, spremite favorite i primijenite u dizajneru."*
2. **`<p class="akv-note">`** — demo banner, `background: --sky-200 #C0D8F2`, `--ink` text, radius `--r-md` 16 px, inset white rim, 13 px: *"Demo katalog — proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda."*
3. **`<nav class="akv-cats">`** — 5 category tiles. `grid auto-fill minmax(158px, 1fr)`, gap 12, `min-height 132px`, padding 16, radius `--r-xl` 28 px. Each is: **an emoji at 30 px**, name (17 px/600), count ("23 PROIZVODA" in uppercase tracked meta). Background is a `color-mix` wash per category — keramika `#E1DEDF`, sanitarije `#D6E4F2`, armature `#D3E6E9`, klima `#D2E6EB`, grijanje `#F1E4D5` — plus a 150° white-to-transparent `::after` sheen at opacity .7 (1 on hover). Hover: −2 px lift, shadow up a step, rim goes amber. Text is `--ink` only, by rule.
4. **`<section class="akv-resume">`** — **conditional**, only if `localStorage["akv:diz-draft"]` exists. The one warm/dark surface: `--brown-800 #68340F`, radius 34 px, 4:3 WebGL still (640×480 canvas, sweep placeholder while rendering), amber eyebrow "VAŠ DIZAJN", 18 px title "Nastavite gdje ste stali", sky-200 subtitle "Kupaonica · spremljeno danas", amber pill CTA "Nastavi dizajn". On a first visit this whole block is absent.
5. **`<div class="akv-sec">`** — `h2.akv-display-2` "Izdvojeno", Sora 600, `clamp(1.375rem, 2.8vw, 1.875rem)` = 22–30 px. No count, no link, no filter.
6. **`<div class="akv-grid" id="featGrid">`** — **exactly 6 hardcoded cards** (`FEATURED_IDS` line 1040): Carrara Bianco, Terrazzo Veneto, Hrast Natur, Heksagon Siva, Toplinska pumpa Vitocal 150-A, Klima Emura FTXJ35AB. `grid auto-fill minmax(172px, 1fr)`, gap 16.

**The product card** (`productCard()`, line 861): radius 28, background `--glass-bg-deco` at alpha .30 (`backdrop-filter` explicitly **none** — budget), 1 px inset warm ring, three-part warm shadow, `isolation:isolate`. Contents: a **1:1 procedural swatch** (`<img>` filled lazily 3-per-idle-slice from `swatchDataUrl(p, 256)`, near-viewport first) with, for non-tile products, **the category emoji at 46 px centred over it**; then an opaque `--surface` scrim `.akv-pbody` holding meta ("MARMO VIVO · 600×1200 MM"), name (17 px/600), price (`--teal-700`, 15 px/700, tabular). A 44×44 `♡/♥` circular button floats top-right. Hover −2 px + amber rim. Entrance `akv-rise` 10 px / 420 ms, staggered 26 ms, **capped at 8 steps**, `fill-mode: backwards`.

### Category (`#/katalog/:id`) — `renderCategory()`, line 1086

1. `.akv-back` "← Katalog" in `--teal-700`, 44 px tall.
2. `pageHead("KATEGORIJA", <name>, "")` — same header block, no lead.
3. `#catCount` — "23 PROIZVODA" in uppercase meta, pulled up `margin:-12px 0 16px`.
4. **Up to four horizontally-scrolling chip rows** — Format / Boja / Završna obrada / Marka. A row renders only if it has ≥2 options. Each row: a sticky 86 px `.lab` label, then 44 px pill chips with a live "would-leave" count in a `.n` span; empty options get a dashed border. Chips are glass-coloured (alpha .78) with blur removed; active = `--teal-700` fill, white text, `--teal-800` on hover.
   - Format is sorted by **real tile area**, not by string.
   - Boja is derived by HSL heuristic from `baseColorHex` into 8 buckets (`colorGroup`, line 52): Bijela, Bež, Siva, Antracit, Kadulja, Terakota, Smeđa, Plava.
5. `#catReset` — hidden until ≥1 filter is on, then a dashed teal "Očisti (n)" chip.
6. `#catGrid` — the same product cards, or a centred `.akv-empty` (34 px radius, 🔍 at 42 px, "Nema proizvoda za odabrane filtre").

Five degradation paths ship on every glass surface (no-backdrop-filter, `prefers-reduced-transparency`, the manual `html[data-transparency="reduced"]`, `prefers-contrast:more`/`forced-colors`, `prefers-reduced-motion`), all landing on `--glass-solid #F4FAFB`.

---

## 5. WHAT IS WEAK — blunt

**A. The page is six cards and five emoji.** On a first visit (no draft) the entire catalogue home is: a heading, a disclaimer banner, five 132 px tiles whose only imagery is a system emoji, an "Izdvojeno" heading, and six cards. **13 % of the assortment (6 of 46) is on the landing screen** and the choice is a hardcoded ID list. There is no hero, no room imagery, no "what can I do here", no entry point to the Dizajner or the 3D soba anywhere on the catalogue page — the app's two genuinely unique features are only reachable from the drawer.

**B. Category identity is an emoji.** 🧱 🚿 🚰 🔥 ❄️ at 30 px on a flat colour wash, plus 📦 fallback and a 46 px emoji stamped over the swatch of every non-tile product. The app can render WebGL stills of five real furnished rooms and generate 7 kinds of procedural tile texture; the catalogue uses neither for category or equipment imagery.

**C. No search, no sort, no price filter — and the strings for all three already exist.** `js/i18n.js:71–78` defines `katalog.search` ("Pretraži proizvode…"), `katalog.results`, `katalog.filter.price`, `katalog.filter.all`. `js/db.js:317 listProducts()` implements diacritic-folded Croatian search. **The catalogue view calls none of it.** No sorting by price, no price range, no pagination — 23 keramika cards land in one grid.

**D. Dark theme is broken on this page, measured.** `js/views/katalog.js` was written against the light palette and bridges to tokens (`--teal-700`, `--mauve-600`, `--amber-ink`, `--sky-200`) that **neither dark block overrides** (`css/styles.css:623–672` re-points only `--paper/--surface/--panel/--ink/--ink-2/--muted/--line/--accent-ink/--accent-2-ink/--danger-ink/--ok-ink/--glass-*`). Computed, WCAG 2.x, on the shipped dark values `--paper #1C1E23` / `--surface #25282E` / `--ink #F1F2F4`:

| element | pair | dark ratio | needs |
|---|---|---:|---:|
| demo banner + `.akv-kind` badge | `#F1F2F4` on `--sky-200 #C0D8F2` | **1,31:1** | 4,5 |
| **card price** `.akv-price` | `--teal-700 #0D707D` on `#25282E` | **2,55:1** | 4,5 |
| ♡ favourite glyph | `--amber-ink #935616` on `#25282E` | **2,52:1** | 3,0 |
| card meta + `.akv-specs th` | `--mauve-600 #756168` on `#25282E` | **2,58:1** | 4,5 |
| "← Katalog" back link | `--teal-700` on `#1C1E23` | **2,88:1** | 4,5 |
| chip group labels | `--mauve-600` on `#1C1E23` | **2,91:1** | 4,5 |
| **sanitarije tile title** | `#F1F2F4` on wash `#768495` | **3,41:1** | 4,5 |

(Light theme is fine: price 5,78:1, ink on paper 11,62:1 — the ledger in the file is accurate *for light only*.)

**E. The manual dark toggle produces near-white glass.** `css/styles.css:664–672` (`:root[data-theme="dark"]`) sets only `--glass-tint:24 18%` and `--glass-wash`; it **does not** override `--glass-bg-text/-strong/-deco`, `--glass-solid`, `--glass-ink`, `--accent-on-glass`, `--warm-on-glass`, `--ok-on-glass`, `--danger-on-glass` — all of which the `@media (prefers-color-scheme: dark)` block 40 lines above *does* override, with a comment explicitly warning that re-tinting alone "still yields a near-white pane". So a user on a light OS who flips the switch gets `hsl(24 18% 97% / .78)` = `#F9F7F6`, composited over `#1C1E23` → **`#C8C7C8`, carrying `--glass-ink` `#F1F2F4` at 1,50:1**, and the AKVA half of the wordmark — which the dark rule re-points to `--ink` — becomes near-white on near-white. The OS-driven path is correct; the switch path is not.

**F. Colour hierarchy is flattened by its own rule.** The five category washes carry `--ink` **only**, by documented rule (teal/mauve/amber inks land at 3,99–4,28:1 on them), so on a tile the name, the count and everything else are the same colour and hierarchy comes from size and tracking alone. The result is five near-identical pale rectangles.

**G. Documentation and code have drifted, in both directions.**
- `README.md:16` says "46 demo proizvoda" ✅ but `:23` says "27 tipova" ✅ and `:153` says "**Svih 25** `.glb`" — there are **61 GLB files, 1 761 632 B**, and `js/views/zasluge.js:6–9` says 61 of which **two are CC-BY 3.0**, not CC0 (`radiator-panel.glb`, `ac-indoor-split.glb`).
- `README.md:54` and all of `docs/DESIGN_SYSTEM.md §Typography` say the faces are **Anton + Figtree**. `vendor/fonts/fonts.css` and `index.html:126` ship **Sora + Inter**; Anton/Figtree survive only as `--font-wordmark`. `js/views/katalog.js:148` still carries an "ANTON METRIC HAZARD" block; `css/styles.css:1` still opens "Vendored Anton (display) + Figtree (text)".
- `README.md:105` and `js/views/prijava.js:14` say sign-in is not implemented / config is empty. `js/config.js` is filled and `js/db.js` ships `signIn/signUp/signInWithGoogle/requestPasswordReset`.
- The dark-theme contrast ledger at `css/styles.css:606–616` lists `#F2EFEC on #1C1815`, `#A79C97`, `#5FD3E0 on #1C1815` — a **warm-brown dark theme that no longer ships** (replaced by the silky grey in commit `44e8ff3`). Every number in that ledger is against retired values.
- `js/app.js:60–62` still documents a `.tabbar` CSS contract; `css/styles.css:1161` says "The tab bar is retired".

**H. Nine strings on this page bypass the dictionary.** `js/i18n.js:10` declares itself "THE AUTHORITY FOR UI COPY", but `kat.eyebrow`, `kat.categoryEyebrow`, `kat.clearFilters`, `kat.resumeEyebrow`, `kat.resumeTitle`, `kat.resumeCta`, `kat.resumeAlt`, `kat.resumeSaved`, `kat.resumeToday` are **not in it** and render from inline `tf()` fallbacks. Same for `scene.mala-kupaonica` and `scene.wc`.

**I. A third accent lives on the page.** The violet AI dock (`#8958F4` tab, `#2A1D50` panel, 152° gradient) sits on the right edge of the catalogue, deliberately off-palette. So the screen currently carries navy+red (logo) + teal+amber (Iris) + violet (dock).

**J. Card texture is at war with card chrome.** `.akv-pcard` is decorative glass at alpha .30 so the swatch reads through — but every word then has to sit on an opaque `--surface` scrim, so the card is a full-bleed texture and a plain white box, glued. The glass does no work a plain card would not do.

---

## 6. ASSETS AVAILABLE TO BUILD WITH

**Imagery the app can produce itself — there is no other imagery:**
- **Procedural tile swatches** — `js/texture.js swatchDataUrl(product, sizePx=256)`, deterministic seeded PRNG, any size, any of 7 generators (marble / travertine / concrete / woodPlank / terrazzo / subway / hexMosaic) + flat. Also `buildPatternCell(product, opts)` for a tileable, physically-scaled cell with grout. Cost measured at 3–20 ms + `toDataURL`, hence the idle-slice hydration.
- **WebGL room stills** — `js/scene3d.js renderSceneThumbnail(canvas, sceneIdOrObject, assignments, products)`. Accepts a scene **id** or a scene **object** (arbitrary room box). Already used on the resume card and every saved-design card at 4:3. `js/scene3d.js` frames every locked camera on `REF_ASPECT` 4:3.
- **61 CC0 1.0 `.glb` models**, 1 761 632 B, `vendor/models/` — bathroom (3 tubs, 3 toilets, 4 washbasins, shower enclosure, mirrors, cabinets, towel rails), kitchen (base/upper/corner cabinets, sink, 2 stoves, fridge, 2 hoods, microwave, bar counter, stools), living (3 sofas, armchair, coffee/dining table, chairs, TV + cabinet, bookshelf, rugs, lamps, chandelier, plants, paintings), openings (doors, 2 windows, curtains), AC indoor/outdoor, radiator panel. Every file has a **measured** bounding box + scale factor in `vendor/models/PROVENANCE.md`. **Two are CC-BY 3.0** (`radiator-panel.glb`, `ac-indoor-split.glb`) and are deliberately never rendered — `js/room3d.js` draws those two as procedural primitives. Radiators and indoor split units are procedural geometry: **no CC0 model of either exists**, documented with search queries.
- **5 authored scenes** — `data/scenes.js` (458 lines): kupaonica (2,6×2,8×2,6 m, 7 fixtures), mala-kupaonica, kuhinja, dnevni-boravak, wc. Each carries a solved camera (position, target, fov) with framing percentages recorded, plus 3 tileable surfaces (pod + 2 visible walls) with default product ids.
- **27 placeable fixture types** with real metre dimensions (`js/views/soba3d.js:64`).
- **4 laying patterns** (mreža, vezni slog, riblja kost, dijagonalno) and **3 grout colours** (bijela `#e8e6e1`, siva `#9a9a9a`, antracit `#3a3a3a`), `js/domain.js`.
- `assets/icon.svg` — the only static image file in the repo. **No photography exists and none may be assumed.**

**Palette — "Iris", every value pixel-sampled from the operator's reference (`docs/DESIGN_SYSTEM.md`):**

| token | hex | role | measured |
|---|---|---|---|
| `--sky-200` | `#C0D8F2` | pale blue, tints, selection | — |
| `--teal-600` `--accent-bright` | `#139EB1` | **the iris** — fills/rims/glow, **never text** | 2,86:1 on paper |
| `--mauve-400` `--faint` | `#A6979C` | decorative only | 2,49:1 |
| `--amber-500` `--accent-2` | `#EAA651` | heat, surfaces, large only | 1,86:1 on paper |
| `--brown-800` | `#68340F` | deep warm ground, hairlines | — |
| `--teal-700` `--accent` | `#0D707D` | **all text-carrying teal** | 5,17 paper / 5,78 white / white-on-it 5,78 |
| `--teal-800` | `#0B5A65` | hover fill, gradient deep stop | white 7,88:1 |
| `--amber-ink` | `#935616` | text amber | 5,23:1 |
| `--mauve-600` `--muted` | `#756168` | secondary text | 5,12 paper / 4,57 panel |
| `--ink` / `--ink-2` | `#313131` / `#51484B` | body | 11,62 / 7,89 |
| `--paper` / `--surface` / `--panel` | `#F2F2F2` / `#FFFFFF` / `#E7E5E6` | grounds | — |
| `--red-warm` `--danger` | `#B92C1C` | destructive (derived, palette has no red) | 5,45:1 |
| `--ok` / `--ok-ink` | `#219F5B` / `#12713F` | status dot / text | 3,04 / 4,66 |
| **dark** | `#1C1E23` `#25282E` `#31353C` `#2A2E34`, ink `#F1F2F4` `#C9CDD4` `#A3A9B3` | silky neutral grey | ink 15,4–16,5:1 |
| dark accents | `#5FD3E0` `#F0B860` `#FF8A7A` `#6FD79A` | re-pointed inks | 7,7–10,0:1 |
| **`--logo-navy` / `--logo-red`** | **`#00008C` / `#d6252e`** | **EXEMPT — do not touch** | navy 13,61 / red 4,51 on paper; red 2,83 on worst-case glass, exempt under SC 1.4.3 |

**Geometry & motion already fixed** (`css/styles.css`, `docs/HOUSE_STANDARD.md`): radius ladder `--r-xs 8 / --r-sm 12 / --r-md 16 / --r-lg 22 / --r-xl 28 / --r-2xl 34 / --r-pill`, with a written concentric-nesting rule (`r_child = r_parent − inset`); controls 44 px min tap (house standard asks 52–54 px pills — the catalogue currently ships 44); three-part warm shadows built on `--shadow-warm rgb(93,79,79)`, never black; easings `--smooth cubic-bezier(.25,1,.5,1)`, `--snap (.22,1,.36,1)`, `--spring (.34,1.4,.5,1)`; durations 200/380/560 ms; `--maxw 1180px`, `--topbar-h 58px`, `--track-meta .08em`.

**Type — vendored, fixed:** Sora variable 500–800 (latin + latin-ext, 37 KB) as `--font-display`; Inter variable 300–800 (latin + latin-ext, 133 KB) as `--font-text`; Figtree kept **solely** as `--font-wordmark`. Existing scale in `vendor/fonts/fonts.css`: `.t-h1` clamp 36–56, `.t-h2` clamp 24–32, `.t-card-title` 17/600, `.t-body` 15/1.6, `.t-meta` 12/500 uppercase .08em, `.t-button` 14/600, `.t-numeric` tabular. `latin-ext` carries č ć ž š đ and is preloaded for both faces.

**Constraints already enforced by the build:** strict CSP meta (`script-src 'self'` + 2 sha256 hashes; `font-src 'self'`; `img-src 'self' data: blob:`; `connect-src 'self' blob: https://*.supabase.co`) — **adding any CDN reference breaks the app**. `user-scalable=no, maximum-scale=1` by operator instruction. Vendored: three.js r185 (2,3 MB), supabase-js 2.111.0 (261 KB), qrcode-generator (61 KB). No build step, no dependencies, ES modules only.

===== ? =====
# OČITANJE — the instrument direction for Akvaterm

*Design panel submission · instrument lens · verified against `C:/NERO/workspaces/Akvaterm` on 2026‑08‑03*

**What I verified in the tree myself (not taken from the brief):** `data/catalog.seed.json` is a 46‑item array; `ker-01 Carrara Bianco` is `priceM2: 54.9`; `ker-05 Travertin Classico` `47.5`; `ker-08 Dalmacija Bijela` `21.9`; `ker-11 Jadran Plava` `24.9`; `gri-05 Vitocal 150-A` `priceUnit: 6490`; `kli-05 Emura FTXJ35AB` `1190`. **No product carries `boxM2` or `m2PerBox`**, so `js/domain.js:201–202` can never emit `boxes` today. `data/scenes.js:155–183` gives kupaonica `2.6 × 2.8 × 2.6` with defaults `ker-05 / ker-11 / ker-08`. `js/scene3d.js:194–213` computes `areaM2` as the raw rectangle (`w*d`, `w*h`, `d*h`) — openings are **not** subtracted. `js/domain.js:193–204` is exactly as briefed. And `css/styles.css:747–752` really does re‑point `.wordmark .akva` to `var(--ink)` in dark — the exempt navy **is being recoloured in shipped code**.

Every ratio below was computed, not estimated. Method at §2.0.

---

## 1. THE IDEA

Akvaterm is not a shop — it is **the instrument you point at a room to find out what it costs**: it holds a real 2,60 × 2,80 m bathroom, three real surfaces, 21,32 m² of them, and one number that moves the moment you change a tile.

It should feel like picking up a laser measure: cold, immediate, honest, and slightly satisfying to hold — the pleasure is that it is *right*, not that it is pretty.

---

## 2. THE PALETTE — "Očitanje"

### 2.0 Method

WCAG 2.x relative luminance. For each 8‑bit channel `c`: `s = c/255`, then `lin = s/12.92` if `s ≤ 0.04045` else `((s+0.055)/1.055)^2.4`. `L = 0.2126·R + 0.7152·G + 0.0722·B`. Ratio = `(L_light + 0.05) / (L_dark + 0.05)`, rounded to 2 dp. Computed in Python; every pair below is **opaque over opaque** — there is no alpha compositing anywhere in this system, which is itself a design decision (§6.1). Decimal comma below, per the UI locale.

### 2.1 The wordmark problem, solved rather than tolerated

`AKVA #00008C` + `TERM #d6252e` is a **pure blue at maximum saturation next to a pure red at maximum saturation**. Every palette that adds a *third* saturated hue — the current Iris teal `#0D707D`, and then the violet dock `#8958F4` on top of it — makes the wordmark look like a fourth participant in an argument.

**So the whole product uses exactly two hues, and they are the wordmark's own two.**

- **Blue = structure.** Everything actionable, selected, or live is `--accent #2B4CC0`. Its hue is 227°; the logo navy is 240°. The wordmark is not a foreign object on the page — it is the *terminus* of the interface's own blue axis, the same hue family taken to full saturation and maximum darkness. Nothing else on the page is allowed to be that dark or that saturated, which is what makes it read as a mark.
- **Red = stop.** `--danger #B3261D` is the only other hue in the system, and it appears only on destructive controls and on an over‑budget figure. The logo's red is the same idea at full strength.
- **Everything else is a cool near‑neutral** derived from the same blue axis (all greys sit at hue ≈ 222°, saturation ≤ 8 %), so nothing competes.

That is the argument: **the interface is not "compatible with" the logo, it is the logo desaturated.**

**And in dark mode the wordmark is not recoloured at all — it gets a plaque.** `css/styles.css:747–752`, which repaints `AKVA` to `--ink`, is **deleted**. `#00008C` on `#1C1E23` measures **1,09:1** — invisible — so instead of restyling an exempt asset, `.wordmark` receives `background: var(--plaque) #F2F2F2; padding: 5px 10px; border-radius: 10px;` (32 px tall inside the 58 px `--topbar-h`). On that plaque the mark performs identically to light mode: **navy 13,61:1, red 4,51:1**. Same rule on the splash. This is the only white object in the dark UI, which is correct — it is the only thing that isn't ours to change.

### 2.2 Tokens — light

| token | hex | role |
|---|---|---|
| `--paper` | `#F3F4F6` | page ground |
| `--surface` | `#FFFFFF` | cards, ledger, rows, top bar |
| `--panel` | `#E9EBEF` | recessed wells, input fields, table head |
| `--readout` | `#171A1F` | **the measurement plate — identical in both themes** |
| `--ink` | `#16181D` | primary text, all figures |
| `--ink-2` | `#3A3F49` | secondary text |
| `--muted` | `#5D6472` | meta, units, labels |
| `--line` | `#D5DAE2` | decorative hairline (no contrast duty) |
| `--line-strong` | `#7F8798` | control borders, input rims (3:1 duty) |
| `--accent` | `#2B4CC0` | links, selected, primary fill, focus ring |
| `--accent-press` | `#1E3A93` | pressed / hover fill |
| `--accent-tint` | `#E6EAF8` | selected row wash, chip active bg |
| `--accent-lg` | `#5C7BE8` | **large/UI only, never body text** |
| `--danger` | `#B3261D` | destructive, over budget |
| `--ok` | `#14713F` | saved, in stock |
| `--warn-ink` | `#7E4A06` | the reserve allowance, and nothing else |
| `--plaque` | `#F2F2F2` | wordmark ground (dark only) |
| `--logo-navy` / `--logo-red` | `#00008C` / `#d6252e` | **EXEMPT — never restyled, never re‑pointed** |

### 2.3 Tokens — dark

The shipped greys are good and I am not repainting them. `--paper #1C1E23`, `--surface #25282E`, `--panel #31353C`, `--panel-2 #2A2E34`, `--ink #F1F2F4`, `--ink-2 #C9CDD4`, `--muted #A3A9B3` all stay exactly as `css/styles.css:625–626` ships them. What I add is the set the dark blocks never defined — which is the entire cause of weakness D.

| token | hex | note |
|---|---|---|
| `--readout` | `#101215` | one step below paper, so the plate still reads as inset |
| `--line` | `#3A3F47` | opaque, replaces `rgba(241,242,244,.13)` |
| `--line-strong` | `#8A92A0` | opaque, replaces `rgba(241,242,244,.32)` |
| `--accent` | `#9EB8FF` | |
| `--accent-press` | `#C2D2FF` | dark theme brightens on press, it does not darken |
| `--accent-tint` | `#1F2740` | |
| `--accent-lg` | `#7B95E0` | |
| `--on-accent` | `#0F1218` | text on a filled accent button |
| `--danger` | `#FF9A8C` | |
| `--ok` | `#6FD79A` | kept from the shipped set |
| `--warn-ink` | `#F0B860` | kept from the shipped set |

**Critical implementation note:** these are declared **once**, in a `[data-theme]`‑agnostic custom‑property block, and both `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` **and** `:root[data-theme="dark"]` include it via the same declaration list. Weakness E exists purely because those two selectors carry different payloads. One list, two selectors, no drift. Same for light.

### 2.4 Contrast ledger — LIGHT (all computed)

| pair | fg | bg | ratio | required |
|---|---|---|---:|---:|
| body text on page | `#16181D` | `#F3F4F6` | **16,14** | 4,5 |
| body text on card | `#16181D` | `#FFFFFF` | **17,76** | 4,5 |
| body text on well | `#16181D` | `#E9EBEF` | **14,88** | 4,5 |
| secondary text | `#3A3F49` | `#FFFFFF` | **10,57** | 4,5 |
| meta / units on card | `#5D6472` | `#FFFFFF` | **5,95** | 4,5 |
| meta on page | `#5D6472` | `#F3F4F6` | **5,40** | 4,5 |
| meta on well | `#5D6472` | `#E9EBEF` | **4,98** | 4,5 |
| link / selected | `#2B4CC0` | `#FFFFFF` | **7,25** | 4,5 |
| link on page | `#2B4CC0` | `#F3F4F6` | **6,59** | 4,5 |
| link on tint | `#2B4CC0` | `#E6EAF8` | **6,04** | 4,5 |
| white on primary pill | `#FFFFFF` | `#2B4CC0` | **7,25** | 4,5 |
| white on pressed pill | `#FFFFFF` | `#1E3A93` | **10,09** | 4,5 |
| destructive text | `#B3261D` | `#FFFFFF` | **6,54** | 4,5 |
| white on destructive fill | `#FFFFFF` | `#B3261D` | **6,54** | 4,5 |
| ok text | `#14713F` | `#FFFFFF` | **6,06** | 4,5 |
| reserve note | `#7E4A06` | `#FFFFFF` | **7,32** | 4,5 |
| control border | `#7F8798` | `#FFFFFF` | **3,61** | 3,0 |
| control border on page | `#7F8798` | `#F3F4F6` | **3,28** | 3,0 |
| control border on well | `#7F8798` | `#E9EBEF` | **3,02** | 3,0 |
| focus ring | `#2B4CC0` | `#F3F4F6` | **6,59** | 3,0 |
| large‑only blue | `#5C7BE8` | `#FFFFFF` | **3,85** | 3,0 |
| **readout figure** | `#FFFFFF` | `#171A1F` | **17,44** | 4,5 |
| readout label | `#A6AEBC` | `#171A1F` | **7,81** | 4,5 |
| readout accent figure | `#A8C0FF` | `#171A1F` | **9,68** | 4,5 |
| readout ok | `#6FD79A` | `#171A1F` | **9,85** | 4,5 |
| readout danger | `#FF9A8C` | `#171A1F` | **8,52** | 4,5 |
| **wordmark AKVA** | `#00008C` | `#FFFFFF` | **15,23** | exempt |
| **wordmark TERM** | `#d6252e` | `#FFFFFF` | **5,04** | exempt |

### 2.5 Contrast ledger — DARK (all computed)

| pair | fg | bg | ratio | required |
|---|---|---|---:|---:|
| body on page | `#F1F2F4` | `#1C1E23` | **14,89** | 4,5 |
| body on card | `#F1F2F4` | `#25282E` | **13,19** | 4,5 |
| body on well | `#F1F2F4` | `#31353C` | **10,99** | 4,5 |
| secondary | `#C9CDD4` | `#25282E` | **9,26** | 4,5 |
| meta on card | `#A3A9B3` | `#25282E` | **6,25** | 4,5 |
| meta on page | `#A3A9B3` | `#1C1E23` | **7,05** | 4,5 |
| meta on well | `#A3A9B3` | `#31353C` | **5,21** | 4,5 |
| link / selected | `#9EB8FF` | `#25282E` | **7,56** | 4,5 |
| link on page | `#9EB8FF` | `#1C1E23` | **8,54** | 4,5 |
| link on tint | `#9EB8FF` | `#1F2740` | **7,56** | 4,5 |
| ink on primary pill | `#0F1218` | `#9EB8FF` | **9,60** | 4,5 |
| destructive text | `#FF9A8C` | `#25282E` | **7,21** | 4,5 |
| ink on destructive fill | `#0F1218` | `#FF9A8C` | **9,15** | 4,5 |
| ok text | `#6FD79A` | `#25282E` | **8,34** | 4,5 |
| reserve note | `#F0B860` | `#25282E` | **8,25** | 4,5 |
| control border | `#8A92A0` | `#25282E` | **4,71** | 3,0 |
| control border on page | `#8A92A0` | `#1C1E23` | **5,32** | 3,0 |
| control border on well | `#8A92A0` | `#31353C` | **3,93** | 3,0 |
| focus ring | `#9EB8FF` | `#1C1E23` | **8,54** | 3,0 |
| **readout figure** | `#FFFFFF` | `#101215` | **18,76** | 4,5 |
| readout label | `#A6AEBC` | `#101215` | **8,40** | 4,5 |
| readout accent figure | `#A8C0FF` | `#101215` | **10,41** | 4,5 |
| **wordmark AKVA on plaque** | `#00008C` | `#F2F2F2` | **13,61** | exempt |
| **wordmark TERM on plaque** | `#d6252e` | `#F2F2F2` | **4,51** | exempt |
| plaque edge vs page | `#F2F2F2` | `#1C1E23` | **14,90** | 3,0 |

**Every one of the seven failures in brief §5D is repaired by construction**, because the four tokens that failed (`--teal-700`, `--mauve-600`, `--amber-ink`, `--sky-200`) no longer exist as text carriers: teal is gone, mauve is replaced by `--muted` which *is* overridden in dark, amber survives only as `--warn-ink` which *is* overridden, and `--sky-200` is deleted entirely (§6.3).

### 2.6 Type scale — same two faces, inverted priorities

Sora and Inter stay. What changes is **who gets the big size.** Today `js/views/katalog.js` spends 48 px of Sora on the word "Katalog" and 15 px on the price. That is backwards for an instrument.

```
--t-readout : 700 Inter, clamp(2.25rem, 6vw, 3.25rem)  36–52px, tnum, -0.02em
--t-num-md  : 700 Inter, 1.375rem  22px, tnum
--t-num-sm  : 600 Inter, 0.9375rem 15px, tnum        ← every price, every m²
--t-h1      : 600 Sora,  clamp(1.5rem, 2.6vw, 1.875rem) 24–30px, -0.02em
--t-h2      : 600 Sora,  1.125rem 18px
--t-title   : 600 Inter, 1.0625rem 17px              ← product names (unchanged)
--t-body    : 400 Inter, 0.9375rem/1.6 15px          ← unchanged
--t-meta    : 500 Inter, 0.75rem  12px, uppercase, .08em ← unchanged
--t-unit    : 500 Inter, 0.75rem  12px, --muted      ← NEW: "m²", "€/m²", "kom"
```

**Rule: every numeral in the product is Inter with `font-variant-numeric: tabular-nums`.** Sora appears only in the wordmark's neighbours, `h1`, and `h2`. A column of prices that jitters is an instrument that lies about being precise.

**Radius re‑assignment** (ladder unchanged, per `docs/HOUSE_STANDARD.md`): readout & cards `--r-lg 22` (down from 28), rows and stat tiles `--r-md 16`, swatches `--r-xs 8`, pills `--r-pill`, bottom sheet keeps `--r-2xl 34`. Concentric rule holds: 40 px swatch inset 12 px inside a `--r-lg 22` card → 22 − 12 = 10 → nearest rung down = 8.

---

## 3. THE DASHBOARD — `#/`, new view `js/views/ploca.js`

Container `#main`, `--maxw 1180px`, padding `18px 16px` mobile / `26px 24px 44px` ≥720 (unchanged from `css/styles.css:1163`). At ≥1024 it becomes a 12‑column grid, 24 px gutters: **main column 8, right rail 4** (rail `position: sticky; top: calc(var(--topbar-h) + 24px)`). Below 1024 the rail's contents fall into the single column between elements 4 and 6.

`js/app.js:810` currently redirects a cold start with no hash to `#/prijava`. **Change it to `#/`.** There is no auth gate on any route (`js/app.js:13–18`); making the first screen a sign‑in wall for an app that works signed out is the single worst thing on the current cold path.

### 0 · Top bar — 58 px, opaque

`background: var(--surface)`, `border-bottom: 1px solid var(--line)`, **no `backdrop-filter`**. Left: 44 px burger. Centre‑left: the wordmark (plaque in dark, §2.1). Right: 44 px search toggle, 44 px theme toggle. At ≥1024 the search becomes an inline 320 px `.akv-field` in the bar itself and the toggle disappears.

### 1 · `.akv-status` — the state line · 32 px, full width

12 px `--t-meta`, `--muted`, one line, `text-overflow: ellipsis`.

> `KUPAONICA · 2,60 × 2,80 × 2,60 M · 3 PLOHE · IZMIJENJENO DANAS U 14:20`

Room dims from `data/scenes.js:158`; timestamp from `akv:diz-draft`. **With no draft it does not vanish** — it reads `NEMA ZAPOČETOG PROJEKTA · ODABERITE PROSTOR`. The current `.akv-resume` block disappearing on a first visit is why the landing page collapses to "a heading and six cards" (§5A); this element and the two below it **always render**, only their data changes.

*Why it earns its place:* an instrument states what it is measuring before it shows a value.

### 2 · `.akv-readout` — the measurement plate · full main‑column width, max 760 px, 132 px tall

`background: var(--readout)`, `--r-lg 22`, padding `20px 24px`. Dark in **both** themes — this is the one component that does not flip, which is exactly what makes it read as a display rather than a card.

- Label, 12 px `--t-meta`, `#A6AEBC` (7,81:1 / 8,40:1): `PROCJENA MATERIJALA`
- Figure, `--t-readout` white (17,44:1 / 18,76:1): **`742,87 €`**
- Qualifier, 13 px `#A6AEBC`: `23,46 m² s rezervom · 21,32 m² neto`
- Right‑aligned tag `.akv-tag`, 22 px pill, 11 px, 1 px `#A6AEBC` rim: `PROCJENA, NE PONUDA`

**That figure is real arithmetic against the shipped seed and the shipped geometry**, not a mock: three surfaces from `data/scenes.js:178–182`, areas from `js/scene3d.js:194–213`, reserve from `js/domain.js:198–199`, prices from `catalog.seed.json`. Derivation in element 3.

*Why it earns its place:* live price against real 3D geometry is the one thing this app does that no competitor site does (`js/views/dizajner.js` + `listSurfaces().areaM2`). It goes first, at 52 px, and it looks like a meter.

### 3 · `.akv-ledger` — the surface table · `--surface`, `--r-lg 22`, 1 px `--line`

Header 36 px, `--t-meta`, `--muted`: `PLOHA · POVRŠINA · PROIZVOD · CIJENA · IZNOS`. Rows 64 px, `--line` hairline between, last three columns right‑aligned tabular.

| PLOHA | POVRŠINA | PROIZVOD | CIJENA | IZNOS |
|---|---:|---|---:|---:|
| Pod | 7,28 m² | ▨ Travertin Classico · 610×406 | 47,50 €/m² | **380,48 €** |
| Lijevi zid | 7,28 m² | ▨ Jadran Plava · 200×200 | 24,90 €/m² | **199,45 €** |
| Desni zid | 6,76 m² | ▨ Dalmacija Bijela · 250×400 | 21,90 €/m² | **162,94 €** |
| — | — | **Rezerva 10 % (mreža)** | — | *+2,14 m²* |
| — | **21,32 m²** | **Ukupno** | — | **742,87 €** |

Arithmetic, exactly as `js/domain.js:193` computes it: `round2(7.28 × 1.10) = 8.01` → `8.01 × 47.50 = 380.475 → 380,48 €`; `8.01 × 24.90 = 199.449 → 199,45 €`; `round2(6.76 × 1.10) = 7.44` → `7.44 × 21.90 = 162.936 → 162,94 €`. Sum **742,87 €**. Switch the floor to *riblja kost* and the reserve row flips to `Rezerva 15 % (riblja kost)`, the floor becomes `8,37 m² → 397,58 €`, and the total moves **+17,10 €** — visibly, in the readout, in 160 ms. Switch the floor to Carrara Bianco at 54,90 €/m² and it moves **+59,27 €**.

The `▨` is a **40 × 40 procedural swatch**, `--r-xs 8`, from `swatchDataUrl(product, 96)` in `js/texture.js`. It is the only imagery in the row and it is generated, not photographed.

Each row is a link into `#/dizajner` with that surface pre‑selected. Mobile ≤719: rows collapse to 72 px stacked — swatch + product name + area on line one, price and amount right‑aligned on line two.

*Why it earns its place:* this is the artefact the buyer actually carries to Bokeljska 12. The 10 %/15 % reserve is a tiler's waste allowance that no shopping site shows and that this codebase already computes — putting it on the first screen is the strongest single statement that this app was built by people who install things.

*Honest gap:* `js/domain.js:201–202` already computes `boxes` from `boxM2`, and **not one of the 46 seed records carries that field** — I checked all 46. Adding one number per tile turns the ledger row into `8,01 m² · 7 kutija`, which is the unit an installer actually orders in. That is a data task, not a design task, and I am flagging it rather than drawing a number that cannot be sourced.

### 4 · `.akv-bar` — the action row · 54 px pills, gap 12

Per `docs/HOUSE_STANDARD.md` (52–54 px), correcting the catalogue's current 44 px.

- **`Nastavi dizajn`** — primary, `--accent` fill, `#FFFFFF` (7,25:1) / dark `--on-accent` (9,60:1) → `#/dizajner`
- **`Pošalji upit`** — secondary, `--surface` + 1 px `--line-strong` (3,61:1) → the existing `mailto:` at `js/views/dizajner.js:1498`, `QUOTE_EMAIL = "info@akvaterm.hr"`
- **⧉** — 54 × 54 icon‑only, share/QR via `js/qrshare.js`

≥720 inline; ≤719 the primary is full width and the other two split 50/50 below it.

### 5 · `.akv-frame` — the room · 4:3, right rail (≥1024) / after element 4 (below)

`renderSceneThumbnail(canvas, "kupaonica", assignments, products)` from `js/scene3d.js` at 640 × 480, displayed up to 380 px wide, `--r-lg 22`. Beneath it, four 44 px `.akv-chip`s: `Kupaonica` · `Mala kupaonica` · `Kuhinja` · `Svi prostori (5)`. Selecting one re‑renders the frame, the ledger and the readout together.

*Why it earns its place:* it is the proof that the numbers are attached to a room and not to a spreadsheet. It is a gauge face, not a photograph — and it is the only kind of imagery this repo can honestly produce.

### 6 · `.akv-stat` row — four tiles · `auto-fit minmax(150px, 1fr)`, gap 12, 92 px

`--surface`, `--r-md 16`, 1 px `--line`. Figure `--t-num-md` 22 px `--ink`; label 12 px `--t-meta` `--muted`.

`21,32 m²` / POVRŠINA PLOHA · `3` / PLOHE · `7` / FAVORITI → `#/favoriti` · `2` / SPREMLJENI DIZAJNI → `#/dizajni`

Counts from `js/db.js:335` (`akv:fav`) and `js/views/dizajni.js`. The two with destinations carry the row‑link affordance; the two without do not.

### 7 · `.akv-field` — search · 54 px, `--panel`, `--r-pill`, 1 px `--line-strong`

Placeholder uses the **existing** key `katalog.search` → *"Pretraži proizvode…"* (`js/i18n.js:71`). 120 ms debounce onto `listProducts()` (`js/db.js:317`) with its diacritic folding. Result count under the field via the **existing** `katalog.results` → *"{n} proizvoda"*. Results render as up to 8 `.akv-row`s, then `Prikaži sve rezultate`.

*Why it earns its place:* three dictionary strings and a working folded‑search function exist in the repo and **nothing calls them** (§5C). This is the cheapest large win in the codebase and its absence is the loudest signal that the current page is a brochure.

### 8 · `.akv-catrow` — the assortment · one list, five 72 px rows, `--surface`, `--r-lg 22`

Replaces the five colour‑washed emoji tiles entirely.

| | | |
|---|---|---|
| ▨▨▨ | **Keramika** · 23 proizvoda | 19,50 – 64,50 €/m² |
| ▮▮▮ | **Sanitarije** · 7 proizvoda | 59 – 329 € |
| ▮▮▮ | **Armature** · 5 proizvoda | 89 – 249 € |
| ▮▮▮ | **Grijanje** · 6 proizvoda | 159 – 6.490 € |
| ▮▮▮ | **Klimatizacija** · 5 proizvoda | 599 – 1.190 € |

Keramika's image is **three overlapping 64 px procedural swatches** (Carrara Bianco `marble`, Hrast Natur `woodPlank`, Heksagon Siva `hexMosaic` — three different generators, so the strip advertises the texture engine), `--r-xs 8`, −10 px overlap, in a 56 × 40 box. The four non‑tile categories get **three stacked 12 px bars drawn from the real `baseColorHex` values in the seed** — sanitarije `#f6f5f2 / #e9e8e6 / #4b4b4d`, armature `#c8c9cc / #2f2f31 / #b9bcbe`, grijanje `#f2f1ed / #d9d7d2 / #dcdcda`, klima `#f4f4f2 / #f3f3f1 / #3c3c3e`. Real data, zero emoji, zero invention.

Ranges are computed at render from `priceM2` / `priceUnit`, not hardcoded.

*Why it earns its place:* the price range is the single most useful fact about a category and the current 132 px tile shows none of it. And 23 vs 5 is meaningful information that a grid of five equal rectangles actively hides — a list ranks, a grid pretends everything is equal.

### 9 · `.akv-fav` strip — conditional

Only when `akv:fav` is non‑empty: `auto-fit minmax(160px, 1fr)`, 84 px 1:1 swatch + name + price. Empty state is **one line**, not an empty‑state illustration: *"Spremite favorit dodirom na ♡ u katalogu."*

### 10 · Demo notice — bottom, 40 px, one line

`border-top: 1px solid var(--line)`, 12 px `--muted` on `--paper` (5,40:1 light / 7,05:1 dark).

> `DEMO · Proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda. Akvaterm d.o.o., Bokeljska 12, Dubrovnik.`

The current version is a `#C0D8F2` slab carrying `#F1F2F4` at **1,31:1** in dark. Here it is a footnote, which is what a permanent disclaimer should be — present, legible, and not shouting at someone who has already read it forty times.

### First run — same components, different data

No draft, no favourites. `.akv-status` reads `NEMA ZAPOČETOG PROJEKTA`. `.akv-readout` shows `—` with the label `ODABERITE PROSTOR ZA PROCJENU`. **`.akv-ledger` becomes the room picker** — five 64 px rows with real dimensions from `data/scenes.js`: `Kupaonica · 2,60 × 2,80 m · 7,28 m²`, `Mala kupaonica · 1,80 × 2,40 m · 4,32 m²`, then Kuhinja, Dnevni boravak and WC from the same file. `.akv-bar`'s primary becomes `Otvorite prostor`. Elements 6–10 are unchanged.

The dashboard therefore has **no state in which it is fewer than eight populated blocks**, which is the direct answer to §5A.

### New dictionary keys — `js/i18n.js`

The nine bypassing strings (§5H) plus this view's. Add: `ploca.status.empty` "Nema započetog projekta · odaberite prostor", `ploca.readout.label` "Procjena materijala", `ploca.readout.empty` "Odaberite prostor za procjenu", `ploca.tag.estimate` "Procjena, ne ponuda", `ploca.net` "{n} m² neto", `ploca.withReserve` "{n} m² s rezervom", `ploca.reserve` "Rezerva {p} % ({pattern})", `ploca.total` "Ukupno", `ploca.cta.continue` "Nastavi dizajn", `ploca.cta.open` "Otvorite prostor", `ploca.cta.quote` "Pošalji upit", `ploca.stat.area` "Površina ploha", `ploca.stat.surfaces` "Plohe", `ploca.stat.favourites` "Favoriti", `ploca.stat.designs` "Spremljeni dizajni", `ploca.assortment` "Asortiman", `ploca.demo` "Demo · proizvodi i cijene su ogledni podaci…", `kat.clearFilters` "Očisti ({n})", plus `scene.mala-kupaonica` "Mala kupaonica" and `scene.wc` "WC".

---

## 4. THE PAGE SYSTEM

Twelve components. Every screen is assembled from them; nothing is bespoke.

| component | what it is | where it repeats |
|---|---|---|
| `.akv-readout` | dark measurement plate, one big figure | dashboard, dizajner (pinned above the bar), proizvod (unit price + estimate for the open room), soba3d (floor area), dizajni card |
| `.akv-ledger` | header + rows + total, tabular right‑aligned | dashboard, dizajner right panel (**this replaces the current surface list**), proizvod spec table, quote preview before `mailto:`, dizajni expanded |
| `.akv-row` / `.akv-rowlink` | 64 px: swatch, title, meta, right figure, 44 px ♡ | catalogue (default view), search results, favourites, saved designs, category list, room picker |
| `.akv-swatch` | procedural square, `--r-xs 8`, 40/64/84/1:1 | everywhere a product appears |
| `.akv-frame` | 4:3 WebGL still, `--r-lg 22` | dashboard rail, dizajni cards, soba3d preview, share preview |
| `.akv-stat` | 92 px tile: figure + meta label | dashboard, dizajner, soba3d |
| `.akv-seg` | segmented control, 44 px, `--r-pill` | uzorak (4), fuga (3), catalogue list/grid, sort |
| `.akv-chip` | 44 px filter pill with live count | catalogue filters, room switcher |
| `.akv-bar` | sticky 54 px action row, 1–3 controls | every workspace |
| `.akv-field` | 54 px input | search, room dimensions, quote form |
| `.akv-tag` | 22 px outline label | `DEMO`, `PROCJENA`, `AI IMPRESIJA`, `CC-BY 3.0` |
| `.akv-sheet` | bottom sheet, `--r-2xl 34` top corners | product drawer in dizajner, filters on mobile |

**Catalogue (`#/katalog`, `#/katalog/:id`)** — defaults to **`.akv-row` list**, not cards, with an `.akv-seg` list/grid toggle persisted to `localStorage`. Row: 40 px swatch, name 17/600, `MARMO VIVO · 600×1200 MM` meta, price right in `--t-num-sm`, ♡ 44 px. Grid mode keeps a card but a plain opaque one (§6.1) with a 1:1 swatch and no emoji stamp. The existing four chip rows stay (Format sorted by real tile area — keep that, it is correct). **Added:** sort `.akv-seg` — `Cijena ↑ · Cijena ↓ · Naziv · Format`; and a price band chip row using the existing `katalog.filter.price` key — for keramika `19–30 · 30–45 · 45–65 €/m²`, computed from the actual min/max per category, not fixed.

**Product (`#/proizvod/:id`)** — `.akv-swatch` at 1:1 up to 420 px (for a tile, `buildPatternCell()` at true scale with the currently selected grout, so you see the *laid* material, not a chip); `.akv-readout` carrying `54,90 €/m²` and, when a room is open, `→ 8,01 m² · 439,75 € za pod kupaonice`; `.akv-ledger` as the spec table (Marka, Format, Površina, Sjaj, Šifra); `.akv-bar` = `Primijeni u dizajneru` / `♡ Spremi`. The `.akv-inq` box at `js/views/proizvod.js:159` stays, restyled as `--panel`.

**Dizajner** — the readout pins above the bar; the surface list becomes `.akv-ledger` so the price breakdown is identical to the dashboard's; uzorak and fuga are `.akv-seg`s; the product drawer is `.akv-sheet`. A/B compare, the wipe, the coach mark and the draft all survive untouched.

**3D soba** — `.akv-stat` row (dimenzije, površina poda, broj elemenata), `.akv-field` × 3 for W/D/H, `.akv-sheet` for the 27 fixture types, same `.akv-bar`.

**Dizajni** — each card is `.akv-frame` + one `.akv-readout` at half scale + a one‑line ledger summary (`3 plohe · 23,46 m² · 742,87 €`). Two‑step delete keeps its `--danger`.

---

## 5. MOTION

Opacity and transform only. Existing easings, existing durations, no new tokens.

| what | property | duration | curve |
|---|---|---|---|
| view enter (`#main` children) | `opacity 0→1`, `translateY(8px→0)` | **260 ms** | `--snap (.22,1,.36,1)` |
| ↳ stagger | 40 ms per child, **capped at 5 steps** (200 ms tail), `fill-mode: backwards` | | |
| **readout figure changes** | `opacity 1→0.4→1` | **160 ms** | `--smooth (.25,1,.5,1)` |
| ledger/row hover+focus | `::before` 2 px accent rule, `transform: scaleY(0→1)`, origin centre | 160 ms | `--snap` |
| any pill / row press | `transform: scale(.985)` | 120 ms | `--snap` |
| swatch hydration | `opacity 0→1` per swatch as `swatchDataUrl` resolves | 180 ms | `--smooth` |
| `.akv-frame` first paint | `opacity 0→1` | 320 ms | `--smooth` |
| drawer panel | `translateX(-100%→0)` | 280 ms open / 220 ms close | `--snap` |
| drawer scrim | `opacity 0→1` | 200 ms | `--smooth` |
| `.akv-sheet` | `translateY(100%→0)` | 300 ms | `--snap` |
| chip toggle | **nothing on the chip** — the result count does the 160 ms opacity dip | | |
| theme flip | **0 ms, no transition** | | |

Entrance drops from 12 px/420 ms to 8 px/260 ms because an instrument should feel *already settled* when you look at it, not still arriving. The stagger cap stays at 5 (the current cap of 8 puts the last card 208 ms behind the first, which on a 23‑item grid reads as loading, not choreography).

**The chip rule is the thesis of this section.** When you toggle a filter or change a pattern, the control does not animate — **the number does.** Feedback belongs to the value that changed, not to the thing you touched, because you already know you touched it. That single rule is what makes the app feel like a measuring device.

**No transition on theme flip** is deliberate: a 300 ms crossfade across a full repaint is the one animation that always looks broken, and `js/app.js:430` re‑tints `<meta theme-color>` instantaneously anyway, so a transition guarantees a visible mismatch between chrome and page.

`prefers-reduced-motion: reduce` — all `transform` transitions removed entirely; opacity fades clamped to 120 ms; stagger delays zeroed. The before/after wipe in the Dizajner keeps its `clip-path`, and this is not a violation: it is **drag‑driven with no `transition` property at all** — the user's finger is the timing function.

---

## 6. WHAT I AM DELIBERATELY NOT DOING

**6.1 No glass on any content surface.** `backdrop-filter` is already `none` on `.akv-pcard` "for budget", which means the current card is glass in name only — a full‑bleed texture glued to an opaque `--surface` scrim (§5J). I remove the pretence: cards, rows, ledgers and the top bar are opaque. This deletes five degradation paths, the entire `--glass-bg-text/-strong/-deco` / `--glass-solid` / `--glass-ink` / `--*-on-glass` composite ladder, and with it the near‑white‑pane bug at `css/styles.css:664–672` — **weakness E cannot recur if there is no composited surface to get wrong.** The glass tokens survive only on the drawer scrim.

**6.2 No emoji, anywhere.** 🧱🚿🚰🔥❄️📦 and the 46 px emoji stamped over every non‑tile swatch are gone. A system emoji is a different typeface, a different metric, and a different rendering on every OS — it is the one graphic in this app that Akvaterm does not control. Replaced by real `baseColorHex` bars and real procedural swatches.

**6.3 No category colour washes and no `--sky-200`.** Five pale rectangles carrying `--ink` only, because every accent fails on them (§5F), is a hierarchy that has already surrendered. Categories are distinguished by **count and price range**, which is information, not by tint, which is not. `--sky-200 #C0D8F2` is deleted from the token set — it is the source of the 1,31:1 dark failure and it has no job left.

**6.4 No teal, and no third accent.** `--teal-600/-700/-800`, `--mauve-400`, `--amber-500` and `--brown-800` retire. For one release `--teal-700: var(--accent)` and `--mauve-600: var(--muted)` stay as aliases so nothing in the 1 184 lines of `js/views/katalog.js` breaks mid‑migration; then they are deleted. **The violet AI dock loses its floating tab** — `#8958F4` / `#2A1D50` is a fourth and fifth colour on a screen that already carries navy, red and blue. The Savjetnik becomes a normal drawer entry plus a 44 px top‑bar button on `#/savjetnik` only. A feature that has to be "deliberately off the palette" to be noticed is a feature the layout failed to place.

**6.5 No hero, no lifestyle photography, no AI staging on the dashboard.** There is no photography in the repo and none may be assumed. The dashboard's imagery is one WebGL still of a room the user actually configured and a handful of swatches of tiles that actually exist. "AI impresija" stays exactly where it is — paid tier, explicit click, labelled (`js/views/savjetnik.js`) — and never on the first screen.

**6.6 No count‑up numbers, no odometers, no shimmer skeletons, no parallax, no lift‑on‑hover for rows.** A figure that animates from 0 to 742,87 € is a figure you cannot read for 600 ms. The sweep placeholder on the resume canvas becomes a static `--panel` block.

**6.7 No sync UI, and no sign‑in wall.** `js/db.js:437 mirror()` is fire‑and‑forget write‑only; nothing reads back. So there is no cloud icon, no "sinkronizirano" state, no device list — signing in changes one menu label, and the interface will say nothing more than that until it is true. I am also moving the cold‑start redirect off `#/prijava` (§3).

**6.8 No pagination and no infinite scroll.** 23 keramika rows is not a scale problem; it is a *sort* problem. Sort, search and price bands, then the list ends.

**6.9 No new typeface, no new radius rung, no new easing, no new duration, no dependency, no CDN.** The scale changes, the ladder does not. `script-src 'self'` stays intact.

**6.10 No recolouring of the wordmark, in any theme, for any reason.** This is the one refusal that requires *deleting shipped code*: `css/styles.css:747–752` currently repaints `AKVA` to `--ink` in dark. That rule goes; the plaque replaces it (§2.1). I would rather introduce the only white rectangle in the dark UI than restyle an asset that is not mine.

**6.11 No decorative gradient in the splash.** The teal→amber "water into heat" rule at `css/styles.css:761–773` becomes a single 2 px `--accent` hairline drawing left to right over the same 0,28–0,88 s window. Same choreography, one colour. The gradient encoded a palette that no longer exists.

**6.12 I am not calling the documentation drift a design problem.** But nothing here ships until `README.md:54` and `docs/DESIGN_SYSTEM.md §Typography` stop saying Anton + Figtree, `README.md:153` stops saying 25 GLB files when there are 61, `js/views/zasluge.js`'s CC‑BY 3.0 note for `radiator-panel.glb` and `ac-indoor-split.glb` is reflected in the README's CC0 claim, the "ANTON METRIC HAZARD" block at `js/views/katalog.js:148` is removed, and the dead warm‑brown contrast ledger at `css/styles.css:606–616` is replaced by §2.4–2.5 above. A design system whose own documentation names the wrong fonts is not a system.

---

**One sentence to be judged on:** every other direction will make this catalogue beautiful; this one makes it *tell you the answer* — 742,87 €, 23,46 m² with the tiler's reserve already in it, on a real 2,60 × 2,80 m bathroom, in the first 132 pixels below the wordmark.

===== ? =====
# BISKVIT
### The material lens — Akvaterm, design panel submission

---

## 1. THE IDEA

**Akvaterm is a sample drawer you can open on your phone: you pull a tile out, hold it against the light, set it down on a floor, and the floor tells you what it costs.** Everything on screen is either a piece of material or a label under a piece of material — the interface itself is unglazed, uncoloured and quiet, so that the only saturated things in the entire app are the goods and the fired stamp on the door.

---

## 2. THE PALETTE

### 2.1 How it was derived — and why that is the whole argument

I did not invent a palette. **Every colour below is either sampled verbatim from `data/catalog.seed.json` or derived from a sampled colour by holding hue and dropping lightness** — which is what happens physically when you apply more of the same oxide. An engineer can verify the source of any token with one grep.

| token | source |
|---|---|
| `--nero` `#2E2C2B` | verbatim `ker-03` **Nero Marquina** `baseColorHex` |
| `--mangan` `#4A4A4C` | verbatim `ker-13` **Beton Antracit** `baseColorHex` |
| `--pladanj` `#E7E2D8` | `ker-18` **Terrazzo Veneto** `#d9d4cb`, L +5 % |
| `--uzorak` `#F7F5F0` | `ker-20` **Metro Bijela** `#f4f2ec`, L +2 % |
| `--terakota-500` `#A34632` | verbatim `ker-19` **Terrazzo Rosso** `accentColorHex` |
| `--kadulja-500` `#4E6350` | `ker-10` **Pelješac Kadulja** `#a8b5a0`, L 67→35 % |
| `--oro` `#C9A35A` | verbatim `ker-02` **Calacatta Oro** `accentColorHex` |
| `--fuga-siva` `#9A9A9A` | verbatim `GROUT_COLORS.siva`, `js/domain.js:26` |
| `--kobalt` `#1B2050` | the wordmark navy, halved in chroma — see 2.3 |

### 2.2 Contrast method

WCAG 2.x, sRGB, computed in Python, not estimated:

```
C_lin = C/12.92                     if C_srgb ≤ 0.04045
C_lin = ((C_srgb+0.055)/1.055)^2.4  otherwise
Y     = 0.2126·R + 0.7152·G + 0.0722·B
ratio = (Y_lighter + 0.05) / (Y_darker + 0.05)
```

Relative luminances of the new grounds: `--uzorak` 0.913702, `--pladanj` 0.763395, `--utor` 0.668187, `--nero` 0.025566, `--kobalt` 0.018452. Dark: `--pladanj` 0.012968, `--uzorak` 0.021082, `--utor` 0.035254.

### 2.3 The wordmark problem, solved three ways

AKVA `#00008C` and TERM `#d6252e` are the two most chromatic values that will ever be on screen — RGB span 140 and 177. I solved this by **not competing, by relation, and by giving the mark its own physical object.**

**(a) The chroma budget — measured.** The app is achromatic. Every ground and ink token has an RGB span ≤ 22: `--uzorak` 7, `--pladanj` 15, `--utor` 19, `--nero` 3, `--mangan` 2, `--fuga-mokra` 17, `--rub-jak` 22. Those tokens cover ~92 % of pixels on every route. Only four tokens exceed a span of 70, and their combined budget is **4 % of viewport area**. The wordmark therefore cannot be shouted down, because nothing else on the page is speaking.

**(b) Kinship — the action ink is the same pigment, diluted.** `--kobalt` `#1B2050` = hsl(234, 50 %, 21 %). The wordmark navy = hsl(240, 100 %, 27 %). Six degrees of hue apart, half the chroma, slightly darker. This is exactly how cobalt oxide behaves: a thin wash is a dull blue-grey, a thick one goes near-black-violet. The wordmark reads as the app's own ink at full strength, not as a foreign object. **And the wordmark red appears nowhere else, ever.** Destructive actions use `--terakota-700` `#98402C` — hue 11° against the logo red's 357°, span 108 against 177. An iron-oxide brown-red, unmistakably not the logo.

**(c) The plaque — this fixes a shipped bug.** Weakness (E) is real: on `html[data-theme="dark"]` the AKVA half goes near-white on near-white, 1.50:1. My answer is that **the wordmark is never set on a themed ground in either theme.** It sits on `--plocica` `#FAF8F4`, a fired white chip, radius `--r-sm` 12, padding 6 px 10 px, with a 1 px `--rub` inset ring and a 2 px `--rub-jak` bottom edge. It does not theme. It is a glazed tile with a backstamp on it — which is literally what the company sells.

| pair | ratio | needs |
|---|---:|---:|
| `--logo-navy #00008C` on plaque `#FAF8F4` | **14.36:1** | 4.5 |
| `--logo-red #d6252e` on plaque `#FAF8F4` | **4.76:1** | 4.5 |
| plaque `#FAF8F4` on dark `--pladanj #1C1E23` | **15.72:1** | 3.0 (boundary) |

Both themes, one code path, no recolouring, and the mark passes AA as body text rather than surviving on the SC 1.4.3 logotype exemption.

### 2.4 LIGHT — computed

| token | hex | role | pair | ratio | needs |
|---|---|---|---|---:|---:|
| `--plocica` | `#FAF8F4` | plaque, text on primary fill | on `--kobalt` | **14.46:1** | 4.5 |
| `--uzorak` | `#F7F5F0` | sample face — every card | — | — | — |
| `--pladanj` | `#E7E2D8` | the tray — page ground | — | — | — |
| `--utor` | `#DBD5C8` | recessed well, inputs, spec panels | — | — | — |
| `--nero` | `#2E2C2B` | body ink | on `--uzorak` | **12.75:1** | 4.5 |
| | | | on `--pladanj` | **10.76:1** | 4.5 |
| | | | on `--utor` | **9.50:1** | 4.5 |
| `--mangan` | `#4A4A4C` | headings, ink-2 | on `--uzorak` | **8.12:1** | 4.5 |
| | | | on `--pladanj` | **6.85:1** | 4.5 |
| `--fuga-mokra` | `#5D564C` | meta, stamps, secondary | on `--uzorak` | **6.64:1** | 4.5 |
| | | | on `--pladanj` | **5.61:1** | 4.5 |
| | | | on `--utor` | **4.95:1** | 4.5 |
| `--fuga-siva` | `#9A9A9A` | **disabled only** (SC 1.4.3 exempt) | on `--uzorak` | 2.58:1 | — |
| `--rub` | `#C6BEAE` | **decorative hairline only** | on `--uzorak` | 1.69:1 | — |
| `--rub-jak` | `#7F7869` | functional border, input rim | on `--uzorak` | **4.02:1** | 3.0 |
| | | | on `--pladanj` | **3.39:1** | 3.0 |
| | | | on `--utor` | **3.00:1** | 3.0 |
| `--kobalt` | `#1B2050` | action ink, price, focus ring, primary fill | on `--uzorak` | **14.08:1** | 4.5 |
| | | | on `--pladanj` | **11.88:1** | 4.5 |
| | | | on `--utor` | **10.49:1** | 4.5 |
| | | | on `--kobalt-wash` | **11.65:1** | 4.5 |
| `--kobalt-mid` | `#4A5490` | rims, non-text glyphs | on `--uzorak` | **6.51:1** | 3.0 |
| | | | on `--pladanj` | **5.49:1** | 3.0 |
| `--kobalt-wash` | `#DDE0EC` | selection tint | `--nero` on it | **10.55:1** | 4.5 |
| `--terakota-500` | `#A34632` | heat fill, grijanje edge band | `--plocica` on it | **5.69:1** | 4.5 |
| `--terakota-700` | `#98402C` | heat text, destructive, favourite ♥ | on `--uzorak` | **6.21:1** | 4.5 |
| | | | on `--pladanj` | **5.24:1** | 4.5 |
| | | | on `--utor` | **4.63:1** | 4.5 |
| `--terakota-wash` | `#F1E3D9` | grijanje wash | `--nero` on it | **11.07:1** | 4.5 |
| `--kadulja-500` | `#4E6350` | saved/ok fill | — | — | — |
| `--kadulja-700` | `#485C4A` | saved/ok text | on `--uzorak` | **6.63:1** | 4.5 |
| | | | on `--utor` | **4.94:1** | 4.5 |
| | | | on `--kadulja-wash` | **5.82:1** | 4.5 |
| `--kadulja-wash` | `#E4E8DE` | ok wash | `--nero` on it | **11.18:1** | 4.5 |
| `--oro` | `#C9A35A` | **decorative only** — featured hairline | on `--uzorak` | 2.17:1 | — |

### 2.5 DARK — computed

The dark grounds stay neutral, and I will defend that on material grounds rather than overturn commit `44e8ff3`: **a neutral grey surround is the standard condition for appraising material colour** (ISO 3664 specifies exactly this for visual assessment). The dark theme is the light booth. The warm-brown dark that the retired ledger at `css/styles.css:606–616` describes would have tinted every travertine and every marble on screen — it was wrong for this product, and its removal was right.

| token | hex | pair | ratio | needs |
|---|---|---|---:|---:|
| `--pladanj` | `#1C1E23` | page ground | — | — |
| `--uzorak` | `#25282E` | card | — | — |
| `--utor` | `#31353C` | recessed | — | — |
| `--plocica` | `#FAF8F4` | **unchanged** — plaque does not theme | — | — |
| `--nero` | `#F1F2F4` | on `--uzorak` | **13.19:1** | 4.5 |
| | | on `--pladanj` | **14.89:1** | 4.5 |
| | | on `--utor` | **10.99:1** | 4.5 |
| `--mangan` | `#C9CDD4` | on `--uzorak` | **9.26:1** | 4.5 |
| `--fuga-mokra` | `#A3A9B3` | on `--uzorak` | **6.25:1** | 4.5 |
| | | on `--pladanj` | **7.05:1** | 4.5 |
| | | on `--utor` | **5.21:1** | 4.5 |
| `--fuga-siva` | `#737A85` | disabled, on `--uzorak` | 3.41:1 | exempt |
| `--rub` | `#3D424B` | decorative, on `--uzorak` | 1.46:1 | — |
| `--rub-jak` | `#7B818B` | on `--uzorak` | **3.77:1** | 3.0 |
| | | on `--pladanj` | **4.25:1** | 3.0 |
| | | on `--utor` | **3.14:1** | 3.0 |
| `--kobalt` | `#A8B6F2` | on `--uzorak` | **7.48:1** | 4.5 |
| | | on `--pladanj` | **8.45:1** | 4.5 |
| | | on `--utor` | **6.24:1** | 4.5 |
| | | `--pladanj` on it (button) | **8.45:1** | 4.5 |
| `--kobalt-mid` | `#6C7BC4` | rims, on `--uzorak` | **3.71:1** | 3.0 |
| `--kobalt-wash` | `#2B3050` | `--nero` on it | **11.42:1** | 4.5 |
| `--terakota` | `#E58F6E` | on `--uzorak` | **5.97:1** | 4.5 |
| | | on `--pladanj` | **6.74:1** | 4.5 |
| | | `--pladanj` on it | **6.74:1** | 4.5 |
| `--terakota-wash` | `#3A2A24` | `--nero` on it | **12.20:1** | 4.5 |
| `--kadulja` | `#9CC0A2` | on `--uzorak` | **7.37:1** | 4.5 |
| | | on `--pladanj` | **8.32:1** | 4.5 |
| `--kadulja-wash` | `#26332A` | `--nero` on it | **11.80:1** | 4.5 |
| `--oro` | `#DCBB78` | decorative, on `--uzorak` | 8.03:1 | — |

**Every one of the seven measured dark failures in weakness (D) is killed at the token level.** There is no `--teal-700`, no `--amber-ink`, no `--mauve-600`, no `--sky-200` in this system, so the four tokens that produced those failures do not exist to be forgotten. The palette has exactly **one** ink ramp per theme and both themes define every rung — the `:root[data-theme="dark"]` block and the `@media (prefers-color-scheme: dark)` block set an identical list, which is the fix for weakness (E).

### 2.6 Type — same faces, new scale

Sora and Inter, vendored, unchanged. But the scale changes: **type on a material sample is stamped, not headlined.**

- `.t-stamp` — Inter 700, 11 px, uppercase, tracking **.14em** (up from `--track-meta` .08em), `--fuga-mokra`. Brand + format lines, counts, eyebrows, status. This is the signature.
- `.t-display` — Sora 600, `clamp(1.625rem, 3.2vw, 2.25rem)` = **26–36 px** (down from 32–48), tracking −.02em, lh 1.14.
- `.t-section` — Sora 600, `clamp(1.125rem, 2vw, 1.375rem)` = 18–22 px.
- `.t-name` — Inter 600, 17 px / 1.25. Product names.
- `.t-body` — Inter 400, 15 px / 1.6, max-width 62ch.
- `.t-spec` — Inter 500, 13 px / 1.45, `font-variant-numeric: tabular-nums`. Dimensions, m², €.
- `.t-price` — Inter 700, 16 px, tabular, `--kobalt`.
- `.t-button` — Inter 600, 14 px.

Sora appears at most four times per screen. Inter carries the spec sheet. The `ANTON METRIC HAZARD` block at `js/views/katalog.js:148` and the "Anton + Figtree" claims in `README.md:54` / `docs/DESIGN_SYSTEM.md` are deleted in the same pass — they document a face that has not shipped since Sora landed.

---

## 3. THE DASHBOARD — `#/`, top to bottom

Frame stays `--maxw 1180px`, `--topbar-h 58px`, padding 18/16 mobile · 26/24/44 ≥720 px. Nothing here needs a new dependency, a new asset byte, or a network call.

**0 · Top bar, 58 px.** Burger (52 px hit) · **the plaque** — `--plocica` chip carrying AKVA|TERM at 14.36 / 4.76:1, italic 800, `--font-wordmark` · desktop nav · theme switch. The bar itself is solid `--uzorak` with a 1 px `--rub-jak` bottom edge. No glass, no `backdrop-filter`, no `--glass-tint` fork.

**1 · Header, ~120 px.**
- `.t-stamp`: `AKVATERM · DUBROVNIK · OBITELJSKI OBRT OD 1991.` — the one true fact about this client (`docs/RESEARCH.md:26`) and it costs 11 px.
- `h1.t-display`: **"Vaš projekt"**
- `.t-body`, 62ch, `--fuga-mokra` 5.61:1: *"Odaberite uzorak, postavite ga u prostor i vidite cijenu po m² prije nego što zatražite ponudu."*

**2 · Traži, 52 px, sticky under the bar.** A real search input: `--utor` fill, 1 px `--rub-jak` (3.00:1), `--r-pill`, placeholder **"Pretraži proizvode…"** — the string is already at `js/i18n.js:71` and `listProducts()` at `js/db.js:317` already does diacritic-folded Croatian matching. Weakness (C) is fixed with wiring, not code. To its right, four 44 px filter pills: `Sve · Sjajno · Mat · Veliki format` (`glossy`, and `tileSizeMm` area ≥ 0.5 m²). Nothing invented — every filter maps to a field that exists on the records.

**3 · NASTAVITE — conditional on `akv:diz-draft`, ~400 px.** One `Stalak` card at full width. A real 4:3 WebGL still from `renderSceneThumbnail()`, inset 8 px inside a `--r-2xl` 34 card so the image radius is 26 (`r_child = r_parent − inset`, house rule). Under it a `Pult` strip in `.t-spec`:
`KUPAONICA · 2,6 × 2,8 M · POD TRAVERTIN CLASSICO · ZID JADRAN PLAVA · 14,6 m² · ~712 €`
— those are the real `defaultProductId`s from `data/scenes.js` (`pod` = `ker-05`, `zid-lijevi` = `ker-11`), and the € is `orderEstimate()` at `js/domain.js:193`. CTA pill 52 px, `--kobalt` fill, `--plocica` label, **"Nastavi dizajn"**, 14.46:1.

**First visit, no draft: this slot is not empty.** It becomes **"Počnite od prostora"** — three `Stalak` cards (Kupaonica, Kuhinja, Dnevni boravak) rendered from `data/scenes.js` with their stock assignments, snap-scrolling on mobile, 3-up ≥720 px. This is the single most important change on the page: today the Dizajner and the 3D soba — the two things a competitor cannot copy — are reachable **only from the drawer**. From here they are the third thing you see.

**4 · LADICA S UZORCIMA — the signature component, 132 px chips mobile / 148 px ≥720.** A horizontal snap rail. Twelve real chips, in this order: Carrara Bianco, Calacatta Oro, Nero Marquina, Travertin Classico, Travertin Noce, Dalmacija Bijela, Kaštela Bež, Pelješac Kadulja, Beton Antracit, Hrast Natur, Terrazzo Veneto, Heksagon Terakota.

Each chip is `swatchDataUrl(product, 256)` full bleed at `--r-lg` 22, **with nothing on top of it** — no emoji, no scrim, no heart. Then the physical detail that carries the entire direction in three CSS lines: a 1 px `--rub` inset ring plus a **2 px `--rub-jak` bottom edge**, which reads as the unglazed biscuit body seen at a slight angle. Below the chip, on the tray and not on the sample: `.t-stamp` `MARMO VIVO · 600×1200 MM`, `.t-name` "Carrara Bianco", `.t-price` "54,90 €/m²" (14.08:1). The ♡ is a 44 px control **in the label strip**, `--terakota-700` / dark `#E58F6E` — off the material, and the 2.52:1 dark failure disappears with it.

Header row: `.t-section` **"Uzorci"** + `.t-stamp` link **"Svih 46 →"** in `--kobalt`. This replaces six hardcoded `FEATURED_IDS` (`js/views/katalog.js:1040`) — 13 % of the assortment — with a rail that carries all 23 keramika and one honest exit to the rest.

**5 · USPOREDBA — appears only when two chips are selected, ~300 px.** The two swatches at 1:1, **butted with zero gap**, because comparing tiles means looking at the seam. Under them a three-row `Pult` in `.t-spec`, tabular: Format / Završna obrada / Cijena — *"Carrara Bianco · 600×1200 · sjajno · 54,90 €/m²"* against *"Beton Antracit · 750×750 · mat · 39,90 €/m²"*. Ghost pill: **"Primijeni u prostoru"** → Dizajner with the two assigned to `pod` and `zid-lijevi`. The A/B compare already exists inside `js/views/dizajner.js`; this surfaces the same instinct one screen earlier, where the decision actually happens.

**6 · PROSTORI — 5 + 1 cards, `grid auto-fill minmax(240px, 1fr)`, gap 16.** One `Stalak` per scene in `data/scenes.js`: Kupaonica, Mala kupaonica, Kuhinja, Dnevni boravak, WC. Each a 4:3 still, `.t-stamp` under it: `2,6 × 2,8 × 2,6 M · 7 ELEMENATA`. The sixth card has no image — dashed 1.5 px `--rub-jak` on `--utor`, `.t-section` **"Vaš prostor"**, `.t-body` *"Unesite širinu, dubinu i visinu."* → `#/soba3d`. Two of these scene names, `scene.mala-kupaonica` and `scene.wc`, are missing from `js/i18n.js` and render from inline `tf()` fallbacks today (weakness H) — they get added, along with `kat.eyebrow`, `kat.categoryEyebrow`, `kat.clearFilters` and the five `kat.resume*` keys.

**7 · OPREMA — 4 cards, ~200 px, `Stalak` at 3:2.** No emoji. Each category gets a rendered sample stand: a 1,2 m neutral box scene passed to `renderSceneThumbnail(canvas, sceneObject, …)` — which already accepts an arbitrary scene object — with one model and a locked camera on `REF_ASPECT` 4:3.

- **Sanitarije (7)** → `washbasin-vanity.glb` + `toilet-modern.glb`
- **Grijanje (6)** → the procedural radiator primitive from `js/room3d.js`, because `radiator-panel.glb` is CC-BY 3.0 and is deliberately never rendered (`js/views/zasluge.js:6–9`)
- **Klima (5)** → the procedural split-unit primitive, same reason for `ac-indoor-split.glb`
- **Armature (5)** → **the one honest gap.** I checked `vendor/models/`: 61 GLB files, and none of them is a tap. So armature does not get a stand; it gets a **material chip** — the `flat` generator at `#C8C9CC` (verbatim `arm-01` Uno Krom) and `#2F2F31` (verbatim `arm-02` Alta Crna), split on a 12° diagonal, with a CSS `linear-gradient` sheen. It is the only card in the system that shows material instead of an object, and the fix is one CC0 tap model, not a redesign.

Each card carries a 3 px left edge band in that category's own sampled colour — chrome `#C8C9CC`, glazed white `#E9E8E6`, heat `#D8B39D`, cool `#BDC9CC` — and a `.t-stamp` `SANITARIJE · 7 PROIZVODA`. **Keramika is not in this row.** Keramika is the drawer above it. The dashboard's structure says what the business is: one material, four kinds of equipment.

**8 · PROCJENA — a `Pult`, ~120 px.** `--utor` panel, `--r-lg` 22. Three tabular numbers in `.t-price`: `3 spremljena dizajna · 14,6 m² · ~1.284 €`. Under them, `.t-stamp`: `PROCJENA UKLJUČUJE 10 % REZERVE ZA REZANJE`. That reserve is already computed by `orderEstimate()` (15 % for riblja kost and dijagonalno) and today it is invisible. Showing it is the single most credible thing on the page — it is the number a tiler would have written down. Ghost pill 52 px, `--kobalt` outline: **"Zatraži ponudu"** → the existing `mailto:` to `info@akvaterm.hr` (`js/views/dizajner.js:107`).

**9 · Demo disclaimer, demoted.** One `.t-stamp` line, `--fuga-mokra` on `--pladanj`, 5.61:1: `DEMO KATALOG — CIJENE I PROIZVODI SU OGLEDNI PODACI, NE STVARNA PONUDA.` It stays honest and it stops being the second thing anyone reads.

---

## 4. THE PAGE SYSTEM

Eight components. Nothing else is drawn.

1. **`Uzorak`** — swatch, 1 px `--rub` ring, 2 px `--rub-jak` biscuit edge, label strip *below*. Three sizes: 132/148 (rail), 1:1 (grid), 56 px (inline, designer drawer).
2. **`Pločica`** — the fired plaque. Carries the wordmark, and nothing else except real partner brand names on the product page: Viessmann, Daikin, Mitsubishi Electric, Termostroj. Invented demo brands never get one.
3. **`Ladica`** — horizontal snap rail. Dashboard samples, category filter chips, designer product drawer, soba3d fixture picker.
4. **`Stalak`** — the 3:2 or 4:3 WebGL still card. Scenes, categories, saved designs, resume.
5. **`Pult`** — `--utor` recessed panel for numbers. Spec tables, estimates, the `.akv-inq` box at `js/views/proizvod.js:159`, the order summary.
6. **`Žig`** — the `.t-stamp` label. Every meta line in the app.
7. **`Rub`** — 3 px edge band, category or status.
8. **`Pilula`** — 52 px control (44 px for icon-only inside a card), `--r-pill`.

**Katalog `#/katalog/:id`** — header, then the search from (2), then the four filter rows with `Žig` labels instead of the current `.lab`, active chip = `--kobalt` fill / `--plocica` text (14.46:1), then a grid of `Uzorak`. Two additions the dictionary is already paying for: sort by `Cijena ↑ / ↓ / Format` and the price range at `katalog.filter.price`. The empty state keeps its 34 px radius and loses the 🔍 — it becomes a `Žig`: `NEMA PROIZVODA ZA ODABRANE FILTRE`.

**Proizvod `#/proizvod/:id`** — the hero is **not** the flat swatch. It is `buildPatternCell(product, {pattern, grout})` at 2:1, so you see Metro Bijela actually laid in vezni slog with siva grout at true scale, and the four `PATTERNS` + three `GROUT_COLORS` switch it in place. Then a `Pult` spec table, then the inquiry box as a `Pult`, then **"Primijeni u prostoru"**.

**Dizajner** — behaviour untouched. The product drawer becomes a `Ladica` of 56 px `Uzorak`; the surface list becomes a `Pult` with live m² and €; the A/B compare adopts the zero-gap seam from dashboard (5). The coach mark becomes a `Žig` on a `Pločica`.

**3D soba** — the 27 fixture types become a `Ladica` of 72 px `Stalak` thumbnails. The two-step touch drag stays exactly as built.

**Dizajni** — grid of `Stalak`, each with `Žig` `SPREMLJENO 2. 8. 2026.` and the m²/€ line. Delete stays two-step, in `--terakota-700` (6.21:1 light, 5.97:1 dark).

---

## 5. MOTION

Opacity and transform only. Existing tokens: `--smooth cubic-bezier(.25,1,.5,1)`, `--snap cubic-bezier(.22,1,.36,1)`, `--spring cubic-bezier(.34,1.4,.5,1)`.

- **Page enter.** `#main` children: `opacity 0→1`, `translateY(10px)→0`, **420 ms `--snap`**, stagger **26 ms**, capped at 8 steps, `fill-mode: backwards`. The existing cap is correct — keep it.
- **Sample settling.** Chips in the `Ladica` enter with `translateY(10px) scale(.996)→none`, same 420 ms `--snap`. The sub-pixel scale is the whole trick: it reads as weight landing, not a card sliding.
- **Chip select.** `scale(.97)→1`, **160 ms `--spring`**. Overshoot is legitimate here — it is a physical object being pressed.
- **Setting a sample down.** When a swatch is applied to a surface: the source chip does `scale(1)→scale(.92)` + `opacity 1→0` over **200 ms `--smooth`**, while the surface overlay does `opacity 0→1` over the same 200 ms, offset 60 ms. No travel, no FLIP, no layout read.
- **Before/after wipe — transform only, no `clip-path`.** The "before" canvas sits in a masking div with `overflow: hidden`; the mask animates `transform: translateX(−x%)` and the inner canvas counter-animates `translateX(+x%)`. Two compositor transforms, identical result to today's `clip-path` over a frozen frame, and it obeys the rule literally.
- **Drawer.** `translateX(−100%)→0`, **380 ms `--smooth`**; scrim `opacity 0→1`, 200 ms.
- **Usporedba bar.** `translateY(16px)→0` + fade, **380 ms `--snap`**, on the second chip selection.
- **Theme flip.** 200 ms opacity crossfade on `--paper`/`--surface` only. The plaque does not animate, because it does not change.
- **`prefers-reduced-motion`** — every transform is dropped, everything becomes `opacity 0→1` at **120 ms linear**, staggers to 0.

---

## 6. WHAT I AM DELIBERATELY NOT DOING

1. **No glass.** `--glass-bg-text`, `-strong`, `-deco`, `--glass-solid`, `--glass-ink`, `--glass-tint` and the four `*-on-glass` inks all collapse to solid tokens. This deletes the entire five-path degradation fork (`no-backdrop-filter`, `prefers-reduced-transparency`, `html[data-transparency]`, `prefers-contrast:more`, `forced-colors`) **and** the `data-theme="dark"` near-white pane bug (weakness E) in one change, because there is no composed value left to forget to override. Weakness (J) — a full-bleed texture glued to an opaque white box — was the glass admitting it did no work.
2. **No emoji.** Not 🧱🚿🚰🔥❄️, not the 📦 fallback, not the 46 px stamp over non-tile swatches, not 🔍. The app renders 3D and generates seven kinds of material texture; using a system font's picture of a brick was the single loudest signal that nobody had looked at what this app can do.
3. **No third accent.** The violet AI dock (`#8958F4` / `#2A1D50`) is re-inked to `--kobalt` on `--kobalt-wash` and moved into the top bar as a 44 px `Žig`-labelled control. Being deliberately off-palette is not a design decision, it is an unresolved one.
4. **No teal, no amber, no mauve, no sky.** Removing `--teal-700`, `--amber-ink`, `--mauve-600` and `--sky-200` is what makes weakness (D) unrepeatable rather than patched.
5. **No photography, no illustration, no icon set, no CDN.** Every image in this proposal is produced at runtime by `js/texture.js` or `js/scene3d.js`. Net new asset bytes: **zero**. The CSP (`script-src 'self'`, `img-src 'self' data: blob:`) is untouched.
6. **No colour-coded category tiles.** Five pale washes carrying `--ink` only is five near-identical rectangles (weakness F). Colour drops to a 3 px edge; identity comes from the rendered material.
7. **No big display type.** Sora caps at 36 px. On a page whose subject is surface, a 48 px heading is the loudest object on screen and it is the one thing nobody came for.
8. **No recolouring of the wordmark in dark mode.** The current dark rule re-points AKVA to `--ink`. I refuse it and give the mark a plaque instead.
9. **No cross-device sync language.** `mirror()` at `js/db.js:437` is fire-and-forget and write-only; nothing reads back. No "sinkronizirano", no cloud glyph, no account benefit that does not exist. The dashboard renders completely signed out, and `js/app.js:810`'s cold-start redirect to `#/prijava` goes away — the first screen is the material, not a login.
10. **No new dependency, no build step, no framework.** Everything above is CSS custom properties, one new component file, and wiring to functions that already ship.

---

**One thing an engineer must know before starting:** the docs lie in both directions and the palette work will trip over it. `README.md:153` says 25 GLB files — there are **61** (1 761 632 B, verified). `README.md:54` and `docs/DESIGN_SYSTEM.md §Typography` say Anton + Figtree — the app ships **Sora + Inter**. `README.md:105` and `js/views/prijava.js:14` say sign-in is unimplemented — `js/config.js` is filled and `js/db.js` ships four auth methods. The dark contrast ledger at `css/styles.css:606–616` measures a warm-brown theme that was replaced in commit `44e8ff3`. Fix the ledger in the same commit as the palette, or the next person will trust it.

===== ? =====
# SALON — the Akvaterm showroom

*Design direction submitted against the Showroom lens · read-only pass over `C:/NERO/workspaces/Akvaterm` · all ratios computed, method below*

---

## 1. THE IDEA

**Akvaterm is not a webshop; it is the showroom Dubrovnik never built, and the app is the door.** You walk in and the first thing you see is a room — lit, tiled, priced, and yours — not a grid of thumbnails, because this company owns the one thing every competitor's website is missing: it can *build the room in front of you*.

The whole system follows from one physical metaphor: **the plinth**. In a real showroom the merchandise stands on a dark mount under a light, the walls are quiet plaster, the fittings are brass, and the maker's sign is a plate screwed to the wall. Every token below is one of those four things.

---

## 2. THE PALETTE — "Salon"

### 2.1 The wordmark problem, solved rather than dodged

AKVA `#00008C` / TERM `#d6252e` is a flag pair: a maximally saturated blue at hue 240 and a hot red at hue 357, each carrying a hard legibility floor. The current app's answer — re-point AKVA to `--ink` in dark mode (`css/styles.css:664`) — destroys the two-tone identity, and on the manual dark toggle it produces near-white-on-near-white (measured 1.50:1 in the brief, §5E). That is not an acceptable answer.

**Three moves, and all three are load-bearing:**

**Move 1 — the plate.** The wordmark never touches a theme token again. It sits on `--plate #F7F5F1`, an invariant warm-white rectangle 34 px tall, 12 px radius (`--r-sm`), padding `0 12px`, present in *both* themes and over the plinth. In light theme the plate is optically indistinguishable from the ground behind it (1.03:1 — it reads as no plate at all); in dark theme and over the hero it reads as exactly what it is, a brand plate screwed to a dark wall.

| pair | ratio | needs |
|---|---:|---:|
| `--logo-navy #00008C` on `--plate #F7F5F1` | **13.99:1** | 4.5 |
| `--logo-red #d6252e` on `--plate #F7F5F1` | **4.63:1** | 4.5 |
| plate edge vs `--paper-dark #14161B` | 16.62:1 | 3.0 |
| plate edge vs `--plinth #10131A` | 17.07:1 | 3.0 |

Two numbers, invariant, forever. No theme, no glass state, no scroll position can move them. This replaces the entire conditional-recolour apparatus.

**Move 2 — the app surrenders the blue-red axis entirely.** The current `--teal-700 #0D707D` is the mistake: hue 187 is blue-adjacent, so it *competes* with the navy without matching it, and it is the direct complement of the logo red, so those two vibrate wherever they meet. **The Salon accent is brass** — hue 36, the travertine/limestone/fitting hue that is already in this catalogue (`Travertin Classico #d8c9ae`, `Kaštela Bež #ddd0b8`, `Calacatta Oro`'s accent `#c9a35a`, `Heksagon Terakota #c17a56`). Navy-and-brass is the canonical hospitality pairing; it makes the logo navy read as *the family head* rather than as a leftover, and it leaves the red as the only hot thing on any screen, which is what a two-colour logo needs.

**Move 3 — red is confiscated.** `--danger` is `#A82217`, deliberately darker and less saturated than `#d6252e`. Nothing else on any screen is red. The logo is the only saturated red object in the product.

### 2.2 Method

WCAG 2.x relative luminance. Per channel `c/255`, then `c/12.92` if `≤ 0.03928` else `((c+0.055)/1.055)^2.4`; `Y = 0.2126R + 0.7152G + 0.0722B`; ratio `(Y_hi + 0.05) / (Y_lo + 0.05)`. Alpha composites resolved as `a·fg + (1−a)·bg` *before* the ratio, against the worst-case backdrop, never against the intended one. Every figure below was produced by that script, not estimated.

### 2.3 The three layers

The system is deliberately split into an **invariant layer** and a **theme layer**. This is the structural idea, not a convenience: a WebGL still rendered once is correct in both themes because the ground it sits on never changes.

#### LAYER A — INVARIANT (identical in light and dark)

| token | hex | role |
|---|---|---|
| `--plinth` | `#10131A` | the mount. Every 3D render, every hero, every product stage stands on it. |
| `--plinth-2` | `#1A1E27` | the caption rail under a render; the riser. |
| `--plinth-ink` | `#F2F3F5` | titles on the plinth |
| `--plinth-ink-2` | `#C7CBD3` | secondary / numeric on the plinth |
| `--plinth-muted` | `#A6ACB8` | eyebrow, meta on the plinth |
| `--brass-500` | `#C9963F` | brass fill — CTA in dark, active chip, the reveal line |
| `--brass-600` | `#A87B2C` | brass rim, hover fill, **the focus ring** |
| `--on-brass` | `#1B1302` | text on a brass fill |
| `--brass-on-plinth` | `#E4B369` | brass as text on the plinth |
| `--deep` | `#1A2440` | structural navy-family fill — primary CTA in light. hsl(222 42% 18%): far darker and far less saturated than the logo navy, so it reads as the navy's shadow, never as a second navy. |
| `--on-deep` | `#F4F1EC` | text on `--deep` |
| `--plate` | `#F7F5F1` | the wordmark plate. **Only** the wordmark uses it. |
| `--logo-navy` / `--logo-red` | `#00008C` / `#d6252e` | **EXEMPT. Untouched.** |

| invariant pair | ratio | needs |
|---|---:|---:|
| `--plinth-ink` on `--plinth` | **16.74:1** | 4.5 |
| `--plinth-ink` on `--plinth-2` | **15.02:1** | 4.5 |
| `--plinth-ink-2` on `--plinth` | **11.43:1** | 4.5 |
| `--plinth-muted` on `--plinth` | **8.15:1** | 4.5 |
| `--plinth-muted` on `--plinth-2` | **7.32:1** | 4.5 |
| `--brass-on-plinth` on `--plinth` | **9.69:1** | 4.5 |
| `--brass-on-plinth` on `--plinth-2` | **8.70:1** | 4.5 |
| `--on-brass` on `--brass-500` | **6.94:1** | 4.5 |
| `--on-deep` on `--deep` | **13.60:1** | 4.5 |
| `--brass-500` hairline on `--deep` | **5.78:1** | 3.0 |
| `--brass-600` reveal line vs `--plinth` | **4.90:1** | 3.0 |

#### LAYER B — LIGHT THEME

| token | hex | role |
|---|---|---|
| `--paper` | `#F4F1EC` | page. Warm limestone, not the current neutral `#F2F2F2`. |
| `--surface` | `#FFFFFF` | cards |
| `--panel` | `#EAE5DC` | recessed: banners, filter rails, table zebra |
| `--ink` | `#1E222A` | body |
| `--ink-2` | `#474D5A` | secondary |
| `--muted` | `#5E6472` | meta, eyebrow, spec labels |
| `--brass-ink` | `#845413` | text-carrying brass: prices, active chip labels, eyebrows |
| `--deep-ink` | `#1A2440` | links, back-nav (same hex as `--deep`; it is dark enough to be text) |
| `--danger` | `#A82217` | destructive |
| `--ok` | `#12713F` | status text |
| `--line` | `rgba(30,34,42,.14)` | hairlines |
| `--glass` | `hsl(38 30% 97% / .82)` = `#F9F6F1 @ .82` | the top bar at rest |

| light pair | ratio | needs |
|---|---:|---:|
| `--ink` on `--paper` | **14.15:1** | 4.5 |
| `--ink` on `--surface` | **15.94:1** | 4.5 |
| `--ink` on `--panel` | **12.71:1** | 4.5 |
| `--ink-2` on `--paper` | **7.52:1** | 4.5 |
| `--ink-2` on `--surface` | **8.48:1** | 4.5 |
| `--muted` on `--paper` | **5.26:1** | 4.5 |
| `--muted` on `--surface` | **5.93:1** | 4.5 |
| `--muted` on `--panel` | **4.73:1** | 4.5 |
| `--brass-ink` on `--paper` | **5.72:1** | 4.5 |
| `--brass-ink` on `--surface` | **6.44:1** | 4.5 |
| `--brass-ink` on `--panel` | **5.14:1** | 4.5 |
| `--deep-ink` on `--paper` | **13.60:1** | 4.5 |
| `--deep-ink` on `--surface` | **15.33:1** | 4.5 |
| `--danger` on `--paper` | **6.41:1** | 4.5 |
| `--ok` on `--paper` | **5.39:1** | 4.5 |
| `--deep` fill edge vs `--paper` | **13.60:1** | 3.0 |
| `--brass-600` rim vs `--paper` | **3.37:1** | 3.0 |
| `--brass-600` rim vs `--surface` | **3.79:1** | 3.0 |

Light glass composited (`#F9F6F1 @ .82` over `--paper` → `#F8F5F0`): `--ink` **14.66:1**, `--muted` **5.45:1**, `--brass-ink` **5.93:1**. All pass.

#### LAYER C — DARK THEME

| token | hex | role |
|---|---|---|
| `--paper` | `#14161B` | page |
| `--surface` | `#1D2027` | cards |
| `--panel` | `#262A32` | recessed |
| `--ink` | `#F2F3F5` | body |
| `--ink-2` | `#C7CBD3` | secondary |
| `--muted` | `#99A0AC` | meta |
| `--brass-ink` | `#E4B369` | text brass |
| `--deep-ink` | `#A9C1EE` | links (the navy family, lifted) |
| `--danger` | `#FF9082` | destructive |
| `--ok` | `#6FD79A` | status text |
| `--line` | `rgba(242,243,245,.13)` | hairlines |
| `--glass` | `#1B1E26 @ .90` | top bar at rest |

| dark pair | ratio | needs |
|---|---:|---:|
| `--ink` on `--paper` | **16.30:1** | 4.5 |
| `--ink` on `--surface` | **14.68:1** | 4.5 |
| `--ink` on `--panel` | **12.96:1** | 4.5 |
| `--ink-2` on `--surface` | **10.02:1** | 4.5 |
| `--ink-2` on `--paper` | **11.13:1** | 4.5 |
| `--muted` on `--paper` | **6.88:1** | 4.5 |
| `--muted` on `--surface` | **6.19:1** | 4.5 |
| `--muted` on `--panel` | **5.47:1** | 4.5 |
| `--brass-ink` on `--paper` | **9.44:1** | 4.5 |
| `--brass-ink` on `--surface` | **8.50:1** | 4.5 |
| `--brass-ink` on `--panel` | **7.50:1** | 4.5 |
| `--deep-ink` on `--surface` | **8.97:1** | 4.5 |
| `--deep-ink` on `--paper` | **9.95:1** | 4.5 |
| `--danger` on `--surface` | **7.42:1** | 4.5 |
| `--ok` on `--surface` | **9.21:1** | 4.5 |
| `--brass-500` fill edge vs `--paper` | **6.82:1** | 3.0 |

Dark glass worst case (`#1B1E26 @ .90` over **pure white**, the lightest backdrop a fixed bar can ever sample → `#32343C`): `--ink` **11.18:1**, `--muted` (using `--plinth-muted #A6ACB8`) **5.45:1**, `--brass-on-glass #E4B369` **6.47:1**. This is the composite-first discipline the current sheet applies in `@media (prefers-color-scheme: dark)` and forgets in `:root[data-theme="dark"]`.

### 2.4 Two rules that fall out of the arithmetic

**Rule A — the brass fill needs a rim in light theme, and nowhere else.** `--brass-500 #C9963F` against `--paper` is **2.35:1**, below the 1.4.11 floor of 3.0. So in light theme every brass-filled control carries a 1.5 px `--brass-600` rim, whose boundary against the page is **3.37:1** ✅. In dark theme the fill itself is **6.82:1** against the page and the rim is dropped. This is why the primary CTA is `--deep` in light (**13.60:1** edge) and `--brass-500` in dark (**6.82:1** edge) — one rule, *the primary action has maximum separation from its ground*, two values.

**Rule B — one focus ring, one documented exception.** `--brass-600 #A87B2C`, 2.5 px, offset 2, following the element radius:

| ground | ratio |
|---|---:|
| light paper / surface / panel | 3.37 / 3.79 / **3.02** |
| dark paper / surface / panel | 4.77 / 4.30 / 3.79 |
| `--plinth` | 4.90 |
| `--deep` fill | 4.04 |
| `--brass-500` fill | **1.43 — fails** |

On a brass fill only, the ring switches to `--deep #1A2440` (**5.78:1** on brass). One exception, one line of CSS, written down.

### 2.5 What is deleted

`--teal-600 #139EB1`, `--teal-700 #0D707D`, `--teal-800 #0B5A65`, `--teal-300`, `--teal-400`, `--sky-200 #C0D8F2`, `--mauve-400 #A6979C`, `--mauve-600 #756168`, `--brown-800 #68340F`, `--brown-700`, `--amber-500 #EAA651`, `--amber-600`, `--amber-ink #935616`, `--red-warm #B92C1C`, and the violet dock pair `#8958F4` / `#2A1D50`. Fifteen accents to two (`--brass-*`, `--deep`) plus a neutral ladder. Weakness **F** — five near-identical pale rectangles carrying `--ink` only because every other ink failed on them — dies with the washes.

### 2.6 The dark-toggle divergence (weakness E) — the actual fix

The bug is not the values, it is that the palette is authored twice: once under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` (`css/styles.css:623`) and once under `:root[data-theme="dark"]` (`:664`), and the second copy is missing eleven properties the first one has. CSS cannot union a media query and an attribute selector into one selector list, so duplication is unavoidable — but *divergence* is not.

Add `scripts/guard_theme_parity.py`, in the house style of `scripts/csp_hashes.py`: parse `css/styles.css`, extract the two dark declaration blocks, and fail non-zero if their property *key sets* differ or any shared key has a different value. It is stdlib-only, it runs in the session checklist, and it makes this class of bug impossible to ship again. Same guard also asserts that every `--*-ink` token declared in `:root` is re-declared in both dark blocks.

---

## 3. THE DASHBOARD — `#/`, top to bottom

**Routing change.** `js/app.js:206` today maps `/^\/?$/` to `katalog.js`. Salon adds `js/views/salon.js` at `/^\/?$/` and moves the catalogue to `/^\/katalog$/`, leaving `/^\/katalog\/([^/]+)$/` untouched. `js/app.js:810`'s cold-start redirect to `#/prijava` is deleted — a showroom does not ask for ID at the door, and the router has no auth gate anyway (`js/app.js:13–18`), so the redirect was already lying about a gate that does not exist.

Frame: `#main` keeps `--maxw 1180px`, padding `18px 16px` mobile / `26px 24px 56px` ≥720px.

---

### 0 · TOP BAR — 58 px, glass, two states

`--topbar-h 58px`. Structure unchanged (`.topbar` transparent wrapper / `.topbar__surface` absolute glass child / `.topbar__inner` — the Safari-26 fix in `js/app.js:28–40` stays exactly as written).

- **Wordmark**: `<a class="brand wordmark">` gets a `--plate` background, 34 px tall, `--r-sm 12px`, `padding 0 12px`, `margin-inline-start 4px`. AKVA `--logo-navy`, TERM `--logo-red`, Figtree italic 800 via `--font-wordmark`. **13.99:1 and 4.63:1, in every state the app has.**
- **State `[data-over="plinth"]`**: an `IntersectionObserver` on the hero writes this attribute while the hero's top 40 px is behind the bar. In *both* themes the bar then adopts the dark glass composition (`#1B1E26 @ .90`) and the plinth inks. Over the plinth the composite is `#1A1D25`: `--plinth-ink` **15.18:1**, `--plinth-muted` **7.39:1**, `--brass-on-plinth` **8.79:1**, plate edge **15.47:1**. This is the vestibule: you enter through a dark threshold and the hall gets lighter as you walk in.
- Right side: burger (44 px, drawer per house standard), then a single 44 px `--brass-600`-rimmed ghost pill "**Zatražite ponudu**" that fires the same `mailto:` `QUOTE_EMAIL` path as `js/views/dizajner.js:107`. It is the only persistent commercial control and it earns 44 px because §2 of the brief says the second job of this app is preparing a quote.

---

### 1 · IZLOG — the hero. The single most important element on the screen.

*Croatian: izlog = shop window.*

A `--plinth` block, full content width, bleeding past `#main`'s padding on mobile via `margin-inline: -16px` with `--r-2xl 34px` retained. Two stacked parts inside one rounded box:

**1a. The picture.** `<canvas>` at 16:9 desktop (1180×664) / 4:3 mobile, inset 12 px inside the plinth, child radius **22 px** (`--r-lg`) — the written concentric rule `r_child = r_parent − inset` = 34 − 12 = 22, exactly on the ladder. Rendered by `renderSceneThumbnail()` (`js/scene3d.js:1777`), which already accepts a scene *object* and already serialises stills through `thumbQueue`.

Content, in priority order:
1. If `akv:diz-draft` exists → **the user's own room**, with their assignments.
2. Else if `listDesigns()` (`js/db.js:388`) is non-empty → their newest saved design.
3. Else → scene `kupaonica` from `data/scenes.js:155` at its authored defaults: pod **Travertin Classico** (`ker-05`), lijevi zid **Jadran Plava** (`ker-11`), desni zid **Dalmacija Bijela** (`ker-08`), with all seven fixtures — kada, WC školjka, umivaonik s ormarićem, ogledalo, visoki ormarić, prozor, držač ručnika.

**Placeholder, and it is not a spinner.** Before three.js arrives — and *permanently* on `Save-Data`/2G, where the service worker skips the 2.3 MB payload by design — the canvas paints a **flat elevation**: `buildPatternCell()` (`js/texture.js:632`) called three times, tiled as a floor band and two wall bands at true relative scale, with the real grout colour. Cost is 3–20 ms each, no three.js, no network. It is not a loading state; it is the catalogue's own drawing of the same room, and if the render never arrives the screen is still complete and still honest.

**1b. The caption rail.** `--plinth-2`, 96 px desktop / auto mobile, `padding 20px 24px`, flush to the bottom of the plinth. **All hero text lives here, on a solid ground.** There is no scrim over the picture anywhere in this system — a 0.62 scrim over `Dalmacija Bijela #f1efe9` puts `--plinth-muted` at 2.60:1 and brass at 3.09:1, which is a failure that depends on what the render happens to contain. A caption rail is 8.15:1 and 9.69:1 regardless. Galleries put the label on the wall, not on the painting.

Contents, left column:
- Eyebrow, `.t-meta` 12/500 uppercase `--track-meta .08em`, `--brass-on-plinth` (**9.69:1** on plinth, **8.70:1** on plinth-2):
  `VAŠA KUPAONICA · 2,60 × 2,80 m · 7,28 m²`
- Title, Sora 600, `clamp(1.5rem, 3.2vw, 2.125rem)` = 24–34 px, line-height 1.2, `--plinth-ink` (**15.02:1**):
  `Travertin Classico na podu, Jadran Plava na zidu`
- Numeric line, `.t-numeric` tabular 14/500, `--plinth-ink-2` (**11.43:1** / 10.36 on plinth-2):
  `Procjena pločica 742,63 € · uključena zaliha 10 %`

That figure is computed, not decorative: `orderEstimate()` (`js/domain.js:193`) over `listSurfaces().areaM2` — pod 7,28 m² × €47,50, zid W 7,28 m² × €24,90, zid N 6,76 m² × €21,90, each × 1,10 reserve = 380,38 + 199,40 + 162,85 = **742,63 €**. Formatted through `formatEur()` (`js/domain.js:173`).

Right column: the primary CTA, a 54 px pill (house standard, not the catalogue's current 44), `padding 0 28px`.
- Light: `--deep` fill, `--on-deep` text, **13.60:1**, edge **13.60:1**.
- Dark: `--brass-500` fill, `--on-brass` text, **6.94:1**, edge **6.82:1**.
- Label: `Nastavite dizajn` when a draft exists, `Otvorite dizajner` on a first visit. Href `#/dizajner` / `#/dizajner/kupaonica`.
- Secondary ghost pill beside it, 54 px, `--brass-600` 1.5 px rim, `--brass-on-plinth` label: `Nacrtajte svoju sobu` → `#/soba3d`.

**Why it earns the top of the screen.** The brief's §5A is that the two genuinely unique features are reachable only from the drawer. This element *is* both of them, showing real geometry, real products by name, and a real price, above the fold, before a single word of marketing copy. Nothing else on this screen is allowed to be this large.

---

### 2 · PROSTORI — "Počnite od prostorije"

Section head: `.t-meta` `--muted` eyebrow `PET GOTOVIH PROSTORA`, then `h2` Sora 600 `clamp(1.375rem, 2.6vw, 1.75rem)` = 22–28 px `--ink`, `Počnite od prostorije`. `margin: 44px 0 18px`.

Grid `repeat(auto-fill, minmax(248px, 1fr))`, gap 18.

Five cards, one per authored scene in `data/scenes.js`. Card: `--surface`, `--r-xl 28px`, `padding 6px 6px 16px`, 1 px `--line` rim, house three-part warm shadow on `--shadow-warm`.
- Top: a `--plinth` mount, 4:3, radius **22 px** (28 − 6 inset), carrying `renderSceneThumbnail(canvas, sceneId, {}, products)` at 480×360.
- Body, `padding 12px 14px 0`: name 17/600 `--ink`; then `.t-meta` `--muted` (**5.93:1** on surface) with real numbers pulled from the scene record:

| card | meta line |
|---|---|
| Kupaonica | `2,60 × 2,80 m · 7,28 m² · 7 elemenata` |
| Mala kupaonica | `1,80 × 2,40 m · 4,32 m² · tuš 90 × 90` |
| Kuhinja | `3 plohe · donji i gornji elementi` |
| Dnevni boravak | `3 plohe · hrast na podu` |
| WC | `3 plohe · najbrži start` |

**Render budget, specified.** Six WebGL stills on one screen is ~600 ms of main thread and `renderSceneThumbnail` opens a fresh context per call. So: the hero renders eagerly; the five room cards are gated on an `IntersectionObserver` with `rootMargin: "200px"` and hydrate **two at a time** through the existing `thumbQueue`, each showing its flat-elevation placeholder until its still lands. Same idle-slice discipline `js/views/katalog.js` already uses for swatches, applied to a heavier asset.

**Why it earns its place.** It replaces the emoji tiles (weakness B) with the app's own strongest asset, and it reframes the entry question from "which category?" (a merchant's question) to "which room?" (the customer's question — §2 of the brief says the user is a homeowner renovating a bathroom).

---

### 3 · SPREMLJENO — conditional rail

Renders only when `listDesigns()` returns ≥1. `h2` `Spremljeno`, then a horizontal `overflow-x: auto` rail, `scroll-snap-type: x mandatory`, cards 280 px wide, gap 14, matching `js/views/dizajni.js`'s existing WebGL-still cards. Final item is a 280 × 100 ghost tile, `--brass-600` dashed rim, `--brass-ink` label `Svi dizajni →` → `#/dizajni`.

If empty, the section is absent entirely — no empty state on a landing screen.

---

### 4 · ASORTIMAN — the catalogue entrance

Eyebrow `--muted` `46 PROIZVODA · 11 MARKI`, `h2` `Asortiman`. Grid `repeat(auto-fill, minmax(206px, 1fr))`, gap 14.

Five cards, `--surface`, `--r-xl 28`, `min-height 148px`, `padding 6px 6px 14px`. **No emoji. No colour wash.**

- Top: a **swatch triptych** — three `<img>` at 1:1 from `swatchDataUrl(product, 192)` (`js/texture.js:682`), butted edge to edge, in a `--plinth` mount, radius 22, height 76 px. The colour on the card is the *merchandise*, which is the whole showroom argument, and it means the card is honest about what is inside it.

| category | the three swatches |
|---|---|
| Keramika (23) | Carrara Bianco, Hrast Natur, Heksagon Terakota |
| Sanitarije (7) | Umivaonik Slim 60, Tuš kada SlimStone 120 Antracit, Viseća WC školjka Pura Rimless |
| Armature (5) | Uno Krom, Visoka slavina Alta Crna, Cucina Inox |
| Grijanje (6) | Vitocal 150-A, Kupaonski radijator Linea, Set podnog grijanja Comfort 10 |
| Klimatizacija (5) | Emura FTXJ35AB, Sensira FTXF25D, MSZ-AY35VGK |

The 23 keramika products render as their real procedural textures. The 23 non-tile products carry `textureKind: "flat"` or `"metal"` and `baseColorHex` — `swatchDataUrl` already draws both, so `Alta Crna #2f2f31` next to `Uno Krom #c8c9cc` gives armature a genuine identity strip instead of 🚰.

- Body: name 17/600 `--ink`; count `.t-meta` `--muted` `23 PROIZVODA`; a brass hairline (1 px `--brass-600`, 24 px wide) under the name, animating to full card width on hover.
- **Full ink ladder available on every card** — `--ink` 15.94:1, `--muted` 5.93:1, `--brass-ink` 6.44:1 on `--surface`. Weakness F is closed: hierarchy is colour again, not size and tracking alone.

---

### 5 · SEARCH AND FILTER — moved here, from the strings that already exist

A single 54 px pill input, full width, `--surface`, 1.5 px `--line-input` rim, `--r-pill`, placeholder from `katalog.search` — **"Pretraži proizvode…"** — which `js/i18n.js:71` already defines and no view has ever called (weakness C). It posts to `listProducts()` (`js/db.js:317`), whose diacritic-folded Croatian search is already implemented and already unused. Typing navigates to `#/katalog?q=…`.

Under it, four 44 px ghost chips using the other orphaned strings — `katalog.filter.price`, `katalog.filter.brand`, `katalog.filter.size`, `katalog.filter.finish`. Active chip = `--brass-500` fill + `--brass-600` rim (**3.37:1** boundary) + `--on-brass` label (**6.94:1**) in light; fill-only in dark (**6.82:1** boundary).

Zero new strings. Five strings that have been sitting in the dictionary unrendered since it was written.

---

### 6 · IZDVOJENO — merchandised by a rule, not a hardcoded list

`js/views/katalog.js:1040` hardcodes six IDs. Replace with a rule derived from `data/scenes.js`:

> **Izdvojeno = the tiles the five authored rooms actually stand on, ordered by how many rooms use them.**

Counted from the `defaultProductId` fields: `ker-08` ×3, `ker-20` ×3, `ker-14` ×2, then `ker-05`, `ker-11`, `ker-22` in scene order.

| # | product | brand · format | price |
|---|---|---|---|
| 1 | **Dalmacija Bijela** | 250 × 400 mm, sjajna | 21,90 €/m² |
| 2 | **Metro Bijela** | 300 × 100 mm, sjajna | 26,90 €/m² |
| 3 | **Beton Pijesak** | 600 × 600 mm, mat | 34,50 €/m² |
| 4 | **Travertin Classico** | 610 × 406 mm, mat | 47,50 €/m² |
| 5 | **Jadran Plava** | 200 × 200 mm, sjajna | 24,90 €/m² |
| 6 | **Heksagon Siva** | 300 × 260 mm, mat | 59,90 €/m² |

Eyebrow: `IZ NAŠIH PROSTORA`. It is deterministic, it is derivable in four lines from data already in the tree, and it means the featured row is literally *what is standing in the showroom*.

Grid `repeat(auto-fill, minmax(196px, 1fr))`, gap 16. **The product card is rebuilt** — see §4.

---

### 7 · SAVJETNIK — one honest strip

`--panel` band, `--r-2xl 34`, `padding 24px`, full width, with a 3 px `--brass-600` rule down the leading edge.
- Eyebrow `--brass-ink` (**5.14:1** on panel light, **7.50:1** dark): `TERMA · SAVJETNIK`
- Title 20/600 `--ink` (**12.71** / **12.96**): `Ne znate koji uređaj?`
- Body 15/1.6 `--ink-2`: `Opišite prostor i dobit ćete prijedlog grijanja ili klime iz našeg asortimana — od panela E-Panel 1000 do toplinske pumpe Vitocal 150-A.`
- 54 px ghost pill `--brass-600` rim: `Otvorite savjetnika` → `#/savjetnik`.

**No violet.** The dock (`js/aidock.js`, tab `#8958F4`, panel `#2A1D50`) moves onto `--plinth` with `--brass-on-plinth` (9.69:1) and `--plinth-ink` (16.74:1). It stops needing to be off-palette to read as "not part of the page" because the plinth *is* the app's not-part-of-the-page surface — it is the same mount the hero and every render stands on. Weakness I closes without inventing a colour.

---

### 8 · DEMO DISCLOSURE + FOOTER

The banner (weakness D's worst offender at 1.31:1 in dark) becomes: `--panel` ground, `--ink` text (**12.71:1** light / **12.96:1** dark), `--r-md 16`, 3 px `--brass-600` leading rule, 13/1.55, and it moves to the **bottom**. Copy unchanged (`kat.demo`). It is a legal disclosure, not a greeting; putting it above the hero is the current design apologising before it has said anything.

Footer, `--muted` 13/1.6, centred: `Akvaterm d.o.o. · Bokeljska 12, Dubrovnik · vodoinstalacije, solarni sistemi, klimatizacija i centralno grijanje od 1991.` Then a `--muted` row of links: `Zasluge` (`#/zasluge` — the CC-BY 3.0 obligation for `radiator-panel.glb` and `ac-indoor-split.glb`), `Prijava`.

---

## 4. THE PAGE SYSTEM

**Eight repeating components. Every screen is assembled from these and nothing else.**

| component | definition | where it appears |
|---|---|---|
| **`.sal-plinth`** | `--plinth` box, `--r-2xl 34`, 12 px inset, child radius 22. Anything rendered by WebGL or canvas goes inside one. Invariant across themes. | hero, room cards, product stage, designer stage, 3D room stage, saved-design cards, swatch triptychs |
| **`.sal-rail`** | `--plinth-2` caption bar, 96 px, glued to the bottom of a plinth. eyebrow (brass) / title (plinth-ink) / numeric (plinth-ink-2) / CTA. **All text over imagery lives here.** | hero, product page, designer, 3D room |
| **`.sal-plate`** | `--plate #F7F5F1`, `--r-sm 12`. Wordmark only. | top bar, splash (`js/splash.js`), share/QR sheet, the `mailto:` quote header |
| **`.sal-card`** | `--surface`, `--r-xl 28`, 1 px `--line`, warm three-part shadow, 6 px inset for a plinth child. **Opaque. Not glass.** | product, room, category, saved design, favourite |
| **`.sal-chip`** | 44 px pill. Rest: `--surface` + `--line`. Active: `--brass-500` fill + `--brass-600` rim (light) / fill only (dark) + `--on-brass`. | catalogue filters, pattern picker, grout picker, drawer categories |
| **`.sal-pill`** | 54 px action. Primary `--deep`/`--brass-500`. Secondary `--brass-600` rim ghost. | every CTA in the app |
| **`.sal-band`** | `--panel`, `--r-2xl 34`, 3 px `--brass-600` leading rule. | Terma strip, demo banner, `.akv-inq` box on the product page, coach mark |
| **`.sal-meta`** | `.t-meta` 12/500 uppercase `--track-meta .08em`. `--muted` on paper, `--brass-*-ink` when it labels a value. | everywhere |

**How the language carries:**

- **Catalogue (`#/katalog`, `js/views/katalog.js`)** — the header block, search pill, chip rows and `.sal-card` grid from the dashboard, unchanged. The product card is rebuilt: **opaque `--surface`, no glass.** The current `.akv-pcard` is decorative glass at alpha .30 *and* an opaque `--surface` scrim over the text, glued together (weakness J) — the glass does no work. Salon: a `--plinth` swatch mount inset 6 (radius 22) carrying the 1:1 `swatchDataUrl` still, then an opaque body with `--muted` meta (`MARMO VIVO · 600 × 1200 MM`), 17/600 `--ink` name, and price in `--brass-ink` (**6.44:1** light, **8.50:1** dark — fixes the 2.55:1 measured in weakness D). The 44 px ♡ moves off the swatch and into the body row, in `--brass-ink`, killing the 2.52:1 amber-on-dark failure. The 46 px emoji stamped over every non-tile swatch is deleted; those products have `baseColorHex` and `textureKind: flat|metal` and `swatchDataUrl` draws them.

- **Product (`#/proizvod/:id`, `js/views/proizvod.js`)** — one `.sal-plinth` at 4:3 holding a large `swatchDataUrl(p, 768)` at true `patternCellMm` scale (`js/domain.js:124`), with a `.sal-rail` carrying brand eyebrow, name, and price. Below: `.akv-specs` table with `--muted` `<th>` (**5.93:1**, fixes 2.58:1), and the `.akv-inq` quote box as a `.sal-band`. A brass-rimmed 54 px `Isprobajte u dizajneru` pill deep-links to `#/dizajner/kupaonica` with this product preassigned.

- **Designer (`#/dizajner`, `js/views/dizajner.js`, 100 KB)** — the stage is already a hero-sized dark surface; it becomes a `.sal-plinth` verbatim, and the live price estimate moves into a `.sal-rail` at its foot. The product drawer, four laying patterns and three grout colours become `.sal-chip` rows. A/B compare and the before/after clip-path wipe get a `--brass-600` 2 px divider line — brass is the one colour that reads on both sides of any wipe, since it is invariant. Save/Share/Quote are three `.sal-pill`s.

- **3D room (`#/soba3d`, `js/views/soba3d.js` + `js/room3d.js`)** — same `.sal-plinth`. The 27 fixture types (`js/room3d.js:167`) get a `.sal-chip` picker grouped `Kupaonica (12) / Kuhinja (8) / Otvori i ostalo (7)`. Width/depth/height are three `.sal-band` range rows with `.t-numeric` readouts.

- **Saved designs (`#/dizajni`)** — a grid of `.sal-card`, each a `.sal-plinth` still plus a `.sal-rail`-styled body. The two-step inline delete uses `--danger` (**6.41** light / **7.42** dark). Because the plinth is invariant, a still rendered in light mode is *correct in dark mode* — no re-render on theme flip. That is the payoff of the invariant layer.

- **Favourites (`#/favoriti`)** — the catalogue grid with no filter rail.

- **Nine orphaned strings** (weakness H) go into `js/i18n.js`, which declares itself the authority at `:10`: `kat.eyebrow`, `kat.categoryEyebrow`, `kat.clearFilters`, `kat.resumeEyebrow`, `kat.resumeTitle`, `kat.resumeCta`, `kat.resumeAlt`, `kat.resumeSaved`, `kat.resumeToday`, plus `scene.mala-kupaonica` and `scene.wc`. Salon's new keys go in with them: `sal.izlog`, `sal.rooms`, `sal.roomsSub`, `sal.assortment`, `sal.featured`, `sal.featuredSub`, `sal.saved`, `sal.allDesigns`, `sal.advisor*`, `sal.quote`.

---

## 5. MOTION

Opacity and transform only. Nothing animates `width`, `height`, `top`, `filter`, or `background`. Every entrance declares `animation-fill-mode: backwards` so nothing flashes at its end state before its delay elapses.

| what | property | duration | curve | delay |
|---|---|---|---|---|
| `#main.view-enter` | `opacity 0→1` | 380 ms (`--dur-2`) | `--snap (.22,1,.36,1)` | 0 |
| Direct children of `#main` | `opacity 0→1`, `translateY(14px→0)` | 420 ms | `--snap` | 0 / 70 / 130 / 180 / 220 / 250 ms, **capped at 6 steps** |
| Hero picture, once the still lands | `opacity 0→1`, `scale(1.015→1)` | 560 ms (`--dur-3`) | `--smooth (.25,1,.5,1)` | 0 |
| `.sal-rail` under it | `opacity 0→1`, `translateY(10px→0)` | 420 ms | `--snap` | 120 ms |
| Grid children (`.sal-card`) | `opacity 0→1`, `translateY(10px→0)` | 420 ms | `--snap` | `26ms × index`, **capped at 8** (keeps the existing `.akv-rise` contract) |
| Card hover | `translateY(0→-2px)` + shadow step | 200 ms (`--dur`) | `--smooth` | 0 |
| Category brass hairline | `scaleX(.12→1)`, origin left | 380 ms | `--snap` | 0 |
| `.sal-pill` press | `scale(1→.97)` | 120 ms | `--smooth` | 0 |
| Chip active | `opacity` on a pseudo-element fill | 200 ms | `--smooth` | 0 |
| Top bar `[data-over="plinth"]` flip | `opacity` cross-fade between two absolutely stacked `.topbar__surface` layers | 200 ms | `--smooth` | 0 |
| Drawer | `translateX(-100%→0)` + backdrop `opacity` | 380 ms | `--snap` | 0 |
| Before/after wipe (designer) | `clip-path` inset, pointer-driven | — | — | — |

**`--spring (.34,1.4,.5,1)` is used nowhere on this screen.** A showroom door does not bounce.

`@media (prefers-reduced-motion: reduce)` — every entrance collapses to `opacity 0→1` at 120 ms with zero stagger; hover lifts become `box-shadow` only; the wipe becomes a two-state toggle. The five degradation paths already shipping on glass surfaces (no-`backdrop-filter`, `prefers-reduced-transparency`, `html[data-transparency="reduced"]`, `prefers-contrast: more`, `forced-colors`) all land on `--surface` / `--plinth` — both fully opaque, both already measured, so unlike the current `--glass-solid #F4FAFB` fallback there is nothing left to re-verify.

---

## 6. WHAT I AM DELIBERATELY NOT DOING

**I am not keeping the Iris teal.** `--teal-700 #0D707D` is a well-built token with an honest ledger, and it is the wrong hue for this logo. Hue 187 is close enough to navy 240 to look like a failed match and close enough to red's complement to buzz against `#d6252e`. Fifteen accent tokens go; two arrive. A palette that has to publish a rule saying "the category washes carry `--ink` only, because teal, mauve and amber all land at 3,99–4,28:1 on them" has already told you it has too many accents.

**I am not putting text on a render.** Not with a scrim, not with a gradient. A 0.62 scrim over `Dalmacija Bijela #f1efe9` gives `--plinth-muted` 2.60:1 and brass 3.09:1 — and the failure depends on which tile the user picked, which means it is not testable. The `.sal-rail` is 8.15:1 and 9.69:1 no matter what is in the picture. This costs 96 px of vertical space on the hero and I am paying it.

**I am not recolouring, outlining, shadowing, or conditionally re-pointing the wordmark.** The plate is the answer and it is the only answer that survives every theme, every glass state and every scroll position with two fixed numbers. AKVA stays `#00008C`, TERM stays `#d6252e`, in Figtree italic 800, everywhere.

**I am not making the product card glass.** Alpha-.30 glass that then needs an opaque scrim under every word is two cards fighting. Opaque `--surface` with a `--plinth`-mounted swatch is one card, it is faster, and the glass budget (2–3 `backdrop-filter` surfaces, per `js/app.js:22`) goes entirely to the top bar and the one modal that is open.

**I am not adding a photograph, a stock illustration, an icon library, or a single CDN reference.** The CSP is `script-src 'self'` + two sha256 hashes and `font-src 'self'`; one CDN URL breaks the app. Every image on every screen is `swatchDataUrl`, `buildPatternCell`, `renderSceneThumbnail`, or `assets/icon.svg`.

**I am not proposing a typeface.** Sora + Inter, vendored, latin-ext, preloaded. I am changing the *scale*: display drops from `clamp(2rem, 4.8vw, 3rem)` to `clamp(1.5rem, 3.2vw, 2.125rem)` for the hero title, because the hero's job is carried by a 664 px picture and a 48 px heading next to it is two things shouting. The `.t-*` classes in `vendor/fonts/fonts.css` are otherwise untouched. The dead **"ANTON METRIC HAZARD"** block at `js/views/katalog.js:148` and the "Vendored Anton (display) + Figtree (text)" opener at `css/styles.css:1` are deleted — Anton has not shipped since the Sora swap and a stale hazard note is worse than none.

**I am not implementing cross-device sync, and I am not letting the UI imply it.** `js/db.js:437 mirror()` is fire-and-forget and write-only; nothing reads back. So Salon shows no cloud glyph, no "synced" state, no account avatar on the dashboard. Sign-in remains one row in the drawer that changes one label, which is exactly what it does. `js/views/prijava.js:14`'s stale header claiming `js/config.js` ships empty gets corrected, and so do `README.md:153` ("Svih 25 `.glb`" — there are **61**, 1 761 632 B, two of them CC-BY 3.0) and `README.md:54` / `docs/DESIGN_SYSTEM.md §Typography` (Anton + Figtree → Sora + Inter). The dark-theme ledger at `css/styles.css:606–616` is deleted outright: every figure in it is against the warm-brown palette retired in `44e8ff3`, and a false ledger is worse than no ledger.

**I am not shipping the dark palette twice by hand again.** `scripts/guard_theme_parity.py`, stdlib-only, in the session checklist. The bug in weakness E is not a colour bug, it is a build-discipline bug, and colour fixes do not fix build discipline.

**I am not gating the door.** The cold-start redirect to `#/prijava` (`js/app.js:810`) goes. There is no auth gate in the router (`js/app.js:13–18`), the demo has nothing to sign in to, and asking a homeowner in Dubrovnik to log in before they can see a bathroom is the single fastest way to make a showroom feel like a bank.