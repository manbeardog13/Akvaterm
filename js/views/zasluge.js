// ============================================================================
// views/zasluge.js — Credits (#/zasluge).
//
// WHY THIS SCREEN IS NOT OPTIONAL
// ---------------------------------------------------------------------------
// 61 of the 3D models in vendor/models/ are CC0 1.0, which asks for nothing.
// TWO ARE NOT:
//
//   radiator-panel.glb   Poly by Google, CC-BY 3.0
//   ac-indoor-split.glb  Poly by Google, CC-BY 3.0
//
// CC-BY costs no money — that is the whole point of the licence, it permits
// commercial use and redistribution for free — but it does carry one binding
// condition: credit the author. There is no way to satisfy that condition
// except to publish the credit somewhere a user can reach.
//
// AND THE OBLIGATION IS ALREADY LIVE, even though neither model is rendered.
// js/room3d.js deliberately draws the radiator and the indoor AC as primitive
// slabs (see the "No CC0 model exists" block there) so that the app itself
// never displays a CC-BY asset. That decision limits the exposure but does not
// remove it: both .glb files are committed to a PUBLIC repository and served
// by GitHub Pages, and CC-BY attaches to REDISTRIBUTION, not only to display.
// Shipping the bytes is the triggering act.
//
// vendor/models/PROVENANCE.md carries the full credit and travels with the
// source, which covers anyone who reads the repository. It does not cover
// someone who only ever opens the app, which is why this screen exists.
//
// If the two files are ever deleted from vendor/models/, the CC-BY section
// below may go with them. Until then it stays, and it stays REACHABLE — a
// credits page that no route points at satisfies nothing.
//
// The CC0 credits underneath are a courtesy, not a requirement. They are here
// because a project that hides where its assets came from is worse than one
// that says so, and because it makes the licence audit re-runnable by hand.
//
// ---------------------------------------------------------------------------
// A backtick must never appear inside the template literals below, not even in
// a comment: it terminates the string, and node --check still passes.
// ============================================================================

import { t } from "../i18n.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function tf(key, fallback, vars) {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

const STYLE_ID = "akv-zasluge-css";

// ---- the data --------------------------------------------------------------
// Transcribed from vendor/models/PROVENANCE.md, which is the authority. The
// counts are how many files in vendor/models/ come from each source, so a
// reader can check this list against the directory rather than trust it.

// MANDATORY. Author, licence and a link to the licence text are what CC-BY 3.0
// asks for; the source page is included so the claim is checkable.
const CC_BY = [
  {
    file: "radiator-panel.glb",
    title: "Radiator",
    author: "Poly by Google",
    authorUrl: "https://poly.pizza/u/Poly%20by%20Google",
    source: "https://poly.pizza/m/4XJ-DH66eKY",
  },
  {
    file: "ac-indoor-split.glb",
    title: "Air conditioner",
    author: "Poly by Google",
    authorUrl: "https://poly.pizza/u/Poly%20by%20Google",
    source: "https://poly.pizza/m/5KohLH0xc8d",
  },
];

// COURTESY. CC0 asks for nothing at all.
const CC0 = [
  { author: "Kenney", count: 36, url: "https://kenney.nl/assets/furniture-kit" },
  { author: "Isa Lousberg", count: 7, url: "https://poly.pizza/u/Isa%20Lousberg" },
  { author: "Quaternius", count: 9, url: "https://quaternius.com/packs/ultimatehomeinterior.html" },
  { author: "CreativeTrio", count: 6, url: "https://poly.pizza/u/CreativeTrio" },
  { author: "Kay Lousberg", count: 1, url: "https://poly.pizza/u/Kay%20Lousberg" },
];

// The SIL Open Font License also requires its text to travel with the fonts.
// That obligation is met by vendor/fonts/OFL-*.txt being in the tree; naming
// the families here is courtesy, and it tells a reader which faces they are
// looking at.
const FONTS = [
  { name: "Sora", role: "naslovi", url: "https://github.com/lafgroup/Sora" },
  { name: "Inter", role: "tekst", url: "https://github.com/rsms/inter" },
  { name: "Figtree", role: "logotip", url: "https://github.com/erikdkennedy/figtree" },
];

const LIB = [
  { name: "three.js", role: "3D prikaz", url: "https://threejs.org/" },
  { name: "supabase-js", role: "baza i prijava", url: "https://supabase.com/" },
];

const CSS = `
.zs-wrap{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
.zs-lead{margin:6px 0 0;font-size:14.5px;line-height:1.6;color:var(--muted);max-width:56ch}
.zs-sec{padding:20px;border-radius:var(--r-lg,20px);background:var(--surface);border:1px solid var(--line)}
.zs-sec h2{font-size:clamp(17px,2.4vw,20px);margin:0 0 3px}
.zs-note{margin:0 0 14px;font-size:13px;line-height:1.55;color:var(--muted)}

/* The required badge is the point of the first section: it says, on screen,
   that this credit is an obligation rather than a nicety. */
.zs-badge{
  display:inline-block;margin-bottom:9px;padding:4px 10px;border-radius:var(--r-pill);
  font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  background:var(--accent-2-tint);color:var(--accent-2-ink);
}
.zs-item{
  display:flex;flex-wrap:wrap;align-items:baseline;gap:5px 9px;
  padding:11px 0;border-top:1px solid var(--line);font-size:14px;line-height:1.5;
}
.zs-item:first-of-type{border-top:0}
.zs-item b{font-weight:600;color:var(--ink)}
.zs-item .zs-meta{font-size:12.5px;color:var(--muted)}
.zs-item a{color:var(--accent-ink);text-decoration:none;font-weight:500}
.zs-item a:hover{text-decoration:underline}
.zs-file{
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:12px;color:var(--muted);
}
.zs-rows{display:flex;flex-direction:column}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// rel="noopener" on every outbound link: these open a third-party page, and a
// target-blank link without it hands that page a window.opener handle.
const link = (href, label) =>
  `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

const BY_URL = "https://creativecommons.org/licenses/by/3.0/";
const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

export async function render(container) {
  ensureStyles();

  const ccByRows = CC_BY.map((m) => `
      <div class="zs-item">
        <b>${esc(m.title)}</b>
        <span class="zs-meta">${tf("zasluge.by", "autor")}: ${link(m.authorUrl, m.author)}</span>
        <span class="zs-meta">${link(BY_URL, "CC-BY 3.0")}</span>
        <span class="zs-meta">${link(m.source, tf("zasluge.source", "izvor"))}</span>
        <span class="zs-file">${esc(m.file)}</span>
      </div>`).join("");

  const cc0Rows = CC0.map((s) => `
      <div class="zs-item">
        <b>${link(s.url, s.author)}</b>
        <span class="zs-meta">${esc(String(s.count))} ${tf("zasluge.models", "modela")}</span>
      </div>`).join("");

  const fontRows = FONTS.map((f) => `
      <div class="zs-item">
        <b>${link(f.url, f.name)}</b>
        <span class="zs-meta">${esc(f.role)} &middot; SIL Open Font License 1.1</span>
      </div>`).join("");

  const libRows = LIB.map((l) => `
      <div class="zs-item">
        <b>${link(l.url, l.name)}</b>
        <span class="zs-meta">${esc(l.role)}</span>
      </div>`).join("");

  container.innerHTML = `
    <div class="zs-wrap">
      <header>
        <span class="t-meta" style="color:var(--accent-ink)">${esc(tf("zasluge.eyebrow", "Akvaterm"))}</span>
        <h1>${esc(tf("zasluge.title", "Zasluge"))}</h1>
        <p class="zs-lead">${esc(tf("zasluge.lead", "Aplikacija koristi otvorene 3D modele, pisma i knjiznice. Ovdje pise tko ih je izradio i pod kojom licencom."))}</p>
      </header>

      <section class="zs-sec">
        <span class="zs-badge">${esc(tf("zasluge.required", "Obavezno navodenje"))}</span>
        <h2>${esc(tf("zasluge.ccbyTitle", "3D modeli — CC-BY 3.0"))}</h2>
        <p class="zs-note">${esc(tf("zasluge.ccbyNote", "Ova licenca dopusta besplatno koristenje, i u komercijalne svrhe, ali trazi navodenje autora."))}</p>
        <div class="zs-rows">${ccByRows}</div>
      </section>

      <section class="zs-sec">
        <h2>${esc(tf("zasluge.cc0Title", "3D modeli — CC0 1.0"))}</h2>
        <p class="zs-note">${esc(tf("zasluge.cc0Note", "Javno dobro: navodenje nije obavezno. Navodimo ga svejedno."))} ${link(CC0_URL, "CC0 1.0")}</p>
        <div class="zs-rows">${cc0Rows}</div>
      </section>

      <section class="zs-sec">
        <h2>${esc(tf("zasluge.fontsTitle", "Pisma"))}</h2>
        <div class="zs-rows">${fontRows}</div>
      </section>

      <section class="zs-sec">
        <h2>${esc(tf("zasluge.libsTitle", "Knjiznice"))}</h2>
        <div class="zs-rows">${libRows}</div>
      </section>
    </div>`;
}
