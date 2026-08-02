-- ============================================================================
-- Akvaterm Platform — demo catalog seed for the `products` table.
-- ----------------------------------------------------------------------------
-- Run this AFTER supabase/schema.sql, in the same place:
--   Supabase dashboard -> SQL Editor -> New query -> paste all -> Run
--
-- Without it the `products` table is empty, and Terma's server-side
-- search_products tool returns nothing — the advisor answers but never shows
-- product cards. The client itself does NOT need this: js/db.js reads
-- data/catalog.seed.json directly, which is why the app works with zero setup.
--
-- 46 demo products (keramika 23, sanitarije 7, armature 5, grijanje 6, klima 5).
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
  ('ker-01', 'keramika', 'Carrara Bianco', 'Marmo Vivo', 'marble', '#e9e7e2', '#a9a7a4', array[600,1200]::int[], true, 54.9, null, 'm2', 'Porculanska gres pločica s uzorkom bijelog mramora Carrara. Rektificirani rubovi, velikoformatna 60×120 cm, za pod i zid.', array['bijela','siva','mramor','sjajna']::text[], true),
  ('ker-02', 'keramika', 'Calacatta Oro', 'Marmo Vivo', 'marble', '#efece5', '#c9a35a', array[800,800]::int[], true, 64.5, null, 'm2', 'Raskošni Calacatta dezen sa zlatnim venama u visokom sjaju. Format 80×80 cm, idealna za reprezentativne prostore.', array['bijela','smeda','mramor','sjajna']::text[], true),
  ('ker-03', 'keramika', 'Nero Marquina', 'Marmo Vivo', 'marble', '#2e2c2b', '#d8d5cf', array[600,600]::int[], true, 58, null, 'm2', 'Duboka crna s izražajnim bijelim venama po uzoru na španjolski Marquina mramor. Format 60×60 cm.', array['antracit','siva','mramor','sjajna']::text[], true),
  ('ker-04', 'keramika', 'Grigio Imperiale', 'Marmo Vivo', 'marble', '#b9b5ae', '#8f8c86', array[600,600]::int[], false, 42.9, null, 'm2', 'Smireni sivi mramorni dezen u mat izvedbi. Format 60×60 cm, protuklizna R10 površina za kupaonice.', array['siva','mramor','mat']::text[], true),
  ('ker-05', 'keramika', 'Travertin Classico', 'TerraNova', 'travertine', '#d8c9ae', '#b09a76', array[610,406]::int[], false, 47.5, null, 'm2', 'Topli bež travertin s prirodnim trakama i porama, mat završna obrada. Klasični format 61×40,6 cm.', array['bez','smeda','travertin','mat']::text[], true),
  ('ker-06', 'keramika', 'Travertin Noce', 'TerraNova', 'travertine', '#b0916c', '#8a6c4a', array[400,400]::int[], false, 44, null, 'm2', 'Travertin u toploj orah nijansi, izražena tekstura pora. Format 40×40 cm, za pod i zid.', array['smeda','travertin','mat']::text[], true),
  ('ker-07', 'keramika', 'Travertin Silver', 'TerraNova', 'travertine', '#c2bcb0', '#9a948a', array[600,400]::int[], false, 49.9, null, 'm2', 'Srebrno-siva interpretacija travertina, suvremena i suzdržana. Format 60×40 cm.', array['bez','siva','travertin','mat']::text[], true),
  ('ker-08', 'keramika', 'Dalmacija Bijela', 'Adria Ceramica', 'ceramic', '#f1efe9', null, array[250,400]::int[], true, 21.9, null, 'm2', 'Svijetla zidna pločica visokog sjaja za kupaonice i kuhinje. Format 25×40 cm.', array['bijela','sjajna']::text[], true),
  ('ker-09', 'keramika', 'Kaštela Bež', 'Adria Ceramica', 'ceramic', '#ddd0b8', null, array[330,330]::int[], false, 19.5, null, 'm2', 'Neutralna bež podna pločica u mat izvedbi. Format 33×33 cm, pouzdan izbor za svaki prostor.', array['bez','mat']::text[], true),
  ('ker-10', 'keramika', 'Pelješac Kadulja', 'Adria Ceramica', 'ceramic', '#a8b5a0', null, array[200,200]::int[], false, 24.9, null, 'm2', 'Zelena nijansa kadulje u malom formatu 20×20 cm — mediteranski karakter za zidove i pod.', array['zelena','mat']::text[], true),
  ('ker-11', 'keramika', 'Jadran Plava', 'Adria Ceramica', 'ceramic', '#7f9fae', null, array[200,200]::int[], true, 24.9, null, 'm2', 'Plavo-siva sjajna pločica 20×20 cm inspirirana Jadranom. Lijepo se slaže s bijelim sanitarijama.', array['plava','sjajna']::text[], true),
  ('ker-12', 'keramika', 'Beton Grigio', 'TerraNova', 'concrete', '#a7a5a0', null, array[600,600]::int[], false, 32.9, null, 'm2', 'Beton-look gres u neutralnoj sivoj, mat mikrotekstura. Format 60×60 cm, minimalistički interijeri.', array['siva','beton','mat']::text[], true),
  ('ker-13', 'keramika', 'Beton Antracit', 'TerraNova', 'concrete', '#4a4a4c', null, array[750,750]::int[], false, 39.9, null, 'm2', 'Tamni antracit beton-look u velikom formatu 75×75 cm. Dramatičan kontrast uz svijetle zidove.', array['antracit','beton','mat']::text[], true),
  ('ker-14', 'keramika', 'Beton Pijesak', 'TerraNova', 'concrete', '#c8bfae', null, array[600,600]::int[], false, 34.5, null, 'm2', 'Topla pješčana varijanta beton-look kolekcije, format 60×60 cm. Ugodna uz drvo i tekstil.', array['bez','beton','mat']::text[], true),
  ('ker-15', 'keramika', 'Hrast Natur', 'Adria Ceramica', 'woodPlank', '#b48a5f', '#8a6748', array[1200,200]::int[], false, 38.9, null, 'm2', 'Gres daska s teksturom prirodnog hrasta, 20×120 cm. Toplina drva uz trajnost keramike.', array['smeda','drvo','mat']::text[], true),
  ('ker-16', 'keramika', 'Hrast Dimljeni', 'Adria Ceramica', 'woodPlank', '#8a6748', '#6b4e35', array[1200,200]::int[], false, 41.5, null, 'm2', 'Tamnija, dimljena nijansa hrastove daske 20×120 cm. Elegantna podloga za dnevne boravke.', array['smeda','drvo','mat']::text[], true),
  ('ker-17', 'keramika', 'Jasen Sivi', 'Adria Ceramica', 'woodPlank', '#9d938a', '#7d746c', array[900,150]::int[], false, 36.9, null, 'm2', 'Sivo patinirani jasen u užoj dasci 15×90 cm — skandinavski ugođaj, neutralan i svijetao.', array['siva','drvo','mat']::text[], true),
  ('ker-18', 'keramika', 'Terrazzo Veneto', 'Marmo Vivo', 'terrazzo', '#d9d4cb', '#b0543f', array[600,600]::int[], false, 52.9, null, 'm2', 'Venecijanski terrazzo s raznobojnim mramornim zrncima na svijetloj podlozi. Format 60×60 cm.', array['bez','crvena','teraco','mat']::text[], true),
  ('ker-19', 'keramika', 'Terrazzo Rosso', 'Marmo Vivo', 'terrazzo', '#c7b6ad', '#a34632', array[400,400]::int[], false, 48.5, null, 'm2', 'Terrazzo s crvenkastim zrncima terakote, format 40×40 cm. Retro šarm s modernom izvedbom.', array['bez','crvena','teraco','mat']::text[], true),
  ('ker-20', 'keramika', 'Metro Bijela', 'Adria Ceramica', 'subway', '#f4f2ec', null, array[300,100]::int[], true, 26.9, null, 'm2', 'Klasična metro pločica 10×30 cm s facetiranim rubom i visokim sjajem. Bezvremenski izbor za zid.', array['bijela','sjajna']::text[], true),
  ('ker-21', 'keramika', 'Metro Antracit', 'Adria Ceramica', 'subway', '#3d3f42', null, array[300,100]::int[], true, 28.9, null, 'm2', 'Metro pločica 10×30 cm u dubokom antracitu — efektna uz svijetle fuge i mesing detalje.', array['antracit','bijela','sjajna']::text[], true),
  ('ker-22', 'keramika', 'Heksagon Siva', 'Marmo Vivo', 'hexMosaic', '#b7b3ac', '#8f8b84', array[300,260]::int[], false, 59.9, null, 'm2', 'Heksagonalni mozaik na mrežici 30×26 cm, tonovi sive. Za podove kupaonica i zidne akcente.', array['siva','mat']::text[], true),
  ('ker-23', 'keramika', 'Heksagon Terakota', 'Marmo Vivo', 'hexMosaic', '#c17a56', '#a35f3f', array[300,260]::int[], false, 61.9, null, 'm2', 'Heksagonalni mozaik u toplim terakota tonovima, 30×26 cm. Mediteranski naglasak prostora.', array['smeda','crvena','mat']::text[], true),
  ('san-01', 'sanitarije', 'Viseća WC školjka Pura Rimless', 'Sanova', 'flat', '#f6f5f2', null, null, true, null, 289, 'kom', 'Viseća WC školjka bez ruba (rimless) s glaziranim odvodom, jednostavno održavanje. Dimenzije: 36×53×33 cm.', array['bijela','sjajna']::text[], true),
  ('san-02', 'sanitarije', 'WC daska Pura soft-close', 'Sanova', 'flat', '#f6f5f2', null, null, true, null, 59, 'kom', 'Duroplast WC daska s mehanizmom laganog spuštanja i brzim skidanjem. Dimenzije: 36×45 cm.', array['bijela','sjajna']::text[], true),
  ('san-03', 'sanitarije', 'Umivaonik Slim 60', 'Sanova', 'flat', '#f6f5f2', null, null, true, null, 179, 'kom', 'Keramički umivaonik tankih stijenki za ormarić ili konzolu. Dimenzije: 60×46×16 cm.', array['bijela','sjajna']::text[], true),
  ('san-04', 'sanitarije', 'Nadgradni umivaonik Orbis', 'AquaLine', 'flat', '#f3f1ec', null, null, true, null, 149, 'kom', 'Okrugli nadgradni umivaonik za postavljanje na ploču. Dimenzije: Ø42×15 cm.', array['bijela','sjajna']::text[], true),
  ('san-05', 'sanitarije', 'Tuš kada SlimStone 90', 'AquaLine', 'flat', '#e9e8e6', null, null, false, null, 219, 'kom', 'Ultra niska tuš kada od lijevanog kamena, protuklizna mat površina. Dimenzije: 90×90×3 cm.', array['bijela']::text[], true),
  ('san-06', 'sanitarije', 'Tuš kada SlimStone 120 Antracit', 'AquaLine', 'flat', '#4b4b4d', null, null, false, null, 259, 'kom', 'Pravokutna tuš kada od lijevanog kamena u antracit izvedbi. Dimenzije: 120×80×3 cm.', array['antracit']::text[], true),
  ('san-07', 'sanitarije', 'Ugradbeni modul Instal 112', 'Norvik', 'flat', '#dfdedb', null, null, false, null, 329, 'kom', 'Ugradbeni vodokotlić s montažnim okvirom za viseće WC školjke, tipka dvostrukog ispiranja. Dimenzije: 50×112×12 cm.', array['bijela']::text[], true),
  ('arm-01', 'armature', 'Slavina za umivaonik Uno Krom', 'Nordika', 'metal', '#c8c9cc', null, null, true, null, 89, 'kom', 'Jednoručna miješalica za umivaonik s keramičkim uloškom i perlator mlaznicom. Visina: 17 cm.', array['siva','metal','sjajna']::text[], true),
  ('arm-02', 'armature', 'Visoka slavina Alta Crna', 'Nordika', 'metal', '#2f2f31', null, null, false, null, 119, 'kom', 'Visoka miješalica u crnoj mat izvedbi za nadgradne umivaonike. Visina: 30 cm.', array['antracit','metal']::text[], true),
  ('arm-03', 'armature', 'Tuš set Rain 25', 'Nordika', 'metal', '#c8c9cc', null, null, true, null, 189, 'kom', 'Nadžbukni tuš stup s okruglom kišnom ružom Ø25 cm i ručnim tušem, kromirana izvedba.', array['siva','metal','sjajna']::text[], true),
  ('arm-04', 'armature', 'Termostatska garnitura Term S', 'AquaLine', 'metal', '#bfc1c4', null, null, true, null, 249, 'kom', 'Termostatska tuš garnitura sa zaštitom od oparina na 38 °C i keramičkim ventilima.', array['siva','metal','sjajna']::text[], true),
  ('arm-05', 'armature', 'Kuhinjska slavina Cucina Inox', 'Nordika', 'metal', '#b9bcbe', null, null, false, null, 139, 'kom', 'Kuhinjska miješalica s okretnim izljevom od brušenog inoxa. Visina: 36 cm.', array['siva','metal']::text[], true),
  ('gri-01', 'grijanje', 'Pločasti radijator Universal 22', 'Viessmann', 'flat', '#f2f1ed', null, null, true, null, 189, 'kom', 'Čelični pločasti radijator tip 22, toplinski učinak 1.680 W (75/65/20). Dimenzije: 60×100×10 cm.', array['bijela','sjajna']::text[], true),
  ('gri-02', 'grijanje', 'Kupaonski radijator Linea', 'Termostroj', 'flat', '#efeeea', null, null, true, null, 159, 'kom', 'Cijevni kupaonski radijator (ljestve) za centralno grijanje, bijela izvedba. Dimenzije: 50×120×3 cm.', array['bijela','sjajna']::text[], true),
  ('gri-03', 'grijanje', 'Električni panel E-Panel 1000', 'Termostroj', 'flat', '#f0efec', null, null, false, null, 229, 'kom', 'Električni zidni panel 1.000 W s Wi-Fi termostatom i tjednim programom. Dimenzije: 83×45×8 cm.', array['bijela']::text[], true),
  ('gri-04', 'grijanje', 'Set podnog grijanja Comfort 10', 'Termostroj', 'flat', '#d9d7d2', null, null, false, null, 449, 'kom', 'Električna grijaća mreža za 10 m² s digitalnim termostatom i podnim osjetnikom — idealno ispod keramike.', array['siva']::text[], true),
  ('gri-05', 'grijanje', 'Toplinska pumpa Vitocal 150-A', 'Viessmann', 'flat', '#dcdcda', null, null, false, null, 6490, 'kom', 'Monoblok toplinska pumpa zrak-voda 6 kW, tihi rad, prirodno rashladno sredstvo R290. Dimenzije vanjske jedinice: 112×104×45 cm.', array['siva']::text[], true),
  ('gri-06', 'grijanje', 'Kondenzacijski kotao Vitodens 100-W', 'Viessmann', 'flat', '#f4f3f1', null, null, true, null, 1890, 'kom', 'Plinski kondenzacijski kombi kotao 19 kW za grijanje i potrošnu toplu vodu. Dimenzije: 40×70×36 cm.', array['bijela','sjajna']::text[], true),
  ('kli-01', 'klima', 'Klima uređaj Sensira FTXF25D', 'Daikin', 'flat', '#f4f4f2', null, null, true, null, 649, 'kom', 'Zidna inverter klima 2,5 kW, energetski razred A++, rashladno sredstvo R-32. Dimenzije unutarnje jedinice: 77×29×27 cm.', array['bijela','sjajna']::text[], true),
  ('kli-02', 'klima', 'Klima uređaj Comfora FTXP35N', 'Daikin', 'flat', '#f4f4f2', null, null, true, null, 799, 'kom', 'Zidna inverter klima 3,5 kW s Wi-Fi upravljanjem i tihim noćnim načinom rada. Dimenzije unutarnje jedinice: 84×30×29 cm.', array['bijela','sjajna']::text[], true),
  ('kli-03', 'klima', 'Klima uređaj MSZ-HR25VF', 'Mitsubishi Electric', 'flat', '#f3f3f1', null, null, true, null, 599, 'kom', 'Kompaktna zidna inverter klima 2,5 kW, pouzdan ulazni model. Dimenzije unutarnje jedinice: 78×28×22 cm.', array['bijela','sjajna']::text[], true),
  ('kli-04', 'klima', 'Klima uređaj MSZ-AY35VGK', 'Mitsubishi Electric', 'flat', '#f3f3f1', null, null, true, null, 899, 'kom', 'Zidna inverter klima 3,5 kW s ugrađenim Wi-Fi modulom i Plasma Quad filtrom zraka. Dimenzije unutarnje jedinice: 80×30×23 cm.', array['bijela','sjajna']::text[], true),
  ('kli-05', 'klima', 'Klima uređaj Emura FTXJ35AB', 'Daikin', 'flat', '#3c3c3e', null, null, true, null, 1190, 'kom', 'Dizajnerska zidna klima 3,5 kW u antracit izvedbi, A+++ u hlađenju. Dimenzije unutarnje jedinice: 90×30×21 cm.', array['antracit','sjajna']::text[], true)
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

-- Expect: 46
select count(*) as seeded_products from products where deleted_at is null;
