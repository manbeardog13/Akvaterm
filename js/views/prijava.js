// ============================================================================
// views/prijava.js — the sign-in threshold (#/prijava).
//
// Visual authority for this surface is the operator-provided photo set dated
// 2026-08-04. It yields one compact translucent card over a real cinematic
// interior photograph generated specifically for this project. The approved
// asset is local: no borrowed photograph, runtime GPU or external fetch.
//
// The threshold is deliberately still. No pointer parallax, device tilt or
// travelling glare competes with the room's slow one-way cinematic settle.
//
// The public GitHub Pages build has no account backend. Its fields are natively
// disabled and its enabled guest link always enters the experience. A configured
// build uses the existing db.js Supabase calls, without making sign-in a route
// gate or claiming that local favourites synchronize.
// ============================================================================
import { t } from "../i18n.js";
import {
  authConfigured, getSession, signIn, signInWithGoogle, signUp,
  requestPasswordReset, signOut, rememberedEmail, rememberEmail,
} from "../db.js";
import { LOGIN_PHOTO_CSS } from "../login-photo-style.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// t() with an inline Croatian fallback — a missing dictionary key must never
// leak a raw key onto a client-facing screen.
function tf(key, fallback, vars) {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

const AUTH_ATTR = "data-akv-auth";
const STYLE_ID = "akv-prijava-css";

// ---- scoped styles ---------------------------------------------------------
// Visual styling lives in login-photo-style.js. Keeping it separate makes the
// operator-supplied photo direction explicit and keeps authentication logic
// independent from presentation.

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = LOGIN_PHOTO_CSS;
  document.head.appendChild(style);
}

// ---- icons -----------------------------------------------------------------
const SVG = (body, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const ICON_MAIL = SVG(`<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>`);
const ICON_LOCK = SVG(`<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>`);
const ICON_EYE = SVG(`<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>`);
const ICON_EYE_OFF = SVG(`<path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.6 4.3M6.5 7.7A17 17 0 0 0 2 12s3.5 6.5 10 6.5a9.7 9.7 0 0 0 3.4-.6"/><path d="M9.7 9.9a2.6 2.6 0 0 0 3.7 3.6"/>`);
const ICON_ARROW = SVG(`<path d="M5 12h14M13 6l6 6-6 6"/>`, 16);
const ICON_INFO = SVG(`<circle cx="12" cy="12" r="8.6"/><path d="M12 11.4v4.6M12 8.2v.1"/>`, 17);

// Google's "G". The only mark in this app that is NOT re-coloured to the Iris
// palette: Google's Third-Party Branding Guidelines require the four official
// colours unaltered, so it is filled, not stroked, and carries its own hex
// values rather than tokens. docs/DESIGN_SYSTEM.md records the exemption
// alongside the Akvaterm wordmark's.
const ICON_GOOGLE = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.2-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"/></svg>`;

// ---- markup ----------------------------------------------------------------
// The mark and theme control share the form's quiet top rail, following the
// compact navigation modules in the supplied references. The wordmark retains
// its protected navy/red authorship while the surrounding plane changes theme.
function cardTop() {
  return `
    <div class="pr-cardtop">
      <p class="pr-mark wordmark"><span class="akva">AKVA</span><span class="term">TERM</span></p>
      <button type="button" class="pr-theme" id="prTheme" aria-pressed="false"
              aria-label="${esc(tf("theme.label", "Tamna tema"))}">
        <span class="pr-themeic"></span>
      </button>
    </div>`;
}

function sceneMarkup() {
  return `
    <aside class="pr-scene" aria-label="${esc(tf("prijava.sceneLabel", "Inspiracija za vašu kupaonicu"))}">
      <picture class="pr-scene-media" aria-hidden="true">
        <img class="pr-scene-dark" src="./assets/images/login-interior-dark-4k.webp" alt=""
             width="2160" height="3840" decoding="async" fetchpriority="high">
        <img class="pr-scene-light" src="./assets/images/login-interior-light-4k.webp" alt=""
             width="2160" height="3840" decoding="async">
      </picture>
    </aside>`;
}

function thresholdMarkup(card) {
  return `<div class="pr-wrap">${sceneMarkup()}${card}</div>`;
}

// The pointer-tracked sheen. A real element (not a pseudo-element background
// driven by a custom property — see login-photo-style.js's .pr-sheen rule
// for why) so wireCardSheen() below can move it with plain element.style and
// have it reliably repaint every time.
function sheenMarkup() {
  return `<span class="pr-sheen" aria-hidden="true"></span>`;
}

// Empty on purpose — populateCardParticles() fills it after the 1.6s
// entrance delay, and skips entirely under prefers-reduced-motion so no
// particle nodes are ever created for a user who has asked for less motion.
function particlesMarkup() {
  return `<div class="pr-particles" aria-hidden="true"></div>`;
}

// The card materializes "out of thin air" 1.6s after the threshold opens
// (operator instruction, 2026-08-04, matching .pr-card's own
// prCardMaterialize delay in login-photo-style.js): a scatter of small glass
// motes converge from just beyond its edges into the sheet at the same
// moment. The setTimeout is what actually times the entrance — the nodes do
// not exist before it fires, so there is nothing sitting invisible in the
// DOM for 1.6s. Polar placement keeps the origin points spread evenly
// around the card instead of clustering in the corners a rectangular random
// spread would produce.
function populateCardParticles(container) {
  const host = container.querySelector(".pr-particles");
  if (!host || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  setTimeout(() => {
    if (!host.isConnected) return;
    const count = 18 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 90 + Math.random() * 170;
      const size = 2 + Math.random() * 3.5;
      const particle = document.createElement("span");
      particle.className = "pr-particle";
      particle.style.width = `${size.toFixed(2)}px`;
      particle.style.height = `${size.toFixed(2)}px`;
      particle.style.setProperty("--pr-particle-x", `${(Math.cos(angle) * radius).toFixed(2)}px`);
      particle.style.setProperty("--pr-particle-y", `${(Math.sin(angle) * radius).toFixed(2)}px`);
      particle.style.setProperty("--pr-particle-duration", `${(650 + Math.random() * 320).toFixed(0)}ms`);
      particle.style.setProperty("--pr-particle-delay", `${(Math.random() * 220).toFixed(0)}ms`);
      host.appendChild(particle);
    }
  }, 1600);
}

// The wrapper is a <div>, NOT a <label>: the password row contains a button
// (the reveal toggle), and a <label> may not contain a labelable descendant
// other than its own control. The label is a sibling with an explicit for=.
function field(id, labelKey, labelFallback, opts) {
  const eye = opts.eye
    ? `<button type="button" class="pr-eye" id="prEye" aria-pressed="false" aria-controls="${id}"
         aria-label="${esc(tf("prijava.showPassword", "Prikaži lozinku"))}">${ICON_EYE}</button>`
    : "";
  // NO VISIBLE LABEL. The field name moves into the placeholder, and aria-label
  // carries it for assistive technology — so the accessible name is unchanged
  // while a row of uppercase micro-type leaves the screen. The placeholder is
  // the LABEL text ("Email"), not an example value: a placeholder that only
  // shows a sample disappears on focus and takes the field's identity with it.
  const label = esc(tf(labelKey, labelFallback));
  return `
    <div class="pr-field">
      <span class="pr-input${opts.eye ? " has-eye" : ""}">
        <span class="pr-ic">${opts.icon}</span>
        <input id="${id}" type="${opts.type}" name="${opts.name}"
               autocomplete="${opts.autocomplete}"${opts.inputmode ? ` inputmode="${opts.inputmode}"` : ""}
               placeholder="${label}" aria-label="${label}"
               aria-describedby="${id}Err" aria-invalid="false"
               value="${esc(opts.value || "")}">
      ${eye}
      </span>
      <span class="pr-err" id="${id}Err"></span>
    </div>`;
}

// mode: "signin" | "signup". The threshold stays spatially stable while only
// the form body changes, preserving the reference set's single-module clarity.
let mode = "signin";

function signInMarkup(configured) {
  const signup = mode === "signup";

  const notice = configured ? "" : `
      <div class="pr-notice">
        <span class="pr-nic">${ICON_INFO}</span>
        <span class="pr-noticetext">
          <b>${esc(tf("prijava.offTitle", "Prijava još nije uključena"))}</b>
          <span>${esc(tf("prijava.offBody", "Ova verzija radi bez poslužitelja za račune, pa se prijava ne može dovršiti. Sve ostalo radi normalno."))}</span>
        </span>
      </div>`;

  const fields =
    field("prEmail", "prijava.email", "Email", {
      icon: ICON_MAIL, type: "email", name: "email", autocomplete: "email", inputmode: "email",
      value: rememberedEmail(),
    }) +
    field("prPass", "prijava.password", "Lozinka", {
      icon: ICON_LOCK, type: "password", name: "password",
      // new-password on the signup pass, or a password manager offers the
      // saved one instead of generating a fresh one.
      autocomplete: signup ? "new-password" : "current-password", eye: true,
    });

  // Sign-in only. There is nothing to recover on a form that is creating the
  // account, and offering it there invites the user to reset a password that
  // does not exist yet.
  const forgot = signup ? "" : `
        <div class="pr-rowend">
          <button type="button" class="pr-forgot" id="prForgot">${esc(tf("prijava.forgot", "Zaboravljena lozinka?"))}</button>
        </div>`;

  const cta = signup
    ? esc(tf("prijava.signupCta", "Napravi račun"))
    : esc(tf("prijava.submit", "Prijavi se"));

  // <fieldset disabled> is a NATIVE disable: on a build with no backend the
  // controls are not focusable and the form cannot be submitted at all, so
  // there is no path on which a password is typed into something that will
  // never check it.
  const form = `
    <form class="pr-form" id="prForm" novalidate autocomplete="on">
      <fieldset${configured ? "" : " disabled"}>
        ${fields}
        ${forgot}
        <button type="submit" class="btn btn-primary btn-lg" id="prSubmit">
          ${cta}${ICON_ARROW}
        </button>
      </fieldset>
      <p class="pr-msg" id="prMsg" role="status" aria-live="polite"></p>
    </form>`;

  // Disabled rather than hidden without a backend, and for the same reason the
  // email form is: a control that is present but plainly unavailable explains
  // the build, where a missing control just looks like a feature nobody built.
  const google = `
      <button type="button" class="btn btn-block pr-google" id="prGoogle"${configured ? "" : " disabled"}>
        ${ICON_GOOGLE}
        <span class="pr-glabel">${esc(tf("prijava.google", "Nastavi s Googleom"))}</span>
      </button>
      <p class="pr-msg" id="prGoogleMsg" role="status" aria-live="polite"></p>`;

  // The switch between the two modes. A <button>, not a link: it changes what
  // this card is, it does not navigate anywhere.
  const swap = signup
    ? `<p class="pr-foot">${esc(tf("prijava.haveAccount", "Već imate račun?"))}
         <button type="button" class="pr-footlink" id="prSwap">${esc(tf("prijava.toSignin", "Prijavite se"))}</button></p>`
    : `<p class="pr-foot">${esc(tf("prijava.firstTime", "Prvi put ovdje?"))}
         <button type="button" class="pr-footlink" id="prSwap">${esc(tf("prijava.createAccount", "Napravi račun"))}</button></p>`;

  const guest = configured ? "" : `
       <a class="btn btn-primary pr-guest" href="#/atelier" data-pr-enter>${esc(tf("prijava.guest", "Nastavi kao gost"))}${ICON_ARROW}</a>
       <p class="pr-guesthint">${esc(tf("prijava.guestHint", "Katalog, dizajner i 3D soba rade bez prijave."))}</p>`;

  // The fastest returning-user path stays first. Account creation puts its
  // fields first because completing them is the purpose of that state.
  const body = signup
    ? `${form}
       <div class="pr-div">${esc(tf("prijava.or", "ili"))}</div>
       ${google}`
    : `${google}
       <div class="pr-div">${esc(tf("prijava.orEmail", "ili e-mailom"))}</div>
       ${form}`;

  return thresholdMarkup(`
      <section class="pr-card" aria-labelledby="prTitle">
        ${sheenMarkup()}
        ${particlesMarkup()}
        ${cardTop()}
        <h1 class="pr-title" id="prTitle">${esc(signup
          ? tf("prijava.createTitle", "Otvorite račun")
          : tf("prijava.title", "Dobrodošli natrag"))}</h1>
        <p class="pr-sub">${esc(signup
          ? tf("prijava.createSub", "Spremite favorite i dizajne na svoj račun")
          : tf("prijava.sub", "Kupaonice, grijanje i klimatizacija"))}</p>
        ${notice}
        ${body}
        ${guest}
        ${swap}
      </section>`);
}

function signedInMarkup(email) {
  const initial = (email || "?").trim().charAt(0).toUpperCase() || "?";
  return thresholdMarkup(`
      <section class="pr-card" aria-labelledby="prTitle">
        ${sheenMarkup()}
        ${particlesMarkup()}
        ${cardTop()}
        <h1 class="pr-title" id="prTitle">${esc(tf("prijava.signedInTitle", "Prijavljeni ste"))}</h1>
        <div class="pr-who">
          <span class="pr-avatar" aria-hidden="true">${esc(initial)}</span>
          <span class="pr-whotext">
            <b>${esc(tf("prijava.account", "Račun"))}</b>
            <span>${esc(email)}</span>
          </span>
        </div>
        <div class="pr-stack">
          <a class="btn btn-primary btn-lg" href="#/atelier" data-pr-enter>${esc(tf("prijava.toCatalog", "Nastavi"))}${ICON_ARROW}</a>
          <button type="button" class="btn btn-block" id="prSignOut">${esc(tf("prijava.signOut", "Odjava"))}</button>
        </div>
        <p class="pr-msg" id="prMsg" role="status" aria-live="polite"></p>
        <p class="pr-note">${esc(tf("prijava.localNote", "Favoriti i dizajni spremaju se na ovaj uređaj."))}</p>
      </section>`);
}

// ---- validation ------------------------------------------------------------
// Deliberately loose: a strict RFC pattern rejects addresses that exist, and
// the server is the real authority. This only catches the typo classes the
// user can fix without a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ERR_FALLBACK = {
  credentials: "Email ili lozinka nisu točni.",
  unconfirmed: "Račun još nije potvrđen — provjerite email.",
  rate: "Previše pokušaja. Pričekajte trenutak pa pokušajte ponovno.",
  network: "Nema veze s poslužiteljem. Provjerite internet pa pokušajte ponovno.",
  unavailable: "Prijava nije dostupna u ovoj verziji.",
  other: "Prijava nije uspjela. Pokušajte ponovno.",
};

function setFieldError(input, message) {
  const wrap = input.closest(".pr-field");
  const slot = wrap?.querySelector(".pr-err");
  if (wrap) wrap.classList.toggle("is-bad", Boolean(message));
  if (slot) slot.textContent = message || "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

// ---- lifecycle -------------------------------------------------------------
function clearChrome() {
  document.documentElement.removeAttribute(AUTH_ATTR);
}
// Fires on EVERY navigation, including the ones where a view threw — see the
// header. Registered once, at module evaluation.
if (typeof window !== "undefined") window.addEventListener("akv:teardown", clearChrome);

export async function render(container) {
  ensureStyles();
  const configured = authConfigured();
  // Resolves to null immediately when unconfigured — no client, no request.
  const session = configured ? await getSession() : null;
  // The user navigated away while the session lookup was in flight: this
  // container is detached, so writing to it would be invisible, and setting
  // the chrome attribute would hide the navigation of the screen they are
  // actually looking at.
  if (!container.isConnected) return;

  const email = session?.user?.email || "";
  container.innerHTML = session ? signedInMarkup(email) : signInMarkup(configured);
  document.documentElement.setAttribute(AUTH_ATTR, "on");
  populateCardParticles(container);
  wireCardSheen(container);

  wireEntryHandoff(container);
  if (session) wireSignedIn(container);
  else if (configured) { wireForm(container); wireGoogle(container); }
  wireCardTop(container);
}

// The pointer-tracked glass sheen (operator reference, 2026-08-04 — the
// @uix.vikram job-card screenshot): a soft highlight that follows the
// cursor across the card, like light moving across a real pane of glass.
// Moves .pr-sheen (login-photo-style.js) directly via element.style — a
// custom-property-driven pseudo-element background-position was tried first
// and measurably did not repaint reliably, which is why this is a real
// element instead.
//
// Deliberately mouse-only: `hover:hover` and `pointer:fine` both have to be
// true, so touch and coarse pointers never wire the listener and simply see
// the CSS default (a fixed top-centre glow) — there is no hover concept to
// react to there. Skipped entirely under reduced motion, same as every
// other card effect on this screen. This is a distinct, deliberate feature
// from the old ambient tilt-sensor parallax this screen never had and still
// doesn't: nothing here reads device orientation or moves the card itself,
// only the one small overlay's background position, on hover.
function wireCardSheen(container) {
  const card = container.querySelector(".pr-card");
  const sheen = container.querySelector(".pr-sheen");
  if (!card || !sheen) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    sheen.style.backgroundPosition = `${Math.max(0, Math.min(100, x)).toFixed(1)}% ${Math.max(0, Math.min(100, y)).toFixed(1)}%`;
  });
  card.addEventListener("pointerleave", () => {
    sheen.style.backgroundPosition = "";
  });
}


// The post-login transition. Lazy-imported and FAILURE-TOLERANT on purpose: a
// static import would put js/splash.js on the login view's critical path, so a
// cold offline load that missed it in cache would fail the entire view instead
// of skipping an animation. If the module cannot load, or throws, the fallback
// is the plain hash change - the user always ends up in the app.
//
// playSignInTransition() owns the route change itself and guarantees it fires
// even if every animation step fails, so there is no navigate() call here to
// double up with it.
async function leaveForApp() {
  try {
    const m = await import("../splash.js");
    await m.playSignInTransition({
      navigate: () => { location.hash = "#/atelier"; },
      orientationCue: {
        title: tf("prijava.rotateTitle", "Okrenite telefon"),
        detail: tf("prijava.rotateBody", "Više prostora za vaš projekt"),
      },
    });
  } catch {
    location.hash = "#/atelier";
  }
}

// Guest/static entry and the already-signed-in doorway use the same departure
// as successful authentication. The ordinary href remains the no-JS/failure
// fallback; only an unmodified primary click is enhanced.
function wireEntryHandoff(container) {
  for (const link of container.querySelectorAll("[data-pr-enter]")) {
    link.addEventListener("click", async (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      link.setAttribute("aria-busy", "true");
      try { await leaveForApp(); }
      finally { link.removeAttribute("aria-busy"); }
    }, { once: true });
  }
}

// The theme switch and the mode swap. Wired even when there is no backend:
// the theme is a client preference and the swap only changes what this card
// renders, so neither depends on accounts being switched on.
function wireCardTop(container) {
  const themeBtn = container.querySelector("#prTheme");
  if (themeBtn) {
    const sync = () => {
      const stored = (() => { try { return localStorage.getItem("akv:theme") || ""; } catch { return ""; } })();
      const dark = stored ? stored === "dark"
        : Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
      themeBtn.setAttribute("aria-pressed", String(dark));
      return dark;
    };
    sync();
    themeBtn.addEventListener("click", () => {
      const dark = themeBtn.getAttribute("aria-pressed") === "true";
      // Written through the SAME key js/app.js owns, so the switch here and the
      // one in the drawer are one setting rather than two that disagree. app.js
      // re-reads it on its own next applyTheme(); the attribute write below is
      // what makes it take effect now.
      try { localStorage.setItem("akv:theme", dark ? "light" : "dark"); } catch { /* storage blocked */ }
      document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
      sync();
    });
  }

  const swap = container.querySelector("#prSwap");
  swap?.addEventListener("click", () => {
    mode = mode === "signup" ? "signin" : "signup";
    if (container.isConnected) render(container);
  });
}

// "Zaboravljena lozinka?" — a real reset mail, not a placeholder.
//
// The success wording is deliberately conditional ("if that address is
// registered"): Supabase does not reveal whether an address exists, because an
// endpoint that did would be an account-enumeration oracle. Saying "sent" would
// claim something this cannot actually know.
function wireForgot(container, say, emailInput) {
  const btn = container.querySelector("#prForgot");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const value = emailInput.value.trim();
    if (!value || !EMAIL_RE.test(value)) {
      setFieldError(emailInput, tf("prijava.forgotNeedEmail", "Upišite svoju e-mail adresu pa ponovno pritisnite."));
      emailInput.focus();
      return;
    }
    btn.disabled = true;
    try {
      await requestPasswordReset(value);
      say(tf("prijava.forgotSent", "Ako je adresa registrirana, poslali smo poveznicu za promjenu lozinke."), "is-ok");
    } catch (err) {
      const code = ERR_FALLBACK[err?.code] ? err.code : "other";
      say(tf("prijava.err." + code, ERR_FALLBACK[code]), "is-err");
    } finally {
      btn.disabled = false;
    }
  });
}

// Google is wired separately from wireForm() because it is NOT part of the
// form: it must keep working if the email form is absent, and a click on it
// must never submit the form's fields.
function wireGoogle(container) {
  const button = container.querySelector("#prGoogle");
  const msg = container.querySelector("#prGoogleMsg");
  if (!button) return;

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    if (msg) { msg.textContent = ""; msg.className = "pr-msg"; }
    button.classList.add("is-busy");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    try {
      await signInWithGoogle();
      // Resolved means "the redirect was issued", not "signed in". The browser
      // is now leaving for accounts.google.com, so the control stays disabled
      // deliberately — re-enabling it would invite a second click that starts a
      // competing OAuth attempt during the hand-off.
      if (msg) {
        msg.textContent = tf("prijava.googleRedirect", "Otvaramo Google prijavu…");
        msg.className = "pr-msg";
      }
    } catch (err) {
      const code = ERR_FALLBACK[err?.code] ? err.code : "other";
      if (msg) {
        msg.textContent = tf("prijava.err." + code, ERR_FALLBACK[code]);
        msg.className = "pr-msg is-err";
      }
      // Only restore the button on FAILURE — on success the page is unloading.
      button.classList.remove("is-busy");
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
    }
  });
}

function wireSignedIn(container) {
  const button = container.querySelector("#prSignOut");
  const msg = container.querySelector("#prMsg");
  button?.addEventListener("click", async () => {
    button.classList.add("is-busy");
    button.disabled = true;
    await signOut();
    window.AKV?.toast?.(tf("prijava.signedOut", "Odjavljeni ste."));
    if (container.isConnected) render(container);
    else if (msg) msg.textContent = tf("prijava.signedOut", "Odjavljeni ste.");
  });
}

function wireForm(container) {
  const form = container.querySelector("#prForm");
  const emailInput = container.querySelector("#prEmail");
  const passInput = container.querySelector("#prPass");
  const submit = container.querySelector("#prSubmit");
  const msg = container.querySelector("#prMsg");
  const eye = container.querySelector("#prEye");
  if (!form || !emailInput || !passInput || !submit) return;

  const say = (text, kind) => {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "pr-msg" + (kind ? " " + kind : "");
  };
  const busy = (on) => {
    submit.classList.toggle("is-busy", on);
    submit.disabled = on;
    submit.setAttribute("aria-busy", String(on));
  };

  // Show / hide password. The label and the pressed state move together, so a
  // screen reader hears the current state rather than the eye glyph.
  eye?.addEventListener("click", () => {
    const reveal = passInput.type === "password";
    passInput.type = reveal ? "text" : "password";
    eye.innerHTML = reveal ? ICON_EYE_OFF : ICON_EYE;
    eye.setAttribute("aria-pressed", String(reveal));
    eye.setAttribute("aria-label", reveal
      ? tf("prijava.hidePassword", "Sakrij lozinku")
      : tf("prijava.showPassword", "Prikaži lozinku"));
    passInput.focus();
  });

  // Clear a field error as soon as the user starts fixing it; re-check on blur
  // only once the field has been submitted at least once, so nobody is told
  // their half-typed address is wrong.
  let submitted = false;
  const checkEmail = () => {
    const value = emailInput.value.trim();
    if (!value) return tf("prijava.errEmailRequired", "Unesite email adresu.");
    if (!EMAIL_RE.test(value)) return tf("prijava.errEmailInvalid", "Provjerite email adresu — nedostaje @ ili domena.");
    return "";
  };
  const checkPass = () => (passInput.value ? "" : tf("prijava.errPasswordRequired", "Unesite lozinku."));

  for (const [input, check] of [[emailInput, checkEmail], [passInput, checkPass]]) {
    input.addEventListener("input", () => setFieldError(input, ""));
    input.addEventListener("blur", () => { if (submitted) setFieldError(input, check()); });
  }

  wireForgot(container, say, emailInput);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitted = true;
    const emailError = checkEmail();
    const passError = checkPass();
    setFieldError(emailInput, emailError);
    setFieldError(passInput, passError);
    if (emailError || passError) {
      say("", "");
      (emailError ? emailInput : passInput).focus();
      return;
    }

    say("", "");
    busy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(emailInput.value.trim(), passInput.value);
        rememberEmail(emailInput.value.trim());
        if (needsConfirmation) {
          // The third state: the account exists but there is no session,
          // because the project confirms addresses by mail. Saying "welcome"
          // here would be a lie, and saying "failed" would be a worse one.
          say(tf("prijava.confirmSent", "Račun je otvoren. Provjerite e-poštu i potvrdite adresu."), "is-ok");
          return;
        }
        say(tf("prijava.createdOk", "Račun je otvoren."), "is-ok");
        window.AKV?.toast?.(tf("prijava.createdOk", "Račun je otvoren."));
        await leaveForApp();
        return;
      }
      await signIn(emailInput.value.trim(), passInput.value);
      rememberEmail(emailInput.value.trim());
      say(tf("prijava.success", "Prijavljeni ste."), "is-ok");
      window.AKV?.toast?.(tf("prijava.success", "Prijavljeni ste."));
      await leaveForApp();
    } catch (err) {
      const code = ERR_FALLBACK[err?.code] ? err.code : "other";
      say(tf("prijava.err." + code, ERR_FALLBACK[code]), "is-err");
      if (code === "credentials") { passInput.value = ""; passInput.focus(); }
    } finally {
      busy(false);
    }
  });
}

export function teardown() {
  clearChrome();
}
