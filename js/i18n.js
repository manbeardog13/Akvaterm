/* Akvaterm Platform — i18n (js/i18n.js)
   Owns: the Croatian UI dictionary and the `t()` lookup used by every view.
   Contract: `t(key, vars?) -> string` (a missing key returns the key itself —
   never throws), `LANG = 'hr'`. `vars` interpolates `{name}` placeholders,
   e.g. t('katalog.results', { n: 12 }) -> '12 proizvoda'.
   HR-first, EN-ready: adding a language later means adding a dictionary and
   switching LANG — keys stay stable. Domain data (categories, patterns, grout
   colours, scenes) carries i18nKey fields that resolve through this table.

   THIS FILE IS THE AUTHORITY FOR UI COPY. Every view also carries an inline
   Croatian fallback (the tf/T/tr helpers), but a fallback only fires when the
   key is MISSING here — so once a key lands below, the dictionary wins and the
   view literal becomes a safety net for a broken/partial deployment. Changing
   a view's fallback string therefore does nothing on its own: change the
   dictionary entry too, or the screen will not move.

   Two key families exist on purpose:
     • the short view prefixes the app actually renders — kat.* (katalog),
       prod.* (proizvod), diz.* (dizajner + moji dizajni), soba3d.*, sv.*
       (savjetnik), surface.*, scene.*;
     • the longer katalog./product./designer./chat. names, which are the
       canonical semantic keys a future EN dictionary would mirror and which
       the domain layer + a few views resolve directly.
   Do not delete either family without checking `grep -rn "<key>" js/ data/`. */

export const LANG = "hr";

const DICT = {
  /* ---- App chrome ---- */
  "app.name": "Akvaterm",
  "app.tagline": "Kupaonice, grijanje i klimatizacija",

  /* ---- Navigation ---- */
  "nav.katalog": "Katalog",
  "nav.dizajner": "Dizajner",
  "nav.soba3d": "3D soba",
  "nav.savjetnik": "Savjetnik",
  "nav.favoriti": "Favoriti",
  "nav.dizajni": "Dizajni",
  "nav.vise": "Više",
  "nav.pocetna": "Početna",
  "nav.prijava": "Prijava",
  "nav.odjava": "Odjava",

  /* ---- "Smanji prozirnost" switch in the "Više" menu (js/app.js openMore) ----
     This is the MANUAL degradation path for the liquid-glass chrome. Safari
     never reports prefers-reduced-transparency and iOS is the bulk of this
     audience, so without this switch a large share of users cannot turn the
     blur off at all. The hint line is required, not optional: the label alone
     does not tell anyone what is about to change on screen. */
  "nav.transparency": "Smanji prozirnost",
  "nav.transparencyHint": "Zamućeno staklo zamjenjuje puna boja — tekst je čitljiviji.",
  "nav.transparencyOn": "Prozirnost je smanjena.",
  "nav.transparencyOff": "Prozirnost je uključena.",

  /* ---- Accessible names for the app chrome (js/app.js mountFrame) ----
     These are read aloud by screen readers, so a missing key here is not a
     cosmetic bug — it makes assistive tech announce "a11y.primaryNav". */
  "a11y.primaryNav": "Glavna navigacija",
  "a11y.sections": "Odjeljci",

  /* ---- Categories (ids from domain.js CATEGORIES) ---- */
  "cat.keramika": "Keramika",
  "cat.sanitarije": "Sanitarije",
  "cat.armature": "Armature",
  "cat.grijanje": "Grijanje",
  "cat.klima": "Klimatizacija",

  /* ---- Catalog ---- */
  "katalog.title": "Katalog",
  "katalog.search": "Pretraži proizvode…",
  "katalog.results": "{n} proizvoda",
  "katalog.result.one": "{n} proizvod",
  "katalog.filter.all": "Sve",
  "katalog.filter.brand": "Brend",
  "katalog.filter.size": "Dimenzije",
  "katalog.filter.color": "Boja",
  "katalog.filter.price": "Cijena",
  "katalog.filter.finish": "Završna obrada",
  "katalog.empty": "Nema proizvoda za odabrane filtre.",
  "katalog.emptyHint": "Pokušajte ukloniti neki filtar ili promijeniti pojam pretrage.",

  /* ---- Product page ---- */
  "product.specs": "Specifikacije",
  "product.brand": "Brend",
  "product.category": "Kategorija",
  "product.size": "Dimenzije",
  "product.tileSize": "Format pločice",
  "product.finish": "Završna obrada",
  "product.finish.glossy": "Sjajna",
  "product.finish.matte": "Mat",
  "product.price": "Cijena",
  "product.priceM2": "Cijena po m²",
  "product.priceUnit": "Cijena po komadu",
  "product.unit.m2": "m²",
  "product.unit.kom": "kom",
  "product.apply": "Primijeni u dizajneru",
  "product.fav.add": "Dodaj u favorite",
  "product.fav.remove": "Ukloni iz favorita",
  "product.similar": "Slični proizvodi",
  "product.notFound": "Proizvod nije pronađen.",
  "product.demo": "Demo proizvod",

  /* ---- Designer (Stage 1 — preset scenes) ---- */
  "designer.title": "Dizajner",
  "designer.pickScene": "Odaberite prostoriju",
  "designer.pickSurface": "Dodirnite površinu, zatim odaberite proizvod",
  "designer.floors": "Podovi",
  "designer.walls": "Zidovi",
  "designer.floor": "Pod",
  "designer.wall": "Zid",
  "designer.surface": "Površina",
  "designer.products": "Proizvodi",
  "designer.pattern": "Uzorak",
  "designer.grout": "Fuga",
  "designer.groutColor": "Boja fuge",
  "designer.groutWidth": "Širina fuge",
  "designer.mm": "{n} mm",
  "designer.save": "Spremi dizajn",
  "designer.saved": "Dizajn je spremljen.",
  "designer.name": "Naziv dizajna",
  "designer.namePlaceholder": "npr. Kupaonica — svijetli kamen",
  "designer.compare": "Usporedi",
  "designer.compareA": "Verzija A",
  "designer.compareB": "Verzija B",
  "designer.share": "Podijeli",
  "designer.shareCopied": "Poveznica na dizajn je kopirana.",
  "designer.reset": "Poništi",
  "designer.estimate": "Procjena cijene",
  "designer.area": "Površina: {m2} m²",

  /* ---- Laying patterns (ids from domain.js PATTERNS) ---- */
  "pattern.grid": "Mreža",
  "pattern.runningBond": "Vezni slog",
  "pattern.herringbone": "Riblja kost",
  "pattern.diagonal": "Dijagonalno",

  /* ---- Grout colours (ids from domain.js GROUT_COLORS) ---- */
  "grout.bijela": "Bijela",
  "grout.siva": "Siva",
  "grout.antracit": "Antracit",

  /* ---- Scenes (ids from data/scenes.js) ----
     data/scenes.js declares i18nKey "scene.dnevniBoravak" (camelCase) while the
     scene id is the kebab-case "dnevni-boravak"; both spellings resolve so
     neither a scene lookup nor an id-derived lookup falls through to the key. */
  "scene.kupaonica": "Kupaonica",
  "scene.mala-kupaonica": "Mala kupaonica",
  "scene.malaKupaonica": "Mala kupaonica",
  "scene.kuhinja": "Kuhinja",
  "scene.dnevniBoravak": "Dnevni boravak",
  "scene.dnevni-boravak": "Dnevni boravak",
  "scene.wc": "WC",

  /* ---- 2D scene surfaces (ids from data/scenes.js surfaces[]) ---- */
  "surface.pod": "Pod",
  "surface.zid-lijevi": "Lijevi zid",
  "surface.zid-desni": "Desni zid",

  /* ---- 3D room (Stage 2) ----
     The dimension trio is unit-less because the group label already carries
     "(m)"; repeating it on every input read as noise under the heading. */
  "soba3d.title": "3D soba",
  "soba3d.sub": "Zadajte dimenzije prostorije, dodajte opremu i obložite svaku površinu pločicama.",
  "soba3d.dims": "Dimenzije (m)",
  "soba3d.width": "Širina",
  "soba3d.depth": "Dubina",
  "soba3d.height": "Visina",
  "soba3d.fixtures": "Oprema",
  "soba3d.surfaces": "Površine",
  "soba3d.products": "Pločice",
  "soba3d.pattern": "Uzorak polaganja",
  "soba3d.grout": "Fuga",
  "soba3d.groutWidth": "Širina fuge",
  "soba3d.saveTitle": "Spremi dizajn",
  "soba3d.save": "Spremi",
  "soba3d.saved": "Dizajn je spremljen.",
  "soba3d.defaultName": "Moja 3D soba",
  "soba3d.empty": "Nema proizvoda u katalogu.",
  "soba3d.remove": "Ukloni",
  "soba3d.loading": "Učitavanje 3D prikaza…",
  "soba3d.hint": "Povucite za okretanje, uštipnite za zumiranje.",
  "soba3d.unsupported": "Vaš preglednik ne podržava 3D prikaz.",

  /* 3D room surfaces (ids from js/views/soba3d.js tables) */
  "soba3d.surface.floor": "Pod",
  "soba3d.surface.wallN": "Sjeverni zid",
  "soba3d.surface.wallE": "Istočni zid",
  "soba3d.surface.wallS": "Južni zid",
  "soba3d.surface.wallW": "Zapadni zid",

  /* ---- Fixture placement controls (3D room) ----
     Croatian imperative, formal register, matching the rest of the app. */
  "soba3d.place": "Postavi",
  "soba3d.move": "Pomakni",
  "soba3d.rotate": "Zakreni",
  "soba3d.rotateLeft": "Zakreni ulijevo",
  "soba3d.rotateRight": "Zakreni udesno",
  "soba3d.rotateStep": "Zakreni za 90°",
  "soba3d.reset": "Vrati na početno",
  "soba3d.resetFixture": "Vrati opremu na početno mjesto",
  "soba3d.resetAll": "Vrati cijeli raspored",
  "soba3d.resetConfirm": "Vratiti raspored opreme na početno stanje?",
  "soba3d.resetDone": "Raspored je vraćen na početno.",
  "soba3d.moveHint": "Povucite opremu po podu da je premjestite.",
  "soba3d.rotateHint": "Zakreće se u koracima od 90°.",
  "soba3d.moved": "Oprema je premještena.",
  "soba3d.rotated": "Oprema je zakrenuta.",
  "soba3d.selected": "Odabrano: {name}",
  "soba3d.deselect": "Poništi odabir",
  "soba3d.duplicate": "Dupliciraj",
  "soba3d.snapWall": "Priljubi uza zid",
  "soba3d.snapped": "Priljubljeno uza zid.",
  "soba3d.addFixture": "Dodaj opremu",
  "soba3d.removeFixture": "Ukloni opremu",
  "soba3d.position": "Položaj",
  "soba3d.rotation": "Zakret",
  "soba3d.noFixtures": "Još niste dodali opremu.",
  "soba3d.fixtureLoading": "Učitavanje modela…",
  "soba3d.fixtureFailed": "Model se nije učitao — prikazujemo pojednostavljeni oblik.",

  /* ---- Fixture model names ----
     ONE key family, `soba3d.fixture.<id>`, holding EVERY id spelling a caller
     might use: the original Croatian ids from js/views/soba3d.js, their
     kebab-case twins, and the vendored GLB basenames under assets/fixtures/.
     This mirrors the scene precedent above ("scene.dnevniBoravak" and
     "scene.dnevni-boravak" both resolve) and exists so neither a fixture-type
     lookup nor a model-file-derived lookup can fall through to the raw key.
     Do not split it into a second `fixture.*` family — grep before adding. */
  "soba3d.fixture.wc": "WC školjka",
  "soba3d.fixture.toilet": "WC školjka",
  "soba3d.fixture.toilet-square": "WC školjka (kvadratna)",
  "soba3d.fixture.toilet-modern": "WC školjka (moderna)",
  "soba3d.fixture.kada": "Kada",
  "soba3d.fixture.bathtub": "Kada",
  "soba3d.fixture.bathtub-freestanding": "Samostojeća kada",
  "soba3d.fixture.umivaonik": "Umivaonik s ormarićem",
  "soba3d.fixture.washbasin-vanity": "Umivaonik s ormarićem",
  "soba3d.fixture.washbasin-vanity-wall": "Viseći umivaonik s ormarićem",
  "soba3d.fixture.washbasin-pedestal": "Umivaonik na stupu",
  "soba3d.fixture.tus": "Tuš kabina",
  "soba3d.fixture.tus-kabina": "Tuš kabina",
  "soba3d.fixture.tusKabina": "Tuš kabina",
  "soba3d.fixture.shower-enclosure": "Tuš kabina",
  "soba3d.fixture.radijator": "Radijator",
  "soba3d.fixture.radiator": "Radijator",
  "soba3d.fixture.klima": "Klima uređaj",
  "soba3d.fixture.ac": "Klima uređaj",
  "soba3d.fixture.ac-outdoor-unit": "Klima uređaj — vanjska jedinica",
  "soba3d.fixture.kuhinjski-element": "Kuhinjski element",
  "soba3d.fixture.kuhinjskiElement": "Kuhinjski element",
  "soba3d.fixture.kitchen-cabinet-base": "Kuhinjski element",
  "soba3d.fixture.kitchen-cabinet-drawer": "Kuhinjski element s ladicama",
  "soba3d.fixture.kitchen-cabinet-corner": "Kutni kuhinjski element",
  "soba3d.fixture.kitchen-cabinet-upper": "Gornji kuhinjski element",
  "soba3d.fixture.sudoper": "Sudoper",
  "soba3d.fixture.kitchen-sink-unit": "Sudoper",
  "soba3d.fixture.stednjak": "Štednjak",
  "soba3d.fixture.kitchen-stove": "Štednjak",
  "soba3d.fixture.hladnjak": "Hladnjak",
  "soba3d.fixture.kitchen-fridge": "Hladnjak",
  "soba3d.fixture.napa": "Napa",
  "soba3d.fixture.kitchen-hood": "Napa",
  "soba3d.fixture.ogledalo": "Ogledalo",
  "soba3d.fixture.bathroom-mirror": "Ogledalo",
  "soba3d.fixture.ormaric": "Kupaonski ormarić",
  "soba3d.fixture.bathroom-cabinet-tall": "Visoki kupaonski ormarić",
  "soba3d.fixture.drzac-rucnika": "Držač ručnika",
  "soba3d.fixture.drzacRucnika": "Držač ručnika",
  "soba3d.fixture.towel-rail": "Držač ručnika",
  "soba3d.fixture.vrata": "Vrata",
  "soba3d.fixture.door": "Vrata",
  "soba3d.fixture.door-leaf": "Vrata s krilom",
  "soba3d.fixture.prozor": "Prozor",
  "soba3d.fixture.window-large": "Prozor (veliki)",
  "soba3d.fixture.window-small": "Prozor (mali)",
  "soba3d.fixture.unknown": "Oprema",

  /* ---- Savjetnik (Terma chat) ---- */
  "chat.title": "Savjetnik",
  "chat.subtitle": "Terma — digitalni savjetnik",
  "chat.hello": "Bok! Ja sam Terma. Postavite mi pitanje o pločicama, sanitarijama, grijanju ili klimatizaciji.",
  "chat.placeholder": "Postavite pitanje o proizvodima…",
  "chat.send": "Pošalji",
  "chat.thinking": "Razmišljam…",
  "chat.error": "Ne mogu dohvatiti odgovor. Pokušajte ponovno.",
  "chat.unavailable": "Savjetnik trenutno nije dostupan.",
  "chat.unavailableHint": "U demo načinu rada savjetnik radi bez veze s poslužiteljem. Pregledajte katalog ili česta pitanja.",
  "chat.aiNote": "Odgovore generira umjetna inteligencija i mogu sadržavati pogreške.",
  "chat.photoAnalyze": "Analiziraj fotografiju prostora",
  "chat.photoConsent": "Fotografija se šalje na obradu radi analize stila. Nastavkom prihvaćate obradu fotografije.",
  "chat.photoResult": "Prijedlog na temelju vaše fotografije:",
  "chat.suggested": "Predloženi proizvodi",

  /* ---- Favoriti ---- */
  "fav.title": "Favoriti",
  "fav.empty": "Još nemate favorita.",
  "fav.emptyHint": "Dodirnite srce na proizvodu da ga spremite ovdje.",
  "fav.added": "Dodano u favorite.",
  "fav.removed": "Uklonjeno iz favorita.",

  /* ---- Spremljeni dizajni ---- */
  "designs.title": "Dizajni",
  "designs.empty": "Još nemate spremljenih dizajna.",
  "designs.emptyHint": "Otvorite Dizajner, uredite prostoriju i spremite svoj prvi dizajn.",
  "designs.open": "Otvori",
  "designs.delete": "Izbriši",
  "designs.deleted": "Dizajn je izbrisan.",
  "designs.savedAt": "Spremljeno {date}",
  "designs.confirmDelete": "Izbrisati ovaj dizajn?",

  /* ======================================================================
     View copy — the strings the shipped screens actually request.
     Every entry below mirrors a t()/tf()/T()/tr() call in js/views/. Adding
     them here is what makes the Croatian UI translatable at all: before this,
     the visible text lived only as literals inside nine view files.
     ====================================================================== */

  /* ---- Katalog view (js/views/katalog.js, favoriti.js, proizvod.js) ---- */
  "kat.eyebrow": "AKVATERM · PLOČICE I OPREMA",
  "kat.categoryEyebrow": "KATEGORIJA",
  "kat.title": "Katalog",
  "kat.sub": "Pločice i oprema za vaš dom — pregledajte, spremite favorite i primijenite u dizajneru.",
  "kat.back": "Katalog",
  "kat.categories": "Kategorije",
  "kat.featured": "Izdvojeno",
  "kat.productsShort": "proizvoda",
  "kat.demo": "Demo katalog — proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda.",
  "kat.clearFilters": "Očisti ({n})",
  "kat.resumeEyebrow": "VAŠ DIZAJN",
  "kat.resumeTitle": "Nastavite gdje ste stali",
  "kat.resumeSubtitle": "Kupaonica · spremljeno danas",
  "kat.resumeCta": "Nastavi dizajn",
  "kat.resumeAlt": "Pregled dizajna",
  "kat.resumeSaved": "spremljeno",
  "kat.resumeToday": "danas",
  "kat.fFormat": "Format",
  "kat.fColor": "Boja",
  "kat.fBrand": "Marka",
  "kat.fFinish": "Završna obrada",
  "kat.glossy": "Sjajna",
  "kat.mat": "Mat",
  "kat.fav": "Dodaj u favorite",
  "kat.favAdded": "Dodano u favorite",
  "kat.favRemoved": "Uklonjeno iz favorita",
  "kat.noMatch": "Nema proizvoda za odabrane filtre",
  "kat.noMatchBody": "Pokušajte ukloniti neki od filtera.",

  /* ---- Proizvod view (js/views/proizvod.js) ---- */
  "prod.notFound": "Proizvod nije pronađen.",
  "prod.brand": "Marka",
  "prod.category": "Kategorija",
  "prod.format": "Format",
  "prod.finish": "Završna obrada",
  "prod.surface": "Površina",
  "prod.unit": "Jedinica",
  "prod.priceM2": "Cijena po m²",
  "prod.pricePiece": "Cijena po komadu",
  "prod.perPiece": "komad",
  "prod.pattern": "Uzorak polaganja",
  "prod.previewAlt": "Pregled uzorka",
  "prod.apply": "Primijeni u dizajneru",
  "prod.fav": "Favorit",
  "prod.demoNote": "Ogledni demo proizvod — cijena i specifikacije nisu stvarna ponuda.",

  /* ---- Dizajner view (js/views/dizajner.js) ----
     NOTE: "diz.title" is deliberately absent. dizajner.js requests it meaning
     "Dizajner" and dizajni.js requests the same key meaning "Moji dizajni";
     defining it would give one of the two views the wrong heading. The views
     must split the key before it can live here. */
  "diz.products": "Pločice",
  "diz.pattern": "Uzorak polaganja",
  "diz.grout": "Boja fuge",
  "diz.groutWidth": "Širina fuge",
  "diz.canvasAlt": "Ilustracija prostorije",
  "diz.noProducts": "Katalog pločica nije dostupan.",
  "diz.save": "Spremi dizajn",
  "diz.saved": "Dizajn spremljen",
  "diz.namePlaceholder": "npr. Kupaonica — svijetli kamen",
  "diz.share": "Podijeli",
  "diz.shareCopied": "Poveznica kopirana",
  "diz.shareManual": "Kopiraj poveznicu:",
  "diz.compare": "Usporedi s verzijom A",
  "diz.closeCompare": "Zatvori usporedbu",
  "diz.aLabel": "Verzija A",
  "diz.bLabel": "Trenutna verzija (B)",
  "diz.setA": "Zapamti ovu verziju (A)",
  "diz.snapSet": "Verzija A zapamćena",
  /* Placement controls, mirroring the 3D room's soba3d.* set so the two
     designers speak the same Croatian for the same gesture. */
  "diz.move": "Pomakni",
  "diz.rotate": "Zakreni",
  "diz.reset": "Vrati na početno",
  "diz.resetSurface": "Vrati površinu na početno",
  "diz.resetConfirm": "Vratiti ovaj dizajn na početno stanje?",
  "diz.resetDone": "Vraćeno na početno.",

  /* ---- Moji dizajni view (js/views/dizajni.js) ---- */
  "diz.emptyTitle": "Još nema spremljenih dizajna",
  "diz.emptyBody": "Otvorite dizajner, odaberite prostoriju i pločice, pa spremite svoj prvi dizajn.",
  "diz.goDesigner": "Otvori dizajner",
  "diz.countShort": "dizajna",
  "diz.unnamed": "Dizajn bez naziva",
  "diz.kindScene": "2D scena",
  "diz.kind3d": "3D soba",
  "diz.open": "Otvori",
  "diz.delete": "Obriši",
  "diz.confirmDelete": "Potvrdi brisanje",
  "diz.deleted": "Dizajn obrisan",

  /* ---- Favoriti view (js/views/favoriti.js) ---- */
  "fav.emptyTitle": "Još nemate favorita",
  "fav.emptyBody": "Dodirnite ♡ na proizvodu koji vam se sviđa i pronaći ćete ga ovdje.",
  "fav.goCatalog": "U katalog",

  /* ---- Savjetnik view (js/views/savjetnik.js) ----
     Register: formal "vi" throughout, matching Katalog and Favoriti. Terma is
     an assistant to a trade customer, not a friend. */
  "sv.title": "Terma — savjetnica",
  "sv.hello": "Bok! Ja sam Terma, Akvatermova savjetnica. Pitajte me o pločicama, sanitarijama, grijanju ili klimi — ili mi pošaljite fotografiju prostora pa ću predložiti što bi se uklopilo.",
  "sv.placeholder": "Pitajte Termu o pločicama, grijanju, klimi…",
  "sv.send": "Pošalji",
  "sv.thinking": "Terma razmišlja…",
  "sv.newChat": "Novi razgovor",
  "sv.newChatShort": "Novi razgovor",
  "sv.busy": "Terma je trenutačno zauzeta. Pokušajte ponovno za nekoliko sekundi.",
  "sv.error": "Terma trenutačno nije dostupna. Pokušajte kasnije.",
  "sv.noAnswer": "Nisam dobila odgovor — pokušajte preformulirati pitanje.",
  "sv.noProduct": "Taj proizvod više nije u katalogu.",
  "sv.suggestLead": "Iz kataloga bi se ovome mogli uklopiti:",
  "sv.offlineTitle": "Terma trenutačno nije povezana",
  "sv.offlineBody": "Aplikacija radi u demo načinu bez poslužitelja, pa AI savjetnica nije dostupna. Katalog i dizajner rade normalno. U međuvremenu — odgovori na najčešća pitanja:",
  "sv.photoBtn": "Analiza fotografije",
  "sv.photoAlt": "Fotografija prostora",
  "sv.analyzing": "Analiziram fotografiju…",
  "sv.badImage": "Tu fotografiju ne mogu pročitati — pokušajte s drugom.",
  "sv.noStyle": "Nisam uspjela pročitati stil s fotografije.",
  "sv.consentNotice": "Fotografija se šalje Googleovom Gemini servisu radi analize stila. Ne šaljite fotografije s osobama, dokumentima ili osobnim podacima. Nastavkom prihvaćate obradu fotografije.",
  "sv.consentAccept": "Prihvaćam",
  "sv.consentDecline": "Odustani",
  "sv.aiBadge": "AI impresija",
  "sv.stageBtn": "AI impresija",
  "sv.stageHint": "Generirajte AI impresiju prostora s ovim proizvodom (ilustrativno)",
  "sv.stageGo": "Generiraj",
  "sv.stageConfirm": "rezultat je ilustrativna AI vizualizacija, ne točan prikaz proizvoda. Generiranje koristi plaćeni Gemini servis i traje nekoliko sekundi.",
  "sv.stageNeedsPhoto": "Prvo učitajte fotografiju prostora gumbom „Analiza fotografije”.",
  "sv.staging": "Generiram AI impresiju…",
  "sv.stagedAlt": "AI impresija prostora",
  "sv.stagingDisclaimer": "AI impresija je ilustrativna vizualizacija, ne točan prikaz proizvoda ni ponuda.",
  "sv.stagingFail": "Generiranje impresije nije uspjelo. Pokušajte ponovno kasnije.",
  "sv.stagingOff": "AI impresija nije uključena na ovom poslužitelju (zahtijeva plaćenu razinu Gemini API-ja).",

  /* ---- QR share sheet (js/qrshare.js) ----
     These shipped as inline fallbacks only, which meant the panel's copy was
     the one part of the UI a future EN dictionary could not reach. The literals
     in qrshare.js stay as the broken-deployment safety net; these entries are
     now what actually renders. */
  "qr.title": "Podijeli dizajn",
  "qr.lead": "Skenirajte kod mobitelom da nastavite na drugom uređaju.",
  "qr.copy": "Kopiraj poveznicu",
  "qr.copied": "Poveznica kopirana",
  "qr.copyManual": "Označili smo poveznicu — kopirajte je s Ctrl+C.",
  "qr.copyManualShort": "Kopirajte označeni tekst",
  "qr.canvasAlt": "QR kod poveznice za dijeljenje",
  "qr.urlLabel": "Poveznica",
  "qr.tooLong": "Poveznica je predugačka za QR kod. Kopirajte je i pošaljite porukom.",

  /* ---- Prijava (js/views/prijava.js, #/prijava) ----
     HONESTY CONTRACT for this block. The public demo has no accounts: config.js
     ships empty, so js/supabaseClient.js never creates a client and no password
     can be checked by anything. Every string below is written to be true in
     BOTH deployments:
       • nothing here promises synchronisation, cross-device favorites or a
         cloud account — db.js mirrors writes only, and only when configured;
       • "prijava.offBody" states plainly that sign-in cannot complete in this
         build, instead of hinting at a temporary outage;
       • "prijava.guest" is always offered, because the catalogue must stay
         reachable for anyone who opens the public link.
     If a future build gains real accounts, the copy that changes is offBody —
     the rest already describes what the screen does. */
  "prijava.eyebrow": "Prijava",
  "prijava.title": "Dobrodošli natrag",
  "prijava.sub": "Kupaonice, grijanje i klimatizacija",
  "prijava.email": "Email",
  "prijava.emailPlaceholder": "ime@tvrtka.hr",
  "prijava.password": "Lozinka",
  "prijava.passwordPlaceholder": "Vaša lozinka",
  "prijava.showPassword": "Prikaži lozinku",
  "prijava.hidePassword": "Sakrij lozinku",
  "prijava.submit": "Prijavi se",
  "prijava.busy": "Prijava u tijeku…",
  "prijava.or": "ili",
  "prijava.orEmail": "ili email",
  /* "Google" stays untranslated and capitalised — it is a product name, and
     Google's branding guidelines require it verbatim in the sign-in label. */
  "prijava.google": "Nastavi s Googleom",
  "prijava.googleRedirect": "Otvaramo Google prijavu…",
  /* Account creation + recovery. Both are REAL calls (db.js signUp /
     requestPasswordReset), not placeholders — see docs/HOUSE_STANDARD.md on
     never shipping a control that does nothing. */
  "prijava.forgot": "Zaboravljena lozinka?",
  "prijava.forgotNeedEmail": "Upišite svoju e-mail adresu pa ponovno pritisnite.",
  /* Conditional on purpose: Supabase will not confirm whether an address is
     registered, so neither may this string. */
  "prijava.forgotSent": "Ako je adresa registrirana, poslali smo poveznicu za promjenu lozinke.",
  "prijava.firstTime": "Prvi put?",
  "prijava.createAccount": "Napravi račun",
  "prijava.haveAccount": "Već imate račun?",
  "prijava.toSignin": "Prijavite se",
  "prijava.createTitle": "Otvorite račun",
  "prijava.createSub": "Spremite favorite i dizajne na svoj račun",
  "prijava.signupCta": "Napravi račun",
  "prijava.createdOk": "Račun je otvoren.",
  "prijava.confirmSent": "Račun je otvoren. Provjerite e-poštu i potvrdite adresu.",
  "prijava.guest": "Nastavi kao gost",
  "prijava.guestHint": "Katalog, dizajner i 3D soba rade bez prijave.",
  "prijava.localNote": "Favoriti i dizajni spremaju se na ovaj uređaj.",
  "prijava.sceneLabel": "Inspiracija za vašu kupaonicu",
  "prijava.sceneKicker": "Od prve ideje do prostora",
  "prijava.sceneTitle": "Kupaonica koja već osjeća kao vaša.",
  "prijava.sceneBody": "Birajte polako. Svaka odluka ostaje vidljiva u prostoru koji gradite.",
  "prijava.rotateTitle": "Okrenite telefon",
  "prijava.rotateBody": "Više prostora za vaš projekt",
  "prijava.motionEnable": "Uključi pokret uređaja",
  "prijava.motionEnableShort": "Uključi pokret",
  "prijava.motionActive": "Pokret uključen",
  "prijava.motionDenied": "Pokret nije dopušten",
  "prijava.offTitle": "Prijava još nije uključena",
  "prijava.offBody": "Ova verzija radi bez poslužitelja za račune, pa se prijava ne može dovršiti. Sve ostalo radi normalno.",
  "prijava.errEmailRequired": "Unesite email adresu.",
  "prijava.errEmailInvalid": "Provjerite email adresu — nedostaje @ ili domena.",
  "prijava.errPasswordRequired": "Unesite lozinku.",
  "prijava.err.credentials": "Email ili lozinka nisu točni.",
  "prijava.err.unconfirmed": "Račun još nije potvrđen — provjerite email.",
  "prijava.err.rate": "Previše pokušaja. Pričekajte trenutak pa pokušajte ponovno.",
  "prijava.err.network": "Nema veze s poslužiteljem. Provjerite internet pa pokušajte ponovno.",
  "prijava.err.unavailable": "Prijava nije dostupna u ovoj verziji.",
  "prijava.err.other": "Prijava nije uspjela. Pokušajte ponovno.",
  "prijava.success": "Prijavljeni ste.",
  "prijava.signedInTitle": "Prijavljeni ste",
  "prijava.account": "Račun",
  "prijava.signOut": "Odjava",
  "prijava.signedOut": "Odjavljeni ste.",
  "prijava.toCatalog": "U katalog",
  "a11y.prijavaCard": "Prijava na Akvaterm",
  /* Left drawer + theme switch (js/app.js). */
  "terma.name": "Terma AI",
  "nav.zasluge": "Zasluge",
  /* Credits (js/views/zasluge.js). The CC-BY section is a licence obligation,
     not a courtesy — the wording says so on screen deliberately. */
  "zasluge.eyebrow": "Akvaterm",
  "zasluge.title": "Zasluge",
  "zasluge.lead": "Aplikacija koristi otvorene 3D modele, pisma i knjižnice. Ovdje piše tko ih je izradio i pod kojom licencom.",
  "zasluge.required": "Obavezno navođenje",
  "zasluge.ccbyTitle": "3D modeli — CC-BY 3.0",
  "zasluge.ccbyNote": "Ova licenca dopušta besplatno korištenje, i u komercijalne svrhe, ali traži navođenje autora.",
  "zasluge.cc0Title": "3D modeli — CC0 1.0",
  "zasluge.cc0Note": "Javno dobro: navođenje nije obavezno. Navodimo ga svejedno.",
  "zasluge.fontsTitle": "Pisma",
  "zasluge.libsTitle": "Knjižnice",
  "zasluge.by": "autor",
  "zasluge.source": "izvor",
  "zasluge.models": "modela",
  "a11y.openMenu": "Otvori izbornik",
  "a11y.closeMenu": "Zatvori izbornik",
  "theme.label": "Tamna tema",

  /* ---- Atelier — guided commissioning journey ---- */
  "atelier.stage": "3D prikaz kupaonice",
  "atelier.staticStage": "Statični prikaz kupaonice",
  "atelier.loading": "Priprema prostora…",
  "atelier.chapters": "Koraci",
  "atelier.panorama": "Pogled 360°",
  "atelier.panoramaLabel": "Pokreni pogled kroz prostor",
  "atelier.guideLabel": "Vodič kroz uređenje",
  "atelier.back": "Natrag",
  "atelier.next": "Dalje",
  "atelier.skip": "Preskoči",
  "atelier.request": "Zatraži ponudu",
  "atelier.finishChoices": "Dovršite odabire",
  "atelier.noProducts": "Nema proizvoda u ovoj kategoriji.",
  "atelier.groutDetail": "Detalj fuge",
  "atelier.groutHint": "Prilagodite boju i širinu — spoj se mijenja pred vama.",
  "atelier.groutColor": "Boja fuge",
  "atelier.groutWidth": "Širina fuge",
  "atelier.groutWidthShort": "Širina",
  "atelier.stale": "Odabir se temeljio na prethodnom smjeru.",
  "atelier.project": "Projekt kupaonice",
  "atelier.demoEstimate": "Demo procjena materijala i odabrane opreme",
  "atelier.surfaces": "Površine",
  "atelier.equipment": "Oprema",
  "atelier.ready": "Projekt je spreman za razgovor s Akvatermom.",
  "atelier.notReady": "Vratite se na označene korake i dovršite obavezne odabire.",
  "atelier.estTotal": "Demo procjena",
  "atelier.estNote": "Procjena je informativna i ne uključuje otvore, ljepilo, fugu ni ugradnju. Točnu ponudu izrađuje Akvaterm.",
  "atelier.dimensions": "Dimenzije",
  "atelier.direction": "Smjer",
  "atelier.directionOrder": "Prvi prijedlozi prate odabrani smjer.",
  "atelier.mailIntro": "Poštovani, molim razgovor i točnu ponudu za ovu kupaonicu:",
  "atelier.mailNote": "Procjena je informativna i ne uključuje otvore, ljepilo, fugu ni ugradnju.",
  "atelier.mailSubject": "Upit za kupaonicu — Akvaterm",
  "atelier.mailOpen": "Otvaramo poruku s vašim projektom.",
  "kat.atelierEyebrow": "Akvaterm Atelier",
  "kat.atelierTitle": "Od osjećaja do gotovog projekta",
  "kat.atelierSub": "Odgovorite na nekoliko mirnih pitanja dok se prostor, materijali i oprema oblikuju pred vama.",
  "kat.atelierCta": "Započni uređenje",
  "kat.atelierResumeTitle": "Nastavite svoju kupaonicu",
  "kat.atelierResumeSub": "Vaši odabiri i raspored čekaju vas u Atelieru.",
  "kat.atelierResumeCta": "Nastavi projekt",

  /* ---- Common ---- */
  "common.back": "Natrag",
  "common.close": "Zatvori",
  "common.save": "Spremi",
  "common.cancel": "Odustani",
  "common.confirm": "Potvrdi",
  "common.delete": "Izbriši",
  "common.search": "Pretraži…",
  "common.loading": "Učitavanje…",
  "common.retry": "Pokušaj ponovno",
  "common.all": "Sve",
  "common.more": "Više",
  "common.yes": "Da",
  "common.no": "Ne",
  "common.online": "Povezano",
  "common.offline": "Izvanmrežno",
  "common.offlineNote": "Nema internetske veze — radite izvanmrežno.",
  /* Router chrome (js/app.js): the 404 card and the view-error card. */
  "common.notFound": "Stranica nije pronađena.",
  "common.error": "Nešto je pošlo po zlu.",
  "common.reload": "Osvježi",

  /* ---- Errors & empty states ---- */
  "error.generic": "Nešto je pošlo po zlu. Pokušajte ponovno.",
  "error.load": "Učitavanje nije uspjelo.",
  "error.notFound": "Stranica nije pronađena.",
  "error.offline": "Nema internetske veze.",

  /* ---- Demo-data disclaimer (shown wherever catalog data appears) ---- */
  "demo.disclaimer": "Demo katalog — podaci nisu stvarna ponuda",
};

/** Look up a UI string. A missing key returns the key itself (never throws);
 *  `vars` fills `{name}` placeholders. */
export function t(key, vars) {
  const raw = DICT[key];
  if (raw == null) return key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
}
