# Setup guide — Akvaterm Platform

This gets the platform running end-to-end: the static app, the shared Supabase
database, and **Terma** (the Gemini-powered advisor). It takes about 20 minutes.

**Important:** the app is designed to run with **zero setup** too — with an empty
`js/config.js` it works fully offline (demo catalog, localStorage favorites and
designs, Terma shows a static FAQ plus Akvaterm's phone number instead of live
chat). Do the steps below when you want the live advisor.

> ### What setup does and does not unlock
>
> **Does:** Terma's live chat, photo analysis, and her server-side catalog
> search (that last one needs step A.3 — seeding the `products` table).
>
> **Does not — yet:** *there is no sign-in screen in this app.* Nothing in
> `js/` calls `supabase.auth`, and there is no login, sign-up or profile route.
> So: favorites and saved designs stay **on the device**, in localStorage,
> configured or not; the `profiles`/roles machinery and the `quotes` table are
> dormant scaffolding waiting for an auth flow; and **AI staging is
> unreachable**, because the Edge Function refuses to spend money for a session
> it cannot name (it answers 401 `staging_requires_account`). None of this is
> broken — it is not built. Share a design across devices with the **QR / share
> link** instead; the link carries the whole design.

You'll do six things: **(A)** create and seed the database, **(B)** get a
Gemini key (read the key warning — it matters), **(C)** deploy the Terma
function, **(D)** connect the app, **(E)** run it, **(F)** deploy it.

> **Nothing here installs fonts, 3D libraries or 3D models.** They are already
> in the repo under `/vendor/` and are served from your own origin. The app
> makes **no** request to any third-party host at runtime — no
> `fonts.googleapis.com`, no `cdn.jsdelivr.net`. The only outbound call is to
> your Supabase project, and only once step D is filled in.

---

## A. Set up and seed the database (Supabase)

1. Go to **https://supabase.com** and sign up (free tier is plenty for a demo).
   Click **New project**.
   - Name it `akvaterm-platform`, set a database password (save it), pick a
     region near you (e.g. `eu-central-1`). Wait ~2 minutes.

2. In the left menu, open **SQL Editor** → **New query**.
   - Open `supabase/schema.sql` from this project, copy **all** of it, paste it
     into the query box, and click **Run**.
   - You should see "Success". This created the product catalog, favorites,
     designs and quotes tables, locked them down with Row Level Security
     (products are public-read; favorites and designs are owner-only), set up
     the audit log and soft-delete recycle bin, added the tables the Terma
     function uses to meter itself (`terma_usage`, `terma_conversations`),
     enabled the realtime publication for future use, and created a public
     **`product-images`** storage bucket. It is safe to re-run any time.
   - *If the very last block errored* (some projects restrict storage DDL):
     go to **Storage** → **New bucket**, name it exactly `product-images`, turn
     **Public** on, and create it. Everything else already ran.

3. **Seed the catalog — don't skip this.** Still in the SQL Editor, open a new
   query, paste **all** of `supabase/seed_products.sql`, and Run.
   - It inserts the 46 demo products and prints a count; you should see **46**.
   - Why it matters: Terma's `search_products` tool queries the `products`
     *table*, not the JSON file. Without this step she answers questions but
     **never shows product cards**, and smoke test E.2 below cannot pass.
   - The app itself does not need it — `js/db.js` reads
     `data/catalog.seed.json` directly, which is why the demo works with zero
     setup. This step exists purely so the server-side search has data.
   - The file is generated. If you change the seed catalog, regenerate it
     (plain node, no dependencies, dev-time only):

     ```sh
     node supabase/seed_products.gen.mjs > supabase/seed_products.sql
     ```

4. Get your two connection values. Left menu → **Project Settings** →
   **Data API** (or **API**).
   - Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
   - Copy the **anon / publishable** API key. This one is safe to ship in the
     client — the data stays protected by the RLS rules from step 2.

> **About accounts.** Browsing needs none: the catalog is public-read. And this
> version of the app offers no way to sign up or sign in at all, so in practice
> every visitor is anonymous. The `profiles` table, the admin/staff/customer
> roles and the owner-only policies are in place for when an auth flow is
> added. Nothing grants admin automatically — if you want one, create the
> account in the Supabase dashboard and then run, knowingly, once:
>
> ```sql
> update public.profiles set role = 'admin' where email = 'you@example.com';
> ```

---

## B. Get the Gemini key — read this part carefully

Terma talks to Google's Gemini API **only through the Edge Function** deployed
in step C. The key never appears in client code, in `config.js`, or in the repo.

**⚠ The September 2026 cutoff.** Google is retiring standard API keys: **all
standard Gemini API keys stop working in September 2026**. Do not set this
project up with a standard key "for now" — it would die mid-demo. Create a
**service-account-bound auth key** from day one:

1. In **Google Cloud Console** (console.cloud.google.com), create or pick a
   project and enable the **Gemini API** (a.k.a. Generative Language API).
2. **IAM & Admin** → **Service Accounts** → **Create service account** (name it
   e.g. `terma-advisor`), grant it the Gemini API user role.
3. Create an **auth key bound to that service account** for the Gemini API
   (AI Studio → API keys also offers the service-account-backed option). That
   key string is what goes into the secret below.

**Free vs. paid:**

- **Chat + photo analysis** (`gemini-3.6-flash`) run on the **free tier** —
  roughly a 10-requests-per-minute class. The app debounces and shows a
  friendly "busy" message on 429, so a demo fits comfortably.
- **AI staging** (`gemini-3.1-flash-image`) has **no free tier**. It needs
  Tier-1 billing enabled on the Google Cloud project and costs about **$0.067
  per staged render**. Because it spends real money per click, the Edge
  Function requires a **signed-in user** for it and meters it against a daily
  per-user quota — and since this version ships no sign-in, staging currently
  answers "AI impresija zahtijeva prijavu" and costs nothing. **You do not need
  billing for this setup.** Turn it on when an auth flow lands.
- Free-tier requests may be used by Google for product improvement. The app
  shows users a consent notice before any photo upload; if that ever becomes a
  concern for real customer photos, move vision to the paid tier.

---

## C. Deploy the Terma Edge Function

You need the [Supabase CLI](https://supabase.com/docs/guides/cli) installed
(`npm i -g supabase` or the standalone binary — the CLI is a dev tool; the app
itself stays dependency-free at runtime).

```sh
supabase login
supabase link --project-ref <your-project-ref>    # ref is in the project URL

# The key from step B — this is the ONLY place it ever lives:
supabase secrets set GEMINI_API_KEY=<service-account auth key>

# REQUIRED. Comma-separated list of the origins allowed to call the function.
# There is no wildcard: an origin that isn't on this list gets 403.
supabase secrets set ALLOWED_ORIGINS=https://your-site.example,http://localhost:8080

# Deploy (from the project root). JWT verification stays ON — the default.
supabase functions deploy terma
```

Prefer the dashboard? **Edge Functions** → **Create function**, name it exactly
`terma`, paste the contents of `supabase/functions/terma/index.ts`, deploy, and
add the `GEMINI_API_KEY` and `ALLOWED_ORIGINS` secrets under **Edge Functions**
→ **Secrets**. Leave **Verify JWT** on.

### Why this function is locked down (and what changed)

An earlier version of this guide told you to deploy with `--no-verify-jwt` and
claimed "the function itself validates every request body". That was true and
beside the point: it validated the body's *shape*, never the caller's
*identity*. Combined with `Access-Control-Allow-Origin: *`, anyone who read the
function URL out of `js/config.js` — which ships as a static file — could run
`chat`, `vision` and the **paid** `staging` action in a loop on your bill.

The function now refuses any caller it cannot name and count:

| Control | What it does |
| --- | --- |
| Bearer token required | Your anon/publishable key resolves to an anonymous identity; a real user access token resolves to that user. Neither → **401**. |
| `ALLOWED_ORIGINS` | Replaces `*`. Unknown browser origin → **403**. (Honest scope: CORS is a browser control — a script can omit the header. It stops other *sites* using your quota; it is not the spend control.) |
| Per-identity quota | Every call consumes a token from `terma_usage` via `akv_terma_consume()` — a short burst window plus a daily ceiling. |
| Fails closed | If those tables/RPC are missing, every request is refused (**503**), never let through. Re-run `schema.sql` if you see this. |
| `staging` needs a user | The paid action rejects the anonymous identity outright. |
| Size caps | Body read through a byte-counting reader that aborts past ~6 MB; per-message and per-image caps on top. |

Anonymous rate limiting is keyed on a SHA-256 of client IP + Origin — no raw
address is ever stored.

If your CLI or gateway rejects the browser's CORS preflight with JWT
verification on, `--no-verify-jwt` is still an acceptable fallback **now**,
because the function performs its own verification either way. It is no longer
load-bearing.

Optional overrides:

```sh
# only if a model is ever renamed or sunset
supabase secrets set TERMA_CHAT_MODEL=gemini-3.6-flash
supabase secrets set TERMA_IMAGE_MODEL=gemini-3.1-flash-image

# quotas — defaults shown; per identity, per window
supabase secrets set TERMA_RATE_CHAT=12       # per minute
supabase secrets set TERMA_DAILY_CHAT=200
supabase secrets set TERMA_RATE_VISION=6      # per minute
supabase secrets set TERMA_DAILY_VISION=60
supabase secrets set TERMA_RATE_STAGING=2     # per minute
supabase secrets set TERMA_DAILY_STAGING=10
```

---

## D. Connect the app

1. Open **`js/config.js`** and fill in the values from step A:

   ```js
   export const CONFIG = {
     supabaseUrl: 'https://abcdxyz.supabase.co',   // Project URL — no /rest/v1 suffix!
     supabaseAnonKey: 'sb_publishable_...',        // anon / publishable key
     appUrl: 'http://localhost:8080/',             // where the app is served from
     termaFunction: 'terma',                       // Edge Function name from step C
   };
   ```

   > ⚠ `supabaseUrl` must be the **Project URL only** — if you copied a URL
   > ending in `/rest/v1/` from the dashboard, delete that suffix.

2. Save the file. Leaving every value as an empty string keeps the app in
   offline/demo mode — that is a supported configuration, not an error.

3. Make sure `appUrl` (and whatever you actually serve from) is in the
   `ALLOWED_ORIGINS` secret from step C, **origin only** — scheme, host and
   port, no path: `http://localhost:8080`, not `http://localhost:8080/`. A
   mismatch shows up as Terma failing with "ne prihvaća zahtjeve s ove adrese".

---

## E. Run it locally

No build step, no npm at runtime — any static file server works. From the
project root:

```sh
npx http-server -c-1 .
```

Open **http://localhost:8080**. (`-c-1` disables caching so edits show up on
refresh — the same workflow the ASC reference project uses. Python's
`python -m http.server 8080` works too.)

Smoke-test checklist:

0. **Type and identity.** The header wordmark reads **AKVA in navy `#00008C` and TERM in red
   `#d6252e`**, italic, in the **text** face (Figtree) — *not* teal/amber and *not* Anton. That is
   correct and deliberate: the logo is exempt from the Iris palette by standing operator
   instruction ("keep the logo original in font and color"), and its two hexes live in
   `--logo-navy` / `--logo-red` in the `:root` block of `css/styles.css`. **If you see a teal/amber
   wordmark, that is the bug** — an earlier version of this checklist described exactly that and
   was wrong. Everything *around* the logo is Iris: headings in Anton (a heavy condensed face),
   body text in Figtree.
   If headings look like Arial Narrow, `vendor/fonts/fonts.css` is not reaching the browser
   (`index.html` links it directly, immediately above `css/styles.css`), or the `woff2` files did
   not deploy. Then open a Croatian heading — "3D SOBA", "SAVJETNIK", anything with `Č Š Ž Đ` — and
   confirm the diacritics are drawn and **not clipped at the top**. Tofu boxes mean the `latin-ext`
   files are missing; a shaved caron means something upstream gained an `overflow: hidden`.
1. **Katalog** loads with the demo products (works even with empty config).
2. **Savjetnik** — ask "Koje pločice imate do 30 €/m²?" — Terma should stream
   an answer and show product cards. The cards come from the `search_products`
   tool hitting your `products` **table**, so this step only passes if you ran
   **A.3 (seed)**. An answer with no cards means the table is empty.
3. Photo analysis — the consent notice appears once, then a style summary,
   colour swatches and suggested products.
4. Staging ("AI impresija") — expected result in this version: it reports that
   the feature needs a sign-in. That is the spend control working, not a
   failure; see the note at the top.
5. **Offline check** — set `js/config.js` back to empty strings and reload.
   Savjetnik must still render: explainer, six FAQ chips, and an Akvaterm
   contact card. Catalog, designer and 3D room must all still work.
6. **3D room** — open **3D soba**, add a fixture, and drag it across the floor.
   On a touch screen this is deliberately two steps: one tap selects, the next
   gesture drags, so a vertical swipe that starts on the room still scrolls the
   page. `R` rotates the selection; fixtures snap to a wall near it and cannot
   leave the room.

---

## F. Deploying

Any static host works (the GitHub Pages pattern inherited from ASC): serve the
repo root, update `appUrl` in `config.js`, add that origin to
`ALLOWED_ORIGINS`, and keep the Supabase values as they are — the anon key is
designed to be public.

Four things about this repo that a deploy must get right:

1. **Upload `/vendor/` whole.** Nothing is fetched from a CDN at runtime — not
   fonts, not three.js, not supabase-js. A host that skips binary files, or a
   `.gitignore`-style filter on `*.woff2` / `*.glb`, produces an app that boots
   and then silently loses its typeface or its 3D fixtures.
2. **The two `vendor/fonts/OFL-*.txt` files must ship.** The SIL Open Font
   License permits bundling and redistribution — including commercially — on
   the condition that the licence text travels with the fonts. Deleting those
   two files to save 9 KB breaks the licence. `vendor/models/` is CC0, so its
   `PROVENANCE.md` is a courtesy record rather than an obligation, but keep it:
   it is where every measured bounding box and scale vector lives.
3. **Bump the cache version on every ship — one line.** `APP_V` in `js/app.js` is now the *only*
   version literal: the page registers `./service-worker.js?v=${APP_V}`, the worker reads that
   query as its `VERSION`, and the cache name is `akv-${VERSION}`. Bump `APP_V`, ship, done —
   returning visitors get the new shell and the two can no longer drift.
   `FALLBACK_VERSION` in `service-worker.js` is only what a registration *without* the query would
   fall back to; keep it equal to `APP_V` so that path lands in the same cache. The worker still
   logs a console warning on drift, which should now never appear.
4. **First load is bigger than it looks, on purpose.** The precached shell is
   ~800 KB including the four webfont files (~85 KB with `fonts.css`) — re-measure rather than
   trusting that figure, it moves with every module edit. three.js (2.2 MB) and the 3D model
   library (804 KB) are *not* in it: they are fetched in the background once the
   network goes quiet, in that order, and skipped entirely for visitors on
   `Save-Data` or a 2G-class connection. Those visitors still get the 3D room —
   they just pay for it when they open it. `vendor/supabase/` (259 KB) is in neither the shell nor
   the pre-warm: it downloads only if you complete step D, on first online use.

---

## Troubleshooting

- **Terma shows the FAQ instead of chat** — `js/config.js` has an empty
  `supabaseUrl`. That's offline mode working as designed; fill in step D.
- **"Terma još nije uključena na poslužitelju" (503)** — one of three things:
  the `GEMINI_API_KEY` secret is missing; the function name in `config.js`
  (`termaFunction`) doesn't match the deployed name; or the metering tables
  from `schema.sql` are missing, in which case the function refuses every call
  on purpose (`rate_limit_unavailable` in the function logs). Re-run
  `supabase/schema.sql` — it is safe to re-run.
- **"Terma ne prihvaća ovaj pristup" (401)** — no usable bearer token reached
  the function. Check `supabaseAnonKey` in `js/config.js`; an empty value means
  no `Authorization` header is sent at all.
- **"Terma ne prihvaća zahtjeve s ove adrese" (403)** — the page's origin isn't
  in `ALLOWED_ORIGINS`. Add it (origin only, no trailing slash) and redeploy
  the secret. Serving from `127.0.0.1` while the allowlist says `localhost`
  counts as a different origin.
- **"Terma je trenutačno zauzeta" (429)** — either Google's free-tier limit or
  your own quota from step C. The response carries `Retry-After`; wait it out,
  or raise `TERMA_RATE_*` if the limit is genuinely too tight for your demo.
- **Chat answers but never shows product cards** — the `products` table is
  empty: you skipped **step A.3**. Run `supabase/seed_products.sql`; the last
  statement should report 46.
- **Staging says it needs a sign-in** — expected in this version. See the note
  at the top of this guide: the paid action requires an authenticated session
  and this build has no sign-in UI.
- **Staging fails some other way** (once auth exists) — `gemini-3.1-flash-image`
  requires paid Tier-1 billing on the Google Cloud project (see step B). Also
  re-check that your key is the service-account auth key, not a standard key.
- **Everything worked, then all AI features died at once** — if it's after
  September 2026 and you set the project up with a standard key despite step B:
  that's the cutoff. Create a service-account auth key and re-run
  `supabase secrets set GEMINI_API_KEY=...`.
- **Headings render in a plain narrow sans, or Croatian letters show as boxes**
  — the vendored fonts are not reaching the browser. Check that
  `vendor/fonts/fonts.css` is linked from `index.html` **above** `css/styles.css`
  (it is, as shipped) and that all four `woff2` files return 200. Boxes
  specifically (tofu) mean the two `*-latin-ext-*.woff2` files are missing:
  `č ć ž š đ` live only in those.
- **The 3D fixtures are grey/untextured and the console shows CSP violations for
  `blob:` URLs** — `index.html`'s CSP lost `blob:` from `img-src` **or** from
  `connect-src`. Both are required: `GLTFLoader` wraps every embedded texture in
  a Blob, and Chrome fetches it on the ImageBitmap path (a *connect*) while other
  engines load it as an *image*. Drop either directive and four of the CC0 models
  render with no colour map.
- **A caron looks shaved off the top of a heading** — some ancestor gained an
  `overflow: hidden`. Anton's Croatian diacritics are taller than the font's
  own declared ascender, so their ink sits outside the line box by design; no
  line-height can pull it back in. Remove the clipping, don't shrink the type.
- **The 3D room shows pale blue blocks instead of baths and cabinets** — the
  `.glb` files under `vendor/models/` did not deploy. Those blocks are the
  deliberate fallback (`--sky-200`): correctly sized, still draggable and
  rotatable, just not modelled. Nothing is logged, because a missing model is
  not an error path the user can act on.
- **Nothing saves across devices** — correct, and not a misconfiguration. This
  version has no sign-in, favorites/designs are owner-only under RLS, and so
  the mirrored writes in `js/db.js` are filtered to zero rows (you'll see a
  "touched 0 rows (RLS?)" warning in the browser console — that is the
  row-count guard doing its job, not an error). Everything saves locally in
  localStorage. To move a design to another device, use **Podijeli** — the
  share link / QR carries the entire design in the URL.
