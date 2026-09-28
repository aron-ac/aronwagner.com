const { basename, join, resolve } = require('node:path');
const { mkdirSync, mkdtempSync } = require('node:fs');
const browser = require('../../tools/lib/browser.cjs');

let artifacts;
function artifactPath(filename) {
  if (!artifacts) {
    const root = resolve(process.env.TEST_ARTIFACT_DIR || 'test-results');
    mkdirSync(root, { recursive: true });
    artifacts = mkdtempSync(join(root, `${basename(process.argv[1], '.cjs')}-`));
  }
  return join(artifacts, basename(filename));
}

// Wait on completed CSS transitions and loaded assets, never an assumed duration.
async function settlePage(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((image) => image.currentSrc)
        .map((image) => image.decode().catch(() => {})),
    );
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}

// Camera easing has no transition event; observe its actual transform until it settles.
async function settleCamera(page, debugName) {
  await page.evaluate((name) => {
    delete window.__testCameraSnapshot;
    window.__testCamera = name;
  }, debugName);
  await page.waitForFunction(() => {
    const camera = window[window.__testCamera].camera;
    const values = [...camera.position.toArray(), ...camera.quaternion.toArray()];
    const previous = window.__testCameraSnapshot;
    const stable =
      previous && values.every((value, index) => Math.abs(value - previous.values[index]) < 0.003);
    const count = stable ? previous.count + 1 : 0;
    window.__testCameraSnapshot = { values, count };
    return count >= 5;
  });
}

module.exports = { ...browser, artifactPath, settlePage, settleCamera };
