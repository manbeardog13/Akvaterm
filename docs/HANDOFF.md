## Handoff for Claude — 2026-08-04

Use this as the shortest practical transition for the opening/ login flow.

### What was changed

- `js/journey-opening.js`
  - Replaced the existing `ajBackdropIn` opening animation behavior with a new
    `ajBackdropFocus` motion so the background starts sharp and naturally softens
    while the glass form arrives.
  - Added a new particle layer (`.aj-particles` / `.aj-particle`) and
    JS-generated particle host on mount for the login-to-journey entrance effect.
  - Reduced the login glass card footprint and increased translucency:
    `aj-focus` width reduced, height/compression adjusted, and stronger
    backdrop-blur/contrast treatment.
  - Updated animation timing and mobile breakpoints to fit the revised geometry.
  - Kept orientation handoff and existing post-login route behavior intact.
- `tests/journey-opening.test.mjs`
  - Updated assertions to match the new keyframes and structure
    (`ajBackdropFocus`, particle DOM hooks, removed old `ajBackdropIn` checks).
- `docs/HANDOFF.md`
  - Added this continuity handoff entry for Claude.

### Verification done before handoff

- `node --check js/journey-opening.js`
- `node --test tests/journey-opening.test.mjs`
- `node --test tests/atelier-landscape.test.mjs`
- Results: both test suites passed (0 failures), file check passed.

### Branch state

- Working tree modified for journey opening flow only: `js/journey-opening.js`,
  `tests/journey-opening.test.mjs`, and this handoff section.
- Existing untracked workspace files are `.claude-flow/`, `ruvector.db`,
  `supabase/.temp/` (non-product artifacts).

### Next action

- Push this handoff with the two code/test file changes; no known blockers
  remain from this pass.

---`n# HANDOFF â€” next session

## Superseding update â€” 2026-08-04

The operator explicitly replaced this file's older login authority with the
photo set supplied on 2026-08-04. The later â€śLogin: CLOSED / Do not restyle itâ€ť
line below is historical and no longer governs the current surface.

- `#/prijava` now uses the operator-approved local cinematic interior at
  `assets/images/login-interior-cinematic.webp`, with no visible scene copy and
  one compact glass card at a recorded 0.75 reference footprint. Its styling
  lives in `js/login-photo-style.js`; depth geometry lives in `js/login-depth.js`.
- Phone tilt is progressive and permission-gated where required. Reduced motion
  is static; sensor values are neither stored nor transmitted; all listeners
  are removed on teardown.
- The 700 ms login departure now shows a minimal 90-degree phone-turn cue only
  after entry and only on portrait touch phones. It does not lock orientation or
  wait for a sensor. The same non-blocking beat module-preloads the next three
  local journey surfaces; landscape and desktop receive no cue.
- The guided bathroom v0 journey is complete locally: consequential direction,
  all-wall decisions, multi-product equipment composition, persistent placement,
  live grid grout colour/width, masked material reveal, priced proposal and one
  finite completion reward.
- The current work is on `feat/commissioning-journey-v0` and remains
  **uncommitted and unpublished** pending an explicit commit/push decision.
  Preserve the inherited dirty review batch and read
  `docs/specs/cinematic-journey.md` for the section-level evidence.

Written 2026-08-03 at the end of a long session. Read this first, then
`docs/HOUSE_STANDARD.md`.

---

## THE DECISION: consolidate on the 3D room engine

**Operator, 2026-08-03:** *"I don't need the before and later view, and honestly
I'd rather just fix the room 3D engine because it's way smoother and looks a lot
more crisp. I would have the application hardened and not failing on memory,
collapsing."*

So: **`js/room3d.js` is the surviving engine. `js/scene3d.js` and the Dizajner
view are to be retired.** The A/B before/after wipe is **dropped** â€” it was the
only feature unique to the Dizajner and it is explicitly not wanted.

### Why this is correct, with the numbers

The 3D room is a strict superset:

| | Dizajner (`scene3d.js`) | 3D soba (`room3d.js`) |
| --- | --- | --- |
| tileable surfaces | 3 (floor + 2 walls) | **5** (floor + all four walls) |
| room dimensions | fixed per authored scene | **user sets W/D/H** |
| camera | locked, composed | **full orbit + pinch** |
| fixtures | placed by the scene author | **25 types, user adds/moves/removes** |
| pricing + quote | no | **yes** |
| lines of code | 1826 + 2034 (view) | 1141 + 1365 (view) |

Retiring the Dizajner removes **~3860 lines** and, more importantly, removes a
second engine that renders the same catalogue a different way. Every visual fix
today had to be made twice or risk drifting.

### What the Dizajner contributed, and must be carried over

Three things, none of which need `scene3d.js` to survive:

1. **Zero-setup entry.** Five pre-composed rooms in `data/scenes.js`
   (kupaonica, mala-kupaonica, kuhinja, dnevni-boravak, wc). Carry them over as
   **presets** for the 3D room: dimensions + starting fixtures + a saved camera
   angle. "Start from a template" instead of typing three numbers before you see
   anything.
2. **A designed camera angle.** An orbit camera lets a user land on an ugly
   shot. Give each preset a saved starting orientation.
3. *(dropped)* the A/B wipe.

---

## âš  THE BLOCKING BUG â€” âś… CLOSED 2026-08-03, commit `1087608`

**Fixed and verified live.** `js/room3d.js` now has: a rebuildable
`buildEnvironment()`, a `webglcontextlost` handler that calls
`preventDefault()`, a `webglcontextrestored` handler that rebuilds the
environment and draws synchronously, `retainPrototypes()` moved below the
renderer constructor, and a teardown that removes both listeners,
null-guards the env disposal, drops the stale `disposeObject(scene, true)`
argument and surrenders the context with `forceContextLoss()`.

Verified by losing and restoring the real context on a mounted `#/soba3d`:
mean frame luminance 213.7 â†’ 213.7, **0 of 6912** sampled pixels changed
(broken scene3d had measured 206.2 â†’ 141.4 with 34384 of 38376 changed).
Teardown after the restore ran clean. One deliberate divergence from
scene3d: no `markShadowsDirty()` is needed â€” room3d leaves
`shadow.autoUpdate` at its default so the depth pass re-rasterises every
frame; **if damage-driven shadows are ported during consolidation, re-arm
them in the restore handler too** (the comment in the code says the same).

The original description follows, kept for the mechanism write-up.

**`js/room3d.js` did not have the context-loss protection that
`js/scene3d.js` got on 2026-08-03.** Verified by grep at the time:

```
webglcontextrestored | rebuildEnvironment | markShadowsDirty
  js/room3d.js   0 occurrences
  js/scene3d.js  11 occurrences
```

This is the ORIGINAL bug the operator reported â€” *"the improved look of the
bathtub and cabinets goes back to the very plain one"* â€” and the 3D room is
**more** exposed than the Dizajner was, because it holds a live WebGL context
while the user browses saved designs.

### The mechanism (diagnosed and measured today, not theorised)

Two GPU resources are **rendered**, not uploaded, so three.js cannot restore
them after a context loss â€” there is no CPU-side source to re-upload from:

1. **The PMREM environment map.** `PMREMGenerator.fromScene()` renders into a
   `WebGLRenderTarget`. Once the allocation is gone the texture samples as
   nothing. The tuned materials in `js/gfx3d.js` `MATERIAL_TUNING` set chrome to
   metalness 1 and glazed ceramics to roughness 0.1 â€” **a metal has no diffuse
   term**, so with no environment it returns almost nothing and every polished
   surface collapses to flat matte.
   *Measured: mean frame luminance 206.2 â†’ 141.4, 34384 of 38376 pixels changed
   â€” identical to forcing `environmentIntensity` to 0.*

2. **The sun's one-shot shadow depth map.** `shadow.autoUpdate = false` with a
   single `needsUpdate = true` means the depth pass runs once and is assumed
   valid forever. r185 carries the *global* shadow-map flags across a restore
   but not the *per-light* one, so the guard skips the depth pass from then on,
   permanently.
   *Measured: 206.2 â†’ 184.3, 19721 pixels changed, never recovers, restored
   exactly by re-setting `needsUpdate`.*

### The fix, as applied to scene3d.js â€” port it

- Wrap the PMREM build in a `buildEnvironment()` that disposes the old target
  and generator and rebuilds both, and expose it on the stage handle.
- Re-arm the depth pass wherever the drawing buffer may have been reallocated:
  a `webglcontextrestored` listener, `resize()`, and before any snapshot.
- three's own restore listener is registered when the renderer is constructed,
  so it runs **before** yours â€” which is what makes rebuilding there safe.

See `js/scene3d.js`, the `buildEnvironment()` block and the `onContextRestored`
handler, for the exact shape.

---

## MEMORY HARDENING â€” the operator's second ask

*"I would have the application hardened and not failing on memory, collapsing."*

Known pressure points, all verified in the tree today:

- **Three `new THREE.WebGLRenderer` call sites** across `js/`. Browsers cap live
  WebGL contexts at roughly 16; a session that browses saved designs while a
  scene is mounted works near that limit, and **a dropped context is the browser
  doing its job**, not an exotic failure. This is why the fix above is not
  optional.
- **`js/room3d.js:1130` calls `disposeObject(scene, true)`** â€” the old `force`
  argument. `js/gfx3d.js` no longer accepts it (the parameter was removed today
  precisely because forcing frees geometry the refcounted prototype cache still
  hands to other live consumers â€” a use-after-free that never throws, because
  three silently re-uploads from the JS-side arrays). The extra argument is now
  ignored, so this is currently harmless â€” **but delete it** so nobody restores
  the behaviour.
- **Prototype cache refcounting.** `retainPrototypes()` / `releasePrototypes()`
  in `js/gfx3d.js`. `scene3d.js` was fixed today to retain only *after* the
  renderer constructor succeeds â€” on a device without WebGL the constructor
  throws and an earlier retain could never be matched, pinning the cache for the
  session. **Check `room3d.js` for the same ordering.**
- **Thumbnail rendering** surrenders its context explicitly. Keep that.

Suggested additions: a `webglcontextlost` handler that calls
`preventDefault()` (without it the context is never restorable), and an explicit
`renderer.dispose()` + `forceContextLoss()` on teardown.

---

## STATE OF THE APP â€” what is done

All committed and pushed to `github.com/manbeardog13/Akvaterm`, `main`.

- **Login: CLOSED.** Matches ASC metric for metric. Spec in
  `docs/HOUSE_STANDARD.md`; copy-pasteable template in
  `docs/templates/login.html`. **Do not restyle it.**
- **Google sign-in** works end to end (PKCE, verified against the live project).
  Sign-up and password reset are real Supabase calls, not stubs.
- **Dark mode** is ASC's palette, contrast computed for every tier.
- **Left drawer** replaces the bottom tab bar; account row with sign-out.
- **Terma** is the top-right button (was "..."), opens a themed dropdown.
- **Post-login transition** wired and verified (zero stranded overlays).
- **Adversarial review** ran: 20 findings â†’ 18 confirmed â†’ fixed.
- **Reduce-transparency** removed entirely, per instruction. Accessibility cost
  recorded in the commit.

## STATE OF THE APP â€” what is open

1. ~~The `room3d.js` context-loss fix.~~ **Done, commit `1087608`.** See above.
2. **Consolidation** onto the 3D room; retire `scene3d.js` + `dizajner.js`.
   Now the top item.
3. **The dashboard/catalogue redesign.** A four-direction design panel produced
   a full spec; only its contrast fixes and missing i18n keys were applied. The
   larger proposals â€” a new `ploca.js` dashboard, a site-wide palette migration,
   a type-scale inversion â€” were deliberately NOT applied because each rewrites
   `css/styles.css` or adds a view.
   **The spec is saved in the repo: `docs/specs/dashboard-design-panel.md`**
   (~123 KB, four agents: the brief plus three design directions). It is raw
   panel output, not an edited spec â€” read it for the concrete directives and
   ignore the deliberation.
4. **Terma has no Gemini key.** She says plainly that she is not switched on.
   Chat is free tier; the photo-analysis model (`gemini-3.1-flash-image`) has
   **no free tier** and would need billing â€” left off deliberately.
5. **The full sign-in choreography** reports `flew:false` on the auth route
   (the top bar is hidden, so there is no destination mark to fly to). It
   degrades correctly; the full version is unseen.
6. **Google OAuth** needs the home-screen icon removed and re-added for the
   `black-translucent` status-bar change to take effect â€” iOS caches those meta
   values at install time.

---

## THE RULES THAT COST THE MOST TODAY

Read these before touching anything visual. Each was learned the expensive way.

1. **NO GUESSWORK.** Reading a value out of a source file and retyping it is
   **not** measurement, and it feels like diligence while being wrong.
   - `.auth-logo` declared `max-width:74%`; it rendered at **46.4%**.
   - `.btn-amber` declared `text-transform:uppercase`; the app rendered
     sentence case.
   - A local render showed a card at 93.6% of viewport; the device showed 81%.
2. **COPY THE RULES, DO NOT RETYPE VALUES.** Everything not consciously
   retyped vanishes silently. The logo glow, the button glow, the theme
   cross-fade and the dark-mode control colours were never decided against â€”
   they simply never crossed over, and each came back as a bug report.
3. **CONFIRM WHICH FILE DEFINES IT.** ASC's card rules are inline in its
   `app/login.html`, not in `css/styles.css`. Six rounds of "reading ASC's
   stylesheet" were reading a file that did not contain the card.
4. **RESOLVE TOKENS, DO NOT READ THEM.** Both repos define `--shadow-card`;
   Akvaterm's is a warm brown that does nothing on a near-black page.
5. **THE DEVICE BEATS THE LOCAL RENDER.** Where they disagree, ask for a
   screenshot and measure that.
6. **`node --check` DOES NOT CATCH THE BACKTICK BUG.** Many CSS blocks live
   inside JS template literals; one backtick terminates the string and the file
   still parses. Always also count backticks and confirm the count is **even**.
7. **DO NOT WRITE CLEVER SCRIPTS OVER THESE FILES.** A brace-walking script to
   strip CSS rules gutted eleven files in one command (it could not tell a CSS
   block from an object literal). Reverted with `git checkout`. Edit by hand,
   per file.

## Verification commands

```bash
cd C:/NERO/workspaces/Akvaterm
for f in js/*.js js/views/*.js service-worker.js; do node --check "$f" || echo "BROKEN $f"; done
for f in js/*.js js/views/*.js; do n=$(grep -o '`' "$f" | wc -l); [ $((n % 2)) -ne 0 ] && echo "ODD BACKTICKS $f"; done
python scripts/csp_hashes.py
```


