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
| Design system | ASC `app/app.css` adapted: accent → Akvaterm navy `#00008C` + logo red; Open Sans; ASC discipline rules kept |
| Hosting target | GitHub Pages-compatible (local `http-server -c-1` during development) |
| Data | Supabase: Postgres + RLS, Auth, Realtime, Storage (product images), Edge Functions |
| 3D | three.js r185 vendored under `/vendor/three/`, import map, lazy-loaded |
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
├── service-worker.js       offline shell, CACHE tied to APP_V
├── css/styles.css          adapted ASC design system (single generation, tokenized accent)
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
│   ├── three/              pinned three.module.js + three.core.js + addons
│   │                       (OrbitControls, RoomEnvironment)
│   ├── supabase/           pinned @supabase/supabase-js 2.111.0 ESM graph (see PROVENANCE.md)
│   └── qr/                 dependency-free QR encoder
├── assets/icon.svg         the only shipped image — everything visual is drawn at runtime
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
renderer, a `profil` view, a vendored `GLTFLoader` and a `SCENE_AUTHORING.md`. None of that was
built and none of it is coming back: the design moved to **procedurally drawn scenes and
procedurally generated textures** — every scene is vector-drawn into a canvas by its own module in
`data/scenes.js`, and every tile surface is generated by `js/texture.js` from a seeded PRNG. That
removes the per-scene photo/mask authoring work (hours each), removes the licensing question
around tile photography, and is why the whole app ships ~143 KB of same-origin assets.

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
  space plus each surface's real size in metres. No masks, no photos.
- `rooms` — Stage 2 parametric: widthM/depthM/heightM + fixtures list.
- Favorites, quotes (public_code sequence from ASC), profiles/roles from ASC scaffolding — the
  last three are provisioned in `schema.sql` and have no UI yet.

## The three pillars

1. **Katalog** — category grid → filterable product lists (size, color, finish, brand, price) →
   product page with large swatch, specs, "primijeni u dizajneru" action. Realtime not required
   day one; seed JSON renders without Supabase so the demo runs with zero setup.
2. **Dizajner** — Stage 1: pick scene → tap surface → pick tile from drawer → pattern/grout
   controls → canvas re-render (<100ms target) → save/share/A-B compare. Stage 2: "3D soba" tab —
   room dimensions, fixtures, orbit view, same product drawer and assignment model.
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
- The repository is public. No secrets, no customer data, no local host paths or operator
  usernames in tracked files — including in prose.

## Build order — and where it actually stands

1. ✅ Scaffold: shell, adapted design system, router, i18n, seed catalog, katalog views. Runs offline.
2. ✅ Texture pipeline + Stage 1 designer with three procedurally drawn scenes.
3. ◐ Supabase schema — written and applied-ready, including RLS, audit log and the Terma metering
   tables. **Auth is not built**: no sign-in UI, so favorites/designs persistence stays local and
   the owner-only tables sit empty. This is the one item the docs used to overstate.
4. ✅ Terma chat via Edge Function + photo analysis, with identity, origin allowlist and quotas.
5. ✅ Stage 2 three.js room.
6. ◐ Staging (paid tier) — implemented and gated; unreachable in practice until step 3 finishes,
   because it now requires an authenticated session rather than a client-side confirm.
7. ✅ Polish: PWA, service worker, share links, QR handoff. Quotes remain schema-only (no UI).

Next up, in order: an auth flow (unblocks 3 and 6 together), then a quote surface on top of the
`quotes` table.
