# vendor/supabase — provenance

`@supabase/supabase-js` **2.111.0**, vendored 2026-08-02.

Source: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm` (jsDelivr's Rollup/esbuild
ESM build of `@supabase/supabase-js@2.111.0/dist/index.mjs`), plus the eight sub-bundles that
file imports.

jsDelivr's `+esm` entry is **not** self-contained: it imports its dependencies with absolute
CDN paths (`/npm/@supabase/auth-js@2.111.0/+esm`, …). Vendoring therefore means the whole
graph, with every `"/npm/<pkg>@<ver>/+esm"` specifier rewritten to the matching local file
under `deps/`:

| file | bytes |
| --- | --- |
| `supabase-js.mjs` | 11 820 |
| `deps/@supabase__auth-js@2.111.0.mjs` | 105 308 |
| `deps/@supabase__storage-js@2.111.0.mjs` | 45 048 |
| `deps/@supabase__realtime-js@2.111.0.mjs` | 32 436 |
| `deps/@supabase__phoenix@0.4.5.mjs` | 26 200 |
| `deps/@supabase__postgrest-js@2.111.0.mjs` | 16 601 |
| `deps/tslib@2.8.1.mjs` | 11 507 |
| `deps/iceberg-js@0.8.1.mjs` | 6 431 |
| `deps/@supabase__functions-js@2.111.0.mjs` | 3 443 |

Verified after rewriting: no `"/npm/…"` specifier and no bare specifier remains in any static
`import`/`export … from`; `node --check` passes on all nine files. The only dynamic import left
is `import("@opentelemetry/api")` inside supabase-js, which is already wrapped in
`.catch(() => null)` — it resolves to null in the browser and nothing else depends on it.

`js/supabaseClient.js` loads `./vendor/supabase/supabase-js.mjs` and never falls back to a CDN,
so the executed bytes are exactly the ones committed here (per
`docs/BUILD_CONTRACTS.md`: nothing from npm at runtime except vendored files under `/vendor/`).

## Upgrading

Re-run the same fetch for the new version, rewrite the `/npm/…/+esm` specifiers to `./deps/…`
filenames, re-run `node --check` on every file, update the table above, and bump the service
worker cache version.
