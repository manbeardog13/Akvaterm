// Deterministic, renderer-agnostic maths for a feathered replacement mask.
//
// The 3D room uses a tiny white-to-black gradient alpha texture. Moving that
// texture across one surface reveals the new material while the old material
// remains untouched beneath it. Keeping the timing and transform maths here
// means Node can prove the transition without a browser or GPU.

export const MASKED_REVEAL = Object.freeze({
  duration: 0.72,
  feather: 0.14,
});

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export function advanceMaskedReveal(progress, dt, duration = MASKED_REVEAL.duration) {
  const safeDuration = Math.max(0.001, Number(duration) || MASKED_REVEAL.duration);
  const safeDt = Math.max(0, Number(dt) || 0);
  return clamp01(clamp01(progress) + safeDt / safeDuration);
}

export function maskedRevealTransform(progress, feather = MASKED_REVEAL.feather) {
  const p = clamp01(progress);
  const f = Math.min(0.5, Math.max(0.02, Number(feather) || MASKED_REVEAL.feather));
  // The gradient is white at x=0 and black at x=1. At progress 0 its entire
  // sample range is clamped to black; at progress 1 it is clamped to white.
  const front = -f / 2 + p * (1 + f);
  return {
    progress: p,
    repeatX: 1 / f,
    offsetX: 0.5 - front / f,
    done: p >= 1,
  };
}

export function maskedRevealAlpha(uvX, progress, feather = MASKED_REVEAL.feather) {
  const transform = maskedRevealTransform(progress, feather);
  const sample = clamp01(clamp01(uvX) * transform.repeatX + transform.offsetX);
  return 1 - sample;
}
