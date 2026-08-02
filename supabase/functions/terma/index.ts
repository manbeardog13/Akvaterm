// ============================================================================
// terma — Akvaterm's AI advisor "Terma" (Supabase Edge Function, Deno).
//
// The static PWA can never hold an API key, so this function is the only place
// the Gemini key lives. One POST endpoint, three actions:
//   • {action:'chat'}    — relays the conversation to Gemini's Interactions API
//     (model gemini-3.6-flash, thinking_level:'low', server-side state keyed by
//     an OPAQUE conversation handle this function owns) and streams normalized
//     SSE back to the client via a ReadableStream. The model's search_products
//     function calls execute HERE against the products table (anon client, so
//     RLS still applies) and the matching product ids are ALSO surfaced to the
//     client as {products:[...]} events so the UI can render catalog cards.
//   • {action:'vision'}  — one base64 JPEG (client resizes to ~1024px), model
//     gemini-3.6-flash, structured JSON out: {styleSummary, colors[], suggestedFilters}.
//   • {action:'staging'} — PAID TIER virtual staging, see the block below.
//
// ---------------------------------------------------------------------------
// SPEND CONTROLS — read before changing anything in the router.
//
// This endpoint spends the operator's money on every call, and its URL is
// derivable from the public bundle (js/config.js ships as a static file). It
// therefore refuses to run for a caller it cannot name and count:
//
//   1. IDENTITY. Every request must carry a bearer token. The project's anon
//      key resolves to a coarse "anon" identity keyed by a SHA-256 of
//      client IP + Origin (never stored raw); a real Supabase user access
//      token resolves to that user's id. No token, or a token that is neither
//      → 401. `staging` additionally REQUIRES a real user — the anon identity
//      may not spend money (see docs/SETUP.md: the client ships no sign-in UI
//      yet, so staging is effectively off until one lands. That is deliberate).
//   2. QUOTA. Every accepted request consumes a token from the `terma_usage`
//      table via the akv_terma_consume() RPC — a short window for burst
//      control plus a daily ceiling. If the table/RPC is missing the request
//      is REFUSED (503), never let through: an unmetered proxy is the bug.
//   3. ORIGIN. ALLOWED_ORIGINS (comma-separated) is an allowlist replacing the
//      old `Access-Control-Allow-Origin: *`. Honest scope note: CORS is a
//      browser control — a scripted attacker simply omits the Origin header.
//      It stops other *sites* from using your quota; it is not the spend
//      control. Identity + quota above are.
//   4. SIZE. The body is read through a byte-counting reader that aborts past
//      MAX_BODY_BYTES (with a Content-Length pre-check first), and per-message
//      / per-image budgets cap what a single accepted request can carry.
//
// KEY REQUIREMENT (docs/RESEARCH.md §4): ALL standard Gemini API keys stop
// working September 2026. GEMINI_API_KEY MUST be a service-account-bound auth
// key from day one — see docs/SETUP.md for how to create one.
//
// Deploy:  supabase functions deploy terma          # JWT verification ON
// Secrets: supabase secrets set GEMINI_API_KEY=<service-account auth key>
//          supabase secrets set ALLOWED_ORIGINS=https://your.site,http://localhost:8080
//          (optional) TERMA_CHAT_MODEL / TERMA_IMAGE_MODEL, TERMA_RATE_* overrides
// Requires: supabase/schema.sql applied (terma_usage, terma_conversations,
//           akv_terma_consume) — the function fails closed without them.
//
// Uses plain fetch against the REST endpoint on purpose — no SDK dependency
// (the @google/genai SDK churns; REST + a tolerant event parser is the stable
// surface for an edge runtime).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHAT_MODEL = Deno.env.get("TERMA_CHAT_MODEL") || "gemini-3.6-flash";
const IMAGE_MODEL = Deno.env.get("TERMA_IMAGE_MODEL") || "gemini-3.1-flash-image";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const MAX_MESSAGES = 24;            // conversation turns the client may send
const MAX_MESSAGE_CHARS = 4_000;    // per turn — MAX_MESSAGES alone let 6 MB of prompt through
const MAX_HISTORY_CHARS = 24_000;   // whole window, newest turns win
const MAX_BODY_BYTES = 6_000_000;   // staging carries two base64 images
const MAX_IMAGE_B64_CHARS = 2_800_000; // ≈2.1 MB of image bytes per attachment
const MAX_TOOL_ROUNDS = 4;          // function-calling loop guard

// Per-identity quotas. Windows are seconds; every accepted request consumes
// one token from each listed bucket (short window first, then the daily cap).
const num = (name: string, fallback: number) => {
  const v = Number(Deno.env.get(name));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};
const LIMITS = {
  chat: [
    { action: "chat", limit: num("TERMA_RATE_CHAT", 12), window: 60 },
    { action: "chat:day", limit: num("TERMA_DAILY_CHAT", 200), window: 86_400 },
  ],
  vision: [
    { action: "vision", limit: num("TERMA_RATE_VISION", 6), window: 60 },
    { action: "vision:day", limit: num("TERMA_DAILY_VISION", 60), window: 86_400 },
  ],
  staging: [
    { action: "staging", limit: num("TERMA_RATE_STAGING", 2), window: 60 },
    { action: "staging:day", limit: num("TERMA_DAILY_STAGING", 10), window: 86_400 },
  ],
} as const;

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const SYSTEM = `Ti si Terma, savjetnica tvrtke Akvaterm iz Dubrovnika (vodoinstalacije,
solarni sistemi, klimatizacija, centralno grijanje — od 1991., partneri: Viessmann,
Daikin, Riello, Mitsubishi, Wilo, Grundfos). Pomažeš kupcima oko pločica (keramika),
sanitarija, armatura, grijanja i klima uređaja.

JEZIK: odgovaraj na jeziku korisnika — prirodan, tečan hrvatski (ili engleski).
Toplo, stručno i konkretno; bez patetike.

ALATI: za SVAKO pitanje o konkretnim proizvodima, cijenama ili dostupnosti pozovi
search_products — nikad ne izmišljaj proizvode ni cijene. Ako alat ne vrati ništa,
reci to otvoreno i predloži šire kriterije. Katalog je demonstracijski dok klijent
ne dostavi svoj asortiman — ako te pitaju za točnu ponudu ili narudžbu, uputi na
kontakt s Akvatermom.

SAVJETI: smiješ davati opće stručne savjete (formati pločica za male prostore,
sjaj/mat, fuge, podno grijanje, orijentacijske snage klima uređaja ~100 W/m²),
ali za dimenzioniranje grijanja/klime uvijek preporuči procjenu na licu mjesta.

STIL: kratko i konkretno, počni odgovorom (broj, naziv, cijena). Bez markdowna,
bez zvjezdica i tablica — obične rečenice i kratki popisi. Cijene u eurima.`;

// Gemini function declarations (OpenAPI-subset schemas).
const FUNCTION_DECLARATIONS = [
  {
    name: "search_products",
    description:
      "Pretraži Akvatermov katalog proizvoda (pločice, sanitarije, armature, grijanje, klima). Vraća do 8 proizvoda s cijenama. Pozovi za svako pitanje o konkretnim proizvodima.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["keramika", "sanitarije", "armature", "grijanje", "klima"],
          description: "Kategorija proizvoda",
        },
        colorTag: { type: "string", description: "Boja/ton, npr. 'bijela', 'siva', 'bez', 'antracit', 'drvo'" },
        maxPriceM2: { type: "number", description: "Najviša cijena po m² u eurima (za pločice)" },
        tileSizeMm: { type: "string", description: "Format pločice u mm, npr. '600x600' ili '300x600'" },
      },
    },
  },
];

// ---- CORS -------------------------------------------------------------------
// An allowlist, not "*". A request with no Origin header is a non-browser
// caller: CORS has nothing to say about it, and identity+quota still gate it.

type Cors = Record<string, string>;

function baseCors(): Cors {
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function originAllowed(origin: string): boolean {
  if (!origin) return true; // not a browser request
  return ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ""));
}

function corsFor(origin: string): Cors {
  const headers = baseCors();
  if (origin && originAllowed(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

const json = (body: unknown, status: number, cors: Cors) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const send = (controller: ReadableStreamDefaultController, obj: unknown) =>
  controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

// ---- Supabase clients -------------------------------------------------------

// Service role: ONLY for this function's own bookkeeping tables (terma_usage,
// terma_conversations), which carry no policies and are unreachable from the
// browser. It must never touch catalog or customer data — that is what the
// anon client below is for.
function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// Anon role for anything driven by model-chosen arguments, so RLS
// (products_public_read) stays the backstop even if this helper is ever
// widened. INVARIANT: search paths run here, never on serviceClient().
function catalogClient() {
  if (ANON_KEY) return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  console.warn("[terma] SUPABASE_ANON_KEY missing — catalog search falls back to the service role");
  return serviceClient();
}

// ---- identity ---------------------------------------------------------------

type Identity = { key: string; userId: string | null; authenticated: boolean };

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearer(req: Request): string {
  const header = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return (m ? m[1] : req.headers.get("apikey") || "").trim();
}

// Unverified peek at a JWT's claims — used ONLY to tell "this is the project's
// public anon key" apart from "this is a user token worth verifying". Nothing
// security-relevant is decided from it: user tokens are verified for real by
// auth.getUser() below, and the anon tier's control is the IP-derived quota.
// deno-lint-ignore no-explicit-any
function peekJwt(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(pad + "=".repeat((4 - pad.length % 4) % 4)));
  } catch {
    return null;
  }
}

// A publishable/anon project key rather than an end-user session token. All
// three forms are public by design — they ship inside js/config.js.
function isProjectKey(token: string): boolean {
  if (ANON_KEY && token === ANON_KEY) return true;
  if (token.startsWith("sb_publishable_")) return true;
  return peekJwt(token)?.role === "anon";
}

// Resolve the caller. Returns null when the token is missing or unrecognized —
// the router turns that into 401 before a single Gemini token is spent.
async function identify(req: Request, origin: string): Promise<Identity | null> {
  const token = bearer(req);
  if (!token) return null;

  // The project's public key: a real but anonymous caller. Rate-limited by a
  // hash of IP + Origin, so no raw address is ever written to Postgres and
  // one abusive client cannot spend the whole project's budget.
  if (isProjectKey(token)) {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    return { key: `anon:${(await sha256Hex(`${ip}|${origin}`)).slice(0, 32)}`, userId: null, authenticated: false };
  }

  // Otherwise it must be a genuine Supabase user access token — verified
  // against the project, not merely decoded.
  try {
    const sb = createClient(SUPABASE_URL, ANON_KEY || token, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return { key: `user:${data.user.id}`, userId: data.user.id, authenticated: true };
  } catch (err) {
    console.error("[terma] identity check failed:", err);
    return null;
  }
}

// ---- quota ------------------------------------------------------------------

type LimitSpec = { action: string; limit: number; window: number };
type QuotaVerdict = { ok: true } | { ok: false; status: number; error: string; retryAfter: number };

// Consumes one token from every bucket. FAILS CLOSED: a missing table, a
// missing RPC or any error is a refusal, because "we could not count it" must
// never mean "so spend anyway".
async function consumeQuota(identity: Identity, specs: readonly LimitSpec[]): Promise<QuotaVerdict> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[terma] no service credentials — cannot meter requests");
    return { ok: false, status: 503, error: "rate_limit_unavailable", retryAfter: 60 };
  }
  const sb = serviceClient();
  for (const spec of specs) {
    const { data, error } = await sb.rpc("akv_terma_consume", {
      p_identity: identity.key,
      p_action: spec.action,
      p_limit: spec.limit,
      p_window_seconds: spec.window,
    });
    if (error) {
      console.error("[terma] akv_terma_consume failed — refusing:", error.message);
      return { ok: false, status: 503, error: "rate_limit_unavailable", retryAfter: 60 };
    }
    const row = (data ?? {}) as { allowed?: boolean; retry_after?: number };
    if (row.allowed !== true) {
      return { ok: false, status: 429, error: "rate_limited", retryAfter: Number(row.retry_after) || spec.window };
    }
  }
  return { ok: true };
}

// ---- conversation handles ---------------------------------------------------
// Gemini interaction ids are shared-namespace secrets: anyone holding one can
// resume that conversation. They therefore never leave this function. The
// client gets an opaque uuid handle bound to the caller's identity, and the
// mapping lives in terma_conversations.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function openConversation(identity: Identity): Promise<string | null> {
  try {
    const { data, error } = await serviceClient()
      .from("terma_conversations")
      .insert({ identity: identity.key })
      .select("handle")
      .single();
    if (error) throw error;
    return data?.handle ? String(data.handle) : null;
  } catch (err) {
    console.error("[terma] could not open a conversation:", err);
    return null;
  }
}

// Resolves a handle ONLY for the caller that owns it. `owned` distinguishes
// "not yours / unknown" (mint a new handle) from "yours, but this is still the
// first turn" (keep the handle, no previous interaction to resume).
type Resolved = { owned: boolean; interactionId: string | null };

async function resolveConversation(handle: string, identity: Identity): Promise<Resolved> {
  if (!UUID_RE.test(handle)) return { owned: false, interactionId: null };
  try {
    const { data, error } = await serviceClient()
      .from("terma_conversations")
      .select("interaction_id")
      .eq("handle", handle)
      .eq("identity", identity.key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { owned: false, interactionId: null };
    return { owned: true, interactionId: data.interaction_id ? String(data.interaction_id) : null };
  } catch (err) {
    console.error("[terma] conversation lookup failed:", err);
    return { owned: false, interactionId: null };
  }
}

async function bindConversation(handle: string, identity: Identity, interactionId: string) {
  if (!handle || !interactionId) return;
  try {
    await serviceClient()
      .from("terma_conversations")
      .update({ interaction_id: interactionId, updated_at: new Date().toISOString() })
      .eq("handle", handle)
      .eq("identity", identity.key);
  } catch (err) {
    console.error("[terma] conversation bind failed:", err);
  }
}

// ---- request body -----------------------------------------------------------

// Reads at most `limit` bytes and aborts the upload past it, so an oversized
// body is never fully materialized. Counts BYTES (String.length would count
// UTF-16 code units and let a multi-byte payload through at ~3x the budget).
async function readBodyCapped(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        try { await reader.cancel(); } catch { /* already gone */ }
        return null;
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  const merged = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { merged.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

function readImage(value: unknown): string {
  if (typeof value !== "string") return "";
  const stripped = value.replace(/^data:[^,]*,/, "");
  return stripped.length > MAX_IMAGE_B64_CHARS ? "" : stripped;
}

// ---- SSE parsing ------------------------------------------------------------

// Parse an SSE body into JSON events (`data: {...}` frames; [DONE] ignored).
async function* sseJson(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        for (const line of block.split("\n")) {
          const m = /^data:\s?(.*)$/.exec(line);
          if (!m || !m[1] || m[1] === "[DONE]") continue;
          try { yield JSON.parse(m[1]); } catch { /* partial frame — skip */ }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

function interactionsRequest(apiKey: string, body: Record<string, unknown>, stream: boolean) {
  return fetch(`${API_ROOT}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      ...(stream ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ---- tolerant Interactions-event extraction ---------------------------------
// The Interactions API surface is young and its event names have shifted;
// these helpers accept both the interactions shapes and legacy
// generateContent-style candidate chunks, so a wire rename can't kill the demo.

// deno-lint-ignore no-explicit-any
function pickTextDelta(evt: any): string {
  const type = String(evt?.type || "");
  if (type.includes("complete")) return ""; // completed events repeat the full text
  if (typeof evt?.delta === "string") return evt.delta;
  if (typeof evt?.delta?.text === "string") return evt.delta.text;
  if (typeof evt?.output_text_delta === "string") return evt.output_text_delta;
  if (typeof evt?.text === "string" && type.includes("delta")) return evt.text;
  const parts = evt?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    // deno-lint-ignore no-explicit-any
    return parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
  }
  return "";
}

// deno-lint-ignore no-explicit-any
function pickInteractionId(evt: any): string {
  if (typeof evt?.interaction?.id === "string") return evt.interaction.id;
  const type = String(evt?.type || "");
  if (typeof evt?.id === "string" && (type.startsWith("interaction") || evt?.object === "interaction")) return evt.id;
  if (typeof evt?.interaction_id === "string") return evt.interaction_id;
  return "";
}

type ToolCall = { id: string; name: string; args: Record<string, unknown> };

// deno-lint-ignore no-explicit-any
function pickFunctionCalls(evt: any): ToolCall[] {
  const found: ToolCall[] = [];
  // deno-lint-ignore no-explicit-any
  const visit = (item: any) => {
    if (!item || typeof item !== "object") return;
    const fc = item.function_call || item.functionCall || (item.type === "function_call" ? item : null);
    if (!fc) return;
    const name = fc.name || item.name;
    if (!name) return;
    let args = fc.arguments ?? fc.args ?? item.arguments ?? item.args ?? {};
    if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
    found.push({
      id: String(fc.call_id || fc.id || item.call_id || item.id || ""),
      name: String(name),
      args: args && typeof args === "object" ? args as Record<string, unknown> : {},
    });
  };
  visit(evt);
  for (const list of [evt?.output, evt?.interaction?.output, evt?.candidates?.[0]?.content?.parts]) {
    if (Array.isArray(list)) list.forEach(visit);
  }
  return found;
}

// deno-lint-ignore no-explicit-any
function pickOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  const chunks: string[] = [];
  // deno-lint-ignore no-explicit-any
  const visit = (item: any) => {
    if (!item || typeof item !== "object") return;
    if (typeof item.text === "string") chunks.push(item.text);
    for (const list of [item.content, item.parts]) if (Array.isArray(list)) list.forEach(visit);
  };
  for (const list of [data?.output, data?.interaction?.output, data?.candidates]) {
    if (Array.isArray(list)) list.forEach(visit);
  }
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const p of parts) if (typeof p?.text === "string") chunks.push(p.text);
  }
  return chunks.join("");
}

// deno-lint-ignore no-explicit-any
function pickOutputImage(data: any): { data: string; mimeType: string } | null {
  let out: { data: string; mimeType: string } | null = null;
  // deno-lint-ignore no-explicit-any
  const visit = (item: any) => {
    if (!item || typeof item !== "object" || out) return;
    const inline = item.inline_data || item.inlineData;
    if (inline && typeof inline.data === "string" && inline.data) {
      out = { data: inline.data, mimeType: String(inline.mime_type || inline.mimeType || "image/png") };
      return;
    }
    if ((item.type === "image" || item.type === "output_image") && typeof item.data === "string" && item.data) {
      out = { data: item.data, mimeType: String(item.mime_type || "image/png") };
      return;
    }
    for (const list of [item.content, item.parts, item.output]) if (Array.isArray(list)) list.forEach(visit);
  };
  visit(data);
  for (const list of [data?.output, data?.interaction?.output, data?.candidates]) {
    if (Array.isArray(list)) list.forEach(visit);
  }
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) parts.forEach(visit);
  return out;
}

function parseLooseJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = /\{[\s\S]*\}/.exec(text || "");
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

// ---- search_products (executes server-side, anon client) --------------------

function parseTileSize(v: unknown): [number, number] | null {
  if (Array.isArray(v) && v.length === 2 && Number.isFinite(Number(v[0])) && Number.isFinite(Number(v[1]))) {
    return [Number(v[0]), Number(v[1])];
  }
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return [v, v];
  if (typeof v === "string") {
    const m = /^\s*(\d{2,4})\s*[x×*]\s*(\d{2,4})\s*$/i.exec(v);
    if (m) return [Number(m[1]), Number(m[2])];
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return [n, n];
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function searchProducts(args: Record<string, unknown>): Promise<any[]> {
  const sb = catalogClient();
  let q = sb.from("products")
    .select("id,name,brand,category,texture_kind,base_color_hex,tile_size_mm,glossy,price_m2,price_unit,unit,color_tags")
    .is("deleted_at", null)
    .limit(24);
  const category = typeof args.category === "string" ? args.category.trim().toLowerCase() : "";
  if (category) q = q.eq("category", category);
  const maxPrice = Number(args.maxPriceM2);
  if (Number.isFinite(maxPrice) && maxPrice > 0) q = q.lte("price_m2", maxPrice);
  const colorTag = typeof args.colorTag === "string" ? args.colorTag.trim().toLowerCase() : "";
  if (colorTag) q = q.contains("color_tags", [colorTag]);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  const size = parseTileSize(args.tileSizeMm);
  if (size) {
    rows = rows.filter((r) =>
      Array.isArray(r.tile_size_mm) && r.tile_size_mm.length === 2 &&
      Number(r.tile_size_mm[0]) === size[0] && Number(r.tile_size_mm[1]) === size[1]
    );
  }
  return rows.slice(0, 8).map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    tileSizeMm: r.tile_size_mm,
    glossy: r.glossy,
    priceM2: r.price_m2,
    priceUnit: r.price_unit,
    unit: r.unit,
  }));
}

async function runTool(call: ToolCall): Promise<{ result: unknown; productIds: string[] }> {
  if (call.name !== "search_products") return { result: { error: "unknown_tool" }, productIds: [] };
  try {
    const rows = await searchProducts(call.args || {});
    return {
      result: rows.length
        ? { count: rows.length, products: rows }
        : { count: 0, note: "Nema proizvoda za te kriterije — predloži šire." },
      productIds: rows.map((r) => String(r.id)),
    };
  } catch (err) {
    console.error("[terma] search_products failed:", err);
    return { result: { error: "search_failed" }, productIds: [] };
  }
}

// ---- chat (SSE relay + server-side tool loop) -------------------------------

type WireMessage = { role: string; content: string };

// Clamp every turn, then keep the newest turns that fit the whole-window
// budget. MAX_MESSAGES alone capped the COUNT, never the size.
function clampMessages(messages: WireMessage[]): WireMessage[] {
  const windowed = messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content ?? "").slice(0, MAX_MESSAGE_CHARS),
  }));
  const kept: WireMessage[] = [];
  let budget = MAX_HISTORY_CHARS;
  for (let i = windowed.length - 1; i >= 0; i--) {
    budget -= windowed[i].content.length;
    if (budget < 0 && kept.length) break;
    kept.unshift(windowed[i]);
    if (budget < 0) break;
  }
  return kept;
}

function historyInput(messages: WireMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: [{ type: "text", text: String(m.content ?? "") }],
  }));
}

function lastUserInput(messages: WireMessage[]) {
  const last = [...messages].reverse().find((m) => m.role !== "assistant");
  return [{ role: "user", content: [{ type: "text", text: String(last?.content ?? "") }] }];
}

// Returns the final Gemini interaction id so the caller can bind it to the
// conversation handle. The id itself is NEVER streamed to the client.
async function runChat(
  controller: ReadableStreamDefaultController,
  apiKey: string,
  messages: WireMessage[],
  previousInteractionId: string | null,
): Promise<string> {
  // With a previous interaction id the server already holds the history —
  // send only the newest user turn. Cold start sends the short window.
  let prev: string | undefined = previousInteractionId || undefined;
  let input: unknown = prev ? lastUserInput(messages) : historyInput(messages);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await interactionsRequest(apiKey, {
      model: CHAT_MODEL,
      stream: true,
      thinking_level: "low",
      system_instruction: SYSTEM,
      tools: [{ function_declarations: FUNCTION_DECLARATIONS }],
      ...(prev ? { previous_interaction_id: prev } : {}),
      input,
    }, true);

    if (res.status === 429) { send(controller, { error: "busy", status: 429 }); return prev || ""; }
    if (!res.ok || !res.body) {
      console.error("[terma] Gemini chat error", res.status, (await res.text()).slice(0, 400));
      send(controller, { error: "terma_failed", status: 502 });
      return prev || "";
    }

    const calls: ToolCall[] = [];
    const seen = new Set<string>();
    for await (const evt of sseJson(res.body)) {
      const id = pickInteractionId(evt);
      if (id) prev = id;   // kept server-side only
      const delta = pickTextDelta(evt);
      if (delta) send(controller, { delta });
      for (const call of pickFunctionCalls(evt)) {
        const key = `${call.name}:${JSON.stringify(call.args)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        calls.push(call);
      }
    }

    if (!calls.length) { send(controller, { done: true }); return prev || ""; }

    // Execute tools here (anon client), surface product ids to the UI,
    // then feed results into a follow-up interaction.
    const results: unknown[] = [];
    for (const call of calls) {
      const out = await runTool(call);
      if (out.productIds.length) send(controller, { products: out.productIds });
      results.push({
        type: "function_result",
        call_id: call.id || undefined,
        name: call.name,
        result: out.result,
      });
    }
    input = results;
  }
  send(controller, { done: true }); // tool-round guard tripped — end politely
  return prev || "";
}

async function handleChat(
  body: Record<string, unknown>,
  apiKey: string,
  identity: Identity,
  cors: Cors,
): Promise<Response> {
  const messages = Array.isArray(body.messages) ? clampMessages(body.messages as WireMessage[]) : [];
  if (!messages.length) return json({ error: "bad_request" }, 400, cors);

  // Conversation state is OURS. A handle the caller does not own resolves to
  // nothing and simply starts a fresh conversation — it can never resume
  // somebody else's, and no raw Gemini interaction id crosses the wire.
  const requested = typeof body.conversationId === "string" ? body.conversationId : "";
  const resolved = requested
    ? await resolveConversation(requested, identity)
    : { owned: false, interactionId: null };
  const handle = resolved.owned ? requested : ((await openConversation(identity)) || "");
  const prevId = resolved.owned ? resolved.interactionId : null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (handle) send(controller, { conversationId: handle });
        const finalId = await runChat(controller, apiKey, messages, prevId);
        if (handle && finalId) await bindConversation(handle, identity, finalId);
      } catch (err) {
        console.error("[terma] chat stream failed:", err);
        try { send(controller, { error: "terma_failed", status: 502 }); } catch { /* closed */ }
      } finally {
        try { controller.close(); } catch { /* closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

// ---- vision (photo → style analysis, structured JSON) -----------------------

const VISION_PROMPT = `Analiziraj ovu fotografiju prostorije za opremanje (pločice,
sanitarije, grijanje). Vrati ISKLJUČIVO JSON po zadanoj shemi:
styleSummary — 2-3 rečenice na hrvatskom o stilu, materijalima i dojmu prostora;
colors — 3 do 5 dominantnih boja kao hex vrijednosti (#rrggbb);
suggestedFilters — preporuka za katalog: category (jedna od: keramika, sanitarije,
armature, grijanje, klima), colorTag (jedna riječ, npr. bijela/siva/bez/antracit/drvo),
glossy (true za sjajne završne obrade, false za mat).`;

const VISION_SCHEMA = {
  name: "room_style_analysis",
  schema: {
    type: "object",
    properties: {
      styleSummary: { type: "string" },
      colors: { type: "array", items: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } },
      suggestedFilters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["keramika", "sanitarije", "armature", "grijanje", "klima"] },
          colorTag: { type: "string" },
          glossy: { type: "boolean" },
        },
      },
    },
    required: ["styleSummary", "colors", "suggestedFilters"],
  },
};

const HEX6 = /^#[0-9a-f]{6}$/i;
const CATEGORIES = ["keramika", "sanitarije", "armature", "grijanje", "klima"];

// The schema's `pattern` is a request, not a guarantee: model output is
// untrusted input and these strings end up in a style attribute downstream.
// Enforce the shape here, and again in js/terma.js, and once more at the DOM
// boundary in js/views/savjetnik.js.
function safeColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const c of value) {
    if (typeof c !== "string") continue;
    const trimmed = c.trim();
    if (!HEX6.test(trimmed)) continue;
    out.push(trimmed.toLowerCase());
    if (out.length === 6) break;
  }
  return out;
}

// deno-lint-ignore no-explicit-any
function safeFilters(value: any): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, unknown> = {};
  if (typeof value.category === "string" && CATEGORIES.includes(value.category)) out.category = value.category;
  if (typeof value.colorTag === "string") out.colorTag = value.colorTag.trim().slice(0, 32);
  if (typeof value.glossy === "boolean") out.glossy = value.glossy;
  return out;
}

async function handleVision(body: Record<string, unknown>, apiKey: string, cors: Cors): Promise<Response> {
  const image = readImage(body.imageBase64);
  if (!image) return json({ error: "bad_request" }, 400, cors);
  const rawMime = typeof body.mimeType === "string" ? body.mimeType : "";
  const mimeType = /^image\/(jpeg|png|webp)$/i.test(rawMime) ? rawMime : "image/jpeg";

  const res = await interactionsRequest(apiKey, {
    model: CHAT_MODEL,
    thinking_level: "low",
    input: [{
      role: "user",
      content: [
        { type: "text", text: VISION_PROMPT },
        { type: "image", mime_type: mimeType, data: image },
      ],
    }],
    response_format: { type: "json_schema", json_schema: VISION_SCHEMA },
  }, false);

  if (res.status === 429) return json({ error: "busy" }, 429, cors);
  if (!res.ok) {
    console.error("[terma] Gemini vision error", res.status, (await res.text()).slice(0, 400));
    return json({ error: "terma_failed" }, 502, cors);
  }
  const data = await res.json();
  const parsed = parseLooseJson(pickOutputText(data));
  if (!parsed) return json({ error: "terma_failed" }, 502, cors);
  return json({
    styleSummary: String(parsed.styleSummary || "").slice(0, 1_000),
    colors: safeColors(parsed.colors),
    suggestedFilters: safeFilters(parsed.suggestedFilters),
  }, 200, cors);
}

// ---------------------------------------------------------------------------
// staging — VIRTUAL STAGING (image generation).
//
// ⚠ PAID TIER ONLY: gemini-3.1-flash-image has NO free tier — Tier-1 billing
//   must be enabled on the Google Cloud project (~$0.067 per 1K render, see
//   docs/RESEARCH.md §4). Because it spends real money per call it is the one
//   action that requires an AUTHENTICATED user (see the router) on top of the
//   daily quota; a client-side confirm dialog is not a control.
// ⚠ SEPTEMBER 2026 KEY CUTOFF: standard Gemini API keys stop working entirely.
//   GEMINI_API_KEY must be a service-account-bound auth key (docs/SETUP.md) or
//   this action — and every other — goes dark.
// ⚠ The output is a prompt-based photoreal re-render (SynthID-watermarked),
//   NOT a mask-based texture map. The UI must label it "AI impresija", never
//   a product-accurate render.
// ---------------------------------------------------------------------------

async function handleStaging(body: Record<string, unknown>, apiKey: string, cors: Cors): Promise<Response> {
  const room = readImage(body.roomBase64);
  const swatch = readImage(body.swatchBase64);
  if (!room || !swatch) return json({ error: "bad_request" }, 400, cors);
  const productName = typeof body.productName === "string" ? body.productName.slice(0, 120) : "";
  const surface = body.surface === "wall" ? "wall" : "floor";

  // Semantic edit prompt — English is the most reliable editing register for
  // the image models; the product name is carried through for context.
  const editPrompt =
    `Edit the first photo of a room: replace ONLY the ${surface === "wall" ? "wall tiles / wall surface" : "floor"} ` +
    `with the tile shown in the second image (tile sample${productName ? `: "${productName}"` : ""}), laid at a ` +
    `realistic physical scale. Keep the room geometry, camera angle, lighting, shadows, reflections and every ` +
    `other object exactly as they are. Photorealistic result, no text, no watermark graphics.`;

  const res = await interactionsRequest(apiKey, {
    model: IMAGE_MODEL,
    input: [{
      role: "user",
      content: [
        { type: "text", text: editPrompt },
        { type: "image", mime_type: "image/jpeg", data: room },
        { type: "image", mime_type: "image/png", data: swatch },
      ],
    }],
  }, false);

  if (res.status === 429) return json({ error: "busy" }, 429, cors);
  if (!res.ok) {
    console.error("[terma] Gemini staging error", res.status, (await res.text()).slice(0, 400));
    return json({ error: "terma_failed" }, 502, cors);
  }
  const data = await res.json();
  const image = pickOutputImage(data);
  if (!image) return json({ error: "staging_empty" }, 502, cors);
  return json({ imageBase64: image.data, mimeType: image.mimeType }, 200, cors);
}

// ---- router -----------------------------------------------------------------

Deno.serve(async (req) => {
  const origin = (req.headers.get("origin") || "").trim();
  const cors = corsFor(origin);

  if (req.method === "OPTIONS") {
    return originAllowed(origin)
      ? new Response("ok", { headers: cors })
      : json({ error: "origin_not_allowed" }, 403, cors);
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  if (!originAllowed(origin)) {
    console.warn("[terma] refused origin:", origin);
    return json({ error: "origin_not_allowed" }, 403, cors);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "terma_not_configured" }, 503, cors);

  // Name the caller BEFORE reading a potentially large body or touching Gemini.
  const identity = await identify(req, origin);
  if (!identity) return json({ error: "unauthorized" }, 401, cors);

  const raw = await readBodyCapped(req, MAX_BODY_BYTES);
  if (raw === null) return json({ error: "too_large" }, 413, cors);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad_request" }, 400, cors); }

  const action = body.action;
  if (action !== "chat" && action !== "vision" && action !== "staging") {
    return json({ error: "bad_request" }, 400, cors);
  }

  // The paid action is not available to an anonymous caller, full stop.
  if (action === "staging" && !identity.authenticated) {
    return json({ error: "staging_requires_account" }, 401, cors);
  }

  const verdict = await consumeQuota(identity, LIMITS[action]);
  if (!verdict.ok) {
    return new Response(JSON.stringify({ error: verdict.error, retryAfter: verdict.retryAfter }), {
      status: verdict.status,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(verdict.retryAfter) },
    });
  }

  try {
    if (action === "chat") return await handleChat(body, apiKey, identity, cors);
    if (action === "vision") return await handleVision(body, apiKey, cors);
    return await handleStaging(body, apiKey, cors);
  } catch (err) {
    console.error("[terma]", err);
    return json({ error: "terma_failed" }, 502, cors);
  }
});
