const { basename, join, resolve } = require('node:path');
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
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

// Chromium's networkidle lifecycle also waits for renderer idle time. Continuous
// software WebGL can prevent it even after every request completes. Observe the
// game's actual readiness instead, without extending timeouts or skipping frames.
async function loadGame(page, url, debugName, { reload = false } = {}) {
  const pending = new Set();
  const messages = [];
  const listeners = {
    request: (request) => pending.add(request.url()),
    requestfinished: (request) => pending.delete(request.url()),
    requestfailed: (request) => {
      pending.delete(request.url());
      messages.push(`${request.failure()?.errorText}: ${request.url()}`);
    },
    pageerror: (error) => messages.push(error.message),
    console: (message) => {
      if (['error', 'warn'].includes(message.type())) messages.push(message.text());
    },
  };
  for (const [event, listener] of Object.entries(listeners)) page.on(event, listener);
  try {
    if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
    else await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (name) => {
        const game = window[name];
        const loaded = document.getElementById('load-state')?.classList.contains('hidden');
        if (!game || !loaded) return false;
        return (
          !game.renderer ||
          (game.renderer.info.render.frame > 0 &&
            game.renderer.info.render.calls > 0 &&
            !game.renderer.getContext().isContextLost())
        );
      },
      { polling: 50 },
      debugName,
    );
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  } catch (error) {
    const path = artifactPath(`${debugName}-load-failure.json`);
    writeFileSync(
      path,
      JSON.stringify(
        { url: page.url(), error: error.message, pending: [...pending], messages },
        null,
        2,
      ),
    );
    throw new Error(`Game did not become ready; diagnostics: ${path}`, { cause: error });
  } finally {
    for (const [event, listener] of Object.entries(listeners)) page.off(event, listener);
  }
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

module.exports = { ...browser, artifactPath, loadGame, settlePage, settleCamera };
