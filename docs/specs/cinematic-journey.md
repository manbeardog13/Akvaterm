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
