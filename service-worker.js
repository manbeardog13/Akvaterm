/* Akvaterm Platform — service worker.
   Makes the app installable and loads the shell instantly. Network-first for
   same-origin files (so deploys show up right away), cache fallback when
   offline. Live data always comes from Supabase online; the seed catalog under
   data/ is precached so the demo runs fully offline.

   Five things are worth knowing before editing this file:
   1. VERSION is read from the registration query (?v=…), which js/app.js now
      supplies, so APP_V is the single source of truth for the cache name.
      See "Versioning".
   2. Precaching is best-effort but no longer silent: a SHELL entry that fails
      is reported. See "Install".
   3. The four vendored woff2 faces ARE in SHELL. They are ~79 KB total and
      render-blocking-ish (a missing display face is a visible reflow), so they
      are treated as shell, not as an optional extra. See "Fonts in SHELL".
   4. vendor/three/ and vendor/models/ are deliberately NOT in SHELL — they are
      fetched lazily on the first 3D open and pre-warmed in the background in
      two ordered stages once the network goes quiet. See "3D pre-warm".
   5. vendor/supabase/ (9 .mjs files, 258 794 B; 260 695 B counting its
      PROVENANCE.md) is the THIRD deliberate omission from SHELL, and unlike
      the other two it is not pre-warmed either. js/supabaseClient.js imports it
      only when js/config.js carries credentials, so precaching it would make
      every offline/demo install pay 253 KB for a library it never loads. It is
      runtime-cached by the generic same-origin handler on its first online use,
      and its absence degrades to local-only (localStorage) rather than to a
      failure — which is the app's documented zero-config mode anyway.
      docs/BUILD_CONTRACTS.md requires every such omission to be stated here;
      this item is that statement.

   There is NO cross-origin dependency left. Fonts are vendored under
   vendor/fonts/ and supabase-js under vendor/supabase/, so the worker only
   ever handles same-origin traffic plus the live Supabase API (which it never
   touches). See "Fetch". */

/* ============================== Versioning ================================
   The cache name and APP_V in js/app.js used to be two literals kept in step
   by comments alone, so a forgotten bump shipped silently.

   Now the cache name is DERIVED, never restated: CACHE = "akv-" + VERSION,
   and VERSION comes from the registration URL. THAT LANDED: js/app.js registers
   `./service-worker.js?v=${APP_V}`, so APP_V is the only version literal in the
   codebase and the cache name follows it by construction. FALLBACK_VERSION
   below is no longer a second source of truth — it is what a registration
   without the query (a hand-registered worker, a stale cached index.html
   running an older app.js) would fall back to. Keep it equal to APP_V anyway,
   so that path lands in the same cache instead of orphaning one.

   activate() still runs a best-effort drift check against the APP_V literal in
   js/app.js (see checkVersionDrift). With the ?v= registration in place it is
   permanently silent — which is the point: it now only speaks when something is
   genuinely wrong (a hand-registered worker, or a bad deploy pairing a new
   app.js with a cached old shell), instead of crying wolf on every activation.
   Never fatal: a failed check leaves activation untouched.

   A page may also postMessage {type:"akv:version"} to read this worker's
   version back (optionally passing its own as `v` for a logged comparison). */
const FALLBACK_VERSION = "v4";           // only for a registration carrying no ?v= — keep == APP_V
// BUG FIX 2026-08-03: was "v2" but APP_V in js/app.js line 92 is "v3". A hand-registered
// worker or a stale cached index.html running an older app.js would create orphaned
// caches (akv-v2 alongside akv-v3) instead of landing in the current cache. Synced to
// APP_V so all paths converge on one cache name.
const VERSION = new URL(self.location.href).searchParams.get("v") || FALLBACK_VERSION;
const CACHE = `akv-${VERSION}`;          // never write this name out by hand

/* Every shipped runtime file except the THREE deliberate omissions —
   vendor/three/, vendor/models/ (both below, under "3D pre-warm") and
   vendor/supabase/ (header item 5, config-gated and not pre-warmed).
   service-worker.js itself is intentionally absent — the browser's update
   machinery fetches it, and a cached copy of the worker fights that. Verified
   entry-by-entry over HTTP against the served tree; keep it that way when
   adding a file. */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./assets/icon.svg",
  "./data/catalog.seed.json",
  "./data/scenes.js",
  "./js/app.js",
  "./js/config.js",
  "./js/i18n.js",
  "./js/supabaseClient.js",
  "./js/db.js",
  "./js/domain.js",
  "./js/texture.js",
  /* js/scene2d.js REMOVED from SHELL 2026-08-03. The file was deleted when the
     hand-drawn 2D pipeline was retired, but its SHELL entry stayed - so every
     install has been requesting a 404 since. install() uses allSettled, so it
     degraded quietly rather than failing, which is exactly why it survived: a
     precache list can rot without ever raising anything. Verified against the
     tree; this was the only stale entry. */
  "./js/room3d.js",
  "./js/terma.js",
  "./js/qrshare.js",
  "./js/splash.js",   // post-login transition; lazy-imported, so precached rather than blocking
  "./vendor/qr/qrcode.mjs",   // 58 KB — small enough to precache; keeps offline sharing working

  /* ============================ Fonts in SHELL ==========================
     The Iris type pairing (docs/DESIGN_SYSTEM.md) is Anton for display and
     Figtree for text, both vendored — vendor/fonts/PROVENANCE.md records the
     URLs, byte counts and SHA-256 of every file, and both are SIL OFL 1.1.

     These entries are in SHELL, not runtime-cached, for two reasons:
       • they are render-blocking-ish. font-display:swap means a cold, offline
         start without them paints the fallback stack and then reflows when the
         real faces arrive.
       • they are small: 201200 bytes of woff2 across the six faces, a fraction
         of what vendor/three costs. There is nothing to save by deferring them.

     ⚠ UPDATED 2026-08-02 with the house type change (docs/HOUSE_STANDARD.md).
     The app's faces are now Sora (display) + Inter (text). ANTON IS NO LONGER
     PRECACHED: nothing references it any more, so precaching it would have
     shipped 50 KB of dead weight to every visitor while the faces the app
     actually renders were fetched from the network — which offline is no fetch
     at all. FIGTREE IS STILL HERE, and not by oversight: the wordmark is
     exempt from the type change and is pinned to it through --font-wordmark,
     so dropping it would render the logo in a fallback face offline.

     The `latin-ext` slices are NOT optional: č ć ž š đ Č Ć Ž Š Đ live in Latin
     Extended-A and the `latin` slice alone renders every Croatian diacritic as
     tofu (proven by cmap parsing — see PROVENANCE.md). Never drop them. */
  "./vendor/fonts/fonts.css",
  "./vendor/fonts/sora-latin-wght-normal.woff2",           // 25284 B — display
  "./vendor/fonts/sora-latin-ext-wght-normal.woff2",       // 12156 B — carries Č Š Ž
  "./vendor/fonts/inter-latin-wght-normal.woff2",          // 48256 B — text
  "./vendor/fonts/inter-latin-ext-wght-normal.woff2",      // 85068 B — carries č š ž ć đ
  "./vendor/fonts/figtree-latin-wght-normal.woff2",        // 20156 B — WORDMARK ONLY
  "./vendor/fonts/figtree-latin-ext-wght-normal.woff2",    // 10280 B — WORDMARK ONLY

  "./js/views/katalog.js",
  "./js/views/proizvod.js",
  "./js/views/dizajner.js",
  "./js/views/soba3d.js",
  "./js/views/savjetnik.js",
  "./js/views/favoriti.js",
  "./js/views/dizajni.js",
  "./js/views/prijava.js",
  // BUG FIX 2026-08-03: prijava.js is the mandatory entry point for cold starts.
  // Without it in SHELL, a cache miss on first load (or after cache clear) hits an
  // offline error card 'Nešto je pošlo po zlu' because the app redirects to #/prijava
  // when offline and the view fails to fetch. This 2-3 KB module must be precached.
  "./js/views/zasluge.js",
  // BUG FIX 2026-08-03: zasluge.js (credits page) is routable via #/zasluge but was
  // missing from SHELL. Offline navigation to credits fails with 'Failed to fetch
  // ./js/views/zasluge.js' error. This small module supports the routable endpoint
  // and must be precached to work offline.
];

/* ============================== 3D pre-warm ===============================
   DELIBERATE DEVIATION from "SHELL lists every shipped file"
   (docs/BUILD_CONTRACTS.md), covering two directories.

   ── Stage 1: vendor/three (2302788 B / 2.2 MB across seven files) ────────
   That is roughly 3x the whole precached shell (SHELL measured 798684 B over
   HTTP on 2026-08-02, fonts included — re-measure rather than trusting that
   number, it moves with every edit to the app's own modules and has already
   drifted once from a documented 773717; the 2.2 MB does not move, because
   three.js is pinned). Putting it in SHELL would
   make every install, including the many users who never open the 3D tab, pay
   2.2 MB before the worker is ready.

   ── Stage 2: vendor/models (823008 B / 804 KiB across 25 .glb files) ──────
   The CC0 fixture library — baths, WCs, basins, kitchen modules, doors,
   windows, an AC outdoor unit (vendor/models/PROVENANCE.md). The decision, and
   the reasoning, so nobody has to re-derive it:

     • NOT in SHELL. 804 KB is 5.6x the whole booting app. Install must not
       block on it, and a first-time visitor who only wants the catalogue would
       pay for a 3D library they may never open. Worse, SHELL is a hard
       dependency in spirit: 25 more entries is 25 more ways for one bad deploy
       to log a precache failure.
     • NOT deferred to first use only either. The models are what makes the 3D
       room feel furnished; fetching 804 KB at the moment the user taps "3D
       soba" puts that whole download in front of the thing they asked for, on
       top of three.js.
     • So: pre-warmed on idle, in a SECOND stage that runs only after stage 1
       has completed. The ordering is the point — a .glb is useless without a
       loader, so spending a user's bandwidth on models before three.js is in
       the cache would be strictly worse than not pre-warming at all.
     • Fetched in batches of PREWARM_BATCH rather than all 25 at once, so the
       background fill cannot saturate a connection the app might still want.
     • First-3D-open still works without any of this: the generic same-origin
       fetch handler below is network-first and caches clean 200s, so opening
       the 3D tab populates the cache as a side effect either way. The pre-warm
       only moves that cost earlier, into a quiet moment.

   ── Common to both stages ────────────────────────────────────────────────
   Fetched once the network has been quiet for PREWARM_IDLE_MS — i.e. after the
   app has finished booting, not during it.

   Skipped entirely on Save-Data or a 2G-class connection: a background 2.9 MB
   download is exactly what those signals ask us not to do. Those users still
   get 3D on demand, they just pay for it when they ask for it.

   A page can trigger the same work explicitly with
   postMessage({type:"akv:prewarm"}) — e.g. from requestIdleCallback after
   load, which is more precise than this worker's network-idle heuristic. */
/* Exactly what js/room3d.js imports, plus GLTFLoader's own two dependencies —
   it does `import { toTrianglesDrawMode } from '../utils/BufferGeometryUtils.js'`
   and `import { clone } from '../utils/SkeletonUtils.js'`, so caching the
   loader without them would still fail offline. Byte counts from the served
   tree; total 2302788 B / 2249 KiB. */
const THREE_ASSETS = [
  "./vendor/three/three.module.js",                          //  650153 B
  "./vendor/three/three.core.js",                            // 1443056 B
  "./vendor/three/addons/controls/OrbitControls.js",         //   40504 B
  "./vendor/three/addons/environments/RoomEnvironment.js",   //    4960 B
  "./vendor/three/addons/loaders/GLTFLoader.js",             //  114959 B
  "./vendor/three/addons/utils/BufferGeometryUtils.js",      //   37621 B — GLTFLoader dep
  "./vendor/three/addons/utils/SkeletonUtils.js",            //   11535 B — GLTFLoader dep
];

/* The whole vendor/models directory, byte counts from the served tree. Keep in
   step with vendor/models/PROVENANCE.md — every file there is CC0 1.0 and
   loadable by plain GLTFLoader (no Draco, no KTX2, no meshopt, no sidecars). */
const MODEL_ASSETS = [
  "./vendor/models/ac-outdoor-unit.glb",              // 38900 B
  "./vendor/models/bathroom-cabinet-tall.glb",        // 11664 B
  "./vendor/models/bathroom-mirror.glb",              // 14780 B
  "./vendor/models/bathtub-freestanding.glb",         // 42848 B
  "./vendor/models/bathtub.glb",                      // 73680 B
  "./vendor/models/door-leaf.glb",                    // 24320 B
  "./vendor/models/door.glb",                         // 16560 B
  "./vendor/models/kitchen-cabinet-base.glb",         // 17840 B
  "./vendor/models/kitchen-cabinet-corner.glb",       // 11092 B
  "./vendor/models/kitchen-cabinet-drawer.glb",       // 23804 B
  "./vendor/models/kitchen-cabinet-upper.glb",        // 12452 B
  "./vendor/models/kitchen-fridge.glb",               // 26260 B
  "./vendor/models/kitchen-hood.glb",                 //  9208 B
  "./vendor/models/kitchen-sink-unit.glb",            // 44620 B
  "./vendor/models/kitchen-stove.glb",                // 97952 B
  "./vendor/models/shower-enclosure.glb",             // 84228 B
  "./vendor/models/toilet-modern.glb",                // 35092 B
  "./vendor/models/toilet-square.glb",                // 30296 B
  "./vendor/models/toilet.glb",                       // 32888 B
  "./vendor/models/towel-rail.glb",                   // 31228 B
  "./vendor/models/washbasin-pedestal.glb",           // 40504 B
  "./vendor/models/washbasin-vanity-wall.glb",        // 19224 B
  "./vendor/models/washbasin-vanity.glb",             // 54396 B
  "./vendor/models/window-large.glb",                 // 20180 B
  "./vendor/models/window-small.glb",                 //  8992 B
];                                                    // total 823008 B

/* Ordered. A later stage never starts before the one in front of it is fully
   cached, because a later stage is useless without it. */
const PREWARM_STAGES = [
  { name: "three", urls: THREE_ASSETS },
  { name: "models", urls: MODEL_ASSETS },
];

const PREWARM_IDLE_MS = 6000;        // quiet network for this long = boot is over
const MAX_PREWARM_ATTEMPTS = 2;      // never retry a broken deploy forever
const PREWARM_BATCH = 4;             // keep the background fill off the app's throat

let prewarmTimer = 0;
let prewarmRunning = false;
const prewarmState = PREWARM_STAGES.map(() => ({ attempts: 0, done: false }));

function dataSaverOn() {
  // WorkerNavigator.connection is Chromium-only; absent elsewhere, which is
  // treated as "no objection".
  const c = self.navigator && self.navigator.connection;
  if (!c) return false;
  return c.saveData === true || c.effectiveType === "2g" || c.effectiveType === "slow-2g";
}

/** Index of the stage that should run next, or -1 when there is nothing left
 *  to do — either every stage is cached, or the first unfinished one has spent
 *  its attempts. Returning -1 in the second case is what stops a broken deploy
 *  from re-arming the idle timer forever. */
function nextPrewarmStage() {
  for (let i = 0; i < PREWARM_STAGES.length; i++) {
    if (prewarmState[i].done) continue;
    return prewarmState[i].attempts < MAX_PREWARM_ATTEMPTS ? i : -1;
  }
  return -1;
}

/** (Re)start the idle countdown. Every same-origin request pushes it back, so
 *  the pre-warm can only fire once the app has stopped asking for things. */
function schedulePrewarm() {
  if (prewarmRunning || nextPrewarmStage() < 0) return;
  if (dataSaverOn()) return;
  clearTimeout(prewarmTimer);
  prewarmTimer = setTimeout(prewarmLazyAssets, PREWARM_IDLE_MS);
}

/** Cache whatever of `urls` is missing, PREWARM_BATCH at a time. Resolves with
 *  the list that could not be fetched; never rejects. */
async function fillCache(cache, urls) {
  const missing = [];
  for (const url of urls) {
    if (!(await cache.match(url))) missing.push(url);
  }
  const failed = [];
  for (let i = 0; i < missing.length; i += PREWARM_BATCH) {
    const batch = missing.slice(i, i + PREWARM_BATCH);
    const results = await Promise.allSettled(
      batch.map((u) => cache.add(new Request(u, { cache: "no-cache" })))
    );
    for (let j = 0; j < batch.length; j++) {
      if (results[j].status === "rejected") failed.push(batch[j]);
    }
  }
  return failed;
}

/** Best-effort background fill of the lazy 3D assets, stage by stage. Only
 *  fetches what is missing, never rejects, never touches the response path.
 *
 *  The attempt cap lives HERE, not only in schedulePrewarm(), because the
 *  postMessage path calls this directly — a page that posts "akv:prewarm" in a
 *  loop must not be able to retry a broken deploy forever. */
async function prewarmLazyAssets() {
  if (prewarmRunning) return;
  prewarmRunning = true;
  try {
    const c = await caches.open(CACHE);
    for (;;) {
      const i = nextPrewarmStage();
      if (i < 0) return;
      const stage = PREWARM_STAGES[i];
      const state = prewarmState[i];
      state.attempts++;
      const failed = await fillCache(c, stage.urls);
      if (failed.length) {
        // Offline, or a genuinely missing file. Stop here rather than spending
        // the user's bandwidth on a stage whose prerequisite is incomplete;
        // the next idle window retries, once.
        console.warn(
          `[akv-sw ${VERSION}] pre-warm "${stage.name}" incomplete ` +
          `(${failed.length}/${stage.urls.length}):`, failed
        );
        return;
      }
      state.done = true;
    }
  } catch (err) {
    console.warn(`[akv-sw ${VERSION}] pre-warm failed:`, err);
  } finally {
    prewarmRunning = false;
  }
}

/* ============================== Install ==================================
   Best-effort precache — one 404 during a deploy must not poison install and
   lock users out of an update. But "best effort" used to mean "no signal at
   all": the worker activated with an incomplete shell and the hole only
   surfaced later as a view that was broken offline. Now every rejected entry
   is named in the console, so a missing file is visible on the first load
   after the bad deploy instead of in a support ticket weeks later.

   cache:"no-cache" revalidates past the host's HTTP cache so a fresh SW never
   precaches a stale (version-skewed) shell. */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "no-cache" })))))
      .then((results) => {
        const failed = SHELL.filter((_, i) => results[i].status === "rejected");
        if (failed.length) {
          console.warn(
            `[akv-sw ${VERSION}] precache incomplete — ${failed.length}/${SHELL.length} SHELL ` +
            `entries failed; these views will break offline:`, failed
          );
          for (let i = 0; i < results.length; i++) {
            if (results[i].status === "rejected") {
              console.warn(`[akv-sw ${VERSION}]   ${SHELL[i]} — ${results[i].reason}`);
            }
          }
        }
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        checkVersionDrift();   // fire-and-forget; never blocks activation
        schedulePrewarm();
      })
  );
});

/* Read the APP_V literal out of js/app.js and compare it with this worker's
   VERSION. It is a diagnostic, not a gate: any failure (offline, refactored
   declaration, no match) is silent, and nothing about caching depends on the
   result.

   Now that js/app.js registers with ?v=${APP_V} this can only fire when the
   app.js on the network disagrees with the app.js that registered this worker
   — i.e. a genuinely skewed deploy, or a worker registered by hand without the
   query. It is deliberately KEPT rather than deleted for exactly that case. */
async function checkVersionDrift() {
  try {
    const res = await fetch("./js/app.js", { cache: "no-cache" })
      .catch(() => caches.match("./js/app.js"));
    if (!res || !res.ok) return;
    const m = /APP_V\s*=\s*["']([^"']+)["']/.exec(await res.text());
    if (!m) return;
    if (m[1] !== VERSION) {
      console.warn(
        `[akv-sw] version drift: cache is "${CACHE}" (v=${VERSION}) but js/app.js ` +
        `declares APP_V="${m[1]}". Bump both, or register the worker as ` +
        `./service-worker.js?v=\${APP_V} so they cannot drift.`
      );
    }
  } catch { /* diagnostics must never affect activation */ }
}

/* Page → worker channel. Both messages are optional conveniences; the worker
   is fully functional without either. */
self.addEventListener("message", (e) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "akv:prewarm") {
    // Explicit "the page is idle now" — more precise than our own heuristic.
    clearTimeout(prewarmTimer);
    e.waitUntil(prewarmLazyAssets());
    return;
  }

  if (msg.type === "akv:version") {
    if (typeof msg.v === "string" && msg.v !== VERSION) {
      console.warn(`[akv-sw] version drift: worker "${VERSION}" vs page APP_V "${msg.v}".`);
    }
    e.source?.postMessage({ type: "akv:version", v: VERSION, cache: CACHE });
  }
});

// Only ever cache clean, complete, same-origin 200s — never opaque, redirected,
// or error responses (any of those, served back later, can wedge the app).
function cacheable(res) {
  return res && res.ok && res.type === "basic" && !res.redirected;
}

/* ============================== Fetch ====================================
   Cross-origin traffic is never intercepted. This used to carry a CDN
   allowlist (fonts.googleapis.com / fonts.gstatic.com / cdn.jsdelivr.net) so
   an offline cold boot could still find its webfont and, transitionally,
   supabase-js. Both dependencies are now vendored — the Iris faces live under
   vendor/fonts/ (SHELL, above) and supabase-js under vendor/supabase/ — so the
   allowlist described a path that no longer exists and has been removed rather
   than left to rot. The only cross-origin traffic left is the Supabase API,
   which must stay live-only: a cached POST response to the Terma function
   would be worse than an error. */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Any same-origin request means the app is still busy — push the 3D pre-warm
  // further out so it can never compete with the boot burst. (Worker-initiated
  // fetches do not fire this event, so the pre-warm cannot defer itself.)
  schedulePrewarm();

  // Full page loads (incl. pull-to-refresh): network-first; on failure fall
  // back to the cached app shell. This is a single-page hash-routed app, so
  // index.html is the ONLY thing we ever answer a navigation with.
  if (req.mode === "navigate") {
    // Only a navigation to the shell itself may overwrite the cached shell —
    // a 200 for any other same-origin URL (a stray asset opened in the address
    // bar) must never replace index.html for offline users.
    const isShell = url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
    e.respondWith(
      // Revalidate with the server (bypass the host's HTTP cache) so a fresh
      // deploy shows up immediately. Fetch by URL because a navigate-mode
      // Request can't take a cache override.
      fetch(req.url, { cache: "no-cache" })
        .then((res) => {
          if (cacheable(res) && isShell) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {}); }
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Scripts / styles / images / data (incl. vendor/three on first 3D open):
  // network-first, cache clean 200s. CRUCIAL: if it's not cached and the
  // network fails, let it fail — do NOT fall back to index.html. Serving HTML
  // for a .js request makes the browser throw a parse error and white-screens
  // the whole app.
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
