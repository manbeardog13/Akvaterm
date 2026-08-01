# Akvaterm Platform — Architecture

**Status:** approved direction pending operator review of RESEARCH.md. Local-only project (no git
remote) per the workspace rule, until the operator explicitly authorizes publication.

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
| 3D | three.js 0.185.1 vendored under `/vendor/three/`, import map, lazy-loaded |
| AI | Gemini via Supabase Edge Function proxy only; `gemini-3.6-flash` chat+vision, `gemini-3.1-flash-image` staging; service-account auth key in secrets |

## Layout

```
akvaterm-platform/
├── index.html              app shell (import map, splash, mounts app)
├── manifest.webmanifest    PWA
├── service-worker.js       offline shell, CACHE tied to APP_V
├── css/styles.css          adapted ASC design system (single generation, tokenized accent)
├── js/
│   ├── config.js           Supabase URL + anon key + app URL (operator-edited)
│   ├── supabaseClient.js   connection (ASC pattern)
│   ├── db.js               data access w/ ASC discipline (fail(), row-count guards, offline queue)
│   ├── domain.js           catalog/room rules: categories, tile formats, pattern math (pure, testable)
│   ├── i18n.js             HR-first dictionary, EN-ready
│   ├── app.js              router (ASC ROUTES pattern) + frame + auth wiring
│   ├── views/              katalog, proizvod, favoriti, dizajner (scenes), soba3d, savjetnik (AI), profil
│   ├── texture.js          pattern-cell builder (tile+grout composite, anti-repetition, physical scale)
│   ├── scene2d.js          preset-scene renderer (homography warp + mask clip + shading multiply)
│   └── room3d.js           three.js room (lazy import)
├── vendor/three/           pinned three.module.js + addons (OrbitControls, RoomEnvironment, GLTFLoader)
├── assets/
│   ├── scenes/<id>/        base.jpg, mask-<surface>.png, shading.png, scene.json (quads, real sizes)
│   └── products/           demo tile/product images (synthetic, clearly labeled)
├── data/
│   ├── catalog.seed.json   demo products (tiles w/ sizeMm, pixelsPerMm, finish, priceM2; equipment)
│   └── scenes.json         scene registry
├── supabase/
│   ├── schema.sql          ASC scaffolding (profiles/roles/RLS/audit/soft-delete) + domain tables
│   └── functions/
│       └── terma/          Gemini proxy: chat (Interactions API, SSE relay), vision, staging
└── docs/                   RESEARCH.md, ARCHITECTURE.md, SETUP.md, SCENE_AUTHORING.md
```

## Domain model

- `products` — id, category (keramika | sanitarije | armature | grijanje | klima | namjestaj),
  name, brand, tileSizeMm [w,h] where applicable, finish, colorTags, imagePath, pixelsPerMm,
  seamless flag, priceM2/priceUnit, demo flag. Seeded from `catalog.seed.json`; Supabase later.
- `designs` — saved user work: `{kind: 'scene'|'room3d', refId, assignments: {surfaceId:
  {productId, pattern, groutColorId, groutWidthMm, rotationDeg}}, fixtures?}` — serialized to
  localStorage always, Supabase when signed in, shareable via URL hash.
- `scenes` — Stage 1 preset scenes: per-surface masks, quads, physical sizes.
- `rooms` — Stage 2 parametric: widthM/depthM/heightM + fixtures list.
- Favorites, quotes (public_code sequence from ASC), profiles/roles from ASC scaffolding.

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
   action, paid tier). Degrades gracefully to a static FAQ when the Edge Function is absent.

## Non-negotiables carried from research

- No API key ever in client code; Gemini only through the Edge Function; **auth key (service
  account), not a standard key** — standard keys die Sept 2026.
- Staging UI copy must say AI impression, not product-accurate render (SynthID-watermarked).
- Physical-scale integrity: `pixelsPerMm` per product photo; ruler-scene validation before Stage 2.
- Accent tokenization done properly from day one (ASC's hardcoded-literal lesson).
- 44px targets, reduced-motion/transparency fallbacks, AA contrast — ASC discipline rules.
- Local-only until the operator authorizes a remote/publication.

## Build order

1. Scaffold: shell, adapted design system, router, i18n, seed catalog, katalog views. ✅ runs offline
2. Texture pipeline + Stage 1 designer with 2 authored scenes.
3. Supabase schema + auth + favorites/designs persistence (app still fully usable without it).
4. Terma chat via Edge Function (reuse ASC asc-agent pattern — read it first) + photo analysis.
5. Stage 2 three.js room. 6. Staging (paid tier, gated). 7. Polish: PWA, SW, quotes, share links.
