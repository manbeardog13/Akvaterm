// The first beat after the 700 ms login handoff. It is intentionally smaller
// than a conventional app shell: black first, then one question and one piece
// of optical glass. Terma lives inside that glass instead of in a second dock.

import { chat, isConfigured, TermaUnavailable } from "./terma.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const CSS = `
html[data-akv-journey] body{overflow:hidden;background:#000}
html[data-akv-journey] .topbar,
html[data-akv-journey] .tabbar,
html[data-akv-journey] .ai-dock,
html[data-akv-journey] #termaBtn{display:none!important}
html[data-akv-journey] #main{width:100%;max-width:none;min-height:100dvh;margin:0;padding:0}
.aj-opening{position:fixed;z-index:28;inset:0;isolation:isolate;display:grid;place-items:center;overflow:hidden;background:#000;color:#f7f7f2}
.aj-backdrop{position:absolute;z-index:0;inset:-34px;overflow:hidden;opacity:0;animation:ajBackdropIn 2.6s cubic-bezier(.22,1,.36,1) .85s forwards}
.aj-backdrop img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;filter:blur(26px) saturate(1.06);transform:scale(1.08);will-change:opacity}
.aj-backdrop-dark{animation:ajDarkCycle 24s ease-in-out 3.2s infinite alternate}
.aj-backdrop-light{opacity:0;animation:ajLightCycle 24s ease-in-out 3.2s infinite alternate}
.aj-veil{position:absolute;z-index:1;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.54),rgba(0,0,0,.22) 44%,rgba(0,0,0,.52));pointer-events:none}
.aj-menu{position:fixed;z-index:3;left:max(18px,env(safe-area-inset-left,0px));top:max(18px,env(safe-area-inset-top,0px));display:grid;place-content:center;gap:5px;width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer;opacity:0;animation:ajElementIn .7s cubic-bezier(.22,1,.36,1) .18s forwards}
.aj-menu span{display:block;width:23px;height:2px;border-radius:999px;background:rgba(240,255,247,.68);box-shadow:0 1px rgba(255,255,255,.34),0 0 8px rgba(159,220,183,.16);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.aj-menu:focus-visible{outline:2px solid rgba(218,242,224,.86);outline-offset:3px;border-radius:12px}
.aj-focus{position:relative;z-index:2;width:min(720px,calc(100vw - 48px));display:grid;gap:22px;margin:auto;transform:translateY(-1vh)}
.aj-question{max-width:670px;margin:0;color:#f8f8f4;font-family:var(--font-display);font-size:clamp(29px,5vw,56px);font-weight:450;line-height:1.06;letter-spacing:-.035em;text-wrap:balance;text-shadow:0 3px 24px rgba(0,0,0,.42);opacity:0;animation:ajElementIn .95s cubic-bezier(.22,1,.36,1) .22s forwards}
.aj-glass{position:relative;isolation:isolate;margin:0;padding:14px 15px 13px;border:1px solid transparent;border-radius:24px;color:#f7f7f2;background:linear-gradient(138deg,rgba(255,255,255,.10),rgba(180,226,195,.035) 40%,rgba(5,10,8,.18) 74%) padding-box,linear-gradient(145deg,rgba(255,255,255,.50),rgba(181,231,202,.15) 30%,rgba(255,221,170,.22) 72%,rgba(255,255,255,.10)) border-box;box-shadow:0 46px 110px -38px rgba(0,0,0,.82),inset 0 1px rgba(255,255,255,.20),inset 0 -1px rgba(132,184,151,.08);backdrop-filter:blur(16px) saturate(1.28) contrast(1.04);-webkit-backdrop-filter:blur(16px) saturate(1.28) contrast(1.04);opacity:0;animation:ajGlassIn 1.05s cubic-bezier(.22,1,.36,1) .48s forwards}
.aj-glass::before{content:"";position:absolute;z-index:0;inset:1px;border-radius:23px;pointer-events:none;box-shadow:inset 1px 0 rgba(203,243,220,.10),inset -1px 0 rgba(255,215,159,.06),inset 0 14px 24px -26px rgba(255,255,255,.54),inset 0 -16px 26px -28px rgba(111,185,143,.28)}
.aj-inputrow{position:relative;z-index:1;display:grid;grid-template-columns:auto minmax(0,1fr) 48px;align-items:end;gap:12px}
.aj-terma{align-self:center;padding-left:4px;color:rgba(213,240,220,.72);font:700 10px/1 var(--font-text);letter-spacing:.12em;text-transform:uppercase}
.aj-input{width:100%;min-height:52px;max-height:126px;resize:none;padding:15px 0 10px;border:0;outline:0;background:transparent;color:#fff;font:500 16px/1.45 var(--font-text)}
.aj-input::placeholder{color:rgba(247,247,242,.46);opacity:1}
.aj-send{display:grid;place-items:center;width:48px;height:48px;padding:0;border:1px solid rgba(255,255,255,.15);border-radius:15px;background:rgba(255,255,255,.055);color:#eef8f0;cursor:pointer}
.aj-send svg{width:20px;height:20px}.aj-send:disabled{opacity:.42;cursor:default}.aj-send:focus-visible{outline:2px solid rgba(218,242,224,.9);outline-offset:2px}
.aj-response{position:relative;z-index:1;margin:11px 3px 1px;padding:13px 4px 1px;border-top:1px solid rgba(255,255,255,.11);color:rgba(247,247,242,.76);font:500 14px/1.5 var(--font-text);white-space:pre-wrap}
.aj-response:empty{display:none}
.aj-glass[data-state="ready"] .aj-send{background:rgba(211,232,190,.92);color:#10150f;border-color:rgba(255,255,255,.38)}
@keyframes ajElementIn{from{opacity:0;transform:translateY(11px)}to{opacity:1;transform:none}}
@keyframes ajGlassIn{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
@keyframes ajBackdropIn{to{opacity:.68}}
@keyframes ajDarkCycle{0%,38%{opacity:1}72%,100%{opacity:.16}}
@keyframes ajLightCycle{0%,38%{opacity:0}72%,100%{opacity:.84}}
@media(max-width:680px){.aj-focus{width:min(100% - 40px,560px);gap:17px}.aj-question{font-size:clamp(27px,8vw,42px)}.aj-glass{padding:12px 12px 11px}.aj-inputrow{grid-template-columns:minmax(0,1fr) 48px;gap:8px}.aj-terma{grid-column:1/-1;padding:3px 5px 0}.aj-input{padding-top:5px}}
@media(orientation:landscape) and (max-height:520px){.aj-focus{width:min(720px,calc(100vw - 140px));gap:15px;transform:none}.aj-question{font-size:clamp(27px,5vh,42px)}.aj-glass{padding-block:10px}.aj-input{min-height:44px}}
@media(prefers-reduced-motion:reduce){.aj-backdrop,.aj-menu,.aj-question,.aj-glass,.aj-backdrop-dark,.aj-backdrop-light{animation:none!important;transform:none!important}.aj-backdrop{opacity:.62}.aj-menu,.aj-question,.aj-glass{opacity:1}.aj-backdrop-dark{opacity:1}.aj-backdrop-light{opacity:0}}
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
      <span class="aj-veil" aria-hidden="true"></span>
      <button class="aj-menu" type="button" aria-label="Otvori izbornik"><span></span><span></span><span></span></button>
      <div class="aj-focus">
        <h1 class="aj-question" id="ajQuestion">Kako želite da se osjećate u ovom prostoru?</h1>
        <form class="aj-glass" id="ajForm">
          <div class="aj-inputrow">
            <span class="aj-terma">Terma</span>
            <textarea class="aj-input" id="ajInput" rows="1" maxlength="700" autocomplete="off" aria-label="Opišite željeni prostor" placeholder="Opišite atmosferu, materijal ili osjećaj…"></textarea>
            <button class="aj-send" type="submit" aria-label="Pošalji Termi">${SEND_ICON}</button>
          </div>
          <p class="aj-response" id="ajResponse" role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>`;

  const form = container.querySelector("#ajForm");
  const input = container.querySelector("#ajInput");
  const response = container.querySelector("#ajResponse");
  const button = form.querySelector(".aj-send");
  const aborter = new AbortController();
  let settled = false;
  let submitted = false;
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

  const dispose = () => {
    aborter.abort();
    if (!settled) { settled = true; finish({ cancelled: true }); }
  };
  window.addEventListener("akv:teardown", dispose, { once: true });
  return { done, dispose };
}
