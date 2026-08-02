# Akvaterm Platform — Research Findings (2026-08-01)

Consolidated from four parallel research tracks: the client site, the ASC reference codebase, room-visualizer engineering, and the current Gemini API. Every claim below was verified against a cited source during research; see the workflow journal for full evidence.

## 1. The client — and a premise correction

**Akvaterm d.o.o.** (akvaterm.hr) is a family-run **mechanical-installations contractor** in Dubrovnik (Bokeljska 12), active since 1991, run by Boris and Juraj Dujmović. Four service lines: **Vodoinstalacija, Solarni sistemi, Klimatizacija, Centralno grijanje**. Partner brands: Horvatić, Termostroj, Viessmann, Daikin, Riello, Mitsubishi, Wilo, Grundfos.

**The correction:** the site has **no webshop, no product catalog, no prices, no SKUs, and no tile data of any kind**. It is a ~2016 Bootstrap brochure with 49 jobsite photos and a contact form. Any "browse the catalog" experience is **new capability with no existing data source** — the demo catalog must be seeded synthetically (tiles + sanitary + heating/AC equipment consistent with their trade and partner brands) and clearly labeled as demo data until the client supplies an assortment. (Similarly-named actual tile/sanitary retailers exist — Kera Term / kera-term.hr, Vodoterm / vodo-term.hr — if the operator ever wants a real assortment reference.)

**Branding to echo:** wordmark AKVA (navy) + TERM (red); primary accent `#00008C` navy, secondary blues `#4864ec`/`#1586c3`, red from the logo; background `#e5e5e5` with white cards; Open Sans 300/400/700; Croatian language; modest, competence-focused tone.

## 2. The ASC reference — what we reuse

ASC (the operator's ASC reference repository, checked out locally alongside this one — its path is intentionally not recorded here) is a no-build HTML/CSS/JS PWA on GitHub Pages with Supabase (Postgres + Auth + Realtime + Storage + Edge Functions). It contains **two generations**: a legacy hash-routed SPA (`js/app.js` + `css/styles.css`, 2,292 lines) and the current delivered MPA (`app/` + `app.css`, 1,032 lines, cleaner extraction).

**Reuse verbatim / near-verbatim:**
- `app/app.css` as the design-system base (cleaner of the two). Accent swap: ASC's Lava `#ff4e1b` → Akvaterm navy/red. **Warning: the accent is not fully tokenized — grep every `rgba(255,78,27,…)` and `#ff8a5c`/`#d6390c` literal.**
- SPA router skeleton from `js/app.js`: ROUTES regex table + lazy `import()` per view, `route()` with navSeq staleness guard, `mountFrame` once, teardown event contract, realtime → debounced `refreshActiveView`, `boot()`/`onAuthChange` uid-dedup.
- `js/db.js` discipline (not its queries): `fail()` error humanization, row-count verification on updates (RLS zero-row "success" guard), offline enqueue/replay, `subscribeToChanges()` multi-table channel, `signedPhotoUrls()` for private buckets.
- `schema.sql` scaffolding: profiles + `handle_new_user` + allowed_emails invite flow, role-tier RLS policy pattern, audit_events + trigger, soft-delete + `purge_deleted()`, realtime publication loop, storage-buckets-in-SQL, public_code sequence trick for quote numbers.
- Design discipline rules from the CSS comments: one accent; green `#2fbf5b` reserved for success/online; `--faint` never for informational text; `-ink` variants for AA text on tints; one depth cue per element; 44px tap targets; `prefers-reduced-motion` / `prefers-reduced-transparency` fallbacks everywhere.
- Dev workflow: `.claude/launch.json` static server (`http-server -c-1`), design-mockup-first iteration, service-worker CACHE version tied to an `APP_V` constant.

**Directly relevant discovery:** ASC already contains a **Gemini agent integration** — `js/agent.js`, `app/agent-gemini.js`, voice (`app/sluh.js`), and Supabase Edge Functions `asc-agent` / `asc-agent-demo`. Internals were not read in this pass; **read them before building the Akvaterm assistant** — the proxy pattern likely already exists in-house.

**Closest existing spatial-UI patterns:** the warehouse visualization CSS (`.zone-block/.rack/.slots`, styles.css:493-508, 986-1015) and `app/layout-edit.js` — read before designing the room-builder grid.

**Cautions:** don't mix the two CSS generations (conflicting token names); MPA pages carry ~100-line inline splash boilerplate each (extract a shared snippet instead); MPA is Croatian-only hardcoded — wire i18n from day one if bilingual matters; SW SHELL list + CACHE bump per new file, or installed clients run stale mixes; `assets/wheel.glb` exists but nothing loads it — there is **no working 3D pipeline in ASC to reuse**.

## 3. Room-builder engineering — the verdict

Industry pattern (Roomvo, Marazzi Stylizer, Tilelook, IKEA planners): **two UX modes** — upload-your-photo (requires server-side ML segmentation; NOT feasible statically) or **curated preset room scenes with pre-masked surfaces** (the standard retailer deployment, fully static-friendly). Tilelook adds a full 3D planner with laying patterns and grout controls.

**Recommended: two stages sharing one data model.**

- **Stage 1 — 2D preset scenes.** 3–5 photoreal bathroom/room scenes, each shipped as: base JPEG + per-surface alpha masks + per-surface 4-corner quads + a grayscale shading overlay. Canvas pipeline: tile the pattern → homography-warp into the quad (CSS `matrix3d` 4-corner technique, franklinta.com method; libs: perspective.js / Homography.js / perspective-transform — **check licenses**) → clip via `destination-in` → multiply the shading layer to keep real lighting. Asset authoring (masks/quads) is hours per scene and is the realism-critical work.
- **Stage 2 — Three.js parametric 3D room.** No-build via import map, pinned version (`three@0.185.1`), **vendored into `/vendor/three/` for CDN resilience**; import maps are Baseline (iOS 16.4+); three.js is WebGL2-only since r163 so non-POT tile photos repeat fine. Room = floor + 4 wall planes from dimensions; fixtures as boxes first, 2–3 small GLTFs later; one ambient + one directional light or RoomEnvironment; OrbitControls clamped; `setPixelRatio(min(dpr,2))`; antialias off on low-end; lazy `import()` the 3D module only when opened.
- **Shared texture pipeline — the "pattern cell".** Per product: offscreen canvas compositing tile photo inset by grout width on grout-colored background; 2x2/4x4 rotated/flipped variants for natural stone anti-repetition; running-bond/herringbone drawn into the cell. Use as `ctx.createPattern` (2D) and `THREE.CanvasTexture` with `RepeatWrapping`, `SRGBColorSpace`, max anisotropy (3D). **Physical scale:** `cellMeters = (tileM + groutM) × cellTileCount`; `texture.repeat.set(W/cellX, D/cellY)`. Keep `pixelsPerMm` metadata per product photo; validate against a ruler scene early.
- **Photo upload:** deliberately excluded from the deterministic path — but covered approximately by Gemini virtual staging (below). Never promise Roomvo-grade accuracy.

## 4. Gemini (state of the API, August 2026)

- **Models:** `gemini-3.6-flash` (GA, 1M ctx, free-tier eligible — the chat + vision workhorse); `gemini-3.5-flash-lite` (cheapest); `gemini-3.1-pro-preview` (preview only); image family "Nano Banana": `gemini-3.1-flash-image`, `gemini-3-pro-image` (up to 4K). Gemini 1.5 and 2.0 are shut down; Imagen 4 dies 2026-08-17.
- **SDK/API:** `@google/genai` (legacy `@google/generative-ai` unmaintained). Primary surface is the **Interactions API** (`interactions.create`, server-side state via `previous_interaction_id`, SSE streaming, parallel function calling, JSON-schema structured output); `generateContent` is legacy-but-supported. Sampling params deprecated — tune with `thinking_level` (use `low` for shop chat), leave temperature at default.
- **Key safety — hard deadline:** client-side keys are forbidden by docs AND **all standard API keys stop working September 2026**; use a **service-account-bound auth key from day one**. Architecture: browser → **Supabase Edge Function** (key in `supabase secrets`, `Deno.env.get`) → Gemini, SSE relayed back via ReadableStream. Safe fallback inside the function: plain `fetch` to the REST endpoint.
- **Capabilities mapped to features:** (a) catalog Q&A via function-calling tools (`search_tiles(color, style, price, size)`) executed as RLS-scoped Supabase queries, product cards returned as structured JSON; (b) room-photo analysis (style/color extraction → tile suggestions) — vision on 3.6-flash, free tier, 258 tokens per 768px tile, resize client-side to ~1024px; (c) **virtual staging**: room photo + tile swatch images → `gemini-3.1-flash-image` semantic edit ("replace only the floor tiles…"). It is **prompt-based photoreal re-render, not mask-based texture mapping** — no mask parameter exists; outputs carry SynthID watermark; UI must present it as an AI impression, not product-accurate.
- **Economics:** chat + vision demo runs on the free tier (~10 RPM class — debounce and handle 429s gracefully); **image generation has no free tier** — Tier 1 billing, ~$0.067 per staged render (1K) on 3.1-flash-image. Gate renders behind explicit user action. Free-tier data is used by Google for product improvement — add a consent notice for user photos, or run vision on paid tier.

## 5. Synthesis — why this composition wins

ASC proves the stack (no build step, Supabase, PWA, GitHub Pages-deployable, Croatian-first) and donates the design system, router, data discipline, schema scaffolding, and — unexpectedly — a working in-house Gemini proxy pattern. The visualizer research gives a deterministic, accurate, fully-static room builder (preset scenes now, 3D next) that no competitor feature forces onto servers. Gemini fills exactly the two gaps statics can't: conversational catalog guidance and approximate photo-upload staging. The three tracks compose without a single architectural conflict.
