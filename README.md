# Akvaterm — Katalog i dizajner prostora

Web platforma za Akvaterm d.o.o. (Dubrovnik): katalog opreme za dom — pločice, sanitarije,
armature, grijanje, klimatizacija — s dizajnerom prostora u kojem kupci oblažu kupaonice, kuhinje
i dnevne boravke pločicama iz kataloga, u 2D scenama i u 3D sobi, uz AI savjetnicu **Termu**.

> **Demo katalog** — proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda.

## Mogućnosti

- **Katalog** — 46 demo proizvoda u 5 kategorija, filtri po formatu, boji, završnici i marki,
  favoriti, detaljna stranica proizvoda s pregledom uzorka polaganja uživo.
- **Dizajner (2D)** — pet ilustriranih scena (kupaonica, mala kupaonica, kuhinja, dnevni boravak,
  predsoblje); dodirni
  površinu, odaberi pločicu, uzorak polaganja (mreža, vezni slog, riblja kost, dijagonalno),
  boju i širinu fuge — sve se iscrtava u stvarnom mjerilu s perspektivnom projekcijom.
  A/B usporedba, spremanje dizajna, dijeljenje poveznicom.
- **3D soba** — parametarska prostorija (three.js, bez build koraka): zadaj dimenzije, obloži
  pod i četiri zida istim pločicama i uzorcima kao u 2D — tekstura je fizički točnog mjerila,
  s fugom. Oprema se **pomiče**: 27 tipova elemenata (12 kupaonskih, 8 kuhinjskih, 7 ostalih)
  postavlja se povlačenjem po podu, rotira tipkom R, lijepi uz zid kad joj se približi i ne
  može izaći iz prostorije. Na dodirnom zaslonu je u dva koraka — dodir bira, sljedeća gesta
  povlači — da okomito listanje stranice ostane moguće.
- **Terma** — AI savjetnica (Google Gemini kroz Supabase Edge Function): pitanja o proizvodima
  s pretragom kataloga, analiza fotografije prostora, AI vizualizacija ("AI impresija" —
  označena kao takva; zahtijeva prijavu, koja u ovoj verziji još ne postoji). Bez konfiguracije
  radi u demo načinu s čestim pitanjima i kontaktom Akvaterma.

## Dizajn — sustav „Iris"

Vizualni identitet je izveden iz predloška koji je naručitelj dostavio. **Svaka boja u sustavu
očitana je iz same slike čitačem piksela**, nijedna nije procijenjena: hladni tirkiz `#139EB1`
(šarenica), topli jantar `#EAA651` i duboka smeđa `#68340F` (polje), blijedoplava `#C0D8F2`,
topli neutral `#A6979C`. To je ujedno i značenje imena tvrtke — *akva* (voda, tirkiz) i *term*
(toplina, jantar). Prijašnji identitet (mornarsko plava `#00008C` / crvena `#d6252e`) je povučen.

Tipografija je **Anton** (naslovi) + **Figtree** (tekst), oboje lokalno isporučeno pod
`vendor/fonts/`. Predložak je imenovao *Montelisu* i *Magi Sans*; **te su porodice komercijalne,
nisu licencirane za ovaj projekt i nisu isporučene** — zamijenjene su otvoreno licenciranim
porodicama koje ponavljaju *strukturu* predloška (teška kondenzirana groteska za naslov, lagana
geometrijska sans za tekst). Hrvatski dijakritici (č ć ž š đ) dokazani su raščlambom `cmap`
tablice svake isporučene datoteke — vidi `vendor/fonts/PROVENANCE.md`.

Površine su **tekuće staklo** (*liquid glass*): prozirni, zamućeni paneli s hladnim tirkiznim
tonom i toplim jantarnim rubnim svjetlom. Čitljivost je iznad efekta — svaki par teksta i podloge
izmjeren je, a ne procijenjen, i zadovoljava WCAG AA (≥ 4,5:1). Staklo ima **četiri** puta
degradacije i svaki od njih vodi na istu neprozirnu plohu, pa se raspored nikad ne pomiče:

| uvjet | ponašanje |
| --- | --- |
| `@supports not (backdrop-filter)` | neprozirna tonirana ploha |
| `prefers-reduced-transparency: reduce` | neprozirno, bez zamućenja |
| `prefers-contrast: more` | neprozirno + pojačani obrubi |
| `forced-colors: active` | sve boje prepuštene sustavu (`Canvas` / `CanvasText` / `Highlight`) |
| `prefers-reduced-motion: reduce` | bez animacija i prijelaza |

Zamućenje se **nikad ne animira**, a na zaslonu su najviše 2–3 staklene plohe istovremeno
(gornja traka + donja traka kartica su stalne; modalni prozor ih zamjenjuje, ne dodaje).

Detalji i točne vrijednosti: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Tehnika

Bez build koraka: čisti HTML/CSS/JS (ES moduli), PWA. three.js, supabase-js, QR koder, fontovi i
3D modeli **vendorirani** pod `/vendor/` — ništa se ne dohvaća s CDN-a u izvođenju i nema nijedne
vanjske domene u izvođenju. Sve teksture pločica i sve 2D scene generiraju se proceduralno
(deterministički, besšavno, u stvarnom mjerilu) — nema foto-ovisnosti.

Service worker precachira ljusku aplikacije **uključujući četiri woff2 datoteke** (~79 KB — premale
da bi se odgađale, a njihov izostanak vidljivo preslaguje stranicu). three.js (2,2 MB) i knjižnica
3D modela (804 KB) namjerno **nisu** u ljusci: dohvaćaju se u pozadini u dvije faze kad se mreža
smiri, a preskaču se posve na `Save-Data` ili 2G vezi.

Podaci: Supabase (Postgres + RLS + Edge Functions) služi AI savjetnici; **prijava korisnika
zasad nije izvedena**, pa se favoriti i dizajni čuvaju lokalno (localStorage), a dizajn se između
uređaja prenosi poveznicom ili QR kodom. Aplikacija je potpuno funkcionalna i bez poslužitelja.

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
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — sustav „Iris": očitane boje, tipografija, staklo
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arhitektura i redoslijed izgradnje
- [docs/BUILD_CONTRACTS.md](docs/BUILD_CONTRACTS.md) — ugovori između modula
- [docs/SETUP.md](docs/SETUP.md) — postavljanje Supabase + Gemini

## Licence i atribucija

Sav vanjski materijal u ovom repozitoriju je pod licencom koja dopušta komercijalnu upotrebu i
redistribuciju. Ništa nije preuzeto pod licencom koja bi to ograničavala, i ništa se ne dohvaća
s vanjskog poslužitelja u izvođenju.

### Fontovi — SIL Open Font License 1.1

| Porodica | Uloga | Licenca | Tekst licence u repozitoriju |
| --- | --- | --- | --- |
| **Anton** | naslovi (display) | SIL OFL 1.1 | `vendor/fonts/OFL-Anton.txt` |
| **Figtree** | tekst | SIL OFL 1.1 | `vendor/fonts/OFL-Figtree.txt` |

- `Copyright 2020 The Anton Project Authors` — <https://github.com/googlefonts/AntonFont>
- `Copyright 2022 The Figtree Project Authors` — <https://github.com/erikdkennedy/figtree>

OFL dopušta ugradnju, isporuku i redistribuciju, i u komercijalnim proizvodima, uz dva uvjeta:
fontovi se ne smiju prodavati sami za sebe, i **tekst licence mora putovati s njima**. Zato obje
`OFL-*.txt` datoteke moraju ostati u isporuci. Popis datoteka, njihove veličine, SHA-256 sažeci i
izvorni URL-ovi su u [`vendor/fonts/PROVENANCE.md`](vendor/fonts/PROVENANCE.md).

*Montelisa* i *Magi Sans* iz predloška su **komercijalne porodice, nisu licencirane i nisu
isporučene** — Anton i Figtree su njihove otvoreno licencirane zamjene.

### 3D modeli — CC0 1.0 (javno vlasništvo)

Svih **25** `.glb` datoteka pod `vendor/models/` (ukupno 823 008 bajta) je **CC0 1.0 Universal** —
javno vlasništvo, komercijalna upotreba dopuštena, **atribucija nije obavezna**. Zasluge dolje su
stoga ljubaznost, ne obveza:

| Autor | Što je preuzeto | Izvor |
| --- | --- | --- |
| **Kenney** | sanitarije, kuhinjski moduli, vrata s dovratnikom (Furniture Kit) | <https://kenney.nl/assets/furniture-kit> |
| **Quaternius** | krilo vrata, prozori, vanjska jedinica klime (Ultimate Home Interior) | <https://quaternius.com/packs/ultimatehomeinterior.html> |
| **CreativeTrio** | moderni WC, samostojeća kada, viseći umivaonik (Home) | <https://poly.pizza/u/CreativeTrio> |
| **Kay Lousberg** | držač ručnika | <https://poly.pizza/u/Kay%20Lousberg> |

Sve pod [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), dohvaćeno preko
[Poly Pizza](https://poly.pizza). Za svaku datoteku
[`vendor/models/PROVENANCE.md`](vendor/models/PROVENANCE.md) bilježi izvornu stranicu, autora,
licencu, SHA-256 sažetak, **izmjereni** granični okvir (dobiven obilaskom glTF grafa scene i
transformacijom `POSITION` min/max svakog accessora — dakle mjeren, ne procijenjen) i faktor
skaliranja na stvarne dimenzije. Nijedna datoteka ne traži `DRACOLoader`, `KTX2Loader` ni vanjski
`uri` — obični `GLTFLoader` ih učitava sve.

**Dvije poštene ograde.** Traženje je dokumentirano u istoj datoteci, s upitima i brojem rezultata:

- **Nema CC0 modela radijatora.** Poly Pizza ih ima 16 i svi su CC-BY; Sketchfabov CC0 skup vraća
  0 rezultata; Poly Haven, Kenney i Quaternius nemaju nijedan. Radijator u aplikaciji je zato
  **proceduralno građena geometrija**, ne preuzeti model.
- **Nema CC0 unutarnje zidne klima jedinice.** Jedini CC0 klima uređaji su vanjske jedinice — ta
  je isporučena kao `ac-outdoor-unit.glb` i imenovana onako kako jest. Unutarnja jedinica je
  također proceduralna.

### Ostale vendorirane knjižnice

| Direktorij | Što je | Licenca | Zapis |
| --- | --- | --- | --- |
| `vendor/three/` | three.js r185 (`three.module.js`, `three.core.js`, 5 addona) | MIT | licenca u zaglavlju datoteka |
| `vendor/supabase/` | @supabase/supabase-js 2.111.0 ESM graf | MIT | `vendor/supabase/PROVENANCE.md` |
| `vendor/qr/` | qrcode-generator 1.4.4 (Kazuhiko Arase) | MIT | `vendor/qr/README.md` |
