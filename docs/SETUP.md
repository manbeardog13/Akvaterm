# Setup guide — Akvaterm Platform

This gets the platform running end-to-end: the static app, the shared Supabase
database, and **Terma** (the Gemini-powered advisor). It takes about 20 minutes.

**Important:** the app is designed to run with **zero setup** too — with an empty
`js/config.js` it works fully offline (demo catalog, localStorage favorites and
designs, Terma shows a static FAQ instead of live chat). Do the steps below when
you want the shared database and the live advisor.

You'll do five things: **(A)** create the database, **(B)** get a Gemini key
(read the key warning — it matters), **(C)** deploy the Terma function,
**(D)** connect the app, **(E)** run it.

---

## A. Set up the database (Supabase)

1. Go to **https://supabase.com** and sign up (free tier is plenty for a demo).
   Click **New project**.
   - Name it `akvaterm-platform`, set a database password (save it), pick a
     region near you (e.g. `eu-central-1`). Wait ~2 minutes.

2. In the left menu, open **SQL Editor** → **New query**.
   - Open `supabase/schema.sql` from this project, copy **all** of it, paste it
     into the query box, and click **Run**.
   - You should see "Success". This created the product catalog, favorites,
     designs and quotes tables, locked them down with Row Level Security
     (products are public-read; favorites and designs are owner-only), switched
     on realtime, set up the audit log and soft-delete recycle bin, and created
     a public **`product-images`** storage bucket. It is safe to re-run any time.
   - *If the very last block errored* (some projects restrict storage DDL):
     go to **Storage** → **New bucket**, name it exactly `product-images`, turn
     **Public** on, and create it. Everything else already ran.

3. Get your two connection values. Left menu → **Project Settings** →
   **Data API** (or **API**).
   - Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
   - Copy the **anon / publishable** API key. This one is safe to ship in the
     client — the data stays protected by the RLS rules from step 2.

> Signing in is optional for browsing: the catalog is public-read. The first
> user who signs up becomes **admin** automatically; everyone after that is a
> **customer** (favorites/designs/quotes only) until an admin changes their row
> in the `profiles` table.

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
  per staged render**. The UI keeps it behind an explicit button with an
  "AI impresija" disclaimer. If you skip billing, everything else still works —
  the staging button just reports that the feature isn't enabled.
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

# Deploy (from the project root). --no-verify-jwt lets the browser's CORS
# preflight through; the function itself validates every request body.
supabase functions deploy terma --no-verify-jwt
```

Prefer the dashboard? **Edge Functions** → **Create function**, name it exactly
`terma`, paste the contents of `supabase/functions/terma/index.ts`, deploy, then
turn **Verify JWT** *off* in the function's settings, and add the
`GEMINI_API_KEY` secret under **Edge Functions** → **Secrets**.

Optional overrides (only if a model is ever renamed or sunset):

```sh
supabase secrets set TERMA_CHAT_MODEL=gemini-3.6-flash
supabase secrets set TERMA_IMAGE_MODEL=gemini-3.1-flash-image
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

1. **Katalog** loads with the demo products (works even with empty config).
2. **Savjetnik** — ask "Koje pločice imate do 30 €/m²?" — Terma should stream
   an answer and show product cards (that's the Edge Function + the
   `search_products` tool hitting your `products` table).
3. Photo analysis — the consent notice appears once, then a style summary and
   suggested products.
4. Staging ("AI impresija") — only if you enabled billing in step B; otherwise
   it reports the feature isn't enabled, which is expected.

For a public deployment, any static host works (GitHub Pages pattern inherited
from ASC): serve the repo root, update `appUrl` in `config.js`, and keep the
Supabase values as they are — the anon key is designed to be public.

---

## Troubleshooting

- **Terma shows the FAQ instead of chat** — `js/config.js` has an empty
  `supabaseUrl`. That's offline mode working as designed; fill in step D.
- **"Terma još nije uključena na poslužitelju" (503)** — the function is
  deployed but the `GEMINI_API_KEY` secret is missing, or the function name in
  `config.js` (`termaFunction`) doesn't match the deployed name.
- **"Terma je trenutačno zauzeta" (429)** — free-tier rate limit (~10 req/min).
  Wait a few seconds; it clears on its own.
- **Chat answers but never shows product cards** — the `products` table is
  empty. The catalog seed lives in `data/catalog.seed.json` for the client;
  copy rows into the `products` table (SQL Editor insert or the dashboard's
  Table Editor) when you want Terma's live search to find them.
- **Staging always fails** — `gemini-3.1-flash-image` requires paid Tier-1
  billing on the Google Cloud project (see step B). Also re-check that your key
  is the service-account auth key, not a standard key.
- **Everything worked, then all AI features died at once** — if it's after
  September 2026 and you set the project up with a standard key despite step B:
  that's the cutoff. Create a service-account auth key and re-run
  `supabase secrets set GEMINI_API_KEY=...`.
- **Nothing saves across devices** — favorites/designs need a signed-in user
  (RLS is owner-only). Without sign-in they still save locally (localStorage).
