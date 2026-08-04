// The login threshold is art-directed exclusively from the operator's supplied
// photo set and the approved project-local cinematic interior derived from it:
// one photographic field, one compact translucent card, and no scene copy.
// The image is shipped with the static site; there is no runtime image service,
// GPU dependency, external request, or borrowed interface artwork.

export const LOGIN_PHOTO_CSS = `
html[data-akv-auth] .topbar,
html[data-akv-auth] .tabbar{display:none}
html[data-akv-auth]{
  --pr-page:#d9ddd4;--pr-shell:#0b0d0c;--pr-panel:#0a0b0b;
  --pr-text:#f7f7f2;--pr-muted:rgba(247,247,242,.58);
  --pr-line:rgba(255,255,255,.13);--pr-soft:rgba(255,255,255,.065);
  --pr-input:rgba(255,255,255,.075);--pr-accent:#d7e2ba;
  --pr-accent-ink:#10130d;--pr-danger:#ff9a88;--pr-ok:#a9e3bd;
  --pr-rx:0deg;--pr-ry:0deg;--pr-scene-x:0px;--pr-scene-y:0px;
  --pr-card-x:0px;--pr-card-y:0px;--pr-glare-x:50%;--pr-glare-y:50%;
  --pr-card-reference-scale:.75;
}
html[data-akv-auth] body{min-height:100%;overflow-x:hidden;overflow-y:auto;background:#0b0d0c}
html[data-akv-auth] #main{
  width:100%;max-width:none;min-height:100dvh;margin:0;padding:
    max(16px,env(safe-area-inset-top,0px))
    max(16px,env(safe-area-inset-right,0px))
    max(16px,env(safe-area-inset-bottom,0px))
    max(16px,env(safe-area-inset-left,0px));
  display:flex;perspective:1600px;
}
.pr-wrap{
  position:relative;isolation:isolate;display:grid;place-items:center;
  width:min(1320px,100%);min-height:calc(100dvh - 32px);margin:auto;
  border:1px solid rgba(255,255,255,.2);border-radius:34px;overflow:hidden;
  background:var(--pr-shell);box-shadow:0 2px 3px rgba(12,15,12,.08),0 28px 72px rgba(12,15,12,.28);
}

/* Project-local cinematic interior. The approved photograph is content, not a
   decorative network fetch: it is precached by service-worker.js and remains
   usable on GitHub Pages and offline. */
.pr-scene{
  position:absolute;z-index:0;inset:0;overflow:hidden;background:#0b0d0c;
}
.pr-scene-media{position:absolute;inset:-18px;display:block;overflow:hidden}
.pr-scene-media img{
  width:100%;height:100%;display:block;object-fit:cover;object-position:50% 50%;
  transform:translate3d(var(--pr-scene-x),var(--pr-scene-y),0) scale(1.045);
  transform-origin:50% 50%;transition:transform 220ms cubic-bezier(.2,.75,.2,1);
  filter:saturate(.96) contrast(1.02);
}
.pr-scene::after{
  content:"";position:absolute;inset:0;pointer-events:none;background:
    radial-gradient(circle at var(--pr-glare-x) var(--pr-glare-y),rgba(255,255,255,.1),transparent 30%),
    linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.2) 45%,rgba(0,0,0,.44));
}
.pr-motion{
  position:absolute;z-index:4;right:18px;bottom:18px;width:44px;height:44px;padding:0;
  display:grid;place-items:center;border:1px solid rgba(255,255,255,.2);
  border-radius:999px;background:rgba(8,11,9,.48);color:#fff;font:650 12px/1 var(--font-text);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);cursor:pointer;
}
.pr-motion[hidden]{display:none}.pr-motion:disabled{cursor:default;opacity:.72}
.pr-motion:focus-visible{outline:2px solid #fff;outline-offset:3px}
.pr-motion svg{width:16px;height:16px}

/* The approved reference card is intentionally reduced to a quieter footprint:
   the form stays touch-safe, but the photograph owns the larger share of the
   frame. */
.pr-card{
  position:relative;z-index:3;display:flex;flex-direction:column;justify-content:center;
  width:min(calc(560px * var(--pr-card-reference-scale)),calc(100% - 48px));min-width:0;margin:44px auto;padding:30px 28px;
  color:var(--pr-text);background:rgba(10,12,11,.58);
  border:1px solid rgba(255,255,255,.22);border-radius:30px;
  box-shadow:0 28px 78px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.08);
  backdrop-filter:blur(24px) saturate(1.08);-webkit-backdrop-filter:blur(24px) saturate(1.08);overflow:hidden;
  transform:translate3d(var(--pr-card-x),var(--pr-card-y),35px);
  transition:transform 220ms cubic-bezier(.2,.75,.2,1);
}
.pr-card::before{
  content:"";position:absolute;inset:-35%;pointer-events:none;background:
    radial-gradient(circle at var(--pr-glare-x) var(--pr-glare-y),rgba(255,255,255,.07),transparent 24%);
}
.pr-card>*{position:relative;z-index:1}
.pr-cardtop{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:28px}
.pr-mark{margin:0;font-size:clamp(24px,2.4vw,31px);line-height:1;letter-spacing:-.055em}
.pr-mark .akva{color:#f8f8f4;text-shadow:none}.pr-mark .term{color:#e4454d;text-shadow:none}
.pr-theme{
  position:relative;width:46px;height:44px;padding:0;flex:none;border:0;
  border-radius:999px;background:transparent;cursor:pointer;
}
.pr-theme::before{content:"";position:absolute;inset:9px 0;border:1px solid var(--pr-line);border-radius:999px;background:var(--pr-soft)}
.pr-themeic{position:absolute;z-index:1;top:12px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--pr-text);transition:transform 260ms cubic-bezier(.2,.85,.25,1)}
.pr-theme[aria-pressed=true] .pr-themeic{transform:translateX(20px)}
.pr-theme:focus-visible{outline:2px solid var(--pr-accent);outline-offset:3px}
.pr-title{margin:0;color:var(--pr-text);font-family:var(--font-display);font-size:clamp(30px,3.4vw,45px);font-weight:450;line-height:1.03;letter-spacing:-.04em}
.pr-sub{margin:12px 0 26px;color:var(--pr-muted);font-size:14px;line-height:1.5}
.pr-notice{display:flex;gap:10px;margin:0 0 18px;padding:12px 14px;border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-soft);color:var(--pr-muted)}
.pr-nic{display:flex;flex:none;color:var(--pr-accent)}
.pr-noticetext{font-size:11.5px;line-height:1.45}.pr-noticetext b{display:block;margin-bottom:2px;color:var(--pr-text);font-size:12px}.pr-noticetext span{display:block}
.pr-form fieldset{min-inline-size:0;margin:0;padding:0;border:0}.pr-form fieldset[disabled]{opacity:.5}
.pr-field{margin-bottom:12px}.pr-input{position:relative;display:flex;align-items:center;min-height:52px;border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-input);transition:border-color 160ms ease,background 160ms ease}
.pr-input:focus-within{border-color:rgba(215,226,186,.72);background:rgba(255,255,255,.1);box-shadow:0 0 0 3px rgba(215,226,186,.09)}
.pr-ic{display:flex;margin-left:16px;color:var(--pr-muted)}
.pr-input input{width:100%;min-width:0;padding:0 14px;border:0;outline:0;background:transparent;color:var(--pr-text);font:500 15px/1 var(--font-text)}
.pr-input input::placeholder{color:var(--pr-muted);opacity:1}.pr-eye{display:grid;place-items:center;min-width:44px;min-height:44px;margin-right:3px;padding:0;border:0;background:transparent;color:var(--pr-muted);cursor:pointer}.pr-eye:focus-visible{outline:2px solid var(--pr-accent);outline-offset:-4px;border-radius:11px}
.pr-err{display:block;min-height:0;margin:4px 3px 0;color:var(--pr-danger);font-size:11.5px;line-height:1.35}.pr-err:not(:empty){min-height:16px}.pr-field.is-bad .pr-input{border-color:var(--pr-danger)}
.pr-rowend{display:flex;justify-content:flex-end;margin:-2px 2px 12px}.pr-forgot,.pr-footlink{min-height:44px;padding:0;border:0;background:none;color:var(--pr-muted);font:600 12px/1 var(--font-text);cursor:pointer}.pr-footlink{display:inline-flex;align-items:center;vertical-align:middle;color:var(--pr-accent);margin-left:5px}.pr-forgot:hover,.pr-footlink:hover{color:var(--pr-text)}.pr-forgot:focus-visible,.pr-footlink:focus-visible{outline:2px solid var(--pr-accent);outline-offset:2px;border-radius:5px}
.pr-card .btn{min-height:52px;border-radius:14px;font-size:13px;font-weight:700;letter-spacing:.01em;box-shadow:none}.pr-card .btn-primary{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid rgba(255,255,255,.32);background:var(--pr-accent);color:var(--pr-accent-ink);box-shadow:0 14px 34px -18px rgba(215,226,186,.72)}
.pr-card .btn-primary:hover{filter:brightness(1.04);transform:translateY(-1px)}.pr-card .btn:focus-visible{outline:2px solid var(--pr-accent);outline-offset:3px}.pr-card .btn:disabled{cursor:not-allowed;filter:none;transform:none;box-shadow:none}
.pr-google{position:relative;display:grid!important;grid-template-columns:28px 1fr 28px;align-items:center;width:100%;border:1px solid var(--pr-line)!important;background:var(--pr-soft)!important;color:var(--pr-text)!important}.pr-google>svg{justify-self:center}.pr-glabel{justify-self:center}.pr-google.is-busy .pr-glabel{opacity:.55}
.pr-div{display:flex;align-items:center;gap:12px;margin:18px 0;color:var(--pr-muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.pr-div::before,.pr-div::after{content:"";height:1px;flex:1;background:var(--pr-line)}
.pr-msg{min-height:0;margin:6px 0 0;color:var(--pr-muted);font-size:12px;line-height:1.4;text-align:center}.pr-msg:not(:empty){min-height:17px}.pr-msg.is-err{color:var(--pr-danger)}.pr-msg.is-ok{color:var(--pr-ok)}
.pr-guest{margin-top:16px}.pr-guesthint{margin:9px 0 0;color:var(--pr-muted);font-size:11.5px;line-height:1.45;text-align:center}
.pr-foot{margin:32px 0 0;text-align:center;color:var(--pr-muted);font-size:12px}.pr-note{margin:16px 0 0;color:var(--pr-muted);font-size:12px;line-height:1.45;text-align:center}
.pr-who{display:flex;align-items:center;gap:13px;margin:24px 0;padding:14px;border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-soft)}.pr-avatar{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:50%;background:var(--pr-accent);color:var(--pr-accent-ink);font-weight:800}.pr-whotext{min-width:0}.pr-whotext b,.pr-whotext span{display:block}.pr-whotext b{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--pr-muted)}.pr-whotext span{margin-top:3px;color:var(--pr-text);font-size:13px;overflow-wrap:anywhere}.pr-stack{display:flex;flex-direction:column;gap:10px}
/* Light mode retains the same photographic structure and reverses only the
   editorial plane, like the paired light and dark portfolio references. */
html[data-akv-auth][data-theme=light]{
  --pr-panel:#f6f5f1;--pr-text:#171916;--pr-muted:rgba(23,25,22,.58);
  --pr-line:rgba(23,25,22,.13);--pr-soft:rgba(23,25,22,.045);
  --pr-input:rgba(23,25,22,.055);--pr-accent:#20251d;--pr-accent-ink:#fff;
  --pr-danger:#9e2f22;--pr-ok:#17613a;
}
:root[data-theme=light] .pr-mark .akva,html[data-akv-auth][data-theme=light] .pr-mark .akva{color:#00008c}
@media(prefers-color-scheme:light){
  html[data-akv-auth]:not([data-theme=dark]){--pr-panel:#f6f5f1;--pr-text:#171916;--pr-muted:rgba(23,25,22,.58);--pr-line:rgba(23,25,22,.13);--pr-soft:rgba(23,25,22,.045);--pr-input:rgba(23,25,22,.055);--pr-accent:#20251d;--pr-accent-ink:#fff;--pr-danger:#9e2f22;--pr-ok:#17613a}
  :root:not([data-theme=dark]) .pr-mark .akva{color:#00008c}
}

@media(max-width:760px){
  html[data-akv-auth] #main{padding:0;min-height:100dvh}
  .pr-wrap{display:grid;width:100%;min-height:100dvh;border:0;border-radius:0;overflow:visible;background:#0b0d0c;box-shadow:none}
  .pr-scene{position:fixed;z-index:0;inset:0;border-radius:0;min-height:100dvh}
  .pr-scene-media{position:absolute;inset:-18px}.pr-scene-media img{object-position:42% 50%;transform:translate3d(var(--pr-scene-x),var(--pr-scene-y),0) scale(1.075)}
  .pr-scene::after{background:radial-gradient(circle at var(--pr-glare-x) var(--pr-glare-y),rgba(255,255,255,.1),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.3) 48%,rgba(0,0,0,.58));mix-blend-mode:normal}
  .pr-motion{position:fixed;top:max(18px,env(safe-area-inset-top,0px));right:16px;bottom:auto}
  .pr-card{width:min(82vw,calc(480px * var(--pr-card-reference-scale)));min-height:auto;margin:max(72px,calc(env(safe-area-inset-top,0px) + 58px)) auto 24px;padding:26px 22px;border-radius:27px;background:rgba(10,12,11,.62);transform:translate3d(var(--pr-card-x),var(--pr-card-y),0)}
  .pr-cardtop{margin-bottom:28px}.pr-title{font-size:clamp(29px,9vw,38px)}.pr-sub{margin-bottom:20px}.pr-foot{margin-top:26px}
  :root[data-theme=light] .pr-card,html[data-akv-auth][data-theme=light] .pr-card{background:rgba(249,248,244,.78);border-color:rgba(255,255,255,.62)}
  @media(prefers-color-scheme:light){:root:not([data-theme=dark]) .pr-card{background:rgba(249,248,244,.78);border-color:rgba(255,255,255,.62)}}
}
@media(max-width:380px){.pr-card{width:min(86vw,330px);padding:24px 19px}.pr-notice{padding:10px 11px}.pr-cardtop{margin-bottom:24px}}
@media(max-height:760px) and (max-width:760px){.pr-card{margin-top:68px}.pr-cardtop{margin-bottom:22px}.pr-sub{margin-bottom:16px}.pr-foot{margin-top:22px}}

@media(prefers-reduced-motion:reduce){
  .pr-wrap,.pr-card,.pr-scene-media img,.pr-themeic,.pr-card .btn{transition:none!important;transform:none!important}
  .pr-motion{display:none!important}
}
@media(prefers-reduced-transparency:reduce){.pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}.pr-motion{backdrop-filter:none;-webkit-backdrop-filter:none;background:#141814}}
html[data-transparency=reduced] .pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}
@media(prefers-contrast:more){.pr-card,.pr-input,.pr-notice,.pr-google{border-width:2px!important}.pr-card::before,.pr-scene::after{display:none}.pr-muted{opacity:1}}
@media(forced-colors:active){
  .pr-wrap,.pr-card,.pr-input,.pr-notice,.pr-google,.pr-motion,.pr-who{forced-color-adjust:auto;border:1px solid CanvasText;background:Canvas;color:CanvasText}
  .pr-scene{display:none}.pr-card{width:min(calc(560px * var(--pr-card-reference-scale)),calc(100% - 32px))}.pr-mark .akva,.pr-mark .term,.pr-title,.pr-sub,.pr-noticetext,.pr-noticetext b{color:CanvasText}.pr-card .btn-primary{background:Highlight;color:HighlightText}.pr-motion{display:none!important}
}
`;
