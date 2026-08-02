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
  "scene.kuhinja": "Kuhinja",
  "scene.dnevniBoravak": "Dnevni boravak",
  "scene.dnevni-boravak": "Dnevni boravak",

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

  /* 3D room surfaces + fixtures (ids from js/views/soba3d.js tables) */
  "soba3d.surface.floor": "Pod",
  "soba3d.surface.wallN": "Sjeverni zid",
  "soba3d.surface.wallE": "Istočni zid",
  "soba3d.surface.wallS": "Južni zid",
  "soba3d.surface.wallW": "Zapadni zid",
  "soba3d.fixture.kada": "Kada",
  "soba3d.fixture.wc": "WC",
  "soba3d.fixture.umivaonik": "Umivaonik s ormarićem",
  "soba3d.fixture.radijator": "Radijator",
  "soba3d.fixture.klima": "Klima",

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
  "kat.title": "Katalog",
  "kat.sub": "Pločice i oprema za vaš dom — pregledajte, spremite favorite i primijenite u dizajneru.",
  "kat.back": "Katalog",
  "kat.categories": "Kategorije",
  "kat.featured": "Izdvojeno",
  "kat.productsShort": "proizvoda",
  "kat.demo": "Demo katalog — proizvodi i cijene su ogledni podaci za prezentaciju, ne stvarna ponuda.",
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
