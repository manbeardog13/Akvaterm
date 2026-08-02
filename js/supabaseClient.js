// ============================================================================
// supabaseClient.js — the single Supabase connection point. Nothing else in
// the app imports supabase-js. The library is lazy-loaded from the VENDORED
// copy under /vendor/supabase/ and ONLY when CONFIG carries real credentials —
// the zero-config offline demo never issues a network request from this module.
//
// No CDN fallback, deliberately: docs/BUILD_CONTRACTS.md allows "nothing from
// npm at runtime except vendored files under /vendor/", and an ESM import()
// carries no integrity attribute — a floating `@2` CDN specifier would mean
// different bytes executing in the app origin from one load to the next, with
// the service worker then persisting whatever arrived. vendor/supabase/ pins
// 2.111.0 byte-for-byte (see vendor/supabase/PROVENANCE.md); upgrading is a
// commit, not a silent CDN roll.
//
// getSupabase() is synchronous by contract: it returns the client once the
// lazy load has finished, and null before that (and always in offline mode).
// Callers treat null as "local storage is the only store" and keep working.
//
// ---------------------------------------------------------------------------
// WHY flowType MUST BE "pkce" HERE — this app is hash-routed
// ---------------------------------------------------------------------------
// auth-js 2.111.0 defaults to flowType "implicit" (verified in the vendored
// bundle), which returns an OAuth result in the URL FRAGMENT:
//     .../Akvaterm/#access_token=...&refresh_token=...
// This app routes on that same fragment (#/katalog, #/dizajner, ...), so the
// implicit return and the router would be reading and writing one value. Two
// separate ways that breaks: the router sees an unknown route and rewrites the
// hash, and it can do so before auth-js's asynchronous _initialize() has read
// it — losing the session at random depending on which finishes first.
//
// PKCE returns ?code=... in the QUERY STRING instead, which the hash router
// never touches, so there is no shared value and no race. detectSessionInUrl
// then exchanges the code and strips it from the address bar.
//
// This is not a preference. Setting flowType back to implicit reintroduces a
// timing-dependent sign-in failure that will not reproduce reliably.
// ============================================================================

import { CONFIG } from "./config.js";

let client = null;        // the created client, once the library has loaded
let loadPromise = null;   // in-flight library load (deduplicated)

// True when the operator has filled in real Supabase credentials.
export function isConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

// Synchronous accessor per the build contract: client | null.
export function getSupabase() {
  return client;
}

// Kick off the lazy library load. Safe to call any number of times, from
// anywhere; resolves to the client, or null when unconfigured or when the
// vendored library can't be read (the app keeps working local-only either
// way — a missing vendor file must never take the demo down).
export function initSupabase() {
  if (client) return Promise.resolve(client);
  if (!isConfigured()) return Promise.resolve(null);
  if (!loadPromise) {
    loadPromise = import("../vendor/supabase/supabase-js.mjs")
      .then((mod) => {
        const createClient = mod?.createClient || mod?.default?.createClient;
        if (typeof createClient !== "function") throw new Error("supabase-js: createClient not found");
        client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
          auth: {
            flowType: "pkce",        // see the header — not optional on a hash router
            detectSessionInUrl: true, // exchange ?code=... on the return hop
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        return client;
      })
      .catch((err) => {
        console.warn("[supabase] library unavailable — continuing local-only:", err?.message || err);
        loadPromise = null;   // allow a later retry (e.g. after reconnect)
        return null;
      });
  }
  return loadPromise;
}
