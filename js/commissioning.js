// ============================================================================
// commissioning.js — pure helpers for turning journey answers into a room and
// a priced commissioning summary.
//
// No DOM and no three.js. The guided view owns presentation, room3d owns
// pixels, and this module owns the small but commercially important seam
// between them: multi-product choices, fixture placement intent and totals.
// ============================================================================

import { GROUT_COLORS, orderEstimate, pricePerRoom } from "./domain.js";

export const ATELIER_GROUT_WIDTHS_MM = Object.freeze([2, 3, 5, 8]);

/** The guided journey deliberately keeps laying to a calm grid and offers only
 * the grout decisions a customer can judge in the live close-up. This also
 * upgrades v0 drafts, which stored only productId, without mutating them. */
export function surfaceFinishForDecision(decision) {
  const groutIds = new Set(GROUT_COLORS.map((color) => color.id));
  const groutColorId = groutIds.has(decision?.groutColorId) ? decision.groutColorId : "siva";
  const width = Number(decision?.groutWidthMm);
  return {
    pattern: "grid",
    groutColorId,
    groutWidthMm: ATELIER_GROUT_WIDTHS_MM.includes(width) ? width : 3,
  };
}

/** Read a product decision across v0 drafts (single productId) and the current
 *  multi-select shape (productIds). Stable order is preserved for rendering. */
export function decisionProductIds(decision) {
  const raw = Array.isArray(decision?.productIds)
    ? decision.productIds
    : (decision?.productId ? [decision.productId] : []);
  return [...new Set(raw.filter((id) => typeof id === "string" && id))];
}

/** A chapter may intentionally span more than one catalogue category (comfort
 *  combines heating and cooling). Older definitions with `category` continue
 *  to work unchanged. */
export function productsForChapter(chapter, products) {
  const categories = Array.isArray(chapter?.categories)
    ? chapter.categories
    : (chapter?.category ? [chapter.category] : []);
  const allowed = new Set(categories);
  return (products || []).filter((product) => allowed.has(product.category));
}

function rgbFromHex(hex) {
  let value = String(hex || "").replace("#", "");
  if (value.length === 3) value = value.split("").map((part) => part + part).join("");
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number)) return { r: 0.5, g: 0.5, b: 0.5 };
  return {
    r: ((number >> 16) & 255) / 255,
    g: ((number >> 8) & 255) / 255,
    b: (number & 255) / 255,
  };
}

/** Direction changes order, never availability: the full catalogue remains
 *  reachable, while the first materials visibly carry the customer's brief. */
export function rankProductsForDirection(products, directionId) {
  const score = (product) => {
    const { r, g, b } = rgbFromHex(product.baseColorHex);
    const light = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const warm = r - b;
    const glossy = product.glossy ? 1 : 0;
    if (directionId === "mirno") return light * 4 - chroma - glossy * 0.35;
    if (directionId === "toplo") return warm * 3 + (1 - Math.abs(light - 0.68)) * 2 - glossy * 0.1;
    if (directionId === "izrazito") return (1 - light) * 4 + chroma + glossy * 0.45;
    return 0;
  };
  return [...(products || [])].sort((a, b) => score(b) - score(a));
}

/** Toggle one equipment product. Products in the same choiceGroup replace one
 *  another (two WC bowls are alternatives); products in different groups can
 *  coexist (a WC, basin and shower are a bathroom). */
export function toggleProductChoice(chapter, decision, productId) {
  const ids = decisionProductIds(decision);
  if (ids.includes(productId)) return ids.filter((id) => id !== productId);

  const meta = chapter?.productFixtures?.[productId];
  const group = meta?.choiceGroup;
  const withoutAlternative = group
    ? ids.filter((id) => chapter?.productFixtures?.[id]?.choiceGroup !== group)
    : ids;
  return [...withoutAlternative, productId];
}

export function surfaceAreaM2(surfaceId, room) {
  const width = Number(room?.widthM) || 0;
  const depth = Number(room?.depthM) || 0;
  const height = Number(room?.heightM) || 0;
  if (surfaceId === "floor") return width * depth;
  if (surfaceId === "wallN" || surfaceId === "wallS") return width * height;
  return depth * height;
}

/** Build the single summary used by both the payoff card and the e-mail handoff.
 *  Tile price includes the ordering reserve returned by orderEstimate(); unit
 *  products are priced once each. Nothing here claims installation pricing. */
export function buildCommission({ chapters, decisions, assignments, room, products }) {
  const byId = new Map((products || []).map((product) => [product.id, product]));
  const surfaces = [];
  for (const chapter of (chapters || []).filter((item) => item.kind === "surface")) {
    const surfaceIds = chapter.surfaces || [chapter.surface];
    const assignedIds = surfaceIds.filter((surfaceId) => assignments?.[surfaceId]);
    if (!assignedIds.length) continue;
    const assignment = assignments[assignedIds[0]];
    const product = byId.get(assignment?.productId);
    if (!product) continue;
    const finish = surfaceFinishForDecision(assignment);
    const areaM2 = assignedIds.reduce((sum, surfaceId) => sum + surfaceAreaM2(surfaceId, room), 0);
    const order = orderEstimate(product, areaM2, finish.pattern);
    const subtotal = pricePerRoom(product, order.totalM2);
    surfaces.push({
      chapterId: chapter.id,
      label: chapter.title,
      surfaceId: chapter.surface,
      surfaceIds: assignedIds,
      product,
      areaM2,
      order,
      finish,
      subtotal,
      stale: assignedIds.some((surfaceId) => assignments[surfaceId]?.stale),
    });
  }

  const equipment = [];
  for (const chapter of (chapters || []).filter((item) => item.kind === "fixtures")) {
    for (const productId of decisionProductIds(decisions?.[chapter.id])) {
      const product = byId.get(productId);
      if (!product) continue;
      equipment.push({
        chapterId: chapter.id,
        label: chapter.title,
        product,
        fixture: chapter.productFixtures?.[productId] || null,
        subtotal: pricePerRoom(product, 0),
      });
    }
  }

  const directionChapter = (chapters || []).find((chapter) => chapter.kind === "direction");
  const directionDecision = directionChapter && decisions?.[directionChapter.id];
  const direction = directionChapter?.options?.find((option) => option.id === directionDecision?.optionId) || null;
  const tilesTotal = surfaces.reduce((sum, row) => sum + row.subtotal, 0);
  const equipmentTotal = equipment.reduce((sum, row) => sum + row.subtotal, 0);

  return {
    direction,
    surfaces,
    equipment,
    tilesTotal,
    equipmentTotal,
    total: Math.round((tilesTotal + equipmentTotal) * 100) / 100,
  };
}

function placementFor(meta, sizeM, room) {
  const width = Number(room?.widthM) || 2.4;
  const depth = Number(room?.depthM) || 2;
  const objectWidth = Number(sizeM?.[0]) || 0.5;
  const objectDepth = Number(sizeM?.[2]) || 0.4;
  const place = meta?.placement || "centre";

  switch (place) {
    case "north-east":
      return { x: width - objectWidth / 2, z: objectDepth / 2, rotY: 0, ax: 1, az: -1 };
    case "north-west":
      return { x: objectWidth / 2, z: objectDepth / 2, rotY: 0, ax: -1, az: -1 };
    case "east-mid":
      return { x: width - objectDepth / 2, z: Math.min(depth - objectWidth / 2, depth * 0.68), rotY: -Math.PI / 2, ax: 1, az: 0 };
    case "south-mid":
      return { x: width / 2, z: depth - objectDepth / 2, rotY: Math.PI, ax: 0, az: 1 };
    case "north-mid":
      return { x: width / 2, z: objectDepth / 2, rotY: 0, ax: 0, az: -1 };
    default:
      return { x: width / 2, z: depth / 2, rotY: 0, ax: 0, az: 0 };
  }
}

/** Convert selected catalogue products into the room engine's fixture list.
 *  A product with no honest 3D analogue remains in the summary but is omitted
 *  here. Existing placements survive re-renders and autosave restoration. */
export function buildFixturePlan({ chapters, decisions, room, catalogue, previous = [] }) {
  const catalogueByType = new Map((catalogue || []).map((item) => [item.type, item]));
  const previousByProduct = new Map((previous || [])
    .filter((fixture) => fixture?.productId)
    .map((fixture) => [fixture.productId, fixture]));
  const plan = [];

  for (const chapter of (chapters || []).filter((item) => item.kind === "fixtures")) {
    for (const productId of decisionProductIds(decisions?.[chapter.id])) {
      const meta = chapter.productFixtures?.[productId];
      if (!meta?.type || !catalogueByType.has(meta.type)) continue;
      const prior = previousByProduct.get(productId);
      if (prior?.type === meta.type) {
        plan.push({ ...prior, productId, chapterId: chapter.id });
        continue;
      }
      const fixture = catalogueByType.get(meta.type);
      plan.push({
        type: meta.type,
        productId,
        chapterId: chapter.id,
        ...placementFor(meta, fixture.sizeM, room),
      });
    }
  }
  return plan;
}
