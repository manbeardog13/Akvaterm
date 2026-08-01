# Akvaterm — Katalog i dizajner prostora

Web platforma za Akvaterm d.o.o. (Dubrovnik): katalog opreme za dom — pločice, sanitarije,
armature, grijanje, klimatizacija — s dizajnerom prostora u kojem kupci oblažu kupaonice, kuhinje
i dnevne boravke pločicama iz kataloga, u 2D scenama i u 3D sobi, uz AI savjetnicu **Termu**.

> **Demo katalog** — proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda.

## Mogućnosti

- **Katalog** — 46 demo proizvoda u 5 kategorija, filtri po formatu, boji, završnici i marki,
  favoriti, detaljna stranica proizvoda s pregledom uzorka polaganja uživo.
- **Dizajner (2D)** — tri ilustrirane scene (kupaonica, kuhinja, dnevni boravak); dodirni
  površinu, odaberi pločicu, uzorak polaganja (mreža, vezni slog, riblja kost, dijagonalno),
  boju i širinu fuge — sve se iscrtava u stvarnom mjerilu s perspektivnom projekcijom.
  A/B usporedba, spremanje dizajna, dijeljenje poveznicom.
- **3D soba** — parametarska prostorija (three.js, bez build koraka): zadaj dimenzije, dodaj
  opremu (kada, WC, umivaonik, radijator, klima), obloži pod i zidove istim pločicama i
  uzorcima kao u 2D — tekstura je fizički točnog mjerila, s fugom.
- **Terma** — AI savjetnica (Google Gemini kroz Supabase Edge Function): pitanja o proizvodima
  s pretragom kataloga, analiza fotografije prostora, AI vizualizacija ("AI impresija" —
  označena kao takva). Bez konfiguracije radi u demo načinu s čestim pitanjima.

## Tehnika

Bez build koraka: čisti HTML/CSS/JS (ES moduli), PWA, three.js vendoriran kao ESM.
Sve teksture pločica generiraju se proceduralno (deterministički, besšavno, u stvarnom mjerilu) —
nema foto-ovisnosti. Podaci: Supabase (Postgres + RLS + Auth + Edge Functions) — aplikacija je
potpuno funkcionalna i bez njega (lokalna pohrana). Dizajn sustav naslijeđen iz ASC platforme,
prilagođen Akvaterm identitetu (navy `#00008C` / crvena `#d6252e`).

## Pokretanje

```bash
npx http-server -c-1 -p 8087
```

Otvori `http://localhost:8087`. Za Supabase i Termu vidi [docs/SETUP.md](docs/SETUP.md) —
uključuje **obaveznu** upotrebu service-account auth ključa za Gemini (standardni API ključevi
prestaju raditi u rujnu 2026.).

## Dokumentacija

- [docs/RESEARCH.md](docs/RESEARCH.md) — istraživanje (klijent, ASC referenca, vizualizacijske
  tehnike, Gemini API)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arhitektura i redoslijed izgradnje
- [docs/BUILD_CONTRACTS.md](docs/BUILD_CONTRACTS.md) — ugovori između modula
- [docs/SETUP.md](docs/SETUP.md) — postavljanje Supabase + Gemini
