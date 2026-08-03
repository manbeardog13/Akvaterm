# The cinematic guided journey — motion, coverage, and glass edges

Status: **in progress.** Operator direction, 2026-08-03. This file is the
binding record of the decisions; the code referenced is at various stages of
completion and each section says which.

The target is not a functional 3D configurator. It is an uninterrupted,
spatially directed design film that the customer quietly controls.

---

## 1. The motion system — BUILT, NOT YET VISUALLY VERIFIED

`js/director3d.js`. The journey declares **intent** (`focusSurface('wallN')`),
never a transform. No bespoke camera animation belongs in a question handler.

Verbs: `focusSurface`, `focusObject`, `inspectMaterial`, `followGroutLine`,
`orbitSelection`, `returnToOverview`, `settleIntoDrift`, plus `yieldToUser`.
Exposed on the room handle as `handle.camera.*`.

### Why springs, not tweens

A timed tween bakes in a start pose, so interrupting it can only snap to a new
start or finish the old move first. The brief forbids both. A **critically
damped spring** has no start pose: it knows position, velocity, and goal.
Retarget mid-flight and both position and velocity carry through — interruption
is free because there is no timeline to interrupt.

It also produces the required curve for physical reasons rather than by taste:
decisive while the error is large, asymptotically slower as it closes, never
linear, no overshoot, no hard arrival. Critical damping specifically — under-
damped wobbles (reads as cheap), over-damped crawls.

The integrator is the stable implicit form (Game Programming Gems 4). It is
unconditionally stable at any frame rate, which matters: a dropped frame on a
phone must not fling the camera.

### Why the camera never stops

The spring converges asymptotically but "converged" still reads as frozen. So
the **target itself never stops**: a low-amplitude wander is added to every
target, on irrational-ratio periods so the sum never repeats within a session.
A looping drift is worse than none — the eye finds the period in two cycles and
the room becomes a screensaver.

### The cost this imposes

`js/room3d.js` is **damage-driven** — it draws on change, not on a rAF
treadmill. A living camera suspends that contract. `startCinematic()` /
`stopCinematic()` bracket the only period where a continuous loop runs, and it
stops on `visibilitychange`: a background tab must not hold the GPU awake, in a
codebase that already runs near the browser's live-context ceiling (see the
context-loss guards in `room3d.js`).

While directing, `controls.update()` is **not** called — OrbitControls
re-derives `camera.position` from its own spherical state and would overwrite
the director every frame. The look-at is applied directly instead.

### Outstanding

**The rendered movement has not been judged.** `requestAnimationFrame` is paused
while the automation browser pane is hidden, so every sample read speed 0. The
code mounts clean with zero console errors; that is all that is currently
established. Per operator rule: reading a value out of a source file is not
measurement. **This must be watched running before it is called done.**

---

## 2. THE COVERAGE RULE — binding

**Operator, 2026-08-03:** *"the screen must always be covered, and there must
never be an edge shown... no edges of the walls or anything like that must be
ever shown. If there's a window there must always be something on the other
side, like beautiful nature on a sunny day."*

This is an at-all-times invariant, not a nice-to-have.

### What it breaks today

1. **`updateWallVisibility()` hides walls by camera azimuth** so the room reads
   open. That *guarantees* exposed edges and empty background while orbiting.
   The feature and the rule cannot both survive.
2. **There is no ceiling.** `SURFACE_IDS` is floor + four walls. Look up, see
   void.

---

## 3. Glass edges — the operator's solution, ADOPTED

**Operator, 2026-08-03:** rather than cutting a wall away, the surfaces that
would reveal an edge become **transparent glassy surfaces** that continue past
the camera's field of view. Surfaces connecting into them are **softened** —
flowing into the glass, then fading out, so only the glass remains. On the very
edges the glass **blurs out of existence**, with focus held at the centre of
frame on desktop.

This is not a new invention: `docs/DESIGN_SYSTEM.md` already defines Iris
**liquid glass** with five degradation paths. This extends that material
language from the interface into the room, which is why it will feel of a piece
rather than bolted on.

### Why it is better than an interior-only camera

An interior-only camera would satisfy the rule by imprisoning the camera, which
costs every wide establishing shot and every orbit. Glass satisfies the rule by
removing the *concept* of an edge instead: there is nothing to hide, so nothing
can be caught being hidden.

### Implementation shape

- Near walls swap opacity, not visibility: an opaque tiled material blends to a
  glass state as the camera crosses behind them. Continuous, so there is never
  a frame where a wall pops.
- The junction where glass meets solid gets an alpha ramp in the shader, driven
  by world position, so the seam dissolves rather than terminating.
- The outer boundary of a glass surface fades to zero, revealing `scene.background`
  (`IRIS.paper`), which is a deliberate, calm ground rather than a void.
- Centre-focus / edge blur is a screen-space pass, not per-object blur.

### Two real risks, to be measured not assumed

1. **Transparency sorting.** Alpha-blended surfaces in three.js render in a
   sorted pass and can occlude each other wrongly, especially two glass walls
   seen through one another. Mitigations in order of preference: keep glass
   surfaces non-overlapping from any legal camera pose; `depthWrite: false` with
   explicit `renderOrder`; only then consider transmission.
2. **Mobile cost.** `MeshPhysicalMaterial.transmission` allocates a transmission
   render target and is expensive on phones. Start with `transparent` + opacity
   + environment sheen, which buys most of the look for a fraction of the cost.
   Treat true transmission and the screen-space blur pass as **desktop
   upgrades**, gated on measured frame pacing — the brief demands buttery
   smoothness on a high-refresh OLED, and an effect that demos well but stutters
   in the journey has failed.

---

## 4. Grout must animate continuously — requires a shader

Grout is currently baked into a `CanvasTexture` by `buildPatternCell`. Animating
its width would mean regenerating that canvas every frame, which is not viable.

Grout therefore moves into the fragment shader as **uniforms**: keep the
procedural tile-face texture as the base, draw the grout lines over it in GLSL
from UV maths. Width and colour then animate continuously and interruptibly,
which is what the brief requires and what makes it feel like inspecting a
material rather than editing a number.

---

## 5. Photorealism — assets, not an engine

The operator asked what it would take to build a bespoke engine. Recorded answer:
**do not.** Writing a rasteriser is not the hard part; matching what three.js has
already solved is — glTF loading, the PBR material model, image-based lighting,
shadow maps, colour management, culling, mobile GPU quirks, context loss. Months
of work to land somewhere worse, and WebGPU would then have to be chased too.

Photorealism is not an engine feature. Surfaces read synthetic because they are
procedurally drawn canvases with **no normal, roughness or ambient-occlusion
maps**, lit by a synthetic room probe. The lever is a CC0 PBR texture set plus a
real HDRI environment — Poly Haven and ambientCG are public domain and creditable
through the existing `vendor/models/PROVENANCE.md` pattern. Same renderer,
convincing material response, days rather than months. It also solves the window
backdrop the coverage rule demands.

**Open decision for the operator:** this revises the recorded architectural
decision that the app ships procedural textures and *no photographic assets*
(`docs/ARCHITECTURE.md`), and it adds megabytes to a PWA that currently vendors
everything for offline use. Weight and the offline story are the real cost.

---

## 6. Build order

Per operator instruction, prove the motion grammar on **one** sequence in the
compact bathroom before composing all five presets: overview → travel to north
wall → shallow-angle tile inspection → slow orbit on one representative tile →
dissolve between tile materials → travel along a grout line → animated grout
width and colour → return to the room, with subtle drift throughout.

Only once that reads correctly on screen do the five curated presets get built
against it.

Unreal remains possible but is not indicated: everything specified is reachable
in three.js. Migration would cost the PWA (hundreds of megabytes, pixel
streaming or a native install), mobile, and the no-build-step constitution.
Recommend it only if a focused prototype in the current renderer demonstrably
cannot reach the required quality.

---

## 8. The guided view — BUILT and rendering (js/views/atelier.js, js/journey.js)

The commissioning journey now has a screen. js/journey.js (definition plus
state machine, no DOM, no three.js — provable in plain Node) drives
js/views/atelier.js, an ADDITIVE route at #/atelier mounted over the same
room3d.js engine /soba3d uses. /soba3d is untouched.

Verified live, after diagnosing a browser module-cache false alarm (a hash
change alone does not refetch the module graph in this harness — a genuine
location.reload() is required after every edit, or stale JS silently keeps
running and looks like a regression that isn't one): the room mounts, all six
chapters render, product selection updates the live room via
api.setSurface(), the chapter rail supports free navigation with no
destructive confirm dialog, and the revision contract (journey.js's core
promise — nothing is ever deleted, only marked stale) was exercised end to end
in the browser, not just in the 17 Node tests.

### The camera never freezes at rest — idle-return

Operator, 2026-08-03: free look is real, but the room's native resting
state is always whatever the guide is currently asking about. Implemented as
a grace period, not a snap: room3d.js's armIdleReturn() waits 1.8 s
(0 s under reduced motion, where the spring itself is already capped at
under 0.45 s) after the customer releases the camera, then calls a
caller-supplied onIdleReturn — atelier.js supplies
() => directCamera(journey.current().chapter), so the return travels on the
exact same spring-eased verb as the original move, never a teleport. A
re-grab during the grace period cancels the pending return unconditionally, so
a second look-around stroke is never yanked back mid-gesture. Without a
caller-supplied callback (/soba3d, which has no "step" to return to) it falls
back to the original settleIntoDrift() behaviour, unchanged.

### The ambient showcase — "Panorama"

Operator, 2026-08-03: an opt-in amenity — a small loop of a few slow,
panning establishing angles. Implemented as director3d.playTour()/stopTour():
poses generated from the room's own dimensions (no per-preset authoring),
azimuths deliberately off the room's axes (dead-on to a wall is the least
interesting frame a wide shot can hold), held until arrival plus a hold timer,
looping until interrupted by a grab, a chapter change, or the toggle itself.

Naming, per operator instruction ("every feature is named in a premium
vocabulary — no button named 'play tour'"): the user-facing label is
"Panorama" — one word, no verb, no utilitarian control language. Internal
engine method names (playTour/stopTour) are professional identifiers never
shown to a customer, so they are unaffected. A regression test
(tests/motion.test.mjs, "the guide never uses utilitarian control
vocabulary") pins the markup against this.

A real bug found and fixed while wiring this: goto() — the function every
normal camera verb funnels through — called cancel("superseded"), which
resolves the promise of whatever was active, but never cleared the
orbit/tour state variables themselves. A running tour, then a chapter
change, would have its promise correctly cancelled while update()'s
standing-state branch kept silently overwriting the fresh position on every
subsequent frame — the new move would believe it had won and be fought anyway.
Fixed by having goto() clear both; covered by a dedicated test.

Also fixed in the same pass: orbitSelection()/followGroutLine() used to
return a freestanding result object never linked to activeMove, so its
.done promise would hang forever — nothing ever called ._finish on it,
because cancel() only ever touches activeMove. Both now assign their
result to activeMove, so a later verb's cancel("superseded") correctly
resolves them as cancelled.

### No native window.confirm() — a design-language finding, not just a copy fix

The chapter-rail revision handler used to gate a jump behind
window.confirm(). Removed entirely, for two independent reasons: (1) it
renders as raw OS chrome inside a glass interface — no amount of copy fixes
that; (2) it misrepresents what is about to happen — this system never
destroys a decision, only outdates it, so a dialog implying irreversible harm
ahead is dishonest. The chapter jump is now immediate; affectedBy()'s report
surfaces in place as the stale banner once the customer is actually looking at
the affected chapter — a fact stated where it is true, not a warning issued in
advance of a harm that never occurs.

### Motion is differentiated per control, not copy-pasted

Operator, 2026-08-03: "I don't want the same animation everywhere."
Every interactive control's hover/press motion was chosen from what the
control means, built from the house's own --spring/--smooth tokens
(bridged, never reinvented) so the set still reads as one system:

- Option cards (a choice being weighed against others) — lift plus a soft
  teal bloom, like picking a card up to look at it.
- Back — recedes; a quiet opacity fade, no lift, no press-scale at all —
  the quietest control on the panel, matching its "go backward" semantic.
- Next / Zatrazi ponudu — propels; a small forward nudge on hover plus a
  warm teal bloom that deepens, echoing the glass rim-glow language already in
  css/styles.css.
- Chapter chips (waypoints on a path) — horizontal motion only, never the
  option cards' vertical lift.
- Panorama — atmospheric, not mechanical: a soft amber glow that breathes
  in on hover and settles into a steady halo while active, no transform at
  all — a light dimming up, not a switch clicking.

Reduced motion strips every transform (a hover lift is still motion) while
leaving colour/shadow state changes instant, which reads as a clean state
swap rather than "the animation was removed."

### Button-count audit (operator: "the exact amount... not everything everywhere")

Counted live in the browser on a representative chapter: 8 product cards
(real catalogue content, not chrome — this IS the primary content), 2 nav
buttons (irreducible), 6 chapter chips (one per real chapter, irreducible),
1 Panorama toggle (explicitly requested). Nothing decorative — no icon
toolbar, no settings affordance nobody asked for.

### Typography — inherited, not invented

.atl-question is a real h2, so it picks up --font-display from
css/styles.css's bare h1,h2,h3 rule for free; the rest of the panel
inherits --font-text from body. No new font was introduced — "premium
fonts" here meant using the house Sora/Inter pairing correctly via semantic
HTML and inheritance, not adding a third face.

### Still open in this view

- No route in NAV/the tab bar — deliberate. .tabbar is grid-auto-columns:1fr
  with a corner-clearance geometry hand-measured in-browser for its current
  five columns (four NAV entries plus "Vise" — see .tabbar__surface's own
  comment in css/styles.css). A sixth column changes that measurement and this
  session could not re-verify it visually. #/atelier is fully reachable by
  URL; wiring a nav entry (or a promotional entry point from /katalog) is a
  follow-up requiring a visual pass.
- Grout-width/colour animation (section 4 above) is not wired into this view
  yet — the grout chapter currently swaps applySurface() products the same
  way /soba3d does, which is a real texture swap, not yet the continuous
  shader-driven animation the original brief specifies. See section 10.
- The summary/estimate screen is functional but not yet the "generous payoff"
  moment the operator described ("minimal means, maximal result" — chrome
  stays quiet, the outcome should feel generous). Worth a dedicated pass.

---

## 9. Material dissolve — researched, verified against r185, NOT implemented

Deep research (community repos, forums, license-checked) produced a complete,
license-clean, zero-dependency implementation plan, verified by compiling
against this repo's actual vendored r185 build (not assumed from docs).

Recommended shape: plain onBeforeCompile on MeshStandardMaterial, ONE
shared compiled program (customProgramCacheKey pinned to a constant string —
critical: the cache key defaults to onBeforeCompile.toString(), so baking any
JS value into the injected GLSL text causes cross-material cache collisions;
everything must be a uniform), four verified-unique single-line anchor
replaces in the r185 fragment shader:
diffuseColor *= sampledDiffuseColor; (albedo), roughnessFactor *= texelRoughness.g;,
metalnessFactor *= texelMetalness.b;, mapN.xy *= normalScale; (normal,
tangent-space, blended before three's own tbn transform is applied).

The anti-snap wipe formula — three.js's own MIT RenderTransitionPass.js
remap — is the one that matters:
r = uMix*(1+uEdge*2) - uEdge; mask = clamp((r-noise)/uEdge, 0, 1). This is
provably 0 at uMix=0 and 1 at uMix=1 for any noise value in [0,1]; a naive
smoothstep(n-e, n+e, progress) does not have that property and produces the
exact residual-speckle-then-snap artefact the operator's brief forbids.

Never let a texture slot go null. HAS_MAP = !!material.map feeds the
defines, which feeds the program cache key — swapping a slot to null
forces a full recompile mid-interaction (a real stall). Pre-populate every
slot with a 1x1 placeholder texture and never null one out.

Interruption (a new selection arriving mid-blend): two free special cases
cover the common ones — reversing to the fade-out material just retargets
uMix toward 0; re-selecting the current target is a no-op. A third material
during an active blend needs either a bake-to-render-target (exact, costs 3
quad draws, requires the mask be evaluated in an unwrapped, non-tiling UV
channel so a UV-space bake is valid) or a bounded N-slot weight stack (no RT,
but a fixed MAX_LAYERS define chosen once at build time). No existing repo
or forum thread solves this cleanly — it is genuinely open design.

Noise source: stegu/webgl-noise (MIT) snoise(vec3), about 60 lines,
self-contained. Do not use unlicensed Shadertoy dissolve shaders —
Shadertoy's default licence is CC BY-NC-SA (non-commercial), disqualifying for
a client-facing product; only copy a shader whose file carries its own
explicit permissive header.

Rejected: Fyrestar/THREE.extendMaterial (GPL-3.0 — copyleft,
disqualifying); the Codrops dissolve tutorial repo (no LICENSE file = all
rights reserved, and it needs Vite/TypeScript = a build step); TSL/NodeMaterial
(not in the vendored build — would mean vendoring a 2.17 MB second renderer
build and migrating off WebGLRenderer, a renderer migration disguised as a
feature); three-custom-shader-material (genuinely vendorable MIT, single
17 KB prebuilt file, verified compatible — but unnecessary for four anchors;
reconsider only if the material model grows to clearcoat/transmission).

A worked, compiled reference implementation was written and verified during
research (0 shader errors against this repo's actual r185 build) but is NOT
in the tree — it lives only in the research session's scratch output and
would need to be written into js/materials/ fresh, following this section's
shape, as its own reviewed change.

---

## 10. Animatable grout via GLSL — researched, verified against r185 WITH MEASUREMENTS

Deep research produced a filtering-quality comparison compiled and rendered
against this repo's actual vendored engine — not assumed, measured.

The measured case for analytic filtering over any texture-bake approach
(40 m floor, 15 cm tiles, 6 mm grout, grazing camera, far-field shimmer
between two camera positions 11 mm/23 mm apart):

| approach | far-field variance | shimmer at 11mm | shimmer at 23mm |
|---|---|---|---|
| naive step() | 27.67 | 6.88 | 15.08 |
| fwidth() + smoothstep | 23.17 | 22.36 | 36.88 |
| analytic box filter, fade-to-mean | 6.25 | 0.49 | 2.03 |

The counter-intuitive finding: fwidth()-based antialiasing measured worse
than no antialiasing at all, because fwidth(min(bd.x, bd.y)) — filtering
the minimum of two per-axis distances — has a discontinuous derivative along
the cell diagonals, so the AA width itself jitters. Filter each axis
separately, combine with vx + vy - vx*vy. This is an easy mistake and it
actively makes shimmer worse, not just unimproved.

Reference: Ben Golus, "The Best Darn Grid Shader (Yet)" — the four fixes
that matter, in order: (1) length(vec2(dFdx,dFdy)) per axis, never a single
fwidth() call on a combined value; (2) clamp the draw width to
[uvDeriv, 0.5] then fade by saturate(targetWidth/drawWidth) ("phone-wire
AA" — without it, grout vanishes entirely once sub-pixel instead of fading to
its area-mean colour); (3) fade to the pattern's duty-cycle mean, not to
black — this IS the analytic mip, and it's why the technique beats a
texture bake without needing one; (4) invert the line when width is greater
than 0.5 (a 20 mm grout on a 30 mm chip is a majority-grout duty cycle).

The normal-map bug already found and avoidable: three.js's own
perturbNormalArb (used for bump maps) normalizes dFdx(surf_pos)
deliberately, because its height input comes from a texture differenced over
exactly one pixel. Feeding it an analytic gradient through the same
normalized path makes the result resolution-dependent and the relief
collapses to nothing — measured: with three's normalization, an 8 mm grout
depth change moved the rendered image by 0.4% of pixels (invisible); with
normalize() removed from the sigma vectors, 3.5% of pixels visibly changed,
matching the actual bevel band. One normalize() call is the entire bug.

Closed-form gradient, zero finite differences, zero extra texture
evaluations: the height function is
h(b) = -depth * (1 - smoothstep(halfWidth, halfWidth+bevel, b)) where b is
distance-to-nearest-joint-centreline; its derivative is the closed-form
6t(1-t)/bevelWidth smoothstep derivative, directed along whichever axis is
nearest, faded to zero as the bevel itself goes sub-pixel (this fade is not
optional — a sub-pixel normal discontinuity is the single worst specular
aliasing source in the material).

Bond patterns, MIT-licensed, verified to compile on r185:
- Running/stack/stretcher bond — catstackdev/glsl-playground-rect-vite, one
  parameterised function (rowAmount selects the bond).
- True herringbone (not a "simplified fake," as several other repos' own
  comments admit theirs are) — adapted from Ttanasart-pt/Pixel-Composer
  (MIT). Its coordinate swap (uv = uv.yx on alternating tiles) means the
  antialiasing footprint axes must swap too, or half the pattern aliases.
- Hexagon mosaic — no usable MIT implementation found anywhere searched;
  written fresh from a standard hex-distance-field construction and
  compile-verified against r185 (0 shader errors).

Integration: compute the tile field once right after <map_fragment>
(locals stay in scope for the later chunks); material.defines = { USE_UV: '' }
must be set explicitly — three.js does not infer it; customProgramCacheKey
pinned to a constant. Measured: 10 full re-renders across 10 different uniform
values (grout width, colour, pitch, bevel, depth, roughness) in 20.5 ms total,
renderer.info.programs unchanged — zero shader recompiles for any of it,
which is the entire point of the uniform-only discipline.

CC0 texture sources, license-verified (not assumed from a badge):
ambientCG (CC0 1.0, explicit commercial-use permission, no attribution
required) and Poly Haven (CC0, scriptable exact-URL API with byte sizes and
md5s) are clean. sharetextures.com explicitly prohibits exactly this use
("No asset redistribution... No automated downloads" despite marketing as
CC0) and freepbr.com is non-commercial-only — both must not be used for
a client-facing commercial product regardless of any "CC0" label on the page.
A shortlist of six specific bathroom-appropriate assets (subway, hexagon,
penny-round, terrazzo, marble) was identified and sized (roughly 9-18 MiB for
the set, keeping only Colour+NormalGL+Roughness — AO and relief are supplied
analytically by the shader, so those maps are unneeded).

Anisotropic filtering has no bearing here and this is worth remembering
explicitly: texture.anisotropy is consumed by the fixed-function sampler
at texture() call time. Procedural colour never passes through a sampler —
there is no texture object to set anisotropy on. The analytic filter above is
not a substitute for anisotropic filtering; for procedural grout, it is the
only filtering mechanism that can exist.

Rejected: NVIDIA MDL's base::tile_texture (BSD-3, good parameter
naming to borrow for a future UI, but its grout edge is an un-antialiased
branch and its bump mapping is 3-tap finite differencing with a
magic-number delta — an offline-renderer technique that aliases badly in
realtime); a render-target bake of the procedural pattern (both research
passes independently suggested this; rejected because the measured analytic
filter already lands within 1/255 of 4x-supersampled ground truth with lower
shimmer than a mip pyramid would give — the bake would add a finite Nyquist
limit, wrap-mode mip seams, and 1.3-5.3 MiB of VRAM to solve a problem that
measures as already solved. Keep in reserve only for a future pattern with no
closed-form integral, e.g. noise-warped hand-laid tile).

A worked, compiled reference file exists only in the research session's
scratch output (tile-grout-material.VERIFIED.js) — not in the tree. Porting
it in is its own reviewed change, following this section's shape.

---

## 11. Cinematic camera techniques — researched, validates existing work, mostly not adopted

Deep research into camera-controls (yomotsu), Theatre.js, camera splines, and
depth-of-field confirmed the existing spring implementation independently
arrived at the same numerics as the reference smoothDamp (the Padé
approximation of e^-x used in both, unprompted). Concrete, verified findings
for future work:

- camera-controls (yomotsu, MIT, genuinely vendorable, zero imports) has the
  right damping model but the wrong state model for a cinematic director — its
  entire state is theta/phi/radius around a target with up locked once; no
  roll channel, every move is an orbit. Worth stealing specific pieces (a
  fitToBox framing helper with asymmetric padding; a dual smoothTime, one for
  director moves and a faster one while the user is actively dragging the same
  axis; a rest event distinct from sleep, so UI gates on "arrived" rather than
  on velocity never quite reaching zero) without taking the dependency.
- Theatre.js is DISQUALIFYING — CommonJS only, no browser build, a build step
  is required to use it at all.
- curve.computeFrenetFrames() (three.js's own, MIT, already vendored) is
  parallel transport despite its name — the roll-free camera-rail primitive,
  already available, needing no new code to exist.
- Full post-processing depth-of-field (pmndrs/postprocessing, three's own
  BokehPass) was investigated and is NOT recommended at this budget: even the
  cheapest real depth-of-field passes cost multiple render targets and
  fullscreen draws per frame. scene.fog (zero passes, already free) plus a
  cheap 8-tap FocusShader are the ceiling worth reaching for under a
  buttery-smooth, high-refresh-display requirement; true bokeh is a future
  upgrade, not part of this build.

No code from this research has been adopted yet beyond the confirmation that
the existing spring integrator's numerics were already correct.

---

## 7. Locked contracts (operator, 2026-08-03) — binding on this engine work

1. **Glass is camera coverage only.** It mutates render state and nothing else:
   never the selected product, assignments, quantities, estimate, saved project,
   thumbnail or specification. Verified by inspection — `applied[sid]` is written
   only in `applySurface()` and read only by `updateAriaLabel()`; the glass path
   touches neither. The opaque state is snapshotted before the first blend and
   restored field-by-field, then forgotten, so a wall returns to its EXACT prior
   material. `handle.camera.forceOpaqueSurfaces()` exists for capture paths: a
   thumbnail records the design, never a camera position.
2. **Stable semantic targets.** `TARGETS` in `director3d.js` maps `north-wall`,
   `south-wall`, `east-wall`, `west-wall`, `floor`; anything else resolves
   against fixture *kind* (`vanity`, `cabinets`, `bath`…) via `resolveFixture`.
   `focusSurface(target, options)` is the single entry point for both new
   questions and natural-language revisions. Question copy is never a target.
   Unknown targets are a silent no-op, never a throw.
3. **Coverage is structural.** A ceiling now closes the box. It is deliberately
   NOT in `SURFACE_IDS`: that list drives assignments, the estimate, the aria
   label and the surface picker, and a ceiling entering it would become a
   product nobody chose and a line the estimate must price.
4. **Hysteresis + time-based blend.** Glass latches at `enter` 0.14 and only
   releases below `exit` 0.02, so jitter or idle drift sitting on a single
   threshold can no longer pulse a wall. The blend is an exponential approach on
   a 0.22 s constant (0.09 s reduced), frame-rate independent — opacity,
   roughness and depth state animate; nothing is blurred per-object.
5. **Photographic PBR is a separate decision.** Not taken, not implemented.
6. **Mobile cost.** Walls carry `receiveShadow` only and never cast, so a
   transparent wall cannot drop an opaque shadow. Glass draws at `renderOrder`
   1 with `depthWrite: false`. Corner (two simultaneous glass walls) and
   phone-class pixel ratio remain UNMEASURED.
7. **Isolated.** Engine only. No UI, view or router file is modified.
8. **`window.__akv3d` removed.**

### Still unverified — do not call this done

The visual acceptance run has NOT been performed: overview → north wall →
shallow outside-wall view → corner/two-wall → floor → vanity → north-wall
revision → ceremonial orbit, plus reduced motion and mobile width, watched at
real `requestAnimationFrame` speed. rAF is paused while the automation browser
pane is hidden, so nothing about how this LOOKS is established.
