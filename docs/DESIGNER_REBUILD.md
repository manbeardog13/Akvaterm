# Dizajner rebuild — real objects, no hand-drawn geometry

**Operator, 2026-08-02:** *"dizajner section. why arent the elements in those rooms quality objects?
that's guesswork kitchen counter and windows. i don't want that"*

He is right, and this is the same instruction he already gave for the 3D room — it was applied
there and not here.

## What is wrong today

`data/scenes.js` is 1,117 lines of hand-authored canvas vector drawing. The fixtures in every
Dizajner scene are approximations drawn with paths and gradients:

- `drawWindow()` — an invented window
- `// counter slab (slight overhang)` and `// countertop slab` — invented kitchen worktops
- a sofa assembled from bezier curves, an invented vanity, an invented shower screen

Meanwhile `vendor/models/` already holds 25 finished CC0 models with measured bounding boxes and
documented real-world scale — including exactly the objects being faked: `kitchen-cabinet-base`,
`kitchen-cabinet-upper`, `kitchen-cabinet-corner`, `kitchen-cabinet-drawer`, `kitchen-sink-unit`,
`kitchen-stove`, `kitchen-fridge`, `kitchen-hood`, `window-large`, `window-small`, `door`,
`door-leaf`, plus the full bathroom set.

## Decision

**The Dizajner scenes are rebuilt on the same real 3D engine and the same sourced models as the
3D room. No fixture geometry is authored by hand anywhere in this project.**

Each Dizajner scene becomes a real room built from:

- real room geometry (floor + walls) at real dimensions,
- real CC0 models placed at measured positions,
- the existing shared texture pipeline (physically-scaled tiles with grout),
- a **locked, flattering camera** per scene, so it still reads as a designed "scene" rather than a
  free-orbit sandbox.

This gives one source of truth for geometry, identical fixtures in Dizajner and 3D soba, and it
deletes every line of invented furniture.

## Why not pre-rendered sprites

Compositing pre-rendered PNG sprites of the models into the existing 2D canvas pipeline was the
alternative. It keeps the fast homography renderer, but it freezes lighting and angle per scene,
needs an offline render step per model per scene, and leaves two engines to keep in sync. Live
rendering from the models is simpler to keep honest and gives movable furniture in the Dizajner
for free.

## What must not regress

Everything the Dizajner currently does has to survive the swap:

- scene tabs; tap/keyboard surface selection; product drawer
- pattern / grout colour / grout width controls; per-surface tile rotation
- live price estimate (per-surface m² and totals)
- curated starter combinations; first-run coach mark
- A/B compare; before/after wipe
- draft persistence; share link + QR; "Zatraži ponudu" mailto
- saved-design thumbnails (currently drawn by `scene2d.renderScene`)

## API contract — `js/scene3d.js`

Binding. The engine is written once and every consumer codes against exactly this.

```js
// Live, interactive scene. Mounts a three.js canvas into `el`.
export async function mountScene(el, {
  sceneId,            // key into SCENES
  assignments = {},   // { [surfaceId]: { productId, pattern, groutColorId, groutWidthMm, rotationDeg } }
  products = [],
  onReady,            // called once the first frame with models has painted
  onSelect,           // (surfaceId|null) — fired on tap/click of a surface
}) -> {
  dispose(),                                  // removes listeners, cancels rAF, frees GPU resources
  setAssignment(surfaceId, assignment|null),  // re-textures one surface, no full rebuild
  setAssignments(assignmentsObject),          // bulk (combos, A/B restore)
  setScene(sceneId),                          // swap scene, keep the renderer
  selectSurface(surfaceId|null),              // programmatic select (keyboard path)
  listSurfaces() -> [{ id, kind, labelKey, areaM2 }],  // areaM2 drives the price estimate
  setBareMode(bool),                          // render the scene with NO tiles — the before/after wipe
  snapshotTo(canvas2d),                       // paint the current frame into a 2D canvas (A/B, wipe, share)
}

// One-shot still, for thumbnails. Renders offscreen and paints into a plain 2D canvas.
// Must work without any prior mountScene call and must not leak a renderer.
export async function renderSceneThumbnail(canvas2d, sceneId, assignments, products) -> void
```

`listSurfaces().areaM2` replaces the old `realSizeM` product — the price estimate must keep working
and must now be derived from the real geometry rather than authored numbers.

## Scene definition contract — `data/scenes.js`

Hand-drawn `draw()` functions are **deleted**. Each scene becomes data:

```js
{ id, i18nKey,
  room: { widthM, depthM, heightM },
  camera: { posM:[x,y,z], targetM:[x,y,z], fov },   // the locked, flattering view
  surfaces: [ { id, kind:'floor'|'wall', wall:'N'|'E'|'S'|'W'|null, labelKey, defaultProductId } ],
  fixtures: [ { model:'<file stem in vendor/models>', posM:[x,z], rotY, wall:'N'|… |null } ],
}
```

Fixture geometry comes **only** from `vendor/models/*.glb` at the scale documented in
`vendor/models/PROVENANCE.md`. Nothing is drawn by hand. If a needed object has no model, the scene
does without it — an honest empty wall beats an invented one.

## Sequencing

The audit-fix workflow currently owns `js/room3d.js` and `js/views/soba3d.js`. The rebuild must
wait for it to land, then proceed with full ownership of the designer files so the shared engine
can be factored cleanly instead of duplicated.
