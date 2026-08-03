// ============================================================================
// views/savjetnik.js — "Savjetnik": the Terma chat dock.
//
// Owns the whole advisor experience:
//   • streaming chat (async-generator terma.chat → token-by-token bubbles),
//   • product cards when the model suggests products (db.getProduct +
//     texture.swatchDataUrl, price via domain.formatEur, links to #/proizvod/),
//   • photo-analysis flow with an explicit consent notice (persisted under
//     localStorage 'akv:terma-consent'),
//   • virtual staging behind a labeled button with the "AI impresija"
//     disclaimer (paid tier — always an explicit user action),
//   • graceful offline mode: when Terma is unavailable (CONFIG empty), a
//     friendly static Croatian explainer + 6 canned FAQ answers keep the view
//     alive — it is never dead.
//
// i18n: every label goes through t(key); because t() returns the key when the
// dictionary misses it, tr(key, fallback) keeps the UI Croatian either way.
//
// Visually this view is on the "Iris" design system (docs/DESIGN_SYSTEM.md):
// sampled teal/amber palette, Anton + Figtree from vendor/fonts/, and a single
// liquid-glass surface — the chat dock. The STYLES block near the bottom of
// this file carries the measured contrast ratio for every colour pair it
// introduces, plus the five mandatory degradation paths — the four automatic
// ones AND the manual html[data-transparency="reduced"] switch js/app.js owns,
// which is the only one iOS Safari users ever get. Read the comment block above
// STYLES before changing any colour here.
// ============================================================================

import {
  chat, analyzePhoto, stageRoom, resetChat, isConfigured,
  fileToResizedJpeg, TermaUnavailable,
} from '../terma.js';
import { CONFIG } from '../config.js';
import { getProduct } from '../db.js';
import { swatchDataUrl } from '../texture.js';
import { formatEur } from '../domain.js';
import { t } from '../i18n.js';

const CONSENT_KEY = 'akv:terma-consent';

// ---- tiny pure helpers ------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// t() with a Croatian fallback: missing keys must never leak into the UI.
const tr = (key, fallback, vars) => {
  const s = t(key, vars);
  return s === key ? fallback : s;
};

const toast = (msg) => { if (window.AKV && window.AKV.toast) window.AKV.toast(msg); };

const priceLabel = (p) => {
  if (p.priceM2 != null) return `${formatEur(p.priceM2)}/m²`;
  if (p.priceUnit != null) return `${formatEur(p.priceUnit)}/kom`;
  return '';
};

// ---- session state (survives view remounts within the page session) ---------

let history = [];      // [{role:'user'|'assistant', content}] — what the model sees
let transcript = [];   // render ops for replay: {kind:'me'|'bot'|'products'|'photo'|'image', ...}
let roomPhoto = null;  // {base64, dataUrl} — kept for the staging flow
let aborter = null;    // AbortController of the in-flight stream
let els = null;        // live DOM handles for the current mount

// ---- canned FAQ (offline fallback — and honest, useful content) -------------

const FAQ = [
  {
    q: 'Koje pločice odabrati za malu kupaonicu?',
    a: 'Svijetle pločice većeg formata (npr. 600×600 ili 300×600 mm) vizualno povećavaju prostor jer imaju manje fuga. Sjajne zidne pločice dodatno reflektiraju svjetlo. Za pod male kupaonice biraj mat, protukliznu površinu.',
  },
  {
    q: 'Sjajne ili mat pločice — što je bolje?',
    a: 'Sjajne reflektiraju svjetlo i lako se čiste, ali su skliske kad su mokre i pokazuju mrlje od vode — najbolje za zidove. Mat pločice su protukliznije i skrivaju tragove, pa su standard za podove, posebno u kupaonici.',
  },
  {
    q: 'Koliko pločica trebam naručiti?',
    a: 'Izračunaj površinu i dodaj 10% rezerve za rezanje, lom i kasnije popravke. Za dijagonalno polaganje ili riblju kost (herringbone) dodaj 15%. Uvijek naruči cijelu količinu odjednom — nijanse se razlikuju između serija.',
  },
  {
    q: 'Ide li podno grijanje ispod keramike?',
    a: 'Da — keramika je najbolja obloga za podno grijanje jer izvrsno provodi i zadržava toplinu. Bitno je koristiti fleksibilno ljepilo za grijane podove i pustiti estrih da se potpuno osuši prije polaganja. Akvaterm izvodi i centralno i podno grijanje.',
  },
  {
    q: 'Koju snagu klima uređaja trebam?',
    a: 'Orijentacijski oko 100 W rashladne snage po m²: za sobu od 20 m² to je ~2 kW (7000 BTU), za 30 m² ~2,6–3,5 kW. Na snagu utječu izolacija, kat i staklene površine, pa je najpouzdanija procjena na licu mjesta — Akvaterm ugrađuje Daikin i Mitsubishi uređaje.',
  },
  {
    q: 'Koju boju i širinu fuge odabrati?',
    a: 'Fuga u tonu pločice daje miran, jednolik izgled; kontrastna fuga naglašava raster. Za podove je praktičnija nešto tamnija fuga. Širina: rektificirane pločice 2–3 mm, standardne 3–5 mm. Bijelu fugu na podu izbjegavaj — brzo posivi.',
  },
];

// ---- transcript rendering ---------------------------------------------------

function scrollLog() {
  if (els && els.log) els.log.scrollTop = els.log.scrollHeight;
}

function bubble(who, text) {
  const el = document.createElement('div');
  el.className = `sv-msg is-${who}`;
  el.textContent = text;
  els.log.appendChild(el);
  scrollLog();
  return el;
}

function photoBubble(dataUrl) {
  const el = document.createElement('div');
  el.className = 'sv-msg is-me sv-photo';
  el.innerHTML = `<img alt="${esc(tr('sv.photoAlt', 'Fotografija prostora'))}" src="${esc(dataUrl)}">`;
  els.log.appendChild(el);
  scrollLog();
  return el;
}

function stagedImageBubble(dataUrl) {
  const el = document.createElement('div');
  el.className = 'sv-msg is-bot sv-staged';
  el.innerHTML = `
    <span class="sv-badge">${esc(tr('sv.aiBadge', 'AI impresija'))}</span>
    <img alt="${esc(tr('sv.stagedAlt', 'AI impresija prostora'))}" src="${esc(dataUrl)}">
    <p class="sv-disclaimer">${esc(tr('sv.stagingDisclaimer',
      'AI impresija je ilustrativna vizualizacija, ne točan prikaz proizvoda ni ponuda.'))}</p>`;
  els.log.appendChild(el);
  scrollLog();
  return el;
}

async function productCards(ids) {
  const wrap = document.createElement('div');
  wrap.className = 'sv-cards';
  els.log.appendChild(wrap);
  for (const id of ids.slice(0, 6)) {
    let p = null;
    try { p = await getProduct(id); } catch { p = null; }
    if (!p) continue;
    const card = document.createElement('a');
    card.className = 'sv-card';
    card.href = `#/proizvod/${encodeURIComponent(p.id)}`;
    let swatch = '';
    try { swatch = swatchDataUrl(p, 128); } catch { swatch = ''; }
    card.innerHTML = `
      ${swatch ? `<img class="sv-card-swatch" alt="" src="${esc(swatch)}">` : '<span class="sv-card-swatch"></span>'}
      <span class="sv-card-body">
        <span class="sv-card-name">${esc(p.name)}</span>
        <span class="sv-card-meta">${esc(p.brand || '')}${p.tileSizeMm ? ` · ${p.tileSizeMm[0]}×${p.tileSizeMm[1]} mm` : ''}</span>
        <span class="sv-card-price">${esc(priceLabel(p))}</span>
      </span>
      ${CONFIG.termaTextOnly ? '' : `<button type="button" class="sv-card-stage" data-stage="${esc(p.id)}"
        title="${esc(tr('sv.stageHint', 'Generiraj AI impresiju prostora s ovim proizvodom (ilustrativno)'))}">
        ✨ ${esc(tr('sv.stageBtn', 'AI impresija'))}</button>`}`;
    wrap.appendChild(card);
  }
  scrollLog();
  return wrap;
}

// Swatch dots for the colours the vision model read off the user's photo.
//
// These strings come from a model looking at an image someone may have sent
// the user — attacker-influenceable input, and text baked into a picture is a
// standard vision-model injection vector. Built as a string template they went
// straight into a `style` attribute, where esc() is no defence: it escapes
// & < > " ' and leaves `;` `(` `)` alone, so `red;background-image:url(https://
// attacker/p)` became a real outbound request (no CSP to stop it either).
// Two changes: the value must match #rrggbb, and it is assigned through the
// CSSOM — style.backgroundColor drops anything invalid instead of parsing it
// as a declaration list. The same check runs in the Edge Function and in
// js/terma.js; this is the last one, at the DOM boundary.
const HEX6 = /^#[0-9a-f]{6}$/i;

function colorDots(colors) {
  const valid = (Array.isArray(colors) ? colors : [])
    .filter((c) => typeof c === 'string' && HEX6.test(c.trim()))
    .map((c) => c.trim().toLowerCase())
    .slice(0, 6);
  if (!valid.length) return;
  const row = document.createElement('div');
  row.className = 'sv-colors';
  for (const hex of valid) {
    const dot = document.createElement('span');
    dot.className = 'sv-dot';
    dot.style.backgroundColor = hex;
    dot.title = hex;
    row.appendChild(dot);
  }
  els.log.appendChild(row);
  scrollLog();
}

async function replayTranscript() {
  for (const op of transcript) {
    if (op.kind === 'me') bubble('me', op.text);
    else if (op.kind === 'bot') bubble('bot', op.text);
    else if (op.kind === 'products') await productCards(op.ids);
    else if (op.kind === 'photo') photoBubble(op.dataUrl);
    else if (op.kind === 'image') stagedImageBubble(op.dataUrl);
    else if (op.kind === 'colors') colorDots(op.colors);
  }
}

// ---- chat flow --------------------------------------------------------------

async function sendMessage(text) {
  const clean = String(text || '').trim();
  if (!clean || aborter) return;
  transcript.push({ kind: 'me', text: clean });
  bubble('me', clean);
  history.push({ role: 'user', content: clean });

  const botEl = bubble('bot', '');
  botEl.classList.add('is-thinking');
  botEl.textContent = tr('sv.thinking', 'Terma razmišlja…');

  aborter = new AbortController();
  let acc = '';
  try {
    for await (const evt of chat(history.slice(), { signal: aborter.signal })) {
      if (Array.isArray(evt.products) && evt.products.length) {
        transcript.push({ kind: 'products', ids: evt.products });
        await productCards(evt.products);
      }
      if (evt.delta) {
        if (!acc) botEl.classList.remove('is-thinking');
        acc += evt.delta;
        botEl.textContent = acc;
        scrollLog();
      }
    }
    if (!acc) {
      acc = tr('sv.noAnswer', 'Nisam dobila odgovor — pokušaj preformulirati pitanje.');
      botEl.classList.remove('is-thinking');
      botEl.textContent = acc;
    }
    history.push({ role: 'assistant', content: acc });
    transcript.push({ kind: 'bot', text: acc });
  } catch (err) {
    botEl.classList.remove('is-thinking');
    if (err && err.name === 'AbortError') {
      botEl.remove();
    } else if (err instanceof TermaUnavailable) {
      botEl.remove();
      renderOffline();
      return;
    } else {
      const msg = (err && err.friendly) || tr('sv.error', 'Terma trenutačno nije dostupna. Pokušaj kasnije.');
      botEl.textContent = msg;
      transcript.push({ kind: 'bot', text: msg });
    }
    history.pop(); // the turn failed — let the user resend it
  } finally {
    aborter = null;
  }
}

// ---- photo-analysis flow (with consent) -------------------------------------

function hasConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
}

function askConsent(onAccept) {
  const card = document.createElement('div');
  card.className = 'sv-consent';
  card.innerHTML = `
    <p>${esc(tr('sv.consentNotice',
      'Fotografija se šalje Googleovom Gemini servisu radi analize stila. Ne šalji fotografije s osobama, dokumentima ili osobnim podacima. Nastavkom prihvaćaš obradu fotografije.'))}</p>
    <div class="sv-consent-actions">
      <button type="button" class="sv-btn sv-btn-primary" data-consent="yes">${esc(tr('sv.consentAccept', 'Prihvaćam'))}</button>
      <button type="button" class="sv-btn" data-consent="no">${esc(tr('sv.consentDecline', 'Odustani'))}</button>
    </div>`;
  els.log.appendChild(card);
  scrollLog();
  card.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    card.remove();
    if (btn.dataset.consent === 'yes') {
      try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* private mode */ }
      onAccept();
    }
  });
}

function pickPhoto() {
  if (hasConsent()) els.file.click();
  else askConsent(() => els.file.click());
}

async function onPhotoChosen(file) {
  if (!file) return;
  let resized;
  try { resized = await fileToResizedJpeg(file, 1024); }
  catch { toast(tr('sv.badImage', 'Tu fotografiju ne mogu pročitati — pokušaj drugu.')); return; }
  roomPhoto = { base64: resized.base64, dataUrl: resized.dataUrl };
  transcript.push({ kind: 'photo', dataUrl: resized.dataUrl });
  photoBubble(resized.dataUrl);

  const botEl = bubble('bot', tr('sv.analyzing', 'Analiziram fotografiju…'));
  botEl.classList.add('is-thinking');
  try {
    const out = await analyzePhoto(file);
    botEl.classList.remove('is-thinking');
    const summary = out.styleSummary || tr('sv.noStyle', 'Nisam uspjela pročitati stil s fotografije.');
    botEl.textContent = summary;
    transcript.push({ kind: 'bot', text: summary });
    if (out.colors && out.colors.length) {
      transcript.push({ kind: 'colors', colors: out.colors });
      colorDots(out.colors);
    }
    if (out.suggestedProductIds && out.suggestedProductIds.length) {
      const lead = tr('sv.suggestLead', 'Iz kataloga bi se ovome mogli uklopiti:');
      transcript.push({ kind: 'bot', text: lead });
      bubble('bot', lead);
      transcript.push({ kind: 'products', ids: out.suggestedProductIds });
      await productCards(out.suggestedProductIds);
    }
  } catch (err) {
    botEl.classList.remove('is-thinking');
    if (err instanceof TermaUnavailable) { botEl.remove(); renderOffline(); return; }
    const msg = (err && err.friendly) || tr('sv.error', 'Terma trenutačno nije dostupna. Pokušaj kasnije.');
    botEl.textContent = msg;
    transcript.push({ kind: 'bot', text: msg });
  }
}

// ---- staging flow (paid tier — explicit confirm with disclaimer) ------------

async function onStageClick(productId) {
  if (!roomPhoto) {
    toast(tr('sv.stageNeedsPhoto', 'Prvo učitaj fotografiju prostora gumbom „Analiza fotografije".'));
    pickPhoto();
    return;
  }
  let product = null;
  try { product = await getProduct(productId); } catch { product = null; }
  if (!product) { toast(tr('sv.noProduct', 'Taj proizvod više nije u katalogu.')); return; }

  const card = document.createElement('div');
  card.className = 'sv-consent';
  card.innerHTML = `
    <p><strong>${esc(tr('sv.aiBadge', 'AI impresija'))}</strong> — ${esc(tr('sv.stageConfirm',
      'rezultat je ilustrativna AI vizualizacija, ne točan prikaz proizvoda. Generiranje koristi plaćeni Gemini servis i traje nekoliko sekundi.'))}</p>
    <div class="sv-consent-actions">
      <button type="button" class="sv-btn sv-btn-primary" data-go="yes">${esc(tr('sv.stageGo', 'Generiraj'))}</button>
      <button type="button" class="sv-btn" data-go="no">${esc(tr('sv.consentDecline', 'Odustani'))}</button>
    </div>`;
  els.log.appendChild(card);
  scrollLog();
  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    card.remove();
    if (btn.dataset.go !== 'yes') return;

    const botEl = bubble('bot', tr('sv.staging', 'Generiram AI impresiju…'));
    botEl.classList.add('is-thinking');
    try {
      const swatch = swatchDataUrl(product, 256);
      const swatchBase64 = String(swatch).split(',')[1] || '';
      const out = await stageRoom({
        roomBase64: roomPhoto.base64,
        swatchBase64,
        productName: product.name,
        surface: 'floor',
      });
      botEl.remove();
      const dataUrl = `data:${out.mimeType};base64,${out.imageBase64}`;
      transcript.push({ kind: 'image', dataUrl });
      stagedImageBubble(dataUrl);
    } catch (err) {
      botEl.classList.remove('is-thinking');
      if (err instanceof TermaUnavailable) { botEl.remove(); renderOffline(); return; }
      const msg = err && err.status === 429
        ? tr('sv.busy', 'Terma je trenutačno zauzeta. Pokušaj ponovno za nekoliko sekundi.')
        : err && err.status === 503
          ? tr('sv.stagingOff', 'AI impresija nije uključena na ovom poslužitelju (zahtijeva plaćenu razinu Gemini API-ja).')
          : tr('sv.stagingFail', 'Generiranje impresije nije uspjelo. Pokušaj ponovno kasnije.');
      botEl.textContent = msg;
      transcript.push({ kind: 'bot', text: msg });
    }
  });
}

// ---- offline fallback (TermaUnavailable → never a dead view) ----------------

// Akvaterm d.o.o., Dubrovnik — the real contact path when the FAQ runs out.
// Deliberately no opening hours: none are verified, and inventing them for a
// real business is worse than omitting them.
const CONTACT = {
  person: 'Boris Dujmović',
  tel: '+385 98 345 464',
  telHref: 'tel:+38598345464',
  email: 'akvaterm.dubrovnik@gmail.com',
  address: 'Bokeljska 12, Dubrovnik',
};

function contactCard() {
  return `
    <div class="sv-contact">
      <h3>${esc(tr('sv.contactTitle', 'Niste našli odgovor? Nazovite Akvaterm'))}</h3>
      <p>${esc(tr('sv.contactBody',
        'Za konkretnu ponudu, dostupnost i izlazak na teren javite se izravno — brže je nego bilo koji chat.'))}</p>
      <div class="sv-contact-actions">
        <a class="sv-btn sv-btn-primary" href="${esc(CONTACT.telHref)}">📞 ${esc(CONTACT.person)} · ${esc(CONTACT.tel)}</a>
        <a class="sv-btn" href="mailto:${esc(CONTACT.email)}">✉ ${esc(CONTACT.email)}</a>
      </div>
      <p class="sv-contact-meta">${esc(CONTACT.address)}</p>
    </div>`;
}

function renderOffline() {
  if (!els || !els.root) return;
  // #svLog stays in the markup (bubble() needs it) but the STYLES hide it
  // while it is :empty — otherwise a ~400px void sits between the explainer
  // and the FAQ chips before the visitor has asked anything.
  els.root.innerHTML = `
    <div class="sv-offline">
      <h2>${esc(tr('sv.offlineTitle', 'Terma trenutačno nije povezana'))}</h2>
      <p>${esc(tr('sv.offlineBody',
        'Aplikacija radi u demo načinu bez poslužitelja, pa AI savjetnica nije dostupna. Katalog i dizajner rade normalno. U međuvremenu — odgovori na najčešća pitanja:'))}</p>
    </div>
    <div class="sv-log" id="svLog" aria-live="polite"></div>
    <p class="sv-label">${esc(tr('sv.faqLabel', 'Česta pitanja'))}</p>
    <div class="sv-chips" id="svFaq">
      ${FAQ.map((f, i) => `<button type="button" class="sv-chip" data-faq="${i}">${esc(f.q)}</button>`).join('')}
    </div>
    ${contactCard()}`;
  els.log = els.root.querySelector('#svLog');
  els.root.querySelector('#svFaq').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-faq]');
    if (!btn) return;
    const f = FAQ[Number(btn.dataset.faq)];
    if (!f) return;
    bubble('me', f.q);
    const answer = bubble('bot', f.a);
    // The chips sit below the log, so without this the answer lands above the
    // fold the visitor is looking at and the tap reads as "nothing happened".
    try { answer.scrollIntoView({ block: 'nearest' }); } catch { /* older engines */ }
  });
}

// ---- view -------------------------------------------------------------------

// Scoped styles ride with the view so the chat dock renders correctly even
// before the shared stylesheet learns about it.
//
// ============================ IRIS + LIQUID GLASS ===========================
// Palette: docs/DESIGN_SYSTEM.md ("Iris"), every base value pixel-sampled from
// the operator's reference. Type: Anton (display) + Figtree (text), vendored
// under vendor/fonts/ — see vendor/fonts/PROVENANCE.md.
//
// EVERY colour pair below was measured, not eyeballed. Method: WCAG 2.x
// relative luminance, sRGB alpha compositing (which is what the browser does),
// and — for the glass — the WORST-CASE backdrop, i.e. pure black behind the
// panel. That is the darkest composite the panel can ever produce, so a pair
// that passes there passes over anything.
//
// ANTON METRIC HAZARD — re-measured in the browser against the vendored face
// (canvas actualBoundingBox at 400px, then scaled; strut-probe for the
// baseline). The numbers are worse than the 1.100em figure this work started
// from, and the conclusion changes because of it:
//
//   Anton, plain caps "TERMA"      ink ascent 0.8594em, descent 0
//   Anton, Croatian "ČŠŽĆĐ"        ink ascent 1.1094em, descent 0.0156em
//                                  -> total ink 1.1250em
//
// The declared ascender is smaller than the caron ink, so the ink pokes out of
// the TOP of the line box at EVERY plausible line-height: measured overshoot at
// font-size 28px is 5.46px at line-height 1.05, still 1.46px at 1.30, and it
// only reaches zero somewhere around 1.44. Line-height alone therefore CANNOT
// fix this — it is not that kind of bug.
//
// So the rule is enforced twice over:
//   1. line-height >= 1.05 on every Anton rule. This is what stops the carons
//      of line 2 colliding with line 1 when a heading wraps — a real, separate
//      problem that line-height does solve.
//   2. overflow:visible plus padding-top:.18em (> the 0.16em overshoot measured
//      at line-height 1.12) on every Anton heading, so the ink sits inside the
//      element's own padding box and survives even if some future ancestor
//      starts clipping.
// Verified in-browser: the hero h1 has zero clipping ancestors, and .sv-log —
// the only overflow container in this view — contains no Anton at all.
// Figtree's caron ink is 0.70em ascent / 0.02em descent: no hazard.
//
// GLASS BUDGET: exactly ONE backdrop-filter surface in this view (.sv-log).
// With the standing nav + tab bar that is 3 on screen, the documented ceiling.
// Cards, chips, consent and contact panels are deliberately opaque — which is
// also why the degradation blocks at the bottom name only .sv-log (plus the bot
// bubble, whose translucent white plate is sampled off it): there is no second
// glass surface in this view for them to have missed.
//
// SAFARI: -webkit-backdrop-filter silently drops the whole declaration when it
// contains var(). Those lines are written with LITERAL values; the unprefixed
// property carries the token. Keep them in sync by hand.
// ============================================================================
const STYLES = `
  .sv-wrap{
    /* --- Iris tokens from css/styles.css. Every fallback literal is the value
       that sheet actually ships today, so the view renders identically if the
       cascade is ever missing — it never silently invents a shade. --------- */
    --sv-teal:var(--teal-600,#139EB1);         /* sampled */
    --sv-teal-hi:var(--teal-300,#09AFBD);      /* sampled */
    --sv-amber:var(--amber-500,#EAA651);       /* sampled */
    --sv-brown:var(--brown-800,#68340F);       /* sampled */
    --sv-ink:var(--ink,#313131);               /* sampled */
    --sv-teal-ink:var(--teal-700,#0D707D);     /* derived: 5.78:1 on #FFF | 5.17:1 on --paper | 5.26:1 on the bot bubble | #FFF on it 5.78:1 */
    --sv-teal-deep:var(--teal-800,#0B5A65);    /* derived: #FFF on it 7.88:1 */
    --sv-amber-ink:var(--amber-ink,#935616);   /* derived: 5.86:1 on #FFF | 5.23:1 on --paper | 4.76:1 on the amber wash */
    --sv-muted:var(--mauve-600,#756168);       /* derived: 5.73:1 on #FFF | 5.12:1 on --paper | 5.20:1 on the bot bubble */

    /* --- surfaces (opaque, so their contrast is deterministic) ------------- */
    --sv-surface:var(--surface,#FFFFFF);
    --sv-wash-teal:#DCEAEC;   /* = --teal-600 @ .10 over --paper. ink 10.55:1, teal-ink 4.69:1 */
    --sv-wash-amber:#F1E6D8;  /* = --amber-500 @ .16 over --paper. ink 10.56:1, amber-ink 4.76:1 */
    --sv-line:var(--line,rgba(104,52,15,.12));            /* warm hairline — never neutral grey */
    --sv-line-teal:rgba(19,158,177,.30);
    --sv-shadow:0 10px 30px -18px rgba(93,79,79,.55);     /* --shadow-warm, per DESIGN_SYSTEM */

    /* --- glass ------------------------------------------------------------
       Tint hsl(187 44% 97%) = #F4FAFB — cool, teal-leaning, per DESIGN_SYSTEM
       rule 4 (never a grey glass). Alpha comes from --glass-alpha-text (.78).

       Floor, computed rather than assumed: over a PURE-BLACK backdrop — the
       darkest composite this panel can ever produce — that tint needs alpha
       >= 0.62 for --ink to reach 4.5:1 (0.62 gives 4.64:1). The shipped .78
       lands on worst-case composite #BEC3C4, where --ink measures 7.31:1, and
       clears the 0.58 light-glass floor from the glass research with room to
       spare.

       CONSEQUENCE, a rule and not a preference: only --sv-ink may sit DIRECTLY
       on this glass. --sv-teal-ink measures 3.25:1 there and --sv-amber-ink
       3.29:1. Every coloured string in this view therefore sits on an opaque
       child surface, never on the panel itself. */
    --sv-glass-bg:var(--glass-bg-text,hsl(187 44% 97% / .78));
    --sv-glass-fx:var(--glass-fx-md,blur(18px) saturate(180%) brightness(1.06));
    --sv-glass-solid:#F4FAFB;            /* the same tint, opaque — all glass fallbacks land here */

    --sv-font-display:var(--font-display,'Anton','Haettenschweiler','Arial Narrow',system-ui,sans-serif);
    --sv-font-text:var(--font-text,'Figtree',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);

    /* --- CORNER LADDER -----------------------------------------------------
       css/styles.css owns the scale (--r-xs … --r-pill); the literal after each
       comma is the same step, so this view keeps the app's corner language even
       before that sheet lands. Concentric nesting is the rule — a child's arc
       is its parent's arc MINUS the padding between them. */
    --sv-r-xs:var(--r-xs,8px);
    --sv-r-sm:var(--r-sm,12px);
    --sv-r-md:var(--r-md,16px);
    --sv-r-lg:var(--r-lg,22px);
    --sv-r-xl:var(--r-xl,28px);
    --sv-r-pill:var(--r-pill,999px);

    display:flex;flex-direction:column;gap:16px;max-width:760px;margin:0 auto;padding:12px;min-height:0;
    font-family:var(--sv-font-text);color:var(--sv-ink);
    /* Phone bottom gutter. #main already reserves the tab bar; this adds the
       clearance on top of it, plus the home-indicator inset again, because with
       viewport-fit=cover the bar carries that inset too. */
    padding-bottom:calc(env(safe-area-inset-bottom,0px) + 28px);
  }
  @media(min-width:720px){.sv-wrap{padding-bottom:12px}}
  /* THE CHAT DOCK'S BLUR DEPENDS ON THIS LINE. css/styles.css:1022 runs the
     shell entrance on every direct child of #main —
       #main.view-enter>*{animation:riseIn var(--dur-2) var(--smooth) both}
     — and riseIn ends on transform:none. fill-mode BOTH freezes the last
     keyframe as the computed style, and a transform resolved by an animation
     stays a MATRIX: measured here in Chrome, .sv-wrap settles on
     transform:matrix(1,0,0,1,0,0) and keeps it. A transformed element is a
     BACKDROP ROOT, so .sv-log — the only backdrop-filter surface in this view,
     and the one the whole GLASS BUDGET note above is written around — had
     nothing to sample and its blur was inert. Same class of defect
     css/styles.css records against viewFade's filter:blur(0px).
     BACKWARDS keeps the entrance and hands the element back to its own
     stylesheet at the end. Specificity (1,2,0) beats the sheet's (1,1,0). The
     root cause belongs in css/styles.css; this is the scoped repair. */
  #main.view-enter>.sv-wrap{animation-fill-mode:backwards}

  /* ---------------------------------------------------------------- hero */
  /* flex-wrap, not a media query: on a 400px viewport "Novi razgovor" cannot
     share a row with the wordmark, and wrapping is the only behaviour that
     keeps the 44px tap target intact. Measured at 400px CSS width. */
  .sv-head{
    display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;
    background:var(--sv-surface);border:1px solid var(--sv-line);border-radius:var(--sv-r-xl);
    padding:16px 20px 18px;box-shadow:var(--sv-shadow);position:relative;overflow:visible;
  }
  .sv-head #svReset{flex:0 0 auto;margin-left:auto}
  /* teal -> heat rule: the brand's own meaning (voda -> toplina). Decorative.
     The inset MUST be at least the card's own radius. The card is overflow:
     visible (Anton caron guard), so at the bottom edge the silhouette only
     spans [radius, width - radius]; a rule inset less than that pokes out past
     the corner into the page. It used to sit at 16px inside a 20px radius and
     did exactly that. 30px clears the --r-xl step with 2px to spare. */
  .sv-head::after{
    content:"";position:absolute;left:30px;right:30px;bottom:0;height:3px;
    border-radius:var(--sv-r-pill);
    background:linear-gradient(90deg,var(--sv-teal-hi),var(--sv-teal) 42%,var(--sv-amber));
  }
  /* Water -> heat, in one 52px mark. Sampled every 0.5% along the gradient and
     took the minimum: white text measures 5.78:1 at its WORST point (the
     teal-700 end). Endpoints: teal-700 5.78:1, teal-800 7.88:1, amber-ink
     5.86:1. The glyph is Anton but caron-free, so line-height 1.06 suffices. */
  .sv-avatar{
    flex:0 0 auto;width:52px;height:52px;border-radius:var(--sv-r-md);display:grid;place-items:center;
    background:linear-gradient(150deg,var(--sv-teal-ink) 0%,var(--sv-teal-deep) 45%,var(--sv-amber-ink) 100%);
    color:#fff;font-family:var(--sv-font-display);font-size:26px;line-height:1.06;
    letter-spacing:.01em;box-shadow:inset 0 1px 0 rgba(255,255,255,.34);
  }
  .sv-head-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 8rem}
  .sv-head h1{
    margin:0;font-family:var(--sv-font-display);font-weight:400;
    font-size:clamp(1.75rem,5.4vw,2.25rem);letter-spacing:-.015em;
    text-transform:uppercase;color:var(--sv-teal-ink);      /* 5.78:1 on #FFF */
    /* Anton caron guard — see the metric note above STYLES. */
    line-height:1.12;padding-top:.18em;overflow:visible;
  }
  .sv-kicker{
    margin:0;font-weight:500;font-size:.75rem;letter-spacing:.08em;line-height:1.4;
    text-transform:uppercase;color:var(--sv-muted);          /* 5.73:1 on #FFF */
  }
  .sv-body{display:flex;flex-direction:column;gap:14px;min-height:0}
  /* the reference's credit-line gesture, reused as a section label */
  .sv-label{
    margin:0;font-weight:500;font-size:.75rem;letter-spacing:.08em;line-height:1.4;
    text-transform:uppercase;color:var(--sv-muted);          /* 5.12:1 on --paper */
  }

  /* --------------------------------------------------------- glass chat dock */
  .sv-log{
    display:flex;flex-direction:column;gap:10px;overflow-y:auto;
    min-height:200px;max-height:52vh;padding:16px;border-radius:var(--sv-r-xl);
    background:
      linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,0) 46%),
      var(--sv-glass-bg);
    /* Order matters. Chrome treats -webkit-backdrop-filter as an ALIAS of the
       standard property, so whichever comes last wins there; putting the
       prefixed one FIRST means every engine that understands the standard
       property uses the token, and the literal only ever serves the older
       WebKit builds that have no unprefixed property at all.
       The literal must stay equal to --glass-fx-md in css/styles.css. */
    -webkit-backdrop-filter:blur(18px) saturate(180%) brightness(1.06);   /* LITERAL — Safari drops the whole line if it contains var() */
    backdrop-filter:var(--sv-glass-fx);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.62),               /* rim light */
      inset 0 0 0 1px var(--sv-line-teal),
      var(--sv-shadow);
    transition:box-shadow 220ms cubic-bezier(.25,1,.5,1);
  }
  .sv-log:empty{display:none}
  /* Warm amber rim light on interaction — box-shadow only. blur() is NEVER
     animated (compositor re-samples the backdrop every frame). */
  .sv-log:hover,.sv-log:focus-within{
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.70),
      inset 0 0 0 1px rgba(185,108,28,.34),   /* --amber-600 #B96C1C @ .34 — a 1px rim, carries no text */
      var(--sv-shadow);
  }

  /* ------------------------------------------------------------- messages */
  /* Concentric: the dock is --sv-r-xl with 16px of padding, so a bubble that
     sits flush against its inner edge takes that difference. The one small
     corner is the speech tail and stays small on purpose. */
  .sv-msg{
    max-width:86%;padding:11px 16px;border-radius:calc(var(--sv-r-xl) - 16px);
    font-size:.9375rem;line-height:1.6;
    white-space:pre-wrap;word-break:break-word;
  }
  /* User turn: solid teal-ink fill, white text = 5.78:1 */
  .sv-msg.is-me{
    align-self:flex-end;background:var(--sv-teal-ink);color:#fff;
    border-bottom-right-radius:6px;box-shadow:inset 0 1px 0 rgba(255,255,255,.20);
  }
  /* Terma's turn: an opaque-enough white plate ON the glass. rgba(255,255,255,.82)
     over the worst-case dock composite #BEC3C4 resolves to #F3F4F4, where
     --sv-ink measures 11.81:1 and --sv-muted 5.20:1. */
  .sv-msg.is-bot{
    align-self:flex-start;background:rgba(255,255,255,.82);color:var(--sv-ink);
    border:1px solid var(--sv-line);border-bottom-left-radius:6px;
  }
  /* colour, not opacity: opacity would drag this below AA on a light surface */
  .sv-msg.is-thinking{color:var(--sv-muted);font-style:italic}   /* 5.20:1 on the bot bubble */
  .sv-photo img,.sv-staged img{max-width:100%;border-radius:var(--sv-r-sm);display:block}

  /* AI-impresija badge — amber-500 fill, brown-800 text = 4.83:1 */
  .sv-badge{
    display:inline-block;background:var(--sv-amber);color:var(--sv-brown);
    font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
    padding:3px 10px;border-radius:var(--sv-r-pill);margin-bottom:8px;
  }
  .sv-disclaimer{font-size:.78rem;line-height:1.5;color:var(--sv-muted);margin:8px 0 0}  /* 5.20:1 on the bot bubble */
  .sv-colors{display:flex;gap:7px;align-self:flex-start;padding:2px 6px}
  .sv-dot{width:22px;height:22px;border-radius:50%;border:1px solid rgba(93,79,79,.28)}

  /* --------------------------------------------------------- product cards */
  .sv-cards{display:flex;flex-direction:column;gap:9px;align-self:stretch}
  .sv-card{
    display:flex;align-items:center;gap:11px;background:var(--sv-surface);
    border:1px solid var(--sv-line);border-radius:var(--sv-r-lg);padding:10px 12px;
    text-decoration:none;color:var(--sv-ink);
    transition:border-color 180ms cubic-bezier(.25,1,.5,1),transform 180ms cubic-bezier(.25,1,.5,1);
  }
  .sv-card:hover{border-color:var(--sv-line-teal)}
  .sv-card:active{transform:scale(.99)}
  /* Concentric inside the --sv-r-lg card at 10px of padding. */
  .sv-card-swatch{width:54px;height:54px;border-radius:calc(var(--sv-r-lg) - 10px);flex:0 0 auto;background:var(--sv-wash-teal);object-fit:cover}
  .sv-card-body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
  /* Figtree — safe to clip. Anton would lose its carons here. */
  .sv-card-name{font-weight:600;font-size:1.0625rem;letter-spacing:-.005em;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sv-card-meta{font-size:.75rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--sv-muted)}  /* 5.73:1 on #FFF */
  .sv-card-price{font-size:.9375rem;font-weight:700;color:var(--sv-teal-ink);font-variant-numeric:tabular-nums}        /* 5.78:1 on #FFF */
  .sv-card-stage{
    flex:0 0 auto;min-height:44px;border:1px solid var(--sv-teal-ink);color:var(--sv-teal-ink);   /* 5.78:1 on #FFF */
    background:transparent;border-radius:var(--sv-r-pill);padding:0 16px;cursor:pointer;
    font-family:inherit;font-size:.8rem;font-weight:600;letter-spacing:.02em;
    transition:background-color 180ms cubic-bezier(.25,1,.5,1);
  }
  .sv-card-stage:hover{background:var(--sv-wash-teal)}   /* teal-ink on #DCEAEC = 4.69:1 — the tightest pair in this view */

  /* ----------------------------------------------------- chips / controls */
  .sv-chips{display:flex;flex-wrap:wrap;gap:9px}
  .sv-chip{
    min-height:44px;border:1px solid var(--sv-line);background:var(--sv-surface);
    border-radius:var(--sv-r-pill);padding:9px 16px;cursor:pointer;color:var(--sv-ink);
    font-family:inherit;font-size:.875rem;font-weight:500;line-height:1.4;text-align:left;
    transition:background-color 180ms cubic-bezier(.25,1,.5,1),border-color 180ms cubic-bezier(.25,1,.5,1);
  }
  .sv-chip:hover{background:var(--sv-wash-teal);border-color:var(--sv-line-teal)}  /* ink on #DCEAEC = 10.55:1 */
  .sv-inputrow{display:flex;gap:9px}
  .sv-inputrow input{
    flex:1;min-height:44px;border:1px solid var(--sv-line);border-radius:var(--sv-r-md);padding:0 16px;
    background:var(--sv-surface);color:var(--sv-ink);font-family:inherit;font-size:.9375rem;
  }
  .sv-inputrow input::placeholder{color:var(--sv-muted)}   /* 5.73:1 on #FFF */
  .sv-inputrow input:focus-visible{outline:2.5px solid var(--sv-teal-ink);outline-offset:2px}
  .sv-btn{
    min-height:44px;border:1px solid var(--sv-line);background:var(--sv-surface);color:var(--sv-ink);
    border-radius:var(--sv-r-pill);padding:0 20px;cursor:pointer;
    font-family:inherit;font-size:.875rem;font-weight:600;letter-spacing:.02em;
    transition:background-color 180ms cubic-bezier(.25,1,.5,1),transform 180ms cubic-bezier(.34,1.4,.5,1);
  }
  .sv-btn:hover{background:var(--sv-wash-teal)}
  .sv-btn:active{transform:scale(.97)}
  .sv-btn-primary{background:var(--sv-teal-ink);border-color:var(--sv-teal-ink);color:#fff}  /* 5.78:1 */
  .sv-btn-primary:hover{background:var(--sv-teal-deep);border-color:var(--sv-teal-deep)}     /* #FFF on --teal-800 = 7.88:1 */
  .sv-toolrow{display:flex;gap:9px;flex-wrap:wrap}

  /* ----------------------------------------------- consent / staging cards */
  /* Amber = heat = "this costs something / read me". Opaque, never glass. */
  .sv-consent{
    align-self:stretch;background:var(--sv-wash-amber);border:1px solid var(--sv-amber-ink);
    border-radius:var(--sv-r-lg);padding:16px;font-size:.9rem;line-height:1.55;color:var(--sv-ink);  /* 10.56:1 */
  }
  .sv-consent strong{color:var(--sv-amber-ink)}   /* 4.76:1 on #F1E6D8 */
  .sv-consent-actions{display:flex;gap:9px;margin-top:12px;flex-wrap:wrap}

  /* -------------------------------------------------- offline / contact */
  .sv-offline{background:var(--sv-wash-amber);border:1px solid var(--sv-line);border-radius:var(--sv-r-xl);padding:20px;box-shadow:var(--sv-shadow)}
  .sv-offline h2{
    margin:0 0 10px;font-family:var(--sv-font-display);font-weight:400;
    font-size:clamp(1.4rem,3.6vw,1.85rem);letter-spacing:-.01em;
    text-transform:uppercase;color:var(--sv-amber-ink);      /* 4.76:1 on #F1E6D8 */
    line-height:1.12;padding-top:.18em;overflow:visible;     /* Anton caron guard — "TRENUTAČNO" */
  }
  .sv-offline p{margin:0;font-size:.9375rem;line-height:1.6;color:var(--sv-ink)}   /* 10.56:1 */
  .sv-contact{background:var(--sv-surface);border:1px solid var(--sv-line);border-radius:var(--sv-r-xl);padding:20px;box-shadow:var(--sv-shadow)}
  .sv-contact h3{
    margin:0 0 8px;font-family:var(--sv-font-display);font-weight:400;
    font-size:clamp(1.2rem,3vw,1.5rem);letter-spacing:-.005em;
    text-transform:uppercase;color:var(--sv-teal-ink);       /* 5.78:1 on #FFF */
    line-height:1.12;padding-top:.18em;overflow:visible;     /* Anton caron guard — "NAŠLI" */
  }
  .sv-contact p{margin:0 0 12px;font-size:.9375rem;line-height:1.6}
  .sv-contact-actions{display:flex;flex-wrap:wrap;gap:9px}
  .sv-contact-actions .sv-btn{display:inline-flex;align-items:center;text-decoration:none}
  .sv-contact-actions .sv-btn-primary{color:#fff}
  .sv-contact .sv-contact-meta{margin:12px 0 0;font-size:.75rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--sv-muted)}

  /* ---- entrance ----------------------------------------------------------
     Named surfaces only, and only ones that are NOT ancestors of .sv-log —
     that is this view's single backdrop-filter surface, and an animated
     opacity/transform on a parent would make it a backdrop root and flatten the
     glass to a plain tint. .sv-wrap and .sv-body are therefore untouched;
     .sv-head, .sv-offline and .sv-contact are siblings of the dock.
     Fill mode 'backwards', not 'both': 'both' freezes the final keyframe as the
     computed style, and a transform resolved by an animation stays a matrix
     even where the keyframe says none — and a matrix is itself a backdrop
     root. 'backwards' hands the element back to its own stylesheet at the end. */
  @media (prefers-reduced-motion:no-preference){
    @keyframes sv-rise{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:none}}
    .sv-head{animation:sv-rise 420ms cubic-bezier(.25,1,.5,1) backwards}
    .sv-offline{animation:sv-rise 420ms cubic-bezier(.25,1,.5,1) 60ms backwards}
    .sv-contact{animation:sv-rise 420ms cubic-bezier(.25,1,.5,1) 120ms backwards}
  }

  /* ====================== the five degradation paths ======================
     1. no backdrop-filter            2. OS reduced transparency
     3. MANUAL "Smanji prozirnost"    4. increased contrast / forced colors
     5. reduced motion

     Every "no glass" path lands on the SAME opaque tint --sv-glass-solid
     #F4FAFB, so the layout never shifts — only the translucency goes. Measured
     on that tint (sRGB relative luminance, WCAG 2.x), so the ledger above holds
     unchanged on every one of them:

       --sv-ink   #313131 on #F4FAFB  12.34:1
       --sv-muted #756168 on #F4FAFB   5.43:1

     and on the bot bubble, which these paths make fully opaque #FFFFFF:

       --sv-ink   #313131 on #FFFFFF  13.01:1
       --sv-muted #756168 on #FFFFFF   5.73:1

     Each of those beats the translucent case it replaces, surface for surface:
     ink on the panel 12.34:1 vs 7.31:1, ink on the bubble 13.01:1 vs 11.81:1,
     muted on the bubble 5.73:1 vs 5.20:1. That is the point — degrading the
     glass never costs contrast, so no path needs its own ledger.

     .sv-log is the ONLY backdrop-filter surface in this view (see GLASS BUDGET
     above), so it is the only surface these lists have to name. */

  /* 1 — engine cannot blur (older Firefox, blur disabled, low-power modes). */
  @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
    .sv-wrap .sv-log{background:var(--sv-glass-solid);box-shadow:inset 0 0 0 1px var(--sv-line-teal),var(--sv-shadow)}
  }
  /* 2 — the OS says translucency hurts this user.
     Gated on html:not([data-transparency="full"]) exactly as css/styles.css's
     own path 2 is: data-transparency="full" is how a user says "I know, keep
     the glass", and it must win over the OS hint. Ungated (as this shipped),
     the shell bars came back as live glass for that user while this panel
     stayed pinned solid — the two halves of the same screen disagreeing. */
  @media (prefers-reduced-transparency:reduce){
    html:not([data-transparency="full"]) .sv-wrap .sv-log{
      background:var(--sv-glass-solid);backdrop-filter:none;-webkit-backdrop-filter:none;
      box-shadow:inset 0 0 0 1px var(--sv-line-teal),var(--sv-shadow);
    }
    html:not([data-transparency="full"]) .sv-wrap .sv-msg.is-bot{background:#fff}
  }
  /* 3 — MANUAL escape hatch: html[data-transparency="reduced"], written by
     applyTransparency() in js/app.js from the "Smanji prozirnost" switch in the
     Više menu.

     NOT a duplicate of path 2, and not optional. Safari never reports
     prefers-reduced-transparency and iOS Safari is the bulk of this audience,
     so path 2 never fires for them — this rule is the ONLY way those users can
     turn the blur off. Before it existed the switch solidified the top bar and
     the tab bar (css/styles.css has always had this path) and left the chat
     dock blurred, which reads as a broken switch rather than a partial one.

     Unconditional by design: an explicit "reduced" is a decision, not a hint,
     so nothing gates it. Mirrors the equivalent block in css/styles.css. */
  html[data-transparency="reduced"] .sv-wrap .sv-log{
    background:var(--sv-glass-solid);backdrop-filter:none;-webkit-backdrop-filter:none;
    box-shadow:inset 0 0 0 1px var(--sv-line-teal),var(--sv-shadow);
  }
  html[data-transparency="reduced"] .sv-wrap .sv-msg.is-bot{background:#fff}
  /* 4a — the OS asks for more contrast: drop the glass, harden the hairlines. */
  @media (prefers-contrast:more){
    .sv-wrap .sv-log{
      background:var(--sv-glass-solid);backdrop-filter:none;-webkit-backdrop-filter:none;
      box-shadow:none;border:2px solid var(--sv-teal-ink);
    }
    .sv-wrap .sv-msg.is-bot{background:#fff;border-color:var(--sv-teal-ink)}
    .sv-wrap .sv-card,.sv-wrap .sv-chip,.sv-wrap .sv-btn,.sv-wrap .sv-inputrow input{border-color:var(--sv-ink)}
    .sv-wrap .sv-card-meta,.sv-wrap .sv-disclaimer,.sv-wrap .sv-contact-meta,
    .sv-wrap .sv-kicker,.sv-wrap .sv-msg.is-thinking{color:var(--sv-ink)}
  }
  /* 4b — Windows High Contrast: hand every colour back to the OS. */
  @media (forced-colors:active){
    .sv-wrap .sv-log,.sv-wrap .sv-msg,.sv-wrap .sv-card,.sv-wrap .sv-chip,.sv-wrap .sv-btn,
    .sv-wrap .sv-consent,.sv-wrap .sv-offline,.sv-wrap .sv-contact,.sv-wrap .sv-head{
      background:Canvas;color:CanvasText;border:1px solid CanvasText;
      backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none;
    }
    .sv-wrap .sv-avatar,.sv-wrap .sv-badge{background:Canvas;color:CanvasText;border:1px solid CanvasText}
    .sv-wrap .sv-head::after{background:CanvasText}
    .sv-wrap .sv-btn-primary{background:Highlight;color:HighlightText;border-color:Highlight}
    .sv-wrap .sv-msg.is-me{background:Canvas;color:CanvasText}
    .sv-wrap .sv-dot{forced-color-adjust:none}   /* the swatches ARE the information */
  }
  /* 5 — motion. Entrance is opt-in; everything else is turned off explicitly. */
  @media (prefers-reduced-motion:no-preference){
    .sv-msg{animation:svIn .18s cubic-bezier(.25,1,.5,1)}
    @keyframes svIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  }
  @media (prefers-reduced-motion:reduce){
    .sv-wrap *,.sv-wrap *::before,.sv-wrap *::after{animation:none!important;transition:none!important}
  }
`;

const CHIPS = [
  ['sv.chip1', 'Koje pločice preporučuješ za kupaonicu do 30 €/m²?'],
  ['sv.chip2', 'Imate li Daikin klima uređaje i koja snaga mi treba za 25 m²?'],
  ['sv.chip3', 'Što se slaže uz travertin u dnevnom boravku?'],
];

export async function render(container, params) { // params unused — route carries none
  els = { root: null, log: null, file: null };

  // The hero is the "premium" gesture: Anton wordmark + the wide-tracked
  // uppercase kicker that is the signature of the Iris type system, over a
  // teal→amber rule (voda → toplina). sv.title stays the accessible name of
  // the section so the existing translation is not orphaned.
  container.innerHTML = `
    <style>${STYLES}</style>
    <section class="sv-wrap" id="svRoot" aria-label="${esc(tr('sv.title', 'Terma — savjetnica'))}">
      <header class="sv-head">
        <span class="sv-avatar" aria-hidden="true">T</span>
        <span class="sv-head-txt">
          <h1>${esc(tr('sv.brand', 'Terma'))}</h1>
          <p class="sv-kicker">${esc(tr('sv.kicker', 'Akvatermova savjetnica'))}</p>
        </span>
        <button type="button" class="sv-btn" id="svReset" title="${esc(tr('sv.newChat', 'Novi razgovor'))}">↺ ${esc(tr('sv.newChatShort', 'Novi razgovor'))}</button>
      </header>
      <div class="sv-body" id="svBody"></div>
    </section>`;
  els.root = container.querySelector('#svBody');

  container.querySelector('#svReset').addEventListener('click', () => {
    if (aborter) { aborter.abort(); aborter = null; }
    history = [];
    transcript = [];
    roomPhoto = null;
    resetChat();
    render(container);
  });

  if (!isConfigured()) { renderOffline(); return; }

  els.root.innerHTML = `
    <div class="sv-log" id="svLog" aria-live="polite"></div>
    <p class="sv-label">${esc(tr('sv.chipsLabel', 'Predloženo'))}</p>
    <div class="sv-chips" id="svChips">
      ${CHIPS.map(([key, fallback], i) => `<button type="button" class="sv-chip" data-chip="${i}">${esc(tr(key, fallback))}</button>`).join('')}
    </div>
    ${CONFIG.termaTextOnly ? '' : `<div class="sv-toolrow">
      <button type="button" class="sv-btn" id="svPhoto">📷 ${esc(tr('sv.photoBtn', 'Analiza fotografije'))}</button>
    </div>`}
    <form class="sv-inputrow" id="svForm" autocomplete="off">
      <input id="svInput" placeholder="${esc(tr('sv.placeholder', 'Pitaj Termu o pločicama, grijanju, klimi…'))}" autocomplete="off">
      <button type="submit" class="sv-btn sv-btn-primary">${esc(tr('sv.send', 'Pošalji'))}</button>
    </form>
    <input type="file" id="svFile" accept="image/*" hidden>`;

  els.log = els.root.querySelector('#svLog');
  els.file = els.root.querySelector('#svFile');
  const input = els.root.querySelector('#svInput');

  if (!transcript.length) {
    const hello = CONFIG.termaTextOnly
      ? tr('sv.helloText',
        'Bok! Ja sam Terma, Akvatermova savjetnica. Pitaj me o pločicama, sanitarijama, grijanju ili klimi — rado ću predložiti što bi se uklopilo.')
      : tr('sv.hello',
        'Bok! Ja sam Terma, Akvatermova savjetnica. Pitaj me o pločicama, sanitarijama, grijanju ili klimi — ili mi pošalji fotografiju prostora pa ću predložiti što bi se uklopilo.');
    transcript.push({ kind: 'bot', text: hello });
    bubble('bot', hello);
  } else {
    await replayTranscript();
  }

  els.root.querySelector('#svForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    sendMessage(text);
  });
  els.root.querySelector('#svChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    const pair = CHIPS[Number(btn.dataset.chip)];
    if (pair) sendMessage(tr(pair[0], pair[1]));
  });
  // Absent in text-only mode — the whole toolrow is not rendered.
  els.root.querySelector('#svPhoto')?.addEventListener('click', pickPhoto);
  els.file.addEventListener('change', () => {
    const file = els.file.files && els.file.files[0];
    els.file.value = '';
    onPhotoChosen(file);
  });
  els.log.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stage]');
    if (!btn) return;
    e.preventDefault(); // the button sits inside the product-card link
    onStageClick(btn.dataset.stage);
  });
}

export function teardown() {
  if (aborter) { aborter.abort(); aborter = null; }
  els = null;
}
