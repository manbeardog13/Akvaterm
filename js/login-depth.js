// Pure geometry for the login threshold's restrained depth response.
// The visual controller lives in views/prijava.js; keeping the maths here makes
// the phone-orientation contract testable without a sensor or a browser.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const LOGIN_DEPTH = Object.freeze({
  sensorRangeDeg: 24,
  rotateXDeg: 1.8,
  rotateYDeg: 2.4,
  sceneTravelPx: 12,
  cardTravelPx: 2.5,
});

export function pointerDepth(clientX, clientY, rect) {
  const width = Number(rect?.width) || 0;
  const height = Number(rect?.height) || 0;
  if (!width || !height) return { x: 0, y: 0 };
  return {
    x: clamp(((Number(clientX) - Number(rect.left || 0)) / width) * 2 - 1, -1, 1),
    y: clamp(((Number(clientY) - Number(rect.top || 0)) / height) * 2 - 1, -1, 1),
  };
}

export function orientationDepth(beta, gamma, screenAngle = 0) {
  const range = LOGIN_DEPTH.sensorRangeDeg;
  const portraitX = clamp((Number(gamma) || 0) / range, -1, 1);
  const portraitY = clamp((Number(beta) || 0) / range, -1, 1);
  const radians = -(Number(screenAngle) || 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: clamp(portraitX * cos - portraitY * sin, -1, 1),
    y: clamp(portraitX * sin + portraitY * cos, -1, 1),
  };
}

export function depthCss(vector, reducedMotion = false) {
  const x = reducedMotion ? 0 : clamp(Number(vector?.x) || 0, -1, 1);
  const y = reducedMotion ? 0 : clamp(Number(vector?.y) || 0, -1, 1);
  return Object.freeze({
    rotateX: `${(-y * LOGIN_DEPTH.rotateXDeg).toFixed(3)}deg`,
    rotateY: `${(x * LOGIN_DEPTH.rotateYDeg).toFixed(3)}deg`,
    sceneX: `${(x * LOGIN_DEPTH.sceneTravelPx).toFixed(3)}px`,
    sceneY: `${(y * LOGIN_DEPTH.sceneTravelPx).toFixed(3)}px`,
    cardX: `${(-x * LOGIN_DEPTH.cardTravelPx).toFixed(3)}px`,
    cardY: `${(-y * LOGIN_DEPTH.cardTravelPx).toFixed(3)}px`,
    glareX: `${((x + 1) * 50).toFixed(2)}%`,
    glareY: `${((y + 1) * 50).toFixed(2)}%`,
  });
}
