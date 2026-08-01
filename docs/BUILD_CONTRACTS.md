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
  empty; lazy-load @supabase/supabase-js from vendor or CDN only when configured).
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
  (kitchen), dnevni-boravak (living room).
- `js/room3d.js` — lazy module: `export async function mountRoom(el, {room, assignments,
  products, onReady}) -> {dispose(), setSurface(surfaceId, product, opts), setDims(w,d,h),
  setFixtures(list)}`. Imports three via the import map ('three', 'three/addons/…') which
  index.html defines pointing at /vendor/three/.
- `js/terma.js` — `export async function* chat(messages, {signal}) -> yields {delta:string}`;
  `export async function analyzePhoto(file) -> {styleSummary, suggestedProductIds[]}`;
  both throw TermaUnavailable when CONFIG.supabaseUrl is empty → views show graceful static
  fallback. `export class TermaUnavailable extends Error {}`.
- `js/app.js` — hash router, ASC pattern: ROUTES table of `[regex, () => import('./views/x.js')]`;
  view modules export `async render(container, params)` and optional `teardown()`; app.js owns
  the frame (header w/ logo wordmark AKVA|TERM, nav tabs, main, toast), calls `t()` for chrome,
  exposes `window.AKV = {toast(msg)}`. Routes: `#/` (katalog home), `#/katalog/:categoryId`,
  `#/proizvod/:id`, `#/dizajner`, `#/dizajner/:sceneId`, `#/soba3d`, `#/savjetnik`,
  `#/favoriti`, `#/dizajni` (saved designs).

## Data shapes

Product: `{id, category, name, brand, textureKind, baseColorHex, accentColorHex?, tileSizeMm:[w,h]|null,
glossy:bool, priceM2:number|null, priceUnit:number|null, unit:'m2'|'kom', desc, demo:true}`
— tiles have tileSizeMm + priceM2; equipment (radiators, AC, faucets, WC…) has priceUnit +
sizeCm for display. ~40+ products, Croatian names, plausible EUR prices, brands from Akvaterm's
partner list for equipment (Viessmann, Daikin, Mitsubishi, Wilo, Grundfos…) and neutral invented
brands for tiles (e.g. "Adria Ceramica"). All `demo:true`.

Design: `{id, kind:'scene'|'room3d', refId, name, assignments:{[surfaceId]:{productId,
pattern, groutColorId, groutWidthMm}}, room?:{widthM,depthM,heightM,fixtures:[{type,x,z,rotY}]},
savedAt}`.

Assignments always resolve through `buildPatternCell`; 2D and 3D share it.

## Visual identity (from ASC discipline + Akvaterm brand)

Tokens in `css/styles.css` `:root`: `--accent:#00008C; --accent-2:#1586c3; --brand-red:#d6252e;
--ok:#2fbf5b;` neutral grays from ASC app.css; radius/shadow/spacing scale copied from ASC
app.css; Open Sans via Google Fonts with system-ui fallback. Header wordmark: AKVA in navy,
TERM in red, italic bold. ASC rules kept: 44px tap targets, one depth cue per element, green
only for success, AA contrast, prefers-reduced-motion fallbacks. Bottom tab bar on mobile,
top nav on desktop (ASC app shell pattern). Croatian labels: Katalog, Dizajner, 3D soba,
Savjetnik, Više.

## Conventions

- Every view: `render(container, params)` builds DOM via template literals + addEventListener
  (ASC style), no frameworks. Cleanup in `teardown()`.
- localStorage keys prefixed `akv:` (favorites `akv:fav`, designs `akv:designs`, consent
  `akv:terma-consent`).
- Canvas design space for scenes: 1000x700, letterboxed responsively.
- Service worker SHELL must list every shipped file; CACHE name `akv-v1` tied to `APP_V` in
  app.js.
- No console.error left in happy paths; typed feel: helpers return null/[] not throws (except
  TermaUnavailable).
