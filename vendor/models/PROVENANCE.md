# vendor/models — provenance and scaling

Every file in this directory is a **binary glTF 2.0 (.glb)**, self-contained, downloaded
2026-08-02.

**Licence is no longer uniform across this directory. Read this before shipping.**

Most files here are CC0 1.0 / public domain: commercial use allowed, no attribution
required in the app, and their credits below are a courtesy record rather than a licence
obligation. **Two files are not.**

**`radiator-panel.glb` and `ac-indoor-split.glb` are CC-BY 3.0 and carry a real,
enforceable attribution obligation.** If either is rendered in the app, the app **must**
display the credit line recorded in its entry below. Every other file's entry states its
own licence — trust the per-file entry, not a blanket assumption.

Those two were taken knowingly: a radiator and an indoor split unit are Akvaterm's actual
trade, no CC0 model of either exists (the searches proving that are recorded below), and
CC-BY 3.0 expressly permits commercial use and redistribution. If the attribution notice
is ever unacceptable, delete those two files and fall back to primitive geometry — do not
silently drop the credit.

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

### Radijator (radiator) — RESOLVED 2026-08-02, but under CC-BY, not CC0

**The finding below still stands: no CC0 radiator exists.** It was re-tested independently
on 2026-08-02 with different queries and a better method, and the conclusion did not change.
The gap was then closed with a **CC-BY 3.0** model instead — see `radiator-panel.glb` in the
[Heating, cooling and dining batch](#heating-cooling-and-dining-radijator-klima-blagovaonica--added-2026-08-02).

Original finding, verified, not assumed:

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

**Re-test 2026-08-02 — new searches, so nobody runs them a third time.** Poly Pizza embeds
a `window.__SERVER_APP_STATE__` JSON blob on every search and model page carrying an
authoritative `licence` field, so these results are read from the site's own data rather
than from rendered text or a search-engine snippet:

- `radiator`, `heater`, `convector`, `boiler`, `water heater`, `water tank` — the only CC0
  hit across all six is Kenney's `Corrugated Iron Sheet`, plus stoves and washers. **No CC0
  radiator, and no CC0 domestic water heater (bojler) either.**
- Non-English terms `radiateur` (11 results) and `heizkorper` (12 results) — again only
  Kenney's `Corrugated Iron Sheet` is CC0. Croatian `radijator` is not a Poly Pizza index term.
- Sketchfab CC0 + downloadable re-queried for `radiator`, `heating` and `boiler`. `radiator`
  still returns **0**. `heating` and `boiler` return only museum photogrammetry
  (60k–1.6M faces: a Roman hypocaust duct, a ship's boiler, a vodka still) — unusable on
  every axis: wrong object, wrong style, ~100x the size budget.
- Quaternius' **Ultimate Furniture Pack** — a pack the first pass never checked — was
  enumerated. It has tables, chairs and stools but **no radiator and no boiler**.

`towel-rail.glb` (Kay Lousberg, CC0) remains a **towel bar with a hanging towel, not a
heated towel rail**. Do not label it a radiator.

### Klima — indoor wall split unit — RESOLVED 2026-08-02, but under CC-BY, not CC0

**The finding below still stands: no CC0 indoor split unit exists.** The gap was closed with
a **CC-BY 3.0** model instead — see `ac-indoor-split.glb` in the
[Heating, cooling and dining batch](#heating-cooling-and-dining-radijator-klima-blagovaonica--added-2026-08-02).

Original finding: the only CC0 air conditioners on Poly Pizza are two Quaternius models, and
both are **outdoor condenser units** (https://poly.pizza/m/amFuyE3IF6 and
https://poly.pizza/m/0MdE89Ijtt). One of them is shipped here as `ac-outdoor-unit.glb` and is
named honestly. Sketchfab's CC0 downloadable pool returns 0 results for `air conditioner`.

**Re-test 2026-08-02.** Searches for `split air conditioner`, `wall mounted AC` and `aircon`
confirm it: the only CC0 air conditioners indexed anywhere on Poly Pizza are still those same
two Quaternius outdoor units. Every candidate that is actually an indoor wall unit is CC-BY.
All nine Poly-by-Google `Air conditioner` / `Radiator` / `Heater` entries were inspected
**visually**, by downloading each model's preview render rather than trusting its title —
which matters, because the titles are unreliable: `4m3lja-ZCkA` is an outdoor condenser,
`3a3MIdsS17a` is an industrial fan heater labelled "SUPER WINDY 2000", `d_Wp5slO_2u` is a
cylindrical air purifier, and `ftrnBGmhoFz`, titled "Radiator", is a **portable oil-filled
electric heater on castors** — not a central-heating radiator at all.

### Bojler — domestic water heater

**No CC0 domestic water heater was found, and none was shipped.** Searched `boiler`,
`water heater` and `water tank` on Poly Pizza with the authoritative licence field: the CC0
results are cooking stoves, washers, dryers, and Quaternius/Kay Lousberg **industrial**
tanks and water towers. Quaternius' `Water Tank` (https://poly.pizza/m/XVB8vUbnZb) was
checked visually and rejected — it is an elevated industrial tank on a steel lattice frame
with an external pipe, not a wall-hung domestic bojler. Sketchfab CC0 `boiler` returns a
ship's boiler and a distillery still. **This gap is still open.** A bojler is a plain
vertical cylinder or a flat rectangular slab, so primitive geometry models it acceptably;
that is the recommended fallback until a CC0 model appears.

## Sources evaluated and rejected

| Source | Result |
| --- | --- |
| Poly Haven (models, CC0) | No fixtures of any kind. Library is props, furniture-as-decor, plants, tools. https://api.polyhaven.com/assets?type=models |
| Khronos glTF-Sample-Assets | No fixtures. 140 dirs are engine conformance tests plus showcase props (DamagedHelmet, Sponza, ToyCar). https://github.com/KhronosGroup/glTF-Sample-Assets |
| ambientCG | PBR materials and HDRIs, not fixtures. Its `Door001` is a texture set, not a model. CC0, useful for room surfaces. https://ambientcg.com/view?id=Door001 |
| Sketchfab CC0 filter | Downloadable CC0 pool is dominated by museum photogrammetry (100k-700k faces). 0 toilets, 0 radiators, 0 ACs. Also needs an account to download, so it cannot be automated. |
| Kenney furniture-kit.zip | The kit itself is the right source, but the ZIP bundles FBX + OBJ + 2D sprites. Poly Pizza serves the same CC0 models as individual GLBs, which is smaller and build-step-free. https://kenney.nl/assets/furniture-kit |
| Quaternius (quaternius.com) | Site offers FBX/OBJ/blend for the House Interior pack. Poly Pizza carries the same CC0 models pre-converted to GLB. https://quaternius.com/packs/ultimatehomeinterior.html |


---

# Living room (dnevni boravak) — added 2026-08-02

Twelve further **binary glTF 2.0 (.glb)** files, all **CC0 1.0 / public domain**, all from
**Kenney's Furniture Kit** — the same pack that supplies most of the bathroom and kitchen
models above, so the visual family is identical by construction rather than by judgement.

The named gap this batch closes is the **sofa**: the living-room scene had no seating at all.

## Verification performed on this batch

- First four bytes of all 12 files are the ASCII magic `glTF` — checked, all 12 pass.
- glTF container version 2, and the header `length` field equals the file size — all 12 pass.
- `extensionsRequired` and `extensionsUsed` are **empty** in every file, and no buffer or
  image uses an external `uri`. All 12 have zero embedded images (flat vertex-coloured
  materials). **three.js `GLTFLoader` alone loads all of these.**
- Every file was rendered-checked against its Poly Pizza preview image before being kept,
  so each one is confirmed to actually be the object its title claims.
- Bounding boxes were **measured**, not estimated, with a dependency-free Node script
  (`node:fs` only) that parses the GLB chunks, walks the scene graph from `scenes[scene].nodes`,
  composes each node's TRS-or-matrix transform into a world matrix, and transforms the eight
  corners of every primitive's POSITION accessor `min`/`max` into world space.
  The same script was run against `toilet.glb`, `bathtub.glb` and `window-large.glb` and
  reproduced the figures already recorded above **exactly**, which is what validates it.
- Total added by this batch: **216 236 bytes (211 KB)** across 12 files.

## Lounge seating — use one shared scale

`sofa`, `sofa-corner`, `sofa-design` and `armchair` are authored on a **common grid**
(depth 0.41 and back height 0.46 are identical across all four; the armchair is exactly
half the sofa's width). Apply the **same** scale vector to all four so seat heights, arm
heights and depths line up when they share a room:

```js
const LOUNGE_RUN_SCALE = new THREE.Vector3(1.8367, 1.8478, 2.1951);
// -> armchair    0.90 x 0.85 x 0.90  (fotelja)
// -> sofa        1.80 x 0.85 x 0.90  (dvosjed)
// -> sofa-design 2.06 x 0.74 x 0.90  (trosjed, niski naslon)
// -> sofa-corner 1.80 x 0.85 x 2.15  (kutna garnitura; krak po Z je duzi)
```

The vector is derived from the armchair: 0.90/0.49, 0.85/0.46, 0.90/0.41. Because the X and
Z factors differ, `sofa-corner`'s square footprint becomes rectangular — its Z arm ends up
longer than its X arm. That is realistic for a corner unit, but do not assume the two arms
are equal.

## Pivot warning for this batch

Nine of the twelve use the **Kenney corner pivot** described further up: X runs from
`-width` to `0`, Z from `0` to `+depth`, Y from `0` up. Three do not:

- `tv.glb` and `potted-plant.glb` are **centred** on X and Z (origin under the object's axis).
- `coffee-table.glb` and `floor-lamp.glb` have an **arbitrary interior offset** — neither a
  corner nor the centre.

Every file in this batch sits on `Y = 0`, so none needs a vertical lift. The
**Footprint centre** line on each record below gives the model-unit offset from the origin
to the centre of the footprint; subtract it to centre the piece on a room coordinate.

## Files

### `sofa.glb`

- **Source page**: https://poly.pizza/m/jMu2iCmGxU
- **Direct download**: https://static.poly.pizza/f47310a0-4d22-48a3-a2ce-62f67bcc998d.glb
- **Original asset name**: Lounge Sofa (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 19384 bytes
- **SHA-256**: `606b37242383d7b56e53847a444dfd47abf7522d10671f62813473ee9b2ba3a1`
- **Triangles**: 256 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.9800 x 0.4600 x 0.4100 (X x Y x Z)
- **Measured min / max**: [-0.9800, 0.0000, 0.0000] / [0.0000, 0.4600, 0.4100]
- **Footprint centre**: [-0.4900, 0.0000, 0.2050] — Kenney corner pivot
- **Inferred real-world target (m)**: 1.80 x 0.85 x 0.90 — dvosjed (2-sjed), s naslonima za ruke
- **Recommended scale (shared LOUNGE_RUN_SCALE)**: `[1.8367, 1.8478, 2.1951]`

### `sofa-design.glb`

- **Source page**: https://poly.pizza/m/xYNuGPF9wK
- **Direct download**: https://static.poly.pizza/c9239576-bf6c-4f2d-b706-ad8d92093161.glb
- **Original asset name**: Lounge Design Sofa (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 17772 bytes
- **SHA-256**: `5fd843acd15c4a1ef449040ab3a7907ebb9d72cf465b6677b6de9006395beecb`
- **Triangles**: 232 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 1.1200 x 0.4000 x 0.4100 (X x Y x Z)
- **Measured min / max**: [-1.1200, 0.0000, 0.0000] / [0.0000, 0.4000, 0.4100]
- **Footprint centre**: [-0.5600, 0.0000, 0.2050] — Kenney corner pivot
- **Inferred real-world target (m)**: 2.06 x 0.74 x 0.90 — trosjed, moderni niski naslon
- **Recommended scale (shared LOUNGE_RUN_SCALE)**: `[1.8367, 1.8478, 2.1951]`

### `sofa-corner.glb`

- **Source page**: https://poly.pizza/m/a42mSc6w2U
- **Direct download**: https://static.poly.pizza/e78c10a3-58e6-400b-a576-c5db78c2d30f.glb
- **Original asset name**: Lounge Sofa Corner (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 26588 bytes
- **SHA-256**: `156b3644482b8cb30db0ef1dab42a6b12e548ed7a9cda8bf907d7ce18114bd49`
- **Triangles**: 380 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.9800 x 0.4600 x 0.9800 (X x Y x Z)
- **Measured min / max**: [-0.9800, 0.0000, 0.0000] / [0.0000, 0.4600, 0.9800]
- **Footprint centre**: [-0.4900, 0.0000, 0.4900] — Kenney corner pivot
- **Inferred real-world target (m)**: 1.80 x 0.85 x 2.15 — kutna garnitura, L-oblik
- **Recommended scale (shared LOUNGE_RUN_SCALE)**: `[1.8367, 1.8478, 2.1951]`

### `armchair.glb`

- **Source page**: https://poly.pizza/m/RY93lbAIFg
- **Direct download**: https://static.poly.pizza/21d3c956-0747-422c-b06d-6d4392380384.glb
- **Original asset name**: Lounge Chair (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 19448 bytes
- **SHA-256**: `20380f25e5b8890dff7ab2b5310882b1caba472603a3527803aa2896a3567380`
- **Triangles**: 256 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4900 x 0.4600 x 0.4100 (X x Y x Z)
- **Measured min / max**: [-0.4900, 0.0000, 0.0000] / [0.0000, 0.4600, 0.4100]
- **Footprint centre**: [-0.2450, 0.0000, 0.2050] — Kenney corner pivot
- **Inferred real-world target (m)**: 0.90 x 0.85 x 0.90 — fotelja; ovaj model definira LOUNGE_RUN_SCALE
- **Recommended scale (shared LOUNGE_RUN_SCALE)**: `[1.8367, 1.8478, 2.1951]`

### `coffee-table.glb`

- **Source page**: https://poly.pizza/m/y4ZU5S7RuD
- **Direct download**: https://static.poly.pizza/68c4bcbd-0c5d-42ee-ab91-4cce6672fa18.glb
- **Original asset name**: Coffee Table (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 14864 bytes
- **SHA-256**: `744d72a41c75e3435c17025a98ad91d0774b596aff69c81500c02bd8a59d2dc0`
- **Triangles**: 248 | materials: 1 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.6610 x 0.2300 x 0.4000 (X x Y x Z)
- **Measured min / max**: [-0.2000, 0.0000, -0.1000] / [0.4610, 0.2300, 0.3000]
- **Footprint centre**: [0.1305, 0.0000, 0.1000] — **not** a corner pivot; origin sits inside the footprint
- **Inferred real-world target (m)**: 1.10 x 0.42 x 0.60 — klub stolic
- **Recommended scale (per-model)**: `[1.6641, 1.8261, 1.5000]`

### `tv.glb`

- **Source page**: https://poly.pizza/m/9trLeWoBek
- **Direct download**: https://static.poly.pizza/1ddcd36c-ac9e-4dc2-a056-846cea033c02.glb
- **Original asset name**: Television (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 12688 bytes
- **SHA-256**: `9faacaba2b76f8b5582cd00a567ca5d1703933478c55fa53219fc8043525383c`
- **Triangles**: 144 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.6848 x 0.4548 x 0.1284 (X x Y x Z)
- **Measured min / max**: [-0.3424, 0.0000, -0.0642] / [0.3424, 0.4548, 0.0642]
- **Footprint centre**: [0.0000, 0.0000, 0.0000] — **centred** on X and Z, unlike most Kenney pieces
- **Inferred real-world target (m)**: 1.23 x 0.78 x 0.25 — televizor ~55", ravni ekran na postolju; visina ukljucuje postolje
- **Recommended scale (per-model)**: `[1.7961, 1.7150, 1.9470]`

### `tv-cabinet.glb`

- **Source page**: https://poly.pizza/m/AL6wwiUgP3
- **Direct download**: https://static.poly.pizza/7281f563-73a5-4907-ae55-7ede647c4e0e.glb
- **Original asset name**: Cabinet Television (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 18956 bytes
- **SHA-256**: `26523c5cc575980975aa62814604e7b80beb03e0fef8d88a3d9458708f6e5be1`
- **Triangles**: 308 | materials: 1 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.8000 x 0.3100 x 0.2500 (X x Y x Z)
- **Measured min / max**: [-0.8000, 0.0000, 0.0000] / [0.0000, 0.3100, 0.2500]
- **Footprint centre**: [-0.4000, 0.0000, 0.1250] — Kenney corner pivot
- **Inferred real-world target (m)**: 1.60 x 0.45 x 0.40 — TV komoda, otvorena s dvije police
- **Recommended scale (per-model)**: `[2.0000, 1.4516, 1.6000]`

### `bookshelf.glb`

- **Source page**: https://poly.pizza/m/MTH8ZwnA27
- **Direct download**: https://static.poly.pizza/867fee8d-2b89-4383-92f9-58660a76d29a.glb
- **Original asset name**: Bookcase Open (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 31896 bytes
- **SHA-256**: `c37b34a2d36d3f7583ab1cd28555078c5d4840f1d38341cdce9cc1222e1b7d25`
- **Triangles**: 640 | materials: 1 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4000 x 0.8800 x 0.2500 (X x Y x Z)
- **Measured min / max**: [-0.4000, 0.0000, 0.0000] / [0.0000, 0.8800, 0.2500]
- **Footprint centre**: [-0.2000, 0.0000, 0.1250] — Kenney corner pivot
- **Inferred real-world target (m)**: 0.80 x 1.80 x 0.30 — regal / polica za knjige. **Otvorena konstrukcija bez ledja i bez knjiga** — cetiri police na okviru, ne zatvoreni ormar. Ne prikazuj ga uza zid kao punu vitrinu.
- **Recommended scale (per-model)**: `[2.0000, 2.0455, 1.2000]`

### `rug-rectangle.glb`

- **Source page**: https://poly.pizza/m/k5oJLb49gw
- **Direct download**: https://static.poly.pizza/bbccb6a6-5194-41fa-9614-f02d01879496.glb
- **Original asset name**: Rug Rectangle (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 7212 bytes
- **SHA-256**: `e8866844863cb64a3915ac0dc638fd3663f58c3f201ec20f1760f2043aab9386`
- **Triangles**: 56 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 1.5700 x 0.0100 x 0.9200 (X x Y x Z)
- **Measured min / max**: [-1.5700, 0.0000, 0.0000] / [0.0000, 0.0100, 0.9200]
- **Footprint centre**: [-0.7850, 0.0000, 0.4600] — Kenney corner pivot
- **Inferred real-world target (m)**: 2.00 x 0.01 x 1.40 — tepih pravokutni 200x140. Debljina 10 mm je vec realna, zato Y ostaje 1.0
- **Recommended scale (per-model)**: `[1.2739, 1.0000, 1.5217]`

### `rug-round.glb`

- **Source page**: https://poly.pizza/m/jeDDiN69Ze
- **Direct download**: https://static.poly.pizza/06a5cc94-d146-4ee6-8506-1be516dc4dbd.glb
- **Original asset name**: Rug Round (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 21820 bytes
- **SHA-256**: `6afb50e9ebc0dc683ff1b486cb2c971fbb5ab9b2ca31f878f9cf27bf5cdace27`
- **Triangles**: 376 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.9200 x 0.0100 x 0.9200 (X x Y x Z)
- **Measured min / max**: [-0.9200, 0.0000, 0.0000] / [0.0000, 0.0100, 0.9200]
- **Footprint centre**: [-0.4600, 0.0000, 0.4600] — Kenney corner pivot; **sredina diska nije u ishodistu**
- **Inferred real-world target (m)**: 1.60 x 0.01 x 1.60 — tepih okrugli, promjer 160. Debljina 10 mm je vec realna, zato Y ostaje 1.0
- **Recommended scale (per-model)**: `[1.7391, 1.0000, 1.7391]`

### `floor-lamp.glb`

- **Source page**: https://poly.pizza/m/8LiDIfXVLi
- **Direct download**: https://static.poly.pizza/98dd45a1-0682-4d44-83d1-32fa2a4fca5b.glb
- **Original asset name**: Lamp Round Floor (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 13200 bytes
- **SHA-256**: `66c669325a563ec4d9843a4c1e5a9f96c30abad13d0db710b4c00306e9cfbdc8`
- **Triangles**: 152 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.1520 x 0.8600 x 0.1756 (X x Y x Z)
- **Measured min / max**: [-0.1360, 0.0000, -0.0278] / [0.0160, 0.8600, 0.1478]
- **Footprint centre**: [-0.0600, 0.0000, 0.0600] — **not** a corner pivot and **not** centred; the lamp's vertical axis is offset from the origin
- **Inferred real-world target (m)**: 0.27 x 1.55 x 0.32 — podna (stojeca) lampa sa sesterokutnim sjenilom. X i Z se razlikuju jer je sjenilo sesterokut (1.155 = 2/sqrt(3), mjera preko vrhova naspram preko stranica), a ne zato sto je model iskrivljen — **skaliraj uniformno**
- **Recommended scale (per-model, uniform)**: `[1.8023, 1.8023, 1.8023]`

### `potted-plant.glb`

- **Source page**: https://poly.pizza/m/23Dx9CC95C
- **Direct download**: https://static.poly.pizza/6482596c-6423-415d-bfd5-e66bcc546642.glb
- **Original asset name**: Potted Plant (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 12408 bytes
- **SHA-256**: `533b5588b34e57ec27c72dcfc6a4dc76b8b39b48fff808e745dbb201842d6643`
- **Triangles**: 104 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.2121 x 0.6540 x 0.2415 (X x Y x Z)
- **Measured min / max**: [-0.1060, 0.0000, -0.1207] / [0.1060, 0.6540, 0.1207]
- **Footprint centre**: [0.0000, 0.0000, 0.0000] — **centred** on X and Z
- **Inferred real-world target (m)**: 0.31 x 0.95 x 0.35 — sobna biljka u tegli. Kao i kod lampe, X/Z razlika dolazi od sesterokutne tegle — **skaliraj uniformno**
- **Recommended scale (per-model, uniform)**: `[1.4526, 1.4526, 1.4526]`

## Living room — sources evaluated and rejected

| Source | Result |
| --- | --- |
| Poly Pizza — Poly-by-Google archive (CMHT Oculus, jeremy, Zsky, Danni Bittman, Alex Safayan, sirkitree, Francisco Hui, J-Toastie …) | **Rejected on licence.** These are the largest group of sofa/couch/armchair/TV/bookshelf hits and every one is **CC-BY 3.0**, not CC0. CC-BY is usable but creates a per-model attribution obligation that the rest of `vendor/models` does not carry, and the header of this file states outright that no attribution is required in the app. A CC0 equivalent existed for all eight requested items, so there was no reason to take on that obligation. |
| Poly Haven — models library | **Rejected on format and size.** The library does contain `Sofa_01`, `sofa_02`, `sofa_03`, `ArmChair_01`, `CoffeeTable_01`, `wooden_bookshelf_worn`, `potted_plant_01/02/04` (521 models total, checked via https://api.polyhaven.com/assets?type=models). But https://api.polyhaven.com/files/Sofa_01 shows it ships **`.gltf` plus 4 separate side files**, never a single `.glb` — there is no build step here to bundle them. Even the smallest 1k variant is 0.49 MB (Sofa_01) to 6.02 MB (potted_plant_01, which alone would exhaust the whole budget), and the assets are photoreal PBR, the wrong visual family for this set. |
| Khronos glTF-Sample-Assets | **Rejected on size and extensions.** It does have furniture, contrary to the earlier note above: `GlamVelvetSofa` (3.00 MB), `SheenWoodLeatherSofa` (9.64 MB), `SheenChair` (3.93 MB), `ChairDamaskPurplegold`. These are material-extension showcases requiring `KHR_materials_sheen` / `KHR_materials_specular`, which breaks the "`extensionsRequired` is empty, `GLTFLoader` alone" guarantee this directory maintains. `SheenWoodLeatherSofa` on its own is larger than the entire asset budget. |
| Sketchfab, CC0 + downloadable filter | **Rejected — nothing usable.** Queried the public API directly: `sofa` → **0 results**, `bookshelf` → **0 results**, `couch` → 1 result ("1943.68 Mule-Head Attachment for a Couch", a museum scan, 95 000 faces, not furniture), `armchair` → 3 results at 150 000–473 000 faces. The CC0 pool is museum photogrammetry. Downloading also needs an account, so it cannot be automated. |
| Kenney.nl `furniture-kit.zip` (direct) | **Not used, though it is the correct upstream.** The kit page (https://kenney.nl/assets/furniture-kit) confirms the licence — "Creative Commons CC0" — and lists 140 files, but the ZIP bundles FBX/OBJ and 2D sprites rather than GLB. Poly Pizza serves the same CC0 Kenney models already converted to individual GLBs, which is smaller and build-step-free. Same reasoning as the kitchen/bathroom batch above. |
| Quaternius & CreativeTrio sofas on Poly Pizza (CC0) | **Viable, deliberately not used.** `Sofa`/`Couch Medium`/`Couch Small`/`L Couch` (Quaternius) and `Couch`/`Armchair` (CreativeTrio) are genuine CC0 GLBs and would have been acceptable. They were passed over only so the whole lounge group shares Kenney's single authoring grid, which is what makes one `LOUNGE_RUN_SCALE` possible. If a different sofa silhouette is ever wanted, these are the first place to look. |


---

# Heating, cooling and dining (radijator, klima, blagovaonica) — added 2026-08-02

Seven further **binary glTF 2.0 (.glb)** files. This batch closes the two gaps this file had
recorded as unfilled — the **radiator** and the **indoor split AC** — and adds the dining
group the kitchen scene was missing.

**Five of the seven are CC0 1.0** (Kenney, Furniture Kit — the same pack and the same
authoring grid as most of the bathroom, kitchen and lounge models above, so the visual family
is identical by construction rather than by judgement).

**Two are CC-BY 3.0 and carry an attribution obligation**: `radiator-panel.glb` and
`ac-indoor-split.glb`. Read the next section before shipping either.

## Attribution required — CC-BY files

This is the only part of `vendor/models` that imposes a runtime obligation on the app.

CC BY 3.0 states, verbatim, that you are free to **"copy and redistribute the material in any
medium or format for any purpose, even commercially"** and to **"remix, transform, and build
upon the material for any purpose, even commercially"**, on one condition —
**"You must give appropriate credit, provide a link to the license, and indicate if changes
were made."** (https://creativecommons.org/licenses/by/3.0/)

So the app must render these two credit lines wherever it renders third-party notices — an
"about", "credits" or "licences" panel is sufficient; it does not have to sit next to the
model:

```text
"Radiator" by Poly by Google — https://poly.pizza/m/4XJ-DH66eKY
  licensed under CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/
  Geometry unmodified; scaled to real-world dimensions at runtime.

"Air conditioner" by Poly by Google — https://poly.pizza/m/5KohLH0xc8d
  licensed under CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/
  Geometry unmodified; scaled to real-world dimensions at runtime.
```

Both `.glb` files are **byte-identical to the upstream download** — only the filename was
changed. The "indicate if changes were made" clause is nonetheless satisfied honestly above,
because the room designer applies a non-uniform runtime scale, which is arguably an adaptation.

**Why the obligation was accepted rather than avoided.** Every other gap in this directory was
closed with CC0. These two could not be: repeated, independent searches (recorded in the two
gap notes above) establish that **no CC0 radiator and no CC0 indoor split unit exist** on any
source reachable without an account. A radiator is not a decorative nicety here — Akvaterm's
business is heating installation, so it is the single most on-brand object in the catalogue.
The trade is: one credit line in an about panel, versus the app's core product being a grey box.

## Verification performed on this batch

- First four bytes of all 7 files are the ASCII magic `glTF` — checked, all 7 pass.
- glTF container version 2, and the header `length` field equals the file size — all 7 pass.
- `extensionsRequired` and `extensionsUsed` are **empty** in every file, and no buffer or image
  uses an external `uri`. Textures, where present, are embedded in the BIN chunk. **three.js
  `GLTFLoader` alone loads all seven — no DRACOLoader, no KTX2Loader, no meshopt decoder,
  no sidecar files.**
- Bounding boxes were **measured**, not estimated, with the same no-dependency Node GLB parser
  used for the earlier batches: it walks the scene graph, composes every node transform (TRS or
  `matrix`), and transforms the eight corners of each primitive's POSITION accessor min/max into
  world space. It was re-run against `toilet.glb` as a control first and reproduced that file's
  already-published figures exactly (0.3126 x 0.4510 x 0.4772), which is what makes these
  numbers comparable to the ones above.
- Licences were read from Poly Pizza's own `window.__SERVER_APP_STATE__` payload — the site's
  authoritative `licence` field — **and** cross-checked against the licence URL rendered on each
  model page. No licence in this batch was taken from a search-result snippet.
- Model identity was verified **visually**: every candidate's preview render was downloaded and
  inspected before selection, because the upstream titles are unreliable (see the Klima gap note).
- Total added by this batch: **214 568 bytes (≈ 210 KiB)** across 7 files.

## Pivot warning for this batch

The five Kenney files follow the corner-pivot convention documented at the top of this file —
X runs from `-width` to `0`, Z from `0` to `+depth`, Y from `0` up — **with one exception**:

- **`bar-stool-square.glb` does not touch the origin on either horizontal axis.** Its X runs
  `-0.2095 … -0.0560` and its Z runs `+0.0411 … +0.1888`. It is the only file in this directory
  whose pivot is offset on both X and Z, so placing it by raw coordinate will shift it
  noticeably. Compensate with the `min` values below.

The two CC-BY files use a different convention again:

- **`radiator-panel.glb`** is **centred on X** (`-57.1430 … +57.1430`) and **centred on Z**,
  sitting on `Y ≈ 0`. It behaves like a normal floor-standing object.
- **`ac-indoor-split.glb`** is **centred on X** but its origin sits **inside the body vertically**
  (`Y` runs `-128.1926 … +115.0000`). Roughly 53 % of its height hangs **below** the origin,
  because the bbox includes the downward air-deflector vane. To hang it at 2.2 m, place the
  origin at about 2.2 m and expect the unit to extend below that, not above it.

Note the units: the two Poly-by-Google models are authored in **centimetre-like units**, not
metres — the radiator measures 114 x 78 x 20 model units. That is why their scale vectors are
~0.001 while the Kenney ones are ~2.0. This is expected, not a mistake.

## Dining group — pairing note

`dining-table` + `dining-chair` are sized to pair at the scales below (0.75 m table height,
0.45 m seat). `bar-stool` and `bar-stool-square` are both scaled to a **0.75 m seat height**,
which is the correct pairing for `kitchen-bar-counter` at its 1.05 m target — not for the
0.90 m kitchen worktop. If you want stools at the worktop instead, scale their Y to 0.65 m.

`kitchen-bar-counter.glb` is authored on the **same 0.43 grid as the eight kitchen modules**, so
its X scale (`1.3953`) is deliberately identical to `KITCHEN_RUN_SCALE.x` and it lines up with
the run. Only its Y differs, to lift it from worktop height to bar height.

## Files

### `radiator-panel.glb`

- **Source page**: https://poly.pizza/m/4XJ-DH66eKY
- **Direct download**: https://static.poly.pizza/c2ffd73c-1861-4588-8241-5872cec1a251.glb
- **Original asset name**: Radiator
- **Author**: Poly by Google — https://poly.pizza/u/Poly%20by%20Google
- **Licence**: **CC-BY 3.0 — ATTRIBUTION REQUIRED** — https://creativecommons.org/licenses/by/3.0/ — source page states verbatim: "Creative Commons Attribution"; the site's own licence field reads verbatim: "CC-BY 3.0". Credit line is mandatory — see [Attribution required](#attribution-required--cc-by-files)
- **Size on disk**: 81580 bytes
- **SHA-256**: `d873caf90d890c01f9c3fd08d51ca235e8628def04f68aea0436021871f63c3c`
- **Triangles**: 3600 | materials: 1 | embedded images: 1 | generator: obj2gltf
- **Measured bbox (model units)**: 114.2860 x 77.7995 x 19.5156 (X x Y x Z)
- **Measured min / max**: [-57.1430, 0.0002, -9.7578] / [57.1430, 77.7998, 9.7578]
- **Footprint centre**: [0.0000, —, 0.0000] — **centred** on X and Z; sits on Y ≈ 0
- **Inferred real-world target (m)**: 1.00 x 0.70 x 0.10 — panelni radijator tip 22, 1000 mm sirine; ukupna visina s nogicama ~0.70 m (sam panel ~0.60 m). **Authored in centimetre-like units** — hence the ~0.009 scale
- **Recommended scale (per-model)**: `[0.0087500, 0.0089975, 0.0051241]`
- **Note**: a genuine white panel radiator with fins and a thermostatic valve — verified from the source preview render, not from the title. This is the on-brand Akvaterm object

### `ac-indoor-split.glb`

- **Source page**: https://poly.pizza/m/5KohLH0xc8d
- **Direct download**: https://static.poly.pizza/f9ea0838-5f11-4107-acfa-e44a8e52eff6.glb
- **Original asset name**: Air conditioner
- **Author**: Poly by Google — https://poly.pizza/u/Poly%20by%20Google
- **Licence**: **CC-BY 3.0 — ATTRIBUTION REQUIRED** — https://creativecommons.org/licenses/by/3.0/ — source page states verbatim: "Creative Commons Attribution"; the site's own licence field reads verbatim: "CC-BY 3.0". Credit line is mandatory — see [Attribution required](#attribution-required--cc-by-files)
- **Size on disk**: 44592 bytes
- **SHA-256**: `fd43f31ff791207988e6c25e710b862c691f2f9ca311b6649c4c4bd2e9a98e06`
- **Triangles**: 236 | materials: 1 | embedded images: 1 | generator: obj2gltf
- **Measured bbox (model units)**: 1000.0000 x 243.1926 x 139.1370 (X x Y x Z)
- **Measured min / max**: [-500.0000, -128.1926, -92.5000] / [500.0000, 115.0000, 46.6370]
- **Footprint centre**: [0.0000, —, -22.9315] — **centred** on X; origin sits **inside** the body on Y
- **Inferred real-world target (m)**: 0.80 x 0.28 x 0.20 — unutarnja zidna jedinica klime (split); montaza na ~2.2 m. **Authored in centimetre-like units**
- **Recommended scale (per-model)**: `[0.0008000, 0.0011514, 0.0014374]`
- **Note**: this is the **indoor wall unit** the earlier gap note said did not exist in any licence. It does exist — just not under CC0. Upstream tags it `#heater #dehumidifier #water heater`, but the render is unambiguously a wall-mounted split indoor unit. Pairs with `ac-outdoor-unit.glb`

### `dining-table.glb`

- **Source page**: https://poly.pizza/m/41R2HTYj1O
- **Direct download**: https://static.poly.pizza/b8daa8f9-78f0-4897-b22a-2561f804779e.glb
- **Original asset name**: Table (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 14588 bytes
- **SHA-256**: `3adce498a9ec1774ba9f606980148291fb1112fe3f6ef42adbcea9a009432189`
- **Triangles**: 240 | materials: 1 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.8415 x 0.3267 x 0.4474 (X x Y x Z)
- **Measured min / max**: [-0.8415, 0.0000, 0.0000] / [0.0000, 0.3267, 0.4474]
- **Inferred real-world target (m)**: 1.40 x 0.75 x 0.80 — blagovaonski stol za 6 osoba
- **Recommended scale (per-model)**: `[1.6637, 2.2957, 1.7881]`

### `dining-chair.glb`

- **Source page**: https://poly.pizza/m/vHyrBYPBum
- **Direct download**: https://static.poly.pizza/fca1766a-cc7b-4e22-a60f-49689446bd46.glb
- **Original asset name**: Chair (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 19156 bytes
- **SHA-256**: `29280c1d2a18024ae783b9fa31212fc4e9cbac8b9c835b8b6a8c6cad4f0e0cb2`
- **Triangles**: 340 | materials: 1 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.2000 x 0.4700 x 0.2000 (X x Y x Z)
- **Measured min / max**: [-0.2000, 0.0000, 0.0000] / [0.0000, 0.4700, 0.2000]
- **Inferred real-world target (m)**: 0.45 x 0.90 x 0.45 — blagovaonska stolica; sjediste na ~0.45 m, naslon do 0.90 m
- **Recommended scale (per-model)**: `[2.2500, 1.9149, 2.2500]`

### `bar-stool.glb`

- **Source page**: https://poly.pizza/m/2do92chR2k
- **Direct download**: https://static.poly.pizza/92b747ab-ed11-47f4-bcfb-a218b0b7e439.glb
- **Original asset name**: Bar Stool (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 22180 bytes
- **SHA-256**: `cd1c5263dbe82825bca1b18dc53e9e3a478ffceeb6da8d1cd77dc7ea6379059b`
- **Triangles**: 352 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.2654 x 0.4350 x 0.2299 (X x Y x Z)
- **Measured min / max**: [-0.2654, 0.0000, 0.0000] / [0.0000, 0.4350, 0.2299]
- **Inferred real-world target (m)**: 0.35 x 0.75 x 0.35 — barska stolica, okruglo sjediste na 0.75 m
- **Recommended scale (per-model)**: `[1.3188, 1.7241, 1.5224]`

### `bar-stool-square.glb`

- **Source page**: https://poly.pizza/m/2EwBIClO8u
- **Direct download**: https://static.poly.pizza/fea46325-5200-445c-8c65-7c1145a5158c.glb
- **Original asset name**: Stool Bar Square (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 18588 bytes
- **SHA-256**: `9f4f143d215d70de9fcd4274d5b32ae286aabc2d4121f379276928b56594faef`
- **Triangles**: 284 | materials: 2 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.1535 x 0.4050 x 0.1476 (X x Y x Z)
- **Measured min / max**: [-0.2095, 0.0000, 0.0411] / [-0.0560, 0.4050, 0.1888]
- **Inferred real-world target (m)**: 0.32 x 0.75 x 0.32 — barska stolica, kvadratno sjediste na 0.75 m
- **Recommended scale (per-model)**: `[2.0847, 1.8519, 2.1680]`
- **PIVOT EXCEPTION**: the only file in this directory offset from the origin on **both** horizontal axes — X does not reach 0 (`-0.2095 … -0.0560`) and Z starts at `+0.0411`. Compensate with `min`, or it will not sit where you place it

### `kitchen-bar-counter.glb`

- **Source page**: https://poly.pizza/m/w00V8SbhYD
- **Direct download**: https://static.poly.pizza/fc56a7ea-263f-4cef-ba5e-e5c7ffaa999d.glb
- **Original asset name**: Kitchen Bar (Furniture Kit)
- **Author**: Kenney — https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/ — source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 13884 bytes
- **SHA-256**: `ec24557b542c996835294841297d82388c7f5fe1b10ade836fe39454272f9904`
- **Triangles**: 152 | materials: 3 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.4200 x 0.2100 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0000] / [0.0000, 0.4200, 0.2100]
- **Inferred real-world target (m)**: 0.60 x 1.05 x 0.40 — barski pult / sank uz kuhinju
- **Recommended scale (per-model)**: `[1.3953, 2.5000, 1.9048]`
- **Note**: X measures exactly 0.4300, the **same authoring grid as the eight kitchen modules**, so the X scale is deliberately identical to `KITCHEN_RUN_SCALE.x` and the counter lines up with the run. Apply `KITCHEN_RUN_SCALE` unchanged instead if you want it at 0.90 m worktop height rather than 1.05 m bar height

## Heating, cooling and dining — sources evaluated and rejected

| Source | Result |
| --- | --- |
| Poly Pizza CC0 pool, for a radiator | **Nothing exists.** Re-tested with `radiator`, `heater`, `convector`, `boiler`, `water heater`, `water tank`, and the non-English `radiateur` and `heizkorper`. Across all eight the only CC0 hit is Kenney's `Corrugated Iron Sheet`. Read from the site's authoritative `licence` field, not from rendered text. |
| Sketchfab, CC0 + downloadable filter | **Rejected — nothing usable.** `radiator` → **0 results** (re-confirmed; a `chair` control query returns results, so the query is sound). `heating` and `boiler` return only museum photogrammetry at 60k–1.6M faces — a Roman hypocaust duct, a ship's boiler, a vodka still. Wrong object, wrong visual family, and ~100x over budget. |
| Quaternius **Ultimate Furniture Pack** | **Checked for the first time — no radiator, no boiler.** The first pass never examined this pack, so it was enumerated in full. It has tables, chairs and stools, all CC0 and all viable, but nothing for heating. The dining pieces were taken from Kenney instead purely so the whole group shares one authoring grid with the existing kitchen run. |
| Poly Pizza, `Radiator` by Poly by Google (`ftrnBGmhoFz`) | **Rejected on the object, not the licence.** Same CC-BY 3.0 terms as the model that was taken, and it would have been acceptable, but the preview render shows a **portable oil-filled electric heater on castors** — a plug-in appliance, not central heating. `4XJ-DH66eKY` is the true wall panel radiator and is the one shipped. |
| Poly Pizza, other `Air conditioner` entries by Poly by Google | **Rejected on the object.** All CC-BY 3.0 and all inspected visually: `4m3lja-ZCkA` and `12XRJPQ0Pur` are outdoor condensers, `3a3MIdsS17a` is an industrial fan heater labelled "SUPER WINDY 2000", `d_Wp5slO_2u` is a cylindrical air purifier, and `4QIvBdpceB-` is the same wall unit as the one taken but with its deflector vanes modelled detached and floating. `5KohLH0xc8d` is the clean one. |
| Poly Pizza, `Air Conditioner` by J-Toastie (`zvwMPbf7tN`) | **Rejected on licence and budget.** CC-BY 3.0 like the others, but at 4300 triangles it is the heaviest candidate in the category and no better as an object than the 236-triangle model taken instead. |
| Quaternius `Water Tank` (`XVB8vUbnZb`), as a bojler stand-in | **Rejected on the object.** Genuinely CC0 and only 864 triangles, but the preview shows an **elevated industrial tank on a steel lattice frame** with an external outlet pipe. Nothing like a wall-hung domestic bojler. Shipping it under that name would have been mislabelling. |
| Meshy (`meshy.ai/tags/radiator`) | **Rejected — provenance and consistency.** Advertises CC0 GLB radiators, but the assets are AI-generated on demand rather than a fixed, citable, human-authored library. There is no stable source page to record, no author to credit, and no guarantee that a given file stays byte-identical or keeps its licence. It is also the wrong visual family for a Kenney/Quaternius set. |
| TurboSquid / CGTrader / Free3D / Open3dModel | **Rejected on licence.** These dominate a plain web search for "free radiator 3D model", but "free" there means zero-price, not open-licence — the terms are proprietary per-item EULAs that generally forbid redistributing the source asset in a public repository. Exactly the licence risk this directory exists to avoid. |

## Kitchen completion and general scene dressing

Added 2026-08-02. Same verification as the rest of this file: first four bytes are the
ASCII magic `glTF`, container version 2, header `length` equals file size,
`extensionsRequired` empty, no buffer or image uses an external `uri`. Bounding boxes
were **measured** with a dependency-free GLB parser that walks the scene graph, composes
every node transform and transforms the eight corners of each accessor's POSITION
min/max into world space â€” the same method used for the records above, not three.js and
not an estimate. Every licence below was read off the model's own Poly Pizza page, which
renders the string `Public Domain (CC0)` next to a link to the CC0 1.0 deed.

### The worktop question â€” answered honestly

**There is no CC0 model of a bare continuous worktop slab.** That was the thing being
looked for and it does not exist; the flat-slab workaround in the kitchen scene is still
the only way to cap the Kenney base-cabinet run.

What does exist is a *different* kitchen family â€” Isa Lousberg's `Countertop *` models â€”
in which the worktop is **modelled as part of each module**: a wood-toned carcass with a
distinct white top that overhangs the front and both sides, so butting two modules
together produces one visually unbroken white worktop line with no seam and no separate
slab. Three pieces are vendored here (`kitchen-counter-straight`, `-corner`, `-sink`).

This family is an **alternative to** the Kenney run, not an addition to it. Do not mix
them: the Kenney modules have no top of their own and are authored on a 0.43 x 0.45 x 0.45
grid, whereas these carry their own top and are authored on a 2.0 x 1.0 x 1.5 grid. Pick
one family per kitchen.

Because the three pieces share one grid, give them one shared scale so the white tops
stay coplanar and equally thick:

```js
// Horizontal factor is uniform, so square modules stay square and the
// worktop slab reads at a constant thickness across the whole run.
const COUNTER_RUN_SCALE = new THREE.Vector3(0.3996, 0.9000, 0.3996);
// -> straight 0.80 W x 0.90 H x 0.60 D, corner 0.70 x 0.90 x 0.70,
//    sink 0.80 W x 0.60 D with the worktop at 0.90
```

Note the module pitch that follows from this is **0.80 m, not the 0.60 m** of the Kenney
run. A layout routine written against `KITCHEN_RUN_SCALE` will not lay these out correctly.

### `kitchen-counter-straight.glb`

- **Source page**: https://poly.pizza/m/ipDw2lbUn2
- **Direct download**: https://static.poly.pizza/89a38a16-0f3a-421c-9d38-f2948a417d2f.glb
- **Original asset name**: Countertop Straight
- **Author**: Isa Lousberg â€” https://poly.pizza/u/Isa%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 44560 bytes
- **SHA-256**: `ec121f4602703e96c2ced35e75683ebeecbf8c805d03ea0332d3e8d708c7f070`
- **Triangles**: 546 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 2.0000 x 1.0000 x 1.5013 (X x Y x Z)
- **Measured min / max**: [-1.0000, 0.0000, -0.7500] / [1.0000, 1.0000, 0.7513]
- **Footprint centre**: [0.0000, 0.0000, 0.0006] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.80 x 0.90 x 0.60 â€” radna ploha + donji element, ravni modul; bijela ploha se nastavlja preko susjednih modula
- **Recommended scale (per-model)**: `[0.3996, 0.9000, 0.3997]`

### `kitchen-counter-corner.glb`

- **Source page**: https://poly.pizza/m/td8H3M8XYn
- **Direct download**: https://static.poly.pizza/54030c15-1e21-4dbb-91de-fe45609c8393.glb
- **Original asset name**: Countertop Corner
- **Author**: Isa Lousberg â€” https://poly.pizza/u/Isa%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 27140 bytes
- **SHA-256**: `4b7f57758b9b70f4caf2ddef1e7935d9257c2314eea354ae0dd6fcbf154d4ccb`
- **Triangles**: 75 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.7500 x 1.0000 x 1.7500 (X x Y x Z)
- **Measured min / max**: [-0.7500, 0.0000, -0.7500] / [1.0000, 1.0000, 1.0000]
- **Footprint centre**: [0.1250, 0.0000, 0.1250] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.70 x 0.90 x 0.70 â€” radna ploha + kutni donji element; L-spoj dvaju ravnih modula
- **Recommended scale (per-model)**: `[0.3996, 0.9000, 0.3996]`

### `kitchen-counter-sink.glb`

- **Source page**: https://poly.pizza/m/Huo4qlZhHC
- **Direct download**: https://static.poly.pizza/e94f02f4-19da-4f0f-96ab-2f747595092d.glb
- **Original asset name**: Countertop Sink
- **Author**: Isa Lousberg â€” https://poly.pizza/u/Isa%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 77508 bytes
- **SHA-256**: `2f0d69eccc745ee0a3f4f74598df53db4b9caaf2c274b98362aaf831d776ba95`
- **Triangles**: 1308 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 2.0000 x 1.7579 x 1.5013 (X x Y x Z)
- **Measured min / max**: [-1.0000, 0.0000, -0.7500] / [1.0000, 1.7579, 0.7513]
- **Footprint centre**: [0.0000, 0.0000, 0.0006] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.80 x 1.58 x 0.60 â€” radna ploha + sudoper + slavina; ploha na 0.90, slavina do 1.58 (stilizirano visoka)
- **Recommended scale (per-model)**: `[0.3996, 0.8998, 0.3997]`

### `kitchen-microwave.glb`

- **Source page**: https://poly.pizza/m/vUsvf2HGDv
- **Direct download**: https://static.poly.pizza/69b6d111-3ae6-4f6d-8f23-4ded92a021ab.glb
- **Original asset name**: Kitchen Microwave (Furniture Kit)
- **Author**: Kenney â€” https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 21576 bytes
- **SHA-256**: `e5cf18193f6fcf16be715ecaaf67453bdaf5692b9c2a876aa890eab8fae03b5d`
- **Triangles**: 256 | materials: 4 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.2900 x 0.1800 x 0.2300 (X x Y x Z)
- **Measured min / max**: [-0.2900, 0.0000, -0.0100] / [0.0000, 0.1800, 0.2200]
- **Footprint centre**: [-0.1450, 0.0000, 0.1050] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.50 x 0.30 x 0.38 â€” mikrovalna pecnica, samostojeca na radnoj plohi
- **Recommended scale (per-model)**: `[1.7241, 1.6667, 1.6522]`

### `kitchen-hood-chimney.glb`

- **Source page**: https://poly.pizza/m/TbW8ISyRqM
- **Direct download**: https://static.poly.pizza/ff3d35e2-4493-455a-b883-eb0a30eeee7f.glb
- **Original asset name**: Extractor Hood
- **Author**: Isa Lousberg â€” https://poly.pizza/u/Isa%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 31820 bytes
- **SHA-256**: `c851d2e1bf513b1ae8e24a57710d8fe9d554cc825c9d3be96a18555e357b404f`
- **Triangles**: 212 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 2.0000 x 2.0000 x 1.6000 (X x Y x Z)
- **Measured min / max**: [-1.0000, -0.2000, 0.0000] / [1.0000, 1.8000, 1.6000]
- **Footprint centre**: [0.0000, -0.2000, 0.8000] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.60 x 0.60 x 0.48 â€” napa 60, dimnjak izvedba; kandidat za zamjenu kitchen-hood.glb
- **Recommended scale (per-model)**: `[0.3000, 0.3000, 0.3000]`

### `kitchen-stove-electric.glb`

- **Source page**: https://poly.pizza/m/x23QPXQpjP
- **Direct download**: https://static.poly.pizza/1709d7f0-4883-4d4e-b5f6-476874dc33c0.glb
- **Original asset name**: Kitchen Stove Electric (Furniture Kit)
- **Author**: Kenney â€” https://kenney.nl/assets/furniture-kit
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 44552 bytes
- **SHA-256**: `c15a55fb045a27521d269e97ace7cda83b206c9282d4ef1e74a05c8dbfefcf65`
- **Triangles**: 676 | materials: 6 | embedded images: 0 | generator: obj2gltf
- **Measured bbox (model units)**: 0.4300 x 0.4500 x 0.4500 (X x Y x Z)
- **Measured min / max**: [-0.4300, 0.0000, 0.0000] / [0.0000, 0.4500, 0.4500]
- **Footprint centre**: [-0.2150, 0.0000, 0.2250] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.60 x 0.90 x 0.60 â€” stednjak 60, staklokeramika; kandidat za zamjenu kitchen-stove.glb
- **Recommended scale (shared KITCHEN_RUN_SCALE)**: `[1.3953, 2.0000, 1.3333]`

### `ceiling-light.glb`

- **Source page**: https://poly.pizza/m/sRNcgQFbLB
- **Direct download**: https://static.poly.pizza/7f5240a6-e02a-4084-b899-8b84784cd76d.glb
- **Original asset name**: Ceiling Light
- **Author**: Quaternius â€” https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 8840 bytes
- **SHA-256**: `5a429947d77ab820605844864c4e4c3177407caacb373bc47359cafd45812dd4`
- **Triangles**: 196 | materials: 3 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.3608 x 1.0121 x 0.3571 (X x Y x Z)
- **Measured min / max**: [-0.1804, -1.0132, -0.1823] / [0.1804, -0.0011, 0.1749]
- **Footprint centre**: [0.0000, -1.0132, -0.0037] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.30 x 0.85 x 0.30 â€” viseca stropna svjetiljka; ishodiste na stropu, model visi prema dolje
- **Recommended scale (per-model)**: `[0.8315, 0.8398, 0.8401]`

### `chandelier.glb`

- **Source page**: https://poly.pizza/m/RPLTkXHOOM
- **Direct download**: https://static.poly.pizza/6e5a83ce-6631-4ba3-aff6-990c830a06df.glb
- **Original asset name**: Chandelier
- **Author**: CreativeTrio â€” https://poly.pizza/u/CreativeTrio
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 63780 bytes
- **SHA-256**: `364864357fedce3d7e3752bf5cf4c7d083ce56fa1f1167e0bf6539364c01162b`
- **Triangles**: 1204 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.7592 x 0.6683 x 0.7592 (X x Y x Z)
- **Measured min / max**: [-0.3789, 0.0000, -0.3765] / [0.3804, 0.6683, 0.3827]
- **Footprint centre**: [0.0008, 0.0000, 0.0031] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.60 x 0.53 x 0.60 â€” luster; ishodiste na DNU modela, tocka ovjesa je max Y
- **Recommended scale (per-model)**: `[0.7903, 0.7931, 0.7903]`

### `curtains-double.glb`

- **Source page**: https://poly.pizza/m/kkeII96j9N
- **Direct download**: https://static.poly.pizza/cf707f1b-8d82-467d-b89e-e4c1322f4515.glb
- **Original asset name**: Curtains Double
- **Author**: Quaternius â€” https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 13312 bytes
- **SHA-256**: `3e1c17ee803414382470f1316825005ba4808f5c665602f8223880b1578f76b9`
- **Triangles**: 320 | materials: 2 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 3.4688 x 4.3445 x 0.4765 (X x Y x Z)
- **Measured min / max**: [-1.6940, -0.0059, -0.3620] / [1.7748, 4.3386, 0.1144]
- **Footprint centre**: [0.0404, -0.0059, -0.1238] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 1.70 x 2.13 x 0.23 â€” zavjese, par na sipci â€” stvarna geometrija, ne tekstura
- **Recommended scale (per-model)**: `[0.4901, 0.4903, 0.4827]`

### `shelf-small.glb`

- **Source page**: https://poly.pizza/m/0REJqMlmSW
- **Direct download**: https://static.poly.pizza/18320cc3-d62c-402a-a56a-b8bec13f69f4.glb
- **Original asset name**: Shelf Small
- **Author**: Quaternius â€” https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 8828 bytes
- **SHA-256**: `d4b22996ad1cbccaa811489c41c51f89670091ec8c01795e5a67364c1434facc`
- **Triangles**: 132 | materials: 1 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.9443 x 0.5774 x 0.5504 (X x Y x Z)
- **Measured min / max**: [-0.9722, -0.0211, -0.2752] / [0.9722, 0.5563, 0.2752]
- **Footprint centre**: [0.0000, -0.0211, 0.0000] â€” **centred** on X and Z
- **Inferred real-world target (m)**: 0.95 x 0.28 x 0.27 â€” niska polica s pregradama
- **Recommended scale (per-model)**: `[0.4886, 0.4849, 0.4906]`

### `wall-painting.glb`

- **Source page**: https://poly.pizza/m/Pi6oReAizt
- **Direct download**: https://static.poly.pizza/c0fa9c78-2671-49d1-b057-9e974e2e1801.glb
- **Original asset name**: Painting
- **Author**: CreativeTrio â€” https://poly.pizza/u/CreativeTrio
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 24092 bytes
- **SHA-256**: `d6fe7714e95732f5a20d596110040ebe7d55ea008cb16eeab6fbc20d8fd31137`
- **Triangles**: 164 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.1909 x 0.0101 x 0.2679 (X x Y x Z)
- **Measured min / max**: [-0.0954, 0.0000, -0.1339] / [0.0954, 0.0101, 0.1339]
- **Footprint centre**: [0.0000, 0.0000, 0.0000] â€” **centred** on X and Z
- **Inferred real-world target (m)**: 0.40 x 0.02 x 0.56 â€” uokvirena slika; AUTORAN LEZECI â€” Y je debljina, Z je visina, treba rotacija -90 oko X
- **Recommended scale (per-model)**: `[2.0953, 1.9802, 2.0903]`

### `wall-corkboard.glb`

- **Source page**: https://poly.pizza/m/U8yQZ9l0HZ
- **Direct download**: https://static.poly.pizza/09cf2ec1-8b2c-4543-b773-962fba13aac5.glb
- **Original asset name**: Wall Corkboard
- **Author**: CreativeTrio â€” https://poly.pizza/u/CreativeTrio
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 23764 bytes
- **SHA-256**: `251ef29e18dfaff8d5aca202ae21bb8ddd6d4d6cd601cc2aa09d394cf41aca05`
- **Triangles**: 218 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.7626 x 0.5266 x 0.0306 (X x Y x Z)
- **Measured min / max**: [-0.3813, 0.0000, -0.0132] / [0.3813, 0.5266, 0.0174]
- **Footprint centre**: [0.0000, 0.0000, 0.0021] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.90 x 0.62 x 0.04 â€” plutena ploca s papiricima; vec je uspravna, Z je debljina
- **Recommended scale (per-model)**: `[1.1802, 1.1774, 1.1765]`

### `mirror-oval.glb`

- **Source page**: https://poly.pizza/m/2WQIUVj5qr
- **Direct download**: https://static.poly.pizza/827cad10-0407-4abe-b988-52984361f090.glb
- **Original asset name**: Mirror
- **Author**: Isa Lousberg â€” https://poly.pizza/u/Isa%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 34176 bytes
- **SHA-256**: `e6b0566ced73dcaff30eda4121cc362003a3bd2e4c6c72c4e9704595e4346f22`
- **Triangles**: 294 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.2600 x 1.5000 x 0.1000 (X x Y x Z)
- **Measured min / max**: [-0.6300, -0.7500, 0.0000] / [0.6300, 0.7500, 0.1000]
- **Footprint centre**: [0.0000, -0.7500, 0.0500] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.60 x 0.80 x 0.05 â€” ovalno zidno ogledalo, drugi stil uz bathroom-mirror.glb; ishodiste CENTRIRANO po X i Y
- **Recommended scale (per-model)**: `[0.4762, 0.5333, 0.5000]`

### `towel-folded.glb`

- **Source page**: https://poly.pizza/m/HE7whBjUwQ
- **Direct download**: https://static.poly.pizza/57600dab-7f90-45aa-823d-d6c8bb5f3aee.glb
- **Original asset name**: Towel Blue
- **Author**: Isa Lousberg â€” https://poly.pizza/u/Isa%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 25060 bytes
- **SHA-256**: `9716d024b47df2a291873a5c74565cbd18c831cf87c1c8fb6cc45b9e0674fbc2`
- **Triangles**: 60 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.6284 x 0.2000 x 0.6284 (X x Y x Z)
- **Measured min / max**: [-0.3142, 0.0000, -0.3142] / [0.3142, 0.2000, 0.3142]
- **Footprint centre**: [0.0000, 0.0000, 0.0000] â€” **centred** on X and Z
- **Inferred real-world target (m)**: 0.30 x 0.10 x 0.30 â€” jedan slozeni rucnik
- **Recommended scale (per-model)**: `[0.4774, 0.5000, 0.4774]`

### `towel-stacked.glb`

- **Source page**: https://poly.pizza/m/PqH2r2lqfc
- **Direct download**: https://static.poly.pizza/b6b80ef5-4809-445b-886c-8d39f4ac0fd9.glb
- **Original asset name**: Towel Stacked
- **Author**: Isa Lousberg â€” https://poly.pizza/u/Isa%20Lousberg
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 30660 bytes
- **SHA-256**: `8c10e2f133ca61dae4cdb043058c4637bd2c9636b6b104526567c56a05ffef81`
- **Triangles**: 180 | materials: 1 | embedded images: 1 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 0.8020 x 0.6000 x 0.8020 (X x Y x Z)
- **Measured min / max**: [-0.4010, 0.0000, -0.4010] / [0.4010, 0.6000, 0.4010]
- **Footprint centre**: [0.0000, 0.0000, 0.0000] â€” **centred** on X and Z
- **Inferred real-world target (m)**: 0.36 x 0.27 x 0.36 â€” hrpa od tri rucnika
- **Recommended scale (per-model)**: `[0.4489, 0.4500, 0.4489]`

### `towel-rack.glb`

- **Source page**: https://poly.pizza/m/8R9fXwL11r
- **Direct download**: https://static.poly.pizza/1748df2d-c41a-4815-81ef-a25a3ee29cbe.glb
- **Original asset name**: Towel Rack
- **Author**: Quaternius â€” https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 11568 bytes
- **SHA-256**: `05feb7f40b486b88ddcc9d4702da5184e493fd7b3dd4dcb453695642eac739b5`
- **Triangles**: 192 | materials: 3 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.1845 x 0.6538 x 0.1611 (X x Y x Z)
- **Measured min / max**: [-0.5609, -0.6214, -0.1266] / [0.6237, 0.0324, 0.0345]
- **Footprint centre**: [0.0314, -0.6214, -0.0460] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.60 x 0.33 x 0.08 â€” zidni drzac rucnika; ishodiste na sipci, rucnik visi prema dolje â€” kandidat za zamjenu towel-rail.glb
- **Recommended scale (per-model)**: `[0.5065, 0.5047, 0.4966]`

### `washing-machine.glb`

- **Source page**: https://poly.pizza/m/UFxsKNSl8W
- **Direct download**: https://static.poly.pizza/e6b5e36e-6541-47be-992e-9b3bf0196321.glb
- **Original asset name**: Washing Machine
- **Author**: Quaternius â€” https://quaternius.com/packs/ultimatehomeinterior.html
- **Licence**: CC0 1.0 Universal (public domain dedication) â€” https://creativecommons.org/publicdomain/zero/1.0/ â€” source page states verbatim: "Public Domain (CC0)"
- **Size on disk**: 16584 bytes
- **SHA-256**: `2fe7f503be82369606da54e2428c57244c8690f3d03592403ad7a60d4610d13a`
- **Triangles**: 304 | materials: 3 | embedded images: 0 | generator: FBX2glTF v0.9.7
- **Measured bbox (model units)**: 1.2919 x 1.4702 x 1.3237 (X x Y x Z)
- **Measured min / max**: [-0.6460, 0.0000, -0.6177] / [0.6460, 1.4702, 0.7061]
- **Footprint centre**: [0.0000, 0.0000, 0.0442] â€” origin is **offset** from the footprint centre; compensate on placement
- **Inferred real-world target (m)**: 0.60 x 0.85 x 0.60 â€” perilica rublja (NIJE perilica posuda)
- **Recommended scale (per-model)**: `[0.4644, 0.5782, 0.4533]`


## Kitchen completion â€” not sourced, and why

Each of these was searched for and **not found under a CC0 or otherwise
redistribution-safe licence**. Verified, not assumed.

### Continuous worktop slab as its own model

**Does not exist as CC0.** Every "countertop" hit on Poly Pizza is a counter *module*
(carcass plus top), never a bare slab. The nearest all-slab candidates were Quaternius'
`Counter Straight` / `Counter Corner` / `Counter End` / `Counter Door` / `Counter Doors` /
`Counter Drawers` (all genuinely CC0), but they are **rejected on style**: the whole model
is one wood tone, the top is the same colour as the carcass, and the silhouette is a
rustic/tavern counter. Next to Akvaterm's white sanitaryware they read as furniture from a
different game. Thumbnails were compared side by side before rejecting them. Use
`kitchen-counter-*` above, or keep the flat slab.

### Full kitchen island

**No CC0 kitchen island exists.** `https://poly.pizza/search/island` returns only
tropical/floating terrain â€” zero furniture. The closest CC0 object is Kenney's
`Kitchen Bar` (https://poly.pizza/m/w00V8SbhYD), a half-depth bar counter module measuring
0.43 x 0.42 x 0.21 model units. That is a bar front panel, not a four-sided island, and it
is **already vendored as `kitchen-bar-counter.glb`** by the concurrent living-room pass â€”
it was downloaded again here, found to be byte-identical by SHA-256, and the duplicate was
deleted rather than shipped twice.

### Dishwasher

**No CC0 dishwasher exists.** All six dishwasher results on Poly Pizza are CC-BY 3.0:
five from the Poly-by-Google archive (`4HlUpiwqtvs`, `4yl2TMOWhrH`, `5KeZIs4X8EX`,
`9InBWk5pY8e`, `5zpHN1-mjps`) and one from Zsky (`xiOSz5XdsF`). The Poly-by-Google page
states verbatim **"Creative Commons Attribution"** linking to
https://creativecommons.org/licenses/by/3.0/. CC-BY is redistributable and the concurrent
heating/cooling pass did accept it for two files it could not otherwise fill, but here a
CC0 kitchen was achievable without it, so the extra attribution obligation was declined
rather than incurred for convenience. Kenney's Furniture Kit and Quaternius' Ultimate House
Interior Pack contain no dishwasher. `washing-machine.glb` below is a **washing machine,
not a dishwasher** â€” do not relabel it.

### Standalone kitchen faucet / tap

**No CC0 standalone tap exists.** Poly Pizza's only standalone faucets are
`Faucet` (Poly by Google) and `Kitchen Sink Faucet` / `Bathroom Sink Faucet`
(Jarlan Perez), all **CC-BY 3.0**. Every CC0 tap is welded into a sink model. Two are
already available: `kitchen-counter-sink.glb` below carries a tall bridge tap, and the
existing `kitchen-sink-unit.glb` carries a short one. A tap that must move independently
of its sink has to stay primitive geometry â€” it is a cylinder and an elbow, which
primitives model well.

### Laundry basket / hamper

**No CC0 laundry basket exists.** `basket`, `hamper`, `laundry` and `clothes basket` were
all searched; the only hamper-shaped result is `Basket` by Poly by Google
(https://poly.pizza/m/a0umk-CRRwo), **CC-BY 3.0**. Kenney, Quaternius, Kay Lousberg, Isa
Lousberg and CreativeTrio have none.

### Wall art â€” CC0 found, CC-BY declined

Jarlan Perez's `Wall Art 01`â€“`07`, `Blank Picture Frame`, `Empty Picture Frame` and
`Abstract Art` are the largest and best-matched set of framed wall art on Poly Pizza, and
all are **CC-BY 3.0** â€” declined for the same reason as the dishwasher. CreativeTrio's
`Painting` and `Wall Corkboard` are CC0 and are vendored below instead.

## Kitchen and dressing â€” replacement candidates, not replacements

Per instruction, nothing already vendored was overwritten. These arrived under new names
so the swap stays a human decision:

| New file | Existing file it could replace | Comparison |
| --- | --- | --- |
| `towel-rack.glb` (Quaternius, 192 tri) | `towel-rail.glb` (Kay Lousberg, 180 tri) | **The clearest win.** The existing file's pivot is genuinely awkward â€” this file already warns that its bbox sits at Y 0.28â€“0.86 and Z 0.80â€“1.26, i.e. displaced almost a full model-unit forward of the origin, so placing it against a wall requires a hand-tuned offset. `towel-rack.glb` hangs cleanly downward from Y â‰ 0 (min Y â’0.6214, max Y 0.0324) with X centred, so the origin *is* the wall mounting point. Same object, same visual family, no offset needed. |
| `kitchen-hood-chimney.glb` (Isa Lousberg, 212 tri) | `kitchen-hood.glb` (Kenney, 72 tri) | The existing hood is the lowest-poly object in the whole directory at 72 triangles and reads as a plain angled box. The new one is a modern white chimney hood with a defined canopy and duct. It scales by a clean uniform 0.30. **Caveat:** it is Isa Lousberg white, so it matches `kitchen-counter-*` better than it matches the Kenney run. |
| `kitchen-stove-electric.glb` (Kenney, 676 tri) | `kitchen-stove.glb` (Kenney, 1604 tri) | Not better, **different** â€” a flat ceramic hob instead of a gas burner top, and less than half the triangles. Same Kenney grid, so it drops into `KITCHEN_RUN_SCALE` unchanged. Worth having as a second product, not necessarily as a replacement. |
| `mirror-oval.glb` (Isa Lousberg, 294 tri) | â€” (second style, added alongside `bathroom-mirror.glb`) | Not a replacement. `bathroom-mirror.glb` is a rectangular mirror with a shelf; this is a frameless oval. Usefully, its origin is **centred on X and Y**, unlike the corner-pivoted Kenney models, so it hangs at a wall coordinate directly. |
