/* Akvaterm Platform — service worker.
   Makes the app installable and loads the shell instantly. Network-first for
   same-origin files (so deploys show up right away), cache fallback when
   offline. Live data always comes from Supabase online; the seed catalog under
   data/ is precached so the demo runs fully offline.
   vendor/three/ is deliberately NOT in SHELL — the 3D module lazy-loads it and
   the fetch handler below runtime-caches it on first use. */
const CACHE = "akv-v1"; // keep in lockstep with APP_V in js/app.js — bump both per release
// Cross-origin dependencies the app benefits from offline (fonts; supabase-js
// ESM if the operator configures it). Runtime-cached network-first so an
// offline cold boot doesn't die on them. All other cross-origin traffic
// (Supabase API) stays live-only.
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
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
  "./js/views/katalog.js",
  "./js/views/proizvod.js",
  "./js/views/dizajner.js",
  "./js/views/soba3d.js",
  "./js/views/savjetnik.js",
  "./js/views/favoriti.js",
  "./js/views/dizajni.js",
];

self.addEventListener("install", (e) => {
  // Best-effort precache — never fail install if one file 404s during a deploy.
  // cache:"no-cache" revalidates past the host's HTTP cache so a fresh SW
  // never precaches a stale (version-skewed) shell.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "no-cache" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
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
