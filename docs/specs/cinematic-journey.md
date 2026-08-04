# The cinematic guided journey — motion, coverage, and glass edges

Status: **complete for the guided bathroom v0 experience.** Operator direction,
2026-08-03 through 2026-08-04. Each section records its own evidence boundary.
Photographic PBR remains a separate operator decision, not unfinished journey
behavior.

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

### Deliberate boundary in this view

- No route in NAV/the tab bar — deliberate. .tabbar is grid-auto-columns:1fr
  with a corner-clearance geometry hand-measured in-browser for its current
  five columns (four NAV entries plus "Vise" — see .tabbar__surface's own
  comment in css/styles.css). A sixth column changes that measurement and this
  session could not re-verify it visually. #/atelier is fully reachable by
  URL; wiring a nav entry (or a promotional entry point from /katalog) is a
  follow-up requiring a visual pass. The catalogue doorway added later makes
  the journey discoverable without disturbing that measured geometry.
- The grid-only live grout controls and the earned proposal payoff are now
  complete; sections 10, 12 and 14 supersede the earlier open notes here.

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

## 10. Animatable grout via GLSL — BUILT for Atelier grid, verified 2026-08-04

Atelier now keeps the product's tile-face texture and draws joint width and
colour analytically in `MeshStandardMaterial.onBeforeCompile`. The program key
is pinned once; width, colour and tile repeat are uniforms. Changing 2/3/5/8 mm
or white/grey/anthracite therefore uploads no replacement canvas texture and
does not compile a second shader. The current numeric finish becomes the next
transition's exact start, so rapid choices redirect instead of snapping.

The live path is deliberately bounded to the grid contract exposed by Atelier.
Other laying patterns retain the established baked texture route; no hidden
pattern option is implied. The analytic joint filters X and Y derivatives
separately, clamps a zero derivative floor, fades sub-pixel coverage toward its
area mean and unions both axes. Reduced motion commits the selected uniform
values immediately. The on-demand render loop stops once all four values settle.

The research below is retained because it records why this implementation uses
separate-axis analytic coverage rather than a repeatedly baked texture.

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

A broader worked research prototype remains outside the tree. The narrower
production grid contract described above is now implemented directly in
`js/room3d.js`, with renderer-independent timing and physical-width maths in
`js/live-grout.js`.

### Verification performed for the built grid path

- Plain Node: `tests/live-grout.test.mjs` — 14 passed, covering legacy draft
  defaults, invalid persisted values, physical millimetre-to-UV conversion,
  finite bounds, 30/60/120 fps parity, interruption continuity, exact settlement,
  reduced motion, the pinned shader/uniform contract, grid-only routing, the
  on-demand damage loop, touch-sized controls and offline precache.
- Browser: changed the floor from grey 3 mm to anthracite 8 mm and watched the
  lit joints widen and darken without a camera reset; reloaded the exact route
  and saw the finish restored; selected a wall product and saw the same live
  path applied to all four wall assignments.
- Proposal: floor and grouped-wall rows name the selected joint colour and width,
  and the mail handoff carries the same persisted finish.

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

---

## 12. Journey continuity and payoff — BUILT and visually verified 2026-08-04

The guided route is now a discoverable, resumable customer path rather than a
hidden technical demonstration. The catalogue home carries one deliberate
**Akvaterm Atelier** invitation; after the first decision it becomes “Nastavite
svoju kupaonicu,” using the existing local draft rather than starting over.
The tab-bar geometry remains unchanged.

The six chapters now behave as one continuous commission:

- **Smjer is consequential.** It is required, changes the live room as a
  non-committing preview, and reorders (never removes) tile suggestions around
  the chosen calm / warm / dramatic direction. Revising it preserves later
  choices, marks material chapters stale and disables the quote action until
  those choices are made current again.
- **A wall choice means walls.** The one “Zidovi” decision applies to and prices
  north, east, south and west walls. The previous view changed and priced only
  `wallN` while its plural copy implied a whole room.
- **Equipment is a composition, not a radio group.** Sanitary and comfort
  chapters accept multiple products. Alternatives in the same physical role
  replace one another; different roles coexist. Products with an honest room3d
  analogue are placed immediately and the camera travels to the latest one.
  Products without one (for example a WC seat, concealed frame or underfloor
  kit) remain in the commercial summary but do not acquire misleading geometry.
- **Placement belongs to the customer.** Fixture moves are written into the
  Atelier draft and survive re-render and reload. Selecting another product no
  longer resets already positioned equipment.
- **The proposal is real data.** The former summary read `orderEstimate().total`,
  a field that does not exist, so every tile subtotal silently became zero. The
  proposal now prices ordered square metres including the domain reserve,
  prices unit equipment once, groups the four walls into one intelligible line,
  states that the figures are demo estimates, and creates a complete mailto
  handoff to Akvaterm. Installation, openings, adhesive and grout remain
  explicitly outside the estimate.

### Coherence and reward

The guide now carries a quiet directional entrance on chapter changes while
the camera performs the larger spatial transition. The selected mood adds a
low-alpha Iris ambient wash over the room; controls keep their already
differentiated semantic motion. Long product chapters scroll inside their own
content area so Back / Next remain stable. A hidden-state cascade defect found
in the live pass (the comfort list painted underneath the proposal) is closed,
and chapter changes reset only the guide scroll that belongs to the old beat.

The final chapter expands into a project card with dimensions, direction,
ordered tile quantities, chosen equipment and the combined demo estimate. Its
request action is sticky and remains reachable on a phone. The camera uses a
new finite `revealRoom()` establishing move; it does **not** start Panorama or
an endless inspection orbit without consent. Reduced motion removes the guide
and payoff animations and shortens the engine move through the existing
director contract.

### Verification performed

- Plain Node: `tests/journey.test.mjs` — 21 passed.
- Plain Node: `tests/commissioning.test.mjs` — 9 passed.
- Plain Node: `tests/motion.test.mjs` — 35 passed.
- Browser, real Chromium animation frames: completed the route at 1440×1000
  and 390×844; direction changed the rendered canvas; two sanitary products
  stayed selected together; four-wall quantity rendered as 25.17 m² for the
  exercised 2.4×2×2.6 m room; the quote action remained visible on the phone;
  and no console/page errors were observed.
- Browser revision pass: changed the completed direction, then opened the
  proposal. Four proposal rows remained, both material rows were visibly stale,
  and the request action was disabled rather than deleting downstream work.
- Reduced-motion emulation: guide/payoff animation names were `none` and the
  inherited control transition duration collapsed to the existing 1 ms path.

### Deliberate boundary after completion

Photographic PBR assets remain an operator decision. The catalogue doorway
solves discoverability without changing the hand-measured tab bar; a dedicated
nav item is still intentionally absent. The guided route, payoff and live grid
finish are complete without claiming that every older engine coverage pose was
re-authored as part of this customer journey.

---

## 13. Masked material replacement — BUILT and visually verified 2026-08-04

The useful part of the reviewed Diffusers inpainting guide is now present
without importing its inference stack. Python, PyTorch, Diffusers, checkpoints,
CUDA, xFormers, CPU offload, prompt generation and hosted inference were all
rejected: GitHub Pages cannot execute them, and this journey does not need to
invent pixels. It already knows the exact semantic surface and exact catalogue
material the customer selected.

Five ideas were retained and translated honestly:

- **Mask:** only the selected room surface receives a temporary reveal layer.
- **Preservation:** the previous material stays on the base mesh until the new
  material completely covers it; every other surface and every commercial
  record is untouched.
- **Blur:** a 14% feather replaces the hard boundary. A single 128×4
  clamp-to-edge gradient alpha texture moves across the surface; no bitmap is
  regenerated per frame.
- **Overlay:** completion removes the temporary mesh and commits the new texture
  as the ordinary lit material. The effect never becomes product, pricing,
  persistence or accessibility state.
- **Chaining:** floor and wall decisions remain separate authored beats. The
  four wall masks may run together because one wall decision semantically owns
  all four walls.

`js/masked-reveal.js` owns renderer-independent timing and mask maths. The room
engine supplies a temporary `MeshStandardMaterial` overlay so the new tile keeps
the same lighting model as the old tile. The reveal lasts 0.72 seconds, uses
on-demand animation frames, and returns to zero animation work when settled.
A newer choice settles and disposes its predecessor before beginning; resize,
restoration and initial mount use the final-state path; disposal releases the
overlay, alpha map and any uncommitted target texture. Reduced motion commits
the final material directly.

The Diffusers `strength`, prompt, negative prompt, model choice, ControlNet and
padding-crop controls were not reproduced. They control stochastic generation,
while this transition is deterministic. Exposing analogous controls would add
complexity while misrepresenting what the browser is doing. Full-mesh UV
coverage also makes crop padding unnecessary: there is no cropped image edge
to hide.

### Verification performed

- Plain Node: `tests/motion.test.mjs` — 40 passed, including mask endpoints,
  feather monotonicity, 30/60/120 fps settlement, render-only state, cleanup,
  interruption, restoration bypass and reduced-motion settlement.
- Browser, Chromium at 1440×1000: watched a contrasting terracotta-to-Nero
  Marquina floor transition at a real mid-frame and at settlement; watched the
  four-wall path; no seam, void, page error or console error was observed.
- Browser interruption pass: selected three contrasting wall products during
  active transitions; the final selected product settled and the canvas stayed
  live without an error.
- Browser reduced-motion emulation: an active reveal settled immediately and a
  subsequent selection used the direct final-state path.
- Browser at 390×844: the transition rendered behind the touch-sized guide
  without changing its scroll, selection or navigation behavior.

The live grout transition is recorded in section 10. Photographic PBR remains a
separate material decision, not part of this localized replacement layer.

---

## 14. Earned completion reward — BUILT and visually verified 2026-08-04

Magic UI was audited as an upstream interaction catalog at commit
`0bd8b9fe0e15c4697c8d22dee1d35d88b5152c25` (tree
`77470458923184770804f3dd790fb3414acaae65`, MIT). The audit used the current
`apps/www/registry.json`, not the stale root registry: 77 components are
registered and 78 source files exist, with `animated-subscribe-button.tsx` as
the unregistered source. The repository's React, Next, Tailwind and Motion
implementation was not imported.

The useful lesson was a lifecycle, not a component bundle. The finished
proposal now receives one earned, finite ritual:

- the project card settles in once;
- a restrained amber-white rim blooms around its existing teal surface;
- the total receives a single left-to-right light sweep while its real text
  remains unchanged in the DOM;
- eight decorative Iris particles disperse inside the card and disappear.

`js/completion-reward.js` gives the completed room, decisions and assignments a
stable signature. The same signature can claim the ritual once per browser tab;
revisiting the proposal, clicking repeatedly, or remounting the route does not
replay it. A materially revised completed commission receives a new signature
and can earn a new moment. Session storage is bounded to 12 signatures and is
best-effort: blocked or malformed storage falls back to the in-memory gate and
never blocks the proposal.

The effect uses CSS and eight temporary decorative elements. It has no package,
Canvas, WebGL, worker, remote asset, inference service or runtime request. Every
animation is nested inside `prefers-reduced-motion:no-preference`, forced-colors
hides the decorative layers, and all animations settle in at most 1.23 seconds.
The service-worker shell now includes the new module and the application cache
version is `v8`.

Several attractive upstream patterns were deliberately rejected here:

- the Progressive Blur component's eight stacked backdrop filters would break
  Atelier's one-glass budget; its scroll-affordance idea remains available for
  a future cheap gradient or mask;
- infinite borders, shimmers, marquees, particles, orbits and light rays would
  turn an earned moment into standing visual noise;
- WebGL globes, custom cursors, device mockups and developer/social cards do not
  serve commissioning;
- React, Tailwind, Motion and `canvas-confetti` would add a build/runtime surface
  for behavior the existing static platform can express directly.

A reusable `$adapt-magic-ui-static` skill now records the source authority,
all 78 component dispositions, selection gate, static translation workflow,
accessibility contract and verification checklist.

### Verification performed

- Plain Node: `tests/completion-reward.test.mjs` — 8 passed, covering canonical
  identity, meaningful revision, one-time claim, remount persistence, blocked
  storage, bounded history, readiness gating and finite reduced-motion-scoped
  markup.
- Full journey suites: `tests/journey.test.mjs` — 21 passed;
  `tests/commissioning.test.mjs` — 9 passed; `tests/motion.test.mjs` — 40 passed.
- Chromium at 1440×1000: all 11 intended card animations were active during
  the earned moment, zero remained running after settlement, the DOM total was
  stable, and revisiting produced no celebration class or particle nodes.
- Chromium at 390×844 with touch: zero horizontal document overflow, the guide
  retained its intentional internal scroll, and the sticky quote action stayed
  visible during the reward.
- Chromium reduced-motion emulation at 390×844: the ready proposal rendered in
  its final state with zero running animation and both decorative pseudo-layers
  at zero opacity.
- No page or console errors appeared in the desktop, mobile, revisit, or
  reduced-motion passes. No HTTP request left the local origin.

The first browser pass exposed a mask-composite rendering seam that drew a long
cyan slash through the proposal. That fragile conic mask was removed and
replaced with the verified rim bloom before this section was marked complete.

---

## 15. Natural-language 3D bridge research — authoring-only boundary 2026-08-04

Hello3DMCP was audited at pinned server commit
`f52631c770a119773ba0743876d364a34eb0fda8` (tree
`127229247ff2d251d595561573f6678996b617c4`) and frontend commit
`9912d8ab6414b1ccba2e222b31cb50c6c7b05812` (tree
`5cf744a17cccf6b960b9b4ecee8f8809e0d85291`). The discussion, both source
repositories, the 67-tool registry, WebSocket/session router, state flow,
frontend handlers, public bundle, build manifest and documentation were
inspected. The tracked `.mcpb` was listed but not executed; the server's tracked
`.env` was deliberately not read. NOD32 was unnecessary because no opaque code
was installed, extracted or run.

The transferable idea is **language declares intent while the browser remains
the scene authority**. That matches this project better than the source's flat
surface of camera, light and rotation micro-tools: `journey.js` already declares
semantic camera intents, and `director3d.js` already owns stable verbs such as
`focusSurface`, `inspectMaterial`, `orbitSelection` and `revealRoom`. No MCP
runtime is needed to gain that architecture.

The source server and frontend are not adopted. The reviewed implementation:

- accepts a caller-supplied session ID on an unauthenticated WebSocket without
  an origin policy and can replace the connection mapped to that session;
- correlates state replies in a global request map without binding them to the
  sending session, while one browser disconnect rejects every session's pending
  queries;
- discards delivery failure and lets tool handlers announce success immediately,
  before the browser confirms that a command was applied;
- treats socket-open as connected before session registration is acknowledged;
- places the routing credential in the page query string;
- sometimes continues a relative operation after its fresh-state query fails;
- names `camera.zoom` controls as field-of-view controls, with widening and
  narrowing semantics reversed; and
- has no automated tests or dependency lockfiles at the pinned commits.

Those are source-specific findings, not a claim that MCP or WebSockets are
inherently unsuitable. A future **optional authoring adapter** may expose the
existing semantic director verbs, but it must use an unguessable single-use
pairing exchange, loopback binding and origin allowlisting, versioned schemas in
both directions, per-session pending work and cleanup, revisioned state, and a
correlated browser `applied`/`rejected` acknowledgement. Tool success must wait
for `applied`; absent, stale, disconnected or conflicted state must fail closed.

This remains outside the production journey. Future customers on GitHub Pages
will not need Claude Desktop, an extension, a local server, a tunnel, a GPU, a
model checkpoint, an API key or a paid inference service. The platform keeps
its current static, phone-capable, zero-runtime-cost path.

The reusable audit and protocol method is recorded in
`$audit-browser-mcp-bridge`. No Akvaterm JavaScript, service-worker entry,
customer UI or production dependency changed in this research pass.

---

## 16. Unity editor MCP research - no product integration 2026-08-04

**Verified fact:** UnifiedUnityMCP was inspected at pinned commit
`a934d2cba994c581089a6131b5dc1439d30e5d2f` (parent
`efe62e0afeeb7ab28cc154bff71775ceec57fe36`, tree
`97b8c88c1305e207e6fd5048d48d3e753f874fb3`, MIT). The tracked source,
repository instructions, Unity version, package manifests and lock, tool
registry, transport, lifecycle commands, dispatcher, core tools, all module
factories, capability catalog, skills, tests and smoke scripts were inspected.
The 277 tracked files total 847,847 bytes. Six JSON files, four PowerShell files
and three Python files parsed successfully. The Unity package was not installed,
the Editor was not launched, and no local MCP endpoint was called. NOD32 was
unnecessary because no opaque executable or downloaded bundle was run.

**Verified fact:** this is a developer-side Unity Editor control server, not a
phone runtime or a GitHub Pages component. It listens on loopback from inside a
Unity Editor process, marshals work to Unity's main thread, and exposes 52 tool
names: 16 direct core tools and 36 module entrypoints. The names recovered from
source match `active_tools.json` exactly. Fifteen module entrypoints are
bridge-only; the shared module wrapper truthfully marks their documented actions
as `implemented=false` and returns `status="not_implemented"` rather than
pretending they ran.

The useful patterns are narrow and authoring-oriented:

- keep one capability manifest synchronized with code, catalogs, skills and
  contract tests;
- expose capability introspection and explicit implementation state;
- marshal editor API work to the editor thread;
- wrap reversible scene edits in named Undo operations and report dirty/save
  state separately; and
- represent builds, tests, imports and compilation as observable jobs whose
  success means settled, not merely queued.

The reviewed server itself is not adopted. Verified reasons include:

- it starts enabled by default and has no authentication check in the request
  path; a missing `Mcp-Session-Id` is accepted for non-initialize requests, and
  the supplied smoke tests and PowerShell scripts rely on sessionless tool calls;
- its origin policy permits any HTTP or HTTPS page hosted on localhost or a
  loopback address, while its tools can destroy objects, alter project settings,
  execute arbitrary Unity menu items and start builds;
- `unity_component_property` reads and writes non-public instance members and
  invokes any compatible non-public instance method by name; recording the
  component in Undo cannot reverse arbitrary method side effects;
- every module's `bridge` action can call any other registered tool, so a
  semantic module name does not constrain authority;
- the fixed 30-second tool timeout only suppresses a late response. It does not
  cancel the queued or running editor action, and dispatcher shutdown does not
  clear the queue, so a reported timeout can be followed by an unreported
  mutation;
- scene open/new can block on a modal save prompt, and builds/tests/compilation
  are not modeled with durable job IDs, progress and cancellation;
- project-structure validation accepts a non-`Assets` root as an arbitrary
  filesystem path and can enumerate directories outside the Unity project; and
- the advertised MCP 2025-03-26 lifecycle is not enforced: initialize payloads
  are not validated or negotiated, initialization need not be first, initialize
  may appear in a batch, and accepted notifications return HTTP 204 even though
  that specification requires HTTP 202.

**Decision:** no Unity, MCP, C#, package, server, build workflow or customer-facing
code enters Akvaterm from this source. The current project has no Unity project
markers and remains a static, phone-capable GitHub Pages experience. A future
Unity-based product would be a separate architectural decision and toolchain,
not an extension of this journey by implication.

**Proposal, not implemented:** if a private editor bridge is ever justified,
require authenticated initialization, an exact origin policy, capability-scoped
tools, strict schemas, cancellation-aware queue entries, allowlisted reflection
and menu commands, dry-run defaults for cleanup, explicit Undo/dirty/save
receipts, and job protocols for build/test/import/compile settlement.

The reusable method is recorded in the new `$audit-editor-mcp-bridge` skill and
its editor contract. `$audit-browser-mcp-bridge` now routes Unity, Unreal,
Blender, Godot, IDE and DCC control audits to that stricter skill. No Akvaterm
JavaScript, service-worker entry, customer UI or production dependency changed
in this research pass.

---

## 17. Lightswind source-delivery audit - no product integration 2026-08-04

**Verified fact:** the published `lightswind@3.2.2` archive was inspected without
installing or running it. npm records publication at `2026-07-24T07:13:24.662Z`,
19 files, 379,223 unpacked bytes, MIT metadata, SHA-1
`41d4d926017f9b0643024234ec78a1721b6e7dc5`, and SHA-512 integrity
`cc91PLXDfYhSKnNAE4KAYN7jRYCpa1MZYGqPaKAWlldR2NmDovdZ2ablXpQm2Ajdr0VqhjkEuBeu38MjbSsYFw==`.
Both downloaded hashes matched. All archive paths stayed under `package/`.

The publish-time repository tag `v3.2.2` resolves to commit
`f02eeb35083cb7cf50c6b3f7067241fb098cde3d` (parent
`b2df849a72536c0daa4322059ab970c3d156c597`, tree
`46598925e0b1f050966ce15e7895d960324e31ad`). A second annotated tag named
`lightswindui/v3.2.2` points to that parent. The npm archive is not reproducible
from either tag: against the publish-time commit, 6 shipped files matched, 3
existed but differed, and 10 generated `dist/` files were absent. That is a
provenance gap, not proof of malicious behavior; the archive remains the
authority for what npm delivered.

**Verified fact:** this package is an installer and remote delivery client, not
the component catalog itself. Its CLI fetches a live registry, writes source and
configuration into the caller's project, invokes the detected package manager,
can modify Cursor and Claude Desktop MCP configuration, reads and writes a Pro
key in `.lightswindrc`, and sends CLI analytics. The MCP server exposes eight
catalog and delivery tools and fetches component or block content from
Lightswind endpoints. The package declares 30 runtime dependencies plus React
and React DOM peers; no install lifecycle script is declared.

The compiled main module reports version `3.2.0` although the package is
`3.2.2`. Importing that module in a non-local browser automatically sends the
site hostname to an obfuscated Lightswind telemetry endpoint and stores a
seven-day local marker. The automatic package-initialization path does not
honor the `doNotTrack` check used by its explicit `trackComponent()` function.
The endpoint was decoded from source but never contacted during this audit.

**Verified fact:** there is no single stable component count. The npm and
repository descriptions say 160+, the website says 260+, the tagged registry
contains 175 items, `all-components.json` contains 180 entries, the tagged
source and dependency manifest contain 241 component names, and the live API
returned 178 items on 2026-08-04. The live payload had three components absent
from the publish-time tag. It is mutable code and cannot be treated as pinned by
pinning the npm version alone.

A source-pattern inventory of those 178 live payloads found 106 client
components, 79 Framer Motion users, 7 GSAP users, 14 Three/React Three
Fiber/OGL/Cobe users, 32 Canvas-related components, 46 direct animation-frame
users, 25 obvious infinite-animation declarations, 29 timer users, 47 global
listener users and 24 components containing remote URLs. Only 3 contained
explicit local reduced-motion handling. These are selection heuristics, not a
claim that every matched component is defective.

The visually useful contracts are already present in Akvaterm or in the Magic
UI adaptation: honest semantic progress, finite reveal, bounded native-button
feedback, and a once-only completion reward. Lightswind's `CinematicScroll`
would add a hidden nested scrollbar and stacked backdrop filters; its timeline
adds continuous glow; its lens and image reveal are hover-led; its
slide-to-confirm is drag-only; and its confetti wrapper downloads a remote
script while failing to enforce the reduced-motion option it exposes. None is
a clearer or safer replacement for the journey now in progress.

**Decision:** no Lightswind package, CLI, MCP server, remote registry, Tailwind
plugin, React component, animation library, telemetry path, GPU effect or
runtime request enters Akvaterm. No customer-facing code changed in this pass.
The existing `$adapt-magic-ui-static` skill now includes a source-delivery gate
and a pinned Lightswind ledger so future UI installers are audited as executable
supply chains before their visual ideas are considered.

---

## 18. Codebase-memory graph audit - method adopted, runtime not integrated 2026-08-04

**Verified fact:** `DeusData/codebase-memory-mcp` was inspected as source at
commit `d6be58ef9d43c574a2d1b0827ecc1e3c4846f0fe`, tree
`f90b1163c183b3023c399feb0c8b3babd469e16a`, with merge parents
`27893016bb227ea4527108ec4e0973c085c153c5` and
`27d9831ab85698647710b8e9acc45cb63d38143e`. The first-party source and tracked
inventory were audited under the repository's MIT license; the downloaded
binary was not executed, the installer was not run, and vendored generated
parser bodies were inventoried rather than line-reviewed as first-party logic.

The project is a developer-side structural index: a C application parses a
repository into a persistent SQLite knowledge graph and exposes discovery,
source, coverage, status, change, ADR and trace operations through MCP or a
one-shot CLI. The pinned registry contains 15 MCP tools. It has no LLM and is
not a browser component, visual effect, customer feature, phone runtime, GPU
service or GitHub Pages capability.

Its strongest reusable contribution is an evidence ladder:

`pinned source -> project and generation -> freshness -> graph discovery ->`
`coverage -> exact source -> complete pagination -> bounded claim`

Graph results are explicitly provisional. Exact source remains authoritative.
An absence, dead-code, completeness or exhaustive-impact claim requires a
bounded current generation, terminal pagination, filesystem freshness, path and
language coverage, and direct inspection of skipped, partial, excluded or
unindexed material. A clean gap list means only that no gap was recorded; it is
not proof that indexing was complete.

**Verified fact:** current source and current prose drift in several places.
The implementation enum contains 163 language members while the README says
158. The MCP registry contains 15 tools while `CONTRIBUTING.md` and one smoke
script still describe 14. Static source inspection found 7,259 `TEST(...)`
definitions under `tests`, while the README says 6,768. Project version strings
also differ between `server.json`/npm metadata (`0.8.1`), `flake.nix` (`0.6.0`)
and the development build default (`dev`). These are documentation and release
metadata reconciliation findings, not evidence that the advertised features
all pass: the external suite and release binary were not executed.

The network documentation also drifted. The README's no-background-network
statement matches current production source, which deliberately installs no
update provider, while `SECURITY.md` still describes an initialization-time
release check. Explicit installation and update paths can still access the
network. Release signing, SLSA, checksum and malware-scan statements remain
upstream claims because no release artifact was downloaded or independently
verified here.

The default installation boundary is too broad for this project. It discovers
and edits many account-level agent configurations; for Codex it can modify
`config.toml`, install hooks and write instructions and skills. MCP sessions use
a shared per-account daemon, `auto_watch` defaults on, and the allowed root is
unrestricted when `CBM_ALLOWED_ROOT` is unset. Indexed projects share an
account-local registry, so one configured client can name another indexed
project. Optional persistence can write `.codebase-memory/` graph artifacts into
a repository. Its graph-side ADR document lives in SQLite and cannot replace
canonical repository architecture records.

The localhost graph UI does make meaningful exposure reductions: source binds
to `127.0.0.1` and checks Host and same-origin requests. That does not turn the
shared cache or installer into multi-tenant isolation, and this pass was a
source audit rather than a complete security assessment.

The accompanying March 2026 preprint reports 31 repositories, 66 languages,
83% answer quality, 10x fewer tokens and 2.1x fewer tool calls in its studied
workflow. That is useful research evidence for graph-assisted discovery; it
does not validate the later 163-language development tree or establish a need
for this small static site.

**Decision:** do not install, execute, configure, vendor or ship
codebase-memory-mcp for Akvaterm. Do not start its daemon or watcher, index this
workspace, modify Codex hooks, create graph artifacts, or use its SQLite ADR
store. The repository is small enough for exact source search and the existing
tests, and the customer experience must remain a zero-GPU static GitHub-hosted
site.

If a much larger private codebase later justifies evaluation, use the one-shot
CLI first, pin and verify a release artifact, set an explicit allowed root,
disable watchers and auto-indexing, keep persistence off, isolate the cache, and
measure discovery value against exact-source verification. That is a future
evaluation gate, not current architecture.

The reusable evidence ladder is recorded in the new
`$verify-codebase-graph-evidence` skill. No Akvaterm JavaScript, service-worker
entry, customer UI, dependency or runtime behavior changed in this research
pass.

---

## 19. Superpowers methodology audit - authoring discipline only 2026-08-04

**Verified fact:** the requested raw `.codex/INSTALL.md` URL returned 404 at
the time of inspection because that file was deliberately removed in release
v5.1.0. The repository's current `main` was inspected at commit
`44c9b2d6e889982ac18c27d05a19fefe335194e1`, parent
`3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`, tree
`dcb98a8f3aa03c8aef4144efda4e2bf9a77c40de`, under the MIT license. Current
instructions route Codex App and Codex CLI through the official Codex plugin
marketplace instead of the deleted clone-and-junction procedure.

The current Codex manifest identifies `superpowers` version `6.2.0`. Its Codex
artifact contains 14 workflow skills and their support files. It declares no
Codex hooks, package dependency, MCP server, startup daemon, model, GPU work or
customer runtime. The source repository has 180 tracked files; its packaging
script deliberately excludes repository hooks, top-level scripts, tests, docs
and other harness manifests from the Codex archive.

The useful methods reinforce this project's existing direction:

- design the smallest coherent behavior before mutating a creative surface;
- test behavior red, then green, then refactor without expanding scope;
- diagnose root cause before proposing a fix;
- use isolated workspaces and narrow tasks where the environment permits;
- verify fresh outputs before any completion claim; and
- keep review, correction and the final merge/push/keep decision separate.

These skills remain subordinate to current user and repository authority.
Their generic instructions cannot authorize a commit, push, PR, merge,
dependency install, deletion of inherited work, or publication. They also do
not override the instruction to stop rather than implement when uncertainty is
consequential. A short design may be enough for a small change; the method must
not turn Akvaterm development, or the eventual customer journey, into ceremony
for its own sake.

One optional feature deserves a separate consent boundary. The brainstorming
skill can offer a browser visual companion; only after the user accepts does it
start a Node HTTP/WebSocket server. Source defaults to `127.0.0.1`, generates a
32-byte session token, checks same-origin WebSocket requests, limits frames,
uses owner-only session files, and times out. It writes persistent mockups and
events under project-local `.superpowers/` when a project directory is used.
It can also request a versioned Prime Radiant logo unless
`SUPERPOWERS_DISABLE_TELEMETRY` (or a supported equivalent) is true. The
companion is not started or needed for Akvaterm by installing the plugin.

**Decision:** adopt Superpowers only as an optional global authoring-method
plugin through the current official Codex marketplace. Do not copy its source
into Akvaterm, add `.superpowers/` runtime state to the repository, start its
visual server automatically, or expose any part of it to customers. No
Akvaterm JavaScript, service-worker entry, dependency, customer UI or runtime
behavior changed in this research pass.

---

## 20. The login threshold — BUILT from the operator photo set 2026-08-04

The login screen is the first authored beat of the same journey, not a form
floating outside it. Its sole visual authority is the ten-image reference set
and the separate dark translucent-card reference supplied by the operator on
2026-08-04. The operator then selected the final project-specific cinematic
interior: a blue-hour spa bathroom opening into a planted courtyard, with warm
limestone, smoked oak and one controlled amber light. There is no headline,
caption or other visible text behind the login card.

`assets/images/login-interior-cinematic.webp` is the approved 1600×900 local
photograph (106,622 bytes). `js/login-photo-style.js` presents it as the full
photographic field and places one compact frosted card above it. The explicit
`--pr-card-reference-scale: .75` token records the operator's instruction that
the card occupy 25% less reference footprint while every interactive target
remains touch-safe. The asset is precached; no external image is fetched, and no
renderer, model, phone GPU service or runtime build dependency was added.

`js/login-depth.js` bounds the depth response. Fine pointers provide a desktop
equivalent. On supporting phones `deviceorientation` moves the scene by at most
12 px and the form by 2.5 px, with less than 2.4 degrees of rotation. iOS asks
for sensor permission only from an explicit 44 px control; Android-class
browsers may enhance automatically. The first sensor sample becomes the neutral
hold, so an upright phone is not mistaken for maximum tilt; rotating the screen
recalibrates that baseline. Sensor values stay in the mounted view,
are coalesced to one animation-frame write and are never stored or transmitted.
Teardown removes every listener and pending frame. Reduced motion resolves all
depth variables to rest and hides the permission affordance.

The threshold remains honest infrastructure. A configured deployment uses the
existing email/password and Google flows. An unconfigured static build keeps
those fields natively disabled and exposes an enabled ordinary link to continue
as a guest; the visual entrance can never become a dead end.

Only after successful authentication, guest entry, or the already-signed-in
doorway does `js/splash.js` mount the orientation handoff. On a portrait touch
phone, a minimal phone outline rotates exactly 90 degrees during the existing
700 ms departure and asks the user to turn the device for a roomier canvas. It
never appears on the idle login, desktop, or a phone already in landscape, and
it never attempts `screen.orientation.lock()`. A real rotation simply hides the
cue through the landscape media query; completion never waits for the sensor.
Reduced motion receives the existing 140 ms plain fade with a static landscape
icon. During the same beat, three same-origin `modulepreload` hints warm
catalogue, Atelier and advisor modules. The hints are not awaited, cannot delay
routing, and add no remote service.

### Verification performed

- Plain Node: `tests/login-depth.test.mjs` — 6 passed, covering pointer geometry,
  orientation rotation and clamping, restrained CSS output, reduced-motion rest,
  permission/cleanup structure, the static-build guest doorway, text-free local
  photography and offline precache.
- Plain Node: `tests/login-handoff.test.mjs` — 6 passed, covering the post-login
  boundary, 700 ms/90-degree animation, portrait-touch eligibility, landscape
  suppression, reduced-motion rest, centralized cleanup, local non-blocking
  warm-up, 0.75 card token and the photograph's delivery budget.
- Chromium, 1440×1000 with normal transparency: the card rendered at 420 px wide
  over the full cinematic interior with `blur(24px) saturate(1.08)`, and the
  document had no overflow.
- Chromium device emulation, 390×844 with touch: the card rendered at 319.8 px,
  the complete 1600×900 image loaded, the document remained exactly 390×844,
  and there was no scene copy or browser fault. At 300 ms the portrait cue was
  present with a near-90-degree transform and three local preloads; it was gone
  after completion. At 844×390 it was never created. The machine's genuine
  reduced-transparency preference also exercised the opaque fallback; an
  emulated normal phone exercised the intended 24 px glass.
