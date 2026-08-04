import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../js/views/prijava.js", import.meta.url), "utf8");
const style = fs.readFileSync(new URL("../js/login-photo-style.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("the idle login has no device-orientation motion path, and no scene parallax", () => {
  assert.doesNotMatch(source, /login-depth|DeviceOrientationEvent|deviceorientation|orientationchange/);
  assert.doesNotMatch(source, /pointerDepth|orientationDepth|wirePhotoDepth|requestPermission/);
  // The scene/background never moves on pointer input — only the card's own
  // glass sheen may (see login-handoff.test.mjs's "deliberate mouse-hover
  // feature" test), and it does so through --pr-gx/--pr-gy, never any of the
  // old login-depth.js parallax property names.
  assert.doesNotMatch(source, /--pr-scene-[xy]|--pr-card-[xy]|--pr-glare-[xy]/);
  assert.doesNotMatch(style, /--pr-scene-[xy]|--pr-card-[xy]|--pr-glare-[xy]/);
  assert.doesNotMatch(style, /\.pr-scene[^{]*\{[^}]*var\(--pr-g[xy]/);
  assert.doesNotMatch(worker, /"\.\/js\/login-depth\.js"/);
});

test("login remains an honest, enabled doorway on an unconfigured static build", () => {
  assert.match(source, /prijava\.guest/);
  assert.match(source, /class="btn btn-primary pr-guest" href="#\/atelier" data-pr-enter/);
  assert.match(source, /fieldset\$\{configured \? "" : " disabled"\}/);
});

test("the photo-directed threshold is project-local, served from the network", () => {
  // "Available offline" is no longer a claim this makes — the service
  // worker is retired (operator instruction, 2026-08-04) and precaches
  // nothing. What's still true, and still worth pinning: the photos are
  // shipped project assets, not an external or embedded image service.
  assert.doesNotMatch(style, /url\s*\(/, "login styling imports an external or embedded image");
  assert.match(source, /assets\/images\/login-interior-dark-4k\.webp/);
  assert.match(source, /assets\/images\/login-interior-light-4k\.webp/);
  assert.match(source, /width="2160" height="3840"/);
  assert.doesNotMatch(
    source.slice(source.indexOf("function sceneMarkup"), source.indexOf("function thresholdMarkup")),
    /pr-scene-copy|sceneTitle|sceneBody/,
    "text leaked behind the login card",
  );
});

test("the service worker is a kill switch, not a cache", () => {
  // Operator instruction, 2026-08-04: destroy the service worker outright —
  // it was serving stale JS/CSS across deploys with no way to bust it short
  // of a version bump, which is exactly what caused a broken, mismatched
  // login render to go live. This asserts it precaches NOTHING and instead
  // aggressively tears itself down: skipWaiting, clients.claim (so already-
  // open tabs are reached, not just future navigations), delete every
  // cache, unregister, then force every controlled window to reload.
  assert.doesNotMatch(worker, /"\.\/js\/login-photo-style\.js"|"\.\/assets\/images\/login-interior/);
  assert.doesNotMatch(worker, /const SHELL|caches\.open\(|\.addAll\(/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(worker, /caches\.delete\(key\)/);
  assert.match(worker, /self\.registration\.unregister\(\)/);
  assert.match(worker, /client\.navigate\(client\.url\)/);
  assert.match(worker, /akv:sw-retired/);
  const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /event\.data\?\.type === "akv:sw-retired"\) location\.reload\(\)/);
});

test("both 4K room states are substantial but remain static-host friendly", () => {
  for (const name of ["login-interior-dark-4k.webp", "login-interior-light-4k.webp"]) {
    const stat = fs.statSync(new URL(`../assets/images/${name}`, import.meta.url));
    assert.ok(stat.size > 250_000, `${name} is unexpectedly empty or placeholder-sized`);
    assert.ok(stat.size < 800_000, `${name} regressed to ${stat.size} bytes`);
  }
});
