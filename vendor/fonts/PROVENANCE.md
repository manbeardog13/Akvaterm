# Vendored web fonts — provenance

Recorded 2026-08-02. All files were fetched with `Invoke-WebRequest` from
`fonts.gstatic.com` (the Google Fonts static asset host) using URLs obtained from the
Google Fonts CSS API v2 (`https://fonts.googleapis.com/css2`) with a current Chrome
user agent, which is what makes the API emit `woff2`.

These files are **vendored**. Nothing in the application may reference
`fonts.googleapis.com` or `fonts.gstatic.com` at runtime.

Every file below was verified to begin with the ASCII signature `wOF2`
(WOFF 2.0 magic number).

## Licences

| Family | Licence | Licence text | Upstream |
| --- | --- | --- | --- |
| Anton | SIL Open Font License 1.1 | <https://raw.githubusercontent.com/google/fonts/main/ofl/anton/OFL.txt> | <https://github.com/googlefonts/AntonFont> |
| Figtree | SIL Open Font License 1.1 | <https://raw.githubusercontent.com/google/fonts/main/ofl/figtree/OFL.txt> | <https://github.com/erikdkennedy/figtree> |

Copyright lines from the upstream `OFL.txt` files:

- `Copyright 2020 The Anton Project Authors (https://github.com/googlefonts/AntonFont.git)`
- `Copyright 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree)`

The SIL OFL permits bundling, embedding and redistribution, including in commercial
products, provided the fonts are not sold on their own and the licence text travels
with them. Both licence texts are vendored here and must ship with the app:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `OFL-Anton.txt` | 4484 | `ee67e6ee22790b7929f1a3769ca2801d565c64b5a9096942c1adf5596de9c9e4` |
| `OFL-Figtree.txt` | 4388 | `140d37233e7f3ce7313798befa9600893bcceaf41a55fa0fa5ad52f7f657a268` |

## Display family — Anton, weight 400 (the only weight Anton ships)

Google Fonts version tag: `v27`.

| File | Subset | Bytes | SHA-256 | Source URL |
| --- | --- | ---: | --- | --- |
| `anton-latin-400-normal.woff2` | latin | 18612 | `d0fa07ff63dd60cbc0e2f58e29c802dca2a5ae0276c999f59c6111ab7bbaec3b` | <https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3Kz-C8.woff2> |
| `anton-latin-ext-400-normal.woff2` | latin-ext | 31356 | `0d17b7880f389deeb6663a52fa4eadc6d9116bdda725f0aa1f3d404fbb7d3d59` | <https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3K9-C8QSw.woff2> |

## Text family — Figtree

Google Fonts version tag: `v9`.

### Variable axis file (recommended — covers wght 300–900)

| File | Subset | Bytes | SHA-256 | Source URL |
| --- | --- | ---: | --- | --- |
| `figtree-latin-wght-normal.woff2` | latin | 20156 | `4ba7d3d096695818fe0686be4f1e82c6b05134e18a22260336130335027462dd` | <https://fonts.gstatic.com/s/figtree/v9/_Xms-HUzqDCFdgfMm4S9DQ.woff2> |
| `figtree-latin-ext-wght-normal.woff2` | latin-ext | 10280 | `bf7828e2c258cffcfa50a048ee388a36b95bc16b452e8d36fa797635dbe15965` | <https://fonts.gstatic.com/s/figtree/v9/_Xms-HUzqDCFdgfMm4q9DbZs.woff2> |

### Static instances (fallback if the variable file is not wanted)

| File | Subset | Weight | Bytes | SHA-256 | Source URL |
| --- | --- | ---: | ---: | --- | --- |
| `figtree-latin-400-normal.woff2` | latin | 400 | 11384 | `8f98dd642986f1fa39c45b89665a57372897c235b36028e0e4a136e43dc5f8ab` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_d_QG5ZyEA.woff2> |
| `figtree-latin-ext-400-normal.woff2` | latin-ext | 400 | 6188 | `3f58126100ed4da09c54adcfb8fa9f642be69101d1e18dc4c0a5489ee9b904c5` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_d_QG5XyEAk4A.woff2> |
| `figtree-latin-500-normal.woff2` | latin | 500 | 11432 | `953a6a4294b1205a1b4d4b9e5529478e8c9e1c5a67a9aa24a551414cd85b6f51` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_dNQG5ZyEA.woff2> |
| `figtree-latin-ext-500-normal.woff2` | latin-ext | 500 | 6156 | `65f0ca6dc939a76e0d63fd7b1fae1039d0a8963d2ce68a00ec20122a452e3b08` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_dNQG5XyEAk4A.woff2> |
| `figtree-latin-600-normal.woff2` | latin | 600 | 11544 | `367d713287918784702563518f59239989da815c80d3c7337686b9816635a08b` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_ehR25ZyEA.woff2> |
| `figtree-latin-ext-600-normal.woff2` | latin-ext | 600 | 6240 | `066f04a662a3b3f740f2e711548003e12c2475375e58a59477aa440c8fd03a17` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_ehR25XyEAk4A.woff2> |
| `figtree-latin-700-normal.woff2` | latin | 700 | 11376 | `7ec4f08d09f91d349917dd6592f6aaae66d8fe1bbd58fa24707961e79236616e` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_eYR25ZyEA.woff2> |
| `figtree-latin-ext-700-normal.woff2` | latin-ext | 700 | 6172 | `b3252ef48dfbfc51b2e7eecb4de8414dec694c4c83a16ef7afd319796235ef72` | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_eYR25XyEAk4A.woff2> |

Total: 12 files, 150896 bytes.

## Croatian coverage verification

The Croatian letters `č ć ž š đ Č Ć Ž Š Đ` live in Latin Extended-A
(U+0106/0107, U+010C/010D, U+0110/0111, U+0160/0161, U+017D/017E), so the
**`latin-ext` slice is mandatory** — the `latin` slice alone would render tofu.

Coverage was verified by downloading the unsubsetted TrueType build of each family
from the Google Fonts CSS API v1 (legacy user agent, `subset=latin,latin-ext`) and
parsing its `cmap` table directly:

| Family | Full TTF | Glyphs present in U+0100–U+017F | All 10 Croatian letters |
| --- | --- | ---: | --- |
| Anton | <https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3K9-Co.ttf> | 128 / 128 | yes |
| Figtree | <https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_d_QG5XyEU.ttf> | 109 / 128 | yes |

Neither family encodes the deprecated precomposed digraphs U+01C4 `DŽ` / U+01C6 `dž`.
This is not a defect: Croatian `dž`, `lj` and `nj` are written as two ordinary
letters, and those compatibility codepoints should not appear in application text.

### Verification of the vendored files themselves

The check above proves the *upstream families* contain the letters. To prove the
*downloaded slices* do, each `.woff2` in this directory was Brotli-decompressed and
its `cmap` table parsed directly (WOFF2 leaves `cmap` untransformed, so it can be read
straight out of the decompressed stream):

| File | Codepoints in cmap | U+0100–U+017F | Croatian letters |
| --- | ---: | ---: | --- |
| `anton-latin-400-normal.woff2` | 232 | 3 / 128 | none — by design |
| `anton-latin-ext-400-normal.woff2` | 570 | 125 / 128 | **all 10 present** |
| `figtree-latin-*-normal.woff2` (each) | 222 | 4 / 128 | none — by design |
| `figtree-latin-ext-*-normal.woff2` (each) | 136 | 106 / 128 | **all 10 present** |
| `figtree-latin-wght-normal.woff2` | 222 | 4 / 128 | none — by design |
| `figtree-latin-ext-wght-normal.woff2` | 136 | 106 / 128 | **all 10 present** |

The three-codepoint gap between the full font and the `latin-ext` slice is U+0131 `ı`,
U+0152 `Œ` and U+0153 `œ`, which Google assigns to the `latin` slice.

**Consequence: shipping only the `latin` files would render every Croatian diacritic
as tofu.** Both slices of both families must be deployed together.

The `unicode-range` values in `fonts.css` are copied verbatim from the Google Fonts
CSS API response for these exact files, so the browser requests the right slice.

---

## Sora + Inter — added 2026-08-02 (the house pairing)

Operator instruction: the ASC platform's font collection becomes the standard
for this and every future project. See `docs/HOUSE_STANDARD.md`.

Fetched the same way as the families above: `https://fonts.googleapis.com/css2`
with a current Chrome user agent (which is what makes the API emit `woff2`),
then the `fonts.gstatic.com` URLs out of the returned CSS. Every file was
verified to begin with the ASCII signature `wOF2`.

Both families are served as **variable** fonts. Requesting weights 600;700
(Sora) and 400;500;600;700 (Inter) returns twelve `@font-face` blocks but only
FOUR distinct files — the per-weight URLs are byte-identical, confirmed by
SHA-256. They are vendored once each under a `-wght-` name, matching the
existing Figtree variable files, and declared with a weight RANGE.

| Family | Licence | Upstream |
| --- | --- | --- |
| Sora | SIL Open Font License 1.1 | <https://github.com/lafgroup/Sora> |
| Inter | SIL Open Font License 1.1 | <https://github.com/rsms/inter> |

Google Fonts version tags: Sora `v17`, Inter `v20`.

| File | Subset | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `sora-latin-wght-normal.woff2` | latin | 25284 | `811e11966d29f3a01fcb19b087b61ac067d380665a55aebb7fcdf2cda95e4a93` |
| `sora-latin-ext-wght-normal.woff2` | latin-ext | 12156 | `08e1ba85bcb55277782f56766af09467dfe18cbeea49704203100c5797ac4cc5` |
| `inter-latin-wght-normal.woff2` | latin | 48256 | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` |
| `inter-latin-ext-wght-normal.woff2` | latin-ext | 85068 | `34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956` |

The OFL requires the licence to travel with the fonts, so both texts are
vendored here and must ship with the app:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `OFL-Sora.txt` | 4385 | `ba0b9729c9428ba79a0459ab8ec575791b51509dbec213e383d0316d37fec299` |
| `OFL-Inter.txt` | 4377 | `5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57` |

Copyright lines from the upstream `OFL.txt` files:

- `Copyright 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font)`
- `Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)`

### Anton and Figtree are still here on purpose

They are no longer the app's faces. Figtree remains because the **wordmark** is
exempt from the palette and the type change and is pinned to it through
`--font-wordmark`; removing the files would silently re-face the logo. Anton is
retained only so the change is revertible in one commit.
