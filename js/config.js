// ============================================================================
// config.js — deployment configuration, edited by the operator only. All four
// values empty (except the function name) = full offline/demo mode: the whole
// app runs from the seed catalog and localStorage with zero setup. Filling in
// supabaseUrl + supabaseAnonKey turns on the Supabase mirror in db.js and the
// Terma edge function in terma.js. The anon key is a public client key by
// design; no secret ever lives in this repository.
// ============================================================================

export const CONFIG = {
  // e.g. "https://xyzcompany.supabase.co" — empty string = offline demo.
  supabaseUrl: "",
  // The project's public anon key — empty string = offline demo.
  supabaseAnonKey: "",
  // Public base URL of the deployed app (used for auth redirects and share
  // links) — empty string = derive from location at call sites.
  appUrl: "",
  // Name of the Supabase Edge Function that proxies Gemini for the advisor.
  termaFunction: "terma",
};
