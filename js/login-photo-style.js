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
  --pr-dark-photo-opacity:1;--pr-light-photo-opacity:0;
  --pr-card-light-reflection:0;
  --pr-card-reference-width:412px;
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
.pr-scene-media{
  position:absolute;inset:0;display:block;overflow:hidden;
  transform-origin:50% 50%;animation:prSceneClockwiseSettle 96s cubic-bezier(.16,.62,.18,1) both;
}
.pr-scene-media img{
  position:absolute;inset:0;width:100%;height:100%;display:block;
  object-fit:cover;object-position:50% 50%;transform:scale(1.025);
  transform-origin:50% 50%;filter:none;
  transition:opacity 1100ms cubic-bezier(.22,1,.36,1);
}
.pr-scene-dark{opacity:var(--pr-dark-photo-opacity)}
.pr-scene-light{opacity:var(--pr-light-photo-opacity)}
.pr-scene::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.22) 48%,rgba(0,0,0,.48));
}
@keyframes prSceneClockwiseSettle{from{transform:rotate(0deg)}to{transform:rotate(1.35deg)}}

/* HOUSE_STANDARD.md defines a 412px canonical card and records 327px at
   375x812 once its 24px page gutters are paid. Typography, controls and hit
   targets never scale; compactness comes from the sheet's vertical rhythm. */
.pr-card{
  position:relative;z-index:3;isolation:isolate;display:flex;flex-direction:column;justify-content:center;
  width:min(var(--pr-card-reference-width),calc(100% - 48px));min-width:0;margin:44px auto;padding:28px 24px 22px;
  color:var(--pr-text);
  background:
    linear-gradient(138deg,rgba(255,255,255,.105),rgba(191,229,197,.035) 34%,rgba(5,10,8,.17) 72%) padding-box,
    linear-gradient(145deg,rgba(255,255,255,.56),rgba(184,231,203,.17) 27%,rgba(255,222,172,.26) 72%,rgba(255,255,255,.12)) border-box;
  border:1px solid transparent;border-radius:30px;
  box-shadow:0 48px 120px -34px rgba(0,0,0,.76),0 18px 42px -30px rgba(163,225,190,.46),
    inset 0 1px 0 rgba(255,255,255,.24),inset 0 -1px 0 rgba(132,176,150,.10);
  backdrop-filter:blur(11px) saturate(1.34) contrast(1.045) brightness(.96);
  -webkit-backdrop-filter:blur(11px) saturate(1.34) contrast(1.045) brightness(.96);overflow:hidden;
}
.pr-card::before{
  content:"";position:absolute;z-index:0;inset:1px;pointer-events:none;border-radius:29px;
  background:linear-gradient(180deg,rgba(255,255,255,.075),transparent 16%,transparent 82%,rgba(155,207,174,.035));
  box-shadow:inset 1px 0 rgba(203,243,220,.11),inset -1px 0 rgba(255,218,163,.065),
    inset 0 16px 28px -28px rgba(255,255,255,.54),inset 0 -18px 30px -30px rgba(105,177,139,.28);
}
.pr-card::after{
  content:"";position:absolute;z-index:0;inset:2px;pointer-events:none;border-radius:28px;
  border-top:1px solid rgba(255,224,181,.30);border-right:1px solid rgba(255,211,153,.14);
  box-shadow:inset 0 13px 24px -24px rgba(255,221,174,.66),inset -14px 0 26px -28px rgba(255,202,128,.42);
  opacity:var(--pr-card-light-reflection);transition:opacity 1100ms cubic-bezier(.22,1,.36,1);
}
.pr-card>*{position:relative;z-index:1}
.pr-cardtop{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}
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
.pr-field{margin-bottom:11px}.pr-input{position:relative;display:flex;align-items:center;min-height:52px;border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-input);transition:border-color 160ms ease,background 160ms ease}
.pr-input:focus-within{border-color:rgba(215,226,186,.72);background:rgba(255,255,255,.1);box-shadow:0 0 0 3px rgba(215,226,186,.09)}
.pr-ic{display:flex;margin-left:16px;color:var(--pr-muted)}
.pr-input input{width:100%;min-width:0;padding:0 14px;border:0;outline:0;background:transparent;color:var(--pr-text);font:500 15px/1 var(--font-text)}
.pr-input input::placeholder{color:var(--pr-muted);opacity:1}.pr-eye{display:grid;place-items:center;min-width:44px;min-height:44px;margin-right:3px;padding:0;border:0;background:transparent;color:var(--pr-muted);cursor:pointer}.pr-eye:focus-visible{outline:2px solid var(--pr-accent);outline-offset:-4px;border-radius:11px}
.pr-err{display:block;min-height:0;margin:4px 3px 0;color:var(--pr-danger);font-size:11.5px;line-height:1.35}.pr-err:not(:empty){min-height:16px}.pr-field.is-bad .pr-input{border-color:var(--pr-danger)}
.pr-rowend{display:flex;justify-content:flex-end;margin:-2px 2px 10px}.pr-forgot,.pr-footlink{min-height:44px;padding:0;border:0;background:none;color:var(--pr-muted);font:600 12px/1 var(--font-text);cursor:pointer}.pr-footlink{display:inline-flex;align-items:center;vertical-align:middle;color:var(--pr-accent);margin-left:5px}.pr-forgot:hover,.pr-footlink:hover{color:var(--pr-text)}.pr-forgot:focus-visible,.pr-footlink:focus-visible{outline:2px solid var(--pr-accent);outline-offset:2px;border-radius:5px}
.pr-card .btn{min-height:52px;border-radius:14px;font-size:13px;font-weight:700;letter-spacing:.01em;box-shadow:none}.pr-card .btn-primary{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid rgba(255,255,255,.32);background:var(--pr-accent);color:var(--pr-accent-ink);box-shadow:0 14px 34px -18px rgba(215,226,186,.72)}
.pr-card .btn-primary:hover{filter:brightness(1.04);transform:translateY(-1px)}.pr-card .btn:focus-visible{outline:2px solid var(--pr-accent);outline-offset:3px}.pr-card .btn:disabled{cursor:not-allowed;filter:none;transform:none;box-shadow:none}
.pr-google{position:relative;display:grid!important;grid-template-columns:28px 1fr 28px;align-items:center;width:100%;border:1px solid var(--pr-line)!important;background:var(--pr-soft)!important;color:var(--pr-text)!important}.pr-google>svg{justify-self:center}.pr-glabel{justify-self:center}.pr-google.is-busy .pr-glabel{opacity:.55}
.pr-div{display:flex;align-items:center;gap:12px;margin:16px 0;color:var(--pr-muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em}.pr-div::before,.pr-div::after{content:"";height:1px;flex:1;background:var(--pr-line)}
.pr-msg{min-height:0;margin:6px 0 0;color:var(--pr-muted);font-size:12px;line-height:1.4;text-align:center}.pr-msg:not(:empty){min-height:17px}.pr-msg.is-err{color:var(--pr-danger)}.pr-msg.is-ok{color:var(--pr-ok)}
.pr-guest{margin-top:16px}.pr-guesthint{margin:9px 0 0;color:var(--pr-muted);font-size:11.5px;line-height:1.45;text-align:center}
.pr-foot{margin:32px 0 0;text-align:center;color:var(--pr-muted);font-size:12px}.pr-note{margin:16px 0 0;color:var(--pr-muted);font-size:12px;line-height:1.45;text-align:center}
.pr-who{display:flex;align-items:center;gap:13px;margin:24px 0;padding:14px;border:1px solid var(--pr-line);border-radius:14px;background:var(--pr-soft)}.pr-avatar{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:50%;background:var(--pr-accent);color:var(--pr-accent-ink);font-weight:800}.pr-whotext{min-width:0}.pr-whotext b,.pr-whotext span{display:block}.pr-whotext b{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--pr-muted)}.pr-whotext span{margin-top:3px;color:var(--pr-text);font-size:13px;overflow-wrap:anywhere}.pr-stack{display:flex;flex-direction:column;gap:10px}
/* Theme changes the photographic state, never the glass sheet. Both files are
   full 4K renders of the same room; no CSS exposure trick is used. */
html[data-akv-auth][data-theme=light]{
  --pr-dark-photo-opacity:0;--pr-light-photo-opacity:1;
  --pr-card-light-reflection:1;
}
@media(prefers-color-scheme:light){
  html[data-akv-auth]:not([data-theme=dark]){--pr-dark-photo-opacity:0;--pr-light-photo-opacity:1;--pr-card-light-reflection:1}
}

@media(max-width:760px){
  html[data-akv-auth] #main{padding:0;min-height:100dvh}
  .pr-wrap{display:grid;width:100%;min-height:100dvh;padding:max(72px,calc(env(safe-area-inset-top,0px) + 56px)) 24px max(72px,calc(env(safe-area-inset-bottom,0px) + 56px));border:0;border-radius:0;overflow:visible;background:#0b0d0c;box-shadow:none}
  .pr-scene{position:fixed;z-index:0;inset:0;border-radius:0;min-height:100dvh}
  .pr-scene-media{position:absolute;inset:0}.pr-scene-media img{object-position:50% 50%;transform:scale(1.055)}
  .pr-scene::after{background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.3) 48%,rgba(0,0,0,.58))}
  .pr-card{width:min(var(--pr-card-reference-width),100%);min-height:auto;margin:auto}
  .pr-title{font-size:clamp(29px,9vw,38px)}.pr-sub{margin-bottom:20px}.pr-foot{margin-top:26px}
}
@media(max-width:380px){.pr-notice{padding:10px 11px}.pr-cardtop{margin-bottom:24px}}
@media(max-height:760px) and (max-width:760px){.pr-card{margin-top:68px}.pr-cardtop{margin-bottom:22px}.pr-sub{margin-bottom:16px}.pr-foot{margin-top:22px}}

@media(prefers-reduced-motion:reduce){
  .pr-wrap,.pr-card,.pr-scene-media,.pr-scene-media img,.pr-themeic,.pr-card .btn,.pr-card::after{transition:none!important;transform:none!important;animation:none!important}
}
@media(prefers-reduced-transparency:reduce){html:not([data-transparency=full]) .pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}}
html[data-transparency=reduced] .pr-card{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--pr-panel)}
@media(prefers-contrast:more){.pr-card,.pr-input,.pr-notice,.pr-google{border-width:2px!important}.pr-card::before,.pr-card::after,.pr-scene::after{display:none}.pr-muted{opacity:1}}
@media(forced-colors:active){
  .pr-wrap,.pr-card,.pr-input,.pr-notice,.pr-google,.pr-who{forced-color-adjust:auto;border:1px solid CanvasText;background:Canvas;color:CanvasText}
  .pr-scene{display:none}.pr-card{width:min(var(--pr-card-reference-width),calc(100% - 32px))}.pr-mark .akva,.pr-mark .term,.pr-title,.pr-sub,.pr-noticetext,.pr-noticetext b{color:CanvasText}.pr-card .btn-primary{background:Highlight;color:HighlightText}
}
`;
