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
// ============================================================================

import {
  chat, analyzePhoto, stageRoom, resetChat, isConfigured,
  fileToResizedJpeg, TermaUnavailable,
} from '../terma.js';
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
      <button type="button" class="sv-card-stage" data-stage="${esc(p.id)}"
        title="${esc(tr('sv.stageHint', 'Generiraj AI impresiju prostora s ovim proizvodom (ilustrativno)'))}">
        ✨ ${esc(tr('sv.stageBtn', 'AI impresija'))}</button>`;
    wrap.appendChild(card);
  }
  scrollLog();
  return wrap;
}

function colorDots(colors) {
  if (!colors || !colors.length) return;
  const row = document.createElement('div');
  row.className = 'sv-colors';
  row.innerHTML = colors.slice(0, 6)
    .map((c) => `<span class="sv-dot" style="background:${esc(c)}" title="${esc(c)}"></span>`)
    .join('');
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

function renderOffline() {
  if (!els || !els.root) return;
  els.root.innerHTML = `
    <div class="sv-offline">
      <h2>${esc(tr('sv.offlineTitle', 'Terma trenutačno nije povezana'))}</h2>
      <p>${esc(tr('sv.offlineBody',
        'Aplikacija radi u demo načinu bez poslužitelja, pa AI savjetnica nije dostupna. Katalog i dizajner rade normalno. U međuvremenu — odgovori na najčešća pitanja:'))}</p>
    </div>
    <div class="sv-log" id="svLog" aria-live="polite"></div>
    <div class="sv-chips" id="svFaq">
      ${FAQ.map((f, i) => `<button type="button" class="sv-chip" data-faq="${i}">${esc(f.q)}</button>`).join('')}
    </div>`;
  els.log = els.root.querySelector('#svLog');
  els.root.querySelector('#svFaq').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-faq]');
    if (!btn) return;
    const f = FAQ[Number(btn.dataset.faq)];
    if (!f) return;
    bubble('me', f.q);
    bubble('bot', f.a);
  });
}

// ---- view -------------------------------------------------------------------

// Scoped styles ride with the view so the chat dock renders correctly even
// before the shared stylesheet learns about it; everything keys off the
// css/styles.css tokens (--accent, --brand-red) with safe fallbacks.
const STYLES = `
  .sv-wrap{display:flex;flex-direction:column;gap:12px;max-width:720px;margin:0 auto;padding:12px;min-height:0}
  .sv-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .sv-head h1{font-size:1.25rem;margin:0;color:var(--accent,#00008C)}
  .sv-log{display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:200px;max-height:52vh;padding:4px}
  .sv-msg{max-width:85%;padding:10px 14px;border-radius:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
  .sv-msg.is-me{align-self:flex-end;background:var(--accent,#00008C);color:#fff;border-bottom-right-radius:4px}
  .sv-msg.is-bot{align-self:flex-start;background:var(--card-bg,#fff);border:1px solid var(--line,#ddd);border-bottom-left-radius:4px}
  .sv-msg.is-thinking{opacity:.65;font-style:italic}
  .sv-photo img,.sv-staged img{max-width:100%;border-radius:10px;display:block}
  .sv-badge{display:inline-block;background:var(--brand-red,#d6252e);color:#fff;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:99px;margin-bottom:6px}
  .sv-disclaimer{font-size:.78rem;opacity:.75;margin:6px 0 0}
  .sv-colors{display:flex;gap:6px;align-self:flex-start;padding:2px 6px}
  .sv-dot{width:22px;height:22px;border-radius:50%;border:1px solid rgba(0,0,0,.15)}
  .sv-cards{display:flex;flex-direction:column;gap:8px;align-self:stretch}
  .sv-card{display:flex;align-items:center;gap:10px;background:var(--card-bg,#fff);border:1px solid var(--line,#ddd);border-radius:12px;padding:8px 10px;text-decoration:none;color:inherit}
  .sv-card-swatch{width:52px;height:52px;border-radius:8px;flex:0 0 auto;background:#eee;object-fit:cover}
  .sv-card-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
  .sv-card-name{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sv-card-meta{font-size:.8rem;opacity:.75}
  .sv-card-price{font-size:.9rem;color:var(--accent,#00008C);font-weight:700}
  .sv-card-stage{flex:0 0 auto;min-height:44px;border:1px solid var(--accent,#00008C);color:var(--accent,#00008C);background:transparent;border-radius:10px;padding:0 10px;cursor:pointer;font:inherit;font-size:.8rem}
  .sv-chips{display:flex;flex-wrap:wrap;gap:8px}
  .sv-chip{min-height:44px;border:1px solid var(--line,#ccc);background:var(--card-bg,#fff);border-radius:99px;padding:8px 14px;cursor:pointer;font:inherit;font-size:.85rem;text-align:left}
  .sv-inputrow{display:flex;gap:8px}
  .sv-inputrow input{flex:1;min-height:44px;border:1px solid var(--line,#ccc);border-radius:10px;padding:0 12px;font:inherit}
  .sv-btn{min-height:44px;border:1px solid var(--line,#ccc);background:var(--card-bg,#fff);border-radius:10px;padding:0 16px;cursor:pointer;font:inherit}
  .sv-btn-primary{background:var(--accent,#00008C);border-color:var(--accent,#00008C);color:#fff}
  .sv-toolrow{display:flex;gap:8px;flex-wrap:wrap}
  .sv-consent{align-self:stretch;background:var(--card-bg,#fff);border:1px solid var(--brand-red,#d6252e);border-radius:12px;padding:12px;font-size:.9rem}
  .sv-consent-actions{display:flex;gap:8px;margin-top:10px}
  .sv-offline{background:var(--card-bg,#fff);border:1px solid var(--line,#ddd);border-radius:12px;padding:16px}
  .sv-offline h2{margin:0 0 8px;color:var(--accent,#00008C)}
  @media (prefers-reduced-motion:no-preference){.sv-msg{animation:svIn .18s ease-out}@keyframes svIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}}
`;

const CHIPS = [
  ['sv.chip1', 'Koje pločice preporučuješ za kupaonicu do 30 €/m²?'],
  ['sv.chip2', 'Imate li Daikin klima uređaje i koja snaga mi treba za 25 m²?'],
  ['sv.chip3', 'Što se slaže uz travertin u dnevnom boravku?'],
];

export async function render(container, params) { // params unused — route carries none
  els = { root: null, log: null, file: null };

  container.innerHTML = `
    <style>${STYLES}</style>
    <section class="sv-wrap" id="svRoot">
      <div class="sv-head">
        <h1>${esc(tr('sv.title', 'Terma — savjetnica'))}</h1>
        <button type="button" class="sv-btn" id="svReset" title="${esc(tr('sv.newChat', 'Novi razgovor'))}">↺ ${esc(tr('sv.newChatShort', 'Novi razgovor'))}</button>
      </div>
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
    <div class="sv-chips" id="svChips">
      ${CHIPS.map(([key, fallback], i) => `<button type="button" class="sv-chip" data-chip="${i}">${esc(tr(key, fallback))}</button>`).join('')}
    </div>
    <div class="sv-toolrow">
      <button type="button" class="sv-btn" id="svPhoto">📷 ${esc(tr('sv.photoBtn', 'Analiza fotografije'))}</button>
    </div>
    <form class="sv-inputrow" id="svForm" autocomplete="off">
      <input id="svInput" placeholder="${esc(tr('sv.placeholder', 'Pitaj Termu o pločicama, grijanju, klimi…'))}" autocomplete="off">
      <button type="submit" class="sv-btn sv-btn-primary">${esc(tr('sv.send', 'Pošalji'))}</button>
    </form>
    <input type="file" id="svFile" accept="image/*" hidden>`;

  els.log = els.root.querySelector('#svLog');
  els.file = els.root.querySelector('#svFile');
  const input = els.root.querySelector('#svInput');

  if (!transcript.length) {
    const hello = tr('sv.hello',
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
  els.root.querySelector('#svPhoto').addEventListener('click', pickPhoto);
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
