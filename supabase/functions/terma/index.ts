// ============================================================================
// terma — Akvaterm's AI advisor "Terma" (Supabase Edge Function, Deno).
//
// The static PWA can never hold an API key, so this function is the only place
// the Gemini key lives. One POST endpoint, three actions:
//   • {action:'chat'}    — relays the conversation to Gemini's Interactions API
//     (model gemini-3.6-flash, thinking_level:'low', server-side state via
//     previous_interaction_id) and streams normalized SSE back to the client
//     via a ReadableStream. The model's search_products function calls execute
//     HERE against the products table (supabase-js service client) and the
//     matching product ids are ALSO surfaced to the client as {products:[...]}
//     events so the UI can render catalog cards.
//   • {action:'vision'}  — one base64 JPEG (client resizes to ~1024px), model
//     gemini-3.6-flash, structured JSON out: {styleSummary, colors[], suggestedFilters}.
//   • {action:'staging'} — PAID TIER virtual staging, see the block below.
//
// KEY REQUIREMENT (docs/RESEARCH.md §4): ALL standard Gemini API keys stop
// working September 2026. GEMINI_API_KEY MUST be a service-account-bound auth
// key from day one — see docs/SETUP.md for how to create one.
//
// Deploy:  supabase functions deploy terma --no-verify-jwt
// Secrets: supabase secrets set GEMINI_API_KEY=<service-account auth key>
//          (optional) TERMA_CHAT_MODEL / TERMA_IMAGE_MODEL overrides
//
// Uses plain fetch against the REST endpoint on purpose — no SDK dependency
// (the @google/genai SDK churns; REST + a tolerant event parser is the stable
// surface for an edge runtime).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHAT_MODEL = Deno.env.get("TERMA_CHAT_MODEL") || "gemini-3.6-flash";
const IMAGE_MODEL = Deno.env.get("TERMA_IMAGE_MODEL") || "gemini-3.1-flash-image";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

const MAX_MESSAGES = 24;            // conversation window the client may send
const MAX_BODY_BYTES = 6_000_000;   // staging carries two base64 images
const MAX_TOOL_ROUNDS = 4;          // function-calling loop guard

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

// ---- shared plumbing --------------------------------------------------------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const send = (controller: ReadableStreamDefaultController, obj: unknown) =>
  controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
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
  // deno-lint-ignore no-explicit-any
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) parts.forEach((p: any) => { if (typeof p?.text === "string") chunks.push(p.text); });
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
  // deno-lint-ignore no-explicit-any
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

// ---- search_products (executes server-side, service client) -----------------

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
  const sb = serviceClient();
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

async function runChat(
  controller: ReadableStreamDefaultController,
  apiKey: string,
  messages: WireMessage[],
  previousInteractionId: string | null,
) {
  // With a previous interaction id the server already holds the history —
  // send only the newest user turn. Cold start sends the short window.
  let prev: string | undefined = previousInteractionId || undefined;
  let input: unknown = prev ? lastUserInput(messages) : historyInput(messages);
  let sentId = "";

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

    if (res.status === 429) { send(controller, { error: "busy", status: 429 }); return; }
    if (!res.ok || !res.body) {
      console.error("[terma] Gemini chat error", res.status, (await res.text()).slice(0, 400));
      send(controller, { error: "terma_failed", status: 502 });
      return;
    }

    const calls: ToolCall[] = [];
    const seen = new Set<string>();
    for await (const evt of sseJson(res.body)) {
      const id = pickInteractionId(evt);
      if (id) {
        prev = id;
        if (id !== sentId) { sentId = id; send(controller, { interactionId: id }); }
      }
      const delta = pickTextDelta(evt);
      if (delta) send(controller, { delta });
      for (const call of pickFunctionCalls(evt)) {
        const key = `${call.name}:${JSON.stringify(call.args)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        calls.push(call);
      }
    }

    if (!calls.length) { send(controller, { done: true }); return; }

    // Execute tools here (service client), surface product ids to the UI,
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
}

function handleChat(body: Record<string, unknown>, apiKey: string): Response {
  const messages = Array.isArray(body.messages) ? body.messages as WireMessage[] : [];
  if (!messages.length) return json({ error: "bad_request" }, 400);
  const trimmed = messages.slice(-MAX_MESSAGES);
  const prevId = typeof body.previousInteractionId === "string" && body.previousInteractionId
    ? body.previousInteractionId
    : null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runChat(controller, apiKey, trimmed, prevId);
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
      colors: { type: "array", items: { type: "string" } },
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

async function handleVision(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const image = typeof body.imageBase64 === "string"
    ? body.imageBase64.replace(/^data:[^,]*,/, "")
    : "";
  if (!image) return json({ error: "bad_request" }, 400);
  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "image/jpeg";

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

  if (res.status === 429) return json({ error: "busy" }, 429);
  if (!res.ok) {
    console.error("[terma] Gemini vision error", res.status, (await res.text()).slice(0, 400));
    return json({ error: "terma_failed" }, 502);
  }
  const data = await res.json();
  const parsed = parseLooseJson(pickOutputText(data));
  if (!parsed) return json({ error: "terma_failed" }, 502);
  const filters = parsed.suggestedFilters && typeof parsed.suggestedFilters === "object"
    ? parsed.suggestedFilters
    : {};
  return json({
    styleSummary: String(parsed.styleSummary || ""),
    colors: Array.isArray(parsed.colors)
      ? parsed.colors.filter((c: unknown) => typeof c === "string").slice(0, 6)
      : [],
    suggestedFilters: filters,
  });
}

// ---------------------------------------------------------------------------
// staging — VIRTUAL STAGING (image generation).
//
// ⚠ PAID TIER ONLY: gemini-3.1-flash-image has NO free tier — Tier-1 billing
//   must be enabled on the Google Cloud project (~$0.067 per 1K render, see
//   docs/RESEARCH.md §4). Keep this behind an explicit user action in the UI;
//   never call it automatically.
// ⚠ SEPTEMBER 2026 KEY CUTOFF: standard Gemini API keys stop working entirely.
//   GEMINI_API_KEY must be a service-account-bound auth key (docs/SETUP.md) or
//   this action — and every other — goes dark.
// ⚠ The output is a prompt-based photoreal re-render (SynthID-watermarked),
//   NOT a mask-based texture map. The UI must label it "AI impresija", never
//   a product-accurate render.
// ---------------------------------------------------------------------------

async function handleStaging(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const room = typeof body.roomBase64 === "string" ? body.roomBase64.replace(/^data:[^,]*,/, "") : "";
  const swatch = typeof body.swatchBase64 === "string" ? body.swatchBase64.replace(/^data:[^,]*,/, "") : "";
  if (!room || !swatch) return json({ error: "bad_request" }, 400);
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

  if (res.status === 429) return json({ error: "busy" }, 429);
  if (!res.ok) {
    console.error("[terma] Gemini staging error", res.status, (await res.text()).slice(0, 400));
    return json({ error: "terma_failed" }, 502);
  }
  const data = await res.json();
  const image = pickOutputImage(data);
  if (!image) return json({ error: "staging_empty" }, 502);
  return json({ imageBase64: image.data, mimeType: image.mimeType });
}

// ---- router -----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "terma_not_configured" }, 503);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad_request" }, 400); }

  try {
    if (body.action === "chat") return handleChat(body, apiKey);
    if (body.action === "vision") return await handleVision(body, apiKey);
    if (body.action === "staging") return await handleStaging(body, apiKey);
    return json({ error: "bad_request" }, 400);
  } catch (err) {
    console.error("[terma]", err);
    return json({ error: "terma_failed" }, 502);
  }
});
