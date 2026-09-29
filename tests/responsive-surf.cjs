const { test } = require('node:test');
// Run against the local HTTP server to check compact layouts and input reachability.
const assert = require('node:assert/strict');
const {
  launchBrowser,
  loadGame,
  closeBrowser,
  artifactPath,
  settleCamera,
} = require('./helpers/browser.cjs');
const { assertCompactDrivingUI } = require('./helpers/driving-controls.cjs');
const { assertJeepControls, exerciseJeepResponsiveTouch } = require('./helpers/jeep-controls.cjs');
const gameURL = new URL(
  process.env.GAME_URL ||
    new URL('surf-riders.html', process.env.SITE_URL || 'http://localhost:8000/'),
);
gameURL.searchParams.set('debug', '1');
const url = gameURL.href;
const viewports = [
  [320, 568, true],
  [360, 640, true],
  [375, 667, true],
  [390, 844, true],
  [568, 320, true],
  [667, 375, true],
  [844, 390, true],
  [667, 600, true],
  [651, 621, true],
  [700, 650, true],
  [768, 1024, true],
  [820, 1180, true],
  [1024, 768, true],
  [1180, 820, true],
  // Touch-capable laptops can report a fine primary pointer.
  [1024, 768, false, true],
  [667, 600, false, true],
  [1024, 600, false],
  [1280, 720, false],
  [1366, 768, false],
];

async function inspectLayout(page, label, playing) {
  const layout = await page.evaluate((playing) => {
    const visible = (element) =>
      element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none';
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const controls = [...document.querySelectorAll('button')].filter(visible).map((button) => {
      const r = rect(button);
      return {
        id: button.id || button.dataset.control,
        inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        reachable: button.contains(
          document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
        ),
      };
    });
    const selectors = [
      '.game-brand',
      '.stats',
      '.dispatch',
      '.coconut-hud',
      '.map-panel',
      '.speedometer',
      '.target',
      '.bottom-bar button',
      '.touch-controls button',
    ];
    const panels = playing
      ? selectors
          .flatMap((selector) =>
            [...document.querySelectorAll(selector)].map((element) => [selector, element]),
          )
          .filter(([, element]) => visible(element))
          .map(([selector, element]) => [selector, rect(element)])
      : [];
    const overlaps = [];
    for (let i = 0; i < panels.length; i++)
      for (let j = i + 1; j < panels.length; j++) {
        const [a, r] = panels[i],
          [b, s] = panels[j];
        if (r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top)
          overlaps.push(`${a} / ${b}`);
      }
    const viewport = rect(document.querySelector('#viewport'));
    const canvas = rect(document.querySelector('#viewport canvas'));
    return {
      controls,
      overlaps,
      scrollY,
      overflowX: document.documentElement.scrollWidth > innerWidth,
      overflowY: document.documentElement.scrollHeight > innerHeight,
      canvasFits:
        Math.abs(canvas.width - viewport.width) < 1 &&
        Math.abs(canvas.height - viewport.height) < 1,
    };
  }, playing);
  assert.equal(layout.overflowX, false, `${label}: no horizontal overflow`);
  assert.equal(layout.overflowY, false, `${label}: game fits the viewport without scrolling`);
  assert.equal(layout.scrollY, 0, `${label}: starting/pausing does not scroll the page`);
  assert.equal(layout.canvasFits, true, `${label}: WebGL canvas matches its viewport`);
  assert.deepEqual(layout.overlaps, [], `${label}: HUD panels do not overlap`);
  for (const control of layout.controls) {
    assert.equal(control.inside, true, `${label}: ${control.id} is inside the viewport`);
    assert.equal(control.reachable, true, `${label}: ${control.id} is not clipped or covered`);
  }
}

test('responsive surf', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [width, height, hasTouch, hybrid = false] of viewports) {
      const label = `${width}×${height}${hybrid ? ' hybrid' : ''}`;
      await page.setViewport({
        width,
        height,
        hasTouch,
        isMobile: hasTouch && width < 900,
        deviceScaleFactor: 1,
      });
      const hybridSetup = hybrid
        ? await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
          })
        : null;
      await loadGame(page, url, 'surfDebug');
      if (hybridSetup) {
        await page.removeScriptToEvaluateOnNewDocument(hybridSetup.identifier);
        assert.ok(
          await page.evaluate(
            () => matchMedia('(pointer: fine)').matches && navigator.maxTouchPoints === 5,
          ),
          `${label}: fixture has a fine primary pointer and touch capability`,
        );
      }
      await inspectLayout(page, `${label} menu`, false);
      await page.click('#start');
      await inspectLayout(page, `${label} driving`, true);
      if (hasTouch || hybrid) {
        await settleCamera(page, 'surfDebug');
        await assertJeepControls(page, label);
        if (hasTouch) await exerciseJeepResponsiveTouch(page, label);
      }
      await assertCompactDrivingUI(page, label);
      await page.click('#pause');
      assert.equal(await page.evaluate(() => surfDebug.state.mode), 'paused');
      await inspectLayout(page, `${label} paused`, false);
      await page.click('#restart');
      assert.equal(await page.evaluate(() => surfDebug.state.mode), 'playing');
      await page.evaluate(() => surfDebug.endGame());
      await inspectLayout(page, `${label} results`, false);
      await page.click('#start');
      assert.equal(await page.evaluate(() => surfDebug.state.mode), 'playing');
      if (width === 320 || width === 568) {
        await settleCamera(page, 'surfDebug');
        await page.screenshot({ path: artifactPath(`surf-responsive-${width}-${height}.png`) });
      }
    }
    // Simulate the CSS safe-area values supplied by notched landscape phones.
    await page.setViewport({ width: 844, height: 390, hasTouch: true, isMobile: true });
    await loadGame(page, url, 'surfDebug');
    await page.addStyleTag({
      content: ':root { --safe-left: 44px; --safe-right: 44px; --safe-bottom: 21px; }',
    });
    await inspectLayout(page, 'landscape safe area menu', false);
    await page.click('#start');
    await inspectLayout(page, 'landscape safe area driving', true);
    await settleCamera(page, 'surfDebug');
    await assertJeepControls(page, 'landscape safe area driving');
    await exerciseJeepResponsiveTouch(page, 'landscape safe area driving');
    await assertCompactDrivingUI(page, 'landscape safe area driving');
    await page.evaluate(() => surfDebug.endGame());
    await inspectLayout(page, 'landscape safe area results', false);
    assert.deepEqual(errors, [], 'No browser errors across the responsive matrix');
    console.log(
      `PASS: Surf Riders menus, replay, HUD, and touch/control reachability at ${viewports.length} phone/tablet/laptop sizes plus landscape safe areas.`,
    );
  } finally {
    await closeBrowser(browser);
  }
});
