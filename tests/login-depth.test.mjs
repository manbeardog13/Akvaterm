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

test("the photo-directed threshold is project-local and available offline", () => {
  assert.doesNotMatch(style, /url\s*\(/, "login styling imports an external or embedded image");
  assert.match(source, /assets\/images\/login-interior-dark-4k\.webp/);
  assert.match(source, /assets\/images\/login-interior-light-4k\.webp/);
  assert.match(source, /width="2160" height="3840"/);
  assert.doesNotMatch(
    source.slice(source.indexOf("function sceneMarkup"), source.indexOf("function thresholdMarkup")),
    /pr-scene-copy|sceneTitle|sceneBody/,
    "text leaked behind the login card",
  );
  assert.match(worker, /"\.\/js\/login-photo-style\.js"/);
  assert.match(worker, /"\.\/assets\/images\/login-interior-dark-4k\.webp"/);
  assert.match(worker, /"\.\/assets\/images\/login-interior-light-4k\.webp"/);
});

test("both 4K room states are substantial but remain static-host friendly", () => {
  for (const name of ["login-interior-dark-4k.webp", "login-interior-light-4k.webp"]) {
    const stat = fs.statSync(new URL(`../assets/images/${name}`, import.meta.url));
    assert.ok(stat.size > 250_000, `${name} is unexpectedly empty or placeholder-sized`);
    assert.ok(stat.size < 800_000, `${name} regressed to ${stat.size} bytes`);
  }
});
