// ============================================================================
// data/scenes.js — the five Dizajner scenes, as DATA.
//
// Operator, 2026-08-02: "dizajner section. why arent the elements in those
// rooms quality objects? that's guesswork kitchen counter and windows. i don't
// want that" — and, earlier, about the 3D room: "do not try to recreate it
// yourself because your guesswork keeps on breaking."
//
// This file used to be 1,117 lines of hand-drawn canvas vector illustration:
// drawWindow(), "counter slab (slight overhang)", a bezier sofa, an invented
// vanity, an invented shower screen. Every one of those is DELETED. There is no
// drawing code in this module any more, and no `draw()` on a scene — the whole
// file is a plain data description that js/scene3d.js turns into a real room.
//
// THE RULE, and it is absolute: a fixture is a FILE STEM under vendor/models/.
// Nothing here invents geometry, and nothing here invents a size. Every model
// is a finished CC0 .glb, placed at the scale that vendor/models/PROVENANCE.md
// MEASURED by walking the glTF scene graph. If a room wants an object the CC0
// set does not have, the room does without it and the gap is written down in a
// comment — an honest empty wall beats an invented one. The rule is enforced in
// code as well as in this comment: js/gfx3d.js MODEL_SPECS is the list of the
// 25 legal stems, and js/scene3d.js SKIPS a fixture naming anything else and
// reports it in inspect().skippedFixtures.
//
// ---------------------------------------------------------------------------
// SHAPE — docs/DESIGNER_REBUILD.md, "Scene definition contract"
//
//   { id, i18nKey,
//     room:   { widthM, depthM, heightM },
//     camera: { posM:[x,y,z], targetM:[x,y,z], fov },
//     surfaces: [ { id, kind:'floor'|'wall', wall:'N'|'E'|'S'|'W'|null,
//                   labelKey, defaultProductId } ],
//     fixtures: [ { model, posM:[x,z], rotY, wall:'N'|'E'|'S'|'W'|null } ] }
//
// `nameHr` is ADDITIVE and optional: the plain Croatian name, so a view can use
// it as the inline fallback for `i18nKey` instead of keeping its own duplicate
// map. Nothing in the contract requires it and no engine reads it.
//
// ---------------------------------------------------------------------------
// COORDINATES — ROOM-LOCAL METRES, the convention js/scene3d.js documents and
// js/room3d.js already used:
//
//     x runs 0 … widthM  from the WEST wall
//     z runs 0 … depthM  from the NORTH wall
//     y runs 0 … heightM from the FLOOR
//
// A fixture's `posM:[x,z]` is the FLOOR CENTRE of its footprint (js/gfx3d.js
// re-origins every prototype there, because the Kenney models pivot at a
// bounding-box corner). Its height comes from the model's own `mountY` in
// MODEL_SPECS — an install height, not something a scene may override.
//
// `rotY` is radians, 0 = the object's back faces NORTH. Every fixture below
// takes its rotation from its `wall` instead of stating one, so "against the
// north wall" always means the same thing.
//
// Two engine behaviours the positions below are authored AGAINST, not against
// which they merely happen to survive:
//
//   1. WALL MAGNET. `wall:'N'` sets that axis flush with the bounding box
//      accounted for, overriding the authored value. The authored number is
//      still written as the flush value so this file reads as what you get.
//   2. 5 cm GRID. The free axis is rounded to 0.05 m, and anything within
//      0.15 m of a wall snaps flush to it. Every free coordinate below is a
//      multiple of 0.05 (or is deliberately inside a snap zone), so the engine
//      moves nothing.
//
// ---------------------------------------------------------------------------
// CAMERAS are LOCKED — a Dizajner scene is a designed picture, not an orbit
// sandbox. Each one is a corner three-quarter view: the camera stands OUTSIDE
// the room box on one diagonal, so it sees the floor and exactly TWO walls, and
// js/scene3d.js hides (and this file simply does not declare) the two walls the
// camera stands outside of. That is what stops a near wall occluding the view.
//
// Which two walls a corner shows, and which reads left and which right, follows
// from the engine's own visibility test (a wall is hidden when its outward
// normal points back at the camera) and from the camera's right vector:
//
//     camera at SE  →  N wall on the RIGHT, W wall on the LEFT
//     camera at SW  →  N wall on the LEFT,  E wall on the RIGHT
//     camera at NE  →  S wall on the LEFT,  W wall on the RIGHT
//     camera at NW  →  E wall on the LEFT,  S wall on the RIGHT
//
// so the surface ids `zid-lijevi` / `zid-desni` below are literally true of
// each scene's own view, and they keep the existing js/i18n.js keys
// ("surface.zid-lijevi", "surface.zid-desni") correct rather than needing new
// ones. Five scenes, four different corners, so the scene strip is not five of
// the same picture.
//
// Every camera was solved numerically, not eyeballed: the two visible wall
// rectangles and the floor were projected through the same perspective maths
// js/scene3d.js uses (including its framedFov() aspect compensation) and the
// distance was bisected until the drawn geometry fit the frame. The per-scene
// numbers are in each camera's comment.
//
// ---------------------------------------------------------------------------
// WHAT THE CC0 SET DOES NOT HAVE, so no scene below pretends otherwise
// (all four verified in vendor/models/PROVENANCE.md, "Not sourced" section):
//
//   • RADIATOR — no CC0 model exists. `towel-rail.glb` is a towel bar with a
//     hanging towel and is NOT a heated towel rail, so it is never used as one.
//   • INDOOR SPLIT AC — every CC0 air conditioner is an outdoor condenser.
//     `ac-outdoor-unit` is named honestly and therefore appears in no interior.
//   • SOFA / ARMCHAIR / COFFEE TABLE / TV UNIT / SHELVING / RUG / PLANT — the
//     living room is sparse because of this, and says so at the scene.
//   • CONTINUOUS KITCHEN WORKTOP — not needed, and the reason is at the kitchen.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. KUPAONICA — the full family bathroom
// ---------------------------------------------------------------------------
// 2.60 × 2.80 × 2.60 m = 7.28 m². A normal Croatian flat bathroom: wide enough
// for a 170 cm tub along one wall and a washbasin plus WC along the other.
//
// Layout: the tub takes the west wall from the north corner (170 cm of the
// 280 cm wall), and the north wall carries WC → vanity → tall cabinet in a row
// with a high-silled window over the head of the bath. Everything is on the two
// walls the camera can see; nothing is parked against a wall that is not drawn.
const KUPAONICA = {
  id: "kupaonica",
  i18nKey: "scene.kupaonica",
  nameHr: "Kupaonica",
  room: { widthM: 2.6, depthM: 2.8, heightM: 2.6 },
  // Camera SE, so the visible pair is N (right) and W (left) — the tub wall and
  // the washbasin wall, which is the whole room. Eye height 1.70 m looking
  // slightly down at 1.20 m puts the horizon just above the vanity top and lets
  // the floor read as a floor. fov 40 is a ~50 mm look: wide enough to hold the
  // room from 4.24 m off its centre, narrow enough that the tub does not bow.
  // Solved: at 4:3 the two walls occupy x [-0.97, 0.94], y [-0.78, 0.92] in NDC
  // — the whole drawn room inside the frame with a hair of margin, filling 96%
  // of the width. The near SE floor corner falls off the bottom edge, which is
  // what standing in the doorway of a small bathroom looks like.
  camera: { posM: [4.3, 1.7, 4.4], targetM: [1.1, 1.2, 1.2], fov: 40 },
  surfaces: [
    { id: "pod", kind: "floor", wall: null, labelKey: "surface.pod", defaultProductId: "ker-05" },
    // West wall — behind the bath, so it is the accent plane: Jadran Plava.
    { id: "zid-lijevi", kind: "wall", wall: "W", labelKey: "surface.zid-lijevi", defaultProductId: "ker-11" },
    // North wall — the washbasin wall, kept quiet in Dalmacija Bijela.
    { id: "zid-desni", kind: "wall", wall: "N", labelKey: "surface.zid-desni", defaultProductId: "ker-08" },
  ],
  fixtures: [
    // Kada 170 × 75, flush into the NW corner: x 0.00…0.75, z 0.00…1.70.
    { model: "bathtub", posM: [0.375, 0.85], wall: "W" },
    // Prozor s visokim parapetom (mountY 1.20) over the head of the bath. It
    // shares the tub's plan footprint and clears it in height — 1.20 m up vs a
    // 0.60 m tub rim — which is exactly where a bathroom window belongs.
    { model: "window-small", posM: [0.4, 0.035], wall: "N" },
    // WC školjka, 17 cm clear of the tub.
    { model: "toilet", posM: [1.1, 0.335], wall: "N" },
    // Umivaonik s ormarićem 60 and its mirror on the same centre line (1.75 m);
    // the mirror mounts at 1.05 m, clear of the 0.85 m basin top.
    { model: "washbasin-vanity", posM: [1.75, 0.23], wall: "N" },
    { model: "bathroom-mirror", posM: [1.75, 0.06], wall: "N" },
    // Visoki zidni ormarić, flush into the NE corner.
    { model: "bathroom-cabinet-tall", posM: [2.4, 0.08], wall: "N" },
    // Držač ručnika on the west wall past the foot of the bath. This is a TOWEL
    // BAR — PROVENANCE is explicit that it is not a heated rail, and no CC0
    // radiator exists, so this bathroom simply has no radiator in it.
    { model: "towel-rail", posM: [0.05, 2.3], wall: "W" },
  ],
};

// ---------------------------------------------------------------------------
// 2. MALA KUPAONICA — the compact one
// ---------------------------------------------------------------------------
// 1.80 × 2.40 × 2.50 m = 4.32 m². The standard second bathroom in a Croatian
// flat: a 90 × 90 quadrant shower instead of a tub, a wall-hung basin, a WC.
//
// The north wall is fully used (shower 0.90 + basin 0.60 leaves 0.30 m), so the
// window goes on the east wall past the WC rather than being squeezed in — a
// 46 cm window will not fit a 30 cm gap and nothing here gets resized to make
// a layout work.
const MALA_KUPAONICA = {
  id: "mala-kupaonica",
  i18nKey: "scene.mala-kupaonica",
  nameHr: "Mala kupaonica",
  room: { widthM: 1.8, depthM: 2.4, heightM: 2.5 },
  // Camera SW — a different corner from the full bathroom on purpose, so the
  // two bathrooms do not read as the same photograph. Visible pair N (left) and
  // E (right). A 4.3 m² room is small enough that the ceiling line is allowed
  // to crop at the near edges: solved to fit the walls up to 2.20 m, which
  // fills 91% of the frame width and 90% of its height instead of leaving the
  // room marooned in the middle of the picture. Everything that matters is
  // inside — the shower top (1.95 m) lands at y 0.59 and the far ceiling corner
  // at y 0.88.
  camera: { posM: [-1.45, 1.62, 3.55], targetM: [1.1, 1.1, 1.0], fov: 42 },
  surfaces: [
    { id: "pod", kind: "floor", wall: null, labelKey: "surface.pod", defaultProductId: "ker-22" },
    // North wall — the one you face from the door: Metro Bijela.
    { id: "zid-lijevi", kind: "wall", wall: "N", labelKey: "surface.zid-lijevi", defaultProductId: "ker-20" },
    { id: "zid-desni", kind: "wall", wall: "E", labelKey: "surface.zid-desni", defaultProductId: "ker-08" },
  ],
  fixtures: [
    // Tuš kabina 90 × 90, flush into the NE corner.
    { model: "shower-enclosure", posM: [1.35, 0.45], wall: "N" },
    // Viseći umivaonik (mountY 0.30 → rim at 0.85 m) in the NW corner, mirror
    // above it on the same centre line.
    { model: "washbasin-vanity-wall", posM: [0.3, 0.23], wall: "N" },
    { model: "bathroom-mirror", posM: [0.3, 0.06], wall: "N" },
    // WC on the east wall, 27 cm clear of the shower tray.
    { model: "toilet-square", posM: [1.49, 1.35], wall: "E" },
    // Prozor further down the same wall, 24 cm past the WC.
    { model: "window-small", posM: [1.765, 2.0], wall: "E" },
  ],
};

// ---------------------------------------------------------------------------
// 3. KUHINJA — the one the operator called out
// ---------------------------------------------------------------------------
// 3.60 × 3.00 × 2.60 m = 10.80 m². A real L-shaped Croatian kitchen, and every
// module in it is a sourced CC0 model at its PROVENANCE size:
//
//   north wall  kutni element 0.64 → ladičar 0.60 → sudoper 0.60 →
//               donji element 0.60 → štednjak 0.60      (3.04 m of run)
//   over it     3 × gornji element 0.60 + napa 0.60
//   west wall   hladnjak 0.60 wide, then the window
//
// THE WORKTOP. The brief allowed one flat slab spanning the base run IF the CC0
// set had no continuous worktop — it does not fire, for two reasons and both
// were checked rather than assumed. First, each Kenney base module carries its
// own worktop as part of the model, so a slab would be invented geometry laid
// on top of real geometry, which is the exact thing being removed from this
// file. Second, js/gfx3d.js applies ONE shared KITCHEN_RUN_SCALE to all eight
// kitchen modules precisely so their tops land at the same height: base, drawer
// and stove all measure to y = 0.900 m in the live scene graph. The run below
// is butted module to module, so those tops already form one continuous 0.90 m
// line. (There is also no mechanism: a scene may only name a file stem, and
// js/scene3d.js skips anything that is not one of the 25.)
//
// The 0.55 m of bare north wall past the stove is not a gap in the design, it
// is the walkway to the door — 0.64 + 5 × 0.60 does not fit a 3.60 m wall, and
// the honest answer to that is a short run and a walkway, not a stretched
// cabinet.
const KUHINJA = {
  id: "kuhinja",
  i18nKey: "scene.kuhinja",
  nameHr: "Kuhinja",
  room: { widthM: 3.6, depthM: 3.0, heightM: 2.6 },
  // Camera SE: N (right) carries the whole run and W (left) carries the fridge
  // and the window, so the corner view shows both legs of the L and the joint
  // between them. This is the shot a kitchen is photographed in. Eye 1.75 m,
  // target 1.25 m — just above the worktop line, which is what makes a run of
  // cabinets read as depth rather than as a flat elevation. Solved: walls at
  // x [-0.89, 0.97], y [-0.68, 0.72] at 4:3, so the room fills 93% of the frame
  // width with the full ceiling line in shot.
  camera: { posM: [5.35, 1.75, 5.05], targetM: [1.6, 1.25, 1.3], fov: 42 },
  surfaces: [
    { id: "pod", kind: "floor", wall: null, labelKey: "surface.pod", defaultProductId: "ker-15" },
    // West wall — the fridge/window leg, calm Beton Pijesak.
    { id: "zid-lijevi", kind: "wall", wall: "W", labelKey: "surface.zid-lijevi", defaultProductId: "ker-14" },
    // North wall — the run wall, i.e. the splashback: Metro Bijela.
    { id: "zid-desni", kind: "wall", wall: "N", labelKey: "surface.zid-desni", defaultProductId: "ker-20" },
  ],
  fixtures: [
    // ---- north run, butted, worktops all at y = 0.900 -----------------------
    // The corner unit measures 0.642 × 0.900 × 0.613 rather than the 0.90 × 0.90
    // PROVENANCE names as its ideal target: the shared KITCHEN_RUN_SCALE is
    // mandatory and worktop alignment wins over the corner unit's footprint.
    { model: "kitchen-cabinet-corner", posM: [0.32, 0.31], wall: "N" },
    { model: "kitchen-cabinet-drawer", posM: [0.95, 0.3], wall: "N" },
    { model: "kitchen-sink-unit", posM: [1.55, 0.3], wall: "N" },
    { model: "kitchen-cabinet-base", posM: [2.15, 0.3], wall: "N" },
    { model: "kitchen-stove", posM: [2.75, 0.3], wall: "N" },
    // ---- over it: uppers at mountY 1.45, napa at 1.55 over the hob ----------
    // Same x centres as the modules below them, so the fronts line up.
    { model: "kitchen-cabinet-upper", posM: [0.95, 0.15], wall: "N" },
    { model: "kitchen-cabinet-upper", posM: [1.55, 0.15], wall: "N" },
    { model: "kitchen-cabinet-upper", posM: [2.15, 0.15], wall: "N" },
    { model: "kitchen-hood", posM: [2.75, 0.19], wall: "N" },
    // ---- west leg ----------------------------------------------------------
    // Hladnjak just south of the corner unit (3.7 cm clear of it). PROVENANCE
    // notes this model is shallow, 0.39 m rather than the usual 0.65 — that is
    // the measured asset and it is not stretched here to look right.
    { model: "kitchen-fridge", posM: [0.2, 0.95], wall: "W" },
    // Prozor 0.90 on the free southern stretch of the west wall. It is NOT over
    // the sink: the sink unit measures 0.98 m tall because the model includes
    // its tap, and a 0.90 m window sill would run through it. Moving the window
    // is honest; moving the model's documented size is not.
    { model: "window-large", posM: [0.035, 2.3], wall: "W" },
  ],
};

// ---------------------------------------------------------------------------
// 4. DNEVNI BORAVAK — deliberately sparse
// ---------------------------------------------------------------------------
// 4.20 × 3.60 × 2.70 m = 15.12 m². A real Croatian living room, and a nearly
// empty one, because the CC0 set contains no living-room furniture at all.
//
// MISSING, and left missing rather than drawn: sofa, armchair, coffee table, TV
// unit, shelving, rug, floor lamp, plant. The previous version of this file
// faked a sofa out of bezier curves and that is precisely what the operator
// rejected. What the set does have for this room is openings — two windows and
// a door — so that is what the room has. The indoor split AC unit that would
// normally sit on one of these walls is also absent: every CC0 air conditioner
// is an outdoor condenser (vendor/models/ac-outdoor-unit.glb is named for what
// it actually is), and it is not being smuggled indoors to fill a wall.
//
// A tiled living room reads as a floor-tile scene, which is the honest use of
// this scene anyway: the two big planes are what a customer is choosing here.
const DNEVNI_BORAVAK = {
  id: "dnevni-boravak",
  i18nKey: "scene.dnevni-boravak",
  nameHr: "Dnevni boravak",
  room: { widthM: 4.2, depthM: 3.6, heightM: 2.7 },
  // Camera SW — the fourth distinct corner in the set. Visible pair N (left,
  // the window wall) and E (right, the door wall), which is the only pairing
  // that puts both of this room's three objects in shot. A 15 m² floor is the
  // subject here, so the camera sits well back (5.9 m out) with the target at
  // 1.30 m: the floor plane runs almost the full width of the frame. Solved:
  // walls x [-0.97, 0.90], y [-0.60, 0.64] at 4:3.
  camera: { posM: [-2.05, 1.75, 5.95], targetM: [2.3, 1.3, 1.6], fov: 42 },
  surfaces: [
    { id: "pod", kind: "floor", wall: null, labelKey: "surface.pod", defaultProductId: "ker-16" },
    { id: "zid-lijevi", kind: "wall", wall: "N", labelKey: "surface.zid-lijevi", defaultProductId: "ker-09" },
    { id: "zid-desni", kind: "wall", wall: "E", labelKey: "surface.zid-desni", defaultProductId: "ker-14" },
  ],
  fixtures: [
    // Two 0.90 m windows on the north wall, symmetric about the room centre
    // (2.10 m): spans 0.60…1.50 and 2.70…3.60, 1.20 m of wall between them.
    { model: "window-large", posM: [1.05, 0.035], wall: "N" },
    { model: "window-large", posM: [3.15, 0.035], wall: "N" },
    // Vrata s dovratnikom, centred on the east wall.
    { model: "door", posM: [4.15, 1.8], wall: "E" },
  ],
};

// ---------------------------------------------------------------------------
// 5. WC — the guest toilet
// ---------------------------------------------------------------------------
// 1.40 × 1.90 × 2.40 m = 2.66 m². A gostinjski WC: a WC, a small hung basin
// with a mirror, and the door. Nothing else fits and nothing else is invented.
//
// It replaces the old "predsoblje" (hallway) scene, which was a corridor drawn
// by hand with no fixtures the model set can supply.
const WC = {
  id: "wc",
  i18nKey: "scene.wc",
  nameHr: "WC / toalet",
  room: { widthM: 1.4, depthM: 1.9, heightM: 2.4 },
  // Camera NW — the last unused corner. Visible pair E (left, basin + mirror +
  // door) and S (right, the WC). At 2.66 m² the room is much taller than it is
  // wide in projection, so the ceiling is cropped: the camera was solved to fit
  // the walls up to 2.10 m, which gets the room to 83% of the frame width
  // instead of the 65% a full-height fit would leave. The door head at 2.05 m
  // lands at y 0.76–0.82 and the far ceiling corner at exactly y 1.00, so the
  // ceiling line still meets the frame at the corner and only runs off at the
  // near edges — a normal interior crop, not a clipped object.
  camera: { posM: [-1.2, 1.6, -0.95], targetM: [0.85, 1.05, 1.1], fov: 45 },
  surfaces: [
    { id: "pod", kind: "floor", wall: null, labelKey: "surface.pod", defaultProductId: "ker-23" },
    { id: "zid-lijevi", kind: "wall", wall: "E", labelKey: "surface.zid-lijevi", defaultProductId: "ker-08" },
    // South wall — the one you face, so it gets the Metro Bijela.
    { id: "zid-desni", kind: "wall", wall: "S", labelKey: "surface.zid-desni", defaultProductId: "ker-20" },
  ],
  fixtures: [
    // WC školjka centred on the south wall.
    { model: "toilet-modern", posM: [0.55, 1.57], wall: "S" },
    // Mali viseći umivaonik in the NE corner, mirror above it.
    { model: "washbasin-vanity-wall", posM: [1.17, 0.3], wall: "E" },
    { model: "bathroom-mirror", posM: [1.34, 0.3], wall: "E" },
    // Vrata at the south end of the east wall, 40 cm clear of the basin and the
    // mirror in plan (they end at z 0.60, the door starts at z 1.00) and never
    // over the WC, whose x range ends at 0.73 while the door's starts at 1.30.
    { model: "door", posM: [1.35, 1.45], wall: "E" },
  ],
};

// Order is the Dizajner's scene-tab order and the first entry is its default.
export const SCENES = [
  KUPAONICA,
  MALA_KUPAONICA,
  KUHINJA,
  DNEVNI_BORAVAK,
  WC,
];
