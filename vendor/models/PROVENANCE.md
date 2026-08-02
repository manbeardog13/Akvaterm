# vendor/models — provenance and scaling

Every file in this directory is a **binary glTF 2.0 (.glb)**, self-contained, downloaded
2026-08-02. All are **CC0 1.0 / public domain**: commercial use allowed, no attribution
required in the app. The credits below are a courtesy record, not a licence obligation.

## Verification performed

- First four bytes of every file are the ASCII magic `glTF` — checked, all 25 pass.
- glTF container version 2, and the header `length` field equals the file size — all 25 pass.
- `extensionsRequired` is empty in every file, and no buffer or image uses an external
  `uri`. Textures, where present, are embedded PNG in the BIN chunk. **three.js
  `GLTFLoader` alone can load all of these — no DRACOLoader, no KTX2Loader, no
  meshopt decoder, no sidecar files.**
- Bounding boxes below were **measured** by walking the glTF scene graph, composing
  every node transform, and transforming the eight corners of each accessor's
  POSITION min/max into world space. They are not estimates.

## Axis convention and the scaling problem

All models follow the glTF convention: **right-handed, +Y up, metres**. Verified —
in every file the vertical extent lies on Y and the model sits at or near Y = 0.

**None of them are real-world metre-accurate.** These are stylised low-poly game
assets; the authors sized them for visual balance, not for a product configurator.
A single global scale factor will not fix them, and applying one is exactly how a
room ends up with a 2.4-metre bathtub. Use the per-file scale vectors below.

The `target` column is **inferred** from standard EU / Croatian sanitaryware and
kitchen-module dimensions, not read off the asset. Adjust it if Akvaterm's real
catalogue sizes differ — the measured column is the part that is factual.

## Pivot warning

The Kenney models are **not centred on the origin**. Their pivot sits at a bounding-box
corner: X runs from `-width` to `0`, Z from `0` to `+depth`, Y from `0` up. Placing one
at a room coordinate without compensating for `min` shifts it by half its footprint in
both horizontal axes. The `min` / `max` columns give the exact offset per file.
`washbasin-pedestal.glb` is the worst case: its origin is at basin level and the
pedestal runs **down** to Y = -0.40, so it needs a +Y lift to stand on the floor.

## Kitchen run — use one shared scale

The eight Kenney kitchen modules are authored on a common grid (0.43 x 0.45 x 0.45
for the base boxes). Apply the **same** scale vector to all of them so worktop heights
and door faces line up:

```js
const KITCHEN_RUN_SCALE = new THREE.Vector3(1.3953, 2.0000, 1.3333);
// -> base cabinet becomes 0.60 W x 0.90 H x 0.60 D, stove and sink unit match exactly
```

## Files

### `toilet.glb`

- **Source page**: https://poly.pizza/m/QsQdZcnTsI
- **Direct download**: https://static.poly.pizza/a4e817a3-ac54-421a-b266-8538730ba0cc.glb
- **Original asset name**: Toilet (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 32888 bytes
- **SHA-256**: `3f4adfc99eba24e8b55b1a4eedbcfab7d9351c7b107b6494b227550fc99eb0ab`
- **Triangles**: 440 | materials: 4 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.3126 x 0.4510 x 0.4772 (X x Y x Z)
- **Measured min / max**: [-0.3126, 0.0000, -0.4772] / [0.0000, 0.4510, -0.0000]
- **Inferred real-world target (m)**: 0.36 x 0.78 x 0.67 — WC skoljka, monoblok
- **Recommended scale (per-model)**: `[1.1516, 1.7295, 1.4040]`

### `toilet-square.glb`

- **Source page**: https://poly.pizza/m/RTlsBgoX44
- **Direct download**: https://static.poly.pizza/e460e038-cc65-494b-b1b8-5f681fb7c4f5.glb
- **Original asset name**: Toilet Square (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 30296 bytes
- **SHA-256**: `3486d52f8952b592b3da635bdd3f89b1bf35d144e70562cc27250e78671e841b`
- **Triangles**: 428 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.3036 x 0.4510 x 0.3872 (X x Y x Z)
- **Measured min / max**: [-0.3036, 0.0000, 0.0000] / [0.0000, 0.4510, 0.3872]
- **Inferred real-world target (m)**: 0.36 x 0.78 x 0.62 — WC skoljka, kockasti dizajn
- **Recommended scale (per-model)**: `[1.1858, 1.7295, 1.6012]`

### `toilet-modern.glb`

- **Source page**: https://poly.pizza/m/ZGtHqPsLv2
- **Direct download**: https://static.poly.pizza/68e03d0b-fd3e-4954-9852-8b3cf63c536d.glb
- **Original asset name**: Toilet (CreativeTrio Home)
- **Author**: CreativeTrio — https://poly.pizza/u/CreativeTrio
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 35092 bytes
- **SHA-256**: `4311471a6685e182f1c7643de16d7e3d32e3beed8182887e5806cfb4e2daf6e1`
- **Triangles**: 404 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.2522 x 0.5542 x 0.4625 (X x Y x Z)
- **Measured min / max**: [-0.1261, 0.0000, -0.1510] / [0.1261, 0.5542, 0.3116]
- **Inferred real-world target (m)**: 0.36 x 0.82 x 0.66 — WC skoljka, moderna, uska vodokotlic
- **Recommended scale (per-model)**: `[1.4274, 1.4796, 1.4270]`

### `bathtub.glb`

- **Source page**: https://poly.pizza/m/kVFRyNEn4F
- **Direct download**: https://static.poly.pizza/72c078cf-f0cb-45dc-b9b6-e732e980576e.glb
- **Original asset name**: Bathtub (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 73680 bytes
- **SHA-256**: `46c98db7c9c0870262145182c9082808415a0c3177057b8a2c178d02151b094a`
- **Triangles**: 1204 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 1.1900 x 0.4200 x 0.5600 (X x Y x Z)
- **Measured min / max**: [-1.1900, -0.0000, 0.0000] / [0.0000, 0.4200, 0.5600]
- **Inferred real-world target (m)**: 1.70 x 0.60 x 0.75 — kada ugradbena 170x75
- **Recommended scale (per-model)**: `[1.4286, 1.4286, 1.3393]`

### `bathtub-freestanding.glb`

- **Source page**: https://poly.pizza/m/2MbbdwbTjt
- **Direct download**: https://static.poly.pizza/5d86d2b6-49b9-4097-bb8c-834e56fff1f2.glb
- **Original asset name**: Bathtub (CreativeTrio Home)
- **Author**: CreativeTrio — https://poly.pizza/u/CreativeTrio
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 42848 bytes
- **SHA-256**: `59ac857cedea7c531ab4f1666e827b1f6bb8425aa6cc9d823a116d0763f36862`
- **Triangles**: 474 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.4172 x 0.7883 x 0.6315 (X x Y x Z)
- **Measured min / max**: [-0.7474, 0.0000, -0.3157] / [0.6698, 0.7883, 0.3157]
- **Inferred real-world target (m)**: 1.70 x 0.62 x 0.75 — samostojeca kada 170x75
- **Recommended scale (per-model)**: `[1.1995, 0.7865, 1.1876]`

### `washbasin-pedestal.glb`

- **Source page**: https://poly.pizza/m/iUz9JXhDE1
- **Direct download**: https://static.poly.pizza/6c0b7fe1-8e06-4940-98ba-52dd18df00b3.glb
- **Original asset name**: Bathroom Sink (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 40504 bytes
- **SHA-256**: `25603fda998ef6e35f35ff9ddcf1547accd14af8d259ac54a4ba4b36e4b3d0a4`
- **Triangles**: 632 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.3400 x 0.5600 x 0.2900 (X x Y x Z)
- **Measured min / max**: [-0.3400, -0.4000, 0.0000] / [0.0000, 0.1600, 0.2900]
- **Inferred real-world target (m)**: 0.55 x 0.85 x 0.45 — umivaonik na stupu
- **Recommended scale (per-model)**: `[1.6176, 1.5179, 1.5517]`

### `washbasin-vanity.glb`

- **Source page**: https://poly.pizza/m/gfhQaeSMWf
- **Direct download**: https://static.poly.pizza/eb06e651-dc7a-4d93-b38c-402c45ee0071.glb
- **Original asset name**: Bathroom Cabinet Drawer (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 54396 bytes
- **SHA-256**: `934c9e7b203d47a894842405bce6d3f5bba882d7856ab4918a8327e0ab094459`
- **Triangles**: 768 | materials: 4 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.4718 x 0.3200 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0582, 0.1300] / [0.0000, 0.5300, 0.4500]
- **Inferred real-world target (m)**: 0.60 x 0.85 x 0.46 — umivaonik s ormaricem 60
- **Recommended scale (per-model)**: `[1.3953, 1.8016, 1.4375]`

### `washbasin-vanity-wall.glb`

- **Source page**: https://poly.pizza/m/7yXd2z5Kvp
- **Direct download**: https://static.poly.pizza/6694c27e-2f8f-464f-b380-6e3633fb9bdc.glb
- **Original asset name**: Bathroom Sink (CreativeTrio Home)
- **Author**: CreativeTrio — https://poly.pizza/u/CreativeTrio
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 19224 bytes
- **SHA-256**: `26bdaea9705a007748aa006a04772cce576f60a2cb65fba53a4b547f04ae4952`
- **Triangles**: 162 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.7090 x 0.4785 x 0.4471 (X x Y x Z)
- **Measured min / max**: [-0.1814, -0.0000, -0.1776] / [0.5277, 0.4785, 0.2695]
- **Inferred real-world target (m)**: 0.60 x 0.55 x 0.46 — viseci umivaonik s ormaricem; gornji rub na 0.85 m
- **Recommended scale (per-model)**: `[0.8463, 1.1494, 1.0289]`

### `shower-enclosure.glb`

- **Source page**: https://poly.pizza/m/eleYtAGZuA
- **Direct download**: https://static.poly.pizza/46cd1ec6-59a0-4a76-8ffc-67bf5f0d4a57.glb
- **Original asset name**: Shower Round (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 84228 bytes
- **SHA-256**: `a75e4b966256364c8b928f5180b6212cddcc2457e8f733fd7b856345458d2aff`
- **Triangles**: 1232 | materials: 4 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.5618 x 1.0940 x 0.5618 (X x Y x Z)
- **Measured min / max**: [-0.5618, 0.0000, 0.0000] / [0.0000, 1.0940, 0.5618]
- **Inferred real-world target (m)**: 0.90 x 1.95 x 0.90 — tus kabina, cetvrtkruzna 90x90
- **Recommended scale (per-model)**: `[1.6020, 1.7824, 1.6020]`

### `bathroom-cabinet-tall.glb`

- **Source page**: https://poly.pizza/m/nIpCxu6kvc
- **Direct download**: https://static.poly.pizza/fb8b7c53-d7d4-435a-b9da-3c01d183af13.glb
- **Original asset name**: Bathroom Cabinet (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 11664 bytes
- **SHA-256**: `962abaaa6dc8be7db20aa32d7eabff91d97be15f74841f1833b7cd8d8c9b384a`
- **Triangles**: 108 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.2300 x 0.3900 x 0.1300 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0800] / [-0.2000, 0.3900, 0.2100]
- **Inferred real-world target (m)**: 0.40 x 0.70 x 0.16 — visoki zidni ormaric s ogledalom
- **Recommended scale (per-model)**: `[1.7391, 1.7949, 1.2308]`

### `bathroom-mirror.glb`

- **Source page**: https://poly.pizza/m/REpBXIXfO7
- **Direct download**: https://static.poly.pizza/c560749a-e28c-4b65-8f4d-c068b920ee4f.glb
- **Original asset name**: Bathroom Mirror (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 14780 bytes
- **SHA-256**: `fef7950c47f651c2ba295aa49c02bb367ff9c0a7f4bfdc6eb6e452fb390166b0`
- **Triangles**: 144 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.3013 x 0.4346 x 0.1444 (X x Y x Z)
- **Measured min / max**: [-0.3013, 0.0000, -0.0956] / [0.0000, 0.4346, 0.0488]
- **Inferred real-world target (m)**: 0.60 x 0.80 x 0.12 — ogledalo s policom
- **Recommended scale (per-model)**: `[1.9914, 1.8408, 0.8310]`

### `towel-rail.glb`

- **Source page**: https://poly.pizza/m/OySPj04X9p
- **Direct download**: https://static.poly.pizza/d0313e73-a3d5-4752-b9a7-5f43fefff224.glb
- **Original asset name**: Towel Rail (KayKit)
- **Author**: Kay Lousberg — https://poly.pizza/u/Kay%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 31228 bytes
- **SHA-256**: `7463bf73b5630c941e8254e09ff517c48aa7bf1ff1be402bec8252c8da15292a`
- **Triangles**: 180 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.6000 x 0.5829 x 0.4634 (X x Y x Z)
- **Measured min / max**: [-0.8000, 0.2806, 0.8000] / [0.8000, 0.8634, 1.2634]
- **Inferred real-world target (m)**: 0.60 x 0.50 x 0.10 — drzac rucnika (NIJE radijator)
- **Recommended scale (per-model)**: `[0.3750, 0.8578, 0.2158]`

### `kitchen-cabinet-base.glb`

- **Source page**: https://poly.pizza/m/tWyOLYYHPw
- **Direct download**: https://static.poly.pizza/0a03826b-80ed-42b4-a5c6-b8591fe867dc.glb
- **Original asset name**: Kitchen Cabinet (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 17840 bytes
- **SHA-256**: `0decb3875e69333a85747887d919c7bb987d84f93221c142f3d4424d2a2885aa`
- **Triangles**: 188 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.4500 x 0.4500 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0000] / [0.0000, 0.4500, 0.4500]
- **Inferred real-world target (m)**: 0.60 x 0.90 x 0.60 — donji element 60
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `kitchen-cabinet-drawer.glb`

- **Source page**: https://poly.pizza/m/rGZG7vK3fd
- **Direct download**: https://static.poly.pizza/5ac8cd4a-25fd-4f6b-a6cb-50e62870f767.glb
- **Original asset name**: Kitchen Cabinet Drawer (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 23804 bytes
- **SHA-256**: `5aedc3a3926717c0fe9a555bc1a732ec573ef2cf6fd437d934891644b4cccf33`
- **Triangles**: 252 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.4500 x 0.4500 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0000] / [0.0000, 0.4500, 0.4500]
- **Inferred real-world target (m)**: 0.60 x 0.90 x 0.60 — donji element s ladicama 60
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `kitchen-cabinet-corner.glb`

- **Source page**: https://poly.pizza/m/JyALkkxfvw
- **Direct download**: https://static.poly.pizza/bdff065a-9375-4515-ac60-157f5350c2c6.glb
- **Original asset name**: Kitchen Cabinet Corner (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 11092 bytes
- **SHA-256**: `3b6aab41d44dfa6903788780fa74b2e7ac8b97f8b536cb56164f68cc273173d6`
- **Triangles**: 108 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4600 x 0.4500 x 0.4600 (X x Y x Z)
- **Measured min / max**: [-0.4600, 0.0000, 0.0000] / [0.0000, 0.4500, 0.4600]
- **Inferred real-world target (m)**: 0.90 x 0.90 x 0.90 — kutni donji element 90x90
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `kitchen-cabinet-upper.glb`

- **Source page**: https://poly.pizza/m/mM40AmuWwT
- **Direct download**: https://static.poly.pizza/f1d3182a-f29c-4e20-98fe-a35e87634b9c.glb
- **Original asset name**: Kitchen Cabinet Upper (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 12452 bytes
- **SHA-256**: `357893ef88c4c4ace1504388bf4cda2b174fd84e6aaa226a0ad39089b005c84e`
- **Triangles**: 124 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.3900 x 0.2200 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, -0.0100] / [0.0000, 0.3900, 0.2100]
- **Inferred real-world target (m)**: 0.60 x 0.78 x 0.29 — gornji element 60 (dubina ostaje plitka)
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `kitchen-sink-unit.glb`

- **Source page**: https://poly.pizza/m/nNGtcp9qK2
- **Direct download**: https://static.poly.pizza/c0e9a45c-2468-4f60-803b-7ce563fbc2ab.glb
- **Original asset name**: Kitchen Sink (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 44620 bytes
- **SHA-256**: `a5c7af7a8095240ef5e95d08e10e58329986d2b8ed8c89a14a96c47e888784e6`
- **Triangles**: 596 | materials: 6 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.4900 x 0.4500 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0000] / [0.0000, 0.4900, 0.4500]
- **Inferred real-world target (m)**: 0.60 x 0.98 x 0.60 — sudoper element; Y ukljucuje slavinu, radna ploha na 0.90
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `kitchen-stove.glb`

- **Source page**: https://poly.pizza/m/kTJU2y4R15
- **Direct download**: https://static.poly.pizza/20ac0ba3-07c3-4ec5-ad2c-dc1b836c3006.glb
- **Original asset name**: Kitchen Stove (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 97952 bytes
- **SHA-256**: `051f8f7da83118872fa4ffbddadda2db572a17e8d96e76a3b372b8ccdc044bf9`
- **Triangles**: 1604 | materials: 5 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.4500 x 0.4500 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0000] / [0.0000, 0.4500, 0.4500]
- **Inferred real-world target (m)**: 0.60 x 0.90 x 0.60 — stednjak 60
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `kitchen-hood.glb`

- **Source page**: https://poly.pizza/m/bv0d4xh00P
- **Direct download**: https://static.poly.pizza/c7f8df0a-33bd-4b98-9d49-a84db597d992.glb
- **Original asset name**: Kitchen Hood Large (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 9208 bytes
- **SHA-256**: `f5835220551d54ff1e7f3d5031743f65c9f61ec89b4fa555f075bdcfb073b5a3`
- **Triangles**: 72 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.3695 x 0.2849 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0000] / [0.0000, 0.3695, 0.2849]
- **Inferred real-world target (m)**: 0.60 x 0.74 x 0.38 — napa 60
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `kitchen-fridge.glb`

- **Source page**: https://poly.pizza/m/36ODvl4CIy
- **Direct download**: https://static.poly.pizza/4e931c24-4e81-4569-8d36-0d009b561d8f.glb
- **Original asset name**: Kitchen Fridge (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 26260 bytes
- **SHA-256**: `8bedbb4c3f9c13681f23c83402489e8efd326320d449097c88531adbe5c07f9e`
- **Triangles**: 316 | materials: 4 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.9200 x 0.2919 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, -0.0100] / [0.0000, 0.9200, 0.2819]
- **Inferred real-world target (m)**: 0.60 x 1.84 x 0.39 — hladnjak; dubina modela je plitka, po potrebi rastegnuti Z na 0.65
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `door.glb`

- **Source page**: https://poly.pizza/m/NjrIKzZLYv
- **Direct download**: https://static.poly.pizza/f8349a23-d921-4903-9b2e-96e64f6c21ad.glb
- **Original asset name**: Doorway (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 16560 bytes
- **SHA-256**: `17350838cb250e94584a84f41e4f7cda708a1ad53c8f7206aac49b22b6cf1131`
- **Triangles**: 216 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4860 x 1.0095 x 0.1134 (X x Y x Z)
- **Measured min / max**: [-0.4860, 0.0000, -0.0121] / [0.0000, 1.0095, 0.1013]
- **Inferred real-world target (m)**: 0.90 x 2.05 x 0.10 — vrata s dovratnikom
- **Recommended scale (per-model)**: `[1.8519, 2.0307, 0.8818]`

### `door-leaf.glb`

- **Source page**: https://poly.pizza/m/LI93WgnjyS
- **Direct download**: https://static.poly.pizza/df219d1d-2583-4082-b150-f7529527a63a.glb
- **Original asset name**: Door (Ultimate House Interior Pack)
- **Author**: Quaternius — https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 24320 bytes
- **SHA-256**: `1d5f1c2f478609a41cba26d6bb3a3e39aac61332e00c058a0f8aa1aed41fa03d`
- **Triangles**: 456 | materials: 2 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.7358 x 4.1878 x 0.4201 (X x Y x Z)
- **Measured min / max**: [-1.7358, -0.0000, -0.2101] / [0.0000, 4.1878, 0.2101]
- **Inferred real-world target (m)**: 0.85 x 2.05 x 0.21 — vrata (krilo + okvir)
- **Recommended scale (per-model)**: `[0.4897, 0.4895, 0.4999]`

### `window-large.glb`

- **Source page**: https://poly.pizza/m/EipzkrS9nG
- **Direct download**: https://static.poly.pizza/23e1676f-9152-4fe9-917c-6b98aa66cbe0.glb
- **Original asset name**: Window Large (Ultimate House Interior Pack)
- **Author**: Quaternius — https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 20180 bytes
- **SHA-256**: `796f902305e94865c0b6f12b7a42274f9be9dae8a5ae64e7d3b3316ab02e101c`
- **Triangles**: 372 | materials: 2 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.8324 x 1.6985 x 0.1411 (X x Y x Z)
- **Measured min / max**: [-0.9162, -0.0000, -0.0706] / [0.9162, 1.6985, 0.0706]
- **Inferred real-world target (m)**: 0.90 x 0.83 x 0.07 — prozor veliki
- **Recommended scale (per-model)**: `[0.4912, 0.4887, 0.4961]`

### `window-small.glb`

- **Source page**: https://poly.pizza/m/n88WAcjzTv
- **Direct download**: https://static.poly.pizza/0ab1cc08-63fe-4b22-a166-ea8ac20ae307.glb
- **Original asset name**: Window Small (Ultimate House Interior Pack)
- **Author**: Quaternius — https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 8992 bytes
- **SHA-256**: `08a621c03caf8a1dec0b384b1779a9b651fa22a723d9e3eac0d7368318209cbb`
- **Triangles**: 132 | materials: 2 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.9282 x 1.2380 x 0.1411 (X x Y x Z)
- **Measured min / max**: [-0.4641, -0.0000, -0.0706] / [0.4641, 1.2380, 0.0706]
- **Inferred real-world target (m)**: 0.46 x 0.61 x 0.07 — prozor mali
- **Recommended scale (per-model)**: `[0.4956, 0.4927, 0.4961]`

### `ac-outdoor-unit.glb`

- **Source page**: https://poly.pizza/m/amFuyE3IF6
- **Direct download**: https://static.poly.pizza/75029333-e7b5-4170-8183-a75dfa0b54e6.glb
- **Original asset name**: Air Conditioner (Quaternius CC0)
- **Author**: Quaternius — https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
- **Size on disk**: 38900 bytes
- **SHA-256**: `2f5f6b5f4c1a048ab10c7c023c3a1202b3ef00907931de9e16fdb7ade6b7aba8`
- **Triangles**: 946 | materials: 4 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.0381 x 0.6856 x 0.7709 (X x Y x Z)
- **Measured min / max**: [-0.3946, -0.2810, -0.5059] / [0.6435, 0.4046, 0.2651]
- **Inferred real-world target (m)**: 0.51 x 0.34 x 0.38 — vanjska jedinica klime (kondenzator)
- **Recommended scale (per-model)**: `[0.4913, 0.4959, 0.4929]`

## Not sourced — still primitive geometry

### Radijator (radiator)

**No CC0 radiator model was found.** Verified, not assumed:

- Poly Pizza has 16 results for `radiator`; every one is **CC-BY 3.0** (Poly by Google
  archive), none CC0. Searches for `panel radiator`, `towel radiator`, `convector`,
  `central heating` and `wall unit heating` returned no CC0 radiator either.
  https://poly.pizza/search/radiator
- Sketchfab's downloadable + CC0 pool returns **0 results** for `radiator` via the
  public API (`https://api.sketchfab.com/v3/search?type=models&q=radiator&downloadable=true&license=cc0`).
  The same query for `chair` returns results, so the query itself is sound — the CC0
  pool is mostly museum scans and simply has no radiators.
- Poly Haven's model library contains no building fixtures at all
  (https://api.polyhaven.com/assets?type=models).
- Kenney's Furniture Kit has no radiator; Quaternius' Ultimate House Interior Pack has none.

`towel-rail.glb` (Kay Lousberg, CC0) is included as the nearest bathroom fitting, but it
is a **towel bar with a hanging towel, not a heated towel rail**. Do not label it a radiator.

### Klima — indoor wall split unit

**No CC0 indoor wall-mounted split unit was found.** The only CC0 air conditioners on
Poly Pizza are two Quaternius models, and both are **outdoor condenser units**
(https://poly.pizza/m/amFuyE3IF6 and https://poly.pizza/m/0MdE89Ijtt). One of them
is shipped here as `ac-outdoor-unit.glb` and is named honestly. Sketchfab's CC0
downloadable pool returns 0 results for `air conditioner`. The indoor split unit should
stay a primitive box — it is a rounded rectangular slab, which primitive geometry
actually models well.

## Sources evaluated and rejected

| Source | Result |
| --- | --- |
| Poly Haven (models, CC0) | No fixtures of any kind. Library is props, furniture-as-decor, plants, tools. https://api.polyhaven.com/assets?type=models |
| Khronos glTF-Sample-Assets | No fixtures. 140 dirs are engine conformance tests plus showcase props (DamagedHelmet, Sponza, ToyCar). https://github.com/KhronosGroup/glTF-Sample-Assets |
| ambientCG | PBR materials and HDRIs, not fixtures. Its `Door001` is a texture set, not a model. CC0, useful for room surfaces. https://ambientcg.com/view?id=Door001 |
| Sketchfab CC0 filter | Downloadable CC0 pool is dominated by museum photogrammetry (100k-700k faces). 0 toilets, 0 radiators, 0 ACs. Also needs an account to download, so it cannot be automated. |
| Kenney furniture-kit.zip | The kit itself is the right source, but the ZIP bundles FBX + OBJ + 2D sprites. Poly Pizza serves the same CC0 models as individual GLBs, which is smaller and build-step-free. https://kenney.nl/assets/furniture-kit |
| Quaternius (quaternius.com) | Site offers FBX/OBJ/blend for the House Interior pack. Poly Pizza carries the same CC0 models pre-converted to GLB. https://quaternius.com/packs/ultimatehomeinterior.html |

