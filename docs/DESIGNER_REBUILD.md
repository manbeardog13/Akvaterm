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

## Sequencing

The audit-fix workflow currently owns `js/room3d.js` and `js/views/soba3d.js`. The rebuild must
wait for it to land, then proceed with full ownership of the designer files so the shared engine
can be factored cleanly instead of duplicated.
