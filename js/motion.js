// ============================================================================
// motion.js — the pure maths behind the cinematic director.
//
// WHY THIS FILE EXISTS
// Every function here is a pure number-in/number-out helper with NO imports —
// not three.js, not the DOM. That is the whole point: the camera's timing
// behaviour can then be proved in plain Node (`node tests/motion.test.mjs`)
// without a browser, a GPU, or a visible window. The director keeps the vectors
// and the scene graph; this file keeps the arithmetic that decides how things
// feel, which is the part that must be right at 30, 60 and 120 fps alike.
//
// This is deliberately NOT a second camera system. There is no state here — no
// module-level mutables, no clock, no scene knowledge. Adding any would create
// exactly the parallel implementation the brief forbids.
// ============================================================================

/** One step of a critically damped spring, per scalar axis.
 *
 *  Returns [position, velocity]. `smoothTime` is roughly the time to close most
 *  of the gap; it is a duration, not a rate, so it reads the same at any frame
 *  rate. This is the stable implicit form (Game Programming Gems 4): it cannot
 *  overshoot and cannot blow up on a long frame, which a naive
 *  `x += (target - x) * k` most certainly can.
 */
export function springScalar(x, v, target, smoothTime, dt) {
  if (!(dt > 0)) return [x, v];
  const omega = 2 / Math.max(0.0001, smoothTime);
  const t = omega * dt;
  // Padé approximation of exp(-t): cheaper than Math.exp, and monotonic in the
  // range that matters, so the step can never invert.
  const exp = 1 / (1 + t + 0.48 * t * t + 0.235 * t * t * t);
  const delta = x - target;
  const temp = (v + omega * delta) * dt;
  return [target + (delta + temp) * exp, (v - omega * temp) * exp];
}

/** Frame-rate independent approach factor for an exponential blend.
 *
 *  `1 - e^(-dt/tau)` is the fraction of the remaining distance to cover this
 *  frame. Equal wall-clock time yields equal progress whether the device runs
 *  at 30 or 120 Hz — which is the property the fps regression test pins down.
 *  A fixed per-frame fraction (the common shortcut) is twice as fast at 120 Hz
 *  as at 60, and that is exactly the bug this avoids.
 */
export function blendFactor(dt, tau) {
  if (!(dt > 0)) return 0;
  if (!(tau > 0)) return 1;
  return 1 - Math.exp(-dt / tau);
}

/** Hysteresis latch for the glass state of one wall.
 *
 *  `facing` > 0 means the camera has crossed outside this wall. With a single
 *  threshold, a camera resting exactly on it — idle drift alone is enough —
 *  flips the wall every frame and it visibly pulses. Requiring a real excursion
 *  past `enter` to engage and back below `exit` to release makes that
 *  impossible, because the two thresholds never coincide.
 *
 *  Returns 1 (want glass) or 0 (want opaque). Pure: previous state in, next
 *  state out.
 */
export function latchGlass(prevWanted, facing, enter, exit) {
  if (prevWanted) return facing < exit ? 0 : 1;
  return facing > enter ? 1 : 0;
}

/** Advance a 0..1 blend toward its goal, snapping when close enough that
 *  further frames would be invisible. The snap is what lets the render loop
 *  fall idle instead of chasing an asymptote forever. */
export function stepBlend(current, want, k, epsilon = 0.001) {
  if (Math.abs(want - current) < epsilon) return want;
  return current + (want - current) * k;
}

/** One axis of the idle wander.
 *
 *  Amplitude in metres, period in seconds. The director sums several of these
 *  on deliberately non-commensurate periods so the total never repeats inside a
 *  session — a drift that loops is worse than no drift, because the eye finds
 *  the period within about two cycles and the room reads as a screensaver.
 */
export function driftAxis(t, amp, period, phase = 0) {
  if (!(period > 0)) return 0;
  return Math.sin((t / period) * Math.PI * 2 + phase) * amp;
}

/** True when a spring may be declared arrived.
 *
 *  Springs converge asymptotically and never formally reach the target, so
 *  "settled" has to be a decision rather than an event. Both the distance and
 *  the speed must be small: distance alone would fire at the top of an
 *  overshoot, and speed alone fires at the moment of reversal.
 */
export function isSettled(distance, speed, distEps = 0.01, speedEps = 0.02) {
  return distance <= distEps && speed <= speedEps;
}
