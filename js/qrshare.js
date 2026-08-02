// ============================================================================
// qrshare.js — cross-device share sheet: a scannable QR code of a URL, the URL
// as selectable text, "Kopiraj poveznicu" and a close button.
//
// Why it exists: the real Akvaterm flow is a customer at the Dubrovnik counter
// (or at home) moving a design between devices. The 2D designer already
// encodes a whole design in the location hash, so a QR of that URL is a
// complete handoff with no account system — the customer points a phone at the
// screen and keeps designing.
//
//   import { openSharePanel } from "../qrshare.js";
//   await openSharePanel(location.href, { title: "Podijeli dizajn" });
//
// Contract: `openSharePanel(url, opts = {}) -> Promise<void>` that resolves
// when the panel is closed (Escape, backdrop, close button, or navigation).
// It is standalone — it takes any URL string, needs no app state, and does not
// import a view. Only css/styles.css (.sheet / .btn, owned elsewhere) and the
// vendored encoder under vendor/qr/ are assumed.
//
// The QR itself is drawn here rather than imported as an image: the encoder
// hands us a module bitmap, and painting it on a canvas at an integer pixel
// scale is what keeps the edges crisp enough to scan.
// ============================================================================

import qrcode from "../vendor/qr/qrcode.mjs";
import { t } from "./i18n.js";

// i18n with an inline Croatian fallback — same tf/T pattern the views use, so
// the panel reads Croatian even before the dictionary gains these keys
// (t() returns the key itself on a miss).
const T = (key, fb) => { const v = t(key); return v === key ? fb : v; };

// The upstream encoder defaults to a single-byte string→bytes function, which
// mangles anything outside Latin-1. Share URLs are percent-encoded ASCII, but
// the panel accepts *any* string, so switch to UTF-8 once at module load.
qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

// Error-correction levels to try, best first. A denser level survives a
// scuffed screen or a bad angle; if the payload will not fit we step down
// rather than refusing to draw. "L" is the largest payload the format allows.
const EC_LEVELS = ["M", "L"];

// Quiet zone: the QR spec requires 4 blank modules on every side. Without it
// most scanners never lock on, which is the classic "renders fine, won't scan"
// bug — so it is a constant here, not a style choice.
const QUIET_MODULES = 4;

// Backing pixels per module. Integer scaling only: a fractional scale makes the
// browser antialias module edges into gray, and gray edges are what break a
// scan at an angle. Clamped so a tiny QR is not a wall poster and a dense one
// still has real pixels behind it.
const MIN_MODULE_PX = 3;
const MAX_MODULE_PX = 10;
const TARGET_BACKING_PX = 720;

// Pure black on pure white — 21.00:1, verified. Deliberately NOT the Iris
// palette: scanners threshold on luminance, and --teal-600 #139EB1 on white is
// 3.20:1, which is a scan failure dressed up as branding. The palette shows up
// in the sheet AROUND the code, never inside it, and .akv-qr-frame keeps its
// literal white for the same reason.
const QR_DARK = "#000000";
const QR_LIGHT = "#ffffff";

let openPanel = null;   // only ever one share sheet at a time

// ---------------------------------------------------------------------------
// scoped styles
// ---------------------------------------------------------------------------
// css/styles.css is owned elsewhere and ships .sheet-backdrop / .sheet /
// .sheet-actions / .btn / h2, which this panel reuses AS-IS. Everything below
// is namespaced .akv-qr* so it can only ever affect this component, and every
// colour is `var(--token, verified-literal)`: the token is what the Iris
// palette supplies, the literal is what keeps a standalone call (or a
// half-deployed stylesheet) legible rather than merely styled. The literals
// are the values the shipped tokens actually resolve to, read out of the live
// page — not guesses at what they might be.
//
// WHAT THIS COMPONENT DELIBERATELY DOES NOT STYLE, because css/styles.css
// already owns it and a second copy would be a specificity fight plus a second
// place to keep in sync:
//   • the scrim — colour, blur, z-index 70, and ALL FOUR degradation paths
//     (@supports not backdrop-filter / prefers-reduced-transparency /
//     prefers-contrast + forced-colors / prefers-reduced-motion) plus the
//     manual html[data-transparency="reduced"] switch. The backdrop element
//     carries .sheet-backdrop as well as .akv-qr-backdrop precisely so it
//     inherits every one of them.
//   • the sheet's surface, border, radius, safe-area padding and entrance.
//   • the <h2>, which takes the display face with the measured caron padding.
// The absence is the decision, so it is written down rather than left silent.
//
// GLASS BUDGET: the top bar and the tab bar are the two standing
// backdrop-filter surfaces. This scrim is the third — and styles.css makes it
// REPLACE rather than add (`html:has(.sheet-backdrop)` drops the bars' blur
// while a sheet is open), so the panel never pushes the count past three.
//
// ---------------------------------------------------------------------------
// CONTRAST — measured against the tokens as shipped, not eyeballed. WCAG 2.x
// relative luminance with sRGB alpha compositing; every pair was computed.
//
//   --ink #313131      on --surface #FFFFFF ............... 13.01:1  (body)
//   --ink #313131      on --panel-2 #FBFAFA ............... 12.49:1  (the URL)
//   --muted #756168    on --surface #FFFFFF ...............  5.73:1  (lead, label)
//   --accent-ink #0D707D on --accent-tint over --surface ...  5.08:1  (the note)
//   --accent-ink #0D707D on --accent-tint over --paper ....  4.58:1  (the note,
//       measured against the darker surface too, so the note stays AA even if
//       --surface is ever retuned toward the page background)
//   #000000            on #FFFFFF ......................... 21.00:1  (the code)
//
// All six clear 4.5:1, so none of this component's text depends on the
// large-text exemption.
// ---------------------------------------------------------------------------

const STYLE_ID = "akv-qr-css";
const STYLES = `
/* ---- Backdrop: layout only. See the note above for everything omitted. --- */
.akv-qr-backdrop{padding:0 env(safe-area-inset-right,0px) 0 env(safe-area-inset-left,0px)}

/* ---- Sheet ---------------------------------------------------------------
   .sheet already supplies the surface, border, radius, shadow, safe-area
   padding and entrance animation. This adds only the scroll behaviour a long
   share URL needs on a short phone. Opaque, never glass: the panel carries a
   12px monospace URL, which is the least forgiving text in the app, and glass
   here would trade the one thing the panel exists to deliver — a readable,
   copyable link — for an effect. */
.akv-qr-sheet{max-height:92vh;overflow-y:auto}
/* .sheet p (0,1,1) outranks a lone class, so the lead is qualified to win. */
.akv-qr-sheet .akv-qr-lead{
  margin-top:8px;font-size:14px;line-height:1.5;color:var(--muted,#756168);
}

/* ---- The code ------------------------------------------------------------ */
.akv-qr-frame{
  /* max-width is a scanning constraint, not a taste one: a dense share URL is
     a ~93-module code, and phone cameras want roughly 3 CSS px per module.
     340px keeps it above that and still fits the 375px mobile sheet. */
  margin:18px auto 0;width:100%;max-width:340px;
  /* Literal white, NOT var(--surface): a tinted quiet zone lowers the module
     contrast the scanner thresholds on. The one place in the app where the
     palette is deliberately not applied — see the QR_DARK/QR_LIGHT note. */
  background:${QR_LIGHT};
  border:1px solid var(--line,rgba(104,52,15,.12));
  border-radius:var(--radius-sm,12px);padding:10px;
}
.akv-qr-frame canvas{
  display:block;width:100%;height:auto;
  /* The canvas is drawn at exact module resolution and upscaled by CSS — keep
     the upscale hard-edged or the modules blur back into unscannable gray.
     crisp-edges first as the fallback; pixelated (nearest neighbour, exactly
     what a QR wants) wins wherever it is supported. */
  image-rendering:crisp-edges;image-rendering:pixelated;
}

/* ---- The "too long for a QR" note ---------------------------------------
   --accent-ink on --accent-tint: 5.08:1 over --surface, 4.58:1 over --paper.
   Measured against both because a tint is transparent, so its contrast is a
   property of whatever is behind it, not of the tint alone.

   Qualified with .akv-qr-sheet for the same reason .akv-qr-lead is: the note
   is a <p> inside .sheet, and the design system's rule
   ".sheet p {color:var(--muted); font-size:14px}" is (0,1,1) — it outranks a
   bare class and silently repainted this note --muted, dropping the teal the
   notice is supposed to carry. Verified in the browser, not assumed: the
   computed colour was rgb(117,97,104).
   (No backticks in this comment: it lives inside the STYLES template literal,
   and one would terminate the literal here.) */
.akv-qr-sheet .akv-qr-note{
  margin-top:14px;padding:11px 14px;border-radius:var(--radius-sm,12px);
  background:var(--accent-tint,rgba(19,158,177,.12));
  border:1px solid var(--accent-ring,rgba(19,158,177,.34));
  color:var(--accent-ink,#0D707D);
  font-size:13.5px;line-height:1.45;font-weight:600;
}

/* ---- The URL --------------------------------------------------------------
   The label is the system's signature meta gesture: small, weight 600,
   uppercase, --track-meta wide. Figtree, whose 0.88em caron clears its 0.95em
   ascent, so every Croatian diacritic renders unclipped at this tracking. */
.akv-qr-url-label{
  display:block;margin:18px 0 6px;
  font-size:11.5px;font-weight:600;letter-spacing:var(--track-meta,.08em);
  line-height:1.4;text-transform:uppercase;color:var(--muted,#756168);
}
.akv-qr-url{
  display:block;width:100%;padding:10px 12px;
  border:1px solid var(--line,rgba(104,52,15,.12));border-radius:var(--radius-sm,12px);
  background:var(--panel-2,#FBFAFA);color:var(--ink,#313131);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;
  max-height:5.5em;overflow-y:auto;overflow-wrap:anywhere;word-break:break-all;
  -webkit-user-select:all;user-select:all;
}
.akv-qr-actions{display:flex;flex-direction:column;gap:10px;margin-top:20px}

/* ---- Forced colours -------------------------------------------------------
   The ONE degradation this component must handle itself. Under forced-colors
   the UA repaints backgrounds from the user's palette, and a repainted quiet
   zone makes the code unscannable — so the frame opts out with
   forced-color-adjust and keeps its literal black-on-white. Everything else
   hands over to the system palette rather than fighting it with fixed hexes. */
@media(forced-colors:active){
  .akv-qr-sheet .akv-qr-note,.akv-qr-url{background:Canvas;color:CanvasText;border:1px solid CanvasText}
  .akv-qr-sheet .akv-qr-lead,.akv-qr-url-label{color:CanvasText}
  .akv-qr-frame{background:${QR_LIGHT};forced-color-adjust:none;border:1px solid CanvasText}
}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// encoding + painting
// ---------------------------------------------------------------------------

/** Encode `text` at the strongest error-correction level it fits in.
 *  Returns null when the payload overflows even level L (~2 950 bytes) — the
 *  caller degrades to copy-only rather than showing a broken code. */
export function encode(text) {
  for (const ec of EC_LEVELS) {
    try {
      const qr = qrcode(0, ec);   // 0 = auto-pick the smallest version that fits
      qr.addData(String(text));
      qr.make();
      return { qr, ec, count: qr.getModuleCount() };
    } catch {
      // "code length overflow" for this level — try a weaker one.
    }
  }
  return null;
}

/** Paint a made QR onto `canvas`, quiet zone included, at an integer scale. */
function paint(canvas, qr, count) {
  const total = count + QUIET_MODULES * 2;
  const scale = Math.min(
    MAX_MODULE_PX,
    Math.max(MIN_MODULE_PX, Math.floor(TARGET_BACKING_PX / total))
  );
  const size = total * scale;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  // The quiet zone is just light background extending past the code.
  ctx.fillStyle = QR_LIGHT;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = QR_DARK;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      ctx.fillRect(
        (col + QUIET_MODULES) * scale,
        (row + QUIET_MODULES) * scale,
        scale,
        scale
      );
    }
  }
}

// ---------------------------------------------------------------------------
// the panel
// ---------------------------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const toast = (msg) => { try { window.AKV?.toast?.(msg); } catch { /* chrome not mounted */ } };

/** Copy `text` to the clipboard. The async Clipboard API needs a secure origin
 *  and a live user gesture, so fall back to the legacy execCommand path before
 *  giving up. Returns whether the text actually reached the clipboard.
 *
 *  Deliberately no window.prompt() fallback: a blocking prompt on top of an
 *  open modal is a worse experience than the panel's own URL text, which is
 *  already displayed with user-select:all. The caller selects that text
 *  instead, so "copy failed" still ends in something the user can act on. */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* not permitted / not a secure context — try the legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (ok) return true;
  } catch { /* fall through */ }
  return false;
}

/** Put the URL under the user's cursor so a manual Ctrl/Cmd+C still works. */
function selectText(el) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch { /* selection is a nicety, never a failure */ }
}

/**
 * Open the share sheet for `url` and resolve once it closes.
 *
 * @param {string} url  Any absolute URL. Shown as text and encoded as a QR.
 * @param {object} [opts]
 * @param {string} [opts.title]     Sheet heading (Croatian).
 * @param {string} [opts.subtitle]  One line under the heading explaining the scan.
 * @returns {Promise<void>} resolves when the panel is closed.
 */
export async function openSharePanel(url, opts = {}) {
  const text = String(url ?? "");

  // A second call replaces the first rather than stacking backdrops.
  if (openPanel) openPanel.close();

  ensureStyles();

  const title = opts.title || T("qr.title", "Podijeli dizajn");
  const subtitle = opts.subtitle ||
    T("qr.lead", "Skenirajte kod mobitelom da nastavite na drugom uređaju.");
  const copyLabel = T("qr.copy", "Kopiraj poveznicu");
  const closeLabel = T("common.close", "Zatvori");

  const encoded = encode(text);

  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop akv-qr-backdrop";
  backdrop.innerHTML = `
    <div class="sheet akv-qr-sheet" role="dialog" aria-modal="true" aria-labelledby="akvQrTitle">
      <h2 id="akvQrTitle">${esc(title)}</h2>
      <p class="akv-qr-lead">${esc(subtitle)}</p>
      ${encoded
        ? `<div class="akv-qr-frame"><canvas id="akvQrCanvas" role="img"
             aria-label="${esc(T("qr.canvasAlt", "QR kod poveznice za dijeljenje"))}"></canvas></div>`
        : `<p class="akv-qr-note">${esc(T("qr.tooLong",
             "Poveznica je predugačka za QR kod. Kopirajte je i pošaljite porukom."))}</p>`}
      <span class="akv-qr-url-label" id="akvQrUrlLabel">${esc(T("qr.urlLabel", "Poveznica"))}</span>
      <code class="akv-qr-url" id="akvQrUrl" aria-labelledby="akvQrUrlLabel">${esc(text)}</code>
      <div class="sheet-actions akv-qr-actions">
        <button type="button" class="btn btn-primary btn-lg" id="akvQrCopy">${esc(copyLabel)}</button>
        <button type="button" class="btn btn-lg" id="akvQrClose">${esc(closeLabel)}</button>
      </div>
    </div>`;

  const sheet = backdrop.querySelector(".akv-qr-sheet");
  const copyBtn = backdrop.querySelector("#akvQrCopy");
  const closeBtn = backdrop.querySelector("#akvQrClose");

  document.body.appendChild(backdrop);
  if (encoded) paint(backdrop.querySelector("#akvQrCanvas"), encoded.qr, encoded.count);

  // ---- modal behaviour --------------------------------------------------
  const prevFocus = document.activeElement;
  let settle;
  const closed = new Promise((resolve) => { settle = resolve; });
  let labelTimer = 0;
  let done = false;

  function close() {
    if (done) return;
    done = true;
    openPanel = null;
    clearTimeout(labelTimer);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("hashchange", close);
    window.removeEventListener("akv:teardown", close);
    backdrop.remove();
    // Give focus back to whatever opened the sheet (the "Podijeli" button), so
    // a keyboard user is not dumped at the top of the document.
    try { prevFocus?.focus?.(); } catch { /* element may be gone after a re-render */ }
    settle();
  }

  function focusables() {
    return [...sheet.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter((el) => !el.disabled && el.offsetParent !== null);
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    // Keep Tab inside the dialog — an aria-modal sheet whose focus escapes to
    // the page behind it is a modal in name only.
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !sheet.contains(active))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault(); first.focus();
    }
  }

  // Backdrop click closes; a click that started inside the sheet must not.
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);

  // Navigating away closes the sheet. Both signals are subscribed one tick
  // late on purpose: a caller that writes the share URL with `location.hash =
  // …` right before opening would otherwise be closed by its own navigation —
  // the hashchange, and the "akv:teardown" app.js fires from route() in
  // response to it, both land after this function returns. (Same deferral
  // app.js uses for its "Više" popover.) history.replaceState, which the 2D
  // designer's share handler uses, fires neither.
  setTimeout(() => {
    if (done) return;
    window.addEventListener("hashchange", close);
    window.addEventListener("akv:teardown", close);   // fired on every view swap
  }, 0);

  const urlEl = backdrop.querySelector("#akvQrUrl");
  copyBtn.addEventListener("click", async () => {
    const ok = await copy(text);
    if (ok) {
      const copied = T("qr.copied", "Poveznica kopirana");
      toast(copied);
      copyBtn.textContent = copied;
    } else {
      // Clipboard refused (insecure origin, denied permission, older browser).
      // Hand the user the next best thing: the URL, already selected.
      selectText(urlEl);
      urlEl.scrollIntoView({ block: "nearest" });
      toast(T("qr.copyManual", "Označili smo poveznicu — kopirajte je s Ctrl+C."));
      copyBtn.textContent = T("qr.copyManualShort", "Kopirajte označeni tekst");
    }
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => { if (!done) copyBtn.textContent = copyLabel; }, 2600);
  });

  openPanel = { close };
  copyBtn.focus();

  return closed;
}
