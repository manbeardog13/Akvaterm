// Renderer-independent motion for Atelier's floating option strip: an
// auto-drifting, swipeable row of translucent glass bubbles that replaces the
// old flat wrap-list. Split the same way js/live-grout.js keeps its
// arithmetic separate from room3d.js's DOM/GL wiring: the drift math below is
// plain and Node-testable, and only createAssetStrip() below touches the DOM.

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const ASSET_STRIP_DRIFT = Object.freeze({
  speedPxPerSec: 14,     // "crawling" — well under any drag gesture's speed
  resumeDelayMs: 2200,   // quiet period after last interaction before drift resumes
  settleMs: 220,         // spring-back duration after a drag ends past bounds
});

/** Advance a track's translateX offset by one frame of idle drift. `bounds`
 * is {min, max} with min <= 0 <= max (max is normally 0 — the track's resting
 * position when nothing has scrolled yet). Reaching either edge reverses
 * `direction` and reflects the overshoot back in, so a long frame (a stalled
 * tab, a slow device) cannot fling the strip past its own bounds — the same
 * "no canned wrap, no snap" principle director3d.js already applies to camera
 * motion. Frame-rate independent: equal wall-clock drift at 30/60/120fps. */
export function nextDriftOffset(offset, dt, speedPxPerSec, bounds, direction) {
  const min = Math.min(0, finite(bounds?.min));
  const max = Math.max(0, finite(bounds?.max));
  if (max <= min) return { offset: min, direction: 1 };
  const seconds = Math.max(0, finite(dt));
  const speed = Math.max(0, finite(speedPxPerSec));
  const dir = direction < 0 ? -1 : 1;
  let next = offset + dir * speed * seconds;
  let nextDir = dir;
  if (next >= max) { next = max - (next - max); nextDir = -1; }
  else if (next <= min) { next = min + (min - next); nextDir = 1; }
  return { offset: clamp(next, min, max), direction: nextDir };
}

/** Which card index sits at (or nearest to) the viewport's leading edge for a
 * given track offset — used to settle a drag release onto a card boundary and
 * to report the currently-visible card for a11y/selection bookkeeping. */
export function nearestCardIndex(offset, cardStep, count) {
  const n = Math.max(0, Math.trunc(finite(count)));
  if (n === 0) return 0;
  const step = Math.max(1, finite(cardStep, 1));
  const idx = Math.round(-finite(offset) / step);
  return Math.min(n - 1, Math.max(0, idx));
}

/** Mount a drift/drag controller on `track` (the flex row of cards) scrolling
 * inside `viewport` (the clipping window, overflow:hidden). Chosen over CSS
 * @keyframes + animation-play-state:paused: a paused/resumed/redirected CSS
 * animation snaps or fights its own baked-in timeline the instant a user
 * drags mid-cycle. Chosen over native overflow-x:auto + scroll-snap alone:
 * native scroll has no idle-auto-advance primitive, so JS has to own drift
 * regardless — once it does, it should own drag physics too rather than
 * fighting the browser for the other half of the same gesture. One
 * requestAnimationFrame loop owns one authoritative `offset` number, applied
 * via transform:translateX() every frame — never left for two systems to
 * disagree about where the strip currently is. */
export function createAssetStrip({ viewport, track, drift = ASSET_STRIP_DRIFT } = {}) {
  if (!viewport || !track || typeof window === "undefined") {
    return { setSelected() {}, refresh() {}, destroy() {} };
  }

  let offset = 0;
  let direction = -1; // "crawling" from the right edge toward the left, per the operator's own words
  let bounds = { min: 0, max: 0 };
  let cardStep = 1;
  let cardCount = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let dragDistance = 0;
  let idleUntil = 0;
  let rafId = null;
  let lastFrameAt = null;
  let destroyed = false;

  const apply = () => { track.style.transform = `translateX(${offset}px)`; };

  function measure() {
    const trackWidth = track.scrollWidth;
    const viewportWidth = viewport.clientWidth;
    bounds = { min: Math.min(0, viewportWidth - trackWidth), max: 0 };
    const first = track.firstElementChild;
    cardCount = track.children.length;
    cardStep = first ? first.getBoundingClientRect().width + finite(parseFloat(getComputedStyle(track).columnGap), 0) : 1;
    offset = clamp(offset, bounds.min, bounds.max);
  }

  function frame(now) {
    if (destroyed) return;
    rafId = window.requestAnimationFrame(frame);
    const dt = lastFrameAt == null ? 0 : (now - lastFrameAt) / 1000;
    lastFrameAt = now;
    if (dragging || now < idleUntil) return;
    const next = nextDriftOffset(offset, dt, drift.speedPxPerSec, bounds, direction);
    offset = next.offset;
    direction = next.direction;
    apply();
  }

  function onPointerDown(event) {
    if (destroyed || bounds.max === bounds.min) return;
    dragging = true;
    dragStartX = event.clientX;
    dragStartOffset = offset;
    dragDistance = 0;
    track.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const dx = event.clientX - dragStartX;
    dragDistance = Math.max(dragDistance, Math.abs(dx));
    const raw = dragStartOffset + dx;
    // Soft rubber-band past the edges rather than a hard stop, so a swipe
    // that reaches the last/first card still feels like it moved.
    if (raw > bounds.max) offset = bounds.max + (raw - bounds.max) * 0.35;
    else if (raw < bounds.min) offset = bounds.min + (raw - bounds.min) * 0.35;
    else offset = raw;
    apply();
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    offset = clamp(offset, bounds.min, bounds.max);
    apply();
    idleUntil = performance.now() + drift.resumeDelayMs;
  }

  // A swipe that crosses several bubbles must not ALSO select whichever one
  // happens to be under the finger at release — the browser's own click
  // synthesis after a pointerup does not know the difference between "tap"
  // and "drag that ended here". Swallow the click in the capture phase (so
  // it never reaches wire()'s delegated selection handler on #atl-options)
  // whenever the gesture that just ended moved more than a few px.
  const DRAG_CLICK_THRESHOLD_PX = 6;
  function suppressClickAfterDrag(event) {
    if (dragDistance > DRAG_CLICK_THRESHOLD_PX) {
      event.stopPropagation();
      event.preventDefault();
    }
    dragDistance = 0;
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("pointerleave", (e) => { if (dragging && e.buttons === 0) endDrag(); });
  viewport.addEventListener("click", suppressClickAfterDrag, { capture: true });

  measure();
  apply();
  rafId = window.requestAnimationFrame(frame);

  return {
    setSelected() { /* selection state lives in the persistent indicator, not forced scroll */ },
    refresh() {
      direction = -1;
      measure();
      apply();
    },
    destroy() {
      destroyed = true;
      if (rafId != null) window.cancelAnimationFrame(rafId);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endDrag);
      viewport.removeEventListener("pointercancel", endDrag);
      viewport.removeEventListener("click", suppressClickAfterDrag, { capture: true });
    },
  };
}
