# Build contracts — every module keeps these interfaces exactly

Binding for all build agents. Deviating from a signature here breaks another agent's work.
Language: UI text Croatian (via i18n keys), code identifiers English. No build step: plain ES
modules, relative imports, nothing from npm at runtime except vendored files under /vendor/.

## Module map and exports

- `js/config.js` — `export const CONFIG = { supabaseUrl: '', supabaseAnonKey: '', appUrl: '',
  termaFunction: 'terma' }` (empty strings = offline/demo mode; everything must work without
  Supabase).
- `js/i18n.js` — `export function t(key, vars?) -> string`; `export const LANG = 'hr'`.
  Missing key returns the key itself (never throws).
- `js/supabaseClient.js` — `export function getSupabase() -> client|null` (null when CONFIG
  empty; lazy-load @supabase/supabase-js from `/vendor/supabase/` — vendored only, no CDN
  fallback, since `import()` carries no integrity check — and only when configured).
- `js/db.js` — all async, all resolve even offline (localStorage fallback):
  `listProducts(filter?) -> Product[]` (from data/catalog.seed.json, cached),
  `getProduct(id) -> Product|null`,
  `listFavorites() -> string[]`, `toggleFavorite(id) -> string[]`,
  `listDesigns() -> Design[]`, `saveDesign(design) -> Design` (assigns id+savedAt),
  `getDesign(id) -> Design|null`, `deleteDesign(id) -> void`.
- `js/domain.js` — pure, no DOM:
  `export const CATEGORIES = [{id:'keramika'|'sanitarije'|'armature'|'grijanje'|'klima',
  icon:string(emoji), i18nKey}]`;
  `export const PATTERNS = [{id:'grid'|'runningBond'|'herringbone'|'diagonal', i18nKey}]`;
  `export const GROUT_COLORS = [{id, hex, i18nKey}]` (min: bijela #e8e6e1, siva #9a9a9a,
  antracit #3a3a3a);
  `cellMeters(product, pattern, groutWidthMm) -> [w,h]`,
  `pricePerRoom(product, areaM2) -> number`, `formatEur(n) -> string ('1.234,56 €')`,
  `newId(prefix) -> string`.
- `js/texture.js` — procedural, deterministic (seeded by product.id, mulberry32 PRNG):
  `buildPatternCell(product, {pattern, groutColorHex, groutWidthMm, scalePxPerMm}) ->
  {canvas: HTMLCanvasElement, cellSizeMm: [w,h]}` — the repeatable unit incl. grout;
  `swatchDataUrl(product, sizePx=256) -> string` (cached);
  `fillStyles`: implement generators keyed by `product.textureKind`:
  'ceramic' | 'marble' | 'travertine' | 'concrete' | 'woodPlank' | 'terrazzo' | 'subway' |
  'hexMosaic' | 'metal' | 'flat' (flat = plain color w/ subtle noise, for non-tile products).
- `js/scene2d.js` — `renderScene(canvas, scene, assignments, products) -> void` draws the whole
  illustrated scene; `hitSurface(scene, canvasX, canvasY) -> surfaceId|null`.
  Scenes are PROCEDURALLY DRAWN (vector illustration in canvas, not photos): each scene module
  draws its own room in 2-point-ish perspective and exposes exact surface quads.
- `data/scenes.js` — `export const SCENES = [{id, i18nKey, draw(ctx,w,h,assignments,texFor),
  surfaces:[{id, kind:'floor'|'wall', quad:[[x,y]x4 in 0..1000x0..700 design space],
  realSizeM:[w,h], defaultProductId}]}]` — at least 3 scenes: kupaonica (bathroom), kuhinja
  (kitchen), dnevni-boravak (living room). Five ship today; `mala-kupaonica` and `predsoblje`
  were added after this contract was written. A view must resolve a scene's label through
  `t(sc.i18nKey, <local Croatian fallback>)` — `js/i18n.js` has entries for the original three
  only, and the fallback map in `js/views/dizajner.js` is what keeps the other two Croatian.
- `js/room3d.js` — lazy module: `export async function mountRoom(el, {room, assignments,
  products, onReady}) -> {dispose(), setSurface(surfaceId, product, opts), setDims(w,d,h),
  setFixtures(list)}`. Imports three via the import map ('three', 'three/addons/…') which
  index.html defines pointing at /vendor/three/, and loads fixture geometry with `GLTFLoader`
  from `/vendor/models/`.
  Those four methods are the binding contract and are unchanged. The module has since grown an
  **additive** surface, which callers may use but no other module may assume:
  `getFixtures()`, `getCatalogue()`, `selectByIndex(i)`, `rotateSelected(delta)`,
  `clearSelection()`, plus the module-level `export const FIXTURE_CATALOGUE` (read-only
  `{type, hr, group:'kupaonica'|'kuhinja'|'ostalo', sizeM:[w,h,d], mount:'floor'|'wall'}[]`,
  27 entries) and `export const FIXTURE_TYPE_IDS`.
  Fixture drag is hand-rolled against `THREE.Plane`/`Raycaster`: `DragControls` and
  `TransformControls` are both disqualified (camera-relative drag plane, sub-44px handles, and
  both hard-set `touch-action:none`, which would break the page-scroll contract). Two fixtures —
  `radijator` and `klima` — are procedural geometry with no `.glb`, because no CC0 model of
  either exists; the searches are recorded in `vendor/models/PROVENANCE.md`.
- `js/terma.js` — `export async function* chat(messages, {signal}) -> yields {delta:string}`;
  `export async function analyzePhoto(file) -> {styleSummary, suggestedProductIds[]}`;
  both throw TermaUnavailable when CONFIG.supabaseUrl is empty → views show graceful static
  fallback. `export class TermaUnavailable extends Error {}`. Conversation state is an opaque
  handle minted by the Edge Function — never a raw provider interaction id. Errors carry
  `.status` and a Croatian `.friendly` string.
  As shipped, both signatures are wider than the line above and views rely on the extra fields:
  `chat` also yields `{delta:'', products:[productId,…]}` when the model ran `search_products`
  server-side; `analyzePhoto` also returns `{colors:['#rrggbb',…], suggestedFilters}`. The module
  further exports `isConfigured()`, `resetChat()`, `fileToResizedJpeg(file, maxPx=1024)` and
  `stageRoom({roomBase64, swatchBase64, productName, surface}) -> {imageBase64, mimeType}` (the
  paid tier). **Colour strings from the vision model are attacker-influenceable** — text baked
  into an image is a standard injection vector — so they are validated as `#rrggbb` in the Edge
  Function, again here, and once more at the DOM boundary in `js/views/savjetnik.js`, where they
  are assigned through the CSSOM rather than interpolated into a `style` attribute.
- `supabase/functions/terma/` — spends money, so it must always: require a bearer token, honour
  the `ALLOWED_ORIGINS` allowlist (never `*`), consume a per-identity quota from Postgres and
  **fail closed** if it cannot, cap body/message/image sizes, validate model output that reaches
  the DOM (colours are `#rrggbb` or dropped), and refuse the paid `staging` action for an
  unauthenticated caller.
- `js/app.js` — hash router, ASC pattern: ROUTES table of `[regex, () => import('./views/x.js')]`;
  view modules export `async render(container, params)` and optional `teardown()`; app.js owns
  the frame (header w/ logo wordmark AKVA|TERM, nav tabs, main, toast), calls `t()` for chrome,
  exposes `window.AKV = {toast(msg)}`. Routes: `#/` (katalog home), `#/katalog/:categoryId`,
  `#/proizvod/:id`, `#/dizajner`, `#/dizajner/:sceneId`, `#/soba3d`, `#/savjetnik`,
  `#/favoriti`, `#/dizajni` (saved designs).

## Data shapes

Product: `{id, category, name, brand, textureKind, baseColorHex, accentColorHex?, tileSizeMm:[w,h]|null,
glossy:bool, priceM2:number|null, priceUnit:number|null, unit:'m2'|'kom', desc, sizeCm?, demo:true}`
— tiles have `tileSizeMm` + `priceM2`; equipment (radiators, AC, faucets, WC…) has `priceUnit`,
`tileSizeMm:null` and **`sizeCm`: a display STRING in `'w×h×d'` form** (e.g. `"36×53×33"`), not an
array and not numbers — `proizvod.js` renders it verbatim followed by the `cm` unit. It is a
display field only: nothing computes with it, the Postgres `products` table has no column for it,
and tiles do not carry it. ~40+ products, Croatian names, plausible EUR prices, brands from
Akvaterm's partner list for equipment (Viessmann, Daikin, Mitsubishi, Wilo, Grundfos…) and neutral
invented brands for tiles (e.g. "Adria Ceramica"). All `demo:true`.

Design: `{id, kind:'scene'|'room3d', refId, name, assignments:{[surfaceId]:{productId,
pattern, groutColorId, groutWidthMm}}, room?:{widthM,depthM,heightM,fixtures:[{type,x,z,rotY,ax,az}]},
savedAt}` — a fixture's `type` indexes `FIXTURE_CATALOGUE` in `js/room3d.js`, `x`/`z` are metres
from the W and N walls, `rotY` is radians, and `ax`/`az` ∈ {-1,0,1} record which wall it is
snapped to so it re-anchors correctly when the room is resized. `ax`/`az` are optional on read
(0/0 when absent) — old saved designs must keep loading.

Assignments always resolve through `buildPatternCell`; 2D and 3D share it.

## Visual identity — the "Iris" design system

**Superseded:** the navy `#00008C` / red `#d6252e` / Open Sans identity described here previously
is retired. `docs/DESIGN_SYSTEM.md` is now the authority on colour and type; this section states
only what is binding between modules.

Palette tokens live once in `css/styles.css` `:root` and are referenced everywhere else through
`var()` — the ASC hardcoded-literal lesson still applies, and it applies to a view's scoped
`<style>` block too. The five sampled swatches plus the supporting photograph tones are listed in
`docs/DESIGN_SYSTEM.md`; **they were pixel-sampled from the reference image and must not be
adjusted by eye.** Any shade not in that set is *derived* and ships with its computed contrast
ratio in a comment beside it.

Type: `vendor/fonts/fonts.css` defines `--font-display` (Anton) and `--font-text` (Figtree) and
the `.t-*` role classes. It must be linked from `index.html` **before** `css/styles.css`. Nothing
may reference `fonts.googleapis.com` or `fonts.gstatic.com` at runtime. Both `latin` and
`latin-ext` slices of both families must be deployed: the Croatian diacritics live only in
`latin-ext`.

Binding rules for any module that paints:

- **Contrast is measured, not judged.** Every text/background pair ≥ 4.5:1 (≥ 3:1 only for
  ≥ 18.66px bold). For a translucent surface, measure against its **worst-case composite** — the
  panel over a pure-black backdrop — not against whatever happens to be behind it today. Record
  the number in a comment.
- **Glass budget:** at most 2–3 `backdrop-filter` surfaces on screen. The top bar and the tab bar
  are the standing pair; a floating panel or modal *replaces* one rather than adding a fourth.
  `blur()` is never animated.
- **Four degradation paths ship on every glass surface**, all landing on the same opaque tint so
  nothing reflows: `@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:…))`,
  `prefers-reduced-transparency: reduce`, `prefers-contrast: more` + `forced-colors: active`, and
  `prefers-reduced-motion: reduce`.
- **Safari:** write `-webkit-backdrop-filter` with **literal** values (it drops the declaration
  when it contains `var()`), and put it *before* the unprefixed property — Chrome treats the two
  as aliases, so last-one-wins, and this ordering leaves every engine that understands the
  standard property using the token.
- **Anton clipping guard:** the vendored face's Croatian diacritics measure 1.1094em ascent +
  0.0156em descent, taller than its declared ascender, so the ink leaves the line box at any
  line-height. Anton headings need line-height ≥ 1.05 *and* `overflow: visible` *and* enough
  `padding-top` (≈ 0.18em at line-height 1.12) to contain the diacritic, and must never sit in a
  clipping/`overflow:hidden` box. Figtree is unaffected.

Kept from ASC unchanged: 44px tap targets, one depth cue per element, green only for success,
`--faint` never for informational text, `-ink` variants for text on tints. Bottom tab bar on
mobile, top nav on desktop. Header wordmark AKVA | TERM. Croatian labels: Katalog, Dizajner,
3D soba, Savjetnik, Više.

## Conventions

- Every view: `render(container, params)` builds DOM via template literals + addEventListener
  (ASC style), no frameworks. Cleanup in `teardown()`.
- localStorage keys prefixed `akv:` (favorites `akv:fav`, designs `akv:designs`, consent
  `akv:terma-consent`).
- Canvas design space for scenes: 1000x700, letterboxed responsively.
- Service worker SHELL must list every shipped file needed to boot and run the app, and **every
  entry must be verified to resolve over HTTP against the served tree** before it is committed —
  one 404 turns install into a silent partial precache. The four vendored `woff2` faces that
  `vendor/fonts/fonts.css` actually `@font-face`-references, and `fonts.css` itself, count as
  shell: ~79 KB, and their absence is a visible reflow. The eight unused static Figtree instances
  do not.
  **Explicit exception:** large lazily-imported assets under `/vendor/` may be left out of the
  precache and runtime-cached on first use instead — keeping install fast matters more than a
  first-visit-offline 3D tab. Today that is `vendor/three/` (2 302 788 B, seven files: the two
  core modules plus OrbitControls, RoomEnvironment, GLTFLoader and GLTFLoader's own two utility
  imports) and `vendor/models/` (823 008 B, 25 files), which are instead pre-warmed in the
  background in two ordered stages once the network has been quiet — three.js first, because a
  `.glb` is useless without a loader — skipped entirely on `Save-Data`/2G, capped at two
  attempts per stage, and fetched four at a time so the fill cannot saturate the connection.
  `vendor/supabase/` is loaded only when `js/config.js` is filled in. Any such omission must be
  stated in the service-worker header comment, so the deviation is deliberate and readable rather
  than an oversight.
  The CACHE name is **derived, never restated**: `CACHE = "akv-" + VERSION`, where `VERSION`
  comes from the registration query (`./service-worker.js?v=${APP_V}`) and falls back to
  `FALLBACK_VERSION` in the worker. Until the page registers with `?v=`, `FALLBACK_VERSION` and
  `APP_V` in `js/app.js` must be bumped together — `activate()` logs a console warning when they
  drift, which is a diagnostic, not a gate.
- No console.error left in happy paths; typed feel: helpers return null/[] not throws (except
  TermaUnavailable).
