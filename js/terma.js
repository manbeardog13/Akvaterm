// ============================================================================
// terma.js — client half of "Terma", the Gemini-powered advisor.
//
// Talks ONLY to the `terma` Supabase Edge Function (the API key lives there,
// never here). Three capabilities:
//   • chat(messages, {signal})  — async generator, yields {delta} text chunks
//     streamed over SSE. Server-side conversation state rides on Gemini's
//     Interactions API: we remember the last interaction id and send it back
//     as previousInteractionId on the next turn. Product suggestions arrive
//     as extra {delta:'', products:[ids]} events so views can render cards.
//   • analyzePhoto(file)        — resizes client-side to ~1024px (258 tokens
//     per 768px tile — keep uploads small), sends base64 JPEG, gets back
//     {styleSummary, colors[], suggestedFilters}, then matches the local demo
//     catalog by color distance → {styleSummary, suggestedProductIds[]}.
//   • stageRoom({...})          — virtual staging (PAID tier, gated in the UI).
//
// When CONFIG.supabaseUrl is empty the app runs in offline/demo mode and every
// entry point throws TermaUnavailable — views catch it and show the static
// Croatian fallback (see views/savjetnik.js).
// ============================================================================

import { CONFIG } from './config.js';
import { listProducts } from './db.js';

export class TermaUnavailable extends Error {
  constructor(message = 'Terma nije dostupna — aplikacija radi u demo načinu bez poslužitelja.') {
    super(message);
    this.name = 'TermaUnavailable';
  }
}

const MAX_MESSAGES = 24; // conversation window sent to the function

// Server-side state handle (Gemini Interactions API). One per page session.
let lastInteractionId = null;

export function isConfigured() {
  return Boolean(CONFIG.supabaseUrl && String(CONFIG.supabaseUrl).trim());
}

export function resetChat() {
  lastInteractionId = null;
}

// ---- plumbing ---------------------------------------------------------------

function requireConfigured() {
  if (!isConfigured()) throw new TermaUnavailable();
}

function functionUrl() {
  const base = String(CONFIG.supabaseUrl).replace(/\/+$/, '');
  return `${base}/functions/v1/${CONFIG.termaFunction || 'terma'}`;
}

function baseHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (CONFIG.supabaseAnonKey) {
    headers.apikey = CONFIG.supabaseAnonKey;
    headers.Authorization = `Bearer ${CONFIG.supabaseAnonKey}`;
  }
  return headers;
}

// Friendly-Croatian error with the HTTP status attached (views read .friendly).
function httpError(status, code) {
  const friendly =
    status === 429 ? 'Terma je trenutačno zauzeta. Pokušaj ponovno za nekoliko sekundi.'
    : status === 503 ? 'Terma još nije uključena na poslužitelju (nedostaje ključ).'
    : 'Terma trenutačno nije dostupna. Pokušaj kasnije.';
  const err = new Error(code || `terma_http_${status}`);
  err.status = status;
  err.friendly = friendly;
  return err;
}

// Minimal SSE reader: yields every parsed `data: {json}` object from a body
// stream. Ignores keep-alives, comments and the [DONE] sentinel.
async function* sseEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        for (const line of block.split('\n')) {
          const m = /^data:\s?(.*)$/.exec(line);
          if (!m || !m[1] || m[1] === '[DONE]') continue;
          try { yield JSON.parse(m[1]); } catch { /* partial frame — skip */ }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

// ---- chat -------------------------------------------------------------------

// Async generator per the build contract: yields {delta:string}. Extra events
// carry {delta:'', products:[productId,...]} when the model called
// search_products server-side — views render those as product cards.
export async function* chat(messages, { signal } = {}) {
  requireConfigured();
  const trimmed = (Array.isArray(messages) ? messages : [])
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
    }));

  const res = await fetch(functionUrl(), {
    method: 'POST',
    headers: baseHeaders(),
    signal,
    body: JSON.stringify({
      action: 'chat',
      messages: trimmed,
      previousInteractionId: lastInteractionId,
    }),
  });
  if (!res.ok || !res.body) throw httpError(res.status || 502);

  for await (const evt of sseEvents(res.body)) {
    if (evt.interactionId) lastInteractionId = String(evt.interactionId);
    if (evt.error) throw httpError(evt.status || 502, evt.error);
    if (Array.isArray(evt.products) && evt.products.length) {
      yield { delta: '', products: evt.products.map(String) };
    }
    if (typeof evt.delta === 'string' && evt.delta) yield { delta: evt.delta };
    if (evt.done) return;
  }
}

// ---- photo analysis ---------------------------------------------------------

// Resize an image File/Blob to a JPEG capped at maxPx on its longer side.
// Exported so the staging flow can reuse the same room photo bytes.
export async function fileToResizedJpeg(file, maxPx = 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { dataUrl, base64: dataUrl.split(',')[1] || '', width: w, height: h };
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const dbl = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + dbl * dbl);
}

// Deterministic local matcher: vision returns dominant colors + soft filters;
// we score the demo catalog by color distance (base + accent color) so the
// suggestions always resolve to real, renderable products.
async function matchProducts(colors, filters) {
  const all = await listProducts();
  const targets = (colors || []).map(hexToRgb).filter(Boolean);
  const category = typeof filters?.category === 'string' && filters.category ? filters.category : 'keramika';
  const wantGlossy = typeof filters?.glossy === 'boolean' ? filters.glossy : null;

  const pool = all.filter((p) => p.category === category);
  const candidates = pool.length ? pool : all;
  if (!targets.length) return candidates.slice(0, 6).map((p) => p.id);

  const scored = candidates.map((p) => {
    const own = [hexToRgb(p.baseColorHex), hexToRgb(p.accentColorHex)].filter(Boolean);
    let best = Infinity;
    for (const o of own) for (const c of targets) best = Math.min(best, colorDistance(o, c));
    if (wantGlossy !== null && Boolean(p.glossy) === wantGlossy) best -= 25; // soft finish preference
    return { id: p.id, score: best };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, 6).map((s) => s.id);
}

// Per the build contract: analyzePhoto(file) -> {styleSummary, suggestedProductIds[]}
// (colors + suggestedFilters ride along for richer UI).
export async function analyzePhoto(file) {
  requireConfigured();
  const { base64 } = await fileToResizedJpeg(file, 1024);
  const res = await fetch(functionUrl(), {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ action: 'vision', imageBase64: base64, mimeType: 'image/jpeg' }),
  });
  if (!res.ok) throw httpError(res.status || 502);
  const data = await res.json();
  const styleSummary = String(data.styleSummary || '');
  const colors = Array.isArray(data.colors) ? data.colors.filter((c) => typeof c === 'string') : [];
  const suggestedFilters = data.suggestedFilters && typeof data.suggestedFilters === 'object' ? data.suggestedFilters : {};
  const suggestedProductIds = await matchProducts(colors, suggestedFilters);
  return { styleSummary, suggestedProductIds, colors, suggestedFilters };
}

// ---- virtual staging (PAID tier — gate behind explicit user action) ---------

// roomBase64: JPEG of the room (from fileToResizedJpeg), swatchBase64: PNG of
// the tile swatch (texture.js swatchDataUrl, prefix stripped). Returns the
// AI-staged render. The UI MUST label the result "AI impresija" — it is a
// prompt-based re-render, not a product-accurate texture map.
export async function stageRoom({ roomBase64, swatchBase64, productName, surface = 'floor' }) {
  requireConfigured();
  const res = await fetch(functionUrl(), {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({
      action: 'staging',
      roomBase64: String(roomBase64 || ''),
      swatchBase64: String(swatchBase64 || ''),
      productName: String(productName || ''),
      surface: surface === 'wall' ? 'wall' : 'floor',
    }),
  });
  if (!res.ok) throw httpError(res.status || 502);
  const data = await res.json();
  if (!data.imageBase64) throw httpError(502, 'staging_empty');
  return { imageBase64: String(data.imageBase64), mimeType: String(data.mimeType || 'image/png') };
}
