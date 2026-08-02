# vendor/qr — QR encoder (vendored)

`qrcode.mjs` is **qrcode-generator 1.4.4** by Kazuhiko Arase, MIT licensed, vendored per
`docs/BUILD_CONTRACTS.md` ("nothing from npm at runtime except vendored files under /vendor/").
No build step, no runtime dependency, no CDN.

| | |
|---|---|
| Upstream | `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js` |
| Upstream bytes | 56 694 |
| Upstream SHA-256 | `18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780` |
| Vendored as | `vendor/qr/qrcode.mjs` (58 381 bytes = upstream + header + ESM shim) |
| Licence | MIT (full notice retained inside the file) |

## What was changed

Nothing inside the upstream source. `qrcode.mjs` is the upstream file **byte-for-byte**, with a
provenance header prepended and a two-line `export` block appended below the `ESM SHIM` marker.

The upstream file is UMD. Inside an ES module its trailing factory is inert (`define` and
`exports` are both undefined there) and its single top-level `var qrcode` is module-scoped, so the
export is the entire shim. It runs unmodified under ES-module strict mode — the source contains no
`with`, no legacy octal literals, no `arguments.callee` and no `eval`.

## Re-vendoring

```sh
curl -sSL -o qrcode-upstream.js https://cdn.jsdelivr.net/npm/qrcode-generator@<version>/qrcode.js
sha256sum qrcode-upstream.js          # record it in the table above
# rebuild qrcode.mjs = header + qrcode-upstream.js + ESM shim, then:
node --check vendor/qr/qrcode.mjs
```

Do not hand-edit the upstream region. If a fix is needed, re-download and re-append the shim.

## API

```js
import qrcode from "../vendor/qr/qrcode.mjs";

qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];  // upstream default is single-byte
const qr = qrcode(0, "M");   // 0 = auto-pick the smallest version that fits
qr.addData(text);
qr.make();                   // throws "code length overflow" when the payload is too long
qr.getModuleCount();         // n, the QR is n x n modules
qr.isDark(row, col);         // true = draw a dark module
```

The only consumer is `js/qrshare.js`. Both are listed in the service-worker `SHELL` so the share
panel works offline.

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
