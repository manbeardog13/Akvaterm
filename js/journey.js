// ============================================================================
// journey.js — the commissioning journey: definition + state machine.
//
// This is the "Atelier" model from docs/specs (and the research report) reduced
// to the one thing Akvaterm actually sells: a room, fitted. The customer never
// browses a catalogue and works out a path. They answer a short sequence of
// questions, the room changes in front of them, and a priced proposal falls out
// of the decisions they made.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE IS DATA AND NOT SCREENS
//
// A journey is a DEFINITION here, not a set of hard-coded views. Adding the
// kitchen journey must be authoring a second definition, never writing a second
// view — that is the whole extensibility argument from the research, and the
// point at which most guided products calcify. Chapters therefore declare
// INTENT ("look at the north wall the way you would lean in to read a tile")
// and the view plus director3d work out the rest.
//
// It is also deliberately free of the DOM and of three.js, so the sequencing
// rules can be proved in plain Node. See tests/journey.test.mjs.
//
// ---------------------------------------------------------------------------
// THE ONE RULE THAT SHAPES EVERYTHING
//
// A chapter may be REVISITED at any time without destroying what came after it.
// "I've changed my mind about the north wall" is the single most common thing a
// customer says, and a wizard that answers it by unwinding the whole sequence
// is the reason people abandon these flows. Revisiting marks downstream work
// STALE, never deleted — the customer decides what to regenerate, having been
// told exactly what is affected.
// ============================================================================

/** Camera intents a chapter may ask for. These are director3d verbs; the
 *  journey names one, it never computes a transform. */
export const INTENT = {
  OVERVIEW: "returnToOverview",
  SURFACE: "focusSurface",
  INSPECT: "inspectMaterial",
  ORBIT: "orbitSelection",
};

// ---------------------------------------------------------------------------
// THE BATHROOM JOURNEY (v0)
//
// Ordered by DECISION WEIGHT, not by category: the choices that constrain
// everything downstream come first. Direction before materials, because a
// direction narrows the catalogue; floor before walls, because the floor is the
// largest single surface and anchors the palette; comfort last, because it is
// the only part a customer will happily defer.
//
// `category` names a real catalogue category (keramika / sanitarije / armature
// / grijanje / klima — verified against data/catalog.seed.json, 46 products).
// `surface` names a real room3d surface id. `target` is a SEMANTIC camera
// target resolved by director3d's TARGETS table, never an internal id.
// ---------------------------------------------------------------------------
export const BATHROOM_V0 = {
  id: "kupaonica-v0",
  title: "Kupaonica",
  // Sensible starting box in metres; the customer can change it, and the
  // journey re-prices without re-asking anything.
  room: { widthM: 2.4, depthM: 2.0, heightM: 2.6 },
  chapters: [
    {
      id: "smjer",
      title: "Smjer",
      question: "Kakav ugođaj želite u kupaonici?",
      help: "Odaberite dojam — pločice i sanitariju biramo zajedno u sljedećim koracima.",
      intent: INTENT.OVERVIEW,
      // A mood chapter assigns nothing; it narrows what is offered later.
      kind: "direction",
      options: [
        { id: "mirno", label: "Mirno i svijetlo", colorTags: ["bijela", "bez", "siva"], glossy: false },
        { id: "toplo", label: "Toplo i prirodno", colorTags: ["drvo", "bez", "smeđa"], glossy: false },
        { id: "izrazito", label: "Izraženo i tamno", colorTags: ["antracit", "crna", "siva"], glossy: true },
      ],
    },
    {
      id: "pod",
      title: "Pod",
      question: "Koje pločice na pod?",
      help: "Za pod preporučujemo mat, protuklizne završne obrade.",
      intent: INTENT.INSPECT,
      target: "floor",
      kind: "surface",
      category: "keramika",
      surface: "floor",
      // A floor is the one surface a bathroom cannot go without.
      required: true,
    },
    {
      id: "zidovi",
      title: "Zidovi",
      question: "Koje pločice na zidove?",
      help: "Počinjemo od sjevernog zida — ostale možete uskladiti ili razlikovati.",
      intent: INTENT.INSPECT,
      target: "north-wall",
      kind: "surface",
      category: "keramika",
      surface: "wallN",
      required: true,
    },
    {
      id: "sanitarije",
      title: "Sanitarija",
      question: "Što ide u prostor?",
      help: "Umivaonik, WC, tuš ili kada — postavit ćemo ih u sobu.",
      intent: INTENT.SURFACE,
      target: "vanity",
      kind: "fixtures",
      category: "sanitarije",
      required: true,
    },
    {
      id: "komfor",
      title: "Grijanje i klima",
      question: "Grijanje i hlađenje?",
      help: "Za dimenzioniranje uvijek preporučujemo izlazak na teren.",
      intent: INTENT.OVERVIEW,
      kind: "fixtures",
      category: "grijanje",
      required: false,          // deferrable without blocking a proposal
    },
    {
      id: "ponuda",
      title: "Ponuda",
      question: "Vaša kupaonica",
      help: "Pregled odabira s okvirnom procjenom. Točnu ponudu radi Akvaterm.",
      intent: INTENT.OVERVIEW,
      kind: "summary",
    },
  ],
};

export const JOURNEYS = { [BATHROOM_V0.id]: BATHROOM_V0 };

// ---------------------------------------------------------------------------
// STATE MACHINE
// ---------------------------------------------------------------------------

/** Create journey state. Pure data in, pure data out — no DOM, no renderer. */
export function createJourney(definition = BATHROOM_V0) {
  const chapters = definition.chapters;
  const state = {
    definition,
    index: 0,
    // chapterId -> { optionId?, productId?, fixtures?, at }
    decisions: Object.create(null),
    // chapterIds whose answer was invalidated by an upstream revision
    stale: new Set(),
    room: { ...definition.room },
  };

  const at = (i) => chapters[Math.max(0, Math.min(i, chapters.length - 1))];
  const indexOf = (id) => chapters.findIndex((c) => c.id === id);

  /** A chapter is answered when it holds a decision and is not stale. */
  function isAnswered(id) {
    return Boolean(state.decisions[id]) && !state.stale.has(id);
  }

  /** Advance is allowed when the current chapter is answered OR optional.
   *  Deliberately permissive: blocking a customer inside a chapter they do not
   *  care about is how a guided flow turns into a form. */
  function canAdvance() {
    const c = at(state.index);
    if (!c) return false;
    if (c.kind === "summary") return false;
    return !c.required || isAnswered(c.id);
  }

  /** Record an answer. `payload` is chapter-kind specific and stored verbatim,
   *  so a new chapter kind needs no change here. */
  function decide(chapterId, payload, now = 0) {
    const i = indexOf(chapterId);
    if (i < 0) return { ok: false, reason: "unknown-chapter" };
    state.decisions[chapterId] = { ...payload, at: now };
    state.stale.delete(chapterId);
    // Answering an upstream chapter afresh re-stales what depended on it.
    markDownstreamStale(i);
    return { ok: true, chapterId };
  }

  /** Downstream chapters are marked STALE, never cleared.
   *
   *  This is the difference between "your later choices still exist, and here
   *  is what the new direction affects" and "we threw away your work". Only
   *  chapters that actually consumed the changed decision are marked: a
   *  direction change restyles the material chapters, but it has no bearing on
   *  which fixtures are in the room, so those are left alone. */
  function markDownstreamStale(fromIndex) {
    const source = chapters[fromIndex];
    if (!source) return;
    if (source.kind !== "direction") return;   // only direction cascades in v0
    for (let i = fromIndex + 1; i < chapters.length; i++) {
      const c = chapters[i];
      if (c.kind === "surface" && state.decisions[c.id]) state.stale.add(c.id);
    }
  }

  /** Jump to a chapter to revise it. Never destroys anything. */
  function revise(chapterId) {
    const i = indexOf(chapterId);
    if (i < 0) return { ok: false, reason: "unknown-chapter" };
    state.index = i;
    return { ok: true, chapterId, affected: affectedBy(chapterId) };
  }

  /** What a revision here would put out of date — shown BEFORE the customer
   *  commits to it, which is the whole point (the "affected items" report). */
  function affectedBy(chapterId) {
    const i = indexOf(chapterId);
    if (i < 0 || chapters[i].kind !== "direction") return [];
    return chapters.slice(i + 1)
      .filter((c) => c.kind === "surface" && state.decisions[c.id])
      .map((c) => c.id);
  }

  function next() {
    if (!canAdvance()) return { ok: false, reason: "chapter-incomplete" };
    state.index = Math.min(state.index + 1, chapters.length - 1);
    return { ok: true, chapterId: at(state.index).id };
  }

  function back() {
    state.index = Math.max(0, state.index - 1);
    return { ok: true, chapterId: at(state.index).id };
  }

  /** Progress never starts at zero.
   *
   *  The endowed-progress effect is one of the better-replicated findings in
   *  the research (Nunes & Drèze roughly doubled completion with a two-stamp
   *  head start): arriving at "0% complete" reads as a mountain, arriving at
   *  a journey already begun reads as momentum. Telling the customer the brief
   *  itself was step one is true, not a trick — they did answer something. */
  function progress() {
    const answerable = chapters.filter((c) => c.kind !== "summary");
    const done = answerable.filter((c) => isAnswered(c.id)).length;
    const ENDOWED = 1;
    return {
      done,
      total: answerable.length,
      fraction: (done + ENDOWED) / (answerable.length + ENDOWED),
      staleCount: state.stale.size,
    };
  }

  /** Everything the view needs for the current beat, in one read. */
  function current() {
    const c = at(state.index);
    return {
      chapter: c,
      index: state.index,
      isFirst: state.index === 0,
      isLast: state.index === chapters.length - 1,
      answered: isAnswered(c.id),
      stale: state.stale.has(c.id),
      decision: state.decisions[c.id] || null,
      canAdvance: canAdvance(),
    };
  }

  /** Surface assignments implied by the decisions so far, in the shape
   *  room3d.setSurface expects. The journey owns intent; the room owns pixels. */
  function assignments() {
    const out = {};
    for (const c of chapters) {
      if (c.kind !== "surface" || !c.surface) continue;
      const d = state.decisions[c.id];
      if (d && d.productId) out[c.surface] = { productId: d.productId, stale: state.stale.has(c.id) };
    }
    return out;
  }

  /** Serialisable state, for saving a commission mid-flight. A Set does not
   *  survive JSON, so it is written out as an array on purpose. */
  function toJSON() {
    return {
      journeyId: definition.id,
      index: state.index,
      decisions: state.decisions,
      stale: [...state.stale],
      room: state.room,
    };
  }

  function restore(saved) {
    if (!saved || saved.journeyId !== definition.id) return { ok: false, reason: "journey-mismatch" };
    state.index = Math.max(0, Math.min(saved.index | 0, chapters.length - 1));
    state.decisions = { ...saved.decisions };
    state.stale = new Set(saved.stale || []);
    state.room = { ...state.room, ...(saved.room || {}) };
    return { ok: true };
  }

  return {
    current, next, back, decide, revise, affectedBy, progress,
    assignments, isAnswered, canAdvance, toJSON, restore,
    get chapters() { return chapters; },
    get room() { return state.room; },
    setRoom(dims) { Object.assign(state.room, dims); },
  };
}
