# vendor/three/addons — provenance

Addon modules from **three.js r185 (npm `three@0.185.1`)**, the same package
version as the already-vendored `vendor/three/three.module.js` and
`three.core.js`. Licence: **MIT** — "Copyright © 2010-2026 three.js authors".

Everything here is served from this repository. Nothing in the app fetches an
addon from a CDN at runtime; `index.html`'s import map points
`three/addons/` at this directory.

## Files

| file | source URL | bytes | SHA-256 |
| --- | --- | --- | --- |
| `controls/OrbitControls.js` | (vendored earlier, same package version) | 40504 | — |
| `environments/RoomEnvironment.js` | (vendored earlier, same package version) | 4960 | — |
| `loaders/GLTFLoader.js` | `https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js` | 114959 | `97642d720f16cc9a0c9844934198e4d0c023bea8e89576d0f7545d03b2d103d2` |
| `utils/BufferGeometryUtils.js` | `https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/utils/BufferGeometryUtils.js` | 37621 | `5c552223a9309883743b80538d6e9cdb45e3227f30d3ec56fb2c39b46e78d595` |
| `utils/SkeletonUtils.js` | `https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/utils/SkeletonUtils.js` | 11535 | `b1632a703206c3d830de9fcbe515696770d04b71a15ee6b50afa6d2c3298c86f` |

## Why GLTFLoader is three files, not one

`GLTFLoader.js` imports two sibling addons unconditionally, at its lines 68–69:

```js
import { toTrianglesDrawMode } from '../utils/BufferGeometryUtils.js';
import { clone } from '../utils/SkeletonUtils.js';
```

`SkeletonUtils.clone` is only needed for **skinned** meshes and none of the
fixture models under `vendor/models/` have a skeleton — but the import is
static, so the file must be present or the module graph fails to resolve.
`BufferGeometryUtils.js` and `SkeletonUtils.js` each import only from the bare
specifier `'three'`, so the transitive closure is complete at three files. This
was checked by reading each file's own import statements, not assumed.

## Verification performed on download

- Each file was confirmed to be **JavaScript, not an HTML error page**: the
  first bytes of all three are an `import {` statement, and the byte counts
  match the sizes published for that package version exactly.
- `node --check` parses all three without error.
- Imports were grepped to confirm the closure above.

Use the `/examples/jsm/` paths only. The `+esm` and `/build/` variants on
jsDelivr are bundled or minified and will not resolve the bare `three`
specifier against this repo's import map.

## Addons deliberately NOT vendored

`DragControls.js` and `TransformControls.js` were both evaluated against the
r185 source and rejected for the fixture-drag work in `js/room3d.js`:

- **DragControls** builds its drag plane from `camera.getWorldDirection()`
  (lines 288 and 359), so with this app's tilted camera a dragged bath climbs
  into the air, and no `mode` / `plane` / `axis` option exists to constrain it
  to the floor. Its rotation tumbles around camera-aligned axes.
- **TransformControls** is a 51.7 KB CAD gizmo whose arrow handles fall far
  under the 44 px touch-target rule this app follows.
- **Both** set `this.domElement.style.touchAction = 'none'` in `connect()`
  (DragControls line 142, TransformControls line 432), permanently, which would
  destroy the documented page-scroll contract that keeps the 3D canvas at
  `touch-action: pan-y` whenever nothing is selected.

The drag in `js/room3d.js` is therefore hand-rolled against `THREE.Plane` and
`THREE.Raycaster`, both already exported by the vendored `three.module.js`, so
it adds **zero** vendored bytes.
