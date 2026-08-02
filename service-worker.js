/* Akvaterm Platform — service worker.
   Makes the app installable and loads the shell instantly. Network-first for
   same-origin files (so deploys show up right away), cache fallback when
   offline. Live data always comes from Supabase online; the seed catalog under
   data/ is precached so the demo runs fully offline.

   Three things are worth knowing before editing this file:
   1. VERSION is read from the registration query (?v=…) when the page supplies
      one, so the cache name has a single source of truth. See "Versioning".
   2. Precaching is best-effort but no longer silent: a SHELL entry that fails
      is reported. See "Install".
   3. vendor/three/ is deliberately NOT in SHELL — it is lazily fetched on the
      first 3D open and pre-warmed in the background once the network goes
      quiet. See "vendor/three pre-warm". */

/* ============================== Versioning ================================
   The cache name and APP_V in js/app.js used to be two literals kept in step
   by comments alone, so a forgotten bump shipped silently.

   Now the cache name is DERIVED, never restated: CACHE = "akv-" + VERSION.
   VERSION comes from the registration URL when the page provides one —
   register with `./service-worker.js?v=${APP_V}` and the two can no longer
   drift, because there is only one literal left in the codebase. That single
   line in the page is the intended end state; this file works either way.

   Until that lands, activate() runs a best-effort drift check against the
   APP_V literal in js/app.js and warns in the console on a mismatch (see
   checkVersionDrift). Never fatal: a failed check leaves activation untouched.

   A page may also postMessage {type:"akv:version"} to read this worker's
   version back (optionally passing its own as `v` for a logged comparison). */
const FALLBACK_VERSION = "v1";           // used when the registration carries no ?v=
const VERSION = new URL(self.location.href).searchParams.get("v") || FALLBACK_VERSION;
const CACHE = `akv-${VERSION}`;          // never write this name out by hand

// Cross-origin dependencies the app benefits from offline (fonts; supabase-js
// ESM if the operator configures it). Runtime-cached network-first so an
// offline cold boot doesn't die on them. All other cross-origin traffic
// (Supabase API) stays live-only.
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

/* Every shipped runtime file except vendor/three (see below). service-worker.js
   itself is intentionally absent — the browser's update machinery fetches it,
   and a cached copy of the worker fights that. Verified entry-by-entry over
   HTTP against the served tree; keep it that way when adding a file. */
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
  "./js/scene2d.js",
  "./js/room3d.js",
  "./js/terma.js",
  "./js/qrshare.js",
  "./vendor/qr/qrcode.mjs",   // 58 KB — small enough to precache; keeps offline sharing working
  "./js/views/katalog.js",
  "./js/views/proizvod.js",
  "./js/views/dizajner.js",
  "./js/views/soba3d.js",
  "./js/views/savjetnik.js",
  "./js/views/favoriti.js",
  "./js/views/dizajni.js",
];

/* ============================== vendor/three pre-warm =====================
   DELIBERATE DEVIATION from "SHELL lists every shipped file"
   (docs/BUILD_CONTRACTS.md). three.js is ~2.1 MB raw across these four files —
   15x the entire rest of the app (measured boot: 12 files, ~143 KB). Putting
   it in SHELL would make every install, including the many users who never
   open the 3D tab, pay 2.1 MB before the worker is ready.

   The cost of leaving it out is real though: an installed-PWA user who never
   opened 3D online has no 3D offline. So instead of choosing one, we converge:
   SHELL stays small and fast, and these files are fetched in the background
   once the network has been quiet for PREWARM_IDLE_MS — i.e. after the app has
   finished booting, not during it. By the time the user first taps "3D soba",
   the module is usually already in the cache.

   Skipped entirely on Save-Data or a 2G-class connection: a background 2.1 MB
   download is exactly what those signals ask us not to do. Those users still
   get 3D on demand, they just pay for it when they ask for it.

   A page can trigger the same work explicitly with
   postMessage({type:"akv:prewarm"}) — e.g. from requestIdleCallback after
   load, which is more precise than this worker's network-idle heuristic. */
const THREE_ASSETS = [
  "./vendor/three/three.module.js",
  "./vendor/three/three.core.js",
  "./vendor/three/addons/controls/OrbitControls.js",
  "./vendor/three/addons/environments/RoomEnvironment.js",
];
const PREWARM_IDLE_MS = 6000;        // quiet network for this long = boot is over
const MAX_PREWARM_ATTEMPTS = 2;      // never retry a broken deploy forever

let prewarmTimer = 0;
let prewarmAttempts = 0;
let prewarmDone = false;
let prewarmRunning = false;

function dataSaverOn() {
  // WorkerNavigator.connection is Chromium-only; absent elsewhere, which is
  // treated as "no objection".
  const c = self.navigator && self.navigator.connection;
  if (!c) return false;
  return c.saveData === true || c.effectiveType === "2g" || c.effectiveType === "slow-2g";
}

/** (Re)start the idle countdown. Every same-origin request pushes it back, so
 *  the pre-warm can only fire once the app has stopped asking for things. */
function schedulePrewarm() {
  if (prewarmDone || prewarmRunning) return;
  if (prewarmAttempts >= MAX_PREWARM_ATTEMPTS) return;
  if (dataSaverOn()) return;
  clearTimeout(prewarmTimer);
  prewarmTimer = setTimeout(prewarmThree, PREWARM_IDLE_MS);
}

/** Best-effort background fill of the 3D module. Only fetches what is missing,
 *  never rejects, never touches the response path.
 *
 *  The attempt cap lives HERE, not only in schedulePrewarm(), because the
 *  postMessage path calls this directly — a page that posts "akv:prewarm" in a
 *  loop must not be able to retry a broken deploy forever. */
async function prewarmThree() {
  if (prewarmDone || prewarmRunning) return;
  if (prewarmAttempts >= MAX_PREWARM_ATTEMPTS) return;
  prewarmRunning = true;
  prewarmAttempts++;
  try {
    const c = await caches.open(CACHE);
    const missing = [];
    for (const url of THREE_ASSETS) {
      if (!(await c.match(url))) missing.push(url);
    }
    if (!missing.length) { prewarmDone = true; return; }

    const results = await Promise.allSettled(
      missing.map((u) => c.add(new Request(u, { cache: "no-cache" })))
    );
    const failed = missing.filter((_, i) => results[i].status === "rejected");
    if (failed.length) {
      // Offline or a genuinely missing file — one more attempt later, then stop.
      console.warn(`[akv-sw ${VERSION}] 3D pre-warm incomplete (${failed.length}/${missing.length}):`, failed);
    } else {
      prewarmDone = true;
    }
  } catch (err) {
    console.warn(`[akv-sw ${VERSION}] 3D pre-warm failed:`, err);
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
   result. Redundant once the page registers with ?v=${APP_V}, at which point
   the two literals become one. */
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
    e.waitUntil(prewarmThree());
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

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Boot-relevant CDN files (fonts, optional supabase-js ESM graph):
  // network-first, cache clean 200s so an offline cold boot still works.
  // Never touch other cross-origin traffic (Supabase API stays live-only).
  if (url.origin !== self.location.origin) {
    if (!CDN_HOSTS.includes(url.hostname)) return;
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

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
