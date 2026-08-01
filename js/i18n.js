/* Akvaterm Platform — i18n (js/i18n.js)
   Owns: the Croatian UI dictionary and the `t()` lookup used by every view.
   Contract: `t(key, vars?) -> string` (a missing key returns the key itself —
   never throws), `LANG = 'hr'`. `vars` interpolates `{name}` placeholders,
   e.g. t('katalog.results', { n: 12 }) -> '12 proizvoda'.
   HR-first, EN-ready: adding a language later means adding a dictionary and
   switching LANG — keys stay stable. Domain data (categories, patterns, grout
   colours, scenes) carries i18nKey fields that resolve through this table. */

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

  /* ---- Scenes (ids from data/scenes.js) ---- */
  "scene.kupaonica": "Kupaonica",
  "scene.kuhinja": "Kuhinja",
  "scene.dnevni-boravak": "Dnevni boravak",

  /* ---- 3D room (Stage 2) ---- */
  "soba3d.title": "3D soba",
  "soba3d.dims": "Dimenzije prostorije",
  "soba3d.width": "Širina (m)",
  "soba3d.depth": "Dubina (m)",
  "soba3d.height": "Visina (m)",
  "soba3d.fixtures": "Oprema",
  "soba3d.loading": "Učitavam 3D prikaz…",
  "soba3d.hint": "Povucite za okretanje, uštipnite za zumiranje.",
  "soba3d.unsupported": "Vaš preglednik ne podržava 3D prikaz.",

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
