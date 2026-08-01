// ============================================================================
// supabaseClient.js — the single Supabase connection point. Nothing else in
// the app imports supabase-js. The library is lazy-loaded (vendored file
// first, CDN fallback) and ONLY when CONFIG carries real credentials — the
// zero-config offline demo never issues a network request from this module.
//
// getSupabase() is synchronous by contract: it returns the client once the
// lazy load has finished, and null before that (and always in offline mode).
// Callers treat null as "local storage is the only store" and keep working.
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
// library can't be reached (the app keeps working local-only either way —
// a missing vendor file or a dead CDN must never take the demo down).
export function initSupabase() {
  if (client) return Promise.resolve(client);
  if (!isConfigured()) return Promise.resolve(null);
  if (!loadPromise) {
    loadPromise = import("../vendor/supabase/supabase-js.mjs")
      .catch(() => import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"))
      .then((mod) => {
        const createClient = mod?.createClient || mod?.default?.createClient;
        if (typeof createClient !== "function") throw new Error("supabase-js: createClient not found");
        client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
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
