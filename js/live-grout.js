// Renderer-independent motion and geometry for Atelier's live grout finish.
// room3d owns the Three.js uniforms; this file keeps the arithmetic testable in
// plain Node and guarantees equal wall-clock behaviour at 30, 60 and 120 Hz.

export const LIVE_GROUT = Object.freeze({
  tau: 0.12,
  widthEpsilonMm: 0.005,
  colorEpsilon: 1 / 2048,
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Convert a full physical joint width into the half-width reserved on each
 * tile edge. The result is expressed in one tile's local 0..1 UV space. */
export function groutHalfUv(widthMm, tileSizeMm) {
  const width = Math.max(0, finite(widthMm));
  const tileW = Math.max(1, finite(tileSizeMm?.[0], 1));
  const tileH = Math.max(1, finite(tileSizeMm?.[1], 1));
  return [
    clamp(width / (tileW * 2), 0, 0.49),
    clamp(width / (tileH * 2), 0, 0.49),
  ];
}

/** Advance [widthMm, linearR, linearG, linearB] toward a new target. The
 * exponential response is frame-rate independent and inherently interruptible:
 * changing `target` never resets `current` or invents a new starting pose. */
export function advanceLiveGrout(current, target, dt, { reducedMotion = false } = {}) {
  const from = [0, 0, 0, 0].map((fallback, i) => finite(current?.[i], fallback));
  const to = from.map((fallback, i) => finite(target?.[i], fallback));
  if (reducedMotion) return { value: to, done: true };

  const seconds = Math.max(0, finite(dt));
  const k = seconds > 0 ? 1 - Math.exp(-seconds / LIVE_GROUT.tau) : 0;
  const value = from.map((part, i) => part + (to[i] - part) * k);
  const done = Math.abs(to[0] - value[0]) <= LIVE_GROUT.widthEpsilonMm
    && value.slice(1).every((part, i) => Math.abs(to[i + 1] - part) <= LIVE_GROUT.colorEpsilon);
  return { value: done ? to : value, done };
}
