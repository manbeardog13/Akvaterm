// ============================================================================
// config.js — deployment configuration, edited by the operator only. All four
// values empty (except the function name) = full offline/demo mode: the whole
// app runs from the seed catalog and localStorage with zero setup. Filling in
// supabaseUrl + supabaseAnonKey turns on the Supabase mirror in db.js and the
// Terma edge function in terma.js. The anon key is a public client key by
// design; no secret ever lives in this repository.
// ============================================================================

export const CONFIG = {
  // Supabase project "Akvaterm" (ref btcqaqstfbaenurhuvym).
  supabaseUrl: "https://btcqaqstfbaenurhuvym.supabase.co",

  // PUBLISHABLE key — public BY DESIGN, and safe in this repository.
  //
  // Supabase's own dashboard states it verbatim: "Publishable keys can be
  // safely shared publicly". What protects the data is Row Level Security,
  // not the secrecy of this string — products are public-read, favourites and
  // designs are owner-only, and every policy lives in supabase/schema.sql.
  // If RLS were ever disabled on a table, THAT would be the breach, not this
  // key being visible.
  //
  // The matching SECRET key is deliberately absent and was never copied
  // anywhere: Edge Functions receive SUPABASE_SERVICE_ROLE_KEY from the
  // platform automatically, so nothing in this project needs to hold it.
  // Operator's local key store: %USERPROFILE%\.akvaterm\keys.env
  supabaseAnonKey: "sb_publishable_hRnCKKDZ5rU4fcWD1GOHNg_7E4Nr2A0",

  // Public base URL of the deployed app (auth redirects, share links).
  appUrl: "https://manbeardog13.github.io/Akvaterm/",

  // Name of the Supabase Edge Function that proxies Gemini for the advisor.
  termaFunction: "terma",

  // Text-only Terma. TRUE hides every picture affordance in the UI (photo
  // analysis, AI impresija) and matches the server's TERMA_ENABLED_ACTIONS=chat
  // secret — the server is the enforcement, this flag is the honest UI for it.
  // Flip both together, never one without the other.
  termaTextOnly: true,
};
