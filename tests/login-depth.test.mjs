import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { LOGIN_DEPTH, depthCss, orientationDepth, pointerDepth } from "../js/login-depth.js";

test("pointer depth maps the centre to rest and clamps outside the surface", () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(pointerDepth(110, 70, rect), { x: 0, y: 0 });
  assert.deepEqual(pointerDepth(-100, 500, rect), { x: -1, y: 1 });
  assert.deepEqual(pointerDepth(10, 20, null), { x: 0, y: 0 });
});

test("orientation depth is bounded and rotates with screen orientation", () => {
  assert.deepEqual(orientationDepth(0, 0), { x: 0, y: 0 });
  assert.deepEqual(orientationDepth(999, -999), { x: -1, y: 1 });
  const landscape = orientationDepth(12, 0, 90);
  assert.ok(Math.abs(landscape.x - 0.5) < 1e-10);
  assert.ok(Math.abs(landscape.y) < 1e-10);
});

test("depth CSS remains restrained and reduced motion resolves to rest", () => {
  const full = depthCss({ x: 1, y: -1 });
  assert.equal(full.rotateX, `${LOGIN_DEPTH.rotateXDeg.toFixed(3)}deg`);
  assert.equal(full.rotateY, `${LOGIN_DEPTH.rotateYDeg.toFixed(3)}deg`);
  assert.equal(full.sceneX, `${LOGIN_DEPTH.sceneTravelPx.toFixed(3)}px`);
  assert.deepEqual(depthCss({ x: 1, y: 1 }, true), {
    rotateX: "0.000deg", rotateY: "0.000deg",
    sceneX: "0.000px", sceneY: "0.000px",
    cardX: "0.000px", cardY: "0.000px",
    glareX: "50.00%", glareY: "50.00%",
  });
});

test("login controller is permission-gated, coalesced and torn down", () => {
  const source = fs.readFileSync(new URL("../js/views/prijava.js", import.meta.url), "utf8");
  assert.match(source, /DeviceOrientationEvent/);
  assert.match(source, /requestPermission/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /orientationBaseline/);
  assert.match(source, /removeEventListener\("deviceorientation"/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("login remains an honest, enabled doorway on an unconfigured static build", () => {
  const source = fs.readFileSync(new URL("../js/views/prijava.js", import.meta.url), "utf8");
  assert.match(source, /prijava\.guest/);
  assert.match(source, /class="btn btn-primary pr-guest" href="#\/" data-pr-enter/);
  assert.match(source, /fieldset\$\{configured \? "" : " disabled"\}/);
});

test("the photo-directed threshold is project-local and available offline", () => {
  const style = fs.readFileSync(new URL("../js/login-photo-style.js", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../js/views/prijava.js", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
  assert.doesNotMatch(style, /url\s*\(/, "login styling imports an external or embedded image");
  assert.match(source, /assets\/images\/login-interior-cinematic\.webp/);
  assert.doesNotMatch(source.slice(source.indexOf("function sceneMarkup"), source.indexOf("function thresholdMarkup")), /pr-scene-copy|sceneTitle|sceneBody/,
    "text leaked behind the login card");
  assert.match(worker, /"\.\/js\/login-depth\.js"/);
  assert.match(worker, /"\.\/js\/login-photo-style\.js"/);
  assert.match(worker, /"\.\/assets\/images\/login-interior-cinematic\.webp"/);
});
