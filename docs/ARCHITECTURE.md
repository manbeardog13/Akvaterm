# Akvaterm Platform — Architecture

**Status:** built and running. Published on 2026-08-01 to the `manbeardog13/Akvaterm` GitHub
repository with the operator's explicit authorization — the earlier "local-only, no git remote"
rule was lifted by that decision and this document no longer claims it. Everything in the tree is
public; keep it free of secrets, customer data and local host paths.

## What it is

A Croatian-first web platform for Akvaterm (Dubrovnik): customers browse a catalog of house
equipment — tiles (keramika), sanitary ware, faucets, radiators, AC units — save favorites, then
design their rooms/bathrooms by applying tiles and accessories to preset scenes (Stage 1) and a
parametric 3D room (Stage 2), with a Gemini-powered advisor ("Terma") for product Q&A, room-photo
style analysis, and AI virtual staging. Demo catalog is synthetic until the client supplies data.

## Stack (inherited from ASC, deliberately)

| Layer | Choice |
| --- | --- |
| Frontend | Static HTML/CSS/JS PWA, **no build step**, ES modules, hash-routed SPA |
| Design system | **Iris** — palette pixel-sampled from the operator's reference (teal `#139EB1` / amber `#EAA651` / brown `#68340F`), liquid-glass surfaces with **five** degradation paths. ASC's structural discipline (tap targets, `-ink` variants, one depth cue) kept; the navy/red identity is retired **for the UI but not for the wordmark**, which keeps navy `#00008C` / red `#d6252e` in the text face by standing operator instruction. See `docs/DESIGN_SYSTEM.md` |
| Type | Anton (display) + Figtree (text), vendored woff2 under `/vendor/fonts/`, SIL OFL 1.1, linked from `index.html` before `css/styles.css` and preloaded for the two `latin-ext` slices. The reference's Montelisa/Magi Sans are commercial, unlicensed here, not shipped, and were substituted by Anton/Figtree respectively — recorded in the README and `docs/DESIGN_SYSTEM.md` so it cannot be lost |
| Hosting target | GitHub Pages-compatible (local `http-server -c-1` during development) |
| Data | Supabase: Postgres + RLS, Auth, Realtime, Storage (product images), Edge Functions |
| 3D | three.js r185 vendored under `/vendor/three/`, import map, lazy-loaded; 25 CC0 `.glb` fixtures under `/vendor/models/` |
| AI | Gemini via Supabase Edge Function proxy only; `gemini-3.6-flash` chat+vision, `gemini-3.1-flash-image` staging; service-account auth key in secrets; caller identity + Postgres-backed quota enforced in the function |

**What Supabase is actually used for today:** the Terma Edge Function (chat, vision, staging) and
its server-side catalog search. Auth, Realtime and Storage are provisioned by `schema.sql` and
have **no client counterpart yet** — the app ships no sign-in UI, opens no realtime channel and
uploads no images. `js/db.js` mirrors favorite/design writes to Postgres, but those tables are
owner-only under RLS, so without a session the writes are correctly filtered to zero rows and
localStorage remains the store. Treat that row of the table as "provisioned", not "in use".

## Layout

As shipped. `docs/BUILD_CONTRACTS.md` is the binding description of the interfaces; this is the
file tree.

```
Akvaterm/
├── index.html              app shell (import map, splash, mounts app)
├── manifest.webmanifest    PWA
├── service-worker.js       offline shell; CACHE = "akv-" + the ?v= APP_V app.js registers with
├── css/styles.css          the Iris design system (single generation, tokenized accent, glass)
├── js/
│   ├── config.js           Supabase URL + anon key + app URL (operator-edited; empty = demo mode)
│   ├── supabaseClient.js   connection (ASC pattern), lazy-loads the vendored supabase-js
│   ├── db.js               data access w/ ASC discipline (fail(), row-count guards, offline queue)
│   ├── domain.js           catalog/room rules: categories, tile formats, pattern math (pure, testable)
│   ├── i18n.js             HR-first dictionary, EN-ready
│   ├── app.js              router (ASC ROUTES pattern) + frame + toast
│   ├── views/              katalog, proizvod, favoriti, dizajner (scenes), soba3d, savjetnik (AI),
│   │                       dizajni (saved designs)
│   ├── texture.js          pattern-cell builder (tile+grout composite, anti-repetition, physical scale)
│   ├── scene2d.js          scene renderer: draws each scene's vector illustration, fills the
│   │                       surface quads with the pattern cell in perspective, hit-tests taps
│   ├── room3d.js           three.js room (lazy import)
│   └── qrshare.js          QR share sheet for cross-device handoff (lazy import)
├── vendor/
│   ├── three/              pinned three.module.js + three.core.js + 5 addons (OrbitControls,
│   │                       RoomEnvironment, GLTFLoader, BufferGeometryUtils, SkeletonUtils)
│   ├── models/             25 CC0 .glb fixtures, 823 008 B (PROVENANCE.md: per-file source,
│   │                       author, SHA-256, MEASURED bbox and scale-to-real-size vector)
│   ├── fonts/              Anton + Figtree woff2 (4 faces used), fonts.css, both OFL texts
│   │                       (PROVENANCE.md: URLs, byte counts, SHA-256, cmap coverage proof)
│   ├── supabase/           pinned @supabase/supabase-js 2.111.0 ESM graph (see PROVENANCE.md)
│   └── qr/                 dependency-free QR encoder (see README.md)
├── assets/icon.svg         the only shipped raster/vector *picture* — see the note below
├── data/
│   ├── catalog.seed.json   46 demo products (tiles w/ tileSizeMm, priceM2; equipment w/ priceUnit)
│   └── scenes.js           scene registry: each scene draws itself and exposes its surface quads
├── supabase/
│   ├── schema.sql          ASC scaffolding (profiles/roles/RLS/audit/soft-delete) + domain tables
│   │                       + the terma metering tables
│   ├── seed_products.sql   generated catalog seed for the products table (run after schema.sql)
│   ├── seed_products.gen.mjs  dev-only generator for the above
│   └── functions/
│       └── terma/          Gemini proxy: chat (Interactions API, SSE relay), vision, staging
└── docs/                   RESEARCH.md, ARCHITECTURE.md, BUILD_CONTRACTS.md, SETUP.md
```

**No image pipeline exists, by design.** An earlier draft of this document described
`assets/scenes/<id>/` with `base.jpg` + per-surface alpha masks + `shading.png`, an
`assets/products/` folder of tile photographs, a homography-warp/mask-clip/shading-multiply
renderer, a `profil` view and a `SCENE_AUTHORING.md`. None of that was built and none of it is
coming back: the design moved to **procedurally drawn scenes and procedurally generated
textures** — every scene is vector-drawn into a canvas by its own module in `data/scenes.js`, and
every tile surface is generated by `js/texture.js` from a seeded PRNG. That removes the per-scene
photo/mask authoring work (hours each) and removes the licensing question around tile photography.

**What did arrive, and it is not the same thing:** `vendor/models/` and a vendored `GLTFLoader`.
Those are 3D *geometry* for the room's fixtures — a bath, a WC, kitchen modules — not photographs
of products, and not an authoring pipeline: the files are finished CC0 assets, they carry no
external `uri` and no compression extension, and the only per-file work is the scale vector
recorded in `vendor/models/PROVENANCE.md`. Tiles are still never photographed. Two fixtures — the
radiator and the indoor AC split unit — are **procedural geometry**, because a documented search
found no CC0 model of either (the searches and their result counts are in that same file).

**Payload, measured over HTTP against the served tree, not estimated:**

| | bytes | when it is fetched |
| --- | ---: | --- |
| Precached shell (31 entries) | ≈ 799 000 | at install |
| — of which the 4 woff2 faces + `fonts.css` | 85 193 | (part of the shell) |
| `vendor/three/` (7 files) | 2 302 788 | lazily on first 3D open; pre-warmed on idle, stage 1 |
| `vendor/models/` (25 files) | 823 008 | lazily on first 3D open; pre-warmed on idle, stage 2 |
| `vendor/supabase/` (9 `.mjs`) | 258 794 | **never precached, never pre-warmed** — imported only when `js/config.js` carries credentials, then runtime-cached |

Measured over HTTP against the served tree (last re-measured 2026-08-02 by reading the populated
`akv-v2` cache back), not estimated. **Treat the shell figure as a snapshot and re-measure rather
than trusting it:** it moves with every edit to the app's own modules, and it has already drifted
once — this table said 773 717 while the served tree measured 798 684. The three vendored figures
do not drift, because those files are pinned. An earlier version of this document said "~143 KB of
same-origin assets" — that predated the vendored fonts, models and three.js addons.

The 31 shell entries are the 30 URLs listed in `SHELL` plus `"./"`, which the worker caches
separately from `"./index.html"` so a navigation to the bare origin resolves offline.

## Domain model

- `products` — id, category (keramika | sanitarije | armature | grijanje | klima), name, brand,
  `textureKind` (which procedural generator draws it), baseColorHex/accentColorHex, tileSizeMm
  [w,h] for tiles or null for equipment, glossy, priceM2/priceUnit, unit, desc, demo flag. The
  canonical shape is in `docs/BUILD_CONTRACTS.md`. Read by the client from `catalog.seed.json`;
  the same rows go into Postgres via `supabase/seed_products.sql` so Terma's server-side search
  has something to find (with `color_tags` derived there, since the JSON has no such field).
  There is no `imagePath` or `pixelsPerMm` — nothing is photographed.
- `designs` — saved user work: `{kind: 'scene'|'room3d', refId, assignments: {surfaceId:
  {productId, pattern, groutColorId, groutWidthMm}}, room?}` — serialized to localStorage always,
  mirrored to Supabase when a session exists (none does yet), shareable via URL hash.
- `scenes` — Stage 1 scenes, procedurally drawn: each exposes surface quads in the 1000×700 design
  space plus each surface's real size in metres. No masks, no photos. Five ship: `kupaonica`,
  `mala-kupaonica`, `kuhinja`, `dnevni-boravak`, `predsoblje`.
- `rooms` — Stage 2 parametric: widthM/depthM/heightM + fixtures list. A fixture is
  `{type, x, z, rotY, ax, az}`: `type` indexes the 27-entry catalogue in `js/room3d.js`
  (12 kupaonica, 8 kuhinja, 7 ostalo), `x`/`z` are metres from the W and N walls, `rotY` is
  radians, and `ax`/`az` ∈ {-1,0,1} record which wall the fixture is snapped to so it re-anchors
  correctly when the room is resized. Fixtures are **movable**: drag on the floor plane, R to
  rotate, wall-snap within a threshold, and hard-clamped inside the room.
- Favorites, quotes (public_code sequence from ASC), profiles/roles from ASC scaffolding — the
  last three are provisioned in `schema.sql` and have no UI yet.

## The three pillars

1. **Katalog** — category grid → filterable product lists (size, color, finish, brand, price) →
   product page with large swatch, specs, "primijeni u dizajneru" action. Realtime not required
   day one; seed JSON renders without Supabase so the demo runs with zero setup.
2. **Dizajner** — Stage 1: pick scene → tap surface → pick tile from drawer → pattern/grout
   controls → canvas re-render (<100ms target) → save/share/A-B compare. Stage 2: "3D soba" tab —
   room dimensions, movable fixtures from the CC0 model library, orbit view, same product drawer
   and assignment model.
3. **Terma (Gemini)** — chat dock: product Q&A via function-calling against the catalog;
   photo-analysis flow (upload → style/color read → suggested products, consent notice); staging
   flow (room photo + chosen tile → AI re-render, labeled as AI impression, behind explicit
   action, paid tier, **and a signed-in session plus a daily server-side quota** — so it is
   dormant until an auth flow ships). Degrades gracefully to a static FAQ, plus a phone/e-mail
   contact card, when the Edge Function is absent.

## Non-negotiables carried from research

- No API key ever in client code; Gemini only through the Edge Function; **auth key (service
  account), not a standard key** — standard keys die Sept 2026.
- The Edge Function must never be an open proxy: no unauthenticated caller, no `*` CORS, no
  unmetered action. Anything that spends money is gated on identity **and** a server-side quota,
  and it fails closed when it cannot count. A client-side confirm dialog is not a control.
- Staging UI copy must say AI impression, not product-accurate render (SynthID-watermarked).
- Physical-scale integrity: tile sizes are millimetres and every texture cell is built at a real
  px-per-mm scale, so 2D and 3D agree with the product spec.
- Accent tokenization done properly from day one (ASC's hardcoded-literal lesson).
- 44px targets, reduced-motion/transparency fallbacks, AA contrast — ASC discipline rules.
- **Iris palette values are sampled, never invented.** Any shade that is not in the sampled set is
  *derived* from one that is, and its contrast ratio is computed and recorded in a comment next to
  it. "Looks like it passes" is not a measurement.
- **Glass never outranks legibility.** Every text-on-glass pair is checked against the glass's
  worst-case composite (the panel over a pure-black backdrop), not against the page background it
  happens to sit on today. All **five** degradation paths — `@supports not (backdrop-filter)`,
  `prefers-reduced-transparency`, the manual `html[data-transparency="reduced"]` switch,
  `prefers-contrast` / `forced-colors`, `prefers-reduced-motion` — ship on every glass surface,
  including glass declared inside a view's own scoped `<style>`, and `blur()` is never animated.
  The manual switch is **not** redundant with the OS media query: Safari never reports
  `prefers-reduced-transparency`, so it is the only path iOS users get. At most 2–3
  backdrop-filtered surfaces on screen: the top bar and the tab bar are the standing pair, and a
  modal *replaces* a panel rather than adding one.
- **The wordmark is exempt from the palette.** Standing operator instruction, 2026-08-02: *"keep
  the logo original in font and color."* AKVA stays navy `#00008C`, TERM stays red `#d6252e`, italic
  800 in the **text** face — not Anton, not teal/amber. The two values live in `--logo-*` tokens
  outside the rebindable ink set. A palette sweep that finds those hexes must leave them alone.
- **Anton is a clipping hazard in Croatian.** Measured on the vendored face: caps ink reaches
  0.8594em, but `Č Š Ž Ć Đ` reach 1.1094em ascent + 0.0156em descent. That is taller than the
  font's declared ascender, so the ink leaves the line box at *any* line-height — line-height
  ≥ 1.05 fixes line-to-line collision, not clipping. Anton headings therefore also need
  `overflow: visible` and enough `padding-top` (≈ 0.18em at line-height 1.12) that the diacritic
  lives inside the element's own padding box. Figtree (0.70em ascent) has no such problem.
- No runtime dependency on a third-party host. Fonts, three.js, supabase-js, the QR encoder and
  the 3D models are all vendored under `/vendor/`; the service worker intercepts same-origin
  traffic only.
- The repository is public. No secrets, no customer data, no local host paths or operator
  usernames in tracked files — including in prose.

## Build order — and where it actually stands

1. ✅ Scaffold: shell, adapted design system, router, i18n, seed catalog, katalog views. Runs offline.
2. ✅ Texture pipeline + Stage 1 designer, now with five procedurally drawn scenes.
3. ◐ Supabase schema — written and applied-ready, including RLS, audit log and the Terma metering
   tables. **Auth is not built**: no sign-in UI, so favorites/designs persistence stays local and
   the owner-only tables sit empty. This is the one item the docs used to overstate.
4. ✅ Terma chat via Edge Function + photo analysis, with identity, origin allowlist and quotas.
5. ✅ Stage 2 three.js room.
6. ◐ Staging (paid tier) — implemented and gated; unreachable in practice until step 3 finishes,
   because it now requires an authenticated session rather than a client-side confirm.
7. ✅ Polish: PWA, service worker, share links, QR handoff. Quotes remain schema-only (no UI).
8. ✅ CC0 fixture library + movable fixtures in the 3D room (drag on the floor plane, R to rotate,
   wall snapping, room clamping) — hand-rolled against `THREE.Plane`/`Raycaster` rather than
   `DragControls`/`TransformControls`, for reasons read out of the r185 source and recorded at the
   top of `js/room3d.js`.
9. ✅ Re-identification to the **Iris** design system: sampled palette, vendored Anton + Figtree,
   liquid glass with five degradation paths. The navy/red identity is retired from the UI —
   **except the wordmark**, which keeps it by standing operator instruction (see above). An earlier
   version of this line said "retired everywhere", which was never true of the logo.

Next up, in order: an auth flow (unblocks 3 and 6 together), then a quote surface on top of the
`quotes` table.
