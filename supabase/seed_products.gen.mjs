// Generates supabase/seed_products.sql from data/catalog.seed.json.
//
// A DEV tool, like the Supabase CLI — plain node, no dependencies, never loaded
// by the app at runtime. Run from the project root after editing the seed
// catalog, then commit both files:
//
//   node supabase/seed_products.gen.mjs > supabase/seed_products.sql
import { readFileSync } from "node:fs";

const products = JSON.parse(readFileSync("data/catalog.seed.json", "utf8"));

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const nullable = (v, fn = q) => (v === null || v === undefined || v === "" ? "null" : fn(v));
const num = (v) => (v === null || v === undefined ? "null" : String(v));

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

// Croatian colour word for a hex value — the vocabulary Terma's search_products
// tool is told to use (bijela / siva / bez / antracit / drvo …).
function colorTag(hex) {
  const c = hexToHsl(hex);
  if (!c) return null;
  const { h, s, l } = c;
  if (l >= 0.86) return "bijela";
  if (l <= 0.16) return "crna";
  if (s < 0.12) return l < 0.42 ? "antracit" : "siva";
  if (h < 20 || h >= 330) return "crvena";
  if (h < 46) return l >= 0.58 ? "bez" : "smeda";
  if (h < 70) return "zuta";
  if (h < 165) return "zelena";
  if (h < 255) return "plava";
  return "ljubicasta";
}

const KIND_TAG = {
  marble: "mramor", travertine: "travertin", concrete: "beton",
  woodPlank: "drvo", terrazzo: "teraco", metal: "metal", subway: "bijela",
};

function tagsFor(p) {
  const tags = new Set();
  for (const hex of [p.baseColorHex, p.accentColorHex]) {
    const tag = colorTag(hex);
    if (tag) tags.add(tag);
  }
  const kind = KIND_TAG[p.textureKind];
  if (kind) tags.add(kind);
  if (p.glossy) tags.add("sjajna"); else if (p.category === "keramika") tags.add("mat");
  return [...tags];
}

const rows = products.map((p) => {
  const size = Array.isArray(p.tileSizeMm) && p.tileSizeMm.length === 2
    ? `array[${Number(p.tileSizeMm[0])},${Number(p.tileSizeMm[1])}]::int[]`
    : "null";
  const tags = tagsFor(p);
  const tagLiteral = tags.length ? `array[${tags.map(q).join(",")}]::text[]` : `'{}'::text[]`;
  return "  (" + [
    q(p.id), q(p.category), q(p.name), nullable(p.brand), q(p.textureKind),
    q(p.baseColorHex), nullable(p.accentColorHex), size,
    p.glossy ? "true" : "false", num(p.priceM2), num(p.priceUnit), q(p.unit),
    q(p.desc), tagLiteral, p.demo === false ? "false" : "true",
  ].join(", ") + ")";
});

const counts = {};
for (const p of products) counts[p.category] = (counts[p.category] || 0) + 1;

process.stdout.write(`-- ============================================================================
-- Akvaterm Platform — demo catalog seed for the \`products\` table.
-- ----------------------------------------------------------------------------
-- Run this AFTER supabase/schema.sql, in the same place:
--   Supabase dashboard -> SQL Editor -> New query -> paste all -> Run
--
-- Without it the \`products\` table is empty, and Terma's server-side
-- search_products tool returns nothing — the advisor answers but never shows
-- product cards. The client itself does NOT need this: js/db.js reads
-- data/catalog.seed.json directly, which is why the app works with zero setup.
--
-- ${products.length} demo products (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}).
-- Safe to re-run: ON CONFLICT (id) DO UPDATE refreshes every column.
--
-- GENERATED from data/catalog.seed.json — do not hand-edit. Regenerate after
-- changing the seed catalog:  node supabase/seed_products.gen.mjs > supabase/seed_products.sql
-- color_tags are derived from baseColorHex/accentColorHex/textureKind because
-- the JSON seed has no such field; they are what Terma's colorTag filter
-- matches against.
-- ============================================================================

insert into products (
  id, category, name, brand, texture_kind, base_color_hex, accent_color_hex,
  tile_size_mm, glossy, price_m2, price_unit, unit, description, color_tags, demo
) values
${rows.join(",\n")}
on conflict (id) do update set
  category         = excluded.category,
  name             = excluded.name,
  brand            = excluded.brand,
  texture_kind     = excluded.texture_kind,
  base_color_hex   = excluded.base_color_hex,
  accent_color_hex = excluded.accent_color_hex,
  tile_size_mm     = excluded.tile_size_mm,
  glossy           = excluded.glossy,
  price_m2         = excluded.price_m2,
  price_unit       = excluded.price_unit,
  unit             = excluded.unit,
  description      = excluded.description,
  color_tags       = excluded.color_tags,
  demo             = excluded.demo,
  deleted_at       = null;

-- Expect: ${products.length}
select count(*) as seeded_products from products where deleted_at is null;
`);
