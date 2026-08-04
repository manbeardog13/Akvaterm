// The first beat after the 700 ms login handoff. It is intentionally smaller
// than a conventional app shell: black first, then one question and one piece
// of optical glass. Terma lives inside that glass instead of in a second dock.

import { chat, isConfigured, TermaUnavailable } from "./terma.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// Word-by-word reveal (operator instruction, 2026-08-05): each word gets its
// own --aj-word-delay landing inside the entrance's second-2 window (roughly
// 1000ms-1900ms), so the question types in after the empty glass has already
// appeared instead of fading in as one block.
function questionWordsMarkup(text) {
  const words = String(text).split(" ").filter(Boolean);
  const start = 1000;
  const span = 900;
  return words.map((word, i) => {
    const delay = start + Math.round((span * i) / Math.max(1, words.length - 1));
    return `<span class="aj-word" style="--aj-word-delay:${delay}ms">${esc(word)}</span>`;
  }).join(" ");
}

const CSS = `
html[data-akv-journey] body{overflow:hidden;background:#000}
html[data-akv-journey] .topbar,
html[data-akv-journey] .tabbar,
html[data-akv-journey] .ai-dock,
html[data-akv-journey] #termaBtn{display:none!important}
html[data-akv-journey] #main{width:100%;max-width:none;min-height:100dvh;margin:0;padding:0}
.aj-opening{position:fixed;z-index:28;inset:0;isolation:isolate;display:grid;place-items:center;overflow:hidden;background:#000;color:#f7f7f2}
.aj-backdrop{position:absolute;z-index:0;inset:0;overflow:hidden;will-change:transform,filter,opacity}
/* Entrance sequence (operator instruction, 2026-08-05): the screen goes dark
   first — .aj-opening's own #000 background already covers this, so the
   backdrop image just needs to start invisible instead of appearing
   instantly. It stays hidden through second 1 (glass window appears, empty)
   and second 2 (question types in word by word), then fades AND blurs in
   together across seconds 2-3, landing fully loaded and settled exactly
   where the old sharp-to-blurry motion used to end up. */
.aj-backdrop img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;filter:blur(0px) saturate(1.06) brightness(1.02);transform:scale(1);animation:ajBackdropFocus 2s cubic-bezier(.2,.82,.16,1) 1s both;will-change:filter,transform,opacity}
.aj-backdrop-dark{animation:ajDarkCycle 24s ease-in-out 3.2s infinite alternate}
.aj-backdrop-light{opacity:0;animation:ajLightCycle 24s ease-in-out 3.2s infinite alternate}
.aj-veil{position:absolute;z-index:1;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.18) 44%,rgba(0,0,0,.40));pointer-events:none}
.aj-particles{position:absolute;z-index:2;inset:0;pointer-events:none;overflow:hidden}
.aj-particle{position:absolute;display:block;opacity:0;transform:translate3d(0,0,0);animation:ajParticleShimmer var(--aj-particle-duration) cubic-bezier(.2,.75,.32,1) var(--aj-particle-delay) forwards;mix-blend-mode:screen;filter:blur(.8px);background:radial-gradient(circle,rgba(255,255,255,.95) 0,rgba(198,248,219,.26) 38%,rgba(164,228,198,0) 74%);border-radius:999px}
.aj-particle::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,0));border-radius:999px;transform:translateY(-20%);opacity:.7}
.aj-menu{position:fixed;z-index:3;left:max(18px,env(safe-area-inset-left,0px));top:max(18px,env(safe-area-inset-top,0px));display:grid;place-content:center;gap:5px;width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer;opacity:0;animation:ajElementIn .7s cubic-bezier(.22,1,.36,1) .18s forwards}
.aj-menu span{display:block;width:23px;height:2px;border-radius:999px;background:rgba(240,255,247,.68);box-shadow:0 1px rgba(255,255,255,.34),0 0 8px rgba(159,220,183,.16);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.aj-menu:focus-visible{outline:2px solid rgba(218,242,224,.86);outline-offset:3px;border-radius:12px}
.aj-focus{position:relative;z-index:3;width:min(536px,calc(100vw - 48px));display:grid;gap:16px;margin:auto;transform:translateY(calc(4vh + 76px))}
.aj-question{max-width:620px;margin:0;color:#f8f8f4;font-family:var(--font-display);font-size:clamp(23px,4vw,45px);font-weight:450;line-height:1.06;letter-spacing:-.035em;text-wrap:balance;text-shadow:0 2px 22px rgba(0,0,0,.42)}
.aj-word{display:inline-block;opacity:0;filter:blur(6px);transform:translateY(6px);animation:ajWordIn .5s cubic-bezier(.22,1,.36,1) var(--aj-word-delay,0ms) both}
.aj-glass{position:relative;isolation:isolate;margin:0;padding:9px 10px 8px;border:1px solid transparent;border-radius:22px;color:#f7f7f2;background:linear-gradient(138deg,rgba(255,255,255,.05),rgba(177,227,208,.018) 40%,rgba(8,12,9,.14) 74%) padding-box,linear-gradient(145deg,rgba(255,255,255,.28),rgba(168,222,197,.10) 30%,rgba(236,201,138,.16) 72%,rgba(255,255,255,.08)) border-box;box-shadow:0 36px 90px -36px rgba(0,0,0,.72),inset 0 1px rgba(255,255,255,.14),inset 0 -1px rgba(132,184,151,.07);backdrop-filter:blur(26px) saturate(1.42) contrast(.98);-webkit-backdrop-filter:blur(26px) saturate(1.42) contrast(.98);opacity:0;transform:scale(.88,.66) translateY(26px);animation:ajGlassIn .75s cubic-bezier(.16,1,.35,1) .1s forwards}
.aj-glass::before{content:"";position:absolute;z-index:0;inset:1px;border-radius:21px;pointer-events:none;box-shadow:inset 1px 0 rgba(203,243,220,.10),inset -1px 0 rgba(255,215,159,.05),inset 0 20px 30px -26px rgba(255,255,255,.28),inset 0 -14px 20px -20px rgba(111,185,143,.22)}
.aj-inputrow{position:relative;z-index:1;display:grid;grid-template-columns:auto minmax(0,1fr) 38px;align-items:end;gap:10px}
.aj-terma{align-self:center;padding-left:4px;color:rgba(213,240,220,.68);font:700 8px/1 var(--font-text);letter-spacing:.12em;text-transform:uppercase}
.aj-input{width:100%;min-height:35px;max-height:101px;resize:none;padding:10px 0 6px;border:0;outline:0;background:transparent;color:#fff;font:500 13px/1.45 var(--font-text)}
.aj-input::placeholder{color:rgba(247,247,242,.46);opacity:1}
.aj-send{display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.055);color:#eef8f0;cursor:pointer}
.aj-send svg{width:16px;height:16px}.aj-send:disabled{opacity:.42;cursor:default}.aj-send:focus-visible{outline:2px solid rgba(218,242,224,.9);outline-offset:2px}
.aj-response{position:relative;z-index:1;margin:9px 2px 1px;padding:10px 3px 1px;border-top:1px solid rgba(255,255,255,.11);color:rgba(247,247,242,.76);font:500 11px/1.5 var(--font-text);white-space:pre-wrap}
.aj-response:empty{display:none}
.aj-glass[data-state="ready"] .aj-send{background:rgba(211,232,190,.92);color:#10150f;border-color:rgba(255,255,255,.38)}
.aj-handoff-target{position:fixed;visibility:hidden;pointer-events:none;width:0;height:0}
.aj-opening.is-departing .aj-question,.aj-opening.is-departing .aj-menu{animation:none;opacity:0;transform:translateY(-8px);transition:opacity .2s ease-out,transform .32s cubic-bezier(.25,1,.5,1)}
.aj-opening.is-departing .aj-backdrop{animation:none;opacity:.72;transform:scale(.985);transition:opacity .55s cubic-bezier(.25,1,.5,1),transform .55s cubic-bezier(.25,1,.5,1)}
.aj-opening.is-departing .aj-glass .aj-inputrow,.aj-opening.is-departing .aj-glass .aj-response{opacity:0;transform:translateY(-4px);transition:opacity .14s ease-out,transform .22s cubic-bezier(.25,1,.5,1)}
.aj-glass.is-handoff{z-index:4;margin:0;max-width:none;pointer-events:none;animation:none;transform-origin:0 0;will-change:transform;transition:transform .55s cubic-bezier(.25,1,.5,1),box-shadow .55s cubic-bezier(.25,1,.5,1)}
@keyframes ajElementIn{from{opacity:0;transform:translateY(11px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
@keyframes ajWordIn{from{opacity:0;transform:translateY(6px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes ajGlassIn{from{opacity:0;transform:scale(.88,.66) translateY(26px);filter:blur(9px)}to{opacity:1;transform:scale(.93,.85) translateY(0);filter:none}}
@keyframes ajBackdropFocus{from{opacity:0;filter:blur(0px) saturate(1.06) brightness(1.02);transform:scale(1)}to{opacity:.75;filter:blur(22px) saturate(1.18) brightness(1.01);transform:scale(1.028)}}
@keyframes ajParticleShimmer{0%{opacity:0;transform:translate3d(0,0,0) scale(.12);filter:blur(4px)}15%{opacity:.95}100%{opacity:0;transform:translate3d(var(--aj-particle-x),var(--aj-particle-y),0) scale(.02);filter:blur(.6px)}}
@keyframes ajDarkCycle{0%,38%{opacity:1}72%,100%{opacity:.16}}
@keyframes ajLightCycle{0%,38%{opacity:0}72%,100%{opacity:.84}}
@media(max-width:680px){.aj-focus{width:min(100% - 40px,416px);gap:13px}.aj-question{font-size:clamp(22px,6.4vw,34px)}.aj-glass{padding:8px 8px 7px}.aj-inputrow{grid-template-columns:minmax(0,1fr) 38px;gap:6px}.aj-terma{grid-column:1/-1;padding:2px 4px 0}.aj-input{padding-top:3px;min-height:34px}}
@media(orientation:landscape) and (max-height:520px){.aj-backdrop img{object-position:center 58%}.aj-focus{width:min(496px,calc(100vw - 140px));gap:11px;transform:translateY(3vh)}.aj-question{font-size:clamp(22px,4vh,34px)}.aj-glass{padding:7px 8px 6px}.aj-input{min-height:32px}}
@media(min-width:560px) and (orientation:landscape){.aj-handoff-target{right:max(16px,env(safe-area-inset-right,0px));top:max(16px,env(safe-area-inset-top,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));width:min(360px,42vw);height:auto}}
@media(min-width:560px) and (max-width:719px) and (orientation:landscape){.aj-handoff-target{right:max(12px,env(safe-area-inset-right,0px));top:max(12px,env(safe-area-inset-top,0px));bottom:max(12px,env(safe-area-inset-bottom,0px));width:min(330px,48vw)}}
@media(prefers-reduced-motion:reduce){.aj-backdrop,.aj-menu,.aj-word,.aj-glass,.aj-backdrop-dark,.aj-backdrop-light,.aj-particles{animation:none!important;transform:none!important}.aj-backdrop{opacity:.62}.aj-menu,.aj-word,.aj-glass{opacity:1;filter:none!important}.aj-backdrop-dark{opacity:1}.aj-backdrop-light{opacity:0}}
@media(prefers-reduced-motion:reduce){.aj-opening.is-departing .aj-question,.aj-opening.is-departing .aj-menu,.aj-opening.is-departing .aj-glass{opacity:0;transition:opacity .17s linear}.aj-opening.is-departing .aj-backdrop{opacity:.62;transform:none;transition:none}}
@media(forced-colors:active){.aj-opening,.aj-glass,.aj-send{forced-color-adjust:auto;background:Canvas;color:CanvasText;border:1px solid CanvasText}.aj-backdrop,.aj-veil{display:none}.aj-menu span{background:CanvasText}.aj-response{color:CanvasText}}
`;

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;

function directionFromBrief(value) {
  const text = String(value || "").toLocaleLowerCase("hr");
  if (/tam|dram|crn|antracit|kontrast|moody|dark|bold|izra/.test(text)) return "izrazito";
  if (/topl|drvo|prirod|zemlj|bež|bez|warm|wood|natural/.test(text)) return "toplo";
  return "mirno";
}

function localReply(direction) {
  if (direction === "izrazito") return "Razumijem. Gradit ćemo prostor iz dubine, kontrasta i nekoliko preciznih refleksija — bez vizualnog nereda.";
  if (direction === "toplo") return "Razumijem. Krenut ćemo od prirodnih tonova, taktilnih materijala i svjetla koje prostor čini mirnim.";
  return "Razumijem. Krenut ćemo od tišeg, svjetlijeg prostora u kojem svaki sljedeći izbor ima dovoljno zraka.";
}

async function termaReply(brief, direction, signal, paint) {
  if (!isConfigured()) { paint(localReply(direction)); return; }
  let full = "";
  try {
    const prompt = `Korisnik započinje vođeno oblikovanje kupaonice i opisao je željeni osjećaj ovako: "${String(brief).slice(0, 700)}". Odgovori na hrvatskom u najviše dvije kratke, smirene rečenice. Potvrdi da si razumjela atmosferu i reci kojim vizualnim principom započinjemo. Ne spominji katalog, AI ni tehničke korake.`;
    for await (const event of chat([{ role: "user", content: prompt }], { signal })) {
      if (event.delta) { full += event.delta; paint(full); }
    }
    if (!full.trim()) paint(localReply(direction));
  } catch (error) {
    if (error?.name === "AbortError") return;
    if (error instanceof TermaUnavailable || !full.trim()) paint(localReply(direction));
  }
}

export function mountJourneyOpening(container, { onBrief } = {}) {
  document.documentElement.setAttribute("data-akv-journey", "opening");
  container.innerHTML = `
    <style>${CSS}</style>
    <section class="aj-opening" aria-labelledby="ajQuestion">
      <div class="aj-backdrop" aria-hidden="true">
        <img class="aj-backdrop-dark" src="./assets/images/login-interior-dark-4k.webp" alt="" width="2160" height="3840" decoding="async">
        <img class="aj-backdrop-light" src="./assets/images/login-interior-light-4k.webp" alt="" width="2160" height="3840" decoding="async">
      </div>
      <div class="aj-particles" aria-hidden="true"></div>
      <span class="aj-veil" aria-hidden="true"></span>
      <button class="aj-menu" type="button" aria-label="Otvori izbornik"><span></span><span></span><span></span></button>
      <div class="aj-focus">
        <h1 class="aj-question" id="ajQuestion">${questionWordsMarkup("Kako želite da se osjećate u ovom prostoru?")}</h1>
        <form class="aj-glass" id="ajForm">
          <div class="aj-inputrow">
            <span class="aj-terma">Terma</span>
            <textarea class="aj-input" id="ajInput" rows="1" maxlength="700" autocomplete="off" aria-label="Opišite željeni prostor" placeholder="Opišite atmosferu, materijal ili osjećaj…"></textarea>
            <button class="aj-send" type="submit" aria-label="Pošalji Termi">${SEND_ICON}</button>
          </div>
          <p class="aj-response" id="ajResponse" role="status" aria-live="polite"></p>
        </form>
      </div>
      <span class="aj-handoff-target" aria-hidden="true"></span>
    </section>`;

  const particleHost = container.querySelector(".aj-particles");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (particleHost && !reducedMotion) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const count = Math.max(12, Math.round((vw * vh) / 42000));
    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement("span");
      const duration = 1000 + Math.random() * 900;
      const delay = Math.random() * 420;
      const driftX = (Math.random() - 0.5) * 300;
      const driftY = (Math.random() - 0.5) * 220;
      const size = 2 + Math.random() * 4;
      particle.className = "aj-particle";
      particle.style.left = `${Math.random() * vw}px`;
      particle.style.top = `${Math.random() * vh}px`;
      particle.style.width = `${size.toFixed(2)}px`;
      particle.style.height = `${size.toFixed(2)}px`;
      particle.style.setProperty("--aj-particle-x", `${driftX.toFixed(2)}px`);
      particle.style.setProperty("--aj-particle-y", `${driftY.toFixed(2)}px`);
      particle.style.setProperty("--aj-particle-duration", `${duration.toFixed(0)}ms`);
      particle.style.setProperty("--aj-particle-delay", `${delay.toFixed(0)}ms`);
      particleHost.appendChild(particle);
    }
  }

  const form = container.querySelector("#ajForm");
  const input = container.querySelector("#ajInput");
  const response = container.querySelector("#ajResponse");
  const button = form.querySelector(".aj-send");
  const aborter = new AbortController();
  let settled = false;
  let submitted = false;
  let handoff = null;
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });

  const resize = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 126)}px`;
  };
  input.addEventListener("input", resize);
  container.querySelector(".aj-menu")?.addEventListener("click", () => document.getElementById("sideOpen")?.click());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (settled) return;
    if (submitted) {
      settled = true;
      finish({ brief: input.value.trim(), directionId: directionFromBrief(input.value), cancelled: false });
      return;
    }
    const brief = input.value.trim();
    if (!brief) { input.focus(); return; }
    submitted = true;
    const directionId = directionFromBrief(brief);
    input.readOnly = true;
    button.disabled = true;
    response.textContent = "Terma sluša…";
    try { onBrief?.({ brief, directionId }); } catch { /* persistence is non-critical here */ }
    await termaReply(brief, directionId, aborter.signal, (text) => { response.textContent = text; });
    if (settled) return;
    form.dataset.state = "ready";
    button.disabled = false;
    button.setAttribute("aria-label", "Nastavi putovanje");
    button.focus({ preventScroll: true });
  });

  const transitionOut = () => {
    if (handoff) return handoff;
    const root = container.querySelector(".aj-opening");
    const glass = container.querySelector(".aj-glass");
    const target = container.querySelector(".aj-handoff-target");
    const lightMix = Math.max(0, Math.min(1,
      Number.parseFloat(getComputedStyle(container.querySelector(".aj-backdrop-light")).opacity) || 0));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    handoff = new Promise((resolve) => {
      if (!root || !glass || reduced) {
        root?.classList.add("is-departing");
        window.setTimeout(() => resolve({ lightMix }), 180);
        return;
      }
      const from = glass.getBoundingClientRect();
      const to = target?.getBoundingClientRect();
      root.classList.add("is-departing");
      if (!to?.width || !to?.height) {
        window.setTimeout(() => resolve({ lightMix }), 240);
        return;
      }

      root.appendChild(glass);
      glass.classList.add("is-handoff");
      Object.assign(glass.style, {
        position: "fixed",
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})`,
      });
      glass.getBoundingClientRect();
      requestAnimationFrame(() => requestAnimationFrame(() => { glass.style.transform = "none"; }));
      window.setTimeout(() => resolve({ lightMix }), 570);
    });
    return handoff;
  };

  const dispose = () => {
    aborter.abort();
    if (!settled) { settled = true; finish({ cancelled: true }); }
  };
  window.addEventListener("akv:teardown", dispose, { once: true });
  return { done, transitionOut, dispose };
}
