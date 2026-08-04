/* Akvaterm Platform — service worker. RETIRED, and this is the kill switch.
   Operator instruction, 2026-08-04 — the service worker is destroyed: it was
   caching JS/CSS across deploys, and a version bump was the only way to bust
   it, which meant a login redesign could ship to the server while real
   visitors kept running old cached files underneath new markup — exactly the
   kind of silent, hard-to-diagnose mismatch that just happened live.

   BUG FIXED 2026-08-04, same day: the first version of this file reloaded
   every controlled window on EVERY activate, unconditionally. Since
   js/app.js still calls register() on every page load, that reload caused
   its own new registration, which activated, which reloaded again — an
   infinite reload loop ("the page is twitching"), live. The fix is the
   `keys.length` gate below: only reload when there was actually something
   to destroy. The first activation (a real old cache exists) cleans up and
   reloads once. Every activation after that finds nothing left to clean and
   does NOT reload, so the loop cannot restart — and stays broken permanently,
   because nothing in this app writes to Cache Storage anymore.

   Every step below is deliberately over-built and defensive — each runs in
   its own try/catch so one failure (a browser quirk, a locked cache) cannot
   block the others, because the one unacceptable outcome is a client that
   stays stuck on old files. In order:
     1. skipWaiting — do not wait for old tabs to close before taking over.
     2. clients.claim — take control of every ALREADY-OPEN tab immediately,
        not just future navigations. Without this, a tab left open across
        the deploy would keep running old cached JS indefinitely.
     3. delete every cache this or any previous version created, and
        remember whether there was anything to delete.
     4. unregister — after this, no service worker controls the origin at
        all, and js/app.js's registration call (kept only to deliver this
        file to already-installed clients) becomes a harmless no-op.
     5. ONLY IF there was something to clean up: force every open window to
        a fresh navigation, so nobody has to manually reload to see the
        effect — with a postMessage fallback for the rare engine where
        client.navigate() is unavailable. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try { await self.clients.claim(); } catch { /* not fatal — steps below still run */ }

    let hadSomethingToClean = false;
    try {
      const keys = await caches.keys();
      hadSomethingToClean = keys.length > 0;
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => {})));
    } catch { /* cache storage unavailable — nothing more to clear */ }

    try { await self.registration.unregister(); } catch { /* best-effort */ }

    if (!hadSomethingToClean) return; // nothing changed — do not reload anyone

    try {
      const clientList = await self.clients.matchAll({ type: "window" });
      for (const client of clientList) {
        try {
          if (typeof client.navigate === "function") client.navigate(client.url);
          else client.postMessage({ type: "akv:sw-retired" });
        } catch {
          try { client.postMessage({ type: "akv:sw-retired" }); } catch { /* client gone */ }
        }
      }
    } catch { /* no controlled clients to reach */ }
  })());
});
